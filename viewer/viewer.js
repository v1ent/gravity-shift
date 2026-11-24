// ================= Gravity Shift — motion & pose viewer =================
// Built into viewer.html by build.py together with the game's own code, so what you see here is exactly
// what the game draws: the same skinned character, the same clips, the same spider rig.
window.VIEWER=true;
const VW={model:'char',item:null,t:0,playing:true,speed:1,mirror:false,root:'none',
  yaw:.7,pitch:.28,dist:150,tgt:null,drag:null,e:null,spider:null,col:hexRGB('#29f0ff')};
const VQ=id=>document.getElementById(id);

// ---------- a small empty test room ----------
function viewerRoom(){
  newMatch('0001');chars=[];props=[];spiders=[];bullets=[];rockets=[];parts=[];dolls=[];corpses=[];drones=[];feed=[];
  grid=new Uint8Array(N*N*N);stairO=new Uint8Array(N*N*N);
  const c=N>>1;
  for(let x=c-9;x<=c+9;x++)for(let z=c-9;z<=c+9;z++)setT(x,0,z,(x+z)%2?1:3);       // checker floor
  for(let x=c-9;x<=c+9;x++)for(let y=1;y<=7;y++){setT(x,y,c+10,6);}                  // back wall
  for(let x=c+2;x<=c+4;x++)setT(x,1,c-3,1);                                          // a one-block cover wall
  buildLevelMesh();R.decoN=0;nav=null; // (no cranes / cables in the test room)
  world.time=0;world.rot=null;
  VW.o=V(c*T+T/2,T,c*T+T/2);VW.tgt=V(VW.o.x,VW.o.y+30,VW.o.z);
}

// ---------- what can be shown ----------
// game poses: a real fighter running the game's own update, with these controls held
const GAME_POSES={
  'Idle (stand)':{},
  'Crouch':{crouch:true},
  'Cover: squat behind a wall':{cover:true},
  'Cover: pop up and aim':{cover:true,aim:true},
  'Cover: shuffle along it':{cover:true,shuffle:true},
  'Dodge forward (live)':{dodge:'fwd'},
  'Dodge left (live)':{dodge:'left'},
  'Dodge right (live)':{dodge:'right'},
  'Aim pistol':{aim:true},
  'Aim shotgun':{aim:true,weapon:'shotgun'},
  'Aim rifle':{aim:true,weapon:'rifle'},
  'Launcher raised (slot 2)':{weapon:'rocket'},
  'Big launcher raised':{weapon:'rocket',big:true},
  'Reload pistol':{reload:true},
  'Reload shotgun':{reload:true,weapon:'shotgun'},
  'Reload rifle':{reload:true,weapon:'rifle'},
  'Reload big launcher':{reload:true,weapon:'rocket',big:true},
};
const SPIDER_MOTIONS=['Walk','Idle','Crouch before a pounce','Leap (in place)','Pounce cycle'];

function viewerList(){
  const L=VQ('vlist');L.innerHTML='';
  const head=t=>{const h=document.createElement('div');h.className='vh';h.textContent=t;L.appendChild(h);};
  const item=(label,key,sub)=>{const b=document.createElement('button');b.className='vi'+(VW.item===key?' on':'');b.innerHTML=label+(sub?`<small>${sub}</small>`:'');
    b.onclick=()=>{selectItem(key);};L.appendChild(b);};
  if(VW.model==='char'){
    if(!(SKN.ready&&SKN.clips)){head('loading the character…');return;}
    head('ANIMATION CLIPS');
    for(const name of Object.keys(SKN.clips).sort()){const c=SKN.clips[name];item(name,'clip:'+name,`${c.n} frames · ${c.dur.toFixed(2)} s${c.loop?' · loop':''}`);}
    head('GAME POSES (live)');
    for(const k of Object.keys(GAME_POSES))item(k,'pose:'+k);
  }else{
    head('SPIDER MOTIONS');
    for(const k of SPIDER_MOTIONS)item(k,'spider:'+k);
  }
}
function selectItem(key){
  VW.item=key;VW.t=0;VW.playing=true;VW.e=null;chars=[];gibs=[];parts=[];corpses=[];dolls=[]; // nothing left over from the last item (dropped magazines, shells…)
  const [kind,name]=key.split(/:(.*)/s);
  VQ('vclipopts').style.display=kind==='clip'?'':'none';
  if(kind==='pose')setupPose(GAME_POSES[name]);
  viewerList();syncControls();
}

// ---------- game poses ----------
function setupPose(cfg){
  const e=makeChar('YOU','#29f0ff',false);
  Object.assign(e,{x:VW.o.x,y:VW.o.y,z:VW.o.z,alive:true,grounded:true,invuln:0,hp:100});
  if(cfg.cover){e.x=VW.o.x+3*T-T/2+T/2;e.z=VW.o.z-3*T+T/2+BODY_W/2+2;} // tucked in behind the low wall, facing it
  const yaw=cfg.cover?Math.PI:0;e.yaw=e.bodyYaw=e.legYaw=yaw;
  if(cfg.weapon==='shotgun')e.hasShotgun=true;if(cfg.weapon==='rifle')e.hasRifle=true;
  if(cfg.big){e.bigLauncher=true;e.rockets=RMAG;}
  e.weapon=cfg.weapon||'pistol';e.ammo=magOf(e);
  chars=[e];player=e;VW.e=e;VW.cfg=cfg;VW.pf=0;
  if(cfg.cover){VW.tgt=V(e.x,e.y+24,e.z);}else VW.tgt=V(VW.o.x,VW.o.y+30,VW.o.z);
}
function stepPose(dt){
  const e=VW.e,cfg=VW.cfg,c=e.ctl;
  for(const k of Object.keys(c))if(typeof c[k]==='boolean')c[k]=false;
  c.mx=0;c.mz=0;c.aimYaw=e.yaw;c.aimPitch=0;c.select=null;c.dodge=null;
  if(cfg.crouch)c.crouch=true;
  if(cfg.cover&&!e.cover&&VW.pf>2)c.crouchPressed=true;
  if(cfg.aim)c.aim=true;
  if(cfg.shuffle&&e.cover){const s=Math.sin(VW.pf/60*2.6)>0?1:-1,d=e.cover.d,lat=[d[1],-d[0]];c.mx=lat[0]*s*.7;c.mz=lat[1]*s*.7;} // sideways along the wall and back
  if(cfg.dodge&&e.state==='normal'&&VW.pf%150===10){Object.assign(e,{x:VW.o.x-(cfg.dodge==='left'?3*T:cfg.dodge==='right'?-3*T:0),z:VW.o.z-(cfg.dodge==='fwd'?4*T:0)});startDodge(e,cfg.dodge);}
  if(cfg.reload){
    if(e.weapon==='rocket'){if(e.rreload<=0&&e.rockets>=rMag(e)){e.rockets=0;}}
    else if(e.reload<=0&&e.ammo>=magOf(e)-0){e.ammo=0;c.reload=true;}else if(e.reload<=0)c.reload=true;
  }
  VW.pf++;
  e.hp=100;world.time+=dt;
  updateChar(e,dt);updatePose(e,dt);
  updateGibs(dt);updateParts(dt); // dropped magazines, shells and sparks fall and settle as in the game
  e.x=clamp(e.x,VW.o.x-8*T,VW.o.x+8*T);e.z=clamp(e.z,VW.o.z-8*T,VW.o.z+8*T);
}

// ---------- spider ----------
function spiderPose(dt){
  if(!VW.spider){VW.spider=makeSpider(V(VW.o.x,VW.o.y+2,VW.o.z),V(0,1,0));VW.spider.dir=V(0,0,1);}
  const s=VW.spider,name=(VW.item||'').split(':')[1]||'Walk',t=VW.t;
  s.spawnT=0;s.p=V(VW.o.x,VW.o.y+2,VW.o.z);s.n=V(0,1,0);s.dir=V(0,0,1);s.look=V(0,0,1);
  s.state='crawl';s.phase=0;
  if(name==='Walk')s.phase=t*SPIDER_SPD/24;
  else if(name==='Crouch before a pounce'){s.state='windup';s.windT0=SPIDER_WINDUP;s.windT=SPIDER_WINDUP*(1-((t/SPIDER_WINDUP)%1.6>1?1:((t/SPIDER_WINDUP)%1.6)));}
  else if(name==='Leap (in place)'){s.state='leap';const u=t%1.1;s.p=V(s.p.x,s.p.y+Math.sin(Math.min(1,u/.9)*Math.PI)*34,s.p.z);}
  else if(name==='Pounce cycle'){const u=t%2.4;
    if(u<.9){s.phase=u*SPIDER_SPD/24;}
    else if(u<.9+SPIDER_WINDUP){s.state='windup';s.windT0=SPIDER_WINDUP;s.windT=SPIDER_WINDUP-(u-.9);}
    else if(u<.9+SPIDER_WINDUP+.75){s.state='leap';const k=(u-.9-SPIDER_WINDUP)/.75;s.p=V(s.p.x,s.p.y+Math.sin(k*Math.PI)*34,s.p.z+k*60-30);}
    else{s.p=V(s.p.x,s.p.y,s.p.z+30);}}
  spiders=[s];
}

// ---------- drawing hook (called inside the game's render) ----------
window.VIEWER_DRAW=function(){
  if(VW.model!=='char'||!VW.item||!VW.item.startsWith('clip:')||!(SKN.ready&&SKN.clips))return;
  const name=VW.item.slice(5),c=SKN.clips[name];if(!c)return;
  const f=Math.min(c.n-1,VW.t*FPS_C);
  const P=placeAt(clipAt(name,f,VW.mirror,VW.root),0,VW.o);
  drawPose(P,VW.col,1);
  if(VW.root==='clip'){VW.tgt=vlerp(VW.tgt,V(P.hip.x,VW.o.y+30,P.hip.z),.08);}
};

// ---------- the loop ----------
function viewerFrame(dt){
  const kind=(VW.item||'').split(':')[0];
  let dur=0;
  if(kind==='clip'&&(SKN.ready&&SKN.clips)){const c=SKN.clips[VW.item.slice(5)];dur=c?c.dur:0;}
  else if(kind==='spider')dur=VW.item.endsWith('Pounce cycle')?2.4:VW.item.endsWith('Leap (in place)')?1.1:VW.item.endsWith('Walk')?24/SPIDER_SPD:1;
  if(VW.playing){VW.t+=dt*VW.speed;if(dur>0&&VW.t>dur&&kind==='clip')VW.t=VW.t%dur;}
  if(kind==='pose'&&VW.e&&VW.playing)stepPose(dt*VW.speed);
  if(VW.model==='spider')spiderPose(dt);else spiders=[];
  if(VW.model==='char'&&kind!=='pose')chars=[];
  // orbit camera
  const cp=Math.cos(VW.pitch),fw=V(-Math.sin(VW.yaw)*cp,-Math.sin(VW.pitch),-Math.cos(VW.yaw)*cp);
  cam.pos=vsub(VW.tgt,vscale(fw,VW.dist));cam.fwd=fw;cam.zoom=1;cam.yaw=VW.yaw+Math.PI;cam.pitch=-VW.pitch;cam.back=200;
  world.xflash=null;
  render();
  // timeline
  const sl=VQ('vtime'),tl=VQ('vtl');
  if(kind==='clip'&&dur>0){sl.disabled=false;if(!VW.scrub)sl.value=Math.round(VW.t/dur*1000);const c=SKN.clips[VW.item.slice(5)];
    tl.textContent=`frame ${Math.min(c.n-1,Math.floor(VW.t*FPS_C))} / ${c.n-1}   ${VW.t.toFixed(2)} s / ${dur.toFixed(2)} s`;}
  else{sl.disabled=true;sl.value=0;tl.textContent=kind==='pose'?'live: the game\'s own update loop':kind==='spider'?`${VW.t.toFixed(2)} s`:'';}
}

// ---------- controls ----------
function syncControls(){
  VQ('vplay').textContent=VW.playing?'❚❚ PAUSE':'▶ PLAY';
  for(const b of document.querySelectorAll('#vmodel button'))b.classList.toggle('on',b.dataset.m===VW.model);
  for(const b of document.querySelectorAll('#vspeed button'))b.classList.toggle('on',+b.dataset.s===VW.speed);
  for(const b of document.querySelectorAll('#vroot button'))b.classList.toggle('on',b.dataset.r===VW.root);
  VQ('vmirror').classList.toggle('on',VW.mirror);
}
function viewerUI(){
  for(const b of document.querySelectorAll('#vstyle button'))b.onclick=()=>{SETTINGS.charStyle=b.dataset.st;saveSettings();for(const x of document.querySelectorAll('#vstyle button'))x.classList.toggle('on',x===b);};
  for(const x of document.querySelectorAll('#vstyle button'))x.classList.toggle('on',x.dataset.st===SETTINGS.charStyle);
  for(const b of document.querySelectorAll('#vmodel button'))b.onclick=()=>{VW.model=b.dataset.m;VW.item=null;VW.e=null;chars=[];
    VW.tgt=V(VW.o.x,VW.o.y+(VW.model==='char'?30:8),VW.o.z);VW.dist=VW.model==='char'?150:90;gibs=[];parts=[];
    selectItem(VW.model==='char'?((SKN.ready&&SKN.clips)?'clip:'+Object.keys(SKN.clips).sort()[0]:null):'spider:Walk');};
  for(const b of document.querySelectorAll('#vspeed button'))b.onclick=()=>{VW.speed=+b.dataset.s;syncControls();};
  for(const b of document.querySelectorAll('#vroot button'))b.onclick=()=>{VW.root=b.dataset.r;VW.tgt=V(VW.o.x,VW.o.y+30,VW.o.z);syncControls();};
  VQ('vmirror').onclick=()=>{VW.mirror=!VW.mirror;syncControls();};
  VQ('vplay').onclick=()=>{VW.playing=!VW.playing;syncControls();};
  const step=d=>{VW.playing=false;VW.t=Math.max(0,VW.t+d/FPS_C);syncControls();};
  VQ('vprev').onclick=()=>step(-1);VQ('vnext').onclick=()=>step(1);
  const sl=VQ('vtime');
  sl.oninput=()=>{const kind=(VW.item||'').split(':')[0];if(kind!=='clip')return;const c=SKN.clips[VW.item.slice(5)];VW.scrub=true;VW.playing=false;VW.t=sl.value/1000*c.dur;syncControls();};
  sl.onchange=()=>{VW.scrub=false;};
  VQ('vreset').onclick=()=>{VW.yaw=.7;VW.pitch=.28;VW.dist=VW.model==='char'?150:90;VW.tgt=V(VW.o.x,VW.o.y+(VW.model==='char'?30:8),VW.o.z);};
  // orbit: left-drag rotates, right-drag (or shift-drag) pans, wheel zooms
  const cvs=cv;
  cvs.addEventListener('contextmenu',e=>e.preventDefault());
  cvs.addEventListener('mousedown',e=>{VW.drag={x:e.clientX,y:e.clientY,pan:e.button===2||e.button===1||e.shiftKey};});
  addEventListener('mouseup',()=>VW.drag=null);
  addEventListener('mousemove',e=>{const d=VW.drag;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;
    if(d.pan){const rt=V(Math.cos(VW.yaw),0,-Math.sin(VW.yaw)),k=VW.dist/600;VW.tgt=vadd(VW.tgt,vadd(vscale(rt,-dx*k),V(0,dy*k,0)));}
    else{VW.yaw-=dx*.008;VW.pitch=clamp(VW.pitch+dy*.006,-1.2,1.45);}});
  cvs.addEventListener('wheel',e=>{e.preventDefault();VW.dist=clamp(VW.dist*Math.pow(1.0015,e.deltaY),30,900);},{passive:false});
  addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;
    if(e.key===' '){e.preventDefault();VW.playing=!VW.playing;syncControls();}
    if(e.key===','||e.key==='ArrowLeft')step(-1);if(e.key==='.'||e.key==='ArrowRight')step(1);});
}
function viewerBoot(){
  viewerRoom();viewerUI();syncControls();
  const wait=()=>{if((SKN.ready&&SKN.clips)){if(!VW.item&&VW.model==='char')selectItem('clip:'+Object.keys(SKN.clips).sort()[0]);else viewerList();}else{viewerList();setTimeout(wait,200);}};
  wait();
}
viewerBoot();
