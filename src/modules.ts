export const MODULE_IDS = ['agenda','financeiro','estudos','academia','alimentacao','negocios','projetos','habitos'] as const;
export type ModuleId = typeof MODULE_IDS[number];
export const MODULES: {id:ModuleId;title:string;description:string;detail:string}[] = [
 {id:'academia',title:'Treinos e saúde',description:'Seu treino, sua evolução.',detail:'Fichas, exercícios e calendário de treinos'},
 {id:'financeiro',title:'Financeiro',description:'Clareza para o seu dinheiro.',detail:'Receitas, despesas e histórico financeiro'},
 {id:'negocios',title:'Negócios',description:'Seu negócio em movimento.',detail:'Clientes, vendas, estoque e ponto de venda'},
 {id:'projetos',title:'Projetos e metas',description:'Transforme planos em conquistas.',detail:'Objetivos, projetos e acompanhamento de progresso'},
 {id:'agenda',title:'Agenda e tarefas',description:'Mais espaço no seu dia.',detail:'Compromissos, prioridades e tarefas'},
 {id:'estudos',title:'Estudos',description:'Aprenda com consistência.',detail:'Disciplinas, sessões de foco e revisões'},
 {id:'alimentacao',title:'Alimentação',description:'Uma rotina que nutre você.',detail:'Refeições, planejamento e lista de compras'},
 {id:'habitos',title:'Hábitos',description:'Pequenos passos, todos os dias.',detail:'Rotinas, sequências e calendário de hábitos'},
];
// Missing preferences mean a legacy account: keep its full workspace available.
export function enabledModules(value:unknown):ModuleId[] {
 if(!Array.isArray(value))return [...MODULE_IDS];
 return MODULE_IDS.filter(id=>value.includes(id));
}
export function pageEnabled(page:string,modules:readonly ModuleId[]) {
 return page==='dashboard'||page==='configuracoes'||modules.includes(page as ModuleId);
}
