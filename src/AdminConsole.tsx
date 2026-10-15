import {useEffect,useState} from 'react';
import {ArrowLeft,RefreshCw,ShieldCheck,Search,Users,Activity,Clock3,AlertTriangle} from 'lucide-react';
import './admin-console.css';
type Overview={role:'owner'|'admin'|'support';users:{total:number;verified:number;suspended:number;trials:number};subscriptions:{status:string;plan_code:string;total:number}[];webhooks:{live_events:number;sandbox_events:number};confirmedRealReceiptsCents:number;databaseMode:string;realChargesEnabled:boolean};
type Member={id:string;email:string;display_name:string;verified_at:string|null;created_at:string;suspended_at:string|null;subscription_status:string|null;plan_code:string|null;platform_role:string|null};
type Event={id:string;actor_id:string|null;event:string;occurred_at:string};
async function getJson<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch(path,{credentials:'same-origin',...init});const b=await r.json();if(!r.ok)throw Error(b.error||'Falha na consulta.');return b as T}
export default function AdminConsole({onBack}:{onBack:()=>void}){
 const [summary,setSummary]=useState<Overview|null>(null),[users,setUsers]=useState<Member[]>([]),[events,setEvents]=useState<Event[]>([]);
 const [query,setQuery]=useState(''),[term,setTerm]=useState(''),[page,setPage]=useState(1),[more,setMore]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const refresh=async()=>{setBusy(true);setError('');try{
  const overview=await getJson<Overview>('/api/admin/overview');setSummary(overview);
  if(overview.role!=='support'){
   const [us,logs]=await Promise.all([getJson<{users:Member[];more:boolean}>('/api/admin/users?q='+encodeURIComponent(term)+'&page='+page),getJson<{events:Event[]}>('/api/admin/audit')]);
   setUsers(us.users);setMore(us.more);setEvents(logs.events);
  }
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 useEffect(()=>{void refresh()},[term,page]);
 const action=async(user:Member,command:'suspend'|'resume'|'revoke-sessions')=>{
  const reason=window.prompt('Justificativa para '+command+' — '+user.display_name+' (mínimo 8 caracteres):');
  if(reason===null)return;
  if(reason.trim().length<8||reason.trim().length>300){setError('A justificativa deve ter entre 8 e 300 caracteres.');return}
  if(!window.confirm('Confirmar ação administrativa? Ela será auditada.'))return;
  setBusy(true);setError('');setMessage('');
  try{await getJson('/api/admin/users/'+user.id+'/'+command,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});setMessage('Operação registrada com sucesso.');await refresh()}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 return <main className="eixo-admin">
  <header className="eixo-admin-header"><div><span className="eixo-admin-eyebrow"><ShieldCheck size={15}/> EIXO · ADMINISTRAÇÃO PROTEGIDA</span><h1>Central administrativa</h1><p>Dados do servidor. Ações são verificadas e auditadas no backend.</p></div><div className="eixo-admin-actions"><button onClick={onBack}><ArrowLeft size={16}/> Minha conta</button><button onClick={()=>void refresh()} disabled={busy}><RefreshCw size={16}/> Atualizar</button></div></header>
  {error&&<p role="alert" className="eixo-admin-error">{error}</p>}{message&&<p role="status" className="eixo-admin-success">{message}</p>}
  {!summary?<p role="status">Carregando dados administrativos...</p>:<>
   <div className="eixo-admin-stats">
    <article><Users size={19}/><span>Usuários</span><strong>{summary.users.total}</strong></article>
    <article><ShieldCheck size={19}/><span>E-mails verificados</span><strong>{summary.users.verified}</strong></article>
    <article><Clock3 size={19}/><span>Trials ativos</span><strong>{summary.users.trials}</strong></article>
    <article><AlertTriangle size={19}/><span>Contas suspensas</span><strong>{summary.users.suspended}</strong></article>
   </div>
   <section className="eixo-admin-panel"><h2>Operação comercial</h2><p>Banco: {summary.databaseMode} · Cobrança real: {summary.realChargesEnabled?'Ativa':'Desativada'} · Webhooks registrados: {summary.webhooks.live_events} produção / {summary.webhooks.sandbox_events} homologação</p><p>Recebimentos reais registrados: {(summary.confirmedRealReceiptsCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} — não equivale a conciliação bancária.</p><div className="eixo-admin-tags">{summary.subscriptions.length?summary.subscriptions.map((s,i)=><span key={i}>{s.plan_code} · {s.status}: {s.total}</span>):<span>Sem assinaturas comerciais cadastradas</span>}</div></section>
   {summary.role!=='support'&&<>
    <section className="eixo-admin-panel"><div className="eixo-admin-title"><h2>Usuários</h2><form onSubmit={e=>{e.preventDefault();setPage(1);setTerm(query)}}><input aria-label="Pesquisar usuários" placeholder="Nome ou e-mail" value={query} onChange={e=>setQuery(e.target.value)} maxLength={120}/><button type="submit"><Search size={15}/> Buscar</button></form></div>
     <div className="eixo-admin-users">{users.length?users.map(user=><article key={user.id}><div><strong>{user.display_name||'Sem nome'}</strong><small>{user.email}</small><small>{user.platform_role?'Administrador: '+user.platform_role+' · ':''}{user.verified_at?'Verificado':'Não verificado'} · {user.suspended_at?'Suspenso':'Ativo'} · {user.plan_code||'Sem plano comercial'}</small></div><div className="eixo-admin-user-actions">{user.suspended_at?<button disabled={busy} onClick={()=>void action(user,'resume')}>Reativar</button>:<button disabled={busy||!!user.platform_role} onClick={()=>void action(user,'suspend')}>Suspender</button>}<button disabled={busy||!!user.platform_role} onClick={()=>void action(user,'revoke-sessions')}>Revogar sessões</button></div></article>):<p>Nenhum usuário encontrado.</p>}</div>
     <div className="eixo-admin-pagination"><button disabled={busy||page===1} onClick={()=>setPage(v=>v-1)}>Anterior</button><span>Página {page}</span><button disabled={busy||!more} onClick={()=>setPage(v=>v+1)}>Próxima</button></div>
    </section>
    <section className="eixo-admin-panel"><h2><Activity size={17}/> Auditoria recente</h2><div className="eixo-admin-log">{events.map(e=><p key={e.id}><strong>{e.event}</strong><time>{new Date(e.occurred_at).toLocaleString('pt-BR')}</time></p>)}{!events.length&&<p>Nenhum evento registrado.</p>}</div></section>
   </>}
  </>}
 </main>;
}
