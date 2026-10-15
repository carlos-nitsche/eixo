// EIXO OS · React 19 voice hook · Audio never leaves this browser; Whisper runs in same-origin Web Worker.
import {useCallback,useEffect,useRef,useState} from 'react';

type VoiceMode='idle'|'checking'|'recording'|'transcribing'|'preview';
export type LocalAudioNote={url:string;seconds:number;mimeType:string};
type WorkerReply={type:'download'|'status'|'result'|'error';id?:number;text?:string;message?:string;status?:string;percent?:number;file?:string};
const MAX_SECONDS=75;
async function decodeAudio(blob:Blob):Promise<Float32Array>{
 const AudioCtx=window.AudioContext;
 if(!AudioCtx||!window.OfflineAudioContext)throw Error('Este dispositivo não suporta a conversão de áudio local.');
 const context=new AudioCtx();
 try{
  const decoded=await context.decodeAudioData(await blob.arrayBuffer());
  const duration=Math.min(MAX_SECONDS,decoded.duration);
  if(duration<0.25)throw Error('Grave pelo menos um segundo de voz.');
  const length=Math.max(1,Math.ceil(duration*16000));
  const offline=new OfflineAudioContext(1,length,16000);
  const source=offline.createBufferSource();
  source.buffer=decoded;
  source.connect(offline.destination);
  source.start();
  const rendered=await offline.startRendering();
  return new Float32Array(rendered.getChannelData(0));
 }finally{await context.close().catch(()=>{})}
}
export function useLocalVoice(onTranscript:(value:string)=>void,workspaceId:string){
 const [mode,setMode]=useState<VoiceMode>('idle');
 const [note,setNote]=useState<LocalAudioNote|null>(null);
 const [notice,setNotice]=useState('');
 const [elapsed,setElapsed]=useState(0);
 const [progress,setProgress]=useState<number|null>(null);
 const recorder=useRef<MediaRecorder|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const worker=useRef<Worker|null>(null);
 const audioBuffer=useRef<Blob|null>(null);
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
  try{if(recorder.current?.state==='recording')recorder.current.stop()}catch{}
  recorder.current=null;
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  worker.current?.terminate();worker.current=null;
  clearClock();
  chunks.current=[];
  audioBuffer.current=null;
  if(revoke){urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[]}
 },[]);
 useEffect(()=>{setMode('idle');setNote(null);setElapsed(0);setNotice('');setProgress(null);return()=>shutDown(true)},[shutDown,workspaceId]);
 const reset=()=>{
  shutDown(true);setMode('idle');setNote(null);setElapsed(0);setProgress(null);setNotice('');
 };
 const transcribe=async(blob:Blob,runId:number)=>{
  if(runId!==generation.current)return;
  setMode('transcribing');setProgress(null);
  try{
   setNotice('Preparando o áudio para reconhecer português...');
   const status=await fetch('/models/eixo-whisper-status.json',{cache:'no-store'});
   if(!status.ok)throw Error('Modelo Whisper não instalado. Execute: npm run voice:install');
   const audio=await decodeAudio(blob);
   if(runId!==generation.current)return;
   const engine=worker.current??new Worker(new URL('./whisper-local.worker.ts',import.meta.url),{type:'module',name:'eixo-whisper-offline'});
   worker.current=engine;
   engine.onmessage=(event:MessageEvent<WorkerReply>)=>{
    if(runId!==generation.current)return;
    const data=event.data;
    if(data.type==='download'){
     if(typeof data.percent==='number')setProgress(data.percent);
     setNotice('Carregando modelo Whisper local'+(typeof data.percent==='number'?' · '+data.percent+'%':'')+'...');
    }else if(data.type==='status'){setNotice(data.message||'Transcrevendo português localmente...')}
    else if(data.type==='error'){
     engine.terminate();worker.current=null;setMode('preview');setProgress(null);
     setNotice('Transcrição indisponível: '+(data.message||'erro no modelo')+'. Tente transcrever novamente, descarte a gravação ou digite o pedido.');
    }else if(data.type==='result'){
     // Keep the model warm inside this worker for the next voice message.
     setProgress(null);
     if(data.text?.trim()){
      transcript.current(data.text.trim());
      setNotice('Transcrição local concluída. Revise a frase e pressione Enviar para criar o registro.');
      setMode('idle');setNote(null);audioBuffer.current=null;
      urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];
     }else{
      setMode('preview');setNotice('Não identifiquei palavras no áudio. Ouça a gravação ou tente falar mais perto do microfone.');
     }
    }
   };
   engine.onerror=()=>{
    if(runId!==generation.current)return;
    engine.terminate();worker.current=null;setProgress(null);setMode('preview');
    setNotice('Erro ao iniciar a transcrição local. Confira a instalação do modelo e tente novamente.');
   };
   engine.postMessage({id:runId,audio,sampleRate:16000},[audio.buffer]);
  }catch(error){
   if(runId!==generation.current)return;
   setProgress(null);setMode('preview');
   setNotice(error instanceof Error?error.message:'Falha ao decodificar áudio local.');
  }
 };
 const start=async()=>{
  if(mode!=='idle')return;
  setMode('checking');setNotice('Solicitando acesso ao microfone...');setProgress(null);
  const runId=++generation.current;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
   setMode('idle');setNotice('Este navegador não oferece gravação de microfone.');return;
  }
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   if(runId!==generation.current){media.getTracks().forEach(track=>track.stop());return}
   stream.current=media;
   const format=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m));
   const handler=new MediaRecorder(media,format?{mimeType:format,audioBitsPerSecond:64000}:undefined);
   recorder.current=handler;chunks.current=[];started.current=Date.now();setElapsed(0);setMode('recording');
   setNotice('Gravando voz. Ao terminar, o Whisper transcreverá sem enviar áudio a serviços externos.');
   durationId.current=window.setInterval(()=>{
    const seconds=Math.floor((Date.now()-started.current)/1000);setElapsed(seconds);
    if(seconds>=MAX_SECONDS&&handler.state==='recording')handler.stop();
   },250);
   handler.ondataavailable=event=>{if(event.data.size>0)chunks.current.push(event.data)};
   handler.onerror=()=>{setNotice('Houve um problema com o microfone.');setMode('idle')};
   handler.onstop=()=>{
    clearClock();media.getTracks().forEach(track=>track.stop());
    if(runId!==generation.current)return;
    const blob=new Blob(chunks.current,{type:handler.mimeType||'audio/webm'});
    stream.current=null;recorder.current=null;
    if(blob.size<100){setMode('idle');setNotice('O áudio ficou vazio. Tente novamente.');return}
    audioBuffer.current=blob;
    const url=URL.createObjectURL(blob);urls.current.push(url);
    const seconds=Math.max(1,Math.ceil((Date.now()-started.current)/1000));
    setNote({url,seconds,mimeType:blob.type});setElapsed(seconds);
    void transcribe(blob,runId);
   };
   handler.start(250);
  }catch(error){
   if(runId!==generation.current)return;
   setMode('idle');
   const denied=error instanceof DOMException&&['NotAllowedError','PermissionDeniedError'].includes(error.name);
   setNotice(denied?'Microfone bloqueado: libere o acesso deste site nas permissões do navegador.':'Não foi possível iniciar o microfone.');
  }
 };
 const stop=()=>{
  if(mode==='recording'&&recorder.current?.state==='recording')recorder.current.stop();
 };
 const retry=()=>{
  if(mode!=='preview'||!audioBuffer.current)return;
  void transcribe(audioBuffer.current,generation.current);
 };
 return {mode,note,notice,elapsed,progress,start,stop,reset,retry,recording:mode==='recording',transcribing:mode==='transcribing'};
}
