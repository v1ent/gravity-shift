// =====================================================================
//  TUTORIAL — practice rooms built into the same voxel grid as the arena
// =====================================================================
const TUT={on:false,id:null,cfg:null,t:0,toast:[],done:{},cp:null,prevState:'normal',complete:false,cardOpen:false,cardDelay:-1,shots:0,lastAmmo:0};
let drones=[];
const TUT_ROOMS=[
  {id:'trav',name:'ADVANCED TRAVERSAL',desc:'Vaults, slides and ledge pull-ups'},
  {id:'range',name:'TARGET PRACTICE',desc:'Follow the yellow line and shoot the drones'},
  {id:'rj',name:'ROCKET JUMPING',desc:"Blast yourself up to platforms you can't reach otherwise"},
  {id:'shift',name:'ARENA SHIFT',desc:'Kick the panels to walk on the walls and the ceiling'},
  {id:'ally',name:'ALLIANCES',desc:'Wave, bow and fight as a team'},
  {id:'fight',name:'BASIC FIGHT',desc:'One easy bot — first to 3 frags'},
];
try{Object.assign(TUT.done,JSON.parse(localStorage.getItem('gravityShiftTutorial')||'{}'));}catch(e){}
const saveTutDone=()=>{try{localStorage.setItem('gravityShiftTutorial',JSON.stringify(TUT.done));}catch(e){}};

// ---------- building helpers (cells) ----------
function gbox(i0,j0,k0,i1,j1,k1,t){
  for(let i=Math.min(i0,i1);i<=Math.max(i0,i1);i++)for(let j=Math.min(j0,j1);j<=Math.max(j0,j1);j++)for(let k=Math.min(k0,k1);k<=Math.max(k0,k1);k++)setT(i,j,k,t);
}
const MKC={yel:hexRGB('#ffcc33'),cyan:hexRGB('#29f0ff'),mag:hexRGB('#ff3fa4'),org:hexRGB('#ff8a2a'),grn:hexRGB('#3dff7a'),red:hexRGB('#ff3b3b')};
const axOf=v=>v.x?0:v.y?1:2;
// thin glowing square on a surface: centre c, size s along the two tangents, nAx = axis of the surface normal
function mkSq(c,s,nAx,col,s2){const z=[s,s,s];z[nAx]=1.2;if(s2){const t=[0,1,2].filter(a=>a!==nAx);z[t[1]]=s2;}addD(c,z[0],z[1],z[2],col,5);}
// chevron pointing along f (unit, axis aligned), lying on a surface with normal axis nAx
function chevron(o,f,l,nAx,s,col){
  const sz=[0,0,0];sz[axOf(f)]=s;sz[axOf(l)]=s;sz[nAx]=1.2;
  for(let t=0;t<3;t++)for(const d of [0,1])for(const sg of (t?[-1,1]:[1])){
    const p=vadd(o,vadd(vscale(f,(2-t-d)*s),vscale(l,sg*t*s)));addD(p,sz[0],sz[1],sz[2],col,5);}
}
// outline rectangle on the floor (px), y = floor top
function floorRect(x0,z0,x1,z1,y,col,th){
  th=th||3;const yy=y+.6;
  addD(V((x0+x1)/2,yy,z0+th/2),x1-x0,1.2,th,col,5);addD(V((x0+x1)/2,yy,z1-th/2),x1-x0,1.2,th,col,5);
  addD(V(x0+th/2,yy,(z0+z1)/2),th,1.2,z1-z0,col,5);addD(V(x1-th/2,yy,(z0+z1)/2),th,1.2,z1-z0,col,5);
}
const floorChev=(x,z,y,dx,dz,col,s)=>chevron(V(x,y+.6,z),V(dx,0,dz),V(-dz,0,dx),1,s||4,col);

// ---------- feedback ----------
function tone(f,at,dur,vol,type){
  if(!AC)return;const t=AC.currentTime+at,o=AC.createOscillator(),g=AC.createGain();
  o.type=type||'sine';o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05);
}
function tsfx(kind){
  if(kind==='ding'){tone(1568,0,1,.22);tone(3136,0,.45,.07);}
  else if(kind==='buzz'){tone(440,0,.16,.16,'square');tone(440,.22,.16,.16,'square');tone(880,.44,.35,.16,'square');}
  else if(kind==='done'){tone(784,0,.25,.2);tone(988,.12,.25,.2);tone(1175,.24,.3,.2);tone(1568,.38,.9,.22);}
  else if(kind==='fail'){tone(330,0,.3,.15,'triangle');tone(247,.18,.45,.15,'triangle');}
  else if(kind==='pop'){tone(620,0,.12,.1,'triangle');tone(930,.06,.12,.08,'triangle');}
}
function toast(text,col,dur){TUT.toast.unshift({text,col:col||'#ffcc33',t:dur||2.4,max:dur||2.4});if(TUT.toast.length>4)TUT.toast.length=4;}
function ding(text,col){tsfx('ding');if(text)toast(text,col||'#3dff7a');}
function objDone(i,text){const o=TUT.cfg.obj[i];if(!o||o.done)return;o.done=true;ding(text||('✓ '+o.short));}
function setCp(x,y,z,yaw){TUT.cp={x,y,z,yaw};}

// ---------- drones (target practice) ----------
function makeDrone(hole,normal,o){
  return {p:V(hole.x,hole.y,hole.z),hole,home:vadd(hole,vscale(normal,o.out||70)),alive:true,state:'emerge',t:0,amp:o.amp||0,spd:o.spd||1,ph:rnd()*6,
    axis:o.axis||V(1,0,0),rot:0,yaw:Math.atan2(-normal.x,-normal.z),delay:o.delay||0};
}
function updateDrones(dt){
  for(const d of drones){
    if(!d.alive)continue;
    if(d.delay>0){d.delay-=dt;if(d.delay<=0)tsfx('pop');continue;}
    d.t+=dt;d.rot+=dt*45;
    if(d.state==='emerge'){const u=Math.min(1,d.t/.9),e=easeInOut(u);d.p=vadd(d.hole,vscale(vsub(d.home,d.hole),e));if(u>=1){d.state='hover';d.t=0;}}
    else d.p=vadd(d.home,vadd(vscale(d.axis,Math.sin(d.t*d.spd+d.ph)*d.amp),V(0,Math.sin(d.t*2.3+d.ph)*4,0)));
  }
}
function hitDrone(d){
  if(!d.alive||d.delay>0)return;d.alive=false;
  for(let i=0;i<34;i++)addPart(d.p.x,d.p.y,d.p.z,(rnd()-.5)*420,(rnd()-.3)*420,(rnd()-.5)*420,.5+rnd()*.5,rnd()<.5?[1,.6,.15]:[.16,.94,1],3,'spark');
  addPart(d.p.x,d.p.y,d.p.z,0,0,0,.4,[1,.7,.2],22,'ring');
  sfx('boom',d.p);ding();
  if(TUT.cfg&&TUT.cfg.onDrone)TUT.cfg.onDrone(d);
}
function droneHit(x,y,z,r){for(const d of drones)if(d.alive&&d.delay<=0&&Math.hypot(x-d.p.x,y-d.p.y,z-d.p.z)<(r||13))return d;return null;}
function drawDrones(){
  const body=hexRGB('#2a3046'),arm=hexRGB('#4b536e'),rotor=hexRGB('#9aa6c2');
  for(const d of drones){
    if(!d.alive||d.delay>0)continue;const p=d.p,y=d.yaw;
    drawBox(p,14,5,14,body,[0,0,0],[.16,.94,1],y);
    drawBox(V(p.x,p.y+3,p.z),8,2,8,hexRGB('#ff8a2a'),[.9,.45,.1],null,y);
    for(let a=0;a<4;a++){
      const ang=y+Math.PI/4+a*Math.PI/2,ax=Math.sin(ang),az=Math.cos(ang);
      drawBox(V(p.x+ax*9,p.y+1,p.z+az*9),3,2,14,arm,[0,0,0],null,ang);
      drawBox(V(p.x+ax*15,p.y+3.5,p.z+az*15),12,.8,2,rotor,[.15,.15,.18],null,d.rot+a);
      drawBox(V(p.x+ax*15,p.y+3.5,p.z+az*15),2,.8,12,rotor,[.15,.15,.18],null,d.rot+a);
    }
    drawBox(V(p.x+Math.sin(y)*7.5,p.y,p.z+Math.cos(y)*7.5),3,2,1.5,MKC.red,[1,.1,.1],null,y);
  }
}

// ================= ROOMS =================
const TUT_BUILD={};

// ---------- 1. advanced traversal ----------
TUT_BUILD.trav=()=>{
  // a three-lane course, snaking through the grid so every station gets a long run-up
  const fy=5*T;
  gbox(2,5,2,34,21,8,0);    // lane A  (z 2..8)  run +x: vaults
  gbox(2,5,11,34,21,17,0);  // lane B  (z 11..17) run -x: slide
  gbox(2,5,20,34,21,26,0);  // lane C  (z 20..26) run +x: pull-ups, gap
  gbox(30,5,2,34,21,17,0);  // corner A->B
  gbox(2,5,11,6,21,26,0);   // corner B->C
  // lane A: two low barriers (1 block, vaultable) after an 11-block run-up
  gbox(14,5,2,14,5,8,3);gbox(22,5,2,22,5,8,3);
  // lane B: slide beam, 1 block of clearance, 14-block run-up from the corner
  gbox(16,6,11,16,21,17,1);gbox(16,6,11,16,6,17,4);
  // lane C: ledge 1 (4 blocks), ledge 2 (+4), 3-block gap, far side (+4)
  gbox(12,5,20,15,8,26,1);gbox(16,5,20,20,12,26,1);gbox(24,5,20,34,16,26,1);gbox(21,4,20,23,4,26,4);
  // markings
  for(let x=4;x<30;x+=1.6)floorChev(x*T,5*T,fy,1,0,MKC.yel,3.2);
  for(let z=3.5;z<15;z+=1.6)floorChev(32*T,z*T,fy,0,1,MKC.yel,3.2);
  for(let x=31;x>6;x-=1.6)floorChev(x*T,14*T,fy,-1,0,MKC.yel,3.2);
  for(let z=12.5;z<24;z+=1.6)floorChev(4*T,z*T,fy,0,1,MKC.yel,3.2);
  for(let x=6;x<11.5;x+=1.6)floorChev(x*T,23*T,fy,1,0,MKC.yel,3.2);
  floorRect(2.5*T,3*T,4.5*T,7*T,fy,MKC.cyan);
  for(const x of [14,22])floorRect(x*T,2*T,(x+1)*T,9*T,fy,MKC.org,4);
  floorRect(17*T,11*T,19*T,18*T,fy,MKC.mag,4);
  for(const z of [12.5,14,15.5])chevron(V(17*T+.6,5*T+44,z*T),V(0,-1,0),V(0,0,1),0,4,MKC.mag);
  for(const [x,y] of [[12,5],[16,9]])for(const z of [21.5,23,24.5])chevron(V(x*T-.6,y*T+30,z*T),V(0,1,0),V(0,0,1),0,5,MKC.cyan);
  for(const z of [21.5,23,24.5])chevron(V(24*T-.6,13*T+50,z*T),V(0,1,0),V(0,0,1),0,5,MKC.cyan);
  floorRect(31*T,20.5*T,34.8*T,25.5*T,17*T,MKC.grn,4);
  const inA=p=>p.z<9*T,inB=p=>p.z>9.5*T&&p.z<18*T&&p.x>7*T,inC=p=>p.z>19*T;
  return {
    name:'ADVANCED TRAVERSAL',spawn:{x:3.5*T,y:fy,z:5*T},yaw:Math.PI/2,
    card:['ADVANCED TRAVERSAL',`<p>Follow the yellow arrows.</p>
      <p>Hold <b>{sprint}</b> to sprint — the green bar under your health is stamina. While sprinting you <b>vault</b> over low barriers on your own.</p>
      <p>Sprint and press <b>C</b> to <b>slide</b> under low gaps.</p>
      <p>Walls are too high to jump onto: jump at the wall while <b>holding {jump}</b> — you catch the ledge, hang, and <b>pull yourself up</b>.</p>`],
    obj:[{text:'Sprint ({sprint}) into the orange barriers to vault over them',short:'VAULT',n:0,need:2},
         {text:'Sprint, then press C to slide under the magenta beam',short:'SLIDE'},
         {text:'Jump at the wall holding {jump}: catch the ledge, pull up — twice',short:'PULL-UP',n:0,need:2},
         {text:'Sprint-jump the gap — the far side is too high, grab its ledge',short:'LEDGE GRAB'},
         {text:'Stand on the green pad',short:'FINISH'}],
    onState(a,b,p){
      const o=TUT.cfg.obj;
      if(b==='climbup'&&p.st&&p.st.vault&&inA(p)){const k=p.x<18*T?'v1':'v2';if(!TUT[k]){TUT[k]=1;o[0].n++;if(o[0].n>=o[0].need)objDone(0,'✓ VAULT');else ding('VAULT 1/2');}}
      if(b==='slide'&&inB(p)&&p.x>16.5*T&&p.x<24*T)TUT.slid=true;
      if(b==='climbup'&&inC(p)&&p.x>22.5*T){objDone(3,'✓ LEDGE GRAB');setCp(26*T,17*T,23*T,Math.PI/2);}
      else if(a==='hang'&&b==='climbup'&&inC(p)){const k=p.x<14*T?'p1':'p2';if(!TUT[k]){TUT[k]=1;o[2].n++;if(o[2].n>=o[2].need){objDone(2,'✓ PULL-UP');setCp(18.5*T,13*T,23*T,Math.PI/2);}else ding('PULL-UP 1/2');}}
    },
    update(dt,p){
      if(TUT.slid&&inB(p)&&p.x<15.4*T){TUT.slid=false;objDone(1,'✓ SLIDE');}
      if(p.grounded&&inC(p)&&p.x>31*T&&Math.abs(p.y-17*T)<4){for(const o of TUT.cfg.obj)o.done=true;tutComplete();}
    },
    fell(p){return inC(p)&&p.x>20.6*T&&p.x<24*T&&p.y<12*T;},
  };
};

// ---------- 2. target practice ----------
TUT_BUILD.range=()=>{
  gbox(3,5,12,33,13,24,0);
  const fy=5*T,cz=18.5*T;
  for(let x=4;x<33;x+=1.25)floorChev(x*T,cz,fy,1,0,MKC.yel,3.2);
  const ST=[6,14,22,30];
  for(const s of ST)floorRect((s-1)*T,16.5*T,(s+1)*T,20.5*T,fy,MKC.yel,4);
  // holes: [i,j,k, normal]
  const H=[
    [[10,7,11],[12,9,25]],
    [[17,6,11],[19,10,25],[20,8,11]],
    [[25,9,11],[26,6,25],[28,11,11],[27,8,25]],
    [[34,7,15],[34,10,18],[34,7,22],[32,11,11],[31,7,25]],
  ];
  const holes=H.map(w=>w.map(([i,j,k])=>{
    setT(i,j,k,0);
    const n=i===34?V(-1,0,0):k===11?V(0,0,1):V(0,0,-1),c=V((i+.5)*T,(j+.5)*T,(k+.5)*T);
    const nAx=axOf(n),face=vadd(c,vscale(n,T/2+.7));
    // orange frame round each hole
    const t=[0,1,2].filter(a=>a!==nAx);
    for(const sg of [-1,1]){const a=V(0,0,0),b=V(0,0,0);a[['x','y','z'][t[0]]]=sg*(T/2+2);b[['x','y','z'][t[1]]]=sg*(T/2+2);
      const sz1=[0,0,0];sz1[nAx]=1.2;sz1[t[0]]=3;sz1[t[1]]=T+7;addD(vadd(face,a),sz1[0],sz1[1],sz1[2],MKC.org,5);
      const sz2=[0,0,0];sz2[nAx]=1.2;sz2[t[1]]=3;sz2[t[0]]=T+7;addD(vadd(face,b),sz2[0],sz2[1],sz2[2],MKC.org,5);}
    return {c,n};
  }));
  TUT.wave=0;TUT.waveLive=false;
  const waveOpts=[{amp:0,spd:1,out:64},{amp:24,spd:.9,out:72},{amp:40,spd:1.4,out:84},{amp:34,spd:1.7,out:90}];
  return {
    name:'TARGET PRACTICE',spawn:{x:3.8*T,y:5*T,z:cz},yaw:Math.PI/2,hud:{shots:true},
    card:['TARGET PRACTICE',`<p>Follow the <b style="color:#ffcc33">yellow arrows</b>. Step onto a yellow square: the range buzzer sounds and drones fly out of the holes in the walls.</p>
      <p>Shoot them all (<b>left mouse</b>, <b>R</b> to reload) and the next square unlocks. Small red markers show where the drones are.</p>`],
    obj:ST.map((s,i)=>({text:`Step onto square ${i+1} and shoot the drones`,short:`WAVE ${i+1}`})),
    update(dt,p){
      if(!TUT.waveLive&&TUT.wave<ST.length){
        const s=ST[TUT.wave];
        if(p.grounded&&Math.abs(p.x-s*T)<T*1.1&&Math.abs(p.z-cz)<T*2.1){
          tsfx('buzz');TUT.waveLive=true;if(TUT.wave===0)TUT.startT=TUT.t;
          const o=waveOpts[TUT.wave];
          holes[TUT.wave].forEach((h,i)=>{const ax=h.n.x?V(0,0,1):V(1,0,0);drones.push(makeDrone(h.c,h.n,{...o,axis:ax,delay:.55+i*.35}));});
        }
      }
      if(TUT.waveLive&&drones.every(d=>!d.alive)){
        TUT.waveLive=false;drones=[];objDone(TUT.wave,`✓ WAVE ${TUT.wave+1} CLEAR`);TUT.wave++;
        if(TUT.wave>=ST.length){TUT.result=`14 drones in ${(TUT.t-TUT.startT).toFixed(1)} s · ${TUT.shots} shots fired`;tutComplete();}
      }
    },
  };
};

// ---------- 3. rocket jumping ----------
TUT_BUILD.rj=()=>{
  gbox(4,5,4,32,33,32,0);
  const P=[[4,9,4,9,11],[4,9,13,18,16],[4,9,22,27,21],[4,12,29,32,26]]; // x0,x1,z0,z1,top block
  for(const [x0,x1,z0,z1,top] of P){gbox(x0,5,z0,x1,top,z1,1);gbox(x0,top,z0,x1,top,z1,4);}
  const fy=5*T;
  // launch pad in front of each climb + arrows up the wall faces
  floorRect(11*T,4.5*T,14*T,9.5*T,fy,MKC.org,4);
  for(let x=19;x>14;x-=1.6)floorChev(x*T,7*T,fy,-1,0,MKC.org,4);
  for(let y=6.5;y<11;y+=1.7)chevron(V(10*T+.6,y*T,7*T),V(0,1,0),V(0,0,1),0,5,MKC.org);
  const tops=P.map(([x0,x1,z0,z1,top])=>({x0:x0*T,x1:(x1+1)*T,z0:z0*T,z1:(z1+1)*T,y:(top+1)*T}));
  for(const [i,t] of tops.entries()){
    floorRect(t.x0+8,t.z0+8,t.x1-8,t.z1-8,t.y,i===3?MKC.grn:MKC.cyan,4);
    if(i<3){const n=tops[i+1];for(let y=t.y/T+1;y<n.y/T-.5;y+=1.7)chevron(V((n.x0+n.x1)/2,y*T,n.z0-.6),V(0,1,0),V(1,0,0),2,5,MKC.org);}
  }
  TUT.rjCount=0;TUT.rjLaunch=null;TUT.reached=[false,false,false,false];
  return {
    name:'ROCKET JUMPING',spawn:{x:20*T,y:fy,z:8*T},yaw:-Math.PI/2,infRockets:true,damage:true,noDeath:true,
    props(){props.push(makeProp(18.2*T,fy,8*T,'launcher'));}, // the big launcher, right in front of you
    card:['ROCKET JUMPING',`<p>Walk over the <b style="color:#ff5a3c">launcher</b> in front of you to pick it up. Then look down at your feet and fire a rocket with the <b>middle mouse button</b> (or switch to the launcher with <b>2</b> and click). The blast <b>always</b> launches you — but standing on the ground it costs about <b>60% of your health</b>.</p>
      <p>The trick: <b>JUMP just before the rocket hits the floor</b>. Caught in the air, you fly higher and lose only <b>15–20%</b>. You have about half a second.</p>
      <p>Near the top of the jump you <b>float</b> for a moment — use it to steer onto a ledge. Each platform needs a rocket jump. You can't die in this room, and your health refills when you stand still.</p>`],
    obj:[{text:'Fire at your feet WITHOUT jumping — see what it costs',short:'NO-JUMP BLAST'},
         {text:'PERFECT rocket jump: jump just before the blast',short:'PERFECT',n:0,need:3},
         {text:'Reach platform 1 — steer during the float at the top',short:'PLATFORM 1'},{text:'Reach platform 2',short:'PLATFORM 2'},
         {text:'Reach platform 3',short:'PLATFORM 3'},{text:'Reach the summit (green pad)',short:'SUMMIT'}],
    onRJ(kind,dmg){
      const p=player,pct=Math.round(dmg);TUT.rjLaunch=p.y;TUT.rjApex=p.y;TUT.healT=0;
      if(kind==='perfect'){const o=TUT.cfg.obj[1];tsfx('ding');toast(`PERFECT ROCKET JUMP  −${pct}%`,'#3dff7a',2);
        if(!o.done){o.n++;if(o.n>=o.need)objDone(1,'✓ PERFECT ×3');}}
      else if(kind==='air'){tsfx('ding');toast(`GOOD ROCKET JUMP  −${pct}% — for PERFECT, fire first, then jump`,'#ffcc33',2.6);}
      else{toast(`NO JUMP  −${pct}% — jump just before the blast!`,'#ff8a2a',2.8);objDone(0,'✓ NOW TRY IT WITH A JUMP');}
    },
    update(dt,p){
      if(p.grounded&&p.state==='normal'){TUT.healT=(TUT.healT||0)+dt;if(TUT.healT>1.2)p.hp=Math.min(100,p.hp+dt*90);}else TUT.healT=0;
      if(TUT.rjLaunch!==null){TUT.rjApex=Math.max(TUT.rjApex,p.y);
        if(p.grounded||p.state==='hang'){const h=(TUT.rjApex-TUT.rjLaunch)/T;if(h>1)toast(`+${h.toFixed(1)} m`,'#29f0ff',1.8);TUT.rjLaunch=null;}}
      if(p.grounded)tops.forEach((t,i)=>{if(!TUT.reached[i]&&Math.abs(p.y-t.y)<5&&p.x>t.x0&&p.x<t.x1&&p.z>t.z0&&p.z<t.z1){TUT.reached[i]=true;objDone(i+2);if(i===3)tutComplete();}});
    },
  };
};

// ---------- 4. arena shift ----------
TUT_BUILD.shift=()=>{
  // a square corridor centred on the turning axis (x), so every turn maps it onto itself
  gbox(3,15,15,33,21,21,0);
  const S=[3,10,17,24,31,34];
  for(let f=0;f<4;f++){
    // in frame f the floor is j=14 and the panel to kick is on the +z wall at the end of section f
    // a 5x5 panel like the arena's (the corridor floor is its bottom ledge), with a strip of machinery over it
    const e=S[f+1]-1;
    gbox(e-4,15,22,e,19,22,2);
    for(let x=e-6,q=0,mix=machineryRuns(9,rnd);x<=e+2;x++,q++)if(x>S[f]-1)setT(x,20,21,mix[q]);
    // the floor of the next section is missing — a pit
    gbox(S[f+1],9,15,S[f+2]-1,14,21,0);gbox(S[f+1],8,15,S[f+2]-1,8,21,4);
    for(let x=S[f]+.8;x<e-2.6;x+=1.3)floorChev(x*T,17*T,15*T,1,0,MKC.yel,3.2);
    for(const x of [e-1.5])for(let z=17;z<21.5;z+=1.4)floorChev(x*T,z*T,15*T,0,1,MKC.mag,3.2);
    rotateGridOnly('+z');rotateDeco('+z');
  }
  gbox(34,16,17,34,19,19,5); // exit light
  genPanelDressing();genMachinery(); // the same frames, devices and pipes as the arena's panels
  panelPrevLive=null;world.panelSwitchT=-99; // (building turned the room round: no switch-on/off animation at the start)
  floorRect(31.2*T,15.5*T,33.8*T,21.5*T,15*T,MKC.grn,4);
  return {
    name:'ARENA SHIFT',spawn:{x:4.2*T,y:15*T,z:18.5*T},yaw:Math.PI/2,hud:{gravity:true},
    card:['ARENA SHIFT',`<p><b style="color:#ff3fa4">Magenta panels</b> turn the whole arena 90°. Walk up to one, <b>face it</b> and press <b>{kick}</b>: that wall becomes your floor.</p>
      <p>Each section of this corridor is missing the floor you're standing on. Kick the panel at the end of each section to walk on the wall, then the ceiling, then the other wall — all the way round to the exit.</p>
      <p>Fall into a pit and you're put back at the last checkpoint.</p>`],
    obj:[{text:'Face the magenta panel (turn right) and press {kick}',short:'SHIFT 1'},{text:'Walk on the wall to the next panel and kick it',short:'SHIFT 2'},
         {text:'Now the ceiling is your floor — kick the next panel',short:'SHIFT 3'},{text:'Last panel — kick it to come back to the floor',short:'SHIFT 4'},
         {text:'Reach the exit',short:'EXIT'}],
    snap:true,
    update(dt,p){
      const sec=S.findIndex((s,i)=>p.x>=s*T&&p.x<S[i+1]*T);
      const turns=world.turns-TUT.turns0;
      for(let i=0;i<4;i++)if(turns>i&&!TUT.cfg.obj[i].done)objDone(i);
      if(p.grounded&&!world.rot&&sec>0&&sec<5&&turns===sec&&TUT.cpSec<sec){TUT.cpSec=sec;tutSnap(V(Math.max(p.x,(S[sec]+.6)*T),p.y,18.5*T),Math.PI/2);toast('CHECKPOINT','#29f0ff',1.4);}
      if(sec===4&&turns>=4&&p.grounded&&p.x>31.5*T){TUT.cfg.obj[4].done=true;tutComplete();}
    },
    fell(p){return !world.rot&&p.y<15*T-28;},
  };
};

// ---------- 5. alliances ----------
// actors: walk / face helpers write the bot's controls directly
function actWalk(b,c,x,z,stop,run){const dx=x-b.x,dz=z-b.z,d=Math.hypot(dx,dz);if(d>(stop||8)){c.mx=dx/d;c.mz=dz/d;c.sprint=!!run&&d>90;}return d;}
function actFace(b,c,o){c.aimYaw=Math.atan2(o.x-b.x,o.z-b.z);c.aimPitch=0;}
// follow the player a little behind and to one side
function actFollow(b,c,side){const p=player,f=V(Math.sin(p.bodyYaw),0,Math.cos(p.bodyYaw)),r=V(-f.z,0,f.x);
  const gx=p.x-f.x*48+r.x*side*34,gz=p.z-f.z*48+r.z*side*34;const d=actWalk(b,c,gx,gz,14,true);if(d<=14)actFace(b,c,V(p.x+f.x*200,0,p.z+f.z*200));else c.aimYaw=Math.atan2(gx-b.x,gz-b.z);}
TUT_BUILD.ally=()=>{
  const fy=5*T;
  gbox(2,5,5,36,12,17,0);
  for(let x=4;x<30.5;x+=1.6)floorChev(x*T,11.5*T,fy,1,0,MKC.yel,3.2);
  for(const x of [9,17,24])floorRect(x*T,10.2*T,(x+1.2)*T,12.8*T,fy,MKC.cyan,3);
  floorRect(31*T,8.5*T,35*T,14.5*T,fy,MKC.grn,4);
  const say=(k,text,col,dur)=>{if(TUT.said&&TUT.said[k])return;(TUT.said||(TUT.said={}))[k]=1;toast(text,col||'#ccd',dur||4.5);};
  const A=()=>chars.find(c=>c.name==='VOLT'),B=()=>chars.find(c=>c.name==='NYX'),C=()=>chars.find(c=>c.name==='RAZOR'),D=()=>chars.find(c=>c.name==='KAI');
  const actors=[
    // case 1: VOLT offers, NYX accepts — VOLT takes NYX's colour
    {name:'VOLT',color:'#ff3fa4',x:10.6,z:8,yaw:Math.PI/2,script(b,c){const n=B();
      if(TUT.stage===1&&!b.team){actFace(b,c,n);if(!b.emote&&TUT.t-TUT.st0>.6&&TUT.t-TUT.st0<1.2)c.wave=true;}else if(b.team)actFace(b,c,player);}},
    {name:'NYX',color:'#ffb020',x:13,z:8,yaw:-Math.PI/2,script(b,c){const a=A();
      if(TUT.stage===1&&!b.team){actFace(b,c,a);if(a.emote&&a.emote.kind==='wave'&&a.emote.t>2.2)c.wave=true;}else if(b.team)actFace(b,c,player);}},
    // case 2: you wave at RAZOR, he comes over and accepts — you take his colour
    {name:'RAZOR',color:'#9dff3a',x:19.5,z:8,yaw:0,script(b,c){const p=player;
      if(b.team&&b.team===p.team){actFollow(b,c,-1);return;}
      if(TUT.stage>=2&&p.emote&&p.emote.kind==='wave'&&Math.hypot(p.x-b.x,p.z-b.z)<330){
        const gx=p.x+Math.sin(p.bodyYaw)*70,gz=p.z+Math.cos(p.bodyYaw)*70;const d=actWalk(b,c,gx,gz,10);
        if(d>10)c.aimYaw=Math.atan2(gx-b.x,gz-b.z);else{actFace(b,c,p);if(inFrontOf(p,b)&&p.emote.t>.8)c.wave=true;}}
      else actFace(b,c,p);}},
    // case 3: KAI comes to you and waves — you accept, and he joins your team
    {name:'KAI',color:'#b06bff',x:27.5,z:14.6,yaw:Math.PI,script(b,c){const p=player;
      if(b.team&&b.team===p.team){actFollow(b,c,1);return;}
      if(TUT.stage>=3){const gx=p.x+Math.sin(p.yaw)*72,gz=p.z+Math.cos(p.yaw)*72;
        if(b.emote){actFace(b,c,p);return;}
        const d=actWalk(b,c,gx,gz,12);if(d>12)c.aimYaw=Math.atan2(gx-b.x,gz-b.z);else{actFace(b,c,p);if(Math.abs(angDiff(Math.atan2(p.x-b.x,p.z-b.z),b.bodyYaw))<.3)c.wave=true;}}
      else actFace(b,c,p);}},
  ];
  return {
    name:'ALLIANCES',spawn:{x:3.5*T,y:fy,z:11.5*T},yaw:Math.PI/2,allyHud:true,actors,hud:{gravity:false},
    card:['ALLIANCES',`<p>Any fighter can offer an alliance. Press <b>T</b> to <b>wave</b>. Someone who comes to <b>stand in front of you</b> and presses <b>T</b> too <b>bows</b> with you — and the one who waved first <b>takes the other's colour</b>. You're a team until the round ends.</p>
      <p>Allies don't target each other (friendly fire still hurts), the team's score is its members' frags averaged, and if the team wins, you all win. Bots like to gang up on whoever is winning. There must always be two sides: the last lone fighter can't be absorbed.</p>
      <p>Follow the yellow line. Stop at each blue marker and watch, then do it yourself.</p>`],
    obj:[{text:'Walk to the first blue marker and watch VOLT and NYX',short:'WATCH'},
         {text:'Second marker: face RAZOR and press {wave} to wave — he comes over and accepts',short:'ASK'},
         {text:'Third marker: KAI comes to you and waves — face him and press {wave}',short:'ACCEPT'},
         {text:'Walk with your team to the green area',short:'FINISH'}],
    update(dt,p){
      const o=TUT.cfg.obj;TUT.stage=TUT.stage||0;
      if(TUT.stage===0&&p.x>8.6*T){TUT.stage=1;TUT.st0=TUT.t;say('s1','VOLT waves at NYX — offering an alliance');}
      if(TUT.stage===1){const a=A(),b=B();
        if(a.emote&&a.emote.kind==='bow')say('s1b','NYX stood in front of VOLT and pressed T — they bow…');
        if(a.team&&a.team===b.team){say('s1c','VOLT took NYX\'s colour — they are allies now','#ffb020');objDone(0,'✓ WATCHED');TUT.stage=2;}}
      if(TUT.stage===2&&p.x>15.5*T)say('s2',keyText('Your turn: face RAZOR and press {wave} to wave'),'#9dff3a');
      if(TUT.stage===2&&p.team&&p.team===C().team){say('s2b','RAZOR accepted — you took his colour. He follows you now','#9dff3a');objDone(1,'✓ ALLIANCE');TUT.stage=3;}
      if(TUT.stage===3&&p.x>22.5*T)say('s3',keyText('KAI wants to join you — face him and press {wave} when he waves'),D().color);
      if(TUT.stage===3&&D().team&&D().team===p.team){say('s3b','KAI joined your team. Walk to the green area together',p.color);objDone(2,'✓ NEW MEMBER');TUT.stage=4;}
      if(TUT.stage===4){const inG=e=>e.x>30.6*T&&e.x<35.4*T&&e.z>8*T&&e.z<15*T;
        if(inG(p)&&inG(C())&&inG(D())){o[3].done=true;TUT.result='Your team: '+sideName(p).split('+').join(' · ');tutComplete();}}
    },
  };
};

// ---------- 6. basic fight ----------
TUT_BUILD.fight=()=>{
  gbox(9,5,9,27,12,27,0);
  for(const [x,z] of [[13,13],[22,13],[13,22],[22,22]])gbox(x,5,z,x+1,8,z+1,3);
  gbox(17,5,18,19,5,18,1);gbox(18,5,16,18,5,20,1);
  return {
    name:'BASIC FIGHT',bots:1,frags:3,damage:true,hud:{score:true,gravity:false},medkits:true,
    card:['BASIC FIGHT',`<p>One easy bot. <b>First to 3 frags</b> wins.</p>
      <p>Use cover, kick the bot when it gets close (<b>E</b>), and try the rocket — a direct hit or a blast at its feet. Medkits drop from time to time.</p>`],
    obj:[{text:'Score 3 frags before the bot does',short:'WIN'}],
    props(){for(const [x,z,k] of [[11,25,'crate'],[25,11,'crate'],[16,11,'big'],[20,25,'barrel'],[11,17,'small']])props.push(makeProp((x+.5)*T,5*T,(z+.5)*T,k));},
    update(dt,p){
      if(gameState==='over'&&!TUT.overSeen){TUT.overSeen=true;
        if(winner===player){TUT.cfg.obj[0].done=true;tutComplete();}
        else{tsfx('fail');TUT.cardDelay=1.4;TUT.cardFn=()=>showCard('THE BOT WON',`<p>${winner.name} got to 3 frags first. Try again — keep moving, use the pillars as cover.</p>`,
          [{label:'TRY AGAIN',fn:()=>startTutorial('fight'),primary:true},{label:'TUTORIAL MENU',fn:openTutMenu}]);}
      }
    },
  };
};

// ================= runtime =================
function startTutorial(id){
  TUT.on=true;TUT.id=id;TUT.t=0;TUT.toast=[];TUT.complete=false;TUT.cp=null;TUT.cardDelay=-1;TUT.prevState='normal';TUT.overSeen=false;TUT.shots=0;
  for(const k of ['v1','v2','p1','p2','slid','result','stage','st0','said'])delete TUT[k];
  drones=[];rnd=Math.random;
  grid.fill(1);stairO.fill(0);deco=[];decals=[];
  const cfg=TUT_BUILD[id]();TUT.cfg=cfg;
  for(const o of cfg.obj){o.done=false;if('n' in o)o.n=0;}
  nav=null;buildNav();buildLevelMesh();buildDecoMesh();
  applyBotSkill('easy');
  chars=[makeChar(playerName(),SETTINGS.color,false)];
  for(let i=0;i<(cfg.bots||0);i++)chars.push(makeChar('DUMMY','#ffb020',true));
  player=chars[0];
  // scripted actors (they don't think for themselves: the room drives them)
  for(const a of cfg.actors||[]){const b=makeChar(a.name,a.color,true);b.script=a.script;b.actor=a;chars.push(b);}
  fixColorClash();
  props=[];bullets=[];rockets=[];parts=[];dolls=[];corpses=[];feed=[];spree=null;spiders=[];
  if(cfg.props)cfg.props();
  if(cfg.spawn)setCp(cfg.spawn.x,cfg.spawn.y,cfg.spawn.z,cfg.yaw);
  for(const e of chars){e.alive=false;e.respawn=0;spawn(e);}
  for(const b of chars)if(b.actor){const a=b.actor;Object.assign(b,{x:a.x*T,y:5*T,z:a.z*T,vx:0,vy:0,vz:0,invuln:0,grounded:true});b.yaw=b.bodyYaw=b.legYaw=a.yaw;b.fallStart=b.y;}
  Object.assign(world,{rotCD:0,rot:null,timeScale:1,lastKicker:null,lastKickT:-99,time:0,flash:0,shake:0,turns:0,hitstop:0,pendingRot:null,
    medT:cfg.medkits?12:1e9,barrelQ:[],sgQ:[],arQ:[],lnQ:[],noises:[],spiderT:1e9,fragLimit:cfg.frags||FRAG_LIMIT});
  TUT.turns0=0;TUT.cpSec=0;
  if(cfg.spawn)player.yaw=cfg.yaw;
  if(cfg.snap)tutSnap(V(cfg.spawn.x,cfg.spawn.y,cfg.spawn.z),cfg.yaw);
  cam.yaw=cfg.yaw!==undefined?cfg.yaw:player.yaw;cam.pitch=-.12;
  TUT.lastAmmo=player.ammo;
  gameState='play';winner=null;paused=false;
  {const pm=document.getElementById('pause');if(pm)pm.style.display='none';}
  showCard(cfg.card[0],cfg.card[1],[{label:'START',fn:closeCard,primary:true}]);
}
// shift room: remember the whole level so a fall puts everything back as it was
function tutSnap(pos,yaw){
  TUT.snap={grid:grid.slice(),deco:deco.map(d=>({c:V(d.c.x,d.c.y,d.c.z),s:d.s.slice(),col:d.col,em:d.em})),turns:world.turns};
  setCp(pos.x,pos.y,pos.z,yaw);
}
function tutRespawn(){
  const p=player,cp=TUT.cp;tsfx('fail');
  if(TUT.cfg.snap&&TUT.snap){
    grid=TUT.snap.grid.slice();deco=TUT.snap.deco.map(d=>({c:V(d.c.x,d.c.y,d.c.z),s:d.s.slice(),col:d.col,em:d.em}));decals=[];
    buildLevelMesh();buildDecoMesh();buildNav();world.turns=TUT.snap.turns;world.rot=null;world.rotCD=0;world.pendingRot=null;world.hitstop=0;
  }
  Object.assign(p,{x:cp.x,y:cp.y,z:cp.z,vx:0,vy:0,vz:0,state:'normal',h:STAND_H,crouch:false,knocked:false,stun:0,grounded:true,runJump:false,rocketJump:false,ba:0,bav:0,fallStart:cp.y,visX:0,visY:0,visZ:0});
  p.yaw=cp.yaw;cam.yaw=cp.yaw;cam.pitch=-.12;
  toast('BACK TO THE CHECKPOINT','#ff8a2a',1.8);
}
function tutComplete(){
  if(TUT.complete)return;TUT.complete=true;tsfx('done');
  TUT.done[TUT.id]=true;saveTutDone();
  toast('ROOM COMPLETE','#3dff7a',3);
  const i=TUT_ROOMS.findIndex(r=>r.id===TUT.id),next=TUT_ROOMS[i+1];
  TUT.cardDelay=1.6;
  TUT.cardFn=()=>showCard('ROOM COMPLETE',`<p>${TUT.cfg.name} — done.</p>${TUT.result?`<p>${TUT.result}</p>`:''}`,
    [...(next?[{label:'NEXT: '+next.name,fn:()=>startTutorial(next.id),primary:true}]:[{label:'ENTER THE ARENA',fn:()=>{closeCard();TUT.on=false;document.getElementById('go').click();},primary:true}]),
     {label:'PRACTICE THIS ROOM MORE',fn:closeCard},{label:'TUTORIAL MENU',fn:openTutMenu}]);
}
function tutStep(dt){
  const p=player,cfg=TUT.cfg;if(!cfg)return;
  TUT.t+=dt;
  if(!cfg.damage&&p.alive){p.hp=100;p.fallStart=Math.max(p.fallStart||0,p.y-HARD_FALL*.5);}
  if(cfg.infRockets){p.rockets=rMag(p);p.rreload=0;}
  if(p.ammo<TUT.lastAmmo&&p.reload<=0)TUT.shots+=TUT.lastAmmo-p.ammo;TUT.lastAmmo=p.ammo;
  if(p.state!==TUT.prevState){if(cfg.onState)cfg.onState(TUT.prevState,p.state,p);TUT.prevState=p.state;}
  if(cfg.update)cfg.update(dt,p);
  if(cfg.fell&&p.alive&&cfg.fell(p))tutRespawn();
  updateDrones(dt);
  for(const t of TUT.toast)t.t-=dt;TUT.toast=TUT.toast.filter(t=>t.t>0);
  if(TUT.cardDelay>0){TUT.cardDelay-=dt;if(TUT.cardDelay<=0&&TUT.cardFn){const f=TUT.cardFn;TUT.cardFn=null;f();}}
}
function tutHUD(c){
  const cfg=TUT.cfg;if(!cfg)return;
  // objective list
  const obj=cfg.obj,cur=obj.findIndex(o=>!o.done);
  c.textAlign='left';const x=16,y=16,w=Math.min(470,W*.45),hh=34+obj.length*19;
  c.fillStyle='rgba(5,6,14,.75)';c.fillRect(x,y,w,hh);c.fillStyle='#ff3fa4';c.fillRect(x,y,3,hh);
  c.font='bold 13px "Courier New",monospace';c.fillStyle='#29f0ff';c.fillText('TUTORIAL · '+cfg.name,x+12,y+20);
  c.font='12px "Courier New",monospace';
  obj.forEach((o,i)=>{const yy=y+40+i*19;
    c.fillStyle=o.done?'#3dff7a':i===cur?'#ffffff':'#667';
    const n=('n' in o)&&!o.done&&o.need?` (${o.n}/${o.need})`:'';
    c.fillText((o.done?'✓ ':i===cur?'▶ ':'· ')+keyText(o.text)+n,x+12,yy);});
  if(cfg.hud&&cfg.hud.shots){c.fillStyle='#889';c.textAlign='right';c.fillText(`shots ${TUT.shots}`,x+w-10,y+20);}
  // toasts
  c.textAlign='center';
  TUT.toast.forEach((t,i)=>{c.globalAlpha=clamp(t.t/.4,0,1);c.font=i===0?'bold 24px "Courier New",monospace':'bold 15px "Courier New",monospace';
    c.fillStyle='rgba(0,0,0,.45)';const tw=c.measureText(t.text).width;c.fillRect(W/2-tw/2-10,H*.3-24+i*30-(i?6:0),tw+20,i?24:32);
    c.fillStyle=t.col;c.fillText(t.text,W/2,H*.3+i*30);});c.globalAlpha=1;
  // drone markers
  for(const d of drones){if(!d.alive||d.delay>0)continue;const s=project(d.p);if(!s)continue;
    c.strokeStyle='#ff3b3b';c.lineWidth=2;c.beginPath();c.moveTo(s.x-9,s.y-16);c.lineTo(s.x,s.y-8);c.lineTo(s.x+9,s.y-16);c.stroke();}
  c.font='11px "Courier New",monospace';c.fillStyle='#667';c.textAlign='right';c.fillText('ESC — menu',W-16,H-12);
}

// ---------- menus / cards ----------
function showCard(title,html,buttons){
  TUT.cardOpen=true;paused=true;for(const k in keys)keys[k]=false;mouseDown=mouseRight=false;
  if(document.pointerLockElement===cv&&document.exitPointerLock)document.exitPointerLock();
  const el=document.getElementById('card');document.getElementById('cardT').textContent=title;document.getElementById('cardB').innerHTML=keyText(html);
  const bw=document.getElementById('cardBtns');bw.innerHTML='';
  for(const b of buttons){const e=document.createElement('button');e.textContent=b.label;if(b.primary)e.className='primary';e.onclick=b.fn;bw.appendChild(e);}
  el.style.display='flex';
}
function closeCard(){
  document.getElementById('card').style.display='none';TUT.cardOpen=false;paused=false;lockMouse();
}
function openTutMenu(){
  document.getElementById('card').style.display='none';TUT.cardOpen=false;
  setPaused(false);TUT.on=false;gameState='menu';
  document.getElementById('ov').style.display='none';
  const list=document.getElementById('tutlist');list.innerHTML='';
  TUT_ROOMS.forEach((r,i)=>{const b=document.createElement('button');b.className='room';
    b.innerHTML=`<span class="n">${i+1}</span><span class="t">${r.name}<small>${r.desc}</small></span><span class="ok">${TUT.done[r.id]?'✓':''}</span>`;
    b.onclick=()=>{if(!AC)initAudio();if(AC&&AC.state==='suspended')AC.resume();document.getElementById('tut').style.display='none';startTutorial(r.id);};
    list.appendChild(b);});
  tutHowto(false);document.getElementById('tut').style.display='flex';
}
// the how-to-play page inside the tutorial menu: its own button first in the list, and a way back
function tutHowto(on){const g=id=>document.getElementById(id);if(!g('howto'))return;
  g('howto').style.display=on?'block':'none';g('tutmain').style.display=on?'none':'block';g('tutbackrow').style.display=on?'none':'block';}
if(typeof document!=='undefined'&&document.getElementById('howtoBtn')){document.getElementById('howtoBtn').onclick=()=>tutHowto(true);document.getElementById('howtoBack').onclick=()=>tutHowto(false);}
document.getElementById('tutback').onclick=()=>{document.getElementById('tut').style.display='none';showMenu('pgMain');};
