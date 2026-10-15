// EIXO OS 0.8 — local microphone recording and on-device speech recognition, browser only.
// No remote STT endpoints, uploads, SpeechRecognition without processLocally or third-party APIs.
import {useCallback,useEffect,useRef,useState} from 'react';

type VoiceMode='idle'|'checking'|'dictating'|'recording'|'preview';
export type LocalAudioNote={url:string;seconds:number;mimeType:string};
type RecognizerResult={resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string}>>};
type LocalRecognizer={lang:string;processLocally:boolean;continuous:boolean;interimResults:boolean;onresult:((event:RecognizerResult)=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type LocalRecognizerConstructor={new():LocalRecognizer;available?:(options:{langs:string[];processLocally:boolean})=>Promise<string>};
const onDeviceRecognizer=():LocalRecognizerConstructor|undefined=>{
 const view=window as typeof window & {SpeechRecognition?:LocalRecognizerConstructor;webkitSpeechRecognition?:LocalRecognizerConstructor};
 const constructor=view.SpeechRecognition||view.webkitSpeechRecognition;
 return constructor?.available?constructor:undefined; // Legacy implementations may use vendor cloud services.
};
export function useLocalVoice(onTranscript:(value:string)=>void,workspaceId:string){
 const [mode,setMode]=useState<VoiceMode>('idle');
 const [note,setNote]=useState<LocalAudioNote|null>(null);
 const [notice,setNotice]=useState('');
 const [elapsed,setElapsed]=useState(0);
 const recognizer=useRef<LocalRecognizer|null>(null);
 const recorder=useRef<MediaRecorder|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const started=useRef(0);
 const chunks=useRef<Blob[]>([]);
 const urls=useRef<string[]>([]);
 const durationId=useRef<number|undefined>(undefined);
 const generation=useRef(0);
 const transcript=useRef(onTranscript);
 transcript.current=onTranscript;
 const clearClock=()=>{if(durationId.current!==undefined){clearInterval(durationId.current);durationId.current=undefined}};
 const shutDown=useCallback((revoke:boolean)=>{
  generation.current++;
  try{recognizer.current?.abort()}catch{}
  recognizer.current=null;
  try{if(recorder.current?.state==='recording')recorder.current.stop()}catch{}
  recorder.current=null;
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  clearClock();
  chunks.current=[];
  if(revoke){urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];}
 },[]);
 useEffect(()=>()=>shutDown(true),[shutDown,workspaceId]);
 useEffect(()=>{setMode('idle');setNote(null);setElapsed(0);setNotice('')},[workspaceId]);
 const reset=()=>{
  shutDown(false);
  if(note){URL.revokeObjectURL(note.url);urls.current=urls.current.filter(url=>url!==note.url)}
  setMode('idle');setNote(null);setElapsed(0);setNotice('');
 };
 const beginRecording=async(runId:number)=>{
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
   if(runId===generation.current){setMode('idle');setNotice('Este navegador não oferece gravação de microfone. Você pode digitar sua mensagem.')}
   return;
  }
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(runId!==generation.current){media.getTracks().forEach(track=>track.stop());return}
   stream.current=media;
   const format=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));
   const handler=new MediaRecorder(media,format?{mimeType:format,audioBitsPerSecond:64000}:undefined);
   recorder.current=handler;chunks.current=[];started.current=Date.now();setElapsed(0);setMode('recording');
   setNotice('Gravando neste dispositivo. O áudio não é enviado ao servidor.');
   durationId.current=window.setInterval(()=>{
    const secs=Math.floor((Date.now()-started.current)/1000);setElapsed(secs);
    if(secs>=75&&handler.state==='recording')handler.stop();
   },250);
   handler.ondataavailable=ev=>{if(ev.data.size>0)chunks.current.push(ev.data)};
   handler.onerror=()=>{setNotice('Houve um problema ao gravar. Tente novamente.');setMode('idle')};
   handler.onstop=()=>{
    clearClock();media.getTracks().forEach(track=>track.stop());
    if(runId!==generation.current)return;
    const blob=new Blob(chunks.current,{type:handler.mimeType||'audio/webm'});
    stream.current=null;recorder.current=null;
    if(blob.size<100){setMode('idle');setNotice('A gravação ficou vazia. Tente novamente.');return}
    const url=URL.createObjectURL(blob);urls.current.push(url);
    const seconds=Math.max(1,Math.ceil((Date.now()-started.current)/1000));
    setNote({url,seconds,mimeType:blob.type});setMode('preview');setElapsed(seconds);
    setNotice('Gravação concluída. Ouça antes de enviar; ela ficará apenas nesta conversa.');
   };
   handler.start(250);
  }catch(error){
   if(runId!==generation.current)return;
   setMode('idle');
   const denied=error instanceof DOMException&&['NotAllowedError','PermissionDeniedError'].includes(error.name);
   setNotice(denied?'O acesso ao microfone foi negado. Libere a permissão nas configurações do navegador.':'Não foi possível iniciar o microfone. Verifique se ele está disponível.');
  }
 };
 const start=async()=>{
  if(mode!=='idle')return;
  setMode('checking');setNotice('Verificando reconhecimento de voz no dispositivo...');
  const runId=++generation.current;
  const Engine=onDeviceRecognizer();
  if(Engine){
   try{
    const available=await Engine.available!({langs:['pt-BR'],processLocally:true});
    if(runId!==generation.current)return;
    if(available==='available'){
     const instance=new Engine();instance.lang='pt-BR';instance.processLocally=true;
     instance.continuous=false;instance.interimResults=false;recognizer.current=instance;
     instance.onresult=(event)=>{
      if(runId!==generation.current)return;
      const text=Array.from(event.results).slice(event.resultIndex).map(result=>result[0]?.transcript||'').join(' ').trim();
      if(text){transcript.current(text);setNotice('Voz transcrita no próprio dispositivo. Revise o texto e envie quando quiser.')}
     };
     instance.onerror=(event)=>{if(runId!==generation.current)return;setMode('idle');setNotice(event.error==='no-speech'?'Nenhuma fala identificada. Tente novamente.':'Não foi possível transcrever. Use o microfone para gravar um áudio local.')};
     instance.onend=()=>{if(runId===generation.current){recognizer.current=null;setMode('idle')}};
     instance.start();setMode('dictating');setNotice('Ouvindo em português. Reconhecimento no dispositivo, sem API externa.');return;
    }
    setNotice(available==='downloadable'?'O pacote de português ainda não está instalado. Vou gravar o áudio localmente.':'Transcrição local indisponível neste navegador. Vou gravar o áudio.');
   }catch{
    setNotice('Não foi possível ativar a transcrição local. Vou usar o gravador de áudio.');
   }
  }
  if(runId===generation.current)await beginRecording(runId);
 };
 const stop=()=>{
  if(mode==='dictating'){try{recognizer.current?.stop()}catch{};return}
  if(mode==='recording'&&recorder.current?.state==='recording')recorder.current.stop();
 };
 const consume=():LocalAudioNote|null=>{
  if(mode!=='preview'||!note)return null;
  const snapshot=note;setNote(null);setMode('idle');setElapsed(0);
  setNotice('Áudio salvo apenas nesta conversa. Para criar registros, envie também a transcrição em texto.');
  return snapshot;
 };
 return {mode,note,notice,elapsed,start,stop,reset,consume,recording:mode==='recording'||mode==='dictating'};
}
