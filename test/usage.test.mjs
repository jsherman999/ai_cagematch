import test from 'node:test';
import assert from 'node:assert/strict';
import {readUsage,trackInference,createUsageLedger} from '../lib/usage.js';
import {generateAxes} from '../lib/analysis.js';
test('usage normalization includes Anthropic cache tokens but does not double count chat reasoning tokens',()=>{
 assert.deepEqual(readUsage({usage:{input_tokens:10,cache_read_input_tokens:20,cache_creation_input_tokens:30,output_tokens:5}},'anthropic'),{input:60,output:5,total:65,cost:null});
 assert.deepEqual(readUsage({usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120,completion_tokens_details:{reasoning_tokens:10},cost:0}},'openrouter'),{input:100,output:20,total:120,cost:0});
 assert.equal(readUsage({usage:{cost:2}},'other').cost,null);
 assert.equal(readUsage({x_groq:{usage:{prompt_tokens:3,completion_tokens:4}}},'groq').total,7);
 assert.equal(readUsage({usage:{prompt_tokens:-1,completion_tokens:NaN,cost:null}},'openrouter').total,null);
});
test('ledger aggregates concurrent requests and models once; missing usage is not free usage',()=>{
 const ledger=createUsageLedger();
 for(const [id,provider,model]of [[1,'openrouter','a'],[2,'anthropic','b'],[3,'openrouter','a']])ledger.record({type:'start',id,provider,model});
 ledger.record({type:'finish',id:2,usage:readUsage(null,'anthropic')});
 const event={type:'finish',id:1,usage:readUsage({usage:{prompt_tokens:10,completion_tokens:5,cost:.002}},'openrouter')};ledger.record(event);ledger.record(event);
 const s=ledger.snapshot();assert.equal(s.total,15);assert.equal(s.cost,.002);assert.equal(s.pending,1);assert.equal(s.unknown,1);assert.equal(s.unpriced,1);assert.equal(s.rows.length,2);
 assert.equal(createUsageLedger().snapshot().requests,0);
});
test('tracking excludes retrieval, marks failures unknown, and skips already-cancelled calls',async()=>{
 const events=[],input={provider:'openrouter',model:'a',apiKey:'never-record-this'};
 const request=trackInference(async()=>{throw Error('Timeout');},input,e=>events.push(e));
 await assert.rejects(request('https://example.com',{method:'GET'}));assert.equal(events.length,0);
 await assert.rejects(request('https://example.com',{method:'POST'}));assert.equal(events.length,2);assert.equal(events[1].usage.total,null);assert.ok(!JSON.stringify(events).includes(input.apiKey));
 const c=new AbortController();c.abort();await assert.rejects(request('https://example.com',{method:'POST',signal:c.signal}),{name:'AbortError'});assert.equal(events.length,2);
});
test('usage from a rejected model output is still recorded before validation',async()=>{
 const ledger=createUsageLedger();
 await assert.rejects(generateAxes({provider:'openrouter',apiKey:'sk-or-v1-test',model:'model',description:'Two axes'},{onUsage:e=>ledger.record(e),request:async()=>({usage:{prompt_tokens:20,completion_tokens:3,cost:.001},choices:[{message:{content:'invalid json'}}]})}));
 assert.equal(ledger.snapshot().total,23);assert.equal(ledger.snapshot().cost,.001);assert.equal(ledger.snapshot().unknown,0);
});
