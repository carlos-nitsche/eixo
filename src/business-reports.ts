import type {ERPData,ERPOrder,ERPProduct,ERPBill} from './erp';
import {orderTotal,orderCost,openAmount,withWorkspace} from './erp.ts';
export type ReportId='vendas'|'vendas-mensais'|'vendas-pagamento'|'margens'|'produtos-vendidos'|'orcamentos'|'clientes'|'compras'|'fornecedores'|'estoque'|'reposicao'|'movimentos'|'receber'|'pagar'|'inadimplencia'|'fluxo'|'previsao';
export type ReportSection='Comercial'|'Financeiro'|'Estoque'|'Relacionamento';
export type ReportColumn={key:string;label:string;kind?:'currency'|'number'|'date'|'percent'|'text'};
export type ReportCell=string|number;
export type ReportRow={id:string;cells:ReportCell[]};
export type ReportKpi={label:string;value:number;kind?:'currency'|'number'|'percent';note?:string};
export type ReportTrend={label:string;value:number;second?:number};
export type ReportResult={id:ReportId;title:string;subtitle:string;section:ReportSection;periodType:'period'|'snapshot'|'due';columns:ReportColumn[];rows:ReportRow[];kpis:ReportKpi[];trend:ReportTrend[];note:string;from:string;to:string;workspaceId:string};
type CatalogEntry={id:ReportId;title:string;description:string;section:ReportSection;periodType:'period'|'snapshot'|'due'};
export const reportCatalog:CatalogEntry[]=[
{id:'vendas',title:'Vendas detalhadas',description:'Documentos, clientes, valores, saldo e recebimentos',section:'Comercial',periodType:'period'},
{id:'vendas-mensais',title:'Evolução de faturamento',description:'Receita, custos e margem por mês',section:'Comercial',periodType:'period'},
{id:'vendas-pagamento',title:'Vendas por forma de pagamento',description:'Mix de pagamentos declarado na venda',section:'Comercial',periodType:'period'},
{id:'margens',title:'Rentabilidade dos produtos',description:'Receita líquida de desconto, custo e margem estimada',section:'Comercial',periodType:'period'},
{id:'produtos-vendidos',title:'Produtos mais vendidos',description:'Quantidade, receita e participação por item',section:'Comercial',periodType:'period'},
{id:'orcamentos',title:'Orçamentos e conversão',description:'Propostas emitidas, abertas e canceladas',section:'Comercial',periodType:'period'},
{id:'clientes',title:'Desempenho por cliente',description:'Receita por cliente, frequência e ticket médio',section:'Relacionamento',periodType:'period'},
{id:'compras',title:'Compras recebidas',description:'Aquisições de fornecedores e valores pendentes',section:'Relacionamento',periodType:'period'},
{id:'fornecedores',title:'Ranking de fornecedores',description:'Fornecedores por volume de compras recebidas',section:'Relacionamento',periodType:'period'},
{id:'estoque',title:'Posição atual do estoque',description:'Saldo físico registrado, custo e preço potencial',section:'Estoque',periodType:'snapshot'},
{id:'reposicao',title:'Necessidade de reposição',description:'Estoque mínimo, ruptura e sugestão de compra',section:'Estoque',periodType:'snapshot'},
{id:'movimentos',title:'Livro de movimentações',description:'Entradas, saídas e ajustes com motivo e data',section:'Estoque',periodType:'period'},
{id:'receber',title:'Contas a receber',description:'Títulos, parcelas e recebíveis em aberto',section:'Financeiro',periodType:'due'},
{id:'pagar',title:'Contas a pagar',description:'Obrigações pendentes, fornecedores e contas',section:'Financeiro',periodType:'due'},
{id:'inadimplencia',title:'Inadimplência e vencimentos',description:'Análise de atraso por faixa de dias',section:'Financeiro',periodType:'snapshot'},
{id:'fluxo',title:'Fluxo de caixa realizado',description:'Entradas e saídas de pagamentos registrados',section:'Financeiro',periodType:'period'},
{id:'previsao',title:'Fluxo de caixa previsto',description:'Projeção de contas abertas por data de vencimento',section:'Financeiro',periodType:'due'}
];
const real=(n:unknown)=>Number.isFinite(Number(n))?Number(n):0;
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const safeDay=(x:string)=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(Date.parse(x+'T12:00:00Z')).toISOString().slice(0,10)===x;
const between=(v:string,from:string,to:string)=>safeDay(v)&&v>=from&&v<=to;
const kpi=(label:string,value:number,kind:ReportKpi['kind']='currency',note=''):ReportKpi=>({label,value:round(value),kind,note});
const col=(...defs:[string,ReportColumn['kind']][]):ReportColumn[]=>defs.map(([label,kind],i)=>({key:String(i),label,kind:kind||'text'}));
const sum=(values:number[])=>round(values.reduce((a,b)=>a+real(b),0));
const titleOr=(s:string|undefined,fallback:string)=>String(s||fallback).trim()||fallback;
const orderStatus=(o:ERPOrder)=>o.kind==='Venda'&&o.status==='Confirmada'||o.kind==='Compra'&&o.status==='Recebida';
const validOpen=(o:ERPOrder)=>orderStatus(o);
const sortRows=(rows:ReportRow[],numericCol:number)=>rows.sort((a,b)=>real(b.cells[numericCol])-real(a.cells[numericCol])||a.id.localeCompare(b.id));
type Due={id:string;title:string;type:'Receber'|'Pagar';due:string;origin:string;total:number;paid:number;balance:number};
export function buildOpenDues(data:ERPData,workspaceId:string):Due[]{
 const scope=withWorkspace(data,workspaceId);const entries:Due[]=[];
 for(const o of scope.orders.filter(validOpen)){
  const type:oType = o.kind==='Compra'?'Pagar':'Receber';
  if(o.kind==='Venda'&&o.installments?.length){
   for(const i of o.installments)entries.push({id:o.id+':'+i.id,title:o.number+' · '+titleOr(o.partnerName,'Consumidor final')+' · '+i.label,type,due:i.dueDate||o.dueDate,origin:o.number,total:real(i.amount),paid:real(i.paid),balance:round(Math.max(0,real(i.amount)-real(i.paid)))});
  }else entries.push({id:o.id,title:o.number+' · '+titleOr(o.partnerName,o.kind==='Compra'?'Fornecedor não informado':'Consumidor final'),type,due:o.dueDate,origin:o.number,total:orderTotal(o),paid:real(o.paid),balance:openAmount(o)});
 }
 for(const b of scope.bills)entries.push({id:b.id,title:b.title,type:b.type,due:b.dueDate,origin:'Conta manual · '+b.category,total:real(b.amount),paid:real(b.paid),balance:round(Math.max(0,real(b.amount)-real(b.paid)))});
 return entries.filter(x=>x.balance>.005).sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
}
type oType='Receber'|'Pagar';
export type BusinessReportInput={data:ERPData;workspaceId:string;clients:{id:string;title:string}[];from:string;to:string;today:string;id:ReportId};
export function buildBusinessReport({data,workspaceId,clients,from,to,today,id}:BusinessReportInput):ReportResult{
 if(!workspaceId||!safeDay(from)||!safeDay(to)||!safeDay(today)||from>to)throw Error('Período inválido para relatório.');
 const def=reportCatalog.find(x=>x.id===id);if(!def)throw Error('Tipo de relatório não encontrado.');
 const scope=withWorkspace(data,workspaceId),orders=scope.orders.filter(o=>between(o.date,from,to));
 const sales=orders.filter(o=>o.kind==='Venda'&&o.status==='Confirmada');
 const purchases=orders.filter(o=>o.kind==='Compra'&&o.status==='Recebida');
 const dues=buildOpenDues(data,workspaceId),selectedDues=dues.filter(x=>between(x.due,from,to));
 const paymentRecords=scope.payments.filter(p=>between(p.date,from,to));
 const revenue=sum(sales.map(orderTotal)),cogs=sum(sales.map(orderCost));
 const dateCols=[['Data','date'],['Documento','text']];
 let columns:ReportColumn[]=[],rows:ReportRow[]=[],kpis:ReportKpi[]=[],trend:ReportTrend[]=[];
 let note='Relatório gerencial baseado nos registros empresariais do EIXO. Não é documento fiscal.';
 const row=(rid:string,...cells:ReportCell[]):ReportRow=>({id:rid,cells});
 const agg=(items:{id:string;title:string;amount:number;count:number;cost:number}[])=>items;
 const grouped=(values:{id:string;title:string;amount:number;count:number;cost:number}[])=>{
  const m=new Map<string,typeof values[number]>();
  for(const x of values){const p=m.get(x.id)||{...x,amount:0,count:0,cost:0};p.amount+=x.amount;p.count+=x.count;p.cost+=x.cost;m.set(x.id,p)}
  return [...m.values()];
 };
 const saleLines=sales.flatMap(o=>{
  const subtotal=sum(o.lines.map(l=>real(l.price)*real(l.quantity)));
  const discountFactor=subtotal>0?Math.max(0,(subtotal-real(o.discount))/subtotal):0;
  return o.lines.map(l=>({order:o,productId:l.productId,title:l.title,sku:l.sku,category:scope.products.find(p=>p.id===l.productId)?.category||'',qty:real(l.quantity),netSales:round(real(l.price)*real(l.quantity)*discountFactor),cost:round(real(l.cost)*real(l.quantity))}));
 });
 if(id==='vendas'){
  columns=col(['Data','date'],['Documento','text'],['Cliente','text'],['Pagamento','text'],['Itens','number'],['Total','currency'],['Recebido','currency'],['Saldo','currency']);
  rows=sales.map(o=>row(o.id,o.date,o.number,titleOr(o.partnerName,'Consumidor final'),o.paymentMethod,o.lines.reduce((n,l)=>n+real(l.quantity),0),orderTotal(o),real(o.paid),openAmount(o))).sort((a,b)=>String(b.cells[0]).localeCompare(String(a.cells[0])));
  kpis=[kpi('Faturamento',revenue),kpi('Vendas confirmadas',sales.length,'number'),kpi('Ticket médio',sales.length?revenue/sales.length:0),kpi('A receber nessas vendas',sum(sales.map(openAmount)))];
  note+=' Inclui apenas vendas confirmadas na data de emissão, exclui canceladas e rascunhos.';
 }else if(id==='vendas-mensais'){
  columns=col(['Competência','text'],['Vendas','number'],['Receita','currency'],['CMV estimado','currency'],['Margem bruta','currency'],['Margem %','percent']);
  const keys=[...new Set(sales.map(o=>o.date.slice(0,7)))].sort();
  rows=keys.map(key=>{const o=sales.filter(x=>x.date.startsWith(key));const rev=sum(o.map(orderTotal)),cost=sum(o.map(orderCost));return row(key,key,o.length,rev,cost,round(rev-cost),rev?round((rev-cost)/rev*100):0)});
  trend=rows.map(x=>({label:String(x.cells[0]),value:real(x.cells[2]),second:real(x.cells[3])}));
  kpis=[kpi('Faturamento',revenue),kpi('Custo das mercadorias',cogs),kpi('Resultado bruto',revenue-cogs),kpi('Margem estimada',revenue?(revenue-cogs)/revenue*100:0,'percent')];
  note+=' Margem estimada não considera impostos, taxas, despesas operacionais ou custos logísticos adicionais.';
 }else if(id==='vendas-pagamento'){
  columns=col(['Forma de pagamento','text'],['Quantidade','number'],['Valor das vendas','currency'],['Participação','percent'],['Saldo em aberto','currency']);
  const methods=[...new Set(sales.map(o=>o.paymentMethod||'Não informado'))].sort();
  rows=methods.map(m=>{const o=sales.filter(x=>(x.paymentMethod||'Não informado')===m);const amt=sum(o.map(orderTotal));return row(m,m,o.length,amt,revenue?round(amt/revenue*100):0,sum(o.map(openAmount)))});
  sortRows(rows,2);trend=rows.slice(0,8).map(x=>({label:String(x.cells[0]),value:real(x.cells[2])}));
  kpis=[kpi('Valor de vendas',revenue),kpi('Modalidades',rows.length,'number'),kpi('Vendas',sales.length,'number')];
  note+=' Classifica pela forma informada no documento, não equivale às modalidades efetivamente conciliadas em bancos.';
 }else if(id==='margens'||id==='produtos-vendidos'){
  const groups=grouped(saleLines.map(l=>({id:l.productId||l.sku,title:l.title,amount:l.netSales,count:l.qty,cost:l.cost})));
  const totalProductRevenue=sum(groups.map(g=>g.amount));
  if(id==='margens'){
   columns=col(['Produto','text'],['Unidades','number'],['Receita itens','currency'],['Custo itens','currency'],['Lucro bruto estimado','currency'],['Margem %','percent']);
   rows=groups.map(x=>row(x.id,x.title,round(x.count),round(x.amount),round(x.cost),round(x.amount-x.cost),x.amount?round((x.amount-x.cost)/x.amount*100):0));
   sortRows(rows,4);kpis=[kpi('Receita de itens',totalProductRevenue),kpi('Custos de itens',sum(groups.map(x=>x.cost))),kpi('Lucro bruto de itens',sum(groups.map(x=>x.amount-x.cost))),kpi('Produtos vendidos',groups.length,'number')];
  }else{
   columns=col(['Produto','text'],['Unidades','number'],['Receita itens','currency'],['Participação','percent'],['Custo itens','currency']);
   rows=groups.map(x=>row(x.id,x.title,round(x.count),round(x.amount),totalProductRevenue?round(x.amount/totalProductRevenue*100):0,round(x.cost)));
   sortRows(rows,2);trend=rows.slice(0,10).map(x=>({label:String(x.cells[0]),value:real(x.cells[2])}));
   kpis=[kpi('Receita de itens',totalProductRevenue),kpi('Unidades',sum(groups.map(x=>x.count)),'number'),kpi('Produtos vendidos',groups.length,'number')];
  }
  note+=' Receita de itens distribui descontos proporcionalmente, exclui fretes. CMV usa custo registrado nas linhas das vendas, não substitui contabilidade.';
 }else if(id==='orcamentos'){
  columns=col(['Emissão','date'],['Orçamento','text'],['Cliente','text'],['Situação','text'],['Total','currency'],['Itens','number']);
  const list=orders.filter(o=>o.kind==='Orçamento');
  rows=list.map(o=>row(o.id,o.date,o.number,titleOr(o.partnerName,'Sem cliente'),o.status,orderTotal(o),o.lines.length)).sort((a,b)=>String(b.cells[0]).localeCompare(String(a.cells[0])));
  kpis=[kpi('Valor orçado',sum(list.map(orderTotal))),kpi('Orçamentos',list.length,'number'),kpi('Em aberto',list.filter(x=>x.status==='Rascunho').length,'number'),kpi('Cancelados',list.filter(x=>x.status==='Cancelada').length,'number')];
  note+=' Não calcula taxa de conversão sem vínculo explícito entre orçamento e venda. Rascunhos não são faturamento.';
 }else if(id==='clientes'){
  columns=col(['Cliente','text'],['Vendas','number'],['Faturamento','currency'],['Ticket médio','currency'],['Saldo aberto','currency'],['Última venda','date']);
  const known=new Map(clients.map(c=>[c.id,c.title]));const groups=new Map<string,ERPOrder[]>();
  for(const o of sales){const key=o.partnerId||'__sem_cliente';groups.set(key,[...(groups.get(key)||[]),o])}
  rows=[...groups.entries()].map(([key,list])=>{const rev=sum(list.map(orderTotal));return row(key,titleOr(known.get(key)||list[0]?.partnerName,key==='__sem_cliente'?'Consumidor final':'Cliente'),list.length,rev,round(rev/list.length),sum(list.map(openAmount)),[...list].map(o=>o.date).sort().at(-1)||'')});
  sortRows(rows,2);trend=rows.slice(0,10).map(x=>({label:String(x.cells[0]),value:real(x.cells[2])}));
  kpis=[kpi('Faturamento',revenue),kpi('Clientes compradores',rows.length,'number'),kpi('Ticket médio',sales.length?revenue/sales.length:0)];
  note+=' Consumidor final sem cadastro é agrupado em uma linha. Apenas vendas confirmadas no período.';
 }else if(id==='compras'){
  columns=col(['Data','date'],['Documento','text'],['Fornecedor','text'],['Total','currency'],['Pago','currency'],['Em aberto','currency'],['Itens','number']);
  rows=purchases.map(o=>row(o.id,o.date,o.number,titleOr(o.partnerName,'Fornecedor não informado'),orderTotal(o),real(o.paid),openAmount(o),o.lines.length)).sort((a,b)=>String(b.cells[0]).localeCompare(String(a.cells[0])));
  kpis=[kpi('Compras recebidas',sum(purchases.map(orderTotal))),kpi('Documentos',purchases.length,'number'),kpi('Saldo a pagar',sum(purchases.map(openAmount)))];
  note+=' Considera compras efetivamente recebidas, não pedidos em rascunho.';
 }else if(id==='fornecedores'){
  columns=col(['Fornecedor','text'],['Compras','number'],['Total comprado','currency'],['Pago','currency'],['A pagar','currency']);
  const groups=new Map<string,ERPOrder[]>();
  for(const o of purchases){const k=o.partnerId||o.partnerName||'__sem_fornecedor';groups.set(k,[...(groups.get(k)||[]),o])}
  rows=[...groups.entries()].map(([key,list])=>row(key,titleOr(list[0]?.partnerName,'Fornecedor não informado'),list.length,sum(list.map(orderTotal)),sum(list.map(o=>real(o.paid))),sum(list.map(openAmount))));
  sortRows(rows,2);trend=rows.slice(0,8).map(x=>({label:String(x.cells[0]),value:real(x.cells[2])}));
  kpis=[kpi('Total de compras',sum(purchases.map(orderTotal))),kpi('Fornecedores',rows.length,'number'),kpi('Saldo pendente',sum(purchases.map(openAmount)))];
  note+=' Usa fornecedor indicado nas compras recebidas. Pagamentos informados no ERP, sem conciliação bancária.';
 }else if(id==='estoque'||id==='reposicao'){
  const snapshot=scope.products;
  if(id==='estoque'){
   columns=col(['Produto','text'],['SKU','text'],['Categoria','text'],['Disponível','number'],['Mínimo','number'],['Custo unit.','currency'],['Total custo','currency'],['Valor potencial','currency']);
   rows=snapshot.map(p=>row(p.id,p.title,p.sku,p.category||'—',real(p.stock),real(p.minimumStock),real(p.cost),round(real(p.stock)*real(p.cost)),round(real(p.stock)*real(p.price)))).sort((a,b)=>String(a.cells[0]).localeCompare(String(b.cells[0])));
   kpis=[kpi('Capital em estoque',sum(snapshot.map(p=>real(p.stock)*real(p.cost)))),kpi('Valor potencial',sum(snapshot.map(p=>real(p.stock)*real(p.price)))),kpi('SKUs',snapshot.length,'number'),kpi('Estoque zerado',snapshot.filter(p=>p.active&&real(p.stock)<=0).length,'number')];
   note+=' Fotografia do estoque ATUAL, não histórica. Valor potencial não representa faturamento realizado.';
  }else{
   const low=snapshot.filter(p=>p.active&&real(p.stock)<=real(p.minimumStock));
   columns=col(['Produto','text'],['SKU','text'],['Saldo','number'],['Mínimo','number'],['Repor sugestão','number'],['Custo reposição','currency'],['Prioridade','text']);
   rows=low.map(p=>{const needed=Math.max(0,Math.ceil(Math.max(1,real(p.minimumStock)*2)-real(p.stock)));return row(p.id,p.title,p.sku,real(p.stock),real(p.minimumStock),needed,round(needed*real(p.cost)),real(p.stock)<=0?'Ruptura':'Crítico')});
   rows.sort((a,b)=>String(a.cells[6]).localeCompare(String(b.cells[6]))||String(a.cells[0]).localeCompare(String(b.cells[0])));
   kpis=[kpi('Itens a repor',rows.length,'number'),kpi('Unidades sugeridas',sum(rows.map(x=>real(x.cells[4]))),'number'),kpi('Custo estimado',sum(rows.map(x=>real(x.cells[5])))),kpi('Rupturas',rows.filter(x=>x.cells[6]==='Ruptura').length,'number')];
   note+=' Sugestão gerencial baseada em duas vezes o estoque mínimo (mínimo zero: 1 unidade); não cria compras nem movimenta estoque.';
  }
 }else if(id==='movimentos'){
  const entries=scope.movements.filter(m=>between(m.date,from,to));
  columns=col(['Data','date'],['Produto','text'],['Movimento','text'],['Quantidade','number'],['Motivo','text'],['Pedido','text']);
  rows=entries.map(m=>row(m.id,m.date,m.productTitle,real(m.delta)>0?'Entrada':'Saída',real(m.delta),m.reason,m.orderId||'—')).sort((a,b)=>String(b.cells[0]).localeCompare(String(a.cells[0])));
  kpis=[kpi('Movimentações',entries.length,'number'),kpi('Entradas',sum(entries.filter(x=>x.delta>0).map(x=>x.delta)),'number'),kpi('Saídas',sum(entries.filter(x=>x.delta<0).map(x=>Math.abs(x.delta))),'number')];
  note+=' Apresenta quantidade física (sem valoração histórica) registrada nas movimentações, incluindo ajustes.';
 }else if(id==='receber'||id==='pagar'){
  const type=id==='receber'?'Receber':'Pagar';const entries=selectedDues.filter(x=>x.type===type);
  columns=col(['Vencimento','date'],['Título','text'],['Documento/Origem','text'],['Total','currency'],['Já liquidado','currency'],['Saldo aberto','currency'],['Atraso (dias)','number']);
  rows=entries.map(x=>row(x.id,x.due,x.title,x.origin,x.total,x.paid,x.balance,safeDay(x.due)?Math.max(0,Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(x.due+'T12:00:00Z'))/86400000)):0));
  kpis=[kpi('Saldo em aberto',sum(entries.map(x=>x.balance))),kpi('Títulos',entries.length,'number'),kpi('Vencidos',sum(entries.filter(x=>x.due<today).map(x=>x.balance))),kpi('Quitado parcialmente',sum(entries.filter(x=>x.paid>0).map(x=>x.paid)))];
  note+=' Filtrado pela DATA DE VENCIMENTO; parcelas são listadas separadamente, sem duplicar o total das vendas. Títulos quitados não aparecem.';
 }else if(id==='inadimplencia'){
  const late=dues.filter(x=>safeDay(x.due)&&x.due<today);
  const time=(x:Due)=>Math.max(0,Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(x.due+'T12:00:00Z'))/86400000));
  columns=col(['Vencimento','date'],['Título','text'],['Tipo','text'],['Faixa atraso','text'],['Dias','number'],['Saldo vencido','currency']);
  rows=late.map(x=>{const days=time(x);const band=days<=7?'01–07 dias':days<=30?'08–30 dias':days<=60?'31–60 dias':days<=90?'61–90 dias':'Mais de 90 dias';return row(x.id,x.due,x.title,x.type,band,days,x.balance)}).sort((a,b)=>real(b.cells[4])-real(a.cells[4]));
  kpis=[kpi('Valores vencidos',sum(late.map(x=>x.balance))),kpi('Títulos vencidos',late.length,'number'),kpi('A receber vencido',sum(late.filter(x=>x.type==='Receber').map(x=>x.balance))),kpi('A pagar vencido',sum(late.filter(x=>x.type==='Pagar').map(x=>x.balance)))];
  const bands=['01–07 dias','08–30 dias','31–60 dias','61–90 dias','Mais de 90 dias'];
  trend=bands.map(label=>({label,value:sum(rows.filter(x=>x.cells[3]===label).map(x=>real(x.cells[5])))}));
  note+=' Fotografia da inadimplência atual, não histórica. Inclui obrigações a pagar vencidas e recebíveis vencidos; não é exclusivamente cobrança de clientes.';
 }else if(id==='fluxo'){
  columns=col(['Data','date'],['Descrição','text'],['Natureza','text'],['Valor','currency'],['Origem','text']);
  rows=paymentRecords.map(p=>row(p.id,p.date,p.description,p.direction,round(p.amount),p.sourceType==='bill'?'Conta manual':'Documento comercial')).sort((a,b)=>String(b.cells[0]).localeCompare(String(a.cells[0])));
  const incoming=sum(paymentRecords.filter(x=>x.direction==='Entrada').map(x=>x.amount));
  const outgoing=sum(paymentRecords.filter(x=>x.direction==='Saída').map(x=>x.amount));
  kpis=[kpi('Entradas realizadas',incoming),kpi('Saídas realizadas',outgoing),kpi('Saldo líquido registrado',incoming-outgoing),kpi('Movimentações',rows.length,'number')];
  const days=[...new Set(paymentRecords.map(x=>x.date))].sort();
  trend=days.map(day=>({label:day,value:sum(paymentRecords.filter(x=>x.date===day&&x.direction==='Entrada').map(x=>x.amount)),second:sum(paymentRecords.filter(x=>x.date===day&&x.direction==='Saída').map(x=>x.amount))}));
  note+=' Usa somente pagamentos efetivamente registrados no ERP. NÃO representa saldo de contas bancárias nem inclui operações sem baixa.';
 }else if(id==='previsao'){
  columns=col(['Vencimento','date'],['Título','text'],['Natureza','text'],['Saldo previsto','currency'],['Documento/Origem','text']);
  rows=selectedDues.map(x=>row(x.id,x.due,x.title,x.type,round(x.balance),x.origin));
  const recv=sum(selectedDues.filter(x=>x.type==='Receber').map(x=>x.balance));
  const pay=sum(selectedDues.filter(x=>x.type==='Pagar').map(x=>x.balance));
  kpis=[kpi('Entradas previstas',recv),kpi('Saídas previstas',pay),kpi('Resultado projetado',recv-pay),kpi('Títulos pendentes',rows.length,'number')];
  const days=[...new Set(selectedDues.map(x=>x.due))].filter(safeDay).sort();
  trend=days.map(day=>({label:day,value:sum(selectedDues.filter(x=>x.due===day&&x.type==='Receber').map(x=>x.balance)),second:sum(selectedDues.filter(x=>x.due===day&&x.type==='Pagar').map(x=>x.balance))}));
  note+=' Estimativa de vencimentos futuros e passados no intervalo filtrado; não é previsão de recebimento efetivo ou saldo bancário.';
 }
 return {id,title:def.title,subtitle:def.description,section:def.section,periodType:def.periodType,columns,rows,kpis,trend,note,from,to,workspaceId};
}
