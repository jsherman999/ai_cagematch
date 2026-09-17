import { createUsageLedger } from './lib/usage.js';
import { DEFAULT_AXES, validateAxes } from './lib/axes.js';
import { createThreadProgress } from './lib/progress.js?v=poster-progress-1';
import { installGraphGestures } from './lib/gestures.js';
import { providers, detectProvider, selectProvider } from './lib/providers.js';
import { listModels, analyze, generateAxes } from './lib/analysis.js?v=session-usage-1';
import { parseThreadURL } from './lib/threads.js';

const $=id=>document.getElementById(id);
const canvas=$('plot'),ctx=canvas.getContext('2d');
const progress=createThreadProgress(document);
let showingProgress=false;
const usageLedger=createUsageLedger();
const presets=new Map([['default',DEFAULT_AXES]]);
let activeAxes=DEFAULT_AXES,presetCounter=0;
const palette=['#daa1b8','#cfb7f4','#b7ace7','#b8c9ef','#b1dfd1','#c2e6ba','#e6d5a8','#d8bca4','#a6cad5','#d8d5c4'];
let people=[],selected=0,width=0,height=0,projected=[],yaw=-.5,tilt=.65,zoom=1,demo=true;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const classified=p=>Number.isFinite(p.potential)&&Number.isFinite(p.outlook);
const maxCount=()=>Math.max(1,...people.map(p=>p.count));
function project(x,z,y=0){
 const rx=x*Math.cos(yaw)-z*Math.sin(yaw),rz=x*Math.sin(yaw)+z*Math.cos(yaw);
 const scale=Math.max(1,Math.min((width-80)/3.7,(height-80)/3.25))*zoom;
 // Center the floor in top-down view; reserve headroom only when height is visible.
 const centerY=height*(.5+.12*Math.cos(tilt));
 return {x:width/2+rx*scale,y:centerY+(rz*Math.sin(tilt)-y*Math.cos(tilt))*scale,depth:rz*Math.cos(tilt)+y*Math.sin(tilt)};
}
function line(a,b,color,lineWidth=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();}
function labelScale(){return width<600?.72:1;}
function text(label,p,color,size=10){ctx.font=`600 ${size*labelScale()}px system-ui`;ctx.textAlign='center';ctx.lineWidth=width<600?2.5:4;ctx.strokeStyle='#19251e';ctx.strokeText(label,p.x,p.y);ctx.fillStyle=color;ctx.fillText(label,p.x,p.y);}
function drawAxisLabels(){
 const entries=[
  [activeAxes.potential.low.toUpperCase(),project(-1.28,0),'#b5edcb'],[activeAxes.potential.high.toUpperCase(),project(1.28,0),'#b5edcb'],
  [activeAxes.outlook.high.toUpperCase(),project(0,-1.3),'#c8b8ff'],[activeAxes.outlook.low.toUpperCase(),project(0,1.3),'#c8b8ff'],
  tilt<1.55?['POSTS',project(-1,1,1.95),'#f1d5a5']:['POST HEIGHT HIDDEN',{x:70,y:height-14},'#f1d5a5']
 ];
 const placed=[],fontSize=10*labelScale();
 ctx.font=`600 ${fontSize}px system-ui`;
 for(const [label,point,color]of entries){
  const w=ctx.measureText(label).width+12,h=fontSize+10;
  const x=clamp(point.x,w/2+6,width-w/2-6),preferred=clamp(point.y, h+6,height-10);
  let y=preferred;
  // Keep labels readable when rotated axes meet the same viewport edge.
  for(let step=0;step<entries.length*2;step++){
   const candidate=clamp(preferred+(step%2?1:-1)*Math.ceil(step/2)*(h+4),h+6,height-10);
   if(!placed.some(p=>Math.abs(x-p.x)<(w+p.w)/2+4&&Math.abs(candidate-p.y)<h+4)){y=candidate;break;}
  }
  placed.push({x,y,w});
  ctx.fillStyle='#17211ff2';ctx.fillRect(x-w/2,y-fontSize-5,w,h);
  text(label,{x,y},color);
 }
}
function draw(){
 ctx.clearRect(0,0,width,height);
 if(showingProgress)return;
 for(let n=-1;n<=1.001;n+=.2){line(project(n,-1),project(n,1),'#8bae9326');line(project(-1,n),project(1,n),'#8bae9326');}
 line(project(-1.15,0),project(1.15,0),'#b5edcb88',1.5);line(project(0,-1.15),project(0,1.15),'#c8b8ff88',1.5);
 if(tilt<1.55){
  line(project(-1,1),project(-1,1,1.8),'#f1d5a5',1.5);
  const ticks=[...new Set([0,Math.round(maxCount()/2),maxCount()])];
  ticks.forEach(n=>{const p=project(-1,1,n/maxCount()*1.6);line({x:p.x-4,y:p.y},{x:p.x+4,y:p.y},'#f1d5a5');text(String(n),{x:p.x-15,y:p.y+3},'#f1d5a5',9);});
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
 drawAxisLabels();
 $('empty-plot').hidden=people.some(classified);
}
function node(tag,content,className){const el=document.createElement(tag);if(content!==undefined)el.textContent=content;if(className)el.className=className;return el;}
function select(i){
 selected=i;
 document.querySelectorAll('.person').forEach((button,j)=>button.setAttribute('aria-pressed',String(i===j)));
 const p=people[i],detail=$('detail');detail.replaceChildren();if(!p){draw();return;}
 detail.append(node('h3',p.name),node('p',`@${p.handle} · ${p.count} retrieved ${p.count===1?'post':'posts'}`));
 for(const [key,label,color]of [['potential',`${activeAxes.potential.name} · ${activeAxes.potential.low} → ${activeAxes.potential.high}`,'var(--mint)'],['outlook',`${activeAxes.outlook.name} · ${activeAxes.outlook.low} → ${activeAxes.outlook.high}`,'var(--purple)']]){
  const row=node('div',undefined,'score');row.append(node('span',label),node('span',`${Math.round(p[key])}/100${p.centeredAxes?.includes(key)?' · uncertain':''}`));detail.append(row);
  const track=node('div',undefined,'track'),fill=node('div',undefined,'fill');fill.style.width=`${p[key]??0}%`;fill.style.background=color;track.append(fill);detail.append(track);
 }
 if(p.centeredAxes?.length)detail.append(node('p',`Centered for lack of evidence: ${p.centeredAxes.map(key=>activeAxes[key].name).join(' and ')}. Centered scores indicate uncertainty, not necessarily a neutral view.`));
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
  const b=node('button',undefined,'person');b.type='button';b.title=`${p.name}: ${p.count} posts`;
  const dot=node('span',undefined,'dot');dot.style.background=palette[i%palette.length];b.append(dot,node('span',p.name,'name'),node('span',String(p.count),'count'));b.onclick=()=>select(i);list.append(b);
 });
 $('scores').textContent=people.map(p=>`${p.name}: ${activeAxes.potential.name} ${p.potential??'unknown'}, ${activeAxes.outlook.name} ${p.outlook??'unknown'}, ${p.count} retrieved posts.`).join(' ');
 select(0);
}
function generateDemo(){
 showingProgress=false;progress.hide();canvas.hidden=false;
 const names=['Alex','Morgan','Sam','Riley','Jordan','Casey','Quinn','Avery','Charlie','Taylor','Jamie','Drew','Robin','Skyler','Cameron','Sage','Blake','Reese','Rowan','Emery'];
 people=names.map((name,i)=>({id:`demo-${i}`,name,handle:name.toLowerCase(),potential:Math.round(8+Math.random()*84),outlook:Math.round(8+Math.random()*84),count:1+Math.floor(Math.random()*20),confidence:'low',rationale:'Fictional data for exploring the graph.',evidence:[]})).sort((a,b)=>b.count-a.count);
 demo=true;$('sample').textContent='DEMO · 20 FICTIONAL PEOPLE';$('people-badge').textContent='DEMO';$('coverage').textContent=`${activeAxes.name}. Fictional sample. Height = post count. Analyze a thread to replace this data.`;renderPeople();
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
function input(requireThread=true){const apiKey=$('api-key').value.trim();const provider=selectProvider($('provider').value,apiKey);return {provider:provider.id,apiKey,url:requireThread?targetURL().url:undefined,model:$('model').value,axes:activeAxes};}
function clearModels(){loadVersion++;loadController?.abort();$('model').replaceChildren(new Option('Enter a provider key to load models',''));$('model').disabled=true;$('analyze').disabled=true;}
function fieldsChanged(){
 clearTimeout(debounce);clearModels();
 if($('provider').value&&$('api-key').value)debounce=setTimeout(loadModels,700);
}
async function loadModels(){
 clearTimeout(debounce);if(busy)return;clearModels();const version=loadVersion;loadController=new AbortController();
 try{
  const payload=input(false);if(!payload.apiKey)throw Error('Enter your provider API key.');status('Loading the provider’s model list…');
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
  const result=await analyze(payload,{signal:analysisController.signal,onUsage:recordUsage,onPost:post=>progress.add(post),onAssessment:event=>progress.assessment(event),onProgress:message=>{status(message);progress.stage(message);}});
  if(!Array.isArray(result.people)||result.people.some(p=>!Number.isInteger(p.count)||p.count<1||typeof p.name!=='string'))throw Error('The analysis returned invalid results.');
  showingProgress=false;progress.hide();canvas.hidden=false;people=result.people;activeAxes=result.axes;updateAxisSummary();demo=false;renderPeople();reset();
  $('sample').textContent=`${result.platform.toUpperCase()} · ${people.length} POSTERS · ${result.totalPosts} POSTS`;
  $('people-badge').textContent='MODEL ESTIMATES';
  $('coverage').textContent=`${activeAxes.name}. ${result.totalPosts} retrieved posts by ${result.totalAuthors} authors. Top ${people.length} ranked by retrieved post count. ${result.warnings.join(' ')} Scope: ${result.url}`;
  const centered=people.filter(p=>p.centeredAxes?.length).length;
  status(`Analyzed with ${result.model}. ${people.length} plotted${centered?`; ${centered} centered on uncertain axes`:''}. Frequency is the count of retrieved posts, not an LLM estimate.`);
 }catch(e){
  const message=e.name==='AbortError'?'Analysis cancelled.':e.message;
  if(showingProgress){progress.stop(message);$('sample').textContent='NO ANALYSIS RESULTS';$('people-badge').textContent='NO RESULTS';$('detail').textContent='Start another analysis or load a demo crowd.';}
  status(message,e.name!=='AbortError');
 }
 finally{busy=false;$('fields').disabled=false;$('shuffle').disabled=false;$('cancel').hidden=true;$('analyze').disabled=!$('model').value;analysisController=null;}
};
function updateAxisSummary(){
 $('axis-summary').textContent=`${activeAxes.potential.name}: ${activeAxes.potential.low} → ${activeAxes.potential.high}. ${activeAxes.outlook.name}: ${activeAxes.outlook.low} → ${activeAxes.outlook.high}. Height: retrieved post count.`;
 canvas.setAttribute('aria-label',`3D opinion graph. Drag or use arrow keys to rotate. Pinch, scroll, or use plus and minus to zoom. ${$('axis-summary').textContent} Select people from the list to inspect evidence.`);
}
function changePreset(){
 activeAxes=presets.get($('axis-preset').value);updateAxisSummary();
 // Scores belong to their criteria. Never reuse them under a different preset.
 showingProgress=false;progress.hide();canvas.hidden=false;people=[];projected=[];renderPeople();
 $('sample').textContent='READY FOR ANALYSIS';$('people-badge').textContent='NO RESULTS';
 $('coverage').textContent=`Selected: ${activeAxes.name}. Analyze the thread using these criteria, or load a fictional demo crowd.`;
 status('Axes changed. Analyze the thread to get new placements.');
}
$('axis-preset').onchange=changePreset;
function showAxisEditor(definition){
 const editor=$('axis-editor');editor.replaceChildren();
 function field(id,label,value,max,multiline=false){
  const wrapper=node('label',label),input=node(multiline?'textarea':'input');input.id=id;input.value=value;input.maxLength=max;if(multiline)input.rows=3;wrapper.append(input);return wrapper;
 }
 editor.append(field('preset-name','Preset name',definition.name,60));
 for(const [key,title]of [['potential','First axis · left to right in top-down view'],['outlook','Second axis · bottom to top in top-down view']]){
  const section=node('div',undefined,'axis-definition');section.append(node('h4',title));
  const a=definition[key];
  for(const [prop,label,max,multi]of [['name','Axis name',30,false],['low','0 endpoint label',24,false],['high','100 endpoint label',24,false],['criteria','Scoring criteria',1500,true],['center','Meaning of the center (50)',500,true]])section.append(field(`${key}-${prop}`,label,a[prop],max,multi));
  editor.append(section);
 }
 $('axis-review').hidden=false;$('axis-builder').open=true;
}
$('edit-axes').onclick=()=>showAxisEditor(activeAxes);
$('discard-axes').onclick=()=>{$('axis-review').hidden=true;$('axis-editor').replaceChildren();};
$('save-axes').onclick=()=>{
 try{
  const definition={name:$('preset-name').value};
  for(const key of ['potential','outlook'])definition[key]=Object.fromEntries(['name','low','high','criteria','center'].map(prop=>[prop,$(`${key}-${prop}`).value]));
  const preset=validateAxes(definition),id=`custom-${++presetCounter}`;
  presets.set(id,preset);$('axis-preset').append(new Option(preset.name,id));$('axis-preset').value=id;
  $('axis-review').hidden=true;$('axis-editor').replaceChildren();$('axis-builder').open=false;changePreset();
 }catch(e){status(e.message,true);}
};
$('generate-axes').onclick=async()=>{
 if(busy)return;
 try{
  const payload=input(false);if(!payload.model)throw Error('Choose a model before generating axes.');
  busy=true;clearTimeout(debounce);loadVersion++;loadController?.abort();$('fields').disabled=true;$('shuffle').disabled=true;$('cancel').hidden=false;
  analysisController=new AbortController();status('Generating axis definitions with the selected model…');
  const definition=await generateAxes({...payload,description:$('axis-description').value},{signal:analysisController.signal,onUsage:recordUsage});
  showAxisEditor(definition);status('Review the labels, scoring criteria, and center meanings. Save to add this preset for this session.');
 }catch(e){status(e.name==='AbortError'?'Axis generation cancelled.':e.message,e.name!=='AbortError');}
 finally{busy=false;$('fields').disabled=false;$('shuffle').disabled=false;$('cancel').hidden=true;$('analyze').disabled=!$('model').value;analysisController=null;}
};
updateAxisSummary();
generateDemo();

function recordUsage(event){
 usageLedger.record(event);
 const s=usageLedger.snapshot(),count=n=>n.toLocaleString(),money=n=>n>0&&n<.0001?'<$0.0001':`$${n.toFixed(4)}`;
 const cost=s.priced?`${money(s.cost)}${s.unpriced?' partial cost':''}`:s.requests?'cost unavailable':'$0.00';
 $('usage-summary').textContent=`Session · ${count(s.total)}${s.unknown?'+':''} tokens · ${cost}${s.pending?` · ${s.pending} pending`:''}${s.unknown?' · unreported usage':''}`;
 const box=$('usage-breakdown');box.replaceChildren();
 for(const r of s.rows){
  const provider=providers.find(p=>p.id===r.provider)?.name??r.provider;
  box.append(node('p',`${provider} / ${r.model}: ${count(r.input)} input + ${count(r.output)} output = ${count(r.total)} reported tokens. ${r.priced?money(r.cost)+' reported cost':'Cost unavailable'}${r.unpriced?`; cost unavailable for ${r.unpriced} request(s)`:''}. ${r.requests} requests${r.pending?`, ${r.pending} pending`:''}${r.unknown?`, ${r.unknown} with incomplete or unreported usage`:''}.`));
 }
}
