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

// solve all 20 bones and write the skinning matrices
function solveSkin(J){
  const B=SKN.bones,bi=SKN.bi,rest=i=>B[i].head,M=SKN.mats;
  const Rw=new Array(20),H=new Array(20),K=new Array(20).fill(1),D0=new Array(20);
  const restVec=(c)=>vsub(rest(c),rest(B[c].parent));
  const fk=(i)=>vadd(H[B[i].parent],rapply(Rw[B[i].parent],vsub(rest(i),rest(B[i].parent))));
  // hips: leg frame, lifted to the model's hip height above the game hip
  const Fh=frame3(J.upL,J.fwdL),F0=frame3(REST_UP[0],REST_UP[1]);
  const Fc=frame3(J.upB,J.fwdB);
  Rw[0]=rotBetween(Fh,F0);H[0]=vadd(J.hip,vscale(J.upL,J.doll?0:4.6*CHAR_SCALE));
  const spine=['Spine','Spine1','Spine2','Neck'];
  spine.forEach((nm,k)=>{const i=bi[nm];H[i]=fk(i);Rw[i]=rotBetween(lerpFrame(Fh,Fc,Math.min(1,(k+1)/3)),F0);});
  {const i=bi.Head;H[i]=fk(i);Rw[i]=rotBetween(frame3(J.headUp,J.headFwd),F0);}
  for(const s of ['Left','Right']){
    const sh=bi[s+'Shoulder'],ar=bi[s+'Arm'],fo=bi[s+'ForeArm'],ha=bi[s+'Hand'];
    H[sh]=fk(sh);Rw[sh]=Rw[bi.Spine2];H[ar]=fk(ar);
    const a=vlen(restVec(fo))*ARM_STRETCH,b=vlen(restVec(ha))*ARM_STRETCH;
    const tgt=s==='Right'?J.hR:J.hL,pole=s==='Right'?J.eR:J.eL;
    const r=ik3(H[ar],tgt,a,b,pole,vscale(J.fwdB,-1));
    const ref0=V(0,0,-1); // rest: elbows point backwards
    Rw[ar]=rotBetween(frame3(vsub(r.mid,H[ar]),r.n),frame3(restVec(fo),ref0));K[ar]=ARM_STRETCH;D0[ar]=vnorm(restVec(fo));
    H[fo]=r.mid;Rw[fo]=rotBetween(frame3(vsub(r.end,r.mid),r.n),frame3(restVec(ha),ref0));K[fo]=ARM_STRETCH;D0[fo]=vnorm(restVec(ha));
    H[ha]=r.end;Rw[ha]=Rw[fo];
  }
  for(const s of ['Left','Right']){
    const ul=bi[s+'UpLeg'],lg=bi[s+'Leg'],ft=bi[s+'Foot'];
    H[ul]=fk(ul);
    const a=vlen(restVec(lg)),b=vlen(restVec(ft)),foot=s==='Right'?J.fR:J.fL,toe=s==='Right'?J.toeR:J.toeL,knee=s==='Right'?J.kR:J.kL;
    const ankleH=rest(ft).y,ankle=vadd(foot,vscale(J.upL,J.doll?0:ankleH));
    const r=ik3(H[ul],ankle,a,b,knee,J.fwdL);
    const ref0=V(0,0,1); // rest: knees point forwards
    Rw[ul]=rotBetween(frame3(vsub(r.mid,H[ul]),r.n),frame3(restVec(lg),ref0));
    H[lg]=r.mid;Rw[lg]=rotBetween(frame3(vsub(r.end,r.mid),r.n),frame3(restVec(ft),ref0));
    H[ft]=r.end;
    const toeRest=SKN.toe[s==='Right'?'R':'L'],fd0=vsub(toeRest,rest(ft)),fd1=vsub(toe,ankle);
    Rw[ft]=rotBetween(frame3(fd1,J.upL),frame3(fd0,V(0,1,0)));
  }
  // matrices: v -> H + R*S*(v-rest), S stretching along the rest bone direction
  for(let i=0;i<20;i++){
    const R3=Rw[i],k=K[i],d=D0[i],o=i*16;
    const col=j=>{let v=j===0?V(1,0,0):j===1?V(0,1,0):V(0,0,1);if(k!==1)v=vadd(v,vscale(d,(k-1)*d[['x','y','z'][j]]));return rapply(R3,v);};
    const c0=col(0),c1=col(1),c2=col(2),r0=rest(i);
    const t=vsub(H[i],vadd(vadd(vscale(c0,r0.x),vscale(c1,r0.y)),vscale(c2,r0.z)));
    M[o]=c0.x;M[o+1]=c0.y;M[o+2]=c0.z;M[o+3]=0;M[o+4]=c1.x;M[o+5]=c1.y;M[o+6]=c1.z;M[o+7]=0;
    M[o+8]=c2.x;M[o+9]=c2.y;M[o+10]=c2.z;M[o+11]=0;M[o+12]=t.x;M[o+13]=t.y;M[o+14]=t.z;M[o+15]=1;
  }
  return {hR:H[bi.RightHand],hL:H[bi.LeftHand],eR:H[bi.RightForeArm],eL:H[bi.LeftForeArm]};
}

function drawSkinned(J,col,alpha){
  const gl=R.gl,L=SKN.loc;const res=solveSkin(J);
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
  return res;
}
if(R.ok)loadModel(); // after everything else is defined
