// EIXO OS 0.7 · React 19 local conversational assistant · zero external model/API requests.
import {useEffect,useRef,useState} from 'react';
import type {FormEvent,KeyboardEvent} from 'react';
import {ArrowUp,CalendarDays,Check,ChevronRight,MessageCircle,Minus,ShieldCheck,Sparkles,Wallet,X,Bot,Clock3,CheckCircle2} from 'lucide-react';
import type {Entry} from './model';
import {draftPreview,interpretAssistant} from './assistant-local';
import type {Draft} from './assistant-local';
import './assistant-chat.css';

type Message={id:number;sender:'assistant'|'user';text:string};
type Props={workspaceId:string;workspaceName:string;tasks:Entry[];events:Entry[];transactions:Entry[];onCreate:(draft:Draft)=>boolean;enabled:boolean};
const welcome='Olá! 👋 Sou o Assistente EIXO. Posso criar tarefas, agendar compromissos, registrar despesas e receitas ou sessões de estudo. Tudo é interpretado aqui no aplicativo, sem API externa.';
const suggestions=['Agende dentista amanhã às 14h','Gastei R$ 85 no mercado','Crie uma tarefa comprar leite sexta','O que tenho para hoje?'];
export default function AssistantChat({workspaceId,workspaceName,tasks,events,transactions,onCreate,enabled}:Props){
 const [open,setOpen]=useState(false);
 const [input,setInput]=useState('');
 const [messages,setMessages]=useState<Message[]>([{id:0,sender:'assistant',text:welcome}]);
 const [pending,setPending]=useState<Draft|null>(null);
 const [busy,setBusy]=useState(false);
 const seq=useRef(1);
 const bottom=useRef<HTMLDivElement>(null);
 const textarea=useRef<HTMLTextAreaElement>(null);
 const add=(sender:Message['sender'],text:string)=>{const id=seq.current++;setMessages(history=>[...history,{id,sender,text}].slice(-75))};
 useEffect(()=>{setPending(null);setInput('');setMessages([{id:0,sender:'assistant',text:welcome}]);seq.current=1},[workspaceId]);
 useEffect(()=>{if(open)bottom.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages,pending,open]);
 useEffect(()=>{if(open){const id=window.setTimeout(()=>textarea.current?.focus(),120);return()=>window.clearTimeout(id)}},[open]);
 useEffect(()=>{
  if(!open)return;
  const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false)}};
  window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
 },[open]);
 if(!enabled)return null;
 const send=(value:string)=>{
  const text=value.trim().slice(0,800);if(!text||busy)return;
  setInput('');add('user',text);
  if(pending&&/^(cancelar|cancela|desistir|esquece|nao|não)$/i.test(text)){setPending(null);add('assistant','Tudo certo. Nada foi salvo. Podemos começar outro pedido.');return}
  if(pending&&/^(sim|confirmar|salvar|pode salvar|ok|isso)$/i.test(text)){add('assistant','Revise o cartão e use o botão “Confirmar e salvar” para efetivar o registro.');return}
  const result=interpretAssistant(text,workspaceId,new Date(),pending||undefined,{tasks,events,transactions});
  add('assistant',result.reply);
  if(result.type==='draft')setPending(result.draft);
  if(result.type==='reply'||result.type==='unknown')setPending(null);
 };
 const confirm=()=>{
  if(!pending||pending.missing.length||busy)return;
  if(pending.workspaceId!==workspaceId){setPending(null);add('assistant','O espaço de trabalho mudou. Reenvie o pedido para evitar registrar no lugar errado.');return}
  setBusy(true);
  try{
   if(onCreate(pending)){add('assistant','Pronto! ✅ Registro adicionado a “'+workspaceName+'”. Confira o indicador de sincronização antes de fechar o aplicativo.');setPending(null)}
   else add('assistant','Não foi possível salvar. Confira os dados ou a sincronização e tente novamente.');
  }catch{add('assistant','Ocorreu uma falha ao registrar. Seus dados anteriores foram preservados.')}
  finally{setBusy(false)}
 };
 const onSubmit=(event:FormEvent)=>{event.preventDefault();send(input)};
 const onKeyDown=(event:KeyboardEvent<HTMLTextAreaElement>)=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send(input)}};
 return <>
  {!open&&<button className="eixo-ai-launcher" type="button" onClick={()=>setOpen(true)} title="Abrir Assistente EIXO" aria-label="Abrir Assistente EIXO"><Sparkles size={22}/><span>Assistente EIXO</span></button>}
  {open&&<section className="eixo-ai-window" aria-label="Chat com Assistente EIXO" role="complementary">
   <header className="eixo-ai-head"><div className="eixo-ai-avatar"><Sparkles size={20}/></div><div className="eixo-ai-headtext"><strong>Assistente EIXO <span>LOCAL</span></strong><small><span className="eixo-ai-dot"/> Pronto para organizar o seu dia</small></div><button type="button" className="eixo-ai-close" onClick={()=>setOpen(false)} title="Minimizar" aria-label="Minimizar Assistente"><Minus size={18}/></button></header>
   <div className="eixo-ai-context"><ShieldCheck size={13}/><span>Sem API externa · Espaço: <strong>{workspaceName}</strong></span></div>
   <div className="eixo-ai-scroll" role="log" aria-live="polite" aria-relevant="additions">
    {messages.map(message=><div className={'eixo-ai-row '+message.sender} key={message.id}><div className="eixo-ai-bubble">{message.text}</div></div>)}
    {pending&&<div className="eixo-ai-draft" aria-label="Confirmação de registro">
     <div className="eixo-ai-drafthead"><span><CheckCircle2 size={15}/> RASCUNHO PARA CONFIRMAÇÃO</span><span>{pending.kind==='events'?'Agenda':pending.kind==='tasks'?'Tarefa':pending.kind==='transactions'?'Financeiro':'Estudos'}</span></div>
     <p>{draftPreview(pending)}</p>
     {pending.missing.length>0?<small className="eixo-ai-missing">Falta informar: {pending.missing.join(', ')}. Responda no chat para completar.</small>:<small>O registro só será salvo após sua confirmação.</small>}
     <div className="eixo-ai-draftbuttons"><button type="button" className="eixo-ai-abort" onClick={()=>{setPending(null);add('assistant','Rascunho descartado. Nada foi salvo.')}}>Cancelar</button><button type="button" className="eixo-ai-confirm" disabled={pending.missing.length>0||busy} onClick={confirm}><Check size={14}/> Confirmar e salvar</button></div>
    </div>}
    {!pending&&messages.length<=2&&<div className="eixo-ai-suggestions"><span>EXPERIMENTE PEDIR</span>{suggestions.map(text=><button key={text} type="button" onClick={()=>send(text)}>{text}<ChevronRight size={13}/></button>)}</div>}
    <div ref={bottom}/>
   </div>
   <form className="eixo-ai-compose" onSubmit={onSubmit}><textarea ref={textarea} rows={2} maxLength={800} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKeyDown} placeholder={pending?'Responda ou ajuste os detalhes...':'Peça para agendar ou registrar algo...'} aria-label="Mensagem para Assistente EIXO"/><button type="submit" title="Enviar mensagem" aria-label="Enviar mensagem" disabled={!input.trim()||busy}><ArrowUp size={19}/></button></form>
   <footer className="eixo-ai-foot">Interpretação local · Confirmação obrigatória para salvar</footer>
  </section>}
 </>;
}
