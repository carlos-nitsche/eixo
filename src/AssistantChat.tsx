// EIXO OS 1.0 · professional local text assistant, no audio, model or external AI API.
import {useEffect,useRef,useState} from 'react';
import type {FormEvent,KeyboardEvent,ReactNode} from 'react';
import {ArrowUp,BookOpen,CalendarDays,Check,ChevronRight,Minus,ShieldCheck,Sparkles,Wallet,ListTodo,FolderKanban,Target,Repeat,RotateCcw} from 'lucide-react';
import type {Entry} from './model';
import {interpretAssistant,labelField} from './assistant-local';
import type {Draft,AssistantKind,AssistantRecords} from './assistant-local';
import './assistant-chat.css';
type Message={id:number;sender:'assistant'|'user';text:string;kind?:AssistantKind;success?:boolean};
type Props={workspaceId:string;workspaceName:string;tasks:Entry[];events:Entry[];transactions:Entry[];studies?:Entry[];projects?:Entry[];habits?:Entry[];goals?:Entry[];onCreate:(draft:Draft)=>boolean;enabled:boolean;allowedKinds:AssistantKind[]};
const welcome='Olá! Sou o Assistente EIXO. Me conte naturalmente o que deseja fazer: posso organizar compromissos, tarefas, despesas, receitas, estudos, projetos, metas e hábitos. Quando for registrar algo, eu preparo uma prévia para você confirmar.';
const suggestions:{text:string;kind:AssistantKind}[]=[
 {text:'Agende dentista amanhã às 14h',kind:'events'},
 {text:'Gastei R$ 85 no mercado',kind:'transactions'},
 {text:'Anota comprar leite sexta',kind:'tasks'},
 {text:'Quanto gastei este mês?',kind:'transactions'},
 {text:'Crie um projeto de reforma',kind:'projects'},
 {text:'Quero um hábito de ler todo dia',kind:'habits'},
 {text:'Meta de juntar R$ 2.000',kind:'goals'},
 {text:'Estudei 45 minutos de anatomia',kind:'studies'}
];
const meta:Record<AssistantKind,{label:string;icon:ReactNode}>={
 events:{label:'Compromisso',icon:<CalendarDays size={17}/>},
 tasks:{label:'Tarefa',icon:<ListTodo size={17}/>},
 transactions:{label:'Financeiro',icon:<Wallet size={17}/>},
 studies:{label:'Estudos',icon:<BookOpen size={17}/>},
 projects:{label:'Projeto',icon:<FolderKanban size={17}/>},
 goals:{label:'Meta',icon:<Target size={17}/>},
 habits:{label:'Hábito',icon:<Repeat size={17}/>}
};
const date=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)?value.slice(8)+'/'+value.slice(5,7)+'/'+value.slice(0,4):String(value||'');
const currency=(value:unknown)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fieldsFor=(draft:Draft):{key:string;label:string;value:string;sign?:string}[]=>{
 const f=draft.fields,items:[string,string,string|undefined,string?][]=[
  ['date','Data',f.date?date(f.date):undefined],
  ['dueDate','Prazo',f.dueDate?date(f.dueDate):undefined],
  ['time','Horário',f.time?String(f.time):undefined],
  ['amount','Valor',f.amount!==undefined?currency(f.amount):undefined,f.type==='Receita'?'positive':'negative'],
  ['category','Categoria',f.category?String(f.category):undefined],
  ['duration','Duração',f.duration?String(f.duration)+' min':undefined],
  ['type','Tipo',f.type?String(f.type):undefined],
  ['priority','Prioridade',f.priority?String(f.priority):undefined],
  ['status','Status',f.status?String(f.status):undefined],
  ['target','Objetivo',f.target?String(f.target)+(f.unit?' '+f.unit:''):undefined],
  ['frequency','Frequência',f.frequency?String(f.frequency):undefined]
 ];
 return items.filter(([, ,value])=>value!==undefined).map(([key,label,value,sign])=>({key,label,value:value!,sign}));
};
function Preview({draft,onCancel,onConfirm,busy}:{draft:Draft;onCancel:()=>void;onConfirm:()=>void;busy:boolean}){
 const card=meta[draft.kind];
 return <article className="eixo-ai-draft" data-kind={draft.kind} aria-label="Confirmação de registro">
  <div className="eixo-ai-drafthead"><span><span className="eixo-ai-kindicon">{card.icon}</span><span><strong>{card.label}</strong><small>Confira antes de salvar</small></span></span><span className="eixo-ai-pendinglabel">{draft.missing.length?'INCOMPLETO':'PRONTO'}</span></div>
  <h3>{String(draft.fields.title||'Aguardando descrição')}</h3>
  <div className="eixo-ai-draft-grid">{fieldsFor(draft).map(field=><div key={field.key} className={'eixo-ai-data '+(field.sign||'')} data-field={field.key}><span>{field.label}</span><strong>{field.value}</strong></div>)}</div>
  {draft.missing.length?<p className="eixo-ai-missing">Ainda preciso saber: {draft.missing.map(labelField).join(' e ')}.</p>:<p className="eixo-ai-confirmation"><ShieldCheck size={14}/> Nenhum dado será adicionado até você confirmar.</p>}
  <div className="eixo-ai-draftbuttons"><button type="button" className="eixo-ai-abort" onClick={onCancel}>Descartar</button><button type="button" className="eixo-ai-confirm" disabled={!!draft.missing.length||busy} onClick={onConfirm}><Check size={16}/> Confirmar e salvar</button></div>
 </article>;
}
export default function AssistantChat({workspaceId,workspaceName,tasks,events,transactions,studies=[],projects=[],habits=[],goals=[],onCreate,enabled,allowedKinds}:Props){
 const [open,setOpen]=useState(false),[input,setInput]=useState('');
 const [messages,setMessages]=useState<Message[]>([{id:0,sender:'assistant',text:welcome}]);
 const [pending,setPending]=useState<Draft|null>(null),[busy,setBusy]=useState(false);
 const seq=useRef(1),bottom=useRef<HTMLDivElement>(null),textarea=useRef<HTMLTextAreaElement>(null);
 const add=(sender:Message['sender'],text:string,extra:Partial<Message>={})=>{
  const id=seq.current++;setMessages(history=>[...history,{id,sender,text,...extra}].slice(-70));
 };
 useEffect(()=>{setInput('');setPending(null);setMessages([{id:0,sender:'assistant',text:welcome}]);seq.current=1},[workspaceId]);
 useEffect(()=>{if(open)bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},[open,messages,pending]);
 useEffect(()=>{if(open){const handle=setTimeout(()=>textarea.current?.focus(),120);return()=>clearTimeout(handle)}},[open]);
 useEffect(()=>{
  if(!open)return;
  const onEscape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
  window.addEventListener('keydown',onEscape);return()=>window.removeEventListener('keydown',onEscape);
 },[open]);
 if(!enabled)return null;
 const records:AssistantRecords={tasks,events,transactions,studies,projects,habits,goals};
 const send=(value:string)=>{
  const text=value.trim().slice(0,800);if(!text||busy)return;
  setInput('');add('user',text);
  if(pending&&/^(?:cancelar|cancela|desistir|esquece|nao|não|deixa pra la)$/i.test(text)){setPending(null);add('assistant','Tudo certo, descartei a prévia. Nenhum dado foi alterado.');return}
  if(pending&&/^(?:sim|confirmar|salvar|pode salvar|ok|isso)$/i.test(text)){add('assistant','Os dados estão prontos no cartão. Clique em “Confirmar e salvar” para registrar.');return}
  const result=interpretAssistant(text,workspaceId,new Date(),pending||undefined,records);
  if(result.type==='draft'&&!allowedKinds.includes(result.draft.kind)){setPending(null);add('assistant','Este módulo está desativado nas configurações do EIXO. Ative-o para poder criar esse registro.');return}
  add('assistant',result.reply,result.type==='draft'?{kind:result.draft.kind}:{});
  setPending(result.type==='draft'?result.draft:null);
 };
 const confirm=()=>{
  if(!pending||pending.missing.length||busy)return;
  if(pending.workspaceId!==workspaceId||!allowedKinds.includes(pending.kind)){setPending(null);add('assistant','O espaço ou a permissão mudou. Comece novamente neste espaço.');return}
  setBusy(true);
  try{
   if(onCreate(pending)){add('assistant',meta[pending.kind].label+' adicionado a “'+workspaceName+'”. Você pode conferir no módulo correspondente.',{kind:pending.kind,success:true});setPending(null)}
   else add('assistant','Não foi possível adicionar este registro. Confira os dados e tente novamente.');
  }catch{add('assistant','Falha ao registrar. Seus registros anteriores não foram alterados.')}
  finally{setBusy(false)}
 };
 const cancel=()=>{setPending(null);add('assistant','Prévia descartada. Pode me pedir outra coisa.')};
 const submit=(event:FormEvent)=>{event.preventDefault();send(input)};
 const onKeyDown=(event:KeyboardEvent<HTMLTextAreaElement>)=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send(input)}};
 const showSuggestions=messages.length<=2&&!pending;
 return <>
  {!open&&<button className="eixo-ai-launcher" type="button" onClick={()=>setOpen(true)} title="Abrir Assistente EIXO" aria-label="Abrir Assistente EIXO"><span className="eixo-ai-launcher-icon"><Sparkles size={21}/></span><span>Assistente EIXO</span><span className="eixo-ai-launcher-pulse"/></button>}
  {open&&<section className="eixo-ai-window" role="complementary" aria-label="Chat com Assistente EIXO">
   <header className="eixo-ai-head"><div className="eixo-ai-avatar"><Sparkles size={21}/></div><div className="eixo-ai-headtext"><strong>Assistente EIXO <span>LOCAL</span></strong><small><span className="eixo-ai-dot"/> Seu espaço inteligente de organização</small></div><button type="button" className="eixo-ai-close" onClick={()=>setOpen(false)} title="Minimizar" aria-label="Minimizar Assistente"><Minus size={18}/></button></header>
   <div className="eixo-ai-context"><ShieldCheck size={14}/><span>Privado · Chat de texto · Sem API externa</span><span className="eixo-ai-workspace">{workspaceName}</span></div>
   <div className="eixo-ai-scroll" role="log" aria-live="polite" aria-relevant="additions">
    <div className="eixo-ai-date-rule"><span>CONVERSA ATUAL</span></div>
    {messages.map(message=><div className={'eixo-ai-row '+message.sender} key={message.id}>
     {message.sender==='assistant'&&<span className="eixo-ai-mini-avatar"><Sparkles size={13}/></span>}
     <div className={'eixo-ai-bubble '+(message.success?'success':'')} data-kind={message.kind||'general'}>{message.success&&<Check size={14}/>}<span>{message.text}</span></div>
    </div>)}
    {pending&&<Preview draft={pending} busy={busy} onCancel={cancel} onConfirm={confirm}/>}
    {showSuggestions&&<div className="eixo-ai-suggestions"><span>COMO POSSO AJUDAR?</span>{suggestions.filter(x=>allowedKinds.includes(x.kind)).slice(0,5).map(x=><button key={x.text} data-kind={x.kind} type="button" onClick={()=>send(x.text)}><span className="eixo-ai-exampleicon">{meta[x.kind].icon}</span><span>{x.text}</span><ChevronRight size={15}/></button>)}</div>}
    <div ref={bottom}/>
   </div>
   <form className="eixo-ai-compose" onSubmit={submit}>
    <textarea ref={textarea} rows={2} maxLength={800} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKeyDown} placeholder={pending?'Continue ou corrija os detalhes...':'Converse, organize e registre por texto...'} aria-label="Mensagem para Assistente EIXO"/>
    <button type="submit" className="eixo-ai-send" title="Enviar mensagem" aria-label="Enviar mensagem" disabled={!input.trim()||busy}><ArrowUp size={19}/></button>
   </form>
   <footer className="eixo-ai-foot"><span><ShieldCheck size={12}/> Processamento local · Sem microfone</span><span>Enter envia · Shift+Enter pula linha</span></footer>
  </section>}
 </>;
}
