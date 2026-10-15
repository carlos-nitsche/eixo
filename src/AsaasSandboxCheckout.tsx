import {useEffect,useState} from 'react';
import {ArrowUpRight,CheckCircle2,Clock3,CreditCard,ExternalLink,FlaskConical,RefreshCw,ShieldCheck,Wallet} from 'lucide-react';
import './asaas-sandbox.css';
type Plan={id:string;name:string;amountCents:number;months:number};
type Method='PIX'|'CREDIT_CARD';
type Status={config:{mode:'sandbox';apiConnected:boolean;webhookConfigured:boolean;checkoutConfigured:boolean;realChargesEnabled:boolean};testPaidThrough:string|null;checkouts:{id:string;planCode:string;method:Method;status:string;createdAt:string;checkoutUrl:string|null;canCancel:boolean}[]};
async function billingRequest<T=any>(url:string,method='GET',data?:unknown):Promise<T>{
 const response=await fetch(url,{method,credentials:'same-origin',headers:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const body=await response.json();
 if(!response.ok)throw Error(body.error||'Não foi possível acessar o Asaas Sandbox.');
 return body as T;
}
export default function AsaasSandboxCheckout({plan,authenticated}:{plan:Plan;authenticated:boolean}){
 const [method,setMethod]=useState<Method>('PIX'),[busy,setBusy]=useState(false);
 const [status,setStatus]=useState<Status|null>(null),[preview,setPreview]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const refresh=async()=>{try{setStatus(await billingRequest<Status>('/api/billing/status'))}catch(e){setError((e as Error).message)}};
 useEffect(()=>{if(authenticated)void refresh()},[authenticated]);
 const simulate=async()=>{
  setBusy(true);setError('');setMessage('');setCreated(null);
  try{await billingRequest('/api/billing/preview','POST',{planCode:plan.id,method});setPreview(true);
   setMessage(method==='PIX'?'Prévia pronta: cobrança Pix avulsa para este período; a próxima renovação exige novo pagamento.':'Prévia pronta: assinatura recorrente por cartão, com cobrança a cada '+plan.months+' meses.');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 const create=async()=>{
  if(!status?.config.checkoutConfigured)return;
  setBusy(true);setError('');setMessage('');
  try{
   const r=await billingRequest<{url:string;status:string}>('/api/billing/checkout','POST',{planCode:plan.id,method});
   if(!/^https:\/\/asaas\.com\/checkoutSession\/show\?id=[a-z0-9_-]+$/i.test(r.url))throw Error('Link de Checkout Sandbox inválido.');
   setCreated(r.url);setMessage('Checkout de teste criado. Nenhuma assinatura real será ativada.');
   await refresh();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 const cancel=async()=>{
  if(!latest?.canCancel||!window.confirm('Cancelar a renovação deste plano no ambiente de testes Asaas? Não haverá reembolso automático.'))return;
  setBusy(true);setError('');try{await billingRequest('/api/billing/cancel','POST',{id:latest.id});await refresh();setMessage('Assinatura de teste cancelada. Nenhuma cobrança real foi feita.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 const latest=status?.checkouts.find(c=>c.planCode===plan.id);
 return <div className="asaas-sandbox-plan">
  <span className="asaas-sandbox-title"><FlaskConical size={14}/> ASaaS · AMBIENTE DE TESTES</span>
  <p>Teste de integração, sem cobrança real nem liberação de assinatura comercial.</p>
  <div className="asaas-payment-choice" role="group" aria-label={'Forma de pagamento de '+plan.name}>
   <button type="button" aria-pressed={method==='PIX'} className={method==='PIX'?'selected':''} onClick={()=>{setMethod('PIX');setPreview(false);setCreated(null);setMessage('')}}><Wallet size={15}/> PIX</button>
   <button type="button" aria-pressed={method==='CREDIT_CARD'} className={method==='CREDIT_CARD'?'selected':''} onClick={()=>{setMethod('CREDIT_CARD');setPreview(false);setCreated(null);setMessage('')}}><CreditCard size={15}/> Cartão</button>
  </div>
  {authenticated?<button type="button" className="asaas-preview-button" disabled={busy} onClick={()=>void simulate()}>{busy?'Preparando...':'Pré-visualizar cobrança'} <ArrowUpRight size={14}/></button>:<small>Entre na sua conta do EIXO para visualizar a cobrança de teste.</small>}
  {preview&&<div className="asaas-preview-details"><strong>{method==='PIX'?'PIX · Pagamento por período':'CARTÃO · Assinatura automática'}</strong><small>{plan.name} · {(plan.amountCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}{method==='CREDIT_CARD'?' a cada '+plan.months+' meses':''}</small><p>{method==='PIX'?'Pagamento avulso. O EIXO não renova automaticamente por PIX neste fluxo.':'O Asaas gerencia os ciclos de cobrança no cartão, dentro do ambiente de teste.'}</p></div>}
  {authenticated&&preview&&status?.config.checkoutConfigured&&<button type="button" className="asaas-preview-button" disabled={busy} onClick={()=>void create()}><FlaskConical size={14}/> Criar checkout Sandbox</button>}
  {created&&<a className="asaas-test-checkout" href={created} target="_blank" rel="noopener noreferrer">Abrir checkout de teste <ExternalLink size={14}/></a>}
  {authenticated&&!status?.config.checkoutConfigured&&<small className="asaas-config-note">{status?.config.apiConnected?'Chave Asaas Sandbox conectada. Aguardando o webhook seguro em um endereço HTTPS estável.':'Aguardando a conexão com o Asaas Sandbox e a configuração do webhook.'} Nenhuma cobrança será criada até lá.</small>}
  {latest&&<div className="asaas-status-pill"><Clock3 size={13}/> Última simulação: {latest.status==='sandbox_paid'?'paga no Sandbox':latest.status==='pending'?'aguardando pagamento':latest.status==='creating'?'em preparação':latest.status}</div>}
  {latest?.canCancel&&<button type="button" className="asaas-cancel-button" disabled={busy} onClick={()=>void cancel()}>Cancelar renovação de teste</button>}
  {status?.testPaidThrough&&<div className="asaas-test-entitlement"><CheckCircle2 size={15}/> Pagamento de teste registrado até {new Date(status.testPaidThrough).toLocaleDateString('pt-BR')}. Isto não libera um plano real.</div>}
  {message&&<p className="asaas-message" role="status">{message}</p>}
  {error&&<p className="asaas-error" role="alert">{error}</p>}
 </div>;
}
