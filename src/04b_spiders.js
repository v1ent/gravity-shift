// =====================================================================
//  SPIDERS — neutral white crawlers. They cling to floors, walls and
//  ceilings, hunt the closest fighter, leap and bite. Gravity turns
//  don't shake them off: they turn with the surface they hold on to.
// =====================================================================
const SPIDER_HP=30,SPIDER_SPD=125,SPIDER_BITE=14,SPIDER_MAX=3,SPIDER_LEAP=430;
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
  const goal=tgt?V(tgt.x,tgt.y+tgt.h*.45,tgt.z):null;
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
    const d=vnorm(vsub(goal,s.p));s.v=vadd(vscale(d,SPIDER_LEAP),V(0,90,0));s.p=vadd(s.p,vscale(s.n,4));s.state='leap';s.leapT=0;sfx('spider',s.p);syncSpider(s);return;
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
  s.phase+=SPIDER_SPD*dt/14;
  syncSpider(s);
}
function updateSpiders(dt){
  world.spiderT-=dt;
  if(world.spiderT<=0){world.spiderT=16+rnd()*12;if(spiders.filter(s=>s.alive).length<SPIDER_MAX)spawnSpider();}
  for(const s of spiders)if(s.alive)updateSpider(s,dt);
  spiders=spiders.filter(s=>s.alive);
}
const SPIDER_COL=hexRGB('#e8ecf2'),SPIDER_DARK=hexRGB('#9aa3b2');
function drawSpider(s){
  const up=vnorm(s.n);
  let fw=s.dir&&vlen(s.dir)>.5?s.dir:null;
  if(!fw){fw=Math.abs(up.y)<.9?vnorm(vcross(up,V(0,1,0))):V(1,0,0);}
  s.look=s.look?vnorm(vlerp(s.look,fw,.25)):fw;
  fw=vnorm(vsub(s.look,vscale(up,vdot(s.look,up))));if(vlen(fw)<.5)fw=Math.abs(up.y)<.9?vnorm(vcross(up,V(0,1,0))):V(1,0,0);
  const rt=vcross(fw,up);
  const at=(f,u,r)=>vadd(s.p,vadd(vscale(fw,f),vadd(vscale(up,u),vscale(rt,r))));
  const box=(c,lf,lu,lr,col,em,edge)=>drawCubeM(M4.basis(c,vscale(rt,lr),vscale(up,lu),vscale(fw,lf)),col,em,edge,1);
  const pop=s.spawnT>0?1-s.spawnT/.8:1;if(pop<=.05)return;
  const sc=pop;
  box(at(-7*sc,7*sc,0),16*sc,11*sc,14*sc,SPIDER_COL,[.05,.05,.06],[.35,.4,.5]);   // abdomen
  box(at(-9*sc,12.5*sc,0),8*sc,1.5*sc,6*sc,hexRGB('#ff3b3b'),[.6,.05,.05],null);    // red mark on the back
  box(at(5*sc,5.5*sc,0),10*sc,7*sc,10*sc,SPIDER_COL,null,[.35,.4,.5]);            // head
  for(const r of [-2.2,2.2])box(at(10.4*sc,7*sc,r*sc),1.6,2,2,hexRGB('#ff2a2a'),[1,.1,.1],null); // eyes
  // 8 legs: hip on the body side, knee high, foot planted on the surface; alternating gait
  const air=s.state==='leap';
  for(let i=0;i<4;i++)for(const side of [-1,1]){
    const off=[7,2.5,-2.5,-7][i];
    const ph=s.phase*Math.PI*2+(i%2?Math.PI:0)+(side>0?0:Math.PI);
    const swing=air?0:Math.sin(ph)*4,lift=air?0:Math.max(0,Math.cos(ph))*4;
    const hip=at(off*.6*sc+1,6*sc,side*5*sc);
    const foot=air?at(off*1.4*sc-4,-2*sc,side*16*sc):at((off*1.6+swing)*sc,lift*sc,side*18*sc);
    const knee=vadd(vlerp(hip,foot,.5),vadd(vscale(up,(air?6:11)*sc),vscale(rt,side*2*sc)));
    drawSeg(hip,knee,2.4*sc,SPIDER_COL,null,[.3,.35,.45],1);drawSeg(knee,foot,2*sc,SPIDER_DARK,null,[.3,.35,.45],1);
  }
}
