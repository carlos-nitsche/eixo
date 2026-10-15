import {useEffect,useRef} from 'react';
import type {CSSProperties} from 'react';
import {Brand} from './Brand';
import './onboarding.css';
export const LAUNCH_DURATION = 2400;
export default function AppLoading({label='Preparando seu espaço',onComplete}:{label?:string;onComplete?:()=>void}) {
 const callback=useRef(onComplete);callback.current=onComplete;
 const completed=useRef(false);
 const finish=()=>{if(completed.current)return;completed.current=true;callback.current?.()};
 useEffect(()=>{
  if(!callback.current)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  // Fallback also releases the screen if animation events are suppressed by the browser.
  const timer=setTimeout(finish,reduced.matches?0:LAUNCH_DURATION+150);
  const change=()=>{if(reduced.matches)finish()};reduced.addEventListener('change',change);
  return()=>{clearTimeout(timer);reduced.removeEventListener('change',change)};
 },[]);
 return <div className={'eixo-loading'+(onComplete?' launch-sequence':'')} style={{'--launch-duration':`${LAUNCH_DURATION}ms`} as CSSProperties} onAnimationEnd={e=>{if(e.target===e.currentTarget&&e.animationName==='eixo-launch-clock')finish()}} role="status" aria-live="polite" aria-label={label}>
  <div className="loading-grid" aria-hidden="true"/>
  <div className="loading-center"><div className="loading-orbit" aria-hidden="true"><i/><i/><i/><div className="loading-mark"><Brand compact/></div></div>
   <div className="loading-wordmark" aria-hidden="true">EIXO<span>UMA VIDA. SEU SISTEMA.</span></div>
   <div className="loading-track" aria-hidden="true"><span/></div><p>{label}<span className="loading-dots" aria-hidden="true">…</span></p>
  </div><small className="loading-caption">Tudo o que importa, no seu ritmo.</small>
 </div>;
}
