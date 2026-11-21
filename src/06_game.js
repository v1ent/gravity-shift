// =====================================================================
//  GAME — world state, gravity turns, camera, input, render, HUD, loop
// =====================================================================
const world={rotCD:0,rot:null,timeScale:1,lastKicker:null,lastKickT:-99,time:0,flash:0,shake:0,turns:0,hitstop:0,pendingRot:null,medT:12,barrelQ:[],sgQ:[],arQ:[],lnQ:[],noises:[],spiderT:14,seedLabel:''};
let gameState='menu',winner=null,paused=false;
const cam={yaw:0,pitch:-.15,pos:V(0,0,0),fwd:V(0,0,1)};

function doRotate(key,kicker,stop){
  gibs=[];
  const r=ROT[key];
  rotateGridOnly(key);rotateDeco(key);buildLevelMesh();buildDecoMesh();buildNav();
  const P=(x,y,z)=>{const q=r.pt(x,y,z);return V(q[0],q[1],q[2]);},Vv=(x,y,z)=>{const q=r.vec(x,y,z);return V(q[0],q[1],q[2]);};
  for(const e of chars)if(e!==kicker)e.turnFall=true;
  for(const e of chars){
    if(!e.alive)continue;
    const c=P(e.x,e.y+e.h/2,e.z),v=Vv(e.vx,e.vy,e.vz);
    if(e===kicker){
      if(e.state!=='kick'){e.state='normal';}
      e.h=STAND_H;e.crouch=false;e.cover=null;
      e.x=c.x;e.z=c.z;e.y=key[0]==='+'?L-stop:stop;e.vx=e.vy=e.vz=0;e.grounded=true;e.coyote=.1;
      e.visX=c.x-e.x;e.visY=c.y-(e.y+e.h/2);e.visZ=c.z-e.z;e.visX=e.visZ=0;e.visY=clamp(e.visY,-30,30);
      e.ba=0;e.bav=0;e.kickerSpin=1;e.trail=[];pushOut(e);
    }else{
      e.state='normal';e.h=STAND_H;e.crouch=false;e.runJump=false;e.sprinting=false;
      e.x=c.x;e.y=c.y-e.h/2;e.z=c.z;e.vx=v.x*.4;e.vy=v.y*.4;e.vz=v.z*.4;
      e.turnT=world.time;e.knocked=true;e.stun=.35;e.trail=[];e.grounded=false;e.ba=Math.PI/2;e.bav=0;e.tumbleHold=.5;e.poseBlend=1;e.kickerSpin=0;
      pushOut(e);
    }
    e.fallStart=e.y;
  }
  const ex=[Vv(1,0,0),Vv(0,1,0),Vv(0,0,1)].map(v=>V(Math.round(v.x),Math.round(v.y),Math.round(v.z))),qr=qFromR(ex);
  for(const b of props){
    if(b.dead)continue;
    const c=P(b.x,b.y+b.h/2,b.z),v=Vv(b.vx,b.vy,b.vz);
    if(b.rb){b.x=c.x;b.z=c.z;b.y=c.y-b.h/2;rbTurn(b,qr);b.av=vadd(b.av,V((rnd()-.5)*1.6,(rnd()-.5)*1.6,(rnd()-.5)*1.6));}
    else{if(key[1]==='x'){const t=b.w;b.w=b.h;b.h=t;}else{const t=b.d;b.d=b.h;b.h=t;}b.x=c.x;b.y=c.y-b.h/2;b.z=c.z;}
    b.vx=v.x;b.vy=v.y;b.vz=v.z;b.grounded=false;if(b.rb?solid(tileAt(b.x,b.y+b.h/2,b.z)):true)pushOut(b);
  }
  for(const s of spiders){s.p=P(s.p.x,s.p.y,s.p.z);s.n=Vv(s.n.x,s.n.y,s.n.z);s.n=V(Math.round(s.n.x),Math.round(s.n.y),Math.round(s.n.z));if(s.v)s.v=Vv(s.v.x,s.v.y,s.v.z);if(s.dir)s.dir=Vv(s.dir.x,s.dir.y,s.dir.z);s.look=null;if(s.state==='crawl'&&s.atWp===false){s.state='leap';s.v=V(0,0,0);s.leapT=0;}s.path=null;s.repath=0;syncSpider(s);}
  for(const b of bullets){const p=P(b.x,b.y,b.z),v=Vv(b.vx,b.vy,b.vz);Object.assign(b,{x:p.x,y:p.y,z:p.z,vx:v.x,vy:v.y,vz:v.z});}
  for(const q of rockets){const p=P(q.x,q.y,q.z);q.x=p.x;q.y=p.y;q.z=p.z;q.d=Vv(q.d.x,q.d.y,q.d.z);}
  for(const p of parts){const a=P(p.x,p.y,p.z),v=Vv(p.vx,p.vy,p.vz);Object.assign(p,{x:a.x,y:a.y,z:a.z,vx:v.x,vy:v.y,vz:v.z});if(p.type==='splat')p.type='drop';}
  for(const g of gibs){const a=P(g.x,g.y,g.z),v=Vv(g.vx,g.vy,g.vz);Object.assign(g,{x:a.x,y:a.y,z:a.z,vx:v.x,vy:v.y,vz:v.z});rbTurn(g,qr);}
  corpsesToDolls();
  for(const d of dolls)for(const p of d.pts){const a=P(p.x,p.y,p.z),o=P(p.ox,p.oy,p.oz);Object.assign(p,{x:a.x,y:a.y,z:a.z,ox:o.x,oy:o.y,oz:o.z});}
  for(const e of chars)if(e.ai){e.ai.path=null;e.ai.kickGoal=null;e.ai.wander=null;}
  const piv=player&&player.alive?V(player.x,player.y+48,player.z):V(L/2,L/2,L/2);
  world.rot={t:0,dur:.8,axis:r.axis,a0:r.a0,pivot:piv,kicker};
  world.rotCD=TUT.on?1:4;world.lastKicker=kicker;world.lastKickT=world.time;world.shake=14;world.flash=.5;world.turns++;world.timeScale=.35;
  sfx('rotate');
  for(let i=0;i<60;i++)addPart(kicker.x+(rnd()-.5)*40,kicker.y+10,kicker.z+(rnd()-.5)*40,(rnd()-.5)*500,rnd()*300,(rnd()-.5)*500,.8+rnd()*.6,rnd()<.5?[1,.25,.64]:[.16,.94,1],3,'spark');
  feed.unshift({t:3.5,text:`${kicker.name} ⟳ TURNED THE ARENA`,color:'#ff3fa4'});
}
// display transform used while the arena is turning (shows the old orientation easing into the new one)
function rotFix(){
  if(!world.rot)return M4.ident();
  const u=Math.min(1,world.rot.t/world.rot.dur),a=world.rot.a0*(1-easeInOut(u)),p=world.rot.pivot;
  return M4.mul(M4.translate(p.x,p.y,p.z),M4.mul(M4.rotAxis(world.rot.axis,a),M4.translate(-p.x,-p.y,-p.z)));
}
function rotUnfix(){
  if(!world.rot)return null;
  const u=Math.min(1,world.rot.t/world.rot.dur),a=-world.rot.a0*(1-easeInOut(u)),p=world.rot.pivot;
  return M4.mul(M4.translate(p.x,p.y,p.z),M4.mul(M4.rotAxis(world.rot.axis,a),M4.translate(-p.x,-p.y,-p.z)));
}

// ---------- input ----------
const keys={},pressed={};let mouseDown=false,mouseRight=false,locked=false;
const SENS=.0024;
// demo: switch the camera to the next / previous fighter
function demoCycle(d){const l=chars.filter(c=>!c.isSpider);if(!l.length)return;const i=l.indexOf(player);player=l[((i<0?0:i)+d+l.length)%l.length];cam.yaw=player.yaw;}
const cv=document.getElementById('c'),hud=document.getElementById('hud'),hctx=hud.getContext('2d');
addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(!keys[k])pressed[k]=true;keys[k]=true;
  if(world.demo&&gameState==='play'&&!paused&&!e.repeat){if(k==='a'||k==='arrowleft')demoCycle(-1);if(k==='d'||k==='arrowright')demoCycle(1);}
  if(k==='escape'&&gameState==='play'&&!TUT.cardOpen){setPaused(!paused);}
  if(k==='enter'&&gameState==='over'&&!TUT.cardOpen){if(TUT.on)startTutorial(TUT.id);else newMatch(world.demo?(SETTINGS.seed||'').trim()||undefined:undefined,{demo:world.demo});}
  if(['w','a','s','d',' ','c','e','r','shift'].includes(k))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
addEventListener('mousedown',e=>{if(gameState!=='play'||paused)return;
  if(world.demo){if(e.button===0||e.button===2)demoCycle(e.button===2?-1:1);return;}if(e.button===0){mouseDown=true;pressed['lmb']=true;}if(e.button===2)mouseRight=true;if(e.button===1){pressed['mmb']=true;e.preventDefault();}
  if(!locked&&cv.requestPointerLock){try{const r=cv.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(err){}}});
addEventListener('wheel',e=>{if(gameState==='play'&&!paused){pressed['wheel']=true;e.preventDefault();}},{passive:false});
addEventListener('mouseup',e=>{if(e.button===0)mouseDown=false;if(e.button===2)mouseRight=false;});
addEventListener('contextmenu',e=>e.preventDefault());
function lockMouse(){try{const r=cv.requestPointerLock&&cv.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(e){}}
// Esc while the mouse is captured only releases the capture (the key never reaches the page), so losing it mid-game pauses
document.addEventListener('pointerlockchange',()=>{const was=locked;locked=document.pointerLockElement===cv;
  if(was&&!locked&&gameState==='play'&&!paused&&!TUT.cardOpen)setPaused(true);});
function setPaused(v){
  paused=v;const pm=document.getElementById('pause');if(pm)pm.style.display=v?'flex':'none';
  for(const [id,show] of [['restart',!TUT.on],['newlevel',!TUT.on],['seedrow',!TUT.on],['tutrestart',TUT.on],['tutmenu',TUT.on]]){const el=document.getElementById(id);if(el)el.style.display=show?'':'none';}
  {const h=document.getElementById('phint');if(h)h.textContent=TUT.on?'ESC to resume · restart puts the room back to the start':'ESC to resume · restart keeps your bot settings';}
  for(const k in keys)keys[k]=false;mouseDown=mouseRight=false;
  if(v&&document.pointerLockElement===cv&&document.exitPointerLock)document.exitPointerLock();
}
function wirePause(){
  const q=id=>document.getElementById(id);if(!q('pause'))return;
  q('resume').onclick=()=>{setPaused(false);lockMouse();};
  q('restart').onclick=()=>{setPaused(false);newMatch(world.seedLabel);lockMouse();};
  q('newlevel').onclick=()=>{setPaused(false);newMatch();lockMouse();};
  q('copyseed').onclick=()=>{
    const v=String(world.seedLabel),btn=q('copyseed'),done=t=>{btn.textContent=t;setTimeout(()=>btn.textContent='COPY',1400);};
    const fallback=()=>{const i=q('seedOut');i.focus();i.select();try{document.execCommand('copy')?done('COPIED'):done('Ctrl+C');}catch(e){done('Ctrl+C');}};
    try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(v).then(()=>done('COPIED'),fallback);else fallback();}catch(e){fallback();}
  };
  q('tomenu').onclick=()=>{setPaused(false);TUT.on=false;world.demo=false;gameState='menu';showMenu('pgMain');};
  q('tutrestart').onclick=()=>{setPaused(false);startTutorial(TUT.id);};
  q('tutmenu').onclick=()=>{openTutMenu();};
}
wirePause();
addEventListener('mousemove',e=>{if(gameState!=='play'||paused)return;
  const k=SENS*(SETTINGS.sens/100)*(cam.zoom||1);cam.yaw-=e.movementX*k;cam.pitch=clamp(cam.pitch-e.movementY*k,-1.35,1.25);});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouseDown=mouseRight=false;});
function playerInput(first){
  const c=player.ctl,fw=V(Math.sin(cam.yaw),0,Math.cos(cam.yaw)),rt=V(-Math.cos(cam.yaw),0,Math.sin(cam.yaw));
  let f=(keys['w']?1:0)-(keys['s']?1:0),s=(keys['d']?1:0)-(keys['a']?1:0);
  if(padMove){f=clamp(f+padMove.f,-1,1);s=clamp(s+padMove.s,-1,1);}
  let mx=fw.x*f+rt.x*s,mz=fw.z*f+rt.z*s;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l;}
  c.mx=mx;c.mz=mz;
  c.jump=first&&!!pressed[' '];c.jumpHeld=!!keys[' '];c.grab=!!keys[' '];
  c.sprint=!!keys['shift']||(padSprint&&!!padMove);c.crouch=!!keys['c'];c.crouchPressed=first&&!!pressed['c'];
  c.fire=mouseDown;c.fireClick=first&&!!pressed['lmb'];c.alt=false;c.aim=mouseRight;c.rocketClick=first&&!!pressed['mmb'];c.kick=first&&!!pressed['e'];c.reload=first&&!!pressed['r'];
  c.swap=first&&!!(pressed['wheel']||pressed['q']);c.select=first?(pressed['1']?'pistol':pressed['2']?'rocket':pressed['3']?'shotgun':pressed['4']?'rifle':null):null;
  // double-tap S / A / D: dodge
  const tap=k=>{if(!(first&&pressed[k]))return false;const t=performance.now()/1000,l=dblTap[k]||-9;dblTap[k]=t;if(t-l<.3){dblTap[k]=-9;return true;}return false;};
  c.dodge=tap('s')?'back':tap('a')?'left':tap('d')?'right':null;if(first&&padDodge)c.dodge=padDodge;
  c.wave=first&&!!pressed['t'];
  c.aimYaw=cam.yaw;c.aimPitch=cam.pitch;
}
const dblTap={};

// ---------- camera ----------
function updateCamera(){
  // demo: the camera looks where the followed bot looks
  if(world.demo&&player){cam.yaw+=angDiff(player.yaw,cam.yaw)*.12;cam.pitch+=(clamp((player.pitch||0)*.6-.12,-.8,.6)-cam.pitch)*.08;}
  // aiming zooms in a little (and slows the mouse to match)
  {const p=player,z=p&&p.alive&&p.aiming?.72:1;cam.zoom=(cam.zoom||1)+(z-(cam.zoom||1))*.18;}
  const p=player;
  const crouchDrop=p.alive?(STAND_H-p.h)*.6:0;
  const head=V(p.x,p.y+57-crouchDrop+(p.stepOff||0),p.z);
  const fw=fwdOf(cam.yaw,cam.pitch),rt=V(-Math.cos(cam.yaw),0,Math.sin(cam.yaw));
  const pivot=vadd(head,vadd(vscale(rt,24),V(0,10,0)));
  let back=150;
  const r=rayVoxel(pivot,vscale(fw,-1),back+8);if(r.t<back+8)back=Math.max(8,r.t-8);
  // keep the shoulder pivot itself out of walls
  let pv=pivot;if(solid(tileAt(pv.x,pv.y,pv.z)))pv=head;
  let pos=vadd(pv,vscale(fw,-back));
  if(world.shake>0)pos=vadd(pos,V((rnd()-.5)*world.shake*.6,(rnd()-.5)*world.shake*.6,(rnd()-.5)*world.shake*.6));
  cam.pos=pos;cam.fwd=fw;cam.back=back;
  // aim point: what's under the crosshair (in world coordinates, also while the arena turns)
  let o=pos,d=fw;const un=rotUnfix();if(un){o=M4.apply(un,o);d=M4.applyDir(un,d);}
  let tHit=rayVoxel(o,d,3000).t;
  for(const e of chars){if(e===p||!e.alive||e.vis<.35)continue;const tt=rayAABB(o,d,e.x-e.w/2,e.y,e.z-e.w/2,e.x+e.w/2,e.y+e.h,e.z+e.w/2);if(tt!==null&&tt<tHit)tHit=tt;}
  tHit=Math.max(tHit,back+30);
  p.aimPoint=vadd(o,vscale(d,tHit));
}
function rayAABB(o,d,x0,y0,z0,x1,y1,z1){
  let tmin=0,tmax=1e9;
  for(const [oo,dd,a,b] of [[o.x,d.x,x0,x1],[o.y,d.y,y0,y1],[o.z,d.z,z0,z1]]){
    if(Math.abs(dd)<1e-9){if(oo<a||oo>b)return null;continue;}
    let t1=(a-oo)/dd,t2=(b-oo)/dd;if(t1>t2){const t=t1;t1=t2;t2=t;}
    tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);if(tmin>tmax)return null;
  }
  return tmin;
}

// ---------- step ----------
function step(dt,first){
  if(world.hitstop>0){
    world.hitstop-=dt;
    if(world.hitstop<=0&&world.pendingRot){const p=world.pendingRot;world.pendingRot=null;if(p.kicker.alive)doRotate(p.key,p.kicker,p.stop);}
    return;
  }
  world.time+=dt;
  if(world.rotCD>0&&!world.rot)world.rotCD-=dt;
  world.medT-=dt;
  if(world.medT<=0){world.medT=13+rnd()*9;if(props.filter(b=>b.kind==='medkit'&&!b.dead).length<3)spawnDrop('medkit');}
  if(world.barrelQ.length&&world.time>=world.barrelQ[0]){world.barrelQ.shift();spawnDrop('barrel');}
  world.lnQ.sort((a,b)=>a-b);if(world.lnQ.length&&world.time>=world.lnQ[0]){world.lnQ.shift();if(props.filter(q=>q.kind==='launcher'&&!q.dead).length<5)spawnDrop('launcher');}
  world.arQ.sort((a,b)=>a-b);if(world.arQ.length&&world.time>=world.arQ[0]){world.arQ.shift();if(props.filter(q=>q.kind==='rifle'&&!q.dead).length<1)spawnDrop('rifle');}
  world.sgQ.sort((a,b)=>a-b);if(world.sgQ.length&&world.time>=world.sgQ[0]){world.sgQ.shift();if(props.filter(q=>q.kind==='shotgun'&&!q.dead).length<2)spawnDrop('shotgun');}
  world.noises=world.noises.filter(n=>world.time-n.t<.15);
  if(player&&!player.isBot)playerInput(first);
  for(const e of chars)if(e.isBot)botThink(e,dt);
  for(const e of chars)updateChar(e,dt);
  updateProps(dt);
  for(const e of chars)charProps(e);
  if(props.some(b=>b.dead))props=props.filter(b=>!b.dead);
  updateSpiders(dt);
  updateBullets(dt);updateRockets(dt);updateDolls(dt);updateCorpses(dt);updateGibs(dt);updateFires(dt);updateParts(dt);
  if(TUT.on)tutStep(dt);
}

// ---------- render ----------
let W=0,H=0,DPR=1;
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*DPR|0;cv.height=H*DPR|0;hud.width=W*DPR|0;hud.height=H*DPR|0;}
addEventListener('resize',resize);resize();
function project(p){
  const q=M4.apply(FR.fix,p),v=FR.vp;
  const x=v[0]*q.x+v[4]*q.y+v[8]*q.z+v[12],y=v[1]*q.x+v[5]*q.y+v[9]*q.z+v[13],w=v[3]*q.x+v[7]*q.y+v[11]*q.z+v[15];
  if(w<=1)return null;return {x:(x/w*.5+.5)*W,y:(1-(y/w*.5+.5))*H,w};
}
function render(){
  const gl=R.gl;
  gl.viewport(0,0,cv.width,cv.height);gl.clearColor(.05,.03,.1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  drawSky();
  const proj=M4.persp(1.2*(cam.zoom||1),W/H,2,5000);
  // the latest explosion lights up everything around it for a moment
  {const f=world.xflash;let k=0;if(f){const a=(world.time-f.t)/f.dur;k=a<0||a>1?0:a<.06?a/.06:(1-a)*(1-a);}
   FR.light=k>0?{p:f.p,r:f.r,c:f.col.map(v=>v*k*1.35)}:null;}
  FR.vp=M4.mul(proj,M4.lookAt(cam.pos,vadd(cam.pos,cam.fwd),V(0,1,0)));
  FR.fix=rotFix();FR.time=world.time;
  beginMain();drawLevelMesh();
  cubeBegin();
  for(const b of props)drawProp(b);
  for(const s of spiders)drawSpider(s);
  drawDrones();
  for(const d of dolls)drawDoll(d);if(SKN.ready)drawCorpses();
  if(window.VIEWER_DRAW)VIEWER_DRAW();
  drawGibs();
  // bullets & rockets
  for(const b of bullets){const k=Math.min(.03,Math.max(0,(b.life0||.6)-b.life));if(k<.004)continue; // the tail never reaches back past the muzzle
    const tail=V(b.x-b.vx*k,b.y-b.vy*k,b.z-b.vz*k);drawSeg(tail,V(b.x,b.y,b.z),1.6,b.col,b.col,null,1);}
  for(const r of rockets){drawSeg(V(r.x-r.d.x*10,r.y-r.d.y*10,r.z-r.d.z*10),V(r.x,r.y,r.z),5,hexRGB('#3a2a2a'),[.2,.06,0],[1,.6,.2],1);drawBox(V(r.x,r.y,r.z),5,5,5,[1,.8,.4],[1,.7,.3],null);}
  // fighters (the kicker of a turn stays upright on screen while the arena swings under him)
  const kickerFix=world.rot&&world.rot.kicker===player;
  const opaque=[],ghost=[];
  const camFade=clamp(((cam.back||135)-14)/50,0,1); // camera squeezed against a wall: fade our own fighter out
  for(const e of chars){if(!e.alive)continue;const v=e===player?Math.max(e.vis,.28)*camFade:e.vis;if(v>=.99)opaque.push(e);else if(v>.02)ghost.push([e,v]);}
  const drawOne=(e,v)=>{
    if(kickerFix&&e===player){R.gl.uniformMatrix4fv(R.main.loc.uWorldFix,false,M4.ident());drawChar(e,v);R.gl.uniformMatrix4fv(R.main.loc.uWorldFix,false,FR.fix);}
    else drawChar(e,v);
  };
  for(const e of opaque)drawOne(e,1);
  for(const [e,v] of ghost)drawOne(e,v);
  // particles
  const add=[],alpha=[];
  for(const p of parts){
    const a=clamp(p.life/p.max,0,1);
    if(p.type==='ember')add.push({x:p.x,y:p.y,z:p.z,r:p.col[0],g:p.col[1],b:p.col[2],a:Math.min(1,a*2)*(.6+.4*Math.sin(p.life*30+p.x)),s:p.size});
    else if(p.type==='scorch')alpha.push({x:p.x,y:p.y,z:p.z,r:p.col[0],g:p.col[1],b:p.col[2],a:Math.min(1,a*3)*.8,s:p.size});
    else if(p.type==='spark'||p.type==='glow'||p.type==='flame')add.push({x:p.x,y:p.y,z:p.z,r:p.col[0],g:p.col[1],b:p.col[2],a:a,s:p.size*(p.type==='flame'?(.6+a*.6):1)});
    else if(p.type==='drop'||p.type==='splat')alpha.push({x:p.x,y:p.y,z:p.z,r:p.col[0],g:p.col[1],b:p.col[2],a:p.type==='drop'?.95:Math.min(1,a*3)*.9,s:p.size*(p.type==='splat'?1.5:1)});
    else alpha.push({x:p.x,y:p.y,z:p.z,r:p.col[0],g:p.col[1],b:p.col[2],a:a*(p.type==='smoke'?.55:.45),s:p.size*(1.6-a*.6)});
  }
  pickupGlows(add);
  drawParticles(alpha,false);drawParticles(add,true);
  drawHUD();drawFPS(hctx);
}
function drawHUD(){
  const c=hctx,p=player;c.setTransform(DPR,0,0,DPR,0,0);c.clearRect(0,0,W,H);
  if(gameState==='menu')return;
  c.font='bold 14px "Courier New",monospace';c.textBaseline='alphabetic';
  // name tags + prompts
  for(const e of chars){if(e===p||!e.alive||e.vis<.5)continue;const s=project(V(e.x,e.y+e.h+14,e.z));if(!s)continue;
    if(!losClear(headPos(p),headPos(e)))continue;
    c.textAlign='center';c.font='bold 11px "Courier New",monospace';c.fillStyle=e.color;c.fillText(e.name,s.x,s.y-4);
    c.fillStyle='rgba(0,0,0,.6)';c.fillRect(s.x-15,s.y,30,3);c.fillStyle=e.color;c.fillRect(s.x-15,s.y,30*clamp(e.hp/100,0,1),3);}
  c.textAlign='left';c.font='bold 14px "Courier New",monospace';
  // bottom-left panel
  c.fillStyle='rgba(5,6,14,.7)';c.fillRect(16,H-78,300,66);
  c.fillStyle='#29f0ff';c.fillText('INTEGRITY',24,H-58);
  c.fillStyle='rgba(41,240,255,.15)';c.fillRect(24,H-52,170,10);
  c.fillStyle=p.hp>35?'#29f0ff':'#ff3f5a';c.fillRect(24,H-52,170*clamp(p.hp/100,0,1),10);
  c.fillStyle='rgba(157,255,58,.12)';c.fillRect(24,H-37,170,4);c.fillStyle=p.stam>.25?'#9dff3a':'#ff9a3a';c.fillRect(24,H-37,170*p.stam,4);
  c.textAlign='right';c.fillStyle=WEAPON_COL[p.weapon];c.fillText(p.weapon==='rocket'?`LAUNCHER ${p.rockets}/${rMag(p)}`:p.reload>0?'RELOAD':`${WEAPON_NAME[p.weapon]} ${p.ammo}/${magOf(p)}`,308,H-44);
  {const own=ownedWeapons(p).filter(w=>w!==p.weapon);if(own.length){c.font='11px "Courier New",monospace';c.fillStyle='#778';c.fillText((SETTINGS.input==='gamepad'?'Y ⇅ ':'wheel ⇅ ')+own.map(w=>`${WEAPON_NAME[w]} ${w==='rocket'?p.rockets:p.stash[w]}`).join('  '),308,H-84);c.font='bold 14px "Courier New",monospace';}}
  c.fillStyle='#ff5a3c';c.fillText(p.rreload>0?(p.bigLauncher?'LOADING ROCKETS':`RECHARGING ${Math.round((1-p.rreload/RRELOAD_S)*100)}%`):`ROCKETS ${'◆'.repeat(p.rockets)}${'◇'.repeat(Math.max(0,rMag(p)-p.rockets))}`,308,H-22);
  c.textAlign='left';
  if(p.alive&&(p.hidden||p.crouchT>0)){
    if(p.hidden){c.fillStyle='#b06bff';c.globalAlpha=.7+.3*Math.sin(world.time*4);c.fillText('◈ CLOAKED',24,H-88);c.globalAlpha=1;}
    else{c.fillStyle='rgba(176,107,255,.25)';c.fillRect(24,H-94,100,5);c.fillStyle='#b06bff';c.fillRect(24,H-94,100*clamp(p.crouchT/STEALTH_T,0,1),5);}
  }
  const TH=TUT.on?(TUT.cfg&&TUT.cfg.hud)||{}:null;
  // gravity status
  c.textAlign='center';if(!TH||TH.gravity){
  const ready=world.rotCD<=0&&!world.rot;
  c.fillStyle=ready?'#ff3fa4':'#7a5068';c.fillText(ready?'◆ GRAVITY PANELS ARMED ◆':`GRAVITY PANELS RECHARGING ${world.rotCD.toFixed(1)}s`,W/2,26);
  c.font='11px "Courier New",monospace';c.fillStyle='#778';c.fillText(`ARENA TURNS: ${world.turns}`,W/2,42);
  if(p.kickPrompt&&ready&&p.alive){c.font='bold 16px "Courier New",monospace';c.fillStyle='#ff3fa4';c.globalAlpha=.6+.4*Math.sin(world.time*8);c.fillText('[E] KICK THE PANEL — TURN THE ARENA',W/2,H/2+70);c.globalAlpha=1;}}
  // scoreboard + feed
  c.textAlign='right';c.font='bold 13px "Courier New",monospace';
  // one block per side: a team shows its averaged score, then its members
  const rows=[];
  if(!TH||TH.score){const seen=new Set(),sides=[];for(const q of chars){const k=q.team||q;if(seen.has(k))continue;seen.add(k);sides.push(q);}
    sides.sort((a,b)=>sideScore(b)-sideScore(a));
    for(const s of sides){const m=sideMembers(s).sort((a,b)=>b.kills-a.kills);
      if(m.length>1){rows.push({team:true,col:s.color,name:'⚑ TEAM',score:sideScore(s)});for(const q of m)rows.push({q,sub:true});}
      else rows.push({q:m[0]});}}
  if(rows.length){
  c.fillStyle='rgba(5,6,14,.7)';c.fillRect(W-196,12,184,22+rows.length*18);
  c.fillStyle='#889';c.fillText(`FRAGS / ${world.fragLimit||FRAG_LIMIT}`,W-20,28);
  rows.forEach((r,i)=>{const y=48+i*18;
    if(r.team){c.fillStyle=r.col;c.textAlign='left';c.fillText(r.name,W-188,y);c.textAlign='right';c.fillText(r.score.toFixed(1),W-20,y);return;}
    const q=r.q;c.fillStyle=q.color;c.textAlign='left';c.fillText((q===p?'▶ ':'  ')+(r.sub?' ':'')+q.name,W-188,y);c.textAlign='right';c.fillText(`${q.kills}  ${q.deaths}`,W-20,y);});
  c.font='12px "Courier New",monospace';
  feed.slice(0,5).forEach((f,i)=>{c.globalAlpha=clamp(f.t,0,1);c.fillStyle=f.color;c.fillText(f.text,W-20,60+rows.length*18+i*16);});c.globalAlpha=1;}
  // crosshair
  const cx=W/2,cy=H/2,hm=p.hitMarker>0,sp=6+p.recoil*4+(p.bloom||0)*260+(Math.hypot(p.vx,p.vz)>60?3:0);
  c.strokeStyle=hm?'#fff':'#29f0ff';c.lineWidth=2;c.beginPath();
  c.moveTo(cx-sp-6,cy);c.lineTo(cx-sp,cy);c.moveTo(cx+sp,cy);c.lineTo(cx+sp+6,cy);c.moveTo(cx,cy-sp-6);c.lineTo(cx,cy-sp);c.moveTo(cx,cy+sp);c.lineTo(cx,cy+sp+6);c.stroke();
  c.fillStyle='#29f0ff';c.fillRect(cx-1,cy-1,2,2);
  if(p.weapon==='shotgun'){const rr=Math.tan(SG_SPREAD)/Math.tan(.6)*H/2;c.strokeStyle='rgba(255,138,42,.7)';c.beginPath();c.arc(cx,cy,rr,0,7);c.stroke();}
  if(hm){c.strokeStyle='#ff3fa4';c.beginPath();c.moveTo(cx-5,cy-5);c.lineTo(cx+5,cy+5);c.moveTo(cx+5,cy-5);c.lineTo(cx-5,cy+5);c.stroke();}
  c.textAlign='center';
  if(!locked&&gameState==='play'&&!paused&&SETTINGS.input!=='gamepad'&&!world.demo){c.font='12px "Courier New",monospace';c.fillStyle='#889';c.fillText('click to capture the mouse',W/2,H-16);}
  if(!p.alive&&gameState==='play'){c.font='bold 26px "Courier New",monospace';c.fillStyle='#ff3f5a';c.fillText('SIGNAL LOST',W/2,H/2-40);c.font='14px "Courier New",monospace';c.fillStyle='#aab';c.fillText(`re-deploying in ${Math.max(0,p.respawn).toFixed(1)}s`,W/2,H/2-18);}
  // bowing: the rest of the screen dims, a soft spotlight on the two of you
  {const m=p.alive&&p.emote&&p.emote.kind==='bow'?p.emote:null;
   world.bowDim=approach(world.bowDim||0,m?1:0,1/60*(m?2.5:4));
   if(world.bowDim>.01){const q=m&&m.partner?m.partner:p,mid=V((p.x+q.x)/2,(p.y+q.y)/2+40,(p.z+q.z)/2),s=project(mid);
     const cx=s&&s.x!==undefined?s.x:W/2,cy=s&&s.y!==undefined?s.y:H/2,r0=Math.min(W,H)*.16,r1=Math.min(W,H)*.62;
     const g=c.createRadialGradient(cx,cy,r0,cx,cy,r1);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,6,${.62*world.bowDim})`);
     c.fillStyle=g;c.fillRect(0,0,W,H);}}
  // demo banner
  if(world.demo){c.font='bold 13px "Courier New",monospace';c.textAlign='center';c.fillStyle='rgba(5,6,14,.65)';c.fillRect(W/2-300,52,600,24);
    c.fillStyle=p.color;c.fillText(`DEMO · following ${p.name} · A / D or click to switch · ESC for the menu`,W/2,69);
    if(gameState==='over'){world.demoT=(world.demoT||0)+1/60;if(world.demoT>7)newMatch((SETTINGS.seed||'').trim()||undefined,{demo:true});}}
  // cover
  if(p.alive&&gameState==='play'&&!world.demo&&p.state==='normal'){
    const pad=SETTINGS.input==='gamepad';let tip=null,col='#9fe8ff';
    if(p.cover){tip=p.aiming?'IN COVER — firing over it':(pad?'IN COVER · hold RB to rise and shoot · B or walk away to leave':'IN COVER · hold right mouse to rise and shoot · C or walk away to leave');col=p.aiming?'#ffcc33':'#3dff7a';}
    else if(p.grounded&&!p.sprinting&&!p.crouch&&coverIn(p,cardOf(Math.sin(p.yaw),Math.cos(p.yaw)),14))tip=pad?'B — take cover':'C — take cover';
    if(tip){c.font='bold 12px "Courier New",monospace';c.textAlign='center';c.fillStyle='rgba(5,6,14,.55)';const tw=c.measureText(tip).width+18;c.fillRect(W/2-tw/2,H*.74-14,tw,20);c.fillStyle=col;c.fillText(tip,W/2,H*.74);c.textAlign='left';}
  }
  // alliance prompts
  if(p.alive&&gameState==='play'&&!world.demo&&(!TUT.on||(TUT.cfg&&TUT.cfg.allyHud))){
    c.font='bold 14px "Courier New",monospace';c.textAlign='center';
    if(p.emote&&p.emote.kind==='wave'){c.fillStyle='#ccd';c.fillText('WAVING — an enemy who stands in front of you and presses T joins you',W/2,H/2+96);}
    else if(p.emote&&p.emote.kind==='bow'){c.fillStyle=p.emote.partner.color;c.fillText(`⚑ FORMING AN ALLIANCE WITH ${p.emote.partner.name}…`,W/2,H/2+96);}
    else{let w=null;for(const o of chars)if(o!==p&&o.alive&&o.emote&&o.emote.kind==='wave'&&canAlly(o,p)&&Math.hypot(o.x-p.x,o.z-p.z)<500){w=o;break;}
      if(w){c.fillStyle=w.color;c.globalAlpha=.65+.35*Math.sin(world.time*6);c.fillText(inFrontOf(w,p)?`[T] ACCEPT ${w.name}'S ALLIANCE`:`⚑ ${w.name} OFFERS AN ALLIANCE — stand in front of them and press T`,W/2,H/2+96);c.globalAlpha=1;}}
  }
  if(TUT.on)tutHUD(c);
  if(paused){c.fillStyle='rgba(0,0,0,.55)';c.fillRect(0,0,W,H);}
  if(gameState==='over'&&winner){c.fillStyle='rgba(0,0,0,.6)';c.fillRect(0,0,W,H);c.font='bold 40px "Courier New",monospace';c.fillStyle=winner.color;c.fillText(!world.demo&&(winner===p||allied(winner,p))?(TUT.on?'YOU WIN':winner.team?'YOUR TEAM WINS THE ARENA':'YOU WIN THE ARENA'):`${winner.team?'TEAM '+sideName(winner):winner.name} WINS`,W/2,H/2-10);if(winner.team){c.font='15px "Courier New",monospace';c.fillText(sideName(winner).split('+').join('  ·  '),W/2,H/2+50);}c.font='16px "Courier New",monospace';c.fillStyle='#ccd';if(!TUT.on)c.fillText('press ENTER for a new arena',W/2,H/2+24);}
  if(world.flash>0){c.fillStyle=`rgba(255,63,164,${world.flash*.3})`;c.fillRect(0,0,W,H);}
}

// ---------- settings (start screen) ----------
const SETTINGS={bots:3,skill:'normal',frags:15,color:'#29f0ff',name:'',seed:'',input:'mouse',sens:100,music:55,fx:80,fps:false,assist:true,assistStr:50,padSeen:false};
const playerName=()=>(SETTINGS.name||'').trim().toUpperCase().slice(0,12)||'YOU';
const PLAYER_COLORS=['#29f0ff','#ff3fa4','#ffb020','#9dff3a','#b06bff','#ff5a3c','#ffffff','#3c8cff','#ffe23c','#00e0a0'];
// a bot (or tutorial actor) that would share your colour gets the colour you gave up
function freeColor(col){const used=new Set(chars.map(c=>c.color));return PLAYER_COLORS.find(k=>!used.has(k))||col;}
function fixColorClash(){const p=chars.find(c=>!c.isBot);if(!p)return;for(const b of chars)if(b!==p&&b.color.toLowerCase()===p.color.toLowerCase()){b.color=freeColor(b.color);b.col=hexRGB(b.color);}}
try{const s=JSON.parse(localStorage.getItem('gravityShiftSettings')||'null');if(s){if(s.bots>=0&&s.bots<=7)SETTINGS.bots=s.bots|0;if(BOT_SKILLS[s.skill])SETTINGS.skill=s.skill;if(s.frags>=10&&s.frags<=50)SETTINGS.frags=s.frags|0;if(PLAYER_COLORS.includes(s.color))SETTINGS.color=s.color;
  if(typeof s.name==='string')SETTINGS.name=s.name.slice(0,12);if(typeof s.seed==='string')SETTINGS.seed=s.seed.slice(0,40);if(s.input==='gamepad')SETTINGS.input='gamepad';
  for(const k of ['sens','music','fx'])if(typeof s[k]==='number'&&s[k]>=0&&s[k]<=250)SETTINGS[k]=s[k];SETTINGS.fps=!!s.fps;if(typeof s.assist==='boolean')SETTINGS.assist=s.assist;if(typeof s.assistStr==='number'&&s.assistStr>=0&&s.assistStr<=100)SETTINGS.assistStr=s.assistStr;SETTINGS.padSeen=!!s.padSeen||SETTINGS.input==='gamepad';}}catch(e){}
function getSettings(){return SETTINGS;}
function saveSettings(){try{localStorage.setItem('gravityShiftSettings',JSON.stringify(SETTINGS));}catch(e){}}
function setupMenu(){
  {const cw=document.getElementById('pcol');
   const drawC=()=>{if(!cw)return;cw.innerHTML='';for(const k of PLAYER_COLORS){const b=document.createElement('button');b.className='sw'+(SETTINGS.color===k?' on':'');b.style.background=k;b.style.color=k;b.title=k;b.onclick=()=>{SETTINGS.color=k;saveSettings();drawC();};cw.appendChild(b);}};
   drawC();}
  {const sl=document.getElementById('fragSl'),fv=document.getElementById('fragV');
   if(sl){sl.value=SETTINGS.frags;fv.textContent=SETTINGS.frags;sl.oninput=()=>{SETTINGS.frags=+sl.value;fv.textContent=sl.value;saveSettings();};}}
  const bw=document.getElementById('bots'),sw=document.getElementById('skill');if(!bw||!sw)return;
  const draw=()=>{
    bw.innerHTML='';for(let n=0;n<=7;n++){const b=document.createElement('button');b.className='opt'+(SETTINGS.bots===n?' on':'');b.textContent=n;b.onclick=()=>{SETTINGS.bots=n;saveSettings();draw();};bw.appendChild(b);}
    sw.innerHTML='';for(const k of Object.keys(BOT_SKILLS)){const b=document.createElement('button');b.className='opt'+(SETTINGS.skill===k?' on':'');b.textContent=BOT_SKILLS[k].label;b.onclick=()=>{SETTINGS.skill=k;saveSettings();draw();};sw.appendChild(b);}
    const d=document.getElementById('skilldesc');
    if(d){const c=BOT_SKILLS[SETTINGS.skill];d.textContent=`vision ${c.fov}° · react ${c.react[0]}–${c.react[1]} s · ${SETTINGS.skill==='easy'?'shaky aim':SETTINGS.skill==='normal'?'decent aim':SETTINGS.skill==='hard'?'sharp aim, longer bursts':'near-perfect aim, very fast'}`;}
  };
  draw();
}
setupMenu();

// ---------- match ----------
function seedNumber(label){
  const t=String(label).trim();
  if(/^\d+$/.test(t))return Number(t)%4294967296;
  let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h;
}
function newMatch(seed,opt){
  opt=opt||{};world.demo=!!opt.demo;world.demoT=0;world.fragLimit=world.demo?10:(SETTINGS.frags||FRAG_LIMIT);
  TUT.on=false;drones=[];
  // the seed decides the level, its decoration, furniture and starting spots; gameplay stays random
  const label=seed!==undefined&&seed!==null&&String(seed).trim()!==''?String(seed).trim():String((Math.random()*1e6)|0);
  world.seedLabel=label;
  let s=seedNumber(label);
  rnd=mulberry32(s^0x5bd1e995);
  for(let tries=0;tries<20;tries++){genLevel(s);if(levelOK())break;s=(s*1103515245+12345)>>>0;}
  nav=null;buildNav();buildLevelMesh();genDeco();buildDecoMesh();
  const cfg=getSettings();applyBotSkill(cfg.skill);
  const roster=[['VOLT','#ff3fa4'],['NYX','#ffb020'],['RAZOR','#9dff3a'],['HEX','#b06bff'],['ONYX','#ff5a3c'],['CIPHER','#ffffff'],['VEGA','#3c8cff']];
  if(world.demo){ // demo: bots only, each with its own skill; 'player' is simply whichever fighter the camera follows
    const sk=Object.keys(BOT_SKILLS);chars=[];for(let i=0;i<Math.max(2,cfg.bots);i++){const b=makeChar(roster[i][0],roster[i][1],true);b.skill=sk[i%sk.length];chars.push(b);}
  }else{
  chars=[makeChar(playerName(),SETTINGS.color,false)];
  for(let i=0;i<cfg.bots;i++){const b=makeChar(roster[i][0],roster[i][1],true);b.skill=cfg.skill;chars.push(b);}fixColorClash();}
  player=chars[0];
  props=[];bullets=[];rockets=[];parts=[];dolls=[];corpses=[];gibs=[];feed=[];
  spawnFurniture();spawnDrop('medkit');spawnDrop('medkit');for(let i=4+(rnd()<.5?1:0);i>0;i--)spawnDrop('launcher');spawnDrop('shotgun');spawnDrop('shotgun');spawnDrop('rifle');
  for(const e of chars){e.alive=false;e.respawn=0;spawn(e);}
  rnd=Math.random;spiders=[];world.spiderT=14;
  Object.assign(world,{rotCD:2,rot:null,timeScale:1,lastKicker:null,lastKickT:-99,time:0,flash:0,shake:0,turns:0,hitstop:0,pendingRot:null,medT:12,barrelQ:[],sgQ:[],arQ:[],lnQ:[],noises:[]});
  cam.yaw=player.yaw;cam.pitch=-.12;
  gameState='play';winner=null;paused=false;{const pm=document.getElementById('pause');if(pm)pm.style.display='none';}
  const so=document.getElementById('seedOut');if(so)so.value=world.seedLabel;
}

// ---------- loop ----------
let last=performance.now(),acc=0;const STEP=1/120;
function frame(now){
  let dt=Math.min(.05,(now-last)/1000);last=now;
  fpsTick(now);
  if(window.VIEWER){if(R.ok)viewerFrame(dt);requestAnimationFrame(frame);return;} // the motion viewer (viewer.html) runs its own loop
  pollPad(dt);
  if(window.__manual){requestAnimationFrame(frame);return;}
  if(gameState!=='menu'&&!paused){
    if(world.rot){world.rot.t+=dt;if(world.rot.t>=world.rot.dur)world.rot=null;}
    world.timeScale+=((world.rot?.35:1)-world.timeScale)*Math.min(1,dt*6);
    world.flash=Math.max(0,world.flash-dt*1.5);world.shake=Math.max(0,world.shake-dt*30);
    for(const f of feed)f.t-=dt;while(feed.length&&feed[feed.length-1].t<=0)feed.pop();
    const sdt=dt*world.timeScale;acc+=sdt;let first=true,n=0;
    while(acc>=STEP&&n<12){step(STEP,first);first=false;acc-=STEP;n++;for(const k in pressed)delete pressed[k];}
    if(world.hitstop<=0)for(const e of chars)updatePose(e,sdt);
  }
  if(gameState!=='menu'&&R.ok){updateCamera();render();}
  else if(R.ok){const gl=R.gl;gl.viewport(0,0,cv.width,cv.height);gl.clearColor(.05,.03,.1,1);gl.clear(gl.COLOR_BUFFER_BIT);}
  requestAnimationFrame(frame);
}
if(!initGL(cv)){document.getElementById('nogl').style.display='block';}
requestAnimationFrame(frame);
