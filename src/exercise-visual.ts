import type { Exercise, MuscleId, WorkoutPlan } from './training';
import type { TrainingObjective } from './training-presets';
import { MUSCLE_LABEL } from './training.ts';

export const muscleIconSrc=(muscle:MuscleId):string=>'/icons/muscles/'+muscle+'.svg';
export const objectiveIconSrc=(objective:TrainingObjective):string=>'/icons/objectives/'+objective+'.svg';

/** Compatibility only. These are original EIXO SVG asset URLs, not Unicode emojis. */
export const muscleEmoji=muscleIconSrc;
export const exerciseSummary=(exercise:Exercise)=>[{
 id:exercise.primary,label:MUSCLE_LABEL[exercise.primary],iconSrc:muscleIconSrc(exercise.primary),primary:true
},...exercise.secondary.map(id=>({id,label:MUSCLE_LABEL[id],iconSrc:muscleIconSrc(id),primary:false}))];
export const planMuscleSummary=(plan:WorkoutPlan,library:Exercise[])=>{
 const groups=new Set<MuscleId>();
 for(const item of plan.items){const exercise=library.find(x=>x.id===item.exerciseId);if(exercise)groups.add(exercise.primary);}
 return [...groups].slice(0,5).map(id=>({id,label:MUSCLE_LABEL[id],iconSrc:muscleIconSrc(id)}));
};
