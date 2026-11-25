// =====================================================================
//  HARD-EDGED EFFECTS — the explosions' sharp parts: spiky star flashes, a jagged fireball that shrinks fast,
//  shockwave rings, and sparks drawn as streaks along their flight. Flat colours, crisp edges (no soft blobs).
// =====================================================================
let hardFX=[];
function addHard(o){hardFX.push(o);if(hardFX.length>600)hardFX.splice(0,hardFX.length-600);}
function updateHardFX(dt){
  for(const f of hardFX){f.t+=dt;
    if(f.type==='streak'){const dr=Math.exp(-f.drag*dt);f.v=vscale(f.v,dr);f.v.y-=f.g*dt;f.p=vadd(f.p,vscale(f.v,dt));
      if(solid(tileAt(f.p.x,f.p.y,f.p.z)))f.t=f.life;}}
  hardFX=hardFX.filter(f=>f.t<f.life);
}
// the sharp parts of an explosion at vc (n: the surface it went off against)
function hardBlast(vc,n,RAD,barrel){
  const sph=k=>{const a=rnd()*Math.PI*2,b=Math.asin(rnd()*2-1);return V(Math.cos(a)*Math.cos(b)*k,Math.sin(b)*k,Math.sin(a)*Math.cos(b)*k);};
  const spikes=n=>Array.from({length:n},()=>.45+rnd()*.55);
  addHard({type:'star',p:vc,t:0,life:.11,size:RAD*1.35,rot:rnd()*6,sp:spikes(14),c0:[1,1,.92,1],c1:[1,.62,.18,0]});
  addHard({type:'star',p:vc,t:-.03,life:.2,size:RAD*.95,rot:rnd()*6,sp:spikes(9),c0:[1,.85,.4,1],c1:[1,.3,.05,0]});
  addHard({type:'disk',p:vc,t:0,life:.32,size:RAD*.62,jag:Array.from({length:11},()=>.8+rnd()*.35),c0:barrel?[1,.75,.3,1]:[1,.9,.55,1],c1:[1,.38,.06,.9]});
  addHard({type:'ring',p:vc,t:0,life:.3,size:RAD*1.9,w:5,c0:[1,.92,.75,.95]});
  addHard({type:'ring',p:vc,t:.0,life:.42,size:RAD*2.4,w:3,c0:[1,.6,.25,.7],plane:n});
  for(let i=0;i<46;i++){const v=vadd(sph(650+rnd()*950),vscale(n,320));
    addHard({type:'streak',p:vc,v,t:0,life:.22+rnd()*.28,drag:2.6,g:500,len:.045,w:1.1+rnd()*1.3,c0:rnd()<.5?[1,.95,.7,1]:[1,.62,.2,1]});}
}
// ---- drawing: camera-facing triangles, one flat-colour program ----
const HVS=`attribute vec3 aPos;attribute vec4 aCol;uniform mat4 uVP;uniform mat4 uWorldFix;varying vec4 vCol;
void main(){vCol=aCol;gl_Position=uVP*(uWorldFix*vec4(aPos,1.0));}`;
const HFS=`precision mediump float;varying vec4 vCol;void main(){gl_FragColor=vCol;}`;
let HR=null;
function drawHardFX(){
  if(!hardFX.length||!R.ok)return;const gl=R.gl;
  if(!HR){const p=gl.createProgram();for(const [t,src] of [[gl.VERTEX_SHADER,HVS],[gl.FRAGMENT_SHADER,HFS]]){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);gl.attachShader(p,s);}
    gl.linkProgram(p);HR={p,buf:gl.createBuffer(),aPos:gl.getAttribLocation(p,'aPos'),aCol:gl.getAttribLocation(p,'aCol'),uVP:gl.getUniformLocation(p,'uVP'),uWorldFix:gl.getUniformLocation(p,'uWorldFix')};}
  const fw=cam.fwd;let rt=vcross(fw,V(0,1,0));rt=vlen(rt)<1e-3?V(1,0,0):vnorm(rt);const up=vcross(rt,fw);
  const out=[],P=(p,c)=>out.push(p.x,p.y,p.z,c[0],c[1],c[2],c[3]);
  const tri=(a,b,c,ca,cb,cc)=>{P(a,ca);P(b,cb);P(c,cc);};
  const at=(o,ax,ay,x,y)=>vadd(o,vadd(vscale(ax,x),vscale(ay,y)));
  const mixc=(a,b,k)=>a.map((x,i)=>x+(b[i]-x)*k);
  for(const f of hardFX){if(f.t<0)continue;const k=clamp(f.t/f.life,0,1);
    if(f.type==='star'){const s=f.size*(.7+k*.5),n=f.sp.length,fade=1-k,c0=f.c0.map((x,i)=>i===3?x*fade:x),c1=f.c1;
      for(let i=0;i<n;i++){const a0=f.rot+i/n*Math.PI*2,a1=f.rot+(i+.5)/n*Math.PI*2,a2=f.rot+(i+1)/n*Math.PI*2,ri=s*.16;
        const tip=at(f.p,rt,up,Math.cos(a1)*s*f.sp[i],Math.sin(a1)*s*f.sp[i]);
        tri(f.p,at(f.p,rt,up,Math.cos(a0)*ri,Math.sin(a0)*ri),tip,c0,c0,c1);tri(f.p,tip,at(f.p,rt,up,Math.cos(a2)*ri,Math.sin(a2)*ri),c0,c1,c0);}}
    else if(f.type==='disk'){const s=f.size*(1-k*.7),n=f.jag.length,c0=f.c0.map((x,i)=>i===3?x*(1-k*k):x),c1=f.c1.map((x,i)=>i===3?x*(1-k):x);
      for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2;
        tri(f.p,at(f.p,rt,up,Math.cos(a0)*s*f.jag[i],Math.sin(a0)*s*f.jag[i]),at(f.p,rt,up,Math.cos(a1)*s*f.jag[(i+1)%n],Math.sin(a1)*s*f.jag[(i+1)%n]),c0,c1,c1);}}
    else if(f.type==='ring'){const e=1-Math.pow(1-k,3),r=f.size*e,w=f.w*(1-k)+.6,c=f.c0.map((x,i)=>i===3?x*(1-k):x);
      let ax=rt,ay=up;if(f.plane){ax=vcross(f.plane,Math.abs(f.plane.y)<.9?V(0,1,0):V(1,0,0));ax=vnorm(ax);ay=vcross(f.plane,ax);}
      const n=28;for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2;
        const p0=at(f.p,ax,ay,Math.cos(a0)*r,Math.sin(a0)*r),p1=at(f.p,ax,ay,Math.cos(a1)*r,Math.sin(a1)*r),q0=at(f.p,ax,ay,Math.cos(a0)*(r+w),Math.sin(a0)*(r+w)),q1=at(f.p,ax,ay,Math.cos(a1)*(r+w),Math.sin(a1)*(r+w));
        tri(p0,q0,q1,c,c,c);tri(p0,q1,p1,c,c,c);}}
    else if(f.type==='streak'){const sp=vlen(f.v);if(sp<5)continue;const d=vscale(f.v,1/sp),tail=vsub(f.p,vscale(f.v,f.len));
      let side=vcross(d,vsub(f.p,cam.pos));side=vlen(side)<1e-3?rt:vscale(vnorm(side),f.w);
      const c=f.c0.map((x,i)=>i===3?x*(1-k):x),ct=mixc(c,[1,.35,.05,0],1);
      tri(vadd(f.p,side),vsub(f.p,side),tail,c,c,ct);}
  }
  if(!out.length)return;
  gl.useProgram(HR.p);for(let a=0;a<8;a++)gl.disableVertexAttribArray(a);
  gl.bindBuffer(gl.ARRAY_BUFFER,HR.buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(HR.aPos);gl.vertexAttribPointer(HR.aPos,3,gl.FLOAT,false,28,0);
  gl.enableVertexAttribArray(HR.aCol);gl.vertexAttribPointer(HR.aCol,4,gl.FLOAT,false,28,12);
  gl.uniformMatrix4fv(HR.uVP,false,FR.vp);gl.uniformMatrix4fv(HR.uWorldFix,false,FR.fix);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);gl.disable(gl.CULL_FACE);
  gl.drawArrays(gl.TRIANGLES,0,out.length/7);
  gl.depthMask(true);gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(HR.aPos);gl.disableVertexAttribArray(HR.aCol);
}
