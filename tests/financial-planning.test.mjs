// EIXO OS — Node.js 22+ regression tests for financial planning.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBudgets,monthlyPosition,transactionCsv} from '../src/financial-planning.ts';
const entries=[
 {id:'a',workspaceId:'pessoal',date:'2026-10-03',type:'Receita',amount:5000,title:'Salário'},
 {id:'b',workspaceId:'pessoal',date:'2026-10-05',type:'Despesa',amount:300.3,title:'Aluguel',category:'Moradia'},
 {id:'c',workspaceId:'pessoal',date:'2026-10-09',type:'Despesa',amount:200.25,title:'Compras',category:'Moradia'},
 {id:'d',workspaceId:'empresa',date:'2026-10-06',type:'Despesa',amount:9999,title:'SEGREDO_EMPRESA',category:'Moradia'},
 {id:'e',workspaceId:'pessoal',date:'2026-09-20',type:'Despesa',amount:1000,title:'Passado',category:'Moradia'},
 {id:'f',workspaceId:'pessoal',date:'2026-10-10',type:'Despesa',amount:50,title:'=cmd|calc',category:'Lazer',notes:'@danger'},
 {id:'g',workspaceId:'pessoal',date:'2026-10-11',type:'Despesa',amount:-10,title:'Legacy negative',category:'Moradia'}
];
test('financial plan is scoped to month and company, uses exact cents and protects against negative values',()=>{
 const budgets=normalizeBudgets([{id:'x',workspaceId:'pessoal',month:'2026-10',category:'Moradia',limit:400},{id:'y',workspaceId:'pessoal',month:'2026-10',category:'Lazer',limit:100},{id:'z',workspaceId:'empresa',month:'2026-10',category:'Moradia',limit:999}]);
 const p=monthlyPosition(entries,budgets,'pessoal','2026-10');
 assert.equal(p.income,5000);assert.equal(p.expenses,550.55);assert.equal(p.net,4449.45);
 assert.deepEqual(p.budgets.map(x=>x.category),['Moradia','Lazer']);
 assert.deepEqual(p.budgets[0],{category:'Moradia',limit:400,spent:500.55,remaining:-100.55,progress:125,exceeded:true});
 assert.equal(p.budgetTotal,500);assert.equal(p.budgetSpent,550.55);
 assert.equal(monthlyPosition(entries,budgets,'empresa','2026-10').expenses,9999);
});
test('normalizer discards broken, duplicate, excessive and cross-account contaminated budgets',()=>{
 const raw=[{id:'a',workspaceId:'pessoal',month:'2026-10',category:' Casa ',limit:99.999},{id:'dup',workspaceId:'pessoal',month:'2026-10',category:'casa',limit:500},{id:'bad',workspaceId:'pessoal',month:'2026-13',category:'X',limit:100},{id:'bad2',workspaceId:'pessoal',month:'2026-10',category:'X',limit:-1}];
 assert.deepEqual(normalizeBudgets(raw),[{id:'a',workspaceId:'pessoal',month:'2026-10',category:'Casa',limit:100}]);
 assert.deepEqual(normalizeBudgets({}),[]);
 assert.throws(()=>monthlyPosition([],[],'pessoal','2026-22'));
});
test('CSV is UTF8 BOM, localized and spreadsheet injection resistant, without other workspaces',()=>{
 const csv=transactionCsv(entries,'pessoal','2026-10');
 assert(csv.startsWith('\uFEFF'));
 assert(csv.includes('5000,00'));
 assert(csv.includes('300,30'));
 assert(csv.includes("'=cmd|calc"));
 assert(!csv.includes('SEGREDO_EMPRESA'));
 assert(!csv.includes('Passado'));
 assert(csv.endsWith('\r\n'));
 assert.throws(()=>transactionCsv(entries,'pessoal','bad-month'));
});
test('invalid values are ignored but data stays immutable',()=>{
 const before=JSON.stringify(entries);
 const r=monthlyPosition(entries,[],'pessoal','2026-10');
 assert.equal(r.budgets.length,0);
 assert.equal(r.unbudgeted,550.55);
 assert.equal(JSON.stringify(entries),before);
});
