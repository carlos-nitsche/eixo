/**
 * EIXO · Precificação gerencial (por unidade).
 * Os percentuais são estimativas informadas pelo operador, NÃO regras fiscais automáticas.
 */
export type PriceGoal='margin'|'markup';
export type PriceRounding='cent'|'90'|'99';
export type PricingSettings={
 freight:number;packaging:number;other:number;
 taxPercent:number;paymentPercent:number;operatingPercent:number;
 goalType:PriceGoal;targetPercent:number;rounding:PriceRounding;
};
export type PriceScenario={price:number;netRevenue:number;percentageCosts:number;fixedCosts:number;profit:number;marginPercent:number;markupPercent:number};
export type PricingAnalysis={
 valid:boolean;message:string;fixedCosts:number;feePercent:number;goalType:PriceGoal;targetPercent:number;
 suggestedPrice:number|null;minimumPrice:number|null;
 current:PriceScenario|null;recommended:PriceScenario|null;
 discount5:PriceScenario|null;discount10:PriceScenario|null;
 assessment:'no-price'|'loss'|'below-target'|'healthy'|'not-calculable';
};
export const defaultPricingSettings:PricingSettings={
 freight:0,packaging:0,other:0,taxPercent:0,paymentPercent:0,operatingPercent:0,
 goalType:'margin',targetPercent:30,rounding:'cent'
};
const cash=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const upward=(value:number)=>Math.ceil((value-1e-9)*100)/100;
const sensible=(value:unknown,limit:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=limit;
export function normalizePricingSettings(value:unknown):PricingSettings{
 if(!value||typeof value!=='object'||Array.isArray(value))return {...defaultPricingSettings};
 const x=value as Record<string,unknown>;
 const get=(key:keyof PricingSettings,limit:number,fallback:number)=>sensible(x[key],limit)?Number(x[key]):fallback;
 return {
  freight:get('freight',1e6,0),packaging:get('packaging',1e6,0),other:get('other',1e6,0),
  taxPercent:get('taxPercent',99,0),paymentPercent:get('paymentPercent',99,0),operatingPercent:get('operatingPercent',99,0),
  goalType:x.goalType==='markup'?'markup':'margin',targetPercent:get('targetPercent',99,30),
  rounding:x.rounding==='90'||x.rounding==='99'?x.rounding:'cent'
 };
}
export function roundSuggestedPrice(amount:number,rounding:PriceRounding):number{
 if(!Number.isFinite(amount)||amount<0)return NaN;
 const base=upward(amount);
 if(rounding==='cent')return base;
 const end=rounding==='90'?.9:.99;
 const integer=Math.floor(base);
 return cash(integer+end+(base>integer+end+1e-9?1:0));
}
export function priceScenario(salePrice:number,fixedCosts:number,feePercent:number):PriceScenario{
 const price=cash(salePrice),percentageCosts=cash(price*feePercent/100);
 const profit=cash(price-percentageCosts-fixedCosts);
 return {price,percentageCosts,fixedCosts:cash(fixedCosts),netRevenue:cash(price-percentageCosts),
  profit,marginPercent:price>0?cash(profit/price*100):0,markupPercent:fixedCosts>0?cash(profit/fixedCosts*100):0};
}
export function analyzePricing(unitCost:number,price:number,settings:PricingSettings):PricingAnalysis{
 const fixedCosts=cash(unitCost+settings.freight+settings.packaging+settings.other);
 const feePercent=settings.taxPercent+settings.paymentPercent+settings.operatingPercent;
 const goal=settings.targetPercent;
 const fields=[unitCost,price,settings.freight,settings.packaging,settings.other];
 const percentages=[settings.taxPercent,settings.paymentPercent,settings.operatingPercent,settings.targetPercent];
 const base={fixedCosts,feePercent:cash(feePercent),goalType:settings.goalType,targetPercent:goal,suggestedPrice:null,minimumPrice:null,current:null,recommended:null,discount5:null,discount10:null,assessment:'not-calculable' as PricingAnalysis['assessment']};
 if(fields.some(n=>!sensible(n,1e9))||percentages.some(n=>!sensible(n,99)))return {...base,valid:false,message:'Informe valores positivos e percentuais entre 0 e 99%.'};
 if(fixedCosts<=0)return {...base,valid:false,message:'Informe o custo de aquisição ou outras despesas para calcular a precificação.'};
 if(feePercent>=100)return {...base,valid:false,message:'Taxas e despesas percentuais somam 100% ou mais. Não há preço viável.'};
 const denom=settings.goalType==='margin'?1-feePercent/100-goal/100:1-feePercent/100;
 if(denom<=0)return {...base,valid:false,message:'A soma da margem desejada com taxas e despesas chega a 100% ou mais. Reduza esses percentuais.'};
 const minimumPrice=upward(fixedCosts/(1-feePercent/100));
 const theoretical=settings.goalType==='margin'?fixedCosts/denom:fixedCosts*(1+goal/100)/denom;
 const suggestedPrice=roundSuggestedPrice(theoretical,settings.rounding);
 if(!Number.isFinite(suggestedPrice)||suggestedPrice>1e9)return {...base,valid:false,message:'Preço calculado excede o limite suportado. Revise os custos e percentuais.'};
 const current=price>0?priceScenario(price,fixedCosts,feePercent):null;
 const recommended=priceScenario(suggestedPrice,fixedCosts,feePercent);
 const discount5=current?priceScenario(price*.95,fixedCosts,feePercent):null,discount10=current?priceScenario(price*.9,fixedCosts,feePercent):null;
 const reached=current&&(settings.goalType==='margin'?current.marginPercent>=goal-.011:current.markupPercent>=goal-.011);
 const assessment:PricingAnalysis['assessment']=!current?'no-price':current.profit<-.001?'loss':!reached?'below-target':'healthy';
 return {...base,valid:true,message:'Cálculo estimado por unidade, com os percentuais informados.',minimumPrice,suggestedPrice,current,recommended,discount5,discount10,assessment};
}
