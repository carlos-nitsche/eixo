import type {ERPBill,ERPData,ERPOrder,ERPProduct,ERPStockMove} from './erp';
export type BusinessPeriod=7|30|90;
export type AgingItem={id:string;sourceId:string;kind:'order'|'bill';title:string;type:'Receber'|'Pagar';dueDate:string;amount:number;paid:number;open:number;daysUntil:number|null;status:'Vencido'|'Hoje'|'Próximos 7 dias'|'Próximos 30 dias'|'Futuro'|'Sem data'};
export type InventoryInsight={product:ERPProduct;sold:number;revenue:number;turnoverDays:number|null;className:'A'|'B'|'C'|'Sem vendas';reorder:number;capital:number;status:'Esgotado'|'Crítico'|'Atenção'|'Regular'|'Inativo'};
type SeriesPoint={date:string;in:number;out:number;net:number;cumulative:number};
export type BusinessInsight={
 performance:{revenue:number;previousRevenue:number;growth:number|null;orders:number;averageTicket:number;grossProfit:number;grossMargin:number|null;received:number;paid:number;netCash:number;customerCount:number};
 dues:AgingItem[];dueTotals:{receivable:number;payable:number;overdueReceive:number;overduePay:number;next7In:number;next7Out:number};
 series:SeriesPoint[];inventory:InventoryInsight[];inventoryTotals:{cost:number;retail:number;atRisk:number;low:number;zero:number;dead:number};
 customerRanks:{id:string;name:string;amount:number;orders:number;balance:number}[];
 notices:{severity:'critical'|'warning'|'info';title:string;description:string;tab:'estoque'|'financeiro'|'vendas'|'orcamentos'}[];
};
const cents=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
const numeric=(x:unknown)=>Number.isFinite(Number(x))?Number(x):0;
const day=/^\d{4}-\d{2}-\d{2}$/;
const validDay=(x:string)=>day.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(Date.parse(x+'T12:00:00Z')).toISOString().slice(0,10)===x;
const utc=(s:string)=>Date.parse(s+'T12:00:00Z');
export const dayOffset=(iso:string,days:number)=>{const d=new Date(utc(iso));d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const diffDays=(a:string,b:string)=>Math.round((utc(a)-utc(b))/86400000);
const dueState=(date:string,today:string):AgingItem['status']=>{
 if(!validDay(date))return 'Sem data';
 const d=diffDays(date,today);
 return d<0?'Vencido':d===0?'Hoje':d<=7?'Próximos 7 dias':d<=30?'Próximos 30 dias':'Futuro';
};
const amount=(o:ERPOrder)=>cents(Math.max(0,o.lines.reduce((s,l)=>s+numeric(l.price)*numeric(l.quantity),0)+numeric(o.shipping)-numeric(o.discount)));
const cost=(o:ERPOrder)=>cents(o.lines.reduce((s,l)=>s+numeric(l.cost)*numeric(l.quantity),0));
const rem=(total:number,paid:number)=>cents(Math.max(0,total-numeric(paid)));
const fillDues=(orders:ERPOrder[],bills:ERPBill[],today:string):AgingItem[]=>{
 const items:AgingItem[]=[];
 for(const order of orders){
  const type: 'Receber'|'Pagar'=order.kind==='Compra'?'Pagar':'Receber';
  if(!((order.kind==='Venda'&&order.status==='Confirmada')||(order.kind==='Compra'&&order.status==='Recebida')))continue;
  const installments=order.kind==='Venda'&&order.installments?.length?order.installments:null;
  if(installments){
   for(const entry of installments)items.push({id:order.id+':'+entry.id,sourceId:order.id,kind:'order',type,title:order.number+' · '+order.partnerName+' · '+entry.label,dueDate:entry.dueDate,amount:numeric(entry.amount),paid:numeric(entry.paid),open:rem(entry.amount,entry.paid),daysUntil:validDay(entry.dueDate)?diffDays(entry.dueDate,today):null,status:dueState(entry.dueDate,today)});
  }else{
   items.push({id:order.id,sourceId:order.id,kind:'order',type,title:order.number+' · '+order.partnerName,dueDate:order.dueDate,amount:amount(order),paid:numeric(order.paid),open:rem(amount(order),order.paid),daysUntil:validDay(order.dueDate)?diffDays(order.dueDate,today):null,status:dueState(order.dueDate,today)});
  }
 }
 for(const bill of bills)items.push({id:bill.id,sourceId:bill.id,kind:'bill',type:bill.type,title:bill.title,dueDate:bill.dueDate,amount:numeric(bill.amount),paid:numeric(bill.paid),open:rem(bill.amount,bill.paid),daysUntil:validDay(bill.dueDate)?diffDays(bill.dueDate,today):null,status:dueState(bill.dueDate,today)});
 return items.filter(x=>x.open>0).sort((a,b)=>(a.daysUntil??Number.MAX_SAFE_INTEGER)-(b.daysUntil??Number.MAX_SAFE_INTEGER)||a.title.localeCompare(b.title,'pt-BR'));
};
export function buildBusinessInsight(data:ERPData,workspaceId:string,clients:{id:string;title:string}[],today:string,period:BusinessPeriod=30):BusinessInsight{
 if(!validDay(today))throw Error('Data de referência inválida');
 const sales=data.orders.filter(o=>o.workspaceId===workspaceId&&o.kind==='Venda'&&o.status==='Confirmada');
 const previousStart=dayOffset(today,-period*2+1),start=dayOffset(today,-period+1),yesterday=dayOffset(start,-1);
 const inWindow=(d:string,a:string,b:string)=>validDay(d)&&d>=a&&d<=b;
 const thisSales=sales.filter(o=>inWindow(o.date,start,today));
 const prevSales=sales.filter(o=>inWindow(o.date,previousStart,yesterday));
 const revenue=cents(thisSales.reduce((s,o)=>s+amount(o),0));
 const previousRevenue=cents(prevSales.reduce((s,o)=>s+amount(o),0));
 const grossProfit=cents(thisSales.reduce((s,o)=>s+amount(o)-cost(o),0));
 const payments=data.payments.filter(p=>p.workspaceId===workspaceId&&inWindow(p.date,start,today));
 const received=cents(payments.filter(p=>p.direction==='Entrada').reduce((s,p)=>s+numeric(p.amount),0));
 const paid=cents(payments.filter(p=>p.direction==='Saída').reduce((s,p)=>s+numeric(p.amount),0));
 const dues=fillDues(data.orders.filter(o=>o.workspaceId===workspaceId),data.bills.filter(b=>b.workspaceId===workspaceId),today);
 const total=(type:'Pagar'|'Receber',predicate:(x:AgingItem)=>boolean=()=>true)=>cents(dues.filter(x=>x.type===type&&predicate(x)).reduce((s,x)=>s+x.open,0));
 const soon=(x:AgingItem)=>x.daysUntil!=null&&x.daysUntil>=0&&x.daysUntil<=7;
 const dueTotals={receivable:total('Receber'),payable:total('Pagar'),overdueReceive:total('Receber',x=>x.status==='Vencido'),overduePay:total('Pagar',x=>x.status==='Vencido'),next7In:total('Receber',soon),next7Out:total('Pagar',soon)};
 let running=0;
 const series=Array.from({length:30},(_,i)=>{
  const date=dayOffset(today,i);const events=dues.filter(x=>x.dueDate===date);
  const incoming=cents(events.filter(x=>x.type==='Receber').reduce((s,x)=>s+x.open,0)),outgoing=cents(events.filter(x=>x.type==='Pagar').reduce((s,x)=>s+x.open,0));
  const net=cents(incoming-outgoing);running=cents(running+net);return {date,in:incoming,out:outgoing,net,cumulative:running};
 });
 const last90=dayOffset(today,-89);
 const activeSales=sales.filter(o=>inWindow(o.date,last90,today));
 const byProduct=new Map<string,{sold:number;revenue:number}>();
 for(const order of activeSales)for(const line of order.lines){
  const old=byProduct.get(line.productId)||{sold:0,revenue:0};
  old.sold+=numeric(line.quantity);old.revenue+=numeric(line.quantity)*numeric(line.price);byProduct.set(line.productId,old);
 }
 const inventory=data.products.filter(p=>p.workspaceId===workspaceId).map(p=>{
  const last=byProduct.get(p.id)||{sold:0,revenue:0};const stock=numeric(p.stock),min=numeric(p.minimumStock);
  const status:InventoryInsight['status']=!p.active?'Inativo':stock<=0?'Esgotado':min>0&&stock<=min?'Crítico':min>0&&stock<=min*1.5?'Atenção':'Regular';
  const target=min>0?min*2:1;const reorder=p.active&&(status==='Esgotado'||status==='Crítico'||status==='Atenção')?Math.max(0,Math.ceil(target-stock)):0;
  const turnoverDays=last.sold>0?Math.round(stock/(last.sold/90)):null;
  return {product:p,sold:cents(last.sold),revenue:cents(last.revenue),turnoverDays,className:'Sem vendas' as InventoryInsight['className'],reorder,capital:cents(stock*numeric(p.cost)),status};
 }).sort((a,b)=>b.revenue-a.revenue||a.product.title.localeCompare(b.product.title,'pt-BR'));
 const salesValue=inventory.reduce((s,p)=>s+p.revenue,0);let accumulated=0;
 for(const item of inventory)if(salesValue>0&&item.revenue>0){const before=accumulated/salesValue;accumulated+=item.revenue;item.className=before<.8?'A':before<.95?'B':'C';}
 const inventoryTotals={cost:cents(inventory.reduce((s,x)=>s+x.capital,0)),retail:cents(inventory.reduce((s,x)=>s+numeric(x.product.stock)*numeric(x.product.price),0)),atRisk:cents(inventory.filter(x=>x.status==='Crítico'||x.status==='Esgotado').reduce((s,x)=>s+x.revenue,0)),low:inventory.filter(x=>x.status==='Crítico'||x.status==='Atenção'||x.status==='Esgotado').length,zero:inventory.filter(x=>x.status==='Esgotado').length,dead:inventory.filter(x=>x.sold===0&&x.product.active&&x.product.stock>0).length};
 const customerRanks=clients.map(c=>{const history=sales.filter(o=>o.partnerId===c.id);
  return {id:c.id,name:c.title,orders:history.length,amount:cents(history.reduce((s,o)=>s+amount(o),0)),balance:cents(history.reduce((s,o)=>s+rem(amount(o),o.paid),0))};
 }).sort((a,b)=>b.amount-a.amount).slice(0,8);
 const notices:BusinessInsight['notices']=[];
 if(dueTotals.overdueReceive>0)notices.push({severity:'critical',title:'Recebimentos vencidos',description:'Há valores a cobrar fora do prazo.',tab:'financeiro'});
 if(dueTotals.overduePay>0)notices.push({severity:'critical',title:'Pagamentos atrasados',description:'Existem obrigações vencidas.',tab:'financeiro'});
 if(inventoryTotals.zero>0)notices.push({severity:'critical',title:'Produtos esgotados',description:'Confira a lista de reposição.',tab:'estoque'});
 else if(inventoryTotals.low>0)notices.push({severity:'warning',title:'Reposição necessária',description:'Existem produtos próximos ou abaixo do mínimo.',tab:'estoque'});
 if(data.orders.some(o=>o.workspaceId===workspaceId&&o.kind==='Venda'&&o.status==='Rascunho'))notices.push({severity:'info',title:'Vendas em rascunho',description:'Revise e confirme as vendas pendentes.',tab:'vendas'});
 if(data.orders.some(o=>o.workspaceId===workspaceId&&o.kind==='Orçamento'&&o.status==='Rascunho'))notices.push({severity:'info',title:'Orçamentos aguardando',description:'Confira as propostas em aberto.',tab:'orcamentos'});
 return {performance:{revenue,previousRevenue,growth:previousRevenue>0?cents((revenue/previousRevenue-1)*100):null,orders:thisSales.length,averageTicket:thisSales.length?cents(revenue/thisSales.length):0,grossProfit,grossMargin:revenue>0?cents(grossProfit/revenue*100):null,received,paid,netCash:cents(received-paid),customerCount:new Set(thisSales.map(x=>x.partnerId).filter(Boolean)).size},dues,dueTotals,series,inventory,inventoryTotals,customerRanks,notices};
}
