import {useEffect,useState} from 'react';
import type {InputHTMLAttributes} from 'react';
/** Allows deleting/retyping controlled numeric fields without coercing blank to zero. */
export default function TrainingNumber(props:InputHTMLAttributes<HTMLInputElement>){
 const [draft,setDraft]=useState(String(props.value??''));
 useEffect(()=>setDraft(String(props.value??'')),[props.value]);
 const valid=(s:string)=>s!==''&&Number.isFinite(Number(s))&&Number(s)>=Number(props.min??0)&&Number(s)<=Number(props.max??100000)&&(props.step==='any'||props.step!==undefined&&Number(props.step)<1||Number.isInteger(Number(s)));
 return <input {...props} type="number" inputMode={props.step==='any'||Number(props.step)<1?'decimal':'numeric'} value={draft} aria-invalid={draft!==''&&!valid(draft)||undefined} onChange={e=>{setDraft(e.target.value);if(valid(e.target.value))props.onChange?.(e)}} onBlur={e=>{if(!valid(draft))setDraft(String(props.value??''));props.onBlur?.(e)}}/>;
}
