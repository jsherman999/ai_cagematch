'use strict';
const canvas = document.querySelector('#plot');
const ctx = canvas.getContext('2d');
const names = ['Alex','Morgan','Sam','Riley','Jordan','Casey','Quinn','Avery','Charlie','Taylor','Jamie','Drew','Robin','Skyler','Cameron','Sage','Blake','Reese','Rowan','Emery'];
let people = [], width = 0, height = 0, projected = [];
const colors = ['#daa1b8','#cfb7f4','#b7ace7','#b8c9ef','#b1dfd1','#c2e6ba','#e6d5a8','#d8bca4','#a6cad5','#d8d5c4'];
function project(x,y){
 const scale=Math.max(1,Math.min((width-110)/2.5,(height-80)/2.6));
 return {x:width/2+x*scale,y:height/2+y*scale};
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
 projected=people.map((p,i)=>({...project(p.potential/100,-p.outlook/100),i}));
 projected.forEach(p=>{
  const person=people[p.i],r=6;

  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=person.color;ctx.fill();ctx.strokeStyle='#17251d';ctx.lineWidth=2;ctx.stroke();
  ctx.font='500 12px system-ui';ctx.textAlign='left';ctx.lineWidth=4;ctx.strokeStyle='#19211b';ctx.strokeText(person.name,p.x+12,p.y+4);ctx.fillStyle='#dce5de';ctx.fillText(person.name,p.x+12,p.y+4);
 });
}
function generate(){
 const pool=[...names];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 const crowd=[];pool.slice(0,10).forEach((name,i)=>{let p,tries=0;do{p={name,potential:Math.round(Math.random()*176-88),outlook:Math.round(Math.random()*176-88),color:colors[i]};tries++}while(tries<100&&crowd.some(q=>Math.hypot(q.potential-p.potential,q.outlook-p.outlook)<28));crowd.push(p)});people=crowd;
 document.querySelector('#scores').textContent='Random fictional scores from 0 to 100. Potential: low to high. Outlook: doomer to Pollyanna. '+people.map(p=>`${p.name}: potential ${Math.round((p.potential+100)/2)}, outlook ${Math.round((p.outlook+100)/2)}.`).join(' ');
 draw();
}
new ResizeObserver(()=>{const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()}).observe(canvas);
generate();
