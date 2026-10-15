import { useEffect, useMemo, useState, useId } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Info, RotateCcw } from 'lucide-react';
import type { Exercise, MuscleId, MusclePeriod, MuscleStats, TrainingData, WorkoutPlan, WorkoutSession } from './training';
import { MUSCLES, MUSCLE_LABEL, addDays, localDate, periodFor, previewMuscles, statsFor } from './training';
import { MuscleIcon } from './MuscleIcon';
import './muscle-map.css';
import {completedSessionDate,dateInZone,resolveTimeZone,validCompletedSet} from './training-calendar';
import type {TrainingTime} from './training-calendar';

type View='front'|'back';
type Side='esquerdo'|'direito';
type MapMode='today'|'week'|'seven'|'thirty'|'custom'|'preview';
type Selection={muscle:MuscleId;side:Side};
const FRONT:Partial<Record<MuscleId,string>>={
 chest:'M126 117 C109 113 99 111 84 124 L80 143 Q99 161 125 158 Z',
 front_deltoid:'M85 110 C72 111 66 119 66 138 L76 157 87 138 94 121 Z',
 side_deltoid:'M68 120 C61 126 56 142 58 157 L65 165 71 148 Z',
 biceps:'M73 155 C65 156 60 165 57 182 L57 206 66 210 72 186 79 159 Z',
 forearm_front:'M57 209 L65 215 56 238 44 266 34 260 40 238 49 216 Z',
 abs:'M125 164 L107 164 106 185 125 187 Z M125 191 L106 190 106 212 125 215 Z M124 218 L108 216 109 253 125 260 Z',
 obliques:'M88 164 L104 169 104 217 107 257 91 246 83 210 83 176 Z',
 quads:'M94 285 C83 288 79 309 80 341 L85 377 98 394 112 367 115 309 110 291 Z',
 adductors:'M116 291 L127 293 124 333 114 368 103 379 108 338 Z',
 tibialis:'M85 392 L100 399 96 446 88 473 77 468 78 439 Z'
};
const BACK:Partial<Record<MuscleId,string>>={
 traps:'M125 100 L93 112 88 128 105 142 125 130 Z',
 rear_deltoid:'M84 110 C71 114 61 126 60 147 L73 160 88 136 96 120 Z',
 triceps:'M72 155 L79 162 67 207 58 216 55 193 61 166 Z',
 lats:'M91 142 L121 158 114 198 105 244 87 227 79 193 82 169 Z',
 lower_back:'M113 219 L126 219 126 280 102 263 104 242 Z',
 glutes:'M88 283 L125 285 124 324 110 347 84 332 80 306 Z',
 hamstrings:'M83 339 L107 348 103 382 93 407 79 399 78 367 Z',
 calves:'M80 408 L96 410 98 441 88 466 76 458 74 433 Z',
 forearm_back:'M56 210 L66 215 54 243 45 266 35 258 40 235 49 213 Z'
};
const SILHOUETTE='M130 94 L112 96 91 103 71 110 C61 113 58 125 52 143 L39 187 27 230 23 252 34 260 44 247 59 213 74 174 73 205 80 242 85 274 C83 292 78 317 77 343 L76 383 76 410 73 454 69 481 72 493 91 495 97 477 100 446 104 409 112 368 122 323 130 289 Z';
const NECK='M117 81 L116 98 129 108 143 98 142 81';
const intensity=(n:number)=>n===0?0:n<3?1:n<6?2:n<9?3:n<12?4:5;
const fmt=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR');
function Body({view,stats,selected,onSelect,planned,secondary,done,scale}:{
 view:View;stats:Record<MuscleId,MuscleStats>;selected:Selection|null;onSelect:(value:Selection)=>void;
 planned:Set<MuscleId>;secondary:Set<MuscleId>;done:Set<MuscleId>;scale:'goal'|'sets'|'plan'
}){
 const gradientId=useId();
 const regions=view==='front'?FRONT:BACK;
 return <div className="mm-body-wrap">
 <span className="mm-view-name">{view==='front'?'FRENTE · ANTERIOR':'COSTAS · POSTERIOR'}</span>
 <svg className="mm-body" viewBox="0 0 260 510" role="group" aria-label={'Mapa muscular '+(view==='front'?'frontal':'posterior')}>
  <defs><linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="var(--mm-base)"/><stop offset="100%" stopColor="var(--mm-base-dark)"/></linearGradient></defs>
  <ellipse cx="130" cy="49" rx="24" ry="31" fill={'url(#'+gradientId+')'} stroke="var(--mm-line)" strokeWidth="1.5"/>
  <path d={NECK} fill="var(--mm-base)" stroke="var(--mm-line)" strokeWidth="1.3"/>
  {[false,true].map(mirror=><path key={String(mirror)} d={SILHOUETTE} transform={mirror?'translate(260 0) scale(-1 1)':undefined} fill={'url(#'+gradientId+')'} stroke="var(--mm-line)" strokeWidth="1.35"/>)}
  <path d="M130 113 L130 288" stroke="var(--mm-line)" opacity=".45" strokeWidth="1"/>
  {([false,true] as const).flatMap(mirror=>Object.entries(regions).map(([raw,d])=>{
   const muscle=raw as MuscleId;
   if(!d)return null;
   const stat=stats[muscle];
   const selectedThis=selected?.muscle===muscle&&selected.side===(mirror?'direito':'esquerdo');
   const completed=done.has(muscle);
   const active=planned.has(muscle);
   const secondaryOnly=secondary.has(muscle)&&!active;
   const level=scale==='goal'?typeof stat.goalPercent==='number'?intensity(stat.goalPercent/100*12):intensity(stat.sets):
       scale==='plan'?completed?5:active?2:secondaryOnly?1:0:intensity(stat.sets);
   const label=MUSCLE_LABEL[muscle]+' · lado '+(mirror?'direito':'esquerdo')+
    (stat.goalPercent!==undefined?' · '+stat.goalPercent+'% da meta':' · '+stat.sets+' séries');
   return <g key={muscle+(mirror?'R':'L')} role="button" tabIndex={0} focusable="true"
      aria-label={label} aria-pressed={Boolean(selectedThis)}
      className={'mm-region mm-level-'+level+(selectedThis?' is-selected':'')+(secondaryOnly?' is-secondary':'')+(completed?' is-completed':'')}
      transform={mirror?'translate(260 0) scale(-1 1)':undefined}
      onClick={()=>onSelect({muscle,side:mirror?'direito':'esquerdo'})}
      onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect({muscle,side:mirror?'direito':'esquerdo'});}}}>
      <title>{label}</title><path d={d}/>
   </g>;
  }))}
 </svg>
 </div>;
}
type Props={
 training:TrainingData;workspaceId:string;library:Exercise[];plan?:WorkoutPlan;session?:WorkoutSession;
 time?:TrainingTime;onCalendar?:(muscle:MuscleId)=>void;compact?:boolean;initialMode?:'today'|'week'|'preview';focusExerciseId?:string;onHistory?:(muscle:MuscleId)=>void;onFind?:(muscle:MuscleId)=>void;onSetGoal?:(muscle:MuscleId,sets:number|undefined)=>void;
};
export default function MuscleMap({training,workspaceId,library,plan,session,compact=false,initialMode='week',focusExerciseId,onHistory,onFind,onSetGoal,onCalendar,time={now:new Date().toISOString(),timeZone:resolveTimeZone()}}:Props){
 const today=dateInZone(time.now,time.timeZone)!;
 const [mode,setMode]=useState<MapMode>(initialMode);
 const [view,setView]=useState<View>('front');
 const [planFilter,setPlanFilter]=useState('');
 const [selected,setSelected]=useState<Selection|null>(null);
 const [from,setFrom]=useState(addDays(today,-13)),[to,setTo]=useState(today);
 const [editingGoal,setEditingGoal]=useState(false),[goalInput,setGoalInput]=useState('');
 const period=mode==='custom'?{from,to}:mode==='today'||mode==='preview'?{from:today,to:today}:periodFor(mode,today);
 const validPeriod=period.from<=period.to?period:{from:period.to,to:period.from};
 const filteredTraining=useMemo(()=>planFilter?{...training,sessions:training.sessions.filter(s=>s.planId===planFilter)}:training,[training,planFilter]);
 const stats=useMemo(()=>statsFor(filteredTraining,workspaceId,validPeriod,time),[filteredTraining,workspaceId,validPeriod.from,validPeriod.to,time.now,time.timeZone]);
 const activeSession=session||training.sessions.find(s=>s.workspaceId===workspaceId&&(s.status==='in_progress'||s.status==='paused'));
 const allSessions=filteredTraining.sessions.filter(s=>{if(s.workspaceId!==workspaceId)return false;if(mode==='today'&&s.id===activeSession?.id)return true;const day=completedSessionDate(s,time);return !!day&&day>=validPeriod.from&&day<=validPeriod.to});
 const todayPlan=(mode==='today'&&session?.planId?training.plans.find(p=>p.id===session.planId&&p.workspaceId===workspaceId):undefined)||plan||training.plans.find(p=>p.workspaceId===workspaceId&&!p.archived&&(p.days||[]).includes((new Date().getDay()+6)%7));
 const focus=session?.exercises.find(e=>e.id===focusExerciseId);
 useEffect(()=>{if(focus&&mode==='today')setSelected({muscle:focus.primary,side:'esquerdo'});},[focus?.id,mode]);
 const preview=focus&&mode==='today'?{main:new Set<MuscleId>([focus.primary]),secondary:new Set<MuscleId>(focus.secondary)}:previewMuscles(todayPlan,library);
 const completedToday=new Set<MuscleId>(),sessionCounts=new Map<MuscleId,number>();
 for(const s of allSessions.filter(x=>!!completedSessionDate(x,time)||(mode==='today'&&x.id===activeSession?.id))){
  for(const ex of s.exercises)if(ex.kind==='strength'){
   const count=ex.sets.filter(validCompletedSet).length;
   if(count){completedToday.add(ex.primary);sessionCounts.set(ex.primary,(sessionCounts.get(ex.primary)||0)+count);}
  }
 }
 const todayEligible=[...sessionCounts.values()].reduce((a,b)=>a+b,0);
 const mapStats=mode==='today'?Object.fromEntries(MUSCLES.map(([id])=>{
  const currentSessions=allSessions.filter(x=>x.status==='completed'||x.id===activeSession?.id);
  const muscleExercises=currentSessions.flatMap(s=>s.exercises).filter(x=>x.primary===id&&x.kind==='strength');
  const names=[...new Set(muscleExercises.filter(ex=>ex.sets.some(validCompletedSet)).map(ex=>ex.title))];
  const totalVolume=muscleExercises.flatMap(x=>x.sets).filter(validCompletedSet).reduce((n,r)=>n+r.reps*r.load,0);
  return [id,{...stats[id],sets:sessionCounts.get(id)||0,sharePercent:todayEligible?Math.round((sessionCounts.get(id)||0)/todayEligible*1000)/10:0,exercises:names,volume:Math.round(totalVolume*100)/100}];
 })) as Record<MuscleId,MuscleStats>:stats;
 const scale=mode==='preview'||mode==='today'?'plan':mode==='week'?'goal':'sets';
 const selectedStats=selected?mapStats[selected.muscle]:null;
 const help=scale==='goal'?'Meta semanal, quando configurada; sem meta, intensidade pelo número de séries.':scale==='plan'?'Destaque suave: planejado. Destaque intenso: série concluída. Contorno tracejado: secundário.':'Intensidade pela quantidade de séries concluídas no período.';
 const trend=selected?filteredTraining.sessions.filter(s=>s.workspaceId===workspaceId&&!!completedSessionDate(s,time)&&completedSessionDate(s,time)!>=validPeriod.from&&completedSessionDate(s,time)!<=validPeriod.to).map(s=>({
  date:completedSessionDate(s,time)!,volume:s.exercises.filter(e=>e.primary===selected.muscle&&e.kind==='strength').flatMap(e=>e.sets).filter(validCompletedSet).reduce((n,r)=>n+r.reps*r.load,0)
 })).filter(x=>x.volume>0).slice(-8):[];
 const maxTrend=Math.max(1,...trend.map(x=>x.volume));
 const select=(item:Selection)=>{setSelected(item);setGoalInput(String(mapStats[item.muscle].goal??''));setEditingGoal(false);};
 const formId='mm-goal-'+(selected?.muscle||'none');
 return <section className={'mm-section'+(compact?' mm-compact':'')} aria-label="Mapa muscular interativo">
  <div className="mm-heading"><div><span className="mm-eyebrow">ANATOMIA VISUAL / DISTRIBUIÇÃO</span><h3>Mapa muscular</h3><p>Atividade registrada por região — não mede hipertrofia, ativação ou recuperação.</p></div><div className="mm-heading-symbol"><Info size={17}/></div></div>
  <div className="mm-toolbar" role="group" aria-label="Período e modo do mapa">
   {([{value:'week',label:'Semana'}, {value:'seven',label:'7 dias'}, {value:'thirty',label:'30 dias'}, {value:'today',label:'Hoje'}, {value:'preview',label:'Ficha'}, {value:'custom',label:'Período'}] as {value:MapMode;label:string}[]).map(item=><button key={item.value} type="button" className={mode===item.value?'active':''} aria-pressed={mode===item.value} onClick={()=>{setMode(item.value);setSelected(null)}}>{item.label}</button>)}
  </div>
  <label className="mm-program-filter">Ficha <select aria-label="Filtrar mapa por ficha" value={planFilter} onChange={e=>{setPlanFilter(e.target.value);setSelected(null);}}><option value="">Todas as fichas</option>{training.plans.filter(p=>p.workspaceId===workspaceId).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
  {mode==='custom'&&<div className="mm-dates"><label>De <input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>Até <input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></div>}
  <label className="mm-program-filter">Selecionar região <select aria-label="Selecionar grupo muscular" value={selected?.muscle||''} onChange={e=>{if(e.target.value)select({muscle:e.target.value as MuscleId,side:'esquerdo'});else setSelected(null)}}><option value="">Toque no mapa ou escolha aqui</option>{MUSCLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><div className="mm-view-switch"><button onClick={()=>setView('front')} className={view==='front'?'active':''} aria-pressed={view==='front'}><ChevronLeft size={14}/> Frente</button><button onClick={()=>setView('back')} className={view==='back'?'active':''} aria-pressed={view==='back'}>Costas <ChevronRight size={14}/></button></div>
  <div className="mm-main">
   <div className="mm-figures">
    <div className="mm-only-wide"><Body view="front" stats={mapStats} selected={selected} onSelect={select} planned={preview.main} secondary={preview.secondary} done={mode==='preview'?new Set<MuscleId>():completedToday} scale={scale}/></div>
    <div className="mm-only-wide"><Body view="back" stats={mapStats} selected={selected} onSelect={select} planned={preview.main} secondary={preview.secondary} done={mode==='preview'?new Set<MuscleId>():completedToday} scale={scale}/></div>
    <div className="mm-only-mobile"><Body view={view} stats={mapStats} selected={selected} onSelect={select} planned={preview.main} secondary={preview.secondary} done={mode==='preview'?new Set<MuscleId>():completedToday} scale={scale}/></div>
   </div>
   <aside className="mm-details" aria-live="polite">
    {selected&&selectedStats?<>
      <div className="mm-panel-top"><span>REGIÃO SELECIONADA · {selected.side.toUpperCase()}</span><button aria-label="Limpar seleção" onClick={()=>setSelected(null)}><RotateCcw size={15}/></button></div>
      <h4><MuscleIcon muscle={selected.muscle} size={38}/>{MUSCLE_LABEL[selected.muscle]}</h4><p className="mm-bilateral">Dados agregados do grupo muscular; o histórico não registra lateralidade.</p>
      <div className="mm-primary-metric"><strong>{mode==='week'&&selectedStats.goalPercent!==undefined?selectedStats.goalPercent.toLocaleString('pt-BR')+'%':selectedStats.sets.toLocaleString('pt-BR')}</strong><span>{mode==='week'&&selectedStats.goalPercent!==undefined?'da meta semanal':'séries válidas concluídas'}</span></div>
      <div className="mm-meter"><span style={{width:Math.min(100,selectedStats.goalPercent??Math.min(100,selectedStats.sets/12*100))+'%'}}/></div>
      <dl className="mm-stats">
       <div><dt>Séries realizadas</dt><dd>{selectedStats.sets}{mode==='week'&&selectedStats.goal!==undefined?' / '+selectedStats.goal:''}</dd></div>
       <div><dt>Participação</dt><dd>{selectedStats.sharePercent.toLocaleString('pt-BR')}%</dd></div>
       <div><dt>Exercícios diferentes</dt><dd>{selectedStats.exercises.length}</dd></div>
       <div><dt>Último treino no período</dt><dd>{selectedStats.lastDate?fmt(selectedStats.lastDate):'Sem registros'}</dd></div>
       <div><dt>Volume externo</dt><dd>{selectedStats.volume.toLocaleString('pt-BR')} kg</dd></div>
       <div><dt>Período anterior</dt><dd>{selectedStats.previousSets} séries ({selectedStats.sets-selectedStats.previousSets>=0?'+':''}{selectedStats.sets-selectedStats.previousSets})</dd></div>
      </dl>
      {trend.length>0&&<div className="mm-trend"><b>Evolução de volume por sessão</b><div className="mm-trend-bars">{trend.map((point,i)=><div key={point.date+i} title={fmt(point.date)+' — '+point.volume.toLocaleString('pt-BR')+' kg'}><i style={{height:Math.max(5,point.volume/maxTrend*100)+'%'}}/><span>{new Date(point.date+'T12:00:00').getDate()}</span></div>)}</div></div>}
      {selectedStats.exercises.length>0&&<div className="mm-exercises"><b>Exercícios utilizados</b><p>{selectedStats.exercises.join(' · ')}</p></div>}
      {onCalendar&&<button className="ts-button" onClick={()=>onCalendar(selected.muscle)}><CalendarDays size={16}/> Ver dias no calendário</button>}{mode==='week'&&onSetGoal&&<div className="mm-goal-editor">
       {editingGoal?<form onSubmit={e=>{e.preventDefault();const number=Number(goalInput);if(!Number.isInteger(number)||number<0||number>200)return;onSetGoal(selected.muscle,number||undefined);setEditingGoal(false);}}>
        <label htmlFor={formId}>Meta semanal (séries)</label><div><input id={formId} type="number" inputMode="numeric" min="0" max="200" value={goalInput} onChange={e=>setGoalInput(e.target.value)} placeholder="Sem meta"/><button type="submit">Salvar</button></div><small>Zero remove a meta.</small>
       </form>:<button onClick={()=>setEditingGoal(true)}>{selectedStats.goal?'Editar meta semanal':'Configurar meta semanal'}</button>}
      </div>}
      <div className="mm-detail-actions">{onHistory&&<button onClick={()=>onHistory(selected.muscle)}><CalendarDays size={15}/> Histórico <ArrowRight size={14}/></button>}{onFind&&<button onClick={()=>onFind(selected.muscle)}>Ver exercícios <ArrowRight size={14}/></button>}</div>
    </>:<div className="mm-no-selection"><div className="mm-ring">◎</div><b>Explore sua distribuição muscular</b><p>Selecione uma região no corpo ou escolha um grupo abaixo para visualizar séries, participação, histórico e metas.</p><small>{validPeriod.from===validPeriod.to?fmt(validPeriod.from):fmt(validPeriod.from)+' — '+fmt(validPeriod.to)}</small></div>}
   </aside>
  </div>
  <p className="mm-legend-title">{help}</p>
  <div className="mm-legend" aria-label="Legenda do mapa">{[0,1,2,3,4,5].map(n=><span key={n}><i className={'mm-legend-swatch mm-level-'+n}/>{scale==='goal'?['Sem séries','1–24%*','25–49%*','50–74%*','75–99%*','100%+*'][n]:scale==='plan'?['Sem indicação','Secundário','Planejado','—','—','Concluído'][n]:['0','1–2','3–5','6–8','9–11','12+'][n]}</span>)}</div>
  {scale==='goal'&&<p className="mm-note">*A escala percentual se aplica somente a músculos com meta. Sem meta, a tonalidade usa faixas de séries e o painel não inventa porcentagens.</p>}
  <div className="mm-list" role="group" aria-label="Lista acessível de grupos musculares">{MUSCLES.map(([id,label])=><button key={id} className={selected?.muscle===id?'active':''} onClick={()=>select({muscle:id,side:'esquerdo'})}><MuscleIcon muscle={id} size={21}/>{label}<small>{mapStats[id].sets}</small></button>)}</div>
 </section>;
}
