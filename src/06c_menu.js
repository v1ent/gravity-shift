// ================= main menu: pages, settings, options, music, gamepad =================
const $=id=>document.getElementById(id);
function wakeAudio(){if(!AC)initAudio();if(AC&&AC.state==='suspended')AC.resume();applyVolumes();musicStart();}
function showMenu(page){
  gameState='menu';$('tut').style.display='none';$('ov').style.display='flex';
  for(const p of document.querySelectorAll('#ov .page'))p.classList.toggle('on',p.id===page);
  if(page==='pgGame')refreshGamePage();
  if(rebind)endRebind();if(page==='pgKeys')buildKeyTable();refreshKeyCells();
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
  opts($('styleopt'),[['lines','LINES'],['solid','SOLID'],['shiny','SHINY'],['ink','INK'],['inkShiny','INK GLOSS']],()=>SETTINGS.charStyle,v=>{SETTINGS.charStyle=v;});
  opts($('fpsopt'),[[false,'OFF'],[true,'ON']],()=>SETTINGS.fps,v=>{SETTINGS.fps=v;});
  const slider=(id,vid,key,fmt,after)=>{const sl=$(id),vv=$(vid);sl.value=SETTINGS[key];vv.textContent=fmt(SETTINGS[key]);
    sl.oninput=()=>{SETTINGS[key]=+sl.value;vv.textContent=fmt(+sl.value);saveSettings();if(after)after();};};
  slider('spdSl','spdV','speed',v=>v+'%'+(v===100?' (original)':''));
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
function applyVolumes(){if(!AC)return;if(master)master.gain.value=.5*SETTINGS.fx/100;if(musicG)musicG.gain.value=(SNDG.music_game?.55:.22)*SETTINGS.music/100;}
const MUS_BPM=104,MUS_STEP=60/MUS_BPM/4;
// A minor: Am - F - C - G, one bar each
const MUS_ROOTS=[45,41,48,43],MUS_ARP=[[0,3,7,12],[0,4,7,12],[0,4,7,12],[0,4,7,11]];
const mtof=n=>440*Math.pow(2,(n-69)/12);
function musicStart(){
  if(!AC||musicOn)return;musicOn=true;
  if(!musicG){musicG=AC.createGain();musicG.connect(AC.bus||AC.destination);}
  applyVolumes();musicNext=AC.currentTime+.1;musicStepI=0;
  musicTimer=setInterval(musicSchedule,40);
}
function musicStop(){musicOn=false;if(musicTimer)clearInterval(musicTimer);musicTimer=null;if(musTrack){try{musTrack.s.stop();}catch(e){}musTrack=null;}}
// the recorded loops: menu music in the menus, game music in matches; they cross-fade when that changes
const MUS_LOOP={music_menu:6.0,music_game:10.5};let musTrack=null;
function musicRecorded(){
  if(!SNDG.music_menu||!SNDG.music_game)return false;
  const want=gameState==='menu'||(TUT.on&&gameState!=='play')?'music_menu':'music_game';
  if(!musTrack||musTrack.name!==want){
    const t=AC.currentTime;
    if(musTrack){const old=musTrack;old.g.gain.setTargetAtTime(0,t,.25);setTimeout(()=>{try{old.s.stop();}catch(e){}},1500);}
    const s=AC.createBufferSource(),g=AC.createGain();s.buffer=SNDG[want][0];s.loop=true;s.loopStart=0;s.loopEnd=Math.min(MUS_LOOP[want],s.buffer.duration);
    g.gain.value=0;g.gain.setTargetAtTime(1,t,.3);s.connect(g);g.connect(musicG);s.start();musTrack={name:want,s,g};
  }
  return true;
}
function musicSchedule(){
  if(!AC||!musicOn)return;
  if(musicRecorded())return; // (the generated synthwave below is only the fallback now)
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
    // waiting for a new gamepad button: the first press once everything is let go (START cancels)
    if(rebind&&rebind.kind==='gp'){
      if(!rebind.armed){if(!now.some(Boolean))rebind.armed=true;}
      else{const i=now.findIndex(Boolean);if(i===9)endRebind();else if(i>=0)endRebind(i);}
      padPrev=now;return;}
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
  if(endOptsOn()){if(down(0))endChoice('same');else if(down(2))endChoice('random');else if(down(1)||down(9))endChoice('menu');}
  else if(gameState==='over'&&down(0)&&!TUT.cardOpen){if(TUT.on)startTutorial(TUT.id);else newMatch(undefined,{demo:world.demo});}
  if(gameState!=='play'){padPrev=now;return;}
  if(down(9)){setPaused(true);padPrev=now;return;}
  if(world.demo){if(down(6)||down(15))demoCycle(1);if(down(5)||down(14))demoCycle(-1);padPrev=now;return;}
  if(SETTINGS.input!=='gamepad'){padPrev=now;return;}
  // look: right stick, eased so small tilts aim finely
  const k=3.1*(SETTINGS.sens/100)*(cam.zoom||1)*dt;
  const S=SETTINGS.assist?SETTINGS.assistStr/100:0,GA=gpOf('aim'),GF=gpOf('fire');
  const A=S>0?assistTarget(down(GA)?2.6:1):null;
  // snap: pressing RB (aim) swings the crosshair onto the nearest enemy in a wide cone
  if(A&&down(GA)){const sn=(.35+.6*S)*.175;cam.yaw+=A.dy*sn;cam.pitch=clamp(cam.pitch+A.dp*sn,-1.35,1.25);}
  // friction: the look slows down a lot while the crosshair is over a target
  const fr=A?1-(.45+.45*S)*.175*(1-A.e*.6):1;
  cam.yaw-=rx*Math.abs(rx)*k*fr;cam.pitch=clamp(cam.pitch-ry*Math.abs(ry)*k*.75*fr,-1.35,1.25);
  if(A){
    // tracking: follow the target as it (or you) moves
    if(padTrk&&padTrk.t===A.t){const ddy=angDiff(A.ay,padTrk.ay),ddp=A.ap-padTrk.ap;if(Math.abs(ddy)<.3){const tk=(.5+.5*S)*.175;cam.yaw+=ddy*tk;cam.pitch=clamp(cam.pitch+ddp*tk,-1.35,1.25);}}
    // magnetism: pull onto the target while you move, look or shoot
    if(rx||ry||lx||ly||now[GF]||now[GA]){const pull=Math.min(.6,(now[GA]?2.45:1.6)*S*dt*(1.3-A.e*.6));
      cam.yaw+=A.dy*pull;cam.pitch=clamp(cam.pitch+A.dp*pull,-1.35,1.25);}
    padTrk={t:A.t,ay:A.ay,ap:A.ap};
  }else padTrk=null;
  // move: left stick; L3 latches sprint until the stick is let go
  if(lx||ly)padMove={f:-ly,s:lx};
  if(down(gpOf('sprint')))padSprint=!padSprint;if(Math.hypot(lx,ly)<.3)padSprint=false;
  // buttons feed the same key / mouse state the keyboard does
  for(const [a] of ACTIONS){const i=gpOf(a);if(i<0||a==='sprint'||a==='dodge')continue;if(down(i)){pressed['pad:'+a]=true;keys['pad:'+a]=true;}if(up(i))keys['pad:'+a]=false;}
  if(down(gpOf('dodge')))padDodge=Math.abs(lx)>Math.abs(ly)&&Math.abs(lx)>.3?(lx>0?'right':'left'):ly<-.3?'fwd':'back';
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
// ---------- key bindings page ----------
var rebind=null;
// the help tables name the keys as currently bound (always the keyboard ones there)
function refreshKeyCells(){if(!document.querySelectorAll)return;for(const td of document.querySelectorAll('td[data-k]'))td.textContent=td.dataset.k.replace(/\{(\w+)\}/g,(m,a)=>keyName(kbOf(a)));}
function buildKeyTable(){
  const t=$('keytab');if(!t||!t.querySelectorAll||typeof document.createElement('div').querySelectorAll!=='function')return;
  let h='<tr><th></th><th>KEYBOARD / MOUSE</th><th>GAMEPAD</th></tr>';
  for(const [a,label] of ACTIONS){
    const kb=KB_FIXED[a]?`<span class="fix">${KB_FIXED[a]}</span>`:`<button class="opt" data-k="kb" data-a="${a}">${keyName(kbOf(a))}</button>`;
    const gp=GP_FIXED[a]?`<span class="fix">${GP_FIXED[a]}</span>`:`<button class="opt" data-k="gp" data-a="${a}">${padName(gpOf(a))}</button>`;
    h+=`<tr><td>${label}</td><td>${kb}</td><td>${gp}</td></tr>`;
  }
  t.innerHTML=h;
  for(const b of t.querySelectorAll('button')){b.onclick=ev=>{ev.stopPropagation();
    if(rebind)endRebind();rebind={kind:b.dataset.k,a:b.dataset.a,btn:b,t:performance.now(),armed:false};
    b.classList.add('wait');b.textContent=b.dataset.k==='kb'?'press a key…':'press a button…';};}
}
// put the new binding on the action; whatever action had it before takes this one's old binding
function endRebind(v){
  const r=rebind;rebind=null;if(!r)return;
  if(v!==undefined){const M=r.kind==='kb'?SETTINGS.kb:SETTINGS.gp,old=M[r.a];
    for(const [a] of ACTIONS)if(a!==r.a&&M[a]===v&&!(r.kind==='kb'?KB_FIXED:GP_FIXED)[a])M[a]=old;
    M[r.a]=v;saveSettings();}
  buildKeyTable();if(padFocus>=0)padHilite();
}
addEventListener('keydown',e=>{if(!rebind)return;e.preventDefault();e.stopImmediatePropagation();
  const k=e.key.toLowerCase();if(k==='escape'||rebind.kind!=='kb'){endRebind();return;}endRebind(k);},true);
addEventListener('mousedown',e=>{if(!rebind||rebind.kind!=='kb'||performance.now()-rebind.t<150)return;e.preventDefault();e.stopImmediatePropagation();if(e.button===0)swallowClick=performance.now()+600;endRebind('mouse'+e.button);},true);
addEventListener('mousedown',()=>{swallowClick=0;},true);
// the click that finishes a mouse-button binding mustn't also press whatever is under the pointer
let swallowClick=0;addEventListener('click',e=>{if(performance.now()<swallowClick){swallowClick=0;e.stopImmediatePropagation();e.preventDefault();}},true);
addEventListener('auxclick',e=>{if(rebind)e.preventDefault();},true);
if($('keyreset'))$('keyreset').onclick=()=>{SETTINGS.kb=Object.assign({},KB_DEF);SETTINGS.gp=Object.assign({},GP_DEF);saveSettings();endRebind();buildKeyTable();};
buildKeyTable();
// a click for every button in the menus
document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('button');if(b&&AC)sfx('ui');},true);
// the music volume follows whether the recorded loops have arrived yet
setTimeout(function volWatch(){if(typeof SNDG!=='undefined'&&SNDG.music_game){applyVolumes();return;}if(AC)setTimeout(volWatch,500);},1000);
// Browsers only let sound start from a real click or key press (a gamepad button doesn't count), so every click/key/touch
// creates or resumes the audio; while it's still blocked a small hint says how to turn it on.
function audioGesture(){
  if(!AC)initAudio();if(!AC)return;
  const go=()=>{applyVolumes();musicStart();};
  if(AC.state!=='running')AC.resume().then(go).catch(()=>{});else go();
}
for(const ev of ['pointerdown','keydown','touchend','click'])document.addEventListener(ev,audioGesture,true);
if(document.body)(function(){const h=document.createElement('div');h.id='sndhint';h.textContent='🔇 click or press any key to turn sound on';
  h.style.cssText='position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:50;font:12px monospace;letter-spacing:.08em;color:#29f0ff;background:rgba(5,8,20,.8);border:1px solid #29f0ff55;padding:6px 12px;pointer-events:none;display:none';
  document.body.appendChild(h);
  setInterval(()=>{const blocked=!AC||AC.state!=='running';h.style.display=blocked&&(SETTINGS.fx>0||SETTINGS.music>0)&&!window.VIEWER?'block':'none';},500);})();

// ---------- end of a match on one of the four arenas: play it again, a random arena, or the main menu ----------
function endOptsOn(){return gameState==='over'&&world.fixedArena&&!world.demo&&!TUT.on&&!TUT.cardOpen;}
function endChoice(c){
  if(!endOptsOn())return;
  if(c==='same')newMatch(world.seedLabel);else if(c==='random')newMatch();
  else{gameState='menu';showMenu('pgMain');}
  if(c!=='menu'&&SETTINGS.input!=='gamepad')lockMouse();
}
if(document.body&&$('endopts')){
  $('endSame').onclick=()=>endChoice('same');$('endRnd').onclick=()=>endChoice('random');$('endMenu').onclick=()=>endChoice('menu');
  let was=false;
  setInterval(()=>{const on=endOptsOn();if(on!==was){was=on;$('endopts').style.display=on?'flex':'none';
    if(on&&document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();}},100);
}

// ---------- audio watchdog ----------
// On some Windows set-ups the browser's connection to the sound device silently dies (moving the system volume slider
// brings it back). Twice a second: is the audio clock still moving, and is the output sane (no NaN; some signal while
// the music should be playing)? If not: pause and resume the audio (makes the browser reopen the device); if that
// doesn't help, rebuild the whole audio graph (the decoded recordings are kept and reused).
const AUDLOG=[];let audW={t:0,ct:0,bad:0,quiet:0,lastFix:-99,tries:0};
// re-open the connection to the sound device, as moving the system volume slider does: point the output at nothing,
// then back at the default device (Chrome / Edge; elsewhere this does nothing)
function audioReopen(why){
  if(!AC||typeof AC.setSinkId!=='function')return false;
  AUDLOG.push((performance.now()/1000).toFixed(1)+' reopen device: '+why);
  try{AC.setSinkId({type:'none'}).then(()=>AC.setSinkId('')).then(()=>{if(AC.state!=='running')AC.resume().catch(()=>{});}).catch(()=>{});}catch(e){return false;}
  return true;
}
function audioRebuild(why){
  AUDLOG.push((performance.now()/1000).toFixed(1)+' rebuild: '+why);
  const old=AC;try{if(musicTimer)clearInterval(musicTimer);}catch(e){}
  musicTimer=null;musicOn=false;musTrack=null;musicG=null;AC=null;
  try{old&&old.close();}catch(e){}
  initAudio();if(AC){if(AC.state!=='running')AC.resume().catch(()=>{});applyVolumes();musicStart();}
}
function audioWatch(){
  if(!AC||document.hidden)return;
  const now=performance.now()/1000,ct=AC.currentTime,rt=now-audW.t;
  if(AC.state==='interrupted'||(AC.state==='suspended'&&navigator.userActivation&&navigator.userActivation.hasBeenActive)){AC.resume().catch(()=>{});}
  let problem='';
  const active=navigator.userActivation?navigator.userActivation.hasBeenActive:true;
  if(AC.state!=='running'&&AC.state!=='closed'&&active)problem='audio stuck '+AC.state;
  if(AC.state==='running'&&audW.t&&rt>.4&&ct-audW.ct<rt*.25)problem='audio clock stalled';
  if(AC.an&&AC.state==='running'){
    const buf=new Float32Array(AC.an.fftSize);AC.an.getFloatTimeDomainData(buf);let e=0;
    for(let i=0;i<buf.length;i++){const v=buf[i];if(!isFinite(v)){problem='output is NaN';break;}e+=v*v;}
    const expect=musTrack&&SETTINGS.music>0&&musicG&&musicG.gain.value>.01;
    audW.quiet=expect&&e<1e-9?audW.quiet+rt:0;if(audW.quiet>2.5)problem='silent while music should play';
  }
  audW.t=now;audW.ct=ct;
  if(!problem){audW.bad=0;audW.tries=0;return;}
  if(++audW.bad<2)return; // twice in a row
  audW.bad=0;audW.quiet=0;
  if(audW.tries===0&&problem!=='output is NaN'){audW.tries=1;
    if(!audioReopen(problem)){AUDLOG.push(now.toFixed(1)+' '+problem+': suspend/resume');AC.suspend().then(()=>AC.resume()).catch(()=>{});}return;}
  if(now-audW.lastFix<4)return;audW.lastFix=now;audW.tries=0;audioRebuild(problem);
}
if(typeof document!=="undefined"&&document.body&&!window.__headless)setInterval(audioWatch,500);
