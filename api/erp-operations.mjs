import {randomUUID} from 'node:crypto';
import {createDemoState,emptyDemoState} from './demo-state.mjs';

const error=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const text=(v,n=180)=>typeof v==='string'?v.trim().slice(0,n):'';
const money=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e10)error('Valor monetário inválido.');return Math.round((v+Number.EPSILON)*100)/100};
const number=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>1e7)error('Quantidade inválida.');return Math.round(v*1000)/1000};
const today=()=>new Date().toISOString().slice(0,10);
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:today();
const sum=(arr,fn)=>arr.reduce((t,v)=>t+fn(v),0);
const total=o=>money(Math.max(0,sum(o.lines,l=>l.quantity*l.price)+o.shipping-o.discount));
const outstanding=o=>money(Math.max(0,('lines'in o?total(o):o.amount)-o.paid));
const empty=()=>({products:[],suppliers:[],orders:[],movements:[],bills:[],payments:[]});
const structured=val=>JSON.parse(JSON.stringify(val));
function workspace(state,ws){
 if(typeof ws!=='string'||ws.length>128)error('Espaço inválido.');
 if(ws!=='pessoal'&&!state.collections?.businesses?.some(x=>x.id===ws))error('Espaço não encontrado.',403);
 return ws;
}
const active=(arr,id,ws,label)=>{const found=arr.find(x=>x.id===id&&x.workspaceId===ws);if(!found)error(label+' não encontrado.',404);return found};
const stamp=()=>({id:randomUUID(),createdAt:new Date().toISOString(),date:today()});
function unique(items,fn){const set=new Set();for(const it of items){const key=fn(it);if(set.has(key))error('Registro duplicado no documento.');set.add(key)}}
function installments(totalValue,entry,count,firstDate,saleDate){
 const cents=Math.round(totalValue*100),paid=Math.round(entry*100);
 if(!Number.isInteger(count)||count<1||count>36||paid<0||paid>cents||!(/^\d{4}-\d{2}-\d{2}$/).test(firstDate))error('Parcelamento inválido.');
 const parts=[];if(paid)parts.push({id:randomUUID(),number:0,dueDate:saleDate,amount:paid/100,paid:0,label:'Entrada'});
 const rest=cents-paid,cent=Math.floor(rest/count),remainder=rest%count;
 const [year,month,day]=firstDate.split('-').map(Number);
 for(let k=0;k<count;k++){
  const start=new Date(Date.UTC(year,month-1+k,1)),end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
  const dueDate=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),Math.min(day,end))).toISOString().slice(0,10);
  parts.push({id:randomUUID(),number:k+1,dueDate,amount:(cent+(k===count-1?remainder:0))/100,paid:0,label:'Parcela '+(k+1)+'/'+count});
 }
 return parts;
}
function move(erp,product,delta,reason,orderId){
 if(!Number.isFinite(delta)||!delta||!Number.isFinite(product.stock+delta)||product.stock+delta<0)error('Movimento de estoque inválido.');
 product.stock=Math.round((product.stock+delta)*1000)/1000;
 erp.movements.push({...stamp(),workspaceId:product.workspaceId,productId:product.id,productTitle:product.title,delta,reason,...(orderId?{orderId}:{})});
}
function modifyOrder(erp,ws,order,operation){
 const o=active(erp.orders,order,ws,'Documento');
 if(operation==='confirm'){
  if(o.kind!=='Venda'||o.status!=='Rascunho')error('Somente vendas em rascunho podem ser confirmadas.');
  const demand=new Map();
  for(const l of o.lines)demand.set(l.productId,(demand.get(l.productId)||0)+l.quantity);
  for(const [id,qty] of demand){const p=active(erp.products,id,ws,'Produto');if(!p.active||p.stock+1e-7<qty)error('Estoque insuficiente para '+p.title+'.');}
  for(const [id,qty] of demand)move(erp,active(erp.products,id,ws,'Produto'),-qty,'Venda '+o.number,o.id);
  o.status='Confirmada';
 }else if(operation==='receive'){
  if(o.kind!=='Compra'||o.status!=='Rascunho')error('Somente compras em rascunho podem ser recebidas.');
  for(const l of o.lines){const p=active(erp.products,l.productId,ws,'Produto');move(erp,p,l.quantity,'Compra '+o.number,o.id);p.cost=l.price;}
  o.status='Recebida';
 }else if(operation==='cancel'){
  if(o.kind!=='Venda'||o.status!=='Confirmada'||o.paid>0)error('Venda recebida ou não confirmada não pode ser cancelada.');
  for(const l of o.lines)move(erp,active(erp.products,l.productId,ws,'Produto'),l.quantity,'Cancelamento '+o.number,o.id);
  o.status='Cancelada';
 }else error('Ação de documento não permitida.');
}
export function applyErpCommand(state,ws,action,input={}){
 if(!state||typeof state!=='object'||!state.collections)error('Estado de conta inválido.');
 ws=workspace(state,ws);
 if(action==='demo.load'||action==='demo.clear'){
  if(input?.confirm!==true)error('Confirme a substituição dos dados.');
  if(action==='demo.clear'&&state.demo!==true)error('Não há demonstração ativa para limpar.');
  return action==='demo.load'?createDemoState(state.preferences):emptyDemoState(state.preferences);
 }
 const next=structured(state),erp=next.erp||empty();
 for(const key of Object.keys(empty()))if(!Array.isArray(erp[key]))erp[key]=[];
 if(!input||typeof input!=='object'||Array.isArray(input))error('Entrada inválida.');
 const getProduct=id=>active(erp.products,id,ws,'Produto');
 switch(action){
 case 'product.save':{
  const incoming=input.product||{},old=input.existingId?erp.products.find(p=>p.id===input.existingId&&p.workspaceId===ws):null;
  if(input.existingId&&!old)error('Produto não encontrado.',404);
  const sku=text(incoming.sku,90),title=text(incoming.title,180),barcode=text(incoming.barcode,80).replace(/\s+/g,'');
  if(!sku||!title)error('Informe produto e SKU.');
  if(erp.products.some(p=>p.workspaceId===ws&&p.id!==old?.id&&p.sku.toLowerCase()===sku.toLowerCase()))error('SKU duplicado.');
  if(barcode&&erp.products.some(p=>p.workspaceId===ws&&p.id!==old?.id&&p.barcode===barcode))error('Código de barras duplicado.');
  const cost=money(incoming.cost),price=money(incoming.price),min=incoming.minimumStock?number(incoming.minimumStock):0;
  const base=old||{...stamp(),workspaceId:ws,stock:0};
  // Persistir apenas as premissas da calculadora, com whitelist e limites no servidor.
  // Campos legados sem pricing continuam compatíveis. O cálculo nunca autoriza alteração de estoque.
  let pricing=old?.pricing;
  if(incoming.pricing!==undefined){
   const p=incoming.pricing;
   if(!p||typeof p!=='object'||Array.isArray(p))error('Premissas de precificação inválidas.');
   const priceNumber=(field,limit)=>{const value=p[field];if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>limit)error('Campo inválido de precificação: '+field);return Math.round((value+Number.EPSILON)*100)/100};
   if(!['margin','markup'].includes(p.goalType)||!['cent','90','99'].includes(p.rounding))error('Estratégia de precificação inválida.');
   pricing={freight:priceNumber('freight',1e6),packaging:priceNumber('packaging',1e6),other:priceNumber('other',1e6),taxPercent:priceNumber('taxPercent',99),paymentPercent:priceNumber('paymentPercent',99),operatingPercent:priceNumber('operatingPercent',99),goalType:p.goalType,targetPercent:priceNumber('targetPercent',99),rounding:p.rounding};
  }
  Object.assign(base,{title,sku,barcode,cost,price,minimumStock:min,category:text(incoming.category,100),unit:text(incoming.unit,18)||'un',notes:text(incoming.notes,5000),active:incoming.active!==false,images:Array.isArray(incoming.images)?incoming.images.filter(x=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x)).slice(0,6):[],...(pricing?{pricing}:{})});
  if(!old){erp.products.push(base);const stock=Number(incoming.stock||0);if(stock<0||!Number.isFinite(stock))error('Estoque inicial inválido.');if(stock)move(erp,base,number(stock),'Saldo inicial');}
  break;
 }
 case 'bill.save':{
  const incoming=input.bill||{},old=input.existingId?erp.bills.find(x=>x.id===input.existingId&&x.workspaceId===ws):null;
  if(input.existingId&&!old)error('Conta não encontrada.',404);
  if(!text(incoming.title))error('Informe a descrição.');
  const amount=money(incoming.amount);
  if(amount<=0)error('Valor da conta inválido.');
  if(old&&amount<old.paid)error('Novo valor não cobre o já pago.');
  const paid=old?.paid||0;
  const nextBill={...(old||{...stamp(),workspaceId:ws}),title:text(incoming.title),type:incoming.type==='Receber'?'Receber':'Pagar',category:text(incoming.category,100),date:date(incoming.date),dueDate:date(incoming.dueDate),amount,paid,notes:text(incoming.notes,5000)};
  if(old)Object.assign(old,nextBill);else{
   erp.bills.push(nextBill);
   const initial=money(incoming.paid||0);
   if(initial>amount)error('Valor pago maior que a conta.');
   if(initial){nextBill.paid=initial;erp.payments.push({...stamp(),workspaceId:ws,date:nextBill.date,sourceType:'bill',sourceId:nextBill.id,description:nextBill.title,direction:nextBill.type==='Pagar'?'Saída':'Entrada',amount:initial});}
  }
  break;
 }
 case 'order.create':{
  const idempotencyKey=typeof input.idempotencyKey==='string'&&/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)?input.idempotencyKey:'';
  if(idempotencyKey&&erp.orders.some(o=>o.workspaceId===ws&&o.idempotencyKey===idempotencyKey))break;
  const d=input.order||{},kind=d.kind;
  if(!['Venda','Compra','Orçamento'].includes(kind))error('Tipo de documento inválido.');
  if(!Array.isArray(d.lines)||!d.lines.length||d.lines.length>150)error('Documento sem itens válidos.');
  const lines=d.lines.map(l=>{
   const p=getProduct(l.productId),qty=number(l.quantity);
   if(!p.active&&kind==='Venda')error('Produto inativo.');
   return {productId:p.id,title:p.title,sku:p.sku,quantity:qty,price:kind==='Compra'?money(p.cost):money(p.price),cost:money(p.cost),unit:p.unit};
  });
  unique(lines,l=>l.productId);
  const disc=money(d.discount||0),shipping=money(d.shipping||0),amount=money(Math.max(0,sum(lines,l=>l.quantity*l.price)+shipping-disc));
  if(amount<=0||disc>sum(lines,l=>l.quantity*l.price)+shipping)error('Total ou desconto inválido.');
  const partnerId=text(d.partnerId,80),clients=next.collections.clients||[];
  const partner=kind==='Compra'?erp.suppliers.find(x=>x.id===partnerId&&x.workspaceId===ws):clients.find(x=>x.id===partnerId&&(x.workspaceId||'pessoal')===ws);
  if(kind==='Compra'&&!partner)error('Fornecedor obrigatório.');
  let parts;
  if(kind==='Venda'&&d.paymentMethod==='A prazo'){
   if(!partner)error('Venda a prazo precisa de cliente.');
   const limit=Number(partner.creditLimit)||0;
   const pending=sum(erp.orders.filter(o=>o.workspaceId===ws&&o.kind==='Venda'&&o.status==='Confirmada'&&o.partnerId===partnerId),outstanding);
   if(limit>0&&pending+amount>limit+.009)error('Limite de crédito insuficiente.');
   parts=installments(amount,money(d.termEntry||0),Number(d.termCount||3),d.firstDueDate||today(),date(d.date));
  }
  const prefix=kind==='Venda'?'VEN':kind==='Compra'?'COM':'ORC';
  const highest=erp.orders.filter(o=>o.workspaceId===ws&&o.kind===kind).reduce((v,o)=>Math.max(v,Number(new RegExp('^'+prefix+'-(\\d+)$').exec(o.number)?.[1])||0),0);
  const order={...stamp(),...(idempotencyKey?{idempotencyKey}:{}),workspaceId:ws,number:prefix+'-'+String(highest+1).padStart(5,'0'),kind,status:'Rascunho',partnerId,partnerName:partner?.title||'Consumidor final',date:date(d.date),dueDate:date(d.dueDate),paymentMethod:text(d.paymentMethod,80)||'Dinheiro',lines,discount:disc,shipping,paid:0,notes:text(d.notes,5000),...(parts?{installments:parts}:{})};
  erp.orders.push(order);
  if(input.instant===true){
   if(kind!=='Venda')error('Finalização imediata é só para vendas.');
   modifyOrder(erp,ws,order.id,'confirm');
   if(order.paymentMethod!=='A prazo'){
    order.paid=amount;
    erp.payments.push({...stamp(),workspaceId:ws,date:order.date,sourceType:'order',sourceId:order.id,description:order.number+' · '+order.partnerName,direction:'Entrada',amount});
   }
  }
  break;
 }
 case 'order.status':modifyOrder(erp,ws,input.id,input.operation);break;
 case 'order.delete':{
  const o=active(erp.orders,input.id,ws,'Documento');
  if(o.status!=='Rascunho')error('Só é possível excluir rascunhos.');
  erp.orders=erp.orders.filter(x=>x.id!==o.id);break;
 }
 case 'stock.adjust':{
  const p=getProduct(input.id),delta=Number(input.delta),reason=text(input.reason,240);
  if(!Number.isFinite(delta)||delta===0||!reason)error('Informe um ajuste e o motivo.');
  if(Math.abs(delta)>1e7)error('Ajuste excessivo.');
  move(erp,p,delta,reason);break;
 }
 case 'payment.record':{
  const amt=money(input.amount);
  if(amt<=0)error('Pagamento inválido.');
  const type=input.sourceType==='order'?'order':input.sourceType==='bill'?'bill':null;
  if(!type)error('Fonte do pagamento inválida.');
  const record=active(type==='order'?erp.orders:erp.bills,input.id,ws,'Lançamento');
  if(type==='order'&&!(record.kind==='Venda'&&record.status==='Confirmada'||record.kind==='Compra'&&record.status==='Recebida'))error('Documento não aceita pagamento.');
  if(amt>outstanding(record)+.001)error('Pagamento supera saldo pendente.');
  if(type==='order'&&record.installments?.length){
   let cents=Math.round(amt*100);
   for(const part of record.installments){
    const open=Math.round((part.amount-part.paid)*100),delta=Math.min(cents,open);
    part.paid=money(part.paid+delta/100);cents-=delta;if(!cents)break;
   }
   if(cents)error('Parcelas incompatíveis com pagamento.');
  }
  record.paid=money(record.paid+amt);
  erp.payments.push({...stamp(),workspaceId:ws,date:date(input.date),sourceType:type,sourceId:record.id,description:type==='order'?record.number+' · '+record.partnerName:record.title,direction:(type==='order'?record.kind==='Compra':record.type==='Pagar')?'Saída':'Entrada',amount:amt});
  break;
 }
 default:error('Operação empresarial não autorizada.',400);
 }
 next.erp=erp;return next;
}
