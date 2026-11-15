// =====================================================================
//  COMBAT — rifle, rocket launcher, explosions, props, particles, audio
// =====================================================================
const ROCKET_V0=60,ROCKET_LOB=.22,ROCKET_ACC=1100,ROCKET_VMAX=650,ROCKET_R=150,ROCKET_DMG=60,ROCKET_PUSH=600;
const AIR_PUSH=1.9,GROUND_PUSH=.65,AIR_DMG=.6,SELF_DMG=1/3,FRAG_LIMIT=15;
// shotgun: found on the level, replaces the pistol until you die
const SG_MAG=6,SG_RELOAD=2.6,SG_CD=.95,SG_PELLETS=9,SG_SPREAD=.11,SG_DMG=10,SG_RANGE=620;
const magOf=e=>e.weapon==='shotgun'?SG_MAG:MAG,reloadOf=e=>e.weapon==='shotgun'?SG_RELOAD:RELOAD;
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
function updateParts(dt){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.life-=dt;if(p.life<=0){parts.splice(i,1);continue;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    if(p.type==='spark')p.vy-=G*.5*dt;
    else if(p.type==='dust'||p.type==='smoke'){const k=Math.pow(.15,dt);p.vx*=k;p.vz*=k;p.vy*=k;if(p.type==='smoke')p.vy+=30*dt;}
    else if(p.type==='flame'){p.vy+=60*dt;}
    else if(p.type==='glow'){const k=Math.pow(.05,dt);p.vx*=k;p.vy*=k;p.vz*=k;}
  }
}

// ---------- audio ----------
let AC=null,noiseBuf=null,master=null;
function initAudio(){try{AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=.5;master.connect(AC.destination);
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
  e.hp-=amt;e.flinch=1;reveal(e);
  if(src&&src!==e){e.lastHit=src;e.lastHitT=world.time;e.hitFrom={p:V(src.x,src.y,src.z),t:world.time};}
  if(e.hp<=0)kill(e,src,dir);
}
function kill(e,src,dir){
  e.alive=false;e.respawn=2.8;e.deaths++;
  let killer=src;
  if((!killer||killer===e)&&e.lastHit&&world.time-e.lastHitT<5)killer=e.lastHit;
  if(killer&&killer.isSpider){feed.unshift({t:4,text:`SPIDER ✕ ${e.name}`,color:'#e8ecf2'});}
  else if(killer&&killer!==e){killer.kills++;feed.unshift({t:4,text:`${killer.name} ⌁ ${e.name}`,color:killer.color});}
  else{e.kills=Math.max(0,e.kills-1);feed.unshift({t:4,text:`${e.name} ✕ self-destructed`,color:'#888'});}
  makeDoll(e,dir);sfx('die',e);
  for(let i=0;i<30;i++)addPart(e.x,e.y+30,e.z,(rnd()-.5)*500,rnd()*300,(rnd()-.5)*500,.9,e.col,3,'spark');
  if(killer&&!killer.isSpider&&killer.kills>=(world.fragLimit||FRAG_LIMIT)&&gameState==='play'){gameState='over';winner=killer;}
}

// ---------- rifle ----------
function fireRifle(e){
  if(e.weapon==='shotgun')return fireShotgun(e);
  reveal(e);noise(e,900,e);
  const m=muzzleOf(e),tgt=e.aimPoint||vadd(headPos(e),vscale(fwdOf(e.yaw,e.pitch),1000));
  let d=vnorm(vsub(tgt,m));
  const spread=.01+(Math.hypot(e.vx,e.vz)>60?.02:0)+(e.grounded?0:.03)+(e.isBot?.018:0)+(e.crouch?-.006:0);
  d=vnorm(V(d.x+(rnd()-.5)*2*spread,d.y+(rnd()-.5)*2*spread,d.z+(rnd()-.5)*2*spread));
  let start=m;if(solid(tileAt(m.x,m.y,m.z)))start=headPos(e);
  bullets.push({x:start.x,y:start.y,z:start.z,vx:d.x*PISTOL_SPEED,vy:d.y*PISTOL_SPEED,vz:d.z*PISTOL_SPEED,owner:e,life:.6,life0:.6,dmg:DMG,head:HEAD_DMG,fall:0,col:e.col});
  e.fireCD=FIRE_CD;e.ammo--;e.recoil=1;
  for(let i=0;i<4;i++)addPart(m.x,m.y,m.z,d.x*200+(rnd()-.5)*150,d.y*200+(rnd()-.5)*150,d.z*200+(rnd()-.5)*150,.08,[1,.9,.6],9,'glow');
  sfx('shot',e);if(e===player)world.shake=Math.max(world.shake,1.5);
  if(e.ammo<=0)e.reload=RELOAD;
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
          p.vx+=b.vx/sp*60/p.m;p.vz+=b.vz/sp*60/p.m;p.vy+=30/p.m;sparkAt(b.x,b.y,b.z,[1,.8,.2]);
          if(p.kind==='barrel')hurtBarrel(p,b.owner,1);dead=true;break;}}
    }
    if(dead)bullets.splice(n,1);
  }
}
function sparkAt(x,y,z,col){for(let k=0;k<5;k++)addPart(x,y,z,(rnd()-.5)*300,rnd()*220,(rnd()-.5)*300,.3,col,3,'spark');}

// ---------- rocket launcher ----------
// slow flare-rocket: leaves the tube slowly and accelerates, so you can fire at your feet and jump before it lands
function fireRocket(e){
  reveal(e);
  // the launcher tube sits over the shoulder: rockets leave from shoulder height, a little ahead
  const sh=V(e.x,e.y+e.h*.8,e.z),tgt=e.aimPoint||vadd(headPos(e),vscale(fwdOf(e.yaw,e.pitch),1000));
  const d=vnorm(vsub(tgt,sh));
  const m=vadd(sh,vscale(d,12));
  let start=m;if(solid(tileAt(m.x,m.y,m.z)))start=sh;
  rockets.push({x:start.x,y:start.y,z:start.z,d,sp:ROCKET_V0,owner:e,life:5,age:0});noise(e,800,e);
  e.rfireCD=RFIRE_CD;e.rockets--;e.recoil=1.4;
  if(e.rockets<=0)e.rreload=RRELOAD;
  sfx('rocket',e);if(e===player)world.shake=Math.max(world.shake,3);
  for(let i=0;i<8;i++)addPart(start.x,start.y,start.z,-d.x*120+(rnd()-.5)*80,-d.y*120+(rnd()-.5)*80,-d.z*120+(rnd()-.5)*80,.5,[.6,.55,.6],8,'smoke');
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
        if(Math.abs(r.x-e.x)<e.w/2+4&&Math.abs(r.z-e.z)<e.w/2+4&&r.y>e.y-2&&r.y<e.y+e.h+2){boom=true;break;}}
      if(boom)break;
      if(droneHit(r.x,r.y,r.z,16)){boom=true;break;}
      for(const sp2 of spiders){if(sp2.alive&&Math.hypot(r.x-sp2.p.x,r.y-sp2.p.y,r.z-sp2.p.z)<14){boom=true;break;}}
      if(boom)break;
      for(const p of props){if(p.dead)continue;if(Math.abs(r.x-p.x)<p.w/2+3&&Math.abs(r.z-p.z)<p.d/2+3&&r.y>p.y-2&&r.y<p.y+p.h+2){boom=true;break;}}
    }
    // flare + smoke trail
    if(rnd()<dt*60)addPart(r.x,r.y,r.z,(rnd()-.5)*30,(rnd()-.5)*30,(rnd()-.5)*30,.9,[.5,.45,.55],9,'smoke');
    addPart(r.x-r.d.x*4,r.y-r.d.y*4,r.z-r.d.z*4,-r.d.x*60+(rnd()-.5)*40,-r.d.y*60+(rnd()-.5)*40,-r.d.z*60+(rnd()-.5)*40,.25,rnd()<.5?[1,.6,.15]:[1,.85,.4],8,'flame');
    if(boom){rockets.splice(n,1);explode(V(r.x,r.y,r.z),{radius:ROCKET_R,dmg:ROCKET_DMG,push:ROCKET_PUSH,src:r.owner,rocket:true});}
  }
}
// explosion: area push + damage. Airborne targets are thrown much harder but hurt less; your own blast hurts you a third as much.
function explode(c,o){
  const RAD=o.radius,src=o.src||null;
  for(const e of chars){
    if(!e.alive)continue;
    const ctr=V(e.x,e.y+e.h*.5,e.z),d=vlen(vsub(ctr,c));if(d>RAD+e.h*.3)continue;
    // line of sight to feet, centre or head
    if(!losClear(c,ctr)&&!losClear(c,V(e.x,e.y+4,e.z))&&!losClear(c,V(e.x,e.y+e.h-4,e.z)))continue;
    const f=clamp(1-d/RAD,0,1);if(f<=0)continue;
    const air=!e.grounded&&e.state!=='down';
    let dir=vnorm(vsub(ctr,c));if(d<6)dir=V(0,1,0);
    dir=vnorm(V(dir.x,dir.y+.35,dir.z)); // explosions lift
    const push=o.push*f*(air?AIR_PUSH:GROUND_PUSH);
    let dmg=o.dmg*f*(air?AIR_DMG:1);if(e===src)dmg*=SELF_DMG;
    damage(e,dmg,e===src?null:src,dir);
    if(!e.alive)continue;
    if(e.state==='hang'||e.state==='climbup'||e.state==='kick'||e.state==='slide'||e.state==='getup'){e.state='normal';e.h=56;}
    if(e.crouch&&!overlapSolid(e.x,e.y,e.z,e.w,56)){e.crouch=false;e.h=56;}
    if(e.state==='down'){e.vx+=dir.x*push*.6;e.vy=Math.max(e.vy,dir.y*push*.5);e.vz+=dir.z*push*.6;e.grounded=false;}
    else{
      e.vx+=dir.x*push;e.vz+=dir.z*push;e.vy=Math.min(Math.max(e.vy,0)*.4+dir.y*push,940);
      e.grounded=false;e.coyote=0;e.y+=2;if(overlapSolid(e.x,e.y,e.z,e.w,e.h))e.y-=2;
      if(e===src&&o.rocket){e.rocketJump=true;e.runJump=false;e.fallStart=e.y;if(TUT.on&&TUT.cfg&&TUT.cfg.onRJ&&e===player)TUT.cfg.onRJ(air,e.vy);}
      else if(push>380){e.knocked=true;e.stun=.45;e.bav=10*f;e.tumbleHold=0;}
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
    p.vx+=dir.x*o.push*f/Math.pow(p.m,.6);p.vy+=dir.y*o.push*f/Math.pow(p.m,.6);p.vz+=dir.z*o.push*f/Math.pow(p.m,.6);p.grounded=false;p.kickedBy=src;p.kickT=world.time;
  }
  // visuals
  parts.push({x:c.x,y:c.y,z:c.z,vx:0,vy:0,vz:0,life:.22,max:.22,col:[1,.95,.7],size:RAD*1.6,type:'glow'});
  addPart(c.x,c.y,c.z,0,0,0,.45,[1,.55,.15],RAD/6,'ring');
  for(let i=0;i<46;i++){const a=rnd()*Math.PI*2,b=rnd()*Math.PI-Math.PI/2,sp=120+rnd()*520;addPart(c.x,c.y,c.z,Math.cos(a)*Math.cos(b)*sp,Math.sin(b)*sp+100,Math.sin(a)*Math.cos(b)*sp,.4+rnd()*.5,rnd()<.5?[1,.8,.2]:[1,.35,.1],3,'spark');}
  for(let i=0;i<22;i++)addPart(c.x+(rnd()-.5)*40,c.y+(rnd()-.5)*30,c.z+(rnd()-.5)*40,(rnd()-.5)*140,40+rnd()*100,(rnd()-.5)*140,1+rnd()*.9,[.2,.17,.22],16+rnd()*14,'smoke');
  for(let i=0;i<14;i++)addPart(c.x+(rnd()-.5)*30,c.y+(rnd()-.5)*30,c.z+(rnd()-.5)*30,(rnd()-.5)*200,rnd()*200,(rnd()-.5)*200,.35,[1,.55,.15],14,'flame');
  sfx('boom',c);noise(c,1300,src);
  if(player){const d=Math.hypot(player.x-c.x,player.y-c.y,player.z-c.z);if(d<900)world.shake=Math.max(world.shake,14*(1-d/900)+2);}
}

// ---------- props: crates, barrels, containers, medkits ----------
const KINDS={
  crate:{w:26,h:26,d:26,m:1,col:'#6b4a1c',edge:'#ffb020'},small:{w:18,h:18,d:18,m:.6,col:'#5e4018',edge:'#d98f2b'},
  big:{w:42,h:38,d:42,m:2.6,col:'#202842',edge:'#5a6a99'},barrel:{w:22,h:30,d:22,m:1.4,col:'#b4381f',edge:'#ffcc33'},
  container:{w:72,h:34,d:34,m:5,col:'#16424d',edge:'#29f0ff'},medkit:{w:24,h:18,d:24,m:.5,col:'#e9f1ff',edge:'#1fd16b'},
  shotgun:{w:26,h:14,d:26,m:.5,col:'#1b2030',edge:'#ff8a2a'}
};
function makeProp(x,y,z,kind,rot){
  const k=KINDS[kind];let w=k.w,d=k.d;if(rot){const t=w;w=d;d=t;}
  return {kind,x,y,z,w,h:k.h,d,m:k.m,vx:0,vy:0,vz:0,grounded:false,dead:false,col:hexRGB(k.col),edge:hexRGB(k.edge),kickedBy:null,kickT:-99};
}
function hurtBarrel(b,src,n){
  if(b.dead)return;if(src)b.lastHitBy=src;
  b.hits=(b.hits||0)+n;const cur=b.fuse===undefined?99:b.fuse;
  if(b.hits>=3)b.fuse=Math.min(cur,.05);else if(b.hits===2){b.fuse=Math.min(cur,3);sfx('ignite',b);}else b.fuse=Math.min(cur,8);
}
function updateProps(dt){
  for(const b of props){
    if(b.dead)continue;
    if(b.fuse!==undefined){b.fuse-=dt;if(b.fuse<=0){b.dead=true;explode(V(b.x,b.y+b.h/2,b.z),{radius:125,dmg:80,push:520,src:b.lastHitBy});world.barrelQ.push(world.time+22+rnd()*10);continue;}}
    if(b.kind==='barrel'&&b.hits){
      if(rnd()<dt*(b.hits>=2?10:7))addPart(b.x+(rnd()-.5)*10,b.y+b.h,b.z+(rnd()-.5)*10,(rnd()-.5)*30,50+rnd()*60,(rnd()-.5)*30,1.2,b.hits>=2?[.16,.14,.16]:[.35,.35,.4],10,'smoke');
      if(b.hits>=2&&rnd()<dt*50)addPart(b.x+(rnd()-.5)*b.w*.8,b.y+b.h,b.z+(rnd()-.5)*b.w*.8,(rnd()-.5)*40,90+rnd()*90,(rnd()-.5)*40,.45,rnd()<.5?[1,.8,.2]:[1,.35,.1],9,'flame');
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
    if(oy<ox&&oy<oz){const top=a.y>b.y?a:b,bot=top===a?b:a;top.y+=oy;if(top.vy<bot.vy){top.vy=bot.vy*.5;}top.grounded=true;top.vx*=.9;top.vz*=.9;}
    else if(ox<oz){const s=Math.sign(b.x-a.x)||1,tm=a.m+b.m;a.x-=s*ox*b.m/tm;b.x+=s*ox*a.m/tm;const v=(a.vx*a.m+b.vx*b.m)/tm;a.vx=v;b.vx=v;}
    else{const s=Math.sign(b.z-a.z)||1,tm=a.m+b.m;a.z-=s*oz*b.m/tm;b.z+=s*oz*a.m/tm;const v=(a.vz*a.m+b.vz*b.m)/tm;a.vz=v;b.vz=v;}
  }
  for(const b of props)if(!b.dead&&overlapSolid(b.x,b.y,b.z,b.w,b.h,b.d))pushOut(b);
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
    if(b.kind==='shotgun'){
      if(e.state!=='down'){
        const had=e.hasShotgun;
        if(!had){e.hasShotgun=true;e.stash.pistol=e.ammo;e.weapon='shotgun';e.ammo=SG_MAG;e.reload=0;}
        else if(e.weapon==='shotgun'){e.ammo=SG_MAG;e.reload=0;}else e.stash.shotgun=SG_MAG;
        b.dead=true;sfx('pickup',b);
        world.sgQ.push(world.time+25);
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
        if(e.vx*s>0){b.vx=s*Math.max(Math.abs(e.vx)*.9/Math.sqrt(b.m),25);if(b.m>2)e.vx*=.6;}}
      else{const s=Math.sign(b.z-e.z)||1,bz0=b.z,ez0=e.z;b.z+=s*oz*share;if(overlapSolid(b.x,b.y,b.z,b.w,b.h,b.d)){b.z=bz0;e.z-=s*oz;}else e.z-=s*oz*(1-share);
        if(overlapSolid(e.x,e.y,e.z,e.w,e.h)){e.z=ez0;}
        if(e.vz*s>0){b.vz=s*Math.max(Math.abs(e.vz)*.9/Math.sqrt(b.m),25);if(b.m>2)e.vz*=.6;}}
    }
  }
}
function spawnFurniture(){
  const pts=spawnPoints();
  const want=['container','container','big','big','big','barrel','barrel','barrel','barrel','barrel','barrel','crate','crate','crate','crate','crate','crate','small','small','small','small'];
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
function drawProp(b){
  const c=V(b.x,b.y+b.h/2,b.z);
  if(b.kind==='barrel'){
    let em=null;if(b.hits>=2)em=[.4*(.6+.4*Math.sin(world.time*25)),.12,0];
    if(b.fuse!==undefined&&b.fuse<1.5&&Math.sin(world.time*(b.fuse<.6?22:10))>0)em=[.8,.75,.5];
    drawBox(c,b.w,b.h,b.d,b.col,em,b.edge);
    for(const yy of [.28,.7])drawBox(V(b.x,b.y+b.h*yy,b.z),b.w+1.5,3,b.d+1.5,hexRGB('#ffcc33'),[.3,.22,0],null);
  }else if(b.kind==='medkit'){
    const pl=.6+.4*Math.sin(world.time*6);
    drawBox(c,b.w,b.h,b.d,b.col,[.1*pl,.25*pl,.12*pl],b.edge);
    drawBox(V(b.x,b.y+b.h+.5,b.z),14,1.5,4,hexRGB('#1fd16b'),[.1,.6,.3],null);drawBox(V(b.x,b.y+b.h+.5,b.z),4,1.5,14,hexRGB('#1fd16b'),[.1,.6,.3],null);
  }else if(b.kind==='container'){
    drawBox(c,b.w,b.h,b.d,b.col,null,b.edge);
    const long=b.w>b.d;drawBox(V(b.x,b.y+b.h*.5,b.z),long?b.w*.4:b.w+1,8,long?b.d+1:b.d*.4,hexRGB('#0b2026'),[0,.15,.2],b.edge);
  }else if(b.kind==='shotgun'){
    // glowing pad with a floating, turning shotgun
    const pl=.6+.4*Math.sin(world.time*4);
    drawBox(V(b.x,b.y+1.5,b.z),26,3,26,b.col,[.25*pl,.1*pl,0],b.edge);
    const yaw=world.time*1.6,hy=b.y+16+Math.sin(world.time*2.5)*2.5;
    drawBox(V(b.x,hy,b.z),30,4.5,4.5,hexRGB('#3b2a22'),null,[1,.55,.2],yaw);
    drawBox(V(b.x+Math.sin(yaw)*4,hy-3.5,b.z+Math.cos(yaw)*4),12,3.5,5,hexRGB('#ff8a2a'),[.35,.15,0],null,yaw);
    drawBox(V(b.x-Math.sin(yaw+Math.PI/2)*12,hy-2,b.z-Math.cos(yaw+Math.PI/2)*12),8,7,4,hexRGB('#2b3148'),null,[1,.55,.2],yaw);
  }else drawBox(c,b.w,b.h,b.d,b.col,null,b.edge);
}
