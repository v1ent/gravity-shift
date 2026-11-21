// =====================================================================
//  COMBAT — rifle, rocket launcher, explosions, props, particles, audio
// =====================================================================
const PISTOL_TAP_CD=.075; // fastest the pistol can fire: as fast as you can click
const ROCKET_V0=60,ROCKET_LOB=.22,ROCKET_ACC=1100,ROCKET_VMAX=650,ROCKET_R=230,ROCKET_DMG=100,ROCKET_PUSH=620;
// airborne targets: little damage, huge directional push
const AIR_PUSH=2.6,GROUND_PUSH=.6,AIR_DMG=.3,FRAG_LIMIT=15;
// rocket jumps: a blast at your feet always launches you; jumping just before it (within RJ_WINDOW) makes it cheap
const RJ_WINDOW=.6,RJ_DMG_GROUND=60,RJ_DMG_PERFECT=18,RJ_DMG_AIR=21,RJ_VY_GROUND=760,RJ_VY_AIR=880,RJ_FLOAT=.75;
// shotgun: found on the level, replaces the pistol until you die
const SG_MAG=6,SG_RELOAD=2.6,SG_CD=.95,SG_PELLETS=9,SG_SPREAD=.11,SG_DMG=10,SG_RANGE=620;
// assault rifle: found on the level like the shotgun; full auto, 30 rounds
const AR_MAG=30,AR_RELOAD=2.3,AR_CD=.095,AR_DMG=13,AR_HEAD=24;
const magOf=e=>e.weapon==='shotgun'?SG_MAG:e.weapon==='rifle'?AR_MAG:MAG,reloadOf=e=>e.weapon==='shotgun'?SG_RELOAD:e.weapon==='rifle'?AR_RELOAD:RELOAD;
const twoHanded=e=>e.weapon==='shotgun'||e.weapon==='rifle';
const WEAPON_NAME={pistol:'PISTOL',rocket:'LAUNCHER',shotgun:'SHOTGUN',rifle:'RIFLE'},WEAPON_COL={pistol:'#ffcc33',rocket:'#ff5a3c',shotgun:'#ff8a2a',rifle:'#7cf0ff'};
function ownedWeapons(e){const w=['pistol','rocket'];if(e.hasShotgun)w.push('shotgun');if(e.hasRifle)w.push('rifle');return w;}
function noise(at,r,src){(world.noises||(world.noises=[])).push({x:at.x,y:at.y,z:at.z,r,src,t:world.time});}
let bullets=[],rockets=[],props=[],parts=[],feed=[];

// ---------- particles ----------
function addPart(x,y,z,vx,vy,vz,life,col,size,type){
  if(type==='ring'){ // expanding glow ring = radial burst of points
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2;parts.push({x,y,z,vx:Math.cos(a)*size*5,vy:(rnd()-.5)*size,vz:Math.sin(a)*size*5,life,max:life,col,size:6,type:'glow'});}
    return;
  }
  parts.push({x,y,z,vx,vy,vz,life,max:life,col,size,type});
  if(parts.length>1400)parts.splice(0,parts.length-1400);
}
// nudge a point out of nearby solid blocks (explosions on walls and floors)
function offSurface(c,d){
  let n=V(0,0,0);
  for(const [ax,v] of [['x',V(1,0,0)],['y',V(0,1,0)],['z',V(0,0,1)]]){
    const a=solid(tileAt(c.x-v.x*14,c.y-v.y*14,c.z-v.z*14)),b=solid(tileAt(c.x+v.x*14,c.y+v.y*14,c.z+v.z*14));
    if(a&&!b)n=vadd(n,v);else if(b&&!a)n=vsub(n,v);}
  if(vlen(n)<.1)return c;n=vnorm(n);let p=vadd(c,vscale(n,d));
  for(let k=0;k<4&&solid(tileAt(p.x,p.y,p.z));k++)p=vadd(p,vscale(n,8));
  return p;
}
function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.life-=dt;if(p.life<=0){parts.splice(i,1);continue;}
    const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt,nz=p.z+p.vz*dt;
    if(p.type!=='glow'&&p.type!=='splat'&&p.type!=='scorch'&&solid(tileAt(nx,ny,nz))){ // particles don't drift into walls: they skim along them
      if(p.type==='drop'){for(const s of [.75,.5,.25])if(!solid(tileAt(p.x+p.vx*dt*s,p.y+p.vy*dt*s,p.z+p.vz*dt*s))){p.x+=p.vx*dt*s;p.y+=p.vy*dt*s;p.z+=p.vz*dt*s;break;}
        p.type='splat';p.vx=p.vy=p.vz=0;p.life=Math.min(p.life,3+rnd()*2);p.max=p.life;continue;}
      if(solid(tileAt(nx,p.y,p.z)))p.vx*=-.25;if(solid(tileAt(p.x,ny,p.z)))p.vy*=-.25;if(solid(tileAt(p.x,p.y,nz)))p.vz*=-.25;
    }else{p.x=nx;p.y=ny;p.z=nz;}
    if(p.type==='spark')p.vy-=G*.5*dt;
    else if(p.type==='drop')p.vy-=G*.9*dt;
    else if(p.type==='ember'){p.vy-=120*dt;p.vx*=1-dt*1.5;p.vz*=1-dt*1.5;}
    else if(p.type==='dust'||p.type==='smoke'){const k=Math.pow(.15,dt);p.vx*=k;p.vz*=k;p.vy*=k;if(p.type==='smoke')p.vy+=30*dt;}
    else if(p.type==='flame'){p.vy+=60*dt;}
    else if(p.type==='glow'){const k=Math.pow(.05,dt);p.vx*=k;p.vy*=k;p.vz*=k;}
  }
}

// ---------- audio ----------
let AC=null,noiseBuf=null,master=null;
function initAudio(){try{AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=.5*SETTINGS.fx/100;master.connect(AC.destination);
  noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}catch(e){AC=null;}}
function sfx(kind,at){
  if(!AC)return;let vol=1;
  if(at&&player){const d=Math.hypot(at.x-player.x,at.y-player.y,at.z-player.z);vol=clamp(1-d/1300,.06,1);}
  const t=AC.currentTime,g=AC.createGain();g.connect(master);
  const noise=(dur,f,q,type)=>{const s=AC.createBufferSource();s.buffer=noiseBuf;const fl=AC.createBiquadFilter();fl.type=type||'bandpass';fl.frequency.value=f;fl.Q.value=q||1;s.connect(fl);fl.connect(g);s.start(t,Math.random()*.5,dur);};
  const osc=(type,f0,f1,dur)=>{const o=AC.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);o.connect(g);o.start(t);o.stop(t+dur);};
  const env=(v,d)=>{g.gain.setValueAtTime(v*vol,t);g.gain.exponentialRampToValueAtTime(.001,t+d);};
  if(kind==='shot'){env(.35,.14);noise(.14,2000,.8);osc('square',200,55,.09);}
  else if(kind==='rocket'){g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.4*vol,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.7);noise(.7,700,.6);osc('sawtooth',90,180,.6);}
  else if(kind==='hit'){env(.25,.1);osc('square',900,200,.1);}
  else if(kind==='kick'){env(.8,.5);osc('sine',140,35,.5);noise(.2,400,1,'lowpass');}
  else if(kind==='rotate'){g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.6,t+.1);g.gain.exponentialRampToValueAtTime(.001,t+1.3);osc('sawtooth',55,26,1.3);noise(1.3,180,1,'lowpass');}
  else if(kind==='land'){env(.25,.12);noise(.12,300,1,'lowpass');}
  else if(kind==='thud'){env(.7,.35);osc('sine',90,30,.35);noise(.2,250,1,'lowpass');}
  else if(kind==='crate'){env(.4,.18);noise(.18,500,2);osc('triangle',160,60,.15);}
  else if(kind==='die'){env(.5,.6);osc('sawtooth',400,40,.6);}
  else if(kind==='reload'){env(.2,.08);osc('square',1400,900,.06);}
  else if(kind==='empty'){env(.12,.04);osc('square',2000,1800,.03);}
  else if(kind==='boom'){env(1,1.2);osc('sine',110,22,1.1);noise(1.1,500,.6,'lowpass');noise(.3,1800,.5);}
  else if(kind==='rifle'){env(.18,.3);noise(.12,3200,.45);osc('square',260,90,.07);}
  else if(kind==='shotgun'){env(.6,.35);noise(.35,900,.6,'lowpass');osc('square',140,40,.18);noise(.12,2500,.5);}
  else if(kind==='pickup'){env(.3,.25);osc('square',600,1200,.12);osc('sine',900,1800,.2);}
  else if(kind==='spider'){env(.25,.35);noise(.35,3200,2,'bandpass');osc('sawtooth',1300,500,.2);}
  else if(kind==='bite'){env(.55,.18);noise(.18,1800,1.5);osc('square',300,90,.12);}
  else if(kind==='splat'){env(.45,.3);noise(.3,700,.8,'lowpass');osc('sine',200,60,.2);}
  else if(kind==='swap'){env(.2,.12);osc('square',500,900,.05);noise(.06,3000,1);}
  else if(kind==='whoosh'){g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.25*vol,t+.12);g.gain.exponentialRampToValueAtTime(.001,t+.28);noise(.28,900,.7);}
  else if(kind==='cloak'){g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.12*vol,t+.15);g.gain.exponentialRampToValueAtTime(.001,t+.7);osc('sine',880,220,.7);}
  else if(kind==='heal'){env(.25,.35);osc('sine',520,1040,.3);}
  else if(kind==='ignite'){g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.35*vol,t+.05);g.gain.exponentialRampToValueAtTime(.001,t+.6);noise(.6,1200,.5,'highpass');}
}

// ---------- damage ----------
function damage(e,amt,src,dir){
  if(!e.alive||e.invuln>0||amt<=0)return;
  if(TUT.on&&TUT.cfg&&TUT.cfg.noDeath&&e===player)amt=Math.min(amt,e.hp-1);
  e.hp-=amt;e.flinch=1;reveal(e);
  if(src&&src!==e){e.lastHit=src;e.lastHitT=world.time;e.hitFrom={p:V(src.x,src.y,src.z),t:world.time};}
  if(e.hp<=0)kill(e,src,dir);
}
function kill(e,src,dir){
  e.alive=false;e.respawn=2.8;e.deaths++;
  let killer=src;
  if((!killer||killer===e)&&e.lastHit&&world.time-e.lastHitT<5)killer=e.lastHit;
  if(killer&&killer.isSpider){feed.unshift({t:4,text:`SPIDER ✕ ${e.name}`,color:'#e8ecf2'});}
  else if(killer&&killer!==e&&allied(killer,e)){killer.kills=Math.max(0,killer.kills-1);feed.unshift({t:4,text:`${killer.name} ✕ ${e.name}  TEAMKILL`,color:'#ff3f5a'});}
  else if(killer&&killer!==e){killer.kills++;feed.unshift({t:4,text:`${killer.name} ⌁ ${e.name}`,color:killer.color});}
  else{e.kills=Math.max(0,e.kills-1);feed.unshift({t:4,text:`${e.name} ✕ self-destructed`,color:'#888'});}
  // the special weapon in their hands stays where they fell
  {const dk=e.weapon==='shotgun'?'shotgun':e.weapon==='rifle'?'rifle':(e.weapon==='rocket'&&e.bigLauncher)?'launcher':null;
   if(dk&&!(TUT&&TUT.on)){const d=makeProp(e.x,e.y+8,e.z,dk);d.dropped=true;d.ttl=30;d.vy=140;d.vx=(rnd()-.5)*60;d.vz=(rnd()-.5)*60;props.push(d);}}
  if(e.gibbed){spawnGibs(e,dir);e.gibbed=false;}else if(!spawnCorpse(e,dir))makeDoll(e,dir);sfx('die',e);
  for(let i=0;i<30;i++)addPart(e.x,e.y+30,e.z,(rnd()-.5)*500,rnd()*300,(rnd()-.5)*500,.9,e.col,3,'spark');
  if(killer&&!killer.isSpider&&sideScore(killer)>=(world.fragLimit||FRAG_LIMIT)&&gameState==='play'){gameState='over';winner=killer;}
}

// ---------- rifle ----------
function fireRifle(e){
  e.aimT=1.6;
  if(e.weapon==='shotgun')return fireShotgun(e);
  if(e.weapon==='rifle')return fireAR(e);
  reveal(e);noise(e,900,e);
  const m=muzzleOf(e),tgt=e.aimPoint||vadd(headPos(e),vscale(fwdOf(e.yaw,e.pitch),1000));
  let d=vnorm(vsub(tgt,m));
  const spread=(.01+(e.bloom||0)+(Math.hypot(e.vx,e.vz)>60?.02:0)+(e.grounded?0:.03)+(e.isBot?.018:0)+(e.crouch?-.006:0))*(e.aiming?.5:1);
  d=vnorm(V(d.x+(rnd()-.5)*2*spread,d.y+(rnd()-.5)*2*spread,d.z+(rnd()-.5)*2*spread));
  let start=m;if(solid(tileAt(m.x,m.y,m.z)))start=headPos(e);
  bullets.push({x:start.x,y:start.y,z:start.z,vx:d.x*PISTOL_SPEED,vy:d.y*PISTOL_SPEED,vz:d.z*PISTOL_SPEED,owner:e,life:.6,life0:.6,dmg:DMG,head:HEAD_DMG,fall:0,col:e.col});
  e.fireCD=PISTOL_TAP_CD;e.ammo--;e.recoil=1;e.bloom=Math.min(.05,(e.bloom||0)+.012);
  for(let i=0;i<4;i++)addPart(m.x,m.y,m.z,d.x*200+(rnd()-.5)*150,d.y*200+(rnd()-.5)*150,d.z*200+(rnd()-.5)*150,.08,[1,.9,.6],9,'glow');
  sfx('shot',e);if(e===player)world.shake=Math.max(world.shake,1.5);
  if(e.ammo<=0)e.reload=RELOAD;
}
function fireAR(e){
  reveal(e);noise(e,950,e);
  const m=muzzleOf(e),tgt=e.aimPoint||vadd(headPos(e),vscale(fwdOf(e.yaw,e.pitch),1000));
  let d=vnorm(vsub(tgt,m));
  // tight first shots, the spray opens up the longer you hold the trigger
  const spread=(.008+(e.bloom||0)+(Math.hypot(e.vx,e.vz)>60?.018:0)+(e.grounded?0:.03)+(e.isBot?.016:0)+(e.crouch?-.005:0))*(e.aiming?.5:1);
  d=vnorm(V(d.x+(rnd()-.5)*2*spread,d.y+(rnd()-.5)*2*spread,d.z+(rnd()-.5)*2*spread));
  let start=m;if(solid(tileAt(m.x,m.y,m.z)))start=headPos(e);
  bullets.push({x:start.x,y:start.y,z:start.z,vx:d.x*PISTOL_SPEED,vy:d.y*PISTOL_SPEED,vz:d.z*PISTOL_SPEED,owner:e,life:.6,life0:.6,dmg:AR_DMG,head:AR_HEAD,fall:0,col:[.5,.95,1]});
  e.fireCD=AR_CD;e.ammo--;e.recoil=.7;e.bloom=Math.min(.055,(e.bloom||0)+.0065);
  for(let i=0;i<3;i++)addPart(m.x,m.y,m.z,d.x*220+(rnd()-.5)*150,d.y*220+(rnd()-.5)*150,d.z*220+(rnd()-.5)*150,.06,[.8,.95,1],8,'glow');
  sfx('rifle',e);if(e===player)world.shake=Math.max(world.shake,1.1);
  if(e.ammo<=0)e.reload=AR_RELOAD;
}
function fireShotgun(e){
  reveal(e);noise(e,1000,e);
  const m=muzzleOf(e),tgt=e.aimPoint||vadd(headPos(e),vscale(fwdOf(e.yaw,e.pitch),600));
  const base=vnorm(vsub(tgt,m));
  let start=m;if(solid(tileAt(m.x,m.y,m.z)))start=headPos(e);
  const life=SG_RANGE/BULLET_SPEED;
  for(let p=0;p<SG_PELLETS;p++){
    const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*SG_SPREAD;
    // spread in a cone around the aim direction
    const up=Math.abs(base.y)<.9?V(0,1,0):V(1,0,0),ax=vnorm(vcross(base,up)),ay=vcross(ax,base);
    const d=vnorm(vadd(base,vadd(vscale(ax,Math.cos(a)*r),vscale(ay,Math.sin(a)*r))));
    bullets.push({x:start.x,y:start.y,z:start.z,vx:d.x*BULLET_SPEED,vy:d.y*BULLET_SPEED,vz:d.z*BULLET_SPEED,owner:e,life,life0:life,dmg:SG_DMG,head:SG_DMG*1.4,fall:.55,col:[1,.62,.2],pellet:true});
  }
  e.fireCD=SG_CD;e.ammo--;e.recoil=1.8;
  for(let i=0;i<10;i++)addPart(m.x,m.y,m.z,base.x*260+(rnd()-.5)*220,base.y*260+(rnd()-.5)*220,base.z*260+(rnd()-.5)*220,.1,[1,.8,.45],12,'glow');
  for(let i=0;i<5;i++)addPart(m.x,m.y,m.z,base.x*80+(rnd()-.5)*60,base.y*80+30,base.z*80+(rnd()-.5)*60,.7,[.5,.48,.52],9,'smoke');
  sfx('shotgun',e);if(e===player)world.shake=Math.max(world.shake,4);
  if(e.ammo<=0)e.reload=SG_RELOAD;
}
function updateBullets(dt){
  for(let n=bullets.length-1;n>=0;n--){
    const b=bullets[n];b.life-=dt;
    const sp=Math.hypot(b.vx,b.vy,b.vz),dist=sp*dt,steps=Math.ceil(dist/8);
    const sx=b.vx*dt/steps,sy=b.vy*dt/steps,sz=b.vz*dt/steps;let dead=b.life<=0;
    for(let s=0;s<steps&&!dead;s++){
      b.x+=sx;b.y+=sy;b.z+=sz;
      if(solid(tileAt(b.x,b.y,b.z))){dead=true;sparkAt(b.x-sx,b.y-sy,b.z-sz,b.col);break;}
      for(const e of chars){
        if(e===b.owner||!e.alive)continue;
        if(Math.abs(b.x-e.x)<e.w/2+2&&Math.abs(b.z-e.z)<e.w/2+2&&b.y>e.y&&b.y<e.y+e.h){
          const head=b.y>e.y+e.h-12&&e.state!=='down';
          const fallK=1-b.fall*(1-Math.max(0,b.life)/b.life0);
          damage(e,(head?b.head:b.dmg)*fallK,b.owner,V(b.vx/sp,b.vy/sp,b.vz/sp));
          if(b.pellet){e.vx+=b.vx/sp*40;e.vz+=b.vz/sp*40;}
          for(let k=0;k<6;k++)addPart(b.x,b.y,b.z,b.vx*.1+(rnd()-.5)*200,(rnd()-.5)*200,b.vz*.1+(rnd()-.5)*200,.35,e.col,3,'spark');
          if(b.owner===player&&!(b.pellet&&player.hitMarker>.15)){sfx('hit');}if(b.owner===player)player.hitMarker=.18;
          dead=true;break;
        }
      }
      if(dead)break;
      {const dr=droneHit(b.x,b.y,b.z,13);if(dr){hitDrone(dr);if(b.owner===player)player.hitMarker=.18;dead=true;break;}}
      for(const sp2 of spiders){if(!sp2.alive||sp2.spawnT>0)continue;if(Math.hypot(b.x-sp2.p.x,b.y-sp2.p.y-4,b.z-sp2.p.z)<11){hurtSpider(sp2,b.dmg*(1-b.fall*(1-Math.max(0,b.life)/b.life0)),b.owner);if(b.owner===player)player.hitMarker=.18;dead=true;break;}}
      if(dead)break;
      for(const p of props){if(p.dead)continue;
        if(Math.abs(b.x-p.x)<p.w/2&&Math.abs(b.z-p.z)<p.d/2&&b.y>p.y&&b.y<p.y+p.h){
          p.vx+=b.vx/sp*60/p.m;p.vz+=b.vz/sp*60/p.m;p.vy+=30/p.m;if(p.rb)rbSpin(p,V(b.x,b.y,b.z),V(b.vx/sp*60,0,b.vz/sp*60));sparkAt(b.x,b.y,b.z,[1,.8,.2]);
          if(p.kind==='barrel')hurtBarrel(p,b.owner,1);dead=true;break;}}
    }
    if(dead)bullets.splice(n,1);
  }
}
function sparkAt(x,y,z,col){for(let k=0;k<5;k++)addPart(x,y,z,(rnd()-.5)*300,rnd()*220,(rnd()-.5)*300,.3,col,3,'spark');}

// ---------- rocket launcher ----------
// slow flare-rocket: leaves the tube slowly and accelerates, so you can fire at your feet and jump before it lands
function fireRocket(e){
  reveal(e);e.rArm=.55;e.rFireT=world.time;
  // the launcher tube sits over the shoulder: rockets leave from shoulder height, a little ahead
  const sh=V(e.x,e.y+e.h*.8,e.z),tgt=e.aimPoint||vadd(headPos(e),vscale(fwdOf(e.yaw,e.pitch),1000));
  const d=vnorm(vsub(tgt,sh));
  const m=vadd(sh,vscale(d,12));
  let start=m;if(solid(tileAt(m.x,m.y,m.z)))start=sh;
  const midAir=!e.grounded&&e.state==='normal'; // fired in mid-air (jump first, then shoot): no slow lob, the motor fires at once
  rockets.push({x:start.x,y:start.y,z:start.z,d,sp:midAir?ROCKET_VMAX*.8:ROCKET_V0,owner:e,life:5,age:midAir?ROCKET_LOB:0,born:world.time});noise(e,800,e);
  e.rfireCD=RFIRE_CD;e.rockets--;e.recoil=1.4;
  if(e.rockets<=0)e.rreload=e.bigLauncher?RRELOAD:RRELOAD_S;
  sfx('rocket',e);if(e===player)world.shake=Math.max(world.shake,3);
  for(let i=0;i<8;i++)addPart(start.x,start.y,start.z,-d.x*120+(rnd()-.5)*80,-d.y*120+(rnd()-.5)*80,-d.z*120+(rnd()-.5)*80,.5,[.6,.55,.6],8,'smoke');
}
// layered blast: light flash, white core, orange fireball, dark billows, sparks, slow embers, rising smoke,
// a dust ring along the surface, debris (barrel shards that burn / chunks of the wall), a scorch mark, and fire left burning after a barrel
function explosionFX(c,RAD,o){
  const vc=offSurface(c,26),n=vlen(vsub(vc,c))>1?vnorm(vsub(vc,c)):V(0,1,0),barrel=!!o.barrel;
  world.xflash={p:vc,r:RAD*3.4,col:barrel?[1,.55,.2]:[1,.66,.32],t:world.time,dur:barrel?.7:.5};
  const free=p=>solid(tileAt(p.x,p.y,p.z))?vc:p,sph=k=>{const a=rnd()*Math.PI*2,b=Math.asin(rnd()*2-1);return V(Math.cos(a)*Math.cos(b)*k,Math.sin(b)*k,Math.sin(a)*Math.cos(b)*k);};
  parts.push({x:vc.x,y:vc.y,z:vc.z,vx:0,vy:0,vz:0,life:.12,max:.12,col:[1,1,.9],size:RAD*1.1,type:'glow'});
  parts.push({x:vc.x,y:vc.y,z:vc.z,vx:0,vy:0,vz:0,life:.3,max:.3,col:[1,.7,.3],size:RAD*1.9,type:'glow'});
  parts.push({x:vc.x,y:vc.y,z:vc.z,vx:0,vy:0,vz:0,life:.55,max:.55,col:[.7,.2,.05],size:RAD*1.4,type:'glow'});
  addPart(vc.x,vc.y,vc.z,0,0,0,.45,[1,.55,.15],RAD/6,'ring');
  // fireball puffs pushed out of the centre
  for(let i=0;i<18;i++){const v=sph(90+rnd()*220),p=free(vadd(vc,vscale(v,.08)));addPart(p.x,p.y,p.z,v.x+n.x*60,v.y+n.y*60+40,v.z+n.z*60,.35+rnd()*.35,rnd()<.4?[1,.85,.4]:rnd()<.5?[1,.5,.12]:[.9,.25,.05],20+rnd()*18,'flame');}
  for(let i=0;i<50;i++){const v=sph(140+rnd()*560);addPart(vc.x,vc.y,vc.z,v.x+n.x*120,v.y+n.y*120+100,v.z+n.z*120,.35+rnd()*.5,rnd()<.5?[1,.8,.2]:[1,.35,.1],3,'spark');}
  for(let i=0;i<24;i++){const v=sph(60+rnd()*260);addPart(vc.x,vc.y,vc.z,v.x+n.x*80,v.y+n.y*80+140,v.z+n.z*80,1.4+rnd()*1.6,rnd()<.5?[1,.6,.15]:[1,.35,.08],2.2+rnd()*1.5,'ember');}
  // smoke: dark billows that roll up and spread
  for(let i=0;i<30;i++){const p=free(vadd(vc,sph(10+rnd()*40)));const v=sph(40+rnd()*110);
    addPart(p.x,p.y,p.z,v.x+n.x*50,Math.abs(v.y)*.5+50+rnd()*70,v.z+n.z*50,1.6+rnd()*2.2,barrel?[.1,.08,.09]:[.2,.17,.22],18+rnd()*20,'smoke');}
  // dust ring along the surface it hit
  {const t1=vlen(vcross(n,V(0,1,0)))>.1?vnorm(vcross(n,V(0,1,0))):V(1,0,0),t2=vcross(n,t1);
   for(let i=0;i<26;i++){const a=i/26*Math.PI*2,d=vadd(vscale(t1,Math.cos(a)),vscale(t2,Math.sin(a))),sp=260+rnd()*160,p=vadd(c,vscale(n,4));
     addPart(p.x,p.y,p.z,d.x*sp,d.y*sp+20,d.z*sp,.6+rnd()*.4,[.5,.52,.6],10+rnd()*8,'dust');}}
  // scorch on the surface
  {const p=offSurface(c,1.5);if(vlen(vsub(p,c))>.5)parts.push({x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:0,life:10,max:10,col:[.02,.015,.02],size:RAD*.55,type:'scorch'});}
  // debris: torn barrel shell that burns, or chips of the wall/floor
  const dc=barrel?o.barrel.col:[.3,.32,.4];
  for(let i=0;i<(barrel?9:6);i++){const v=vadd(sph(160+rnd()*280),vscale(n,220)),p=free(vadd(vc,sph(8)));
    const g={x:p.x,y:p.y,z:p.z,vx:v.x,vy:v.y+120,vz:v.z,m:.4,col:barrel&&rnd()<.3?[1,.8,.2]:dc,dark:dc.map(x=>x*.5),glow:[1,.5,.15],kind:'shard',life:3+rnd()*2.5,bleed:0,burn:barrel&&rnd()<.5?1.2+rnd()*1.5:0};
    rbSetup(g,barrel?3+rnd()*5:2+rnd()*3,barrel?.7+rnd()*.6:1.5+rnd()*2,barrel?2+rnd()*4:2+rnd()*3,qaxis(vnorm(sph(1)),rnd()*6));g.y=p.y;g.av=sph(10+rnd()*14);gibs.push(g);}
  if(gibs.length>90)gibs.splice(0,gibs.length-90);
  if(barrel){const f=world.fires||(world.fires=[]);const p=offSurface(c,2);f.push({x:p.x,y:p.y,z:p.z,t:0,dur:3+rnd()*1.5,n});}
}
function updateFires(dt){
  const f=world.fires;if(!f)return;
  for(let i=f.length-1;i>=0;i--){const q=f[i];q.t+=dt;if(q.t>q.dur){f.splice(i,1);continue;}const k=1-q.t/q.dur;
    if(rnd()<dt*45*k)addPart(q.x+(rnd()-.5)*26,q.y+(rnd()-.5)*6,q.z+(rnd()-.5)*26,(rnd()-.5)*30+q.n.x*60,40+rnd()*70+q.n.y*40,(rnd()-.5)*30+q.n.z*60,.5,rnd()<.5?[1,.75,.2]:[1,.35,.08],9+rnd()*8,'flame');
    if(rnd()<dt*8*k)addPart(q.x,q.y+10,q.z,(rnd()-.5)*30,50+rnd()*50,(rnd()-.5)*30,1.8,[.1,.08,.09],14,'smoke');}
}
function updateRockets(dt){
  for(let n=rockets.length-1;n>=0;n--){
    const r=rockets[n];r.life-=dt;r.age+=dt;
    if(r.age>ROCKET_LOB)r.sp=Math.min(ROCKET_VMAX,r.sp+ROCKET_ACC*dt); // short slow 'lob', then the motor kicks in
    const dist=r.sp*dt,steps=Math.max(1,Math.ceil(dist/5));let boom=r.life<=0;
    for(let s=0;s<steps&&!boom;s++){
      r.x+=r.d.x*dist/steps;r.y+=r.d.y*dist/steps;r.z+=r.d.z*dist/steps;
      if(solid(tileAt(r.x,r.y,r.z))){r.x-=r.d.x*4;r.y-=r.d.y*4;r.z-=r.d.z*4;boom=true;break;}
      for(const e of chars){if(e===r.owner||!e.alive)continue;
        if(Math.abs(r.x-e.x)<e.w/2+4&&Math.abs(r.z-e.z)<e.w/2+4&&r.y>e.y-2&&r.y<e.y+e.h+2){boom=true;r.hit=e;break;}}
      if(boom)break;
      if(droneHit(r.x,r.y,r.z,16)){boom=true;break;}
      for(const sp2 of spiders){if(sp2.alive&&Math.hypot(r.x-sp2.p.x,r.y-sp2.p.y,r.z-sp2.p.z)<14){boom=true;break;}}
      if(boom)break;
      for(const p of props){if(p.dead)continue;if(Math.abs(r.x-p.x)<p.w/2+3&&Math.abs(r.z-p.z)<p.d/2+3&&r.y>p.y-2&&r.y<p.y+p.h+2){boom=true;break;}}
    }
    // flare + smoke trail
    if(rnd()<dt*60)addPart(r.x,r.y,r.z,(rnd()-.5)*30,(rnd()-.5)*30,(rnd()-.5)*30,.9,[.5,.45,.55],9,'smoke');
    addPart(r.x-r.d.x*4,r.y-r.d.y*4,r.z-r.d.z*4,-r.d.x*60+(rnd()-.5)*40,-r.d.y*60+(rnd()-.5)*40,-r.d.z*60+(rnd()-.5)*40,.25,rnd()<.5?[1,.6,.15]:[1,.85,.4],8,'flame');
    if(boom){rockets.splice(n,1);explode(V(r.x,r.y,r.z),{radius:ROCKET_R,dmg:ROCKET_DMG,push:ROCKET_PUSH,src:r.owner,rocket:true,direct:r.hit||null,born:r.born});}
  }
}
// explosion: area push + damage. Airborne targets are thrown much harder but hurt less; your own blast hurts you a third as much.
function explode(c,o){
  const RAD=o.radius,src=o.src||null;
  for(const e of chars){
    if(!e.alive)continue;
    const direct=o.direct===e;
    const ctr=V(e.x,e.y+e.h*.5,e.z),d=direct?0:Math.max(0,vlen(vsub(ctr,c))-10);if(d>RAD+e.h*.3)continue;
    // line of sight to feet, centre or head
    if(!direct&&!losClear(c,ctr)&&!losClear(c,V(e.x,e.y+4,e.z))&&!losClear(c,V(e.x,e.y+e.h-4,e.z)))continue;
    const f=direct?1:clamp(1-d/RAD,0,1);if(f<=0)continue;
    const air=!e.grounded&&e.state!=='down';
    let dir=vnorm(vsub(ctr,c));if(d<6)dir=V(0,1,0);
    dir=vnorm(V(dir.x,dir.y+.35,dir.z)); // explosions lift
    if(e===src&&o.rocket&&e.state!=='down'){rocketJump(e,c,f,air,dir,o.born);continue;}
    const push=o.push*f*(air?AIR_PUSH:GROUND_PUSH);
    const dmg=direct?999:o.dmg*f*(air?AIR_DMG:1);
    if(direct)e.gibbed=true;
    damage(e,dmg,e===src?null:src,dir);
    if(!e.alive)continue;
    e.gibbed=false;
    if(e.state==='hang'||e.state==='climbup'||e.state==='kick'||e.state==='slide'||e.state==='getup'){e.state='normal';e.h=STAND_H;}
    if(e.crouch&&!overlapSolid(e.x,e.y,e.z,e.w,STAND_H)){e.crouch=false;e.h=STAND_H;}
    if(e.state==='down'){e.vx+=dir.x*push*.6;e.vy=Math.max(e.vy,dir.y*push*.5);e.vz+=dir.z*push*.6;e.grounded=false;}
    else{
      e.vx+=dir.x*push;e.vz+=dir.z*push;e.vy=Math.min(Math.max(e.vy,0)*.4+dir.y*push,940);
      {const hs=Math.hypot(e.vx,e.vz);if(hs>1150){e.vx*=1150/hs;e.vz*=1150/hs;}}
      e.grounded=false;e.coyote=0;e.y+=2;if(overlapSolid(e.x,e.y,e.z,e.w,e.h))e.y-=2;
      if(push>380){e.knocked=true;e.stun=.45;e.bav=10*f;e.tumbleHold=0;}
    }
  }
  for(const dr of drones)if(dr.alive&&dr.delay<=0&&vlen(vsub(dr.p,c))<RAD*.85)hitDrone(dr);
  for(const sp2 of spiders){if(!sp2.alive)continue;const d=vlen(vsub(sp2.p,c));if(d<RAD)hurtSpider(sp2,o.dmg*(1-d/RAD)*1.3,src);}
  for(const p of props){
    if(p.dead)continue;
    const pc=V(p.x,p.y+p.h/2,p.z),d=vlen(vsub(pc,c));if(d>RAD*1.1)continue;
    const f=1-d/(RAD*1.1);
    if(p.kind==='barrel'){p.lastHitBy=src;p.hits=3;p.fuse=Math.min(p.fuse===undefined?99:p.fuse,.12+rnd()*.12);continue;}
    const dir=vnorm(V(pc.x-c.x,pc.y-c.y+20,pc.z-c.z));
    const pk=o.push*f*.6/Math.pow(Math.max(p.m,1),.6);p.vx+=dir.x*pk;p.vy+=dir.y*pk;p.vz+=dir.z*pk;{const s=Math.hypot(p.vx,p.vy,p.vz);if(s>560){p.vx*=560/s;p.vy*=560/s;p.vz*=560/s;}}p.grounded=false;p.kickedBy=src;p.kickT=world.time;
    if(p.rb){const hp=V(clamp(c.x,p.x-p.w/2,p.x+p.w/2),clamp(c.y,p.y,p.y+p.h),clamp(c.z,p.z-p.d/2,p.z+p.d/2));rbSpin(p,hp,vscale(dir,pk*p.m),.45);p.av=vadd(p.av,V((rnd()-.5)*f,(rnd()-.5)*f,(rnd()-.5)*f));}
  }
  explosionFX(c,RAD,o);
  sfx('boom',c);noise(c,1300,src);
  if(player){const d=Math.hypot(player.x-c.x,player.y-c.y,player.z-c.z);if(d<900)world.shake=Math.max(world.shake,14*(1-d/900)+2);}
}

// ---------- props: crates, barrels, containers, medkits ----------
const KINDS={
  crate:{w:26,h:26,d:26,m:1,col:'#6b4a1c',edge:'#ffb020'},small:{w:18,h:18,d:18,m:.6,col:'#5e4018',edge:'#d98f2b'},
  big:{w:42,h:38,d:42,m:2.6,col:'#202842',edge:'#5a6a99'},barrel:{w:22,h:30,d:22,m:1.4,col:'#b4381f',edge:'#ffcc33'},
  container:{w:72,h:34,d:34,m:5,col:'#16424d',edge:'#29f0ff'},medkit:{w:24,h:18,d:24,m:.5,col:'#e9f1ff',edge:'#1fd16b'},
  shotgun:{w:26,h:14,d:26,m:.5,col:'#1b2030',edge:'#ff8a2a'},
  rifle:{w:26,h:14,d:26,m:.5,col:'#1b2030',edge:'#7cf0ff'},
  launcher:{w:26,h:14,d:26,m:.5,col:'#1b2030',edge:'#ff5a3c'},
  // taller pieces that break up long sight lines
  locker:{w:22,h:62,d:18,m:1.8,col:'#2c3550',edge:'#29f0ff'},
  stack:{w:40,h:66,d:40,m:3.5,col:'#4a3418',edge:'#ffb020'},
  pallet:{w:44,h:50,d:36,m:3,col:'#3a4a58',edge:'#8fb4d9'},
  rack:{w:26,h:60,d:26,m:2.2,col:'#141a2a',edge:'#3dff7a'},
  tallcrate:{w:30,h:64,d:30,m:2.4,col:'#5e4220',edge:'#d98f2b'},
  barrier:{w:64,h:28,d:16,m:4,col:'#5b6170',edge:'#ffcc33'},
  spool:{w:36,h:36,d:26,m:2,col:'#4f3519',edge:'#ff8a2a'}
};
function makeProp(x,y,z,kind,rot){
  const k=KINDS[kind];let w=k.w,d=k.d;if(rot){const t=w;w=d;d=t;}
  const b={kind,x,y,z,w,h:k.h,d,m:k.m,vx:0,vy:0,vz:0,grounded:false,dead:false,col:hexRGB(k.col),edge:hexRGB(k.edge),kickedBy:null,kickT:-99};
  if(kind!=='shotgun'&&kind!=='rifle'&&kind!=='launcher')rbSetup(b,k.w,k.h,k.d,rot?qaxis(V(0,1,0),Math.PI/2):qIdent());
  return b;
}
function hurtBarrel(b,src,n){
  if(b.dead)return;if(src)b.lastHitBy=src;
  b.hits=(b.hits||0)+n;const cur=b.fuse===undefined?99:b.fuse;
  if(b.hits>=3)b.fuse=Math.min(cur,.05);else if(b.hits===2){b.fuse=Math.min(cur,3);sfx('ignite',b);}else b.fuse=Math.min(cur,8);
}
function updateProps(dt){
  for(const b of props){
    if(b.dead)continue;
    if(b.ttl!==undefined){b.ttl-=dt;if(b.ttl<=0){b.dead=true;continue;}} // dropped weapons vanish after a while
    if(b.fuse!==undefined){b.fuse-=dt;if(b.fuse<=0){b.dead=true;explode(V(b.x,b.y+b.h/2,b.z),{radius:125,dmg:80,push:520,src:b.lastHitBy,barrel:b});world.barrelQ.push(world.time+22+rnd()*10);continue;}}
    if(b.kind==='barrel'&&b.hits){
      if(rnd()<dt*(b.hits>=2?10:7))addPart(b.x+(rnd()-.5)*10,b.y+b.h,b.z+(rnd()-.5)*10,(rnd()-.5)*30,50+rnd()*60,(rnd()-.5)*30,1.2,b.hits>=2?[.16,.14,.16]:[.35,.35,.4],10,'smoke');
      if(b.hits>=2&&rnd()<dt*50)addPart(b.x+(rnd()-.5)*b.w*.8,b.y+b.h,b.z+(rnd()-.5)*b.w*.8,(rnd()-.5)*40,90+rnd()*90,(rnd()-.5)*40,.45,rnd()<.5?[1,.8,.2]:[1,.35,.1],9,'flame');
    }
    if(b.rb){ // tumbling box
      let imp=0,gr=false;const many=b.W>40||b.H>40||b.D>40;
      for(let s=0;s<2;s++){const r=rbStep(b,dt/2,b.cyl?RB_CYL:many?RB_ALL:RB_LIGHT);imp=Math.max(imp,r.imp);gr=gr||r.ground;}
      b.propSupport=false;b.grounded=gr;
      if(imp>320){sfx('crate',b);for(let i=0;i<5;i++)addPart(b.x+(rnd()-.5)*b.w,b.y,b.z+(rnd()-.5)*b.d,(rnd()-.5)*150,rnd()*80,(rnd()-.5)*150,.35,[.48,.52,.63],6,'dust');
        if(b.kind==='barrel'&&imp>700)hurtBarrel(b,(world.time-b.kickT<4&&b.kickedBy)||(world.time-world.lastKickT<6?world.lastKicker:null),1);}
      continue;
    }
    const pv=b.vy;
    b.vy=Math.max(b.vy-G*dt,-MAXFALL);
    const landed=moveBody(b,dt);
    if(landed){
      if(pv<-320){sfx('crate',b);for(let i=0;i<5;i++)addPart(b.x+(rnd()-.5)*b.w,b.y,b.z+(rnd()-.5)*b.d,(rnd()-.5)*150,rnd()*80,(rnd()-.5)*150,.35,[.48,.52,.63],6,'dust');
        if(pv<-550)b.vy=-pv*.16;
        if(b.kind==='barrel'&&pv<-700)hurtBarrel(b,(world.time-b.kickT<4&&b.kickedBy)||(world.time-world.lastKickT<6?world.lastKicker:null),1);}
    }
    if(b.hitX)b.vx*=-.2;if(b.hitZ)b.vz*=-.2;
    b.grounded=landed||groundProbe(b);
    if(b.grounded){const k=Math.pow(.02/Math.min(b.m,2),dt);b.vx*=k;b.vz*=k;}
  }
  // prop vs prop
  for(let i=0;i<props.length;i++)for(let j=i+1;j<props.length;j++){
    const a=props[i],b=props[j];if(a.dead||b.dead)continue;
    const ox=Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2);
    const oz=Math.min(a.z+a.d/2,b.z+b.d/2)-Math.max(a.z-a.d/2,b.z-b.d/2);
    const oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    if(ox<=0||oy<=0||oz<=0)continue;
    if(oy<ox&&oy<oz){const top=a.y>b.y?a:b,bot=top===a?b:a;top.y+=oy;if(top.vy<bot.vy){top.vy=bot.vy*.5;}top.grounded=true;top.propSupport=true;top.vx*=.9;top.vz*=.9;if(top.rb)top.av=vscale(top.av,.9);}
    else if(ox<oz){const s=Math.sign(b.x-a.x)||1,tm=a.m+b.m;a.x-=s*ox*b.m/tm;b.x+=s*ox*a.m/tm;const v=(a.vx*a.m+b.vx*b.m)/tm;a.vx=v;b.vx=v;}
    else{const s=Math.sign(b.z-a.z)||1,tm=a.m+b.m;a.z-=s*oz*b.m/tm;b.z+=s*oz*a.m/tm;const v=(a.vz*a.m+b.vz*b.m)/tm;a.vz=v;b.vz=v;}
  }
  for(const b of props)if(!b.dead&&(b.rb?solid(tileAt(b.x,b.y+b.h/2,b.z)):overlapSolid(b.x,b.y,b.z,b.w,b.h,b.d)))pushOut(b);
}
// characters vs props: stand on them, push them, get crushed, pick up medkits
function charProps(e){
  if(!e.alive||e.state==='climbup'||e.state==='hang')return;
  for(const b of props){
    if(b.dead)continue;
    const ox=Math.min(e.x+e.w/2,b.x+b.w/2)-Math.max(e.x-e.w/2,b.x-b.w/2);
    const oz=Math.min(e.z+e.w/2,b.z+b.d/2)-Math.max(e.z-e.w/2,b.z-b.d/2);
    const oy=Math.min(e.y+e.h,b.y+b.h)-Math.max(e.y,b.y);
    if(ox<=0||oy<=0||oz<=0)continue;
    if(b.kind==='launcher'){
      if(e.state!=='down'){
        e.bigLauncher=true;e.rockets=RMAG;e.rreload=0;e.rrl=null;
        b.dead=true;sfx('pickup',b);if(!b.dropped)world.lnQ.push(world.time+25);
        if(e===player)feed.unshift({t:3,text:'YOU PICKED UP THE BIG LAUNCHER — 3 ROCKETS',color:'#ff5a3c'});
        for(let i=0;i<14;i++)addPart(b.x,b.y+8,b.z,(rnd()-.5)*160,rnd()*200,(rnd()-.5)*160,.5,[1,.4,.2],3,'spark');
      }
    }else if(b.kind==='rifle'){
      if(e.state!=='down'){
        const had=e.hasRifle;
        if(!had){e.hasRifle=true;e.stash[e.weapon]=e.ammo;e.weapon='rifle';e.ammo=AR_MAG;e.reload=0;}
        else if(e.weapon==='rifle'){e.ammo=AR_MAG;e.reload=0;}else e.stash.rifle=AR_MAG;
        b.dead=true;sfx('pickup',b);
        if(!b.dropped)world.arQ.push(world.time+40);
        if(e===player)feed.unshift({t:3,text:had?'RIFLE AMMO REFILLED':'YOU PICKED UP A RIFLE',color:'#7cf0ff'});
        for(let i=0;i<14;i++)addPart(b.x,b.y+8,b.z,(rnd()-.5)*160,rnd()*200,(rnd()-.5)*160,.5,[.5,.95,1],3,'spark');
      }
    }else if(b.kind==='shotgun'){
      if(e.state!=='down'){
        const had=e.hasShotgun;
        if(!had){e.hasShotgun=true;e.stash[e.weapon]=e.ammo;e.weapon='shotgun';e.ammo=SG_MAG;e.reload=0;}
        else if(e.weapon==='shotgun'){e.ammo=SG_MAG;e.reload=0;}else e.stash.shotgun=SG_MAG;
        b.dead=true;sfx('pickup',b);
        if(!b.dropped)world.sgQ.push(world.time+30);
        if(e===player)feed.unshift({t:3,text:had?'SHOTGUN SHELLS REFILLED':'YOU PICKED UP A SHOTGUN',color:'#ff8a2a'});
        for(let i=0;i<14;i++)addPart(b.x,b.y+8,b.z,(rnd()-.5)*160,rnd()*200,(rnd()-.5)*160,.5,[1,.55,.15],3,'spark');
      }
      continue;
    }
    if(b.kind==='medkit'){
      if(e.hp<100&&e.state!=='down'){e.hp=Math.min(100,e.hp+50);b.dead=true;sfx('heal',b);
        for(let i=0;i<16;i++)addPart(b.x,b.y+9,b.z,(rnd()-.5)*160,rnd()*220,(rnd()-.5)*160,.6,[.36,1,.6],3,'spark');}
      continue;
    }
    if(oy<Math.min(ox,oz)||b.vy<-300){
      if(e.y+e.h/2>b.y+b.h/2){ // on top
        if(overlapSolid(e.x,e.y+oy,e.z,e.w,e.h)){const s=Math.sign(b.x-e.x)||1;b.x+=s*(ox+1);if(overlapSolid(b.x,b.y,b.z,b.w,b.h,b.d))b.x-=2*s*(ox+1);continue;}
        e.boxSupport=true;
        if(e.vy<=0){e.y+=oy;e.vy=0;if(!e.grounded)e.land=.3;e.grounded=true;e.coyote=.1;}else e.y+=oy;
      }else{ // box landing on someone
        if(b.vy<-360){
          const kk=(world.time-b.kickT<4&&b.kickedBy)||(world.time-world.lastKickT<6?world.lastKicker:null);
          damage(e,Math.min(90,(-b.vy-280)*.07*Math.sqrt(b.m)),kk&&kk!==e?kk:null,V(0,-1,0));sfx('crate',b);
          if(e.alive&&b.m>=1.4&&e.state==='normal'&&e.grounded)enterDown(e,.4);
        }
        const by0=b.y;b.y=e.y+e.h;if(overlapSolid(b.x,b.y,b.z,b.w,b.h,b.d)){b.y=by0;}
        b.vy=Math.abs(b.vy)*.2;b.vx+=(b.x>e.x?1:-1)*120/b.m;
      }
    }else{
      const share=clamp(.45/b.m,.08,.5);
      if(ox<oz){const s=Math.sign(b.x-e.x)||1,bx0=b.x,ex0=e.x;b.x+=s*ox*share;if(overlapSolid(b.x,b.y,b.z,b.w,b.h,b.d)){b.x=bx0;e.x-=s*ox;}else e.x-=s*ox*(1-share);
        if(overlapSolid(e.x,e.y,e.z,e.w,e.h)){e.x=ex0;}
        if(e.vx*s>0){const dv=s*Math.max(Math.abs(e.vx)*.9/Math.sqrt(b.m),25)-b.vx;b.vx+=dv;if(b.rb)rbSpin(b,V(b.x-s*b.w/2,Math.min(e.y+34,b.y+b.h*.9),b.z),V(dv*b.m*.35,0,0));if(b.m>2)e.vx*=.6;}}
      else{const s=Math.sign(b.z-e.z)||1,bz0=b.z,ez0=e.z;b.z+=s*oz*share;if(overlapSolid(b.x,b.y,b.z,b.w,b.h,b.d)){b.z=bz0;e.z-=s*oz;}else e.z-=s*oz*(1-share);
        if(overlapSolid(e.x,e.y,e.z,e.w,e.h)){e.z=ez0;}
        if(e.vz*s>0){const dv=s*Math.max(Math.abs(e.vz)*.9/Math.sqrt(b.m),25)-b.vz;b.vz+=dv;if(b.rb)rbSpin(b,V(b.x,Math.min(e.y+34,b.y+b.h*.9),b.z-s*b.d/2),V(0,0,dv*b.m*.35));if(b.m>2)e.vz*=.6;}}
    }
  }
}
function spawnFurniture(){
  const pts=spawnPoints();
  const want=['container','container','big','big','big','barrel','barrel','barrel','barrel','barrel','barrel','crate','crate','crate','crate','crate','crate','small','small','small','small',
    'locker','locker','locker','locker','stack','stack','stack','pallet','pallet','pallet','rack','rack','rack','tallcrate','tallcrate','tallcrate','barrier','barrier','barrier','spool','spool'];
  for(const kind of want){
    const k=KINDS[kind];
    for(let tr=0;tr<40;tr++){
      const p=pts[rnd()*pts.length|0];if(!p)break;
      const rot=rnd()<.5,w=rot?k.d:k.w,d=rot?k.w:k.d;
      const x=p.x+(rnd()-.5)*8,z=p.z+(rnd()-.5)*8,y=p.y;
      if(overlapSolid(x,y,z,w,k.h,d))continue;
      if(!overlapSolid(x,y-4,z,w-6,3,d-6))continue; // needs a floor under it
      if(props.some(o=>Math.abs(o.x-x)<(o.w+w)/2+4&&Math.abs(o.z-z)<(o.d+d)/2+4&&Math.abs(o.y-y)<40))continue;
      props.push(makeProp(x,y,z,kind,rot));
      if(kind==='crate'&&rnd()<.4)props.push(makeProp(x,y+26,z,'small'));
      break;
    }
  }
}
function spawnDrop(kind){
  const pts=spawnPoints(),k=KINDS[kind];
  for(let tr=0;tr<30;tr++){
    const p=pts[rnd()*pts.length|0];if(!p)return;
    const y=p.y+2*T;
    if(overlapSolid(p.x,y,p.z,k.w,k.h,k.d)||overlapSolid(p.x,p.y,p.z,k.w,k.h,k.d))continue;
    if(chars.some(c=>c.alive&&Math.hypot(c.x-p.x,c.y-p.y,c.z-p.z)<140))continue;
    props.push(makeProp(p.x,y,p.z,kind));
    addPart(p.x,y,p.z,0,0,0,.6,kind==='medkit'?[.36,1,.6]:[1,.55,.15],40,'ring');
    return;
  }
}
// floating weapon pickups: drawn bigger than in the hands, with a halo and a light beam (see render)
const PICKUP_S=2.5,PICKUP_GLOW={shotgun:[1,.55,.2],launcher:[1,.35,.15],rifle:[.45,.9,1]};
function drawPickupModel(b){
  const yaw=world.time*.7+b.x*.01,bob=Math.sin(world.time*1.8+b.z*.01)*1.5,u=V(Math.sin(yaw),0,Math.cos(yaw)),v=V(0,1,0),gc=PICKUP_GLOW[b.kind];
  if(b.kind==='shotgun')drawShotgunModel({o:vsub(V(b.x,b.y+9+bob,b.z),vscale(u,5)),u,v,w:vcross(u,v)},gc,1,0);
  else if(b.kind==='launcher'){ // the same wrist launcher you wear, on its gauntlet sleeve (the arm it straps to is missing)
    const c=V(b.x,b.y+8+bob,b.z),eb=vsub(c,vscale(u,7)),hn=vadd(c,vscale(u,7)),SL=hexRGB('#1b1f2b');
    drawTube(vadd(eb,vscale(u,1.2)),vadd(eb,vscale(u,11.4)),1.55,SL,null,1);                   // sleeve
    drawTube(vadd(eb,vscale(u,.4)),vadd(eb,vscale(u,1.4)),1.85,hexRGB('#262b3a'),null,1);       // cuff rim
    drawTube(vadd(eb,vscale(u,10.9)),vadd(eb,vscale(u,12.1)),1.75,hexRGB('#262b3a'),null,1);
    drawTube(vadd(eb,vscale(u,5.6)),vadd(eb,vscale(u,6.4)),1.62,gc,gc,1);                        // lit band in the pickup colour
    drawLauncherModel({bigLauncher:true,rockets:RMAG,rreload:0,bodyYaw:yaw},eb,hn,V(0,1,0),gc,1);}
  else drawRifleModel({o:vsub(V(b.x,b.y+9+bob,b.z),vscale(u,4)),u,v,w:vcross(u,v)},gc,1,0);
}
function pickupGlows(add){
  for(const b of props){if(b.dead||b.rb||!PICKUP_GLOW[b.kind])continue;const g=PICKUP_GLOW[b.kind],pl=.75+.25*Math.sin(world.time*3+b.x*.02),cy=b.y+17;
    add.push({x:b.x,y:cy,z:b.z,r:g[0],g:g[1],b:g[2],a:.42*pl,s:46*PICKUP_S});
    add.push({x:b.x,y:cy,z:b.z,r:1,g:1,b:1,a:.18*pl,s:16*PICKUP_S});
    add.push({x:b.x,y:b.y+2,z:b.z,r:g[0],g:g[1],b:g[2],a:.5*pl,s:30*PICKUP_S});
    for(let i=1;i<=7;i++)add.push({x:b.x,y:b.y+i*22,z:b.z,r:g[0],g:g[1],b:g[2],a:.22*pl*(1-i/8),s:14});}
}
function drawProp(b){
  if(b.dead)return;
  if(!b.rb){ // pickups stay upright
    const c=V(b.x,b.y+b.h/2,b.z);
    if(PICKUP_GLOW[b.kind]){WXF=scaleAbout(V(b.x,b.y+(b.kind==='launcher'?10:9),b.z),PICKUP_S);WXF=M4.mul(M4.basis(V(0,8,0),V(1,0,0),V(0,1,0),V(0,0,1)),WXF);try{drawPickupModel(b);}finally{WXF=null;}return;}
    if(b.kind==='shotgun'){
      const pl=.6+.4*Math.sin(world.time*4);
      const yaw=world.time*.7+b.x*.01,hy=b.y+9+Math.sin(world.time*1.8+b.z*.01)*1.5,u=V(Math.sin(yaw),0,Math.cos(yaw)),v=V(0,1,0);
      drawShotgunModel({o:vsub(V(b.x,hy,b.z),vscale(u,5)),u,v,w:vcross(u,v)},[1,.55,.2],1,0);
    }else if(b.kind==='launcher'){
      const pl=.6+.4*Math.sin(world.time*4);
      const yaw=world.time*.7+b.x*.01,hy=b.y+10+Math.sin(world.time*1.8+b.z*.01)*1.5,u=V(Math.sin(yaw),0,Math.cos(yaw)),c=V(b.x,hy,b.z);
      drawLauncherModel({bigLauncher:true,rockets:RMAG,rreload:0,bodyYaw:yaw},vsub(c,vscale(u,7)),vadd(c,vscale(u,7)),V(0,1,0),[1,.4,.2],1);
    }else if(b.kind==='rifle'){
      const pl=.6+.4*Math.sin(world.time*4);
      const yaw=world.time*.7+b.x*.01,hy=b.y+9+Math.sin(world.time*1.8+b.z*.01)*1.5,u=V(Math.sin(yaw),0,Math.cos(yaw)),v=V(0,1,0);
      drawRifleModel({o:vsub(V(b.x,hy,b.z),vscale(u,4)),u,v,w:vcross(u,v)},[.5,.95,1],1,0);
    }else drawBox(c,b.w,b.h,b.d,b.col,null,b.edge);
    return;
  }
  const gl=R.gl,W=b.W,H=b.H,D=b.D;
  // the body is pushed back a hair in depth so the bands and labels on it never fight with it (no flicker)
  gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.5,3);
  let em=null;
  if(b.kind==='barrel'){if(b.hits>=2)em=[.4*(.6+.4*Math.sin(world.time*25)),.12,0];if(b.fuse!==undefined&&b.fuse<1.5&&Math.sin(world.time*(b.fuse<.6?22:10))>0)em=[.8,.75,.5];}
  if(b.kind==='pallet')em=[.02,.03,.05];
  if(b.kind==='medkit'){const pl=.6+.4*Math.sin(world.time*6);em=[.1*pl,.25*pl,.12*pl];}
  rbDraw(b,V(0,0,0),V(W,H,D),b.kind==='spool'?hexRGB('#2a1c0e'):b.col,em,b.kind==='spool'?null:b.edge);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  drawPropDetail(b,W,H,D);
}
// a round barrel: a 12-sided drum (three boxes turned 30° apart), rolling hoops, hazard bands, lid rim and a hazard plate
function rbDrawRotY(b,lc,ls,ry,col,em,al){const q=qmul(b.q,qaxis(V(0,1,0),ry)),C=rbCols(q),c=vadd(V(b.x,b.y+b.h/2,b.z),vadd(vadd(vscale(C[0],lc.x),vscale(C[1],lc.y)),vscale(C[2],lc.z)));
  drawCubeM(M4.basis(c,vscale(C[0],ls.x),vscale(C[1],ls.y),vscale(C[2],ls.z)),col,em,null,al);}
function drumAt(b,y,h,r,col,em){for(const a of [0,Math.PI/6,Math.PI/3])rbDrawRotY(b,V(0,y,0),V(r*1.93,h,r*1.93),a,col,em);}
function drawBarrel(b,em){
  const gl=R.gl,H=b.H,r=b.W/2,dark=b.col.map(v=>v*.55);
  drumAt(b,0,H,r,b.col,em);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  for(const y of [-.22,.22])drumAt(b,y*H,1.6,r+.55,dark,null);                    // rolling hoops
  const yel=hexRGB('#ffcc33');for(const y of [-.36,.36])drumAt(b,y*H,3,r+.3,yel,[.3,.22,0]); // hazard bands
  drumAt(b,H/2-.5,1.1,r+.35,hexRGB('#2a2a30'),null);drumAt(b,-H/2+.5,1.1,r+.35,hexRGB('#2a2a30'),null); // rims
  rbDraw(b,V(r*.35,H/2+.35,0),V(3,1,3),hexRGB('#2a2a30'),null,null);              // bung
  rbDraw(b,V(0,0,r+.15),V(7,7,.5),yel,[.25,.18,0],null);rbDraw(b,V(0,0,r+.45),V(3.4,3.4,.3),hexRGB('#151515'),null,null); // hazard plate
}
// details: bands across the long axis (in the box's own frame)
function drawPropDetail(b,W,H,D){
  const ax=W>=H&&W>=D?'x':H>=D?'y':'z',L={x:W,y:H,z:D}[ax];
  const band=(t,th,col,em,grow)=>{const lc=V(0,0,0);lc[ax]=(t-.5)*L;const g=grow===undefined?1.6:grow,ls=V(W+g,H+g,D+g);ls[ax]=th;rbDraw(b,lc,ls,col,em||null,null);};
  const k=b.kind;
  if(k==='barrel'){for(const t of [.28,.7])band(t,3,hexRGB('#ffcc33'),[.3,.22,0],1.6);}
  else if(k==='container'){band(.5,L*.4,hexRGB('#0b2026'),[0,.15,.2],1.4);}
  else if(k==='crate'||k==='small'||k==='big'){band(.5,L*.16,hexRGB('#2a1c0b'),null,1.4);}
  else if(k==='locker'){for(const t of [.2,.24,.28])band(t,1,hexRGB('#0d1220'),null,1.4);band(.62,2,hexRGB('#29f0ff'),[.05,.3,.35],1.2);}
  else if(k==='rack'){for(let i=0;i<6;i++){const blink=Math.sin(world.time*(2+i*.7)+b.x*.1+i)>.2;band(.14+i*.14,2.2,blink?hexRGB('#3dff7a'):hexRGB('#123018'),blink?[.1,.5,.2]:null,1.2);}}
  else if(k==='stack'||k==='tallcrate'){const n=k==='stack'?3:2;for(let i=1;i<n;i++)band(i/n,2.5,hexRGB('#2a1c0b'),null,1.8);for(let i=0;i<n;i++)band((i+.5)/n,1.5,hexRGB('#ffb020'),[.18,.11,0],1.2);}
  else if(k==='pallet'){band(.06,L*.12,hexRGB('#6b4a1c'),null,1.8);for(const t of [.4,.7])band(t,1.2,hexRGB('#8fb4d9'),[.06,.09,.14],1.2);}
  else if(k==='barrier'){for(let i=0;i<4;i++)band(.125+i*.25,L*.12,i%2?hexRGB('#ffcc33'):hexRGB('#1a1a1a'),i%2?[.25,.18,0]:null,1.2);}
  else if(k==='medkit'){const g=hexRGB('#1fd16b');rbDraw(b,V(0,H/2+.5,0),V(W*.6,1.4,D*.17),g,[.1,.6,.3],null);rbDraw(b,V(0,H/2+.5,0),V(W*.17,1.4,D*.6),g,[.1,.6,.3],null);}
  else if(k==='spool'){band(.06,L*.12,hexRGB('#9a6a32'),null,2);band(.94,L*.12,hexRGB('#9a6a32'),null,2);band(.5,L*.6,hexRGB('#ff8a2a'),[.2,.08,0],.8);}
}
// your own rocket at your feet: always a launch. Timing decides the price.
function rocketJump(e,c,f,air,dir,born){
  const fs=clamp(f/.55,0,1);if(fs<=0)return;            // full strength anywhere in the inner half of the blast
  const sinceJump=world.time-(e.jumpAt===undefined?-99:e.jumpAt);
  // perfect = fire first, then jump before the blast. Jumping first and firing in mid-air works almost as well.
  const jumpedAfterFire=born===undefined||e.jumpAt>=born-.03;
  const kind=!air?'ground':(sinceJump<RJ_WINDOW&&jumpedAfterFire)?'perfect':'air';
  const dmg=(kind==='ground'?RJ_DMG_GROUND:kind==='perfect'?RJ_DMG_PERFECT:RJ_DMG_AIR)*fs;
  if(e.state==='hang'||e.state==='climbup'||e.state==='kick'||e.state==='slide'||e.state==='getup'){e.state='normal';e.h=STAND_H;}
  if(e.crouch&&!overlapSolid(e.x,e.y,e.z,e.w,STAND_H)){e.crouch=false;e.h=STAND_H;}
  const vy=(air?RJ_VY_AIR:RJ_VY_GROUND)*fs;
  e.vy=Math.min(980,Math.max(e.vy,0)*.35+vy);
  e.vx+=dir.x*300*fs;e.vz+=dir.z*300*fs;
  e.grounded=false;e.coyote=0;e.y+=2;if(overlapSolid(e.x,e.y,e.z,e.w,e.h))e.y-=2;
  e.rocketJump=true;e.runJump=false;e.fallStart=e.y;e.rjFloat=RJ_FLOAT*fs;
  damage(e,dmg,null,dir);
  if(TUT.on&&TUT.cfg&&TUT.cfg.onRJ&&e===player)TUT.cfg.onRJ(kind,dmg);
}
// direct rocket hit: the body comes apart
let gibs=[];
// body segments fly off from where each bone was, tumbling, leaking dark coolant
const GIB_SEGS=[ // bone, its child (for length), cross-section, part kind
  ['Head',null,[10,11,10],'head'],['Spine2','Neck',[16,0,10],'chest'],['Hips','Spine1',[14,0,9],'pelvis'],
  ['LeftArm','LeftForeArm',[5.2,0,5.2],'limb'],['RightArm','RightForeArm',[5.2,0,5.2],'limb'],
  ['LeftForeArm','LeftHand',[4.6,0,4.6],'limb'],['RightForeArm','RightHand',[4.6,0,4.6],'limb'],
  ['LeftUpLeg','LeftLeg',[6.8,0,6.8],'limb'],['RightUpLeg','RightLeg',[6.8,0,6.8],'limb'],
  ['LeftLeg','LeftFoot',[5.8,0,5.8],'limb'],['RightLeg','RightFoot',[5.8,0,5.8],'limb']];
function spawnGibs(e,dir){
  const col=e.col,dark=e.col.map(v=>v*.42),c=V(e.x,e.y+e.h*.5,e.z),d=dir||V(0,1,0);
  const fluid=[e.col[0]*.22+.06,e.col[1]*.12+.02,e.col[2]*.18+.04];
  const P=SKN.ready&&e.skLast?e.skLast:null,H=P?fkHeads(P):null,bi=SKN.bi;
  const add=(pos,q,W,Hh,Dd,kind,cl)=>{
    const sp=280+rnd()*320,g={x:pos.x,y:pos.y,z:pos.z,vx:d.x*sp+(rnd()-.5)*300,vy:d.y*sp*.7+200+rnd()*240,vz:d.z*sp+(rnd()-.5)*300,
      m:Math.max(.2,W*Hh*Dd/1500),col:cl,dark,glow:col,kind,life:6+rnd()*2.5,bleed:kind==='shard'?0:.5+rnd()*.7,fluid};
    rbSetup(g,W,Hh,Dd,q);g.y=pos.y-g.h/2;
    // the blast pushes on the near side: off-centre pushes start them spinning
    const r=vsub(pos,c);g.av=vadd(vscale(vcross(r,vscale(d,1)),.12),V((rnd()-.5)*16,(rnd()-.5)*16,(rnd()-.5)*16));
    gibs.push(g);
  };
  if(H){
    for(const [bn,ch,xs,kind] of GIB_SEGS){
      const i=bi[bn],a=H[i];let len=xs[1]||11,mid=a;
      if(ch){const b=H[bi[ch]];len=Math.max(6,vlen(vsub(b,a)));mid=vscale(vadd(a,b),.5);}
      else mid=vadd(a,qrot(P.q[i],V(0,5,0)));
      add(mid,P.q[i],xs[0],len,xs[2],kind,kind==='limb'?(bn.includes('Up')||bn.endsWith('Arm')?col.map(v=>v*.6+.04):dark):col.map(v=>v*.55+.05));
    }
  }else{
    for(const [sx,sy,sz,hy,kind] of [[10,11,10,e.h-6,'head'],[16,18,10,36,'chest'],[14,8,9,24,'pelvis'],[5,14,5,36,'limb'],[5,14,5,36,'limb'],[6.8,17,6.8,14,'limb'],[6.8,17,6.8,14,'limb']])
      add(V(e.x+(rnd()-.5)*8,e.y+hy,e.z+(rnd()-.5)*8),qaxis(vnorm(V(rnd()-.5,rnd()-.5,rnd()-.5)),rnd()*6),sx,sy,sz,kind,col.map(v=>v*.55+.05));
  }
  for(let i=0;i<9;i++)add(vadd(c,V((rnd()-.5)*20,(rnd()-.5)*30,(rnd()-.5)*20)),qaxis(vnorm(V(rnd()-.5,rnd()-.5,rnd()-.5)),rnd()*6),2+rnd()*3,2+rnd()*4,1.5+rnd()*2.5,'shard',rnd()<.5?dark:[.13,.14,.18]);
  for(let i=0;i<26;i++)addPart(c.x,c.y,c.z,(rnd()-.5)*500,(rnd()-.2)*500,(rnd()-.5)*500,.5+rnd()*.5,rnd()<.5?[.9,.15,.2]:[1,.6,.2],4,'spark');
  for(let i=0;i<80;i++){const sp=120+rnd()*420,a=rnd()*Math.PI*2,b=rnd()*1.3-.2;
    addPart(c.x+(rnd()-.5)*14,c.y+(rnd()-.5)*24,c.z+(rnd()-.5)*14,Math.cos(a)*Math.cos(b)*sp+d.x*200,Math.sin(b)*sp+120,Math.sin(a)*Math.cos(b)*sp+d.z*200,6+rnd()*3,fluid,1.6+rnd()*2.4,'drop');}
  if(gibs.length>70)gibs.splice(0,gibs.length-70);
}
function updateGibs(dt){
  for(const g of gibs){
    g.life-=dt;
    rbStep(g,dt,RB_LIGHT,{rest:.3,mu:.5});
    if(g.burn>0){g.burn-=dt;if(rnd()<dt*30)addPart(g.x,g.y+g.h/2,g.z,(rnd()-.5)*20,30+rnd()*40,(rnd()-.5)*20,.35,rnd()<.5?[1,.7,.2]:[1,.35,.1],6+rnd()*4,'flame');}
    if(g.bleed>0&&!g.asleep){g.bleed-=dt;if(rnd()<dt*28)addPart(g.x,g.y+g.h/2,g.z,g.vx*.3+(rnd()-.5)*50,g.vy*.3+(rnd()-.5)*50,g.vz*.3+(rnd()-.5)*50,6,g.fluid,1.4+rnd()*1.6,'drop');}
  }
  gibs=gibs.filter(g=>g.life>0);
}
function drawGibs(){
  for(const g of gibs){
    const al=Math.min(1,g.life),W=g.W,H=g.H,D=g.D;
    rbDraw(g,V(0,0,0),V(W,H,D),g.col,null,null,al);
    if(g.kind==='shard')continue;
    // torn ends: dark joint caps with a glowing core where it ripped
    const cap=g.kind==='head'?null:V(W*1.08,Math.min(2.4,H*.18),D*1.08);
    if(cap){rbDraw(g,V(0,H/2-cap.y/2,0),cap,g.dark,null,null,al);rbDraw(g,V(0,-H/2+cap.y/2,0),cap,g.dark,null,null,al);
      rbDraw(g,V(0,-H/2-.4,0),V(W*.45,1,D*.45),g.glow,g.glow,null,al);}
    if(g.kind==='head')rbDraw(g,V(0,1,D/2),V(W*.8,3,1.2),g.glow,g.glow,null,al);
    if(g.kind==='chest'){rbDraw(g,V(0,H*.15,D/2),V(W*.7,2.5,1),g.glow,g.glow.map(v=>v*.6),null,al);rbDraw(g,V(0,-H/2-.5,0),V(W*.6,1.2,D*.5),g.glow,g.glow,null,al);}
  }
}
