import {randomUUID,timingSafeEqual} from 'node:crypto';
import {query,transaction,mode} from './db.mjs';

const API='https://api.asaas.com/v3';
const prodKey=()=>String(process.env.EIXO_ASAAS_PRODUCTION_KEY||'');
const webhookSecret=()=>String(process.env.EIXO_ASAAS_PRODUCTION_WEBHOOK_TOKEN||'');
const billingOrigin=()=>String(process.env.EIXO_BILLING_PRODUCTION_ORIGIN||'').replace(/\/$/,'');
const failed=(status,message)=>Object.assign(new Error(message),{status});
const checkoutURL=id=>'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(id);
const idMatch=/^[a-zA-Z0-9_-]{7,150}$/;
// A documentação Asaas inclui IDs de evento com '&' (ex.: evt_...&368604920).
// Aceitar esse separador evita rejeitar webhooks legítimos e travar a fila de entregas.
const eventMatch=/^evt_[a-zA-Z0-9_&-]{5,200}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const months={monthly:1,semiannual:6,annual:12};
const cycle={monthly:'MONTHLY',semiannual:'SEMIANNUALLY',annual:'YEARLY'};
const accepted=['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'];
const risky=['PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED'];
const notifications=['CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','SUBSCRIPTION_CREATED','SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED',...accepted,...risky];
function stableURL(raw){
 try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname.includes('.')&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&!['localhost','127.0.0.1'].includes(u.hostname)&&!u.hostname.endsWith('.trycloudflare.com')&& !u.hostname.endsWith('.example')}
 catch{return false}
}
export function liveBillingStatus(){
 const publicHost=String(process.env.EIXO_PUBLIC_HOST||'').toLowerCase();
 const origin=billingOrigin();
 const prerequisites={
  productionApiKey:prodKey().startsWith('$aact_prod_')&&prodKey().length>50,
  webhookSecret:webhookSecret().length>=32&&webhookSecret().length<=255&&!/\s/.test(webhookSecret())&&webhookSecret()!==prodKey(),
  webhookRegistered:process.env.EIXO_ASAAS_PRODUCTION_WEBHOOK_READY==='1',
  stableHttpsDomain:stableURL(origin),
  publicUrlMatches:stableURL(String(process.env.EIXO_PUBLIC_URL||''))&&String(process.env.EIXO_PUBLIC_URL||'').replace(/\/$/,'')===origin&&new URL(origin||'https://invalid.example').hostname.toLowerCase()===publicHost,
  postgresql:mode==='postgresql'&&process.env.DATABASE_SSL==='require',
  productionRuntime:process.env.EIXO_MODE==='production',
  smtp:/^smtps?:\/\//.test(String(process.env.SMTP_URL||''))&&String(process.env.SMTP_FROM||'').includes('@'),
  offsiteBackup:process.env.EIXO_OFFSITE_BACKUP_READY==='1',
  deploymentApproved:process.env.EIXO_INFRASTRUCTURE_DEPLOYMENT_APPROVED==='1',
  explicitApproval:process.env.EIXO_ASAAS_ENABLE_REAL_BILLING==='1'
 };
 const enabled=Object.values(prerequisites).every(Boolean);
 return {mode:'production',enabled,realChargesEnabled:enabled,requirements:prerequisites};
}
export function verifyLiveWebhook(value){
 const expected=webhookSecret();
 if(expected.length<32||typeof value!=='string')return false;
 const a=Buffer.from(value),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
const mustEnable=()=>{if(!liveBillingStatus().enabled)throw failed(503,'Pagamentos reais indisponíveis até validar toda a infraestrutura de produção.')};
async function provider(endpoint,{method='GET',payload}={}){
 mustEnable();
 const safe=/^\/checkouts$/.test(endpoint)||/^\/payments\/pay_[A-Za-z0-9_-]{5,100}$/.test(endpoint)||
  /^\/payments\?checkoutSession=[A-Za-z0-9_-]{7,150}&limit=100$/.test(endpoint)||
  /^\/subscriptions\/sub_[A-Za-z0-9_-]{5,100}$/.test(endpoint);
 if(!safe||!['GET','POST','DELETE'].includes(method))throw failed(400,'Rota de pagamento não permitida.');
 if(method==='DELETE'&&!endpoint.startsWith('/subscriptions/'))throw failed(400,'Cancelamento não autorizado.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{
  const response=await fetch(API+endpoint,{method,headers:{access_token:prodKey(),'User-Agent':'EIXO/1.0','accept':'application/json','content-type':'application/json'},body:payload?JSON.stringify(payload):undefined,signal:controller.signal,redirect:'error'});
  let result={};try{result=await response.json()}catch{if(response.ok)throw failed(502,'Resposta inválida do gateway.')}
  if(!response.ok)throw failed(response.status===429?429:502,'Gateway Asaas recusou a operação ('+response.status+').');
  return result;
 }catch(e){if(e?.name==='AbortError')throw failed(504,'Resposta incerta do Asaas; verifique antes de tentar novamente.');throw e}finally{clearTimeout(timer)}
}
function nextDueDate(){
 const d=new Date(Date.now()+86400000);const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const m=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return m.year+'-'+m.month+'-'+m.day+' 12:00:00';
}
export function realCheckoutPayload(plan,method,id){
 if(!plan||!months[plan.id]||!Number.isSafeInteger(plan.amountCents)||plan.amountCents<100||!uuid.test(id))throw failed(400,'Plano ou solicitação inválidos.');
 if(!['PIX','CREDIT_CARD'].includes(method))throw failed(400,'Forma de pagamento inválida.');
 if(!stableURL(billingOrigin()))throw failed(503,'É necessário um domínio HTTPS permanente.');
 const result={billingTypes:[method],chargeTypes:[method==='PIX'?'DETACHED':'RECURRENT'],minutesToExpire:60,externalReference:id,
  callback:{successUrl:billingOrigin()+'/?billing=return',cancelUrl:billingOrigin()+'/?billing=canceled',expiredUrl:billingOrigin()+'/?billing=expired'},
  items:[{name:'EIXO · Plano '+plan.name,description:'Acesso ao EIXO por '+months[plan.id]+' meses',quantity:1,value:plan.amountCents/100}]};
 if(method==='CREDIT_CARD')result.subscription={cycle:cycle[plan.id],nextDueDate:nextDueDate()};
 return result;
}
export async function realBillingHistory(userId){
 const history=(await query('SELECT id,plan_code,method,status,checkout_id,subscription_id,paid_through,created_at FROM live_billing_intents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 12',[userId])).rows;
 const subscription=(await query('SELECT plan_code,status,paid_through,provider_id FROM subscriptions WHERE user_id=$1',[userId])).rows[0]||null;
 return {config:liveBillingStatus(),subscription:subscription?{planCode:subscription.plan_code,status:subscription.status,paidThrough:subscription.paid_through,renewalActive:history.some(r=>r.subscription_id===subscription.provider_id&&r.method==='CREDIT_CARD'&&!['recurrence_canceled','canceled','expired','cancellation_requested'].includes(r.status))}:null,
  orders:history.map(x=>({id:x.id,planCode:x.plan_code,method:x.method,status:x.status,paidThrough:x.paid_through,createdAt:x.created_at,checkoutUrl:x.checkout_id&&['pending','awaiting_card_settlement'].includes(x.status)?checkoutURL(x.checkout_id):null,canCancel:x.method==='CREDIT_CARD'&&Boolean(x.subscription_id)&&!['recurrence_canceled','canceled','expired','cancellation_requested'].includes(x.status)}))};
}
export async function createRealCheckout(user,plan,method){
 mustEnable();
 if(!user.verified_at)throw failed(403,'Confirme seu e-mail antes da contratação.');
 if(user.is_owner)throw failed(409,'Esta conta já possui acesso vitalício e não precisa contratar um plano.');
 if(!['PIX','CREDIT_CARD'].includes(method))throw failed(400,'Forma de pagamento inválida.');
 const active=(await query("SELECT paid_through FROM subscriptions WHERE user_id=$1 AND status='active' AND paid_through>NOW()",[user.id])).rows[0];
 if(active)throw failed(409,'Você já tem um plano pago ativo; confira sua assinatura antes de comprar novamente.');
 const recurrence=(await query("SELECT id FROM live_billing_intents WHERE user_id=$1 AND method='CREDIT_CARD' AND subscription_id IS NOT NULL AND status NOT IN ('recurrence_canceled','canceled','expired') LIMIT 1",[user.id])).rows[0];
 if(recurrence)throw failed(409,'Já existe uma assinatura automática associada à sua conta.');
 const pending=(await query("SELECT * FROM live_billing_intents WHERE user_id=$1 AND status IN ('creating','pending','needs_review','awaiting_card_settlement','cancellation_requested') ORDER BY created_at DESC LIMIT 1",[user.id])).rows[0];
 if(pending){
  if(pending.status!=='pending'||!pending.checkout_id||pending.plan_code!==plan.id||pending.method!==method)throw failed(409,'Há uma cobrança anterior pendente de conclusão ou conciliação.');
  return {id:pending.id,url:checkoutURL(pending.checkout_id),reused:true};
 }
 const id=randomUUID();
 try{await query("INSERT INTO live_billing_intents(id,user_id,plan_code,method,amount_cents,status) VALUES($1,$2,$3,$4,$5,'creating')",[id,user.id,plan.id,method,plan.amountCents])}
 catch(e){if(e?.code==='23505')throw failed(409,'Uma cobrança já está sendo processada.');throw e}
 try{
  const checkout=await provider('/checkouts',{method:'POST',payload:realCheckoutPayload(plan,method,id)});
  if(!idMatch.test(String(checkout.id||'')))throw failed(502,'Asaas não retornou um identificador válido.');
  await query("UPDATE live_billing_intents SET status='pending',checkout_id=$2,updated_at=NOW() WHERE id=$1 AND status='creating'",[id,checkout.id]);
  return {id,url:checkoutURL(checkout.id),reused:false};
 }catch(e){
  await query("UPDATE live_billing_intents SET status='needs_review',updated_at=NOW() WHERE id=$1 AND status='creating'",[id]);
  throw e;
 }
}
function paidUntil(previous,monthsCount){
 const d=previous&&new Date(previous)>new Date()?new Date(previous):new Date();
 const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+monthsCount);
 d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));
 return d.toISOString();
}
export function verifiedLivePayment(p,intent,checkoutContext=false){
 if(!p||!idMatch.test(String(p.id||''))||!accepted.includes('PAYMENT_'+p.status))return false;
 if(!['CONFIRMED','RECEIVED'].includes(String(p.status)))return false;
 if(p.billingType!==intent.method)return false;
 if(Math.round(Number(p.value)*100)!==intent.amount_cents)return false;
 if(p.deleted||p.refunded||p.status==='REFUNDED')return false;
 if(checkoutContext)return true; 
 return p.checkoutSession===intent.checkout_id||(intent.method==='CREDIT_CARD'&&p.subscription&&p.subscription===intent.subscription_id);
}
async function recordReceipt(tx,intent,p){
 const result=await tx('INSERT INTO live_billing_receipts(payment_id,intent_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING payment_id',[p.id,intent.id]);
 if(!result.rows.length)return false;
 const previous=(await tx('SELECT paid_through FROM subscriptions WHERE user_id=$1',[intent.user_id])).rows[0]?.paid_through;
 const until=paidUntil(previous,months[intent.plan_code]);
 const providerId=intent.method==='CREDIT_CARD'?p.subscription:intent.checkout_id;
 await tx("INSERT INTO subscriptions(user_id,plan_code,status,paid_through,provider_id) VALUES($1,$2,'active',$3,$4) ON CONFLICT(user_id) DO UPDATE SET plan_code=$2,status='active',paid_through=$3,provider_id=$4",[intent.user_id,intent.plan_code,until,providerId]);
 const newStatus=intent.status==='recurrence_canceled'?'recurrence_canceled':'paid';
 await tx("UPDATE live_billing_intents SET status=$2,paid_through=$3,updated_at=NOW() WHERE id=$1",[intent.id,newStatus,until]);
 return true;
}
async function getCheckoutPayments(checkoutId){
 const result=await provider('/payments?checkoutSession='+encodeURIComponent(checkoutId)+'&limit=100');
 if(!Array.isArray(result?.data))throw failed(502,'Consulta de pagamentos retornou um formato inesperado.');
 return result.data;
}
async function locate(tx,event,verifiedPayment){
 const c=String(event.checkout?.id||verifiedPayment?.checkoutSession||'');
 const sub=String(verifiedPayment?.subscription||event.subscription?.id||event.payment?.subscription||'');
 const reference=String(event.checkout?.externalReference||event.subscription?.externalReference||verifiedPayment?.externalReference||'');
 if(idMatch.test(c)){
  const row=(await tx('SELECT * FROM live_billing_intents WHERE checkout_id=$1 FOR UPDATE',[c])).rows[0];
  if(row)return row;
 }
 if(idMatch.test(sub)){
  const row=(await tx('SELECT * FROM live_billing_intents WHERE subscription_id=$1 FOR UPDATE',[sub])).rows[0];
  if(row)return row;
 }
 if(uuid.test(reference)){
  const row=(await tx('SELECT * FROM live_billing_intents WHERE id=$1 FOR UPDATE',[reference])).rows[0];
  if(row)return row;
 }
 return null;
}
export async function applyLiveWebhook(event){
 mustEnable();
 const eventId=String(event?.id||''),type=String(event?.event||'');
 if(!eventMatch.test(eventId))throw failed(400,'Identificador do evento inválido.');
 if(!notifications.includes(type))return {ok:true,ignored:true};
 let payment=null,checkoutPayments=null,subscription=null;
 if((accepted.includes(type)||risky.includes(type))&&event?.payment?.id){
  const id=String(event.payment.id);
  if(!/^pay_[A-Za-z0-9_-]{5,100}$/.test(id))throw failed(400,'ID de pagamento inválido.');
  payment=await provider('/payments/'+id);
  if(payment.id!==id)throw failed(502,'Pagamento retornado não corresponde à notificação.');
 }
 if(type==='CHECKOUT_PAID'&&idMatch.test(String(event.checkout?.id||''))){
  checkoutPayments=await getCheckoutPayments(event.checkout.id);
 }
 if(type==='SUBSCRIPTION_CREATED'&&/^sub_[A-Za-z0-9_-]{5,100}$/.test(String(event.subscription?.id||''))){
  subscription=await provider('/subscriptions/'+event.subscription.id);
  if(subscription?.id!==event.subscription.id)throw failed(502,'Assinatura retornada não corresponde ao evento.');
 }
 return transaction(async tx=>{
  const registered=await tx('INSERT INTO live_billing_events(id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[eventId,type]);
  if(!registered.rows.length)return {ok:true,duplicate:true};
  let intent=await locate(tx,event,payment);
  if(!intent&&subscription)intent=await locate(tx,{subscription},null);
  if(!intent)return {ok:true,unmatched:true};
  if(type==='SUBSCRIPTION_CREATED'&&subscription&&intent.method==='CREDIT_CARD'){
   if(subscription.value!=null&&Math.round(Number(subscription.value)*100)!==intent.amount_cents)return {ok:true,needsReview:true};
   if(subscription.cycle&&subscription.cycle!==cycle[intent.plan_code])return {ok:true,needsReview:true};
   if(!intent.subscription_id){
    await tx("UPDATE live_billing_intents SET subscription_id=$2,updated_at=NOW() WHERE id=$1 AND subscription_id IS NULL",[intent.id,subscription.id]);
   }
  }
  if(type==='CHECKOUT_PAID'&&event.checkout?.status==='PAID'){
   if(intent.method==='PIX'){
    // A signed webhook alone does not grant paid access; reconcile with Asaas payment records.
    const p=checkoutPayments.find(p=>p.checkoutSession===intent.checkout_id&&verifiedLivePayment(p,intent,true));
    if(!p)return {ok:true,awaitingVerifiedPayment:true};
    const done=await recordReceipt(tx,intent,p);
    return {ok:true,processed:true,credited:done};
   }
   if(intent.method==='CREDIT_CARD'){
    const p=checkoutPayments.find(p=>p.checkoutSession===intent.checkout_id&&verifiedLivePayment(p,intent,true)&&idMatch.test(String(p.subscription||'')));
    if(p){
     if(!intent.subscription_id)await tx("UPDATE live_billing_intents SET subscription_id=$2 WHERE id=$1 AND subscription_id IS NULL",[intent.id,p.subscription]);
     const done=await recordReceipt(tx,intent,p);return {ok:true,processed:true,credited:done};
    }
    await tx("UPDATE live_billing_intents SET status='awaiting_card_settlement',updated_at=NOW() WHERE id=$1 AND status='pending'",[intent.id]);
   }
  }
  if(['CHECKOUT_CANCELED','CHECKOUT_EXPIRED'].includes(type)&&['pending','creating','awaiting_card_settlement'].includes(intent.status)&&!intent.paid_through){
   await tx("UPDATE live_billing_intents SET status=$2,updated_at=NOW() WHERE id=$1",[intent.id,type==='CHECKOUT_CANCELED'?'canceled':'expired']);
  }
  if(payment&&accepted.includes(type)&&verifiedLivePayment(payment,intent)){
   if(intent.method==='CREDIT_CARD'&&payment.subscription&&!intent.subscription_id){
    await tx("UPDATE live_billing_intents SET subscription_id=$2 WHERE id=$1 AND subscription_id IS NULL",[intent.id,payment.subscription]);
   }
   const done=await recordReceipt(tx,intent,payment);
   return {ok:true,processed:true,credited:done};
  }
  if(payment&&risky.includes(type)){
   const found=(await tx('SELECT payment_id FROM live_billing_receipts WHERE payment_id=$1 AND intent_id=$2',[payment.id,intent.id])).rows[0];
   if(found){
    await tx("UPDATE live_billing_intents SET status='needs_review',updated_at=NOW() WHERE id=$1",[intent.id]);
    if(type==='PAYMENT_REFUNDED'||type==='PAYMENT_CHARGEBACK_REQUESTED'){
     await tx("UPDATE subscriptions SET status='under_review' WHERE user_id=$1 AND provider_id=$2",[intent.user_id,intent.method==='CREDIT_CARD'?intent.subscription_id:intent.checkout_id]);
    }
    return {ok:true,financialReviewRequired:true};
   }
  }
  if(['SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED'].includes(type)&&intent.method==='CREDIT_CARD'&&String(event.subscription?.id||'')===intent.subscription_id){
   await tx("UPDATE live_billing_intents SET status='recurrence_canceled',updated_at=NOW() WHERE id=$1",[intent.id]);
  }
  return {ok:true,processed:true};
 });
}
export async function reconcileRealCheckout(userId,intentId){
 mustEnable();
 if(!uuid.test(String(intentId||'')))throw failed(400,'Cobrança inválida.');
 const row=(await query('SELECT * FROM live_billing_intents WHERE id=$1 AND user_id=$2',[intentId,userId])).rows[0];
 if(!row||!idMatch.test(String(row.checkout_id||'')))throw failed(404,'Não há checkout confirmado para conciliar.');
 const payments=await getCheckoutPayments(row.checkout_id);
 const paid=payments.find(p=>p.checkoutSession===row.checkout_id&&verifiedLivePayment(p,row,true)&&(row.method==='PIX'||idMatch.test(String(p.subscription||''))));
 if(!paid)return {ok:true,credited:false,status:row.status,message:'Nenhum pagamento confirmado foi identificado no Asaas.'};
 return transaction(async tx=>{
  const intent=(await tx('SELECT * FROM live_billing_intents WHERE id=$1 AND user_id=$2 FOR UPDATE',[intentId,userId])).rows[0];
  if(!intent)throw failed(404,'Cobrança não encontrada.');
  if(intent.method==='CREDIT_CARD'&&!intent.subscription_id){
   await tx("UPDATE live_billing_intents SET subscription_id=$2 WHERE id=$1 AND subscription_id IS NULL",[intent.id,paid.subscription]);
  }
  const done=await recordReceipt(tx,intent,paid);
  return {ok:true,credited:done,status:done?'paid':intent.status};
 });
}
export async function cancelRealSubscription(userId,intentId){
 mustEnable();
 if(!uuid.test(String(intentId||'')))throw failed(400,'Solicitação de cancelamento inválida.');
 const row=(await query('SELECT * FROM live_billing_intents WHERE id=$1 AND user_id=$2',[intentId,userId])).rows[0];
 if(!row||row.method!=='CREDIT_CARD'||!/^sub_[A-Za-z0-9_-]{5,100}$/.test(String(row.subscription_id||'')))throw failed(404,'Assinatura recorrente não localizada.');
 if(row.status==='recurrence_canceled')return {ok:true,canceled:true,alreadyCanceled:true,accessUntil:row.paid_through};
 if(row.status==='cancellation_requested'||row.status==='needs_review')throw failed(409,'Cancelamento exige conferência antes de nova tentativa.');
 const claim=await query("UPDATE live_billing_intents SET status='cancellation_requested',updated_at=NOW() WHERE id=$1 AND user_id=$2 AND status NOT IN ('cancellation_requested','recurrence_canceled','needs_review') RETURNING id",[intentId,userId]);
 if(!claim.rows.length)throw failed(409,'Esta assinatura já está em processamento.');
 try{
  const result=await provider('/subscriptions/'+row.subscription_id,{method:'DELETE'});
  if(result?.deleted!==true)throw failed(502,'Asaas não confirmou o cancelamento.');
  await query("UPDATE live_billing_intents SET status='recurrence_canceled',updated_at=NOW() WHERE id=$1 AND status='cancellation_requested'",[intentId]);
  return {ok:true,canceled:true,accessUntil:row.paid_through};
 }catch(e){
  await query("UPDATE live_billing_intents SET status='needs_review',updated_at=NOW() WHERE id=$1 AND status='cancellation_requested'",[intentId]);
  throw e;
 }
}
