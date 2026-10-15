export type NutrientKey='kcal'|'protein'|'carbs'|'fat'|'fiber'|'sodiumMg';
export type Nutrients=Record<NutrientKey,number|null>;
export type FoodItem={
 id:string;name:string;category:string;source:string;sourceId?:string;referenceUnit:'g'|'ml';
 per100:Nutrients;allergens:string[];ingredientStatus:'single'|'unverified'|'declared';
 aliases:string[];workspaceId?:string;brand?:string;ingredients?:string[];userProvided?:boolean;
};
export type NutritionObjective='equilibrio'|'apoio-treino'|'ganho-gradual'|'manutencao'|'habitos';
export type EatingStyle='onivoro'|'vegetariano'|'vegano'|'pescetariano'|'sem-porco';
export type NutritionProfile={
 workspaceId:string;objective:NutritionObjective;style:EatingStyle;mealsPerDay:number;
 prepMinutes:number;budgetBRL?:number;preferences:string[];dislikes:string[];
 useTraining:boolean;showNumbers:boolean;age?:number;heightCm?:number;weightKg?:number;
 manualGoals?:Partial<Record<NutrientKey,number>>;
 updatedAt:string;
};
export type RestrictionKind='allergy'|'suspected'|'intolerance'|'celiac'|'medical'|'ethical'|'preference';
export type Restriction={id:string;workspaceId:string;kind:RestrictionKind;allergen:string;label:string;notes?:string;source:'self'|'professional'|'unspecified';severity?:'unspecified'|'mild'|'severe';updatedAt:string};
export type MealIngredient={id:string;foodId:string;grams:number};
export type MealSlot='Café da manhã'|'Lanche'|'Almoço'|'Lanche da tarde'|'Jantar'|'Ceia'|'Pré-treino'|'Pós-treino'|'Outra refeição';
export type Meal={id:string;workspaceId:string;date:string;slot:MealSlot;title:string;ingredients:MealIngredient[];status:'planned'|'consumed';createdAt:string;sourceTemplateId?:string};
export type Recipe={id:string;workspaceId:string;title:string;ingredients:MealIngredient[];instructions:string;prepMinutes:number;favorite?:boolean;createdAt:string};
export type ShoppingCheck={workspaceId:string;foodId:string;checked:boolean};
export type RestrictionAudit={id:string;workspaceId:string;at:string;operation:'added'|'updated'|'removed';kind:RestrictionKind;allergen:string};
export type NutritionData={version:1;profiles:NutritionProfile[];restrictions:Restriction[];foods:FoodItem[];meals:Meal[];recipes:Recipe[];favorites:{workspaceId:string;foodId:string}[];shoppingChecks:ShoppingCheck[];restrictionAudit:RestrictionAudit[]};
export const emptyNutrition=():NutritionData=>({version:1,profiles:[],restrictions:[],foods:[],meals:[],recipes:[],favorites:[],shoppingChecks:[],restrictionAudit:[]});
const isRecord=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const validStrings=(v:unknown):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'):[];
const recordList=(v:unknown):Record<string,unknown>[]=>Array.isArray(v)?v.filter(isRecord):[];
const nutritionKeys:NutrientKey[]=['kcal','protein','carbs','fat','fiber','sodiumMg'];
const safeNutrients=(v:unknown):Nutrients=>{
 const input=isRecord(v)?v:{};
 return Object.fromEntries(nutritionKeys.map(key=>[key,typeof input[key]==='number'&&Number.isFinite(input[key])&&(input[key] as number)>=0?input[key]:null])) as Nutrients;
};
const safeIngredients=(v:unknown):MealIngredient[]=>
 recordList(v).filter(x=>typeof x.foodId==='string'&&typeof x.id==='string'&&validGrams(x.grams as number))
 .map(x=>({id:x.id as string,foodId:x.foodId as string,grams:x.grams as number}));
export function parseNutrition(raw?:Partial<NutritionData>|null):NutritionData{
 if(!raw||!isRecord(raw))return emptyNutrition();
 const profiles=recordList(raw.profiles).filter(p=>typeof p.workspaceId==='string').map(p=>({
  ...p,preferences:validStrings(p.preferences),dislikes:validStrings(p.dislikes),
  objective:(Object.keys(NUTRITION_OBJECTIVES).includes(String(p.objective))?p.objective:'equilibrio'),
  style:(Object.keys(EATING_STYLES).includes(String(p.style))?p.style:'onivoro'),
  mealsPerDay:Number.isInteger(p.mealsPerDay)&&Number(p.mealsPerDay)>=1&&Number(p.mealsPerDay)<=9?p.mealsPerDay:3,
  prepMinutes:typeof p.prepMinutes==='number'&&Number.isFinite(p.prepMinutes)?p.prepMinutes:30,
  useTraining:p.useTraining===true,showNumbers:p.showNumbers===true,
  updatedAt:typeof p.updatedAt==='string'?p.updatedAt:''
 })) as NutritionProfile[];
 const foods=recordList(raw.foods).filter(f=>typeof f.id==='string'&&typeof f.name==='string').map(f=>({
  ...f,aliases:validStrings(f.aliases),allergens:validStrings(f.allergens),
  ingredients:f.ingredients===undefined?undefined:validStrings(f.ingredients),per100:safeNutrients(f.per100),
  ingredientStatus:['single','declared'].includes(String(f.ingredientStatus))?f.ingredientStatus:'unverified',
  category:typeof f.category==='string'?f.category:'Meus alimentos',
  source:typeof f.source==='string'?f.source:'Origem não informada',referenceUnit:f.referenceUnit==='ml'?'ml':'g'
 })) as FoodItem[];
 const restrictions=recordList(raw.restrictions).filter(r=>typeof r.id==='string'&&typeof r.workspaceId==='string')
 .map(r=>({...r,allergen:typeof r.allergen==='string'?r.allergen:'outro',
  label:typeof r.label==='string'?r.label:'Restrição sem rótulo',
  kind:['allergy','suspected','intolerance','celiac','medical','ethical','preference'].includes(String(r.kind))?r.kind:'suspected'
 })) as Restriction[];
 const meals=recordList(raw.meals).filter(m=>typeof m.id==='string'&&typeof m.workspaceId==='string')
 .map(m=>({...m,ingredients:safeIngredients(m.ingredients),status:m.status==='consumed'?'consumed':'planned',
   title:typeof m.title==='string'?m.title:'Refeição antiga',date:typeof m.date==='string'?m.date:''})) as Meal[];
 const recipes=recordList(raw.recipes).filter(r=>typeof r.id==='string'&&typeof r.workspaceId==='string')
 .map(r=>({...r,ingredients:safeIngredients(r.ingredients),title:typeof r.title==='string'?r.title:'Receita antiga'})) as Recipe[];
 return {version:1,profiles,restrictions,foods,meals,recipes,
  favorites:recordList(raw.favorites).filter(x=>typeof x.workspaceId==='string'&&typeof x.foodId==='string') as NutritionData['favorites'],
  shoppingChecks:recordList(raw.shoppingChecks).filter(x=>typeof x.workspaceId==='string'&&typeof x.foodId==='string') as NutritionData['shoppingChecks'],
  restrictionAudit:recordList(raw.restrictionAudit).filter(x=>typeof x.id==='string'&&typeof x.workspaceId==='string') as RestrictionAudit[]};
}
export const ALLERGEN_OPTIONS=[
 ['leite','Leite e proteína do leite'],['lactose','Lactose (intolerância)'],['ovo','Ovos'],['amendoim','Amendoim'],
 ['soja','Soja'],['trigo','Trigo'],['gluten','Glúten / doença celíaca'],['peixe','Peixes'],
 ['crustaceo','Crustáceos'],['molusco','Moluscos'],['castanhas','Castanhas / nozes'],['gergelim','Gergelim'],
 ['outro','Outro ingrediente']
] as const;
export const NUTRITION_OBJECTIVES:Record<NutritionObjective,string>={
 equilibrio:'Refeições equilibradas', 'apoio-treino':'Organizar alimentação e treino','ganho-gradual':'Apoiar ganho de massa gradual',manutencao:'Manutenção',habitos:'Melhores hábitos'
};
export const EATING_STYLES:Record<EatingStyle,string>={
 onivoro:'Onívoro',vegetariano:'Vegetariano',vegano:'Vegano',pescetariano:'Pescetariano','sem-porco':'Sem carne suína'
};
export const MEAL_SLOTS:MealSlot[]=['Café da manhã','Lanche','Almoço','Lanche da tarde','Jantar','Ceia','Pré-treino','Pós-treino','Outra refeição'];
export const nowDate=()=>{const date=new Date();return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')};
export const moveDate=(ymd:string,days:number)=>{const d=new Date(ymd+'T12:00:00');d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
export const sanitizeName=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const validGrams=(value:number)=>Number.isFinite(value)&&value>0&&value<=5000;
const KEYS:NutrientKey[]=['kcal','protein','carbs','fat','fiber','sodiumMg'];
export function scaleNutrients(food:FoodItem,grams:number):Nutrients{
 if(!validGrams(grams))throw Error('Quantidade deve estar entre 0 e 5000 g.');
 return Object.fromEntries(KEYS.map(key=>[key,typeof food.per100[key]==='number'&&Number.isFinite(food.per100[key])?Math.round(food.per100[key]*grams/100*100)/100:null])) as Nutrients;
}
export function sumNutrition(ingredients:MealIngredient[],library:FoodItem[]):Nutrients{
 const sums:Object=Object.fromEntries(KEYS.map(key=>[key,0]));const result=sums as Nutrients;
 if(!ingredients.length)return Object.fromEntries(KEYS.map(key=>[key,null])) as Nutrients;
 for(const ingredient of ingredients){
  const food=library.find(x=>x.id===ingredient.foodId);
  if(!food||!validGrams(ingredient.grams)){for(const key of KEYS)result[key]=null;continue;}
  const per=scaleNutrients(food,ingredient.grams);
  for(const key of KEYS){
   const value=per[key];
   result[key]=result[key]===null||value===null?null:Math.round(((result[key]||0)+value)*100)/100;
  }
 }
 return result;
}
export const validateProfile=(p:NutritionProfile):string[]=>{
 const errors:string[]=[];
 if(!NUTRITION_OBJECTIVES[p.objective])errors.push('Objetivo inválido.');
 if(!EATING_STYLES[p.style])errors.push('Estilo alimentar inválido.');
 if(!Number.isInteger(p.mealsPerDay)||p.mealsPerDay<1||p.mealsPerDay>9)errors.push('Informe de 1 a 9 refeições por dia.');
 if(!Number.isFinite(p.prepMinutes)||p.prepMinutes<0||p.prepMinutes>240)errors.push('Tempo de preparo inválido.');
 if(p.budgetBRL!==undefined&&(!Number.isFinite(p.budgetBRL)||p.budgetBRL<0))errors.push('Orçamento inválido.');
 if(p.age!==undefined&&(!Number.isInteger(p.age)||p.age<18||p.age>120))errors.push('Idade deve estar entre 18 e 120 anos.');
 if(p.heightCm!==undefined&&(!Number.isFinite(p.heightCm)||p.heightCm<100||p.heightCm>250))errors.push('Altura fora do intervalo esperado.');
 if(p.weightKg!==undefined&&(!Number.isFinite(p.weightKg)||p.weightKg<20||p.weightKg>500))errors.push('Peso fora do intervalo esperado.');
 for(const [key,value] of Object.entries(p.manualGoals||{})){if(value!==undefined&&(!Number.isFinite(value)||value<0||value>100000))errors.push('Meta manual inválida: '+key+'.');}
 return errors;
};
export function foodSearch(foods:FoodItem[],query:string,category=''):FoodItem[]{
 const q=sanitizeName(query);return foods.filter(food=>(!category||food.category===category)&&(!q||sanitizeName([food.name,...food.aliases].join(' ')).includes(q)));
}
export type FoodSafety='blocked'|'unverified'|'review';
const detectedTerms:Record<string,string[]>={
 leite:['leite','queijo','iogurte','caseina','soro de leite','manteiga','requeijao','ricota','coalhada','sorvete'],
 lactose:['leite','iogurte','creme de leite','lactose','queijo','requeijao','ricota','coalhada','sorvete'],ovo:['ovo','ovos','albumina'],
 soja:['soja','tofu','proteina de soja'],amendoim:['amendoim'],
 trigo:['trigo','farinha de trigo'],gluten:['trigo','cevada','centeio','malte'],
 peixe:['peixe','atum','sardinha','tilapia','salmao','bacalhau'],crustaceo:['camarao','lagosta','caranguejo'],
 molusco:['ostra','mexilhao','lula','polvo'],castanhas:['castanha','noz','nozes','amendoa','pistache','avela'],
 gergelim:['gergelim']
};
export function blockedKeys(restrictions:Restriction[]):string[]{
 return [...new Set(restrictions.filter(r=>['allergy','suspected','intolerance','celiac','medical','ethical','preference'].includes(r.kind)).flatMap(r=>r.kind==='celiac'?['gluten',r.allergen]:[r.allergen]))];
}
export function assessFood(food:FoodItem,restrictions:Restriction[]):FoodSafety{
 const words=sanitizeName([food.name,...(food.ingredients||[]),...food.aliases].join(' '));
 const allergies=food.allergens||[];
 for(const r of restrictions){
  if(!['allergy','suspected','intolerance','celiac','medical','ethical','preference'].includes(r.kind))continue;
  const keys=r.kind==='celiac'?['gluten',r.allergen]:[r.allergen];
  for(const key of keys){
   const label=key==='outro'?sanitizeName(r.label||''):'';
   const customMatch=label.length>0&&(' '+words+' ').includes(' '+label+' ');
   const direct=allergies.includes(key)||(key==='lactose'&&allergies.includes('leite'))||
    (key==='gluten'&&allergies.includes('trigo'))||(key==='trigo'&&allergies.includes('gluten'));
   const patterns=(detectedTerms[key]||[]).some(term=>new RegExp('(^|[^a-z])'+term+'([^a-z]|$)').test(words));
   if(direct||customMatch||patterns)return 'blocked';
  }
 }
 // An allergen field inferred from a food name never certifies ingredient completeness or absence of cross contact.
 return food.ingredientStatus==='single'?'review':'unverified';
}
export function assessMeal(ingredients:MealIngredient[],foods:FoodItem[],restrictions:Restriction[]):FoodSafety{
 let unknown=false;
 for(const item of ingredients){const food=foods.find(f=>f.id===item.foodId);if(!food){unknown=true;continue;}const assessment=assessFood(food,restrictions);if(assessment==='blocked')return 'blocked';if(assessment==='unverified')unknown=true;}
 return unknown||!ingredients.length?'unverified':'review';
}
export function styleCompatible(food:FoodItem,style:EatingStyle):boolean{
 const name=sanitizeName([food.name,...(food.ingredients||[])].join(' '));const category=sanitizeName(food.category);
 const meat=/carnes|peixes|pescados|aves/.test(category)||/frango|bovina|porco|suina|peru|carne/.test(name);
 const fish=/peixe|pescados/.test(category)||/atum|sardinha|salmao|tilapia|camarao/.test(name);
 const animal=meat||fish||/leite|laticinio|ovo/.test(category)||/queijo|leite|iogurte|manteiga|ovo|caseina|mel|gelatina/.test(name);
 if(style==='vegano'&&animal)return false;
 if(style==='vegetariano'&&(meat||fish))return false;
 if(style==='pescetariano'&&meat&&!fish)return false;
 if(style==='sem-porco'&&/porco|suino|bacon|presunto/.test(name))return false;
 return true;
}
export type FoodSuggestion={food:FoodItem;reason:string;safety:FoodSafety};
export function suggestFoods(foods:FoodItem[],profile:NutritionProfile|undefined,restrictions:Restriction[],limit=8):FoodSuggestion[]{
 if(!profile)return [];
 const dislike=profile.dislikes.map(sanitizeName);
 const severe=restrictions.some(r=>['allergy','suspected','celiac','intolerance','medical'].includes(r.kind));
 const categories:Record<NutritionObjective,string[]>={
  equilibrio:['Frutas','Verduras e legumes','Leguminosas','Cereais','Peixes e frutos do mar','Carnes'],
  'apoio-treino':['Leguminosas','Cereais','Carnes','Ovos','Frutas','Verduras e legumes'],
  'ganho-gradual':['Leguminosas','Carnes','Ovos','Cereais','Laticínios','Frutas'],
  manutencao:['Verduras e legumes','Leguminosas','Frutas','Cereais','Carnes','Ovos'],
  habitos:['Frutas','Verduras e legumes','Leguminosas','Cereais','Carnes','Ovos']
 };
 const ranked=foods.filter(f=>(profile.style==='onivoro'||f.ingredientStatus==='single')&&styleCompatible(f,profile.style)&&!dislike.some(term=>term&&sanitizeName(f.name).includes(term)))
 .map(f=>({food:f,safety:assessFood(f,restrictions),reason:'Objetivo: '+NUTRITION_OBJECTIVES[profile.objective]+'. Estilo: '+EATING_STYLES[profile.style].toLowerCase()+'. '+(profile.useTraining?'Rotina de treino considerada como preferência organizacional. ':'')+'Confira ingredientes, fabricante e rótulos. Dados: '+f.source}))
 .filter(s=>s.safety!=='blocked'&&(!severe||s.safety==='review'))
 .sort((a,b)=>{
  const preference=(f:FoodItem)=>profile.preferences.some(p=>p&&sanitizeName(f.name).includes(sanitizeName(p)))?2:0;
  const score=(s:FoodSuggestion)=>preference(s.food)+(s.safety==='review'?1:0);
  return score(b)-score(a)||a.food.name.localeCompare(b.food.name,'pt-BR');
 });
 const output:FoodSuggestion[]=[];
 const requested=categories[profile.objective]||categories.equilibrio;
 for(const group of requested){
  const selected=ranked.find(s=>s.food.category===group&&!output.includes(s));
  if(selected)output.push(selected);
  if(output.length>=limit)return output;
 }
 for(const candidate of ranked){if(!output.includes(candidate))output.push(candidate);if(output.length>=limit)break;}
 return output;
}
export function shoppingFor(meals:Meal[],from:string,to:string,workspaceId:string,foods:FoodItem[]){
 const grouped=new Map<string,number>();
 meals.filter(m=>m.workspaceId===workspaceId&&m.status==='planned'&&m.date>=from&&m.date<=to).forEach(meal=>meal.ingredients.forEach(item=>{if(foods.some(f=>f.id===item.foodId)&&validGrams(item.grams))grouped.set(item.foodId,(grouped.get(item.foodId)||0)+item.grams)}));
 return [...grouped].map(([foodId,grams])=>({foodId,grams,food:foods.find(f=>f.id===foodId)!})).sort((a,b)=>a.food.category.localeCompare(b.food.category)||a.food.name.localeCompare(b.food.name));
}

/** Escapes CSV cells and prevents Excel/Sheets formula injection from user-entered names. */
export function safeCsvCell(raw:string):string{
 const dangerous=/^[\s\u0000-\u001f]*[=+\-@]/.test(raw);
 const text=(dangerous?"'":"")+raw;
 return '"'+text.replace(/"/g,'""')+'"';
}
