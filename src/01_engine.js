'use strict';
// =====================================================================
//  ENGINE — math, WebGL renderer (no external libraries)
// =====================================================================
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
const approach=(v,t,d)=>v<t?Math.min(v+d,t):Math.max(v-d,t);
const smooth=t=>t*t*(3-2*t), easeOut=t=>1-(1-t)*(1-t)*(1-t), easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
let rnd=Math.random;
const V=(x,y,z)=>({x,y,z});
const vadd=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z), vsub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z), vscale=(a,s)=>V(a.x*s,a.y*s,a.z*s);
const vdot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z, vlen=a=>Math.hypot(a.x,a.y,a.z);
const vcross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const vnorm=a=>{const l=vlen(a)||1;return V(a.x/l,a.y/l,a.z/l);};
const vlerp=(a,b,t)=>V(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(a.z,b.z,t));
const fwdOf=(yaw,pitch)=>V(Math.sin(yaw)*Math.cos(pitch||0),Math.sin(pitch||0),Math.cos(yaw)*Math.cos(pitch||0)); // yaw 0 = +z
const yawOf=(dx,dz)=>Math.atan2(dx,dz);
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};

// ---- mat4 (column-major) ----
const M4={
  ident(){const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;},
  mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;},
  persp(fovy,aspect,n,f){const t=1/Math.tan(fovy/2),m=new Float32Array(16);m[0]=t/aspect;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=2*f*n/(n-f);return m;},
  lookAt(e,c,up){
    const z=vnorm(vsub(e,c)),x=vnorm(vcross(up,z)),y=vcross(z,x),m=new Float32Array(16);
    m[0]=x.x;m[4]=x.y;m[8]=x.z;m[1]=y.x;m[5]=y.y;m[9]=y.z;m[2]=z.x;m[6]=z.y;m[10]=z.z;
    m[12]=-vdot(x,e);m[13]=-vdot(y,e);m[14]=-vdot(z,e);m[15]=1;return m;
  },
  translate(x,y,z){const m=M4.ident();m[12]=x;m[13]=y;m[14]=z;return m;},
  // rotation about a unit axis
  rotAxis(ax,a){const c=Math.cos(a),s=Math.sin(a),t=1-c,{x,y,z}=ax,m=new Float32Array(16);
    m[0]=t*x*x+c;m[1]=t*x*y+s*z;m[2]=t*x*z-s*y;m[4]=t*x*y-s*z;m[5]=t*y*y+c;m[6]=t*y*z+s*x;m[8]=t*x*z+s*y;m[9]=t*y*z-s*x;m[10]=t*z*z+c;m[15]=1;return m;},
  // model from origin + three (scaled) axes
  basis(o,ax,ay,az){const m=new Float32Array(16);m[0]=ax.x;m[1]=ax.y;m[2]=ax.z;m[4]=ay.x;m[5]=ay.y;m[6]=ay.z;m[8]=az.x;m[9]=az.y;m[10]=az.z;m[12]=o.x;m[13]=o.y;m[14]=o.z;m[15]=1;return m;},
  apply(m,p){return V(m[0]*p.x+m[4]*p.y+m[8]*p.z+m[12],m[1]*p.x+m[5]*p.y+m[9]*p.z+m[13],m[2]*p.x+m[6]*p.y+m[10]*p.z+m[14]);},
  applyDir(m,p){return V(m[0]*p.x+m[4]*p.y+m[8]*p.z,m[1]*p.x+m[5]*p.y+m[9]*p.z,m[2]*p.x+m[6]*p.y+m[10]*p.z);},
};

// ---- GL ----
const R={gl:null,ok:false};
function hexRGB(h){const n=parseInt(h.slice(1),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}
const VS=`
attribute vec3 aPos;attribute vec3 aNor;attribute vec3 aCol;attribute vec4 aUV;attribute float aEm;
uniform mat4 uVP;uniform mat4 uModel;uniform mat4 uWorldFix;
varying vec3 vNor;varying vec3 vCol;varying vec4 vUV;varying float vEm;varying vec3 vW;varying float vD;
void main(){vec4 w=uWorldFix*(uModel*vec4(aPos,1.0));vW=(uModel*vec4(aPos,1.0)).xyz;vNor=normalize((uWorldFix*uModel*vec4(aNor,0.0)).xyz);
vCol=aCol;vUV=aUV;vEm=aEm;gl_Position=uVP*w;vD=gl_Position.w;}`;
const FS=`
precision mediump float;
varying vec3 vNor;varying vec3 vCol;varying vec4 vUV;varying float vEm;varying vec3 vW;varying float vD;
uniform vec3 uTint;uniform float uUseTint;uniform vec3 uEmis;uniform float uAlpha;uniform float uTime;uniform vec3 uSun;uniform vec3 uFog;uniform float uFogD;uniform float uEdge;uniform vec3 uEdgeCol;
void main(){
  vec3 base=mix(vCol,uTint,uUseTint);
  vec3 n=normalize(vNor);
  float dif=max(dot(n,uSun),0.0);
  float hemi=n.y*0.5+0.5;
  vec3 col=base*(0.34+0.30*hemi+0.62*dif);
  // panel edges: outline of each merged quad + faint seams every block
  float u=vUV.x,v=vUV.y,w=vUV.z,h=vUV.w;
  float e=min(min(u,w-u),min(v,h-v));
  float seam=min(min(fract(u),1.0-fract(u)),min(fract(v),1.0-fract(v)));
  float edge=1.0-smoothstep(0.0,uEdge,e);
  float sm=(1.0-smoothstep(0.0,0.03,seam))*0.25;
  vec3 ec=uEdgeCol;
  if(vEm>3.5&&vEm<4.5){ // hazard tape along the edges of slab rims
    float band=1.0-smoothstep(0.16,0.2,e);
    float s=step(0.5,fract((vW.x+vW.y+vW.z)/18.0));
    col=mix(col,mix(vec3(0.06),vec3(0.9,0.7,0.15),s)*(0.55+0.5*dif),band*0.85);ec=vec3(1.0,0.8,0.25);
  }
  if(vEm>5.5){ec*=0.35;}
  if(vEm>1.5&&vEm<2.5){ec=vec3(1.0,0.75,0.25);}
  col+=ec*(edge*0.9+sm*0.35);
  if(vEm>0.5&&vEm<1.5){ // live gravity panel
    float p=0.55+0.45*sin(uTime*5.0);float ch=step(0.5,fract(v*1.0-uTime*1.2+abs(fract(u)-0.5)));
    col=mix(vec3(0.35,0.02,0.22),vec3(1.0,0.25,0.65),0.35+0.4*ch*p)+vec3(1.0,0.3,0.7)*edge*1.2;
  }
  if(vEm>2.5&&vEm<3.5){ // dormant gravity panel
    float ch=step(0.5,fract(v+abs(fract(u)-0.5)));col=mix(col,vec3(0.22,0.07,0.2),0.6)+vec3(0.5,0.1,0.35)*ch*0.12;
  }
  if(vEm>4.5&&vEm<5.5){ // neon strip / lamp / LED
    col=vCol*1.6;
  }
  if(vEm>6.5&&vEm<7.5){ // blinking LED
    float bl=step(0.45,fract(uTime*1.3+dot(vW,vec3(0.031,0.017,0.023))));col=mix(vCol*0.25,vCol*1.8,bl);
  }
  col+=uEmis;
  float f=exp(-pow(vD*uFogD,2.0));
  col=mix(uFog,col,f);
  gl_FragColor=vec4(col,uAlpha);
}`;
const PVS=`attribute vec3 aPos;attribute vec4 aCol;attribute float aSize;uniform mat4 uVP;uniform mat4 uWorldFix;uniform float uScale;varying vec4 vCol;
void main(){gl_Position=uVP*(uWorldFix*vec4(aPos,1.0));gl_PointSize=clamp(aSize*uScale/gl_Position.w,1.0,256.0);vCol=aCol;}`;
const PFS=`precision mediump float;varying vec4 vCol;void main(){vec2 d=gl_PointCoord-0.5;float r=dot(d,d)*4.0;if(r>1.0)discard;gl_FragColor=vec4(vCol.rgb,vCol.a*(1.0-r));}`;
const SKYVS=`attribute vec2 aP;varying vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.999,1.0);}`;
const SKYFS=`precision mediump float;varying vec2 vP;uniform float uTime;void main(){float t=vP.y*0.5+0.5;vec3 c=mix(vec3(0.03,0.02,0.07),vec3(0.13,0.04,0.2),t);gl_FragColor=vec4(c,1.0);}`;

function compile(gl,vs,fs){
  const mk=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
  const p=gl.createProgram();gl.attachShader(p,mk(gl.VERTEX_SHADER,vs));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  const loc={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const u=gl.getActiveUniform(p,i);loc[u.name]=gl.getUniformLocation(p,u.name);}
  const na=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);for(let i=0;i<na;i++){const a=gl.getActiveAttrib(p,i);loc[a.name]=gl.getAttribLocation(p,a.name);}
  return {p,loc};
}
const STRIDE=14; // pos3 nor3 col3 uv4 em1
function initGL(canvas){
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false})||canvas.getContext('experimental-webgl');
  if(!gl)return false;
  R.gl=gl;R.main=compile(gl,VS,FS);R.part=compile(gl,PVS,PFS);R.sky=compile(gl,SKYVS,SKYFS);
  // unit cube centred at origin, uv 0..1 per face
  const v=[];const faces=[[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]];
  for(const [ax,s] of faces){
    const u=(ax+1)%3,w=(ax+2)%3;
    const quad=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
    for(const [a,b] of quad){const p=[0,0,0];p[ax]=s*.5;p[u]=a-.5;p[w]=b-.5;const n=[0,0,0];n[ax]=s;v.push(...p,...n,1,1,1,a,b,1,1,0);}
  }
  R.cube=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,R.cube);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(v),gl.STATIC_DRAW);R.cubeN=v.length/STRIDE;
  R.level=gl.createBuffer();R.levelN=0;
  R.pbuf=gl.createBuffer();
  R.skyBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,R.skyBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  R.ok=true;return true;
}
function bindMain(buf){
  const gl=R.gl,L=R.main.loc;gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  const S=STRIDE*4;
  gl.enableVertexAttribArray(L.aPos);gl.vertexAttribPointer(L.aPos,3,gl.FLOAT,false,S,0);
  gl.enableVertexAttribArray(L.aNor);gl.vertexAttribPointer(L.aNor,3,gl.FLOAT,false,S,12);
  gl.enableVertexAttribArray(L.aCol);gl.vertexAttribPointer(L.aCol,3,gl.FLOAT,false,S,24);
  gl.enableVertexAttribArray(L.aUV);gl.vertexAttribPointer(L.aUV,4,gl.FLOAT,false,S,36);
  gl.enableVertexAttribArray(L.aEm);gl.vertexAttribPointer(L.aEm,1,gl.FLOAT,false,S,52);
}
// frame-level state shared by draw helpers
const FR={vp:null,fix:M4.ident(),time:0};
function beginMain(){
  const gl=R.gl,L=R.main.loc;gl.useProgram(R.main.p);
  gl.uniformMatrix4fv(L.uVP,false,FR.vp);gl.uniformMatrix4fv(L.uWorldFix,false,FR.fix);
  gl.uniform1f(L.uTime,FR.time);
  const s=vnorm(V(.35,.85,.25));gl.uniform3f(L.uSun,s.x,s.y,s.z);
  gl.uniform3f(L.uFog,.05,.03,.1);gl.uniform1f(L.uFogD,1/1500);
  gl.uniform1f(L.uAlpha,1);gl.uniform3f(L.uEmis,0,0,0);gl.uniform1f(L.uUseTint,0);
}
function drawLevelMesh(){
  if(!R.levelN)return;const gl=R.gl,L=R.main.loc;
  bindMain(R.level);gl.uniformMatrix4fv(L.uModel,false,M4.ident());gl.uniform1f(L.uUseTint,0);
  gl.uniform1f(L.uEdge,.05);gl.uniform3f(L.uEdgeCol,.16,.85,1.0);
  gl.drawArrays(gl.TRIANGLES,0,R.levelN);
  if(R.decoN){bindMain(R.deco);gl.uniform1f(L.uEdge,.012);gl.drawArrays(gl.TRIANGLES,0,R.decoN);}
}
// solid cube with model matrix
let _cubeBound=false;
function cubeBegin(){bindMain(R.cube);_cubeBound=true;const gl=R.gl,L=R.main.loc;gl.uniform1f(L.uUseTint,1);gl.uniform1f(L.uEdge,.06);}
function drawCubeM(m,col,em,edgeCol,alpha){
  const gl=R.gl,L=R.main.loc;
  gl.uniformMatrix4fv(L.uModel,false,m);gl.uniform3f(L.uTint,col[0],col[1],col[2]);
  if(em)gl.uniform3f(L.uEmis,em[0],em[1],em[2]);else gl.uniform3f(L.uEmis,0,0,0);
  const ec=edgeCol||[0,0,0];gl.uniform3f(L.uEdgeCol,ec[0],ec[1],ec[2]);
  gl.uniform1f(L.uAlpha,alpha===undefined?1:alpha);
  gl.drawArrays(gl.TRIANGLES,0,R.cubeN);
}
// axis-aligned / yawed box
function drawBox(c,sx,sy,sz,col,em,edgeCol,yaw,alpha){
  const cy=Math.cos(yaw||0),sy_=Math.sin(yaw||0);
  const m=M4.basis(c,V(cy*sx,0,-sy_*sx),V(0,sy,0),V(sy_*sz,0,cy*sz));
  drawCubeM(m,col,em,edgeCol,alpha);
}
// limb segment from a to b, square cross-section of thickness t
function drawSeg(a,b,t,col,em,edgeCol,alpha){
  const d=vsub(b,a),len=vlen(d)||.001,dz=vscale(d,1/len);
  let ref=Math.abs(dz.y)<.9?V(0,1,0):V(1,0,0);
  const ax=vnorm(vcross(ref,dz)),ay=vcross(dz,ax);
  const m=M4.basis(vscale(vadd(a,b),.5),vscale(ax,t),vscale(ay,t),vscale(dz,len+t*.6));
  drawCubeM(m,col,em,edgeCol,alpha);
}
// particles: arrays of {x,y,z,r,g,b,a,size}
function drawParticles(list,additive){
  if(!list.length)return;const gl=R.gl,L=R.part.loc;
  const d=new Float32Array(list.length*8);let i=0;
  for(const p of list){d[i++]=p.x;d[i++]=p.y;d[i++]=p.z;d[i++]=p.r;d[i++]=p.g;d[i++]=p.b;d[i++]=p.a;d[i++]=p.s;}
  gl.useProgram(R.part.p);gl.bindBuffer(gl.ARRAY_BUFFER,R.pbuf);gl.bufferData(gl.ARRAY_BUFFER,d,gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(L.aPos);gl.vertexAttribPointer(L.aPos,3,gl.FLOAT,false,32,0);
  gl.enableVertexAttribArray(L.aCol);gl.vertexAttribPointer(L.aCol,4,gl.FLOAT,false,32,12);
  gl.enableVertexAttribArray(L.aSize);gl.vertexAttribPointer(L.aSize,1,gl.FLOAT,false,32,28);
  gl.uniformMatrix4fv(L.uVP,false,FR.vp);gl.uniformMatrix4fv(L.uWorldFix,false,FR.fix);gl.uniform1f(L.uScale,R.gl.drawingBufferHeight*.9);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,additive?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.drawArrays(gl.POINTS,0,list.length);
  gl.depthMask(true);gl.disable(gl.BLEND);
  // restore main attribute layout on next bind
  for(const a of [L.aPos,L.aCol,L.aSize])gl.disableVertexAttribArray(a);
}
function drawSky(){
  const gl=R.gl,L=R.sky.loc;gl.useProgram(R.sky.p);gl.bindBuffer(gl.ARRAY_BUFFER,R.skyBuf);
  gl.enableVertexAttribArray(L.aP);gl.vertexAttribPointer(L.aP,2,gl.FLOAT,false,8,0);
  gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthMask(true);gl.disableVertexAttribArray(L.aP);
}
