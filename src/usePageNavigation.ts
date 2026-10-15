import {useCallback,useEffect,useState} from 'react';
export function usePageNavigation<T extends string>(pages:readonly T[],fallback:T){
 const read=()=>{const raw=location.hash.slice(1).split('/')[0];const value=(raw==='cerebro'?'estudos':raw) as T;return pages.includes(value)?value:fallback};
 const [page,update]=useState<T>(read);
 const navigate=useCallback((next:T)=>{
  if(location.hash!==`#${next}`){const method=history.state?.eixoDrawer?'replaceState':'pushState';history[method]({eixoPage:next},'',`#${next}`)}
  update(next);
 },[]);
 useEffect(()=>{const back=()=>update(read());window.addEventListener('popstate',back);window.addEventListener('hashchange',back);return()=>{window.removeEventListener('popstate',back);window.removeEventListener('hashchange',back)}},[]);
 return [page,navigate] as const;
}
