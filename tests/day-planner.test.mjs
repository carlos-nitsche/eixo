// EIXO OS 0.6.0 · Node 22+ regression tests for Meu Dia.
import test from 'node:test';
import assert from 'node:assert/strict';
import {dayOffset,isCalendarDate,weekStrip,normalizeFocusSessions,dailyOverview,focusWeek} from '../src/day-planner.ts';
const entry=(id,title,workspaceId,extras={})=>({id,title,workspaceId,createdAt:'2026-10-01T12:00:00Z',...extras});
const tasks=[
 entry('a','Alta atrasada','pessoal',{dueDate:'2026-10-14',priority:'Alta',status:'A fazer'}),
 entry('b','Baixa hoje','pessoal',{dueDate:'2026-10-15',priority:'Baixa',status:'A fazer'}),
 entry('c','Alta hoje','pessoal',{dueDate:'2026-10-15',priority:'Alta',status:'A fazer'}),
 entry('d','Concluída hoje','pessoal',{dueDate:'2026-10-15',status:'Concluído'}),
 entry('e','Sem prazo','pessoal',{priority:'Média',status:'A fazer'}),
 entry('f','SEGREDO DO OUTRO ESPAÇO','empresa-b',{dueDate:'2026-10-15',priority:'Alta',status:'A fazer'}),
 entry('g','Concluída antiga','pessoal',{dueDate:'2026-10-10',status:'Concluído'})
];
const events=[
 entry('e1','Reunião','pessoal',{date:'2026-10-15',time:'14:00'}),
 entry('e2','Atendimento','pessoal',{date:'2026-10-15',time:'09:30'}),
 entry('e3','Outro espaço','empresa-b',{date:'2026-10-15',time:'08:00'}),
 entry('e4','Sem horário','pessoal',{date:'2026-10-15'}),
];
const focus=[
 {id:'session-01',workspaceId:'pessoal',date:'2026-10-14',minutes:25,completedAt:'2026-10-14T12:00:00Z'},
 {id:'session-02',workspaceId:'pessoal',date:'2026-10-15',minutes:50,completedAt:'2026-10-15T12:00:00Z'},
 {id:'session-03',workspaceId:'empresa-b',date:'2026-10-15',minutes:100,completedAt:'2026-10-15T12:00:00Z'},
];
test('strict calendar handles leap years and week crossing years',()=>{
 assert.equal(isCalendarDate('2026-02-29'),false);
 assert.equal(isCalendarDate('2028-02-29'),true);
 assert.equal(dayOffset('2026-12-31',1),'2027-01-01');
 assert.equal(dayOffset('2028-03-01',-1),'2028-02-29');
 assert.deepEqual(weekStrip('2026-10-15'),['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17','2026-10-18']);
 assert.throws(()=>dayOffset('2026-02-29',1));
});
test('daily priorities respect current workspace, overdue and completed tasks',()=>{
 const view=dailyOverview(tasks,events,focus,'pessoal','2026-10-15','2026-10-15');
 assert.deepEqual(view.tasks.map(x=>x.item.id),['a','c','e','b','d']);
 assert.deepEqual(view.events.map(x=>x.item.id),['e2','e1','e4']);
 assert.equal(view.pending,4);
 assert.equal(view.completed,1);
 assert.equal(view.overdue,1);
 assert.equal(view.focusMinutes,50);
 assert.equal(view.focusCount,1);
 assert(!JSON.stringify(view).includes('SEGREDO'));
});
test('future day does not inherit overdue tasks or unplanned backlog',()=>{
 const view=dailyOverview(tasks,events,focus,'pessoal','2026-10-16','2026-10-15');
 assert.deepEqual(view.tasks,[]);
 assert.deepEqual(view.events,[]);
});
test('focus records validation rejects corrupt values, dedupes and caps',()=>{
 const raw=[...focus,{...focus[0]},{id:'invalid',workspaceId:'pessoal',date:'2026-02-30',minutes:30,completedAt:'2026-10-15T12:00:00Z'},{id:'too-long',workspaceId:'pessoal',date:'2026-10-15',minutes:Infinity,completedAt:'2026-10-15T12:00:00Z'}];
 assert.deepEqual(normalizeFocusSessions(raw),focus);
 assert.deepEqual(normalizeFocusSessions(null),[]);
 assert.deepEqual(normalizeFocusSessions({}),[]);
});
test('weekly focus only includes requested company and exact seven calendar days',()=>{
 const week=focusWeek(focus,'pessoal','2026-10-15');
 assert.deepEqual([week.minutes,week.count,week.days.length],[75,2,7]);
 assert.equal(week.days.at(-1).minutes,50);
 assert.equal(focusWeek(focus,'empresa-b','2026-10-15').minutes,100);
 assert.equal(focusWeek(focus,'pessoal','2026-10-13').minutes,0);
});
