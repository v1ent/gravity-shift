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
}
function rotateDeco(key){
  const r=ROT[key];
  for(const d of deco){const q=r.pt(d.c.x,d.c.y,d.c.z);d.c=V(q[0],q[1],q[2]);if(key[1]==='x'){const t=d.s[0];d.s[0]=d.s[1];d.s[1]=t;}else{const t=d.s[2];d.s[2]=d.s[1];d.s[1]=t;}}
}
function buildDecoMesh(){
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
