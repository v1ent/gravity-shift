// =====================================================================
//  HARD-EDGED EFFECTS — the explosions' sharp parts: spiky star flashes, a jagged fireball that shrinks fast,
//  shockwave rings, and sparks drawn as streaks along their flight. Flat colours, crisp edges (no soft blobs).
// =====================================================================
let hardFX=[];
function addHard(o){hardFX.push(o);if(hardFX.length>600)hardFX.splice(0,hardFX.length-600);}
function updateHardFX(dt){
  for(const f of hardFX){f.t+=dt;
    if((f.type==='cube'||f.type==='cel')&&f.v){const dr=Math.exp(-(f.drag||0)*dt);f.v=vscale(f.v,dr);f.v.y-=(f.g||0)*dt;
      const np=vadd(f.p,vscale(f.v,dt));if(solid(tileAt(np.x,np.y,np.z)))f.v=V(0,0,0);else f.p=np;if(f.spin)f.ang+=f.spin*dt;}
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
const sphR=k=>{const a=rnd()*Math.PI*2,b=Math.asin(rnd()*2-1);return V(Math.cos(a)*Math.cos(b)*k,Math.sin(b)*k,Math.sin(a)*Math.cos(b)*k);};
// CLASSIC: the original soft fireball, puffs, sparks, embers, billowing smoke and a dust ring
function boomClassic(vc,n,c,RAD,barrel,free,sph){
  parts.push({x:vc.x,y:vc.y,z:vc.z,vx:0,vy:0,vz:0,life:.12,max:.12,col:[1,1,.9],size:RAD*1.1,type:'glow'});
  parts.push({x:vc.x,y:vc.y,z:vc.z,vx:0,vy:0,vz:0,life:.3,max:.3,col:[1,.7,.3],size:RAD*1.9,type:'glow'});
  parts.push({x:vc.x,y:vc.y,z:vc.z,vx:0,vy:0,vz:0,life:.55,max:.55,col:[.7,.2,.05],size:RAD*1.4,type:'glow'});
  addPart(vc.x,vc.y,vc.z,0,0,0,.45,[1,.55,.15],RAD/6,'ring');
  for(let i=0;i<18;i++){const v=sph(90+rnd()*220),p=free(vadd(vc,vscale(v,.08)));addPart(p.x,p.y,p.z,v.x+n.x*60,v.y+n.y*60+40,v.z+n.z*60,.35+rnd()*.35,rnd()<.4?[1,.85,.4]:rnd()<.5?[1,.5,.12]:[.9,.25,.05],20+rnd()*18,'flame');}
  for(let i=0;i<50;i++){const v=sph(140+rnd()*560);addPart(vc.x,vc.y,vc.z,v.x+n.x*120,v.y+n.y*120+100,v.z+n.z*120,.35+rnd()*.5,rnd()<.5?[1,.8,.2]:[1,.35,.1],3,'spark');}
  for(let i=0;i<24;i++){const v=sph(60+rnd()*260);addPart(vc.x,vc.y,vc.z,v.x+n.x*80,v.y+n.y*80+140,v.z+n.z*80,1.4+rnd()*1.6,rnd()<.5?[1,.6,.15]:[1,.35,.08],2.2+rnd()*1.5,'ember');}
  for(let i=0;i<30;i++){const p=free(vadd(vc,sph(10+rnd()*40)));const v=sph(40+rnd()*110);
    addPart(p.x,p.y,p.z,v.x+n.x*50,Math.abs(v.y)*.5+50+rnd()*70,v.z+n.z*50,1.6+rnd()*2.2,barrel?[.1,.08,.09]:[.2,.17,.22],18+rnd()*20,'smoke');}
  {const t1=vlen(vcross(n,V(0,1,0)))>.1?vnorm(vcross(n,V(0,1,0))):V(1,0,0),t2=vcross(n,t1);
   for(let i=0;i<26;i++){const a=i/26*Math.PI*2,d=vadd(vscale(t1,Math.cos(a)),vscale(t2,Math.sin(a))),sp=260+rnd()*160,p=vadd(c,vscale(n,4));
     addPart(p.x,p.y,p.z,d.x*sp,d.y*sp+20,d.z*sp,.6+rnd()*.4,[.5,.52,.6],10+rnd()*8,'dust');}}
}
// VOXEL: burning cubes thrown out, cooling white > yellow > orange > red > soot; then cube smoke and a ring of grit
function boomVoxel(vc,n,RAD,barrel){
  addHard({type:'disk',p:vc,t:0,life:.09,size:RAD*.75,jag:Array(10).fill(1),c0:[1,1,.9,1],c1:[1,.8,.4,.6]});
  for(let i=0;i<30;i++){const v=vadd(sphR(200+rnd()*520),vscale(n,180));
    addHard({type:'cube',fire:true,p:vadd(vc,sphR(RAD*.15)),v,t:0,life:.5+rnd()*.5,size:RAD*(.07+rnd()*.09),ax:vnorm(sphR(1)),ang:rnd()*6,spin:(rnd()-.5)*14,drag:2.2,g:260});}
  for(let i=0;i<14;i++){const v=vadd(sphR(40+rnd()*90),vadd(vscale(n,50),V(0,70,0)));
    addHard({type:'cube',alpha:true,smoke:true,p:vadd(vc,sphR(RAD*.2)),v,t:-.08-rnd()*.15,life:1.1+rnd()*.9,size:RAD*(.1+rnd()*.1),ax:vnorm(sphR(1)),ang:rnd()*6,spin:(rnd()-.5)*3,drag:1.4,g:-25,col:barrel?[.09,.08,.09]:[.16,.15,.19]});}
  {const t1=vlen(vcross(n,V(0,1,0)))>.1?vnorm(vcross(n,V(0,1,0))):V(1,0,0),t2=vcross(n,t1);
   for(let i=0;i<16;i++){const a=i/16*Math.PI*2,d=vadd(vscale(t1,Math.cos(a)),vscale(t2,Math.sin(a)));
     addHard({type:'cube',alpha:true,smoke:true,p:vadd(vc,vscale(n,-RAD*.1)),v:vscale(d,240+rnd()*120),t:0,life:.45+rnd()*.25,size:RAD*.05,ax:vnorm(sphR(1)),ang:0,spin:9,drag:4,g:0,col:[.4,.42,.5]});}}
}
// PLASMA: a neon energy burst — a white-hot core, an expanding wire sphere, electric arcs, cyan and magenta sparks
function boomPlasma(vc,n,RAD){
  world.xflash.col=[.45,.8,1];
  addHard({type:'disk',p:vc,t:0,life:.24,size:RAD*.55,jag:Array(14).fill(1),c0:[1,1,1,1],c1:[.3,.9,1,.7]});
  const planes=[V(0,1,0),vnorm(V(1,.4,.2)),vnorm(V(-.3,.5,1))];
  planes.forEach((pl,i)=>addHard({type:'ring',p:vc,t:-i*.03,life:.45,size:RAD*1.7,w:2.4,c0:i%2?[1,.25,.75,.9]:[.3,.95,1,.9],plane:pl}));
  addHard({type:'ring',p:vc,t:0,life:.3,size:RAD*2.2,w:4,c0:[.8,.95,1,.8]});
  for(let i=0;i<9;i++)addHard({type:'arc',p:vc,dir:vnorm(vadd(sphR(1),vscale(n,.5))),len:RAD*(.6+rnd()*.7),t:rnd()*.08,life:.22+rnd()*.15,w:1.6,c0:rnd()<.5?[.6,.95,1,1]:[1,.5,.9,1]});
  for(let i=0;i<34;i++){const v=vadd(sphR(500+rnd()*800),vscale(n,250));
    addHard({type:'streak',p:vc,v,t:0,life:.2+rnd()*.25,drag:3,g:150,len:.035,w:1.1,c0:rnd()<.5?[.4,1,1,1]:[1,.4,.85,1]});}
}
// TOON: cartoon puffs with dark outlines — yellow/orange fire blobs that swell and pop, grey smoke puffs, speed lines
function boomToon(vc,n,RAD){
  addHard({type:'star',p:vc,t:0,life:.08,size:RAD*1.2,rot:rnd()*6,sp:Array.from({length:10},()=>.6+rnd()*.4),c0:[1,1,.95,1],c1:[1,.9,.4,0]});
  for(let i=0;i<8;i++){const o=vadd(sphR(RAD*.32),vscale(n,RAD*.15));
    addHard({type:'cel',alpha:true,p:vadd(vc,o),v:vscale(o,2.2),drag:3,t:-i*.012,life:.38+rnd()*.15,size:RAD*(.3+rnd()*.22),col:i<3?[1,.93,.45]:i<6?[1,.62,.15]:[.95,.32,.08],ink:[.13,.05,.03]});}
  for(let i=0;i<9;i++){const o=vadd(sphR(RAD*.35),vscale(n,RAD*.2));
    addHard({type:'cel',alpha:true,smoke:true,p:vadd(vc,o),v:vadd(vscale(o,.9),V(0,55,0)),drag:1.2,t:-.18-rnd()*.12,life:1+rnd()*.6,size:RAD*(.22+rnd()*.15),col:[.36,.35,.4],ink:[.08,.07,.1]});}
  for(let i=0;i<10;i++){const v=vadd(sphR(900+rnd()*500),vscale(n,300));
    addHard({type:'streak',p:vadd(vc,vscale(vnorm(v),RAD*.4)),v,t:0,life:.14+rnd()*.08,drag:2,g:0,len:.07,w:1.8,c0:[1,1,.95,1]});}
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
  const outA=[],outB=[];let out=outB;const P=(p,c)=>out.push(p.x,p.y,p.z,c[0],c[1],c[2],c[3]);
  const tri=(a,b,c,ca,cb,cc)=>{P(a,ca);P(b,cb);P(c,cc);};
  const at=(o,ax,ay,x,y)=>vadd(o,vadd(vscale(ax,x),vscale(ay,y)));
  const mixc=(a,b,k)=>a.map((x,i)=>x+(b[i]-x)*k);
  const FIRE=[[1,1,.92],[1,.9,.4],[1,.55,.12],[.75,.18,.05],[.16,.12,.12]];
  const fireAt=k=>{const x=clamp(k,0,.999)*(FIRE.length-1),i=Math.floor(x),u=x-i;return FIRE[i].map((v,j)=>v+(FIRE[i+1][j]-v)*u);};
  const L3=vnorm(V(.35,.85,.4));
  for(const f of hardFX){if(f.t<0)continue;const k=clamp(f.t/f.life,0,1);out=f.alpha?outA:outB;
    if(f.type==='cube'){ // a tumbling cube, its faces shaded
      const s=f.size*(f.smoke?(.7+k*.8):(1-k*.55))/2,q=qaxis(f.ax,f.ang),X=qrot(q,V(s,0,0)),Y=qrot(q,V(0,s,0)),Z=qrot(q,V(0,0,s));
      const col=f.fire?fireAt(k):f.col,a=f.smoke?(1-k)*.85:1;
      for(const [nn,u,v] of [[X,Y,Z],[vscale(X,-1),Z,Y],[Y,Z,X],[vscale(Y,-1),X,Z],[Z,X,Y],[vscale(Z,-1),Y,X]]){
        const lit=f.fire?(.75+.25*Math.max(0,vdot(vnorm(nn),L3))):(.55+.45*Math.max(0,vdot(vnorm(nn),L3)));const c=[col[0]*lit,col[1]*lit,col[2]*lit,a];
        const o=vadd(f.p,nn),p00=vsub(vsub(o,u),v),p10=vsub(vadd(o,u),v),p11=vadd(vadd(o,u),v),p01=vadd(vsub(o,u),v);
        tri(p00,p10,p11,c,c,c);tri(p00,p11,p01,c,c,c);}
      if(f.fire&&k<.5){out=outB;const g=[col[0],col[1],col[2],.35*(1-k*2)],s2=s*1.9;tri(vadd(f.p,vscale(rt,-s2)),vadd(f.p,vscale(up,s2)),vadd(f.p,vscale(rt,s2)),g,g,g);tri(vadd(f.p,vscale(rt,-s2)),vadd(f.p,vscale(rt,s2)),vadd(f.p,vscale(up,-s2)),g,g,g);}
      continue;}
    if(f.type==='cel'){ // a cartoon puff: dark outline, flat fill, a lighter highlight
      const sw=Math.sin(Math.min(1,k*1.6)*Math.PI*.5),s=f.size*(f.smoke?(.5+k*.9):(.45+.75*sw)*(k>.7?1-(k-.7)/.3:1)),a=f.smoke?1-k*k:1;
      if(s<.5)continue;const N2=18,ring=(r,c,dx,dy)=>{for(let i=0;i<N2;i++){const a0=i/N2*Math.PI*2,a1=(i+1)/N2*Math.PI*2,o=at(f.p,rt,up,dx,dy);tri(o,at(o,rt,up,Math.cos(a0)*r,Math.sin(a0)*r),at(o,rt,up,Math.cos(a1)*r,Math.sin(a1)*r),c,c,c);}};
      ring(s*1.1,[...f.ink,a],0,0);ring(s,[...f.col,a],0,0);ring(s*.45,[Math.min(1,f.col[0]*1.15+.1),Math.min(1,f.col[1]*1.15+.1),Math.min(1,f.col[2]*1.15+.1),a],-s*.28,s*.3);
      continue;}
    if(f.type==='scorch'){ // flat on the surface it hit, fading out over its life
      const pl=f.plane;let ax=vnorm(vcross(pl,Math.abs(pl.y)<.9?V(0,1,0):V(1,0,0))),ay=vcross(pl,ax);const ca=Math.cos(f.rot),sa=Math.sin(f.rot);[ax,ay]=[vadd(vscale(ax,ca),vscale(ay,sa)),vsub(vscale(ay,ca),vscale(ax,sa))];
      const a=Math.min(1,(1-k)*4)*.85,c0=[.015,.012,.015,a],c1=[.02,.015,.02,0],n=f.jag.length;
      for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,r0=f.size*f.jag[i],r1=f.size*f.jag[(i+1)%n];
        tri(f.p,at(f.p,ax,ay,Math.cos(a0)*r0,Math.sin(a0)*r0),at(f.p,ax,ay,Math.cos(a1)*r1,Math.sin(a1)*r1),c0,c1,c1);}
      continue;}
    if(f.type==='arc'){ // a jagged electric arc, re-drawn every frame so it crackles
      let side=vcross(f.dir,cam.fwd);side=vlen(side)<1e-3?rt:vnorm(side);const up2=vnorm(vcross(side,f.dir)),c=f.c0.map((x,i)=>i===3?x*(1-k):x);
      let prev=f.p;const segs=7;for(let i=1;i<=segs;i++){const along=f.len*i/segs*(.6+.4*Math.min(1,k*3));
        const nx=i<segs?vadd(vadd(vadd(f.p,vscale(f.dir,along)),vscale(side,(Math.random()-.5)*f.len*.25)),vscale(up2,(Math.random()-.5)*f.len*.25)):vadd(f.p,vscale(f.dir,along));
        const sd=vscale(side,f.w);tri(vadd(prev,sd),vsub(prev,sd),vadd(nx,sd),c,c,c);tri(vsub(prev,sd),vsub(nx,sd),vadd(nx,sd),c,c,c);prev=nx;}
      continue;}
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
  if(!outA.length&&!outB.length)return;
  gl.useProgram(HR.p);for(let a=0;a<8;a++)gl.disableVertexAttribArray(a);
  gl.bindBuffer(gl.ARRAY_BUFFER,HR.buf);
  gl.uniformMatrix4fv(HR.uVP,false,FR.vp);gl.uniformMatrix4fv(HR.uWorldFix,false,FR.fix);
  gl.enable(gl.BLEND);gl.depthMask(false);gl.disable(gl.CULL_FACE);
  for(const [arr,add] of [[outA,false],[outB,true]]){if(!arr.length)continue;
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(HR.aPos);gl.vertexAttribPointer(HR.aPos,3,gl.FLOAT,false,28,0);
    gl.enableVertexAttribArray(HR.aCol);gl.vertexAttribPointer(HR.aCol,4,gl.FLOAT,false,28,12);
    gl.blendFunc(gl.SRC_ALPHA,add?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);
    if(!add){gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-2);}
    gl.drawArrays(gl.TRIANGLES,0,arr.length/7);
    gl.disable(gl.POLYGON_OFFSET_FILL);}
  gl.depthMask(true);gl.disable(gl.BLEND);
  gl.disableVertexAttribArray(HR.aPos);gl.disableVertexAttribArray(HR.aCol);
}
