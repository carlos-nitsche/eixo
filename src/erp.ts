export type ERPKind='Venda'|'Orçamento'|'Compra';
export type ERPStatus='Rascunho'|'Confirmada'|'Recebida'|'Cancelada';
import type {PricingSettings} from './pricing-utils';
export type ERPProduct={id:string;workspaceId:string;createdAt:string;title:string;sku:string;barcode:string;category:string;unit:string;cost:number;price:number;stock:number;minimumStock:number;active:boolean;notes:string;images?:string[];pricing?:PricingSettings};
export type ERPSupplier={id:string;workspaceId:string;createdAt:string;title:string;document:string;phone:string;email:string;contact:string;address:string;notes:string};
export type ERPLine={productId:string;title:string;sku:string;quantity:number;price:number;cost:number;unit:string};
export type ERPInstallment={id:string;number:number;dueDate:string;amount:number;paid:number;label:string};
export type ERPOrder={installments?:ERPInstallment[];idempotencyKey?:string;id:string;workspaceId:string;createdAt:string;number:string;kind:ERPKind;status:ERPStatus;partnerId:string;partnerName:string;date:string;dueDate:string;paymentMethod:string;lines:ERPLine[];discount:number;shipping:number;paid:number;notes:string};
export type ERPStockMove={id:string;workspaceId:string;createdAt:string;date:string;productId:string;productTitle:string;delta:number;reason:string;orderId?:string};
export type ERPBill={id:string;workspaceId:string;createdAt:string;title:string;type:'Pagar'|'Receber';category:string;date:string;dueDate:string;amount:number;paid:number;notes:string};
export type ERPPayment={id:string;workspaceId:string;date:string;createdAt:string;sourceType:'order'|'bill';sourceId:string;description:string;direction:'Entrada'|'Saída';amount:number};
export type ERPData={products:ERPProduct[];suppliers:ERPSupplier[];orders:ERPOrder[];movements:ERPStockMove[];bills:ERPBill[];payments:ERPPayment[]};
export const emptyERP=():ERPData=>({products:[],suppliers:[],orders:[],movements:[],bills:[],payments:[]});
export const parseERP=(source?:Partial<ERPData>|null):ERPData=>{const s=source||{};return {products:Array.isArray(s.products)?s.products:[],suppliers:Array.isArray(s.suppliers)?s.suppliers:[],orders:Array.isArray(s.orders)?s.orders:[],movements:Array.isArray(s.movements)?s.movements:[],bills:Array.isArray(s.bills)?s.bills:[],payments:Array.isArray(s.payments)?s.payments:[]}};
export const erpId=()=>crypto.randomUUID();
export const erpDate=()=>{const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')};
export const n=(v:unknown)=>Number(v)||0;
export const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
export const lineTotal=(line:ERPLine)=>round(n(line.quantity)*n(line.price));
export const orderSub=(o:Pick<ERPOrder,'lines'>)=>round(o.lines.reduce((total,line)=>total+lineTotal(line),0));
export const orderTotal=(o:Pick<ERPOrder,'lines'|'shipping'|'discount'>)=>round(Math.max(0,orderSub(o)+n(o.shipping)-n(o.discount)));
export const orderCost=(o:ERPOrder)=>round(o.lines.reduce((total,line)=>total+line.quantity*line.cost,0));
export const openAmount=(o:ERPOrder|ERPBill)=>round(Math.max(0,('lines'in o?orderTotal(o):n(o.amount))-n(o.paid)));
export const money=(v:unknown)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n(v));
export const dateShort=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString('pt-BR'):'—';
export const nextNumber=(orders:ERPOrder[],kind:ERPKind,workspaceId:string)=>{const prefix=kind==='Venda'?'VEN':kind==='Compra'?'COM':'ORC';const top=orders.filter(x=>x.workspaceId===workspaceId&&x.kind===kind).reduce((max,o)=>{const match=new RegExp('^'+prefix+'-(\\d+)$').exec(o.number);return Math.max(max,match?Number(match[1]):0)},0);return prefix+'-'+String(top+1).padStart(5,'0')};
export const withWorkspace=(erp:ERPData,ws:string)=>({products:erp.products.filter(x=>x.workspaceId===ws),suppliers:erp.suppliers.filter(x=>x.workspaceId===ws),orders:erp.orders.filter(x=>x.workspaceId===ws),movements:erp.movements.filter(x=>x.workspaceId===ws),bills:erp.bills.filter(x=>x.workspaceId===ws),payments:erp.payments.filter(x=>x.workspaceId===ws)});
export type ActionResult={ok:true;data:ERPData}|{ok:false;message:string};
export const confirmSale=(data:ERPData,id:string):ActionResult=>{
 const sale=data.orders.find(o=>o.id===id);if(!sale||sale.kind!=='Venda'||sale.status!=='Rascunho')return {ok:false,message:'Somente vendas em rascunho podem ser confirmadas.'};
 const demand=new Map<string,number>();for(const line of sale.lines)demand.set(line.productId,(demand.get(line.productId)||0)+line.quantity);
 for(const [pid,qty] of demand){const p=data.products.find(x=>x.id===pid&&x.workspaceId===sale.workspaceId);if(!p)return {ok:false,message:'Produto indisponível ou removido. Revise esta venda.'};if(p.stock<qty)return {ok:false,message:'Estoque insuficiente para '+p.title+'. Disponível: '+p.stock+'.'};}
 return {ok:true,data:{...data,products:data.products.map(p=>demand.has(p.id)?{...p,stock:p.stock-(demand.get(p.id)||0)}:p),orders:data.orders.map(o=>o.id===id?{...o,status:'Confirmada'}:o),movements:[...data.movements,...sale.lines.map(line=>({id:erpId(),workspaceId:sale.workspaceId,createdAt:new Date().toISOString(),date:erpDate(),productId:line.productId,productTitle:line.title,delta:-line.quantity,reason:'Venda '+sale.number,orderId:id}))]}};
};
export const cancelSale=(data:ERPData,id:string):ActionResult=>{
 const sale=data.orders.find(o=>o.id===id);if(!sale||sale.kind!=='Venda'||sale.status!=='Confirmada')return {ok:false,message:'Esta venda não pode ser cancelada.'};
 if(sale.paid>0)return {ok:false,message:'Venda com recebimento registrado. Estorne o valor recebido antes de cancelar.'};
 return {ok:true,data:{...data,products:data.products.map(p=>({...p,stock:round(p.stock+sale.lines.filter(l=>l.productId===p.id).reduce((t,l)=>t+l.quantity,0))})),orders:data.orders.map(o=>o.id===id?{...o,status:'Cancelada'}:o),movements:[...data.movements,...sale.lines.map(line=>({id:erpId(),workspaceId:sale.workspaceId,createdAt:new Date().toISOString(),date:erpDate(),productId:line.productId,productTitle:line.title,delta:line.quantity,reason:'Cancelamento '+sale.number,orderId:id}))]}};
};
export const receivePurchase=(data:ERPData,id:string):ActionResult=>{
 const purchase=data.orders.find(o=>o.id===id);if(!purchase||purchase.kind!=='Compra'||purchase.status!=='Rascunho')return {ok:false,message:'Esta compra não pode ser recebida.'};
 for(const line of purchase.lines)if(!data.products.find(x=>x.id===line.productId&&x.workspaceId===purchase.workspaceId))return {ok:false,message:'Produto da compra não existe mais.'};
 return {ok:true,data:{...data,products:data.products.map(p=>({...p,stock:round(p.stock+purchase.lines.filter(l=>l.productId===p.id).reduce((t,l)=>t+l.quantity,0)),cost:purchase.lines.find(l=>l.productId===p.id)?.price??p.cost})),orders:data.orders.map(o=>o.id===id?{...o,status:'Recebida'}:o),movements:[...data.movements,...purchase.lines.map(line=>({id:erpId(),workspaceId:purchase.workspaceId,createdAt:new Date().toISOString(),date:erpDate(),productId:line.productId,productTitle:line.title,delta:line.quantity,reason:'Compra '+purchase.number,orderId:id}))]}};
};
export const adjustStock=(data:ERPData,id:string,delta:number,reason:string):ActionResult=>{
 const p=data.products.find(x=>x.id===id);if(!p||!Number.isFinite(delta)||delta===0)return {ok:false,message:'Ajuste inválido.'};if(p.stock+delta<0)return {ok:false,message:'O ajuste deixaria o estoque negativo.'};
 return {ok:true,data:{...data,products:data.products.map(x=>x.id===id?{...x,stock:round(x.stock+delta)}:x),movements:[...data.movements,{id:erpId(),workspaceId:p.workspaceId,createdAt:new Date().toISOString(),date:erpDate(),productId:p.id,productTitle:p.title,delta,reason:reason.trim()||'Ajuste manual'}]}};
};

export function makeInstallments(total:number,entry:number,count:number,firstDate:string,saleDate:string):ERPInstallment[]{
 const cents=Math.round(total*100),paidFirst=Math.round(entry*100);
 if(!Number.isInteger(count)||count<1||count>36||cents<=0||paidFirst<0||paidFirst>cents||!/^\d{4}-\d{2}-\d{2}$/.test(firstDate))throw Error('Parcelamento inválido.');
 const installments:ERPInstallment[]=[];
 if(paidFirst>0)installments.push({id:erpId(),number:0,dueDate:saleDate,amount:paidFirst/100,paid:0,label:'Entrada'});
 const rest=cents-paidFirst,part=Math.floor(rest/count),remainder=rest%count;
 const [y,m,day]=firstDate.split('-').map(Number);
 for(let j=0;j<count;j++){
  const month=new Date(Date.UTC(y,m-1+j,1));
  const lastDay=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate();
  const date=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),Math.min(day,lastDay))).toISOString().slice(0,10);
  installments.push({id:erpId(),number:j+1,dueDate:date,amount:(part+(j===count-1?remainder:0))/100,paid:0,label:'Parcela '+(j+1)+'/'+count});
 }
 return installments;
}
export function allocateInstallmentPayment(installments:ERPInstallment[],amount:number):ERPInstallment[]{
 let remaining=Math.round(amount*100);
 if(remaining<=0)throw Error('Pagamento deve ser positivo.');
 const result=installments.map(x=>({...x}));
 for(const i of result){const outstanding=Math.round((i.amount-i.paid)*100);const allocated=Math.min(remaining,outstanding);i.paid=round(i.paid+allocated/100);remaining-=allocated;if(remaining===0)break}
 if(remaining>0)throw Error('Pagamento maior que o saldo pendente.');
 return result;
}
