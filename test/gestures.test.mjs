import test from 'node:test';
import assert from 'node:assert/strict';
import { installGraphGestures } from '../lib/gestures.js';
function setup(){
 const handlers=new Map(),rotations=[],taps=[];let zoom=1;
 const canvas={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),setPointerCapture:()=>{}};
 const cleanup=installGraphGestures(canvas,{getZoom:()=>zoom,onZoom:value=>{zoom=Math.max(.55,Math.min(2.5,value));},onRotate:(...p)=>rotations.push(p),onTap:(...p)=>taps.push(p)});
 const fire=(type,id,x=0,y=0,button=0)=>handlers.get(type)?.({type,pointerId:id,clientX:x,clientY:y,button});
 return {fire,rotations,taps,get zoom(){return zoom;},cleanup};
}
test('single-finger drag rotates; a tap selects without rotating',()=>{
 const g=setup();g.fire('pointerdown',1,20,20);g.fire('pointermove',1,22,21);g.fire('pointerup',1,22,21);
 assert.deepEqual(g.taps,[[22,21]]);assert.deepEqual(g.rotations,[]);
 g.fire('pointerdown',2,20,20);g.fire('pointermove',2,35,30);g.fire('pointerup',2,35,30);
 assert.deepEqual(g.rotations,[[15,10]]);assert.equal(g.taps.length,1);
});
test('horizontal pinch zooms in and out proportionally without rotation or selection',()=>{
 const g=setup();g.fire('pointerdown',1,0,0);g.fire('pointerdown',2,100,0);
 g.fire('pointermove',2,200,0);assert.equal(g.zoom,2);
 g.fire('pointermove',2,100,0);assert.equal(g.zoom,1);
 g.fire('pointerup',2,100,0);g.fire('pointerup',1,0,0);
 assert.deepEqual(g.rotations,[]);assert.deepEqual(g.taps,[]);
});
test('vertical pinch works and clamps at limits without getting stuck',()=>{
 const g=setup();g.fire('pointerdown',1,0,0);g.fire('pointerdown',2,0,100);
 g.fire('pointermove',2,0,1000);assert.equal(g.zoom,2.5);
 g.fire('pointermove',2,0,500);assert.equal(g.zoom,1.25);
 g.fire('pointermove',2,0,1);assert.equal(g.zoom,.55);
});
test('lifting one finger resumes rotation at the current position without jumping',()=>{
 const g=setup();g.fire('pointerdown',1,10,10);g.fire('pointerdown',2,110,10);g.fire('pointermove',1,0,10);
 g.fire('pointerup',2,110,10);g.fire('lostpointercapture',2);g.fire('pointermove',1,5,12);g.fire('pointerup',1,5,12);
 assert.deepEqual(g.rotations,[[5,2]]);assert.deepEqual(g.taps,[]);
});
test('cancelled and lost contacts do not linger or cause false taps',()=>{
 const g=setup();g.fire('pointerdown',1);g.fire('pointerdown',2,100,0);g.fire('pointercancel',1);g.fire('lostpointercapture',2);
 g.fire('pointermove',2,500,0);assert.equal(g.zoom,1);assert.deepEqual(g.taps,[]);
 g.fire('pointerdown',3,4,4);g.fire('pointerup',3,4,4);assert.deepEqual(g.taps,[[4,4]]);
});
test('coincident fingers and a third contact do not produce invalid zoom or false taps',()=>{
 const g=setup();g.fire('pointerdown',1);g.fire('pointerdown',2);g.fire('pointermove',2,100,0);
 assert.equal(g.zoom,1);g.fire('pointerdown',3,150,0);g.fire('pointerup',1);g.fire('pointermove',3,200,0);
 assert.equal(g.zoom,2);g.fire('pointerup',2);g.fire('pointerup',3);assert.deepEqual(g.taps,[]);
});
