// Shared, deterministic examples for the browser and authoritative server command.
// These records are fictional; dates are relative so every module remains useful.
const modules=['agenda','financeiro','estudos','academia','alimentacao','negocios','projetos','habitos'];
const groups=['transactions','tasks','events','subjects','studies','workouts','clients','deals','projects','goals','habits','businesses'];
const emptyERP=()=>({products:[],suppliers:[],orders:[],movements:[],bills:[],payments:[]});
export function emptyDemoState(preferences={}) {
 return {version:1,collections:Object.fromEntries(groups.map(key=>[key,[]])),
  preferences:{name:'',theme:'light',currency:'BRL',weeklyTrainingGoal:3,...preferences,workspaceId:'pessoal'},demo:false,
  erp:emptyERP(),training:{version:1,plans:[],sessions:[],customExercises:[],goals:[],profiles:[]},
  nutrition:{version:1,profiles:[],restrictions:[],foods:[],meals:[],recipes:[],favorites:[],shoppingChecks:[],restrictionAudit:[]},
  study:{version:1,plans:[],cards:[],reviews:[],exams:[],focus:[],weeklyGoalMinutes:300}};
}

export function createDemoState(preferences={},referenceDate=new Date()) {
 const clock=new Date(referenceDate);
 if(!Number.isFinite(clock.getTime()))throw new Error('Data da demonstração inválida.');
 const anchor=new Date(Date.UTC(clock.getUTCFullYear(),clock.getUTCMonth(),clock.getUTCDate(),12));
 const day=offset=>{const date=new Date(anchor);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)};
 const at=(offset,hour=12)=>day(offset)+`T${String(hour).padStart(2,'0')}:00:00.000Z`;
 const ws='demo-workspace',createdAt=at(-90);
 const s=emptyDemoState(preferences);
 s.demo=true;
 Object.assign(s.preferences,{workspaceId:ws,enabledModules:[...modules],onboardingVersion:1,weeklyTrainingGoal:3});
 let serial=0;
 const id=()=>`demo-${++serial}`;
 const base=()=>({id:id(),workspaceId:ws,createdAt});
 const add=(group,title,values={})=>{const entry={...base(),title,...values};s.collections[group].push(entry);return entry};
 add('businesses','Horizonte • Demonstração',{id:ws,workspaceId:'pessoal',category:'Papelaria e organização',city:'São Paulo',state:'SP',notes:'Empresa fictícia. Todos os módulos deste espaço contêm exemplos.'});

 // Six months of personal cashflow, with current and upcoming agenda items.
 for(let month=5;month>=0;month--){
  const d=new Date(anchor);d.setUTCMonth(d.getUTCMonth()-month,1);const date=d.toISOString().slice(0,10);
  add('transactions','Receita mensal de exemplo',{amount:4200+(5-month)*150,type:'Receita',category:'Salário',date,account:'Conta demonstrativa'});
  for(const [title,amount,category] of [['Moradia',1250,'Moradia'],['Supermercado',460+month*17,'Alimentação'],['Transporte',190,'Transporte'],['Curso online',149,'Educação']])add('transactions',title,{amount,type:'Despesa',category,date,account:'Conta demonstrativa'});
 }
 add('transactions','Projeto freelance',{amount:850,type:'Receita',category:'Outros',date:day(-1)});
 for(const [title,offset,status,priority] of [['Revisar o conteúdo da semana',0,'A fazer','Alta'],['Organizar documentos',-2,'A fazer','Média'],['Planejar as refeições',1,'Em andamento','Média'],['Concluir o curso',7,'A fazer','Alta'],['Conferir orçamento mensal',-1,'Concluído','Baixa']])add('tasks',title,{dueDate:day(offset),status,priority,category:'Pessoal'});
 for(const [title,offset,time,category] of [['Reunião de planejamento',0,'14:00','Trabalho'],['Treino A',0,'18:00','Academia'],['Grupo de estudos',1,'19:00','Faculdade'],['Revisão de metas',3,'09:00','Pessoal'],['Apresentação do projeto',7,'10:00','Negócios']])add('events',title,{date:day(offset),time,category});
 add('projects','Lançar a loja virtual',{category:'Negócios',status:'Em andamento',priority:'Alta',dueDate:day(21),notes:'Catálogo pronto; próximo passo: fotografar os produtos.'});
 add('projects','Concluir trilha de estudos',{category:'Estudos',status:'Em andamento',priority:'Média',dueDate:day(45)});
 add('projects','Organizar o escritório',{category:'Pessoal',status:'Concluído',priority:'Baixa',dueDate:day(-3)});
 for(const [title,target,current,unit] of [['Reserva de emergência',10000,4250,'R$'],['Estudar no trimestre',60,24,'h'],['Concluir treinos no mês',12,8,'treinos']])add('goals',title,{target,current,unit,dueDate:day(60)});
 for(const [index,title] of ['Ler 20 minutos','Beber água ao longo do dia','Caminhar','Revisar os gastos'].entries())add('habits',title,{
  frequency:index===3?'Semanal':'Diária',category:['Estudos','Saúde','Fitness','Finanças'][index],icon:['📚','💧','🚶','💰'][index],
  doneDates:Array.from({length:21},(_,n)=>n).filter(n=>(n+index)%4!==0).map(n=>day(-n)).sort().join(','),startDate:day(-30),scheduleDays:'0,1,2,3,4,5,6',targetPerWeek:3,archived:false,archivedAt:'',reminderTime:'20:00',notes:'Exemplo de acompanhamento de rotina.'});

 // Modern study records are linked to the subjects used in the legacy dashboard.
 const subjects=['Gestão financeira','Comunicação','Tecnologia'].map((title,index)=>add('subjects',title,{teacher:'Equipe de exemplo',grade:8+index*.5,attendancePresent:17+index,attendanceTotal:20,nextExam:day(7+index*4)}));
 for(let n=0;n<21;n++)if(n%4!==3){const subject=subjects[n%3];add('studies',`Revisão: ${subject.title}`,{subject:subject.title,subjectId:subject.id,date:day(-n),duration:25+(n%3)*15,notes:'Sessão demonstrativa concluída.'})}
 for(const [index,subject] of subjects.entries()){
  s.study.plans.push({...base(),subjectId:subject.id,title:`Revisar ${subject.title}`,date:day(index),minutes:40,done:false,notes:'Atividade planejada: não conta como horas estudadas.'});
  s.study.exams.push({...base(),subjectId:subject.id,title:'Avaliação concluída',date:day(-5-index),weight:1,grade:8+index*.5,maximum:10,notes:''},
   {...base(),subjectId:subject.id,title:'Próxima avaliação',date:day(7+index*4),weight:2,maximum:10,notes:'Conteúdo dos últimos capítulos.'});
  for(let n=0;n<3;n++){
   const card={...base(),subjectId:subject.id,sourceNoteId:'',front:['O que é uma meta mensurável?','Como organizar uma revisão?','Qual a diferença entre receita e lucro?'][n],back:['Um objetivo acompanhado por um indicador e prazo.','Revisitar o conteúdo e testar a lembrança sem consultar as anotações.','Receita é o valor das vendas; lucro considera também os custos e despesas.'][n],dueDate:day(n-1),interval:3,ease:2.5,reviews:1,lastGrade:2,lastReviewedAt:at(-3)};
   s.study.cards.push(card);s.study.reviews.push({...base(),cardId:card.id,at:at(-3),grade:2,previousDue:day(-3),nextDue:card.dueDate});
  }
 }
 s.study.focus.push({workspaceId:ws,subjectId:subjects[0].id,title:'Revisão financeira',targetMinutes:25,startedAt:null,accumulatedSeconds:0});

 const exercises=[
  ['supino-reto','Supino reto','chest',['triceps','front_deltoid'],'Barra',30],
  ['remada-curvada','Remada curvada','lats',['biceps','traps'],'Barra',25],
  ['agachamento','Agachamento livre','quads',['glutes','adductors'],'Barra',35],
  ['mesa-flexora','Mesa flexora','hamstrings',[],'Máquina',20],
  ['desenvolvimento','Desenvolvimento de ombros','front_deltoid',['side_deltoid','triceps'],'Halteres',10],
  ['abdominal','Abdominal crunch','abs',[],'Peso corporal',0]
 ];
 for(let index=0;index<3;index++)s.training.plans.push({...base(),updatedAt:createdAt,title:['Ficha A • Superior','Ficha B • Pernas','Ficha C • Ombros e abdômen'][index],days:[[1,4],[2,5],[3,6]][index],items:exercises.slice(index*2,index*2+2).map(e=>({id:id(),exerciseId:e[0],sets:3,reps:10,restSeconds:60,targetLoad:e[5],notes:'Exemplo ilustrativo; adapte seu treino.'}))});
 for(let n=0;n<12;n++){
  const plan=s.training.plans[n%3],offset=-1-n*2;
  s.training.sessions.push({...base(),planId:plan.id,planTitle:plan.title,date:day(offset),startedAt:at(offset,15),finishedAt:at(offset,16),status:'completed',exercises:exercises.slice(n%3*2,n%3*2+2).map(e=>({id:id(),exerciseId:e[0],title:e[1],primary:e[2],secondary:e[3],equipment:e[4],kind:'strength',restSeconds:60,sets:Array.from({length:3},()=>({id:id(),reps:10,load:e[5],done:true,kind:'working'}))}))});
 }
 s.training.goals=['chest','lats','quads','hamstrings','front_deltoid','abs'].map(muscle=>({workspaceId:ws,muscle,sets:6}));
 s.training.profiles.push({workspaceId:ws,age:30,heightCm:175,weightKg:75,objective:'bem-estar',level:'iniciante',setting:'academia',daysPerWeek:3,minutesPerSession:60,lowImpact:false,updatedAt:createdAt});

 // Self-contained fictional food labels keep recipes usable even before catalog loads.
 const foods=[['Arroz cozido',128,2.5,28,0.2,1.6,1],['Feijão cozido',76,4.8,13.6,.5,8.5,2],['Frango grelhado',159,32,0,2.5,0,50],['Banana',98,1.3,26,.1,2,0],['Aveia',394,13.9,66.6,8.5,9.1,5],['Brócolis cozido',25,2.1,4.4,.5,3.4,2]];
 s.nutrition.foods=foods.map(([name,kcal,protein,carbs,fat,fiber,sodiumMg])=>({...base(),name,category:'Demonstração',source:'Rótulo ilustrativo de demonstração',referenceUnit:'g',per100:{kcal,protein,carbs,fat,fiber,sodiumMg},allergens:name==='Aveia'?['gluten']:[],ingredientStatus:'single',aliases:[],userProvided:true}));
 const ingredients=indices=>indices.map(index=>({id:id(),foodId:s.nutrition.foods[index].id,grams:index===4?40:100}));
 s.nutrition.profiles.push({workspaceId:ws,objective:'equilibrio',style:'onivoro',mealsPerDay:3,prepMinutes:30,preferences:[],dislikes:[],useTraining:true,showNumbers:true,updatedAt:createdAt});
 for(let offset=-6;offset<=6;offset++)for(const [slot,title,indices] of [['Café da manhã','Banana com aveia',[3,4]],['Almoço','Arroz, feijão, frango e brócolis',[0,1,2,5]],['Jantar','Bowl de arroz com vegetais',[0,1,5]]]){
  s.nutrition.meals.push({...base(),date:day(offset),slot,title,ingredients:ingredients(indices),status:offset<0||offset===0&&slot==='Café da manhã'?'consumed':'planned'});
 }
 s.nutrition.recipes.push({...base(),title:'Bowl de arroz e vegetais',ingredients:ingredients([0,1,5]),instructions:'Combine os ingredientes já cozidos. Receita ilustrativa.',prepMinutes:20,favorite:true});
 s.nutrition.favorites=s.nutrition.foods.slice(0,3).map(food=>({workspaceId:ws,foodId:food.id}));

 const clients=['Ana • Cliente de exemplo','Bruno • Cliente de exemplo','Clara • Cliente de exemplo'].map(title=>add('clients',title,{status:'Ativo',email:'cliente@example.test',type:'Física',city:'São Paulo',origin:'Demonstração',notes:'Contato fictício.'}));
 for(const [index,client] of clients.entries())add('deals',`Kit de organização — ${client.title}`,{amount:250+index*100,client:client.title,clientId:client.id,status:['Proposta','Negociação','Ganho'][index],date:day(index+2)});
 const supplier={...base(),title:'Distribuidora de exemplo',document:'',phone:'',email:'fornecedor@example.test',contact:'Equipe fictícia',address:'',notes:'Fornecedor demonstrativo.'};s.erp.suppliers.push(supplier);
 for(const [index,[title,cost,price,stock,min]] of [['Caderno pontilhado',18,35,30,8],['Planner semanal',25,59,12,5],['Kit de canetas',12,29,4,6],['Estojo organizador',15,39,0,4]].entries()){
  const product={...base(),title,sku:`DEMO-${index+1}`,barcode:`00000000000${index+1}`,category:'Organização',unit:'un',cost,price,stock,minimumStock:min,active:true,notes:'Produto fictício.'};s.erp.products.push(product);
  if(stock)s.erp.movements.push({...base(),date:day(-90),productId:product.id,productTitle:title,delta:stock,reason:'Saldo inicial demonstrativo'});
 }
 const order=(kind,status,offset,productIndex,quantity,paid=0)=>{
  const product=s.erp.products[productIndex],client=clients[productIndex%clients.length],price=kind==='Compra'?product.cost:product.price;
  const value=quantity*price;
  const record={...base(),number:`${kind==='Compra'?'COM':kind==='Venda'?'VEN':'ORC'}-${String(s.erp.orders.length+1).padStart(5,'0')}`,kind,status,partnerId:kind==='Compra'?supplier.id:client.id,partnerName:kind==='Compra'?supplier.title:client.title,date:day(offset),dueDate:day(offset+15),paymentMethod:paid===value?'PIX':'A prazo',lines:[{productId:product.id,title:product.title,sku:product.sku,quantity,price,cost:product.cost,unit:'un'}],discount:0,shipping:0,paid,notes:'Documento demonstrativo, sem valor fiscal.'};
  s.erp.orders.push(record);
  if(status==='Confirmada'||status==='Recebida'){
   const delta=kind==='Compra'?quantity:-quantity;product.stock+=delta;
   s.erp.movements.push({...base(),date:record.date,productId:product.id,productTitle:product.title,delta,reason:`${kind} ${record.number}`,orderId:record.id});
  }
  if(paid)s.erp.payments.push({...base(),date:record.date,sourceType:'order',sourceId:record.id,description:record.number,direction:kind==='Compra'?'Saída':'Entrada',amount:paid});
  return record;
 };
 order('Compra','Recebida',-45,0,20,360);
 for(const offset of [-40,-20,-7,-2,0])order('Venda','Confirmada',offset,0,3,105);
 const sale=order('Venda','Confirmada',-18,1,3,59);
 sale.installments=Array.from({length:3},(_,index)=>({id:id(),number:index+1,label:`Parcela ${index+1}/3`,dueDate:day(-18+index*15),amount:59,paid:index===0?59:0}));sale.dueDate=sale.installments.at(-1).dueDate;
 order('Venda','Rascunho',0,2,1);order('Orçamento','Rascunho',0,1,4);order('Compra','Rascunho',0,3,10);order('Venda','Cancelada',-8,0,1);
 for(const [title,type,amount,paid,due] of [['Aluguel da loja','Pagar',900,900,-5],['Internet','Pagar',120,0,3],['Embalagens','Pagar',180,0,-2],['Serviço de organização','Receber',350,100,5]]){
  const bill={...base(),title,type,amount,paid,category:'Operação',date:day(-10),dueDate:day(due),notes:'Conta demonstrativa.'};s.erp.bills.push(bill);
  if(paid)s.erp.payments.push({...base(),date:day(-5),sourceType:'bill',sourceId:bill.id,description:title,direction:type==='Pagar'?'Saída':'Entrada',amount:paid});
 }
 return s;
}
