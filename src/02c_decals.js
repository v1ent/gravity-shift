// =====================================================================
//  DECALS — stencilled sector codes, Japanese / Korean signage, graffiti, dirt, paint splatter, drips
//  One texture sheet drawn at start-up (white shapes on transparent, tinted per decal), quads laid flat on exposed faces
//  of concrete / steel / shell blocks a hair in front of the surface. Like the pipes (src/02b_deco.js) they are placed
//  from the level's seed and turned with the arena.
// =====================================================================
let decals=[]; // {c:V centre, n:V normal, u:V right, v:V up, w, h (world units), r:[x,y,w,h] sheet rect 0..1, col:[r,g,b,a], em}
const DSHEET=1024,DCELL=256;
// the designs: sheet cell (x,y,w,h in 256 px cells), what it is, where it may go
const DECAL_KINDS={
  stencilA:{cell:[0,0,2,1],type:'text',wall:true},       // big stencilled sector code
  stencilB:{cell:[2,0,2,1],type:'text',wall:true},
  jpNoEntry:{cell:[0,1,2,1],type:'text',wall:true},      // 立入禁止 — no entry
  krDanger:{cell:[2,1,2,1],type:'text',wall:true},       // 위험 구역 — danger zone
  jpSeven:{cell:[0,2,1,1],type:'glyph',wall:true},       // 七 — seven
  krThree:{cell:[1,2,1,1],type:'glyph',wall:true},       // 삼 — three
  jpFour:{cell:[2,2,1,1],type:'glyph',wall:true},        // 第四 — the fourth
  fox:{cell:[3,2,1,1],type:'graffiti',wall:true},        // a spray-painted fox mask
  dirt:{cell:[0,3,1,1],type:'dirt',wall:true,floor:true},
  splat:{cell:[1,3,1,1],type:'splat',wall:true,floor:true},
  chevron:{cell:[2,3,1,1],type:'chevron',wall:true,floor:true},
  drip:{cell:[3,3,1,1],type:'drip',wall:true},
};
// ---- the sheet ----
function drawDecalSheet(){
  const cv=document.createElement('canvas');cv.width=cv.height=DSHEET;const c=cv.getContext('2d');
  const R2=mulberry32(90210);
  const cell=(k,fn)=>{const [x,y,w,h]=DECAL_KINDS[k].cell;c.save();c.translate(x*DCELL,y*DCELL);c.beginPath();c.rect(0,0,w*DCELL,h*DCELL);c.clip();fn(w*DCELL,h*DCELL);c.restore();};
  // wear: knock specks and scratches out of whatever was just drawn
  const wear=(W,H,n,big)=>{c.save();c.globalCompositeOperation='destination-out';
    for(let i=0;i<n;i++){c.globalAlpha=.3+R2()*.7;c.beginPath();c.arc(R2()*W,R2()*H,R2()*(big||3)+.5,0,7);c.fill();}
    c.lineWidth=1.2;for(let i=0;i<n/12;i++){c.globalAlpha=.6;c.beginPath();const x=R2()*W,y=R2()*H;c.moveTo(x,y);c.lineTo(x+(R2()-.5)*60,y+(R2()-.5)*14);c.stroke();}
    c.restore();};
  const CJK="'Yu Gothic','Meiryo','MS Gothic','Malgun Gothic','Noto Sans CJK JP','Noto Sans CJK KR','Noto Sans CJK TC','Noto Sans CJK SC',sans-serif";
  const stencil=(txt,W,H)=>{c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';
    c.font=`900 ${H*.78}px Impact,'Arial Black','Franklin Gothic Heavy',sans-serif`;let s=Math.min(1,(W*.92)/c.measureText(txt).width);
    c.save();c.translate(W/2,H/2+H*.04);c.scale(s,1);c.fillText(txt,0,0);c.restore();
    // stencil bridges: thin gaps cut through the letters
    c.save();c.globalCompositeOperation='destination-out';c.fillStyle='#000';
    for(let i=1;i<8;i++){c.fillRect(W*i/8-2,H*.1,4,H*.8);}c.restore();
    wear(W,H,420,2.6);};
  cell('stencilA',(W,H)=>stencil('A-03',W,H));
  cell('stencilB',(W,H)=>stencil('B-17',W,H));
  const sign=(txt,W,H,frame)=>{c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';
    c.font=`900 ${H*.6}px ${CJK}`;const s=Math.min(1,(W*.86)/c.measureText(txt).width);
    c.save();c.translate(W/2,H/2);c.scale(s,1);c.fillText(txt,0,0);c.restore();
    if(frame){c.strokeStyle='#fff';c.lineWidth=10;c.strokeRect(14,14,W-28,H-28);}
    wear(W,H,300,2.2);};
  cell('jpNoEntry',(W,H)=>sign('立入禁止',W,H,true));
  cell('krDanger',(W,H)=>sign('위험 구역',W,H,true));
  // big brushed numerals: drawn several times with jitter so the edges look painted
  const brush=(txt,W,H,font)=>{c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.font=font;
    for(let i=0;i<6;i++){c.globalAlpha=.35;c.fillText(txt,W/2+(R2()-.5)*6,H/2+(R2()-.5)*6);}c.globalAlpha=1;c.fillText(txt,W/2,H/2);
    // paint runs from the bottom of the strokes
    for(let i=0;i<7;i++){const x=W*.25+R2()*W*.5,y=H*.62+R2()*H*.15,l=20+R2()*60;c.fillRect(x,y,3+R2()*3,l);c.beginPath();c.arc(x+2.5,y+l,3.5,0,7);c.fill();}
    wear(W,H,160,2);};
  cell('jpSeven',(W,H)=>brush('七',W,H,`900 ${H*.82}px ${CJK}`));
  cell('krThree',(W,H)=>brush('삼',W,H,`900 ${H*.78}px ${CJK}`));
  cell('jpFour',(W,H)=>brush('第四',W,H,`900 ${H*.5}px ${CJK}`));
  // the fox mask: sprayed outlines (soft wide stroke under a sharp one)
  cell('fox',(W,H)=>{c.lineCap='round';c.lineJoin='round';
    const path=()=>{c.beginPath();
      c.moveTo(W*.5,H*.86);c.lineTo(W*.2,H*.5);c.lineTo(W*.16,H*.12);c.lineTo(W*.38,H*.3);c.lineTo(W*.5,H*.26);c.lineTo(W*.62,H*.3);c.lineTo(W*.84,H*.12);c.lineTo(W*.8,H*.5);c.closePath();
      c.moveTo(W*.3,H*.48);c.lineTo(W*.44,H*.52);c.moveTo(W*.7,H*.48);c.lineTo(W*.56,H*.52); // eyes
      c.moveTo(W*.42,H*.72);c.lineTo(W*.5,H*.78);c.lineTo(W*.58,H*.72); // snout
      c.moveTo(W*.24,H*.2);c.lineTo(W*.3,H*.36);c.moveTo(W*.76,H*.2);c.lineTo(W*.7,H*.36);};
    c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=16;path();c.stroke();
    c.strokeStyle='#fff';c.lineWidth=6;path();c.stroke();
    for(let i=0;i<260;i++){c.globalAlpha=R2()*.6;c.fillStyle='#fff';c.fillRect(W*.5+(R2()-.5)*W*.8,H*.5+(R2()-.5)*H*.8,1.5,1.5);} // overspray
    c.globalAlpha=1;});
  // dirt: soft blotches with grain
  cell('dirt',(W,H)=>{for(let i=0;i<46;i++){const x=W*.5+(R2()-.5)*W*.55,y=H*.5+(R2()-.5)*H*.55,r=10+R2()*48;
      const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.34)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,7);c.fill();}
    c.fillStyle='#fff';for(let i=0;i<900;i++){const a=R2()*7,d=Math.pow(R2(),.7)*W*.42;c.globalAlpha=R2()*.35;c.fillRect(W/2+Math.cos(a)*d,H/2+Math.sin(a)*d,1.5,1.5);}c.globalAlpha=1;});
  // paint splatter: a splash, flung droplets
  cell('splat',(W,H)=>{c.fillStyle='#fff';c.beginPath();
    for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,r=W*(.17+R2()*.09)+(i%5===0?W*.1*R2():0);i?c.lineTo(W/2+Math.cos(a)*r,H/2+Math.sin(a)*r):c.moveTo(W/2+r,H/2);}c.fill();
    for(let i=0;i<40;i++){const a=R2()*7,d=W*(.25+R2()*.22),r=1.5+R2()*6;c.beginPath();c.arc(W/2+Math.cos(a)*d,H/2+Math.sin(a)*d,r,0,7);c.fill();}});
  // chevrons, painted
  cell('chevron',(W,H)=>{c.fillStyle='#fff';for(let i=0;i<3;i++){const x=W*.12+i*W*.26;c.beginPath();c.moveTo(x,H*.22);c.lineTo(x+W*.16,H*.22);c.lineTo(x+W*.32,H*.5);c.lineTo(x+W*.16,H*.78);c.lineTo(x,H*.78);c.lineTo(x+W*.16,H*.5);c.fill();}wear(W,H,200,2.5);});
  // rust / grime streaks running down from a line
  cell('drip',(W,H)=>{for(let i=0;i<22;i++){const x=W*.1+R2()*W*.8,l=H*(.25+R2()*.7),w=2+R2()*7,g=c.createLinearGradient(0,0,0,l);
      g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(x,0,w,l);}
    c.fillStyle='rgba(255,255,255,.55)';c.fillRect(0,0,W,7);});
  return cv;
}
// ---- placement (seeded by the level) ----
const DECAL_TINT={
  text:[[.92,.92,.9,.55],[1,.82,.2,.6],[1,.25,.65,.6],[.25,.95,1,.5],[.85,.86,.9,.35]],
  glyph:[[1,.24,.6,.85],[.25,.95,1,.8],[.95,.95,.95,.6],[1,.8,.2,.75]],
  graffiti:[[1,.25,.65,.9],[.25,.95,1,.85]],
  dirt:[[0,0,0,1],[.03,.02,.01,.95]],
  splat:[[1,.24,.6,.75],[.25,.95,1,.7],[1,.8,.2,.7],[.9,.9,.9,.55]],
  chevron:[[1,.8,.2,.7],[1,.25,.65,.65]],
  drip:[[.35,.16,.06,.6],[.03,.02,.02,.65]],
};
const DECAL_MIX=[['dirt',16],['drip',8],['splat',7],['chevron',5],['stencilA',5],['stencilB',5],['jpNoEntry',6],['krDanger',6],['jpSeven',4],['krThree',4],['jpFour',4],['fox',4]];
function genDecals(){
  decals=[];
  const Rn=rnd,NS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],tot=DECAL_MIX.reduce((a,m)=>a+m[1],0);
  const ok=(t)=>t===1||t===3||t===6;
  const exposed=(i,j,k,n)=>ok(tile(i,j,k))&&!solid(tile(i+n[0],j+n[1],k+n[2]));
  // every exposed face of paintable blocks, so picks don't waste time on air or buried blocks
  const faces=[];for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){if(!ok(tile(i,j,k)))continue;for(const n of NS)if(!solid(tile(i+n[0],j+n[1],k+n[2])))faces.push([i,j,k,n]);}
  if(!faces.length)return;
  for(let tries=0;tries<3000&&decals.length<95;tries++){
    let r=Rn()*tot,kind='dirt';for(const [k,wt] of DECAL_MIX)if((r-=wt)<0){kind=k;break;}
    const K=DECAL_KINDS[kind],[i,j,k,n]=faces[Rn()*faces.length|0];
    const wall=n[1]===0;if(wall?!K.wall:!K.floor)continue;
    // the face's axes: on walls "up" is up; on floors and ceilings pick a heading
    const N3=V(n[0],n[1],n[2]);let up,rt;
    if(wall){up=V(0,1,0);rt=V(n[2],0,-n[0]);} // the right-hand direction for someone facing the wall
    else{const a=(Rn()*4|0)*Math.PI/2;up=V(Math.round(Math.sin(a)),0,Math.round(Math.cos(a)));rt=V(up.z*n[1],0,-up.x*n[1]);}
    // size in tiles
    const [cw,ch]=[K.cell[2],K.cell[3]];
    const big=K.type==='text'?(kind.startsWith('stencil')?2.2+Rn()*2.4:1.6+Rn()*1.4):K.type==='glyph'||K.type==='graffiti'?1.3+Rn()*1.5:1+Rn()*2;
    let w=big*T*(cw/Math.max(cw,ch))*(cw>ch?1.6:1),h=w*ch/cw;
    // centre on the face, nudged off-grid; the whole footprint must be exposed wall of the same plane
    const fc=V((i+.5+n[0]*.5)*T,(j+.5+n[1]*.5)*T,(k+.5+n[2]*.5)*T);
    const c=vadd(vadd(fc,vscale(rt,(Rn()-.5)*T)),vscale(up,(Rn()-.5)*T*(wall?.6:1)));
    const fits=()=>{for(let a=-.5;a<=.5;a+=.25)for(let b=-.5;b<=.5;b+=.25){
      const p=vadd(vadd(c,vscale(rt,a*w*.98)),vscale(up,b*h*.98)),q=vsub(p,vscale(N3,T*.5));
      if(!exposed(Math.floor(q.x/T),Math.floor(q.y/T),Math.floor(q.z/T),n))return false;}return true;};
    let fine=fits();for(let s=0;s<3&&!fine&&w>T*.9;s++){w*=.75;h*=.75;fine=fits();} // too big for this wall: try smaller
    if(!fine)continue;
    if(decals.some(d=>{const dd=vlen(vsub(d.c,c));return dd<(Math.max(d.w,d.h)+Math.max(w,h))*.5||(d.kind===kind&&dd<T*9);}))continue; // no overlaps; the same design not repeated close by
    const tints=DECAL_TINT[K.type],col=tints[Rn()*tints.length|0].slice();col[3]*=.8+Rn()*.25;
    const [cx,cy,cww,chh]=K.cell;
    decals.push({kind,c:vadd(c,vscale(N3,.35+decals.length*.004)),n:N3,u:rt,v:up,w,h,r:[cx/4,cy/4,cww/4,chh/4],col,em:(K.type==='glyph'||K.type==='graffiti')&&col[3]>.7?.5:0,mirror:K.type==='dirt'||K.type==='splat'?Rn()<.5:false});
  }
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
