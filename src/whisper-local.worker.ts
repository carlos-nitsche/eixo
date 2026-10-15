// EIXO OS · Web Worker · Whisper Tiny multilingual, fully local WASM inference.
// Model and WASM assets MUST be served from our own origin, never a cloud inference API.
import {env,pipeline} from '@huggingface/transformers';

type Request={id:number;audio:Float32Array;sampleRate:16000};
type Progress={status?:string;progress?:number;file?:string};
env.allowLocalModels=true;
env.allowRemoteModels=false;
env.localModelPath='/models/';
env.useBrowserCache=true;
if(env.backends.onnx.wasm){
 env.backends.onnx.wasm.wasmPaths='/whisper-wasm/';
 env.backends.onnx.wasm.numThreads=1;
} // works without SharedArrayBuffer/COOP+COEP on iOS.
type SpeechPipe=(audio:Float32Array,options:Record<string,unknown>)=>Promise<{text?:string}|Array<{text?:string}>>;
const createPipe=pipeline as unknown as (task:'automatic-speech-recognition',model:string,options:Record<string,unknown>)=>Promise<SpeechPipe>;
let transcriber:Promise<SpeechPipe>|undefined;
function getTranscriber(){
 transcriber??=createPipe('automatic-speech-recognition','Xenova/whisper-tiny',{
  device:'wasm',dtype:'q8',
  progress_callback:(event:Progress)=>{
   const percent=typeof event.progress==='number'?Math.max(0,Math.min(100,Math.round(event.progress))):undefined;
   self.postMessage({type:'download',status:event.status,percent,file:event.file||''});
  }
 }).catch(error=>{transcriber=undefined;throw error});
 return transcriber;
}
self.onmessage=async(event:MessageEvent<Request>)=>{
 const {id,audio,sampleRate}=event.data||{};
 if(!id||!(audio instanceof Float32Array)||sampleRate!==16000||audio.length===0){
  self.postMessage({type:'error',id,message:'Áudio inválido para o Whisper.'});return;
 }
 try{
  self.postMessage({type:'status',id,message:'Carregando modelo de voz local...'});
  const model=await getTranscriber();
  self.postMessage({type:'status',id,message:'Reconhecendo português neste dispositivo...'});
  const result=await model(audio,{
   language:'portuguese',task:'transcribe',
   chunk_length_s:25,stride_length_s:4,
   return_timestamps:false
  });
  const first=Array.isArray(result)?result[0]:result;
  const text=typeof first?.text==='string'?first.text.trim():'';
  self.postMessage({type:'result',id,text});
 }catch(error){
  self.postMessage({type:'error',id,message:error instanceof Error?error.message:String(error)});
 }
};
