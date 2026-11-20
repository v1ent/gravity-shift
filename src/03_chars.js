// =====================================================================
//  CHARACTERS — movement, parkour, stealth, knockdowns, procedural pose
//  units: px (1 block = 32px ≈ 1 m, a fighter is 56px tall)
// =====================================================================
const G=1500,WALK=95,RUN=215,JUMPV=410,RUNJUMPV=470,MAXFALL=950; // standing jump ~1.7 blocks, running ~2.3: higher walls need a ledge grab
const STAND_H=62,BODY_W=23,CHAR_SCALE=64/56; // fighters are ~2 m: 62 px hitbox, model drawn 64 px tall
const CROUCH_SPD=48,CROUCH_H=41,SLIDE_H=30,SLIDE_DUR=.7,SLIDE_FRIC=280,STAM_DRAIN=1/7.2,STAM_REGEN=1/3.5,STEALTH_T=1.6;
const STEALTH_ON=false; // cloaking is switched off for now (players and bots)
const HARD_FALL=10*T,GETUP_DUR=.8,KICK_DUR=.6,KICK_HIT=.42,KICK_DMG=15,KICK_PUSH=560;
const MAG=10,RELOAD=2,FIRE_CD=.42,BULLET_SPEED=1300,PISTOL_SPEED=3900,DMG=25,HEAD_DMG=45;
const RMAG=3,RRELOAD=3.2,RFIRE_CD=.8;
// everyone starts with a one-shot wrist launcher that recharges on its own; the big one (3 rockets) is found on the level
const RMAG_S=1,RRELOAD_S=6;
const rMag=e=>e.bigLauncher?RMAG:RMAG_S;
const THIGH=14,SHIN=14,TORSO=17,UPPER=11,FORE=11;
let chars=[],player=null;

// dodges: which clip, which frames, how fast; 'fb' is the travel used when the clips aren't loaded (headless)
const DODGE_STAM=.3;
const DODGES={
  back:{clip:'dodging_back',f0:8,f1:60,rate:1.45,mirror:false,fb:V(0,0,-80)},
  right:{clip:'dodge_right',f0:14,f1:100,rate:2,mirror:false,scale:2.6,fb:V(-83,0,-39),fix:93*Math.PI/180,fix0:56,fix1:96},
  left:{clip:'dodge_right',f0:14,f1:100,rate:2,mirror:true,scale:2.6,fb:V(83,0,-39),fix:-93*Math.PI/180,fix0:56,fix1:96},
};
for(const k in DODGES){const D=DODGES[k];D.dur=(D.f1-D.f0)/30/D.rate;}
// travel so far (character space: +z forward, -x right)
function dodgeDisp(D,t){
  const u=clamp(t/D.dur,0,1);
  if(typeof SKN!=='undefined'&&SKN.clips&&SKN.clips[D.clip]){
    const h=f=>sampleClip(D.clip,f/30,D.mirror).hip,a=h(D.f0),b=h(D.f0+u*(D.f1-D.f0)),k=D.scale||1;return V((b.x-a.x)*k,0,(b.z-a.z)*k);}
  return vscale(D.fb,smooth(u)*(D.scale||1));
}
function startDodge(e,kind){
  const D=DODGES[kind];e.state='dodge';e.st={kind,t:0,yaw:e.bodyYaw,prev:V(0,0,0)};
  e.stam=Math.max(0,e.stam-DODGE_STAM);e.stamDelay=1;e.crouch=false;e.h=STAND_H;e.sprinting=false;e.poseBlend=.4;reveal(e);sfx('whoosh',e);
}
function makeChar(name,color,isBot){
  return {name,color,col:hexRGB(color),isBot,x:0,y:0,z:0,w:BODY_W,h:STAND_H,vx:0,vy:0,vz:0,hp:100,alive:false,respawn:.5,
    grounded:false,coyote:0,jumpBuf:0,cut:false,yaw:0,pitch:0,bodyYaw:0,legYaw:0,state:'normal',st:{},grabCD:0,
    weapon:'pistol',hasShotgun:false,hasRifle:false,stash:{pistol:MAG,shotgun:0,rifle:0},fireCD:0,ammo:MAG,reload:0,rockets:RMAG_S,bigLauncher:false,rreload:0,rfireCD:0,stam:1,stamDelay:0,sprinting:false,crouch:false,crouchT:0,hidden:false,vis:1,runJump:false,
    kickCD:0,stun:0,knocked:false,recoil:0,flinch:0,land:0,takeoff:0,phase:0,ba:0,bav:0,baAxis:0,tumbleHold:0,runW:0,accS:0,prevFwd:0,
    kills:0,deaths:0,invuln:0,lastHit:null,lastHitT:-99,poseBlend:1,pose:null,kickPrompt:false,rocketJump:false,airT:0,
    ctl:{mx:0,mz:0,jump:false,jumpHeld:false,sprint:false,crouch:false,crouchPressed:false,fire:false,alt:false,kick:false,reload:false,grab:false,aimYaw:0,aimPitch:0},ai:null};
}
const headPos=e=>V(e.x,e.y+e.h-3.5,e.z);
const chestPos=e=>V(e.x,e.y+e.h*.62,e.z);

function spawn(e){
  const pts=TUT.on&&TUT.cp&&!e.isBot?[TUT.cp]:spawnPoints();
  let best=null,bs=-1;
  for(let k=0;k<40;k++){
    const p=pts[rnd()*pts.length|0];if(!p)continue;
    if(overlapSolid(p.x,p.y,p.z,BODY_W,STAND_H))continue;
    let md=1e9;for(const o of chars)if(o!==e&&o.alive)md=Math.min(md,Math.hypot(o.x-p.x,o.y-p.y,o.z-p.z));
    for(const b of props)if(Math.abs(b.x-p.x)<30&&Math.abs(b.z-p.z)<30&&Math.abs(b.y-p.y)<50)md=0;
    if(md>bs){bs=md;best=p;}
  }
  if(!best)best={x:L/2,y:T,z:L/2};
  Object.assign(e,{x:best.x,y:best.y,z:best.z,h:STAND_H,vx:0,vy:0,vz:0,hp:100,alive:true,state:'normal',stun:0,knocked:false,kickCD:0,weapon:'pistol',hasShotgun:false,hasRifle:false,stash:{pistol:MAG,shotgun:0,rifle:0},ammo:MAG,reload:0,rockets:RMAG_S,bigLauncher:false,rreload:0,
    stam:1,sprinting:false,crouch:false,crouchT:0,hidden:false,vis:1,runJump:false,ba:0,bav:0,tumbleHold:0,invuln:1.2,poseBlend:1,land:.6,lastHit:null,rocketJump:false});
  // face the middle of the arena
  e.yaw=e.bodyYaw=e.legYaw=yawOf(L/2-e.x,L/2-e.z);e.pitch=0;e.ctl.aimYaw=e.yaw;e.ctl.aimPitch=0;
  e.pose=null;
  for(let i=0;i<14;i++)addPart(e.x+(rnd()-.5)*20,e.y+rnd()*56,e.z+(rnd()-.5)*20,(rnd()-.5)*60,rnd()*120,(rnd()-.5)*60,.6,e.col,3,'spark');
}

// ---------- parkour helpers ----------
const CARDS=[[1,0],[-1,0],[0,1],[0,-1]];
function cardOf(dx,dz){return Math.abs(dx)>=Math.abs(dz)?[Math.sign(dx)||1,0]:[0,Math.sign(dz)||1];}
// column of blocks right in front of the body in cardinal direction d
function frontCell(e,d,extra){
  const x=e.x+d[0]*(e.w/2+(extra||3)),z=e.z+d[1]*(e.w/2+(extra||3));
  return [Math.floor(x/T),Math.floor(z/T)];
}
function standSpotOn(e,d,ci,ck,ly){
  // a spot just inside the ledge top along d, same lateral position
  let x=e.x,z=e.z;
  if(d[0]>0)x=ci*T+e.w/2+2;else if(d[0]<0)x=(ci+1)*T-e.w/2-2;
  if(d[1]>0)z=ck*T+e.w/2+2;else if(d[1]<0)z=(ck+1)*T-e.w/2-2;
  return V(x,ly,z);
}
// ledge in front (cardinal d) near head height; validated so you can never pass through solid blocks
function findLedge(e,d,reach){
  reach=reach||14;
  for(const extra of [3,16]){
    const [ci,ck]=frontCell(e,d,extra);
    if(ci===Math.floor(e.x/T)&&ck===Math.floor(e.z/T))continue;
    const top=e.y+e.h;
    for(let r=Math.floor((top-22)/T)-1;r<=Math.floor((top+reach)/T);r++){
      const ly=(r+1)*T;
      if(ly<top-22||ly>top+reach)continue;
      if(!(solid(tile(ci,r,ck))&&!solid(tile(ci,r+1,ck))&&!solid(tile(ci,r+2,ck))))continue;
      const sp=standSpotOn(e,d,ci,ck,ly);
      if(overlapSolid(sp.x,sp.y,sp.z,e.w,e.h))continue;
      if(ly<=top-6){ // low ledge: vault — rise straight up beside it
        if(overlapSolid(e.x,ly,e.z,e.w,e.h))continue;
        return {ci,ck,r,ly,low:true,stand:sp};
      }
      // hang spot against the face
      let hx=e.x,hz=e.z;
      if(d[0]>0)hx=ci*T-e.w/2-.5;else if(d[0]<0)hx=(ci+1)*T+e.w/2+.5;
      if(d[1]>0)hz=ck*T-e.w/2-.5;else if(d[1]<0)hz=(ck+1)*T+e.w/2+.5;
      const hy=ly-4-e.h;
      if(overlapSolid(hx,hy,hz,e.w,e.h))continue;
      const dist=Math.hypot(hx-e.x,hz-e.z);
      if(dist>e.w)continue;
      if(dist>12){let bl=false;for(let s=1;s<=4;s++){const t=s/4;if(overlapSolid(lerp(e.x,hx,t),hy,lerp(e.z,hz,t),e.w,e.h)){bl=true;break;}}if(bl)continue;}
      if(overlapSolid(hx,ly,hz,e.w,e.h))continue;
      return {ci,ck,r,ly,low:false,stand:sp,hang:V(hx,hy,hz)};
    }
  }
  return null;
}
// 1- or 2-block obstacle right in front with room to get over it
function lowObstacle(e,d,over){
  const [ci,ck]=frontCell(e,d,3);
  if(ci===Math.floor(e.x/T)&&ck===Math.floor(e.z/T))return null;
  const r0=Math.floor((e.y+1)/T);
  if(tile(ci,r0,ck)===STAIR||tile(ci,r0+1,ck)===STAIR||tile(Math.floor(e.x/T),Math.floor((e.y-1)/T),Math.floor(e.z/T))===STAIR)return null; // stairs are walked, not vaulted
  let h=0;while(h<3&&solid(tile(ci,r0+h,ck)))h++;
  if(h<1||h>2)return null;
  const ly=(r0+h)*T;
  if(overlapSolid(e.x,ly,e.z,e.w,e.h))return null;
  // land beyond if the obstacle is thin, otherwise on top
  const bi=ci+d[0],bk=ck+d[1];
  let sp;
  let beyond=false;
  if((h===2||over)&&!solid(tile(bi,r0+h,bk))&&!solid(tile(bi,r0+h+1,bk))&&!solid(tile(bi,r0+h-1,bk))){
    // thin obstacle: go over it. Land on the floor beyond if there is one, else at the top height and drop
    const floorBeyond=solid(tile(bi,r0-1,bk))&&!solid(tile(bi,r0,bk))&&!solid(tile(bi,r0+1,bk));
    sp=V(bi*T+T/2-d[0]*4,floorBeyond?r0*T:ly,bk*T+T/2-d[1]*4);beyond=true;
  }
  else sp=standSpotOn(e,d,ci,ck,ly);
  if(d[0]===0)sp.x=e.x;if(d[1]===0)sp.z=e.z;
  if(overlapSolid(sp.x,sp.y,sp.z,e.w,e.h))return null;
  return {h,ly,stand:sp,over:beyond,face:d[0]>0?ci*T:d[0]<0?(ci+1)*T:d[1]>0?ck*T:(ck+1)*T};
}
// a resting box right in front (along cardinal d), low enough to get over: vault across it if it's thin
// and there's floor beyond, otherwise climb on top of it
function propObstacle(e,d,maxGap){
  let best=null;
  for(const b of props){
    if(b.dead||!b.grounded||PICKUP_GLOW[b.kind]||b.kind==='medkit'||b.fuse!==undefined&&b.fuse<1)continue;
    const top=b.y+b.h-e.y;if(top<20||top>54||b.y>e.y+8||b.y+b.h<e.y+8)continue;
    const half=d[0]?b.w/2:b.d/2,latHalf=d[0]?b.d/2:b.w/2;
    const along=d[0]?(b.x-e.x)*d[0]:(b.z-e.z)*d[1],lat=d[0]?Math.abs(b.z-e.z):Math.abs(b.x-e.x);
    const gap=along-half-e.w/2;if(gap<-6||gap>(maxGap||8)||lat>latHalf+e.w/2-6)continue;
    if(!best||gap<best.gap)best={b,gap,along,half,top};
  }
  if(!best)return null;
  const b=best.b,ly=b.y+b.h;
  if(overlapSolid(e.x,ly,e.z,e.w,e.h))return null; // no room above it
  const clear=(x,y,z)=>!overlapSolid(x,y,z,e.w,e.h)&&!props.some(o=>o!==b&&!o.dead&&Math.abs(o.x-x)<(o.w+e.w)/2&&Math.abs(o.z-z)<(o.d+e.w)/2&&o.y<y+e.h&&o.y+o.h>y);
  const face=d[0]>0?b.x-b.w/2:d[0]<0?b.x+b.w/2:d[1]>0?b.z-b.d/2:b.z+b.d/2;
  // over: thin box, floor and room on the far side
  if(best.half*2<=50){const far=best.along+best.half+e.w/2+5,x=e.x+d[0]*far,z=e.z+d[1]*far;
    if(clear(x,e.y,z)&&solid(tileAt(x,e.y-4,z)))return {h:2,ly,stand:V(x,e.y,z),over:true,face,prop:b};}
  // on top
  const into=Math.min(best.along,best.along-best.half+e.w/2+3),x=e.x+d[0]*into,z=e.z+d[1]*into;
  if(clear(x,ly+1,z))return {h:2,ly,stand:V(x,ly,z),over:false,face,prop:b};
  return null;
}
// low cover along cardinal d within maxGap of the body: a one-block wall, or a box 24-54 px tall
// (hides you crouched, lets you shoot over it standing)
function coverIn(e,d,maxGap){
  const r0=Math.floor((e.y+1)/T),own=[Math.floor(e.x/T),Math.floor(e.z/T)];
  const lat=[-d[1],d[0]];
  for(const o of [0,-e.w/2+3,e.w/2-3]){
    const x=e.x+d[0]*(e.w/2+maxGap)+lat[0]*o,z=e.z+d[1]*(e.w/2+maxGap)+lat[1]*o,ci=Math.floor(x/T),ck=Math.floor(z/T);
    if(ci===own[0]&&ck===own[1])continue;
    if(solid(tile(ci,r0,ck))&&!solid(tile(ci,r0+1,ck))&&!solid(tile(ci,r0+2,ck)))return {d,kind:'wall'};
  }
  for(const b of props){
    if(b.dead||PICKUP_GLOW[b.kind]||b.kind==='medkit')continue;
    const top=b.y+b.h-e.y;if(top<24||top>54||b.y>e.y+8)continue;
    const half=d[0]?b.w/2:b.d/2,latHalf=d[0]?b.d/2:b.w/2;
    const along=d[0]?(b.x-e.x)*d[0]:(b.z-e.z)*d[1],lt=d[0]?Math.abs(b.z-e.z):Math.abs(b.x-e.x);
    const gap=along-half-e.w/2;if(gap<-8||gap>maxGap||lt>latHalf+e.w/2-4)continue;
    return {d,kind:'box',b};
  }
  return null;
}
// a live gravity panel within kicking reach in cardinal direction d (also through furniture)
function kickableSide(e,d){
  const axis=d[0]?'x':'z',s=d[0]||d[1];
  const edge=(axis==='x'?e.x:e.z)+s*e.w/2;
  const lat=axis==='x'?e.z:e.x;
  for(let dist=1;dist<=96;dist+=3){
    const p=edge+s*dist,c=Math.floor(p/T),l=Math.floor(lat/T);
    if(c===Math.floor((axis==='x'?e.x:e.z)/T))continue;
    let hit=false,live=false;
    for(const yy of [e.y+8,e.y+30,e.y+50]){
      const r=Math.floor(yy/T),i=axis==='x'?c:l,k=axis==='x'?l:c;
      if(solid(tile(i,r,k))){hit=true;if(isLiveK(i,r,k))live=true;}
    }
    if(!hit)continue;
    if(!live)return null;
    const face=s>0?c*T:(c+1)*T,gap=(face-edge)*s;
    if(gap<=14)return {stop:face};
    // furniture wedged in between transmits the kick
    const iv=[];
    for(const b of props){if(b.dead||PICKUP_GLOW[b.kind]||b.y>e.y+52||b.y+b.h<e.y+6)continue;
      const bl=axis==='x'?b.z:b.x;if(Math.abs(bl-lat)>b.w/2+e.w/2)continue;
      const bc=axis==='x'?b.x:b.z;const n=(bc-b.w/2-edge)*s,f=(bc+b.w/2-edge)*s;iv.push(s>0?[n,f]:[(bc+b.w/2-edge)*s,(bc-b.w/2-edge)*s]);}
    let cur=0,tol=14,first=null;
    for(let k=0;k<5;k++){
      let bf=-1,bn=null;for(const [n,f] of iv)if(n>=cur-8&&n<=cur+tol&&f>cur&&f>bf){bf=f;bn=n;}
      if(bf<0)break;if(first===null)first=bn;cur=bf;tol=8;
      if(gap-cur<=8)return {stop:edge+s*first};
    }
    return null;
  }
  return null;
}

// ---------- update ----------
function updateChar(e,dt){
  const c=e.ctl;
  if(!e.alive){if(gameState==='play'){e.respawn-=dt;if(e.respawn<=0)spawn(e);}return;}
  e.wasBox=e.boxSupport;e.boxSupport=false;
  e.invuln=Math.max(0,e.invuln-dt);e.fireCD-=dt;e.bloom=Math.max(0,(e.bloom||0)-dt*.06);e.clickBuf=Math.max(0,(e.clickBuf||0)-dt);e.rfireCD-=dt;e.grabCD-=dt;e.kickCD-=dt;e.stun-=dt;
  e.recoil=Math.max(0,e.recoil-dt*5);e.flinch=Math.max(0,e.flinch-dt*5);e.hitMarker=Math.max(0,(e.hitMarker||0)-dt);
  const ctrl=e.stun<=0&&e.state!=='down'&&e.state!=='getup';
  updateEmote(e,c,ctrl,dt);
  // right mouse: aim — the gun comes up (or the launcher arm), tighter shots, walk only
  e.aiming=ctrl&&!!c.aim&&(e.state==='normal'||e.state==='slide'||e.state==='kick')&&!e.runJump&&!e.emote;
  if(e.aiming){e.aimT=Math.max(e.aimT||0,.35);if(e.weapon==='rocket')e.rArm=Math.max(e.rArm||0,.3);}
  let mx=ctrl?c.mx:0,mz=ctrl?c.mz:0;const mag=Math.hypot(mx,mz);if(mag>1){mx/=mag;mz/=mag;}
  if(ctrl&&c.jump)e.jumpBuf=.13;else e.jumpBuf-=dt;
  e.yaw=c.aimYaw;e.pitch=clamp(c.aimPitch,-1.35,1.35);
  // weapon switch (mouse wheel / Q / 1 / 2) once you own a shotgun
  const own=ownedWeapons(e);
  if(ctrl&&own.length>1&&(c.swap||(c.select&&c.select!==e.weapon&&own.includes(c.select)))){
    const to=c.select&&c.select!==e.weapon&&own.includes(c.select)?c.select:own[(own.indexOf(e.weapon)+1)%own.length];
    if(e.weapon!=='rocket')e.stash[e.weapon]=e.ammo;e.weapon=to;e.ammo=to==='rocket'?0:e.stash[to];e.reload=0;e.fireCD=Math.max(e.fireCD,.35);e.rfireCD=Math.max(e.rfireCD,.3);e.recoil=.6;sfx('swap',e);
    if(to!=='rocket'&&e.ammo<=0)e.reload=reloadOf(e);
  }
  // reloads
  if(e.reload>0){
    if(!e.rl||e.rl.w!==e.weapon)e.rl={w:e.weapon,a0:e.ammo,n:Math.max(1,magOf(e)-e.ammo),dur:e.reload};
    e.reload-=dt;
    // shells go in one at a time
    if(e.weapon==='shotgun'){const p=clamp((1-e.reload/e.rl.dur-.12)/.8,0,1),k=Math.floor(p*e.rl.n+.12);const a=Math.min(magOf(e),e.rl.a0+k);if(a>e.ammo){e.ammo=a;sfx('reload',e);}}
    if(e.reload<=0){e.reload=0;e.ammo=magOf(e);sfx('reload',e);e.rl=null;}}
  else if(c.reload&&e.weapon!=='rocket'&&e.ammo<magOf(e))e.reload=reloadOf(e);
  if(c.reload&&e.weapon==='rocket'&&e.bigLauncher&&e.rockets<RMAG&&e.rreload<=0)e.rreload=RRELOAD;
  if(e.reload<=0)e.rl=null;
  if(e.rreload>0){
    // the big launcher is loaded by hand, one rocket at a time; the small one just recharges
    if(e.bigLauncher){
      if(!e.rrl)e.rrl={a0:e.rockets,n:Math.max(1,RMAG-e.rockets),dur:e.rreload};
      const p=clamp((1-e.rreload/e.rrl.dur-.1)/.8,0,1),k=Math.floor(p*e.rrl.n+.12);const a=Math.min(RMAG,e.rrl.a0+k);if(a>e.rockets){e.rockets=a;sfx('reload',e);}}
    e.rreload-=dt;
    if(e.rreload<=0){e.rreload=0;e.rockets=rMag(e);e.rrl=null;if(!e.bigLauncher)sfx('reload',e);}}
  else{e.rrl=null;if(e.rockets<=0)e.rreload=e.bigLauncher?RRELOAD:RRELOAD_S;}
  // tumble spring
  if(e.tumbleHold>0)e.tumbleHold-=dt;
  else{const k=e.stun>0?18:55,d=e.stun>0?3:9;e.bav+=(-k*e.ba-d*e.bav)*dt;e.ba+=e.bav*dt;if(Math.abs(e.ba)<.002&&Math.abs(e.bav)<.01){e.ba=0;e.bav=0;}}
  const prevState=e.state,prevVy=e.vy,wasGround=e.grounded;
  e.kickPrompt=false;
  const moving=Math.hypot(mx,mz)>.15;
  // stamina
  const sprintOK=ctrl&&c.sprint&&moving&&!e.crouch&&e.stam>.02&&e.state==='normal';
  if(e.grounded)e.sprinting=sprintOK&&!e.aiming;else if(!sprintOK&&!e.runJump)e.sprinting=false;
  if(e.aiming&&e.sprinting&&!e.runJump)e.sprinting=false; // aiming: walk only
  if(e.sprinting&&e.grounded){e.stam=Math.max(0,e.stam-dt*STAM_DRAIN);e.stamDelay=.8;}
  else{e.stamDelay-=dt;if(e.stamDelay<=0)e.stam=Math.min(1,e.stam+dt*STAM_REGEN);}
  const hsp=Math.hypot(e.vx,e.vz);

  // cover (players): crouch facing low cover and you stay down until you press crouch again or leave it;
  // aiming rises over the cover, letting go of aim ducks back
  if(e.cover&&(e.state!=='normal'||!e.alive||!ctrl))e.cover=null;
  if(e.state==='normal'&&ctrl&&!e.isBot){
    if(e.cover){
      const ok=e.grounded&&!e.sprinting&&coverIn(e,e.cover.d,18);
      e.cover.lost=ok?0:e.cover.lost+dt;
      if(c.crouchPressed||c.jump||e.cover.lost>.25)e.cover=null;
    }else if(c.crouchPressed&&e.grounded&&!e.sprinting){
      const cv=coverIn(e,cardOf(Math.sin(e.yaw),Math.cos(e.yaw)),14);
      if(cv)e.cover={d:cv.d,lost:0,t:world.time};
    }
  }
  const wantCrouch=e.cover?!c.aim:c.crouch;
  if(e.state==='normal'){
    if(ctrl&&e.grounded&&wantCrouch&&!e.sprinting){if(!e.crouch){e.crouch=true;e.h=CROUCH_H;}}
    else if(e.crouch&&(!wantCrouch||!e.grounded||!ctrl)){if(!overlapSolid(e.x,e.y,e.z,e.w,STAND_H)){e.crouch=false;e.h=STAND_H;}}
    // body faces aim, except sprinting/diving where it faces travel
    // sprinting away from the aim is a backwards run: keep facing the aim instead of turning round to face the camera
    const backIn=moving&&Math.abs(angDiff(yawOf(mx,mz),e.yaw))>1.95;
    if(((e.sprinting&&e.grounded)||e.runJump)&&!(e.aimT>0&&!e.runJump)&&!(backIn&&!e.runJump)){if(hsp>20)e.bodyYaw=yawOf(e.vx,e.vz);}
    else e.bodyYaw=e.yaw;
    // legs follow travel; walking backwards keeps the legs facing the aim (backpedal)
    let back=false;
    if(hsp>15){const my=yawOf(e.vx,e.vz),d=angDiff(my,e.bodyYaw);
      if(Math.abs(d)>1.9){back=true;e.legYaw=e.legYaw+angDiff(my+Math.PI,e.legYaw)*Math.min(1,dt*10);}
      else e.legYaw=e.legYaw+angDiff(my,e.legYaw)*Math.min(1,dt*10);}
    else e.legYaw=e.legYaw+angDiff(e.bodyYaw,e.legYaw)*Math.min(1,dt*6);
    let spd=e.crouch?CROUCH_SPD:e.sprinting?(backIn?RUN*.6:RUN):WALK*(back?.85:1);
    if(!e.grounded)spd=e.runJump?RUN:Math.max(WALK,Math.min(RUN,hsp));
    const acc=e.grounded?(moving?(e.sprinting?900:1100):1600):(e.stun>0?120:500);
    const tx=mx*spd,tz=mz*spd,dvx=tx-e.vx,dvz=tz-e.vz,dl=Math.hypot(dvx,dvz),st=Math.min(dl,acc*dt);
    if(dl>0){e.vx+=dvx/dl*st;e.vz+=dvz/dl*st;}
    if(ctrl&&c.crouchPressed&&e.grounded&&e.sprinting&&hsp>140)startSlide(e);
  }
  if(e.state==='normal'){
    if(e.jumpBuf>0&&e.coyote>0){
      if(e.crouch){if(!overlapSolid(e.x,e.y,e.z,e.w,STAND_H)){e.crouch=false;e.h=STAND_H;}else e.jumpBuf=0;}
      if(e.jumpBuf>0){
        const run=e.sprinting&&Math.hypot(e.vx,e.vz)>140;
        e.jumpAt=world.time;
        if(run){e.runJump=true;e.vy=RUNJUMPV;const s=RUN*1.08/Math.max(1,Math.hypot(e.vx,e.vz));e.vx*=s;e.vz*=s;e.cut=false;}
        else{e.vy=JUMPV;e.cut=true;}
        e.grounded=false;e.coyote=0;e.jumpBuf=0;e.takeoff=1;
      }
    }
    if(!c.jumpHeld&&e.cut&&e.vy>180){e.vy*=.5;e.cut=false;}
    if(e.vy<=0)e.cut=false;
    // the calm at the top of a rocket jump: near the apex gravity almost lets go for a moment
    let gm=1;if(e.rocketJump&&e.rjFloat>0&&Math.abs(e.vy)<150){gm=.22;e.rjFloat-=dt;const dmp=1-dt*1.1;e.vx*=dmp;e.vz*=dmp;}
    e.vy-=G*gm*dt;e.vy=Math.max(e.vy,-MAXFALL);
    if(!e.grounded&&(e.fallStart===undefined||e.vy>=0))e.fallStart=e.y;
    e.canStep=e.grounded&&e.vy<=0&&!e.knocked&&!e.runJump;
    const landed=moveBody(e,dt);e.canStep=false;
    // steps up/down: the camera eases over them instead of jumping 8px each step
    if(e.stepped){e.stepOff=clamp((e.stepOff||0)-e.stepped,-40,40);e.stepped=0;}
    if(e.stepOff)e.stepOff*=Math.exp(-dt*9);
    e.grounded=landed||(e.vy<=0&&groundProbe(e));
    if(e.grounded)e.coyote=.1;else e.coyote-=dt;
    if(e.grounded&&!wasGround){
      e.runJump=false;
      const imp=-prevVy;
      e.land=clamp(imp/900,.15,1);e.poseBlend=Math.max(e.poseBlend,.4);
      if(imp>300){sfx('land',e);for(let i=0;i<8;i++)addPart(e.x+(rnd()-.5)*20,e.y+2,e.z+(rnd()-.5)*20,(rnd()-.5)*200,rnd()*60,(rnd()-.5)*200,.4,[.48,.52,.63],5,'dust');}
      const fell=e.fallStart!==undefined?e.fallStart-e.y:0;
      if(imp>=MAXFALL-5&&fell>(e.rocketJump?16:11)*T){const kk=world.time-world.lastKickT<5?world.lastKicker:null;damage(e,Math.min(50,(fell-11*T)/T*5+15),kk,V(0,-1,0));}
      const limit=e.rocketJump?HARD_FALL*1.6:HARD_FALL;
      // after an arena turn: land crouched, hands to the floor, still facing the same way (not on your back looking at the camera)
      if(e.alive&&e.turnFall&&imp>120){e.state='land';e.st={t:0,dur:clamp(.55+fell/T*.06,.7,1.3),sev:1};e.vx*=.3;e.vz*=.3;e.poseBlend=0;e.ba=0;e.bav=0;
        if(fell>7*T)world.shake=Math.max(world.shake,e===player?5:0);}
      else if(e.alive&&e.knocked&&imp>120)enterDown(e,clamp((fell-limit)/(8*T)+.25,0,1));
      else if(e.alive&&fell>3.5*T&&imp>460){ // crouch into the landing, hands to the ground; longer for bigger drops
        e.state='land';e.st={t:0,dur:clamp(.2+fell/T*.075,.32,1.15),sev:clamp(fell/(10*T),.35,1)};e.vx*=.35;e.vz*=.35;e.poseBlend=0;
        if(fell>7*T)world.shake=Math.max(world.shake,e===player?5:0);
      }
      e.fallStart=e.y;e.knocked=false;e.rocketJump=false;e.turnFall=false;
    }
    // step up single blocks while walking; vault 2-block obstacles while sprinting
    if(e.state==='normal'&&e.grounded&&moving&&(e.hitX||e.hitZ||Math.hypot(e.vx,e.vz)<30)){
      const d=cardOf(mx,mz);let ob=ctrl&&c.noVault?null:lowObstacle(e,d,e.sprinting);
      if(ob&&(ob.h===1||e.sprinting)){
        const speed=ob.h===2||ob.over;
        e.state='climbup';e.st={t:0,s0:V(e.x,e.y,e.z),s1:ob.stand,ly:ob.ly,d,vault:true,speed:true,over:ob.over,face:ob.face,dur:ob.over?(typeof SKN!=='undefined'&&SKN.clips&&SKN.clips.vault?.66:.44):ob.h===1?.22:.34,exitV:e.sprinting?RUN:WALK};
        e.vx=e.vy=e.vz=0;e.poseBlend=.5;if(speed)sfx('whoosh',e);
      }
    }
    // sprinting into a box low enough to get over: vault it (thin) or climb onto it
    if(e.state==='normal'&&e.grounded&&moving&&e.sprinting&&!e.isBot&&!(ctrl&&c.noVault)){ // (bots path round boxes)
      const d=cardOf(mx,mz),ob=propObstacle(e,d);
      if(ob&&(mx*d[0]+mz*d[1])>.7*Math.hypot(mx,mz)){
        e.state='climbup';e.st={t:0,s0:V(e.x,e.y,e.z),s1:ob.stand,ly:ob.ly,d,vault:true,speed:true,over:ob.over,face:ob.face,
          dur:ob.over?(typeof SKN!=='undefined'&&SKN.clips&&SKN.clips.vault?.66:.44):.34,exitV:RUN,prop:ob.prop.kind};
        e.vx=e.vy=e.vz=0;e.poseBlend=.5;sfx('whoosh',e);
      }
    }
    // ledge grab: diving hands-first grabs automatically; moving toward a ledge or holding SPACE reaches for it
    if(e.state==='normal'&&!e.grounded&&e.grabCD<=0&&ctrl&&!c.noGrab){
      const dirs=[];
      if(e.runJump)dirs.push(cardOf(e.vx,e.vz));
      if(moving)dirs.push(cardOf(mx,mz));
      if(c.grab)dirs.push(cardOf(Math.sin(e.yaw),Math.cos(e.yaw)));
      const reach=c.grab?32:e.runJump?22:14;
      const tried={};
      for(const d of dirs){
        const key=d.join(',');if(tried[key])continue;tried[key]=1;
        const lg=findLedge(e,d,reach);if(!lg)continue;
        if(lg.low&&e.vy<420){
          e.jumpBuf=0;e.runJump=false;e.state='climbup';e.st={t:0,s0:V(e.x,e.y,e.z),s1:lg.stand,ly:lg.ly,d,vault:true,dur:.3};e.vx=e.vy=e.vz=0;e.poseBlend=.6;e.bodyYaw=e.legYaw=yawOf(d[0],d[1]);break;
        }else if(!lg.low&&(e.vy<160||(c.grab&&e.vy<320)||e.runJump)){
          const into=Math.max(0,e.vx*d[0]+e.vz*d[1]),k=clamp(into/RUN+Math.max(0,-e.vy-200)/900,0,1.2);
          e.runJump=false;e.state='hang';e.st={d,lg,t:0,ph:-.42*k,w:2.4*k+.3};e.x=lg.hang.x;e.y=lg.hang.y;e.z=lg.hang.z;e.vx=e.vy=e.vz=0;e.poseBlend=1;e.bodyYaw=e.legYaw=yawOf(d[0],d[1]);sfx('land',e);break;
        }
      }
    }
    // automatic catch (player): falling past a ledge, or the arena has just turned and a ledge is within arm's reach
    if(e.state==='normal'&&!e.grounded&&!e.ai&&e.grabCD<=0&&!e.runJump&&!(ctrl&&c.crouch)){
      const turned=world.time-(e.turnT||-9)<1.6,fell=(e.fallStart!==undefined?e.fallStart-e.y:0);
      if((turned&&e.vy<200)||(e.vy<-260&&fell>T*1.5)){
        const f0=cardOf(Math.sin(e.bodyYaw),Math.cos(e.bodyYaw)),order=[f0,...CARDS.filter(d=>d[0]!==f0[0]||d[1]!==f0[1])];
        for(const d of order){const lg=findLedge(e,d,turned?40:30);if(!lg||lg.low)continue;
          const k=clamp(-e.vy/700,.4,1.3)+(turned?.5:0);
          e.state='hang';e.st={d,lg,t:0,ph:-(.45+.3*k),w:2.6*k+.8,auto:true};e.x=lg.hang.x;e.y=lg.hang.y;e.z=lg.hang.z;e.vx=e.vy=e.vz=0;
          e.knocked=false;e.turnFall=false;e.ba=0;e.bav=0;e.tumbleHold=0;e.stun=0;e.poseBlend=1;e.bodyYaw=e.legYaw=yawOf(d[0],d[1]);sfx('land',e);
          for(let i=0;i<8;i++)addPart(lg.hang.x+d[0]*12,lg.ly,lg.hang.z+d[1]*12,(rnd()-.5)*120,rnd()*80,(rnd()-.5)*120,.35,[.48,.52,.63],4,'dust');
          break;}
      }
    }
    e.reach=e.state==='normal'&&!e.grounded&&!e.runJump&&e.vy>-260&&world.time-(e.jumpAt||-9)<1.2&&!!findLedge(e,cardOf(Math.sin(e.bodyYaw),Math.cos(e.bodyYaw)),56);
    // dodge: double-tap back / left / right (costs stamina)
    if(ctrl&&c.dodge&&e.state==='normal'&&e.grounded&&!e.runJump&&e.stam>=DODGE_STAM&&(e.dodgeCD||0)<=0&&!(e.crouch&&overlapSolid(e.x,e.y,e.z,e.w,STAND_H)))startDodge(e,c.dodge);
    // gravity-wall kick
    if(e.state==='normal'){
      const can=(e.grounded||e.wasBox)&&world.rotCD<=0&&!world.rot&&!world.pendingRot;
      if(can){
        const aimC=cardOf(Math.sin(e.yaw),Math.cos(e.yaw));
        const order=[aimC,...CARDS.filter(d=>d[0]!==aimC[0]||d[1]!==aimC[1])];
        for(const d of order){const ks=kickableSide(e,d);if(ks){e.kickPrompt=true;
          if(ctrl&&c.kick&&e.kickCD<=0){if(e.crouch&&!overlapSolid(e.x,e.y,e.z,e.w,STAND_H)){e.crouch=false;e.h=STAND_H;}
            if(!e.crouch){e.state='kick';e.st={t:0,d,hit:false,done:false};e.bodyYaw=e.legYaw=yawOf(d[0],d[1]);e.kickCD=.8;e.poseBlend=.7;e.trail=[];sfx('whoosh',e);}}
          break;}}
      }
      if(ctrl&&c.kick&&e.kickCD<=0&&e.state==='normal'&&!(e.crouch&&overlapSolid(e.x,e.y,e.z,e.w,STAND_H))){
        e.crouch=false;e.h=STAND_H;const d=cardOf(Math.sin(e.yaw),Math.cos(e.yaw));
        e.state='kick';e.st={t:0,d,free:true,yaw:e.yaw,hit:false,done:false};e.bodyYaw=e.legYaw=e.yaw;e.kickCD=.7;e.poseBlend=.7;e.trail=[];sfx('whoosh',e);
      }
    }
  }else if(e.state==='slide'){
    const s=e.st;s.t+=dt;
    const sp=Math.hypot(e.vx,e.vz),ns=Math.max(0,sp-SLIDE_FRIC*dt);if(sp>0){e.vx*=ns/sp;e.vz*=ns/sp;}
    e.vy=Math.max(e.vy-G*dt,-MAXFALL);
    const l=moveBody(e,dt);e.grounded=l||(e.vy<=0&&groundProbe(e));
    if(rnd()<dt*30)addPart(e.x,e.y+2,e.z,-e.vx*.3+(rnd()-.5)*40,rnd()*40,-e.vz*.3+(rnd()-.5)*40,.35,[.48,.52,.63],4,'dust');
    const fw=V(Math.sin(s.yaw),0,Math.cos(s.yaw));
    let hit=meleeHit(e,fw,e.w/2+18,32,s.hitSet);
    if(e.hitX||e.hitZ){
      const d=cardOf(fw.x,fw.z);
      const ks=(world.rotCD<=0&&!world.rot&&!world.pendingRot)?kickableSide(e,d):null;
      if(ks){world.pendingRot={key:dirKey(d[0],d[1]),kicker:e,stop:ks.stop};world.hitstop=.16;sfx('kick',e);world.shake=Math.max(world.shake,10);}
      else sfx('land',e);
      hit=true;
    }
    if(hit)world.hitstop=Math.max(world.hitstop,.06);
    const lowCeil=!hit&&e.grounded&&overlapSolid(e.x,e.y,e.z,e.w,CROUCH_H);
    if(lowCeil&&(s.t>=SLIDE_DUR||Math.hypot(e.vx,e.vz)<70)){const fw2=V(Math.sin(s.yaw),0,Math.cos(s.yaw));e.vx=fw2.x*75;e.vz=fw2.z*75;} // keep scooting until there is headroom
    else if(hit||s.t>=SLIDE_DUR||Math.hypot(e.vx,e.vz)<55||!e.grounded)endSlide(e);
  }else if(e.state==='hang'){
    e.vx=e.vy=e.vz=0;const d=e.st.d,hs=e.st;
    // the body swings under the hands, bumps the wall, settles
    hs.t=(hs.t||0)+dt;hs.ph=hs.ph||0;hs.w=hs.w||0;
    hs.w+=(-(G/40)*Math.sin(hs.ph)-3.2*hs.w)*dt;hs.ph+=hs.w*dt;
    if(hs.ph>.14){hs.ph=.14;if(hs.w>0){hs.w*=-.35;if(Math.abs(hs.w)>.6)sfx('thud',e);}}
    const settled=hs.t>.3&&(Math.abs(hs.w)<1.3||hs.t>.9);
    const toward=(mx*d[0]+mz*d[1])>.5,away=(mx*d[0]+mz*d[1])<-.5;
    if(ctrl&&settled&&(c.jump||c.grab&&!e.st.held||toward)){
      const lg=e.st.lg;e.state='climbup';e.st={t:0,s0:V(e.x,e.y,e.z),s1:lg.stand,ly:lg.ly,d,dur:SKN.clips?1.3:.95,lg,noWall:!solid(tile(lg.ci,lg.r-1,lg.ck))};e.poseBlend=1;
    }else if(ctrl&&(c.crouchPressed||away)){e.state='normal';e.grabCD=.35;e.poseBlend=1;}
    else if(!solid(tile(e.st.lg.ci,e.st.lg.r,e.st.lg.ck))){e.state='normal';e.grabCD=.3;}
    if(e.st&&e.st.lg)e.st.held=c.grab;
  }else if(e.state==='dodge'){
    // the body follows the clip's own travel (so the feet don't slide); walls and edges still stop it
    const s=e.st,D=DODGES[s.kind];s.t+=dt;
    const now=dodgeDisp(D,Math.min(s.t,D.dur)),qy=qaxis(V(0,1,0),s.yaw),w=qrot(qy,vsub(now,s.prev));s.prev=now;
    e.vx=w.x/dt;e.vz=w.z/dt;e.vy=Math.max(e.vy-G*dt,-MAXFALL);
    const landed=moveBody(e,dt);e.grounded=landed||(e.vy<=0&&groundProbe(e));
    e.bodyYaw=e.legYaw=s.yaw;
    if(s.t>=D.dur){e.state='normal';e.vx*=.2;e.vz*=.2;e.poseBlend=.6;e.dodgeCD=.25;if(!e.grounded)e.fallStart=e.y;}
  }else if(e.state==='climbup'){
    const s=e.st;s.t+=dt/s.dur;const t=Math.min(1,s.t);
    const d=s.d,sa=s.s0,sb=s.s1;
    if(s.over){const u=t;e.x=lerp(sa.x,sb.x,u);e.z=lerp(sa.z,sb.z,u);e.y=lerp(sa.y,sb.y,u)+Math.sin(u*Math.PI)*(s.ly+5-Math.max(sa.y,sb.y));}
    else if(s.speed){e.y=lerp(sa.y,sb.y,easeOut(Math.min(1,t/.45)));const u=smooth(t);e.x=lerp(sa.x,sb.x,u);e.z=lerp(sa.z,sb.z,u);}
    else if(s.vault){e.y=lerp(sa.y,sb.y,easeOut(Math.min(1,t/.6)));const u=easeInOut(clamp((t-.4)/.6,0,1));e.x=lerp(sa.x,sb.x,u);e.z=lerp(sa.z,sb.z,u);}
    else{e.y=lerp(sa.y,sb.y,smooth(Math.min(1,t/.72)));const u=easeInOut(clamp((t-.5)/.5,0,1));e.x=lerp(sa.x,sb.x,u);e.z=lerp(sa.z,sb.z,u);}
    if(s.t>=1){
      e.state='normal';e.x=sb.x;e.y=sb.y;e.z=sb.z;e.vy=0;
      const ev=s.exitV||0;e.vx=d[0]*ev;e.vz=d[1]*ev;e.poseBlend=.5;
      if(overlapSolid(e.x,e.y,e.z,e.w,e.h))pushOut(e);
      e.grounded=groundProbe(e);e.coyote=.1;if(!e.grounded)e.fallStart=e.y;
    }
  }else if(e.state==='kick'){
    const s=e.st;s.t+=dt/KICK_DUR;
    e.vx=approach(e.vx,0,2000*dt);e.vz=approach(e.vz,0,2000*dt);e.vy=Math.max(e.vy-G*dt,-MAXFALL);
    const l=moveBody(e,dt);e.grounded=l||(e.vy<=0&&groundProbe(e));
    if(s.t>=KICK_HIT&&!s.hit){s.hit=true;
      const ky=s.free?s.yaw:yawOf(s.d[0],s.d[1]),kfw=V(Math.sin(ky),0,Math.cos(ky));
      meleeHit(e,kfw,e.w/2+30,52,null);
      const ks=s.free?null:kickableSide(e,s.d);
      const fp=localToWorld(e,25,-28,'body');
      addPart(fp.x,fp.y,fp.z,0,0,0,.3,e.col,30,'ring');
      if(ks&&world.rotCD<=0&&!world.rot&&!world.pendingRot){
        world.pendingRot={key:dirKey(s.d[0],s.d[1]),kicker:e,stop:ks.stop};world.hitstop=.16;s.done=true;
        sfx('kick',e);world.shake=Math.max(world.shake,10);
        for(let i=0;i<24;i++)addPart(fp.x,fp.y,fp.z,(rnd()-.5)*400-s.d[0]*200,(rnd()-.5)*400,(rnd()-.5)*400-s.d[1]*200,.5,rnd()<.5?[1,.25,.64]:[1,1,1],3,'spark');
      }
    }
    if(s.t>=1){e.state='normal';e.poseBlend=.6;}
  }else if(e.state==='down'){
    const s=e.st;s.t+=dt;
    e.vy=Math.max(e.vy-G*dt,-MAXFALL);if(e.grounded){e.vx=approach(e.vx,0,700*dt);e.vz=approach(e.vz,0,700*dt);}
    const l=moveBody(e,dt);e.grounded=l||(e.vy<=0&&groundProbe(e));
    if(s.t>=s.dur&&(e.grounded||e.wasBox)){
      if(!overlapSolid(e.x,e.y,e.z,e.w,STAND_H)){e.h=STAND_H;e.state='getup';e.st={t:0,side:s.side};e.poseBlend=.25;}else s.dur+=.3;
    }
  }else if(e.state==='land'){
    const s=e.st;s.t+=dt;
    e.vx=approach(e.vx,0,1800*dt);e.vz=approach(e.vz,0,1800*dt);e.vy=Math.max(e.vy-G*dt,-MAXFALL);
    const l=moveBody(e,dt);e.grounded=l||(e.vy<=0&&groundProbe(e));
    const early=s.t>s.dur*.65&&ctrl&&(moving||c.jump);
    if(s.t>=s.dur||early||!e.grounded){e.state='normal';e.poseBlend=.45;}
  }else if(e.state==='getup'){
    e.st.t+=dt/GETUP_DUR;
    e.vx=approach(e.vx,0,1500*dt);e.vz=approach(e.vz,0,1500*dt);e.vy=Math.max(e.vy-G*dt,-MAXFALL);
    const l=moveBody(e,dt);e.grounded=l||(e.vy<=0&&groundProbe(e));
    if(e.st.t>=1){e.state='normal';e.poseBlend=.35;}
  }
  if(e.state!==prevState)e.poseBlend=Math.max(e.poseBlend,.6);
  if(e.state!=='normal'){e.crouch=false;if(e.state!=='slide'&&e.state!=='down'&&e.h!==STAND_H&&!overlapSolid(e.x,e.y,e.z,e.w,STAND_H))e.h=STAND_H;}
  // weapons (gun lowered while sprinting or diving)
  if(e.dodgeCD>0)e.dodgeCD-=dt;
  const canFire=(e.state==='normal'&&!e.runJump)||e.state==='kick'||e.state==='slide';
  if(ctrl&&canFire&&gameState!=='over'){
    if(c.fireClick)e.clickBuf=.12; // a click just before the gun is ready still counts
    // middle click: a rocket, whatever is in your hands
    if(c.rocketClick&&e.rfireCD<=0){if(e.rockets>0&&e.rreload<=0)fireRocket(e);else sfx('empty',e);}
    if(e.weapon==='rocket'){ // launcher selected: left click fires it
      if(e.clickBuf>0||c.fireClick){
        if(e.rockets>0&&e.rreload<=0){if(e.rfireCD<=0){e.clickBuf=0;fireRocket(e);e.lastShot=world.time;}}
        else if(!e.bigLauncher){ // the one-shot launcher is recharging: straight to the pistol and shoot
          e.weapon='pistol';e.ammo=e.stash.pistol;e.reload=0;e.recoil=.3;sfx('swap',e);
          if(e.ammo>0&&e.fireCD<=0){e.clickBuf=0;fireRifle(e);e.lastShot=world.time;}else if(e.ammo<=0)e.reload=RELOAD;}
        else if(c.fireClick){e.clickBuf=0;sfx('empty',e);}}
    }else{
    const pistol=e.weapon==='pistol',held=c.fire&&world.time-(e.lastShot||-9)>=FIRE_CD;
    const wants=pistol?(e.clickBuf>0||held):c.fire;
    if(wants&&e.fireCD<=0&&e.reload<=0){e.clickBuf=0;if(e.ammo>0){fireRifle(e);e.lastShot=world.time;}else{e.reload=reloadOf(e);sfx('empty',e);}}
    }
  }
  // stealth
  e.airT=(e.grounded||e.wasBox)?0:(e.airT||0)+dt;
  if(e.hidden){const ok=(e.state==='normal'||e.state==='kick')&&e.airT<.15&&!(e.sprinting&&e.grounded);if(!ok)reveal(e);}
  else if(STEALTH_ON&&e.state==='normal'&&e.crouch&&e.grounded){e.crouchT+=dt;if(e.crouchT>=STEALTH_T){e.hidden=true;sfx('cloak',e);}}
  else e.crouchT=0;
  e.vis=approach(e.vis,e.hidden?0:1,dt*(e.hidden?1.3:8));
  if(e.y<-300||e.y>L+300||e.x<-300||e.x>L+300||e.z<-300||e.z>L+300){pushOut(e);e.x=clamp(e.x,T*1.5,L-T*1.5);e.y=clamp(e.y,T,L-T*3);e.z=clamp(e.z,T*1.5,L-T*1.5);pushOut(e);}
}
function reveal(e){
  if(e.hidden){e.hidden=false;for(let i=0;i<14;i++)addPart(e.x+(rnd()-.5)*18,e.y+rnd()*e.h,e.z+(rnd()-.5)*18,(rnd()-.5)*90,rnd()*90,(rnd()-.5)*90,.45,e.col,3,'spark');}
  e.crouchT=0;e.vis=Math.max(e.vis,.85);
}
function startSlide(e){
  const yaw=yawOf(e.vx,e.vz);
  e.state='slide';e.st={t:0,yaw,hitSet:new Set()};e.bodyYaw=e.legYaw=yaw;e.h=SLIDE_H;e.crouch=false;
  const sp=Math.max(Math.hypot(e.vx,e.vz),RUN)*1.18;e.vx=Math.sin(yaw)*sp;e.vz=Math.cos(yaw)*sp;e.stam=Math.max(0,e.stam-.15);e.poseBlend=.5;
  sfx('whoosh',e);
}
function endSlide(e){e.state='normal';e.poseBlend=.5;if(!overlapSolid(e.x,e.y,e.z,e.w,STAND_H)){e.h=STAND_H;e.crouch=false;}else{e.h=CROUCH_H;e.crouch=true;}}
function enterDown(e,sev){
  e.state='down';
  const fwd=e.vx*Math.sin(e.bodyYaw)+e.vz*Math.cos(e.bodyYaw);
  e.st={t:0,dur:.8+sev*1.1,side:fwd<-80?-1:1}; // on the back only when thrown backwards
  e.h=22;e.poseBlend=.3;e.bav*=.3;e.knocked=false;e.stun=0;e.legYaw=e.bodyYaw;
  sfx('thud',e);
  for(let i=0;i<16;i++)addPart(e.x+(rnd()-.5)*40,e.y+2,e.z+(rnd()-.5)*40,(rnd()-.5)*320,rnd()*140,(rnd()-.5)*320,.6,[.54,.59,.69],8,'dust');
  addPart(e.x,e.y+4,e.z,0,0,0,.35,[.78,.83,1],46,'ring');
  if(player&&Math.hypot(player.x-e.x,player.y-e.y,player.z-e.z)<500)world.shake=Math.max(world.shake,6+sev*8);
}
// push / damage whatever is in front (slides)
function meleeHit(e,fw,reach,height,already){
  let hit=false;
  const cx=e.x+fw.x*reach*.6,cz=e.z+fw.z*reach*.6,rr=reach*.6+4;
  for(const o of chars){
    if(o===e||!o.alive||(already&&already.has(o)))continue;
    if(Math.abs(o.x-cx)<rr+o.w/2&&Math.abs(o.z-cz)<rr+o.w/2&&o.y<e.y+height&&o.y+o.h>e.y){
      if(already)already.add(o);damage(o,KICK_DMG,e,fw);hit=true;if(!o.alive)continue;
      knockBack(o,V(fw.x*KICK_PUSH,380,fw.z*KICK_PUSH),true);
    }
  }
  for(const b of props){
    if(b.dead||(already&&already.has(b)))continue;
    if(PICKUP_GLOW[b.kind]||(b.kind==='medkit'&&e.state==='slide'))continue; // weapons aren't kicked away, and a slide collects a medkit
    if(Math.abs(b.x-cx)<rr+b.w/2&&Math.abs(b.z-cz)<rr+b.d/2&&b.y<e.y+height&&b.y+b.h>e.y){
      if(already)already.add(b);b.vx+=fw.x*700/Math.pow(b.m,.65);b.vz+=fw.z*700/Math.pow(b.m,.65);b.vy=320/Math.sqrt(b.m);b.grounded=false;b.kickedBy=e;b.kickT=world.time;hit=true;
      if(b.rb)rbSpin(b,V(b.x-fw.x*b.w/2,e.y+24,b.z-fw.z*b.d/2),V(fw.x*700*Math.pow(b.m,.35),120,fw.z*700*Math.pow(b.m,.35)),.5);
    }
  }
  for(const sp of spiders){
    if(!sp.alive||sp.spawnT>0||(already&&already.has(sp)))continue;
    if(Math.abs(sp.p.x-cx)<rr+10&&Math.abs(sp.p.z-cz)<rr+10&&sp.p.y<e.y+height+6&&sp.p.y>e.y-10){
      if(already)already.add(sp);hurtSpider(sp,KICK_DMG,e);hit=true;
      if(sp.alive){sp.state='leap';sp.leapT=0;sp.p=vadd(sp.p,vscale(sp.n,3));sp.v=V(fw.x*620,330,fw.z*620);sp.biteCD=Math.max(sp.biteCD,1);sp.path=null;}
    }
  }
  if(hit){reveal(e);sfx('kick',e);if(e===player)world.shake=Math.max(world.shake,6);}
  return hit;
}
function knockBack(o,v,knock){
  if(o.state==='down'){o.vx+=v.x*.6;o.vz+=v.z*.6;o.vy=Math.max(o.vy,v.y*.4);o.grounded=false;return;}
  if(o.state!=='normal')o.state='normal';
  o.h=STAND_H;o.crouch=false;o.runJump=false;
  o.vx=v.x;o.vy=v.y;o.vz=v.z;o.grounded=false;o.y+=2;
  if(knock){o.knocked=true;o.stun=.6;o.bav=12;o.tumbleHold=0;o.poseBlend=.6;}
  if(overlapSolid(o.x,o.y,o.z,o.w,o.h))pushOut(o);
}

// ---------- procedural pose (sagittal plane, then mapped into 3D) ----------
function ik2(ax,ay,tx,ty,l1,l2,pick){
  let dx=tx-ax,dy=ty-ay,d=Math.hypot(dx,dy);
  const maxd=l1+l2-.01;if(d>maxd){dx*=maxd/d;dy*=maxd/d;d=maxd;}
  if(d<1e-3)d=1e-3;
  const base=Math.atan2(dy,dx),cc=clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1),off=Math.acos(cc);
  const k1={x:ax+Math.cos(base+off)*l1,y:ay+Math.sin(base+off)*l1},k2={x:ax+Math.cos(base-off)*l1,y:ay+Math.sin(base-off)*l1};
  return {j:pick(k1,k2),e:{x:ax+dx,y:ay+dy}};
}
const pickFwd=(a,b)=>a.x>b.x?a:b,pickDown=(a,b)=>a.y>b.y?a:b;
function sm(P,key,tx,ty,a){const p=P[key];p.x+=(tx-p.x)*a;p.y+=(ty-p.y)*a;}
function legPhase(phi,s,A,lift){
  phi=((phi%1)+1)%1;
  if(phi<s){const t=phi/s;return {x:A*(1-2*t),y:0};}
  const t=(phi-s)/(1-s),xs=smooth(Math.pow(t,1.6)),drive=Math.sin(clamp((t-.45)/.55,0,1)*Math.PI)*A*.18;
  return {x:-A+2*A*xs+drive,y:-lift*Math.sin(Math.PI*Math.pow(t,.85))};
}
// local (forward x, y-down from feet) -> world, in the body or leg frame, with tumble about the hip-height pivot
function localToWorld(e,lx,ly,frame,lat){
  const yaw=frame==='leg'?e.legYaw:e.bodyYaw;
  const K=CHAR_SCALE,cy=e.h/2/K,c=Math.cos(e.ba),s=Math.sin(e.ba);
  let px=lx,py=ly+cy;const rx=px*c-py*s,ry=px*s+py*c;px=rx*K;py=(ry-cy)*K;
  const fx=Math.sin(yaw),fz=Math.cos(yaw),rxv=-Math.cos(yaw),rzv=Math.sin(yaw);
  const la=(lat||0)*K;
  return V(e.x+e.visX+fx*px+rxv*la,e.y+e.visY-py,e.z+e.visZ+fz*px+rzv*la);
}
function updatePose(e,dt){
  if(!e.alive)return;
  e.visX=e.visX||0;e.visY=e.visY||0;e.visZ=e.visZ||0;
  if(!e.pose){const z=(x,y)=>({x,y});
    e.pose={hip:z(0,-26),fA:z(4,0),fB:z(-4,0),hN:z(10,-40),hF:z(14,-40),lean:0,headTilt:0,neck:z(0,-43),head:z(0,-52),kA:z(0,-13),kB:z(0,-13),eN:z(4,-35),eF:z(4,-35),gp:z(10,-40),gunA:0,muzzle:z(28,-40),sh:z(0,-41),gunOn:true};}
  const P=e.pose;
  e.poseBlend=Math.max(0,e.poseBlend-dt*3);
  const k=lerp(55,12,e.poseBlend),a=1-Math.exp(-k*dt);
  let aim=clamp(-e.pitch,-1.5,1.5);
  if(e.state==='normal'&&e.grounded&&e.sprinting&&!(e.aimT>0))aim=.85;
  const fwd=e.vx*Math.sin(e.legYaw)+e.vz*Math.cos(e.legYaw); // speed along the legs
  const acc=(fwd-e.prevFwd)/Math.max(dt,1e-4);e.prevFwd=fwd;e.accS=lerp(e.accS,acc,1-Math.exp(-10*dt));
  const lvx=fwd,pvy=-e.vy; // 2D convention: y down
  const speedN=clamp(Math.hypot(e.vx,e.vz)/RUN,0,1);
  e.land=Math.max(0,e.land-dt*3.2);e.takeoff=Math.max(0,(e.takeoff||0)-dt*5);
  let hipX=0,hipY=-26,lean=0,fa,fb,handsGun=true,hN=null,hF=null,headTilt=aim*.35;
  const st=e.state;
  if(st==='normal'&&e.grounded){
    const mv=speedN>.06;
    e.runW=lerp(e.runW,mv?1:0,1-Math.exp(-12*dt));
    const s=lerp(.62,.4,speedN),A=lerp(7,17,speedN),cyc=2*A/s,lift=lerp(5,13,speedN);
    e.phase+=lvx*dt/cyc;
    const pa=legPhase(e.phase,s,A,lift),pb=legPhase(e.phase+.5,s,A,lift);e.armPh={a:pa.x/A,b:pb.x/A};
    const bob=lerp(.8,3.2,speedN)*(.5+.5*Math.cos(4*Math.PI*(e.phase-s/2)));
    const breath=Math.sin(world.time*2.2)*.6,w=e.runW,crouch=e.crouch?11:0;
    hipX=lerp(-1,2.5*Math.sign(lvx),w);
    hipY=lerp(-25.5+breath*(crouch?.5:1)+crouch,-25.5+bob+crouch*.9,w)+e.land*11;
    fa={x:lerp(6+crouch*.4,pa.x+hipX,w),y:lerp(0,pa.y,w)};
    fb={x:lerp(-5-crouch*.3,pb.x+hipX,w),y:lerp(0,pb.y,w)};
    lean=w*speedN*.2*Math.sign(lvx)+clamp(e.accS/5000,-.18,.18)+e.land*.25+crouch*.025+(e.sprinting?.12:0);
  }else if(st==='normal'){
    const r=clamp(-pvy/JUMPV,-1,1);
    const flail=pvy>650?Math.sin(world.time*18)*4*clamp((pvy-650)/400,0,1):0;
    const tumble=Math.min(1,Math.abs(e.ba)*1.5);
    hipY=-28-e.takeoff*2;
    fa={x:lerp(5,7,Math.max(r,0))+flail+tumble*Math.sin(world.time*14)*6,y:lerp(-4,-15,Math.max(r,0))+(r<0?-r*2:0)};
    fb={x:-7-flail+tumble*Math.cos(world.time*13)*6,y:lerp(-8,-5,Math.max(r,0))+(r<0?-r:0)};
    lean=clamp(lvx/RUN,-1,1)*.12-r*.06+tumble*.3*Math.sin(world.time*9);
    if(e.reach&&!e.runJump){handsGun=false;
      const u=smooth(clamp((world.time-(e.jumpAt||0))/.32,0,1)),th=lerp(-1.1,2.95,u),th2=th-.12;
      hN={x:P.sh.x+Math.sin(th)*21,y:P.sh.y+Math.cos(th)*21};hF={x:P.sh.x+Math.sin(th2)*21,y:P.sh.y+Math.cos(th2)*21};
      headTilt=-.45*u;fa={x:3,y:-6};fb={x:-3,y:-3};lean=.05;}
    if(e.runJump){handsGun=false;const u=clamp(-pvy/RUNJUMPV,-1,1);
      lean=.95-u*.15;hipY=-30;hipX=-2;headTilt=-.55;fa={x:-18,y:-20+u*3};fb={x:-24,y:-13};hN={x:26,y:-44+u*5};hF={x:29,y:-40+u*5};}
  }else if(st==='slide'){
    hipY=-8;hipX=-2;lean=-1.05;headTilt=.35;fa={x:22,y:-2};fb={x:7,y:-1};
  }else if(st==='hang'){
    // hanging from the hands: the body is a pendulum under them
    handsGun=false;const s=e.st,ang=-.35+(s.ph||0),pv={x:(e.w/2+.5)/CHAR_SCALE,y:-(e.h+4)/CHAR_SCALE},lag=-(s.w||0)*2.2;
    hipX=pv.x+Math.sin(ang)*35;hipY=pv.y+Math.cos(ang)*35;lean=-ang;headTilt=-.35-(s.ph||0)*.4;
    fa={x:pv.x+Math.sin(ang)*58+lag+1.5,y:pv.y+Math.cos(ang)*58};fb={x:pv.x+Math.sin(ang)*57+lag*1.3-2,y:pv.y+Math.cos(ang)*57-1.5};
    hN={x:pv.x+1,y:pv.y};hF={x:pv.x-1,y:pv.y};
  }else if(st==='climbup'&&!e.st.vault){
    // pull-up: hang -> chest to the ledge -> belly over -> knee up -> stand (keyframed on the ledge corner)
    handsGun=false;const s=e.st,t=Math.min(1,s.t);
    const along=(s.s1.x-e.x)*s.d[0]+(s.s1.z-e.z)*s.d[1],cx=(along-(e.w/2+2))/CHAR_SCALE,hy=-(s.ly-e.y)/CHAR_SCALE;
    const K=[
      {t:0,  hip:[cx-12,hy+33],lean:.35,fa:[cx-10,hy+59],fb:[cx-13,hy+57],hn:[cx+3,hy],hf:[cx+1,hy],head:-.35},
      {t:.38,hip:[cx-9,hy+12], lean:.25,fa:[cx-7,hy+36], fb:[cx-10,hy+34],hn:[cx+3,hy],hf:[cx+1,hy],head:.05},
      {t:.62,hip:[cx+2,hy-2],  lean:1.2,fa:[cx-5,hy+22], fb:[cx-8,hy+20], hn:[cx+13,hy],hf:[cx+11,hy],head:.45},
      {t:.82,hip:[cx+7,hy-13], lean:.55,fa:[cx+11,hy],   fb:[cx-1,hy+4],  hn:[cx+16,hy-1],hf:[cx+14,hy-1],head:.2},
      {t:1,  hip:[0,-26],      lean:.05,fa:[5,0],        fb:[-4,0],       hn:[12,-36],hf:[16,-36],head:0}];
    let i=0;while(i<K.length-2&&t>K[i+1].t)i++;
    const k0=K[i],k1=K[i+1],u=smooth(clamp((t-k0.t)/(k1.t-k0.t),0,1)),L2=(a,b)=>({x:lerp(a[0],b[0],u),y:lerp(a[1],b[1],u)});
    const h=L2(k0.hip,k1.hip);hipX=h.x;hipY=h.y;lean=lerp(k0.lean,k1.lean,u);headTilt=lerp(k0.head,k1.head,u);
    fa=L2(k0.fa,k1.fa);fb=L2(k0.fb,k1.fb);hN=L2(k0.hn,k1.hn);hF=L2(k0.hf,k1.hf);
    if(t>.93)handsGun=true;
  }else if(st==='climbup'){
    // vault: hands planted on the obstacle top, legs tucked and swung through
    handsGun=false;const s=e.st,t=Math.min(1,s.t),dd=s.d;
    const top=-(s.ly-e.y)/CHAR_SCALE;
    let fx;if(s.face!==undefined)fx=(s.face-(dd[0]?e.x:e.z))*(dd[0]||dd[1])/CHAR_SCALE;
    else{const along=(s.s1.x-e.x)*dd[0]+(s.s1.z-e.z)*dd[1];fx=(along-(e.w/2+2))/CHAR_SCALE;}
    const plant=t<.62,u1=smooth(clamp(t/.42,0,1)),u2=smooth(clamp((t-.42)/.58,0,1));
    const mid={hip:[fx+6,top-13],lean:.5,fa:[fx+15,top-4],fb:[fx+9,top-6],hn:[fx+6,top],hf:[fx+3,top],head:.2};
    const st0={hip:[1,-25],lean:.2,fa:[6,0],fb:[-5,0],hn:[fx+6,top],hf:[fx+3,top],head:.1};
    const st1={hip:[0,-26],lean:.05,fa:[5,0],fb:[-4,0],hn:[12,-36],hf:[16,-36],head:0};
    const A=t<.42?st0:mid,B=t<.42?mid:st1,u=t<.42?u1:u2,L2=(a,b)=>({x:lerp(a[0],b[0],u),y:lerp(a[1],b[1],u)});
    const h=L2(A.hip,B.hip);hipX=h.x;hipY=h.y;lean=lerp(A.lean,B.lean,u);headTilt=lerp(A.head,B.head,u);
    fa=L2(A.fa,B.fa);fb=L2(A.fb,B.fb);
    if(plant){hN={x:mid.hn[0],y:top};hF={x:mid.hf[0],y:top};}else{hN=L2(A.hn,B.hn);hF=L2(A.hf,B.hf);}
    if(t>.9)handsGun=true;
  }else if(st==='land'){
    // three-point landing: knees deep, both hands to the ground, eyes forward, then rise
    handsGun=false;const s=e.st,t=s.t/s.dur,sev=s.sev;
    const dn=smooth(clamp(t/.12,0,1)),up=smooth(clamp((t-.62)/.38,0,1));
    const low={hip:-6-(1-sev)*7,lean:.62+sev*.18};
    hipX=lerp(0,-1,dn);hipY=lerp(lerp(-22,low.hip,dn),-26,up);lean=lerp(lerp(.2,low.lean,dn),.06,up);headTilt=lerp(-.1,-.55,dn)*(1-up);
    fa={x:lerp(6,9,dn),y:0};fb={x:lerp(-5,-10,dn),y:0};
    hN={x:lerp(lerp(8,15,dn),12,up),y:lerp(lerp(-20,-1,dn),-36,up)};hF={x:lerp(lerp(6,11,dn),16,up),y:lerp(lerp(-20,-2,dn),-36,up)};
    if(up>.8)handsGun=true;
  }else if(st==='kick'){
    const t=e.st.t;
    if(t<KICK_HIT){const u=smooth(t/KICK_HIT);fa={x:lerp(5,11,u),y:lerp(0,-12,u)};lean=-.12*u;hipY=-26+u*2;}
    else if(t<.56){const u=easeOut((t-KICK_HIT)/(.56-KICK_HIT));fa={x:lerp(11,27,u),y:lerp(-12,-27,u)};lean=lerp(-.12,-.22,u);hipY=-24;}
    else if(t<.72){fa={x:27,y:-27};lean=-.22;hipY=-24;}
    else{const u=smooth((t-.72)/.28);fa={x:lerp(27,5,u),y:lerp(-27,0,u)};lean=lerp(-.22,0,u);hipY=-24-u*2;}
    fb={x:-7,y:0};
    if(e.st.done&&t>=.45){const u=clamp((t-.45)/.25,0,1);fa={x:lerp(fa.x,6,u),y:lerp(fa.y,0,u)};lean=lerp(lean,.05,u);}
  }else if(st==='down'){
    handsGun=false;const s=e.st,sg=s.side,imp=Math.max(0,1-s.t/.3);
    hipY=-5-Math.sin(Math.min(1,s.t/.3)*Math.PI)*5*imp;lean=sg*Math.PI/2*.97;headTilt=sg*.9;
    if(sg<0){fa={x:14,y:-2};fb={x:9,y:-8};}else{fa={x:-14,y:-2};fb={x:-12,y:-1};}
    hN={x:sg*22,y:-3};hF={x:sg*13,y:-11};
    if(s.t>s.dur-.35){hF={x:hF.x+Math.sin(s.t*20)*1.5,y:hF.y};}
  }else if(st==='getup'){
    const s=e.st,sg=s.side,t=Math.min(1,s.t),u1=smooth(clamp(t/.5,0,1)),u2=smooth(clamp((t-.45)/.55,0,1));
    handsGun=t>.8;
    lean=lerp(lerp(sg*Math.PI/2*.97,sg<0?.35:.6,u1),.04,u2);
    hipY=lerp(lerp(-5,sg<0?-9:-13,u1),-26,u2);hipX=lerp(0,sg<0?-2:-3,u1)*(1-u2);
    const fa0=sg<0?{x:14,y:-2}:{x:-14,y:-2},fb0=sg<0?{x:9,y:-8}:{x:-12,y:-1},fa1=sg<0?{x:9,y:0}:{x:-1,y:0},fb1=sg<0?{x:3,y:0}:{x:-11,y:-1};
    fa={x:lerp(lerp(fa0.x,fa1.x,u1),5,u2),y:lerp(lerp(fa0.y,fa1.y,u1),0,u2)};
    fb={x:lerp(lerp(fb0.x,fb1.x,u1),-4,u2),y:lerp(lerp(fb0.y,fb1.y,u1),0,u2)};
    headTilt=lerp(sg*.9,0,u1);
    if(!handsGun){hN={x:lerp(sg*22,8,u1),y:lerp(-3,-1,u1)};hF={x:lerp(sg*13,4,u1),y:lerp(-11,-1,u1)};
      if(u2>0){hN={x:lerp(hN.x,12,u2),y:lerp(hN.y,-36,u2)};hF={x:lerp(hF.x,16,u2),y:lerp(hF.y,-36,u2)};}}
  }else{fa={x:5,y:0};fb={x:-5,y:0};}
  lean-=e.flinch*.25;
  const stance=(st==='normal'&&e.grounded&&e.poseBlend<.05),snappy=st==='kick'||st==='slide'||st==='land'||st==='climbup'||(st==='hang'&&e.st.t>.12)||(st==='down'&&e.st.t<.3);
  const af=stance?1-Math.exp(-80*dt):snappy?1-Math.exp(-45*dt):a,al=snappy?af:a;
  sm(P,'hip',hipX,hipY,al);sm(P,'fA',fa.x,fa.y,af);sm(P,'fB',fb.x,fb.y,af);
  P.lean+=(lean-P.lean)*al;P.headTilt+=(headTilt-P.headTilt)*al;
  const H=P.hip,ln=P.lean;
  P.neck={x:H.x+Math.sin(ln)*TORSO,y:H.y-Math.cos(ln)*TORSO};
  const ht=ln*.4+P.headTilt;P.head={x:P.neck.x+Math.sin(ht)*8.5,y:P.neck.y-Math.cos(ht)*8.5};P.headA=ht;
  P.sh={x:P.neck.x-Math.sin(ln)*2.5,y:P.neck.y+Math.cos(ln)*2.5};
  const LA=ik2(H.x,H.y,P.fA.x,P.fA.y,THIGH,SHIN,pickFwd),LB=ik2(H.x,H.y,P.fB.x,P.fB.y,THIGH,SHIN,pickFwd);
  P.kA=LA.j;P.fA={x:LA.e.x,y:LA.e.y};P.kB=LB.j;P.fB={x:LB.e.x,y:LB.e.y};
  P.gunOn=handsGun;
  if(!e.trail)e.trail=[];
  if(st==='kick'&&e.st.t>.3&&e.st.t<.8){e.trail.push(localToWorld(e,P.fA.x,P.fA.y,'body',5));if(e.trail.length>9)e.trail.shift();}
  else if(e.trail.length)e.trail.shift();
  e.aimT=Math.max(0,(e.aimT||0)-dt);e.rArm=Math.max(0,(e.rArm||0)-dt);
  if(e.weapon==='rocket'&&e.state==='normal'&&!e.emote&&!(e.rreload>0&&e.rrl))e.rArm=Math.max(e.rArm,.25); // launcher selected: the arm stays up
  const sg=twoHanded(e),wantAim=sg||e.aimT>0;
  e.aimW=approach(e.aimW||0,wantAim?1:0,dt*(wantAim?14:2.6));
  // the aimed position is always computed (bullets leave from it)
  P.gunA+=(aim-P.gunA)*Math.min(1,dt*30);
  const ga=P.gunA,cxa=Math.cos(ga),sya=Math.sin(ga),rec=e.recoil*e.recoil*5,glen=sg?19:12;
  const gpA={x:P.sh.x+2+cxa*(10-rec),y:P.sh.y+3+sya*(10-rec)};
  P.muzzleAim={x:gpA.x+cxa*glen,y:gpA.y+sya*glen};
  if(handsGun){
    // arm swing from the stride: each arm opposite its leg
    const swingAmp=(st==='normal'&&e.grounded)?lerp(.18,e.sprinting?1.05:.7,speedN)*e.runW:0;
    const ph=e.armPh||{a:0,b:0},idle=Math.sin(world.time*2.2)*.04;
    const thN=-ph.a*swingAmp+.08+idle,thF=-ph.b*swingAmp+.08-idle,AL=20.5;
    const hNc={x:P.sh.x+Math.sin(thN)*AL,y:P.sh.y+Math.cos(thN)*AL},hFc={x:P.sh.x+Math.sin(thF)*AL,y:P.sh.y+Math.cos(thF)*AL};
    const w=sg?1:smooth(e.aimW),gaC=clamp(.85-thN*.6,.35,1.35),gaB=lerp(gaC,ga,w);
    const gp={x:lerp(hNc.x,gpA.x,w),y:lerp(hNc.y,gpA.y,w)};
    const cx=Math.cos(gaB),sy=Math.sin(gaB);
    P.gunA2=gaB;P.gp=gp;P.muzzle={x:gp.x+cx*glen,y:gp.y+sy*glen};
    P.hN={x:gp.x,y:gp.y};
    const grip=sg?{x:gp.x+cx*9,y:gp.y+sy*9-1}:{x:gp.x+cx*1.5-1,y:gp.y+sy*1.5+2.5}; // pistol: support hand cups the grip
    P.hF={x:lerp(hFc.x,grip.x,w),y:lerp(hFc.y,grip.y,w)};
  }else{sm(P,'hN',hN.x,hN.y,a);sm(P,'hF',hF.x,hF.y,a);P.gunA2=P.gunA;}
  // wrist launcher: the off arm snaps forward when a rocket goes
  if(e.rArm>0){const wr=clamp(e.rArm/.12,0,1)*clamp((e.rArm)/.45,0,1)*1.6,wv=Math.min(1,wr);
    const tgt={x:P.sh.x+cxa*21,y:P.sh.y+sya*21};P.hF={x:lerp(P.hF.x,tgt.x,wv),y:lerp(P.hF.y,tgt.y,wv)};}
  const AN=ik2(P.sh.x,P.sh.y,P.hN.x,P.hN.y,UPPER,FORE,pickDown),AF=ik2(P.sh.x,P.sh.y,P.hF.x,P.hF.y,UPPER,FORE,pickDown);
  P.eN=AN.j;P.hN={x:AN.e.x,y:AN.e.y};P.eF=AF.j;P.hF={x:AF.e.x,y:AF.e.y};
  if(!world.rot)e.kickerSpin=0;
  const vd=Math.exp(-8*dt);e.visX*=vd;e.visY*=vd;e.visZ*=vd;
}
// world-space muzzle for shooting
function muzzleOf(e){
  if(e._mzRel&&e._mzW===e.weapon&&world.time-e._mzT<.12)return V(e.x+e._mzRel.x,e.y+e._mzRel.y,e.z+e._mzRel.z);
  const P=e.pose;
  if(!P)return V(e.x,e.y+44,e.z);
  const m=P.muzzleAim||P.muzzle;return localToWorld(e,m.x,m.y,'body',3);
}

// ---------- drawing ----------
const SUIT=hexRGB('#1c2236'),SUIT2=hexRGB('#252d47'),DARK=hexRGB('#151a2a');
function drawChar(e,alphaOverride){
  if(!e.alive||!e.pose)return;
  const vis=alphaOverride!==undefined?alphaOverride:e.vis;
  if(vis<.02)return;
  const P=e.pose,acc=e.col,al=vis,flash=e.invuln>0?(.5+.5*Math.sin(world.time*14))*Math.min(1,e.invuln/.3)*.8:0;
  const gl=R.gl;
  if(al<.99){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
  const B=(p,lat)=>localToWorld(e,p.x,p.y,'body',lat),Lg=(p,lat)=>localToWorld(e,p.x,p.y,'leg',lat);
  const hipC=B(P.hip,0);
  // rigged model when it's loaded: the game skeleton drives its bones
  const SK=SKN.ready&&SKN.on?drawSkinnedChar(e,acc,al,flash):null;
  if(al<.99&&SK){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
  if(!SK){
  // legs (A = right, B = left)
  for(const [kk,ff,lat,col] of [[P.kA,P.fA,5,SUIT],[P.kB,P.fB,-5,DARK]]){
    const hp=Lg(P.hip,lat),kn=Lg(kk,lat*1.05),ft=Lg(ff,lat);
    drawSeg(hp,kn,7,col,null,acc,al);drawSeg(kn,ft,6,col,null,acc,al);
    const toe=localToWorld(e,ff.x+6,ff.y-.5,'leg',lat);drawSeg(ft,toe,4.5,DARK,null,acc,al);
  }
  // torso (oriented box hip->neck)
  const nk=B(P.neck,0);
  {const d=vsub(nk,hipC),len=vlen(d)||1,up=vscale(d,1/len),yaw=e.bodyYaw;
   const rt=V(-Math.cos(yaw),0,Math.sin(yaw)),fw=vnorm(vcross(rt,up)),rt2=vcross(up,fw);
   drawCubeM(M4.basis(vscale(vadd(hipC,nk),.5),vscale(rt2,-13),vscale(up,len+4),vscale(fw,8)),SUIT2,null,acc,al);
   const chest=vadd(hipC,vscale(d,.7));drawCubeM(M4.basis(chest,vscale(rt2,-15),vscale(up,8),vscale(fw,10)),SUIT,null,acc,al);
   drawCubeM(M4.basis(hipC,vscale(rt2,-12),vscale(up,4),vscale(fw,8.5)),acc,[acc[0]*.5,acc[1]*.5,acc[2]*.5],null,al);}
  // head + visor
  {const hc=B(P.head,0),yaw=e.bodyYaw,ht=P.headA;
   const fw=V(Math.sin(yaw)*Math.cos(ht),Math.sin(ht),Math.cos(yaw)*Math.cos(ht)),rt=V(-Math.cos(yaw),0,Math.sin(yaw)),up=vcross(fw,rt);
   drawCubeM(M4.basis(hc,vscale(rt,12),vscale(up,13),vscale(fw,12)),hexRGB('#232a42'),null,acc,al);
   const vz=vadd(hc,vadd(vscale(fw,5.5),vscale(up,1.5)));
   drawCubeM(M4.basis(vz,vscale(rt,10),vscale(up,3.5),vscale(fw,2.5)),acc,[acc[0]*.9,acc[1]*.9,acc[2]*.9],null,al);}
  }
  if(SK){drawWeaponsSK(e,P,SK,acc,al);}
  else{
  // gun
  if(P.gunOn&&e.weapon==='pistol'){
    const g0=B(P.gp,3),gm=B(P.muzzle,3),dir=vnorm(vsub(gm,g0));
    const ga=P.gunA2||0,gripEnd=B({x:P.gp.x-Math.sin(ga)*6,y:P.gp.y+Math.cos(ga)*6},3);
    drawSeg(vadd(g0,vscale(dir,-2.5)),gm,4,hexRGB('#2b3148'),null,acc,al);
    drawSeg(g0,gripEnd,3.2,hexRGB('#1f2436'),null,null,al);
    drawSeg(vadd(gm,vscale(dir,-1.2)),gm,2.2,acc,acc,null,al);
  }else if(P.gunOn){
    const g0=B(P.gp,3),gm=B(P.muzzle,3),gb=vadd(g0,vscale(vnorm(vsub(g0,gm)),6));
    drawSeg(gb,gm,5,hexRGB('#2b3148'),null,acc,al);
    {const dir=vnorm(vsub(gm,g0));drawSeg(vadd(g0,vscale(dir,4)),vadd(gm,vscale(dir,3)),7,hexRGB('#3b2a22'),null,[1,.55,.2],al);
      const pump=vadd(g0,vscale(dir,10-e.recoil*3));drawSeg(vadd(pump,V(0,-3,0)),vadd(pump,vadd(vscale(dir,7),V(0,-3,0))),5,hexRGB('#ff8a2a'),[.3,.12,0],null,al);}
  }else if(twoHanded(e)){
    const back=B({x:P.neck.x-6,y:P.neck.y+8},0);drawSeg(vadd(back,V(0,8,0)),vadd(back,V(0,-12,0)),5,hexRGB('#2b3148'),null,acc,al);
  }else{
    const h0=Lg({x:P.hip.x+1,y:P.hip.y+3},9),h1=Lg({x:P.hip.x+2,y:P.hip.y+11},9);drawSeg(h0,h1,4,hexRGB('#2b3148'),null,acc,al);
  }
  for(const [el,hd,lat,hl,col] of [[P.eN,P.hN,7,3,SUIT],[P.eF,P.hF,-7,2,DARK]]){
    const sh=B(P.sh,lat),eb=B(el,lat*1.2),hn=B(hd,hl);
    drawSeg(sh,eb,5,col,null,acc,al);drawSeg(eb,hn,4.5,col,null,acc,al);
    if(lat<0){const fd=vnorm(vsub(hn,eb)),side=V(Math.cos(e.bodyYaw)*2.5,2,-Math.sin(e.bodyYaw)*2.5);
      const a0=vadd(vadd(eb,vscale(fd,1)),side),a1=vadd(vadd(hn,vscale(fd,2)),side);
      drawSeg(a0,a1,5.5,hexRGB('#3a2a2a'),null,[1,.55,.2],al);
      drawSeg(vadd(a1,vscale(fd,-1.5)),vadd(a1,vscale(fd,.6)),4,hexRGB('#ff8a2a'),e.rreload>0?[.2,.08,0]:[.9,.4,.1],null,al);}
  }
  }
  if(e.trail&&e.trail.length>1){for(let i=1;i<e.trail.length;i++){drawSeg(e.trail[i-1],e.trail[i],2+i/e.trail.length*5,acc,acc,null,.35*i/e.trail.length*al+.05);}}
  if(al<.99){gl.disable(gl.BLEND);gl.depthMask(true);}
}

// ---------- weapon models on the rigged character ----------
// box with its long axis from a to b, square side t, rolled about that axis
function segM(a,b,t,roll,t2){const d=vsub(b,a),len=vlen(d)||.001,dz=vscale(d,1/len);const ref=Math.abs(dz.y)<.9?V(0,1,0):V(1,0,0);
  let ax=vnorm(vcross(ref,dz)),ay=vcross(dz,ax);if(roll){const c=Math.cos(roll),s=Math.sin(roll),nx=vadd(vscale(ax,c),vscale(ay,s)),ny=vsub(vscale(ay,c),vscale(ax,s));ax=nx;ay=ny;}
  return M4.basis(vscale(vadd(a,b),.5),vscale(ax,t),vscale(ay,t2||t),vscale(dz,len));}
// round-ish tube: two boxes, the second turned 45° (an octagon in section)
function drawTube(a,b,r,col,em,al){drawCubeM(segM(a,b,r*1.7,0),col,em,null,al);drawCubeM(segM(a,b,r*1.7,Math.PI/4),col,em,null,al);}
// a part in a weapon's frame: origin o, axes u (barrel), v (up), w (side); centre (cu,cv,cw), size (su,sv,sw)
function wpart(F,cu,cv,cw,su,sv,sw,col,em,edge,al){
  const c=vadd(F.o,vadd(vadd(vscale(F.u,cu),vscale(F.v,cv)),vscale(F.w,cw)));
  drawCubeM(M4.basis(c,vscale(F.u,su),vscale(F.v,sv),vscale(F.w,sw)),col,em,edge,al);
}
const GUNMETAL=hexRGB('#2a3042'),GUNDARK=hexRGB('#161a26'),GRIPC=hexRGB('#1d2130');
// compact pistol: slide, frame, angled grip, trigger guard, sights, a thin glowing stripe in the team colour
function drawPistolModel(F,acc,al,slideBack){
  const sb=slideBack||0;
  wpart(F,2.1-sb,1.75,0,7.6,1.5,1.25,GUNMETAL,null,null,al);                 // slide
  wpart(F,2.4-sb,1.75,.64,6.2,.35,.05,acc,acc,null,al);                       // stripe (right side)
  wpart(F,2.4-sb,1.75,-.64,6.2,.35,.05,acc,acc,null,al);                      // stripe (left side)
  wpart(F,2.4,.75,0,6.4,.8,1.05,GUNDARK,null,null,al);                         // frame / dust cover
  wpart(F,6.05,1.65,0,.5,.8,.8,hexRGB('#0a0c12'),null,null,al);                // muzzle
  wpart(F,-1.3-sb,2.65,0,.5,.45,.9,GUNDARK,null,null,al);                      // rear sight
  wpart(F,5.4-sb,2.6,0,.4,.4,.25,acc,acc,null,al);                             // front sight dot
  wpart(F,1.55,-.25,0,2.2,.25,.55,GUNDARK,null,null,al);                       // trigger guard (bottom)
  wpart(F,2.6,.1,0,.25,.9,.55,GUNDARK,null,null,al);                           // trigger guard (front)
  wpart(F,1.3,.05,0,.25,.8,.3,hexRGB('#3a4258'),null,null,al);                 // trigger
  // grip, raked back
  const gF={o:vadd(F.o,vadd(vscale(F.u,-.35),vscale(F.v,-1.7))),u:vnorm(vadd(F.u,vscale(F.v,.28))),v:vnorm(vsub(F.v,vscale(F.u,.28))),w:F.w};
  wpart(gF,0,0,0,1.6,4.2,1.2,GRIPC,null,null,al);
  wpart(gF,0,-2.15,0,1.7,.35,1.3,GUNDARK,null,null,al);                         // magazine base
}
// wrist launcher: round tube, flared muzzle, rear cap, a three-round drum (lit per rocket left), straps round the forearm
function drawLauncherModel(e,eb,hn,out,acc,al){
  if(!e.bigLauncher)return drawSmallLauncher(e,eb,hn,out,acc,al);
  const fd=vnorm(vsub(hn,eb)),len=vlen(vsub(hn,eb));
  const up=vnorm(vsub(out,vscale(fd,vdot(out,fd)))),sd=vcross(fd,up);
  const ax=d=>vadd(vadd(eb,vscale(fd,d)),vscale(up,2.6));
  const a0=ax(len*.12),a1=ax(len+1.2),hot=e.rreload>0?[.25,.1,0]:[1,.5,.12];
  drawTube(a0,a1,1.45,hexRGB('#3a2c2c'),null,al);                                         // tube
  drawTube(vsub(a1,vscale(fd,.9)),vadd(a1,vscale(fd,1.1)),1.9,hexRGB('#222633'),null,al); // muzzle collar
  drawTube(vadd(a1,vscale(fd,1.05)),vadd(a1,vscale(fd,1.3)),1.05,hexRGB('#ff8a2a'),hot,al);// muzzle glow
  drawTube(vsub(a0,vscale(fd,.9)),vadd(a0,vscale(fd,.5)),1.75,hexRGB('#222633'),null,al);  // rear cap
  for(const t of [.33,.62])drawTube(vadd(eb,vscale(fd,len*t-.35)),vadd(eb,vscale(fd,len*t+.35)),2.3,hexRGB('#151821'),null,al); // straps
  // drum on the outer side with the rockets that are left
  const F={o:vadd(ax(len*.55),vscale(sd,1.7)),u:fd,v:up,w:sd};
  wpart(F,0,0,.4,len*.38,1.9,1.2,hexRGB('#4a2a22'),null,null,al);
  const n=e.rockets===undefined?3:e.rockets;
  for(let i=0;i<3;i++)wpart(F,(i-1)*len*.12,0,1.05,.8,.8,.3,i<n?hexRGB('#ff8a2a'):hexRGB('#2a1a14'),i<n?[.9,.4,.1]:null,null,al);
  wpart({o:ax(len*.8),u:fd,v:up,w:sd},0,1.7,0,1.4,.45,.45,acc,acc,null,al);                  // sight
}
// the default one-shot launcher: a slim tube on the forearm, one rocket, a light that fills as it recharges
function drawSmallLauncher(e,eb,hn,out,acc,al){
  const fd=vnorm(vsub(hn,eb)),len=vlen(vsub(hn,eb));
  const up=vnorm(vsub(out,vscale(fd,vdot(out,fd)))),sd=vcross(fd,up);
  const ax=d=>vadd(vadd(eb,vscale(fd,d)),vscale(up,2.2));
  const a0=ax(len*.3),a1=ax(len+.6),ch=e.rreload>0?1-e.rreload/RRELOAD_S:1;
  drawTube(a0,a1,1.1,hexRGB('#3a2c2c'),null,al);
  drawTube(vsub(a1,vscale(fd,.6)),vadd(a1,vscale(fd,.7)),1.45,hexRGB('#222633'),null,al);
  drawTube(vadd(a1,vscale(fd,.65)),vadd(a1,vscale(fd,.85)),.8,hexRGB('#ff8a2a'),ch>=1?[1,.5,.12]:[.15*ch,.06*ch,0],al);
  drawTube(vsub(a0,vscale(fd,.6)),vadd(a0,vscale(fd,.4)),1.35,hexRGB('#222633'),null,al);
  drawTube(vadd(eb,vscale(fd,len*.55-.3)),vadd(eb,vscale(fd,len*.55+.3)),2.1,hexRGB('#151821'),null,al);
  // charge bar along the top
  const F={o:ax(len*.62),u:fd,v:up,w:sd};
  wpart(F,0,1.3,0,len*.4,.35,.45,hexRGB('#2a1a14'),null,null,al);
  if(ch>0)wpart(F,-len*.2+len*.2*ch,1.38,0,len*.4*ch,.38,.5,ch>=1?hexRGB('#ff8a2a'):hexRGB('#a04a1a'),ch>=1?[.9,.4,.1]:[.25,.1,0],null,al);
}
// pump shotgun: stock and butt pad, receiver with ejection port and side shell carrier, barrel over the magazine tube,
// sliding ribbed forend, perforated heat shield with glowing slots, bead sight. Origin = the gun hand on the grip.
function drawShotgunModel(F,acc,al,pump){
  const POLY=hexRGB('#20242f'),MET=hexRGB('#2c3346'),DK=hexRGB('#12151d'),OR=hexRGB('#ff8a2a'),p=(pump||0)*3;
  wpart(F,-10.6,-.4,0,.8,4.2,1.8,DK,null,null,al);                     // butt pad
  wpart(F,-7,-.05,0,6.2,2.7,1.6,POLY,null,null,al);                     // stock
  wpart(F,-6.4,1.5,0,4.8,.6,1.3,POLY,null,null,al);                     // comb
  wpart(F,-4.2,-1.25,0,1.4,.25,1.65,OR,[.25,.1,0],null,al);             // stock stripe
  const gF={o:vadd(F.o,vadd(vscale(F.u,-.3),vscale(F.v,-1.8))),u:vnorm(vadd(F.u,vscale(F.v,.3))),v:vnorm(vsub(F.v,vscale(F.u,.3))),w:F.w};
  wpart(gF,0,0,0,1.6,3.6,1.4,POLY,null,null,al);                        // pistol grip
  wpart(F,3,1.3,0,6.6,2.6,1.9,MET,null,null,al);                        // receiver
  wpart(F,3.6,1.7,.97,2.4,.8,.06,acc,acc,null,al);                      // ejection port glow
  for(let i=0;i<4;i++)wpart(F,1.7+i*.95,1.1,-1.1,.6,1.2,.5,hexRGB('#c0392b'),[.18,.03,0],null,al); // side shells
  wpart(F,1,-.3,0,2.1,.25,.6,DK,null,null,al);wpart(F,2.05,.15,0,.25,.9,.6,DK,null,null,al); // trigger guard
  wpart(F,.8,0,0,.25,.8,.3,hexRGB('#3a4258'),null,null,al);             // trigger
  const at=(u,v)=>vadd(F.o,vadd(vscale(F.u,u),vscale(F.v,v)));
  drawTube(at(6.2,2),at(20.6,2),.62,MET,null,al);                       // barrel
  drawTube(at(20.4,2),at(21.3,2),.8,DK,null,al);                        // muzzle
  drawTube(at(6.2,.65),at(18.6,.65),.62,DK,null,al);                    // magazine tube
  wpart(F,18.2,1.35,0,.9,2.5,1.5,DK,null,null,al);                      // barrel clamp
  wpart(F,12.2-p,.95,0,5.2,2,2.2,OR,[.22,.09,0],null,al);               // forend
  for(const du of [-1.6,-.5,.6,1.7])wpart(F,12.2-p+du,.95,0,.32,2.15,2.35,DK,null,null,al); // grip ribs
  wpart(F,13.2,2.75,0,11,.35,1.3,DK,null,null,al);                      // heat shield
  for(const du of [9.5,13.2,16.9])wpart(F,du,2.95,0,1.3,.1,.8,acc,acc,null,al);
  wpart(F,20.9,2.85,0,.45,.45,.45,acc,acc,null,al);                     // bead
}
// assault rifle: stock, pistol grip, receiver with a glowing optic, curved magazine, railed handguard, barrel with muzzle brake
function drawRifleModel(F,acc,al,recoil,magOut){
  const POLY=hexRGB('#1f2330'),MET=hexRGB('#2c3346'),DK=hexRGB('#12151d'),CY=hexRGB('#7cf0ff'),k=(recoil||0)*.6;
  const P=(cu,cv,cw,su,sv,sw,col,em)=>wpart(F,cu-k,cv,cw,su,sv,sw,col,em||null,null,al);
  P(-9.6,-.6,0,.8,3.6,1.6,DK);                     // butt pad
  P(-7.2,-.1,0,4.4,2.2,1.4,POLY);P(-6.6,1.1,0,3.4,.5,1.2,POLY);P(-4.6,.4,0,1.4,1.4,1.1,DK); // stock, comb, tube
  const gF={o:vadd(F.o,vadd(vscale(F.u,-.2-k),vscale(F.v,-1.7))),u:vnorm(vadd(F.u,vscale(F.v,.3))),v:vnorm(vsub(F.v,vscale(F.u,.3))),w:F.w};
  wpart(gF,0,0,0,1.5,3.4,1.3,POLY,null,null,al);     // pistol grip
  P(2.2,1.2,0,7,2.4,1.8,MET);                        // receiver
  P(2.6,1.6,.92,2.6,.7,.05,CY,[.2,.6,.7]);           // ejection port
  P(.8,-.25,0,2,.25,.6,DK);P(1.8,.15,0,.25,.9,.6,DK);P(.6,0,0,.25,.8,.3,hexRGB('#3a4258')); // guard + trigger
  if(!magOut){const mF={o:vadd(F.o,vadd(vscale(F.u,3.4-k),vscale(F.v,-.4))),u:vnorm(vadd(F.u,vscale(F.v,-.35))),v:vnorm(vadd(F.v,vscale(F.u,.35))),w:F.w};
    wpart(mF,0,-1.9,0,1.6,4,1.2,DK,null,null,al);wpart(mF,.5,-3.8,0,1.7,.35,1.3,acc,acc,null,al);} // curved magazine, lit base
  P(2.4,3.05,0,3.2,1.2,1.4,DK);P(.85,3.05,0,.25,1.05,1.1,acc,acc);P(3.9,3.05,0,.2,.9,.9,hexRGB('#0a0c12')); // optic: body, lit rear lens, front
  P(9.2,1.35,0,6.6,2,1.9,POLY);for(const du of [6.6,8.2,9.8,11.4])P(du,2.45,0,.6,.3,1.2,DK); // handguard + rail teeth
  P(9.2,1.35,.98,5.4,.3,.05,acc,acc);                // handguard stripe
  drawTube(vadd(F.o,vadd(vscale(F.u,12.5-k),vscale(F.v,1.5))),vadd(F.o,vadd(vscale(F.u,17-k),vscale(F.v,1.5))),.42,MET,null,al); // barrel
  P(17.6,1.5,0,1.4,1,1,DK);P(18.35,1.5,0,.15,.6,.6,CY,[.3,.8,1]); // muzzle brake
}
// the muzzle of the gun model as last drawn, kept relative to the fighter so it follows them between frames
const MUZZLE_AT={pistol:[6.5,1.65],shotgun:[21.4,2],rifle:[18.5,1.5]};
function noteMuzzle(e,F){const m=MUZZLE_AT[e.weapon];if(!m||WXF)return;const p=vadd(F.o,vadd(vscale(F.u,m[0]),vscale(F.v,m[1])));e._mzRel=V(p.x-e.x,p.y-e.y,p.z-e.z);e._mzT=world.time;e._mzW=e.weapon;}
function drawWeaponsSK(e,P,SK,acc,al){
  const by=e.bodyYaw,rt=V(-Math.cos(by),0,Math.sin(by));
  const busy=e._handsBusy==='rocket'||e._handsBusy==='emote';
  if(e._gunF&&P.gunOn){ // reloading: the gun sits where the reload puts it
    if(e.weapon==='shotgun')drawShotgunModel(e._gunF,acc,al,0);else if(e.weapon==='rifle')drawRifleModel(e._gunF,acc,al,0,e._gunF.mag);else drawPistolModel(e._gunF,acc,al,e._gunF.slide||0);
    noteMuzzle(e,e._gunF);
  }else if(P.gunOn&&e.weapon==='pistol'&&!busy){
    // carried in the hand along the hand's own axis; snapped onto the aim line while shooting
    const w=clamp((e.aimW||0)*1.6,0,1),pd=e._aimDir||SK.handFwd;
    const u=vnorm(vadd(vscale(SK.handFwd,1-w),vscale(pd,w)));
    let v=vnorm(vadd(vscale(SK.handDown,-(1-w)),vscale(V(0,1,0),w)));v=vnorm(vsub(v,vscale(u,vdot(v,u))));
    const F={o:vadd(SK.hR,vadd(vscale(u,1.6),vscale(v,.6))),u,v,w:vcross(u,v)};
    drawPistolModel(F,acc,al,e.recoil*e.recoil*1.4);noteMuzzle(e,F);
  }else if(P.gunOn&&!busy&&twoHanded(e)){ // long gun, both hands
    const u=e._aimDir&&e.aimW>.3?e._aimDir:vnorm(vsub(SK.hL,SK.hR));let v=vsub(V(0,1,0),vscale(u,u.y));v=vlen(v)<.1?V(1,0,0):vnorm(v);
    const F={o:vadd(SK.hR,vadd(vscale(u,.5),vscale(v,1.4))),u,v,w:vcross(u,v)};
    if(e.weapon==='rifle')drawRifleModel(F,acc,al,e.recoil);else drawShotgunModel(F,acc,al,e.recoil);noteMuzzle(e,F);
  }
  // long guns not in the hands are slung across the back (one each way)
  {const fw=V(Math.sin(by),0,Math.cos(by)),b=vadd(SK.sh,vscale(fw,-6.5)),v=vscale(fw,-1);let side=0;
   for(const wpn of ['shotgun','rifle']){
     const owned=wpn==='shotgun'?e.hasShotgun:e.hasRifle,inHand=e.weapon===wpn&&P.gunOn&&!busy;if(!owned||inHand)continue;
     const s=side++?1:-1,u=vnorm(vadd(vscale(rt,.55*s),V(0,-1,0)));
     if(wpn==='shotgun')drawShotgunModel({o:vsub(vadd(b,vscale(fw,-1.2*side)),vscale(u,5)),u,v,w:vcross(u,v)},acc,al,0);
     else drawRifleModel({o:vsub(vadd(b,vscale(fw,-1.2*side)),vscale(u,4)),u,v,w:vcross(u,v)},acc,al,0);}
  }
  if(e._rItem){const it=e._rItem;
    if(it.kind==='rmag'){const v=it.d,u=it.u,F={o:it.p,u,v,w:vcross(u,v)};wpart(F,0,1.6,0,1.6,4,1.2,GUNDARK,null,null,al);wpart(F,0,-.5,0,1.7,.35,1.3,acc,acc,null,al);}
    else if(it.kind==='mag'){const v=it.d,u=it.u,F={o:it.p,u,v,w:vcross(u,v)};wpart(F,0,1.4,0,1.1,3.6,.9,GUNDARK,null,null,al);wpart(F,0,-.5,0,1.3,.4,1.05,acc,acc,null,al);}
    else if(it.kind==='shell'){drawTube(vsub(it.p,vscale(it.d,1.1)),vadd(it.p,vscale(it.d,1.1)),.45,hexRGB('#c0392b'),[.18,.03,0],al);drawTube(vsub(it.p,vscale(it.d,1.3)),vsub(it.p,vscale(it.d,.7)),.5,hexRGB('#d4a640'),null,al);}
    else{ // a small rocket (fits the tube): body, nose cone, tail fins
      const d=it.d,q=(a,b)=>vadd(it.p,vscale(d,a));
      drawTube(q(-1.6),q(1.1),.55,hexRGB('#ff8a2a'),[.3,.12,0],al);
      drawTube(q(1.1),q(1.6),.4,hexRGB('#3a2a2a'),null,al);drawTube(q(1.6),q(1.95),.22,hexRGB('#3a2a2a'),null,al);
      const sd=vnorm(vcross(d,Math.abs(d.y)<.9?V(0,1,0):V(1,0,0))),up=vcross(sd,d);
      drawCubeM(segM(q(-1.7),q(-1),.12,0,1.5),hexRGB('#222633'),null,null,al);drawCubeM(segM(q(-1.7),q(-1),1.5,0,.12),hexRGB('#222633'),null,null,al);}
  }
  if((!(P.gunOn&&e.weapon==='pistol')||(busy&&!e._gunF))&&SK.uR){ // pistol holstered on the right thigh
    const d=vnorm(vsub(SK.kR,SK.uR)),F={o:vadd(vadd(SK.uR,vscale(d,6)),vscale(rt,4.2)),u:d,v:vnorm(vsub(V(Math.sin(by),0,Math.cos(by)),vscale(d,vdot(V(Math.sin(by),0,Math.cos(by)),d)))),w:null};
    F.w=vcross(F.u,F.v);drawPistolModel(F,acc,al,0);
  }
  // launcher on the left forearm, on its outer side
  drawLauncherModel(e,SK.eL,SK.hL,vadd(vscale(rt,-1),V(0,.7,0)),acc,al);
}

// ---------- ragdolls ----------
let dolls=[];
const DOLL_R={head:7,neck:8,hip:8,kA:5,kB:5,fA:4,fB:4,eN:4,eF:4,hN:3.5,hF:3.5};
const DOLL_LINKS=[['neck','head'],['neck','hip'],['hip','kA'],['kA','fA'],['hip','kB'],['kB','fB'],['neck','eN'],['eN','hN'],['neck','eF'],['eF','hF'],['head','hip'],['kA','kB'],['eN','eF']];
function makeDoll(e,dir){
  const P=e.pose;if(!P)return;
  const pts={head:localToWorld(e,P.head.x,P.head.y,'body'),neck:localToWorld(e,P.neck.x,P.neck.y,'body'),hip:localToWorld(e,P.hip.x,P.hip.y,'body'),
    kA:localToWorld(e,P.kA.x,P.kA.y,'leg',5),fA:localToWorld(e,P.fA.x,P.fA.y,'leg',5),kB:localToWorld(e,P.kB.x,P.kB.y,'leg',-5),fB:localToWorld(e,P.fB.x,P.fB.y,'leg',-5),
    eN:localToWorld(e,P.eN.x,P.eN.y,'body',8),hN:localToWorld(e,P.hN.x,P.hN.y,'body',4),eF:localToWorld(e,P.eF.x,P.eF.y,'body',-8),hF:localToWorld(e,P.hF.x,P.hF.y,'body',-4)};
  const dt=1/120,list=[],idx={};
  for(const k in pts){const p=pts[k],up=k==='head'||k==='neck'?1.4:1;
    const ivx=e.vx+(dir?dir.x*260*up:0)+(rnd()-.5)*40,ivy=e.vy+(dir?dir.y*260:0)+60,ivz=e.vz+(dir?dir.z*260*up:0)+(rnd()-.5)*40;
    idx[k]=list.length;list.push({x:p.x,y:p.y,z:p.z,ox:p.x-ivx*dt,oy:p.y-ivy*dt,oz:p.z-ivz*dt,r:DOLL_R[k]});}
  const links=DOLL_LINKS.map(([a,b])=>{const A=list[idx[a]],Bp=list[idx[b]];return {a:idx[a],b:idx[b],len:Math.hypot(A.x-Bp.x,A.y-Bp.y,A.z-Bp.z)};});
  dolls.push({pts:list,idx,links,life:7,col:e.col});if(dolls.length>8)dolls.shift();
}
function updateDolls(dt){
  for(let n=dolls.length-1;n>=0;n--){
    const d=dolls[n];d.life-=dt;if(d.life<=0){dolls.splice(n,1);continue;}
    for(const p of d.pts){const vx=(p.x-p.ox)*.995,vy=(p.y-p.oy)*.995,vz=(p.z-p.oz)*.995;p.ox=p.x;p.oy=p.y;p.oz=p.z;p.x+=vx;p.y+=vy-G*dt*dt;p.z+=vz;}
    for(let it=0;it<5;it++){
      for(const l of d.links){const A=d.pts[l.a],B=d.pts[l.b],dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z,dd=Math.hypot(dx,dy,dz)||1e-3,f=(dd-l.len)/dd*.5;
        A.x+=dx*f;A.y+=dy*f;A.z+=dz*f;B.x-=dx*f;B.y-=dy*f;B.z-=dz*f;}
      for(const p of d.pts){dollRadius(p);const i=Math.floor(p.x/T),j=Math.floor(p.y/T),k=Math.floor(p.z/T);
        if(solid(tileAt(p.x,p.y,p.z))){
          const c=[[p.x-i*T,0,-1],[(i+1)*T-p.x,0,1],[p.y-j*T,1,-1],[(j+1)*T-p.y,1,1],[p.z-k*T,2,-1],[(k+1)*T-p.z,2,1]];
          let m=c[0];for(const q of c)if(q[0]<m[0])m=q;
          if(m[1]===0)p.x=m[2]<0?i*T-.1:(i+1)*T+.1;else if(m[1]===1){p.y=m[2]<0?j*T-.1:(j+1)*T+.1;if(m[2]>0){p.ox=p.x-(p.x-p.ox)*.5;p.oz=p.z-(p.z-p.oz)*.5;}}else p.z=m[2]<0?k*T-.1:(k+1)*T+.1;
        }}
    }
  }
}
function dollRadius(p){const r=p.r||5;
  for(const [ax,s] of [['y',-1],['x',-1],['x',1],['z',-1],['z',1],['y',1]]){
    const q={x:p.x,y:p.y,z:p.z};q[ax]+=s*r;if(!solid(tileAt(q.x,q.y,q.z))||solid(tileAt(p.x,p.y,p.z)))continue;
    const cell=Math.floor(q[ax]/T),face=s<0?(cell+1)*T:cell*T;p[ax]=face-s*r;
    if(ax==='y'&&s<0){p.ox=p.x-(p.x-p.ox)*.6;p.oz=p.z-(p.z-p.oz)*.6;}}
}
function drawDoll(d){
  const p=k=>{const q=d.pts[d.idx[k]];return V(q.x,q.y,q.z);};
  const al=Math.min(1,d.life/1.5);const gl=R.gl;
  if(al<.99){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}
  if(SKN.ready&&SKN.on){drawSkinned(jointsFromDoll(d),d.col,al);if(al<.99)gl.disable(gl.BLEND);return;}
  for(const [a,b,t] of [['neck','hip',11],['hip','kA',7],['kA','fA',6],['hip','kB',7],['kB','fB',6],['neck','eN',5],['eN','hN',4.5],['neck','eF',5],['eF','hF',4.5]])drawSeg(p(a),p(b),t,SUIT,null,d.col,al);
  drawSeg(p('neck'),p('head'),11,hexRGB('#232a42'),null,d.col,al);
  if(al<.99)gl.disable(gl.BLEND);
}
