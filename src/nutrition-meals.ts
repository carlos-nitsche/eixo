import type {FoodItem,MealIngredient,NutritionProfile,Restriction,FoodSafety} from './nutrition';
import {assessMeal,styleCompatible} from './nutrition.ts';
export type MealIdea={id:string;title:string;occasion:string;description:string;foods:{foodId:string;grams:number}[];prepMinutes:number};
export const MEAL_IDEAS:MealIdea[]=[
 {id:'prato-brasileiro',title:'Arroz, feijão, frango e salada',occasion:'Almoço / jantar',description:'Ingredientes simples. Verifique temperos, molhos e produtos adicionados.',prepMinutes:30,foods:[{foodId:'taco-3',grams:100},{foodId:'taco-561',grams:100},{foodId:'taco-408',grams:100},{foodId:'taco-78',grams:40}]},
 {id:'arroz-lentilha',title:'Arroz, lentilha e tomate',occasion:'Almoço',description:'Alternativa sem carne, com combinações brasileiras. Ajuste quantidades.',prepMinutes:25,foods:[{foodId:'taco-3',grams:100},{foodId:'taco-577',grams:100},{foodId:'taco-157',grams:50}]},
 {id:'ovos-batata',title:'Ovo cozido, batata e cenoura',occasion:'Almoço / jantar',description:'Preparações de referência prontas; informe temperos reais usados.',prepMinutes:25,foods:[{foodId:'taco-488',grams:100},{foodId:'taco-91',grams:100},{foodId:'taco-110',grams:50}]},
 {id:'frutas-simples',title:'Banana com mamão',occasion:'Lanche',description:'Frutas in natura; cuidado com acompanhamentos e embalagens.',prepMinutes:5,foods:[{foodId:'taco-182',grams:100},{foodId:'taco-226',grams:100}]},
 {id:'frango-batata',title:'Frango, batata e cenoura',occasion:'Almoço / jantar',description:'Sugestão de montagem com itens separados para editar.',prepMinutes:35,foods:[{foodId:'taco-408',grams:100},{foodId:'taco-91',grams:100},{foodId:'taco-109',grams:60}]},
 {id:'feijao-arroz-ovo',title:'Arroz, feijão preto e ovo',occasion:'Almoço / jantar',description:'Combinação de alimentos familiares, adaptável ao seu contexto.',prepMinutes:30,foods:[{foodId:'taco-3',grams:100},{foodId:'taco-567',grams:100},{foodId:'taco-488',grams:50}]},
 {id:'salada-grao',title:'Salada com lentilha',occasion:'Lanche / jantar',description:'Tomate, folhas e lentilha; molhos precisam ser cadastrados à parte.',prepMinutes:20,foods:[{foodId:'taco-577',grams:100},{foodId:'taco-157',grams:80},{foodId:'taco-78',grams:50}]}
];
export type SuggestedMeal={idea:MealIdea;safety:FoodSafety;ingredients:MealIngredient[];missing:boolean};
export function availableIdeas(foods:FoodItem[],profile:NutritionProfile|undefined,restrictions:Restriction[]):SuggestedMeal[]{
 if(!profile)return [];
 return MEAL_IDEAS.flatMap(idea=>{
  if(idea.prepMinutes>profile.prepMinutes)return [];
  const items=idea.foods.map(({foodId,grams})=>({id:foodId,foodId,grams}));
  const found=idea.foods.map(f=>foods.find(x=>x.id===f.foodId));
  if(found.some(x=>!x)||found.some(x=>x&&!styleCompatible(x,profile.style)))return [];
  const safety=assessMeal(items,foods,restrictions);
  // Do not recommend dishes with known conflicting or incomplete ingredient data to allergy users.
  const active=restrictions.some(r=>['allergy','suspected','celiac','medical','intolerance'].includes(r.kind));
  if(safety==='blocked'||(active&&safety==='unverified'))return [];
  return [{idea,safety,ingredients:items,missing:false}];
 });
}
