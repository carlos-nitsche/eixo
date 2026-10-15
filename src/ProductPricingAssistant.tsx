import {useMemo,useState} from 'react';
import {AlertTriangle,ArrowDownRight,ArrowRight,ArrowUpRight,BadgeCheck,Calculator,ChevronDown,Info,Lightbulb,Percent,RotateCcw,ShieldCheck,TrendingUp} from 'lucide-react';
import {analyzePricing,defaultPricingSettings,normalizePricingSettings} from './pricing-utils';
import type {PricingSettings} from './pricing-utils';
import {money} from './erp';
import './product-pricing.css';
type Props={cost:number;price:number;unit:string;settings:PricingSettings;setSettings:(value:PricingSettings)=>void;onApply:(price:number)=>void};
const percent=(n:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n)+'%';
function NumberField({label,value,onChange,help,unit,max=1000000}:{label:string;value:number;onChange:(v:number)=>void;help?:string;unit:'R$'|'%';max?:number}){
 return <label className="epc-field"><span>{label}</span><div className="epc-number"><span aria-hidden>{unit}</span><input aria-label={label} min={0} max={max} type="number" step=".01" inputMode="decimal" value={value} onChange={e=>onChange(e.target.value===''?0:Number(e.target.value))}/></div>{help&&<small>{help}</small>}</label>;
}
export default function ProductPricingAssistant({cost,price,unit,settings,setSettings,onApply}:Props){
 const [expanded,setExpanded]=useState(true);
 const analysis=useMemo(()=>analyzePricing(cost,price,settings),[cost,price,settings]);
 const update=<K extends keyof PricingSettings>(key:K,value:PricingSettings[K])=>setSettings({...settings,[key]:value});
 const currentStatus=analysis.assessment==='loss'?'Prejuízo estimado':analysis.assessment==='below-target'?'Abaixo da meta':analysis.assessment==='healthy'?'Dentro da meta':analysis.assessment==='no-price'?'Preço não definido':'Confira os custos';
 return <section className="epc" aria-label="Assistente de precificação">
  <button className="epc-heading" type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>
   <span className="epc-heading-icon"><Calculator size={19}/></span><span><strong>Assistente de precificação</strong><small>Calcule um preço que considere custos, taxas e o lucro desejado</small></span><ChevronDown size={19} className={expanded?'epc-chevron epc-chevron-open':'epc-chevron'}/>
  </button>
  {expanded&&<div className="epc-body">
   <div className="epc-tip"><Info size={15}/><span>Todos os valores são <b>por {unit||'unidade'}</b>. O custo de compra vem do cadastro acima. Informe as despesas e percentuais que realmente se aplicam à sua operação.</span></div>
   <div className="epc-subheading"><span>01</span><div><strong>Custo total por unidade</strong><small>O que você gasta para colocar o item à venda</small></div></div>
   <div className="epc-fields">
    <div className="epc-linked-cost"><span>Custo de aquisição</span><strong>{money(cost)}</strong><small>Vinculado ao campo “Custo de compra” do produto.</small></div>
    <NumberField label="Frete rateado (R$)" value={settings.freight} onChange={v=>update('freight',v)} unit="R$" help="Frete total dividido pela quantidade"/>
    <NumberField label="Embalagem (R$)" value={settings.packaging} onChange={v=>update('packaging',v)} unit="R$"/>
    <NumberField label="Outros custos (R$)" value={settings.other} onChange={v=>update('other',v)} unit="R$" help="Ex.: etiqueta, preparação, insumos"/>
   </div>
   <div className="epc-subheading"><span>02</span><div><strong>Taxas e despesas da venda</strong><small>Percentuais sobre o preço cobrado do cliente</small></div></div>
   <div className="epc-fields">
    <NumberField label="Tributos estimados (%)" value={settings.taxPercent} onChange={v=>update('taxPercent',v)} unit="%" max={99} help="Use a alíquota efetiva aplicável"/>
    <NumberField label="Taxa do pagamento (%)" value={settings.paymentPercent} onChange={v=>update('paymentPercent',v)} unit="%" max={99} help="Cartão, marketplace etc."/>
    <NumberField label="Despesas operacionais (%)" value={settings.operatingPercent} onChange={v=>update('operatingPercent',v)} unit="%" max={99} help="Rateio de comissões e despesas"/>
    <div className="epc-rate-total"><span>Taxas e despesas percentuais</span><strong>{percent(analysis.feePercent)}</strong><small>Descontadas do valor da venda</small></div>
   </div>
   <div className="epc-subheading"><span>03</span><div><strong>Seu objetivo de resultado</strong><small>Margem e markup representam cálculos diferentes</small></div></div>
   <div className="epc-target">
    <div className="epc-segments" role="group" aria-label="Método de precificação">
     <button type="button" aria-pressed={settings.goalType==='margin'} className={settings.goalType==='margin'?'selected':''} onClick={()=>update('goalType','margin')}>Margem sobre venda</button>
     <button type="button" aria-pressed={settings.goalType==='markup'} className={settings.goalType==='markup'?'selected':''} onClick={()=>update('goalType','markup')}>Markup sobre custo</button>
    </div>
    <NumberField label={settings.goalType==='margin'?'Margem desejada (%)':'Markup desejado (%)'} value={settings.targetPercent} onChange={v=>update('targetPercent',v)} unit="%" max={99}/>
   </div>
   <p className="epc-explainer">{settings.goalType==='margin'?'Margem = lucro estimado ÷ preço final.':'Markup = lucro estimado ÷ custo total unitário.'} Ambos consideram as taxas e despesas informadas. Não confunda 30% de margem com 30% de markup.</p>
   <div className="epc-rounding"><span>Arredondamento do preço</span><div role="group" aria-label="Arredondamento">{([['cent','Centavos'],['90','Terminar em ,90'],['99','Terminar em ,99']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={settings.rounding===key} className={settings.rounding===key?'selected':''} onClick={()=>update('rounding',key)}>{label}</button>)}</div></div>
   {!analysis.valid?<div className="epc-warning" role="status"><AlertTriangle size={18}/><span>{analysis.message}</span></div>:<>
    <div className="epc-result">
     <div><div className="epc-eyebrow"><Lightbulb size={16}/> PREÇO SUGERIDO POR {unit||'UNIDADE'}</div><strong className="epc-value">{money(analysis.suggestedPrice)}</strong><p>Estimativa para alcançar {percent(settings.targetPercent)} de {settings.goalType==='margin'?'margem sobre a venda':'markup sobre o custo'}.</p><div className="epc-result-summary"><span>Custo completo <b>{money(analysis.fixedCosts)}</b></span><span>Ponto de equilíbrio <b>{money(analysis.minimumPrice)}</b></span></div></div>
     <button type="button" className="epc-apply" onClick={()=>analysis.suggestedPrice!==null&&onApply(analysis.suggestedPrice)}><ArrowRight size={16}/> Aplicar preço sugerido</button>
    </div>
    <div className="epc-compare">
     <div><span>Preço digitado</span><strong>{price>0?money(price):'Não definido'}</strong>{analysis.current&&<small className={analysis.assessment==='loss'?'epc-negative':analysis.assessment==='healthy'?'epc-positive':'epc-caution'}>{analysis.assessment==='healthy'?<BadgeCheck size={13}/>:analysis.assessment==='loss'?<ArrowDownRight size={13}/>:<AlertTriangle size={13}/>} {currentStatus}</small>}</div>
     <div><span>Lucro estimado por {unit||'unidade'}</span><strong className={analysis.current&&analysis.current.profit<0?'epc-negative':''}>{analysis.current?money(analysis.current.profit):'—'}</strong><small>{analysis.current?percent(analysis.current.marginPercent)+' de margem · '+percent(analysis.current.markupPercent)+' markup':'Informe um preço de venda'}</small></div>
     <div><span>Lucro com preço sugerido</span><strong>{money(analysis.recommended?.profit)}</strong><small>Margem: {percent(analysis.recommended?.marginPercent||0)}</small></div>
    </div>
    {analysis.current&&<div className="epc-risk"><div><strong>Teste de desconto</strong><small>Quanto sobraria de lucro por unidade?</small></div><span className={analysis.discount5!.profit<0?'epc-negative':''}>–5% <b>{money(analysis.discount5!.profit)}</b></span><span className={analysis.discount10!.profit<0?'epc-negative':''}>–10% <b>{money(analysis.discount10!.profit)}</b></span></div>}
   </>}
   <div className="epc-footer"><ShieldCheck size={15}/><p>Simulação gerencial: não substitui análise tributária ou contábil. Não altera o estoque nem o valor do produto até você clicar em <b>Aplicar preço sugerido</b> e depois <b>Salvar registro</b>.</p></div>
  </div>}
 </section>;
}
