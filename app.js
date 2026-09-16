import { createThreadProgress } from './lib/progress.js';
import { installGraphGestures } from './lib/gestures.js';
import { providers, detectProvider, selectProvider } from './lib/providers.js';
import { listModels, analyze } from './lib/analysis.js?v=live-progress-1';
import { parseThreadURL } from './lib/threads.js';

const $=id=>document.getElementById(id);
const canvas=$('plot'),ctx=canvas.getContext('2d');
const progress=createThreadProgress(document);
let showingProgress=false;
const palette=['#daa1b8','#cfb7f4','#b7ace7','#b8c9ef','#b1dfd1','#c2e6ba','#e6d5a8','#d8bca4','#a6cad5','#d8d5c4'];
let people=[],selected=0,width=0,height=0,projected=[],yaw=-.5,tilt=.65,zoom=1,demo=true;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const classified=p=>Number.isFinite(p.potential)&&Number.isFinite(p.outlook);
const maxCount=()=>Math.max(1,...people.map(p=>p.count));
function project(x,z,y=0){
 const rx=x*Math.cos(yaw)-z*Math.sin(yaw),rz=x*Math.sin(yaw)+z*Math.cos(yaw);
 const scale=Math.max(1,Math.min((width-80)/3.7,(height-80)/3.25))*zoom;
 return {x:width/2+rx*scale,y:height*.62+(rz*Math.sin(tilt)-y*Math.cos(tilt))*scale,depth:rz*Math.cos(tilt)+y*Math.sin(tilt)};
}
function line(a,b,color,lineWidth=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();}
function labelScale(){return width<600?.72:1;}
function text(label,p,color,size=10){ctx.font=`600 ${size*labelScale()}px system-ui`;ctx.textAlign='center';ctx.lineWidth=width<600?2.5:4;ctx.strokeStyle='#19251e';ctx.strokeText(label,p.x,p.y);ctx.fillStyle=color;ctx.fillText(label,p.x,p.y);}
function draw(){
 ctx.clearRect(0,0,width,height);
 if(showingProgress)return;
 for(let n=-1;n<=1.001;n+=.2){line(project(n,-1),project(n,1),'#8bae9326');line(project(-1,n),project(1,n),'#8bae9326');}
 line(project(-1.15,0),project(1.15,0),'#b5edcb88',1.5);line(project(0,-1.15),project(0,1.15),'#c8b8ff88',1.5);
 text('LOW POTENTIAL',project(-1.28,0),'#b5edcb');text('HIGH POTENTIAL',project(1.28,0),'#b5edcb');
 text('POLLYANNA',project(0,-1.3),'#c8b8ff');text('DOOMER',project(0,1.3),'#c8b8ff');
 if(tilt<1.55){
  line(project(-1,1),project(-1,1,1.8),'#f1d5a5',1.5);
  const ticks=[...new Set([0,Math.round(maxCount()/2),maxCount()])];
  ticks.forEach(n=>{const p=project(-1,1,n/maxCount()*1.6);line({x:p.x-4,y:p.y},{x:p.x+4,y:p.y},'#f1d5a5');text(String(n),{x:p.x-15,y:p.y+3},'#f1d5a5',9);});
  text('POSTS',project(-1,1,1.95),'#f1d5a5');
 }
 projected=people.map((p,i)=>({...project((p.potential-50)/50,-(p.outlook-50)/50,p.count/maxCount()*1.6),i})).filter(p=>classified(people[p.i])).sort((a,b)=>b.depth-a.depth);
 const labels=[];
 projected.forEach(point=>{
  const person=people[point.i],color=palette[point.i%palette.length],active=selected===point.i;
  const base=project((person.potential-50)/50,-(person.outlook-50)/50);
  line(base,point,color+(active?'bb':'55'),active?2:1);
  ctx.beginPath();ctx.arc(base.x,base.y,2,0,Math.PI*2);ctx.fillStyle=color+'77';ctx.fill();
  if(active){ctx.beginPath();ctx.arc(point.x,point.y,12,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();}
  ctx.beginPath();ctx.arc(point.x,point.y,active?7:5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#152219';ctx.lineWidth=2;ctx.stroke();
  const name=person.name.length>17?person.name.slice(0,16)+'…':person.name;const fontSize=11*labelScale();ctx.font=`${fontSize}px system-ui`;
  const w=ctx.measureText(name).width;
  let position;
  for(const [dx,dy]of [[12,4],[12,-12],[-w-12,4],[12,20],[-w-12,-12]]){
   const candidate={x:point.x+dx,y:point.y+dy,w};
   if(candidate.x<4||candidate.x+w>width-4)continue;
   if(!labels.some(l=>candidate.x<l.x+l.w+4&&candidate.x+w+4>l.x&&Math.abs(candidate.y-l.y)<fontSize+3)){position=candidate;break;}
  }
  position??={x:point.x+12,y:point.y+4,w};labels.push(position);
  ctx.textAlign='left';ctx.lineWidth=width<600?2.5:4;ctx.strokeStyle='#19251e';ctx.strokeText(name,position.x,position.y);ctx.fillStyle=active?'#fff':'#d5dfd7';ctx.fillText(name,position.x,position.y);
 });
 $('empty-plot').hidden=people.some(classified);
}
function node(tag,content,className){const el=document.createElement(tag);if(content!==undefined)el.textContent=content;if(className)el.className=className;return el;}
function select(i){
 selected=i;
 document.querySelectorAll('.person').forEach((button,j)=>button.setAttribute('aria-pressed',String(i===j)));
 const p=people[i],detail=$('detail');detail.replaceChildren();if(!p){draw();return;}
 detail.append(node('h3',p.name),node('p',`@${p.handle} · ${p.count} retrieved ${p.count===1?'post':'posts'}`));
 for(const [key,label,color]of [['potential','Potential · low → high','var(--mint)'],['outlook','Outlook · doomer → Pollyanna','var(--purple)']]){
  const row=node('div',undefined,'score');row.append(node('span',label),node('span',p[key]===null?'Unknown':`${Math.round(p[key])}/100`));detail.append(row);
  const track=node('div',undefined,'track'),fill=node('div',undefined,'fill');fill.style.width=`${p[key]??0}%`;fill.style.background=color;track.append(fill);detail.append(track);
 }
 if(!classified(p))detail.append(node('p','Unclassified: not plotted because one or both opinion axes lack evidence.'));
 detail.append(node('p',`${demo?'Demo estimate':`Model estimate · ${p.confidence} confidence`}. ${p.rationale}`));
 for(const e of p.evidence||[]){
  const box=node('blockquote',undefined,'evidence');box.append(node('p',`“${e.quote}”`));
  try{const url=new URL(e.url);if(url.protocol==='https:'&&url.hostname==='bsky.app'){const a=node('a','View supporting post ↗');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';box.append(a);}}catch{}
  detail.append(box);
 }
 draw();
}
function renderPeople(){
 const list=$('people');list.replaceChildren();
 people.forEach((p,i)=>{
  const b=node('button',undefined,`person${classified(p)?'':' unclassified'}`);b.type='button';b.title=`${p.name}: ${p.count} posts${classified(p)?'':' · unclassified'}`;
  const dot=node('span',undefined,'dot');dot.style.background=palette[i%palette.length];b.append(dot,node('span',p.name,'name'),node('span',String(p.count),'count'));b.onclick=()=>select(i);list.append(b);
 });
 $('scores').textContent=people.map(p=>`${p.name}: potential ${p.potential??'unknown'}, outlook ${p.outlook??'unknown'}, ${p.count} retrieved posts.`).join(' ');
 select(0);
}
function generateDemo(){
 showingProgress=false;progress.hide();canvas.hidden=false;
 const names=['Alex','Morgan','Sam','Riley','Jordan','Casey','Quinn','Avery','Charlie','Taylor','Jamie','Drew','Robin','Skyler','Cameron','Sage','Blake','Reese','Rowan','Emery'];
 people=names.map((name,i)=>({id:`demo-${i}`,name,handle:name.toLowerCase(),potential:Math.round(8+Math.random()*84),outlook:Math.round(8+Math.random()*84),count:1+Math.floor(Math.random()*20),confidence:'low',rationale:'Fictional data for exploring the graph.',evidence:[]})).sort((a,b)=>b.count-a.count);
 demo=true;$('sample').textContent='DEMO · 20 FICTIONAL PEOPLE';$('people-badge').textContent='DEMO';$('coverage').textContent='Fictional sample. Height = post count. Analyze a thread to replace this data.';renderPeople();
}
function reset(top=false){yaw=top?0:-.5;tilt=top?Math.PI/2:.65;zoom=1;$('top').setAttribute('aria-pressed',String(top));draw();}
installGraphGestures(canvas,{
 getZoom:()=>zoom,
 onZoom:value=>{zoom=clamp(value,.55,2.5);draw();},
 onRotate:(dx,dy)=>{yaw+=dx*.007;tilt=clamp(tilt+dy*.007,.18,1.45);$('top').setAttribute('aria-pressed','false');draw();},
 onTap:(clientX,clientY)=>{
  const rect=canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
  const hits=projected.filter(p=>Math.hypot(p.x-x,p.y-y)<18).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
  if(hits.length)select(hits[0].i);
 }
});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom-e.deltaY*.001,.55,2.5);draw();},{passive:false});
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;if(e.key==='ArrowUp')tilt=clamp(tilt-.1,.18,1.45);if(e.key==='ArrowDown')tilt=clamp(tilt+.1,.18,1.45);if(e.key==='+'||e.key==='=')zoom=clamp(zoom+.1,.55,2.5);if(e.key==='-')zoom=clamp(zoom-.1,.55,2.5);if(e.key==='0')reset();$('top').setAttribute('aria-pressed','false');draw();});
$('reset').onclick=()=>reset();$('top').onclick=()=>reset(true);$('shuffle').onclick=()=>{generateDemo();status('Fictional demo data. No requests were sent.');};
new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}).observe(canvas);

// Credentials are kept in input elements only; no storage, URL parameters, or logs.
let loadController=null,analysisController=null,loadVersion=0,debounce,busy=false;
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function targetURL(){return parseThreadURL($('thread-url').value.trim());}
function input(){const apiKey=$('api-key').value.trim();const provider=selectProvider($('provider').value,apiKey);return {provider:provider.id,apiKey,url:targetURL().url,model:$('model').value};}
function clearModels(){loadVersion++;loadController?.abort();$('model').replaceChildren(new Option('Enter key and thread URL to load models',''));$('model').disabled=true;$('analyze').disabled=true;}
function fieldsChanged(){
 clearTimeout(debounce);clearModels();
 if($('provider').value&&$('api-key').value&&$('thread-url').value){try{targetURL();debounce=setTimeout(loadModels,700);}catch(e){status(e.message,true);}}
}
async function loadModels(){
 clearTimeout(debounce);if(busy)return;clearModels();const version=loadVersion;loadController=new AbortController();
 try{
  const payload=input();if(!payload.apiKey)throw Error('Enter your provider API key.');status('Loading the provider’s model list…');
  const result=await listModels(payload,{signal:loadController.signal});if(version!==loadVersion)return;
  $('model').replaceChildren(new Option('Choose a text chat model',''),...result.models.map(id=>new Option(id,id)));$('model').disabled=false;
  status(`${result.models.length} models loaded. Choose a text chat model, then analyze the thread.`);
 }catch(e){if(e.name!=='AbortError'&&version===loadVersion)status(e.message,true);}
}
for(const p of providers)$('provider').append(new Option(p.name,p.id));
function updateProviderHint(detected=false){
 const key=$('api-key').value.trim(),provider=providers.find(p=>p.id===$('provider').value);
 $('provider-hint').textContent=provider?`${detected?'Detected':'Selected'}: ${provider.name}. Your key goes only to this provider.`:key?'Provider not identifiable from this key. Choose its provider above; nothing has been sent.':'Recognizable keys are detected locally. Otherwise, choose a provider by name.';
}
$('api-key').addEventListener('input',()=>{$('provider').value=detectProvider($('api-key').value)||'';updateProviderHint(Boolean($('provider').value));fieldsChanged();});
$('provider').addEventListener('change',()=>{updateProviderHint();fieldsChanged();});
$('thread-url').addEventListener('input',fieldsChanged);
$('load-models').onclick=loadModels;$('model').onchange=()=>{$('analyze').disabled=!$('model').value||busy;};
$('cancel').onclick=()=>analysisController?.abort();
$('analysis-form').onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 try{
  const payload=input();if(!payload.model)throw Error('Choose a model.');
  busy=true;$('fields').disabled=true;$('shuffle').disabled=true;$('cancel').hidden=false;
  analysisController=new AbortController();
  showingProgress=true;people=[];projected=[];renderPeople();canvas.hidden=true;$('empty-plot').hidden=true;
  $('sample').textContent='READING THREAD';$('people-badge').textContent='WAITING';$('coverage').textContent='';
  $('detail').textContent='Posters and their opinion estimates will appear when analysis is complete.';
  progress.start();status('Fetching this thread and counting its posts…');
  const result=await analyze(payload,{signal:analysisController.signal,onPost:post=>progress.add(post),onProgress:message=>{status(message);progress.stage(message);}});
  if(!Array.isArray(result.people)||result.people.some(p=>!Number.isInteger(p.count)||p.count<1||typeof p.name!=='string'))throw Error('The analysis returned invalid results.');
  showingProgress=false;progress.hide();canvas.hidden=false;people=result.people;demo=false;renderPeople();reset();
  $('sample').textContent=`${result.platform.toUpperCase()} · ${people.length} POSTERS · ${result.totalPosts} POSTS`;
  $('people-badge').textContent='MODEL ESTIMATES';
  $('coverage').textContent=`${result.totalPosts} retrieved posts by ${result.totalAuthors} authors. Top ${people.length} ranked by retrieved post count. ${result.warnings.join(' ')} Scope: ${result.url}`;
  const unknown=people.filter(p=>!classified(p)).length;
  status(`Analyzed with ${result.model}. ${people.length-unknown} plotted${unknown?`; ${unknown} unclassified (insufficient evidence)`:''}. Frequency is the count of retrieved posts, not an LLM estimate.`);
 }catch(e){
  const message=e.name==='AbortError'?'Analysis cancelled.':e.message;
  if(showingProgress){progress.stop(message);$('sample').textContent='NO ANALYSIS RESULTS';$('people-badge').textContent='NO RESULTS';$('detail').textContent='Start another analysis or load a demo crowd.';}
  status(message,e.name!=='AbortError');
 }
 finally{busy=false;$('fields').disabled=false;$('shuffle').disabled=false;$('cancel').hidden=true;$('analyze').disabled=!$('model').value;analysisController=null;}
};
generateDemo();
