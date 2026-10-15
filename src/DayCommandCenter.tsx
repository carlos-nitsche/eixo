// EIXO OS 0.6.0 · React 19 / TypeScript · premium daily command center.
import {useEffect,useMemo,useState} from 'react';
import type {CSSProperties,Dispatch,SetStateAction} from 'react';
import {ArrowRight,CalendarDays,Check,CheckCircle2,ChevronLeft,ChevronRight,Clock3,Flame,Focus,Pause,Play,Plus,RotateCcw,Sparkles,Target,Timer,TrendingUp} from 'lucide-react';
import type {Store,Entry} from './model';
import {today} from './model';
import {dailyOverview,dayOffset,focusWeek,normalizeFocusSessions,weekStrip} from './day-planner';
import './day-command-center.css';

type Props={store:Store;setStore:Dispatch<SetStateAction<Store>>;workspaceId:string;accountKey:string;tasks:Entry[];events:Entry[];onOpenTask:(item:Entry)=>void;onOpenEvent:(item:Entry)=>void;onCreateTask:(date:string)=>void;onCreateEvent:(date:string)=>void;onOpenAgenda:()=>void};
type TimerState={scope:string;runId:string;duration:number;remainingMs:number;deadline:number|null;taskId:string};
const options=[15,25,50] as const;
const newTimer=(scope:string,duration=25):TimerState=>({scope,runId:crypto.randomUUID(),duration,remainingMs:duration*60000,deadline:null,taskId:''});
const storageKey=(scope:string)=>'eixo:focus:session:'+encodeURIComponent(scope);
const readTimer=(scope:string):TimerState=>{
 try{
  const raw=sessionStorage.getItem(storageKey(scope));
  if(!raw)return newTimer(scope);
  const state=JSON.parse(raw) as TimerState;
  if(state.scope!==scope||!options.includes(state.duration as typeof options[number])||typeof state.runId!=='string'||state.runId.length>120||typeof state.remainingMs!=='number'||!Number.isFinite(state.remainingMs)||state.remainingMs<0||state.remainingMs>state.duration*60000||state.deadline!==null&&(!Number.isFinite(state.deadline)||Math.abs(state.deadline-Date.now())>24*60*60000)||typeof state.taskId!=='string')return newTimer(scope);
  return state;
 }catch{return newTimer(scope)}
};
const label=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'short',timeZone:'UTC'}).replace('.','');
const dayNum=(date:string)=>date.slice(8,10);
const longDay=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'numeric',month:'long',timeZone:'UTC'});
const first=(name:string)=>name.split(/\s+/)[0]||'você';
const greeting=()=>{const hour=new Date().getHours();return hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite'};

export default function DayCommandCenter({store,setStore,workspaceId,accountKey,tasks,events,onOpenTask,onOpenEvent,onCreateTask,onCreateEvent,onOpenAgenda}:Props){
 const [selected,setSelected]=useState(today);
 const scope=accountKey+'::'+workspaceId;
 const [timer,setTimer]=useState<TimerState>(()=>readTimer(scope));
 const [now,setNow]=useState(Date.now);
 const [celebration,setCelebration]=useState('');
 const activeTimer=timer.scope===scope?timer:newTimer(scope);
 useEffect(()=>{setTimer(readTimer(scope));setSelected(today());setCelebration('')},[scope]);
 useEffect(()=>{if(timer.scope!==scope)return;try{sessionStorage.setItem(storageKey(scope),JSON.stringify(timer))}catch{}},[timer,scope]);
 useEffect(()=>{
  const tick=()=>setNow(Date.now());
  const id=window.setInterval(tick,500);
  document.addEventListener('visibilitychange',tick);
  return()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',tick)};
 },[]);
 useEffect(()=>{if(!celebration)return;const timer=window.setTimeout(()=>setCelebration(''),4000);return()=>window.clearTimeout(timer)},[celebration]);
 const todayDate=today();
 const focus=useMemo(()=>normalizeFocusSessions(store.focusSessions),[store.focusSessions]);
 const overview=useMemo(()=>dailyOverview(tasks,events,focus,workspaceId,selected,todayDate),[tasks,events,focus,workspaceId,selected,todayDate]);
 const weekly=useMemo(()=>focusWeek(focus,workspaceId,todayDate),[focus,workspaceId,todayDate]);
 const days=weekStrip(selected);
 const due=overview.tasks.filter(t=>t.item.status!=='Concluído').slice(0,6);
 const finished=overview.tasks.filter(t=>t.item.status==='Concluído').slice(0,2);
 const agenda=overview.events.slice(0,5);
 const remaining=activeTimer.deadline===null?activeTimer.remainingMs:Math.max(0,activeTimer.deadline-now);
 const timerReady=remaining<1000;
 const running=activeTimer.deadline!==null&&!timerReady;
 const elapsedPct=Math.min(100,Math.max(0,100-remaining/(activeTimer.duration*60000)*100));
 const minutesDisplay=String(Math.floor(Math.ceil(remaining/1000)/60)).padStart(2,'0');
 const secondsDisplay=String(Math.ceil(remaining/1000)%60).padStart(2,'0');
 const toggle=()=>{
  if(timerReady)return;
  setNow(Date.now());
  setTimer(old=>{
   const current=old.scope===scope?old:readTimer(scope);
   if(current.deadline!==null)return {...current,remainingMs:Math.max(0,current.deadline-Date.now()),deadline:null};
   return {...current,deadline:Date.now()+current.remainingMs};
  });
 };
 const reset=()=>{setTimer(newTimer(scope,activeTimer.duration));setNow(Date.now())};
 const finish=()=>{
  if(!timerReady)return;
  const snapshot=activeTimer;
  const completedAt=new Date().toISOString(),date=today();
  setStore(previous=>{
   const existing=normalizeFocusSessions(previous.focusSessions);
   if(existing.some(record=>record.id===snapshot.runId))return previous;
   return {...previous,focusSessions:[...existing,{id:snapshot.runId,workspaceId,date,minutes:snapshot.duration,completedAt,...(snapshot.taskId?{taskId:snapshot.taskId}:{})}].slice(-1000)};
  });
  setTimer(newTimer(scope,activeTimer.duration));setNow(Date.now());setCelebration('Sessão concluída! Tempo de foco registrado.');
 };
 const changeDuration=(duration:number)=>{if(running)return;setTimer(newTimer(scope,duration));setNow(Date.now())};
 const toggleTask=(item:Entry)=>{
  setStore(previous=>({...previous,collections:{...previous.collections,tasks:previous.collections.tasks.map(record=>record.id===item.id&&((record.workspaceId||'pessoal')===workspaceId)?{...record,status:record.status==='Concluído'?'A fazer':'Concluído'}:record)}}));
 };
 const selectTask=(id:string)=>setTimer(current=>({...current,taskId:id}));
 const nextLabel=selected===todayDate?'HOJE':selected<todayDate?'DIA ANTERIOR':'PLANEJAMENTO';
 return <section className="eixo-day" aria-label="Meu Dia — central de comando">
  <div className="eixo-day-hero">
   <div className="eixo-day-hero-main">
    <span className="eixo-day-kicker"><Sparkles size={13}/> EIXO · CENTRAL DE COMANDO</span>
    <h2>{greeting()}. <span>Seu dia, no controle.</span></h2>
    <p>Planeje o essencial, avance nas prioridades e acompanhe cada minuto de foco.</p>
    <div className="eixo-day-pills"><span><CheckCircle2 size={15}/>{overview.pending} tarefa{overview.pending!==1?'s':''} pendente{overview.pending!==1?'s':''}</span><span><CalendarDays size={15}/>{overview.events.length} compromisso{overview.events.length!==1?'s':''}</span><span><Focus size={15}/>{weekly.minutes} min de foco na semana</span></div>
   </div>
   <div className="eixo-day-glyph" aria-hidden="true"><span className="eixo-day-orbit"/><Focus size={76} strokeWidth={1.15}/></div>
  </div>
  <div className="eixo-day-content">
   <div className="eixo-day-main">
    <div className="eixo-day-sectionhead"><div><span className="eixo-day-upper">{nextLabel}</span><h3>{longDay(selected)}</h3></div><div className="eixo-day-date-actions"><button type="button" title="Dia anterior" onClick={()=>setSelected(d=>dayOffset(d,-1))}><ChevronLeft size={17}/></button><button type="button" className="today-button" onClick={()=>setSelected(today())}>Hoje</button><button type="button" title="Próximo dia" onClick={()=>setSelected(d=>dayOffset(d,1))}><ChevronRight size={17}/></button></div></div>
    <div className="eixo-day-weekrail" role="group" aria-label="Selecionar data">{days.map(date=><button type="button" key={date} className={date===selected?'eixo-day-selected':''} aria-pressed={date===selected} onClick={()=>setSelected(date)}><span>{label(date)}</span><strong>{dayNum(date)}</strong>{date===todayDate&&<i aria-label="Hoje"/>}</button>)}</div>
    <div className="eixo-day-listhead"><span><Target size={16}/> Prioridades</span><button type="button" onClick={()=>onCreateTask(selected)}><Plus size={15}/> Nova tarefa</button></div>
    {due.length?<div className="eixo-day-tasklist">{due.map(({item,overdue,priority})=><article className="eixo-day-task" key={item.id}><button type="button" className="eixo-day-check" aria-label={'Concluir '+item.title} title="Marcar concluída" onClick={()=>toggleTask(item)}><Check size={14}/></button><button type="button" className="eixo-day-taskcopy" onClick={()=>onOpenTask(item)}><strong>{item.title}</strong><span>{overdue?'Atrasada · ':''}{item.category||'Tarefa'}{item.dueDate?' · '+longDay(String(item.dueDate)):''}</span></button><span className="eixo-day-priority" data-priority={priority}>{priority}</span></article>)}</div>:<div className="eixo-day-empty"><CheckCircle2 size={24}/><strong>Sem pendências para este dia</strong><small>Você pode começar uma nova tarefa ou aproveitar o espaço livre.</small></div>}
    {finished.length>0&&<div className="eixo-day-finished">{finished.map(({item})=><button type="button" key={item.id} onClick={()=>toggleTask(item)} aria-label={'Reabrir '+item.title}><CheckCircle2 size={14}/><span>{item.title}</span></button>)}</div>}
    <div className="eixo-day-listhead"><span><CalendarDays size={16}/> Agenda do dia</span><button type="button" onClick={()=>onCreateEvent(selected)}><Plus size={15}/> Novo evento</button></div>
    {agenda.length?<div className="eixo-day-eventlist">{agenda.map(({item,time})=><button type="button" key={item.id} className="eixo-day-event" onClick={()=>onOpenEvent(item)}><time>{time||'Dia todo'}</time><span><strong>{item.title}</strong><small>{item.category||'Compromisso'}</small></span><ArrowRight size={15}/></button>)}</div>:<div className="eixo-day-eventempty"><CalendarDays size={16}/><span>Nenhum compromisso nesta data.</span></div>}
    <button type="button" className="eixo-day-openagenda" onClick={onOpenAgenda}>Abrir agenda completa <ArrowRight size={16}/></button>
   </div>
   <aside className="eixo-focus-panel" aria-label="Temporizador de foco">
    <div className="eixo-focus-heading"><span><Timer size={17}/> MODO FOCO</span><span className="eixo-focus-status"><span data-running={running}/>{running?'Em andamento':timerReady?'Tempo concluído':'Pronto'}</span></div>
    <div className="eixo-focus-subtitle">Um passo por vez. Sem distrações.</div>
    <div className="eixo-focus-ring" style={{'--focus-progress':elapsedPct+'%'} as CSSProperties}><div className="eixo-focus-ring-inner"><strong role="timer" aria-label="Tempo restante">{minutesDisplay}:{secondsDisplay}</strong><small>{timerReady?'Sessão pronta para registrar':'MINUTOS RESTANTES'}</small></div></div>
    <div className="eixo-focus-options" aria-label="Duração da sessão">{options.map(min=><button key={min} type="button" disabled={running} className={activeTimer.duration===min?'selected':''} aria-pressed={activeTimer.duration===min} onClick={()=>changeDuration(min)}>{min} min</button>)}</div>
    <label className="eixo-focus-assign">Focar em<select value={activeTimer.taskId} onChange={event=>selectTask(event.target.value)} disabled={running}><option value="">Sessão livre</option>{tasks.filter(t=>(t.workspaceId||'pessoal')===workspaceId&&t.status!=='Concluído').slice(0,50).map(t=><option key={t.id} value={t.id}>{t.title.slice(0,56)}</option>)}</select></label>
    <div className="eixo-focus-buttons">{timerReady?<button className="eixo-focus-primary" type="button" onClick={finish}><Check size={16}/> Registrar sessão</button>:<button className="eixo-focus-primary" type="button" onClick={toggle}>{running?<Pause size={16}/>:<Play size={16}/>} {running?'Pausar foco':activeTimer.remainingMs<activeTimer.duration*60000?'Continuar':'Começar foco'}</button>}<button type="button" className="eixo-focus-reset" onClick={reset} aria-label="Reiniciar sessão" title="Reiniciar sessão"><RotateCcw size={17}/></button></div>
    {celebration&&<p className="eixo-focus-celebration" role="status"><CheckCircle2 size={16}/>{celebration}</p>}
    <div className="eixo-focus-week"><div className="eixo-focus-weektitle"><span><Flame size={16}/> Seu ritmo</span><strong>{weekly.count} sessões</strong></div><div className="eixo-focus-heat">{weekly.days.map(d=><div key={d.date} title={longDay(d.date)+': '+d.minutes+' minutos'}><span data-active={d.minutes>0} style={{opacity:d.minutes?Math.max(.4,Math.min(1,d.minutes/50)):undefined}}/><small>{label(d.date).slice(0,2)}</small></div>)}</div><div className="eixo-focus-weekfooter"><span><Clock3 size={14}/>{weekly.minutes} minutos nesta semana</span><TrendingUp size={17}/></div></div>
    <p className="eixo-focus-footnote">A sessão é registrada somente ao concluir o temporizador e confirmar. Acompanhe os registros por espaço.</p>
   </aside>
  </div>
 </section>;
}
