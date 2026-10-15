import {randomUUID,timingSafeEqual} from 'node:crypto';
import {query,transaction} from './db.mjs';

/** EIXO billing integration is sandbox-only. No production URL or production entitlement updates. */
export const sandboxApi='https://api-sandbox.asaas.com/v3';
const sandboxKey=()=>process.env.EIXO_ASAAS_SANDBOX_KEY||'';
const webhookToken=()=>process.env.EIXO_ASAAS_SANDBOX_WEBHOOK_TOKEN||'';
const err=(status,message)=>Object.assign(new Error(message),{status});
export function billingConfig(){
 const key=sandboxKey(),token=webhookToken();
 const keyValid=key.startsWith('$aact_hmlg_')&&key.length>30||key==='fake-only-sandbox-token-never-valid-in-real-asaas';
 const tokenValid=token.length>=32;
 return {mode:'sandbox',apiConnected:keyValid,webhookConfigured:tokenValid&&process.env.EIXO_ASAAS_SANDBOX_WEBHOOK_READY==='1',realChargesEnabled:false,entitlementsAreTestOnly:true,checkoutConfigured:keyValid&&tokenValid&&process.env.EIXO_ASAAS_SANDBOX_WEBHOOK_READY==='1'};
}
export function verifyAsaasWebhook(provided){
 const expected=webhookToken();
 if(expected.length<32||typeof provided!=='string')return false;
 const a=Buffer.from(provided),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
function nextDateString(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return v.year+'-'+v.month+'-'+v.day+' 23:59:00';
}
export function checkoutPayload(plan,method,id,origin){
 if(!['PIX','CREDIT_CARD'].includes(method))throw err(400,'Forma de pagamento inválida.');
 if(!plan||!Number.isSafeInteger(plan.amountCents)||plan.amountCents<100||![1,6,12].includes(plan.months))throw err(400,'Plano inválido.');
 if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin))throw err(400,'URL pública HTTPS estável necessária.');
 const callback={successUrl:origin+'/?billing=return',cancelUrl:origin+'/?billing=canceled',expiredUrl:origin+'/?billing=expired'};
 const payload={billingTypes:[method],chargeTypes:[method==='PIX'?'DETACHED':'RECURRENT'],minutesToExpire:60,externalReference:id,callback,
  items:[{name:'EIXO · Plano '+plan.name,description:'Acesso ao EIXO por '+plan.months+' meses',quantity:1,value:plan.amountCents/100}]};
 if(method==='CREDIT_CARD')payload.subscription={cycle:plan.months===1?'MONTHLY':plan.months===6?'SEMIANNUALLY':'YEARLY',nextDueDate:nextDateString()};
 return payload;
}
export async function asaasRequest(endpoint,{method='GET',payload,fetchImpl=fetch}={}){
 const key=sandboxKey();
 if(!key.startsWith('$aact_hmlg_')&&key!=='fake-only-sandbox-token-never-valid-in-real-asaas')throw err(503,'A integração só aceita chaves Asaas Sandbox.');
 if(!/^\/(?:checkouts|payments|subscriptions)(?:[/?][a-zA-Z0-9_/?=&%-]*)?$/.test(endpoint))throw err(400,'Endpoint Asaas não permitido.');
 const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),20000);
 try{
  const response=await fetchImpl(sandboxApi+endpoint,{method,headers:{access_token:key,accept:'application/json','content-type':'application/json','User-Agent':'EIXO-Sandbox/0.3.0'},body:payload?JSON.stringify(payload):undefined,signal:ctrl.signal,redirect:'error'});
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{throw err(502,'Resposta inválida do Asaas Sandbox.')}
  if(!response.ok)throw err(response.status===429?429:502,'Asaas Sandbox não concluiu a solicitação ('+response.status+').');
  return data;
 }catch(e){if(e?.name==='AbortError')throw err(504,'Tempo esgotado. Confira o histórico antes de tentar novamente.');throw e}
 finally{clearTimeout(timeout)}
}
export async function billingStatus(userId){
 const rows=(await query('SELECT id,plan_code,method,status,checkout_id,paid_through,created_at FROM billing_checkout_intents WHERE user_id=$1 ORDER BY created_at DESC LIMIT 12',[userId])).rows;
 const active=(await query("SELECT MAX(paid_through) AS paid_through FROM billing_checkout_intents WHERE user_id=$1 AND status IN ('sandbox_paid','sandbox_canceled')",[userId])).rows[0]?.paid_through;
 return {config:billingConfig(),testPaidThrough:active&&new Date(active)>new Date()?active:null,checkouts:rows.map(x=>({id:x.id,planCode:x.plan_code,method:x.method,status:x.status,paidThrough:x.paid_through,createdAt:x.created_at,checkoutUrl:x.checkout_id?'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(x.checkout_id):null,canCancel:x.method==='CREDIT_CARD'&&Boolean(x.subscription_id)&&x.status!=='sandbox_canceled'}))};
}
export async function createBillingCheckout(user,plan,method,origin){
 const config=billingConfig();
 if(!config.checkoutConfigured)throw err(503,'Checkout de testes aguardando chave Sandbox e token de Webhook.');
 if(!user.verified_at)throw err(403,'Confirme o e-mail antes de contratar.');
 await query("UPDATE billing_checkout_intents SET status='expired',updated_at=NOW() WHERE user_id=$1 AND status IN('creating','pending') AND created_at<NOW()-INTERVAL '60 minutes'",[user.id]);
 const existing=(await query("SELECT id,checkout_id,status,plan_code,method FROM billing_checkout_intents WHERE user_id=$1 AND status IN('creating','pending','needs_review') ORDER BY created_at DESC LIMIT 1",[user.id])).rows[0];
 if(existing){
  if(existing.plan_code!==plan.id||existing.method!==method)throw err(409,'Já existe um checkout pendente em outro plano ou forma de pagamento. Conclua ou aguarde sua expiração.');
  if(!existing.checkout_id||existing.status==='needs_review')throw err(409,'Existe uma cobrança com resultado incerto. Confira-a no Asaas Sandbox antes de continuar.');
  return {id:existing.id,status:'pending',url:'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(existing.checkout_id),reused:true};
 }
 const id=randomUUID();
 const inserted=await query("INSERT INTO billing_checkout_intents(id,user_id,plan_code,method,amount_cents,status) VALUES($1,$2,$3,$4,$5,'creating') RETURNING id",[id,user.id,plan.id,method,plan.amountCents]);
 if(!inserted.rows.length)throw err(500,'Não foi possível criar a solicitação.');
 const payload=checkoutPayload(plan,method,id,origin);
 try{
  const result=await asaasRequest('/checkouts',{method:'POST',payload});
  if(!/^[a-z0-9_-]{12,100}$/i.test(String(result.id||'')))throw err(502,'Identificador inválido do Checkout Sandbox.');
  await query("UPDATE billing_checkout_intents SET status='pending',checkout_id=$2,updated_at=NOW() WHERE id=$1 AND status='creating'",[id,result.id]);
  return {id,status:'pending',url:'https://asaas.com/checkoutSession/show?id='+encodeURIComponent(result.id),reused:false};
 }catch(e){
  // Timeout and ambiguous response must not automatically cause duplicate checkout creation.
  await query("UPDATE billing_checkout_intents SET status='needs_review',updated_at=NOW() WHERE id=$1 AND status='creating'",[id]);
  throw e;
 }
}
function extendPaidThrough(previous,months){
 const current=previous&&new Date(previous)>new Date()?new Date(previous):new Date();
 const day=current.getUTCDate();current.setUTCDate(1);current.setUTCMonth(current.getUTCMonth()+months);
 const max=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+1,0)).getUTCDate();
 current.setUTCDate(Math.min(day,max));return current.toISOString();
}
export async function applySandboxWebhook(event){
 const id=String(event?.id||''),type=String(event?.event||'');
 if(!/^evt_[a-zA-Z0-9_&-]{3,150}$/.test(id))throw err(400,'Identificador de evento inválido.');
 if(!/^(CHECKOUT_(CREATED|PAID|CANCELED|EXPIRED)|SUBSCRIPTION_(CREATED|INACTIVATED|DELETED)|PAYMENT_(CREATED|CONFIRMED|RECEIVED|REFUNDED|CHARGEBACK_REQUESTED|OVERDUE))$/.test(type))throw err(400,'Evento não processado.');
 const checkoutId=typeof event.checkout?.id==='string'?event.checkout.id:null;
 const ref=typeof event.subscription?.externalReference==='string'?event.subscription.externalReference:null;
 const subId=typeof event.payment?.subscription==='string'?event.payment.subscription:null;
 let verifiedPayment=null;
 if(['PAYMENT_CONFIRMED','PAYMENT_RECEIVED'].includes(type)&&subId&&/^pay_[a-zA-Z0-9_-]{5,100}$/.test(String(event.payment?.id||'')))
  verifiedPayment=await asaasRequest('/payments/'+encodeURIComponent(event.payment.id));
 // Use event ID for exactly-once state mutation. This affects Sandbox test records only.
 return transaction(async tx=>{
  const inserted=await tx('INSERT INTO billing_webhook_events(id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[id,type]);
  if(!inserted.rows.length)return {ok:true,duplicate:true};
  let row;
  if(checkoutId)row=(await tx('SELECT * FROM billing_checkout_intents WHERE checkout_id=$1 FOR UPDATE',[checkoutId])).rows[0];
  else if(ref&&/^[0-9a-f-]{36}$/i.test(ref))row=(await tx('SELECT * FROM billing_checkout_intents WHERE id=$1 FOR UPDATE',[ref])).rows[0];
  else if(subId)row=(await tx('SELECT * FROM billing_checkout_intents WHERE subscription_id=$1 FOR UPDATE',[subId])).rows[0];
  if(!row)return {ok:true,unmatched:true};
  if(type==='SUBSCRIPTION_CREATED'&&event.subscription?.id&&row.method==='CREDIT_CARD'){
   await tx('UPDATE billing_checkout_intents SET subscription_id=$2,updated_at=NOW() WHERE id=$1',[row.id,String(event.subscription.id)]);
  }
  if(type==='CHECKOUT_PAID'&&event.checkout?.status==='PAID'&&row.status!=='sandbox_paid'){
   if(row.method==='CREDIT_CARD'){
    await tx("UPDATE billing_checkout_intents SET status='checkout_paid',updated_at=NOW() WHERE id=$1 AND status NOT IN ('sandbox_paid','sandbox_canceled')",[row.id]);
    return {ok:true,awaitingVerifiedCardPayment:true};
   }
   const planMonths=row.plan_code==='monthly'?1:row.plan_code==='semiannual'?6:12;
   const previous=(await tx("SELECT MAX(paid_through) AS end FROM billing_checkout_intents WHERE user_id=$1 AND status='sandbox_paid'",[row.user_id])).rows[0]?.end;
   const end=extendPaidThrough(previous,planMonths);
   await tx("UPDATE billing_checkout_intents SET status='sandbox_paid',paid_through=$2,updated_at=NOW() WHERE id=$1",[row.id,end]);
  }
  if(['CHECKOUT_CANCELED','CHECKOUT_EXPIRED'].includes(type)&&row.status!=='sandbox_paid'){
   await tx("UPDATE billing_checkout_intents SET status=$2,updated_at=NOW() WHERE id=$1",[row.id,type==='CHECKOUT_CANCELED'?'canceled':'expired']);
  }
  if(['SUBSCRIPTION_INACTIVATED','SUBSCRIPTION_DELETED'].includes(type)&&row.method==='CREDIT_CARD')
   await tx("UPDATE billing_checkout_intents SET status='sandbox_canceled',updated_at=NOW() WHERE id=$1",[row.id]);
  if(verifiedPayment&&row.status!=='sandbox_canceled'&&row.method==='CREDIT_CARD'&&row.subscription_id&&verifiedPayment.id===event.payment.id&&verifiedPayment.subscription===row.subscription_id
   &&['CONFIRMED','RECEIVED'].includes(verifiedPayment.status)&&Math.round(Number(verifiedPayment.value)*100)===row.amount_cents){
   const receipt=await tx('INSERT INTO billing_payment_receipts(payment_id,intent_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING payment_id',[verifiedPayment.id,row.id]);
   if(receipt.rows.length){
    const months=row.plan_code==='monthly'?1:row.plan_code==='semiannual'?6:12;
    const previous=(await tx('SELECT MAX(paid_through) AS end FROM billing_checkout_intents WHERE user_id=$1',[row.user_id])).rows[0]?.end;
    await tx("UPDATE billing_checkout_intents SET status='sandbox_paid',paid_through=$2,updated_at=NOW() WHERE id=$1",[row.id,extendPaidThrough(previous,months)]);
   }
  }
  // Only Sandbox preview status is affected, never production access.
  return {ok:true,processed:true};
 });
}

/** Sandbox-only cancellation; only the session owner can cancel their recurring test checkout. */
export async function cancelSandboxSubscription(userId,intentId){
 if(!billingConfig().checkoutConfigured)throw err(503,'Sandbox ainda não configurado.');
 if(!/^[0-9a-f-]{36}$/i.test(String(intentId||'')))throw err(400,'Cobrança inválida.');
 const row=(await query('SELECT id,method,subscription_id,status FROM billing_checkout_intents WHERE id=$1 AND user_id=$2',[intentId,userId])).rows[0];
 if(!row)throw err(404,'Assinatura de teste não encontrada.');
 if(row.status==='sandbox_canceled')return {ok:true,canceled:true,alreadyCanceled:true};
 if(row.method!=='CREDIT_CARD'||!row.subscription_id||!/^sub_[a-zA-Z0-9_-]{3,100}$/.test(row.subscription_id))throw err(409,'Recorrência ainda não vinculada ao Asaas Sandbox.');
 await asaasRequest('/subscriptions/'+encodeURIComponent(row.subscription_id),{method:'DELETE'});
 await query("UPDATE billing_checkout_intents SET status='sandbox_canceled',updated_at=NOW() WHERE id=$1 AND user_id=$2",[intentId,userId]);
 return {ok:true,canceled:true,realChargesEnabled:false};
}
