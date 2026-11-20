// ================= main menu: pages, settings, options, music, gamepad =================
const $=id=>document.getElementById(id);
function wakeAudio(){if(!AC)initAudio();if(AC&&AC.state==='suspended')AC.resume();applyVolumes();musicStart();}
function showMenu(page){
  gameState='menu';$('tut').style.display='none';$('ov').style.display='flex';
  for(const p of document.querySelectorAll('#ov .page'))p.classList.toggle('on',p.id===page);
  if(page==='pgGame')refreshGamePage();
  padFocus=-1;padHilite();
}
// the seed shown on the GAME page: the one from Arena settings, or a fresh random one
let rndSeed=String(1000+((Math.random()*99000)|0));
function shownSeed(){return (SETTINGS.seed||'').trim()||rndSeed;}
function refreshGamePage(){
  $('seedRnd').value=shownSeed();
  const sk=BOT_SKILLS[SETTINGS.skill];
  $('setsum').textContent=`${SETTINGS.bots} bot${SETTINGS.bots===1?'':'s'} · ${sk?sk.label:SETTINGS.skill} · first to ${SETTINGS.frags} frags · you are ${playerName()}`;
}
function startArena(seed){
  wakeAudio();$('ov').style.display='none';newMatch(seed);
  if(SETTINGS.input!=='gamepad')lockMouse();
}
function startDemo(){
  wakeAudio();$('ov').style.display='none';
  newMatch((SETTINGS.seed||'').trim()||undefined,{demo:true});
}
function wireMenu(){
  for(const b of document.querySelectorAll('#ov [data-go]'))b.onclick=()=>showMenu(b.dataset.go);
  for(const b of document.querySelectorAll('#ov .arena'))b.onclick=()=>startArena(b.dataset.seed);
  $('go').onclick=()=>{const v=$('seedRnd').value.trim();startArena(v||undefined);if(!(SETTINGS.seed||'').trim())rndSeed=String(1000+((Math.random()*99000)|0));};
  $('seedRnd').oninput=()=>{SETTINGS.seed=$('seedRnd').value;$('seedIn').value=SETTINGS.seed;saveSettings();};
  $('reroll').onclick=()=>{SETTINGS.seed='';$('seedIn').value='';saveSettings();rndSeed=String(1000+((Math.random()*99000)|0));refreshGamePage();};
  $('seedIn').value=SETTINGS.seed||'';
  $('seedIn').oninput=()=>{SETTINGS.seed=$('seedIn').value;saveSettings();};
  $('pname').value=SETTINGS.name||'';
  $('pname').oninput=()=>{SETTINGS.name=$('pname').value.slice(0,12);saveSettings();};
  $('tutbtn').onclick=()=>{wakeAudio();openTutMenu();};
  $('demo').onclick=startDemo;
  $('exitbtn').onclick=()=>{musicStop();showMenu('pgBye');try{window.close();}catch(e){}};
  // options
  const opts=(el,list,get,set)=>{const draw=()=>{el.innerHTML='';for(const [v,label] of list){const b=document.createElement('button');b.className='opt'+(get()===v?' on':'');b.textContent=label;b.onclick=()=>{set(v);saveSettings();draw();};el.appendChild(b);}};draw();};
  // aim assist is a gamepad thing: with mouse + keyboard it shows OFF and can't be changed;
  // the first switch to the gamepad turns it on at 50%, after that your last gamepad choice is kept
  const drawAssist=()=>{const pad=SETTINGS.input==='gamepad',el=$('assistopt');el.innerHTML='';
    for(const [v,label] of [[false,'OFF'],[true,'ON']]){const b=document.createElement('button');const on=pad?SETTINGS.assist===v:!v;
      b.className='opt'+(on?' on':'');b.textContent=label;b.disabled=!pad;b.style.opacity=pad?'':'.45';
      b.onclick=()=>{SETTINGS.assist=v;saveSettings();drawAssist();};el.appendChild(b);}
    const sl=$('asSl');sl.disabled=!pad||!SETTINGS.assist;sl.style.opacity=sl.disabled?'.4':'';
    $('asV').textContent=pad&&SETTINGS.assist?SETTINGS.assistStr+'%':'—';
    $('asdesc').textContent=pad?'slows the look on a target, tracks and pulls toward it · RB snaps on':'gamepad only — switch Controls to Gamepad to use it';};
  opts($('ctlmode'),[['mouse','MOUSE + KEYBOARD'],['gamepad','GAMEPAD']],()=>SETTINGS.input,v=>{
    SETTINGS.input=v;if(v==='gamepad'&&!SETTINGS.padSeen){SETTINGS.padSeen=true;SETTINGS.assist=true;SETTINGS.assistStr=50;$('asSl').value=50;}drawAssist();});
  opts($('fpsopt'),[[false,'OFF'],[true,'ON']],()=>SETTINGS.fps,v=>{SETTINGS.fps=v;});
  const slider=(id,vid,key,fmt,after)=>{const sl=$(id),vv=$(vid);sl.value=SETTINGS[key];vv.textContent=fmt(SETTINGS[key]);
    sl.oninput=()=>{SETTINGS[key]=+sl.value;vv.textContent=fmt(+sl.value);saveSettings();if(after)after();};};
  slider('sensSl','sensV','sens',v=>(v/100).toFixed(2)+'×');
  slider('asSl','asV','assistStr',v=>v+'%');drawAssist();
  slider('musSl','musV','music',v=>v+'%',()=>{wakeAudio();applyVolumes();});
  slider('fxSl','fxV','fx',v=>v+'%',()=>{wakeAudio();applyVolumes();sfx('hit');});
  showMenu('pgMain');
}

// ---------- FPS counter ----------
let fpsShown=0,fpsN=0,fpsT0=0;
function fpsTick(now){fpsN++;if(now-fpsT0>=500){fpsShown=Math.round(fpsN*1000/(now-fpsT0));fpsN=0;fpsT0=now;}}
function drawFPS(c){if(!SETTINGS.fps)return;c.font='bold 12px "Courier New",monospace';c.textAlign='right';c.fillStyle=fpsShown>=50?'#3dff7a':fpsShown>=30?'#ffcc33':'#ff3f5a';c.fillText(fpsShown+' FPS',W-12,H-10);c.textAlign='left';}

// ---------- volumes + a small generated synthwave loop ----------
let musicG=null,musicOn=false,musicNext=0,musicStepI=0,musicTimer=null;
function applyVolumes(){if(!AC)return;if(master)master.gain.value=.5*SETTINGS.fx/100;if(musicG)musicG.gain.value=.22*SETTINGS.music/100;}
const MUS_BPM=104,MUS_STEP=60/MUS_BPM/4;
// A minor: Am - F - C - G, one bar each
const MUS_ROOTS=[45,41,48,43],MUS_ARP=[[0,3,7,12],[0,4,7,12],[0,4,7,12],[0,4,7,11]];
const mtof=n=>440*Math.pow(2,(n-69)/12);
function musicStart(){
  if(!AC||musicOn)return;musicOn=true;
  if(!musicG){musicG=AC.createGain();musicG.connect(AC.destination);}
  applyVolumes();musicNext=AC.currentTime+.1;musicStepI=0;
  musicTimer=setInterval(musicSchedule,40);
}
function musicStop(){musicOn=false;if(musicTimer)clearInterval(musicTimer);musicTimer=null;}
function musicSchedule(){
  if(!AC||!musicOn)return;
  if(SETTINGS.music<=0){musicNext=AC.currentTime+.1;return;}
  while(musicNext<AC.currentTime+.18){musicNote(musicStepI,musicNext);musicNext+=MUS_STEP;musicStepI=(musicStepI+1)%64;}
}
function musicNote(i,t){
  const bar=i>>4,s=i&15,root=MUS_ROOTS[bar],calm=gameState==='menu'||paused;
  const voice=(type,f,dur,vol,cut)=>{const o=AC.createOscillator(),g=AC.createGain(),fl=AC.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(fl);fl.connect(g);g.connect(musicG);o.start(t);o.stop(t+dur+.05);};
  // bass: driving eighths, octave jump on the off-beat
  if(s%2===0)voice('sawtooth',mtof(root-12+(s%4===2?12:0)),MUS_STEP*1.8,.5,420+(s%8===0?300:0));
  // arpeggio
  if(!calm||s%2===0){const a=MUS_ARP[bar];voice('square',mtof(root+24+a[(s>>(calm?1:0))%4]),MUS_STEP*1.4,calm?.07:.09,1800);}
  // pad: the chord, held for the bar
  if(s===0)for(const n of MUS_ARP[bar].slice(0,3))voice('triangle',mtof(root+12+n),MUS_STEP*16,.09,900);
  if(calm)return;
  // drums: kick on the beats, snare on 2 and 4, hats on the off-steps
  if(s%4===0){const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(40,t+.12);
    g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(g);g.connect(musicG);o.start(t);o.stop(t+.3);}
  const nz=(dur,f,vol,type)=>{const b=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();b.buffer=noiseBuf;fl.type=type;fl.frequency.value=f;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);b.connect(fl);fl.connect(g);g.connect(musicG);b.start(t,Math.random()*.5);b.stop(t+dur);};
  if(s===4||s===12)nz(.18,1800,.45,'bandpass');
  if(s%2===1)nz(.05,8000,.12,'highpass');
}

// ---------- gamepad ----------
// standard mapping: 0 A,1 B,2 X,3 Y,4 LB,5 RB,6 LT,7 RT,8 back,9 start,10 L3,11 R3,12 up,13 down,14 left,15 right
let padTrk=null,padStatT=0,padPrev=[],padFocus=-1,padMove=null,padDodge=null,padSprint=false,padRep=0;
function findPad(){const l=navigator.getGamepads?navigator.getGamepads():[];for(const g of l)if(g&&g.connected)return g;return null;}
const padDZ=(v,d)=>Math.abs(v)<d?0:(v-Math.sign(v)*d)/(1-d);
function pollPad(dt){
  const g=findPad();padMove=null;padDodge=null;
  {const hide=SETTINGS.input==='gamepad'&&gameState!=='menu'&&!paused&&!TUT.cardOpen;if(hide!==document.body.classList.contains('nocur'))document.body.classList.toggle('nocur',hide);}
  if(gameState==='menu'&&(padStatT-=dt)<=0){padStatT=.5;const el=$('padstat');if(el)el.textContent=g?'gamepad: '+g.id.replace(/\s*\(.*\)\s*/,'').slice(0,40):'no gamepad found — connect one and press a button';}
  if(!g){padPrev=[];return;}
  const btn=i=>{const b=g.buttons[i];return !!b&&(b.pressed||b.value>.5);};
  const now=[];for(let i=0;i<17;i++)now[i]=btn(i);
  const down=i=>now[i]&&!padPrev[i],up=i=>!now[i]&&padPrev[i];
  const ax=g.axes||[],lx=padDZ(ax[0]||0,.18),ly=padDZ(ax[1]||0,.18),rx=padDZ(ax[2]||0,.14),ry=padDZ(ax[3]||0,.14);
  // menus (any overlay open, or paused): D-pad / left stick moves, A selects, B backs out
  const menuOpen=gameState==='menu'||paused||TUT.cardOpen;
  if(menuOpen){
    padRep-=dt;let mv=0;
    if(down(12)||down(14))mv=-1;if(down(13)||down(15))mv=1;
    const sy=Math.abs(ly)>.6?Math.sign(ly):0;if(sy&&padRep<=0){mv=sy;padRep=.22;}if(!sy&&!now[12]&&!now[13])padRep=Math.min(padRep,0);
    const lr=down(14)?-1:down(15)?1:0;
    if(lr&&padAdjust(lr)){}else if(mv)padNav(mv);
    if(down(0))padClick();
    if(down(1))padBack();
    if(down(9)&&paused&&gameState==='play'){setPaused(false);}
    padPrev=now;return;
  }
  if(gameState==='over'&&down(0)&&!TUT.cardOpen){if(TUT.on)startTutorial(TUT.id);else newMatch(undefined,{demo:world.demo});}
  if(gameState!=='play'){padPrev=now;return;}
  if(down(9)){setPaused(true);padPrev=now;return;}
  if(world.demo){if(down(6)||down(15))demoCycle(1);if(down(5)||down(14))demoCycle(-1);padPrev=now;return;}
  if(SETTINGS.input!=='gamepad'){padPrev=now;return;}
  // look: right stick, eased so small tilts aim finely
  const k=3.1*(SETTINGS.sens/100)*(cam.zoom||1)*dt;
  const S=SETTINGS.assist?SETTINGS.assistStr/100:0;
  const A=S>0?assistTarget(down(5)?2.6:1):null;
  // snap: pressing RB (aim) swings the crosshair onto the nearest enemy in a wide cone
  if(A&&down(5)){const sn=(.35+.6*S)*.175;cam.yaw+=A.dy*sn;cam.pitch=clamp(cam.pitch+A.dp*sn,-1.35,1.25);}
  // friction: the look slows down a lot while the crosshair is over a target
  const fr=A?1-(.45+.45*S)*.175*(1-A.e*.6):1;
  cam.yaw-=rx*Math.abs(rx)*k*fr;cam.pitch=clamp(cam.pitch-ry*Math.abs(ry)*k*.75*fr,-1.35,1.25);
  if(A){
    // tracking: follow the target as it (or you) moves
    if(padTrk&&padTrk.t===A.t){const ddy=angDiff(A.ay,padTrk.ay),ddp=A.ap-padTrk.ap;if(Math.abs(ddy)<.3){const tk=(.5+.5*S)*.175;cam.yaw+=ddy*tk;cam.pitch=clamp(cam.pitch+ddp*tk,-1.35,1.25);}}
    // magnetism: pull onto the target while you move, look or shoot
    if(rx||ry||lx||ly||now[6]||now[5]){const pull=Math.min(.6,(now[5]?2.45:1.6)*S*dt*(1.3-A.e*.6));
      cam.yaw+=A.dy*pull;cam.pitch=clamp(cam.pitch+A.dp*pull,-1.35,1.25);}
    padTrk={t:A.t,ay:A.ay,ap:A.ap};
  }else padTrk=null;
  // move: left stick; L3 latches sprint until the stick is let go
  if(lx||ly)padMove={f:-ly,s:lx};
  if(down(10))padSprint=!padSprint;if(Math.hypot(lx,ly)<.3)padSprint=false;
  // buttons feed the same key / mouse state the keyboard does
  const hold=(i,key)=>{if(down(i)){pressed[key]=true;keys[key]=true;}if(up(i))keys[key]=false;};
  hold(0,' ');hold(1,'c');hold(2,'e');hold(4,'r');hold(12,'t');
  if(down(3))pressed['q']=true;
  if(down(6)){mouseDown=true;pressed['lmb']=true;}if(up(6))mouseDown=false;
  if(down(5))mouseRight=true;if(up(5))mouseRight=false;
  if(down(7))pressed['mmb']=true;
  if(down(11))padDodge=Math.abs(lx)>Math.abs(ly)&&Math.abs(lx)>.3?(lx>0?'right':'left'):'back';
  padPrev=now;
}
// aim assist: the enemy closest to the crosshair, inside a cone that grows with the strength and with how near they are
function assistTarget(wide){
  const p=player;if(!p||!p.alive||world.rot||world.demo||!cam.pos)return null;
  const s=SETTINGS.assistStr/100,o=headPos(p);let best=null;
  for(const e of chars){
    if(e===p||!e.alive||allied(e,p)||e.vis<.35)continue;
    const t=chestPos(e),d=vsub(t,cam.pos),dist=vlen(d);if(dist<20||dist>1600)continue;
    const ay=Math.atan2(d.x,d.z),ap=Math.asin(clamp(d.y/dist,-1,1)),dy=angDiff(ay,cam.yaw),dp=ap-cam.pitch;
    if(Math.abs(dy)>1.4)continue;
    const err=Math.hypot(dy*Math.cos(cam.pitch),dp),rad=(.07+40/dist)*(.5+1.6*s)*.5*(wide||1);
    if(err>rad)continue;
    const e2=err/rad;if(best&&e2>=best.e)continue;
    if(!losClear(o,t))continue;
    best={t:e,e:e2,dy,dp,ay,ap};
  }
  return best;
}
// which overlay the pad is driving, and what in it can be selected
function padLayer(){
  for(const id of ['card','pause','tut','ov']){const el=$(id);if(el&&getComputedStyle(el).display!=='none')return el;}return null;
}
function padItems(){
  const L=padLayer();if(!L)return [];
  return [...L.querySelectorAll('button,input[type=range],summary')].filter(e=>e.offsetParent!==null&&!e.disabled);
}
function padHilite(){
  for(const e of document.querySelectorAll('.pf'))e.classList.remove('pf');
  const it=padItems();if(padFocus<0||padFocus>=it.length)return;
  const e=it[padFocus];e.classList.add('pf');try{e.focus({preventScroll:true});}catch(x){}e.scrollIntoView({block:'nearest'});
}
function padNav(d){const it=padItems();if(!it.length)return;const cur=it.indexOf(document.querySelector('.pf'));padFocus=cur<0?(d>0?0:it.length-1):(cur+d+it.length)%it.length;padHilite();}
function padAdjust(d){
  const e=document.querySelector('.pf');if(!e)return false;
  if(e.type==='range'){e.value=+e.value+d*(+e.step||1)*(e.max-e.min>60?5:1);e.oninput&&e.oninput();return true;}
  return false; // left/right on buttons just moves along the row
}
function padClick(){const e=document.querySelector('.pf');if(!e){padNav(1);return;}if(e.tagName!=='SUMMARY')wakeAudio();e.click();
  setTimeout(()=>{const f=document.querySelector('.pf');if(!f||f.offsetParent===null||!padItems().includes(f)){padFocus=-1;padNav(1);}},40);}
function padBack(){
  const L=padLayer();if(!L)return;
  if(L.id==='pause'){setPaused(false);return;}
  const b=L.id==='ov'?[...L.querySelectorAll('.page.on .back')][0]:L.id==='tut'?$('tutback'):null;
  if(b){b.click();padNav(1);}
}
wireMenu();
