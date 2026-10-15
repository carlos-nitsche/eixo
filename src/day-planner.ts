// EIXO OS · 0.6.0 · TypeScript · deterministic daily planning and focus records.
import type {Entry} from './model';

export type FocusSession={id:string;workspaceId:string;taskId?:string;date:string;minutes:number;completedAt:string};
export type DayTask={item:Entry;overdue:boolean;priority:'Alta'|'Média'|'Baixa'};
export type DayEvent={item:Entry;time:string};
export type DayOverview={date:string;tasks:DayTask[];events:DayEvent[];pending:number;completed:number;overdue:number;dueToday:number;focusMinutes:number;focusCount:number};
const datePattern=/^(20\d\d|21\d\d)-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
export const isCalendarDate=(value:unknown):value is string=>{
 if(typeof value!=='string'||!datePattern.test(value))return false;
 const d=new Date(value+'T12:00:00.000Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
};
export const dayOffset=(date:string,delta:number)=>{
 if(!isCalendarDate(date))throw Error('Data inválida');
 const d=new Date(date+'T12:00:00.000Z');d.setUTCDate(d.getUTCDate()+delta);
 return d.toISOString().slice(0,10);
};
export const weekStrip=(date:string)=>Array.from({length:7},(_,i)=>dayOffset(date,i-3));
const scope=(record:{workspaceId?:string},workspaceId:string)=>(record.workspaceId||'pessoal')===workspaceId;
const priority=(record:Entry):DayTask['priority']=>record.priority==='Alta'?'Alta':record.priority==='Média'?'Média':'Baixa';
const priorityScore=(p:DayTask['priority'])=>p==='Alta'?3:p==='Média'?2:1;
export function normalizeFocusSessions(input:unknown):FocusSession[]{
 if(!Array.isArray(input))return [];
 const output:FocusSession[]=[],seen=new Set<string>();
 for(const raw of input.slice(-2000)){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const r=raw as Partial<FocusSession>;
  if(typeof r.id!=='string'||r.id.length<4||r.id.length>120||seen.has(r.id)||typeof r.workspaceId!=='string'||!r.workspaceId||r.workspaceId.length>120||!isCalendarDate(r.date)||typeof r.minutes!=='number'||!Number.isInteger(r.minutes)||r.minutes<1||r.minutes>180||typeof r.completedAt!=='string'||!Number.isFinite(Date.parse(r.completedAt)))continue;
  seen.add(r.id);
  output.push({id:r.id,workspaceId:r.workspaceId,date:r.date,minutes:r.minutes,completedAt:r.completedAt,...(typeof r.taskId==='string'&&r.taskId.length<=120?{taskId:r.taskId}:{})});
 }
 return output.slice(-1000);
}
export function dailyOverview(tasks:readonly Entry[],events:readonly Entry[],sessions:readonly FocusSession[],workspaceId:string,date:string,nowDate=date):DayOverview{
 if(!isCalendarDate(date)||!isCalendarDate(nowDate))throw Error('Data inválida');
 const scopedTasks=tasks.filter(t=>scope(t,workspaceId)),scopedEvents=events.filter(e=>scope(e,workspaceId));
 const taskRows=scopedTasks.filter(t=>{
  if(isCalendarDate(t.dueDate))return t.dueDate===date||(date===nowDate&&t.dueDate<date&&t.status!=='Concluído');
  return date===nowDate&&t.status!=='Concluído';
 }).map(item=>({item,overdue:isCalendarDate(item.dueDate)&&item.dueDate<date,priority:priority(item)}));
 taskRows.sort((a,b)=>{
  const doneA=a.item.status==='Concluído'?1:0,doneB=b.item.status==='Concluído'?1:0;
  return doneA-doneB||Number(b.overdue)-Number(a.overdue)||priorityScore(b.priority)-priorityScore(a.priority)||String(a.item.dueDate||'9999').localeCompare(String(b.item.dueDate||'9999'))||a.item.title.localeCompare(b.item.title,'pt-BR');
 });
 const eventRows=scopedEvents.filter(e=>e.date===date).map(item=>({item,time:typeof item.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)?item.time:''}));
 eventRows.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||a.item.title.localeCompare(b.item.title,'pt-BR'));
 const focused=sessions.filter(s=>s.workspaceId===workspaceId&&s.date===date);
 return {date,tasks:taskRows,events:eventRows,pending:taskRows.filter(t=>t.item.status!=='Concluído').length,completed:taskRows.filter(t=>t.item.status==='Concluído').length,overdue:taskRows.filter(t=>t.overdue).length,dueToday:taskRows.filter(t=>t.item.dueDate===date).length,focusMinutes:focused.reduce((sum,s)=>sum+s.minutes,0),focusCount:focused.length};
}
export function focusWeek(sessions:readonly FocusSession[],workspaceId:string,endDate:string){
 if(!isCalendarDate(endDate))throw Error('Data inválida');
 const start=dayOffset(endDate,-6);
 const scoped=sessions.filter(s=>s.workspaceId===workspaceId&&s.date>=start&&s.date<=endDate);
 return {minutes:scoped.reduce((sum,x)=>sum+x.minutes,0),count:scoped.length,days:Array.from({length:7},(_,i)=>{const date=dayOffset(start,i);const item=scoped.filter(s=>s.date===date);return {date,minutes:item.reduce((sum,s)=>sum+s.minutes,0),count:item.length}})};
}
