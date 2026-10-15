// EIXO OS — Node.js action center isolation and date tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {getActionCenter} from '../src/action-center.ts';
const empty={products:[],suppliers:[],orders:[],movements:[],bills:[],payments:[]};
test('alerts count only active workspace and ignore settled, canceled and invalid date entries',()=>{
 const result=getActionCenter({
  today:'2026-10-15',workspaceId:'a',
  tasks:[
   {id:'t1',workspaceId:'a',status:'A fazer',dueDate:'2026-10-14'},
   {id:'t2',workspaceId:'b',status:'A fazer',dueDate:'2026-10-14'},
   {id:'t3',workspaceId:'a',status:'Concluído',dueDate:'2026-10-14'},
   {id:'t4',workspaceId:'a',status:'A fazer',dueDate:'2026-10-15'}
  ],
  events:[{id:'e1',workspaceId:'a',date:'2026-10-22'},{id:'e2',workspaceId:'a',date:'2026-10-23'}],
  erp:{...empty,
   products:[{id:'p1',workspaceId:'a',active:true,stock:3,minimumStock:5},{id:'p2',workspaceId:'b',active:true,stock:0,minimumStock:5},{id:'p3',workspaceId:'a',active:false,stock:0,minimumStock:5}],
   bills:[{id:'b1',workspaceId:'a',type:'Receber',dueDate:'2026-10-14',amount:100,paid:25},{id:'b2',workspaceId:'a',type:'Pagar',dueDate:'2026-10-14',amount:50,paid:50},{id:'b3',workspaceId:'b',type:'Pagar',dueDate:'2026-10-14',amount:50,paid:0}]
  }
 });
 assert.deepEqual(Object.fromEntries(result.map(x=>[x.id,x.count])),{'tasks-overdue':1,'tasks-today':1,stock:1,receivable:1,events:1});
});
test('empty workspaces have no invented notifications and invalid dates do not throw',()=>{
 assert.deepEqual(getActionCenter({today:'2026-10-15',workspaceId:'b',tasks:[],events:[],erp:empty}),[]);
 assert.deepEqual(getActionCenter({today:'invalid',workspaceId:'b',tasks:[],events:[],erp:empty}),[]);
});
test('relative weeks do not incorrectly bridge month or year boundaries',()=>{
 const result=getActionCenter({today:'2026-12-29',workspaceId:'pessoal',tasks:[],events:[{date:'2027-01-05',workspaceId:'pessoal'}],erp:empty});
 assert.equal(result[0].count,1);
});
