export type StudyPlan={sourceNoteId?:string;id:string;workspaceId:string;subjectId:string;title:string;date:string;minutes:number;done:boolean;createdAt:string;completedAt?:string;notes:string};
export type StudyCard={sourceNoteId?:string;id:string;workspaceId:string;subjectId:string;front:string;back:string;createdAt:string;dueDate:string;interval:number;ease:number;reviews:number;lastGrade?:number;lastReviewedAt?:string};
export type StudyReview={id:string;workspaceId:string;cardId:string;at:string;grade:number;previousDue:string;nextDue:string};
export type StudyExam={id:string;workspaceId:string;subjectId:string;title:string;date:string;weight:number;grade?:number;maximum:number;notes:string};
export type StudyFocus={sourceNoteId?:string;workspaceId:string;subjectId:string;title:string;targetMinutes:number;startedAt:string|null;accumulatedSeconds:number};
export type StudyData={version:1;plans:StudyPlan[];cards:StudyCard[];reviews:StudyReview[];exams:StudyExam[];focus:StudyFocus[];weeklyGoalMinutes:number};
export const emptyStudy=():StudyData=>({version:1,plans:[],cards:[],reviews:[],exams:[],focus:[],weeklyGoalMinutes:300});
const rec=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const list=(v:unknown)=>Array.isArray(v)?v.filter(rec):[];
const val=(n:unknown,def=0,max=1e6)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max?n:def;
const string=(v:unknown,max=200)=>typeof v==='string'?v.slice(0,max):'';
export const isoDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'));
export function shiftStudyDate(ymd:string,days:number):string{
 if(!isoDate(ymd)||!Number.isInteger(days)||Math.abs(days)>100000)throw Error('Data de revisão inválida');
 const d=new Date(ymd+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
export function parseStudy(raw?:Partial<StudyData>|null):StudyData{
 const b=emptyStudy();if(!rec(raw))return b;
 const plans=list(raw.plans).filter(x=>typeof x.id==='string'&&typeof x.workspaceId==='string'&&isoDate(String(x.date))).map(x=>({
  sourceNoteId:string(x.sourceNoteId),id:string(x.id),workspaceId:string(x.workspaceId),subjectId:string(x.subjectId),title:string(x.title),date:string(x.date),
  minutes:val(x.minutes,30,1440),done:x.done===true,createdAt:string(x.createdAt),completedAt:typeof x.completedAt==='string'?x.completedAt:undefined,notes:string(x.notes,4000)
 })) as StudyPlan[];
 const cards=list(raw.cards).filter(x=>typeof x.id==='string'&&typeof x.workspaceId==='string').map(x=>({
  sourceNoteId:string(x.sourceNoteId),id:string(x.id),workspaceId:string(x.workspaceId),subjectId:string(x.subjectId),front:string(x.front,1500),back:string(x.back,5000),
  createdAt:string(x.createdAt),dueDate:isoDate(String(x.dueDate))?String(x.dueDate):'2000-01-01',
  interval:val(x.interval,0,3650),ease:val(x.ease,2.5,5),reviews:val(x.reviews,0,100000),
  lastGrade:typeof x.lastGrade==='number'&&x.lastGrade>=0&&x.lastGrade<=3?x.lastGrade:undefined,
  lastReviewedAt:typeof x.lastReviewedAt==='string'?x.lastReviewedAt:undefined
 })) as StudyCard[];
 const reviews=list(raw.reviews).filter(x=>typeof x.id==='string'&&typeof x.workspaceId==='string').map(x=>({
  id:string(x.id),workspaceId:string(x.workspaceId),cardId:string(x.cardId),at:string(x.at),
  grade:val(x.grade,0,3),previousDue:string(x.previousDue),nextDue:string(x.nextDue)
 })) as StudyReview[];
 const exams=list(raw.exams).filter(x=>typeof x.id==='string'&&typeof x.workspaceId==='string'&&isoDate(String(x.date))).map(x=>({
  sourceNoteId:string(x.sourceNoteId),id:string(x.id),workspaceId:string(x.workspaceId),subjectId:string(x.subjectId),title:string(x.title),date:string(x.date),
  weight:val(x.weight,1,100),grade:x.grade==null?undefined:val(x.grade,0,100),
  maximum:val(x.maximum,10,100),notes:string(x.notes,4000)
 })) as StudyExam[];
 const focus=list(raw.focus).filter(x=>typeof x.workspaceId==='string').map(x=>({
  sourceNoteId:string(x.sourceNoteId),workspaceId:string(x.workspaceId),subjectId:string(x.subjectId),title:string(x.title,300),
  targetMinutes:Math.min(240,Math.max(5,val(x.targetMinutes,25,240))),
  startedAt:typeof x.startedAt==='string'&&!Number.isNaN(Date.parse(x.startedAt))?x.startedAt:null,
  accumulatedSeconds:val(x.accumulatedSeconds,0,86400)
 })) as StudyFocus[];
 return {version:1,plans,cards,reviews,exams,focus,weeklyGoalMinutes:val(raw.weeklyGoalMinutes,300,10080)};
}
export function focusSeconds(focus:StudyFocus,now=new Date().toISOString()):number{
 const elapsed=focus.startedAt?Math.max(0,Math.floor((Date.parse(now)-Date.parse(focus.startedAt))/1000)):0;
 return Math.max(0,Math.min(86400,focus.accumulatedSeconds+elapsed));
}
export function reviewCard(card:StudyCard,grade:0|1|2|3,today:string,now:string):StudyCard{
 if(!isoDate(today)||![0,1,2,3].includes(grade))throw Error('Avaliação inválida');
 let interval:number,ease=card.ease||2.5;
 if(grade===0){interval=1;ease=Math.max(1.3,ease-.2)}
 else if(grade===1){interval=Math.max(2,Math.round((card.interval||1)*1.2));ease=Math.max(1.3,ease-.1)}
 else if(grade===2){interval=card.reviews===0?3:Math.max(4,Math.round((card.interval||3)*ease))}
 else{interval=card.reviews===0?5:Math.max(6,Math.round((card.interval||3)*(ease+.3)));ease=Math.min(3.2,ease+.1)}
 interval=Math.min(3650,interval);
 return {...card,interval,ease,reviews:card.reviews+1,dueDate:shiftStudyDate(today,interval),lastGrade:grade,lastReviewedAt:now};
}
export const dueCards=(cards:StudyCard[],day:string)=>cards.filter(c=>c.dueDate<=day).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
export function examAverage(exams:StudyExam[]):number|null{
 const recorded=exams.filter(e=>e.grade!==undefined&&e.maximum>0&&e.weight>0);
 const total=recorded.reduce((s,e)=>s+e.weight,0);
 return total?recorded.reduce((s,e)=>s+e.weight*(e.grade!/e.maximum*10),0)/total:null;
}
export function studySummary(studies:{date?:string|number|boolean;duration?:string|number|boolean}[],day:string,weeklyGoal:number){
 const monday=shiftStudyDate(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
 const mins=(arr:typeof studies)=>arr.reduce((s,x)=>s+(Number.isFinite(Number(x.duration))&&Number(x.duration)>0?Math.min(1440,Number(x.duration)):0),0);
 const valid=studies.filter(x=>typeof x.date==='string'&&isoDate(x.date)&&x.date<=day);
 const weekly=valid.filter(x=>String(x.date)>=monday);
 const dates=new Set(valid.filter(x=>Number(x.duration)>0).map(x=>String(x.date)));
 let streak=0,cursor=dates.has(day)?day:shiftStudyDate(day,-1);
 while(dates.has(cursor)&&streak<3650){streak++;cursor=shiftStudyDate(cursor,-1)}
 return {total:mins(valid),weekly:mins(weekly),today:mins(valid.filter(x=>x.date===day)),sessions:valid.length,streak,goalPct:weeklyGoal>0?Math.round(100*mins(weekly)/weeklyGoal):null};
}
export function studyCalendar(studies:{date?:string|number|boolean;duration?:string|number|boolean}[],plans:StudyPlan[],month:string,exams:StudyExam[]=[]){ 
 if(!/^\d{4}-\d{2}$/.test(month))return [];
 const [y,m]=month.split('-').map(Number),days=new Date(y,m,0).getDate();
 return Array.from({length:days},(_,i)=>{
  const day=month+'-'+String(i+1).padStart(2,'0');
  return {day,minutes:studies.filter(s=>s.date===day).reduce((v,s)=>v+Math.max(0,Number(s.duration)||0),0),planned:plans.filter(p=>p.date===day&&!p.done).length,done:plans.filter(p=>p.date===day&&p.done).length,exams:exams.filter(e=>e.date===day).length};
 });
}
