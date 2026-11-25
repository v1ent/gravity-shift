// =====================================================================
//  DECO — pipes, vents, electrical boxes, conduits, cable trays, lamps
//  purely visual boxes hugging block faces; they turn with the arena
// =====================================================================
let deco=[]; // {c:V, s:[sx,sy,sz], col:[r,g,b], em:number}
const DC={pipeT:hexRGB('#5aa9b5'),pipeC:hexRGB('#d0823f'),pipeG:hexRGB('#98a2b8'),pipeW:hexRGB('#e6e9f0'),flange:hexRGB('#3a4152'),
  vent:hexRGB('#59627c'),slat:hexRGB('#0c0e14'),ebox:hexRGB('#6b7896'),door:hexRGB('#8794b4'),cable:hexRGB('#1a1c24'),tray:hexRGB('#8a909e'),
  ledG:hexRGB('#3dff7a'),ledR:hexRGB('#ff3b3b'),ledA:hexRGB('#ffb020'),lampC:hexRGB('#29f0ff'),lampA:hexRGB('#ffb020'),stripe:hexRGB('#ffcc33')};
const AX=[V(1,0,0),V(0,1,0),V(0,0,1)];
const comp=(v,a)=>a===0?v.x:a===1?v.y:v.z;
function addD(c,sx,sy,sz,col,em){deco.push({c,s:[sx,sy,sz],col,em:em||6});}
// a box given by centre, half-extent along tangent t1 (len), along t2 (w), along normal n (d)
function addOriented(c,ta,len,tb,w,na,d,col,em){const s=[0,0,0];s[ta]=len;s[tb]=w;s[na]=d;addD(c,s[0],s[1],s[2],col,em);}
const decorable=t=>t===1||t===3||t===4||t===6;
function exposedFace(i,j,k,n){ // block (i,j,k) solid & decorable, neighbour in direction n is air
  const t=tile(i,j,k);if(!decorable(t))return false;
  return !solid(tile(i+n[0],j+n[1],k+n[2]));
}
function genDeco(){
  deco=[];
  const R=rnd; // seeded during level setup
  const NS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const pick=()=>{for(let tr=0;tr<60;tr++){const i=1+(R()*(N-2)|0),j=(R()*N)|0,k=1+(R()*(N-2)|0),n=NS[R()*6|0];
      // shell blocks too (i/j/k may be 0 or N-1 via j); interior blocks preferred
      if(exposedFace(i,j,k,n))return {i,j,k,n};}return null;};
  const nAxis=n=>n[0]?0:n[1]?1:2;
  const faceCentre=(i,j,k,n,off)=>V((i+.5+n[0]*.5)*T+n[0]*off,(j+.5+n[1]*.5)*T+n[1]*off,(k+.5+n[2]*.5)*T+n[2]*off);
  // ---- pipe runs (floors excluded: walls & ceilings only)
  let made=0;
  for(let tries=0;tries<1400&&made<65;tries++){
    const f=pick();if(!f||f.n[1]===1)continue;
    const na=nAxis(f.n),cand=[0,1,2].filter(a=>a!==na);const ta=cand[R()*2|0],tb=cand.find(a=>a!==ta);
    const step=[0,0,0];step[ta]=1;
    // extend the run both ways along ta while the face stays exposed
    let a=0,b=0;
    while(a<14&&exposedFace(f.i-step[0]*(a+1),f.j-step[1]*(a+1),f.k-step[2]*(a+1),f.n))a++;
    while(b<14&&exposedFace(f.i+step[0]*(b+1),f.j+step[1]*(b+1),f.k+step[2]*(b+1),f.n))b++;
    const len=a+b+1;if(len<4)continue;
    const r=3.5+R()*3.5,count=R()<.45?2+(R()*2|0):1;
    const pal=[DC.pipeT,DC.pipeC,DC.pipeG,DC.pipeW][R()*4|0];
    const pos0=R()*.5+.25;
    for(let p=0;p<count;p++){
      const lat=(pos0-.5)*T+(p-(count-1)/2)*(r*2+2.5);
      const c=faceCentre(f.i,f.j,f.k,f.n,r+1.5);
      const mid=(b-a)/2*T;
      const cc=V(c.x+AX[ta].x*mid+AX[tb].x*lat,c.y+AX[ta].y*mid+AX[tb].y*lat,c.z+AX[ta].z*mid+AX[tb].z*lat);
      addOriented(cc,ta,len*T-4,tb,r*2,na,r*2,pal,6);
      // flanges / clamps every couple of blocks
      for(let q=-a;q<=b;q+=2+(R()*2|0)){
        const fc=V(c.x+AX[ta].x*q*T+AX[tb].x*lat,c.y+AX[ta].y*q*T+AX[tb].y*lat,c.z+AX[ta].z*q*T+AX[tb].z*lat);
        addOriented(fc,ta,3,tb,r*2+2.5,na,r*2+2,DC.flange,6);
      }
      // the odd valve wheel
      if(R()<.3){const q=-a+(R()*len|0);const vc=V(c.x+AX[ta].x*q*T+AX[tb].x*lat+f.n[0]*(r+2),c.y+AX[ta].y*q*T+AX[tb].y*lat+f.n[1]*(r+2),c.z+AX[ta].z*q*T+AX[tb].z*lat+f.n[2]*(r+2));
        addOriented(vc,ta,8,tb,8,na,2,DC.ledR,6);}
    }
    made++;
  }
  // ---- vents (walls and ceilings)
  made=0;
  for(let tries=0;tries<700&&made<32;tries++){
    const f=pick();if(!f||f.n[1]===1)continue;
    const na=nAxis(f.n),[ta,tb]=[0,1,2].filter(a=>a!==na);
    const c=faceCentre(f.i,f.j,f.k,f.n,1.8),big=R()<.5;
    const lw=big?30:22,lh=big?22:15;
    addOriented(c,ta,lw,tb,lh,na,3.6,DC.vent,6);
    const slats=big?5:4;
    for(let s2=0;s2<slats;s2++){const o=(s2-(slats-1)/2)*(lh/(slats+.5));
      addOriented(V(c.x+AX[tb].x*o+f.n[0]*1.9,c.y+AX[tb].y*o+f.n[1]*1.9,c.z+AX[tb].z*o+f.n[2]*1.9),ta,lw-5,tb,2.2,na,1.2,DC.slat,6);}
    made++;
  }
  // ---- electrical boxes with LEDs and a conduit running along the wall
  made=0;
  for(let tries=0;tries<700&&made<28;tries++){
    const f=pick();if(!f||f.n[1]!==0)continue; // walls only
    const na=nAxis(f.n),ta=na===0?2:0; // horizontal tangent
    const c=faceCentre(f.i,f.j,f.k,f.n,4);
    addD(V(c.x,c.y,c.z),na===0?8:22,26,na===0?22:8,DC.ebox,6);
    const doorC=V(c.x+f.n[0]*4.2,c.y,c.z+f.n[2]*4.2);addD(doorC,na===0?1:17,20,na===0?17:1,DC.door,6);
    const leds=[DC.ledG,DC.ledG,DC.ledA,DC.ledR];
    for(let l=0;l<3;l++){const lc=V(doorC.x+f.n[0]*.9+AX[ta].x*(l-1)*4.5,doorC.y+6,doorC.z+f.n[2]*.9+AX[ta].z*(l-1)*4.5);addD(lc,3,3,3,leds[R()*4|0],R()<.45?7:5);}
    // hazard stripe
    addD(V(doorC.x+f.n[0]*.6,doorC.y-6,doorC.z+f.n[2]*.6),na===0?.8:14,3,na===0?14:.8,DC.stripe,6);
    // conduit up the wall from the box
    let up=0;while(up<8&&exposedFace(f.i,f.j+up+1,f.k,f.n))up++;
    if(up>0){const cc=V(c.x+AX[ta].x*5,c.y+10+up*T/2,c.z+AX[ta].z*5);addD(V(cc.x-f.n[0]*1.5,cc.y,cc.z-f.n[2]*1.5),4.5,up*T,4.5,DC.pipeG,6);}
    made++;
  }
  // ---- cable trays under ceilings
  made=0;
  for(let tries=0;tries<700&&made<16;tries++){
    const f=pick();if(!f||f.n[1]!==-1)continue;
    const ta=R()<.5?0:2,tb=ta===0?2:0,step=[0,0,0];step[ta]=1;
    let a=0,b=0;
    while(a<12&&exposedFace(f.i-step[0]*(a+1),f.j,f.k-step[2]*(a+1),f.n))a++;
    while(b<12&&exposedFace(f.i+step[0]*(b+1),f.j,f.k+step[2]*(b+1),f.n))b++;
    const len=a+b+1;if(len<4)continue;
    const c=faceCentre(f.i,f.j,f.k,f.n,7),mid=(b-a)/2*T;
    const cc=V(c.x+AX[ta].x*mid,c.y,c.z+AX[ta].z*mid);
    addOriented(cc,ta,len*T-6,tb,18,1,2.5,DC.tray,6);
    for(const o of [-5,0,5])addOriented(V(cc.x+AX[tb].x*o,cc.y+2.5,cc.z+AX[tb].z*o),ta,len*T-6,tb,3.5,1,3.5,o?DC.cable:DC.ledR,6);
    for(let q=-a;q<=b;q+=3)addOriented(V(c.x+AX[ta].x*q*T,c.y+4,c.z+AX[ta].z*q*T),ta,1.5,tb,2,1,8,DC.flange,6); // hangers
    made++;
  }
  // ---- small lamps / warning lights
  made=0;
  for(let tries=0;tries<600&&made<40;tries++){
    const f=pick();if(!f)continue;
    const na=nAxis(f.n),[ta,tb]=[0,1,2].filter(a=>a!==na);
    const c=faceCentre(f.i,f.j,f.k,f.n,1.5);
    if(f.n[1]===-1)addOriented(c,ta,26,tb,5,na,2.5,R()<.6?DC.lampC:DC.lampA,5); // ceiling strip light
    else if(f.n[1]===0){addOriented(c,ta,5,tb,7,na,3,DC.flange,6);addOriented(V(c.x+f.n[0]*2,c.y,c.z+f.n[2]*2),ta,3,tb,4,na,2,R()<.5?DC.lampA:DC.ledR,R()<.4?7:5);}
    else continue;
    made++;
  }
  genPanelDressing();genMachinery();
  if(typeof genDecals==='function')genDecals(); // stencils, signs, graffiti, dirt (src/02c_decals.js)
}
// ---------- dressing round the gravity panels (looks only: no collision) ----------
// a steel bezel with a neon line, equipment boxes with vents and LEDs at the corners, pipes down the sides,
// cable bundles running off along the wall, and on the ledges above/below: conduits, junction boxes, warning
// lights and a lamp under the top ledge shining on the panel
let panelSpots=[]; // centre and facing of every panel (handy for tests and cameras)
function genPanelDressing(){
  panelSpots=[];
  const R=rnd,seen=new Set(),PM=hexRGB('#ff3fa4'),DARK=hexRGB('#232836'),STEEL=hexRGB('#4a5268'),CAB=[DC.cable,hexRGB('#2a2d38'),hexRGB('#1c2230'),hexRGB('#33303a'),hexRGB('#151820')];
  for(let k0=0;k0<N;k0++)for(let j0=0;j0<N;j0++)for(let i0=0;i0<N;i0++){
    if(tile(i0,j0,k0)!==2||seen.has(gi(i0,j0,k0)))continue;
    // the panel: all type-2 blocks connected to this one
    const st=[[i0,j0,k0]],cells=[];seen.add(gi(i0,j0,k0));
    while(st.length){const [i,j,k]=st.pop();cells.push([i,j,k]);
      for(const [a,b,c] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const q=[i+a,j+b,k+c];if(tile(...q)===2&&!seen.has(gi(...q))){seen.add(gi(...q));st.push(q);}}}
    const mn=[0,1,2].map(x=>Math.min(...cells.map(c=>c[x]))),mx=[0,1,2].map(x=>Math.max(...cells.map(c=>c[x])));
    const na=[0,1,2].find(x=>mn[x]===mx[x]);if(na===undefined)continue;
    const nv=[0,0,0];nv[na]=mn[na]<N/2?1:-1; // into the arena
    const tg=[0,1,2].filter(x=>x!==na),bax=tg.includes(1)?1:tg[1],aax=tg.find(x=>x!==bax); // b is "up" on walls
    const ha=(mx[aax]-mn[aax]+1)*T/2,hb=(mx[bax]-mn[bax]+1)*T/2;
    const O=[0,0,0];O[aax]=(mn[aax]+mx[aax]+1)*T/2;O[bax]=(mn[bax]+mx[bax]+1)*T/2;O[na]=nv[na]>0?(mn[na]+1)*T:mn[na]*T;
    const wall=na!==1;panelSpots.push({c:V(O[0],O[1],O[2]),n:V(nv[0],nv[1],nv[2]),wall});
    // a box in panel space: centre (pa,pb,pn), size (sa,sb,sn); pn is the distance out from the wall
    const box=(pa,pb,pn,sa,sb,sn,col,em)=>{const c=O.slice();c[aax]+=pa;c[bax]+=pb;c[na]+=pn*nv[na];const s=[0,0,0];s[aax]=sa;s[bax]=sb;s[na]=sn;addD(V(c[0],c[1],c[2]),s[0],s[1],s[2],col,em||8);};
    const onWall=(pa,pb)=>{const c=O.slice();c[aax]+=pa;c[bax]+=pb;c[na]-=nv[na]*T/2;const i=Math.floor(c[0]/T),j=Math.floor(c[1]/T),k=Math.floor(c[2]/T);
      return decorable(tile(i,j,k))&&!solid(tile(i+nv[0],j+nv[1],k+nv[2]));};
    // bezel + neon line
    const t=6;
    box(0,hb+t/2,2,2*ha+2*t,t,4,STEEL);box(0,-hb-t/2,2,2*ha+2*t,t,4,STEEL);box(ha+t/2,0,2,t,2*hb,4,STEEL);box(-ha-t/2,0,2,t,2*hb,4,STEEL);
    box(0,hb+t*.5,4.3,2*ha+2*t-4,1.2,.8,PM,5);box(0,-hb-t*.5,4.3,2*ha+2*t-4,1.2,.8,PM,5);box(ha+t*.5,0,4.3,1.2,2*hb,.8,PM,5);box(-ha-t*.5,0,4.3,1.2,2*hb,.8,PM,5);
    // ---- the border: bands packed with devices, pipes and cables ----
    // put(s,c,h,ss,cs,hs,col,em): a box in a band — s along it, c across it, h out from its mounting surface
    const band=(put,s0,s1,c0,c1,maxH,ok)=>{
      const W2=c1-c0;
      // pipes running the length of the band: round, square, flat duct, insulated, ribbed
      const np=R()<.4?0:1+(R()*2|0);
      for(let q=0;q<np;q++){
        const style=R()*5|0,d=style===2?3:[3.5,5,6.5,8][R()*4|0],cw=style===2?10+R()*8:d,cc=c0+cw/2+2+R()*Math.max(0,W2-cw-4),hh=maxH*(.25+R()*.55);
        const col=[DC.pipeG,STEEL,DC.flange,DC.pipeG][R()*4|0],len=s1-s0;
        if(!ok((s0+s1)/2,cc))continue;
        put((s0+s1)/2,cc,hh,len,cw,d,col);
        if(style===3)for(let x=s0+6;x<s1-4;x+=10)put(x,cc,hh,5,cw+1.4,d+1.4,DC.pipeW);          // insulation wraps
        else if(style===4)for(let x=s0+3;x<s1-2;x+=6)put(x,cc,hh,1.6,cw+1.6,d+1.6,DC.flange);   // ribbed
        else for(let x=s0+10+R()*20;x<s1-6;x+=26+R()*34){put(x,cc,hh,3,cw+3.5,d+3.5,DC.flange);
          if(R()<.25){put(x+6,cc,hh+d/2+3,2,2,5,DC.flange);put(x+6,cc,hh+d/2+5,9,9,1.2,DC.ledR);}} // flanges, now and then a valve wheel
        // where it meets the wall: elbows into the surface at both ends
        put(s0+2,cc,hh/2,d,cw,hh,col);put(s1-2,cc,hh/2,d,cw,hh,col);
      }
      // devices packed along the band
      for(let x=s0+2;x<s1-6;){
        const w=Math.min(s1-2-x,8+R()*22);if(w<6)break;
        if(R()<.45){
          const cw=Math.min(W2-2,10+R()*(W2-8)),cc=c0+1+cw/2+R()*Math.max(0,W2-2-cw),hd=Math.min(maxH,4+R()*maxH*.8),xc=x+w/2;
          if(ok(xc,cc)){
            put(xc,cc,hd/2,w,cw,hd,[DARK,STEEL,DARK,DC.vent][R()*4|0]);
            const kind=R()*6|0,f=hd+.4;
            if(kind===0)for(let y=-cw/2+3;y<cw/2-2;y+=3.2)put(xc,cc+y,f,w-4,1.1,.8,DC.slat);                        // vent bank
            else if(kind===1){const n=1+(R()*2|0);for(let q=0;q<n;q++)put(xc-w/2+3+q*4,cc+cw/2-3,f,1.6,1.6,.8,R()<.7?DC.ledG:DC.ledR,7);} // an LED or two
            else if(kind===2&&R()<.4)put(xc,cc,f,w-5,Math.min(cw-5,10),.6,DC.lampC,5);   // little screen (now and then)
            else if(kind===3)put(xc,cc,f,w-3,1.6,.6,DC.flange);   // a seam
            else if(kind===4){put(xc,cc,f+1.5,2,cw*.6,3,DC.tray);put(xc,cc,f+.2,5,5,.6,DC.pipeW,5);}                       // handle + gauge
            else{put(xc,cc,f,w*.5,cw*.5,1.2,DC.flange);put(xc+w*.3,cc+cw*.3,f+.6,2,2,.6,DC.ledG,7);}                       // hatch + LED
            if(R()<.35)put(xc,cc,hd+2,2,2,4,DC.tray);                                                                     // antenna stub / connector
          }
        }
        x+=w+1+R()*6;
      }
      // cables: thin, in colours, sagging between clips
      const nc=2+(R()*3|0);
      for(let q=0;q<nc;q++){
        const cc=c0+2+R()*(W2-4),col=CAB[R()*CAB.length|0],d=1.4+R()*1.2,hh=1+R()*2,sag=3+R()*6;let x=s0;
        while(x<s1-4){const span=30+R()*40,e=Math.min(s1,x+span),n=Math.max(2,Math.round((e-x)/11));
          for(let k=0;k<n;k++){const a0=x+(e-x)*k/n,a1=x+(e-x)*(k+1)/n,m=(k+.5)/n,off=sag*4*m*(1-m);
            if(ok((a0+a1)/2,cc-off))put((a0+a1)/2,cc-off,hh,a1-a0+.8,d,d,col,6);}
          put(e,cc,hh,2,d+3,d+2,DC.tray);x=e;}
      }
    };
    const T2=T*2-2;
    if(wall){
      // both sides of the panel, between the ledges
      band((s,c,h,ss,cs,hs,col,em)=>box(-ha-t-c,s,h,cs,ss,hs,col,em),-hb,hb,0,T2-t,16,(s,c)=>onWall(-ha-t-c,s));
      band((s,c,h,ss,cs,hs,col,em)=>box(ha+t+c,s,h,cs,ss,hs,col,em),-hb,hb,0,T2-t,16,(s,c)=>onWall(ha+t+c,s));
    }
    if(wall){ // a lamp under the top ledge, shining on the panel
      box(0,hb-2,T*1.2,2*ha-10,3,6,DC.lampC,5);box(0,hb-.6,T*1.2,2*ha,1.2,10,DARK);
    }
  }
}
// ---------- machinery: the ledges and curbs round the panels (voxel type 7) ----------
// Collision is the plain block; what you see is built from smaller parts: a dark core, plates and grates on top,
// and on the sides and undersides pipes that run on unbroken along the whole ledge plus a row of mixed devices.
function genMachinery(){
  const R=rnd,AX=[V(1,0,0),V(0,1,0),V(0,0,1)],NS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const CORE=hexRGB('#151925'),STEEL=hexRGB('#4a5268'),PLATE=[hexRGB('#3c4459'),hexRGB('#454e66'),hexRGB('#363d50')],DARK=hexRGB('#232836');
  const comp=new Map();let nComp=0;
  const isM=(i,j,k)=>tile(i,j,k)===7;
  // components (one per ledge / curb), each with its own pipe layout per facing
  for(let k0=0;k0<N;k0++)for(let j0=0;j0<N;j0++)for(let i0=0;i0<N;i0++){if(!isM(i0,j0,k0)||comp.has(gi(i0,j0,k0)))continue;
    const id=nComp++,st=[[i0,j0,k0]];comp.set(gi(i0,j0,k0),id);
    while(st.length){const [i,j,k]=st.pop();for(const n of NS){const q=[i+n[0],j+n[1],k+n[2]];if(isM(...q)&&!comp.has(gi(...q))){comp.set(gi(...q),id);st.push(q);}}}}
  const layouts=new Map();
  const layout=(id,fi)=>{const key=id*6+fi;if(layouts.has(key))return layouts.get(key);
    const pipes=[],np=1+(R()*3|0);let c=-T/2+3;
    for(let q=0;q<np&&c<-2;q++){const d=[3,4,5.5,7][R()*4|0];pipes.push({c:c+d/2,d,col:[DC.pipeG,STEEL,DC.flange,DARK][R()*4|0],wrap:R()<.2});c+=d+1+R()*2;}
    const L2={pipes,devLo:Math.max(c,-4),devHi:T/2-2};layouts.set(key,L2);return L2;};
  const bx=(c,s,col,em)=>addD(c,s.x,s.y,s.z,col,em||8);
  for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    if(!isM(i,j,k))continue;const id=comp.get(gi(i,j,k)),cc=V((i+.5)*T,(j+.5)*T,(k+.5)*T);
    const exp=NS.map(n=>!solid(tile(i+n[0],j+n[1],k+n[2])));
    // the core, pulled in 2.5 from every open face
    {let lo=[-T/2,-T/2,-T/2],hi=[T/2,T/2,T/2];NS.forEach((n,f)=>{if(!exp[f])return;const a=n.findIndex(x=>x!==0);if(n[a]>0)hi[a]-=2.5;else lo[a]+=2.5;});
      bx(V(cc.x+(lo[0]+hi[0])/2,cc.y+(lo[1]+hi[1])/2,cc.z+(lo[2]+hi[2])/2),V(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]),CORE,6);}
    NS.forEach((n,f)=>{
      if(!exp[f])return;
      const na=n.findIndex(x=>x!==0),tg=[0,1,2].filter(x=>x!==na);
      // the run: the face direction along which this ledge continues
      const runA=tg.find(a=>{const e=[0,0,0];e[a]=1;return isM(i+e[0],j+e[1],k+e[2])||isM(i-e[0],j-e[1],k-e[2]);});
      const ra=runA===undefined?tg[0]:runA,ca=tg.find(x=>x!==ra);
      const nv=V(n[0],n[1],n[2]),rv=AX[ra],cv=AX[ca];
      const fc=vadd(cc,vscale(nv,T/2));
      // a part on this face: s along the run, c across, from depth 'in' below the face to 'out' above it
      const part=(s,c,ss,cs,inn,out,col,em)=>{const p=vadd(vadd(vadd(fc,vscale(rv,s)),vscale(cv,c)),vscale(nv,(out-inn)/2));
        const sz=[0,0,0];sz[ra]=ss;sz[ca]=cs;sz[na]=out+inn;bx(p,V(sz[0],sz[1],sz[2]),col,em);};
      const up=n[1]===1&&na===1; // a top you walk on (as generated)
      if(up){
        // plates, grates and the odd hatch, flush with the top
        for(const a of [-1,1])for(const b of [-1,1]){const r=R(),sc=a*T/4,cc2=b*T/4;
          if(r<.2){part(sc,cc2,T/2-1.2,T/2-1.2,2.5,.2,DARK);for(let q=-5;q<=5;q+=2.5)part(sc,cc2+q,T/2-3,.9,.2,.45,STEEL);}
          else if(r<.27){part(sc,cc2,T/2-1.2,T/2-1.2,2.5,.25,PLATE[0]);part(sc,cc2,T/2-6,T/2-6,.1,.5,STEEL);}
          else part(sc,cc2,T/2-1.2,T/2-1.2,2.5,.25,PLATE[R()*3|0]);}
        // a lip along any open edge: a steel nosing with yellow tape
        return;
      }
      const LY=layout(id,f);
      // pipes, unbroken from cell to cell
      for(const P of LY.pipes){part(0,P.c,T+.4,P.d,2.5,P.d-1.5,P.col);
        if(P.wrap)part(0,P.c,5,P.d+1.2,2.5,P.d-.9,DC.flange);
        else if(R()<.35)part((R()-.5)*T*.7,P.c,2.6,P.d+2.6,2.5,P.d-.4,DC.flange);}
      // devices along the rest of the face
      let s=-T/2+.6;
      while(s<T/2-3){const w=Math.min(T/2-.6-s,5+R()*14);if(w<3)break;const xc=s+w/2;
        const lo=LY.devLo,hi=LY.devHi,ch=Math.max(4,(hi-lo)*(.55+R()*.45)),c0=lo+(hi-lo-ch)*R()+ch/2,out=.3+R()*1.6;
        const r=R();
        if(r<.12){part(xc,c0,w-.4,ch,2.5,.1,CORE);}  // a gap
        else{part(xc,c0,w-.4,ch,2.5,out,[DARK,STEEL,DARK,DC.vent][R()*4|0]);
          const f2=out+.35,k2=R()*5|0;
          if(k2===0)for(let y=-ch/2+1.6;y<ch/2-1;y+=2)part(xc,c0+y,w-2,.7,0,f2,DC.slat);
          else if(k2===1&&R()<.5)part(xc-w/2+2,c0+ch/2-1.8,1.3,1.3,0,f2+.2,R()<.7?DC.ledG:DC.ledR,7);
          else if(k2===2&&w>6&&R()<.3)part(xc,c0,w-3,Math.min(ch-2,6),0,f2,DC.lampC,5);
          else if(k2===3)part(xc,c0+ch/2-1.2,w-.4,1.6,0,f2,DC.flange);
          else part(xc,c0,w*.45,ch*.45,0,f2+.3,DC.flange);}
        s+=w;}
    });
  }
}
function rotateDeco(key){
  const r=ROT[key];
  // which panels were live, in the turned arena's coordinates: the mesh animates the ones that switch on or off
  {const s=new Set();for(const id of panelLiveNow){const i=id%N,j=Math.floor(id/N)%N,k=Math.floor(id/(N*N)),q=r.pt((i+.5)*T,(j+.5)*T,(k+.5)*T);
    s.add(gi(Math.floor(q[0]/T),Math.floor(q[1]/T),Math.floor(q[2]/T)));}panelPrevLive=s;world.panelSwitchT=world.time;}if(typeof rotateDecals==='function')rotateDecals(key);
  for(const d of deco){const q=r.pt(d.c.x,d.c.y,d.c.z);d.c=V(q[0],q[1],q[2]);if(key[1]==='x'){const t=d.s[0];d.s[0]=d.s[1];d.s[1]=t;}else{const t=d.s[2];d.s[2]=d.s[1];d.s[1]=t;}}
}
function buildDecoMesh(){
  if(typeof buildDecalMesh==='function')buildDecalMesh();
  if(!R.ok)return;
  const out=[];
  for(const d of deco){
    const [sx,sy,sz]=d.s,c=d.c,col=d.col,em=d.em;
    for(let ax=0;ax<3;ax++)for(const sg of [-1,1]){
      const u=(ax+1)%3,v=(ax+2)%3,half=[sx/2,sy/2,sz/2];
      const w=[sx,sy,sz][u]/T,h=[sx,sy,sz][v]/T;
      const corner=(a,b)=>{const p=[c.x,c.y,c.z];p[ax]+=sg*half[ax];p[u]+=(a-.5)*2*half[u];p[v]+=(b-.5)*2*half[v];return p;};
      const nor=[0,0,0];nor[ax]=sg;
      const vt=(a,b)=>{const p=corner(a,b);out.push(p[0],p[1],p[2],nor[0],nor[1],nor[2],col[0],col[1],col[2],a*w,b*h,w,h,em);};
      vt(0,0);vt(1,0);vt(1,1);vt(0,0);vt(1,1);vt(0,1);
    }
  }
  const gl=R.gl;if(!R.deco)R.deco=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,R.deco);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.STATIC_DRAW);R.decoN=out.length/STRIDE;
}
