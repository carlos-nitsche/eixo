import HabitGlyph, {habitGlyphLabel} from './HabitGlyph';
import {useMemo,useState} from 'react';
import type {CSSProperties,Dispatch,FormEvent,SetStateAction} from 'react';
import {Activity,Archive,ArrowRight,BarChart3,CalendarDays,Check,CheckCircle2,ChevronLeft,ChevronRight,Clock3,Flame,FolderOpen,Grid3X3,Heart,History,Leaf,MoreHorizontal,Pencil,Plus,RotateCcw,Search,Settings2,Sparkles,Target,Trash2,X} from 'lucide-react';
import type {Store} from './model';
import {today,uid} from './model';
import type {Habit,HabitFrequency} from './habits';
import {HABIT_CATEGORIES,HABIT_ICONS,WEEKDAYS,eligible,dayOfHabitWeek,habitCalendar,habitStats,habitStreak,habitTemplates,hasCompletion,isDue,normalizeHabit,overallHabits,scheduleDays,toggleHabit,validHabitDate,moveHabitDate,weekBeginning,weeklyCount} from './habits';
import './habit-studio.css';
type Props={store:Store;setStore:Dispatch<SetStateAction<Store>>;workspaceId:string};
type View='hoje'|'calendario'|'analise'|'habitos';
type HabitForm={title:string;icon:string;category:string;frequency:HabitFrequency;days:number[];target:number;notes:string;startDate:string;reminderTime:string;tone:string};
const views:{id:View;label:string;icon:typeof Leaf}[]=[
 {id:'hoje',label:'Meu dia',icon:Leaf},{id:'calendario',label:'Calendário',icon:CalendarDays},
 {id:'analise',label:'Evolução',icon:BarChart3},{id:'habitos',label:'Meus hábitos',icon:Grid3X3}
];
const colors:Record<string,string>={green:'#2d9b83',blue:'#4a89c8',violet:'#8572cf',orange:'#d9904b',pink:'#c76f86'};
const palette=Object.keys(colors);
const frequencyName=(h:Habit)=>h.frequency==='Diária'?'Todos os dias':h.frequency==='Semanal'?h.targetPerWeek+'× por semana':h.scheduleDays.split(',').map(n=>WEEKDAYS[Number(n)]).join(', ');
const dayOfHabitWeekSafe=(d:string)=>dayOfHabitWeek(d);
const eligibleForHeatmap=(h:Habit,d:string)=>h.frequency!=='Semanal'&&eligible(h,d);
const labelDate=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
const longDate=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
const byDay=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');
const initial=(day:string):HabitForm=>({title:'',icon:'🌱',category:'Pessoal',frequency:'Diária',days:[0,1,2,3,4,5,6],target:3,notes:'',startDate:day,reminderTime:'',tone:'green'});
const formFrom=(h:Habit):HabitForm=>({title:h.title,icon:h.icon,category:h.category,frequency:h.frequency,
 days:[...scheduleDays(h)],target:h.targetPerWeek,notes:h.notes,startDate:h.startDate,reminderTime:h.reminderTime,tone:String(h.tone||'green')});
function HabitTile({habit,day,onToggle,onEdit,onArchive}:{habit:Habit;day:string;onToggle:()=>void;onEdit:()=>void;onArchive:()=>void}){
 const metric=habitStats(habit,day),done=metric.completedToday;
 const weekly=habit.frequency==='Semanal',achieved=weekly&&metric.weekly>=habit.targetPerWeek;
 const due=isDue(habit,day);
 const tone=colors[String(habit.tone)]||colors.green;
 return <article className={'habit-tile '+(done?'is-done ':'')+(achieved?'is-achieved ':'')} style={{'--habit-color':tone} as CSSProperties}>
  <div className="habit-tile-icon"><HabitGlyph value={habit.icon}/></div>
  <div className="habit-tile-content"><div className="habit-title-line"><strong>{habit.title}</strong>{achieved&&<span className="habit-mini-status"><Check size={12}/> Meta atingida</span>}</div>
  <p>{habit.category} <span className="habit-dot"/> {frequencyName(habit)}</p>
  <div className="habit-tile-footer"><span><Flame size={14}/> {metric.streak} {habit.frequency==='Semanal'?'semana(s)':'ocorrência(s)'}</span>{weekly&&<span>{metric.weekly} de {habit.targetPerWeek} nesta semana</span>}{!weekly&&metric.completedToday&&<span>Feito hoje</span>}</div></div>
  <div className="habit-tile-actions"><button className={'habit-action-check '+(done?'checked':'')} aria-label={(done?'Desmarcar':'Concluir')+' '+habit.title} aria-pressed={done} title={due||done?'Marcar/desmarcar conclusão':'Concluir no dia atual'} onClick={onToggle}><Check size={20}/></button><button className="habit-small-action" aria-label={'Editar '+habit.title} title="Editar hábito" onClick={onEdit}><Pencil size={16}/></button><button className="habit-small-action" aria-label={'Arquivar '+habit.title} title="Arquivar hábito" onClick={onArchive}><Archive size={16}/></button></div>
 </article>;
}
export default function HabitStudio({store,setStore,workspaceId}:Props){
 const day=today(),habits=useMemo(()=>store.collections.habits.filter(h=>(h.workspaceId||'pessoal')===workspaceId).map(normalizeHabit),[store.collections.habits,workspaceId]);
 const active=habits.filter(x=>!x.archived),archived=habits.filter(x=>x.archived);
 const [view,setView]=useState<View>('hoje'),[selectedDay,setSelectedDay]=useState(day),[month,setMonth]=useState(day.slice(0,7));
 const [search,setSearch]=useState(''),[category,setCategory]=useState('Todos'),[showArchived,setShowArchived]=useState(false);
 const [modal,setModal]=useState(false),[editingId,setEditingId]=useState(''),[form,setForm]=useState<HabitForm>(initial(day));
 const [toast,setToast]=useState(''),[confirmDay,setConfirmDay]=useState<string|null>(null);
 const stats=overallHabits(active,day),calendar=habitCalendar(active,month,day);
 const accent=(h:Habit)=>colors[String(h.tone)]||colors.green;
 const notify=(s:string)=>{setToast(s);window.setTimeout(()=>setToast(''),4000)};
 const patch=(id:string,fn:(h:Habit)=>Habit)=>setStore(s=>({...s,collections:{...s.collections,habits:s.collections.habits.map(old=>old.id===id&&(old.workspaceId||'pessoal')===workspaceId?fn(normalizeHabit(old)):old)}}));
 const open=(h?:Habit,template?:Partial<HabitForm>)=>{
  setEditingId(h?.id||'');setForm(h?formFrom(h):{...initial(day),...template});setModal(true);
 };
 const save=(e:FormEvent)=>{
  e.preventDefault();const title=form.title.trim();
  if(title.length<2||title.length>150)return notify('Digite um nome entre 2 e 150 caracteres.');
  if(!validHabitDate(form.startDate))return notify('Informe uma data de início válida.');
  if(form.frequency==='Personalizada'&&!form.days.length)return notify('Selecione pelo menos um dia da semana.');
  if(!Number.isInteger(form.target)||form.target<1||form.target>7)return notify('A meta semanal deve estar entre 1 e 7 dias.');
  if(form.reminderTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.reminderTime))return notify('Horário inválido.');
  const old=habits.find(x=>x.id===editingId);
  const entry={...old,id:old?.id||uid(),createdAt:old?.createdAt||new Date().toISOString(),workspaceId,title,icon:form.icon,category:form.category,frequency:form.frequency,
   doneDates:old?.doneDates||'',startDate:form.startDate,scheduleDays:[...form.days].sort().join(','),targetPerWeek:form.target,notes:form.notes.trim().slice(0,4000),
   reminderTime:form.reminderTime,tone:palette.includes(form.tone)?form.tone:'green',archived:old?.archived||false,archivedAt:old?.archivedAt||''};
  setStore(s=>({...s,collections:{...s.collections,habits:old?s.collections.habits.map(x=>x.id===old.id?entry:x):[entry,...s.collections.habits]}}));
  setModal(false);notify(old?'Hábito atualizado.':'Novo hábito criado.');
 };
 const toggle=(h:Habit,chosen=day)=>{
  if(chosen>day)return notify('Não é possível registrar conclusões futuras.');
  if(h.archived)return notify('Reative o hábito para voltar a registrar.');
  try{patch(h.id,x=>toggleHabit(x,chosen,day));notify(hasCompletion(h,chosen)?'Conclusão desfeita.':'Mais um passo registrado!')}catch(err){notify(err instanceof Error?err.message:'Este dia não está disponível.')}
 };
 const archive=(h:Habit)=>{
  if(!window.confirm((h.archived?'Reativar':'Arquivar')+' "'+h.title+'"? O histórico será preservado.'))return;
  patch(h.id,x=>({...x,archived:!x.archived,archivedAt:x.archived?'':day}));notify(h.archived?'Hábito reativado.':'Hábito arquivado sem apagar o histórico.');
 };
 const remove=(h:Habit)=>{
  if(!window.confirm('Excluir permanentemente "'+h.title+'" e suas conclusões?'))return;
  setStore(s=>({...s,collections:{...s.collections,habits:s.collections.habits.filter(x=>x.id!==h.id||((x.workspaceId||'pessoal')!==workspaceId))}}));
  notify('Hábito excluído.');
 };
 const list=(items:Habit[])=>items.filter(h=>(category==='Todos'||h.category===category)&&h.title.toLowerCase().includes(search.trim().toLowerCase()));
 const selected=active.filter(h=>h.startDate<=selectedDay&&(h.frequency==='Semanal'||h.frequency==='Diária'||scheduleDays(h).has((new Date(selectedDay+'T12:00:00Z').getUTCDay()+6)%7)));
 const selectedDone=selected.filter(h=>selectedDay<=day&&hasCompletion(h,selectedDay)).length;
 const nextMonth=(offset:number)=>{const [year,m]=month.split('-').map(Number);const target=new Date(Date.UTC(year,m-1+offset,1)).toISOString().slice(0,7);setMonth(target);setSelectedDay(target+'-01');};
 const seven=Array.from({length:7},(_,i)=>{const d=moveHabitDate(day,i-6);const count=active.filter(h=>h.startDate<=d&&hasCompletion(h,d)).length;return {day:d,count}});
 const max7=Math.max(1,...seven.map(x=>x.count));
 const monthTotal=calendar.reduce((sum,d)=>sum+d.completed,0);
 const monthExpected=calendar.filter(d=>d.day<=day).reduce((sum,d)=>sum+d.expected,0);
 const best=active.map(h=>({habit:h,stats:habitStats(h,day)})).sort((a,b)=>b.stats.streak-a.stats.streak);
 const weekly=active.filter(h=>h.frequency==='Semanal');
 return <section className="habit-studio" aria-label="Central de hábitos">
  <header className="habit-hero"><div><span className="habit-eyebrow"><Leaf size={15}/> EIXO / CONSTÂNCIA</span><h1>Pequenos passos, <em>grandes mudanças.</em></h1><p>Acompanhe seus hábitos com metas realistas, histórico e um pouco de consistência todos os dias.</p></div><button className="habit-btn primary" onClick={()=>open()}><Plus size={17}/> Novo hábito</button></header>
  {toast&&<div className="habit-notice" role="status">{toast}</div>}
  <nav className="habit-tabs" aria-label="Seções de hábitos">{views.map(v=><button aria-current={view===v.id?'page':undefined} className={view===v.id?'selected':''} key={v.id} onClick={()=>setView(v.id)}><v.icon size={17}/>{v.label}</button>)}</nav>
  {view==='hoje'&&<>
   <div className="habit-metrics">
    <article data-tone={stats.todays&&stats.completed>=stats.todays?'positive':'info'}><span><CheckCircle2 size={18}/> Progresso de hoje</span><strong>{stats.completed} <small>/ {stats.todays}</small></strong><div className="habit-progress"><i style={{width:stats.progress+'%'}}/></div><p>{stats.todays?stats.progress+'% dos hábitos elegíveis':'Nenhum hábito previsto hoje'}</p></article>
    <article><span><Flame size={18}/> Maior sequência ativa</span><strong>{best[0]?.stats.streak||0} <small>{best[0]?.habit.frequency==='Semanal'?'sem.':'dias*'}</small></strong><p>*Dias ou ocorrências programadas consecutivas</p></article>
    <article><span><Target size={18}/> Hábitos ativos</span><strong>{active.length}</strong><p>{stats.weeklyTotal?stats.weeklyCompleted+' de '+stats.weeklyTotal+' metas semanais concluídas':'Personalize sua rotina'}</p></article>
    <article><span><CalendarDays size={18}/> Registros no mês</span><strong>{monthTotal}</strong><p>Marcações realizadas no calendário atual</p></article>
   </div>
   <div className="habit-overview-grid">
    <article className="habit-panel habit-today"><div className="habit-panel-head"><div><span className="habit-eyebrow">ROTINA DE HOJE</span><h2>{longDate(day)}</h2></div><span className="habit-counter">{stats.remaining} pendente(s)</span></div>
     {active.filter(h=>isDue(h,day)||hasCompletion(h,day)).length?<div className="habit-tiles">{active.filter(h=>isDue(h,day)||hasCompletion(h,day)).sort((a,b)=>Number(hasCompletion(a,day))-Number(hasCompletion(b,day))).map(h=><HabitTile key={h.id} habit={h} day={day} onToggle={()=>toggle(h)} onEdit={()=>open(h)} onArchive={()=>archive(h)}/>)}</div>:<div className="habit-empty"><span><HabitGlyph value="🌤️" size={52}/></span><h3>{active.length?'Tudo em dia por aqui!':'Sua jornada começa aqui'}</h3><p>{active.length?'Você não tem hábitos pendentes para hoje.':'Comece com um ou dois hábitos pequenos e registre seu progresso diariamente.'}</p><button className="habit-btn secondary" onClick={()=>open()}><Plus size={16}/> Criar hábito</button></div>}
    </article>
    <aside className="habit-panel habit-quick-panel"><span className="habit-eyebrow">SEU DIA, SEU RITMO</span><div className="habit-ring" style={{'--ring-progress':stats.progress+'%'} as CSSProperties}><div><strong>{stats.progress}%</strong><small>hoje</small></div></div><h3>{stats.completed===stats.todays&&stats.todays?'Rotina do dia concluída!':stats.todays?'Um passo de cada vez.':'Organize sua constância.'}</h3><p>{stats.todays?stats.completed+' de '+stats.todays+' marcados hoje.':'Crie hábitos com metas que combinem com sua vida.'}</p><button className="habit-btn secondary" onClick={()=>setView('calendario')}><CalendarDays size={16}/> Ver calendário</button><div className="habit-tip"><Sparkles size={17}/><span>Falhar um dia não apaga seu histórico. A sequência é recalculada com base nas datas previstas.</span></div></aside>
   </div>
   <div className="habit-overview-grid">
    <section className="habit-panel"><div className="habit-panel-head"><div><span className="habit-eyebrow">CONSISTÊNCIA</span><h2>Últimos sete dias</h2></div><button className="habit-link" onClick={()=>setView('analise')}>Ver evolução <ArrowRight size={15}/></button></div><div className="habit-bars">{seven.map(x=><div key={x.day}><span>{x.count||''}</span><div><i style={{height:(x.count/max7*100)+'%'}}/></div><small>{byDay(x.day)}</small></div>)}</div><p className="habit-footnote">Quantidade de hábitos concluídos em cada dia.</p></section>
    <section className="habit-panel"><div className="habit-panel-head"><div><span className="habit-eyebrow">SUAS MELHORES ROTINAS</span><h2>Em destaque</h2></div><button className="habit-link" onClick={()=>setView('habitos')}>Todos os hábitos <ArrowRight size={15}/></button></div>{best.slice(0,4).map(({habit,stats:st})=><div className="habit-list-row" key={habit.id}><span className="habit-list-icon"><HabitGlyph value={habit.icon}/></span><div><strong>{habit.title}</strong><small>{frequencyName(habit)}</small></div><span className="habit-streak"><Flame size={15}/>{st.streak}</span></div>)}{!best.length&&<p className="habit-muted">Seus hábitos aparecerão aqui conforme forem cadastrados.</p>}</section>
   </div>
   {!active.length&&<section className="habit-panel habit-template-panel"><div className="habit-panel-head"><div><span className="habit-eyebrow">INSPIRAÇÃO</span><h2>Comece com um destes hábitos</h2></div></div><div className="habit-presets">{habitTemplates.slice(0,6).map(t=><button key={t.title} onClick={()=>open(undefined,{title:t.title,icon:t.icon,category:t.category,frequency:t.frequency,notes:'notes'in t?String(t.notes):'',days:'scheduleDays'in t?String(t.scheduleDays).split(',').map(Number):[0,1,2,3,4,5,6],target:'targetPerWeek'in t?Number(t.targetPerWeek):3})}><span><HabitGlyph value={t.icon}/></span><strong>{t.title}</strong><Plus size={14}/></button>)}</div></section>}
  </>}
  {view==='calendario'&&<>
   <div className="habit-section-head"><div><h2>Seu calendário de constância</h2><p>Veja marcações realizadas, dias previstos e acompanhe datas anteriores.</p></div><button className="habit-btn primary" onClick={()=>open()}><Plus size={16}/> Criar hábito</button></div>
   <div className="habit-calendar-layout">
    <section className="habit-panel"><div className="habit-calendar-head"><div><span className="habit-eyebrow">HISTÓRICO MENSAL</span><h2>{new Date(month+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2></div><div className="habit-month-controls"><button onClick={()=>nextMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18}/></button><button onClick={()=>nextMonth(1)} aria-label="Próximo mês"><ChevronRight size={18}/></button></div></div>
     <div className="habit-weekdays">{WEEKDAYS.map(d=><span key={d}>{d}</span>)}</div>
     <div className="habit-calendar-grid">{Array.from({length:dayOfHabitWeekSafe(month+'-01')},(_,i)=><i key={'gap'+i}/>)}{calendar.map(d=><button key={d.day} aria-pressed={selectedDay===d.day} className={(selectedDay===d.day?'selected ':'')+(d.day===day?'today ':'')+(d.completed?'has-done':'')} onClick={()=>setSelectedDay(d.day)}><b>{Number(d.day.slice(-2))}</b><span className="habit-day-dots">{d.completed>0&&<i className="done"/>}{d.expected>0&&<i className="expected"/>}</span></button>)}</div>
     <div className="habit-calendar-legend"><span><i className="done"/> Registrado</span><span><i className="expected"/> Previsto</span></div>
     <p className="habit-footnote">Hábitos semanais contam na meta da semana, não como obrigação em todos os dias.</p>
    </section>
    <aside className="habit-panel"><div className="habit-panel-head"><div><span className="habit-eyebrow">DIA SELECIONADO</span><h2>{labelDate(selectedDay)}</h2></div><span className="habit-counter">{selectedDone} registrado(s)</span></div>
    {selected.length?selected.map(h=><div className="habit-day-row" key={h.id}><span><HabitGlyph value={h.icon}/></span><div><strong>{h.title}</strong><small>{h.frequency==='Semanal'?weeklyCount(h,selectedDay)+'/'+h.targetPerWeek+' na semana':h.category}</small></div><button disabled={selectedDay>day} className={hasCompletion(h,selectedDay)?'checked':''} onClick={()=>toggle(h,selectedDay)} aria-label={(hasCompletion(h,selectedDay)?'Desmarcar':'Marcar')+' '+h.title+' em '+selectedDay}><Check size={17}/></button></div>):<div className="habit-empty small"><CalendarDays size={27}/><p>Nenhum hábito programado para este dia.</p></div>}
    <div className="habit-day-total">Marcações concluídas <strong>{selectedDone}</strong><small>Histórico editável até hoje. O registro real nunca é criado automaticamente.</small></div>
    </aside>
   </div>
  </>}
  {view==='analise'&&<>
   <div className="habit-section-head"><div><h2>Sua evolução</h2><p>Estatísticas baseadas somente nas marcações registradas.</p></div><button className="habit-btn secondary" onClick={()=>setView('calendario')}><CalendarDays size={16}/> Calendário</button></div>
   <div className="habit-metrics three"><article><span><Check size={18}/> Marcações no mês</span><strong>{monthTotal}</strong><p>Total de atividades realizadas no mês selecionado</p></article><article><span><Target size={18}/> Taxa mensal*</span><strong>{monthExpected?Math.round(calendar.filter(d=>d.day<=day).reduce((n,d)=>n+d.completedScheduled,0)/monthExpected*100)+'%':'—'}</strong><p>*Apenas metas diárias/personalizadas, sem incluir semanais</p></article><article><span><Flame size={18}/> Maior sequência atual</span><strong>{best[0]?.stats.streak||0}</strong><p>{best[0]?best[0].habit.title:'Adicione hábitos para acompanhar'}</p></article></div>
   <div className="habit-analysis-grid">
    <section className="habit-panel"><div className="habit-panel-head"><div><span className="habit-eyebrow">DISTRIBUIÇÃO DE CONSTÂNCIA</span><h2>Últimos 30 dias</h2></div></div>
     <div className="habit-heatmap" aria-label="Mapa de calor dos hábitos"><div className="habit-heatmap-grid">{Array.from({length:30},(_,i)=>{const date=moveHabitDate(day,i-29),actual=active.filter(h=>eligibleForHeatmap(h,date)&&hasCompletion(h,date)).length;const expected=active.filter(h=>eligibleForHeatmap(h,date)).length;const strength=expected?Math.min(4,Math.ceil(actual/expected*4)):0;return <button key={date} type="button" className={'habit-heatmap-cell heat-'+strength} title={date+': '+actual+' de '+expected+' hábitos concluídos'} aria-label={date+': '+actual+' de '+expected+' hábitos concluídos'} onClick={()=>{setSelectedDay(date);setMonth(date.slice(0,7));setView('calendario')}}/>})}</div></div><p className="habit-muted">Mais cor significa maior proporção de hábitos registrados nos dias elegíveis.</p>
     <div className="habit-heat-legend"><span>Menos</span>{[0,1,2,3,4].map(n=><i key={n} className={'heat-'+n}/>)}<span>Mais</span></div>
    </section>
    <section className="habit-panel"><div className="habit-panel-head"><div><span className="habit-eyebrow">DESEMPENHO INDIVIDUAL</span><h2>Hábitos em destaque</h2></div></div>
     {best.map(({habit,stats:m})=><div className="habit-analysis-row" key={habit.id}><span className="habit-list-icon"><HabitGlyph value={habit.icon}/></span><div><strong>{habit.title}</strong><small>{m.total} registros · {habit.frequency==='Semanal'?m.streak+' semanas de sequência':m.streak+' ocorrências seguidas'}</small><div className="habit-progress"><i style={{width:m.rate30+'%',background:accent(habit)}}/></div></div><span>{habit.frequency==='Semanal'?m.weekly+'/'+habit.targetPerWeek+' sem.':m.rate30+'%'}</span></div>)}
     {!best.length&&<p className="habit-muted">As análises individuais aparecerão após cadastrar hábitos.</p>}
    </section>
   </div>
   {!!weekly.length&&<section className="habit-panel"><div className="habit-panel-head"><div><span className="habit-eyebrow">OBJETIVOS SEMANAIS</span><h2>Metas de frequência</h2></div></div><div className="habit-week-goals">{weekly.map(h=>{const completed=weeklyCount(h,day),rate=Math.min(100,Math.round(completed/h.targetPerWeek*100));return <article key={h.id}><div><span><HabitGlyph value={h.icon}/></span><strong>{h.title}</strong><small>{completed} / {h.targetPerWeek} dias na semana</small></div><div className="habit-progress"><i style={{width:rate+'%',background:accent(h)}}/></div></article>})}</div></section>}
  </>}
  {view==='habitos'&&<>
   <div className="habit-section-head"><div><h2>Minha biblioteca de hábitos</h2><p>Personalize horários, categorias, frequência e a rotina de cada hábito.</p></div><button className="habit-btn primary" onClick={()=>open()}><Plus size={16}/> Novo hábito</button></div>
   <div className="habit-library-tools"><label className="habit-search"><Search size={16}/><input aria-label="Buscar hábito" value={search} placeholder="Buscar hábito..." onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filtrar categoria" value={category} onChange={e=>setCategory(e.target.value)}><option>Todos</option>{HABIT_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><button className={'habit-btn secondary '+(showArchived?'active':'')} onClick={()=>setShowArchived(v=>!v)}><Archive size={15}/>{showArchived?'Mostrar ativos':'Arquivados ('+archived.length+')'}</button></div>
   <section className="habit-panel"><div className="habit-panel-head"><h2>{showArchived?'Hábitos arquivados':'Hábitos ativos'}</h2><span className="habit-muted">{list(showArchived?archived:active).length} registro(s)</span></div>
    {list(showArchived?archived:active).map(h=>{
     const metric=habitStats(h,day);
     return <article key={h.id} className="habit-library-row"><div className="habit-list-icon"><HabitGlyph value={h.icon}/></div><div className="habit-library-copy"><strong>{h.title}</strong><small>{h.category} · {frequencyName(h)} · {metric.total} registro(s)</small>{h.notes&&<p>{h.notes}</p>}</div><div className="habit-library-actions"><span className="habit-library-streak"><Flame size={14}/>{metric.streak}</span><button aria-label={'Editar '+h.title} onClick={()=>open(h)}><Pencil size={16}/></button><button aria-label={(h.archived?'Reativar ':'Arquivar ')+h.title} onClick={()=>archive(h)}>{h.archived?<RotateCcw size={16}/>:<Archive size={16}/>}</button><button aria-label={'Excluir '+h.title} onClick={()=>remove(h)}><Trash2 size={16}/></button></div></article>;
    })}
    {!list(showArchived?archived:active).length&&<div className="habit-empty small"><FolderOpen size={24}/><strong>{showArchived?'Nenhum hábito arquivado':'Nenhum hábito encontrado'}</strong><p>{showArchived?'Os hábitos arquivados ficam aqui sem perder o histórico.':'Experimente ajustar o filtro ou criar um novo hábito.'}</p></div>}
   </section>
   <section className="habit-panel"><div className="habit-panel-head"><div><span className="habit-eyebrow">COMECE DE UM JEITO SIMPLES</span><h2>Modelos para adicionar</h2></div></div><div className="habit-presets">{habitTemplates.map(t=><button key={t.title} onClick={()=>open(undefined,{title:t.title,icon:t.icon,category:t.category,frequency:t.frequency,notes:'notes'in t?String(t.notes):'',days:'scheduleDays'in t?String(t.scheduleDays).split(',').map(Number):[0,1,2,3,4,5,6],target:'targetPerWeek'in t?Number(t.targetPerWeek):3})}><span><HabitGlyph value={t.icon}/></span><strong>{t.title}</strong><Plus size={15}/></button>)}</div></section>
   <p className="habit-footnote">Horários escolhidos servem para organização pessoal; notificações automáticas não estão ativadas.</p>
  </>}
  {modal&&<div className="habit-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="habit-dialog" role="dialog" aria-modal="true" aria-label="Editor de hábitos" onSubmit={save}><header><div><span className="habit-eyebrow">ROTINA PERSONALIZADA</span><h2>{editingId?'Editar hábito':'Novo hábito'}</h2><p>Defina um compromisso simples e acompanhe seus resultados.</p></div><button type="button" aria-label="Fechar editor" onClick={()=>setModal(false)}><X size={19}/></button></header>
   <div className="habit-fields"><label>Nome do hábito<input value={form.title} required maxLength={150} placeholder="Ex.: Ler 20 minutos" onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
    <label>Escolha um ícone</label><div className="habit-icon-picker" role="group" aria-label="Escolher ícone do hábito">{HABIT_ICONS.map(icon=><button type="button" aria-label={'Ícone '+habitGlyphLabel(icon)} aria-pressed={form.icon===icon} className={form.icon===icon?'selected':''} key={icon} onClick={()=>setForm(v=>({...v,icon}))}><HabitGlyph value={icon}/></button>)}</div>
    <div className="habit-field-row"><label>Categoria<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{HABIT_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label>Frequência<select value={form.frequency} onChange={e=>setForm(v=>({...v,frequency:e.target.value as HabitFrequency}))}><option>Diária</option><option>Semanal</option><option>Personalizada</option></select></label></div>
    {form.frequency==='Personalizada'&&<fieldset className="habit-days"><legend>Dias da semana</legend><div>{WEEKDAYS.map((w,idx)=><button type="button" aria-pressed={form.days.includes(idx)} className={form.days.includes(idx)?'selected':''} key={w} onClick={()=>setForm(v=>({...v,days:v.days.includes(idx)?v.days.filter(n=>n!==idx):[...v.days,idx]}))}>{w}</button>)}</div></fieldset>}
    {form.frequency==='Semanal'&&<label>Meta: quantos dias por semana?<input type="number" min="1" max="7" required value={form.target} onChange={e=>setForm(v=>({...v,target:Number(e.target.value)}))}/></label>}
    <div className="habit-field-row"><label>Começar em<input type="date" required value={form.startDate} onChange={e=>setForm(v=>({...v,startDate:e.target.value}))}/></label><label>Horário preferido (opcional)<input type="time" value={form.reminderTime} onChange={e=>setForm(v=>({...v,reminderTime:e.target.value}))}/></label></div><small className="habit-muted">O horário é apenas organizacional; o EIXO não enviará lembretes automáticos.</small>
    <label>Cor de destaque</label><div className="habit-color-picker" role="group" aria-label="Cor do hábito">{palette.map(c=><button key={c} type="button" style={{background:colors[c]}} aria-label={'Cor '+c} aria-pressed={form.tone===c} className={form.tone===c?'selected':''} onClick={()=>setForm(v=>({...v,tone:c}))}>{form.tone===c&&<Check size={15}/>}</button>)}</div>
    <label>Motivação ou observações<textarea maxLength={4000} value={form.notes} placeholder="Por que este hábito é importante para você?" onChange={e=>setForm(v=>({...v,notes:e.target.value}))}/></label>
   </div><footer><button className="habit-btn secondary" type="button" onClick={()=>setModal(false)}>Cancelar</button><button className="habit-btn primary" type="submit"><Check size={16}/> Salvar hábito</button></footer>
  </form></div>}
 </section>;
}
