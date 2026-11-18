// =====================================================================
//  RIGID BOXES — crates, furniture and gibs tumble: orientation, spin,
//  contact points on their corners/edges/faces against the voxel world
// =====================================================================
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

const RB_ALL=(()=>{const s=[];for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1])if(x||y||z)s.push([x,y,z]);return s;})(); // corners, edges, faces
const RB_LIGHT=RB_ALL.filter(([x,y,z])=>(x&&y&&z)||(Math.abs(x)+Math.abs(y)+Math.abs(z)===1));                          // corners + face centres
const qIdent=()=>[0,0,0,1];
function rbCols(q){return [qrot(q,V(1,0,0)),qrot(q,V(0,1,0)),qrot(q,V(0,0,1))];}
// world inverse inertia applied to a vector
function rbInvI(b,C,v){
  const m=b.m,W=b.W,H=b.H,D=b.D,ix=12/(m*(H*H+D*D)),iy=12/(m*(W*W+D*D)),iz=12/(m*(W*W+H*H));
  const lx=vdot(C[0],v)*ix,ly=vdot(C[1],v)*iy,lz=vdot(C[2],v)*iz;
  return vadd(vadd(vscale(C[0],lx),vscale(C[1],ly)),vscale(C[2],lz));
}
// axis-aligned bounds of the turned box (what characters and other props collide with)
function rbBounds(b){
  const C=rbCols(b.q),cy=b.y+b.h/2;
  const ex=k=>Math.abs(C[0][k])*b.W/2+Math.abs(C[1][k])*b.H/2+Math.abs(C[2][k])*b.D/2;
  b.w=ex('x')*2;b.h=ex('y')*2;b.d=ex('z')*2;b.y=cy-b.h/2;
}
function rbSetup(b,W,H,D,q){b.W=W;b.H=H;b.D=D;b.q=q||qIdent();b.av=V(0,0,0);b.rb=true;b.sleep=0;b.w=W;b.h=H;b.d=D;rbBounds(b);}
// spin only (the linear push is applied by the caller): impulse J at world point p
function rbSpin(b,p,J,k){if(!b.rb||!isFinite(p.x+p.y+p.z+J.x+J.y+J.z))return;const C=rbCols(b.q),c=V(b.x,b.y+b.h/2,b.z);b.av=vadd(b.av,vscale(rbInvI(b,C,vcross(vsub(p,c),J)),k===undefined?1:k));b.asleep=false;b.sleep=0;}
// turn with the arena
function rbTurn(b,qr){if(!b.rb)return;b.q=qn(qmul(qr,b.q));b.av=qrot(qr,b.av);b.asleep=false;b.sleep=0;rbBounds(b);}
// the nearest axis-aligned orientation (for settling)
function rbSnapQ(q){
  const C=rbCols(q),cols=[];const used={};
  for(const c of C){let best=null,bv=-1;for(const [k,ax] of [['x',V(1,0,0)],['y',V(0,1,0)],['z',V(0,0,1)]]){if(used[k])continue;const d=Math.abs(c[k]);if(d>bv){bv=d;best=[k,ax,Math.sign(c[k])||1];}}
    used[best[0]]=1;cols.push(vscale(best[1],best[2]));}
  if(vdot(vcross(cols[0],cols[1]),cols[2])<0)cols[2]=vscale(cols[2],-1);
  return qFromR(cols);
}
function rbAngleTo(q,t){const d=Math.abs(q[0]*t[0]+q[1]*t[1]+q[2]*t[2]+q[3]*t[3]);return 2*Math.acos(Math.min(1,d));}
// one physics step; returns the largest contact impulse (for sounds and dust) and whether it rests on something
function rbStep(b,dt,samples,o){
  o=o||{};const rest=o.rest===undefined?.18:o.rest,mu=o.mu===undefined?.55:o.mu;
  let c=V(b.x,b.y+b.h/2,b.z);
  if(b.asleep){
    // wake if the floor under it went away or something moved it
    const C=rbCols(b.q),down=V(0,-1,0);let sup=false;
    for(const s of samples){const r=vadd(vadd(vscale(C[0],s[0]*b.W/2),vscale(C[1],s[1]*b.H/2)),vscale(C[2],s[2]*b.D/2));if(vdot(r,down)<b.h*.45)continue;
      const p=vadd(c,r);if(solid(tileAt(p.x,p.y-3,p.z))){sup=true;break;}}
    if(sup||b.propSupport){if(Math.hypot(b.vx,b.vy,b.vz)<1&&vlen(b.av)<.02){b.vx=b.vy=b.vz=0;return {imp:0,ground:true};}}
    b.asleep=false;b.sleep=0;
  }
  b.vy=Math.max(b.vy-G*dt,-MAXFALL);
  c=vadd(c,V(b.vx*dt,b.vy*dt,b.vz*dt));
  const w=b.av,wl=vlen(w);
  if(wl>1e-5){const dq=qaxis(vscale(w,1/wl),wl*dt);b.q=qn(qmul(dq,b.q));}
  const C=rbCols(b.q);let imp=0,ground=false;
  const corr={};let v=V(b.vx,b.vy,b.vz),av=b.av;
  for(const s of samples){
    const r=vadd(vadd(vscale(C[0],s[0]*b.W/2),vscale(C[1],s[1]*b.H/2)),vscale(C[2],s[2]*b.D/2)),p=vadd(c,r);
    const i=Math.floor(p.x/T),j=Math.floor(p.y/T),k=Math.floor(p.z/T);
    if(!solid(tile(i,j,k)))continue;
    // the way out: the shallowest face of this block that opens onto air
    let n=null,dep=1e9;
    for(const [d,nn,ok] of [[p.y-j*T,V(0,-1,0),!solid(tile(i,j-1,k))],[(j+1)*T-p.y,V(0,1,0),!solid(tile(i,j+1,k))],[p.x-i*T,V(-1,0,0),!solid(tile(i-1,j,k))],
      [(i+1)*T-p.x,V(1,0,0),!solid(tile(i+1,j,k))],[p.z-k*T,V(0,0,-1),!solid(tile(i,j,k-1))],[(k+1)*T-p.z,V(0,0,1),!solid(tile(i,j,k+1))]])
      if(ok&&d<dep){dep=d;n=nn;}
    if(!n){n=V(0,1,0);dep=(j+1)*T-p.y;}
    if(n.y>.7)ground=true;
    const key=n.x+','+n.y+','+n.z;corr[key]=Math.max(corr[key]||0,dep);
    const vp=vadd(v,vcross(av,r)),vn=vdot(vp,n);
    if(vn<0){
      const rn=vcross(r,n),kk=1/b.m+vdot(n,vcross(rbInvI(b,C,rn),r)),e=-vn>120?rest:0,jn=-(1+e)*vn/kk;
      v=vadd(v,vscale(n,jn/b.m));av=vadd(av,rbInvI(b,C,vscale(rn,jn)));imp=Math.max(imp,jn/b.m);
      const vp2=vadd(v,vcross(av,r)),vt=vsub(vp2,vscale(n,vdot(vp2,n))),tl=vlen(vt);
      if(tl>1e-3){const t=vscale(vt,1/tl),rt=vcross(r,t),kt=1/b.m+vdot(t,vcross(rbInvI(b,C,rt),r));let jt=-tl/kt;jt=Math.max(jt,-mu*jn);
        v=vadd(v,vscale(t,jt/b.m));av=vadd(av,rbInvI(b,C,vscale(rt,jt)));}
    }
  }
  for(const key in corr){const [x,y,z]=key.split(',').map(Number);c=vadd(c,vscale(V(x,y,z),corr[key]*.8));}
  // a little air drag on the spin; more while scraping along the floor
  av=vscale(av,Math.pow(ground?.25:.85,dt));
  b.vx=v.x;b.vy=v.y;b.vz=v.z;b.av=av;
  b.x=c.x;b.z=c.z;b.y=c.y-b.h/2;rbBounds(b);
  // settle: slow and resting → square it up onto the face it lies on and sleep
  if((ground||b.propSupport)&&Math.hypot(b.vx,b.vy,b.vz)<14&&vlen(b.av)<.7){
    b.sleep+=dt;
    if(b.sleep>.25){const sq=rbSnapQ(b.q);if(rbAngleTo(b.q,sq)<.2){b.q=qlerp(b.q,sq,Math.min(1,dt*10));if(rbAngleTo(b.q,sq)<.01){b.q=sq;rbBounds(b);b.vx=b.vy=b.vz=0;b.av=V(0,0,0);b.asleep=true;}}}
  }else b.sleep=0;
  return {imp,ground};
}
// draw a sub-box given in the body's local frame (centre lc, size ls)
function rbDraw(b,lc,ls,col,em,edge,alpha){
  const C=rbCols(b.q),c=vadd(V(b.x,b.y+b.h/2,b.z),vadd(vadd(vscale(C[0],lc.x),vscale(C[1],lc.y)),vscale(C[2],lc.z)));
  drawCubeM(M4.basis(c,vscale(C[0],ls.x),vscale(C[1],ls.y),vscale(C[2],ls.z)),col,em,edge,alpha);
}
