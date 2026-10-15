import type {Entry} from './model';
export type HabitFrequency='Diária'|'Semanal'|'Personalizada';
export type Habit=Entry&{frequency:HabitFrequency;category:string;doneDates:string;icon:string;notes:string;startDate:string;scheduleDays:string;targetPerWeek:number;archived:boolean;archivedAt:string;reminderTime:string};
export const HABIT_CATEGORIES=['Saúde','Estudos','Pessoal','Trabalho','Bem-estar','Fitness','Casa','Finanças','Outros'] as const;
export const HABIT_ICONS=['🌱','💧','📚','💪','🧘','🏃','🥗','😴','✍️','💊','🪥','🧹','💰','🎯','☀️','🚶','🧠','❤️','📵','🎨','🎵','🐾','🏡','🕯️'] as const;
export const WEEKDAYS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'] as const;
const short=(value:unknown,limit=180)=>typeof value==='string'?value.slice(0,limit):'';
export const validHabitDate=(s:unknown):s is string=>{
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
};
export function moveHabitDate(day:string,shift:number){
 if(!validHabitDate(day)||!Number.isInteger(shift)||Math.abs(shift)>50000)throw Error('Data inválida.');
 const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+shift);return date.toISOString().slice(0,10);
}
export const dayOfHabitWeek=(day:string)=>(new Date(day+'T12:00:00Z').getUTCDay()+6)%7;
export const weekBeginning=(day:string)=>moveHabitDate(day,-dayOfHabitWeek(day));
export const completedDays=(habit:Pick<Habit,'doneDates'>)=>new Set(String(habit.doneDates||'').split(',').filter(validHabitDate));
export function normalizeHabit(raw:Entry):Habit{
 const freq:HabitFrequency=raw.frequency==='Semanal'||raw.frequency==='Personalizada'?raw.frequency:'Diária';
 const done=[...completedDays({doneDates:String(raw.doneDates||'')})].sort();
 const recorded=validHabitDate(raw.startDate)?raw.startDate:validHabitDate(String(raw.createdAt||'').slice(0,10))?String(raw.createdAt).slice(0,10):done[0]||'2000-01-01';
 const start=validHabitDate(raw.startDate)?raw.startDate:done.length&&done[0]<recorded?done[0]:recorded;
 const weekdays=[...new Set(String(raw.scheduleDays||'0,1,2,3,4,5,6').split(',').map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))].sort();
 return {...raw,title:short(raw.title),category:short(raw.category,60)||'Pessoal',frequency:freq,
  doneDates:done.join(','),icon:short(raw.icon,12)||'🌱',notes:short(raw.notes,4000),startDate:start,
  scheduleDays:weekdays.length?weekdays.join(','):'0,1,2,3,4,5,6',
  targetPerWeek:Math.min(7,Math.max(1,Number.isInteger(Number(raw.targetPerWeek))?Number(raw.targetPerWeek):3)),
  archived:raw.archived===true,archivedAt:validHabitDate(raw.archivedAt)?raw.archivedAt:'',
  reminderTime:/^\d{2}:\d{2}$/.test(String(raw.reminderTime||''))?String(raw.reminderTime):''};
}
export const scheduleDays=(h:Habit)=>new Set(h.scheduleDays.split(',').map(Number).filter(Number.isInteger));
export function eligible(h:Habit,day:string):boolean{
 if(!validHabitDate(day)||day<h.startDate||h.archivedAt&&day>=h.archivedAt)return false;
 return h.frequency!=='Personalizada'||scheduleDays(h).has(dayOfHabitWeek(day));
}
export function isDue(h:Habit,day:string):boolean{
 if(!eligible(h,day))return false;
 if(h.frequency==='Semanal')return weeklyCount(h,day)<h.targetPerWeek;
 return true;
}
export function weeklyCount(h:Habit,day:string):number{
 const start=weekBeginning(day),end=moveHabitDate(start,6);
 return [...completedDays(h)].filter(d=>d>=start&&d<=end&&eligible(h,d)).length;
}
export function hasCompletion(h:Habit,day:string){return completedDays(h).has(day)}
export function toggleHabit(h:Habit,day:string,now:string):Habit{
 if(!validHabitDate(day)||day>now||!eligible(h,day))throw Error('Este dia não está disponível para o hábito.');
 const values=completedDays(h);
 if(values.has(day))values.delete(day);else values.add(day);
 return {...h,doneDates:[...values].sort().join(',')};
}
export function habitStreak(h:Habit,day:string):number{
 if(!validHabitDate(day)||day<h.startDate)return 0;
 const done=completedDays(h);
 if(h.frequency==='Semanal'){
  let cursor=weekBeginning(day),score=0;
  if(weeklyCount(h,day)<h.targetPerWeek)cursor=moveHabitDate(cursor,-7);
  for(let i=0;i<520&&cursor>=weekBeginning(h.startDate);i++,cursor=moveHabitDate(cursor,-7)){
   if(weeklyCount(h,cursor)<h.targetPerWeek)break;score++;
  }
  return score;
 }
 let cursor=day;
 if(!eligible(h,cursor)||!done.has(cursor))cursor=moveHabitDate(cursor,-1);
 let score=0;
 for(let i=0;i<15000&&cursor>=h.startDate;i++,cursor=moveHabitDate(cursor,-1)){
  if(!eligible(h,cursor))continue;
  if(!done.has(cursor))break;
  score++;
 }
 return score;
}
export function habitStats(h:Habit,day:string){
 const done=completedDays(h),start30=moveHabitDate(day,-29),eligibleDays:string[]=[];
 for(let cursor=start30;cursor<=day;cursor=moveHabitDate(cursor,1))if(eligible(h,cursor))eligibleDays.push(cursor);
 const eligibleCompletions=eligibleDays.filter(d=>done.has(d)).length;
 const weekCount=weeklyCount(h,day);
 const expected=h.frequency==='Semanal'?h.targetPerWeek:eligibleDays.length;
 let expectedWindow=eligibleDays.length;
 if(h.frequency==='Semanal'){
  expectedWindow=0;
  for(let week=weekBeginning(start30);week<=day;week=moveHabitDate(week,7)){
   const end=moveHabitDate(week,6);
   const possible=eligibleDays.filter(d=>d>=week&&d<=end).length;
   expectedWindow+=Math.min(possible,h.targetPerWeek);
  }
 }
 const pct=h.frequency==='Semanal'?Math.round(Math.min(100,weekCount/h.targetPerWeek*100)):expected?Math.round(eligibleCompletions/expected*100):0;
 return {streak:habitStreak(h,day),completedToday:done.has(day),weekly:weekCount,
  total:[...done].filter(d=>d<=day&&eligible(h,d)).length,last30:eligibleCompletions,last30Expected:expectedWindow,
  rate30:expectedWindow?Math.round(Math.min(100,100*eligibleCompletions/expectedWindow)):0,
  progress:pct,expected,dueToday:isDue(h,day),dueDays30:eligibleDays};
}
export function habitCalendar(habits:Habit[],month:string,now:string){
 if(!/^\d{4}-\d{2}$/.test(month))return [];
 const [year,m]=month.split('-').map(Number);if(year<2000||year>2100||m<1||m>12)return [];
 return Array.from({length:new Date(Date.UTC(year,m,0)).getUTCDate()},(_,idx)=>{
  const day=month+'-'+String(idx+1).padStart(2,'0');
  return {day,completed:day<=now?habits.filter(h=>eligible(h,day)&&hasCompletion(h,day)).length:0,
   completedScheduled:day<=now?habits.filter(h=>h.frequency!=='Semanal'&&eligible(h,day)&&hasCompletion(h,day)).length:0,
   expected:habits.filter(h=>h.frequency!=='Semanal'&&eligible(h,day)).length,
   pending:day<=now?habits.filter(h=>h.frequency!=='Semanal'&&eligible(h,day)&&!hasCompletion(h,day)).length:0};
 });
}
export function overallHabits(habits:Habit[],day:string){
 const active=habits.filter(h=>!h.archived);
 const todays=active.filter(h=>isDue(h,day)||hasCompletion(h,day)&&eligible(h,day));
 const completed=todays.filter(h=>hasCompletion(h,day));
 const weekStart=weekBeginning(day),weekly=active.filter(h=>h.frequency==='Semanal');
 return {active:active.length,todays:todays.length,completed:completed.length,remaining:todays.length-completed.length,
  progress:todays.length?Math.round(100*completed.length/todays.length):0,
  weeklyCompleted:weekly.filter(h=>weeklyCount(h,day)>=h.targetPerWeek).length,
  weeklyTotal:weekly.length,weekStart};
}
export const habitTemplates=[
 {title:'Beber água',icon:'💧',category:'Saúde',frequency:'Diária',notes:'Registrar uma vez ao atingir a meta pessoal de hidratação.'},
 {title:'Ler por 20 minutos',icon:'📚',category:'Estudos',frequency:'Diária',notes:'Dedicar tempo à leitura.'},
 {title:'Movimentar o corpo',icon:'🏃',category:'Fitness',frequency:'Personalizada',scheduleDays:'0,1,2,3,4'},
 {title:'Meditar 10 minutos',icon:'🧘',category:'Bem-estar',frequency:'Diária'},
 {title:'Organizar minhas finanças',icon:'💰',category:'Finanças',frequency:'Semanal',targetPerWeek:1},
 {title:'Arrumar o quarto',icon:'🧹',category:'Casa',frequency:'Semanal',targetPerWeek:2},
 {title:'Estudar uma disciplina',icon:'🧠',category:'Estudos',frequency:'Personalizada',scheduleDays:'0,1,2,3,4'},
 {title:'Dormir no horário planejado',icon:'😴',category:'Bem-estar',frequency:'Diária'}
] as const;
