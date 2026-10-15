import net from 'node:net';
// Never inherit a live database, SMTP transport or public gateway configuration.
export const isolatedEnv=(port)=>({...process.env,DATABASE_URL:'',DATABASE_SSL:'',SMTP_URL:'',EIXO_MODE:'development',EIXO_HOST:'127.0.0.1',EIXO_PRIVATE_ACCESS:'',EIXO_PUBLIC_HOST:'',EIXO_PUBLIC_URL:'',PORT:String(port),API_TEST_ORIGIN:`http://127.0.0.1:${port}`});
export async function availableTestPort(){
 const socket=net.createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve)});
 const port=socket.address().port;await new Promise((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));return port;
}
