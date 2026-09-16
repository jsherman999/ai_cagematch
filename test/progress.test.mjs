import test from 'node:test';
import assert from 'node:assert/strict';
import { createThreadProgress } from '../lib/progress.js';
function fixture(){
 class Node{
  children=[];textContent='';hidden=false;classList={values:new Set(),add(...names){names.forEach(n=>this.values.add(n));},remove(...names){names.forEach(n=>this.values.delete(n));}};
  append(...nodes){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n);}}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
  replaceChildren(){for(const n of [...this.children])n.remove();}
 }
 const nodes=new Map();const document={createElement:()=>new Node(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);}};
 return {progress:createThreadProgress(document),get:document.getElementById};
}
test('progress counts unique posts, limits cards to top 20, and clears between runs',()=>{
 const {progress,get}=fixture();progress.start();
 for(let i=0;i<22;i++)progress.add({id:String(i),authorId:String(i),name:`Poster ${i}`,handle:`p${i}`});
 progress.add({id:'extra',authorId:'21',name:'Poster 21'});
 progress.add({id:'extra',authorId:'21',name:'Poster 21'});
 progress.stop('Cancelled');
 assert.equal(get('progress-posters').children.length,20);
 const frequent=get('progress-posters').children.find(card=>card.children[0].textContent==='Poster 21');
 assert.equal(frequent.children[1].textContent,'2');
 assert.match(get('progress-summary').textContent,/23 retrieved posts · 22 posters/);
 assert.equal(get('progress-title').textContent,'Analysis stopped');
 progress.start();assert.equal(get('progress-posters').children.length,0);
 assert.equal(get('progress-summary').textContent,'Connecting to Bluesky…');
 progress.add({id:'pending',authorId:'new',name:'New'});progress.hide();
 assert.equal(get('thread-progress').hidden,true);
 progress.start();progress.stop('Error');assert.equal(get('progress-posters').children.length,0);
});
test('model wait retains retrieved counts and replaces the discovery heading',t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const {progress,get}=fixture();progress.start();
 progress.add({id:'1',authorId:'a',name:'Alice'});progress.stage('Read 1 posts. Asking model to assess the top 1 posters…');
 t.mock.timers.tick(80);
 assert.equal(get('progress-title').textContent,'Mapping opinions');
 assert.match(get('progress-summary').textContent,/1 retrieved post · 1 poster/);
 t.mock.timers.tick(8000);assert.match(get('progress-summary').textContent,/1 retrieved post · 1 poster/);
 progress.hide();
});
test('active and completed cards reflect assessment events and reset on cancellation/restart',()=>{
 const {progress,get}=fixture();progress.start();
 progress.add({id:'1',authorId:'a',name:'Alice'});progress.add({id:'2',authorId:'b',name:'Bob'});
 progress.assessment({id:'a',state:'active',completed:0,total:2});
 progress.assessment({id:'b',state:'active',completed:0,total:2});
 const [a,b]=get('progress-posters').children;
 assert.ok(a.classList.values.has('assessing'));assert.ok(b.classList.values.has('assessing'));
 progress.assessment({id:'b',state:'done',completed:1,total:2});
 assert.ok(!b.classList.values.has('assessing'));assert.ok(b.classList.values.has('assessed'));
 assert.equal(get('progress-title').textContent,'Mapping opinions · 1/2 complete');
 progress.stop('Cancelled');assert.ok(!a.classList.values.has('assessing'));
 progress.start();assert.equal(get('progress-posters').children.length,0);progress.hide();
});
