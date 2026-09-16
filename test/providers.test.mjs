import test from 'node:test';
import assert from 'node:assert/strict';
import { detectProvider, selectProvider, providers } from '../lib/providers.js';
import { listModels, analyze } from '../lib/analysis.js';
const url='https://bsky.app/profile/did:plc:abc/post/root';
test('distinctive key prefixes identify providers locally',()=>{
 for(const [key,id]of [['sk-proj-example','openai'],['sk-svcacct-example','openai'],['sk-ant-api03-example','anthropic'],['sk-or-v1-example','openrouter'],['gsk_example','groq'],['xai-example','xai']])assert.equal(detectProvider(key),id);
 assert.equal(detectProvider('  gsk_example  '),'groq');
});
test('ambiguous formats require explicit provider choice and no network probing',async()=>{
 for(const key of ['sk-example','AIzaExample','randomkey',''])assert.equal(detectProvider(key),null);
 assert.throws(()=>selectProvider('','sk-example'),/ambiguous/);
 assert.equal(selectProvider('deepseek','sk-example').id,'deepseek');
 let calls=0;await assert.rejects(()=>listModels({apiKey:'sk-example',url},{request:async()=>{calls++;}}),/ambiguous/);assert.equal(calls,0);
});
test('known prefix mismatch and administrative keys fail before sending a key',async()=>{
 let calls=0;const request=async()=>{calls++;};
 await assert.rejects(()=>listModels({provider:'openai',apiKey:'sk-or-v1-example',url},{request}),/does not match/);
 await assert.rejects(()=>listModels({provider:'openai',apiKey:'sk-admin-example',url},{request}),/administrative/);
 assert.equal(calls,0);
});
test('each preset sends model-list credentials only to its fixed provider origin',async()=>{
 for(const p of providers){
  const result=await listModels({provider:p.id,apiKey:'test-key',url},{request:async(target,opts)=>{
   assert.equal(new URL(target).origin,new URL(p.base).origin);
   if(p.id==='anthropic'){assert.equal(opts.headers['x-api-key'],'test-key');assert.equal(opts.headers.Authorization,undefined);}
   else assert.equal(opts.headers.Authorization,'Bearer test-key');
   return {data:[{id:'test-chat'}]};
  }});assert.deepEqual(result.models,['test-chat']);
 }
});
test('Anthropic model lists paginate without changing credential destination',async()=>{
 let calls=0;
 const result=await listModels({apiKey:'sk-ant-api03-example',url},{request:async(target)=>{
  assert.ok(target.startsWith('https://api.anthropic.com/v1/models?limit=100'));
  return calls++===0?{data:[{id:'claude-a'}],has_more:true,last_id:'cursor'}:{data:[{id:'claude-b'}],has_more:false};
 }});assert.deepEqual(result.models,['claude-a','claude-b']);assert.equal(calls,2);
});
test('Anthropic analysis uses Messages format and validates evidence',async()=>{
 const id='at://did:plc:abc/app.bsky.feed.post/root';
 const result=await analyze({provider:'anthropic',apiKey:'sk-ant-api03-example',model:'test-claude',url},{request:async(target,opts)=>{
  if(target.startsWith('https://public.api.bsky.app/'))return {thread:{post:{uri:id,author:{did:'did:plc:abc',handle:'a.bsky.social'},record:{text:'AI can transform society.'},replyCount:0},replies:[]}};
  assert.equal(target,'https://api.anthropic.com/v1/messages');assert.equal(opts.body.max_tokens,8192);assert.equal(typeof opts.body.system,'string');assert.equal(opts.body.messages[0].role,'user');assert.equal(opts.headers['x-api-key'],'sk-ant-api03-example');
  return {stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({assessments:[{authorId:'a1',potential:90,outlook:null,confidence:'medium',rationale:'Large potential.',evidence:[{postId:id,quote:'AI can transform society.'}]}]})}]};
 }});assert.equal(result.people[0].potential,90);assert.equal(result.people[0].count,1);
});
