// Track every contact so a second finger changes rotation into a pinch.
export function installGraphGestures(canvas,{getZoom,onZoom,onRotate,onTap}){
 const pointers=new Map();let lastDistance=null;
 const distance=()=>{const [a,b]=[...pointers.values()];return a&&b?Math.hypot(b.x-a.x,b.y-a.y):null;};
 function down(e){
  if(e.button!==0)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false});
  canvas.setPointerCapture(e.pointerId);
  if(pointers.size>1){for(const p of pointers.values())p.moved=true;lastDistance=distance();}
 }
 function move(e){
  const p=pointers.get(e.pointerId);if(!p)return;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(Math.hypot(p.x-p.sx,p.y-p.sy)>4)p.moved=true;
  if(pointers.size>1){
   const next=distance();
   if(lastDistance>0&&next>0)onZoom(getZoom()*next/lastDistance);
   lastDistance=next;
  }else if(p.moved)onRotate(dx,dy);
 }
 function end(e){
  const p=pointers.get(e.pointerId);if(!p)return;
  if(e.type==='pointerup'&&!p.moved&&pointers.size===1)onTap(e.clientX,e.clientY);
  pointers.delete(e.pointerId);lastDistance=distance();
  // Remaining contacts keep their current position and cannot become taps.
  for(const remaining of pointers.values()){remaining.sx=remaining.x;remaining.sy=remaining.y;remaining.moved=true;}
 }
 const handlers={pointerdown:down,pointermove:move,pointerup:end,pointercancel:end,lostpointercapture:end};
 for(const [type,handler]of Object.entries(handlers))canvas.addEventListener(type,handler);
 return ()=>{for(const [type,handler]of Object.entries(handlers))canvas.removeEventListener(type,handler);pointers.clear();};
}
