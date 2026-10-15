/** Marca vetorial EIXO: quatro conexões em torno de um centro comum. */
export function Brand({compact=false}:{compact?:boolean}) {
 return <span className="eixo-brand" aria-label="EIXO OS"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 6h15v9H15v6H6zM27 6h15v15h-9v-6h-6zM42 27v15H27v-9h6v-6zM21 42H6V27h9v6h6z" fill="currentColor"/><path d="m24 17 7 7-7 7-7-7z" fill="var(--accent)"/></svg>{!compact&&<><b>EIXO</b><small>OS</small></>}</span>;
}
export function Avatar({name,src,className=''}:{name:string;src?:string|null;className?:string}) {
 return <span className={'identity-avatar '+className}>{src?<img src={src} alt="" onError={e=>{e.currentTarget.hidden=true}}/>:null}<span aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'EU'}</span></span>;
}
