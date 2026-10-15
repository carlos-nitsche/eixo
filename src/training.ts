import type { Entry } from './model';
import {completedSessionDate,validCompletedSet,resolveTimeZone} from './training-calendar.ts';
import type {TrainingTime} from './training-calendar';
import type { TrainingProfile } from './training-presets';

export const MUSCLES = [
 ['chest','Peitoral','front'],['front_deltoid','Deltoide anterior','front'],['side_deltoid','Deltoide lateral','front'],
 ['biceps','Bíceps','front'],['forearm_front','Antebraço anterior','front'],['abs','Abdômen','front'],
 ['obliques','Oblíquos','front'],['quads','Quadríceps','front'],['adductors','Adutores','front'],['tibialis','Tibial anterior','front'],
 ['traps','Trapézio','back'],['rear_deltoid','Deltoide posterior','back'],['triceps','Tríceps','back'],
 ['lats','Grande dorsal','back'],['lower_back','Região lombar','back'],['glutes','Glúteos','back'],
 ['hamstrings','Posterior de coxa','back'],['calves','Panturrilhas','back'],['forearm_back','Antebraço posterior','back']
] as const;
export type MuscleId = typeof MUSCLES[number][0];
export const MUSCLE_LABEL:Record<MuscleId,string>=Object.fromEntries(MUSCLES.map(m=>[m[0],m[1]])) as Record<MuscleId,string>;
export const MUSCLE_IDS = new Set<string>(MUSCLES.map(m=>m[0]));
export type Exercise={id:string;title:string;primary:MuscleId;secondary:MuscleId[];equipment:string;kind:'strength'|'cardio';custom?:boolean;workspaceId?:string;};
const ex=(id:string,title:string,primary:MuscleId,secondary:MuscleId[],equipment:string,kind:'strength'|'cardio'='strength'):Exercise=>({id,title,primary,secondary,equipment,kind});
export const EXERCISES:Exercise[]=[
 ex('supino-reto','Supino reto','chest',['triceps','front_deltoid'],'Barra'),
 ex('supino-inclinado','Supino inclinado','chest',['front_deltoid','triceps'],'Halteres'),
 ex('crucifixo','Crucifixo','chest',['front_deltoid'],'Halteres'),
 ex('flexao','Flexão de braços','chest',['triceps','front_deltoid'],'Peso corporal'),
 ex('puxada-alta','Puxada alta','lats',['biceps','traps'],'Polia'),
 ex('remada-curvada','Remada curvada','lats',['biceps','traps'],'Barra'),
 ex('remada-baixa','Remada baixa','lats',['biceps','traps'],'Polia'),
 ex('barra-fixa','Barra fixa','lats',['biceps','forearm_front'],'Peso corporal'),
 ex('encolhimento','Encolhimento','traps',[],'Halteres'),
 ex('desenvolvimento','Desenvolvimento de ombros','front_deltoid',['side_deltoid','triceps'],'Halteres'),
 ex('elevacao-lateral','Elevação lateral','side_deltoid',[],'Halteres'),
 ex('crucifixo-inverso','Crucifixo inverso','rear_deltoid',['traps'],'Halteres'),
 ex('rosca-direta','Rosca direta','biceps',['forearm_front'],'Barra'),
 ex('rosca-martelo','Rosca martelo','biceps',['forearm_front'],'Halteres'),
 ex('rosca-punho','Rosca de punho','forearm_front',[],'Halteres'),
 ex('extensao-punho','Extensão de punho','forearm_back',[],'Halteres'),
 ex('triceps-corda','Tríceps corda','triceps',[],'Polia'),
 ex('triceps-testa','Tríceps testa','triceps',[],'Barra'),
 ex('agachamento','Agachamento livre','quads',['glutes','adductors'],'Barra'),
 ex('leg-press','Leg press','quads',['glutes'],'Máquina'),
 ex('cadeira-extensora','Cadeira extensora','quads',[],'Máquina'),
 ex('afundo','Afundo','quads',['glutes','adductors'],'Halteres'),
 ex('adutora','Cadeira adutora','adductors',[],'Máquina'),
 ex('mesa-flexora','Mesa flexora','hamstrings',[],'Máquina'),
 ex('stiff','Stiff','hamstrings',['glutes','lower_back'],'Barra'),
 ex('terra','Levantamento terra','glutes',['hamstrings','lower_back','traps'],'Barra'),
 ex('elevacao-pelvica','Elevação pélvica','glutes',['hamstrings'],'Barra'),
 ex('panturrilha','Elevação de panturrilha','calves',[],'Máquina'),
 ex('tibial','Elevação de ponta dos pés','tibialis',[],'Peso corporal'),
 ex('abdominal','Abdominal crunch','abs',[],'Peso corporal'),
 ex('prancha','Prancha','abs',['obliques'],'Peso corporal'),
 ex('rotacao','Rotação de tronco','obliques',['abs'],'Polia'),
 ex('extensao-lombar','Extensão lombar','lower_back',['glutes'],'Banco'),
 ex('caminhada','Caminhada','quads',['calves','glutes'],'Esteira','cardio'),
 ex('corrida','Corrida','quads',['calves','glutes'],'Esteira','cardio'),
 ex('bicicleta','Bicicleta ergométrica','quads',['glutes','calves'],'Bicicleta','cardio'),
 ex('agachamento-corporal','Agachamento sem carga externa','quads',['glutes'],'Peso corporal'),
 ex('afundo-corporal','Afundo sem carga externa','quads',['glutes'],'Peso corporal'),
 ex('ponte-gluteos','Ponte de glúteos','glutes',['hamstrings'],'Peso corporal'),
 ex('panturrilha-corporal','Panturrilha em pé','calves',[],'Peso corporal'),
 ex('flexao-joelhos','Flexão com joelhos apoiados','chest',['triceps','front_deltoid'],'Peso corporal'),
 ex('desenvolvimento-corporal','Elevação de braços acima da cabeça','front_deltoid',['side_deltoid'],'Peso corporal'),
 ex('remada-mochila','Remada com mochila','lats',['biceps'],'Mochila'),
 ex('rosca-mochila','Rosca com mochila','biceps',['forearm_front'],'Mochila'),
 ex('superman','Extensão de tronco no solo','lower_back',['glutes'],'Peso corporal'),
 ex('prancha-lateral','Prancha lateral','obliques',['abs'],'Peso corporal'),
 ex('caminhada-livre','Caminhada ao ar livre','quads',['calves'],'Sem equipamento','cardio')
];
export type PlanExercise={id:string;exerciseId:string;sets:number;reps:number;restSeconds:number;durationMinutes?:number;targetLoad?:number;notes?:string};
export type WorkoutPlan={id:string;workspaceId:string;title:string;days:number[];archived?:boolean;items:PlanExercise[];createdAt:string;updatedAt:string};
export type CompletedSet={id:string;reps:number;load:number;done:boolean;kind:'working'|'warmup'};
export type SessionExercise={id:string;exerciseId:string;title:string;primary:MuscleId;secondary:MuscleId[];kind:'strength'|'cardio';equipment:string;restSeconds?:number;plannedMinutes?:number;sets:CompletedSet[];minutes?:number;distanceKm?:number;notes?:string};
export type WorkoutSession={id:string;workspaceId:string;planId?:string;planTitle:string;date:string;startedAt:string;finishedAt?:string;restEndsAt?:number;status:'in_progress'|'paused'|'completed';exercises:SessionExercise[]};
export type MuscleGoal={workspaceId:string;muscle:MuscleId;sets:number};
export type TrainingData={version:1;plans:WorkoutPlan[];sessions:WorkoutSession[];customExercises:Exercise[];goals:MuscleGoal[];profiles:TrainingProfile[]};
export const emptyTraining=():TrainingData=>({version:1,plans:[],sessions:[],customExercises:[],goals:[],profiles:[]});
export const parseTraining=(value?:Partial<TrainingData>|null):TrainingData=>({
 version:1,plans:Array.isArray(value?.plans)?value.plans:[],
 sessions:Array.isArray(value?.sessions)?value.sessions:[],
 customExercises:Array.isArray(value?.customExercises)?value.customExercises:[],
 goals:Array.isArray(value?.goals)?value.goals:[],
 profiles:Array.isArray(value?.profiles)?value.profiles:[]
});
export const makeId=()=>crypto.randomUUID();
export const localDate=(date:Date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
export const addDays=(ymd:string,days:number)=>{const date=new Date(ymd+'T12:00:00');date.setDate(date.getDate()+days);return localDate(date);};
export const weekStart=(ymd:string)=>{const date=new Date(ymd+'T12:00:00');return addDays(ymd,-((date.getDay()+6)%7));};
export const numeric=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:0;
export const validNumber=(value:number,max=10000)=>Number.isFinite(value)&&value>=0&&value<=max;
export const bodyExercise=(exercise:Exercise):PlanExercise=>({id:makeId(),exerciseId:exercise.id,sets:exercise.kind==='cardio'?0:3,reps:exercise.kind==='cardio'?0:10,restSeconds:exercise.kind==='cardio'?0:90,durationMinutes:exercise.kind==='cardio'?15:undefined});
export const exercisesFor=(data:TrainingData,workspaceId:string):Exercise[]=>[...EXERCISES,...data.customExercises.filter(x=>x.workspaceId===workspaceId)];
export const snapshotExercise=(e:Exercise,p:PlanExercise):SessionExercise=>({id:makeId(),exerciseId:e.id,title:e.title,primary:e.primary,secondary:[...e.secondary],kind:e.kind,equipment:e.equipment,restSeconds:p.restSeconds,plannedMinutes:p.durationMinutes,sets:e.kind==='strength'?Array.from({length:p.sets},()=>({id:makeId(),reps:p.reps,load:p.targetLoad??0,kind:'working' as const,done:false})):[]});
export const startSession=(plan:WorkoutPlan|undefined,library:Exercise[],workspaceId:string,when=new Date()):WorkoutSession=>({
 id:makeId(),workspaceId,planId:plan?.id,planTitle:plan?.title||'Treino livre',date:localDate(when),startedAt:when.toISOString(),
 status:'in_progress',exercises:(plan?.items||[]).flatMap(p=>{const ex=library.find(e=>e.id===p.exerciseId);return ex?[snapshotExercise(ex,p)]:[]})
});
export type MuscleStats={muscle:MuscleId;sets:number;goal?:number;goalPercent?:number;sharePercent:number;volume:number;exercises:string[];lastDate?:string;previousSets:number};
export type MusclePeriod={from:string;to:string};
export const periodFor=(mode:'week'|'seven'|'thirty'|'custom',todayDate=localDate(),custom?:MusclePeriod):MusclePeriod=>{
 if(mode==='seven')return {from:addDays(todayDate,-6),to:todayDate};
 if(mode==='thirty')return {from:addDays(todayDate,-29),to:todayDate};
 if(mode==='custom'&&custom)return custom;
 return {from:weekStart(todayDate),to:addDays(weekStart(todayDate),6)};
};
export const statsFor=(data:TrainingData,workspaceId:string,period:MusclePeriod,time:TrainingTime={now:new Date().toISOString(),timeZone:resolveTimeZone()}):Record<MuscleId,MuscleStats>=>{
 const result=Object.fromEntries(MUSCLES.map(m=>[m[0],{muscle:m[0],sets:0,sharePercent:0,volume:0,exercises:[],previousSets:0}])) as unknown as Record<MuscleId,MuscleStats>;
 const days=Math.max(1,Math.round((new Date(period.to+'T12:00:00').getTime()-new Date(period.from+'T12:00:00').getTime())/86400000)+1);
 const previous={from:addDays(period.from,-days),to:addDays(period.to,-days)};
 let eligible=0;
 for(const session of data.sessions){
  if(session.workspaceId!==workspaceId)continue;
  const completionDate=completedSessionDate(session,time);if(!completionDate)continue;
  const current=completionDate>=period.from&&completionDate<=period.to;
  const prior=completionDate>=previous.from&&completionDate<=previous.to;
  if(!current&&!prior)continue;
  for(const ex of session.exercises){
   if(ex.kind!=='strength'||!MUSCLE_IDS.has(ex.primary))continue;
   const sets=ex.sets.filter(validCompletedSet);
   if(!sets.length)continue;
   const muscle=result[ex.primary];
   if(current){
    muscle.sets+=sets.length;eligible+=sets.length;
    muscle.volume+=sets.reduce((sum,s)=>sum+s.reps*s.load,0);
    if(!muscle.exercises.includes(ex.title))muscle.exercises.push(ex.title);
    if(!muscle.lastDate||completionDate>muscle.lastDate)muscle.lastDate=completionDate;
   }else if(prior)muscle.previousSets+=sets.length;
  }
 }
 for(const muscle of MUSCLES){
  const stat=result[muscle[0]];
  const goal=data.goals.find(g=>g.workspaceId===workspaceId&&g.muscle===muscle[0]);
  if(goal&&validNumber(goal.sets,999)&&goal.sets>0){
   stat.goal=goal.sets;stat.goalPercent=Math.round(stat.sets/goal.sets*1000)/10;
  }
  stat.sharePercent=eligible?Math.round(stat.sets/eligible*1000)/10:0;
  stat.volume=Math.round(stat.volume*100)/100;
 }
 return result;
};
export const previewMuscles=(plan:WorkoutPlan|undefined,library:Exercise[])=>{
 const main=new Set<MuscleId>(),secondary=new Set<MuscleId>();
 for(const p of plan?.items||[]){
  const exercise=library.find(x=>x.id===p.exerciseId);
  if(exercise){main.add(exercise.primary);exercise.secondary.forEach(m=>secondary.add(m));}
 }
 return {main,secondary};
};
export const legacyGroup=(x:Entry):MuscleId|undefined=>{
 const mapped:Record<string,MuscleId>={'Peito':'chest','Costas':'lats','Ombros':'front_deltoid','Bíceps':'biceps','Tríceps':'triceps','Pernas':'quads','Abdômen':'abs'};
 return mapped[String(x.category||'')];
};
