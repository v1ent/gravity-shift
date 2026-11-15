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
function botThink(b,dt){
  const c=b.ctl;
  c.swap=false;c.select=null;c.mx=0;c.mz=0;c.jump=false;c.fire=false;c.alt=false;c.kick=false;c.reload=false;c.crouch=false;c.crouchPressed=false;c.sprint=false;c.grab=false;
  if(!b.alive){b.ai=null;return;}
  const ai=b.ai||(b.ai={known:null,acquire:0,lostT:0,lastSeen:null,alert:null,alertT:0,yaw:b.yaw,pitch:0,errT:0,ex:0,ey:0,ez:0,burst:0,pause:0,path:null,replan:0,stuckT:0,last:V(b.x,b.y,b.z),flip:0,hold:0,strafe:1,strafeT:0,skill:BOT_CFG.skill[0]+rnd()*(BOT_CFG.skill[1]-BOT_CFG.skill[0]),rocketT:(2+rnd()*3)/BOT_CFG.rocket,jumpWait:0,scanT:0});
  const eye=headPos(b);
  // ---- perception: 120° view cone + line of sight; very close = sensed anyway; gunfire and hits are heard
  const look=fwdOf(ai.yaw,ai.pitch*.5);
  const canSee=o=>{
    if(!o.alive||o===b||o.vis<.35)return false;
    const tc=chestPos(o),v=vsub(tc,eye),l=vlen(v)||1;
    if(l>1500)return false;
    if(l>70&&vdot(v,look)/l<BOT_FOV_COS)return false;
    return losClear(eye,tc)||losClear(eye,headPos(o));
  };
  if(ai.known&&(!ai.known.alive))ai.known=null;
  let see=false;
  if(ai.known){see=canSee(ai.known);if(see){ai.lostT=0;ai.lastSeen=V(ai.known.x,ai.known.y,ai.known.z);}else{ai.lostT+=dt;if(ai.lostT>3){ai.known=null;}}}
  if(!see){ // look for someone new in the cone
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
  if(b.hitFrom&&world.time-b.hitFrom.t<.1){if(!see){ai.alert=b.hitFrom.p;ai.alertT=4;}b.hitFrom=null;}
  ai.alertT-=dt;if(ai.alertT<=0)ai.alert=null;
  const t=ai.known;
  const dist=t?Math.hypot(t.x-b.x,t.z-b.z):1e9,dy=t?t.y-b.y:0;
  // ---- aim: nothing until the reaction time is over, then a limited turn rate
  ai.errT-=dt;if(ai.errT<=0){ai.errT=.4+rnd()*.4;const e=(1.2-ai.skill)*(30+dist*.05);ai.ex=(rnd()-.5)*e;ai.ey=(rnd()-.5)*e;ai.ez=(rnd()-.5)*e;}
  if(see&&ai.acquire>0)ai.acquire-=dt;
  let ap=null,turn=BOT_TURN*.6;
  if(t&&see&&ai.acquire<=0){const ch=chestPos(t);ap=V(ch.x+t.vx*.12+ai.ex,ch.y+t.vy*.05+ai.ey,ch.z+t.vz*.12+ai.ez);turn=BOT_TURN;}
  else if(t&&see&&ai.acquire>0){ap=vadd(eye,vscale(fwdOf(ai.yaw,ai.pitch),200));turn=0;} // still reacting: gaze holds
  else if(t&&!see&&ai.lastSeen)ap=V(ai.lastSeen.x,ai.lastSeen.y+44,ai.lastSeen.z);
  else if(!t&&ai.alert)ap=V(ai.alert.x,ai.alert.y+30,ai.alert.z);
  else if(!see&&ai.path&&ai.path[0]){const n=ai.path[0];ap=V(n.i*T+T/2,b.y+44,n.k*T+T/2);}
  if(!ap){ // idle scan: glance around now and then
    ai.scanT-=dt;if(ai.scanT<=0){ai.scanT=1.5+rnd()*2;ai.scanYaw=ai.yaw+(rnd()-.5)*2.4;}
    ap=vadd(eye,vscale(fwdOf(ai.scanYaw!==undefined?ai.scanYaw:ai.yaw,0),200));
  }
  let wantRocket=false;ai.rocketT-=dt;
  if(t&&see&&ai.acquire<=0&&b.rockets>0&&b.rreload<=0&&dist>170&&dist<850&&ai.rocketT<=0){wantRocket=true;ap=V(t.x,t.y+4,t.z);}
  const d=vsub(ap,eye),dl=vlen(d)||1;
  const ty=yawOf(d.x,d.z),tp=Math.asin(clamp(d.y/dl,-1,1));
  ai.yaw+=clamp(angDiff(ty,ai.yaw),-turn*dt,turn*dt);ai.pitch+=clamp(tp-ai.pitch,-turn*.8*dt,turn*.8*dt);
  c.aimYaw=ai.yaw;c.aimPitch=ai.pitch;b.aimPoint=vadd(eye,vscale(fwdOf(ai.yaw,ai.pitch),dl));
  // ---- shoot once the sights are actually on target
  const loose=b.weapon==='shotgun'?.16:.09;
  const onTarget=Math.abs(angDiff(ty,ai.yaw))<loose&&Math.abs(tp-ai.pitch)<loose+.03;
  const range=b.weapon==='shotgun'?560:1100;
  if(see&&t&&ai.acquire<=0&&onTarget&&dist<range){
    if(wantRocket){c.alt=true;ai.rocketT=(3+rnd()*4)/BOT_CFG.rocket;}
    else if(ai.pause>0)ai.pause-=dt;
    else{c.fire=true;ai.burst+=dt;if(ai.burst>(.9+rnd()*.7)*BOT_CFG.burst){ai.burst=0;ai.pause=(.6+rnd()*.6)*BOT_CFG.pause;}}
  }
  if(b.hasShotgun&&t&&see){const want=dist<420?'shotgun':'pistol';if(b.weapon!==want&&b.fireCD<=0)c.select=want;}
  if(b.ammo<4&&!see)c.reload=true;
  if(b.state==='hang'){c.grab=true;c.jump=rnd()<dt*4;return;}
  if(b.state!=='normal')return;
  // ---- path planning ----
  ai.replan-=dt;
  const [ci,cj,ck]=cellOf(b);
  const onNode=b.grounded&&nav&&nav.adj.has(ni(ci,cj,ck));
  if(onNode&&(ai.replan<=0||!ai.path||ai.navVer!==nav.ver)){
    let g=null;ai.medGoal=null;
    if(b.hp<55){let bd=1e9;for(const m of props){if(m.kind!=='medkit'||!m.grounded||m.dead)continue;const q=[Math.floor(m.x/T),Math.floor((m.y+1)/T),Math.floor(m.z/T)];const dd=Math.abs(q[0]-ci)+Math.abs(q[1]-cj)+Math.abs(q[2]-ck);if(dd<bd){bd=dd;g=q;}}if(g&&bd<30)ai.medGoal=g;else g=null;}
    if(!g&&!see&&!b.hasShotgun){let bd=1e9,bq=null;for(const m of props){if(m.kind!=='shotgun'||m.dead)continue;const q=[Math.floor(m.x/T),Math.floor((m.y+1)/T),Math.floor(m.z/T)];const dd=Math.abs(q[0]-ci)+Math.abs(q[1]-cj)+Math.abs(q[2]-ck);if(dd<bd){bd=dd;bq=q;}}if(bq&&bd<22){g=bq;ai.medGoal=bq;}}
    if(!g&&world.rotCD<=0&&!world.rot&&!ai.kickGoal&&nav.kickCells.length&&rnd()<.25){let bd=1e9,bk=null;for(const q of nav.kickCells){const dd=Math.abs(q.i-ci)+Math.abs(q.j-cj)+Math.abs(q.k-ck);if(dd<bd){bd=dd;bk=q;}}if(bd<26)ai.kickGoal=bk;}
    if(ai.kickGoal&&(world.rotCD>0||world.rot))ai.kickGoal=null;
    if(!g&&ai.kickGoal)g=[ai.kickGoal.i,ai.kickGoal.j,ai.kickGoal.k];
    if(ai.roam>0)g=null; // target unreachable recently: roam somewhere else for a bit
    else if(!g&&t&&see)g=cellOf(t);
    else if(!g&&t&&ai.lastSeen)g=[Math.floor(ai.lastSeen.x/T),Math.floor((ai.lastSeen.y+1)/T),Math.floor(ai.lastSeen.z/T)];
    else if(!g&&ai.alert)g=[Math.floor(ai.alert.x/T),Math.floor((ai.alert.y+1)/T),Math.floor(ai.alert.z/T)];
    if(!g){if(!ai.wander||rnd()<.03||ai.newRoam){ai.newRoam=false;const sp=spawnPoints();ai.wander=sp[rnd()*sp.length|0];}g=[Math.floor(ai.wander.x/T),Math.floor((ai.wander.y+1)/T),Math.floor(ai.wander.z/T)];}
    ai.path=findPath(ci,cj,ck,g[0],g[1],g[2]);ai.navVer=nav.ver;ai.replan=.6+rnd()*.3;
    if(ai.path&&ai.path.length===0){ai.kickGoal=null;ai.medGoal=null;ai.roam=4+rnd()*3;ai.newRoam=true;ai.replan=0;}
  }
  let mvx=0,mvz=0;
  const fight=see&&t&&ai.acquire<=0&&Math.abs(dy)<70&&!ai.kickGoal&&!ai.medGoal;
  if(fight){
    ai.strafeT-=dt;if(ai.strafeT<=0){ai.strafeT=.5+rnd()*1.2;ai.strafe=rnd()<.5?-1:1;}
    const tx=(t.x-b.x)/(dist||1),tz=(t.z-b.z)/(dist||1);
    const pref=b.weapon==='shotgun'?[110,260]:[200,500];
    const fwdW=dist>pref[1]?1:dist<pref[0]?-1:0;
    mvx=-tz*ai.strafe+tx*fwdW;mvz=tx*ai.strafe+tz*fwdW;
    // don't walk off ledges while strafing
    const l=Math.hypot(mvx,mvz)||1,px=b.x+mvx/l*22,pz=b.z+mvz/l*22;
    if(!solid(tileAt(px,b.y-4,pz))&&!solid(tileAt(px,b.y-36,pz))){mvx=-mvx;mvz=-mvz;ai.strafe*=-1;}
    if(rnd()<dt*.25&&b.grounded)c.jump=true;
  }else if(ai.path&&ai.path.length){
    const p=ai.path;
    if(onNode)while(p.length&&p[0].i===ci&&p[0].j===cj&&p[0].k===ck)p.shift();
    if(onNode&&p.length&&Math.abs(p[0].fi-ci)+Math.abs(p[0].fj-cj)+Math.abs(p[0].fk-ck)>1)ai.replan=0;
    const n=p[0];
    if(n){
      const nx=n.i*T+T/2,nz=n.k*T+T/2,fx=n.fi*T+T/2,fz=n.fk*T+T/2;
      if(n.type==='walk'||n.type==='step'||n.type==='fall'){mvx=nx-b.x;mvz=nz-b.z;}
      else{ // gap / ledge jump: line up on the take-off block, then go
        const off=Math.hypot(fx-b.x,fz-b.z);
        if(b.grounded&&off>7&&ai.jumpWait<=0){mvx=fx-b.x;mvz=fz-b.z;}
        else{mvx=nx-b.x;mvz=nz-b.z;if(b.grounded&&ai.jumpWait<=0){c.jump=true;ai.hold=.6;ai.jumpWait=.4;}c.grab=true;if(n.type==='gap')c.sprint=b.stam>.1;}
      }
      const far=p.length>4;
      if(n.type!=='jump'&&far&&b.stam>.3)c.sprint=true;
    }else if(t){mvx=t.x-b.x;mvz=t.z-b.z;}
  }
  ai.jumpWait-=dt;ai.roam=(ai.roam||0)-dt;
  // stuck detection
  ai.stuckT+=dt;
  if(ai.stuckT>1.4){
    if(Math.hypot(b.x-ai.last.x,b.y-ai.last.y,b.z-ai.last.z)<10&&!see&&(mvx||mvz)){c.jump=true;ai.hold=.4;ai.flip=.5;ai.replan=0;}
    ai.stuckT=0;ai.last=V(b.x,b.y,b.z);
  }
  if(ai.flip>0){ai.flip-=dt;const t2=mvx;mvx=-mvz;mvz=t2;}
  const l=Math.hypot(mvx,mvz);if(l>0){c.mx=mvx/l;c.mz=mvz/l;}
  // kick the world
  if(t&&see&&b.state==='normal'&&b.kickCD<=0&&Math.hypot(t.x-b.x,t.z-b.z)<44&&Math.abs(t.y-b.y)<40&&rnd()<dt*4){c.kick=true;}
  if((b.grounded||b.wasBox)&&world.rotCD<=0&&!world.rot&&b.kickPrompt&&(ai.kickGoal||rnd()<dt*.9)){c.kick=true;ai.kickGoal=null;}
  if(ai.hold>0){ai.hold-=dt;c.jumpHeld=true;}else c.jumpHeld=false;
}
