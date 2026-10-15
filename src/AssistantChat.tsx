// EIXO OS v0.8 — React 19, professional local assistant, private microphone recording.
import {useEffect,useRef,useState} from 'react';
import type {FormEvent,KeyboardEvent,ReactNode} from 'react';
import {ArrowUp,BookOpen,CalendarDays,Check,ChevronRight,Headphones,Mic,Minus,ShieldCheck,Sparkles,Square,Trash2,Wallet,X,ListTodo,AudioLines} from 'lucide-react';
import type {Entry} from './model';
import {interpretAssistant,labelField} from './assistant-local';
import type {Draft,AssistantKind} from './assistant-local';
import {useLocalVoice} from './useLocalVoice';
import './assistant-chat.css';

type Message={id:number;sender:'assistant'|'user';text:string;kind?:AssistantKind;success?:boolean};
type Props={workspaceId:string;workspaceName:string;tasks:Entry[];events:Entry[];transactions:Entry[];onCreate:(draft:Draft)=>boolean;enabled:boolean};
const welcome='Olá! Eu sou o Assistente EIXO. Posso organizar sua agenda, criar tarefas, registrar gastos e receitas e acompanhar estudos. Me conte o que precisa — eu preparo tudo para você conferir antes de salvar.';
const suggestions=[
 {text:'Agende dentista amanhã às 14h',kind:'events' as const},
 {text:'Gastei R$ 85 no mercado',kind:'transactions' as const},
 {text:'Crie uma tarefa comprar leite sexta',kind:'tasks' as const},
 {text:'Quanto gastei este mês?',kind:'transactions' as const}
];
const meta:Record<AssistantKind,{label:string;icon:ReactNode;description:string}>={
 events:{label:'Compromisso',icon:<CalendarDays size={17}/>,description:'Agenda'},
 tasks:{label:'Tarefa',icon:<ListTodo size={17}/>,description:'Organização'},
 transactions:{label:'Financeiro',icon:<Wallet size={17}/>,description:'Movimentação'},
 studies:{label:'Estudos',icon:<BookOpen size={17}/>,description:'Aprendizado'}
};
const formatDate=(value:unknown)=>{
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))return String(value||'');
 const [year,month,day]=value.split('-');return day+'/'+month+'/'+year;
};
const currency=(value:unknown)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fieldsFor=(draft:Draft):{key:string;label:string;value:string;sign?:string}[]=>{
 const f=draft.fields;
 const items:[string,string,string|undefined,string?][]=[
  ['date','Data',f.date?formatDate(f.date):undefined],
  ['dueDate','Prazo',f.dueDate?formatDate(f.dueDate):undefined],
  ['time','Horário',f.time?String(f.time):undefined],
  ['amount','Valor',f.amount!==undefined?currency(f.amount):undefined,f.type==='Receita'?'positive':'negative'],
  ['category','Categoria',f.category?String(f.category):undefined],
  ['duration','Duração',f.duration?String(f.duration)+' min':undefined],
  ['type','Tipo',f.type?String(f.type):undefined],
  ['status','Status',f.status?String(f.status):undefined]
 ];
 return items.filter(([, ,value])=>value!==undefined).map(([key,label,value,sign])=>({key,label,value:value!,sign}));
};
function Preview({draft,onCancel,onConfirm,busy}:{draft:Draft;onCancel:()=>void;onConfirm:()=>void;busy:boolean}){
 const card=meta[draft.kind];
 const values=fieldsFor(draft);
 return <article className="eixo-ai-draft" data-kind={draft.kind} aria-label="Confirmação de registro">
  <div className="eixo-ai-drafthead"><span><span className="eixo-ai-kindicon">{card.icon}</span><span><strong>{card.label}</strong><small>Prévia para conferência</small></span></span><span className="eixo-ai-pendinglabel">{draft.missing.length?'INCOMPLETO':'PRONTO'}</span></div>
  <h3>{String(draft.fields.title||'Aguardando descrição')}</h3>
  <div className="eixo-ai-draft-grid">{values.map(field=><div key={field.key} className={'eixo-ai-data '+(field.sign||'')} data-field={field.key}><span>{field.label}</span><strong>{field.value}</strong></div>)}</div>
  {draft.missing.length?<p className="eixo-ai-missing">Me informe {draft.missing.map(labelField).join(' e ')} para completar.</p>:<p className="eixo-ai-confirmation"><ShieldCheck size={14}/> Os dados só serão adicionados após sua confirmação.</p>}
  <div className="eixo-ai-draftbuttons"><button type="button" className="eixo-ai-abort" onClick={onCancel}>Descartar</button><button type="button" className="eixo-ai-confirm" disabled={!!draft.missing.length||busy} onClick={onConfirm}><Check size={16}/> Confirmar e salvar</button></div>
 </article>;
}
export default function AssistantChat({workspaceId,workspaceName,tasks,events,transactions,onCreate,enabled}:Props){
 const [open,setOpen]=useState(false);
 const [input,setInput]=useState('');
 const [messages,setMessages]=useState<Message[]>([{id:0,sender:'assistant',text:welcome}]);
 const [pending,setPending]=useState<Draft|null>(null);
 const [busy,setBusy]=useState(false);
 const seq=useRef(1);
 const bottom=useRef<HTMLDivElement>(null);
 const textarea=useRef<HTMLTextAreaElement>(null);
 const add=(sender:Message['sender'],text:string,extra:Partial<Message>={})=>{
  const id=seq.current++;
  setMessages(history=>[...history,{id,sender,text,...extra}].slice(-70));
 };
 const voice=useLocalVoice(phrase=>setInput(value=>(value.trim()?value.trim()+' ':'')+phrase),workspaceId);
 useEffect(()=>{
  setPending(null);setInput('');setMessages([{id:0,sender:'assistant',text:welcome}]);seq.current=1;
 },[workspaceId]);
 useEffect(()=>{if(open)bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages,pending,open,voice.note,voice.mode]);
 useEffect(()=>{if(open&&voice.mode==='idle'){const id=window.setTimeout(()=>textarea.current?.focus(),150);return()=>window.clearTimeout(id)}},[open,voice.mode]);
 useEffect(()=>{
  if(!open)return;
  const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){voice.reset();setOpen(false)}};
  window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
 },[open,voice.reset]);
 if(!enabled)return null;
 const send=(value:string)=>{
  const text=value.trim().slice(0,800);
  if(!text||busy)return;
  setInput('');add('user',text);
  if(pending&&/^(cancelar|cancela|desistir|esquece|nao|não)$/i.test(text)){
   setPending(null);add('assistant','Pedido descartado. Nenhum dado foi alterado. Quer que eu organize outra coisa?');return;
  }
  if(pending&&/^(sim|confirmar|salvar|pode salvar|ok|isso)$/i.test(text)){
   add('assistant','Está quase pronto! Clique em “Confirmar e salvar” no cartão para registrar com segurança.');return;
  }
  const result=interpretAssistant(text,workspaceId,new Date(),pending||undefined,{tasks,events,transactions});
  add('assistant',result.reply,result.type==='draft'?{kind:result.draft.kind}:{});
  setPending(result.type==='draft'?result.draft:null);
 };
 const confirm=()=>{
  if(!pending||pending.missing.length||busy)return;
  if(pending.workspaceId!==workspaceId){setPending(null);add('assistant','Você mudou de espaço. Vamos refazer o pedido no local correto.');return}
  setBusy(true);
  try{
   if(onCreate(pending)){
    add('assistant',meta[pending.kind].label+' adicionado a “'+workspaceName+'”. Confira a sincronização antes de fechar o aplicativo.',{kind:pending.kind,success:true});
    setPending(null);
   }else add('assistant','Não consegui adicionar o registro. Confira os campos e o estado da sincronização.');
  }catch{add('assistant','Ocorreu uma falha no registro. Seus dados anteriores permanecem intactos.')}
  finally{setBusy(false)}
 };
 const cancel=()=>{setPending(null);add('assistant','Pronto, descartei a prévia. Não houve nenhuma alteração. Se quiser, podemos começar outro pedido.')};
 const onSubmit=(event:FormEvent)=>{event.preventDefault();send(input)};
 const onKeyDown=(event:KeyboardEvent<HTMLTextAreaElement>)=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send(input)}};
 const close=()=>{voice.reset();setOpen(false)};
 const showExamples=!pending&&messages.length<=2;
 return <>
  {!open&&<button className="eixo-ai-launcher" type="button" onClick={()=>setOpen(true)} title="Abrir Assistente EIXO" aria-label="Abrir Assistente EIXO"><span className="eixo-ai-launcher-icon"><Sparkles size={21}/></span><span>Assistente EIXO</span><span className="eixo-ai-launcher-pulse"/></button>}
  {open&&<section className="eixo-ai-window" aria-label="Chat com Assistente EIXO" role="complementary">
   <header className="eixo-ai-head"><div className="eixo-ai-avatar"><Sparkles size={21}/></div><div className="eixo-ai-headtext"><strong>Assistente EIXO <span>LOCAL</span></strong><small><span className="eixo-ai-dot"/> Seu espaço inteligente de organização</small></div><button type="button" className="eixo-ai-close" onClick={close} title="Minimizar" aria-label="Minimizar Assistente"><Minus size={18}/></button></header>
   <div className="eixo-ai-context"><ShieldCheck size={14}/><span>Privado · Sem API externa</span><span className="eixo-ai-workspace">{workspaceName}</span></div>
   <div className="eixo-ai-scroll" role="log" aria-live="polite" aria-relevant="additions">
    <div className="eixo-ai-date-rule"><span>CONVERSA ATUAL</span></div>
    {messages.map(message=><div className={'eixo-ai-row '+message.sender} key={message.id}>
     {message.sender==='assistant'&&<span className="eixo-ai-mini-avatar"><Sparkles size={13}/></span>}
     <div className={'eixo-ai-bubble '+(message.success?'success':'')} data-kind={message.kind||'general'}>{message.success&&<Check size={14}/>}<span>{message.text}</span></div>
    </div>)}
    {pending&&<Preview draft={pending} busy={busy} onCancel={cancel} onConfirm={confirm}/>}
    {showExamples&&<div className="eixo-ai-suggestions"><span>O QUE VOCÊ GOSTARIA DE FAZER?</span>{suggestions.map(item=><button key={item.text} data-kind={item.kind} type="button" onClick={()=>send(item.text)}><span className="eixo-ai-exampleicon">{meta[item.kind].icon}</span><span>{item.text}</span><ChevronRight size={15}/></button>)}</div>}
    <div ref={bottom}/>
   </div>
   {voice.mode==='recording'&&<div className="eixo-ai-audio-active" role="status"><span className="eixo-ai-red-dot"/><AudioLines size={17}/><strong>Gravando áudio</strong><time>{Math.floor(voice.elapsed/60)}:{String(voice.elapsed%60).padStart(2,'0')}</time><button type="button" onClick={voice.stop} aria-label="Parar gravação"><Square size={14}/> Parar</button></div>}
   {voice.transcribing&&<div className="eixo-ai-audio-active local" role="status"><AudioLines size={17}/><span><strong>Whisper local</strong> · Transcrevendo português{voice.progress!==null?' · '+voice.progress+'%':''}...</span><button type="button" onClick={voice.reset}><X size={14}/> Cancelar</button></div>}
   {voice.note&&voice.mode==='preview'&&<div className="eixo-ai-audio-preview"><span className="eixo-ai-recording-label"><Headphones size={14}/> Prévia da gravação para transcrição · {voice.note.seconds}s</span><audio controls preload="metadata" src={voice.note.url} aria-label="Ouvir gravação"/><div><button type="button" onClick={voice.reset}><Trash2 size={13}/> Descartar</button><button type="button" onClick={voice.retry}><AudioLines size={13}/> Tentar transcrição</button></div></div>}
   {voice.notice&&<div className="eixo-ai-voice-notice" role="status">{voice.notice}</div>}
   <form className="eixo-ai-compose" onSubmit={onSubmit}>
    <button type="button" className={'eixo-ai-mic '+(voice.recording?'active':'')} aria-label={voice.recording?'Parar microfone':'Gravar ou ditar por voz'} title="Microfone · transcrição no dispositivo quando disponível" disabled={voice.mode==='checking'||voice.mode==='preview'} onClick={()=>{if(voice.recording)voice.stop();else void voice.start()}}>{voice.recording?<Square size={17}/>:<Mic size={19}/>}</button>
    <textarea ref={textarea} rows={2} maxLength={800} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKeyDown} placeholder={pending?'Informe ou corrija os detalhes...':'Peça para agendar, registrar ou organizar...'} aria-label="Mensagem para Assistente EIXO"/>
    <button type="submit" className="eixo-ai-send" title="Enviar mensagem" aria-label="Enviar mensagem" disabled={!input.trim()||busy}><ArrowUp size={19}/></button>
   </form>
   <footer className="eixo-ai-foot"><span><ShieldCheck size={12}/> Apenas texto entra no chat · Whisper offline</span><span>Enter envia · Shift+Enter pula linha</span></footer>
  </section>}
 </>;
}
