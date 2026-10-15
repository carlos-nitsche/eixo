import {useMemo,useState} from 'react';
import {Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, CalendarClock, ChevronRight, CircleDollarSign, Clock3, Download, Filter, Package, PackageCheck, Plus, Search, ShoppingCart, TrendingDown, TrendingUp, Users, Wallet} from 'lucide-react';
import type {ERPData,ERPProduct} from './erp';
import {dateShort,money} from './erp';
import {buildBusinessInsight} from './business-insights';
import type {BusinessInsight,BusinessPeriod,InventoryInsight} from './business-insights';
import './business-control-center.css';
type View='inteligencia'|'fluxo'|'inventario';
type Props={view:View;data:ERPData;workspaceId:string;clients:{id:string;title:string}[];onNavigate:(id:'financeiro'|'estoque'|'produtos'|'vendas'|'orcamentos'|'compras'|'relatorios'|'clientes')=>void;onNewPurchase:()=>void;onNewBill:()=>void;onAdjust:(product:ERPProduct)=>void;onPayment:(kind:'order'|'bill',id:string)=>void;onCreateProduct:()=>void};
const strip=(x:string)=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const pill=(value:string,kind:'bad'|'warning'|'neutral'|'good'='neutral')=><span className={'boc-pill boc-pill-'+kind}>{value}</span>;
function ExportCSV({name,rows}:{name:string;rows:(string|number)[][]}){
 const save=()=>{
  const quote=(val:string|number)=>{const s=String(val??'');const escaped=/^\s*[=+\-@\t\r]/.test(s)?"'"+s:s;return '"'+escaped.replace(/"/g,'""')+'"';};
  const text='\ufeff'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
  const object=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.download=name+'.csv';a.href=object;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(object),1000);
 };
 return <button className="boc-btn boc-btn-subtle" onClick={save}><Download size={15}/> Exportar CSV</button>;
}
function Stat({label,value,detail,icon:Icon,tone='neutral'}:{label:string;value:string;detail:string;icon:typeof Package;tone?:'neutral'|'good'|'warn'|'bad'}){
 return <article className={'boc-stat boc-stat-'+tone}><div className="boc-stat-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{detail}</small></article>;
}
function Section({heading,caption,action,children}:{heading:string;caption:string;action?:React.ReactNode;children:React.ReactNode}){
 return <section className="boc-section"><header className="boc-section-head"><div><h3>{heading}</h3><p>{caption}</p></div>{action}</header>{children}</section>;
}
const tableStatus=(status:string)=>status==='Vencido'?'bad':status==='Hoje'?'warning':status==='Próximos 7 dias'?'warning':'neutral';
const inventoryTone=(status:InventoryInsight['status'])=>status==='Esgotado'||status==='Crítico'?'bad':status==='Atenção'?'warning':status==='Regular'?'good':'neutral';
function InsightView({insight,period,setPeriod,onNavigate}:{insight:BusinessInsight;period:BusinessPeriod;setPeriod:(n:BusinessPeriod)=>void;onNavigate:Props['onNavigate']}){
 const p=insight.performance;
 const biggest=Math.max(1,...insight.inventory.slice(0,6).map(x=>x.revenue));
 return <div className="boc-layout">
  <div className="boc-heading"><div><span className="boc-eyebrow">PERFORMANCE / VISÃO EXECUTIVA</span><h2>Inteligência de negócios</h2><p>Decisões baseadas em vendas confirmadas e pagamentos registrados, sem estimativas de receita fictícias.</p></div><div className="boc-range" role="group" aria-label="Período de análise">{([7,30,90] as const).map(days=><button key={days} aria-pressed={period===days} className={period===days?'boc-range-active':''} onClick={()=>setPeriod(days)}>{days} dias</button>)}</div></div>
  <div className="boc-stats">
   <Stat label="Vendas confirmadas" value={money(p.revenue)} detail={p.growth===null?'Sem base anterior para comparar':(p.growth>=0?'+':'')+p.growth.toLocaleString('pt-BR')+'% contra o período anterior'} icon={TrendingUp} tone="good"/>
   <Stat label="Ticket médio" value={money(p.averageTicket)} detail={p.orders+' venda(s) no período'} icon={ShoppingCart}/>
   <Stat label="Margem bruta estimada" value={p.grossMargin===null?'—':p.grossMargin.toLocaleString('pt-BR')+'%'} detail={money(p.grossProfit)+' antes de impostos e despesas'} icon={Activity} tone={p.grossProfit<0?'bad':'neutral'}/>
   <Stat label="Entradas – saídas registradas" value={money(p.netCash)} detail={'Recebido '+money(p.received)+' · pago '+money(p.paid)} icon={Wallet} tone={p.netCash>=0?'good':'bad'}/>
  </div>
  <div className="boc-two">
   <Section heading="Central de prioridades" caption="Alertas calculados com os registros da empresa" action={<button className="boc-link" onClick={()=>onNavigate('financeiro')}>Abrir financeiro <ArrowRight size={14}/></button>}>
    <div className="boc-issues">{insight.notices.length?insight.notices.map((notice,i)=><button key={i} className="boc-issue" onClick={()=>onNavigate(notice.tab)}><span className={'boc-issue-icon boc-issue-'+notice.severity}>{notice.severity==='critical'?<AlertTriangle size={18}/>:notice.severity==='warning'?<Package size={18}/>:<Clock3 size={18}/>}</span><span><strong>{notice.title}</strong><small>{notice.description}</small></span><ChevronRight size={17}/></button>):<div className="boc-good"><BadgeCheck size={25}/><strong>Nenhuma pendência crítica</strong><p>Seus controles estão atualizados conforme os dados cadastrados.</p></div>}</div>
   </Section>
   <Section heading="Saúde financeira" caption="Valores em aberto — não representa saldo bancário" action={<button className="boc-link" onClick={()=>onNavigate('financeiro')}>Ver títulos <ArrowRight size={14}/></button>}>
    <div className="boc-health"><div><span>A receber</span><strong>{money(insight.dueTotals.receivable)}</strong><div className="boc-meter"><i style={{width:(insight.dueTotals.receivable/(insight.dueTotals.receivable+insight.dueTotals.payable||1)*100)+'%'}}/></div></div><div><span>A pagar</span><strong>{money(insight.dueTotals.payable)}</strong><div className="boc-meter boc-meter-out"><i style={{width:(insight.dueTotals.payable/(insight.dueTotals.receivable+insight.dueTotals.payable||1)*100)+'%'}}/></div></div><div className="boc-health-foot"><span>Recebíveis vencidos <b>{money(insight.dueTotals.overdueReceive)}</b></span><span>Contas vencidas <b>{money(insight.dueTotals.overduePay)}</b></span></div></div>
   </Section>
  </div>
  <div className="boc-two">
   <Section heading="Produtos que mais faturam" caption="Receita de itens nas vendas confirmadas nos últimos 90 dias" action={<button className="boc-link" onClick={()=>onNavigate('produtos')}>Catálogo <ArrowRight size={14}/></button>}>
    <div className="boc-ranking">{insight.inventory.some(x=>x.revenue>0)?insight.inventory.filter(x=>x.revenue>0).slice(0,6).map((item,i)=><div className="boc-ranking-row" key={item.product.id}><span className="boc-ranking-index">{String(i+1).padStart(2,'0')}</span><div><strong>{item.product.title}</strong><small>{item.sold} {item.product.unit} · Curva {item.className}</small><div className="boc-meter"><i style={{width:Math.max(3,item.revenue/biggest*100)+'%'}}/></div></div><b>{money(item.revenue)}</b></div>):<div className="boc-empty">Os itens vendidos aparecerão aqui após confirmar vendas.</div>}</div>
   </Section>
   <Section heading="Carteira de clientes" caption="Ranking histórico por valor de compras confirmadas" action={<button className="boc-link" onClick={()=>onNavigate('clientes')}>Ver clientes <ArrowRight size={14}/></button>}>
    <div className="boc-ranking">{insight.customerRanks.some(x=>x.amount>0)?insight.customerRanks.filter(x=>x.amount>0).slice(0,6).map((c,i)=><div className="boc-customer" key={c.id}><span className="boc-ranking-index">{String(i+1).padStart(2,'0')}</span><div><strong>{c.name}</strong><small>{c.orders} compra(s) · {money(c.balance)} em aberto</small></div><b>{money(c.amount)}</b></div>):<div className="boc-empty">Vincule clientes às vendas para acompanhar a carteira.</div>}</div>
   </Section>
  </div>
  <p className="boc-disclaimer">Análise gerencial, não contábil. Receita considera vendas confirmadas; margem bruta não inclui impostos, taxas, frete, despesas operacionais nem estornos bancários. Entradas e saídas refletem pagamentos registrados no ERP.</p>
 </div>;
}
function CashView({insight,onNewBill,onPayment}:{insight:BusinessInsight;onNewBill:Props['onNewBill'];onPayment:Props['onPayment']}){
 const [filter,setFilter]=useState<'all'|'receber'|'pagar'|'vencidos'>('all');
 const [search,setSearch]=useState('');
 const due=insight.dues.filter(x=>(filter==='all'||filter==='vencidos'&&x.status==='Vencido'||filter==='receber'&&x.type==='Receber'||filter==='pagar'&&x.type==='Pagar')&&strip(x.title).includes(strip(search)));
 const top=Math.max(1,...insight.series.map(x=>Math.max(x.in,x.out)));
 const net=insight.series.reduce((s,x)=>s+x.net,0);
 return <div className="boc-layout"><div className="boc-heading"><div><span className="boc-eyebrow">TESOURARIA / CONTAS</span><h2>Fluxo de caixa</h2><p>Agenda de obrigações e recebimentos projetados a partir dos títulos em aberto.</p></div><button className="boc-btn boc-btn-primary" onClick={onNewBill}><Plus size={16}/> Nova conta</button></div>
 <div className="boc-stats"><Stat label="A receber" value={money(insight.dueTotals.receivable)} detail="Saldo de vendas e contas" icon={ArrowDownRight}/><Stat label="A pagar" value={money(insight.dueTotals.payable)} detail="Compras e obrigações" icon={ArrowUpRight}/><Stat label="Vencido" value={money(insight.dueTotals.overdueReceive+insight.dueTotals.overduePay)} detail="Recebíveis e despesas atrasadas" icon={AlertTriangle} tone={(insight.dueTotals.overdueReceive+insight.dueTotals.overduePay)>0?'bad':'neutral'}/><Stat label="Projeção líquida 30 dias" value={money(net)} detail="A receber menos a pagar nos próximos 30 dias" icon={CalendarClock} tone={net<0?'bad':'good'}/></div>
 <Section heading="Previsão dos próximos 30 dias" caption="Barras mostram títulos a receber e a pagar por dia; valores não são saldo bancário.">
  <div className="boc-projection-legend"><span><i className="boc-in"/> Entradas previstas</span><span><i className="boc-out"/> Saídas previstas</span></div>
  <div className="boc-timeline" role="img" aria-label="Projeção diária de entradas e saídas para 30 dias">{insight.series.map((item,i)=><div key={item.date} className="boc-day" title={dateShort(item.date)+': entradas '+money(item.in)+'; saídas '+money(item.out)}><div className="boc-day-bars"><span className="boc-bar-in" style={{height:item.in?Math.max(3,item.in/top*100)+'%':'0%'}}/><span className="boc-bar-out" style={{height:item.out?Math.max(3,item.out/top*100)+'%':'0%'}}/></div>{i%5===0&&<small>{dateShort(item.date).slice(0,5)}</small>}</div>)}</div>
 </Section>
 <Section heading="Agenda de vencimentos" caption={insight.dues.length+' títulos em aberto, ordenados por data'} action={<ExportCSV name="eixo-agenda-financeira" rows={[['Descrição','Tipo','Vencimento','Total','Pago','Saldo','Situação'],...insight.dues.map(x=>[x.title,x.type,x.dueDate,x.amount,x.paid,x.open,x.status])]}/>}>
  <div className="boc-filterbar"><div className="boc-chips" role="group" aria-label="Filtrar títulos">{([['all','Todos'],['vencidos','Vencidos'],['receber','A receber'],['pagar','A pagar']] as const).map(([id,text])=><button key={id} className={filter===id?'boc-chip-active':''} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{text}</button>)}</div><label className="boc-search"><Search size={16}/><input aria-label="Buscar título" placeholder="Buscar título..." value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
  {due.length?<div className="boc-table-scroll"><table className="boc-table"><thead><tr><th>Título</th><th>Vencimento</th><th>Tipo</th><th>Saldo</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{due.map(x=><tr key={x.id}><td><strong>{x.title}</strong><small>{money(x.amount)} de valor total</small></td><td>{x.dueDate?dateShort(x.dueDate):'Não definida'}</td><td>{pill(x.type,x.type==='Pagar'?'warning':'good')}</td><td><b>{money(x.open)}</b></td><td>{pill(x.status,tableStatus(x.status))}</td><td><button className="boc-text-button" onClick={()=>onPayment(x.kind,x.sourceId)}>Registrar baixa <ArrowRight size={13}/></button></td></tr>)}</tbody></table></div>:<div className="boc-empty">Nenhum título corresponde aos filtros selecionados.</div>}
 </Section><p className="boc-disclaimer">A projeção usa os vencimentos registrados no EIXO, não saldos de bancos ou extratos. Títulos sem vencimento ficam fora do gráfico, mas permanecem na agenda. Os valores podem mudar conforme pagamentos e alterações dos documentos.</p></div>;
}
function InventoryView({insight,onNavigate,onNewPurchase,onAdjust,onCreateProduct}:{insight:BusinessInsight;onNavigate:Props['onNavigate'];onNewPurchase:Props['onNewPurchase'];onAdjust:Props['onAdjust'];onCreateProduct:Props['onCreateProduct']}){
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'repor'|'abcA'|'semvenda'>('all');
 const items=insight.inventory.filter(x=>(filter==='all'||filter==='repor'&&x.reorder>0||filter==='abcA'&&x.className==='A'||filter==='semvenda'&&x.sold===0&&x.product.stock>0)&&strip(x.product.title+' '+x.product.sku+' '+x.product.category).includes(strip(search)));
 const suggestions=insight.inventory.filter(x=>x.reorder>0);
 return <div className="boc-layout"><div className="boc-heading"><div><span className="boc-eyebrow">SUPRIMENTOS / INTELIGÊNCIA</span><h2>Inventário inteligente</h2><p>Curva ABC, capital investido, giro de produtos e sugestões de reposição.</p></div><div className="boc-head-buttons"><button className="boc-btn boc-btn-subtle" onClick={onCreateProduct}><Plus size={15}/> Produto</button><button className="boc-btn boc-btn-primary" onClick={onNewPurchase}><ShoppingCart size={15}/> Nova compra</button></div></div>
 <div className="boc-stats"><Stat label="Capital em estoque" value={money(insight.inventoryTotals.cost)} detail="Quantidade × custo de aquisição" icon={Wallet}/><Stat label="Valor potencial de venda" value={money(insight.inventoryTotals.retail)} detail="Quantidade × preço atual" icon={CircleDollarSign}/><Stat label="Produtos para repor" value={String(insight.inventoryTotals.low)} detail={insight.inventoryTotals.zero+' sem saldo disponível'} icon={PackageCheck} tone={insight.inventoryTotals.low?'warn':'good'}/><Stat label="Sem saída em 90 dias" value={String(insight.inventoryTotals.dead)} detail="Itens ativos com estoque e sem vendas" icon={Clock3}/></div>
 <Section heading="Plano de reposição" caption="Sugestão gerencial: repor até duas vezes o estoque mínimo; quando o mínimo é zero, sugerir 1 unidade" action={<button className="boc-link" onClick={()=>onNavigate('compras')}>Compras <ArrowRight size={14}/></button>}>
  {suggestions.length?<div className="boc-replenish">{suggestions.slice(0,8).map(item=><div className="boc-replenish-row" key={item.product.id}><div><strong>{item.product.title}</strong><small>{item.product.stock} {item.product.unit} em estoque · mínimo {item.product.minimumStock} · {pill(item.status,inventoryTone(item.status))}</small></div><b>+{item.reorder} {item.product.unit}</b><button className="boc-text-button" onClick={()=>onAdjust(item.product)}>Ajustar <ChevronRight size={14}/></button></div>)}</div>:<div className="boc-good"><BadgeCheck size={23}/><strong>Nenhuma reposição imediata</strong><p>Os produtos ativos estão acima do ponto de atenção configurado.</p></div>}
  <p className="boc-inline-disclaimer">Quantidade sugerida não é pedido automático. Ao receber mercadorias, registre uma compra; ajuste manual serve para corrigir divergências verificadas.</p>
 </Section>
 <Section heading="Análise de catálogo" caption="Curva ABC baseada no valor dos itens vendidos nos últimos 90 dias" action={<ExportCSV name="eixo-inventario-inteligente" rows={[['Produto','SKU','Classe ABC','Saldo','Mínimo','Sugestão','Custo','Preço','Unidades vendidas 90d','Receita 90d','Dias de cobertura estimados'],...insight.inventory.map(x=>[x.product.title,x.product.sku,x.className,x.product.stock,x.product.minimumStock,x.reorder,x.product.cost,x.product.price,x.sold,x.revenue,x.turnoverDays??'Sem giro'])]}/>}>
  <div className="boc-filterbar"><div className="boc-chips" role="group" aria-label="Filtrar inventário">{([['all','Todos'],['repor','Repor'],['abcA','Classe A'],['semvenda','Sem vendas']] as const).map(([id,label])=><button key={id} aria-pressed={filter===id} className={filter===id?'boc-chip-active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><label className="boc-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="Buscar produto no inventário" placeholder="Produto, SKU, categoria..."/></label></div>
  {items.length?<div className="boc-table-scroll"><table className="boc-table"><thead><tr><th>Produto</th><th>Classe</th><th>Estoque</th><th>Vendidas / 90d</th><th>Receita / 90d</th><th>Cobertura</th><th>Operação</th></tr></thead><tbody>{items.map(x=><tr key={x.product.id}><td><strong>{x.product.title}</strong><small>SKU {x.product.sku} · {x.product.category||'Sem categoria'}</small></td><td>{pill(x.className,x.className==='A'?'good':'neutral')}</td><td>{pill(x.product.stock+' '+x.product.unit,inventoryTone(x.status))}<small>{x.status}</small></td><td>{x.sold} {x.product.unit}</td><td><b>{money(x.revenue)}</b></td><td>{x.turnoverDays===null?'Sem giro':x.turnoverDays+' dias'}</td><td><button className="boc-text-button" onClick={()=>onAdjust(x.product)}>Ajustar <ChevronRight size={14}/></button></td></tr>)}</tbody></table></div>:<div className="boc-empty">Nenhum produto atende aos filtros. <button onClick={onCreateProduct}>Criar produto</button></div>}
 </Section><p className="boc-disclaimer">Curva ABC: A representa aproximadamente os primeiros 80% da receita de itens, B os próximos 15% e C os demais 5%. Sem vendas permanece sem classificação. Estimativa de cobertura usa média simples de vendas dos últimos 90 dias, não representa previsão de demanda nem autoriza ajuste automático.</p></div>;
}
export default function BusinessControlCenter({view,data,workspaceId,clients,onNavigate,onNewPurchase,onNewBill,onAdjust,onPayment,onCreateProduct}:Props){
 const [period,setPeriod]=useState<BusinessPeriod>(30);
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const insight=useMemo(()=>buildBusinessInsight(data,workspaceId,clients,today,period),[data,workspaceId,clients,today,period]);
 return view==='inteligencia'?<InsightView insight={insight} period={period} setPeriod={setPeriod} onNavigate={onNavigate}/>:view==='fluxo'?<CashView insight={insight} onNewBill={onNewBill} onPayment={onPayment}/>:<InventoryView insight={insight} onNavigate={onNavigate} onNewPurchase={onNewPurchase} onAdjust={onAdjust} onCreateProduct={onCreateProduct}/>;
}
