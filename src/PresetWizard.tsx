import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Dumbbell, Info, RotateCcw, Sparkles } from 'lucide-react';
import type { Exercise } from './training';
import type { PresetDraft, TrainingProfile, TrainingObjective, TrainingLevel, TrainingSetting } from './training-presets';
import { generateWorkoutPreset, PROFILE_LEVELS, PROFILE_OBJECTIVES, PROFILE_SETTINGS, validateTrainingProfile } from './training-presets';
import { MUSCLES,MUSCLE_LABEL } from './training';
import type { MuscleId } from './training';
import { ExerciseIcon, MuscleIcon, ObjectiveIcon } from './MuscleIcon';
import './preset-wizard.css';

type Props={workspaceId:string;library:Exercise[];existing?:TrainingProfile;onApply:(profile:TrainingProfile,draft:PresetDraft)=>void;onClose:()=>void;onNutrition?:()=>void};
const asNumber=(v:string)=>v===''?0:Number(v.replace(',','.'));
export default function PresetWizard({workspaceId,library,existing,onApply,onClose,onNutrition}:Props){
 const [age,setAge]=useState(existing?.age?String(existing.age):'');
 const [height,setHeight]=useState(existing?.heightCm?String(existing.heightCm):'');
 const [weight,setWeight]=useState(existing?.weightKg?String(existing.weightKg):'');
 const [objective,setObjective]=useState<TrainingObjective>(existing?.objective||'hipertrofia');
 const [level,setLevel]=useState<TrainingLevel>(existing?.level||'iniciante');
 const [setting,setSetting]=useState<TrainingSetting>(existing?.setting||'academia');
 const [days,setDays]=useState(existing?.daysPerWeek||3);
 const [minutes,setMinutes]=useState(existing?.minutesPerSession||50);
 const [lowImpact,setLowImpact]=useState(existing?.lowImpact||false);
 const [availableEquipment,setAvailableEquipment]=useState<string[]>(existing?.availableEquipment||[]);
 const [preferredMuscles,setPreferredMuscles]=useState<MuscleId[]>(existing?.preferredMuscles||[]);
 const [excludedExerciseIds,setExcludedExerciseIds]=useState<string[]>(existing?.excludedExerciseIds||[]);
 const [errors,setErrors]=useState<string[]>([]);
 const [draft,setDraft]=useState<PresetDraft|null>(null);
 const profile=():TrainingProfile=>({
  workspaceId,age:asNumber(age),heightCm:asNumber(height),weightKg:asNumber(weight),
  objective,level,setting,daysPerWeek:days,minutesPerSession:minutes,lowImpact,availableEquipment:setting==='casa'?[]:availableEquipment,preferredMuscles,excludedExerciseIds,updatedAt:new Date().toISOString()
 });
 const preview=()=>{const p=profile();const issues=validateTrainingProfile(p);if(issues.length){setErrors(issues);return;}
  try{setDraft(generateWorkoutPreset(p,library));setErrors([])}catch(e){setErrors([e instanceof Error?e.message:'Não foi possível gerar as fichas.'])}};
 const edit=()=>{setDraft(null);setErrors([])};
 return <section className="pw-root" aria-label="Assistente de treino personalizado">
  <header className="pw-header"><div className="pw-overline"><Sparkles size={15}/> EIXO · ESTÚDIO DE TREINOS</div><h2>{draft?'Confira suas fichas':'Monte sua rotina'}</h2><p>Um ponto de partida editável conforme seu objetivo, rotina e experiência.</p></header>
  {!draft?<form onSubmit={e=>{e.preventDefault();preview()}}>
   <div className="pw-step"><span className="pw-number">01</span><div><h3>O que você busca?</h3><p>Escolha a prioridade do programa.</p></div></div>
   <div className="pw-objectives">{(Object.entries(PROFILE_OBJECTIVES) as [TrainingObjective,typeof PROFILE_OBJECTIVES[TrainingObjective]][]).map(([id,item])=><button type="button" key={id} onClick={()=>setObjective(id)} aria-pressed={objective===id} className={'pw-objective'+(objective===id?' selected':'')}><span className="pw-objective-emoji"><ObjectiveIcon name={id} size={45}/></span><span><b>{item.label}</b><small>{item.description}</small></span><span className="pw-radio">{objective===id&&<Check size={13}/>}</span></button>)}</div>
   <div className="pw-step"><span className="pw-number">02</span><div><h3>Seu perfil de treino</h3><p>Essas informações ficam na sua conta, neste espaço de trabalho.</p></div></div>
   <div className="pw-fields">
    <label>Idade (anos)<input aria-label="Idade em anos" value={age} onChange={e=>{setAge(e.target.value);setDraft(null)}} required type="number" inputMode="numeric" min="18" max="100" placeholder="Ex.: 25"/></label>
    <label>Altura (cm)<input aria-label="Altura em centímetros" value={height} onChange={e=>setHeight(e.target.value)} required type="number" min="120" max="230" step=".1" inputMode="decimal" placeholder="Ex.: 180"/></label>
    <label>Peso (kg)<input aria-label="Peso em quilogramas" value={weight} onChange={e=>setWeight(e.target.value)} required type="number" min="30" max="300" step=".1" inputMode="decimal" placeholder="Ex.: 75"/></label>
    <label>Experiência<select aria-label="Experiência de treino" value={level} onChange={e=>setLevel(e.target.value as TrainingLevel)}>{(Object.entries(PROFILE_LEVELS) as [TrainingLevel,string][]).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Onde vai treinar?<select aria-label="Local de treino" value={setting} onChange={e=>setSetting(e.target.value as TrainingSetting)}>{(Object.entries(PROFILE_SETTINGS) as [TrainingSetting,string][]).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Duração disponível<select aria-label="Duração disponível" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>{[30,40,50,60,75,90].map(n=><option key={n} value={n}>{n} minutos</option>)}</select></label>
   </div>
   <div className="pw-step"><span className="pw-number">03</span><div><h3>Quantos dias por semana?</h3><p>A distribuição respeita o número de dias escolhido.</p></div></div>
   <div className="pw-days" role="group" aria-label="Frequência semanal">{[2,3,4,5,6].map(n=><button type="button" key={n} className={days===n?'selected':''} aria-pressed={days===n} onClick={()=>setDays(n)}><strong>{n}</strong><small>dias</small></button>)}</div>
   <label className="pw-check"><input type="checkbox" checked={lowImpact} onChange={e=>setLowImpact(e.target.checked)}/>Prefiro alternativas de menor impacto para cardio</label>
   <div className="pw-step"><span className="pw-number">04</span><div><h3>Personalize o equipamento e os exercícios</h3><p>Esses filtros são opcionais. Sem seleção, o EIXO utiliza as opções do local indicado.</p></div></div>
   {setting==='academia'&&<div className="pw-days" role="group" aria-label="Equipamentos disponíveis">{[...new Set(library.filter(x=>x.kind==='strength').map(x=>x.equipment))].map(value=><label key={value} className="pw-filter-option"><input type="checkbox" checked={availableEquipment.includes(value)} onChange={e=>setAvailableEquipment(old=>e.target.checked?[...old,value]:old.filter(x=>x!==value))}/>{value}</label>)}</div>}
   <details className="pw-extra-options"><summary>Priorizar grupos musculares e excluir movimentos</summary><div className="pw-days">{MUSCLES.map(([id,label])=><label key={id} className="pw-filter-option"><input type="checkbox" checked={preferredMuscles.includes(id)} onChange={e=>setPreferredMuscles(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))}/>{label}</label>)}</div><p>Evitar exercícios específicos</p><div className="pw-days">{library.filter(x=>x.kind==='strength').map(ex=><label className="pw-filter-option" key={ex.id}><input type="checkbox" checked={excludedExerciseIds.includes(ex.id)} onChange={e=>setExcludedExerciseIds(old=>e.target.checked?[...old,ex.id]:old.filter(x=>x!==ex.id))}/>{ex.title}</label>)}</div></details>
   <div className="pw-info"><Info size={16}/><p>Altura e peso ajudam a registrar seu contexto e revisar ajustes de equipamento. <b>Não são usados para inventar cargas ou prever resultados.</b> O programa é uma sugestão geral, não avaliação clínica ou prescrição individual.</p></div>
   {errors.length>0&&<div className="pw-errors" role="alert">{errors.map(e=><p key={e}>{e}</p>)}</div>}
   <footer className="pw-footer"><button type="button" className="ts-button" onClick={onClose}>Voltar</button><button type="submit" className="ts-button ts-primary"><Sparkles size={17}/> Ver sugestões <ArrowRight size={16}/></button></footer>
  </form>:<div className="pw-preview">
   <div className="pw-preview-hero"><span className="pw-preview-icon"><ObjectiveIcon name={objective} size={56}/></span><div><small>SEU PONTO DE PARTIDA</small><h3>{draft.title}</h3><p>{draft.description}</p></div></div>
   <div className="pw-profile-summary"><span>{age} anos</span><span>{height} cm</span><span>{weight} kg</span><span>{PROFILE_LEVELS[level]}</span><span>{PROFILE_SETTINGS[setting]}</span></div>
   <div className="pw-preview-grid">{draft.suggestions.map((s,index)=><article className="pw-suggest" key={index}><header><span>FICHA {String.fromCharCode(65+index)}</span><span>{['SEG','TER','QUA','QUI','SEX','SÁB','DOM'][s.days[0]]}</span></header><h4>{s.name}</h4><div className="pw-exercises">{s.exerciseIds.map(id=>{const ex=library.find(e=>e.id===id);return ex?<div key={id}><span className="pw-exercise-emoji"><ExerciseIcon exercise={ex} size={36}/></span><span>{ex.title}<small>{ex.kind==='cardio'?'Cardio · duração ajustável':MUSCLE_LABEL[ex.primary]}</small></span><select aria-label={'Trocar '+ex.title} value={id} onChange={e=>{const next=draft.suggestions.map((day,k)=>k===index?{...day,exerciseIds:day.exerciseIds.map(x=>x===id?e.target.value:x)}:day);setDraft({...draft,suggestions:next})}}>{library.filter(x=>x.kind===ex.kind&&!excludedExerciseIds.includes(x.id)&&(x.id===id||!s.exerciseIds.includes(x.id))&&(setting==='casa'?['Peso corporal','Mochila','Sem equipamento'].includes(x.equipment):!availableEquipment.length||availableEquipment.includes(x.equipment)||x.equipment==='Peso corporal'||x.equipment==='Sem equipamento')).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></div>:null})}</div><div className="pw-suggest-foot">{draft.defaultSets} séries · {draft.defaultReps} reps-alvo · {draft.restSeconds}s descanso (força)</div></article>)}</div>
   <div className="pw-disclaimer"><b>Antes de começar</b>{draft.warnings.map(w=><p key={w}>{w}</p>)}</div>
   <footer className="pw-footer"><button className="ts-button" type="button" onClick={edit}><ArrowLeft size={15}/> Editar perfil</button><button className="ts-button ts-primary" type="button" disabled={draft.suggestions.some(x=>!x.exerciseIds.length)} onClick={()=>onApply(profile(),draft)}><Check size={17}/> Adicionar {draft.suggestions.length} fichas</button></footer>
   {onNutrition&&<button type="button" className="ts-button" onClick={onNutrition}>Adaptar alimentação ao meu objetivo (opcional) →</button>}
   <p className="pw-append-note">A criação adiciona fichas novas. Não substitui nem apaga fichas ou sessões já registradas.</p>
  </div>}
 </section>;
}
