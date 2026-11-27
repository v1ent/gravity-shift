// =====================================================================
//  ALLIANCES — press T to wave. Someone who stands in front of a waving
//  fighter and presses T too: both bow, and the one who waved first takes
//  the other's colour and joins them. Allies don't target each other
//  (friendly fire still hurts), the team scores its best member's frags, and it
//  wins together. Teams last until the end of the round. The last fighter
//  standing alone can never be absorbed: there must always be two sides.
// =====================================================================
const WAVE_T=6,BOW_T=2.6,ALLY_RANGE=120;
const allied=(a,b)=>!!a&&!!b&&a!==b&&!!a.team&&a.team===b.team;
const sideMembers=e=>e.team?chars.filter(c=>c.team===e.team):[e];
const sideScore=e=>Math.max(...sideMembers(e).map(c=>c.kills)); // a team scores its best member's frags
const sideCount=()=>new Set(chars.map(c=>c.team||c)).size;
function sideName(e){return e.team?sideMembers(e).map(c=>c.name).join('+'):e.name;}
// the side in front (strictly ahead on frags), or null
function leaderSide(){let best=null,bs=-1,tie=false;const seen=new Set();
  for(const c of chars){const k=c.team||c;if(seen.has(k))continue;seen.add(k);const s=sideScore(c);if(s>bs){bs=s;best=c;tie=false;}else if(s===bs)tie=true;}
  return tie||bs<=0?null:best;}
const isLeader=e=>{const l=leaderSide();return !!l&&(l===e||allied(l,e));};
// can these two become allies? (not both already in teams; at least two sides must remain)
function canAlly(a,b){
  if(!a||!b||a===b||!a.alive||!b.alive||allied(a,b))return false;
  if(a.team&&b.team)return false;
  return sideCount()-1>=2;
}
// b stands in front of a and faces it, close enough
function inFrontOf(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d>ALLY_RANGE||Math.abs(b.y-a.y)>26||d<1)return false;
  const fa=Math.cos(angDiff(Math.atan2(dx,dz),a.bodyYaw)),fb=Math.cos(angDiff(Math.atan2(-dx,-dz),b.yaw));
  return fa>Math.cos(1.2)&&fb>Math.cos(1.0);
}
// someone waving that e (pressing T) answers
function wavePartner(e){
  let best=null,bd=1e9;
  for(const o of chars){if(o===e||!o.alive||!o.emote||o.emote.kind!=='wave')continue;
    if(!inFrontOf(o,e)||!canAlly(o,e))continue;const d=Math.hypot(o.x-e.x,o.z-e.z);if(d<bd){bd=d;best=o;}}
  return best;
}
function startWave(e){e.emote={kind:'wave',t:0,id:Math.random()};
  // bots that can see it think about it straight away (a short reaction, not their usual slow rhythm)
  for(const o of chars)if(o.ai&&o!==e&&Math.hypot(o.x-e.x,o.z-e.z)<700)o.ai.dipCD=Math.min(o.ai.dipCD||9,.25+rnd()*.45);
if(e===player)feed.unshift({t:3.5,text:keyText('YOU WAVE — an enemy who stands in front of you and presses {wave} becomes your ally'),color:'#ccd'});}
function startBow(init,resp){
  const face=(a,b)=>{a.yaw=a.bodyYaw=a.legYaw=Math.atan2(b.x-a.x,b.z-a.z);};
  face(init,resp);face(resp,init);
  init.emote={kind:'bow',t:0,partner:resp,init:true};resp.emote={kind:'bow',t:0,partner:init,init:false};
  for(const e of [init,resp]){e.vx*=.2;e.vz*=.2;e.sprinting=false;}
}
function formAlliance(init,resp){
  // the one who waved first joins the other (or, if it already leads a team, the other joins it)
  let team=resp.team||init.team;
  if(!team){team={id:Math.random(),color:resp.color,col:resp.col.slice()};resp.team=team;}
  for(const e of [init,resp]){e.team=team;e.color=team.color;e.col=team.col.slice();}
  feed.unshift({t:5,text:`⚑ ${init.name} + ${resp.name} — ALLIANCE`,color:team.color});
  sfx('pickup',init);
  for(const e of [init,resp])for(let i=0;i<16;i++)addPart(e.x,e.y+40,e.z,(rnd()-.5)*160,rnd()*160,(rnd()-.5)*160,.7,team.col,3,'spark');
}
// called from updateChar each step, before the controls are used
function updateEmote(e,c,ctrl,dt){
  if(!e.alive){e.emote=null;return;}
  if(ctrl&&c.wave&&!e.emote&&e.state==='normal'&&e.grounded){const w=wavePartner(e);if(w)startBow(w,e);else startWave(e);c.wave=false;}
  const m=e.emote;if(!m)return;
  m.t+=dt;
  if(e.state!=='normal'){e.emote=null;return;}
  if(m.kind==='wave'){
    // a player calls the wave off by doing something else; a bot's wave runs its course (its AI ends it if it must)
    const busy=ctrl&&!e.isBot&&(Math.hypot(c.mx,c.mz)>.2||c.fire||c.alt||c.jump||c.kick||c.dodge);
    if(busy||m.t>WAVE_T){e.emote=null;return;}
  }else{ // bowing: locked in place, facing the partner
    const p=m.partner;
    if(!p||!p.alive||!p.emote||p.emote.kind!=='bow'){e.emote=null;return;}
    e.yaw=e.bodyYaw=e.legYaw=Math.atan2(p.x-e.x,p.z-e.z);
    if(m.init&&m.t>=BOW_T){if(canAlly(e,p))formAlliance(e,p);e.emote=null;p.emote=null;return;}
  }
  // while emoting the hands are busy: no moving, shooting, jumping, kicking
  c.mx=0;c.mz=0;c.fire=false;c.fireClick=false;c.rocketClick=false;c.alt=false;c.aim=false;c.jump=false;c.kick=false;c.dodge=null;c.sprint=false;
}

// ---------- bots: offering and accepting alliances ----------
function botDiplomacy(b,ai,dt,see,t){
  const c=b.ctl;
  ai.dipCD=(ai.dipCD||2+rnd()*3)-dt;
  const d=ai.dip;
  if(d){
    const o=d.target;
    // gave up, got shot by them, or it's no longer possible
    // the one you're offering to waves first: just answer it
    if(d.role==='offer'&&o.emote&&o.emote.kind==='wave'&&!(b.emote&&b.emote.kind==='wave')&&canAlly(o,b)){d.role='accept';d.until=world.time+WAVE_T+1.5;}
    const shotByThem=b.lastHit===o&&world.time-b.lastHitT<.5&&!(b.emote&&b.emote.kind==='bow');
    if(!o.alive||world.time>d.until||shotByThem||!canAlly(o,b)&&!(b.emote&&b.emote.kind==='bow')){if(b.emote&&b.emote.kind==='wave')b.emote=null;ai.dip=null;ai.dipCD=8+rnd()*6;return null;}
    if(b.emote&&b.emote.kind==='bow')return {stay:true};
    let goal;
    if(d.role==='accept'){
      if(!o.emote||o.emote.kind!=='wave'){ai.dip=null;ai.dipCD=6;return null;}
      goal=V(o.x+Math.sin(o.bodyYaw)*70,o.y,o.z+Math.cos(o.bodyYaw)*70);
      const gd=Math.hypot(goal.x-b.x,goal.z-b.z);
      if(gd<30&&inFrontOf(o,b))c.wave=true;
      if(gd<90)return {goal,face:o,close:true};
    }else{ // offering: walk up to them, then wave and wait
      goal=V(o.x,o.y,o.z);
      if(b.emote&&b.emote.kind==='wave')return {stay:true,face:o};
      if(d.waved){ai.dip=null;ai.dipCD=10+rnd()*8;ai.holdFire=world.time+1;return null;} // waved, nobody answered (a beat before it turns hostile again)
      const dd=Math.hypot(o.x-b.x,o.z-b.z);if(dd>220)return {path:o};
      if(dd<260&&losClear(headPos(b),headPos(o))){if(Math.abs(angDiff(Math.atan2(o.x-b.x,o.z-b.z),b.bodyYaw))<.5&&Math.hypot(b.vx,b.vz)<25){c.wave=true;d.waved=true;d.until=world.time+WAVE_T+1;}return {stay:true,face:o};} // the answer window starts when it actually waves
    }
    return {goal,face:o};
  }
  if(ai.dipCD>0||b.emote)return null;
  ai.dipCD=2.5+rnd()*2;
  // answer someone's wave
  for(const o of chars){
    if(o===b||!o.emote||o.emote.kind!=='wave'||!canAlly(o,b)||ai.dipSeen===o.emote.id)continue;
    const dist=Math.hypot(o.x-b.x,o.z-b.z);if(dist>520||!losClear(headPos(b),headPos(o)))continue;
    ai.dipSeen=o.emote.id;
    const p=isLeader(o)?.12:isLeader(b)?.2:.65;
    if(rnd()<p){ai.dip={target:o,role:'accept',until:world.time+WAVE_T+1.5};return null;}
  }
  // offer an alliance to someone nearby who isn't winning (gang up on the leader)
  if(!isLeader(b)&&rnd()<.3){
    let best=null,bd=1e9;
    for(const o of chars){if(o===b||!canAlly(b,o)||isLeader(o))continue;const dist=Math.hypot(o.x-b.x,o.y-b.y,o.z-b.z);if(dist<750&&dist<bd){bd=dist;best=o;}}
    if(best)ai.dip={target:best,role:'offer',until:world.time+9};
  }
  return null;
}
