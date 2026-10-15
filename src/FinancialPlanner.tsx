// EIXO OS — React 19 / TypeScript — financial budgets and secure CSV export.
import {useMemo,useState} from 'react';
import type {Dispatch,SetStateAction,FormEvent} from 'react';
import {ArrowDownToLine,CalendarDays,Check,ChevronDown,Plus,Trash2,TrendingDown,Wallet} from 'lucide-react';
import type {Store,Entry} from './model';
import {config,formatMoney,today} from './model';
import {normalizeBudgets,monthlyPosition,transactionCsv} from './financial-planning';
import './financial-planner.css';

type Props={store:Store;setStore:Dispatch<SetStateAction<Store>>;workspaceId:string;entries:Entry[];onAddTransaction:()=>void};
const validAmount=(raw:string)=>Number.isFinite(Number(raw))&&Number(raw)>0&&Number(raw)<=100000000;
const download=(content:string,filename:string)=>{
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),3000);
};
export default function FinancialPlanner({store,setStore,workspaceId,entries,onAddTransaction}:Props){
 const [month,setMonth]=useState(today().slice(0,7));
 const [category,setCategory]=useState('');
 const [amount,setAmount]=useState('');
 const [message,setMessage]=useState('');
 const budgets=useMemo(()=>normalizeBudgets(store.budgets),[store.budgets]);
 const metrics=useMemo(()=>monthlyPosition(entries,budgets,workspaceId,month),[entries,budgets,workspaceId,month]);
 const current=budgets.filter(x=>x.workspaceId===workspaceId&&x.month===month);
 const knownCategories=config.transactions.fields.find(x=>x.key==='category')?.options||[];
 const categories=Array.from(new Set([...knownCategories,...entries.filter(x=>x.type==='Despesa').map(x=>String(x.category||'Outros'))].filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const addBudget=(event:FormEvent)=>{
  event.preventDefault();setMessage('');
  if(!category.trim()||!validAmount(amount)){setMessage('Informe categoria e limite maior que zero.');return}
  const amountNumber=Math.round(Number(amount)*100)/100;
  const existing=budgets.find(b=>b.workspaceId===workspaceId&&b.month===month&&b.category.toLocaleLowerCase('pt-BR')===category.toLocaleLowerCase('pt-BR'));
  const record={id:existing?.id||crypto.randomUUID(),workspaceId,month,category,limit:amountNumber};
  setStore(prev=>({...prev,budgets:normalizeBudgets([...(prev.budgets||[]).filter(b=>b.id!==existing?.id),record])}));
  setAmount('');setMessage(existing?'Limite atualizado.':'Limite adicionado.');
 };
 const deleteBudget=(id:string,label:string)=>{
  if(!window.confirm('Remover o limite de '+label+' deste mês? Seus lançamentos financeiros não serão apagados.'))return;
  setStore(prev=>({...prev,budgets:(prev.budgets||[]).filter(b=>b.id!==id)}));
  setMessage('Limite removido; lançamentos preservados.');
 };
 const exportCsv=()=>{
  const csv=transactionCsv(entries,workspaceId,month);
  download(csv,'eixo-financeiro-'+month+'.csv');
  setMessage('CSV do mês exportado. Nenhum outro espaço foi incluído.');
 };
 const spentPct=metrics.budgetTotal>0?Math.min(100,Math.round(100*metrics.budgetSpent/metrics.budgetTotal)):0;
 return <section className="financial-planner panel" aria-label="Planejamento financeiro mensal">
  <header className="panel-head financial-planner-head"><div><span className="financial-planner-eyebrow"><Wallet size={14}/> PLANEJAMENTO MENSAL</span><h3>Orçamentos por categoria</h3><p>Defina limites e acompanhe quanto cada categoria consumiu.</p></div>
   <div className="financial-planner-actions"><label className="finance-month"><CalendarDays size={15}/><span className="sr-only">Mês de referência</span><input aria-label="Mês de referência" type="month" value={month} min="2020-01" max="2100-12" onChange={e=>{if(/^\d{4}-(?:0[1-9]|1[0-2])$/.test(e.target.value)){setMonth(e.target.value);setMessage('')}}}/></label><button type="button" className="btn light" onClick={exportCsv}><ArrowDownToLine size={16}/> Exportar CSV do mês</button></div>
  </header>
  <div className="financial-planner-summary">
   <article><span>Entradas no mês</span><strong>{formatMoney(metrics.income)}</strong></article>
   <article><span>Saídas no mês</span><strong>{formatMoney(metrics.expenses)}</strong></article>
   <article><span>Saldo do mês</span><strong className={metrics.net<0?'finance-negative':'finance-positive'}>{formatMoney(metrics.net)}</strong></article>
   <article><span>Limites definidos</span><strong>{formatMoney(metrics.budgetTotal)}</strong></article>
  </div>
  <div className="financial-planner-content">
   <div className="financial-planner-left">
    {metrics.budgets.length?<div className="financial-budget-list">
      <div className="finance-overview"><span>Utilização dos limites</span><strong>{spentPct}%</strong><div className="finance-track"><span style={{width:spentPct+'%'}} data-exceeded={metrics.budgetSpent>metrics.budgetTotal}/></div></div>
      {metrics.budgets.map(b=>{const record=current.find(x=>x.category.toLocaleLowerCase('pt-BR')===b.category.toLocaleLowerCase('pt-BR'));return <article key={b.category} className="finance-budget-item" data-exceeded={b.exceeded}>
       <div className="finance-budget-title"><div><strong>{b.category}</strong><small>{formatMoney(b.spent)} de {formatMoney(b.limit)} · {b.exceeded?'Limite excedido':formatMoney(b.remaining)+' disponíveis'}</small></div><button type="button" className="icon-button" title={'Remover limite de '+b.category} aria-label={'Remover limite de '+b.category} onClick={()=>record&&deleteBudget(record.id,b.category)}><Trash2 size={16}/></button></div>
       <div className="finance-track"><span style={{width:Math.min(100,b.progress)+'%'}} data-exceeded={b.exceeded}/></div>
      </article>})}
      {metrics.unbudgeted>0&&<div className="finance-unbudgeted"><TrendingDown size={15}/> {formatMoney(metrics.unbudgeted)} em despesas sem limite definido.</div>}
     </div>:<div className="finance-empty"><div className="finance-empty-mark"><Wallet size={25}/></div><strong>Comece a planejar seus gastos</strong><p>Crie um limite para Moradia, Alimentação ou outra categoria. Seus lançamentos existentes serão calculados automaticamente.</p><button className="btn light" type="button" onClick={onAddTransaction}><Plus size={15}/> Novo lançamento</button></div>}
   </div>
   <form className="financial-budget-form" onSubmit={addBudget}>
    <strong>Definir limite de gastos</strong><p>Válido apenas para o mês e espaço selecionados.</p>
    <label>Categoria<select required value={category} onChange={e=>{setCategory(e.target.value);setMessage('')}}><option value="">Selecione a categoria</option>{categories.map(name=><option key={name} value={name}>{name}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></label>
    <label>Limite (R$)<input required min="0.01" max="100000000" step="0.01" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ex.: 500,00" inputMode="decimal"/></label>
    <button className="btn primary" type="submit"><Plus size={16}/> {current.some(b=>b.category===category)?'Atualizar limite':'Adicionar limite'}</button>
    {message&&<p className="finance-message" role="status"><Check size={14}/>{message}</p>}
    <small>Os limites são metas de planejamento. Não alteram o saldo bancário nem as vendas do PDV.</small>
   </form>
  </div>
 </section>
}
