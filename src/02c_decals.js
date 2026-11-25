// =====================================================================
//  DECALS — stencilled sector codes, Japanese / Korean signage, graffiti, dirt, paint splatter, drips
//  One texture sheet drawn at start-up (white shapes on transparent, tinted per decal), quads laid flat on exposed faces
//  of concrete / steel / shell blocks a hair in front of the surface. Like the pipes (src/02b_deco.js) they are placed
//  from the level's seed and turned with the arena.
// =====================================================================
let decals=[]; // {kind, c:V centre, n:V normal, u:V right, v:V up, w, h (world units), r:[x,y,w,h] sheet rect 0..1, col:[r,g,b,a], em}
const DSHEET=2048,DCELL=256,DGRID=8;
// the designs: sheet cell (x,y,w,h in 256 px cells of an 8x8 sheet)
const KR_NUM=['일','이','삼','사','오','육','칠','팔','구','십'];
const AR_NUM2=['07','13','24','36','42','51','09','88'],AR_NUM1=['3','5','8','1'];
const DECAL_KINDS={};
KR_NUM.forEach((g,i)=>DECAL_KINDS['kr'+i]={cell:i<8?[i,0,1,1]:[i-8,1,1,1],type:'kr',txt:g});
AR_NUM2.forEach((t,i)=>DECAL_KINDS['n'+t]={cell:i<3?[2+i*2,1,2,1]:i<7?[(i-3)*2,2,2,1]:[4,3,2,1],type:'num2',txt:t});
AR_NUM1.forEach((t,i)=>DECAL_KINDS['d'+t]={cell:[i,3,1,1],type:'num1',txt:t});
DECAL_KINDS.stain0={cell:[0,4,4,4],type:'stain'};DECAL_KINDS.stain1={cell:[4,4,4,4],type:'stain'};
// ---- the sheet ----
function drawDecalSheet(){
  const cv=document.createElement('canvas');cv.width=cv.height=DSHEET;const c=cv.getContext('2d');
  const R2=mulberry32(90210);
  const cell=(k,fn)=>{const [x,y,w,h]=DECAL_KINDS[k].cell;c.save();c.translate(x*DCELL,y*DCELL);c.beginPath();c.rect(0,0,w*DCELL,h*DCELL);c.clip();fn(w*DCELL,h*DCELL);c.restore();};
  // wear: knock specks and scratches out of whatever was just drawn
  const wear=(W,H,n,big)=>{c.save();c.globalCompositeOperation='destination-out';
    for(let i=0;i<n;i++){c.globalAlpha=.3+R2()*.7;c.beginPath();c.arc(R2()*W,R2()*H,R2()*(big||3)+.5,0,7);c.fill();}
    c.lineWidth=1.4;for(let i=0;i<n/10;i++){c.globalAlpha=.6;c.beginPath();const x=R2()*W,y=R2()*H;c.moveTo(x,y);c.lineTo(x+(R2()-.5)*70,y+(R2()-.5)*16);c.stroke();}
    c.restore();};
  const CJK="'Malgun Gothic','Noto Sans CJK KR','Noto Sans KR','Apple SD Gothic Neo','Noto Sans CJK TC',sans-serif";
  const text=(txt,W,H,font,stencil)=>{c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.font=font;
    const s=Math.min(1,(W*.9)/c.measureText(txt).width);c.save();c.translate(W/2,H/2+H*.03);c.scale(s,1);c.fillText(txt,0,0);c.restore();
    if(stencil){c.save();c.globalCompositeOperation='destination-out';const n=Math.round(W/H*2);for(let i=1;i<n;i++)c.fillRect(W*i/n-3,H*.08,6,H*.84);c.restore();}
    wear(W,H,Math.round(W*H/180),2.6);};
  for(const [k,K] of Object.entries(DECAL_KINDS)){
    if(K.type==='kr')cell(k,(W,H)=>text(K.txt,W,H,`900 ${H*.86}px ${CJK}`));
    else if(K.type==='num2'||K.type==='num1')cell(k,(W,H)=>text(K.txt,W,H,`900 ${H*.9}px Impact,'Arial Black','Franklin Gothic Heavy',sans-serif`,true));
  }
  // stains: big soft irregular blotches with mottled insides
  for(const k of ['stain0','stain1'])cell(k,(W,H)=>{
    for(let i=0;i<70;i++){const a=R2()*7,d=Math.pow(R2(),1.4)*W*.3,x=W/2+Math.cos(a)*d,y=H/2+Math.sin(a)*d*.85,r=W*(.06+R2()*.16);
      const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.34)');g.addColorStop(.7,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,7);c.fill();}
    c.save();c.globalCompositeOperation='destination-out';
    for(let i=0;i<120;i++){const x=R2()*W,y=R2()*H,r=W*(.01+R2()*.04),g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,7);c.fill();}
    c.restore();
    // a fade to nothing at the cell edge so no square ever shows
    c.save();c.globalCompositeOperation='destination-in';const g=c.createRadialGradient(W/2,H/2,W*.25,W/2,H/2,W*.5);g.addColorStop(0,'#000');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,W,H);c.restore();
  });
  return cv;
}
// ---- placement (seeded by the level): big stains first, then the numbers over them ----
function genDecals(){
  decals=[];
  const Rn=rnd,NS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const ok=(t)=>t===1||t===3||t===6;
  const exposed=(i,j,k,n)=>ok(tile(i,j,k))&&!solid(tile(i+n[0],j+n[1],k+n[2]));
  const faces=[];for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){if(!ok(tile(i,j,k)))continue;for(const n of NS)if(!solid(tile(i+n[0],j+n[1],k+n[2])))faces.push([i,j,k,n]);}
  if(!faces.length)return;
  const KR=Object.keys(DECAL_KINDS).filter(k=>DECAL_KINDS[k].type==='kr'),N2=Object.keys(DECAL_KINDS).filter(k=>DECAL_KINDS[k].type==='num2'),N1=Object.keys(DECAL_KINDS).filter(k=>DECAL_KINDS[k].type==='num1');
  const place=(kind,tilesMin,tilesMax,want,allowFloor)=>{
    const K=DECAL_KINDS[kind],[cx,cy,cw,ch]=K.cell;
    for(let tries=0;tries<40;tries++){
      const [i,j,k,n]=faces[Rn()*faces.length|0],wall=n[1]===0;if(!wall&&!allowFloor)continue;
      const N3=V(n[0],n[1],n[2]);let up,rt;
      if(wall){up=V(0,1,0);rt=V(n[2],0,-n[0]);}
      else{const a=(Rn()*4|0)*Math.PI/2;up=V(Math.round(Math.sin(a)),0,Math.round(Math.cos(a)));rt=V(-up.z*n[1],0,up.x*n[1]);}
      let w=(tilesMin+Rn()*(tilesMax-tilesMin))*T,h=w*ch/cw;
      const fc=V((i+.5+n[0]*.5)*T,(j+.5+n[1]*.5)*T,(k+.5+n[2]*.5)*T);
      const c=vadd(vadd(fc,vscale(rt,(Rn()-.5)*T)),vscale(up,(Rn()-.5)*T));
      const stain=K.type==='stain',lim=stain?.62:.98; // a stain fades out well inside its square, so only its middle must lie on the surface
      const fits=()=>{for(let a=-.5;a<=.5;a+=.125)for(let b=-.5;b<=.5;b+=.125){
        const p=vadd(vadd(c,vscale(rt,a*w*lim)),vscale(up,b*h*lim)),q=vsub(p,vscale(N3,T*.5));
        if(!exposed(Math.floor(q.x/T),Math.floor(q.y/T),Math.floor(q.z/T),n))return false;}return true;};
      let fine=fits();for(let s=0;s<6&&!fine&&w>tilesMin*T*.45;s++){w*=.8;h*=.8;fine=fits();}
      if(!fine)continue;
      if(decals.some(d=>{const sd=d.kind.startsWith('stain');if(sd!==stain)return false;const dd=vlen(vsub(d.c,c));
        return dd<(Math.max(d.w,d.h)+Math.max(w,h))*(stain?.3:.5)||(!stain&&d.kind===kind&&dd<T*10);}))continue;
      let col;if(stain){col=[0,0,0,.42+Rn()*.2];}else{const g=.78+Rn()*.22;col=[g,g,g*.98,.32+Rn()*.3];}
      const mirror=stain&&Rn()<.5;
      decals.push({kind,c:vadd(c,vscale(N3,.35+decals.length*.004)),n:N3,u:rt,v:up,w,h,r:[cx/DGRID,cy/DGRID,cw/DGRID,ch/DGRID],col,em:0,mirror});
      return true;
    }
    return false;
  };
  for(let q=0;q<30;q++)place(Rn()<.5?'stain0':'stain1',3.5,9,q,true);
  for(let q=0;q<46;q++){const r=Rn();
    if(r<.5)place(KR[Rn()*KR.length|0],2.5,6,q,true);
    else if(r<.85)place(N2[Rn()*N2.length|0],4,9,q,true);
    else place(N1[Rn()*N1.length|0],2.5,6,q,true);}
}
function rotateDecals(key){
  const r=ROT[key],tv=v=>{const q=r.vec(v.x,v.y,v.z);return V(q[0],q[1],q[2]);};
  for(const d of decals){const q=r.pt(d.c.x,d.c.y,d.c.z);d.c=V(q[0],q[1],q[2]);d.n=tv(d.n);d.u=tv(d.u);d.v=tv(d.v);}
}
// ---- drawing ----
const DVS=`attribute vec3 aPos;attribute vec2 aUV;attribute vec4 aCol;attribute float aEm;
uniform mat4 uVP;uniform mat4 uWorldFix;varying vec2 vUV;varying vec4 vCol;varying float vEm;varying float vD;varying vec3 vW;
void main(){vec4 w=uWorldFix*vec4(aPos,1.0);vW=aPos;vUV=aUV;vCol=aCol;vEm=aEm;gl_Position=uVP*w;vD=gl_Position.w;}`;
const DFS=`precision mediump float;varying vec2 vUV;varying vec4 vCol;varying float vEm;varying float vD;varying vec3 vW;
uniform sampler2D uTex;uniform vec3 uFog;uniform float uFogD;uniform vec4 uLP;uniform vec3 uLC;
void main(){vec4 t=texture2D(uTex,vUV);float a=t.a*vCol.a;if(a<0.01)discard;
  vec3 col=vCol.rgb*(0.62+vEm*0.9);
  {float ld=length(vW-uLP.xyz),la=clamp(1.0-ld/uLP.w,0.0,1.0);col+=vCol.rgb*uLC*la*la*0.8;}
  float f=exp(-pow(vD*uFogD,2.0));gl_FragColor=vec4(mix(uFog,col,f),a);}`;
let DR=null; // decal program, texture, buffer
function decalInit(){
  if(DR||!R.ok)return;const gl=R.gl;
  const p=gl.createProgram();
  for(const [t,src] of [[gl.VERTEX_SHADER,DVS],[gl.FRAGMENT_SHADER,DFS]]){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn(gl.getShaderInfoLog(s));return;}gl.attachShader(p,s);}
  gl.linkProgram(p);const loc={};for(const a of ['aPos','aUV','aCol','aEm'])loc[a]=gl.getAttribLocation(p,a);
  for(const u of ['uVP','uWorldFix','uTex','uFog','uFogD','uLP','uLC'])loc[u]=gl.getUniformLocation(p,u);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,drawDecalSheet());
  gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  DR={p,loc,tex,buf:gl.createBuffer(),n:0};
}
function buildDecalMesh(){
  if(!R.ok||typeof document==='undefined')return;decalInit();if(!DR)return;
  const out=[],gl=R.gl;
  for(const d of decals){
    const hu=vscale(d.u,d.w/2),hv=vscale(d.v,d.h/2),[rx,ry,rw,rh]=d.r,pad=.004;
    const P=(a,b)=>{const p=vadd(vadd(d.c,vscale(hu,a)),vscale(hv,b));const uu=d.mirror?-a:a;
      out.push(p.x,p.y,p.z,rx+pad+(uu*.5+.5)*(rw-2*pad),ry+pad+(.5-b*.5)*(rh-2*pad),d.col[0],d.col[1],d.col[2],d.col[3],d.em);};
    P(-1,-1);P(1,-1);P(1,1);P(-1,-1);P(1,1);P(-1,1);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER,DR.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.STATIC_DRAW);DR.n=out.length/10;
}
function drawDecals(){
  if(!DR||!DR.n)return;const gl=R.gl,L=DR.loc;
  gl.useProgram(DR.p);for(let a=0;a<8;a++)gl.disableVertexAttribArray(a);
  gl.bindBuffer(gl.ARRAY_BUFFER,DR.buf);
  gl.enableVertexAttribArray(L.aPos);gl.vertexAttribPointer(L.aPos,3,gl.FLOAT,false,40,0);
  gl.enableVertexAttribArray(L.aUV);gl.vertexAttribPointer(L.aUV,2,gl.FLOAT,false,40,12);
  gl.enableVertexAttribArray(L.aCol);gl.vertexAttribPointer(L.aCol,4,gl.FLOAT,false,40,20);
  gl.enableVertexAttribArray(L.aEm);gl.vertexAttribPointer(L.aEm,1,gl.FLOAT,false,40,36);
  gl.uniformMatrix4fv(L.uVP,false,FR.vp);gl.uniformMatrix4fv(L.uWorldFix,false,FR.fix);
  gl.uniform3f(L.uFog,.05,.03,.1);gl.uniform1f(L.uFogD,1/1500);
  const li=FR.light;if(li){gl.uniform4f(L.uLP,li.p.x,li.p.y,li.p.z,li.r);gl.uniform3f(L.uLC,li.c[0],li.c[1],li.c[2]);}else{gl.uniform4f(L.uLP,0,-1e5,0,1);gl.uniform3f(L.uLC,0,0,0);}
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,DR.tex);gl.uniform1i(L.uTex,0);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-2);
  gl.drawArrays(gl.TRIANGLES,0,DR.n);
  gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthMask(true);gl.disable(gl.BLEND);
  for(const a of [L.aPos,L.aUV,L.aCol,L.aEm])gl.disableVertexAttribArray(a);
  R.lastProg=null;
}
