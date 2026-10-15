// EIXO OS · Node.js 22+ tests of local assistant intent, dates, confirmation and workspace isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretAssistant,fillDraft,parseDate,parseTime,parseAmount,draftPreview} from '../src/assistant-local.ts';
const now=new Date(2026,9,15,12,0,0);
const plan=(text,space='pessoal',records)=>interpretAssistant(text,space,now,undefined,records);
test('agendar amanhã às 14h extracts a clean event without date/time in title',()=>{
 const r=plan('Agende dentista amanhã às 14h');
 assert.equal(r.type,'draft');
 assert.deepEqual(r.draft.fields,{date:'2026-10-16',time:'14:00',title:'dentista'});
 assert.deepEqual(r.draft.missing,[]);
});
test('understands accented dates, weekdays, numeric dates and rejects invalid dates',()=>{
 assert.equal(parseDate('amanhã',now),'2026-10-16');
 assert.equal(parseDate('depois de amanhã',now),'2026-10-17');
 assert.equal(parseDate('sexta às 9h',now),'2026-10-16');
 assert.equal(parseDate('próxima sexta',now),'2026-10-23');
 assert.equal(parseDate('25/10/2026',now),'2026-10-25');
 assert.equal(parseDate('31/02/2027',now),undefined);
 assert.equal(parseDate('dia 20',now),'2026-10-20');
 assert.equal(parseTime('às 14h30'),'14:30');
 assert.equal(parseTime('pelas 09:15'),'09:15');
});
test('transaction amounts are localized and safe',()=>{
 assert.equal(parseAmount('paguei R$ 1.249,90'),1249.9);
 assert.equal(parseAmount('gastei 55,20'),55.2);
 assert.equal(parseAmount('gastei R$ 0'),undefined);
 assert.equal(parseAmount('R$ 100000001'),undefined);
 const expense=plan('gastei R$ 85 no mercado');
 assert.equal(expense.draft.fields.amount,85);
 assert.equal(expense.draft.fields.type,'Despesa');
 assert.equal(expense.draft.fields.category,'Alimentação');
 assert.equal(expense.draft.fields.title,'mercado');
 const income=plan('recebi R$ 2.500,00 de salário');
 assert.equal(income.draft.fields.type,'Receita');
 assert.equal(income.draft.fields.amount,2500);
});
test('task and study records use dates and durations, no remote models',()=>{
 const task=plan('cria tarefa comprar pão sexta');
 assert.equal(task.draft.kind,'tasks');
 assert.equal(task.draft.fields.dueDate,'2026-10-16');
 assert.equal(task.draft.fields.title,'comprar pão');
 const study=plan('estudei 1 hora e 20 minutos de anatomia');
 assert.equal(study.draft.kind,'studies');
 assert.equal(study.draft.fields.duration,80);
 assert.equal(study.draft.fields.title,'anatomia');
});
test('missing event fields are filled by conversation without saving',()=>{
 const initial=plan('marque consulta');
 assert.equal(initial.type,'draft');
 assert.deepEqual(initial.draft.missing,['date','time']);
 const intermediate=interpretAssistant('amanhã', 'pessoal',now,initial.draft);
 assert.deepEqual(intermediate.draft.missing,['time']);
 const complete=interpretAssistant('às 15h', 'pessoal',now,intermediate.draft);
 assert.deepEqual(complete.draft.missing,[]);
 assert.equal(complete.draft.fields.title,'consulta');
 assert(draftPreview(complete.draft).includes('15:00'));
});
test('read-only summary never includes records from another workspace',()=>{
 const records={tasks:[{id:'p',title:'Pessoal',workspaceId:'pessoal',status:'A fazer',dueDate:'2026-10-15'},{id:'s',title:'CONFIDENCIAL OUTRA EMPRESA',workspaceId:'company-x',status:'A fazer',dueDate:'2026-10-15'}],events:[],transactions:[]};
 const result=plan('o que tenho para hoje?', 'pessoal',records);
 assert.equal(result.type,'reply');
 assert(result.reply.includes('Pessoal'));
 assert(!result.reply.includes('CONFIDENCIAL'));
});
test('unknown text does not produce speculative actions',()=>{
 assert.equal(plan('quais são as notícias?').type,'unknown');
 assert.equal(plan('olá').type,'reply');
 assert.equal(plan('registre uma tarefa').draft.missing.includes('title'),true);
});
