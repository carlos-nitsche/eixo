import type { Exercise, PlanExercise, WorkoutPlan, MuscleId } from './training';
import { EXERCISES } from './training.ts';
import {estimatedPlanMinutes} from './training-calendar.ts';

export type TrainingObjective='hipertrofia'|'forca'|'condicionamento'|'bem-estar';
export type TrainingLevel='iniciante'|'intermediario'|'avancado';
export type TrainingSetting='academia'|'casa';
export type TrainingProfile={
 workspaceId:string;
 age:number;
 heightCm:number;
 weightKg:number;
 objective:TrainingObjective;
 level:TrainingLevel;
 setting:TrainingSetting;
 daysPerWeek:number;
 minutesPerSession:number;
 lowImpact:boolean;
 availableEquipment?:string[];
 preferredMuscles?:MuscleId[];
 excludedExerciseIds?:string[];
 updatedAt:string;
};
export type PresetSuggestion={name:string;days:number[];exerciseIds:string[];cardioMinutes?:number};
export type PresetDraft={title:string;description:string;suggestions:PresetSuggestion[];warnings:string[];defaultSets:number;defaultReps:number;restSeconds:number};

export const PROFILE_OBJECTIVES:Record<TrainingObjective,{label:string;description:string}>={
 hipertrofia:{label:'Ganho de massa',description:'Distribuição equilibrada de exercícios de força'},
 forca:{label:'Força',description:'Ênfase em padrões básicos de movimento'},
 condicionamento:{label:'Condicionamento',description:'Força e cardio em uma rotina sustentável'},
 'bem-estar':{label:'Saúde e disposição',description:'Consistência, mobilidade e movimentos gerais'}
};
export const PROFILE_LEVELS:Record<TrainingLevel,string>={iniciante:'Iniciante',intermediario:'Intermediário',avancado:'Avançado'};
export const PROFILE_SETTINGS:Record<TrainingSetting,string>={academia:'Academia completa',casa:'Em casa / peso corporal'};

export const validateTrainingProfile=(profile:TrainingProfile):string[]=>{
 const errors:string[]=[];
 if(!Number.isInteger(profile.age)||profile.age<18||profile.age>100)errors.push('Informe uma idade entre 18 e 100 anos. Menores de 18 anos devem buscar orientação presencial.');
 if(!Number.isFinite(profile.heightCm)||profile.heightCm<120||profile.heightCm>230)errors.push('Informe uma altura entre 120 e 230 cm.');
 if(!Number.isFinite(profile.weightKg)||profile.weightKg<30||profile.weightKg>300)errors.push('Informe um peso entre 30 e 300 kg.');
 if(!Number.isInteger(profile.daysPerWeek)||profile.daysPerWeek<2||profile.daysPerWeek>6)errors.push('Escolha de 2 a 6 dias semanais.');
 if(!Number.isInteger(profile.minutesPerSession)||profile.minutesPerSession<20||profile.minutesPerSession>120)errors.push('Escolha uma duração de 20 a 120 minutos.');
 if(!PROFILE_OBJECTIVES[profile.objective])errors.push('Objetivo inválido.');
 if(!PROFILE_LEVELS[profile.level])errors.push('Nível inválido.');
 if(!PROFILE_SETTINGS[profile.setting])errors.push('Local de treino inválido.');
 return errors;
};
const GYM={
 push:['supino-reto','supino-inclinado','desenvolvimento','elevacao-lateral','triceps-corda'],
 pull:['puxada-alta','remada-baixa','crucifixo-inverso','rosca-direta','rosca-martelo'],
 legs:['agachamento','leg-press','mesa-flexora','panturrilha','abdominal'],
 upper:['supino-reto','puxada-alta','remada-curvada','desenvolvimento','rosca-direta','triceps-corda'],
 lower:['agachamento','mesa-flexora','elevacao-pelvica','panturrilha','prancha'],
 fullA:['agachamento','supino-reto','puxada-alta','prancha'],
 fullB:['leg-press','remada-baixa','desenvolvimento','mesa-flexora','abdominal'],
 fullC:['afundo','supino-inclinado','remada-curvada','panturrilha','prancha']
};
const HOME={
 push:['flexao','flexao-joelhos','desenvolvimento-corporal','prancha'],
 pull:['remada-mochila','superman','rosca-mochila','prancha-lateral'],
 legs:['agachamento-corporal','afundo-corporal','ponte-gluteos','panturrilha-corporal','abdominal'],
 upper:['flexao','remada-mochila','desenvolvimento-corporal','rosca-mochila','prancha'],
 lower:['agachamento-corporal','ponte-gluteos','afundo-corporal','panturrilha-corporal','prancha-lateral'],
 fullA:['agachamento-corporal','flexao','remada-mochila','prancha'],
 fullB:['ponte-gluteos','flexao-joelhos','superman','panturrilha-corporal','abdominal'],
 fullC:['afundo-corporal','remada-mochila','desenvolvimento-corporal','prancha-lateral']
};
const dayPatterns:Record<number,number[]>={2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5]};
export const generateWorkoutPreset=(profile:TrainingProfile,library:Exercise[]):PresetDraft=>{
 const errors=validateTrainingProfile(profile);
 if(errors.length)throw new Error(errors.join(' '));
 const home=profile.setting==='casa',templates=home?HOME:GYM;
 const days=dayPatterns[profile.daysPerWeek];
 const type=profile.daysPerWeek<=3
  ? (profile.daysPerWeek===2?['fullA','fullB']:['fullA','fullB','fullC'])
  : profile.daysPerWeek===4?['upper','lower','upper','lower']
  : profile.daysPerWeek===5?['push','pull','legs','upper','lower']
  : ['push','pull','legs','push','pull','legs'];
 const dayNames=type.map((t,i)=>({name:(['Treino A','Treino B','Treino C','Treino D','Treino E','Treino F'][i])+' — '+({fullA:'Corpo inteiro',fullB:'Corpo inteiro',fullC:'Corpo inteiro',upper:'Membros superiores',lower:'Membros inferiores',push:'Empurrar',pull:'Puxar',legs:'Pernas'} as Record<string,string>)[t],days:[days[i]],exerciseIds:[...templates[t as keyof typeof templates]]}));
 const cardioIds=home?['caminhada-livre','caminhada-livre']:['bicicleta','caminhada'];
 if(profile.objective==='condicionamento'||profile.objective==='bem-estar'){
  dayNames.forEach((day,i)=>{
   if(i%2===0)day.exerciseIds.push(profile.lowImpact?'caminhada-livre':cardioIds[i%2]);
  });
 }
 const byId=new Set(library.map(e=>e.id));
 const excluded=new Set(profile.excludedExerciseIds||[]);
 const equipment=new Set(home?[]:(profile.availableEquipment||[]));
 const priorities=new Set(profile.preferredMuscles||[]);
 const eligible=(id:string)=>{const e=library.find(f=>f.id===id);return !!e&&!excluded.has(id)&&(!equipment.size||e.equipment==='Peso corporal'||e.equipment==='Sem equipamento'||equipment.has(e.equipment))};
 const strengthLimit=profile.minutesPerSession<=35?3:profile.minutesPerSession<=50?4:profile.minutesPerSession<=70?5:6;
 const suggestions:PresetSuggestion[]=dayNames.map(day=>{
  const unique=day.exerciseIds.filter((id,i,arr)=>byId.has(id)&&eligible(id)&&arr.indexOf(id)===i);
  if(priorities.size)unique.sort((a,b)=>Number(priorities.has(library.find(e=>e.id===b)?.primary as MuscleId))-Number(priorities.has(library.find(e=>e.id===a)?.primary as MuscleId)));
  const strength=unique.filter(id=>library.find(e=>e.id===id)?.kind==='strength').slice(0,strengthLimit);
  const cardio=unique.filter(id=>library.find(e=>e.id===id)?.kind==='cardio').slice(0,1);
  return {...day,exerciseIds:[...strength,...cardio]};
 });
 const novice=profile.level==='iniciante',older=profile.age>=60;
 const defaultSets=novice||older?2:profile.level==='avancado'?4:3;
 const defaultReps=profile.objective==='forca'?6:profile.objective==='condicionamento'?12:profile.objective==='bem-estar'?10:10;
 const restSeconds=profile.objective==='forca'?120:profile.objective==='condicionamento'?60:90;
 const estimate=(ids:string[],durationMinutes=15)=>estimatedPlanMinutes(ids.map(exerciseId=>({exerciseId,sets:defaultSets,reps:defaultReps,restSeconds,durationMinutes})),library);
 for(const suggestion of suggestions){
  while(estimate(suggestion.exerciseIds)>profile.minutesPerSession&&suggestion.exerciseIds.filter(id=>library.find(e=>e.id===id)?.kind==='strength').length>1){
   const index=suggestion.exerciseIds.map(id=>library.find(e=>e.id===id)?.kind==='strength').lastIndexOf(true);suggestion.exerciseIds.splice(index,1);
  }
  if(estimate(suggestion.exerciseIds)>profile.minutesPerSession)suggestion.cardioMinutes=Math.max(5,15-(estimate(suggestion.exerciseIds)-profile.minutesPerSession));
 }
 const estimates=suggestions.map(s=>estimate(s.exerciseIds,s.cardioMinutes));
 const warnings=[
  'Modelo educativo e ajustável: idade, altura e peso não determinam cargas, repetições seguras nem diagnóstico de saúde.',
  'Ajuste máquinas, amplitude e posição ao seu corpo; se houver dor, limitação ou condição clínica, peça orientação profissional.',
  'O sistema não define cargas iniciais automaticamente. Escolha esforço e progressão com técnica e orientação adequadas.'
 ];
 if(suggestions.some(s=>s.exerciseIds.length===0))warnings.unshift('Há fichas sem exercícios compatíveis com seus filtros. Ajuste equipamentos ou exercícios excluídos antes de salvar.');
 if(older)warnings.unshift('Volume inicial mais conservador: revise o plano com um profissional, principalmente ao retomar exercícios.');
 if(profile.minutesPerSession<=35)warnings.unshift('Tempo curto: remova exercícios da prévia se necessário para caber no seu tempo.');
 if(profile.lowImpact)warnings.unshift('Preferência por menor impacto registrada; verifique individualmente se cada exercício é confortável.');
 return {title:PROFILE_OBJECTIVES[profile.objective].label+' · '+profile.daysPerWeek+' dias/semana',description:(home?'Treino em casa':'Treino de academia')+' · '+PROFILE_LEVELS[profile.level]+' · '+Math.min(...estimates)+'–'+Math.max(...estimates)+' min estimados (disponível: '+profile.minutesPerSession+' min)',suggestions,warnings,defaultSets,defaultReps,restSeconds};
};
export const makePlansFromPreset=(draft:PresetDraft,profile:TrainingProfile,workspaceId:string,now:string,generateId:()=>string):WorkoutPlan[]=>{
 return draft.suggestions.map(s=>({
  id:generateId(),workspaceId,title:s.name,days:[...s.days],createdAt:now,updatedAt:now,
  items:s.exerciseIds.map(exerciseId=>({
   id:generateId(),exerciseId,sets:EXERCISES.find(e=>e.id===exerciseId)?.kind==='cardio'?0:draft.defaultSets,reps:EXERCISES.find(e=>e.id===exerciseId)?.kind==='cardio'?0:draft.defaultReps,restSeconds:EXERCISES.find(e=>e.id===exerciseId)?.kind==='cardio'?0:draft.restSeconds,durationMinutes:EXERCISES.find(e=>e.id===exerciseId)?.kind==='cardio'?(s.cardioMinutes??15):undefined
  } satisfies PlanExercise))
 }));
};
