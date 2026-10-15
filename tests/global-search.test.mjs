// EIXO OS — Node.js regression tests for workspace-search isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {searchWorkspaceRecords,normalizeSearch} from '../src/global-search.ts';
const entry=(id,title,workspaceId='pessoal',category='')=>({id,title,workspaceId,category});
const collections={
 tasks:[entry('a','Pagar aluguel','pessoal','Casa'),entry('b','Pagar fornecedor','empresa-a','Compras'),entry('c','Pagar imposto','empresa-b','Tributário')],
 clients:[entry('d','Carlos Cliente','empresa-a'),entry('e','Carlos Cliente','empresa-b')],
 businesses:[entry('empresa-a','Empresa Alpha'),entry('empresa-b','Empresa Beta')],
 projects:[entry('f','Reforma escritório','pessoal')],
 transactions:[entry('g','Cartão de crédito','pessoal'),entry('h','Cartão empresarial','empresa-a')],
};
test('search isolates client and financial data per selected workspace',()=>{
 const one=searchWorkspaceRecords(collections,['tasks','clients','transactions'],'empresa-a','pagar');
 assert.deepEqual(one.map(x=>x.item.id),['b']);
 const clients=searchWorkspaceRecords(collections,['clients'],'empresa-b','carlos');
 assert.deepEqual(clients.map(x=>x.item.id),['e']);
 assert.equal(searchWorkspaceRecords(collections,['transactions'],'pessoal','empresarial').length,0);
});
test('search respects module visibility, company names and legacy personal workspace',()=>{
 assert.equal(searchWorkspaceRecords(collections,['tasks'],'empresa-a','reforma').length,0);
 assert.deepEqual(searchWorkspaceRecords(collections,['businesses'],'pessoal','empresa').map(x=>x.item.id),['empresa-a','empresa-b']);
 assert.deepEqual(searchWorkspaceRecords(collections,['projects'],'pessoal','reforma').map(x=>x.item.id),['f']);
});
test('search is accent insensitive, deterministic, capped and ignores blank queries',()=>{
 assert.equal(normalizeSearch(' CárTÃO '),'cartao');
 const matches=searchWorkspaceRecords(collections,['transactions'],'pessoal','cartao',1);
 assert.equal(matches.length,1);
 assert.deepEqual(searchWorkspaceRecords(collections,['tasks'],'pessoal','   '),[]);
 assert.deepEqual(searchWorkspaceRecords(collections,['tasks'],'pessoal','x'.repeat(200)),[]);
});
