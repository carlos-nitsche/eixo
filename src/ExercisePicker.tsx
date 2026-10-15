import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Exercise, MuscleId } from './training';
import { MUSCLES, MUSCLE_LABEL } from './training';
import { ExerciseIcon, MuscleIcon } from './MuscleIcon';
import './exercise-picker.css';

type Props={library:Exercise[];onChoose:(exercise:Exercise)=>void;onClose:()=>void;title?:string;selected?:string[];initialMuscle?:MuscleId|''};
export default function ExercisePicker({library,onChoose,onClose,title='Escolher exercício',selected=[],initialMuscle=''}:Props){
 const [search,setSearch]=useState('');
 const [group,setGroup]=useState<MuscleId|''>(initialMuscle);
 const [kind,setKind]=useState<'all'|'strength'|'cardio'>('all');
 const searchRef=useRef<HTMLInputElement>(null);
 const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{searchRef.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')closeRef.current()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 const filtered=useMemo(()=>library.filter(e=>(!group||e.primary===group||e.secondary.includes(group))&&(kind==='all'||e.kind===kind)&&(!search||[e.title,e.equipment,MUSCLE_LABEL[e.primary],...e.secondary.map(m=>MUSCLE_LABEL[m])].join(' ').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))),[library,group,kind,search]);
 return <div className="xp-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="xp-dialog" role="dialog" aria-modal="true" aria-label={title}>
   <header className="xp-head"><div><span className="xp-eyebrow">EIXO · BIBLIOTECA</span><h2>{title}</h2><p>Veja os músculos trabalhados antes de adicionar.</p></div><button type="button" className="xp-close" onClick={onClose} aria-label="Fechar seleção"><X size={20}/></button></header>
   <div className="xp-filters"><label className="xp-search"><Search size={17}/><input ref={searchRef} aria-label="Buscar exercício" placeholder="Nome, músculo ou equipamento..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label className="xp-select"><SlidersHorizontal size={16}/><select aria-label="Grupo muscular" value={group} onChange={e=>setGroup(e.target.value as MuscleId|'')}><option value="">Todos os músculos</option>{MUSCLES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   </div>
   <div className="xp-kinds" aria-label="Modalidade">{([['all','Todos'],['strength','Musculação'],['cardio','Cardio']] as const).map(([id,label])=><button type="button" key={id} className={kind===id?'active':''} aria-pressed={kind===id} onClick={()=>setKind(id)}>{label}</button>)}</div>
   <div className="xp-count">{filtered.length} exercícios encontrados</div>
   <div className="xp-grid">{filtered.map(ex=><button type="button" key={ex.id} className={'xp-card'+(selected.includes(ex.id)?' in-plan':'')} onClick={()=>onChoose(ex)}>
    <span className="xp-avatar"><ExerciseIcon exercise={ex} size={43}/></span>
    <span className="xp-card-body"><strong>{ex.title}</strong><small>{ex.equipment} · {ex.kind==='cardio'?'Cardio':'Força'}</small>
     <span className="xp-tags"><span className="xp-tag primary"><MuscleIcon muscle={ex.primary} size={19}/> {MUSCLE_LABEL[ex.primary]}</span>{ex.secondary.map(id=><span className="xp-tag" key={id}><MuscleIcon muscle={id} size={17}/> {MUSCLE_LABEL[id]}</span>)}</span>
    </span>{selected.includes(ex.id)?<Check className="xp-chevron" size={18}/>:<ChevronRight className="xp-chevron" size={18}/>}
   </button>)}</div>
   {!filtered.length&&<div className="xp-noresult">Nenhum exercício encontrado. Tente outro músculo ou termo de pesquisa.</div>}
   <p className="xp-footnote">As regiões indicadas são categorias gerais de exercícios, não medições de ativação muscular.</p>
  </section>
 </div>;
}
