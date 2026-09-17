const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export function readUsage(result,provider){
 const u=result?.usage??result?.x_groq?.usage;
 let input=number(u?.prompt_tokens)??number(u?.input_tokens),output=number(u?.completion_tokens)??number(u?.output_tokens);
 if(provider==='anthropic'&&input!==null)input+=(number(u?.cache_read_input_tokens)??0)+(number(u?.cache_creation_input_tokens)??0);
 const total=number(u?.total_tokens)??(input!==null&&output!==null?input+output:null);
 // OpenRouter documents usage.cost in USD credits. Do not assume other APIs' cost units.
 const cost=provider==='openrouter'?number(u?.cost):null;
 return {input,output,total,cost};
}
let nextRequest=0;
export function trackInference(request,input,onUsage=()=>{}){
 return async(url,options)=>{
  if(options?.method!=='POST')return request(url,options);
  options.signal?.throwIfAborted();
  const id=++nextRequest,provider=input.provider??'custom';
  onUsage({type:'start',id,provider,model:input.model});
  let result;
  try{result=await request(url,options);}
  catch(error){onUsage({type:'finish',id,usage:readUsage(null,provider)});throw error;}
  onUsage({type:'finish',id,usage:readUsage(result,provider)});
  return result;
 };
}
export function createUsageLedger(){
 const records=new Map();
 return {
  record(event){
   if(event.type==='start'&&!records.has(event.id))records.set(event.id,{provider:event.provider,model:event.model,usage:null});
   if(event.type==='finish'&&records.has(event.id)&&!records.get(event.id).usage)records.get(event.id).usage=event.usage;
  },
  snapshot(){
   const groups=new Map();
   for(const r of records.values()){
    const key=JSON.stringify([r.provider,r.model]);
    if(!groups.has(key))groups.set(key,{provider:r.provider,model:r.model,requests:0,pending:0,input:0,output:0,total:0,cost:0,priced:0,unknown:0,unpriced:0});
    const g=groups.get(key);g.requests++;
    if(!r.usage){g.pending++;continue;}
    const u=r.usage;g.input+=u.input??0;g.output+=u.output??0;g.total+=u.total??0;
    if(u.total===null||u.input===null||u.output===null)g.unknown++;
    if(u.cost===null)g.unpriced++;else{g.cost+=u.cost;g.priced++;}
   }
   const rows=[...groups.values()],total={requests:0,pending:0,input:0,output:0,total:0,cost:0,priced:0,unknown:0,unpriced:0};
   for(const row of rows)for(const key of Object.keys(total))total[key]+=row[key];
   return {rows,...total};
  }
 };
}
