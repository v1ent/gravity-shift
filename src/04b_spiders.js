// =====================================================================
//  SPIDERS — neutral white crawlers. They cling to floors, walls and
//  ceilings, hunt the closest fighter, leap and bite. Gravity turns
//  don't shake them off: they turn with the surface they hold on to.
// =====================================================================
const SPIDER_HP=30,SPIDER_SPD=125,SPIDER_BITE=14,SPIDER_MAX=3,SPIDER_LEAP=430;
let SPIDER_LAG=.35,SPIDER_WINDUP=.3; // it reacts to where you were a moment ago, and crouches before it pounces
let spiders=[];
const SPIDER_SRC={name:'SPIDER',isSpider:true,color:'#e8ecf2',x:0,y:0,z:0};
const gA=(v,a)=>a===0?v.x:a===1?v.y:v.z;
function sA(v,a,val){if(a===0)v.x=val;else if(a===1)v.y=val;else v.z=val;}
const axisOfN=n=>Math.abs(n.x)>.5?0:Math.abs(n.y)>.5?1:2;
function domAxis(d,skip){let best=-1,bv=-1;for(let a=0;a<3;a++){if(a===skip)continue;const v=Math.abs(gA(d,a));if(v>bv){bv=v;best=a;}}return best;}
function syncSpider(s){s.x=s.p.x;s.y=s.p.y-6;s.z=s.p.z;}
function makeSpider(p,n){
  const s={p,n,hp:SPIDER_HP,state:'crawl',dir:V(0,0,0),look:null,v:V(0,0,0),biteCD:0,leapCD:1.5,phase:0,alive:true,stuckT:0,last:V(p.x,p.y,p.z),
    path:null,repath:0,spawnT:.8,w:18,h:12,vx:0,vy:0,vz:0,vis:1,isSpider:true,name:'SPIDER'};
  syncSpider(s);return s;
}
function spawnSpider(){
  const dirs=[[0,-1,0],[0,1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
  for(let tr=0;tr<300;tr++){
    const i=1+(rnd()*(N-2)|0),j=1+(rnd()*(N-2)|0),k=1+(rnd()*(N-2)|0);
    if(solid(tile(i,j,k)))continue;
    const d=dirs[rnd()*6|0];if(!solid(tile(i+d[0],j+d[1],k+d[2])))continue;
    const n=V(-d[0],-d[1],-d[2]),c=V((i+.5)*T,(j+.5)*T,(k+.5)*T);
    const p=V(c.x-n.x*(T/2-2),c.y-n.y*(T/2-2),c.z-n.z*(T/2-2));
    if(chars.some(e=>e.alive&&Math.hypot(e.x-p.x,e.y-p.y,e.z-p.z)<520))continue;
    const s=makeSpider(p,n);spiders.push(s);
    for(let q=0;q<16;q++)addPart(p.x,p.y,p.z,(rnd()-.5)*120+n.x*80,(rnd()-.5)*120+n.y*80,(rnd()-.5)*120+n.z*80,.7,[.15,.15,.18],10,'smoke');
    sfx('spider',p);
    return s;
  }
  return null;
}
function hurtSpider(s,amt,src){
  if(!s.alive)return;s.hp-=amt;
  for(let q=0;q<5;q++)addPart(s.p.x,s.p.y,s.p.z,(rnd()-.5)*160,(rnd()-.5)*160,(rnd()-.5)*160,.4,[.8,1,.7],3,'spark');
  if(s.hp<=0){s.alive=false;sfx('splat',s.p);
    for(let q=0;q<26;q++)addPart(s.p.x,s.p.y,s.p.z,(rnd()-.5)*320+s.n.x*120,(rnd()-.5)*320+s.n.y*120,(rnd()-.5)*320+s.n.z*120,.7,rnd()<.5?[.85,.95,.8]:[.55,.9,.4],4,'spark');
    if(src===player)feed.unshift({t:3,text:'YOU ✕ SPIDER',color:'#e8ecf2'});}
}
// ---- surface graph: a "face" is an air cell + the direction away from the solid block it sits on
const SN=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const snIdx=(x,y,z)=>x>.5?0:x<-.5?1:y>.5?2:y<-.5?3:z>.5?4:5;
function isFace(i,j,k,f){const n=SN[f];return i>=0&&j>=0&&k>=0&&i<N&&j<N&&k<N&&!solid(tile(i,j,k))&&solid(tile(i-n[0],j-n[1],k-n[2]));}
function facePt(i,j,k,f){const n=SN[f],o=T/2-2;return V((i+.5)*T-n[0]*o,(j+.5)*T-n[1]*o,(k+.5)*T-n[2]*o);}
function spiderPath(s,goal){
  const c=vadd(s.p,vscale(s.n,4));let i=Math.floor(c.x/T),j=Math.floor(c.y/T),k=Math.floor(c.z/T),f=snIdx(s.n.x,s.n.y,s.n.z);
  if(!isFace(i,j,k,f))return null;
  const key=(i,j,k,f)=>((i*N+j)*N+k)*6+f;
  const start=key(i,j,k,f),prev=new Map([[start,-1]]),q=[[i,j,k,f]];
  let best=start,bd=vlen(vsub(facePt(i,j,k,f),goal)),bestQ=q[0];
  for(let h=0;h<q.length&&h<14000;h++){
    const [ci,cj,ck,cf]=q[h],n=SN[cf],K=key(ci,cj,ck,cf);
    const d=vlen(vsub(facePt(ci,cj,ck,cf),goal));if(d<bd){bd=d;best=K;bestQ=q[h];if(d<36)break;}
    for(let t=0;t<6;t++){
      if((t>>1)===(cf>>1))continue;const tv=SN[t];
      const ai=ci+tv[0],aj=cj+tv[1],ak=ck+tv[2];let nb;
      if(solid(tile(ai,aj,ak)))nb=[ci,cj,ck,t^1];                       // wall ahead: climb it
      else if(solid(tile(ai-n[0],aj-n[1],ak-n[2])))nb=[ai,aj,ak,cf];      // same plane
      else nb=[ai-n[0],aj-n[1],ak-n[2],t];                               // round the edge
      if(!isFace(...nb))continue;const nk=key(...nb);if(prev.has(nk))continue;
      prev.set(nk,K);nb.push(K);q.push(nb);
    }
  }
  // rebuild the chain of faces -> waypoints (add the edge point when wrapping round a convex corner)
  const chain=[];let k2=best;const dec=K=>{const f=K%6;let r=(K-f)/6;const kk=r%N;r=(r-kk)/N;const jj=r%N;return [(r-jj)/N,jj,kk,f];};
  while(k2!==-1){chain.push(dec(k2));k2=prev.get(k2);}
  chain.reverse();
  const out=[];
  for(let m=1;m<chain.length;m++){
    const [pi,pj,pk,pf]=chain[m-1],[ni,nj,nk,nf]=chain[m];
    if(pf!==nf&&!(pi===ni&&pj===nj&&pk===nk)){const n=SN[nf];out.push({p:vadd(facePt(pi,pj,pk,pf),V(n[0]*(T/2-2),n[1]*(T/2-2),n[2]*(T/2-2))),n:null});}
    const nn=SN[nf];out.push({p:facePt(ni,nj,nk,nf),n:V(nn[0],nn[1],nn[2])});
  }
  return out;
}
function spiderTarget(s){
  let tgt=null,bd=1e9;
  for(const e of chars){if(!e.alive)continue;const d=Math.hypot(e.x-s.p.x,e.y+e.h*.4-s.p.y,e.z-s.p.z);if(d<bd){bd=d;tgt=e;}}
  return [tgt,bd];
}
function spiderBite(s,e){
  const dir=vnorm(vsub(V(e.x,e.y+e.h*.5,e.z),s.p));
  SPIDER_SRC.x=s.p.x;SPIDER_SRC.y=s.p.y;SPIDER_SRC.z=s.p.z;
  damage(e,SPIDER_BITE,SPIDER_SRC,dir);
  if(e.alive&&e.state==='normal'){e.vx+=dir.x*140;e.vz+=dir.z*140;}
  s.biteCD=1.1;sfx('bite',s.p);
  for(let q=0;q<6;q++)addPart(e.x,e.y+e.h*.5,e.z,(rnd()-.5)*160,rnd()*120,(rnd()-.5)*160,.35,e.col,3,'spark');
  if(e===player)world.shake=Math.max(world.shake,4);
}
function updateSpider(s,dt){
  s.biteCD-=dt;s.leapCD-=dt;
  if(s.spawnT>0){s.spawnT-=dt;syncSpider(s);return;}
  const [tgt,bd]=spiderTarget(s);
  // remember where the target has been: the spider acts on that, not on where they are right now
  if(tgt){if(s.histOf!==tgt){s.hist=[];s.histOf=tgt;}s.hist.push({t:world.time,p:V(tgt.x,tgt.y+tgt.h*.45,tgt.z)});while(s.hist.length>2&&world.time-s.hist[1].t>SPIDER_LAG)s.hist.shift();}
  const goal=tgt?s.hist[0].p:null; // (the oldest entry: about SPIDER_LAG ago)
  if(s.state==='windup'){ // crouched, about to spring at where you were
    s.windT-=dt;if(s.leapGoal){const f=vsub(s.leapGoal,s.p),ff=vsub(f,vscale(s.n,vdot(f,s.n)));if(vlen(ff)>1)s.dir=vnorm(ff);}
    if(s.windT<=0){const d=vnorm(vsub(s.leapGoal,s.p));s.v=vadd(vscale(d,SPIDER_LEAP),V(0,90,0));s.p=vadd(s.p,vscale(s.n,4));s.state='leap';s.leapT=0;sfx('spider',s.p);}
    syncSpider(s);return;
  }
  if(s.state==='leap'){
    // pounce: straight-ish flight with a slight drop, re-grabs whatever it hits
    s.v.y-=G*.45*dt;
    const sp=vlen(s.v),steps=Math.max(1,Math.ceil(sp*dt/4)),st=dt/steps;
    for(let k=0;k<steps;k++){
      const prev=V(s.p.x,s.p.y,s.p.z);
      s.p=vadd(s.p,vscale(s.v,st));
      if(tgt&&s.biteCD<=0&&Math.abs(tgt.x-s.p.x)<tgt.w/2+8&&Math.abs(tgt.z-s.p.z)<tgt.w/2+8&&s.p.y>tgt.y-4&&s.p.y<tgt.y+tgt.h+4){spiderBite(s,tgt);s.v=vscale(s.v,-.35);}
      if(solid(tileAt(s.p.x,s.p.y,s.p.z))){
        // which face did we cross? -> cling to it
        const ci=[Math.floor(prev.x/T),Math.floor(prev.y/T),Math.floor(prev.z/T)],cn=[Math.floor(s.p.x/T),Math.floor(s.p.y/T),Math.floor(s.p.z/T)];
        let ax=0;for(let a=0;a<3;a++)if(ci[a]!==cn[a]){ax=a;break;}
        const sg=Math.sign(gA(s.v,ax))||1;
        s.p=prev;const face=sg>0?cn[ax]*T:(cn[ax]+1)*T;sA(s.p,ax,face-sg*2);
        s.n=V(0,0,0);sA(s.n,ax,-sg);
        s.state='crawl';s.leapCD=2.2;s.v=V(0,0,0);s.path=null;s.repath=0;s.atWp=true;sfx('land',s.p);break;
      }
    }
    s.leapT=(s.leapT||0)+dt;if(s.leapT>4){s.alive=false;}
    syncSpider(s);return;
  }
  // bite when close
  if(tgt&&bd<30&&s.biteCD<=0)spiderBite(s,tgt);
  // leap when close and clear
  if(tgt&&bd<200&&bd>45&&s.leapCD<=0&&losClear(vadd(s.p,vscale(s.n,4)),goal)){
    s.state='windup';s.windT=s.windT0=SPIDER_WINDUP;s.leapGoal=V(goal.x,goal.y,goal.z);s.leapCD=2.2;syncSpider(s);return;
  }
  // crawl: follow a path over the surface graph (floors, walls, ceilings, round edges)
  s.repath-=dt;
  if(goal&&s.atWp!==false&&(s.repath<=0||!s.path||!s.path.length)){s.repath=.45;s.path=spiderPath(s,goal);
    if(!s.path){s.state='leap';s.v=V(0,0,0);s.p=vadd(s.p,vscale(s.n,3));s.leapT=0;syncSpider(s);return;}}
  let remain=SPIDER_SPD*dt;
  while(remain>0&&s.path&&s.path.length){
    const w=s.path[0],to=vsub(w.p,s.p),d=vlen(to);
    if(d<=remain){s.p=V(w.p.x,w.p.y,w.p.z);remain-=d;if(w.n)s.n=V(w.n.x,w.n.y,w.n.z);s.path.shift();s.atWp=!!w.n;if(s.atWp&&s.repath<=0)break;}
    else{const u=vscale(to,1/d);s.p=vadd(s.p,vscale(u,remain));remain=0;s.atWp=false;const f=vsub(u,vscale(s.n,vdot(u,s.n)));if(vlen(f)>.2)s.dir=vnorm(f);}
  }
  s.phase+=SPIDER_SPD*dt/24; // stride rate: slower, longer steps
  syncSpider(s);
}
function updateSpiders(dt){
  world.spiderT-=dt;
  if(world.spiderT<=0){world.spiderT=16+rnd()*12;if(spiders.filter(s=>s.alive).length<SPIDER_MAX)spawnSpider();}
  for(const s of spiders)if(s.alive)updateSpider(s,dt);
  spiders=spiders.filter(s=>s.alive);
}
const SPIDER_COL=hexRGB('#e8ecf2'),SPIDER_DARK=hexRGB('#9aa3b2');
// ---------- the spider model (spider_new.glb): static shell + eyes, 16 rigid leg segments posed by a 2-bone solve ----------
const SPIDER_K=29; // model units -> world px
let SPM=null;
function spiderMeshes(){
  if(SPM||!R.gl||typeof SPIDER_MODEL==='undefined')return SPM;
  const gl=R.gl,raw=atob(SPIDER_MODEL.b64),u8=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u8[i]=raw.charCodeAt(i);
  const dv=new DataView(u8.buffer);SPM={};
  for(const [name,[off,n]] of Object.entries(SPIDER_MODEL.meshes)){
    const v=new Float32Array(n*STRIDE);
    for(let k=0;k<n;k++){const o=off+k*12,w=k*STRIDE;
      for(let a=0;a<3;a++)v[w+a]=dv.getInt16(o+a*2,true)/30000;
      for(let a=0;a<3;a++)v[w+3+a]=dv.getInt8(o+6+a)/127;
      for(let a=0;a<3;a++)v[w+6+a]=u8[o+9+a]/255;
      v[w+9]=.5;v[w+10]=.5;v[w+11]=1;v[w+12]=1;v[w+13]=0;}
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);SPM[name]={b,n};
  }
  SPM.legs=SPIDER_MODEL.legs.map(l=>({up:l.up,lo:l.lo,hip:V(...l.hip),knee:V(...l.knee),foot:V(...l.foot)}));
  for(const l of SPM.legs){l.l1=vlen(vsub(l.knee,l.hip));l.l2=vlen(vsub(l.foot,l.knee));}
  return SPM;
}
const xf=(M,p)=>V(M[0]*p.x+M[4]*p.y+M[8]*p.z+M[12],M[1]*p.x+M[5]*p.y+M[9]*p.z+M[13],M[2]*p.x+M[6]*p.y+M[10]*p.z+M[14]);
// rigid move that takes the rest segment a0->b0 onto a->b (rotation about a, minimal arc)
function segMatrix(a0,b0,a,b){
  const u=vnorm(vsub(b0,a0)),v=vnorm(vsub(b,a)),c=clamp(vdot(u,v),-1,1),ax=vcross(u,v),s=vlen(ax);
  let r;if(s<1e-6)r=[1,0,0,0,1,0,0,0,1];
  else{const k=vscale(ax,1/s),C=1-c,x=k.x,y=k.y,z=k.z;
    r=[c+x*x*C,y*x*C+z*s,z*x*C-y*s, x*y*C-z*s,c+y*y*C,z*y*C+x*s, x*z*C+y*s,y*z*C-x*s,c+z*z*C];} // column-major
  const ra=V(r[0]*a0.x+r[3]*a0.y+r[6]*a0.z,r[1]*a0.x+r[4]*a0.y+r[7]*a0.z,r[2]*a0.x+r[5]*a0.y+r[8]*a0.z);
  const t=vsub(a,ra);
  return [r[0],r[1],r[2],0,r[3],r[4],r[5],0,r[6],r[7],r[8],0,t.x,t.y,t.z,1];
}
function drawSpiderMesh(m,M,em){
  const gl=R.gl,L=R.main.loc;bindMain(m.b);
  gl.uniformMatrix4fv(L.uModel,false,M);gl.uniform1f(L.uUseTint,0);gl.uniform1f(L.uEdge,0);
  if(em)gl.uniform3f(L.uEmis,em[0],em[1],em[2]);else gl.uniform3f(L.uEmis,0,0,0);gl.uniform1f(L.uAlpha,1);
  gl.drawArrays(gl.TRIANGLES,0,m.n);
}
function drawSpider(s){
  const up=vnorm(s.n);
  let fw=s.dir&&vlen(s.dir)>.5?s.dir:null;
  if(!fw){fw=Math.abs(up.y)<.9?vnorm(vcross(up,V(0,1,0))):V(1,0,0);}
  s.look=s.look?vnorm(vlerp(s.look,fw,.25)):fw;
  fw=vnorm(vsub(s.look,vscale(up,vdot(s.look,up))));if(vlen(fw)<.5)fw=Math.abs(up.y)<.9?vnorm(vcross(up,V(0,1,0))):V(1,0,0);
  const pop=s.spawnT>0?1-s.spawnT/.8:1;if(pop<=.05)return;
  const S=spiderMeshes();if(!S){drawSpiderBoxes(s,up,fw,pop);return;}
  const k=SPIDER_K*pop,crouch=s.state==='windup'?Math.min(1,(s.windT0-s.windT)/s.windT0*3):0;
  const lx=vcross(up,fw),o=vsub(s.p,vscale(up,2+crouch*3));
  const M=M4.basis(o,vscale(lx,k),vscale(up,k),vscale(fw,k)); // the ground frame: feet are planted in this
  // body motion while walking: bob twice a gait cycle, sway side to side, a little pitch and yaw wiggle.
  // How much follows how fast the legs are actually cycling.
  const now=performance.now()/1000,dtw=s._pt!==undefined?Math.min(.1,now-s._pt):0,rate=dtw>0?(s.phase-s._ph)/dtw:0;s._ph=s.phase;s._pt=now;
  s.walkAmt=lerp(s.walkAmt||0,s.state==='crawl'?clamp(rate/(SPIDER_SPD/24),0,1.3):0,1-Math.exp(-6*dtw));
  const wa=s.walkAmt,G=s.phase*Math.PI*2;
  const bob=Math.sin(G*2)*1.1*wa*pop,roll=Math.sin(G)*.085*wa,pitch=Math.sin(G*2+1)*.045*wa,wig=Math.sin(G+.6)*.06*wa;
  const q=qmul(qaxis(up,wig),qmul(qaxis(lx,pitch),qaxis(fw,roll))),cb=vadd(o,vscale(up,.3*k));
  const ob=vadd(vadd(cb,qrot(q,vsub(o,cb))),vscale(up,bob));
  const Mb=M4.basis(ob,vscale(qrot(q,lx),k),vscale(qrot(q,up),k),vscale(qrot(q,fw),k)); // the body frame
  drawSpiderMesh(S.shell,Mb);drawSpiderMesh(S.eyes,Mb,[.9,.06,.06]);
  // legs: feet step in an alternating gait (or tuck in mid-leap); knees bend the way the model's do
  const air=s.state==='leap';
  S.legs.forEach((l,i)=>{
    const row=i>>1,side=l.hip.x>0?1:-1;
    const ph=s.phase*Math.PI*2+(row%2?Math.PI:0)+(side>0?0:Math.PI);
    let f;
    if(air)f=V(l.hip.x+(l.foot.x-l.hip.x)*.62,l.hip.y-.12,l.hip.z+(l.foot.z-l.hip.z)*.5+.12);
    else{const sw=Math.sin(ph)*.17,lift=Math.max(0,Math.cos(ph))*.13;f=V(l.foot.x*(1-crouch*.08),lift,l.foot.z+sw);}
    const hipW=xf(Mb,l.hip),footW=xf(air?Mb:M,f),kneeR=xf(Mb,l.knee); // hips ride the body, feet stay planted
    const L1=l.l1*k,L2=l.l2*k;let dv=vsub(footW,hipW),d=vlen(dv)||1e-3;
    const dd=Math.min(d,(L1+L2)*.999),dir=vscale(dv,1/d);
    const a=(L1*L1-L2*L2+dd*dd)/(2*dd),h=Math.sqrt(Math.max(0,L1*L1-a*a));
    let pole=vsub(kneeR,hipW);pole=vsub(pole,vscale(dir,vdot(pole,dir)));pole=vlen(pole)>1e-4?vnorm(pole):up;
    const knee=vadd(hipW,vadd(vscale(dir,a),vscale(pole,h))),foot=vadd(hipW,vscale(dir,dd));
    const kneeW0=kneeR,footW0=xf(Mb,l.foot);
    drawSpiderMesh(S[l.up],M4.mul(segMatrix(hipW,kneeW0,hipW,knee),Mb));
    drawSpiderMesh(S[l.lo],M4.mul(segMatrix(kneeW0,footW0,knee,foot),Mb));
  });
  bindMain(R.cube);const gl=R.gl,L=R.main.loc;gl.uniform1f(L.uUseTint,1);gl.uniform1f(L.uEdge,.06);gl.uniform3f(L.uEmis,0,0,0);
}
// the old box spider (only if the model can't be used)
function drawSpiderBoxes(s,up,fw,pop){
  const rt=vcross(fw,up);
  const at=(f,u,r)=>vadd(s.p,vadd(vscale(fw,f),vadd(vscale(up,u),vscale(rt,r))));
  const box=(c,lf,lu,lr,col,em,edge)=>drawCubeM(M4.basis(c,vscale(rt,lr),vscale(up,lu),vscale(fw,lf)),col,em,edge,1);
  const sc=pop;
  box(at(-7*sc,7*sc,0),16*sc,11*sc,14*sc,SPIDER_COL,[.05,.05,.06],[.35,.4,.5]);
  box(at(5*sc,5.5*sc,0),10*sc,7*sc,10*sc,SPIDER_COL,null,[.35,.4,.5]);
}
