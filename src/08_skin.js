// =====================================================================
//  SKINNED CHARACTER MODEL — the procedural skeleton drives a rigged mesh
// =====================================================================
const SKN={ready:false,failed:false,on:true};
const ARM_STRETCH=1.2; // the model's arms are shorter than the game skeleton's reach

const SKVS=`
attribute vec3 aPos;attribute vec4 aNor;attribute vec4 aJ;attribute vec4 aW;
uniform mat4 uVP;uniform mat4 uWorldFix;uniform mat4 uB[20];uniform float uQ;
varying vec3 vNor;varying float vMat;varying float vD;varying vec3 vW;
void main(){
  vec4 p=vec4(aPos/uQ,1.0);
  mat4 m=uB[int(aJ.x)]*aW.x+uB[int(aJ.y)]*aW.y+uB[int(aJ.z)]*aW.z+uB[int(aJ.w)]*aW.w;
  vec4 w=uWorldFix*(m*p);vW=(m*p).xyz;
  vNor=normalize((uWorldFix*(m*vec4(aNor.xyz,0.0))).xyz);vMat=aNor.w;
  gl_Position=uVP*w;vD=gl_Position.w;
}`;
const SKFS=`
precision mediump float;
varying vec3 vNor;varying float vMat;varying float vD;varying vec3 vW;uniform vec4 uLP;uniform vec3 uLC;
uniform vec3 uBody;uniform vec3 uJoint;uniform vec3 uGlow;uniform vec3 uSun;uniform vec3 uFog;uniform float uFogD;uniform float uAlpha;
void main(){
  vec3 n=normalize(vNor);
  float body=step(0.5,vMat);
  vec3 base=mix(uJoint,uBody,body);
  float dif=max(dot(n,uSun),0.0),hemi=n.y*0.5+0.5;
  vec3 col=base*(0.34+0.30*hemi+0.62*dif);
  float rim=pow(1.0-abs(n.z*0.3+n.x*0.0),3.0)*0.0;
  col+=uGlow*(1.0-body)*0.55+uGlow*body*0.06;
  {float ld=length(vW-uLP.xyz),la=clamp(1.0-ld/uLP.w,0.0,1.0);col+=base*uLC*la*la*1.1;}
  float f=exp(-pow(vD*uFogD,2.0));
  gl_FragColor=vec4(mix(uFog,col,f),uAlpha);
}`;

// ---- "lines" style (like the blocky fighters): a dark body with the model's sharp edges glowing in the fighter's colour ----
// The mesh is unpacked so each triangle corner carries edge flags: component k reaches 0 on the edge opposite corner k,
// and stays 1 everywhere for edges that aren't sharp (so only creases, borders and material seams draw).
const SKVS_L=SKVS.replace('attribute vec4 aW;','attribute vec4 aW;attribute vec3 aB;varying vec3 vB;').replace('vMat=aNor.w;','vMat=aNor.w;vB=aB;');
function skfsLines(deriv){return (deriv?'#extension GL_OES_standard_derivatives : enable\n':'')+`
precision mediump float;
varying vec3 vNor;varying float vMat;varying float vD;varying vec3 vW;varying vec3 vB;uniform vec4 uLP;uniform vec3 uLC;
uniform vec3 uBody;uniform vec3 uJoint;uniform vec3 uGlow;uniform vec3 uSun;uniform vec3 uFog;uniform float uFogD;uniform float uAlpha;uniform vec3 uLine;
void main(){
  vec3 n=normalize(vNor);
  float dif=max(dot(n,uSun),0.0),hemi=n.y*0.5+0.5;
  vec3 fill=vec3(0.035,0.04,0.065)*(0.6+0.5*hemi+0.5*dif)+uLine*0.05;
  ${deriv?'vec3 w=fwidth(vB)*1.35;':'vec3 w=vec3(0.06);'}
  vec3 a=smoothstep(vec3(0.0),w,vB);float edge=1.0-min(min(a.x,a.y),a.z);
  vec3 col=mix(fill,uLine*1.25+vec3(0.12),edge);
  {float ld=length(vW-uLP.xyz),la=clamp(1.0-ld/uLP.w,0.0,1.0);col+=fill*uLC*la*la*1.5;}
  float f=exp(-pow(vD*uFogD,2.0));
  gl_FragColor=vec4(mix(uFog,col,f),uAlpha);
}`;}
function buildLineMesh(gl,u8,vOff,ni,idx,q){
  const nv=ni;const out=new Uint8Array(nv*24),pos=i=>{const o=vOff+i*20,d=new DataView(u8.buffer,u8.byteOffset);return [d.getInt16(o,true),d.getInt16(o+2,true),d.getInt16(o+4,true)];};
  const key=p=>p[0]+','+p[1]+','+p[2],nt=ni/3,N=[],edges=new Map(),mat=i=>u8[vOff+i*20+11];
  for(let t=0;t<nt;t++){const a=pos(idx[t*3]),b=pos(idx[t*3+1]),c=pos(idx[t*3+2]);
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;N.push(n.map(x=>x/l));
    const ks=[key(a),key(b),key(c)];
    for(let k=0;k<3;k++){const e=[ks[(k+1)%3],ks[(k+2)%3]].sort().join('|');if(!edges.has(e))edges.set(e,[]);edges.get(e).push(t);}}
  const sharp=(t,k)=>{const ks=[0,1,2].map(j=>key(pos(idx[t*3+j]))),e=[ks[(k+1)%3],ks[(k+2)%3]].sort().join('|'),l=edges.get(e);
    if(l.length!==2)return true;const o=l[0]===t?l[1]:l[0],a=N[t],b=N[o];
    if(mat(idx[t*3])!==mat(idx[o*3]))return true;
    return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]<Math.cos(28*Math.PI/180);};
  for(let t=0;t<nt;t++){const vis=[sharp(t,0),sharp(t,1),sharp(t,2)];
    for(let j=0;j<3;j++){const src=vOff+idx[t*3+j]*20,dst=(t*3+j)*24;out.set(u8.subarray(src,src+20),dst);
      for(let k=0;k<3;k++)out[dst+20+k]=(j===k||!vis[k])?255:0;}}
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,out,gl.STATIC_DRAW);return {b,n:nv};
}
async function loadModel(){
  try{
    if(typeof MODEL_B64==='undefined'||!R.ok||typeof DecompressionStream==='undefined'){SKN.failed=true;return;}
    const bin=Uint8Array.from(atob(MODEL_B64),c=>c.charCodeAt(0));
    const ds=new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate'));
    const buf=await new Response(ds).arrayBuffer();
    const dv=new DataView(buf),jl=dv.getUint32(0,true);
    const meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,jl)));
    const vOff=4+jl,vLen=meta.nv*20,iOff=vOff+vLen;
    const gl=R.gl;
    const p=gl.createProgram();
    for(const [t,src] of [[gl.VERTEX_SHADER,SKVS],[gl.FRAGMENT_SHADER,SKFS]]){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    const loc={};for(const a of ['aPos','aNor','aJ','aW'])loc[a]=gl.getAttribLocation(p,a);
    for(const u of ['uVP','uWorldFix','uB','uQ','uBody','uJoint','uGlow','uSun','uFog','uFogD','uAlpha','uLP','uLC'])loc[u]=gl.getUniformLocation(p,u);
    SKN.vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,SKN.vb);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(buf,vOff,vLen),gl.STATIC_DRAW);
    SKN.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,SKN.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(buf.slice(iOff,iOff+meta.ni*2)),gl.STATIC_DRAW);
    SKN.p=p;SKN.loc=loc;SKN.meta=meta;SKN.ni=meta.ni;
    try{ // the "lines" variant: its own program and an unpacked copy of the mesh
      const deriv=!!gl.getExtension('OES_standard_derivatives'),lp=gl.createProgram();
      for(const [t,src] of [[gl.VERTEX_SHADER,SKVS_L],[gl.FRAGMENT_SHADER,skfsLines(deriv)]]){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(lp,s);}
      gl.linkProgram(lp);if(!gl.getProgramParameter(lp,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(lp));
      const ll={};for(const a of ['aPos','aNor','aJ','aW','aB'])ll[a]=gl.getAttribLocation(lp,a);
      for(const u of ['uVP','uWorldFix','uB','uQ','uBody','uJoint','uGlow','uSun','uFog','uFogD','uAlpha','uLP','uLC','uLine'])ll[u]=gl.getUniformLocation(lp,u);
      const u8=new Uint8Array(buf),idx=new Uint16Array(buf.slice(iOff,iOff+meta.ni*2));
      SKN.lm=buildLineMesh(gl,u8,vOff,meta.ni,idx,meta.q);SKN.lp=lp;SKN.ll=ll;
    }catch(err){console.warn('line style unavailable:',err);}
    // rest skeleton
    SKN.bones=meta.bones.map(b=>({name:b.name,head:V(b.head[0],b.head[1],b.head[2]),parent:b.parent}));
    SKN.bi={};SKN.bones.forEach((b,i)=>SKN.bi[b.name]=i);
    SKN.toe={L:V(...meta.toeL),R:V(...meta.toeR)};
    SKN.mats=new Float32Array(20*16);
    SKN.ready=true;
  }catch(err){SKN.failed=true;console.warn('character model not loaded:',err);}
}

// ---------- small 3x3 rotation helpers (matrices as 3 column vectors) ----------
function frame3(d,r){const x=vnorm(d);let y=vsub(r,vscale(x,vdot(r,x)));if(vlen(y)<1e-4)y=Math.abs(x.y)<.9?V(0,1,0):V(1,0,0),y=vsub(y,vscale(x,vdot(y,x)));y=vnorm(y);return [x,y,vcross(x,y)];}
// rotation taking rest frame F0 onto frame F1
function rotBetween(F1,F0){const c=[];for(const k of ['x','y','z'])c.push(vadd(vadd(vscale(F1[0],F0[0][k]),vscale(F1[1],F0[1][k])),vscale(F1[2],F0[2][k])));return c;}
const rapply=(R3,v)=>vadd(vadd(vscale(R3[0],v.x),vscale(R3[1],v.y)),vscale(R3[2],v.z));
function lerpFrame(Fa,Fb,t){return frame3(vadd(vscale(Fa[0],1-t),vscale(Fb[0],t)),vadd(vscale(Fa[1],1-t),vscale(Fb[1],t)));}
const REST_UP=[V(0,1,0),V(0,0,1)]; // (up, forward) of the rest pose
// two-bone IK: from root s towards target t, lengths a,b, bending towards pole
function ik3(s,t,a,b,pole,fallback){
  let d=vsub(t,s),L=vlen(d);const Lc=clamp(L,Math.abs(a-b)+.01,a+b-.01);
  const u=L>1e-4?vscale(d,1/L):V(0,-1,0);
  let n=vsub(vsub(pole,s),vscale(u,vdot(vsub(pole,s),u)));if(vlen(n)<1e-3)n=vsub(fallback,vscale(u,vdot(fallback,u)));n=vnorm(n);
  const x=(a*a-b*b+Lc*Lc)/(2*Lc),h=Math.sqrt(Math.max(0,a*a-x*x));
  const mid=vadd(s,vadd(vscale(u,x),vscale(n,h)));
  return {mid,end:vadd(s,vscale(u,Lc)),n};
}

// world joint targets from a live fighter's pose
function jointsFromChar(e){
  const P=e.pose,B=(p,lat)=>localToWorld(e,p.x,p.y,'body',lat),Lg=(p,lat)=>localToWorld(e,p.x,p.y,'leg',lat);
  const by=e.bodyYaw,ly=e.legYaw;
  const rightB=V(-Math.cos(by),0,Math.sin(by)),rightL=V(-Math.cos(ly),0,Math.sin(ly));
  const o=localToWorld(e,0,0,'leg',0),upL=vnorm(vsub(localToWorld(e,0,-10,'leg',0),o));
  const hip=B(P.hip,0),neck=B(P.neck,0),upB=vnorm(vsub(neck,hip));
  // during a kick the torso leans back: the head keeps looking where you aim instead of tipping back with it
  const ht=e.state==='kick'?clamp(e.pitch||0,-.8,.8)*.6:(P.headA||0),hf=V(Math.sin(by)*Math.cos(ht),Math.sin(ht),Math.cos(by)*Math.cos(ht));
  const J={hip,neck,upB,fwdB:vcross(upB,rightB),upL,fwdL:vcross(upL,rightL),headUp:vcross(rightB,hf),headFwd:hf,
    kR:Lg(P.kA,5.25),fR:Lg(P.fA,5),toeR:localToWorld(e,P.fA.x+6,P.fA.y-.5,'leg',5),
    kL:Lg(P.kB,-5.25),fL:Lg(P.fB,-5),toeL:localToWorld(e,P.fB.x+6,P.fB.y-.5,'leg',-5),
    eR:B(P.eN,8.4),hR:B(P.hN,3),eL:B(P.eF,-8.4),hL:B(P.hF,-2)};
  return J;
}
// world joint targets from a ragdoll
function jointsFromDoll(d){
  const p=k=>{const q=d.pts[d.idx[k]];return V(q.x,q.y,q.z);};
  const hip=p('hip'),neck=p('neck'),head=p('head'),upB=vnorm(vsub(neck,hip));
  let right=vsub(vadd(p('kA'),p('eN')),vadd(p('kB'),p('eF')));right=vsub(right,vscale(upB,vdot(right,upB)));
  if(vlen(right)<1e-3)right=V(1,0,0);right=vnorm(right);const fwd=vcross(upB,right);
  const hu=vnorm(vsub(head,neck));
  const fR=p('fA'),fL=p('fB');
  return {hip,neck,upB,fwdB:fwd,upL:upB,fwdL:fwd,headUp:hu,headFwd:vcross(hu,right),
    kR:p('kA'),fR,toeR:vadd(fR,vscale(fwd,6)),kL:p('kB'),fL,toeL:vadd(fL,vscale(fwd,6)),
    eR:p('eN'),hR:p('hN'),eL:p('eF'),hL:p('hF'),doll:true};
}

// a pose: world rotation (relative to the rest pose) of each of the 20 bones, hips position, arm stretch
const mkPose=()=>({q:Array.from({length:20},()=>[0,0,0,1]),K:new Array(20).fill(1),hip:V(0,0,0)});
function blendPose(a,b,t){const o=mkPose();for(let i=0;i<20;i++){o.q[i]=qlerp(a.q[i],b.q[i],t);o.K[i]=lerp(a.K[i],b.K[i],t);}o.hip=vadd(vscale(a.hip,1-t),vscale(b.hip,t));return o;}

// ---------- procedural: game skeleton -> pose (IK for arms and legs) ----------
function procPose(J){
  const B=SKN.bones,bi=SKN.bi,rest=i=>B[i].head;
  const Rw=new Array(20),H=new Array(20),K=new Array(20).fill(1);
  const restVec=c=>vsub(rest(c),rest(B[c].parent));
  const fk=i=>vadd(H[B[i].parent],rapply(Rw[B[i].parent],vsub(rest(i),rest(B[i].parent))));
  const Fh=frame3(J.upL,J.fwdL),F0=frame3(REST_UP[0],REST_UP[1]),Fc=frame3(J.upB,J.fwdB);
  Rw[0]=rotBetween(Fh,F0);H[0]=vadd(J.hip,vscale(J.upL,J.doll?0:4.6*CHAR_SCALE));
  ['Spine','Spine1','Spine2','Neck'].forEach((nm,k)=>{const i=bi[nm];H[i]=fk(i);Rw[i]=rotBetween(lerpFrame(Fh,Fc,Math.min(1,(k+1)/3)),F0);});
  {const i=bi.Head;H[i]=fk(i);Rw[i]=rotBetween(frame3(J.headUp,J.headFwd),F0);}
  for(const s of ['Left','Right']){
    const sh=bi[s+'Shoulder'],ar=bi[s+'Arm'],fo=bi[s+'ForeArm'],ha=bi[s+'Hand'];
    H[sh]=fk(sh);Rw[sh]=Rw[bi.Spine2];H[ar]=fk(ar);
    const a=vlen(restVec(fo))*ARM_STRETCH,b=vlen(restVec(ha))*ARM_STRETCH;
    const r=ik3(H[ar],s==='Right'?J.hR:J.hL,a,b,s==='Right'?J.eR:J.eL,vscale(J.fwdB,-1)),ref0=V(0,0,-1);
    Rw[ar]=rotBetween(frame3(vsub(r.mid,H[ar]),r.n),frame3(restVec(fo),ref0));K[ar]=ARM_STRETCH;
    Rw[fo]=rotBetween(frame3(vsub(r.end,r.mid),r.n),frame3(restVec(ha),ref0));K[fo]=ARM_STRETCH;Rw[ha]=Rw[fo];
  }
  for(const s of ['Left','Right']){
    const ul=bi[s+'UpLeg'],lg=bi[s+'Leg'],ft=bi[s+'Foot'];H[ul]=fk(ul);
    const a=vlen(restVec(lg)),b=vlen(restVec(ft)),foot=s==='Right'?J.fR:J.fL,toe=s==='Right'?J.toeR:J.toeL;
    const ankle=vadd(foot,vscale(J.upL,J.doll?0:rest(ft).y));
    const r=ik3(H[ul],ankle,a,b,s==='Right'?J.kR:J.kL,J.fwdL),ref0=V(0,0,1);
    Rw[ul]=rotBetween(frame3(vsub(r.mid,H[ul]),r.n),frame3(restVec(lg),ref0));
    Rw[lg]=rotBetween(frame3(vsub(r.end,r.mid),r.n),frame3(restVec(ft),ref0));
    Rw[ft]=rotBetween(frame3(vsub(toe,ankle),J.upL),frame3(vsub(SKN.toe[s==='Right'?'R':'L'],rest(ft)),V(0,1,0)));
  }
  const P=mkPose();for(let i=0;i<20;i++)P.q[i]=qFromR(Rw[i]);P.K=K;P.hip=H[0];return P;
}

// ---------- animation clips ----------
const MIRROR=[0,1,2,3,4,5,10,11,12,13,6,7,8,9,17,18,19,14,15,16]; // left <-> right
async function loadAnims(){
  if(typeof ANIM_B64==='undefined')return;
  const bin=Uint8Array.from(atob(ANIM_B64),c=>c.charCodeAt(0));
  const buf=await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  const jl=new DataView(buf).getUint32(0,true),meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,jl))),base=4+jl;
  SKN.clips={};
  for(const c of meta.clips){
    const q=new Int16Array(buf.slice(base+c.off,base+c.off+c.n*160)),h=new Int16Array(buf.slice(base+c.off+c.n*160,base+c.off+c.n*166));
    SKN.clips[c.name]={n:c.n,loop:c.loop,speed:c.speed,dur:(c.n-1)/meta.fps,fps:meta.fps,q,h};
  }
}
// clip pose in character space (facing +Z), t in seconds
function sampleClip(name,t,mirror){
  const c=SKN.clips[name],P=mkPose();
  let f=t*c.fps;f=c.loop?((f%(c.n-1))+(c.n-1))%(c.n-1):clamp(f,0,c.n-1);
  const i0=Math.floor(f),i1=Math.min(c.n-1,i0+1),u=f-i0;
  for(let b=0;b<20;b++){
    const src=mirror?MIRROR[b]:b,o0=(i0*20+src)*4,o1=(i1*20+src)*4;
    let qa=[c.q[o0],c.q[o0+1],c.q[o0+2],c.q[o0+3]],qb=[c.q[o1],c.q[o1+1],c.q[o1+2],c.q[o1+3]];
    let q=qlerp(qn(qa),qn(qb),u);if(mirror)q=[q[0],-q[1],-q[2],q[3]];P.q[b]=q;
  }
  const h=i=>V(c.h[i*3]/64,c.h[i*3+1]/64,c.h[i*3+2]/64);P.hip=vadd(vscale(h(i0),1-u),vscale(h(i1),u));if(mirror)P.hip.x=-P.hip.x;
  return P;
}
// weighted blend of several poses
function mixPoses(list){
  const tot=list.reduce((a,x)=>a+x[1],0)||1,P=mkPose();P.hip=V(0,0,0);
  for(let b=0;b<20;b++){let acc=[0,0,0,0];const ref=list[0][0].q[b];
    for(const [p,w] of list){const q=p.q[b],sg=(q[0]*ref[0]+q[1]*ref[1]+q[2]*ref[2]+q[3]*ref[3])<0?-1:1;for(let k=0;k<4;k++)acc[k]+=q[k]*w*sg;}
    P.q[b]=qn(acc);}
  for(const [p,w] of list)P.hip=vadd(P.hip,vscale(p.hip,w/tot));
  return P;
}
function fkHeads(P){
  const B=SKN.bones,H=new Array(20);H[0]=P.hip;
  for(let i=1;i<20;i++){const pa=B[i].parent;let off=vsub(B[i].head,B[pa].head);
    if(P.K[pa]!==1){const d=vnorm(off);off=vscale(off,P.K[pa]);}
    H[i]=vadd(H[pa],qrot(P.q[pa],off));}
  return H;
}
function writeMatrices(P){
  const B=SKN.bones,M=SKN.mats,H=fkHeads(P);
  for(let i=0;i<20;i++){
    const q=P.q[i],k=P.K[i],o=i*16;let d0=null;
    if(k!==1){const ch=B.findIndex(b=>b.parent===i);d0=vnorm(vsub(B[ch].head,B[i].head));}
    const col=j=>{let v=j===0?V(1,0,0):j===1?V(0,1,0):V(0,0,1);if(d0)v=vadd(v,vscale(d0,(k-1)*d0[['x','y','z'][j]]));return qrot(q,v);};
    const c0=col(0),c1=col(1),c2=col(2),r0=B[i].head;
    const t=vsub(H[i],vadd(vadd(vscale(c0,r0.x),vscale(c1,r0.y)),vscale(c2,r0.z)));
    M[o]=c0.x;M[o+1]=c0.y;M[o+2]=c0.z;M[o+3]=0;M[o+4]=c1.x;M[o+5]=c1.y;M[o+6]=c1.z;M[o+7]=0;
    M[o+8]=c2.x;M[o+9]=c2.y;M[o+10]=c2.z;M[o+11]=0;M[o+12]=t.x;M[o+13]=t.y;M[o+14]=t.z;M[o+15]=1;
  }
  return H;
}
// =====================================================================
//  CLIP-DRIVEN ANIMATION: every state picks a Mixamo clip (or a piece of one);
//  states no clip covers (kick, dive, vault, tumble) keep the procedural skeleton
// =====================================================================
const FPS_C=30;
const qconj=q=>[-q[0],-q[1],-q[2],q[3]];
const charOrigin=e=>V(e.x+(e.visX||0),e.y+(e.visY||0),e.z+(e.visZ||0));
// clip pose at frame f, character space; root: 'feet' (feet under the origin), 'center' (body centred), 'clip' (travel kept), 'none'
function clipAt(name,f,mirror,root){
  const P=sampleClip(name,f/FPS_C,mirror);
  if(root==='feet'||root==='center'){const H=fkHeads(P),bi=SKN.bi,lf=H[bi.LeftFoot],rf=H[bi.RightFoot];
    let cx=(lf.x+rf.x)/2,cz=(lf.z+rf.z)/2;if(root==='center'){cx=(cx+P.hip.x)/2;cz=(cz+P.hip.z)/2;}P.hip.x-=cx;P.hip.z-=cz;}
  else if(root==='none'){P.hip.x=0;P.hip.z=0;}
  return P;
}
function placeAt(P,yaw,o){const qy=qaxis(V(0,1,0),yaw);for(let b=0;b<20;b++)P.q[b]=qmul(qy,P.q[b]);P.hip=vadd(o,qrot(qy,P.hip));return P;}
const UPPER_SHARE={Spine:.3,Spine1:.6,Spine2:1,Neck:1,Head:1,LeftShoulder:1,RightShoulder:1,LeftArm:1,RightArm:1,LeftForeArm:1,RightForeArm:1,LeftHand:1,RightHand:1};
function twistUpper(P,tw){if(Math.abs(tw)<1e-3)return;const bi=SKN.bi;for(const nm in UPPER_SHARE)P.q[bi[nm]]=qmul(qaxis(V(0,1,0),tw*UPPER_SHARE[nm]),P.q[bi[nm]]);}
// bend the upper body forward (clip space, before placing: +x is the character's left, so +ang tips the chest forward)
function bendUpper(P,ang){if(Math.abs(ang)<1e-3)return;const bi=SKN.bi;for(const nm in UPPER_SHARE)P.q[bi[nm]]=qmul(qaxis(V(1,0,0),ang*UPPER_SHARE[nm]),P.q[bi[nm]]);}
// rotate a whole pose about a world pivot
function rotatePose(P,q,piv){for(let b=0;b<20;b++)P.q[b]=qmul(q,P.q[b]);P.hip=vadd(piv,qrot(q,vsub(P.hip,piv)));}
// copy some bones from another pose, carried along by a reference bone (e.g. arms relative to the chest)
function layerBones(P,src,names,ref,w){
  if(w<=.01)return;const bi=SKN.bi,r=ref?qmul(P.q[bi[ref]],qconj(src.q[bi[ref]])):[0,0,0,1];
  for(const nm of names){const i=bi[nm];P.q[i]=qlerp(P.q[i],qmul(r,src.q[i]),w);}
}
const LEGS=['LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
const ARM_L=['LeftShoulder','LeftArm','LeftForeArm','LeftHand'];

// ---------- locomotion ----------
const LOCO={F:['walking_forward','running'],B:['walking_backward','running_backward']};
function locoPose(e,A,dt){
  const sp=Math.hypot(e.vx,e.vz),by=e.bodyYaw;
  const wMove=clamp((sp-8)/40,0,1);
  if(sp>12){
    const mv=Math.atan2(e.vx,e.vz),rel=Math.abs(angDiff(mv,by));
    if(!A.back&&rel>2.05)A.back=true;else if(A.back&&rel<1.75)A.back=false;
    A.legYaw+=clamp(angDiff(A.back?mv+Math.PI:mv,A.legYaw),-dt*11,dt*11);
  }
  const idle=sampleClip('idle',A.idle,false);
  if(wMove<=.01){A.ph=0;return idle;}
  const [wn,rn]=LOCO[A.back?'B':'F'],cw=SKN.clips[wn],cr=SKN.clips[rn];
  const k=clamp((sp-cw.speed)/(cr.speed-cw.speed),0,1),nat=lerp(cw.speed,cr.speed,k),dur=lerp(cw.dur,cr.dur,k);
  A.ph=(A.ph+(Math.max(sp,10)/nat)/dur*dt)%1;
  const mv=blendPose(sampleClip(wn,A.ph*cw.dur,false),sampleClip(rn,A.ph*cr.dur,false),k);
  return wMove>=.99?mv:blendPose(idle,mv,wMove);
}
// a wall straight ahead at body height (for bracing against it)
function wallAhead(e,yaw,dist){const fx=Math.sin(yaw),fz=Math.cos(yaw);
  for(const h of [30,50])if(solid(tileAt(e.x+fx*(e.w/2+dist),e.y+h,e.z+fz*(e.w/2+dist))))return true;return false;}

// ---------- one-shot actions layered over locomotion on the ground ----------
// name, first/last frame, playback rate, root mode, how strongly it replaces the legs
const ACTS={
  stop:{clip:'run_to_stop',f0:9,f1:46,rate:1.25,root:'feet'},          // braking into a wall, hands out
  turnR:{clip:'right_turn_90',f0:0,f1:28,rate:1.6,root:'feet'},        // stepping round on the spot
  turn180:{clip:'running_turn_180',f0:0,f1:20,rate:1.5,root:'none'},
  hop:{clip:'jump',f0:41,f1:56,rate:1.3,root:'feet'},                  // small landing
  slideUp:{clip:'running_slide',f0:27,f1:44,rate:1.5,root:'feet'},     // getting up out of a slide
};
function startAct(A,kind,o){A.act=Object.assign({kind,t:0,w:0,out:false},o||{});}
function actPose(e,A,dt){
  const a=A.act,D=ACTS[a.kind],c=SKN.clips[D.clip];
  a.t+=dt*D.rate;const f=D.f0+a.t*FPS_C;
  if(f>=D.f1)a.out=true;
  a.w=a.out?a.w-dt/.16:Math.min(1,a.w+dt/.1);
  if(a.w<=0){A.act=null;if(a.onEnd)a.onEnd();return null;}
  return clipAt(D.clip,Math.min(f,D.f1),a.mirror,D.root);
}

// ---------- the aim: hands on the gun along the 3D aim line, chest bends for steep angles ----------
function overlayAim(P,e,wGun,wRocket){
  const bi=SKN.bi,B=SKN.bones,a=clamp(e.pitch||0,-1.35,1.35),yaw=e.yaw;
  const rt=V(-Math.cos(yaw),0,Math.sin(yaw)),aim=fwdOf(yaw,a),wA=Math.max(wGun,wRocket);
  // head always follows the view a little; the waist takes what the arms can't
  const bend=(a-clamp(a,-.4,.5))*wA,head=a*lerp(.55,1,wA);
  const rot=(nm,an)=>{const i=bi[nm];P.q[i]=qmul(qaxis(rt,an),P.q[i]);};
  rot('Spine',bend*.3);rot('Spine1',bend*.65);
  for(const nm of ['Spine2','LeftShoulder','RightShoulder','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand'])rot(nm,bend);
  rot('Neck',bend+(head-bend)*.45);rot('Head',bend+(head-bend)*.9);
  e._aimDir=aim;
  if(wA<.01)return P;
  const H=fkHeads(P),shR=H[bi.RightArm],shL=H[bi.LeftArm],mid=vscale(vadd(shR,shL),.5),up=V(0,1,0);
  const len=i=>vlen(vsub(B[i+1].head,B[i].head))*ARM_STRETCH;
  const lr=len(bi.RightArm)+len(bi.RightForeArm),ll=len(bi.LeftArm)+len(bi.LeftForeArm);
  const sg=twoHanded(e),rf=e.weapon==='rifle';
  // gun hand
  const g=sg?vadd(vadd(shR,vscale(aim,lr*.5)),vadd(vscale(rt,-2.5),V(0,-1.5,0))):vadd(vadd(mid,vscale(aim,lr*.8)),vadd(vscale(rt,1.5),V(0,-3,0)));
  let tL=sg?vadd(g,vadd(vscale(aim,rf?9.3:11*CHAR_SCALE),vadd(vscale(rt,-1.5),V(0,-1.5,0)))):vadd(g,vadd(vscale(aim,.8),vadd(vscale(rt,-2.6),V(0,-1.6,0))));
  if(wRocket>0)tL=vadd(vscale(tL,1-wRocket),vscale(vadd(shL,vscale(aim,ll*.97)),wRocket));
  const solveArm=(s,tgt,w,pole)=>{
    if(w<.01)return;const ar=bi[s+'Arm'],fo=bi[s+'ForeArm'],ha=bi[s+'Hand'];
    const rv=c=>vsub(B[c].head,B[B[c].parent].head);
    const r=ik3(H[ar],tgt,vlen(rv(fo))*ARM_STRETCH,vlen(rv(ha))*ARM_STRETCH,pole,vscale(up,-1)),ref0=V(0,0,-1);
    const qa=qFromR(rotBetween(frame3(vsub(r.mid,H[ar]),r.n),frame3(rv(fo),ref0))),qf=qFromR(rotBetween(frame3(vsub(r.end,r.mid),r.n),frame3(rv(ha),ref0)));
    P.q[ar]=qlerp(P.q[ar],qa,w);P.q[fo]=qlerp(P.q[fo],qf,w);P.q[ha]=qlerp(P.q[ha],qf,w);
    P.K[ar]=lerp(P.K[ar],ARM_STRETCH,w);P.K[fo]=P.K[ar];
  };
  solveArm('Right',g,wGun,vadd(shR,vadd(vscale(rt,9),V(0,-12,0))));
  solveArm('Left',tL,Math.max(wGun*.95,wRocket),vadd(shL,vadd(vscale(rt,wRocket>.5?-4:-9),V(0,-12,0))));
  return P;
}

// ---------- which clip for which state ----------
// hang / pull-up: pull_up_wall is anchored to the ledge; hands at the edge, feet on the wall (or dangling when there is none)
const LEDGE_C={y:83,z:4};
function ledgeFrame(e,d,ly,base){
  const yaw=Math.atan2(d[0],d[1]),fp=V(base.x+d[0]*(e.w/2+.5),ly,base.z+d[1]*(e.w/2+.5));
  return {yaw,o:vsub(fp,qrot(qaxis(V(0,1,0),yaw),V(0,LEDGE_C.y,LEDGE_C.z)))};
}
const wallBelow=(lg)=>lg&&lg.ci!==undefined&&solid(tile(lg.ci,lg.r-1,lg.ck));
const PULL_KEYS=[[0,25],[.22,72],[.42,100],[.5,140],[.78,198],[1,218]];
function warp(keys,u){for(let i=1;i<keys.length;i++)if(u<=keys[i][0]){const [a,fa]=keys[i-1],[b,fb]=keys[i];return lerp(fa,fb,(u-a)/(b-a));}return keys[keys.length-1][1];}
function clipFor(e,A,dt){
  const st=e.state,o=charOrigin(e);
  if(st==='hang'){
    const hs=e.st,lg=hs.lg;if(!lg||lg.ly===undefined)return null;
    const L=ledgeFrame(e,hs.d,lg.ly,V(e.x,e.y,e.z));
    A.hangT=(A.hangT||0)+dt;const f=12+12*Math.sin(A.hangT*1.6);
    const P=clipAt('pull_up_wall',f,false,'clip');
    if(!wallBelow(lg)){const idl=sampleClip('idle',0,false);layerBones(P,idl,LEGS,null,.9);}
    placeAt(P,L.yaw,L.o);
    const piv=vadd(L.o,qrot(qaxis(V(0,1,0),L.yaw),V(0,80,2))),ax=vcross(V(0,-1,0),V(hs.d[0],0,hs.d[1]));
    rotatePose(P,qaxis(ax,hs.ph||0),piv);
    return {P,key:'hang'};
  }
  if(st==='climbup'&&!e.st.vault){
    const s=e.st,u=clamp(s.t,0,1),f=warp(PULL_KEYS,u);
    const lg=s.lg||{ci:undefined};const L=ledgeFrame(e,s.d,s.ly,s.s0);
    const P=clipAt('pull_up_wall',f,false,'clip');
    if(s.noWall){const idl=sampleClip('idle',0,false);layerBones(P,idl,LEGS,null,.9*(1-smooth(clamp((f-110)/60,0,1))));}
    placeAt(P,L.yaw,L.o);
    // ease into the game's standing spot at the end
    if(!s.endHip){const E=placeAt(clipAt('pull_up_wall',218,false,'clip'),L.yaw,L.o);s.endHip=E.hip;}
    const k=smooth(clamp((u-.55)/.45,0,1));P.hip=vadd(P.hip,V((s.s1.x-s.endHip.x)*k,0,(s.s1.z-s.endHip.z)*k));
    return {P,key:'climb'};
  }
  if(st==='dodge'){
    const s=e.st,D=DODGES[s.kind],f=dodgeFrame(D,Math.min(s.t,D.dur)*30*D.rate).f;
    const P=clipAt(D.clip,f,D.mirror,'none');
    // dodge_right ends turned 93° to the side: turn it back so it finishes facing forward
    if(D.fix)rotatePose(P,qaxis(V(0,1,0),D.fix*smooth(clamp((f-D.fix0)/(D.fix1-D.fix0),0,1))),V(P.hip.x,0,P.hip.z));
    return {P:placeAt(P,s.yaw,o),key:'dodge'};
  }
  if(st==='climbup'&&e.st.vault&&e.st.over&&(SKN.clips[e.st.vclip]||SKN.clips.vault)){
    // dive vault: hands on the obstacle, body over flat, landing; the clip's travel stretched to the real distance
    const s=e.st,vn=SKN.clips[s.vclip]?s.vclip:'vault',VC=VAULT_CLIPS[vn],u=clamp(s.t,0,1),f=lerp(VC.f0,VC.f1,u),yaw=Math.atan2(s.d[0],s.d[1]);
    if(!s.vz){const h=fr=>sampleClip(vn,fr/30,false).hip;s.vz=[h(VC.f0).z,h(VC.f1).z];}
    const P=clipAt(vn,f,false,'clip'),dist=Math.hypot(s.s1.x-s.s0.x,s.s1.z-s.s0.z),k=dist/Math.max(1,s.vz[1]-s.vz[0]);
    P.hip.z=(P.hip.z-s.vz[0])*k;P.hip.x*=.5;
    return {P:placeAt(P,yaw,V(s.s0.x,Math.min(s.s0.y,s.s1.y),s.s0.z)),key:'vault'};
  }
  if(st==='land'){
    const s=e.st,u=clamp(s.t/s.dur,0,1);let P;
    if(s.dur>=.6)P=clipAt('landing',lerp(18,70,u<.5?u*1.2:.6+(u-.5)*.8),false,'feet');
    else P=clipAt('jump',lerp(40,56,u),false,'feet');
    return {P:placeAt(P,e.bodyYaw,o),key:'land'};
  }
  if(st==='slide'){
    const t=e.st.t,f=t<.13?3+t/.13*8:11+4.5+4.5*Math.sin((t-.13)*5-Math.PI/2);
    return {P:placeAt(clipAt('running_slide',f,false,'center'),e.st.yaw,o),key:'slide',aim:true};
  }
  if(false&&st==='down'){ // knockdowns stay procedural: the clip starts mid-stumble and pops after a tumble
    const t=e.st.t,f=Math.min(45,20+t*42);
    return {P:placeAt(clipAt('fall_flat',f,false,'center'),e.bodyYaw,o),key:'down'};
  }
  if(st!=='normal'||Math.abs(e.ba||0)>.05||e.runJump||e.knocked)return null;
  if(!e.grounded&&!e.wasBox){
    A.air=(A.air||0)+dt;
    let P;
    if(e.vy<-430&&e.airT>.3){P=clipAt('landing',4+3.5*Math.sin(world.time*4),false,'none');P.hip.y-=52;}
    else{const jumped=world.time-(e.jumpAt||-9)<e.airT+.08;
      const f=e.vy>0?lerp(jumped?23:32,30,clamp(1-e.vy/JUMPV,0,1)):lerp(30,37,clamp(-e.vy/450,0,1));
      P=clipAt('jump',f,false,'none');P.hip.y-=7;}
    {const d=angDiff(e.bodyYaw,A.legYaw);if(Math.abs(d)>1.2)A.legYaw+=d-Math.sign(d)*1.2;}
    const yaw=A.legYaw;A.legYaw+=clamp(angDiff(e.bodyYaw,A.legYaw),-dt*6,dt*6);
    P=placeAt(P,yaw,o);twistUpper(P,angDiff(e.bodyYaw,yaw));
    return {P,key:'air',aim:true};
  }
  if(e.cover&&e.grounded&&SKN.clips.crouch_to_cover){
    // in cover: crouch_to_cover holds the hidden squat (its end), rises to peek over (frames 6->24, held to 42) while you aim,
    // and ducks back (42->60). Shuffling along the cover uses cover_sneaking_right, turned to face the cover, mirrored for left.
    const d=e.cover.d,yaw=Math.atan2(d[0],d[1]),up=!e.crouch;
    let f=A.covF===undefined?80:A.covF;const r=30*1.6*dt;
    if(up){if(f>=60||f<6)f=6;else if(f<42)f=Math.min(36,f+r);else f=Math.min(60,f+r);}      // rise and hold the peek
    else{if(f>=24&&f<60)f=Math.max(f,42)+r;else if(f<24&&f>=6)f=Math.max(6,f-r);else if(f>=60)f=Math.min(90,f+r*.3);if(f>=90)f=66;} // duck, then breathe
    A.covF=f;
    const lat=V(Math.cos(yaw),0,-Math.sin(yaw)),vs=e.vx*lat.x+e.vz*lat.z; // + = to the right while facing the cover
    A.sneakW=lerp(A.sneakW||0,!up&&Math.abs(vs)>12?1:0,1-Math.exp(-10*dt));
    let P=clipAt('crouch_to_cover',f,false,'feet');
    if(A.sneakW>.01){
      const n=SKN.clips.cover_sneaking_right.n;A.sneakF=((A.sneakF||0)+Math.abs(vs)*dt/42*(n-1))%(n-1);
      const S=clipAt('cover_sneaking_right',A.sneakF,vs<0,'feet');                 // (the clip faces backwards: turned below)
      const q=qaxis(V(0,1,0),Math.PI);for(let b=0;b<20;b++)S.q[b]=qmul(q,S.q[b]);S.hip=qrot(q,S.hip);
      // keep low: only part of the sneak's height, chest bent over the cover's top
      P=blendPose(P,S,smooth(A.sneakW)*.55);bendUpper(P,.5*smooth(A.sneakW));
    }
    A.legYaw=yaw;A.act=null;A.air=0;
    P=placeAt(P,yaw,o);twistUpper(P,angDiff(e.bodyYaw,yaw)*(up?1:.3));
    return {P,key:'cover',aim:true};
  }
  if(e.h<STAND_H-1)return null; // crouched: procedural
  if(e.emote){ // waving hands / bowing to a new ally
    const m=e.emote,P=m.kind==='wave'?clipAt('waving_hands',(m.t*30)%95,false,'feet'):clipAt('bow',Math.min(82,m.t/BOW_T*82),false,'feet');
    A.legYaw=e.bodyYaw;A.act=null;A.air=0;return {P:placeAt(P,e.bodyYaw,o),key:'emote'};
  }
  // landed after being in the air: a short knee bend
  if(A.air>.25&&!A.act)startAct(A,'hop',{mirror:false});
  A.air=0;
  const sp=Math.hypot(e.vx,e.vz),mv=Math.atan2(e.vx,e.vz);
  // sprinting into a wall: brake and catch it with the hands
  if((!A.act||A.act.kind==='hop')&&sp>150&&wallAhead(e,mv,38)&&!wallAhead(e,mv,-6)){startAct(A,'stop',{yaw:mv});A.stopDir=mv;}
  if(A.act&&A.act.kind==='stop'&&!A.act.out){const away=sp>60&&Math.abs(angDiff(mv,A.stopDir))>.9;if(away||!wallAhead(e,A.stopDir,40))A.act.out=true;}
  // a sharp reversal at running speed
  if(sp>150){if(A.runDir!==undefined&&Math.abs(angDiff(mv,A.runDir))>2.5&&world.time-A.runT<.7&&!A.act){startAct(A,'turn180',{yaw:A.runDir,onEnd:null});A.legYaw=mv;}A.runDir=mv;A.runT=world.time;}
  // standing and the aim swung far round: step round with the feet
  if(sp<12&&!A.act){const d=angDiff(e.bodyYaw,A.legYaw);if(Math.abs(d)>1.05){const y0=A.legYaw,s=d<0?-1:1;startAct(A,'turnR',{mirror:s>0,yaw:y0,turn:s});}}
  // never twist the waist further than a person can: past the limit the feet are dragged round
  {const lim=sp<12?1.2:2.1,tr=A.act&&A.act.kind==='turnR'&&A.turnYaw!==undefined,cur=tr?A.turnYaw:A.legYaw,d=angDiff(e.bodyYaw,cur);
   if(Math.abs(d)>lim){const c=d-Math.sign(d)*lim;A.legYaw+=c;if(tr){A.act.yaw+=c;A.turnYaw+=c;}}}
  let P=locoPose(e,A,dt),yaw=A.legYaw,key='loco';
  if(A.act){
    const a=A.act,ap=actPose(e,A,dt);
    if(ap){
      const ay=a.yaw!==undefined?a.yaw:A.legYaw;
      if(a.kind==='turnR'){const prog=smooth(clamp(a.t*FPS_C/28,0,1));ay;A.turnYaw=a.yaw+a.turn*Math.PI/2*prog;
        if(a.out||a.t*FPS_C>=27){A.legYaw=a.yaw+a.turn*Math.PI/2;}}
      // the action's own yaw: rotate it into the locomotion frame before blending
      const dy=angDiff(ay,yaw);if(Math.abs(dy)>1e-3){const q=qaxis(V(0,1,0),dy);for(let b=0;b<20;b++)ap.q[b]=qmul(q,ap.q[b]);ap.hip=qrot(q,ap.hip);}
      P=blendPose(P,ap,smooth(a.w));key='act';
    }
  }
  P=placeAt(P,yaw,o);
  let base=yaw;if(A.act&&A.act.kind==='turnR'&&A.turnYaw!==undefined)base=A.turnYaw;
  twistUpper(P,angDiff(e.bodyYaw,base)*(A.act&&A.act.kind==='stop'?A.act.w<1?1-A.act.w:0:1));
  return {P,key,aim:!(A.act&&A.act.kind==='stop'&&!A.act.out)};
}

// shotgun kick in the chest after a shot, rocket arm lowering after the launch
function addRecoil(P,e){
  const bi=SKN.bi;
  if(e.weapon==='rifle'){const t=world.time-(e.lastShot||-9);if(t<.18){ // full-auto shoulder shake from rifle_shooting
    const S=sampleClip('rifle_shooting',(world.time*1.4)%1.2,false),S0=sampleClip('rifle_shooting',0,false),w=.9*(1-t/.18);
    for(const nm of ['Spine','Spine1','Spine2','Neck']){const i=bi[nm];P.q[i]=qlerp(P.q[i],qmul(qmul(S.q[i],qconj(S0.q[i])),P.q[i]),w);}
    const k=qaxis(V(-Math.cos(e.bodyYaw),0,Math.sin(e.bodyYaw)),.05*e.recoil);for(const nm of ['Spine2','Neck','Head'])P.q[bi[nm]]=qmul(k,P.q[bi[nm]]);}}
  if(e.weapon==='shotgun'){const t=world.time-(e.lastShot||-9);if(t<.55){const f0=SKN.clips.shotgun_shot,f=50+t*40;
    const S=sampleClip('shotgun_shot',f/FPS_C,false),S0=sampleClip('shotgun_shot',48/FPS_C,false),w=Math.sin(Math.PI*t/.55)*.8;
    for(const nm of ['Spine','Spine1','Spine2']){const i=bi[nm];P.q[i]=qlerp(P.q[i],qmul(qmul(S.q[i],qconj(S0.q[i])),P.q[i]),w);}}}
}
function rocketLower(P,e){
  const t=world.time-(e.rFireT||-9)-.5;if(t<0||t>.45)return;
  const S=clipAt('rocket_aim_shot',38+t*55,true,'none');
  layerBones(P,S,ARM_L,'Spine2',Math.sin(Math.PI*Math.min(1,t/.45))*.85);
}


// ---------- reloads: the free hand does the work, one magazine / shell / rocket at a time ----------
function armTo(P,H,s,tgt,w,pole){
  if(w<.01)return;const bi=SKN.bi,B=SKN.bones,ar=bi[s+'Arm'],fo=bi[s+'ForeArm'],ha=bi[s+'Hand'];
  const rv=c=>vsub(B[c].head,B[B[c].parent].head);
  const r=ik3(H[ar],tgt,vlen(rv(fo))*ARM_STRETCH,vlen(rv(ha))*ARM_STRETCH,pole,V(0,-1,0)),ref0=V(0,0,-1);
  const qa=qFromR(rotBetween(frame3(vsub(r.mid,H[ar]),r.n),frame3(rv(fo),ref0))),qf=qFromR(rotBetween(frame3(vsub(r.end,r.mid),r.n),frame3(rv(ha),ref0)));
  P.q[ar]=qlerp(P.q[ar],qa,w);P.q[fo]=qlerp(P.q[fo],qf,w);P.q[ha]=qlerp(P.q[ha],qf,w);
  P.K[ar]=lerp(P.K[ar],ARM_STRETCH,w);P.K[fo]=P.K[ar];
}
// piecewise path through keyed points: keys [[t,point],...]
function pathAt(keys,t){
  if(t<=keys[0][0])return keys[0][1];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){const [a,p]=keys[i-1],[b,q]=keys[i],u=smooth((t-a)/(b-a));return vadd(vscale(p,1-u),vscale(q,u));}
  return keys[keys.length-1][1];
}
const orthTo=(v,u)=>vnorm(vsub(v,vscale(u,vdot(v,u))));
function reloadOverlay(P,e){
  e._gunF=null;e._rItem=null;e._handsBusy=null;
  const gunRl=e.reload>0&&e.rl,rocketRl=e.rreload>0&&e.rrl&&!gunRl;
  if(!gunRl&&!rocketRl)return;
  const bi=SKN.bi,by=e.bodyYaw,fw=V(Math.sin(by),0,Math.cos(by)),rt=V(-Math.cos(by),0,Math.sin(by)),up=V(0,1,0);
  const H=fkHeads(P),ch=H[bi.Spine2],hip=H[bi.Hips],shR=H[bi.RightArm],shL=H[bi.LeftArm];
  const at=(o,a,b,c)=>vadd(o,vadd(vadd(vscale(fw,a),vscale(up,b)),vscale(rt,c))); // forward, up, right
  if(gunRl){
    const R=e.rl,u=clamp(1-e.reload/R.dur,0,1),w=Math.min(smooth(clamp(u/.08,0,1)),smooth(clamp((1-u)/.08,0,1)));
    if(e.weapon==='shotgun'){
      // gun at the right hip, muzzle forward-left and up; the left hand feeds shells from the side carrier into the port underneath
      const u3=vnorm(vadd(vadd(vscale(fw,.82),vscale(rt,-.42)),vscale(up,.3))),v3=orthTo(up,u3),w3=vcross(u3,v3);
      const hR=at(hip,9,13,3.5),F={o:vadd(hR,vadd(vscale(u3,.5),vscale(v3,1.4))),u:u3,v:v3,w:w3};
      const g=(a,b,c)=>vadd(F.o,vadd(vadd(vscale(u3,a),vscale(v3,b)),vscale(w3,c)));
      const n=R.n,p=clamp((u-.12)/.8,0,.9999),k=Math.floor(p*n),s=p*n-k;
      const grab=g(2.2+(k%4)*.95,1.1,-2.4),port=g(4.6,-2.2,0),inn=g(6.2,-.6,0),rest=g(11.5,-.4,-1.2);
      const tL=u<.12?pathAt([[0,rest],[.12,grab]],u):u>.92?pathAt([[.92,inn],[1,rest]],u):pathAt([[0,inn],[.3,grab],[.62,port],[.85,inn],[1,inn]],s);
      armTo(P,H,'Right',vsub(F.o,vadd(vscale(u3,.5),vscale(v3,1.4))),w,at(shR,-2,-12,9));
      armTo(P,H,'Left',tL,w,at(shL,-2,-12,-9));
      e._gunF=w>.3?F:null;
      if(u>=.12&&u<=.92&&s>.3&&s<.85)e._rItem={kind:'shell',p:vadd(tL,vscale(v3,.8)),d:u3};
    }else if(e.weapon==='rifle'){
      // rifle across the chest: thumb the magazine out, fresh one from the left hip, slap it in, pull the charging handle
      const u3=vnorm(vadd(vadd(vscale(fw,.85),vscale(up,.35)),vscale(rt,-.25))),v3=orthTo(vadd(up,vscale(rt,.4)),u3),w3=vcross(u3,v3);
      const hR=at(ch,8,-6,3.5),F={o:vadd(hR,vadd(vscale(u3,.5),vscale(v3,1.4))),u:u3,v:v3,w:w3,mag:u>.14&&u<.7};
      const g=(a,b,c)=>vadd(F.o,vadd(vadd(vscale(u3,a),vscale(v3,b)),vscale(w3,c)));
      const fore=g(9.2,.2,-.6),well=g(3.6,-1.4,0),pouch=at(hip,3,2,-7.5),handle=g(1,2.4,-1.4);
      const tL=pathAt([[0,fore],[.1,vadd(well,vscale(v3,-1))],[.18,vadd(well,vscale(v3,-5))],[.36,pouch],[.44,pouch],[.6,vadd(well,vscale(v3,-6))],[.7,vadd(well,vscale(v3,-1))],[.8,handle],[.86,vadd(handle,vscale(u3,-2.5))],[1,fore]],u);
      armTo(P,H,'Right',vsub(F.o,vadd(vscale(u3,.5),vscale(v3,1.4))),w,at(shR,-2,-12,9));
      armTo(P,H,'Left',tL,w,at(shL,-3,-12,-8));
      e._gunF=w>.3?F:null;
      if(u>.38&&u<.7)e._rItem={kind:'rmag',p:tL,d:v3,u:u3};
      if(u>.18&&!R.dropped){R.dropped=true;const p=vadd(well,vscale(v3,-5)),g2={x:p.x,y:p.y,z:p.z,vx:fw.x*20,vy:-50,vz:fw.z*20,m:.3,col:hexRGB('#12151d'),dark:hexRGB('#12151d'),glow:e.col,kind:'shard',life:4,bleed:0};
        rbSetup(g2,1.6,4,1.2,qFromR([w3,v3,u3]));g2.y=p.y;g2.av=V((rnd()-.5)*6,(rnd()-.5)*6,(rnd()-.5)*6);gibs.push(g2);}
    }else{
      // pistol up in front of the chest, slide locked back; old magazine drops, a fresh one comes from the left hip and is slapped in
      const u3=vnorm(vadd(vadd(vscale(fw,.72),vscale(up,.5)),vscale(rt,-.35))),v3=orthTo(vadd(up,vscale(rt,.5)),u3),w3=vcross(u3,v3);
      const hR=at(ch,13,-5,1.5),F={o:vadd(hR,vadd(vscale(u3,1.6),vscale(v3,.6))),u:u3,v:v3,w:w3,slide:u<.86?1.4:1.4*(1-smooth((u-.86)/.06))};
      const well=vadd(F.o,vadd(vscale(u3,-1.6),vscale(v3,-4.4)));
      const pouch=at(hip,3,2,-7.5),rack=vadd(F.o,vadd(vscale(u3,-1.4),vscale(v3,2.6))),grip=vadd(well,vscale(v3,1.5));
      const tL=pathAt([[0,grip],[.12,vadd(well,vscale(v3,-2))],[.32,pouch],[.42,pouch],[.6,vadd(well,vscale(v3,-6))],[.7,vadd(well,vscale(v3,-1.2))],[.76,well],[.84,rack],[.9,vadd(rack,vscale(u3,-2.5))],[1,grip]],u);
      armTo(P,H,'Right',vsub(F.o,vadd(vscale(u3,1.6),vscale(v3,.6))),w,at(shR,-2,-12,9));
      armTo(P,H,'Left',tL,w,at(shL,-3,-12,-8));
      e._gunF=w>.3?F:null;
      if(u>.32&&u<.76)e._rItem={kind:'mag',p:tL,d:v3,u:u3};
      if(u>.1&&!R.dropped){R.dropped=true;const p=vadd(well,vscale(v3,-1.5)),g={x:p.x,y:p.y,z:p.z,vx:fw.x*30,vy:-60,vz:fw.z*30,m:.3,col:hexRGB('#161a26'),dark:hexRGB('#161a26'),glow:e.col,kind:'shard',life:4,bleed:0};
        rbSetup(g,1.1,3.6,.9,qFromR([w3,v3,u3]));g.y=p.y;g.av=V((rnd()-.5)*6,(rnd()-.5)*6,(rnd()-.5)*6);gibs.push(g);}
    }
  }else{
    // rockets: launcher arm across the chest, muzzle to the right; the right hand (pistol holstered) brings rockets from the right hip
    const R=e.rrl,u=clamp(1-e.rreload/R.dur,0,1),w=Math.min(smooth(clamp(u/.07,0,1)),smooth(clamp((1-u)/.08,0,1)))*(1-clamp(e.aimW||0,0,1));
    if(w<.01)return;
    e._handsBusy='rocket';
    // launcher forearm held across the belly, muzzle to the right
    armTo(P,H,'Left',at(ch,9,-6,3.5),w,at(shL,7,-13,-5));
    // the muzzle exactly where the launcher is drawn (same frame as drawLauncherModel)
    const H2=fkHeads(P),eb=H2[bi.LeftForeArm],hn=H2[bi.LeftHand],len=vlen(vsub(hn,eb)),fd=vnorm(vsub(hn,eb));
    const out0=vadd(vscale(rt,-1),V(0,.7,0)),upv=vnorm(vsub(out0,vscale(fd,vdot(out0,fd)))),mz=vadd(vadd(eb,vscale(fd,len+2.2)),vscale(upv,2.6));
    const n=R.n,p=clamp((u-.1)/.8,0,.9999),k=Math.floor(p*n),s=p*n-k;
    // the hand holds a rocket by its nose and feeds it tail-first into the muzzle
    const pouch=at(hip,-3,4,7.5),lineUp=vadd(mz,vscale(fd,5.6)),inn=vadd(mz,vscale(fd,1.6)),idle=at(hip,4,9,6);
    const tR=u<.1?pathAt([[0,idle],[.1,pouch]],u):u>.9?pathAt([[.9,inn],[1,idle]],u):pathAt([[0,inn],[.28,pouch],[.38,pouch],[.62,lineUp],[.7,lineUp],[.88,inn],[1,inn]],s);
    armTo(P,H,'Right',tR,w,at(shR,-3,-12,9));
    if(u>=.1&&u<=.9&&s>.33&&s<.88)e._rItem={kind:'rocket',p:vsub(tR,vscale(fd,1.7)),d:fd};
  }
}

// pick the source for a fighter and blend between sources
function charPose(e){
  const J=jointsFromChar(e),now=world.time,dt=clamp(now-(e.skT||now),0,.1);e.skT=now;
  const A=e.anim||(e.anim={ph:0,idle:Math.random()*8,legYaw:e.bodyYaw,back:false,act:null});
  A.idle+=dt;
  if(e.forceClip){const f=e.forceClip;const P=placeAt(clipAt(f.name,f.t*FPS_C,f.mirror,f.root||'none'),e.bodyYaw,V(e.x,e.y,e.z));e.skLast=P;e.skSrc='force';return {P,J};}
  let P=null,src='proc';
  if(SKN.clips&&e.alive){
    const r=clipFor(e,A,dt);
    if(r){P=r.P;src=r.key;
      if(r.aim){const sg=twoHanded(e);const wG=sg?1:e.weapon==='rocket'?0:smooth(clamp(e.aimW||0,0,1));
        const wR=e.rArm>0?clamp(e.rArm/.08,0,1)*clamp(e.rArm/.2,0,1):0;
        overlayAim(P,e,wG,wR);addRecoil(P,e);rocketLower(P,e);}}
    else{A.legYaw=e.legYaw;A.act=null;}
    if(e.state!=='hang')A.hangT=0;
  }
  if(!P){P=procPose(J);src='proc';}
  if(SKN.clips&&e.alive&&(e.state==='normal'||e.state==='slide'))reloadOverlay(P,e);else{e._gunF=null;e._rItem=null;e._handsBusy=null;}
  if(e.emote)e._handsBusy='emote'; // waving / bowing: guns away
  if(e.skSrc&&e.skSrc!==src)e.skFade=src==='act'||e.skSrc==='act'?.12:.2;e.skSrc=src;
  if(e.skFade>0&&e.skLast){e.skFade-=dt;P=blendPose(e.skLast,P,clamp(1-e.skFade/.2,0,1)*.65+.15);}
  e.skLast=P;
  return {P,J};
}
function drawSkinnedChar(e,col,alpha,flash){const {P}=charPose(e);return drawPose(P,col,alpha,flash);}
function drawSkinned(J,col,alpha){return drawPose(procPose(J),col,alpha);}

// ---------- death clips: the body crumples, then lies until it fades ----------
let corpses=[];
function spawnCorpse(e,dir){
  if(!SKN.clips||!SKN.ready||!e.grounded||e.knocked||(e.state!=='normal'&&e.state!=='land'&&e.state!=='kick'))return false;
  if(dir&&dir.y>.45)return false;
  const by=e.bodyYaw,fw=V(Math.sin(by),0,Math.cos(by)),rt=V(-Math.cos(by),0,Math.sin(by));
  const fsp=e.vx*fw.x+e.vz*fw.z,dh=dir?vnorm(V(dir.x,0,dir.z)):fw,side=vdot(dh,rt);
  let opts;
  if(fsp>150)opts=[['fall_flat',false]];
  else if(Math.abs(side)>.6)opts=[['death3',side>0],['death1',rnd()<.5]];
  else opts=rnd()<.5?[['death1',false],['death2',rnd()<.5],['death3',rnd()<.5]]:[['death2',rnd()<.5],['death1',false],['death3',rnd()<.5]];
  const o=V(e.x,e.y,e.z),bi=SKN.bi;
  for(const [clip,mirror] of opts){
    const c=SKN.clips[clip],end=placeAt(clipAt(clip,c.n-1,mirror,'clip'),by,o),H=fkHeads(end);
    let ok=true;
    for(const i of [bi.Head,bi.Hips,bi.Spine2,bi.LeftFoot,bi.RightFoot,bi.LeftHand,bi.RightHand]){const p=H[i];
      if(solid(tileAt(p.x,p.y+6,p.z))||((i===bi.Head||i===bi.Hips)&&!solid(tileAt(p.x,p.y-12,p.z)))){ok=false;break;}}
    if(!ok)continue;
    corpses.push({clip,mirror,yaw:by,o,t:0,life:7,col:e.col,from:e.skLast});
    if(corpses.length>8)corpses.shift();
    return true;
  }
  return false;
}
function corpsePose(c){
  const cl=SKN.clips[c.clip];let P=placeAt(clipAt(c.clip,Math.min(cl.n-1,c.t*FPS_C),c.mirror,'clip'),c.yaw,c.o);
  if(c.from&&c.t<.18)P=blendPose(c.from,P,c.t/.18);
  return P;
}
function updateCorpses(dt){for(let i=corpses.length-1;i>=0;i--){const c=corpses[i];c.t+=dt;c.life-=dt;if(c.life<=0)corpses.splice(i,1);}}
function drawCorpses(){for(const c of corpses)drawPose(corpsePose(c),c.col,Math.min(1,c.life/1.5));}
// the arena turns: lying bodies become ragdolls so they fall with everything else
function corpsesToDolls(){
  const bi=SKN.bi;
  for(const c of corpses){
    const H=fkHeads(corpsePose(c)),pts={head:H[bi.Head],neck:H[bi.Neck],hip:H[bi.Hips],kA:H[bi.RightLeg],fA:H[bi.RightFoot],kB:H[bi.LeftLeg],fB:H[bi.LeftFoot],
      eN:H[bi.RightForeArm],hN:H[bi.RightHand],eF:H[bi.LeftForeArm],hF:H[bi.LeftHand]};
    const list=[],idx={};for(const k in pts){idx[k]=list.length;const p=pts[k];list.push({x:p.x,y:p.y,z:p.z,ox:p.x,oy:p.y,oz:p.z,r:DOLL_R[k]});}
    const links=DOLL_LINKS.map(([a,b])=>{const A=list[idx[a]],Bp=list[idx[b]];return {a:idx[a],b:idx[b],len:Math.hypot(A.x-Bp.x,A.y-Bp.y,A.z-Bp.z)};});
    dolls.push({pts:list,idx,links,life:c.life,col:c.col});
  }
  corpses=[];
}

function drawPose(P,col,alpha,flash){
  const lines=SETTINGS.charStyle==='lines'&&SKN.lp,gl=R.gl,L=lines?SKN.ll:SKN.loc;const H=writeMatrices(P),bi=SKN.bi;
  gl.useProgram(lines?SKN.lp:SKN.p);
  for(let a=0;a<8;a++)gl.disableVertexAttribArray(a);
  const ST=lines?24:20;
  if(lines)gl.bindBuffer(gl.ARRAY_BUFFER,SKN.lm.b);else{gl.bindBuffer(gl.ARRAY_BUFFER,SKN.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,SKN.ib);}
  gl.enableVertexAttribArray(L.aPos);gl.vertexAttribPointer(L.aPos,3,gl.SHORT,false,ST,0);
  gl.enableVertexAttribArray(L.aNor);gl.vertexAttribPointer(L.aNor,4,gl.BYTE,true,ST,8);
  gl.enableVertexAttribArray(L.aJ);gl.vertexAttribPointer(L.aJ,4,gl.UNSIGNED_BYTE,false,ST,12);
  gl.enableVertexAttribArray(L.aW);gl.vertexAttribPointer(L.aW,4,gl.UNSIGNED_BYTE,true,ST,16);
  if(lines){gl.enableVertexAttribArray(L.aB);gl.vertexAttribPointer(L.aB,3,gl.UNSIGNED_BYTE,true,ST,20);gl.uniform3f(L.uLine,col[0],col[1],col[2]);}
  const draw=()=>{if(lines)gl.drawArrays(gl.TRIANGLES,0,SKN.lm.n);else gl.drawElements(gl.TRIANGLES,SKN.ni,gl.UNSIGNED_SHORT,0);};
  gl.uniformMatrix4fv(L.uVP,false,FR.vp);gl.uniformMatrix4fv(L.uWorldFix,false,FR.fix);
  gl.uniformMatrix4fv(L.uB,false,SKN.mats);gl.uniform1f(L.uQ,SKN.meta.q);
  const s=vnorm(V(.35,.85,.25));gl.uniform3f(L.uSun,s.x,s.y,s.z);gl.uniform3f(L.uFog,.05,.03,.1);gl.uniform1f(L.uFogD,1/1500);
  {const li=FR.light;if(li){gl.uniform4f(L.uLP,li.p.x,li.p.y,li.p.z,li.r);gl.uniform3f(L.uLC,li.c[0],li.c[1],li.c[2]);}else{gl.uniform4f(L.uLP,0,-1e5,0,1);gl.uniform3f(L.uLC,0,0,0);}}
  const fl=flash||0;
  gl.uniform3f(L.uBody,col[0]*(.55+fl*.5)+.05,col[1]*(.55+fl*.5)+.05,col[2]*(.55+fl*.5)+.06);gl.uniform3f(L.uJoint,.1+col[0]*fl*.3,.11+col[1]*fl*.3,.15+col[2]*fl*.3);
  gl.uniform3f(L.uGlow,col[0]*(.35+fl),col[1]*(.35+fl),col[2]*(.35+fl));
  if(alpha<.99){
    // see-through: lay down the body's depth first, so only its front shows and nothing behind it (guns, its own far side) bleeds through
    gl.colorMask(false,false,false,false);gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(L.uAlpha,1);
    draw();
    gl.colorMask(true,true,true,true);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);
    gl.uniform1f(L.uAlpha,alpha);draw();
    gl.depthFunc(gl.LESS);gl.depthMask(true);
  }else{gl.uniform1f(L.uAlpha,1);draw();}
  for(const a of [L.aPos,L.aNor,L.aJ,L.aW,L.aB])if(a!==undefined&&a>=0)gl.disableVertexAttribArray(a);
  gl.useProgram(R.main.p);cubeBegin();
  const qh=P.q[bi.RightHand];
  return {hR:H[bi.RightHand],hL:H[bi.LeftHand],eR:H[bi.RightForeArm],eL:H[bi.LeftForeArm],handFwd:qrot(qh,V(0,0,1)),handDown:qrot(qh,V(0,-1,0)),
    sh:H[bi.Spine2],hd:H[bi.Head],uR:H[bi.RightUpLeg],kR:H[bi.RightLeg]};
}
if(R.ok)loadModel().then(()=>{if(SKN.ready)return loadAnims();}).catch(e=>console.warn('anims not loaded',e));
