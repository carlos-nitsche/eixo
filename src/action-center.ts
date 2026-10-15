// EIXO OS — TypeScript: cross-module action center, isolated by workspace.
import type {Entry} from './model';
import type {ERPData} from './erp';
import {monthlyPosition} from './financial-planning.ts';
import type {CategoryBudget} from './financial-planning';
type Page='agenda'|'negocios'|'financeiro';
export type ActionNotice={id:string;title:string;description:string;count:number;page:Page;tone:'warning'|'danger'|'info'};
type Input={tasks:Entry[];events:Entry[];erp:ERPData;transactions?:Entry[];budgets?:CategoryBudget[];workspaceId:string;today:string};
const scope=(workspaceId:string)=>(record:{workspaceId?:string})=>(record.workspaceId||'pessoal')===workspaceId;
const dateOkay=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
export function getActionCenter({tasks,events,erp,transactions=[],budgets=[],workspaceId,today}:Input):ActionNotice[]{
 const notices:ActionNotice[]=[];
 if(!dateOkay(today))return notices;
 const inWorkspace=scope(workspaceId);
 const openTasks=tasks.filter(t=>inWorkspace(t)&&t.status!=='Concluído');
 const overdueTasks=openTasks.filter(t=>dateOkay(t.dueDate)&&String(t.dueDate)<today).length;
 const dueToday=openTasks.filter(t=>t.dueDate===today).length;
 const dueSoon=events.filter(e=>inWorkspace(e)&&dateOkay(e.date)&&String(e.date)>=today&&String(e.date)<=shiftDate(today,7)).length;
 const lowStock=erp.products.filter(p=>inWorkspace(p)&&p.active&&Number.isFinite(p.stock)&&Number.isFinite(p.minimumStock)&&(p.stock<=0||p.minimumStock>0&&p.stock<=p.minimumStock)).length;
 const overduePayables=erp.bills.filter(b=>inWorkspace(b)&&b.type==='Pagar'&&dateOkay(b.dueDate)&&b.dueDate<today&&b.amount-b.paid>.009).length;
 const overdueReceivables=erp.bills.filter(b=>inWorkspace(b)&&b.type==='Receber'&&dateOkay(b.dueDate)&&b.dueDate<today&&b.amount-b.paid>.009).length;
 if(overdueTasks)notices.push({id:'tasks-overdue',title:'Tarefas atrasadas',description:'Priorize o que passou do prazo',count:overdueTasks,page:'agenda',tone:'danger'});
 if(dueToday)notices.push({id:'tasks-today',title:'Tarefas para hoje',description:'Compromissos que pedem atenção',count:dueToday,page:'agenda',tone:'warning'});
 if(lowStock)notices.push({id:'stock',title:'Estoque baixo',description:'Produtos para repor ou revisar',count:lowStock,page:'negocios',tone:'warning'});
 if(overdueReceivables)notices.push({id:'receivable',title:'Contas a receber vencidas',description:'Acompanhe os recebimentos pendentes',count:overdueReceivables,page:'negocios',tone:'danger'});
 if(overduePayables)notices.push({id:'payable',title:'Contas a pagar vencidas',description:'Revise os pagamentos pendentes',count:overduePayables,page:'negocios',tone:'danger'});
 if(dueSoon)notices.push({id:'events',title:'Próximos compromissos',description:'Eventos dos próximos sete dias',count:dueSoon,page:'agenda',tone:'info'});
 const position=monthlyPosition(transactions,budgets,workspaceId,today.slice(0,7));
 const over=position.budgets.filter(x=>x.exceeded).length;
 const nearing=position.budgets.filter(x=>!x.exceeded&&x.progress>=90).length;
 if(over)notices.push({id:'budget-over',title:'Orçamento excedido',description:'Revise os limites de gastos neste mês',count:over,page:'financeiro',tone:'danger'});
 if(nearing)notices.push({id:'budget-near',title:'Orçamento quase no limite',description:'Uma categoria está perto do teto planejado',count:nearing,page:'financeiro',tone:'warning'});
 return notices;
}
function shiftDate(day:string,offset:number){
 const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);
}
