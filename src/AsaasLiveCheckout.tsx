import {useEffect,useState} from 'react';
import {CreditCard,ExternalLink,ShieldCheck,Wallet,Clock3,RefreshCw,AlertTriangle,CalendarCheck2} from 'lucide-react';
import AsaasSandboxCheckout from './AsaasSandboxCheckout';
import './asaas-live-checkout.css';
type Plan={id:string;name:string;amountCents:number;months:number};
type Method='PIX'|'CREDIT_CARD';
type Order={id:string;planCode:string;method:Method;status:string;checkoutUrl:string|null;canCancel:boolean;paidThrough:string|null};
type LiveStatus={config:{mode:string;enabled:boolean;realChargesEnabled:boolean;requirements?:{productionRuntime?:boolean}};subscription:{planCode:string;status:string;paidThrough:string|null;renewalActive:boolean}|null;orders:Order[]};
const price=(cents:number)=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=(value:string|null)=>{if(!value)return '—';const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('pt-BR')};
async function request<T>(route:string,method='GET',payload?:unknown):Promise<T>{
 const res=await fetch(route,{method,credentials:'same-origin',headers:{'content-type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store'});
 const body=await res.json();if(!res.ok)throw Error(body.error||'O gateway não concluiu a solicitação.');return body as T;
}
const labels:Record<string,string>={
 pending:'Aguardando pagamento',creating:'Criando checkout',needs_review:'Conciliação necessária',
 paid:'Pagamento confirmado',awaiting_card_settlement:'Aguardando confirmação financeira',
 recurrence_canceled:'Renovação desativada',cancellation_requested:'Cancelamento em processamento',
 canceled:'Checkout cancelado',expired:'Checkout expirado'
};
export default function AsaasLiveCheckout({plan,authenticated}:{plan:Plan;authenticated:boolean}){
 const [status,setStatus]=useState<LiveStatus|null>(null),[method,setMethod]=useState<Method>('PIX');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[checkout,setCheckout]=useState<string|null>(null);
 const refresh=async()=>{const result=await request<LiveStatus>('/api/billing/live/status');setStatus(result);return result};
 useEffect(()=>{let canceled=false;if(authenticated){void request<LiveStatus>('/api/billing/live/status').then(x=>{if(!canceled)setStatus(x)}).catch(()=>{})};return()=>{canceled=true}},[authenticated]);
 if(authenticated&&status?.config.requirements?.productionRuntime&&!status.config.enabled)return <div className="asaas-live-plan"><span className="asaas-live-heading"><ShieldCheck size={15}/> Pagamento protegido</span><p>As cobranças reais ainda não estão disponíveis. O EIXO não gerará pagamentos até a configuração de produção estar completa.</p><small>Não é necessário pagar novamente. Contate o suporte se já iniciou alguma cobrança.</small></div>;
 if(!authenticated||!status?.config.enabled)return <AsaasSandboxCheckout plan={plan} authenticated={authenticated}/>;
 const orders=status.orders.filter(x=>x.planCode===plan.id),last=orders[0]||null;
 const active=status.subscription?.status==='active'&&Boolean(status.subscription.paidThrough&&new Date(status.subscription.paidThrough)>new Date());
 const hasPending=status.orders.some(x=>['creating','pending','awaiting_card_settlement','needs_review','cancellation_requested'].includes(x.status));
 const buy=async()=>{
  if(busy)return;setBusy(true);setError('');setNotice('');setCheckout(null);
  try{
   const result=await request<{url:string;id:string;reused:boolean}>('/api/billing/live/checkout','POST',{planCode:plan.id,method});
   if(!/^https:\/\/asaas\.com\/checkoutSession\/show\?id=[a-zA-Z0-9_-]{7,150}$/.test(result.url))throw Error('O checkout retornou um link não reconhecido.');
   setCheckout(result.url);await refresh();setNotice(result.reused?'Checkout anterior recuperado. Confira antes de realizar outro pagamento.':'Checkout seguro criado no Asaas. O acesso será liberado somente após a confirmação do pagamento.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível iniciar a cobrança.')}finally{setBusy(false)}
 };
 const cancel=async()=>{
  if(!last?.canCancel||busy)return;
  if(!window.confirm('Deseja ENCERRAR as cobranças automáticas futuras deste plano no Asaas? O período já pago continuará válido. Este procedimento não solicita reembolso.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   await request('/api/billing/live/cancel','POST',{id:last.id});
   await refresh();setCheckout(null);setNotice('Renovação automática cancelada. Seu acesso já pago permanece até o vencimento.');
  }catch(e){setError(e instanceof Error?e.message:'Cancelamento não confirmado; consulte o suporte antes de tentar de novo.')}finally{setBusy(false)}
 };
 return <div className="asaas-live-plan">
  <span className="asaas-live-heading"><ShieldCheck size={15}/> Pagamento real seguro · Asaas</span>
  <p>Você paga diretamente no checkout oficial do Asaas. O EIXO não recebe nem armazena números de cartão.</p>
  {active&&<div className="asaas-live-current"><CalendarCheck2 size={16}/><span>Plano ativo até <strong>{date(status.subscription?.paidThrough||null)}</strong>{status.subscription?.renewalActive?' · renovação automática ativa':''}</span></div>}
  <div className="asaas-live-methods" role="group" aria-label="Forma de pagamento">
   <button type="button" className={method==='PIX'?'selected':''} aria-pressed={method==='PIX'} disabled={busy} onClick={()=>{setMethod('PIX');setCheckout(null)}}><Wallet size={16}/> PIX</button>
   <button type="button" className={method==='CREDIT_CARD'?'selected':''} aria-pressed={method==='CREDIT_CARD'} disabled={busy} onClick={()=>{setMethod('CREDIT_CARD');setCheckout(null)}}><CreditCard size={16}/> Cartão</button>
  </div>
  <p>{method==='PIX'?'Pagamento único. O Pix não faz renovação automática; será necessário pagar o próximo período.':'Assinatura recorrente no cartão. Você poderá cancelar as cobranças futuras na sua conta.'}</p>
  {checkout?<a className="asaas-live-action" href={checkout} target="_blank" rel="noopener noreferrer">Ir para o checkout oficial <ExternalLink size={15}/></a>:<button type="button" className="asaas-live-action" disabled={busy||active||hasPending} onClick={()=>void buy()}>{busy?'Verificando cobrança...':active?'Plano já ativo':hasPending?'Confira sua cobrança em andamento':'Assinar '+plan.name+' · '+price(plan.amountCents)}</button>}
  {last?.checkoutUrl&&!checkout&&['pending','awaiting_card_settlement'].includes(last.status)&&<a className="asaas-live-checkout-link" href={last.checkoutUrl} target="_blank" rel="noopener noreferrer">Reabrir checkout pendente <ExternalLink size={13}/></a>}
  <button type="button" className="asaas-live-refresh" disabled={busy} onClick={()=>void refresh().then(()=>setNotice('Status atualizado. A liberação depende da confirmação do Asaas.')).catch(e=>setError(e.message))}><RefreshCw size={13}/> Atualizar situação</button>
  {last&&['pending','awaiting_card_settlement','needs_review'].includes(last.status)&&<button type="button" className="asaas-live-refresh" disabled={busy} onClick={()=>{setBusy(true);setError('');void request<{credited:boolean;message?:string}>('/api/billing/live/reconcile','POST',{id:last.id}).then(async outcome=>{await refresh();setNotice(outcome.credited?'Pagamento identificado e processado.':outcome.message||'Ainda não há confirmação financeira.')}).catch(e=>setError(e.message)).finally(()=>setBusy(false))}}><Clock3 size={13}/> Conferir pagamento no Asaas</button>}
  {last&&<small>Situação: <strong>{labels[last.status]||'Em análise'}</strong>{last.paidThrough?' · acesso pago até '+date(last.paidThrough):''}</small>}
  {last?.canCancel&&<button type="button" className="asaas-live-cancel" disabled={busy} onClick={()=>void cancel()}>Cancelar renovação automática</button>}
  {last?.status==='needs_review'&&<div className="asaas-live-attention"><AlertTriangle size={15}/> Existe uma cobrança com resultado incerto. Não repita a compra; consulte o suporte.</div>}
  {notice&&<p className="asaas-live-notice" role="status">{notice}</p>}
  {error&&<p className="asaas-live-error" role="alert">{error}</p>}
  <small><Clock3 size={12}/> Retornar à página do EIXO não confirma pagamento. O status é atualizado pelo Asaas.</small>
 </div>;
}
