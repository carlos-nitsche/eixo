import {useEffect,useState} from 'react';
import type { CSSProperties } from 'react';
import type { Exercise,MuscleId } from './training';
import {MUSCLE_LABEL} from './training';
import type { TrainingObjective } from './training-presets';
import { muscleIconSrc, objectiveIconSrc } from './exercise-visual';
import './muscle-icons.css';

type Shared={size?:number;className?:string;decorative?:boolean};
export function MuscleIcon({muscle,size=20,className='',decorative=true}:{muscle:MuscleId}&Shared){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[muscle]);
 return failed?<span className="eixo-icon-fallback" style={{width:size,height:size}} aria-label={MUSCLE_LABEL[muscle]}>{MUSCLE_LABEL[muscle]?.slice(0,2)}</span>:<img className={'eixo-muscle-icon '+className} style={{'--eixo-icon-size':size+'px'} as CSSProperties} src={muscleIconSrc(muscle)} alt={decorative?'':MUSCLE_LABEL[muscle]} aria-hidden={decorative} onError={()=>setFailed(true)} draggable={false} loading="lazy" decoding="async"/>;
}
export function ObjectiveIcon({name,size=40,className='',decorative=true}:{name:TrainingObjective}&Shared){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[name]);
 return failed?<span className="eixo-icon-fallback" style={{width:size,height:size}} aria-label={name}>{name.slice(0,2)}</span>:<img className={'eixo-muscle-icon '+className} style={{'--eixo-icon-size':size+'px'} as CSSProperties} src={objectiveIconSrc(name)} alt={decorative?'':name} aria-hidden={decorative} onError={()=>setFailed(true)} draggable={false} loading="lazy" decoding="async"/>;
}
export const MOVEMENT_ICONS:Record<string,string>={'supino-reto':'bench','supino-inclinado':'bench','rosca-direta':'curl','rosca-martelo':'curl','rosca-mochila':'curl','agachamento':'squat','agachamento-corporal':'squat','puxada-alta':'pulldown','leg-press':'leg-press','desenvolvimento':'overhead','desenvolvimento-corporal':'overhead','corrida':'run','caminhada':'run','caminhada-livre':'run','bicicleta':'cycle'};
export function ExerciseIcon({exercise,size=40,decorative=true}:{exercise:Exercise}&Shared){
 const [failed,setFailed]=useState(false);const movement=MOVEMENT_ICONS[exercise.id];
 useEffect(()=>setFailed(false),[exercise.id]);
 return movement&&!failed?<img className="eixo-muscle-icon eixo-movement-icon" style={{'--eixo-icon-size':size+'px'} as CSSProperties} src={'/icons/exercises/'+movement+'.svg'} alt={decorative?'':exercise.title} aria-hidden={decorative} onError={()=>setFailed(true)} loading="lazy" decoding="async"/>:<MuscleIcon muscle={exercise.primary} size={size} decorative={decorative}/>;
}
