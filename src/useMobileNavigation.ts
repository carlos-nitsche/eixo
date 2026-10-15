import {useCallback,useEffect,useRef,useState} from 'react';
import {lockPageScroll} from './scrollLock';

/** Edge-only gestures; horizontal intent must win before preventing scroll. */
export function useMobileNavigation() {
 const [open,update]=useState(false);
 const drawer=useRef<HTMLElement>(null);
 const isOpen=useRef(false);
 const close=useCallback(()=>{
  isOpen.current=false; update(false);
  if(history.state?.eixoDrawer) history.back();
 },[]);
 const setOpen=useCallback((value:boolean)=>{
  if(!value){close();return}
  if(!isOpen.current){history.pushState({...history.state,eixoDrawer:true},'');isOpen.current=true;update(true)}
 },[close]);
 useEffect(()=>{
  const back=()=>{isOpen.current=false;update(false)};
  const media=matchMedia('(max-width: 1023px)');
  const resize=()=>{if(!media.matches)close()};
  window.addEventListener('popstate',back);media.addEventListener('change',resize);
  let start:{x:number;y:number;dx:number;active:boolean;opening:boolean}|null=null;
  const down=(e:TouchEvent)=>{
   if(!media.matches||e.touches.length!==1||document.querySelector('[role="dialog"][aria-modal="true"],.overlay,.erp-overlay'))return;
   const t=e.touches[0],target=e.target as HTMLElement;
   if(!isOpen.current&&(t.clientX<8||t.clientX>32||target.closest('input,select,textarea,[data-horizontal],.erp-nav,.table-wrap,.erp-table-scroll,.recharts-wrapper')))return;
   start={x:t.clientX,y:t.clientY,dx:0,active:false,opening:!isOpen.current};
  };
  const move=(e:TouchEvent)=>{
   if(!start||e.touches.length!==1){start=null;return}
   const dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;
   if(!start.active){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){start=null;return}if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.4)return;start.active=true}
   if(e.cancelable)e.preventDefault();start.dx=dx;
   if(drawer.current){const w=drawer.current.offsetWidth;drawer.current.style.transition='none';drawer.current.style.transform=`translateX(${start.opening?Math.min(0,-w+Math.max(0,dx)):Math.min(0,Math.max(-w,dx))}px)`}
  };
  const reset=()=>{if(drawer.current){drawer.current.style.removeProperty('transform');drawer.current.style.removeProperty('transition')}};
  const up=()=>{if(start?.active){if(start.opening&&start.dx>64)setOpen(true);else if(!start.opening&&start.dx< -64)close()}start=null;reset()};
  const cancel=()=>{start=null;reset()};
  document.addEventListener('touchstart',down,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',up);document.addEventListener('touchcancel',cancel);
  return()=>{window.removeEventListener('popstate',back);media.removeEventListener('change',resize);document.removeEventListener('touchstart',down);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',up);document.removeEventListener('touchcancel',cancel)};
 },[close,setOpen]);
 useEffect(()=>{
  if(!open)return;
  const el=drawer.current,previous=document.activeElement as HTMLElement;
  const main=document.querySelector<HTMLElement>('.main-wrap');if(main)main.inert=true;
  const unlock=lockPageScroll();
  el?.querySelector<HTMLElement>('button')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){
   const nodes=Array.from(el?.querySelectorAll<HTMLElement>('button,select,[href]')||[]).filter(n=>n.offsetParent!==null&&!n.hasAttribute('disabled'));
   const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
  }};
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);if(main)main.inert=false;unlock();if(!document.querySelector('[role="dialog"][aria-modal="true"]'))previous?.focus({preventScroll:true})};
 },[open,close]);
 return {navOpen:open,setNavOpen:setOpen,drawer};
}
