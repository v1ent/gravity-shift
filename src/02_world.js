// =====================================================================
//  WORLD — voxel construction site, collision, 90° gravity turns, nav
// =====================================================================
const T=32,N=37,L=N*T,S6=6;
// voxel types: 0 air, 1 concrete, 2 gravity panel, 3 steel, 4 hazard rim, 5 neon strip, 6 outer shell
let grid=new Uint8Array(N*N*N);
const gi=(i,j,k)=>i+N*(j+N*k);
const tile=(i,j,k)=>(i<0||j<0||k<0||i>=N||j>=N||k>=N)?6:grid[gi(i,j,k)];
const setT=(i,j,k,v)=>{if(i>=0&&j>=0&&k>=0&&i<N&&j<N&&k<N)grid[gi(i,j,k)]=v;};
const solid=t=>t!==0;
const tileAt=(x,y,z)=>tile(Math.floor(x/T),Math.floor(y/T),Math.floor(z/T));
const isLiveK=(i,j,k)=>tile(i,j,k)===2&&(tile(i,j+1,k)===2||tile(i,j-1,k)===2);

// ---------------- level generation ----------------
function genLevel(seed){
  const R=mulberry32(seed);
  grid=new Uint8Array(N*N*N);
  const M=12,MC=3; // macro grid: 3x3x3 big rooms of 11 blocks
  // outer shell with neon bands
  for(let a=0;a<N;a++)for(let b=0;b<N;b++){
    for(const [i,j,k] of [[0,a,b],[N-1,a,b],[a,0,b],[a,N-1,b],[a,b,0],[a,b,N-1]])setT(i,j,k,6);
  }
  for(let a=0;a<N;a++)for(const j of [9,21,33]){setT(0,j,a,5);setT(N-1,j,a,5);setT(a,j,0,5);setT(a,j,N-1,5);}
  const box=(x0,y0,z0,x1,y1,z1,t)=>{for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)if(tile(x,y,z)!==6)setT(x,y,z,t);};
  const clear=(x0,y0,z0,x1,y1,z1)=>{for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)if(x>0&&y>0&&z>0&&x<N-1&&y<N-1&&z<N-1)setT(x,y,z,0);};
  // ---- main floors at y=12 and y=24: big slabs over each 11x11 room, some half, some with a hole, some missing
  for(const y of [12,24])for(let a=0;a<MC;a++)for(let c=0;c<MC;c++){
    const x0=a*M+1,z0=c*M+1,x1=x0+10,z1=z0+10,r=R();
    if(r<.45)box(x0-1,y,z0-1,x1+1,y,z1+1,1);
    else if(r<.65){const s=R()*4|0;// half slab along one side
      if(s===0)box(x0-1,y,z0-1,x1+1,y,z0+4,1);else if(s===1)box(x0-1,y,z1-4,x1+1,y,z1+1,1);else if(s===2)box(x0-1,y,z0-1,x0+4,y,z1+1,1);else box(x1-4,y,z0-1,x1+1,y,z1+1,1);}
    else if(r<.77){box(x0-1,y,z0-1,x1+1,y,z1+1,1);clear(x0+3,y,z0+3,x1-3,y,z1-3);}
  }
  // ---- mezzanines at y=6,18,30: wide strips along one side of a room
  for(const y of [6,18,30])for(let a=0;a<MC;a++)for(let c=0;c<MC;c++){
    if(R()>.32)continue;
    const x0=a*M+1,z0=c*M+1,x1=x0+10,z1=z0+10,s=R()*4|0;
    if(s===0)box(x0,y,z0,x1,y,z0+3,1);else if(s===1)box(x0,y,z1-3,x1,y,z1,1);else if(s===2)box(x0,y,z0,x0+3,y,z1,1);else box(x1-3,y,z0,x1,y,z1,1);
  }
  // ---- walls on the room boundaries (x=12,24 and z=12,24): mostly open, wide archways, low parapets
  const wall=(plane,fixed,u0,y0,t)=>{ // 11 wide, 11 tall (two storeys) segment
    for(let dy=0;dy<11;dy++)for(let du=0;du<11;du++){
      let on=false;
      if(t==='S')on=true;
      else if(t==='A')on=!(du>=3&&du<=7&&(dy<=3||(dy>=6&&dy<=9))); // two big archways, one per storey
      else if(t==='P')on=dy===0||dy===6;
      if(!on)continue;
      if(plane==='x')setT(fixed,y0+dy,u0+du,1);else setT(u0+du,y0+dy,fixed,1);
    }
  };
  for(const f of [12,24])for(let u=0;u<MC;u++)for(let b=0;b<MC;b++){
    for(const plane of ['x','z']){
      const r=R(),t=r<.1?'S':r<.38?'A':r<.5?'P':'E';
      if(t!=='E')wall(plane,f,u*M+1,b*M+1,t);
    }
  }
  // ---- partitions: full walls from side to side (and one full floor) with doorways, windows and holes,
  //      splitting the arena into smaller rooms so fights happen closer
  const PX=[R()<.5?12:24],PZ=[R()<.5?12:24],PY=R()<.5?12:24;
  if(R()<.5)PX.push(PX[0]===12?24:12);else if(R()<.5)PZ.push(PZ[0]===12?24:12);
  const part=(plane,f)=>{
    const put=(u,y,t)=>{if(plane==='x')setT(f,y,u,t);else setT(u,y,f,t);};
    for(let u=1;u<N-1;u++)for(let y=1;y<N-1;y++)put(u,y,1);
    for(let seg=0;seg<MC;seg++)for(let st=0;st<5;st++){         // st: storeys every 6 blocks
      const y0=st*6+1,u0=seg*M+1;
      if(st%2===0||R()<.55){const du=2+(R()*6|0);for(let u=u0+du;u<u0+du+3;u++)for(let y=y0;y<y0+4;y++)put(u,y,0);} // doorway 3 wide, 4 tall
      if(R()<.45){const du=1+(R()*8|0);for(let u=u0+du;u<u0+du+2;u++)for(let y=y0+2;y<y0+4;y++)if(y<N-1)put(u,y,0);}        // window to shoot through
    }
  };
  for(const f of PX)part('x',f);for(const f of PZ)part('z',f);
  box(1,PY,1,N-2,PY,N-2,1);
  let holes=0;
  for(let a=0;a<MC;a++)for(let c=0;c<MC;c++)if(R()<.35||(a===2&&c===2&&holes<2)){
    const x0=a*M+2+(R()*5|0),z0=c*M+2+(R()*5|0);clear(x0,PY,z0,x0+3,PY,z0+3);holes++;}
  // ---- a few steel columns at room corners and beams
  for(const x of [12,24])for(const z of [12,24])for(let b=0;b<MC;b++)if(R()<.18)for(let y=b*M;y<=b*M+M;y++)setT(x,y,z,3);
  for(const y of [12,24])for(const z of [12,24])for(let a=0;a<MC;a++)if(R()<.12)for(let x=a*M;x<=a*M+M;x++)setT(x,y,z,3);
  for(const y of [12,24])for(const x of [12,24])for(let c=0;c<MC;c++)if(R()<.12)for(let z=c*M;z<=c*M+M;z++)setT(x,y,z,3);
  // ---- wide stairs (2 lanes): from y0 up 6 steps to the next floor level
  for(let n=0;n<8;n++){
    const a=R()*MC|0,c=R()*MC|0,lvl=R()*5|0,y0=lvl*6,ax=R()<.5?0:2,rev=R()<.5,lane=1+(R()*7|0);
    const x0=a*M+1,z0=c*M+1;
    for(let s=0;s<6;s++){
      const p=rev?9-s:s+1;
      for(let y=y0+1;y<=y0+1+s;y++)for(let l=0;l<2;l++){if(ax===0)setT(x0+p,y,z0+lane+l,3);else setT(x0+lane+l,y,z0+p,3);}
      if(y0+6===PY&&s<5)for(let l=-1;l<3;l++){if(ax===0)setT(x0+p,PY,z0+lane+l,0);else setT(x0+lane+l,PY,z0+p,0);}
      for(let y=y0+2+s;y<=y0+5+s&&y<N-1;y++)for(let l=0;l<2;l++){if(ax===0){if(tile(x0+p,y,z0+lane+l)!==6&&y>y0+6)setT(x0+p,y,z0+lane+l,0);}else{if(tile(x0+lane+l,y,z0+p)!==6&&y>y0+6)setT(x0+lane+l,y,z0+p,0);}}
    }
  }
  // ---- gravity panels on the outer shell (5x5), each with a ledge to stand on below and above
  const panels=[];
  for(const face of ['x0','x1','z0','z1']){
    for(let n=0;n<2;n++){
      const lvl=1+(R()*4|0),m=R()*MC|0,y0=lvl*6;
      const u0=m*M+4; // panel spans u0..u0+4
      panels.push({face,y0,u0});
      // ledges (3 deep, 9 wide) under and over the panel
      for(const yy of [y0,y0+6]){if(yy>=N-1)continue;
        for(let d=1;d<=3;d++)for(let u=u0-2;u<=u0+6;u++){
          if(face==='x0')setT(d,yy,u,1);else if(face==='x1')setT(N-1-d,yy,u,1);else if(face==='z0')setT(u,yy,d,1);else setT(u,yy,N-1-d,1);}}
    }
  }
  for(const face of ['y0','y1']){
    for(let n=0;n<2;n++){
      const a=R()*MC|0,c=R()*MC|0,u0=a*M+4,v0=c*M+4;
      panels.push({face,u0,v0});
      // a 1-block curb around it: a step on the floor now, a ledge once the arena turns
      const y=face==='y0'?1:N-2;
      for(let u=u0-1;u<=u0+5;u++)for(let v=v0-1;v<=v0+5;v++)if(u===u0-1||u===u0+5||v===v0-1||v===v0+5)setT(u,y,v,1);
    }
  }
  // ---- hazard rims on main floors
  const rim=[];
  for(const y of [6,12,18,24,30])for(let x=1;x<N-1;x++)for(let z=1;z<N-1;z++){
    if(tile(x,y,z)!==1)continue;
    if(!solid(tile(x+1,y,z))||!solid(tile(x-1,y,z))||!solid(tile(x,y,z+1))||!solid(tile(x,y,z-1)))rim.push([x,y,z]);
  }
  for(const [x,y,z] of rim)setT(x,y,z,4);
  for(const p of panels){
    for(let u=0;u<5;u++)for(let v=1;v<=5;v++){
      if(p.face==='x0')setT(0,p.y0+v,p.u0+u,2);else if(p.face==='x1')setT(N-1,p.y0+v,p.u0+u,2);
      else if(p.face==='z0')setT(p.u0+u,p.y0+v,0,2);else if(p.face==='z1')setT(p.u0+u,p.y0+v,N-1,2);
      else if(p.face==='y0')setT(p.u0+u,0,p.v0+v-1,2);else setT(p.u0+u,N-1,p.v0+v-1,2);
    }
  }
}

// ---------------- mesh (greedy merge of coplanar faces) ----------------
const TYPE_COL={1:hexRGB('#3b425c'),2:hexRGB('#5a1048'),3:hexRGB('#4b4d5e'),4:hexRGB('#3b425c'),5:hexRGB('#29f0ff'),6:hexRGB('#1d2133')};
function buildLevelMesh(){
  if(!R.ok)return;
  const out=[];
  const dims=[N,N,N];
  for(let d=0;d<3;d++){
    const u=(d+1)%3,v=(d+2)%3;
    const x=[0,0,0],q=[0,0,0];q[d]=1;
    const mask=new Int32Array(N*N);
    for(x[d]=-1;x[d]<N;){
      // build mask: +id for faces pointing +d, -id for -d
      let n=0;
      for(x[v]=0;x[v]<N;x[v]++)for(x[u]=0;x[u]<N;x[u]++){
        const a=x[d]>=0?grid[gi(x[0],x[1],x[2])]:0;
        const b=x[d]<N-1?grid[gi(x[0]+q[0],x[1]+q[1],x[2]+q[2])]:0;
        let m=0;
        const code=(t,i,j,k)=>t===2?(isLiveK(i,j,k)?20:21):t;
        if(solid(a)&&!solid(b))m=code(a,x[0],x[1],x[2]);
        else if(!solid(a)&&solid(b))m=-code(b,x[0]+q[0],x[1]+q[1],x[2]+q[2]);
        mask[n++]=m;
      }
      x[d]++;
      n=0;
      for(let j=0;j<N;j++)for(let i=0;i<N;){
        const m=mask[n];
        if(m===0){i++;n++;continue;}
        let w=1;while(i+w<N&&mask[n+w]===m)w++;
        let h=1,done=false;
        while(j+h<N){for(let k=0;k<w;k++)if(mask[n+k+h*N]!==m){done=true;break;}if(done)break;h++;}
        // emit quad
        const t=Math.abs(m),sgn=m>0?1:-1;
        const typ=t===20||t===21?2:t;
        const col=TYPE_COL[typ]||TYPE_COL[1];
        const em=t===20?1:t===21?3:typ===3?2:typ===4?4:typ===5?5:typ===6?6:0;
        const p=[0,0,0];p[d]=x[d]*T;
        const corner=(cu,cv)=>{const r=p.slice();r[u]=cu*T;r[v]=cv*T;return r;};
        const c00=corner(i,j),c10=corner(i+w,j),c11=corner(i+w,j+h),c01=corner(i,j+h);
        const nor=[0,0,0];nor[d]=sgn;
        const vert=(c,uu,vv)=>out.push(c[0],c[1],c[2],nor[0],nor[1],nor[2],col[0],col[1],col[2],uu,vv,w,h,em);
        vert(c00,0,0);vert(c10,w,0);vert(c11,w,h);vert(c00,0,0);vert(c11,w,h);vert(c01,0,h);
        for(let l=0;l<h;l++)for(let k=0;k<w;k++)mask[n+k+l*N]=0;
        i+=w;n+=w;
      }
    }
  }
  const gl=R.gl;gl.bindBuffer(gl.ARRAY_BUFFER,R.level);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(out),gl.STATIC_DRAW);R.levelN=out.length/STRIDE;
}

// ---------------- collision ----------------
function overlapSolid(x,y,z,w,h,d){
  d=d||w;
  const i0=Math.floor((x-w/2)/T),i1=Math.floor((x+w/2-.01)/T),k0=Math.floor((z-d/2)/T),k1=Math.floor((z+d/2-.01)/T);
  const j0=Math.floor(y/T),j1=Math.floor((y+h-.01)/T);
  for(let j=j0;j<=j1;j++)for(let k=k0;k<=k1;k++)for(let i=i0;i<=i1;i++)if(solid(tile(i,j,k)))return true;
  return false;
}
function moveBody(e,dt){
  const sp=Math.max(Math.abs(e.vx),Math.abs(e.vy),Math.abs(e.vz));
  const steps=Math.max(1,Math.ceil(sp*dt/10)),sdt=dt/steps;
  let landed=false;e.hitX=0;e.hitZ=0;e.hitCeil=false;
  const w=e.w,h=e.h,wd=e.d||e.w;
  for(let s=0;s<steps;s++){
    // X
    e.x+=e.vx*sdt;
    {const j0=Math.floor(e.y/T),j1=Math.floor((e.y+h-.01)/T),k0=Math.floor((e.z-wd/2)/T),k1=Math.floor((e.z+wd/2-.01)/T);
     if(e.vx>0){const c=Math.floor((e.x+w/2)/T);outer:for(let j=j0;j<=j1;j++)for(let k=k0;k<=k1;k++)if(solid(tile(c,j,k))){e.x=c*T-w/2-.01;e.vx=0;e.hitX=1;break outer;}}
     else if(e.vx<0){const c=Math.floor((e.x-w/2)/T);outer:for(let j=j0;j<=j1;j++)for(let k=k0;k<=k1;k++)if(solid(tile(c,j,k))){e.x=(c+1)*T+w/2+.01;e.vx=0;e.hitX=-1;break outer;}}}
    // Z
    e.z+=e.vz*sdt;
    {const j0=Math.floor(e.y/T),j1=Math.floor((e.y+h-.01)/T),i0=Math.floor((e.x-w/2)/T),i1=Math.floor((e.x+w/2-.01)/T);
     if(e.vz>0){const c=Math.floor((e.z+wd/2)/T);outer:for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(solid(tile(i,j,c))){e.z=c*T-wd/2-.01;e.vz=0;e.hitZ=1;break outer;}}
     else if(e.vz<0){const c=Math.floor((e.z-wd/2)/T);outer:for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(solid(tile(i,j,c))){e.z=(c+1)*T+wd/2+.01;e.vz=0;e.hitZ=-1;break outer;}}}
    // Y
    e.y+=e.vy*sdt;
    {const i0=Math.floor((e.x-w/2)/T),i1=Math.floor((e.x+w/2-.01)/T),k0=Math.floor((e.z-wd/2)/T),k1=Math.floor((e.z+wd/2-.01)/T);
     if(e.vy<0){const r=Math.floor(e.y/T);outer:for(let k=k0;k<=k1;k++)for(let i=i0;i<=i1;i++)if(solid(tile(i,r,k))){e.y=(r+1)*T;e.vy=0;landed=true;break outer;}}
     else if(e.vy>0){const r=Math.floor((e.y+h)/T);outer:for(let k=k0;k<=k1;k++)for(let i=i0;i<=i1;i++)if(solid(tile(i,r,k))){e.y=r*T-h-.01;e.vy=0;e.hitCeil=true;break outer;}}}
  }
  return landed;
}
function groundProbe(e){
  const r=Math.floor((e.y-1)/T);if(Math.abs(e.y-(r+1)*T)>1)return false;
  const wd=e.d||e.w,i0=Math.floor((e.x-e.w/2)/T),i1=Math.floor((e.x+e.w/2-.01)/T),k0=Math.floor((e.z-wd/2)/T),k1=Math.floor((e.z+wd/2-.01)/T);
  for(let k=k0;k<=k1;k++)for(let i=i0;i<=i1;i++)if(solid(tile(i,r,k)))return true;
  return false;
}
function pushOut(e){
  if(!overlapSolid(e.x,e.y,e.z,e.w,e.h,e.d))return;
  for(let r=4;r<=200;r+=4){
    for(let k=0;k<26;k++){
      const th=k/26*Math.PI*2;
      for(const [dx,dy,dz] of [[Math.cos(th),0,Math.sin(th)],[0,1,0],[0,-1,0],[Math.cos(th)*.7,.7,Math.sin(th)*.7]]){
        const nx=e.x+dx*r,ny=e.y+dy*r,nz=e.z+dz*r;
        if(!overlapSolid(nx,ny,nz,e.w,e.h,e.d)){e.x=nx;e.y=ny;e.z=nz;return;}
      }
    }
  }
}
// ray march through voxels; returns distance to first solid (or maxD)
function rayVoxel(o,d,maxD){
  let x=Math.floor(o.x/T),y=Math.floor(o.y/T),z=Math.floor(o.z/T);
  const sx=d.x>0?1:-1,sy=d.y>0?1:-1,sz=d.z>0?1:-1;
  const tdx=Math.abs(T/(d.x||1e-9)),tdy=Math.abs(T/(d.y||1e-9)),tdz=Math.abs(T/(d.z||1e-9));
  let tx=((sx>0?(x+1)*T-o.x:o.x-x*T))/Math.abs(d.x||1e-9);
  let ty=((sy>0?(y+1)*T-o.y:o.y-y*T))/Math.abs(d.y||1e-9);
  let tz=((sz>0?(z+1)*T-o.z:o.z-z*T))/Math.abs(d.z||1e-9);
  let t=0,nAxis=-1;
  if(solid(tile(x,y,z)))return {t:0,axis:-1};
  for(let n=0;n<400;n++){
    if(tx<ty&&tx<tz){x+=sx;t=tx;tx+=tdx;nAxis=0;}else if(ty<tz){y+=sy;t=ty;ty+=tdy;nAxis=1;}else{z+=sz;t=tz;tz+=tdz;nAxis=2;}
    if(t>maxD)return {t:maxD,axis:-1};
    if(solid(tile(x,y,z)))return {t,axis:nAxis,i:x,j:y,k:z};
  }
  return {t:maxD,axis:-1};
}
const losClear=(a,b)=>{const d=vsub(b,a),l=vlen(d);if(l<1)return true;return rayVoxel(a,vscale(d,1/l),l).t>=l-1;};

// ---------------- 90° gravity turns ----------------
// the kicked wall lies in direction dk (one of +x,-x,+z,-z); afterwards it is the floor
const ROT={
  '+x':{vox:(i,j,k)=>[j,N-1-i,k],pt:(x,y,z)=>[y,L-x,z],vec:(x,y,z)=>[y,-x,z],axis:V(0,0,1),a0:Math.PI/2},
  '-x':{vox:(i,j,k)=>[N-1-j,i,k],pt:(x,y,z)=>[L-y,x,z],vec:(x,y,z)=>[-y,x,z],axis:V(0,0,1),a0:-Math.PI/2},
  '+z':{vox:(i,j,k)=>[i,N-1-k,j],pt:(x,y,z)=>[x,L-z,y],vec:(x,y,z)=>[x,-z,y],axis:V(1,0,0),a0:-Math.PI/2},
  '-z':{vox:(i,j,k)=>[i,k,N-1-j],pt:(x,y,z)=>[x,z,L-y],vec:(x,y,z)=>[x,z,-y],axis:V(1,0,0),a0:Math.PI/2},
};
function rotateGridOnly(key){
  const r=ROT[key],ng=new Uint8Array(N*N*N);
  for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){const t=grid[gi(i,j,k)];if(!t)continue;const [a,b,c]=r.vox(i,j,k);ng[gi(a,b,c)]=t;}
  grid=ng;
}
const dirKey=(dx,dz)=>Math.abs(dx)>Math.abs(dz)?(dx>0?'+x':'-x'):(dz>0?'+z':'-z');
const keyVec=k=>k==='+x'?V(1,0,0):k==='-x'?V(-1,0,0):k==='+z'?V(0,0,1):V(0,0,-1);

// ---------------- navigation graph (for bots) ----------------
let nav=null;
const ni=(i,j,k)=>i+N*(j+N*k);
function standable(i,j,k){
  if(i<1||j<1||k<1||i>=N-1||j>=N-2||k>=N-1)return false;
  return !solid(tile(i,j,k))&&!solid(tile(i,j+1,k))&&solid(tile(i,j-1,k));
}
const CARD=[[1,0],[-1,0],[0,1],[0,-1]];
function buildNav(){
  const adj=new Map();
  for(let k=1;k<N-1;k++)for(let j=1;j<N-2;j++)for(let i=1;i<N-1;i++){
    if(!standable(i,j,k))continue;
    const out=[];
    for(const [dx,dz] of CARD){
      const x=i+dx,z=k+dz;
      if(standable(x,j,z)){out.push({i:x,j,k:z,type:'walk'});}
      else if(standable(x,j+1,z)&&!solid(tile(i,j+2,k)))out.push({i:x,j:j+1,k:z,type:'step'});
      else if(!solid(tile(x,j,z))&&!solid(tile(x,j+1,z))){
        let y=j-1;while(y>0&&!standable(x,y,z)&&!solid(tile(x,y,z)))y--;
        if(standable(x,y,z))out.push({i:x,j:y,k:z,type:'fall'});
        // gap jump over the hole (2–3 cells)
        for(let g=2;g<=3;g++){const gx=i+dx*g,gz=k+dz*g;if(standable(gx,j,gz)&&!solid(tile(i+dx,j+2,k+dz))&&!solid(tile(gx,j+2,gz))){out.push({i:gx,j,k:gz,type:'gap'});break;}}
      }
      // jump up to a ledge (grab) 2..4 blocks higher, right beside us
      for(let dy=2;dy<=4;dy++){ // jump + grab reaches about 4 blocks
        let clear=true;for(let y=j+2;y<=j+dy+1;y++)if(solid(tile(i,y,k))){clear=false;break;}
        if(!clear)break;
        if(standable(x,j+dy,z)&&solid(tile(x,j+dy-1,z))){out.push({i:x,j:j+dy,k:z,type:'jump',dy});break;}
      }
    }
    adj.set(ni(i,j,k),out);
  }
  // cells where you can kick a live gravity panel
  const kickCells=[];
  for(const [id,_] of adj){
    const i=id%N,j=Math.floor(id/N)%N,k=Math.floor(id/(N*N));
    for(const [dx,dz] of CARD){if(isLiveK(i+dx,j,k+dz)||isLiveK(i+dx,j+1,k+dz)){kickCells.push({i,j,k,dx,dz});break;}}
  }
  nav={adj,kickCells,ver:(nav?nav.ver:0)+1};
}
function findPath(si,sj,sk,gi_,gj,gk){
  if(!nav)buildNav();
  const start=ni(si,sj,sk);if(!nav.adj.has(start))return null;
  const prev=new Map(),via=new Map();prev.set(start,-1);
  const q=[start];let best=start,bd=1e9;
  for(let h=0;h<q.length&&h<6000;h++){
    const n=q[h],x=n%N,y=Math.floor(n/N)%N,z=Math.floor(n/(N*N));
    const d=Math.abs(x-gi_)+Math.abs(z-gk)+Math.abs(y-gj)*1.3;
    if(d<bd){bd=d;best=n;if(d===0)break;}
    for(const e of nav.adj.get(n)){const m=ni(e.i,e.j,e.k);if(prev.has(m)||!nav.adj.has(m))continue;prev.set(m,n);via.set(m,e);q.push(m);}
  }
  const path=[];let n=best;
  while(prev.get(n)!==-1){const e=via.get(n),p=prev.get(n);path.unshift({i:e.i,j:e.j,k:e.k,type:e.type,dy:e.dy||0,fi:p%N,fj:Math.floor(p/N)%N,fk:Math.floor(p/(N*N))});n=p;}
  return path;
}
const cellOf=e=>[Math.floor(e.x/T),Math.floor((e.y+1)/T),Math.floor(e.z/T)];
function spawnPoints(){
  if(!nav)buildNav();
  const pts=[];for(const [id] of nav.adj){const i=id%N,j=Math.floor(id/N)%N,k=Math.floor(id/(N*N));if(!solid(tile(i,j+2,k)))pts.push({x:i*T+T/2,y:j*T,z:k*T+T/2});}
  return pts;
}
// every "down" orientation must offer reachable live gravity panels
function levelOK(){
  const save=grid.slice();
  const seqs=[[],['+x'],['-x'],['+z'],['-z'],['+x','+x']];
  let ok=true;
  for(const seq of seqs){
    grid=save.slice();for(const s of seq)rotateGridOnly(s);
    buildNav();
    if(nav.adj.size<400){ok=false;break;}
    // biggest reachable region from a few starts
    const ids=[...nav.adj.keys()];let bestSeen=null,bestN=0;
    for(let t=0;t<5;t++){
      const s=ids[(t*7919)%ids.length],seen=new Set([s]),q=[s];
      for(let h=0;h<q.length;h++)for(const e of nav.adj.get(q[h])){const m=ni(e.i,e.j,e.k);if(!seen.has(m)&&nav.adj.has(m)){seen.add(m);q.push(m);}}
      if(seen.size>bestN){bestN=seen.size;bestSeen=seen;}
    }
    if(bestN<nav.adj.size*.5){ok=false;break;}
    const live=nav.kickCells.filter(c=>bestSeen.has(ni(c.i,c.j,c.k)));
    const groups=new Set(live.map(c=>(c.dx+','+c.dz)+':'+Math.floor(c.j/6)+':'+Math.floor((c.dx?c.k:c.i)/6)));
    if(groups.size<2){ok=false;break;}
  }
  grid=save;nav=null;
  return ok;
}
