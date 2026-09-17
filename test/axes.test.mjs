import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_AXES,validateAxes} from '../lib/axes.js';
import {generateAxes,scoringInstructions,analyze,listModels} from '../lib/analysis.js';
const custom={name:'Policy map',potential:{name:'Economics',low:'Left',high:'Right',criteria:'0 favors redistribution; 100 favors free markets.',center:'Mixed policies or unclear evidence.'},outlook:{name:'Policy preference',low:'Policy A',high:'Policy B',criteria:'0 favors A over B; 100 favors B over A.',center:'Equal support, rejection of both, or unclear preference. Explain which.'}};
const input={endpoint:'https://provider.example/v1',apiKey:'test',model:'chosen',description:'Left vs right; policy A vs B'};
test('axis validation produces an independent bounded definition and rejects malformed endpoints',()=>{
 const copy=validateAxes(custom);copy.potential.low='Changed';assert.equal(custom.potential.low,'Left');
 for(const value of [null,{}, {...custom,name:''},{...custom,potential:{...custom.potential,low:'x'.repeat(25)}},{...custom,outlook:{...custom.outlook,high:'Policy A'}}])assert.throws(()=>validateAxes(value));
 assert.equal(validateAxes(DEFAULT_AXES).outlook.high,'Pollyanna');
});
test('axis generation uses selected model/provider and needs no thread URL',async()=>{
 const axes=await generateAxes(input,{request:async(url,options)=>{
  assert.equal(url,'https://provider.example/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer test');assert.equal(options.body.model,'chosen');
  assert.deepEqual(JSON.parse(options.body.messages[1].content),{description:input.description});
  return {choices:[{message:{content:JSON.stringify(custom)}}]};
 }});assert.deepEqual(axes,custom);
 const models=await listModels(input,{request:async()=>({data:[{id:'chosen'}]})});assert.deepEqual(models.models,['chosen']);
});
test('Anthropic generates the same validated definition using Messages',async()=>{
 const axes=await generateAxes({...input,endpoint:undefined,provider:'anthropic',apiKey:'sk-ant-api03-fixture'},{request:async(url,options)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(options.body.model,'chosen');assert.ok(options.body.system.includes('exactly two'));
  return {content:[{type:'text',text:JSON.stringify(custom)}]};
 }});assert.deepEqual(axes,custom);
});
test('bad generation output cannot become a preset',async()=>{
 for(const content of ['not json',JSON.stringify({name:'missing axes'})])await assert.rejects(generateAxes(input,{request:async()=>({choices:[{message:{content}}]})}));
 const c=new AbortController();c.abort();await assert.rejects(generateAxes(input,{signal:c.signal,request:async()=>({})}),{name:'AbortError'});
});
test('custom criteria reach poster analysis and results retain their definition snapshot',async()=>{
 const uri='at://did:plc:abc/app.bsky.feed.post/root';
 const axes=structuredClone(custom);
 const result=await analyze({...input,url:'https://bsky.app/profile/did:plc:abc/post/root',axes},{request:async(url,options)=>{
  if(url.includes('getPostThread'))return {thread:{post:{uri,author:{did:'did:plc:abc',handle:'test.bsky.social'},record:{text:'I favor policy A.'},replyCount:0},replies:[]}};
  const prompt=options.body.messages[0].content;assert.ok(prompt.includes('free markets'));assert.ok(prompt.includes(custom.outlook.center));assert.ok(!prompt.includes('extinction'));
  axes.potential.low='Changed during request';
  return {choices:[{message:{content:JSON.stringify({assessments:[{authorId:'a1',potential:50,outlook:10,confidence:'medium',rationale:'Supports policy A.',evidence:[{postId:uri,quote:'I favor policy A.'}]}]})}}]};
 }});
 assert.deepEqual(result.axes,custom);assert.equal(result.people[0].outlook,10);assert.ok(scoringInstructions().includes('extinction'));
});
