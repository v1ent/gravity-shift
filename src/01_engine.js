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
uniform vec4 uLP;uniform vec3 uLC;
uniform vec3 uTint;uniform float uUseTint;uniform vec3 uEmis;uniform float uAlpha;uniform float uTime;uniform vec3 uSun;uniform vec3 uFog;uniform float uFogD;uniform float uEdge;uniform vec3 uEdgeCol;
uniform vec3 uPanel; // x: grid offline (static) 0..1, y: hit glitch 0..1, z: grid health 0..1
uniform float uCount; // seconds left on a grid outage (shown on the panels)
uniform float uSwitch; // seconds since the last arena turn: panels that just switched on/off animate, block by block
// a TV switching on / off inside one block: 'a' is how far on (1 = picture, 0 = dark): the picture squeezes to a bright
// line, the line to a dot, the dot fades
vec3 tvBlock(vec2 cl,float a,vec3 pic,vec3 off){
  if(a>=1.0)return pic;if(a<=0.0)return off;
  if(a>0.4){float sy=(a-0.4)/0.6;return abs(cl.y)<0.5*sy?pic*(1.0+(1.0-sy)*2.0):off;}
  if(a>0.15){float sx=(a-0.15)/0.25;return (abs(cl.y)<0.03&&abs(cl.x)<0.5*sx)?vec3(1.0,0.75,0.95)*1.6:off;}
  float r=length(cl);return r<0.05*a/0.15+0.01?vec3(1.0,0.85,1.0)*1.8:off;
}
// a 7-segment digit (like a digital clock): 1 inside a lit segment, ~0.12 for unlit ones, with a soft glow
float segMask(float d){if(d<0.5)return 63.0;if(d<1.5)return 6.0;if(d<2.5)return 91.0;if(d<3.5)return 79.0;if(d<4.5)return 102.0;
  if(d<5.5)return 109.0;if(d<6.5)return 125.0;if(d<7.5)return 7.0;if(d<8.5)return 127.0;return 111.0;}
float segBox(vec2 p,vec2 c,vec2 hs){vec2 q=abs(p-c)-hs;return length(max(q,0.0))+min(max(q.x,q.y),0.0);}
float digit7(vec2 p,float dg,float hh){ // p: digit space, height 2*hh, width hh
  float hw=hh*0.5,t=hh*0.16,m=segMask(dg),lit=0.0,ghost=0.0,glow=0.0;
  for(int i=0;i<7;i++){
    vec2 c,hs;
    if(i==0){c=vec2(0.0,hh-t*0.5);hs=vec2(hw-t*0.8,t*0.5);}
    else if(i==1){c=vec2(hw-t*0.5,hh*0.5);hs=vec2(t*0.5,hh*0.5-t*0.8);}
    else if(i==2){c=vec2(hw-t*0.5,-hh*0.5);hs=vec2(t*0.5,hh*0.5-t*0.8);}
    else if(i==3){c=vec2(0.0,-hh+t*0.5);hs=vec2(hw-t*0.8,t*0.5);}
    else if(i==4){c=vec2(-hw+t*0.5,-hh*0.5);hs=vec2(t*0.5,hh*0.5-t*0.8);}
    else if(i==5){c=vec2(-hw+t*0.5,hh*0.5);hs=vec2(t*0.5,hh*0.5-t*0.8);}
    else{c=vec2(0.0,0.0);hs=vec2(hw-t*0.8,t*0.5);}
    float dd=segBox(vec2(p.x-p.y*0.12,p.y),c,hs),on=mod(floor(m/exp2(float(i))),2.0);
    float shape=1.0-smoothstep(-t*0.08,t*0.08,dd);
    lit=max(lit,shape*on);ghost=max(ghost,shape);glow=max(glow,on*exp(-max(dd,0.0)/(t*0.9)));
  }
  return max(max(lit,ghost*0.1),glow*0.45);
}
float hsh(vec2 p){p=fract(mod(p,289.0)*vec2(0.1031,0.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
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
  if((vEm>0.5&&vEm<1.5)||(vEm>2.5&&vEm<3.5)){ // gravity panel: a screen when live, switched off on floors and ceilings
    float t=uTime,gl=uPanel.y;
    // hit glitch: rows slide sideways
    float uu=u+(hsh(vec2(floor(v*14.0),floor(t*30.0)))-0.5)*gl*0.6;
    vec2 q=vec2(uu,v),cl=fract(q)-0.5;
    vec3 pc=vec3(1.0,0.25,0.65);
    vec3 c2=mix(vec3(0.13,0.0,0.08),vec3(0.36,0.02,0.22),clamp(v/max(h,1.0),0.0,1.0));
    // fine grid
    vec2 f4=abs(fract(q*4.0)-0.5);c2+=pc*max(smoothstep(0.44,0.5,f4.x),smoothstep(0.44,0.5,f4.y))*0.1;
    // chevrons climbing: soft fill plus a bright outline
    float cv=fract(v*1.0-t*1.2+abs(fract(uu)-0.5));
    c2+=pc*step(0.5,cv)*0.16*(0.6+0.4*sin(t*5.0));c2+=pc*(1.0-smoothstep(0.0,0.05,abs(cv-0.5)))*0.55;
    // a rotating dashed ring and a pulsing core on every block
    float r=length(cl),a=atan(cl.y,cl.x);
    float ring=(1.0-smoothstep(0.012,0.035,abs(r-0.3)))*step(0.38,fract(a/6.2832*10.0+t*0.35));
    float ring2=(1.0-smoothstep(0.006,0.02,abs(r-0.21)))*step(0.6,fract(-a/6.2832*4.0+t*0.6));
    float core=(1.0-smoothstep(0.03,0.07,r))*(0.6+0.4*sin(t*6.0+floor(q.x)*1.7+floor(q.y)*2.3));
    c2+=vec3(1.0,0.55,0.85)*(ring*0.9+ring2*0.6+core*0.9);
    // a light sweep, scanlines, sparkle
    c2+=pc*exp(-pow((fract(v/max(h,1.0)*0.5-t*0.22)-0.5)*7.0,2.0))*0.35;
    c2*=0.84+0.16*sin(gl_FragCoord.y*1.7);
    c2+=vec3(1.0,0.7,0.9)*step(0.985,hsh(floor(q*24.0)+floor(t*7.0)))*0.5;
    // weakened grid: blocks drop out and flicker
    float hp=uPanel.z;c2*=1.0-step(hsh(floor(q)+floor(t*9.0)),(1.0-hp)*0.45)*0.75;
    // frame and corner brackets
    float cb=(1.0-smoothstep(0.0,0.07,e))*step(min(u,w-u),0.35)*step(min(v,h-v),0.35);
    c2+=pc*edge*1.1+vec3(1.0,0.8,0.95)*cb*1.2;
    c2=mix(c2,c2*vec3(1.3,0.6,1.4),gl*0.5);
    col=c2;
    if(uPanel.x>0.0){ // offline: TV static with a rolling bar
      float n=hsh(floor(gl_FragCoord.xy*0.5)+vec2(floor(t*24.0)*7.0,floor(t*24.0)*13.0));
      float roll=smoothstep(0.0,0.1,abs(fract(v*0.3-t*0.5)-0.5));
      vec3 st=vec3(n)*vec3(0.72,0.68,0.8)*(0.3+0.7*roll)*0.7+vec3(0.35,0.03,0.18)*0.15+vec3(0.6,0.15,0.35)*edge*0.3;
      col=mix(c2,st,uPanel.x);
      // the countdown, two big digital-clock digits across the panel, upright and reading left to right
      vec2 pp=vec2(u-w*0.5,v-h*0.5);if(vCol.r>0.5)pp=pp.yx;if(vCol.g>0.5)pp.x=-pp.x;
      float hh=min(w,h)*0.3,cs=floor(max(uCount,0.0)+0.999);
      float d1=floor(cs/10.0),d0=cs-d1*10.0;
      float lv=max(digit7(pp-vec2(-hh*0.68,0.0),d1,hh),digit7(pp-vec2(hh*0.68,0.0),d0,hh));
      vec3 led=uCount<5.5?vec3(1.0,0.2,0.45):vec3(1.0,0.32,0.7);
      float bg=1.0-smoothstep(0.0,hh*0.25,max(abs(pp.x)-hh*1.55,abs(pp.y)-hh*1.3));
      col=mix(col,col*0.25,bg*0.8*uPanel.x);col+=led*lv*1.6*uPanel.x;
    }
    // switched off: dark glass with the block seams and a faint magenta frame
    vec3 offc=vec3(0.03,0.028,0.045)*(0.7+0.6*hemi+0.4*dif)+vec3(0.12,0.1,0.16)*sm*1.5+vec3(0.5,0.1,0.35)*edge*0.12;
    bool live=vEm<1.5;
    if(vCol.b>0.5){ // just switched: block by block, like old TV sets
      float dly=hsh(floor(vec2(u,v))+vec2(3.1,7.7))*0.9,k=clamp((uSwitch-0.35-dly)/0.45,0.0,1.0);
      col=tvBlock(fract(vec2(u,v))-0.5,live?k:1.0-k,col,offc);
    }else if(!live)col=offc;
  }
  if(vEm>4.5&&vEm<5.5){ // neon strip / lamp / LED
    col=vCol*1.6;
  }
  if(vEm>6.5&&vEm<7.5){ // blinking LED
    float bl=step(0.45,fract(uTime*1.3+dot(vW,vec3(0.031,0.017,0.023))));col=mix(vCol*0.25,vCol*1.8,bl);
  }
  {float ld=length(vW-uLP.xyz),la=clamp(1.0-ld/uLP.w,0.0,1.0);col+=base*uLC*la*la*1.1+uLC*la*la*la*0.1;}
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
  const li=FR.light;if(li){gl.uniform4f(L.uLP,li.p.x,li.p.y,li.p.z,li.r);gl.uniform3f(L.uLC,li.c[0],li.c[1],li.c[2]);}else{gl.uniform4f(L.uLP,0,-1e5,0,1);gl.uniform3f(L.uLC,0,0,0);}
}
function drawLevelMesh(){
  if(!R.levelN)return;const gl=R.gl,L=R.main.loc;
  bindMain(R.level);gl.uniformMatrix4fv(L.uModel,false,M4.ident());gl.uniform1f(L.uUseTint,0);
  if(L.uPanel){const W2=world,off=W2.panelOff>0?(W2.panelOff>PANEL_OFF-.8?(Math.random()<.5?1:.35):Math.min(1,W2.panelOff/.5)):0;gl.uniform3f(L.uPanel,off,W2.panelGlitch||0,W2.panelHP===undefined?1:W2.panelHP/PANEL_HP);if(L.uCount)gl.uniform1f(L.uCount,W2.panelOff||0);if(L.uSwitch)gl.uniform1f(L.uSwitch,W2.time-(W2.panelSwitchT===undefined?-99:W2.panelSwitchT));}
  gl.uniform1f(L.uEdge,.05);gl.uniform3f(L.uEdgeCol,.16,.85,1.0);
  gl.drawArrays(gl.TRIANGLES,0,R.levelN);
  if(R.decoN){bindMain(R.deco);gl.uniform1f(L.uEdge,.012);gl.drawArrays(gl.TRIANGLES,0,R.decoN);}
}
// solid cube with model matrix
let _cubeBound=false;
let WXF=null; // optional extra model transform (pickups are drawn scaled up)
const scaleAbout=(c,s)=>M4.basis(V(c.x*(1-s),c.y*(1-s),c.z*(1-s)),V(s,0,0),V(0,s,0),V(0,0,s));
function cubeBegin(){bindMain(R.cube);_cubeBound=true;const gl=R.gl,L=R.main.loc;gl.uniform1f(L.uUseTint,1);gl.uniform1f(L.uEdge,.06);}
function drawCubeM(m,col,em,edgeCol,alpha){
  const gl=R.gl,L=R.main.loc;if(WXF)m=M4.mul(WXF,m);
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
