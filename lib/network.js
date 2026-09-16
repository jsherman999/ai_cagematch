export class AppError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
export function providerBase(value){
 let url;try{url=new URL(value);}catch{throw new AppError('Enter a valid HTTPS provider API base URL.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(url.port&&url.port!=='443'))throw new AppError('Use an HTTPS provider API base URL without credentials, query parameters, or fragments.');
 return url.href.replace(/\/+$/,'');
}
export function credential(value,label){
 if(typeof value!=='string'||!value.trim()||value.length>4096||/[\r\n]/.test(value))throw new AppError(`Enter a valid ${label}.`);
 return value.trim();
}
// Direct requests only. No proxy, cookies, redirects, logging, or persistent storage.
export async function jsonRequest(url,{method='GET',headers={},body,signal,service='Service',timeoutMs=120_000,fetchImpl=globalThis.fetch}={}){
 const timeout=AbortSignal.timeout(timeoutMs);
 const combined=signal?AbortSignal.any([signal,timeout]):timeout;
 try{
  const response=await fetchImpl(url,{method,headers:{Accept:'application/json',...headers,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:combined,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store'});
  if(!response.ok){
   const hint=service==='Bluesky'&&[400,403,404].includes(response.status)?'Check the Bluesky post URL; the post or account may be unavailable.':response.status===401?'Check your API key.':response.status===403?'This key does not have access.':response.status===429?'Rate limit or quota reached. Try again later.':'Check the API endpoint and chosen model.';
   throw new AppError(`${service} returned HTTP ${response.status}. ${hint}`,response.status);
  }
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8_000_000){await reader.cancel();throw new AppError(`${service} returned too much data.`);}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new AppError(`${service} did not return JSON. Check the API base URL.`);}
 }catch(error){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(timeout.aborted)throw new AppError(`${service} timed out after ${Math.round(timeoutMs/1000)} seconds without a complete response. The provider may be busy or the model may need longer. Try again or choose a faster model.`);
  if(error instanceof AppError)throw error;
  throw new AppError(`${service} could not be reached. It may block browser requests (CORS), be offline, or redirect. Choose a browser-compatible endpoint. No proxy is used.`);
 }
}
