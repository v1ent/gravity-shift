// =====================================================================
//  SKINNED CHARACTER MODEL — the procedural skeleton drives a rigged mesh
// =====================================================================
const SKN={ready:false,failed:false,on:true};
const ARM_STRETCH=1.2; // the model's arms are shorter than the game skeleton's reach

const SKVS=`
attribute vec3 aPos;attribute vec4 aNor;attribute vec4 aJ;attribute vec4 aW;
uniform mat4 uVP;uniform mat4 uWorldFix;uniform mat4 uB[20];uniform float uQ;
varying vec3 vNor;varying float vMat;varying float vD;
void main(){
  vec4 p=vec4(aPos/uQ,1.0);
  mat4 m=uB[int(aJ.x)]*aW.x+uB[int(aJ.y)]*aW.y+uB[int(aJ.z)]*aW.z+uB[int(aJ.w)]*aW.w;
  vec4 w=uWorldFix*(m*p);
  vNor=normalize((uWorldFix*(m*vec4(aNor.xyz,0.0))).xyz);vMat=aNor.w;
  gl_Position=uVP*w;vD=gl_Position.w;
}`;
const SKFS=`
precision mediump float;
varying vec3 vNor;varying float vMat;varying float vD;
uniform vec3 uBody;uniform vec3 uJoint;uniform vec3 uGlow;uniform vec3 uSun;uniform vec3 uFog;uniform float uFogD;uniform float uAlpha;
void main(){
  vec3 n=normalize(vNor);
  float body=step(0.5,vMat);
  vec3 base=mix(uJoint,uBody,body);
  float dif=max(dot(n,uSun),0.0),hemi=n.y*0.5+0.5;
  vec3 col=base*(0.34+0.30*hemi+0.62*dif);
  float rim=pow(1.0-abs(n.z*0.3+n.x*0.0),3.0)*0.0;
  col+=uGlow*(1.0-body)*0.55+uGlow*body*0.06;
  float f=exp(-pow(vD*uFogD,2.0));
  gl_FragColor=vec4(mix(uFog,col,f),uAlpha);
}`;

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
    for(const u of ['uVP','uWorldFix','uB','uQ','uBody','uJoint','uGlow','uSun','uFog','uFogD','uAlpha'])loc[u]=gl.getUniformLocation(p,u);
    SKN.vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,SKN.vb);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(buf,vOff,vLen),gl.STATIC_DRAW);
    SKN.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,SKN.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(buf.slice(iOff,iOff+meta.ni*2)),gl.STATIC_DRAW);
    SKN.p=p;SKN.loc=loc;SKN.meta=meta;SKN.ni=meta.ni;
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
  const ht=P.headA||0,hf=V(Math.sin(by)*Math.cos(ht),Math.sin(ht),Math.cos(by)*Math.cos(ht));
  const J={hip,neck,upB,fwdB:vcross(upB,rightB),upL,fwdL:vcross(upL,rightL),headUp:vcross(hf,rightB),headFwd:hf,
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
  return {hip,neck,upB,fwdB:fwd,upL:upB,fwdL:fwd,headUp:hu,headFwd:vcross(right,hu),
    kR:p('kA'),fR,toeR:vadd(fR,vscale(fwd,6)),kL:p('kB'),fL,toeL:vadd(fL,vscale(fwd,6)),
    eR:p('eN'),hR:p('hN'),eL:p('eF'),hL:p('hF'),doll:true};
}

// ---------- quaternions ([x,y,z,w]) ----------
function qFromR(R3){const m=(i,j)=>R3[j][['x','y','z'][i]];const t=m(0,0)+m(1,1)+m(2,2);let q;
  if(t>0){const s=Math.sqrt(t+1)*2;q=[(m(2,1)-m(1,2))/s,(m(0,2)-m(2,0))/s,(m(1,0)-m(0,1))/s,.25*s];}
  else if(m(0,0)>m(1,1)&&m(0,0)>m(2,2)){const s=Math.sqrt(1+m(0,0)-m(1,1)-m(2,2))*2;q=[.25*s,(m(0,1)+m(1,0))/s,(m(0,2)+m(2,0))/s,(m(2,1)-m(1,2))/s];}
  else if(m(1,1)>m(2,2)){const s=Math.sqrt(1+m(1,1)-m(0,0)-m(2,2))*2;q=[(m(0,1)+m(1,0))/s,.25*s,(m(1,2)+m(2,1))/s,(m(0,2)-m(2,0))/s];}
  else{const s=Math.sqrt(1+m(2,2)-m(0,0)-m(1,1))*2;q=[(m(0,2)+m(2,0))/s,(m(1,2)+m(2,1))/s,.25*s,(m(1,0)-m(0,1))/s];}
  return qn(q);}
const qn=q=>{const l=Math.hypot(q[0],q[1],q[2],q[3])||1;return [q[0]/l,q[1]/l,q[2]/l,q[3]/l];};
const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
function qrot(q,v){const [x,y,z,w]=q,ix=w*v.x+y*v.z-z*v.y,iy=w*v.y+z*v.x-x*v.z,iz=w*v.z+x*v.y-y*v.x,iw=-x*v.x-y*v.y-z*v.z;
  return V(ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x);}
const qaxis=(ax,an)=>{const s=Math.sin(an/2);return [ax.x*s,ax.y*s,ax.z*s,Math.cos(an/2)];};
function qlerp(a,b,t){const d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3],sg=d<0?-1:1;return qn([a[0]*(1-t)+b[0]*t*sg,a[1]*(1-t)+b[1]*t*sg,a[2]*(1-t)+b[2]*t*sg,a[3]*(1-t)+b[3]*t*sg]);}

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
// locomotion: the legs play the forward (or backward) clips turned toward the direction of travel;
// the upper body twists back at the waist so the chest keeps facing the aim
const LOCO={F:['walking_forward','running'],B:['walking_backward','running_backward']};
function locoPose(e,dt){
  const sp=Math.hypot(e.vx,e.vz),by=e.bodyYaw;
  const A=e.anim||(e.anim={ph:0,idle:Math.random()*8,legYaw:by,back:false});
  A.idle+=dt;
  const wMove=clamp((sp-8)/40,0,1);
  if(sp>12){
    const mv=Math.atan2(e.vx,e.vz),rel=Math.abs(angDiff(mv,by));
    if(!A.back&&rel>2.05)A.back=true;else if(A.back&&rel<1.75)A.back=false;   // hysteresis: no flicker around 110 degrees
    const tgt=A.back?mv+Math.PI:mv;
    A.legYaw+=clamp(angDiff(tgt,A.legYaw),-dt*11,dt*11);
  }else{ // standing: feet stay put until the aim turns too far, then step round
    const d=angDiff(by,A.legYaw);if(Math.abs(d)>.9||A.turning){A.turning=Math.abs(d)>.1;A.legYaw+=clamp(d,-dt*6,dt*6);}
  }
  const idle=sampleClip('idle',A.idle,false);
  let P=idle;
  if(wMove>.01){
    const [wn,rn]=LOCO[A.back?'B':'F'],cw=SKN.clips[wn],cr=SKN.clips[rn];
    const k=clamp((sp-cw.speed)/(cr.speed-cw.speed),0,1),nat=lerp(cw.speed,cr.speed,k),dur=lerp(cw.dur,cr.dur,k);
    A.ph=(A.ph+(Math.max(sp,10)/nat)/dur*dt)%1;
    const mv=blendPose(sampleClip(wn,A.ph*cw.dur,false),sampleClip(rn,A.ph*cr.dur,false),k);
    P=wMove>=.99?mv:blendPose(idle,mv,wMove);
  }else A.ph=0;
  return {P,yaw:A.legYaw};
}
// character space -> world (yaw and position), then twist the upper body round to the aim
function placePose(L,e){
  const P=L.P,qy=qaxis(V(0,1,0),L.yaw);
  for(let b=0;b<20;b++)P.q[b]=qmul(qy,P.q[b]);
  P.hip=vadd(V(e.x+(e.visX||0),e.y+(e.visY||0),e.z+(e.visZ||0)),qrot(qy,P.hip));
  const tw=angDiff(e.bodyYaw,L.yaw),bi=SKN.bi;
  const share={Spine:.3,Spine1:.6,Spine2:1,Neck:1,Head:1,LeftShoulder:1,RightShoulder:1,LeftArm:1,RightArm:1,LeftForeArm:1,RightForeArm:1,LeftHand:1,RightHand:1};
  for(const nm in share)P.q[bi[nm]]=qmul(qaxis(V(0,1,0),tw*share[nm]),P.q[bi[nm]]);
  return P;
}
// arms from the game's IK on top of a clip (two-hand aim, rocket arm), torso pitched with the aim
function overlayArms(P,J,wR,wL,pitch){
  const B=SKN.bones,bi=SKN.bi,rest=i=>B[i].head,restVec=c=>vsub(rest(c),rest(B[c].parent));
  if(pitch){const rt=vcross(J.fwdB,V(0,1,0));for(const nm of ['Spine1','Spine2','Neck','Head','LeftShoulder','RightShoulder']){const i=bi[nm];P.q[i]=qmul(qaxis(vnorm(rt),pitch*(nm==='Spine1'?.35:.65)),P.q[i]);}}
  const H=fkHeads(P);
  for(const [s,w] of [['Right',wR],['Left',wL]]){
    if(w<.01)continue;
    const ar=bi[s+'Arm'],fo=bi[s+'ForeArm'],ha=bi[s+'Hand'];
    const a=vlen(restVec(fo))*ARM_STRETCH,b=vlen(restVec(ha))*ARM_STRETCH;
    const r=ik3(H[ar],s==='Right'?J.hR:J.hL,a,b,s==='Right'?J.eR:J.eL,vscale(J.fwdB,-1)),ref0=V(0,0,-1);
    const qa=qFromR(rotBetween(frame3(vsub(r.mid,H[ar]),r.n),frame3(restVec(fo),ref0))),qf=qFromR(rotBetween(frame3(vsub(r.end,r.mid),r.n),frame3(restVec(ha),ref0)));
    P.q[ar]=qlerp(P.q[ar],qa,w);P.q[fo]=qlerp(P.q[fo],qf,w);P.q[ha]=qlerp(P.q[ha],qf,w);
    P.K[ar]=lerp(1,ARM_STRETCH,w);P.K[fo]=P.K[ar];
  }
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
// pick the source for a fighter: clips for ordinary movement on the ground, the procedural skeleton for everything else
function charPose(e){
  const J=jointsFromChar(e),now=world.time,dt=clamp(now-(e.skT||now),0,.1);e.skT=now;
  const clipOK=SKN.clips&&e.alive&&e.state==='normal'&&e.grounded&&!e.crouch&&Math.abs(e.ba||0)<.05&&e.h>=STAND_H-1;
  let P,src;
  if(clipOK){
    P=placePose(locoPose(e,dt),e);src='clip';
    const wR=e.weapon==='shotgun'?1:smooth(clamp(e.aimW||0,0,1)),wL=Math.max(e.weapon==='shotgun'?1:wR*.9,e.rArm>0?1:0);
    P=overlayArms(P,J,wR,wL,-(e.pitch||0)*Math.max(wR,.4));
  }else{P=procPose(J);src='proc';}
  if(e.skSrc&&e.skSrc!==src)e.skFade=.22;e.skSrc=src;
  if(e.skFade>0&&e.skLast){e.skFade-=dt;P=blendPose(e.skLast,P,clamp(1-e.skFade/.22,0,1)*.6+.2);}
  e.skLast=P;
  return {P,J};
}
function drawSkinnedChar(e,col,alpha){const {P}=charPose(e);return drawPose(P,col,alpha);}
function drawSkinned(J,col,alpha){return drawPose(procPose(J),col,alpha);}
function drawPose(P,col,alpha){
  const gl=R.gl,L=SKN.loc;const H=writeMatrices(P),bi=SKN.bi;
  gl.useProgram(SKN.p);
  for(let a=0;a<8;a++)gl.disableVertexAttribArray(a);
  gl.bindBuffer(gl.ARRAY_BUFFER,SKN.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,SKN.ib);
  gl.enableVertexAttribArray(L.aPos);gl.vertexAttribPointer(L.aPos,3,gl.SHORT,false,20,0);
  gl.enableVertexAttribArray(L.aNor);gl.vertexAttribPointer(L.aNor,4,gl.BYTE,true,20,8);
  gl.enableVertexAttribArray(L.aJ);gl.vertexAttribPointer(L.aJ,4,gl.UNSIGNED_BYTE,false,20,12);
  gl.enableVertexAttribArray(L.aW);gl.vertexAttribPointer(L.aW,4,gl.UNSIGNED_BYTE,true,20,16);
  gl.uniformMatrix4fv(L.uVP,false,FR.vp);gl.uniformMatrix4fv(L.uWorldFix,false,FR.fix);
  gl.uniformMatrix4fv(L.uB,false,SKN.mats);gl.uniform1f(L.uQ,SKN.meta.q);
  const s=vnorm(V(.35,.85,.25));gl.uniform3f(L.uSun,s.x,s.y,s.z);gl.uniform3f(L.uFog,.05,.03,.1);gl.uniform1f(L.uFogD,1/1500);
  gl.uniform3f(L.uBody,col[0]*.55+.05,col[1]*.55+.05,col[2]*.55+.06);gl.uniform3f(L.uJoint,.1,.11,.15);gl.uniform3f(L.uGlow,col[0]*.35,col[1]*.35,col[2]*.35);
  gl.uniform1f(L.uAlpha,alpha);
  gl.drawElements(gl.TRIANGLES,SKN.ni,gl.UNSIGNED_SHORT,0);
  for(const a of [L.aPos,L.aNor,L.aJ,L.aW])gl.disableVertexAttribArray(a);
  gl.useProgram(R.main.p);cubeBegin();
  // pistol rides in the right hand: barrel along the hand's forward, grip down
  const qh=P.q[bi.RightHand];
  return {hR:H[bi.RightHand],hL:H[bi.LeftHand],eR:H[bi.RightForeArm],eL:H[bi.LeftForeArm],handFwd:qrot(qh,V(0,0,1)),handDown:qrot(qh,V(0,-1,0))};
}
if(R.ok)loadModel().then(()=>{if(SKN.ready)return loadAnims();}).catch(e=>console.warn('anims not loaded',e));
