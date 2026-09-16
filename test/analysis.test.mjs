import test from 'node:test';
import assert from 'node:assert/strict';
import { providerBase, jsonRequest } from '../lib/network.js';
import { parseThreadURL, rankPosters, fetchBluesky } from '../lib/threads.js';
import { validateAssessments, prepareAuthors, analyze, listModels } from '../lib/analysis.js';

const post=(id,authorId,parentId=null,text='AI could transform everything for the better.')=>({id,authorId,parentId,text,name:authorId,handle:authorId,url:`https://bsky.app/profile/a.bsky.social/post/${id}`});
test('accept only exact public post URLs, never feeds, profiles, DMs, or lookalike hosts',()=>{
 assert.throws(()=>parseThreadURL('https://x.com/alice/status/123?s=20')); 
 assert.equal(parseThreadURL('https://bsky.app/profile/alice.bsky.social/post/3abc').platform,'bluesky');
 for(const url of ['https://x.com/messages/123','https://x.com/alice','https://bsky.app/profile/alice.bsky.social','https://x.com.evil.org/a/status/123','http://x.com/a/status/123','https://user@x.com/a/status/123','https://x.com:444/a/status/123','https://bsky.app/profile/../post/123'])assert.throws(()=>parseThreadURL(url));
});
test('provider endpoint requires HTTPS and excludes URL credentials, query keys and fragments',()=>{
 assert.equal(providerBase('https://api.openai.com/v1/'),'https://api.openai.com/v1');
 for(const url of ['http://api.openai.com/v1','https://u:p@api.example.com','https://api.example.com?key=secret','https://api.example.com:444','https://api.example.com/#secret'])assert.throws(()=>providerBase(url));
});
test('rank top 20 by deterministic deduplicated counts, not by model scores',()=>{
 const posts=Array.from({length:25},(_,i)=>post(String(i),`author-${i}`));posts.push(post('extra','author-24'),posts[0]);
 const ranked=rankPosters(posts);assert.equal(ranked.length,20);assert.equal(ranked[0].id,'author-24');assert.equal(ranked[0].count,2);assert.equal(ranked.find(a=>a.id==='author-0').count,1);
});
function bskyNode(id,parent=null,replies=[],replyCount=replies.length){return {post:{uri:`at://did:plc:abc/app.bsky.feed.post/${id}`,author:{did:`did:plc:${id}`,handle:`${id}.bsky.social`},record:{text:'AI is transformative.',...(parent?{reply:{parent:{uri:`at://did:plc:abc/app.bsky.feed.post/${parent}`}}}:{})},replyCount},replies};}
test('Bluesky follows reply edges and ignores embedded or parent material; marks truncated replies',async()=>{
 const child=bskyNode('child','root'),outsider=bskyNode('outsider','different');const root=bskyNode('root',null,[child,outsider],3);
 root.parent=bskyNode('ancestor');root.post.embed={record:{value:{text:'not in scope'}}};
 const calls=[];
 const result=await fetchBluesky(parseThreadURL('https://bsky.app/profile/did:plc:abc/post/root'),{request:async url=>{calls.push(url);return {thread:root};}});
 assert.deepEqual(result.posts.map(p=>p.id.split('/').at(-1)),['root','child']);assert.equal(result.incomplete,true);assert.ok(calls.every(url=>url.includes('parentHeight=0')));
});
test('Bluesky expands a truncated descendant subtree without leaving the branch',async()=>{
 const nested=bskyNode('child','root',[],1),leaf=bskyNode('leaf','child');
 const discovered=[];
 const result=await fetchBluesky(parseThreadURL('https://bsky.app/profile/did:plc:abc/post/root'),{onPost:p=>discovered.push(p),request:async url=>({thread:new URL(url).searchParams.get('uri').endsWith('/root')?bskyNode('root',null,[nested]):bskyNode('child','root',[leaf])})});
 assert.deepEqual(discovered.map(p=>p.id),result.posts.map(p=>p.id));
 assert.equal(result.posts.length,3);assert.equal(result.incomplete,false);
});
test('model evidence must match the supplied author and literal text; no evidence means no placement',()=>{
 const authors=rankPosters([post('1','a'),post('2','b')]),supplied=prepareAuthors(authors);
 const raw={assessments:supplied.map(a=>({authorId:a.authorId,potential:90,outlook:90,confidence:'high',rationale:'Optimistic.',evidence:[{postId:'1',quote:'AI could transform everything'}]}))};
 const result=validateAssessments(raw,authors,supplied);
 assert.equal(result[0].potential,90);assert.equal(result[1].potential,null);assert.equal(result[1].outlook,null);assert.equal(result[0].count,1);
 raw.assessments[0].potential=101;assert.throws(()=>validateAssessments(raw,authors,supplied),/invalid opinion score/);
});
test('missing and duplicate model assessments are rejected',()=>{
 const authors=rankPosters([post('1','a'),post('2','b')]),supplied=prepareAuthors(authors);
 assert.throws(()=>validateAssessments({assessments:[]},authors,supplied));
 const item={authorId:'a1',potential:null,outlook:null,confidence:'low',rationale:'Unknown',evidence:[]};assert.throws(()=>validateAssessments({assessments:[item,item]},authors,supplied));
});
test('text sampling does not alter deterministic frequency',()=>{
 const authors=rankPosters(Array.from({length:10},(_,i)=>post(String(i),'a',null,'x'.repeat(3000))));const supplied=prepareAuthors(authors);
 assert.equal(authors[0].count,10);assert.equal(supplied[0].posts.reduce((n,p)=>n+p.text.length,0),6000);
});
test('model list comes from provider, with key only in Authorization',async()=>{
 const result=await listModels({endpoint:'https://api.example.com/v1',apiKey:'test-key',url:'https://bsky.app/profile/alice.bsky.social/post/3abc'},{request:async(url,opts)=>{assert.equal(url,'https://api.example.com/v1/models');assert.equal(opts.headers.Authorization,'Bearer test-key');return {data:[{id:'chat-b'},{id:'chat-a'},{id:'chat-b'}]};}});
 assert.deepEqual(result.models,['chat-a','chat-b']);
});
test('end-to-end fixture sends only thread text and validates model evidence',async()=>{
 const request=async(url,options)=>{
  if(url.includes('getPostThread'))return {thread:bskyNode('root')};
  assert.equal(url,'https://api.example.com/v1/chat/completions');assert.equal(options.body.model,'chosen-model');assert.equal(options.body.tools,undefined);
  const supplied=JSON.parse(options.body.messages[1].content);assert.equal(supplied.authors[0].authorId,'a1');assert.ok(!options.body.messages[1].content.includes('root.bsky.social'));
  return {choices:[{finish_reason:'stop',message:{content:JSON.stringify({assessments:[{authorId:'a1',potential:90,outlook:null,confidence:'medium',rationale:'Transformative potential, no outlook evidence.',evidence:[{postId:supplied.authors[0].posts[0].id,quote:'AI is transformative.'}]}]})}}]};
 };
 const result=await analyze({endpoint:'https://api.example.com/v1',apiKey:'test',model:'chosen-model',url:'https://bsky.app/profile/did:plc:abc/post/root'},{request});
 assert.equal(result.people[0].count,1);assert.equal(result.people[0].potential,90);assert.equal(result.people[0].outlook,null);assert.equal(result.totalPosts,1);
});
test('browser request does not use cookies, referrers or redirects; key goes in provider Authorization only',async()=>{
 let seen;
 const result=await jsonRequest('https://provider.example/v1/models',{headers:{Authorization:'Bearer test-key'},fetchImpl:async(url,options)=>{seen={url,options};return new Response(JSON.stringify({data:[]}));}});
 assert.deepEqual(result,{data:[]});assert.equal(seen.url,'https://provider.example/v1/models');assert.equal(seen.options.credentials,'omit');assert.equal(seen.options.redirect,'error');assert.equal(seen.options.referrerPolicy,'no-referrer');assert.equal(seen.options.headers.Authorization,'Bearer test-key');assert.equal(seen.options.body,undefined);
});
test('CORS failures are explicit and never fall back to a proxy',async()=>{
 let calls=0;
 await assert.rejects(()=>jsonRequest('https://provider.example/v1/models',{fetchImpl:async()=>{calls++;throw new TypeError('Failed to fetch');}}),/CORS/);
 assert.equal(calls,1);
});
test('upstream errors never echo response bodies or credentials',async()=>{
 await assert.rejects(()=>jsonRequest('https://provider.example/v1/models',{fetchImpl:async()=>new Response('secret-credential-reflected',{status:401})}),e=>e.message.includes('401')&&!e.message.includes('secret-credential'));
});
test('cancellation is propagated',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>jsonRequest('https://provider.example/v1/models',{signal:controller.signal,fetchImpl:async(_url,o)=>{o.signal.throwIfAborted();}}),{name:'AbortError'});
});
test('LLM key is never sent to Bluesky and no request leaves the two chosen API origins',async()=>{
 const calls=[];
 const request=async(url,options)=>{
  calls.push(url);
  if(url.startsWith('https://public.api.bsky.app/')){
   assert.equal(options.headers,undefined);assert.equal(options.body,undefined);
   return {thread:bskyNode('root')};
  }
  assert.equal(url,'https://provider.example/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer test-key');
  return {choices:[{message:{content:JSON.stringify({assessments:[{authorId:'a1',potential:null,outlook:null,confidence:'low',rationale:'Unknown',evidence:[]}]})}}]};
 };
 const result=await analyze({endpoint:'https://provider.example/v1',apiKey:'test-key',model:'chosen-model',url:'https://bsky.app/profile/did:plc:abc/post/root'},{request});
 assert.equal(calls.length,2);assert.equal(result.people[0].count,1);
});

test('poster requests run two at a time, use five minutes, and keep ranked results despite completion order',async()=>{
 const events=[],pending=[];let inFlight=0,maxInFlight=0;
 const request=async(url,options)=>{
  if(url.includes('getPostThread'))return {thread:bskyNode('root',null,[bskyNode('a','root'),bskyNode('b','root')])};
  assert.equal(options.timeoutMs,300_000);
  const authors=JSON.parse(options.body.messages[1].content).authors;assert.equal(authors.length,1);
  inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
  await new Promise(resolve=>pending.push(resolve));inFlight--;
  return {choices:[{message:{content:JSON.stringify({assessments:[{authorId:authors[0].authorId,potential:null,outlook:null,confidence:'low',rationale:'Unknown',evidence:[]}]})}}]};
 };
 const run=analyze({endpoint:'https://provider.example/v1',apiKey:'test',model:'model',url:'https://bsky.app/profile/did:plc:abc/post/root'},{request,onAssessment:e=>events.push(e)});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,2);
 pending[1]();await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,3);
 pending[2]();pending[0]();const result=await run;
 assert.equal(maxInFlight,2);assert.deepEqual(result.people.map(p=>p.id),['did:plc:a','did:plc:b','did:plc:root']);
 assert.deepEqual(events.filter(e=>e.state==='done').map(e=>e.completed),[1,2,3]);
 assert.equal(events.filter(e=>e.state==='active').length,3);
});
test('a failed poster stops its sibling request and never schedules remaining posters',async()=>{
 let llmCalls=0,aborted=false;
 const request=async(url,options)=>{
  if(url.includes('getPostThread'))return {thread:bskyNode('root',null,[bskyNode('a','root'),bskyNode('b','root')])};
  llmCalls++;
  if(llmCalls===1){await new Promise(resolve=>setImmediate(resolve));throw Error('Provider failure');}
  return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Cancelled','AbortError'));},{once:true}));
 };
 await assert.rejects(analyze({endpoint:'https://provider.example/v1',apiKey:'test',model:'model',url:'https://bsky.app/profile/did:plc:abc/post/root'},{request}),/Provider failure/);
 assert.equal(llmCalls,2);assert.equal(aborted,true);
});
test('configured request timeout reports its actual duration',async()=>{
 // Hold the event loop open while AbortSignal's unref'ed timer fires.
 const hold=setTimeout(()=>{},1000);
 try{await assert.rejects(jsonRequest('https://provider.example/v1',{timeoutMs:5,service:'LLM analysis',fetchImpl:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}),/timed out after 0 seconds/);}
 finally{clearTimeout(hold);}
});
