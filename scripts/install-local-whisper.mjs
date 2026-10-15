// EIXO OS · Node.js >=22 · provision multilingual Whisper ONNX weights and WASM, same-origin only.
// Download is a one-time installation action. No speech recordings are sent to the model host.
import {mkdir,stat,rename,rm,copyFile,readdir,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline as pipe} from 'node:stream/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const model='Xenova/whisper-tiny',dest=path.join(root,'public','models',...model.split('/'));
const assets=[
 'config.json','tokenizer.json','tokenizer_config.json','preprocessor_config.json',
 'generation_config.json','special_tokens_map.json','normalizer.json','added_tokens.json',
 'merges.txt','vocab.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'
];
const base='https://huggingface.co/'+model+'/resolve/main/';
const verifyFile=async(filepath,min)=>{try{return (await stat(filepath)).size>=min}catch{return false}};
async function obtain(file){
 const target=path.join(dest,...file.split('/')),min=file.endsWith('.onnx')?1000000:5;
 if(await verifyFile(target,min)){console.log('CACHED '+file);return}
 await mkdir(path.dirname(target),{recursive:true});
 for(let attempt=0;attempt<3;attempt++){
  const partial=target+'.part';
  try{
   const response=await fetch(base+file,{signal:AbortSignal.timeout(180000),headers:{'user-agent':'EIXO-Offline-Model-Installer/1.0'}});
   if(!response.ok||!response.body)throw Error('HTTP '+response.status+' em '+file);
   await pipe(Readable.fromWeb(response.body),createWriteStream(partial));
   if(!await verifyFile(partial,min))throw Error('Arquivo incompleto: '+file);
   await rename(partial,target);
   const size=(await stat(target)).size;console.log('OK '+file+' '+Math.round(size/1024/1024*100)/100+' MB');
   return;
  }catch(error){await rm(partial,{force:true});if(attempt===2)throw error;console.warn('RETRY '+file+' '+String(error))}
 }
}
await mkdir(dest,{recursive:true});
for(const file of assets)await obtain(file);
const onnxDir=path.join(root,'node_modules','onnxruntime-web','dist');
const wasmDir=path.join(root,'public','whisper-wasm');
await mkdir(wasmDir,{recursive:true});
let copied=0;
for(const name of await readdir(onnxDir)){
 if(/^ort-wasm-simd-threaded(?:\.jsep)?\.(?:wasm|mjs)$/.test(name)){
  await copyFile(path.join(onnxDir,name),path.join(wasmDir,name));copied++;
  console.log('WASM '+name);
 }
}
if(copied<4)throw Error('ONNX runtime WASM não está completo');
const manifest={name:'Whisper Tiny — multilíngue',model,language:'portuguese',installation:'same-origin',remoteInference:false,installedAt:new Date().toISOString(),files:assets.length,wasmFiles:copied};
await writeFile(path.join(root,'public','models','eixo-whisper-status.json'),JSON.stringify(manifest,null,2));
console.log('EIXO_LOCAL_WHISPER_INSTALLED '+JSON.stringify({model,assets:assets.length,wasmFiles:copied}));
