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
  genPanelDressing();
  if(typeof genDecals==='function')genDecals(); // stencils, signs, graffiti, dirt (src/02c_decals.js)
}
// ---------- dressing round the gravity panels (looks only: no collision) ----------
// a steel bezel with a neon line, equipment boxes with vents and LEDs at the corners, pipes down the sides,
// cable bundles running off along the wall, and on the ledges above/below: conduits, junction boxes, warning
// lights and a lamp under the top ledge shining on the panel
let panelSpots=[]; // centre and facing of every panel (handy for tests and cameras)
function genPanelDressing(){
  panelSpots=[];
  const R=rnd,seen=new Set(),PM=hexRGB('#ff3fa4'),DARK=hexRGB('#232836'),STEEL=hexRGB('#4a5268'),CAB=[DC.cable,hexRGB('#b0202c'),hexRGB('#d8a41c'),hexRGB('#1d6f86'),hexRGB('#2a2d38')];
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
    const box=(pa,pb,pn,sa,sb,sn,col,em)=>{const c=O.slice();c[aax]+=pa;c[bax]+=pb;c[na]+=pn*nv[na];const s=[0,0,0];s[aax]=sa;s[bax]=sb;s[na]=sn;addD(V(c[0],c[1],c[2]),s[0],s[1],s[2],col,em);};
    const onWall=(pa,pb)=>{const c=O.slice();c[aax]+=pa;c[bax]+=pb;c[na]-=nv[na]*T/2;const i=Math.floor(c[0]/T),j=Math.floor(c[1]/T),k=Math.floor(c[2]/T);
      return decorable(tile(i,j,k))&&!solid(tile(i+nv[0],j+nv[1],k+nv[2]));};
    // bezel + neon line
    const t=6;
    box(0,hb+t/2,2,2*ha+2*t,t,4,STEEL);box(0,-hb-t/2,2,2*ha+2*t,t,4,STEEL);box(ha+t/2,0,2,t,2*hb,4,STEEL);box(-ha-t/2,0,2,t,2*hb,4,STEEL);
    box(0,hb+t*.5,4.3,2*ha+2*t-4,1.2,.8,PM,5);box(0,-hb-t*.5,4.3,2*ha+2*t-4,1.2,.8,PM,5);box(ha+t*.5,0,4.3,1.2,2*hb,.8,PM,5);box(-ha-t*.5,0,4.3,1.2,2*hb,.8,PM,5);
    // corner units: a housing, vent slats, an LED, a small lamp
    for(const sa of [-1,1])for(const sb of [-1,1]){
      const pa=sa*(ha+t+7),pb=sb*(hb-10);
      box(pa,pb,4,14,18,8,DARK);for(let q=0;q<4;q++)box(pa,pb-6+q*3.6,8.2,10,1.2,.6,DC.slat);
      box(pa+sa*-3,pb+sb*7,8.4,2.4,2.4,.8,[DC.ledG,DC.ledR,DC.ledA][R()*3|0],7);
      box(pa,pb-sb*11,3,6,4,6,DC.ebox);
    }
    // pipes down both sides, with flanges
    if(wall){const col=[DC.pipeT,DC.pipeG,DC.pipeC][R()*3|0];
      for(const sa of [-1,1])for(const off of [24,31]){const pa=sa*(ha+off);if(!onWall(pa,0))continue;
        box(pa,0,4,4.5,2*hb-4,4.5,col);for(let y=-hb+14;y<hb-6;y+=34)box(pa,y,4,7,3,7,DC.flange);}}
    // cable bundles running off along the wall from the corner units, turning once
    for(let q=0;q<4;q++){
      const sa=q<2?-1:1,sb=q%2?1:-1;let pa=sa*(ha+t+14),pb=sb*(hb-6);const nC=2+(R()*3|0),out=[];
      let dir=[sa,0],len=0,turned=false;
      for(let s=0;s<40;s++){const na2=pa+dir[0]*8,nb2=pb+dir[1]*8;
        if(!onWall(na2,nb2)){if(turned||!wall)break;turned=true;dir=[0,R()<.5?1:-1];continue;}
        pa=na2;pb=nb2;len++;out.push([pa,pb,dir.slice()]);
        if(!turned&&len>4+R()*14){turned=true;dir=[0,sb];}}
      if(out.length<3)continue;
      // merge the steps into straight runs, one box per run per cable
      let run=[out[0]];const flush=()=>{const a0=run[0],a1=run[run.length-1],d=a0[2],L2=run.length*8;
        for(let c=0;c<nC;c++){const off=(c-(nC-1)/2)*2.6,cc=CAB[(q+c)%CAB.length];
          if(d[0])box((a0[0]+a1[0])/2,a0[1]+off,1.6+c*.2,L2+2.6,1.8,1.8,cc,6);else box(a0[0]+off,(a0[1]+a1[1])/2,1.6+c*.2,1.8,L2+2.6,1.8,cc,6);}
        // a clip every so often
        box(a1[0],a1[1],1.4,d[0]?2:nC*2.6+3,d[0]?nC*2.6+3:2,3.4,DC.tray);};
      for(let s=1;s<out.length;s++){if(out[s][2][0]===run[0][2][0]&&out[s][2][1]===run[0][2][1])run.push(out[s]);else{flush();run=[out[s]];}}flush();
    }
    if(wall){
      // the ledges: front edge 3 blocks out — a conduit, junction boxes, amber warning lights; a lamp under the top ledge
      for(const [pb,top] of [[-hb-T/2,false],[hb+T/2,true]]){
        const fr=3*T,span=ha+2*T-4;
        box(0,pb+(top?-6:6),fr+2.5,2*span,4,4,DC.pipeG);
        for(let x=-span+18;x<span-10;x+=46+R()*20){box(x,pb,fr+3,12,14,6,R()<.5?DC.ebox:DARK);box(x,pb+3,fr+6.2,3,3,.8,DC.ledA,7);}
        box(-span+6,pb,fr+2,6,T-6,4,DC.stripe);box(span-6,pb,fr+2,6,T-6,4,DC.stripe);
        if(top){box(0,hb-2,T*1.2,2*ha-10,3,6,DC.lampC,5);box(0,hb-.6,T*1.2,2*ha,1.2,10,DARK);
          box(0,hb-3,T*2.6,2*ha+20,3,3,DC.cable,6);}
      }
    }else{
      // floor / ceiling panels: lamp strips along the inside of the curb
      for(const sa of [-1,1]){box(sa*(ha+T-2),0,T*.5,2.5,2*hb,4,PM,5);box(0,sa*(hb+T-2),T*.5,2*ha,2.5,4,PM,5);}
    }
  }
}
function rotateDeco(key){
  const r=ROT[key];if(typeof rotateDecals==='function')rotateDecals(key);
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
