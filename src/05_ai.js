// =====================================================================
//  BOTS
// =====================================================================
// skill presets (chosen on the start screen)
const BOT_SKILLS={
  easy:  {label:'EASY',  fov:100,react:[1.2,1.8],turn:2.0,skill:[.30,.45],burst:.6,pause:1.0,rocket:.4},
  normal:{label:'NORMAL',fov:120,react:[.6,1.05],turn:3.2,skill:[.60,.90],burst:1.0,pause:.6,rocket:1},
  hard:  {label:'HARD',  fov:140,react:[.35,.65],turn:4.6,skill:[.90,1.05],burst:1.3,pause:.4,rocket:1.4},
  insane:{label:'INSANE',fov:160,react:[.15,.3], turn:7.0,skill:[1.1,1.2],burst:1.8,pause:.2,rocket:2}
};
let BOT_CFG=BOT_SKILLS.normal;
let BOT_FOV_COS=Math.cos(60*Math.PI/180),BOT_REACT_MIN=.6,BOT_REACT_MAX=1.05,BOT_TURN=3.2;
function applyBotSkill(key){
  BOT_CFG=BOT_SKILLS[key]||BOT_SKILLS.normal;
  BOT_FOV_COS=Math.cos(BOT_CFG.fov/2*Math.PI/180);BOT_REACT_MIN=BOT_CFG.react[0];BOT_REACT_MAX=BOT_CFG.react[1];BOT_TURN=BOT_CFG.turn;
}
// ---------- cover ----------
// the best low-cover spot near the bot against a threat: beside a one-block wall or a waist-high box that faces the threat,
// where crouching hides you (and standing lets you shoot over, preferably)
function findCoverSpot(b,th,R){
  const j=Math.floor((b.y+1)/T),bi=Math.floor(b.x/T),bk=Math.floor(b.z/T),tc=chestPos(th),y=j*T;let best=null;
  const consider=(x,z,d,kind,prop)=>{
    const dx=th.x-x,dz=th.z-z,dl=Math.hypot(dx,dz)||1,al=(d[0]*dx+d[1]*dz)/dl;
    if(al<.55||dl<130)return;
    if(overlapSolid(x,y,z,BODY_W,COVER_H)||!solid(tileAt(x,y-4,z)))return;
    if(chars.some(o=>o!==b&&o.alive&&Math.hypot(o.x-x,o.z-z)<BODY_W+4))return;
    if(kind==='wall'&&losClear(V(x,y+COVER_H-3,z),tc))return;          // must actually hide you
    const peek=losClear(V(x,y+56,z),tc)?0:70;                           // ...and ideally let you shoot over it
    const dist=Math.hypot(x-b.x,z-b.z);
    const sc=dist+peek+(1-al)*90+Math.max(0,240-dl)*.5;
    if(!best||sc<best.sc)best={x,y,z,d,kind,prop,sc};
  };
  for(let i=bi-R;i<=bi+R;i++)for(let k=bk-R;k<=bk+R;k++){
    if(!nav.adj.has(ni(i,j,k)))continue;
    for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){const wi=i+d[0],wk=k+d[1];
      if(solid(tile(wi,j,wk))&&!solid(tile(wi,j+1,wk))&&!solid(tile(wi,j+2,wk)))
        consider((i+.5)*T+d[0]*(T/2-BODY_W/2-2),(k+.5)*T+d[1]*(T/2-BODY_W/2-2),d,'wall');}
  }
  for(const p of props){
    if(p.dead||!p.grounded||PICKUP_GLOW[p.kind]||p.kind==='medkit'||p.fuse!==undefined)continue;
    const top=p.y+p.h-y;if(top<28||top>54||Math.abs(p.y-y)>6||Math.hypot(p.x-b.x,p.z-b.z)>R*T)continue;
    const d=cardOf(th.x-p.x,th.z-p.z),half=d[0]?p.w/2:p.d/2;
    consider(p.x-d[0]*(half+BODY_W/2+3),p.z-d[1]*(half+BODY_W/2+3),d,'box',p);
  }
  return best;
}
// survival first: hurt, reloading, out of ammo or under fire with an enemy about -> get behind cover,
// reload and wait hidden, pop up for short bursts, duck as soon as you're hit; leave when flanked, rushed or alone
function botCover(b,ai,c,t,see,dt,think){
  if(window.AI_COVER===false)return null;
  ai.covCD=(ai.covCD||0)-dt;
  const hurt=b.lastHitT&&world.time-b.lastHitT<2.2;
  // the threat: whoever we're fighting, or (while hiding from them) the one we took cover from
  let th=t&&t.alive&&!t.isSpider?t:null;if(!th&&ai.cov&&ai.cov.th&&ai.cov.th.alive)th=ai.cov.th;
  if(ai.cov){const cv=ai.cov;cv.lostT=see?0:(cv.lostT||0)+dt;let drop=!th||world.rot||(cv.lostT>4&&b.hp>45);
    if(th){const dx=th.x-cv.x,dz=th.z-cv.z,dl=Math.hypot(dx,dz)||1,al=(cv.d[0]*dx+cv.d[1]*dz)/dl;
      if(dl<100)drop=true;
      else if(al<(cv.inT?.25:.5)&&think){ // the threat moved round: find a better spot rather than give up
        const sp=findCoverSpot(b,th,b.hp<45?9:6);
        if(sp){Object.assign(cv,sp,{t0:cv.inT?cv.t0:world.time,inT:0,px:sp.prop?sp.prop.x:0,pz:sp.prop?sp.prop.z:0});if(b.cover)c.leaveCover=true;ai.replan=0;}else drop=true;}}
    if(world.time-cv.t0>(cv.inT?13:5))drop=true;
    if(cv.prop&&(cv.prop.dead||Math.hypot(cv.prop.x-cv.px,cv.prop.z-cv.pz)>16))drop=true; // the box got knocked away
    if(drop){if(window.COVDBG){const why=!th?'nothreat':world.rot?'rot':cv.lostT>4&&b.hp>45?'lost':world.time-cv.t0>(cv.inT?13:5)?(cv.inT?'sat':'slow'):cv.prop&&(cv.prop.dead||!cv.prop.grounded)?'prop':'flank/close';
      const k=(cv.inT?'in:':'go:')+why;const D=window.COVDBG;D[k]=(D[k]||0)+1;if(!cv.inT){const dd=Math.hypot(cv.x-b.x,cv.z-b.z);D.dist=(D.dist||[]);D.dist.push(Math.round(dd/T*10)/10+(Math.abs(b.y-cv.y)>8?'^':''));}}
      ai.cov=null;c.leaveCover=true;ai.covCD=1+rnd();return null;}}
  if(!ai.cov&&th&&ai.covCD<=0&&think&&b.grounded&&b.state==='normal'&&!ai.dip){
    const mag=magOf(b);
    const want=(see||hurt)&&(b.hp<75||b.reload>0||(see&&b.ammo<mag*.3)||(hurt&&b.hp<95));
    if(want&&rnd()<.85){ // every skill level tries to stay alive
      const sp=findCoverSpot(b,th,b.hp<45?9:6);
      if(sp){ai.cov=Object.assign(sp,{th,t0:world.time,peek:false,pt:.7,px:sp.prop?sp.prop.x:0,pz:sp.prop?sp.prop.z:0});ai.replan=0;}
      ai.covCD=sp?0:1.5;
    }else if(want)ai.covCD=1;
  }
  if(!ai.cov)return null;
  const cv=ai.cov;
  if(t&&t.alive&&t!==cv.th&&see)cv.th=t;
  if(b.cover){
    if(!cv.inT){cv.inT=world.time;cv.t0=world.time;}
    cv.pt-=dt;
    if(cv.peek&&b.lastHitT>cv.peekAt+.05){cv.peek=false;cv.pt=1.1+rnd()*.8;}       // hit while up: duck
    if(cv.pt<=0){if(cv.peek||b.reload>0){cv.peek=false;cv.pt=(b.hp<45?1.5:.8)+rnd()*.9;}else{cv.peek=true;cv.peekAt=world.time;cv.pt=.9+rnd()*.9;}}
    if(b.reload>0)cv.peek=false;
    c.aim=cv.peek;c.coverDir=cv.d;
    if(!cv.peek&&b.ammo<magOf(b)*.6&&b.reload<=0)c.reload=true;
    return {mv:[0,0]};
  }
  const dx=cv.x-b.x,dz=cv.z-b.z,dl=Math.hypot(dx,dz);
  if(dl<4){c.coverDir=cv.d;return {mv:[0,0]};}
  if(dl<1.6*T&&Math.abs(b.y-cv.y)<8){c.sprint=dl>40&&b.stam>.1;if(dl<16)c.coverDir=cv.d;return {mv:[dx,dz]};}
  return {path:[Math.floor(cv.x/T),Math.floor((cv.y+1)/T),Math.floor(cv.z/T)]};
}
function botThink(b,dt){
  const c=b.ctl;
  if(b.skill&&BOT_CFG!==BOT_SKILLS[b.skill])applyBotSkill(b.skill); // each bot can have its own skill (demo)
  c.swap=false;c.select=null;c.mx=0;c.mz=0;c.jump=false;c.fire=false;c.fireClick=false;c.rocketClick=false;c.aim=false;c.alt=false;c.kick=false;c.reload=false;c.crouch=false;c.crouchPressed=false;c.sprint=false;c.grab=false;c.dodge=null;c.wave=false;c.sprint=false;c.noVault=false;c.noGrab=false;c.coverDir=null;c.leaveCover=false;
  if(!b.alive){b.ai=null;return;}
  if(b.script){c.mx=0;c.mz=0;b.script(b,c,dt);return;} // tutorial actors
  const ai=b.ai||(b.ai={known:null,acquire:0,lostT:0,lastSeen:null,alert:null,alertT:0,yaw:b.yaw,pitch:0,errT:0,ex:0,ey:0,ez:0,burst:0,pause:0,path:null,replan:0,stuckT:0,last:V(b.x,b.y,b.z),flip:0,hold:0,strafe:1,strafeT:0,skill:BOT_CFG.skill[0]+rnd()*(BOT_CFG.skill[1]-BOT_CFG.skill[0]),rocketT:(2+rnd()*3)/BOT_CFG.rocket,jumpWait:0,scanT:0});
  // loop breaker: the same grab / vault / climb three times in one spot within 14 s means the bot is going round in circles:
  // pick a goal somewhere else and stop grabbing / vaulting for a few seconds
  if(b.state!==ai.lastState){if(b.state==='hang'||b.state==='climbup'){(ai.ev||(ai.ev=[])).push({t:world.time,x:b.x,y:b.y,z:b.z});
    ai.ev=ai.ev.filter(q=>world.time-q.t<14);
    if(ai.ev.filter(q=>Math.hypot(q.x-b.x,q.z-b.z)<3*T&&Math.abs(q.y-b.y)<3*T).length>=3){
      ai.ev=[];ai.loopT=6;ai.roam=6;ai.newRoam=true;ai.loopAt=V(b.x,b.y,b.z);ai.path=null;ai.replan=0;ai.kickGoal=null;ai.medGoal=null;ai.goalPt=null;}}
    ai.lastState=b.state;}
  ai.loopT=(ai.loopT||0)-dt;if(ai.loopT>0){c.noVault=true;c.noGrab=true;}
  // remember every change of level (route, strafe or knock-back alike), so the next routes don't undo it at once
  if(b.grounded&&b.state==='normal'){const cc=cellOf(b);if(ai.gc&&cc[1]!==ai.gc[1])(ai.left||(ai.left=[])).push({i:ai.gc[0],j:ai.gc[1],k:ai.gc[2],t:world.time});ai.gc=cc;}
  const eye=headPos(b);
  // decisions happen at a human rhythm (~4 times a second), not every frame; in between the bot commits
  ai.tick=(ai.tick||0)-dt;const think=ai.tick<=0;if(think)ai.tick=.2+rnd()*.15;
  // ---- perception: 120° view cone + line of sight; very close = sensed anyway; gunfire and hits are heard
  const look=fwdOf(ai.yaw,ai.pitch*.5);
  const canSee=o=>{
    if(!o.alive||o===b||o.vis<.35||allied(o,b)||(ai.dip&&ai.dip.target===o))return false;
    const tc=chestPos(o),v=vsub(tc,eye),l=vlen(v)||1;
    if(l>1500)return false;
    if(l>70&&vdot(v,look)/l<BOT_FOV_COS)return false;
    return losClear(eye,tc)||losClear(eye,headPos(o));
  };
  if(ai.known&&(!ai.known.alive))ai.known=null;
  let see=false;
  if(ai.known){see=canSee(ai.known);if(see){ai.lostT=0;ai.lastSeen=V(ai.known.x,ai.known.y,ai.known.z);}else{ai.lostT+=dt;if(ai.lostT>3){ai.known=null;}}}
  if(!see&&(think||!ai.known)){ // look for someone new in the cone
    let best=null,bd=1e9;
    for(const o of chars){if(!canSee(o))continue;const d=Math.hypot(o.x-b.x,o.y-b.y,o.z-b.z);if(d<bd){bd=d;best=o;}}
    if(!best)for(const o of spiders){if(o.spawnT>0||!canSee(o))continue;const d=Math.hypot(o.x-b.x,o.y-b.y,o.z-b.z);if(d<450&&d<bd){bd=d;best=o;}}
    if(best){
      if(best!==ai.known)ai.acquire=BOT_REACT_MIN+rnd()*(BOT_REACT_MAX-BOT_REACT_MIN)+(1-ai.skill)*.25; // spotted: takes a moment to react
      ai.known=best;see=true;ai.lostT=0;ai.lastSeen=V(best.x,best.y,best.z);
    }
  }
  // heard something / got hit: turn toward it
  if(world.noises)for(const nz of world.noises){if(nz.src===b||nz.used&&nz.used.has(b))continue;const d=Math.hypot(nz.x-b.x,nz.y-b.y,nz.z-b.z);
    if(d<nz.r){(nz.used||(nz.used=new Set())).add(b);if(!see){ai.alert=V(nz.x,nz.y,nz.z);ai.alertT=3.5;}}}
  // sometimes a bot that's being shot throws a dodge
  if(b.hitFrom&&world.time-b.hitFrom.t<.1&&b.stam>.6&&rnd()<.22*ai.skill)c.dodge=['back','left','right'][rnd()*3|0];
  if(b.hitFrom&&world.time-b.hitFrom.t<.1){if(!see){ai.alert=b.hitFrom.p;ai.alertT=4;}b.hitFrom=null;}
  ai.alertT-=dt;if(ai.alertT<=0)ai.alert=null;
  const t=ai.known;
  const dist=t?Math.hypot(t.x-b.x,t.z-b.z):1e9,dy=t?t.y-b.y:0;
  // ---- aim: nothing until the reaction time is over, then a limited turn rate
  ai.errT-=dt;if(ai.errT<=0){ai.errT=.6+rnd()*.6;const e=Math.min(120,(1.2-ai.skill)*(30+Math.min(dist,1500)*.05));ai.etx=(rnd()-.5)*e;ai.ety=(rnd()-.5)*e;ai.etz=(rnd()-.5)*e;}
  {const eb=Math.min(1,dt*2.5);ai.ex+=((ai.etx||0)-ai.ex)*eb;ai.ey+=((ai.ety||0)-ai.ey)*eb;ai.ez+=((ai.etz||0)-ai.ez)*eb;}
  if(see&&ai.acquire>0)ai.acquire-=dt;
  let ap=null,turn=BOT_TURN*.6;
  if(t&&see&&ai.acquire<=0){const ch=chestPos(t);ap=V(ch.x+t.vx*.12+ai.ex,ch.y+t.vy*.05+ai.ey,ch.z+t.vz*.12+ai.ez);turn=BOT_TURN;}
  else if(t&&see&&ai.acquire>0){ap=vadd(eye,vscale(fwdOf(ai.yaw,ai.pitch),200));turn=0;} // still reacting: gaze holds
  else if(t&&!see&&ai.lastSeen)ap=V(ai.lastSeen.x,ai.lastSeen.y+44,ai.lastSeen.z);
  else if(!t&&ai.alert)ap=V(ai.alert.x,ai.alert.y+30,ai.alert.z);
  else if(!see&&ai.path&&ai.path[0]&&Math.hypot(ai.mvx||0,ai.mvz||0)>.3){const lead=ai.goalPt&&Math.hypot(ai.goalPt.x-b.x,ai.goalPt.z-b.z)>60?ai.goalPt:{x:b.x+ai.mvx*200,z:b.z+ai.mvz*200};ap=V(lead.x,b.y+44,lead.z);} // look where you're going
  if(!ap){ // idle scan: glance around now and then
    ai.scanT-=dt;if(ai.scanT<=0){ai.scanT=1.5+rnd()*2;ai.scanYaw=ai.yaw+(rnd()-.5)*2.4;}
    ap=vadd(eye,vscale(fwdOf(ai.scanYaw!==undefined?ai.scanYaw:ai.yaw,0),200));
  }
  // alliances: offer / accept
  const dip=botDiplomacy(b,ai,dt,see,t);
  if(dip&&dip.face&&(!(see&&t)||dip.stay||dip.close)){ap=V(dip.face.x,dip.face.y+44,dip.face.z);turn=BOT_TURN;}
  let wantRocket=false;ai.rocketT-=dt;
  if(t&&see&&ai.acquire<=0&&b.rockets>0&&b.rreload<=0&&dist>280&&dist<850&&ai.rocketT<=0){wantRocket=true;ap=V(t.x,t.y+4,t.z);}
  const d=vsub(ap,eye),dl=vlen(d)||1;
  const ty=yawOf(d.x,d.z),tp=Math.asin(clamp(d.y/dl,-1,1));
  {const tyv=clamp(angDiff(ty,ai.yaw)*8,-turn,turn),tpv=clamp((tp-ai.pitch)*8,-turn*.8,turn*.8),k=Math.min(1,dt*14);
   ai.yv=(ai.yv||0)+(tyv-(ai.yv||0))*k;ai.pv=(ai.pv||0)+(tpv-(ai.pv||0))*k;ai.yaw+=ai.yv*dt;ai.pitch+=ai.pv*dt;}
  c.aimYaw=ai.yaw;c.aimPitch=ai.pitch;b.aimPoint=vadd(eye,vscale(fwdOf(ai.yaw,ai.pitch),dl));
  // ---- shoot once the sights are actually on target
  const loose=b.weapon==='shotgun'?.16:b.weapon==='rifle'?.12:.09;
  const onTarget=Math.abs(angDiff(ty,ai.yaw))<loose&&Math.abs(tp-ai.pitch)<loose+.03;
  const range=b.weapon==='shotgun'?560:1100;
  // waving / bowing, waiting for an answer to its offer, or just turned down: no shooting at them
  const peaceful=!!b.emote||(ai.holdFire||0)>world.time||(ai.dip&&t===ai.dip.target);
  if(see&&t&&ai.acquire<=0&&onTarget&&dist<range&&!peaceful){
    if(wantRocket&&b.rfireCD<=0){c.rocketClick=true;ai.rocketT=(3+rnd()*4)/BOT_CFG.rocket;}
    else if(ai.pause>0)ai.pause-=dt;
    else{c.fire=true;ai.burst+=dt;if(ai.burst>(.9+rnd()*.7)*BOT_CFG.burst){ai.burst=0;ai.pause=(.6+rnd()*.6)*BOT_CFG.pause;}}
  }
  // weapon choice: the launcher only for the moment of a rocket shot, otherwise the best gun for the range
  {const want=b.hasShotgun&&dist<420?'shotgun':b.hasRifle?'rifle':'pistol';if(b.weapon!==want&&(b.weapon==='rocket'||(t&&see&&b.fireCD<=0)))c.select=want;}
  if(b.ammo<4&&!see)c.reload=true;
  const cov=b.state==='normal'?botCover(b,ai,c,t,see,dt,think):null;
  if(b.state==='hang'){c.grab=true;c.jump=rnd()<dt*4;return;}
  if(b.state!=='normal')return;
  // ---- path planning ----
  ai.replan-=dt;
  const [ci,cj,ck]=cellOf(b);
  const onNode=b.grounded&&nav&&nav.adj.has(ni(ci,cj,ck));
  if(onNode&&(ai.replan<=0||!ai.path||ai.navVer!==nav.ver)){
    let g=null;ai.medGoal=null;
    if(b.hp<65&&!(cov&&!cov.path&&see)){let bd=1e9;for(const m of props){if(m.kind!=='medkit'||!m.grounded||m.dead)continue;const q=[Math.floor(m.x/T),Math.floor((m.y+1)/T),Math.floor(m.z/T)];const dd=Math.abs(q[0]-ci)+Math.abs(q[1]-cj)+Math.abs(q[2]-ck);if(dd<bd){bd=dd;g=q;}}if(g&&bd<30)ai.medGoal=g;else g=null;}
    if(!g&&!see&&(!b.hasShotgun||!b.hasRifle||!b.bigLauncher)){let bd=1e9,bq=null;for(const m of props){if(m.dead||!((m.kind==='shotgun'&&!b.hasShotgun)||(m.kind==='rifle'&&!b.hasRifle)||(m.kind==='launcher'&&!b.bigLauncher)))continue;const q=[Math.floor(m.x/T),Math.floor((m.y+1)/T),Math.floor(m.z/T)];const dd=Math.abs(q[0]-ci)+Math.abs(q[1]-cj)+Math.abs(q[2]-ck);if(dd<bd){bd=dd;bq=q;}}if(bq&&bd<22){g=bq;ai.medGoal=bq;}}
    if(!g&&world.rotCD<=0&&!world.rot&&!ai.kickGoal&&nav.kickCells.length&&rnd()<.25){let bd=1e9,bk=null;for(const q of nav.kickCells){const dd=Math.abs(q.i-ci)+Math.abs(q.j-cj)+Math.abs(q.k-ck);if(dd<bd){bd=dd;bk=q;}}if(bd<26)ai.kickGoal=bk;}
    if(ai.kickGoal&&(world.rotCD>0||world.rot))ai.kickGoal=null;
    if(!g&&cov&&cov.path){g=cov.path;ai.kickGoal=null;}
    if(!g&&ai.kickGoal)g=[ai.kickGoal.i,ai.kickGoal.j,ai.kickGoal.k];
    if(!g&&ai.dip&&!see)g=cellOf(ai.dip.target); // heading over to offer / accept an alliance
    if(ai.roam>0)g=null; // target unreachable recently: roam somewhere else for a bit
    else if(!g&&t&&see)g=cellOf(t);
    else if(!g&&t&&ai.lastSeen)g=[Math.floor(ai.lastSeen.x/T),Math.floor((ai.lastSeen.y+1)/T),Math.floor(ai.lastSeen.z/T)];
    else if(!g&&ai.alert)g=[Math.floor(ai.alert.x/T),Math.floor((ai.alert.y+1)/T),Math.floor(ai.alert.z/T)];
    if(!g){if(!ai.wander||rnd()<.03||ai.newRoam){ai.newRoam=false;
      // hunt: half the time head for somewhere near a living rival (you can hear a fight through the walls), else wander
      const rivals=chars.filter(o=>o!==b&&o.alive);
      if(rivals.length&&rnd()<.5&&!(ai.loopT>0)){const o=rivals[rnd()*rivals.length|0],sp=spawnPoints().filter(q=>Math.hypot(q.x-o.x,q.y-o.y,q.z-o.z)<260);ai.wander=sp.length?sp[rnd()*sp.length|0]:{x:o.x,y:o.y,z:o.z};}
      else{let sp=spawnPoints();if(ai.loopAt&&ai.loopT>0){const far=sp.filter(q=>Math.hypot(q.x-ai.loopAt.x,q.z-ai.loopAt.z)>9*T);if(far.length)sp=far;}ai.wander=sp[rnd()*sp.length|0];}}g=[Math.floor(ai.wander.x/T),Math.floor((ai.wander.y+1)/T),Math.floor(ai.wander.z/T)];}
    // don't undo a climb or a drop straight away: for 12 s, jumps / drops back to (near) the cells just left are off the route
    ai.left=(ai.left||[]).filter(q=>world.time-q.t<12);
    const skip=ai.left.length?(e,x,y,z)=>e.type!=='walk'&&e.type!=='step'&&e.j!==y&&ai.left.some(q=>q.j===e.j&&Math.abs(q.i-e.i)+Math.abs(q.k-e.k)<=3):null;
    ai.goalPt=null;ai.path=findPath(ci,cj,ck,g[0],g[1],g[2],skip);
    // like a person: walk round rather than climb over, unless going round is much longer
    if(window.AI_DETOUR!==false&&ai.path&&ai.path.length&&ai.path.some(n=>n.type==='jump'||n.type==='gap')){
      const alt=findPath(ci,cj,ck,g[0],g[1],g[2],(e,x,y,z)=>e.type==='jump'||e.type==='gap'||e.type==='fall'||(skip?skip(e,x,y,z):false));
      const end=q=>q[q.length-1],a1=end(ai.path),a2=alt&&alt.length&&end(alt);
      if(a2&&a2.i===a1.i&&a2.j===a1.j&&a2.k===a1.k&&alt.length<=ai.path.length*1.6+5)ai.path=alt;}ai.navVer=nav.ver;ai.replan=.6+rnd()*.3;
    if(ai.path&&ai.path.length===0){ai.kickGoal=null;ai.medGoal=null;ai.roam=4+rnd()*3;ai.newRoam=true;ai.replan=0;}
  }
  let mvx=0,mvz=0;
  let fight=see&&t&&ai.acquire<=0&&Math.abs(dy)<70&&!ai.kickGoal&&!ai.medGoal;
  if(fight)ai.fightHold=.6;else if(t&&t.alive&&ai.fightHold>0&&!ai.kickGoal&&!ai.medGoal){ai.fightHold-=dt;fight=true;} // don't flip modes on a one-frame glimpse
  if(cov)fight=false; // heading for / sitting in cover: still aiming and shooting, but not strafing in the open
  if(cov&&cov.mv){mvx=cov.mv[0];mvz=cov.mv[1];}
  else if(fight){
    b.aimT=Math.max(b.aimT||0,.5); // weapon up with both hands while fighting
    ai.strafeT-=dt;if(ai.strafeT<=0){ai.strafeT=1.1+rnd()*1.8;const r=rnd();ai.strafe=r<.18?0:r<.59?-1:1;}
    const tx=(t.x-b.x)/(dist||1),tz=(t.z-b.z)/(dist||1);
    const pref=b.weapon==='shotgun'?[110,260]:b.weapon==='rifle'?[180,520]:[200,500];
    if(dist>pref[1]+40)ai.fwdW=1;else if(dist<pref[0]-30)ai.fwdW=-1;else if(dist>pref[0]+30&&dist<pref[1]-40)ai.fwdW=0;
    if(b.hp<35)ai.fwdW=-1; // badly hurt and no cover: back off rather than push
    const fwdW=(ai.fwdW||0)*.8;
    mvx=-tz*ai.strafe+tx*fwdW;mvz=tx*ai.strafe+tz*fwdW;
    // don't walk off ledges while strafing: pick the other side and stick with it for a while
    const l=Math.hypot(mvx,mvz)||1,px=b.x+mvx/l*26,pz=b.z+mvz/l*26;
    if((mvx||mvz)&&!solid(tileAt(px,b.y-4,pz))&&!solid(tileAt(px,b.y-36,pz))){ai.strafe=ai.strafe?-ai.strafe:1;ai.fwdW=0;ai.strafeT=Math.max(ai.strafeT,1);mvx=-tz*ai.strafe;mvz=tx*ai.strafe;}
    if(think&&ai.strafe&&rnd()<.03&&b.grounded)c.jump=true;
    c.noVault=true;
    if(think&&ai.strafe&&(b.hitX||b.hitZ)){ai.strafe=-ai.strafe;ai.strafeT=Math.max(ai.strafeT,1);}
  }else if(ai.path&&ai.path.length){
    const p=ai.path;
    if(onNode)while(p.length&&p[0].i===ci&&p[0].j===cj&&p[0].k===ck){const q=p.shift();if(q.type!=='walk'&&q.type!=='step'&&q.fj!==q.j)(ai.left||(ai.left=[])).push({i:q.fi,j:q.fj,k:q.fk,t:world.time});}
    if(onNode&&p.length&&Math.abs(p[0].fi-ci)+Math.abs(p[0].fj-cj)+Math.abs(p[0].fk-ck)>1)ai.replan=0;
    const n=p[0];
    if(n){
      const nx=n.i*T+T/2,nz=n.k*T+T/2,fx=n.fi*T+T/2,fz=n.fk*T+T/2;
      if(n.type==='walk'||n.type==='step'||n.type==='fall'){
        const gp=ai.goalPt,gd=gp?Math.hypot(gp.x-b.x,gp.z-b.z):0;
        if(think||!gp||gd<14||n.type!=='walk'||!b.grounded){
          let tg=n;
          if(b.grounded&&n.type==='walk'&&n.j===cj)for(let q=1;q<Math.min(p.length,8);q++){const m=p[q];if(m.type!=='walk'||m.j!==cj||!walkClear(b,m.i*T+T/2,m.k*T+T/2))break;tg=m;}
          ai.goalPt={x:tg.i*T+T/2,z:tg.k*T+T/2};
        }
        mvx=ai.goalPt.x-b.x;mvz=ai.goalPt.z-b.z;
      }
      else{ // gap / ledge jump: line up on the take-off block, then go
        const off=Math.hypot(fx-b.x,fz-b.z);
        if(b.grounded&&off>7&&ai.jumpWait<=0){mvx=fx-b.x;mvz=fz-b.z;}
        else{mvx=nx-b.x;mvz=nz-b.z;if(b.grounded&&ai.jumpWait<=0){c.jump=true;ai.hold=.6;ai.jumpWait=.4;}c.grab=true;if(n.type==='gap')c.sprint=b.stam>.1;}
      }
      const far=p.length>4;
      if(n.type!=='jump'&&far&&b.stam>.3)ai.sprintT=1;
      if(ai.sprintT>0&&b.stam>.05&&n.type!=='jump'&&n.type!=='step'&&!(p[1]&&p[1].type==='step'&&Math.hypot(nx-b.x,nz-b.z)<T*1.5))c.sprint=true; // no sprint into a step: it would vault over instead of up
    }else if(t){mvx=t.x-b.x;mvz=t.z-b.z;}
  }
  ai.jumpWait-=dt;ai.roam=(ai.roam||0)-dt;ai.sprintT=(ai.sprintT||0)-dt;
  // stuck detection
  ai.stuckT+=dt;
  if(ai.stuckT>1.4){
    if(Math.hypot(b.x-ai.last.x,b.y-ai.last.y,b.z-ai.last.z)<10&&!see&&(mvx||mvz)){c.jump=true;ai.hold=.4;ai.flip=.5;ai.replan=0;}
    ai.stuckT=0;ai.last=V(b.x,b.y,b.z);
  }
  if(dip&&(!fight||dip.close||dip.stay)&&!dip.path){if(dip.stay){mvx=0;mvz=0;}else if(dip.goal&&Math.hypot(dip.goal.x-b.x,dip.goal.z-b.z)<240){mvx=dip.goal.x-b.x;mvz=dip.goal.z-b.z;if(Math.hypot(mvx,mvz)<10){mvx=0;mvz=0;}}}
  if(ai.flip>0){ai.flip-=dt;const t2=mvx;mvx=-mvz;mvz=t2;}
  {const l=Math.hypot(mvx,mvz),dx=l>0?mvx/l:0,dz=l>0?mvz/l:0;
   const nn=ai.path&&ai.path[0],precise=(!fight&&nn&&(nn.type==='jump'||nn.type==='gap'))||ai.flip>0;
   const k=Math.min(1,dt*(precise?20:fight?3.5:7));
   ai.mvx=(ai.mvx||0)+(dx-(ai.mvx||0))*k;ai.mvz=(ai.mvz||0)+(dz-(ai.mvz||0))*k;
   c.mx=ai.mvx;c.mz=ai.mvz;}
  // kick the world
  if(t&&see&&!peaceful&&b.state==='normal'&&b.kickCD<=0&&Math.hypot(t.x-b.x,t.z-b.z)<44&&Math.abs(t.y-b.y)<40&&rnd()<dt*4){c.kick=true;}
  if((b.grounded||b.wasBox)&&world.rotCD<=0&&!world.rot&&b.kickPrompt&&(ai.kickGoal||rnd()<dt*.9)){c.kick=true;ai.kickGoal=null;}
  if(ai.hold>0){ai.hold-=dt;c.jumpHeld=true;}else c.jumpHeld=false;
  if(!c.grab)c.noGrab=true; // bots only reach for a ledge when their route jumps to one
}

// straight walk from b to (x,z) on b's level: floor under every step, nothing in the way at body height
function walkClear(b,x,z){
  const dx=x-b.x,dz=z-b.z,l=Math.hypot(dx,dz),n=Math.ceil(l/10);
  for(let s=1;s<=n;s++){
    const px=b.x+dx*s/n,pz=b.z+dz*s/n;
    for(const [ox,oz] of [[-9,-9],[9,-9],[-9,9],[9,9]])if(!solid(tileAt(px+ox,b.y-4,pz+oz)))return false;
    if(overlapSolid(px,b.y+3,pz,b.w+4,b.h-6))return false;
  }
  return true;
}
