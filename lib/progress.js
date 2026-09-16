// Animate only retrieved posts; the model stage never invents scores or progress percentages.
export function createThreadProgress(document) {
 const $=id=>document.getElementById(id);
 const panel=$('thread-progress'),list=$('progress-posters');
 let queue=[],authors=new Map(),seen=new Set(),timer=null,total=0,message='',started=0,assessmentTotal=0,completed=0;
 const el=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
 function render(){
  const ranked=[...authors.values()].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id)).slice(0,20);
  const keep=new Set(ranked.map(a=>a.card));
  for(const child of [...list.children])if(!keep.has(child))child.remove();
  for(const a of ranked){a.digit.textContent=String(a.count);if(a.card.parentNode!==list)list.append(a.card);}
  $('progress-summary').textContent=`${total} retrieved ${total===1?'post':'posts'} · ${authors.size} ${authors.size===1?'poster':'posters'}${authors.size>20?' · showing top 20':''}`;
 }
 function analysisSummary(){
  if(!assessmentTotal)return;
  const elapsed=Math.floor((Date.now()-started)/1000);
  $('progress-title').textContent=`Mapping opinions · ${completed}/${assessmentTotal} complete`;
  $('progress-note').textContent=`Red: request in progress · Green: complete · ${elapsed}s elapsed. Each request covers one poster’s retrieved posts, with up to two running at once. Allow up to 5 minutes per request.`;
 }
 function consume(){
  const batch=queue.splice(0,Math.max(1,Math.ceil(queue.length/20)));
  for(const post of batch){
   if(seen.has(post.id))continue;seen.add(post.id);total++;
   let a=authors.get(post.authorId);
   if(!a){
    const card=el('div','','discovered-poster'),name=el('span',post.name,'discovered-name'),digit=el('strong','0','discovered-count');
    name.title=`@${post.handle}`;card.append(name,digit,el('small','posts'));
    a={id:post.authorId,count:0,card,digit};authors.set(a.id,a);
   }
   a.count++;
  }
  if(batch.length)render();
  if(!assessmentTotal&&!queue.length&&message.startsWith('Read '))$('progress-title').textContent='Mapping opinions';
  analysisSummary();
 }
 function clearTimer(){clearInterval(timer);timer=null;}
 return {
  start(){clearTimer();queue=[];authors=new Map();seen=new Set();total=0;message='';assessmentTotal=0;completed=0;started=0;list.replaceChildren();panel.hidden=false;panel.classList.remove('stopped');$('progress-title').textContent='Discovering posters';$('progress-summary').textContent='Connecting to Bluesky…';$('progress-note').textContent='Names and counts arrive as posts are retrieved. The graph appears after opinion analysis.';timer=setInterval(consume,80);},
  add(post){queue.push(post);},
  stage(text){message=text;$('progress-note').textContent=text;},
  assessment(event){
   while(queue.length)consume();
   if(!assessmentTotal)started=Date.now();
   assessmentTotal=event.total;completed=event.completed;
   const a=authors.get(event.id);
   if(a){a.card.classList.remove('assessing','assessed','assessment-stopped');a.card.classList.add(event.state==='active'?'assessing':event.state==='done'?'assessed':'assessment-stopped');a.card.title=event.state==='active'?'Analyzing this poster’s posts':event.state==='done'?'Assessment complete':'Assessment stopped';}
   analysisSummary();
  },
  hide(){clearTimer();queue=[];panel.hidden=true;},
  stop(text){clearTimer();while(queue.length)consume();for(const a of authors.values())a.card.classList.remove('assessing');panel.classList.add('stopped');$('progress-title').textContent='Analysis stopped';$('progress-note').textContent=text;}
 };
}
