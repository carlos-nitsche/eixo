import type {CompletedSet, MuscleId, WorkoutSession} from './training';

export type TrainingTime={now:string;timeZone:string};
export type StreakMode='calendar-days'; // Future policies can be added without storing a derived score.
export const validDay=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function shiftDay(day:string,delta:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10)}
const zoneCache=new Map<string,string>();
const dateFormatters=new Map<string,Intl.DateTimeFormat>();
const localFormatters=new Map<string,Intl.DateTimeFormat>();
export function resolveTimeZone(zone?:string){const key=zone||'local';if(zoneCache.has(key))return zoneCache.get(key)!;let value='UTC';try{value=zone||Intl.DateTimeFormat().resolvedOptions().timeZone;new Intl.DateTimeFormat('en',{timeZone:value})}catch{value='UTC'}zoneCache.set(key,value);return value}
export function dateInZone(instant:string,zone:string):string|null{
 if(!instant||!Number.isFinite(Date.parse(instant)))return null;
 const tz=resolveTimeZone(zone);if(!dateFormatters.has(tz))dateFormatters.set(tz,new Intl.DateTimeFormat('en',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}));
 const parts=dateFormatters.get(tz)!.formatToParts(new Date(instant));
 return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');
}
export function localDateTime(instant:string,zone:string){
 if(!Number.isFinite(Date.parse(instant)))return '';
 const tz=resolveTimeZone(zone);if(!localFormatters.has(tz))localFormatters.set(tz,new Intl.DateTimeFormat('en',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
 const p=localFormatters.get(tz)!.formatToParts(new Date(instant));
 const get=(key:string)=>p.find(x=>x.type===key)?.value;
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
/** Reject nonexistent DST wall times; choose the earlier occurrence of a repeated time. */
export function instantFromLocal(value:string,zone:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!validDay(value.slice(0,10)))return null;
 const guess=Date.parse(value+'Z');if(!Number.isFinite(guess))return null;
 const candidates=new Set<number>();
 for(const delta of [-86400000,0,86400000]){const stamp=guess+delta,wall=localDateTime(new Date(stamp).toISOString(),zone),offset=Date.parse(wall+'Z')-stamp,candidate=guess-offset;if(localDateTime(new Date(candidate).toISOString(),zone)===value)candidates.add(candidate)}
 return candidates.size?new Date(Math.min(...candidates)).toISOString():null;
}
export const validCompletedSet=(s:CompletedSet)=>s.done===true&&s.kind==='working'&&Number.isFinite(s.reps)&&s.reps>0&&s.reps<=1000&&Number.isFinite(s.load)&&s.load>=0&&s.load<=100000;
export function sessionSummary(session:WorkoutSession){
 const muscles=new Set<MuscleId>();let sets=0,volume=0,exerciseCount=0,cardioMinutes=0;
 for(const ex of session.exercises||[]){const valid=(ex.sets||[]).filter(validCompletedSet);const cardio=ex.kind==='cardio'&&Number.isFinite(ex.minutes)&&Number(ex.minutes)>0&&Number(ex.minutes)<=1440?Number(ex.minutes):0;
  if(valid.length||cardio){exerciseCount++;muscles.add(ex.primary);(ex.secondary||[]).forEach(m=>muscles.add(m))}
  if(ex.kind==='strength'){sets+=valid.length;volume+=valid.reduce((n,s)=>n+s.load*s.reps,0)}cardioMinutes+=cardio;
 }
 const elapsed=session.finishedAt?(Date.parse(session.finishedAt)-Date.parse(session.startedAt))/60000:NaN;
 return {sets,volume:Math.round(volume*100)/100,exerciseCount,cardioMinutes,muscles:[...muscles],durationMinutes:Number.isFinite(elapsed)&&elapsed>=0?Math.round(elapsed):null};
}
/** Explicit completion + actual work; a planned or future record never earns a day. */
export function completedSessionDate(session:WorkoutSession,time:TrainingTime):string|null{
 if(session.status!=='completed')return null;
 const summary=sessionSummary(session);if(!summary.sets&&!summary.cardioMinutes)return null;
 const today=dateInZone(time.now,time.timeZone);if(!today)return null;
 if(session.finishedAt){
  const end=Date.parse(session.finishedAt),start=Date.parse(session.startedAt);
  if(!Number.isFinite(end)||end>Date.parse(time.now)||(Number.isFinite(start)&&start>end))return null;
  return dateInZone(session.finishedAt,time.timeZone);
 }
 // Old explicitly completed sessions with verified work may have a local date only.
 return validDay(session.date)&&session.date<=today?session.date:null;
}
export function uniqueCompletedDays(sessions:WorkoutSession[],workspaceId:string,time:TrainingTime){
 return [...new Set(sessions.filter(s=>s.workspaceId===workspaceId).map(s=>completedSessionDate(s,time)).filter((d):d is string=>!!d))].sort();
}
export function trainingStreak(sessions:WorkoutSession[],workspaceId:string,time:TrainingTime,mode:StreakMode='calendar-days'){
 const days=uniqueCompletedDays(sessions,workspaceId,time),today=dateInZone(time.now,time.timeZone)!;
 let best=0,run=0,previous='';for(const day of days){run=previous&&shiftDay(previous,1)===day?run+1:1;best=Math.max(best,run);previous=day}
 const todayCompleted=days.includes(today),last=days.at(-1);let current=0;
 if(last===today||last===shiftDay(today,-1)){for(let i=days.length-1;i>=0;i--){if(i===days.length-1||shiftDay(days[i],1)===days[i+1])current++;else break}}
 return {mode,days,current,best,todayCompleted,atRisk:current>0&&!todayCompleted,state:todayCompleted?'active' as const:current>0?'at-risk' as const:'broken' as const,totalDays:days.length,monthDays:days.filter(d=>d.startsWith(today.slice(0,7))).length,isRecord:todayCompleted&&current===best&&current>0};
}
export function groupSessionsByDate(sessions:WorkoutSession[],workspaceId:string,time:TrainingTime){
 const completed:Record<string,WorkoutSession[]>={},active:Record<string,WorkoutSession[]>={},legacy:WorkoutSession[]=[];
 for(const session of sessions.filter(s=>s.workspaceId===workspaceId)){
  const date=completedSessionDate(session,time);
  if(date){(completed[date]??=[]).push(session);continue}
  if(session.status==='in_progress'||session.status==='paused'){
   const start=dateInZone(session.startedAt,time.timeZone)||(validDay(session.date)?session.date:null);
   if(start)(active[start]??=[]).push(session);
  }else legacy.push(session);
 }
 for(const list of Object.values(completed))list.sort((a,b)=>(a.finishedAt||a.date).localeCompare(b.finishedAt||b.date));
 return {completed,active,legacy};
}
export function monthStatistics(sessions:WorkoutSession[],workspaceId:string,month:string,time:TrainingTime){
 const today=dateInZone(time.now,time.timeZone)!,days=uniqueCompletedDays(sessions,workspaceId,time).filter(d=>d.startsWith(month)),first=month+'-01';
 const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
 const elapsed=month>today.slice(0,7)?0:month===today.slice(0,7)?Number(today.slice(8)):end;
 const grouped=groupSessionsByDate(sessions,workspaceId,time);
 return {days,trainedDays:days.length,sessionCount:days.reduce((n,d)=>n+(grouped.completed[d]?.length||0),0),elapsedDays:elapsed,frequency:elapsed?Math.round(days.length/elapsed*100):0,daysInMonth:end,offset:(new Date(first+'T12:00:00Z').getUTCDay()+6)%7};
}
export function estimatedPlanMinutes(items:{sets:number;reps:number;restSeconds:number;durationMinutes?:number;exerciseId:string}[],library:{id:string;kind:string}[]){
 return Math.ceil(items.reduce((n,p)=>n+(library.find(e=>e.id===p.exerciseId)?.kind==='cardio'?(p.durationMinutes||0):p.sets*p.reps*3/60+Math.max(0,p.sets-1)*p.restSeconds/60+1),0));
}
