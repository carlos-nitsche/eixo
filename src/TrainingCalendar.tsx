import {useMemo,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Clock,ArrowRight} from 'lucide-react';
import type {MuscleId,WorkoutSession} from './training';
import {MUSCLE_LABEL} from './training';
import {dateInZone,groupSessionsByDate,monthStatistics,sessionSummary,validCompletedSet,shiftDay,trainingStreak} from './training-calendar';
import type {TrainingTime} from './training-calendar';
import {MuscleIcon} from './MuscleIcon';
import './training-calendar.css';

export function StreakIcon(){return <svg className="ts-streak-icon" viewBox="0 0 40 48" aria-hidden="true"><path d="M23 3c2 10-9 12-5 21 3-2 5-5 6-8 7 6 11 11 10 18-1 8-7 12-15 11S5 39 6 31c0-8 8-12 7-19 3 2 4 4 4 7 3-6 8-10 6-16Z" fill="currentColor"/><path d="M20 28c0 4-5 5-5 9a5 5 0 0 0 10 0c0-3-3-5-3-7l-2 3Z" fill="var(--surface)"/></svg>}
export function StreakCard({sessions,workspaceId,time}:{sessions:WorkoutSession[];workspaceId:string;time:TrainingTime}){
 const streak=trainingStreak(sessions,workspaceId,time);
 return <section className={'ts-streak '+streak.state} aria-label="Ofensiva de Treinos"><div className="ts-streak-heading"><StreakIcon/><span className="ts-eyebrow">OFENSIVA DE TREINOS</span><span className="ts-streak-status">{streak.todayCompleted?'Hoje concluído':streak.atRisk?'Hoje pendente':'Novo começo'}</span></div><strong data-testid="streak-current">{streak.current} <span>{streak.current===1?'dia':'dias'} consecutivos</span></strong><p>{streak.atRisk?'Sua sequência está em risco até concluir um treino hoje.':streak.todayCompleted?'Treino registrado. Um dia de cada vez.':'Quando você voltar, uma nova sequência pode começar.'}</p><div className="ts-streak-facts"><span>Melhor ofensiva <b data-testid="streak-best">{streak.best} dias</b></span><span>Dias neste mês <b>{streak.monthDays}</b></span></div><small>Dias corridos, sem pontuação extra por repetir sessões. Dias de descanso podem ser importantes para sua rotina.</small></section>;
}
type Props={sessions:WorkoutSession[];workspaceId:string;time:TrainingTime;onOpen:(session:WorkoutSession)=>void;onResume?:()=>void;compact?:boolean;muscle?:MuscleId|'';onExpand?:()=>void};
const labelDate=(date:string)=>new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
export default function TrainingCalendar({sessions,workspaceId,time,onOpen,onResume,compact=false,muscle='',onExpand}:Props){
 const today=dateInZone(time.now,time.timeZone)!;
 const [month,setMonth]=useState(today.slice(0,7)),[selected,setSelected]=useState(today);
 const filtered=useMemo(()=>muscle?sessions.filter(s=>s.exercises.some(e=>(e.primary===muscle||e.secondary.includes(muscle))&&(e.sets.some(validCompletedSet)||Number(e.minutes)>0))):sessions,[sessions,muscle]);
 const grouped=useMemo(()=>groupSessionsByDate(filtered,workspaceId,time),[filtered,workspaceId,time.now,time.timeZone]);
 const stats=monthStatistics(filtered,workspaceId,month,time),selectedSessions=grouped.completed[selected]||[],ongoing=grouped.active[selected]||[];
 const changeMonth=(delta:number)=>{const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);const next=d.toISOString().slice(0,7);setMonth(next);setSelected(next===today.slice(0,7)?today:next+'-01')};
 const clock=(instant:string)=>Number.isFinite(Date.parse(instant))?new Date(instant).toLocaleTimeString('pt-BR',{timeZone:time.timeZone,hour:'2-digit',minute:'2-digit'}):'Não registrado';
 return <section className={'tc-calendar'+(compact?' tc-compact':'')} aria-label="Calendário de Treinos">
  <header className="tc-heading"><div><span className="ts-eyebrow">CONSISTÊNCIA REAL</span><h2>Calendário de Treinos</h2>{muscle&&<p>Grupo: {MUSCLE_LABEL[muscle]}</p>}</div>{compact&&<button className="ts-button" onClick={onExpand} aria-label="Abrir calendário completo"><ArrowRight size={18}/></button>}</header>
  <div className="tc-month-nav"><button onClick={()=>changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={20}/></button><h3 aria-live="polite">{new Date(month+'-01T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'})}</h3><button onClick={()=>changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={20}/></button></div>
  <div className="tc-weekdays" aria-hidden="true">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d=><span key={d}>{d}</span>)}</div>
  <div className="tc-days" role="group" aria-label="Dias do mês">{Array.from({length:stats.offset},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:stats.daysInMonth},(_,i)=>{
   const day=month+'-'+String(i+1).padStart(2,'0'),count=grouped.completed[day]?.length||0,running=!!grouped.active[day]?.length;
   const previous=count&&!!grouped.completed[shiftDay(day,-1)],next=count&&!!grouped.completed[shiftDay(day,1)];
   return <button key={day} data-date={day} data-completed={count>0} className={['tc-day',count?'trained':'',running?'ongoing':'',previous?'linked-before':'',next?'linked-after':'',day===today?'today':'',day===selected?'selected':''].join(' ')} aria-current={day===today?'date':undefined} aria-pressed={day===selected} aria-label={`${labelDate(day)}: ${count?count+' treino(s) concluído(s)':'sem treino concluído'}${running?', sessão em andamento':''}`} onClick={()=>setSelected(day)}><span>{i+1}</span><span className="tc-indicator">{count>0?<><Check size={12}/>{count>1&&<small>{count}</small>}</>:running?<Clock size={12}/>:null}</span></button>;
  })}</div>
  <div className="tc-legend"><span><Check size={14}/>Concluído</span><span><Clock size={14}/>Em andamento</span><button onClick={()=>{setMonth(today.slice(0,7));setSelected(today)}}>Hoje</button></div>
  <div className="tc-summary"><span><b>{stats.trainedDays}</b> dias treinados</span><span><b>{stats.sessionCount}</b> sessões</span><span><b>{stats.frequency}%</b> dos {stats.elapsedDays} dias decorridos</span></div>
  <div className="tc-day-details" aria-live="polite"><h3>{labelDate(selected)}</h3>{!selectedSessions.length&&!ongoing.length&&<p>Nenhum treino registrado neste dia.</p>}
   {selectedSessions.map(session=>{const summary=sessionSummary(session);return <article key={session.id} className="tc-session"><div><b>{session.planTitle}</b><span className="tc-session-completed"><Check size={14}/>Concluído</span></div><p>{clock(session.startedAt)} – {session.finishedAt?clock(session.finishedAt):'Término não registrado'}{summary.durationMinutes!==null?` · ${summary.durationMinutes} min`:''}</p><div className="tc-session-facts"><span>{summary.exerciseCount} exercícios realizados</span><span>{summary.sets} séries</span><span>{summary.volume.toLocaleString('pt-BR')} kg de volume</span>{summary.cardioMinutes>0&&<span>{summary.cardioMinutes} min de cardio</span>}</div><div className="tc-muscles">{summary.muscles.map(m=><span key={m}><MuscleIcon muscle={m} size={20}/>{MUSCLE_LABEL[m]}</span>)}</div><button className="ts-button" onClick={()=>onOpen(session)}>Ver treino completo <ArrowRight size={15}/></button></article>})}
   {ongoing.map(session=><article key={session.id} className="tc-session ongoing"><b>{session.planTitle}</b><p><Clock size={14}/> {session.status==='paused'?'Sessão pausada':'Sessão em andamento'}. Ainda não conta como dia treinado.</p>{onResume&&<button className="ts-button" onClick={onResume}>Retomar treino</button>}</article>)}
  </div>
 </section>;
}
