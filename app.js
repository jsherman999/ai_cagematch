'use strict';
const canvas = document.querySelector('#plot');
const ctx = canvas.getContext('2d');
const names = ['Alex','Morgan','Sam','Riley','Jordan','Casey','Quinn','Avery','Charlie','Taylor','Jamie','Drew','Robin','Skyler','Cameron','Sage','Blake','Reese','Rowan','Emery'];
let people = [], selected = 0, yaw = -.38, tilt = .82, zoom = 1, width = 0, height = 0, projected = [];
const colors = ['#daa1b8','#cfb7f4','#b7ace7','#b8c9ef','#b1dfd1','#c2e6ba','#e6d5a8','#d8bca4','#a6cad5','#d8d5c4'];
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
function project(x,z,y=0){
  const rx=x*Math.cos(yaw)-z*Math.sin(yaw), rz=x*Math.sin(yaw)+z*Math.cos(yaw);
  const sy=rz*Math.sin(tilt)-y*Math.cos(tilt), depth=rz*Math.cos(tilt)+y*Math.sin(tilt);
  const perspective=4.8/(4.8+depth);
  const scale=Math.min(width/3.5,height/3.15)*zoom;
  return {x:width/2+rx*scale*perspective,y:height/2+sy*scale*perspective,depth,scale:perspective};
}
function line(a,b,color,lineWidth=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke()}
function label(text,x,z,color){const p=project(x,z);ctx.font='600 10px system-ui';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(text,p.x,p.y)}
function draw(){
 ctx.clearRect(0,0,width,height);
 const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(p=>project(...p));
 ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#a9edc906';ctx.fill();
 for(let n=-1;n<=1.001;n+=.2){line(project(n,-1),project(n,1),'#839d8b22');line(project(-1,n),project(1,n),'#839d8b22')}
 line(project(-1.12,0),project(1.12,0),'#a9edc97a',1.5);
 line(project(0,-1.12),project(0,1.12),'#c8b8ff7a',1.5);
 label('LOW POTENTIAL',-1.23,0,'#a9edc9');label('HIGH POTENTIAL',1.23,0,'#a9edc9');
 label('POLLYANNA',0,-1.23,'#c8b8ff');label('DOOMER',0,1.3,'#c8b8ff');
 projected=people.map((p,i)=>({...project(p.potential/100,-p.outlook/100),i})).sort((a,b)=>b.depth-a.depth);
 projected.forEach(p=>{
  const person=people[p.i],isSelected=p.i===selected,r=(isSelected?7:5)*p.scale;
  if(isSelected){ctx.beginPath();ctx.arc(p.x,p.y,r+6,0,Math.PI*2);ctx.fillStyle=person.color+'18';ctx.fill();ctx.strokeStyle=person.color+'80';ctx.lineWidth=1;ctx.stroke()}
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=person.color;ctx.fill();ctx.strokeStyle='#17251d';ctx.lineWidth=2;ctx.stroke();
  ctx.font=(isSelected?'600 ':'400 ')+'11px system-ui';ctx.textAlign='left';ctx.lineWidth=4;ctx.strokeStyle='#19211b';ctx.strokeText(person.name,p.x+12,p.y+4);ctx.fillStyle=isSelected?'#ffffff':'#c2cec4';ctx.fillText(person.name,p.x+12,p.y+4);
 });
}
function select(i){selected=i;document.querySelectorAll('.person').forEach((b,j)=>{b.classList.toggle('selected',j===i);b.setAttribute('aria-pressed',String(j===i))});
 const p=people[i],potential=Math.round((p.potential+100)/2),outlook=p.outlook;
 document.querySelector('#detail').innerHTML=`<h3>${p.name}</h3><p>${potential>65?'Expects major change':potential<35?'Expects limited change':'Unsure about the scale'} · ${outlook>25?'optimistic':outlook< -25?'pessimistic':'mixed outlook'}</p><div class="score"><span>Potential · low → high</span><span>${potential}/100</span></div><div class="track"><div class="fill" style="width:${potential}%;background:var(--mint)"></div></div><div class="score"><span>Outlook · doomer → Pollyanna</span><span>${Math.round((outlook+100)/2)}/100</span></div><div class="track"><div class="fill" style="width:${(outlook+100)/2}%;background:var(--purple)"></div></div>`;draw();
}
function generate(){
 const pool=[...names];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 const crowd=[];pool.slice(0,10).forEach((name,i)=>{let p,tries=0;do{p={name,potential:Math.round(Math.random()*176-88),outlook:Math.round(Math.random()*176-88),color:colors[i]};tries++}while(tries<100&&crowd.some(q=>Math.hypot(q.potential-p.potential,q.outlook-p.outlook)<28));crowd.push(p)});people=crowd;
 const list=document.querySelector('#people');list.replaceChildren();people.forEach((p,i)=>{const b=document.createElement('button');b.className='person';b.innerHTML=`<span class="dot" style="background:${p.color}"></span>${p.name}`;b.addEventListener('click',()=>select(i));list.append(b)});select(0);
}
function view(top=false){yaw=top?0:-.38;tilt=top?Math.PI/2:.82;zoom=1;syncView();draw()}
function syncView(){const top=Math.abs(tilt-Math.PI/2)<.001&&Math.abs(yaw)<.001;document.querySelector('#top').classList.toggle('active',top);document.querySelector('#top').setAttribute('aria-pressed',String(top));document.querySelector('#perspective').classList.toggle('active',!top);document.querySelector('#perspective').setAttribute('aria-pressed',String(!top));document.querySelector('#view-tag').textContent=top?'TOP-DOWN VIEW':'PERSPECTIVE VIEW'}
function zoomBy(amount){zoom=clamp(zoom+amount,.55,1.65);draw()}
let drag=null;
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)drag.moved=true;yaw+=(e.clientX-drag.x)*.008;tilt=clamp(tilt+(e.clientY-drag.y)*.008,.18,Math.PI/2);drag.x=e.clientX;drag.y=e.clientY;syncView();draw()});
canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.moved){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;const hits=projected.filter(p=>Math.hypot(p.x-x,p.y-y)<18).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));if(hits.length)select(hits[0].i)}drag=null});
canvas.addEventListener('pointercancel',()=>{drag=null});canvas.addEventListener('lostpointercapture',()=>{drag=null});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(-e.deltaY*.001)},{passive:false});
canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;if(e.key==='ArrowUp')tilt=clamp(tilt-.1,.18,Math.PI/2);if(e.key==='ArrowDown')tilt=clamp(tilt+.1,.18,Math.PI/2);if(e.key==='+'||e.key==='=')zoomBy(.1);if(e.key==='-')zoomBy(-.1);if(e.key==='0')view();syncView();draw()});
document.querySelector('#top').onclick=()=>view(true);document.querySelector('#perspective').onclick=()=>view();document.querySelector('#reset').onclick=()=>view();document.querySelector('#zoom-in').onclick=()=>zoomBy(.1);document.querySelector('#zoom-out').onclick=()=>zoomBy(-.1);document.querySelector('#shuffle').onclick=generate;
new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()}).observe(canvas);
generate();
