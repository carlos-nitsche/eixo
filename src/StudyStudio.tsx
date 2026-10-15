import {useEffect,useMemo,useState} from 'react';
import type {Dispatch,FormEvent,SetStateAction} from 'react';
import {BookOpen,CalendarDays,Check,ChevronLeft,ChevronRight,Clock3,Flame,GraduationCap,Layers3,Pause,Play,Plus,RotateCcw,Search,Target,Trash2,X,BarChart3,Pencil,Timer} from 'lucide-react';
import type {Entry,Store} from './model';
import {uid,today} from './model';
import {dueCards,emptyStudy,examAverage,focusSeconds,parseStudy,reviewCard,shiftStudyDate,studyCalendar,studySummary} from './study';
import type {StudyCard,StudyData,StudyExam,StudyFocus,StudyPlan} from './study';
import './study-studio.css';
import StudyNotebook from './StudyNotebook';
import type {BrainIdea,BrainNode} from './brain';
type Tab='notas'|'visao'|'disciplinas'|'foco'|'planejamento'|'revisoes'|'historico';
type Kind='subject'|'plan'|'card'|'exam'|'session';
type Props={store:Store;setStore:Dispatch<SetStateAction<Store>>;workspaceId:string};
const sections:{id:Tab;label:string;icon:typeof BookOpen}[]=[
 {id:'notas',label:'Notas e cérebro',icon:BookOpen},
 {id:'visao',label:'Visão geral',icon:BarChart3},{id:'disciplinas',label:'Disciplinas',icon:BookOpen},
 {id:'foco',label:'Modo foco',icon:Timer},{id:'planejamento',label:'Planejamento',icon:CalendarDays},
 {id:'revisoes',label:'Revisões',icon:Layers3},{id:'historico',label:'Histórico',icon:Clock3}
];
const minutes=(n:number)=>n>=60?Math.floor(n/60)+'h '+Math.round(n%60)+'min':Math.round(n)+' min';
const timerText=(s:number)=>[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,'0')).join(':');
const niceDate=(v:string)=>new Date(v+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
const num=(v:unknown)=>Number(v)||0;
const fresh=(ws:string):StudyFocus=>({workspaceId:ws,subjectId:'',title:'',targetMinutes:25,startedAt:null,accumulatedSeconds:0});
const nowIso=()=>new Date().toISOString();
const allowedDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d+'T12:00:00Z'));
export default function StudyStudio({store,setStore,workspaceId}:Props){
 const data=useMemo(()=>parseStudy(store.study),[store.study]);
 const subjects=store.collections.subjects.filter(x=>(x.workspaceId||'pessoal')===workspaceId);
 const sessions=store.collections.studies.filter(x=>(x.workspaceId||'pessoal')===workspaceId);
 const plans=data.plans.filter(x=>x.workspaceId===workspaceId);
 const cards=data.cards.filter(x=>x.workspaceId===workspaceId);
 const exams=data.exams.filter(x=>x.workspaceId===workspaceId);
 const focus=data.focus.find(x=>x.workspaceId===workspaceId)||fresh(workspaceId);
 const [tab,setTab]=useState<Tab>('notas');
 const [dialog,setDialog]=useState<Kind|null>(null),[editing,setEditing]=useState('');
 const [form,setForm]=useState<Record<string,string>>({});
 const [selectedSubject,setSelectedSubject]=useState('');
 const [search,setSearch]=useState(''),[month,setMonth]=useState(today().slice(0,7)),[daySelected,setDaySelected]=useState(today());
 const [clock,setClock]=useState(nowIso()),[answer,setAnswer]=useState(false),[reviewId,setReviewId]=useState('');
 const [notice,setNotice]=useState(''),[goalDraft,setGoalDraft]=useState('');
 const day=today(),studyRows=sessions.map(s=>({date:String(s.date||''),duration:Number(s.duration)||0})),summary=studySummary(studyRows,day,data.weeklyGoalMinutes);
 const due=dueCards(cards,day),currentCard=cards.find(x=>x.id===reviewId)||due[0];
 const elapsed=focusSeconds(focus,clock),limit=focus.targetMinutes*60;
 const calendar=studyCalendar(studyRows,plans,month,exams);
 const subjectName=(id:string)=>subjects.find(x=>x.id===id)?.title||'Estudo independente';
 const changeStudy=(fn:(d:StudyData)=>StudyData)=>setStore(s=>({...s,study:fn(parseStudy(s.study))}));
 const message=(v:string)=>{setNotice(v);window.setTimeout(()=>setNotice(''),4000)};
 const updateFocus=(fn:(f:StudyFocus)=>StudyFocus)=>changeStudy(d=>({...d,focus:[...d.focus.filter(x=>x.workspaceId!==workspaceId),fn(d.focus.find(x=>x.workspaceId===workspaceId)||fresh(workspaceId))]}));
 useEffect(()=>{const id=setInterval(()=>setClock(nowIso()),1000);return()=>clearInterval(id)},[]);
 const open=(kind:Kind,item?:any)=>{
  setDialog(kind);setEditing(item?.id||'');
  if(kind==='subject')setForm(item?{title:item.title,teacher:String(item.teacher||''),nextExam:String(item.nextExam||''),attendancePresent:String(item.attendancePresent||''),attendanceTotal:String(item.attendanceTotal||''),grade:String(item.grade??''),notes:String(item.notes||'')}:{title:'',teacher:'',attendancePresent:'0',attendanceTotal:'0',nextExam:'',grade:'',notes:''});
  if(kind==='plan')setForm(item?{title:item.title,subjectId:item.subjectId,date:item.date,minutes:String(item.minutes),notes:item.notes||''}:{title:'',subjectId:selectedSubject||subjects[0]?.id||'',date:daySelected,minutes:'45',notes:''});
  if(kind==='card')setForm(item?{front:item.front,back:item.back,subjectId:item.subjectId}:{front:'',back:'',subjectId:selectedSubject||subjects[0]?.id||''});
  if(kind==='exam')setForm(item?{title:item.title,subjectId:item.subjectId,date:item.date,weight:String(item.weight),maximum:String(item.maximum),grade:String(item.grade??''),notes:item.notes||''}:{title:'',subjectId:selectedSubject||subjects[0]?.id||'',date:day,weight:'1',maximum:'10',grade:'',notes:''});
  if(kind==='session')setForm(item?{title:item.title,subject:String(item.subject||''),date:String(item.date||day),duration:String(item.duration||''),notes:String(item.notes||'')}:{title:'',subject:selectedSubject?subjectName(selectedSubject):'',date:day,duration:'30',notes:''});
 };
 const save=(e:FormEvent)=>{
  e.preventDefault();if(!dialog)return;
  const title=(form.title||'').trim(),stamp=nowIso(),existing=editing;
  if(dialog==='subject'){
   const pres=Number(form.attendancePresent||0),tot=Number(form.attendanceTotal||0);
   if(!title||!Number.isInteger(pres)||!Number.isInteger(tot)||pres<0||pres>tot||tot>100000||form.grade!==''&&(num(form.grade)<0||num(form.grade)>10))return message('Revise nome, frequência e nota (0 a 10).');
   const old=subjects.find(x=>x.id===existing);
   const item:Entry={...old,id:old?.id||uid(),createdAt:old?.createdAt||stamp,workspaceId,title,teacher:form.teacher||'',nextExam:form.nextExam||'',attendancePresent:pres,attendanceTotal:tot,grade:form.grade===''?'':Number(form.grade),notes:form.notes||''};
   setStore(s=>({...s,collections:{...s.collections,subjects:old?s.collections.subjects.map(x=>x.id===old.id?item:x):[...s.collections.subjects,item],studies:old&&old.title!==title?s.collections.studies.map(x=>(x.workspaceId||'pessoal')===workspaceId&&(x.subject===old.title||x.subjectId===old.id)?{...x,subject:title,subjectId:old.id}:x):s.collections.studies}}));
  }
  if(dialog==='plan'){
   if(!title||!allowedDate(form.date)||!Number.isInteger(num(form.minutes))||num(form.minutes)<1||num(form.minutes)>1440)return message('Informe um plano com data e duração válidas.');
   const old=plans.find(x=>x.id===existing);
   const item:StudyPlan={sourceNoteId:form.sourceNoteId||old?.sourceNoteId,id:old?.id||uid(),workspaceId,createdAt:old?.createdAt||stamp,subjectId:form.subjectId||'',title,date:form.date,minutes:num(form.minutes),notes:form.notes||'',done:old?.done||false,completedAt:old?.completedAt};
   changeStudy(d=>({...d,plans:old?d.plans.map(x=>x.id===old.id?item:x):[...d.plans,item]}));
  }
  if(dialog==='card'){
   if(!form.front?.trim()||!form.back?.trim())return message('Informe pergunta e resposta.');
   const old=cards.find(x=>x.id===existing);
   const item:StudyCard=old?{...old,front:form.front.trim(),back:form.back.trim(),subjectId:form.subjectId||''}:{sourceNoteId:form.sourceNoteId,id:uid(),workspaceId,subjectId:form.subjectId||'',front:form.front.trim(),back:form.back.trim(),createdAt:stamp,dueDate:day,interval:0,ease:2.5,reviews:0};
   changeStudy(d=>({...d,cards:old?d.cards.map(x=>x.id===old.id?item:x):[...d.cards,item]}));
  }
  if(dialog==='exam'){
   const max=num(form.maximum),grade=form.grade===''?undefined:Number(form.grade);
   if(!title||!allowedDate(form.date)||num(form.weight)<=0||max<=0||max>100||grade!==undefined&&(!Number.isFinite(grade)||grade<0||grade>max))return message('Preencha data, peso e nota válida.');
   const old=exams.find(x=>x.id===existing);
   const item:StudyExam={id:old?.id||uid(),workspaceId,subjectId:form.subjectId||'',title,date:form.date,weight:num(form.weight),maximum:max,grade,notes:form.notes||''};
   changeStudy(d=>({...d,exams:old?d.exams.map(x=>x.id===old.id?item:x):[...d.exams,item]}));
  }
  if(dialog==='session'){
   if(!title||!allowedDate(form.date)||!Number.isInteger(num(form.duration))||num(form.duration)<1||num(form.duration)>1440)return message('Informe assunto, data e duração entre 1 e 1440 minutos.');
   const old=sessions.find(x=>x.id===existing),item:Entry={...old,id:old?.id||uid(),workspaceId,createdAt:old?.createdAt||stamp,title,subject:form.subject||'',subjectId:subjects.find(x=>x.title===form.subject)?.id||'',date:form.date,duration:num(form.duration),notes:form.notes||''};
   setStore(s=>({...s,collections:{...s.collections,studies:old?s.collections.studies.map(x=>x.id===old.id?item:x):[item,...s.collections.studies]}}));
  }
  setDialog(null);setEditing('');message('Dados salvos.');
 };
 const remove=(type:Kind,id:string,title:string)=>{
  if(!confirm('Excluir '+title+'? Não é possível desfazer.'))return;
  if(type==='subject'||type==='session')setStore(s=>({...s,collections:{...s.collections,[type==='subject'?'subjects':'studies']:s.collections[type==='subject'?'subjects':'studies'].filter(x=>x.id!==id)}}));
  else changeStudy(d=>({...d,[type==='plan'?'plans':type==='card'?'cards':'exams']:d[type==='plan'?'plans':type==='card'?'cards':'exams'].filter((x:{id:string})=>x.id!==id)}));
  message('Excluído.');
 };
 const markPlan=(id:string)=>changeStudy(d=>({...d,plans:d.plans.map(x=>x.id===id?{...x,done:!x.done,completedAt:x.done?undefined:nowIso()}:x)}));
 const rate=(grade:0|1|2|3)=>{
  if(!currentCard)return;
  const next=reviewCard(currentCard,grade,day,nowIso());
  changeStudy(d=>({...d,cards:d.cards.map(x=>x.id===next.id?next:x),reviews:[...d.reviews,{id:uid(),workspaceId,cardId:next.id,at:nowIso(),grade,previousDue:currentCard.dueDate,nextDue:next.dueDate}]}));
  setAnswer(false);setReviewId('');message('Próxima revisão: '+niceDate(next.dueDate));
 };
 const finishFocus=()=>{
  const secs=focusSeconds(focus);
  if(secs<60)return message('Estude pelo menos 1 minuto para salvar.');
  if(!confirm('Registrar '+minutes(Math.floor(secs/60))+' de estudo?'))return;
  const item:Entry={id:uid(),workspaceId,createdAt:nowIso(),title:focus.title.trim()||subjectName(focus.subjectId),subject:focus.subjectId?subjectName(focus.subjectId):'',subjectId:focus.subjectId,date:day,duration:Math.floor(secs/60),notes:'Sessão cronometrada',sourceNoteId:focus.sourceNoteId};
  setStore(s=>({...s,collections:{...s.collections,studies:[item,...s.collections.studies]},study:{...parseStudy(s.study),focus:[...parseStudy(s.study).focus.filter(x=>x.workspaceId!==workspaceId),{...fresh(workspaceId),targetMinutes:focus.targetMinutes,subjectId:focus.subjectId,title:focus.title,sourceNoteId:focus.sourceNoteId}]}}));
  message('Sessão registrada no histórico.');
 };
 const openKnowledgeRecord=(node:BrainNode)=>{const kind:Kind=node.kind==='subjects'?'subject':node.kind==='studies'?'session':node.kind==='plans'?'plan':node.kind==='cards'?'card':'exam';const source=kind==='subject'?subjects:kind==='session'?sessions:kind==='plan'?plans:kind==='card'?cards:exams;const record=source.find(x=>x.id===node.recordId);if(record)open(kind,record)};
 const studyFromNote=(note:BrainIdea,action:'card'|'plan'|'focus')=>{
  if(action==='focus'){if(focus.startedAt||focus.accumulatedSeconds>0){setTab('foco');message('Conclua ou reinicie sua sessão atual antes de estudar outra nota.');return}updateFocus(f=>({...f,title:note.title,subjectId:note.subjectId||'',sourceNoteId:note.id}));setTab('foco');return}
  open(action);setForm(f=>({...f,subjectId:note.subjectId||'',sourceNoteId:note.id,...(action==='card'?{front:note.title,back:note.notes.slice(0,5000)||'Escreva o que você aprendeu.'}:{title:'Estudar: '+note.title,notes:'[['+note.title+']]'})}));
 };
 const week=Array.from({length:7},(_,i)=>{const date=shiftStudyDate(day,i-6);return {date,minutes:sessions.filter(s=>s.date===date).reduce((n,s)=>n+Math.max(0,num(s.duration)),0)}});
 const peak=Math.max(30,...week.map(x=>x.minutes));
 return <section className="study-root" aria-label="Centro de estudos">
  <header className="study-hero"><div><p className="study-kicker"><GraduationCap size={16}/> EIXO / APRENDIZAGEM</p><h1>Seu conhecimento, conectado<span>.</span></h1><p>Escreva, conecte e aprenda. Seu espaço para transformar informação em conhecimento.</p></div><div className="study-hero-actions"><button className="study-btn secondary" onClick={()=>open('subject')}><Plus size={17}/> Disciplina</button><button className="study-btn primary" onClick={()=>setTab('foco')}><Play size={16}/> Começar a estudar</button></div></header>
  {notice&&<div className="study-notice" role="status">{notice}</div>}
  <nav className="study-tabs" aria-label="Abas de estudos">{sections.map(s=><button key={s.id} className={tab===s.id?'active':''} aria-current={tab===s.id?'page':undefined} onClick={()=>setTab(s.id)}><s.icon size={16}/>{s.label}{s.id==='revisoes'&&due.length>0&&<small>{due.length}</small>}</button>)}</nav>
  {tab==='notas'&&<StudyNotebook store={store} setStore={setStore} workspaceId={workspaceId} onOpenRecord={openKnowledgeRecord} onStudyAction={studyFromNote}/>}
  {tab==='visao'&&<>
   <div className="study-metrics">
    <article data-tone={summary.goalPct!==null&&summary.goalPct>=100?'positive':'info'}><span><Clock3 size={18}/> Nesta semana</span><strong>{minutes(summary.weekly)}</strong><small>{summary.goalPct!==null?summary.goalPct+'% da meta semanal':'Sem meta definida'}</small><div className="study-progress"><i style={{width:Math.min(100,summary.goalPct||0)+'%'}}/></div></article>
    <article><span><Flame size={18}/> Sequência</span><strong>{summary.streak} <em>dias</em></strong><small>Somente dias com estudo registrado</small></article>
    <article data-tone={due.length?'warning':'neutral'}><span><Layers3 size={18}/> Para revisar</span><strong>{due.length}</strong><small>{cards.length} cartões na biblioteca</small></article>
    <article><span><Target size={18}/> Planejamento</span><strong>{plans.filter(p=>!p.done).length}</strong><small>Atividades ainda pendentes</small></article>
   </div>
   <div className="study-overview">
    <article className="study-panel study-chart"><div className="study-panel-head"><div><span className="study-eyebrow">CONSISTÊNCIA</span><h2>Últimos sete dias</h2></div><span className="study-muted">{minutes(summary.total)} no histórico</span></div><div className="study-bars">{week.map(w=><div key={w.date}><span>{w.minutes?minutes(w.minutes):''}</span><div className="study-bar-track"><i style={{height:(w.minutes/peak*100)+'%'}}/></div><small>{new Date(w.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</small></div>)}</div></article>
    <article className="study-panel study-next"><div className="study-panel-head"><div><span className="study-eyebrow">PRÓXIMOS PASSOS</span><h2>Sua agenda</h2></div><button className="study-link" onClick={()=>setTab('planejamento')}>Ver plano <ChevronRight size={15}/></button></div>
    {plans.filter(p=>!p.done).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4).map(p=><div className="study-list-row" key={p.id}><button className="study-check" aria-label={'Concluir '+p.title} onClick={()=>markPlan(p.id)}/><div><b>{p.title}</b><small>{subjectName(p.subjectId)} · {niceDate(p.date)} · {minutes(p.minutes)}</small></div></div>)}
    {!plans.some(p=>!p.done)&&<div className="study-empty"><CalendarDays size={24}/><strong>Nenhuma atividade pendente</strong><p>Crie um plano para organizar a próxima semana.</p><button className="study-btn secondary" onClick={()=>open('plan')}><Plus size={15}/> Planejar</button></div>}
    </article>
   </div>
   <div className="study-overview study-overview-low">
    <article className="study-panel"><div className="study-panel-head"><div><span className="study-eyebrow">ORGANIZAÇÃO</span><h2>Disciplinas</h2></div><button className="study-link" onClick={()=>setTab('disciplinas')}>Ver todas <ChevronRight size={15}/></button></div>{subjects.slice(0,4).map(s=><div className="study-list-row" key={s.id}><span className="study-subject-symbol"><BookOpen size={17}/></span><div><b>{s.title}</b><small>{sessions.filter(x=>x.subjectId===s.id||x.subject===s.title||x.subject===s.id).length} sessões registradas</small></div></div>)}{!subjects.length&&<p className="study-muted">Adicione suas disciplinas para começar.</p>}</article>
    <article className="study-panel"><div className="study-panel-head"><div><span className="study-eyebrow">REVISÃO ATIVA</span><h2>Memorize o que aprendeu</h2></div></div><p className="study-muted">Revise com cartões de pergunta e resposta. As próximas datas são ajustadas conforme a dificuldade informada por você.</p><button className="study-btn primary" onClick={()=>setTab('revisoes')}>Abrir revisões <ChevronRight size={16}/></button></article>
   </div>
  </>}
  {tab==='disciplinas'&&<>
   <div className="study-section-head"><div><h2>Minhas disciplinas</h2><p>Conteúdos, frequência, provas e evolução por matéria.</p></div><button className="study-btn primary" onClick={()=>open('subject')}><Plus size={16}/> Nova disciplina</button></div>
   <label className="study-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar disciplina..." aria-label="Buscar disciplina"/></label>
   <div className="study-subject-grid">{subjects.filter(x=>x.title.toLowerCase().includes(search.toLowerCase())).map(s=>{
    const total=num(s.attendanceTotal),pres=num(s.attendancePresent),attendance=total?pres/total*100:null,grades=exams.filter(x=>x.subjectId===s.id),avg=examAverage(grades),recorded=sessions.filter(x=>x.subjectId===s.id||x.subject===s.title||x.subject===s.id);
    return <article className="study-subject-card" key={s.id}><div className="study-subject-card-top"><span className="study-subject-symbol"><BookOpen size={21}/></span><div className="study-actions"><button title="Editar disciplina" aria-label={'Editar '+s.title} onClick={()=>open('subject',s)}><Pencil size={16}/></button><button title="Excluir disciplina" aria-label={'Excluir '+s.title} onClick={()=>remove('subject',s.id,s.title)}><Trash2 size={16}/></button></div></div><h3>{s.title}</h3><p>{s.teacher||'Professor não informado'}</p><div className="study-subject-stats"><div><span>Nota</span><b>{avg!==null?avg.toFixed(1)+'/10':s.grade!==''&&s.grade!==undefined?String(s.grade)+'/10':'—'}</b></div><div><span>Frequência</span><b>{attendance!==null?attendance.toFixed(1)+'%':'—'}</b></div><div><span>Estudos</span><b>{minutes(recorded.reduce((a,b)=>a+Math.max(0,num(b.duration)),0))}</b></div></div><div className="study-progress"><i style={{width:attendance===null?'0%':Math.min(100,attendance)+'%'}}/></div><small className="study-muted">Próxima prova: {s.nextExam?niceDate(String(s.nextExam)):'não cadastrada'}</small><div className="study-card-buttons"><button onClick={()=>{open('exam');setForm(f=>({...f,subjectId:s.id}));setSelectedSubject(s.id)}}><Plus size={14}/> Avaliação</button><button onClick={()=>{setSelectedSubject(s.id);setTab('historico')}}>Histórico <ChevronRight size={14}/></button></div></article>
   })}</div>{!subjects.length&&<div className="study-empty study-panel"><BookOpen size={28}/><h3>Sua primeira disciplina começa aqui</h3><p>Organize as matérias e registre suas avaliações.</p><button className="study-btn primary" onClick={()=>open('subject')}>Adicionar disciplina</button></div>}
   <div className="study-panel"><div className="study-panel-head"><div><span className="study-eyebrow">AVALIAÇÕES</span><h2>Notas e provas</h2></div><button className="study-link" onClick={()=>open('exam')}><Plus size={15}/> Avaliação</button></div>{[...exams].sort((a,b)=>a.date.localeCompare(b.date)).map(x=><div className="study-list-row" key={x.id}><span className="study-subject-symbol"><CalendarDays size={17}/></span><div><b>{x.title}</b><small>{subjectName(x.subjectId)} · {niceDate(x.date)} · Peso {x.weight} · {x.grade===undefined?'Não realizada':x.grade+'/'+x.maximum}</small></div><div className="study-actions"><button aria-label={'Editar '+x.title} onClick={()=>open('exam',x)}><Pencil size={15}/></button><button aria-label={'Excluir '+x.title} onClick={()=>remove('exam',x.id,x.title)}><Trash2 size={15}/></button></div></div>)}{!exams.length&&<p className="study-muted">Cadastre provas, trabalhos e notas para acompanhar as médias ponderadas.</p>}</div>
  </>}
  {tab==='foco'&&<div className="study-focus-layout"><section className="study-panel study-focus"><span className="study-eyebrow">SESSÃO DE CONCENTRAÇÃO</span><h2>Um momento para aprender.</h2><p className="study-muted">Cronômetro persistente. Só conta como estudo ao salvar a sessão.</p><div className="study-focus-clock" role="timer" aria-label="Tempo da sessão">{timerText(elapsed)}</div><div className="study-progress"><i style={{width:Math.min(100,limit?elapsed/limit*100:0)+'%'}}/></div><small className="study-muted">{elapsed>=limit?'Meta da sessão alcançada':'Meta: '+minutes(focus.targetMinutes)+' · Restante: '+timerText(Math.max(0,limit-elapsed))}</small>
   <div className="study-focus-form"><label>Disciplina<select disabled={!!focus.startedAt} value={focus.subjectId} onChange={e=>updateFocus(f=>({...f,subjectId:e.target.value}))}><option value="">Estudo independente</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label>Assunto<input disabled={!!focus.startedAt} value={focus.title} placeholder="O que você vai estudar?" onChange={e=>updateFocus(f=>({...f,title:e.target.value.slice(0,200)}))}/></label><label>Objetivo (min)<select disabled={!!focus.startedAt} value={focus.targetMinutes} onChange={e=>updateFocus(f=>({...f,targetMinutes:Number(e.target.value)}))}>{[15,25,30,45,50,60,90,120].map(v=><option key={v} value={v}>{v} minutos</option>)}</select></label></div>
   <div className="study-focus-buttons">{focus.startedAt?<button className="study-btn secondary" onClick={()=>updateFocus(f=>({...f,accumulatedSeconds:focusSeconds(f),startedAt:null}))}><Pause size={17}/> Pausar</button>:<button className="study-btn primary" onClick={()=>updateFocus(f=>({...f,startedAt:nowIso()}))}><Play size={17}/> {elapsed?'Continuar':'Iniciar foco'}</button>}<button className="study-btn primary" disabled={elapsed<60} onClick={finishFocus}><Check size={17}/> Concluir e salvar</button><button className="study-btn secondary" onClick={()=>{if(confirm('Descartar tempo desta sessão?'))updateFocus(f=>({...f,startedAt:null,accumulatedSeconds:0}))}}><RotateCcw size={16}/> Zerar</button></div></section>
   <aside className="study-panel"><span className="study-eyebrow">ESTUDE MELHOR</span><h2>Seu progresso é real.</h2><p className="study-muted">A sessão pode ser pausada e retomada. O relógio usa o horário atual e continua contando quando você muda de tela.</p><div className="study-list-row"><span className="study-subject-symbol"><Clock3 size={18}/></span><div><b>{minutes(summary.today)} hoje</b><small>{summary.sessions} sessões no histórico</small></div></div><div className="study-list-row"><span className="study-subject-symbol"><Target size={18}/></span><div><b>{minutes(summary.weekly)} nesta semana</b><small>Meta semanal: {minutes(data.weeklyGoalMinutes)}</small></div></div><button className="study-btn secondary" onClick={()=>open('session')}><Plus size={16}/> Registrar estudo manual</button></aside></div>}
  {tab==='planejamento'&&<>
   <div className="study-section-head"><div><h2>Calendário de estudos</h2><p>Planejado e realizado aparecem separados para não inflar suas horas.</p></div><button className="study-btn primary" onClick={()=>open('plan')}><Plus size={16}/> Nova atividade</button></div>
   <div className="study-calendar-layout"><section className="study-panel"><div className="study-panel-head"><div className="study-month-controls"><button aria-label="Mês anterior" onClick={()=>setMonth(m=>shiftStudyDate(m+'-15',-31).slice(0,7))}><ChevronLeft size={18}/></button><h2>{new Date(month+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2><button aria-label="Próximo mês" onClick={()=>setMonth(m=>{const [y,mo]=m.split('-').map(Number);return new Date(Date.UTC(y,mo,15)).toISOString().slice(0,7)})}><ChevronRight size={18}/></button></div></div><div className="study-calendar"><div className="study-weekdays">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=><span key={x}>{x}</span>)}</div><div className="study-calendar-days">{Array.from({length:(new Date(month+'-01T12:00:00').getDay()+6)%7},(_,i)=><i key={'gap'+i}/>)}{calendar.map(x=><button key={x.day} aria-label={x.day+': '+x.minutes+' minutos realizados, '+x.planned+' planejados, '+x.exams+' avaliações'} aria-pressed={daySelected===x.day} className={(daySelected===x.day?'selected ':'')+(x.day===day?'today ':'')} onClick={()=>setDaySelected(x.day)}><b>{Number(x.day.slice(-2))}</b><span>{x.minutes>0&&<i className="studied"/>}{x.planned>0&&<i className="planned"/>}{x.done>0&&<i className="completed"/>}{x.exams>0&&<i className="exam"/>}</span></button>)}</div></div><div className="study-legend"><span><i className="studied"/> Estudo realizado</span><span><i className="planned"/> Planejado</span><span><i className="completed"/> Concluído</span><span><i className="exam"/> Avaliação</span></div></section>
   <aside className="study-panel"><div className="study-panel-head"><div><span className="study-eyebrow">DATA SELECIONADA</span><h2>{niceDate(daySelected)}</h2></div><button className="study-link" onClick={()=>open('plan')}><Plus size={15}/> Planejar</button></div>{plans.filter(p=>p.date===daySelected).map(x=><div className="study-list-row" key={x.id}><button aria-label={x.done?'Reabrir atividade':'Concluir atividade'} className={'study-check '+(x.done?'done':'')} onClick={()=>markPlan(x.id)}>{x.done&&<Check size={14}/>}</button><div><b className={x.done?'struck':''}>{x.title}</b><small>{subjectName(x.subjectId)} · {minutes(x.minutes)}</small></div><div className="study-actions"><button aria-label={'Editar '+x.title} onClick={()=>open('plan',x)}><Pencil size={15}/></button><button aria-label={'Excluir '+x.title} onClick={()=>remove('plan',x.id,x.title)}><Trash2 size={15}/></button></div></div>)}{exams.filter(x=>x.date===daySelected).map(x=><div className="study-list-row" key={x.id}><span className="study-subject-symbol"><GraduationCap size={17}/></span><div><b>{x.title}</b><small>Prova · {subjectName(x.subjectId)}</small></div><div className="study-actions"><button aria-label={'Editar '+x.title} onClick={()=>open('exam',x)}><Pencil size={15}/></button></div></div>)}{!plans.some(p=>p.date===daySelected)&&!exams.some(e=>e.date===daySelected)&&<p className="study-muted">Nenhuma atividade planejada para este dia.</p>}<div className="study-day-total">Estudado de verdade: <strong>{minutes(sessions.filter(x=>x.date===daySelected).reduce((s,x)=>s+Math.max(0,num(x.duration)),0))}</strong></div></aside></div>
   <section className="study-panel"><div className="study-panel-head"><div><span className="study-eyebrow">PENDÊNCIAS</span><h2>Próximos estudos</h2></div></div>{plans.filter(x=>!x.done).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12).map(p=><div className="study-list-row" key={p.id}><button aria-label={'Concluir '+p.title} className="study-check" onClick={()=>markPlan(p.id)}/><div><b>{p.title}</b><small>{subjectName(p.subjectId)} · {niceDate(p.date)} · {minutes(p.minutes)}</small></div><div className="study-actions"><button onClick={()=>open('plan',p)} aria-label={'Editar '+p.title}><Pencil size={15}/></button><button onClick={()=>remove('plan',p.id,p.title)} aria-label={'Excluir '+p.title}><Trash2 size={15}/></button></div></div>)}{!plans.some(p=>!p.done)&&<p className="study-muted">Sem estudos pendentes.</p>}</section>
  </>}
  {tab==='revisoes'&&<>
   <div className="study-section-head"><div><h2>Revisões espaçadas</h2><p>Perguntas e respostas que voltam em intervalos ajustados pelas suas avaliações.</p></div><button className="study-btn primary" onClick={()=>open('card')}><Plus size={16}/> Novo cartão</button></div>
   <div className="study-metrics study-three"><article><span><Layers3 size={18}/> Cartões</span><strong>{cards.length}</strong><small>Na sua biblioteca</small></article><article><span><Clock3 size={18}/> Para hoje</span><strong>{due.length}</strong><small>Com vencimento até hoje</small></article><article><span><Check size={18}/> Revisões registradas</span><strong>{data.reviews.filter(r=>r.workspaceId===workspaceId).length}</strong><small>Histórico total de respostas</small></article></div>
   {currentCard?<div className="study-panel study-flashcard"><div className="study-panel-head"><div><span className="study-eyebrow">CARTÃO DE REVISÃO</span><h2>{subjectName(currentCard.subjectId)}</h2></div><span className="study-muted">{due.length} pendentes</span></div><div className="study-flash-inner"><small>{answer?'RESPOSTA':'PERGUNTA'}</small><p>{answer?currentCard.back:currentCard.front}</p></div>{!answer?<button className="study-btn primary" onClick={()=>setAnswer(true)}>Mostrar resposta</button>:<><p className="study-muted">Como foi lembrar dessa resposta?</p><div className="study-review-buttons">{([['Não lembrei',0],['Difícil',1],['Lembrei',2],['Fácil',3]] as const).map(([name,value])=><button key={value} onClick={()=>rate(value)}>{name}</button>)}</div></>}{due.length>1&&<button className="study-link" onClick={()=>{setReviewId(due.find(x=>x.id!==currentCard.id)?.id||'');setAnswer(false)}}>Pular por agora <ChevronRight size={15}/></button>}</div>:<div className="study-panel study-empty"><Check size={30}/><h3>Revisões em dia</h3><p>{cards.length?'Não há cartões vencidos agora.':'Crie cartões para construir sua biblioteca de revisão.'}</p><button className="study-btn secondary" onClick={()=>open('card')}>Adicionar cartão</button></div>}
   <section className="study-panel"><div className="study-panel-head"><h2>Biblioteca de cartões</h2></div>{cards.map(x=><div className="study-list-row" key={x.id}><span className="study-subject-symbol"><Layers3 size={17}/></span><div><b>{x.front}</b><small>{subjectName(x.subjectId)} · Próxima: {niceDate(x.dueDate)} · {x.reviews} revisões</small></div><div className="study-actions"><button aria-label={'Editar cartão '+x.front} onClick={()=>open('card',x)}><Pencil size={15}/></button><button aria-label={'Excluir cartão '+x.front} onClick={()=>remove('card',x.id,x.front)}><Trash2 size={15}/></button></div></div>)}{!cards.length&&<p className="study-muted">Nenhum cartão cadastrado.</p>}</section>
  </>}
  {tab==='historico'&&<>
   <div className="study-section-head"><div><h2>Histórico e evolução</h2><p>Somente sessões efetivamente registradas entram nas horas de estudo.</p></div><button className="study-btn primary" onClick={()=>open('session')}><Plus size={16}/> Registrar sessão</button></div>
   <div className="study-metrics study-three"><article><span><Clock3 size={18}/> Tempo acumulado</span><strong>{minutes(summary.total)}</strong><small>Registrado neste espaço</small></article><article><span><BookOpen size={18}/> Sessões</span><strong>{sessions.length}</strong><small>Registros de estudo</small></article><article><span><Flame size={18}/> Sequência atual</span><strong>{summary.streak}</strong><small>Dias consecutivos</small></article></div>
   <section className="study-panel"><div className="study-panel-head"><h2>Suas sessões</h2><label className="study-search"><Search size={15}/><input aria-label="Filtrar sessões" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar assunto..."/></label></div>{sessions.filter(x=>(x.title+' '+String(x.subject||'')).toLowerCase().includes(search.toLowerCase())&&(!selectedSubject||x.subject===subjectName(selectedSubject)||x.subject===selectedSubject)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(s=><div className="study-list-row" key={s.id}><span className="study-subject-symbol"><Clock3 size={17}/></span><div><b>{s.title}</b><small>{s.subject||'Estudo independente'} · {s.date?niceDate(String(s.date)):'Sem data'} · {minutes(Math.max(0,num(s.duration)))}</small></div><div className="study-actions"><button aria-label={'Editar sessão '+s.title} onClick={()=>open('session',s)}><Pencil size={15}/></button><button aria-label={'Excluir sessão '+s.title} onClick={()=>remove('session',s.id,s.title)}><Trash2 size={15}/></button></div></div>)}{!sessions.length&&<p className="study-muted">Registre um estudo manualmente ou use o modo foco.</p>}{selectedSubject&&<button className="study-link" onClick={()=>setSelectedSubject('')}>Mostrar todas as disciplinas</button>}</section>
  </>}
  {tab==='visao'&&<div className="study-goal"><div><strong>Meta de estudos da semana</strong><small>Registre apenas horas que você realmente estudou.</small></div>{goalDraft!==''?<div className="study-goal-edit"><input aria-label="Meta semanal em minutos" type="number" min="0" max="10080" value={goalDraft} onChange={e=>setGoalDraft(e.target.value)}/><button className="study-btn primary" onClick={()=>{const n=Number(goalDraft);if(!Number.isFinite(n)||n<0||n>10080)return message('Meta entre 0 e 10.080 minutos.');changeStudy(d=>({...d,weeklyGoalMinutes:Math.round(n)}));setGoalDraft('')}}>Salvar</button></div>:<button className="study-btn secondary" onClick={()=>setGoalDraft(String(data.weeklyGoalMinutes))}>{data.weeklyGoalMinutes?minutes(data.weeklyGoalMinutes):'Sem meta'} <Pencil size={14}/></button>}</div>}
  {dialog&&<div className="study-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog(null)}}><form className="study-dialog" role="dialog" aria-modal="true" aria-label="Editor de estudos" onSubmit={save}><div className="study-dialog-head"><div><span className="study-eyebrow">CENTRO DE ESTUDOS</span><h2>{editing?'Editar':'Adicionar'} {dialog==='subject'?'disciplina':dialog==='plan'?'atividade':dialog==='card'?'cartão':dialog==='exam'?'avaliação':'sessão'}</h2></div><button type="button" aria-label="Fechar" onClick={()=>setDialog(null)}><X size={20}/></button></div>
  <div className="study-fields">
  {dialog!=='card'&&<label>Título / assunto<input required value={form.title||''} maxLength={180} onChange={e=>setForm(s=>({...s,title:e.target.value}))} placeholder="Informe um título"/></label>}
  {(['plan','card','exam'] as Kind[]).includes(dialog)&&<label>Disciplina<select value={form.subjectId||''} onChange={e=>setForm(s=>({...s,subjectId:e.target.value}))}><option value="">Sem disciplina</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
  {dialog==='subject'&&<><label>Professor<input value={form.teacher||''} onChange={e=>setForm(s=>({...s,teacher:e.target.value}))}/></label><div className="study-field-row"><label>Aulas presentes<input type="number" min="0" value={form.attendancePresent||''} onChange={e=>setForm(s=>({...s,attendancePresent:e.target.value}))}/></label><label>Total de aulas<input type="number" min="0" value={form.attendanceTotal||''} onChange={e=>setForm(s=>({...s,attendanceTotal:e.target.value}))}/></label></div><div className="study-field-row"><label>Nota atual (0 a 10)<input type="number" min="0" max="10" step=".01" value={form.grade??''} onChange={e=>setForm(s=>({...s,grade:e.target.value}))}/></label><label>Próxima prova<input type="date" value={form.nextExam||''} onChange={e=>setForm(s=>({...s,nextExam:e.target.value}))}/></label></div></>}
  {dialog==='card'&&<><label>Pergunta<textarea required maxLength={1500} value={form.front||''} onChange={e=>setForm(s=>({...s,front:e.target.value}))}/></label><label>Resposta<textarea required maxLength={5000} value={form.back||''} onChange={e=>setForm(s=>({...s,back:e.target.value}))}/></label></>}
  {dialog==='session'&&<label>Disciplina<input list="study-subject-suggestions" value={form.subject||''} onChange={e=>setForm(s=>({...s,subject:e.target.value}))}/><datalist id="study-subject-suggestions">{subjects.map(s=><option key={s.id} value={s.title}/>)}</datalist></label>}
  {(['session','plan','exam'] as Kind[]).includes(dialog)&&<label>Data<input type="date" required value={form.date||''} onChange={e=>setForm(s=>({...s,date:e.target.value}))}/></label>}
  {dialog==='plan'&&<label>Tempo previsto (minutos)<input type="number" min="1" max="1440" required value={form.minutes||''} onChange={e=>setForm(s=>({...s,minutes:e.target.value}))}/></label>}
  {dialog==='session'&&<label>Tempo realizado (minutos)<input type="number" min="1" max="1440" required value={form.duration||''} onChange={e=>setForm(s=>({...s,duration:e.target.value}))}/></label>}
  {dialog==='exam'&&<div className="study-field-row"><label>Peso<input type="number" min="0.01" step=".01" required value={form.weight||''} onChange={e=>setForm(s=>({...s,weight:e.target.value}))}/></label><label>Nota máxima<input type="number" min="1" max="100" required value={form.maximum||''} onChange={e=>setForm(s=>({...s,maximum:e.target.value}))}/></label><label>Nota obtida<input type="number" min="0" step=".01" value={form.grade??''} onChange={e=>setForm(s=>({...s,grade:e.target.value}))}/></label></div>}
  {dialog!=='card'&&<label>Observações<textarea value={form.notes||''} maxLength={4000} onChange={e=>setForm(s=>({...s,notes:e.target.value}))}/></label>}
  </div><div className="study-dialog-foot"><button className="study-btn secondary" type="button" onClick={()=>setDialog(null)}>Cancelar</button><button className="study-btn primary" type="submit">Salvar registro</button></div></form></div>}
 </section>;
}
