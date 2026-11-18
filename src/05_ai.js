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
  c.swap=false;c.select=null;c.mx=0;c.mz=0;c.jump=false;c.fire=false;c.alt=false;c.kick=false;c.reload=false;c.crouch=false;c.crouchPressed=false;c.sprint=false;c.grab=false;c.dodge=null;
  if(!b.alive){b.ai=null;return;}
  const ai=b.ai||(b.ai={known:null,acquire:0,lostT:0,lastSeen:null,alert:null,alertT:0,yaw:b.yaw,pitch:0,errT:0,ex:0,ey:0,ez:0,burst:0,pause:0,path:null,replan:0,stuckT:0,last:V(b.x,b.y,b.z),flip:0,hold:0,strafe:1,strafeT:0,skill:BOT_CFG.skill[0]+rnd()*(BOT_CFG.skill[1]-BOT_CFG.skill[0]),rocketT:(2+rnd()*3)/BOT_CFG.rocket,jumpWait:0,scanT:0});
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
  if(see&&t&&ai.acquire<=0&&onTarget&&dist<range){
    if(wantRocket){c.alt=true;ai.rocketT=(3+rnd()*4)/BOT_CFG.rocket;}
    else if(ai.pause>0)ai.pause-=dt;
    else{c.fire=true;ai.burst+=dt;if(ai.burst>(.9+rnd()*.7)*BOT_CFG.burst){ai.burst=0;ai.pause=(.6+rnd()*.6)*BOT_CFG.pause;}}
  }
  if((b.hasShotgun||b.hasRifle)&&t&&see){const want=b.hasShotgun&&dist<420?'shotgun':b.hasRifle?'rifle':'pistol';if(b.weapon!==want&&b.fireCD<=0)c.select=want;}
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
    if(!g&&!see&&(!b.hasShotgun||!b.hasRifle)){let bd=1e9,bq=null;for(const m of props){if(m.dead||!((m.kind==='shotgun'&&!b.hasShotgun)||(m.kind==='rifle'&&!b.hasRifle)))continue;const q=[Math.floor(m.x/T),Math.floor((m.y+1)/T),Math.floor(m.z/T)];const dd=Math.abs(q[0]-ci)+Math.abs(q[1]-cj)+Math.abs(q[2]-ck);if(dd<bd){bd=dd;bq=q;}}if(bq&&bd<22){g=bq;ai.medGoal=bq;}}
    if(!g&&world.rotCD<=0&&!world.rot&&!ai.kickGoal&&nav.kickCells.length&&rnd()<.25){let bd=1e9,bk=null;for(const q of nav.kickCells){const dd=Math.abs(q.i-ci)+Math.abs(q.j-cj)+Math.abs(q.k-ck);if(dd<bd){bd=dd;bk=q;}}if(bd<26)ai.kickGoal=bk;}
    if(ai.kickGoal&&(world.rotCD>0||world.rot))ai.kickGoal=null;
    if(!g&&ai.kickGoal)g=[ai.kickGoal.i,ai.kickGoal.j,ai.kickGoal.k];
    if(!g&&ai.dip&&!see)g=cellOf(ai.dip.target); // heading over to offer / accept an alliance
    if(ai.roam>0)g=null; // target unreachable recently: roam somewhere else for a bit
    else if(!g&&t&&see)g=cellOf(t);
    else if(!g&&t&&ai.lastSeen)g=[Math.floor(ai.lastSeen.x/T),Math.floor((ai.lastSeen.y+1)/T),Math.floor(ai.lastSeen.z/T)];
    else if(!g&&ai.alert)g=[Math.floor(ai.alert.x/T),Math.floor((ai.alert.y+1)/T),Math.floor(ai.alert.z/T)];
    if(!g){if(!ai.wander||rnd()<.03||ai.newRoam){ai.newRoam=false;
      // hunt: half the time head for somewhere near a living rival (you can hear a fight through the walls), else wander
      const rivals=chars.filter(o=>o!==b&&o.alive);
      if(rivals.length&&rnd()<.5){const o=rivals[rnd()*rivals.length|0],sp=spawnPoints().filter(q=>Math.hypot(q.x-o.x,q.y-o.y,q.z-o.z)<260);ai.wander=sp.length?sp[rnd()*sp.length|0]:{x:o.x,y:o.y,z:o.z};}
      else{const sp=spawnPoints();ai.wander=sp[rnd()*sp.length|0];}}g=[Math.floor(ai.wander.x/T),Math.floor((ai.wander.y+1)/T),Math.floor(ai.wander.z/T)];}
    ai.goalPt=null;ai.path=findPath(ci,cj,ck,g[0],g[1],g[2]);ai.navVer=nav.ver;ai.replan=.6+rnd()*.3;
    if(ai.path&&ai.path.length===0){ai.kickGoal=null;ai.medGoal=null;ai.roam=4+rnd()*3;ai.newRoam=true;ai.replan=0;}
  }
  let mvx=0,mvz=0;
  let fight=see&&t&&ai.acquire<=0&&Math.abs(dy)<70&&!ai.kickGoal&&!ai.medGoal;
  if(fight)ai.fightHold=.6;else if(t&&t.alive&&ai.fightHold>0&&!ai.kickGoal&&!ai.medGoal){ai.fightHold-=dt;fight=true;} // don't flip modes on a one-frame glimpse
  if(fight){
    b.aimT=Math.max(b.aimT||0,.5); // weapon up with both hands while fighting
    ai.strafeT-=dt;if(ai.strafeT<=0){ai.strafeT=1.1+rnd()*1.8;const r=rnd();ai.strafe=r<.18?0:r<.59?-1:1;}
    const tx=(t.x-b.x)/(dist||1),tz=(t.z-b.z)/(dist||1);
    const pref=b.weapon==='shotgun'?[110,260]:b.weapon==='rifle'?[180,520]:[200,500];
    if(dist>pref[1]+40)ai.fwdW=1;else if(dist<pref[0]-30)ai.fwdW=-1;else if(dist>pref[0]+30&&dist<pref[1]-40)ai.fwdW=0;
    const fwdW=(ai.fwdW||0)*.8;
    mvx=-tz*ai.strafe+tx*fwdW;mvz=tx*ai.strafe+tz*fwdW;
    // don't walk off ledges while strafing: pick the other side and stick with it for a while
    const l=Math.hypot(mvx,mvz)||1,px=b.x+mvx/l*26,pz=b.z+mvz/l*26;
    if((mvx||mvz)&&!solid(tileAt(px,b.y-4,pz))&&!solid(tileAt(px,b.y-36,pz))){ai.strafe=ai.strafe?-ai.strafe:1;ai.fwdW=0;ai.strafeT=Math.max(ai.strafeT,1);mvx=-tz*ai.strafe;mvz=tx*ai.strafe;}
    if(think&&ai.strafe&&rnd()<.03&&b.grounded)c.jump=true;
  }else if(ai.path&&ai.path.length){
    const p=ai.path;
    if(onNode)while(p.length&&p[0].i===ci&&p[0].j===cj&&p[0].k===ck)p.shift();
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
      if(ai.sprintT>0&&b.stam>.05&&n.type!=='jump')c.sprint=true;
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
  if(t&&see&&b.state==='normal'&&b.kickCD<=0&&Math.hypot(t.x-b.x,t.z-b.z)<44&&Math.abs(t.y-b.y)<40&&rnd()<dt*4){c.kick=true;}
  if((b.grounded||b.wasBox)&&world.rotCD<=0&&!world.rot&&b.kickPrompt&&(ai.kickGoal||rnd()<dt*.9)){c.kick=true;ai.kickGoal=null;}
  if(ai.hold>0){ai.hold-=dt;c.jumpHeld=true;}else c.jumpHeld=false;
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
