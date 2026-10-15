// EIXO OS — TypeScript financial planning, browser and Node 22+.
import type {Entry} from './model';

export type CategoryBudget={id:string;workspaceId:string;month:string;category:string;limit:number};
export type BudgetPosition={category:string;limit:number;spent:number;remaining:number;progress:number;exceeded:boolean};
export type MonthPosition={month:string;income:number;expenses:number;net:number;budgets:BudgetPosition[];budgetTotal:number;budgetSpent:number;unbudgeted:number};

const validMonth=(value:unknown):value is string=>typeof value==='string'&&/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/.test(value);
const cents=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100000000?Math.round(value*100):0;
const money=(value:number)=>Math.round(value)/100;
export function normalizeBudgets(input:unknown):CategoryBudget[]{
 if(!Array.isArray(input))return [];
 const out:CategoryBudget[]=[],keys=new Set<string>();
 for(const raw of input.slice(0,1200)){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const item=raw as Partial<CategoryBudget>;
  const category=typeof item.category==='string'?item.category.trim().slice(0,80):'';
  const ws=typeof item.workspaceId==='string'?item.workspaceId.trim().slice(0,120):'';
  const id=typeof item.id==='string'?item.id.slice(0,120):'';
  if(!id||!ws||!category||!validMonth(item.month)||typeof item.limit!=='number'||!Number.isFinite(item.limit)||item.limit<=0||item.limit>100000000)continue;
  const key=ws+'\u0000'+item.month+'\u0000'+category.toLocaleLowerCase('pt-BR');
  if(keys.has(key))continue;
  keys.add(key);
  out.push({id,workspaceId:ws,month:item.month,category,limit:money(cents(item.limit))});
 }
 return out;
}
export function monthlyPosition(entries:readonly Entry[],budgets:readonly CategoryBudget[],workspaceId:string,month:string):MonthPosition{
 if(!validMonth(month))throw Error('Mês inválido.');
 const scoped=entries.filter(t=>(t.workspaceId||'pessoal')===workspaceId&&typeof t.date==='string'&&t.date.startsWith(month+'-'));
 const expenses=scoped.filter(t=>t.type==='Despesa');
 const income=scoped.filter(t=>t.type==='Receita');
 const incomeCents=income.reduce((sum,t)=>sum+cents(t.amount),0);
 const expenseCents=expenses.reduce((sum,t)=>sum+cents(t.amount),0);
 const spentByCategory=new Map<string,number>();
 for(const entry of expenses){
  const name=String(entry.category||'Outros').trim()||'Outros';
  const key=name.toLocaleLowerCase('pt-BR');
  spentByCategory.set(key,(spentByCategory.get(key)||0)+cents(entry.amount));
 }
 let budgetTotal=0,budgetSpent=0;
 const positions=budgets.filter(b=>b.workspaceId===workspaceId&&b.month===month).map(b=>{
  const limitCents=cents(b.limit),spentCents=spentByCategory.get(b.category.toLocaleLowerCase('pt-BR'))||0;
  budgetTotal+=limitCents;budgetSpent+=spentCents;
  return {category:b.category,limit:money(limitCents),spent:money(spentCents),remaining:money(limitCents-spentCents),progress:limitCents>0?Math.round(spentCents/limitCents*100):0,exceeded:spentCents>limitCents};
 }).sort((a,b)=>b.progress-a.progress||a.category.localeCompare(b.category,'pt-BR'));
 return {month,income:money(incomeCents),expenses:money(expenseCents),net:money(incomeCents-expenseCents),budgets:positions,budgetTotal:money(budgetTotal),budgetSpent:money(budgetSpent),unbudgeted:money(Math.max(0,expenseCents-budgetSpent))};
}
const csvString=(value:unknown):string=>{
 let s=String(value??'').replace(/\u0000/g,'');
 // Spreadsheet clients interpret cells beginning with control characters or =,+,-,@ as formulas.
 if(/^[\s\u0001-\u001f]*[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
export function transactionCsv(entries:readonly Entry[],workspaceId:string,month?:string):string{
 if(month&&!validMonth(month))throw Error('Mês inválido.');
 const rows=entries.filter(x=>(x.workspaceId||'pessoal')===workspaceId&&(!month||String(x.date||'').startsWith(month+'-')))
  .filter(x=>x.type==='Receita'||x.type==='Despesa')
  .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id).localeCompare(String(b.id)));
 const columns=['Data','Tipo','Descrição','Categoria','Conta','Valor (R$)','Observações'];
 const data=rows.map(x=>[
  String(x.date||''),String(x.type||''),String(x.title||''),String(x.category||'Outros'),
  String(x.account||''),(money(cents(x.amount))).toFixed(2).replace('.',','),String(x.notes||'')
 ]);
 return '\uFEFF'+[columns,...data].map(row=>row.map(csvString).join(';')).join('\r\n')+'\r\n';
}
