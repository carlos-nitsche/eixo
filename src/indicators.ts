export type IndicatorTone='positive'|'negative'|'warning'|'info'|'neutral';
export const balanceTone=(value:number):IndicatorTone=>value>0?'positive':value<0?'negative':'neutral';
export const balanceLabel=(value:number)=>value>0?'Saldo positivo':value<0?'Saldo negativo':'Saldo zerado';
