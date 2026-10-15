import {useEffect,useRef,useState} from 'react';
import {Avatar} from './Brand';
export function ImageUpload({name,imageId,workspaceId,onChange,onBusy,onError}:{name:string;imageId?:string;workspaceId:string;onChange:(id:string)=>void;onBusy:(busy:boolean)=>void;onError:(message:string)=>void}){
 const [busy,setBusy]=useState(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>{controller.current?.abort()},[]);
 const upload=async(file:File|undefined)=>{
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){onError('Escolha JPG, PNG ou WebP de até 5 MB.');return}
  controller.current?.abort();const request=new AbortController();controller.current=request;setBusy(true);onBusy(true);
  try{const r=await fetch('/api/media',{method:'POST',credentials:'same-origin',signal:request.signal,headers:{'Content-Type':file.type,'X-Eixo-Workspace':workspaceId},body:file});const data=await r.json();if(!r.ok)throw Error(data.error||'Falha no envio.');if(!request.signal.aborted)onChange(data.id)}
  catch(e){if(!request.signal.aborted)onError((e as Error).message)}
  finally{if(!request.signal.aborted){setBusy(false);onBusy(false)}}
 };
 return <div className="wide company-upload"><span>Identidade da empresa</span><Avatar name={name} src={imageId?'/api/media/'+imageId:null}/><label>Logo da empresa<input type="file" aria-label="Logo da empresa" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/></label><small role="status">{busy?'Enviando imagem…':'JPG, PNG ou WebP · até 5 MB'}</small>{imageId&&<button type="button" className="text-action" disabled={busy} onClick={()=>onChange('')}>Remover imagem</button>}</div>;
}
