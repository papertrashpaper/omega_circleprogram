export const ROLES=['H1','MT','ST','D1','D2','D3','D4','H2'];
export const CONFIG={arenaRadius:20,towerRadius:2.5,towerDistance:12.4,outerDistance:18,blastRadius:16,transferDistance:1.5,moveSpeed:8,firstDuration:14,roundDuration:8,waitDuration:1.5,extendWaitMax:3,pickupRadius:3.5,tetherWaitRadius:4,avoidRadius:6,standbyBlastMargin:3.1,retreatRadius:16};
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const polar=(a,r)=>({x:Math.sin(a)*r,y:-Math.cos(a)*r});
export const action=(n,round)=>n===round+1?'塔':n===((round+2)%4)+1?'線':'休み';
const shuffled=(a,rng)=>{a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export function segmentDistance(p,b){let l=b.x*b.x+b.y*b.y;let t=l?Math.max(0,Math.min(1,(p.x*b.x+p.y*b.y)/l)):0;return Math.hypot(p.x-b.x*t,p.y-b.y*t)}
export function makeLayout(rng=Math.random,mode='random',previous=null){
 const first=Math.floor(rng()*4), delta=mode==='opposite'?2:mode==='adjacent'?(rng()<.5?1:3):1+Math.floor(rng()*3);
 const dirs=[first,(first+delta)%4].sort((a,b)=>a-b);
 let offset=(rng()<.5?-1:1)*Math.atan(3/12);
 if(previous&&dirs.some(d=>previous.dirs.includes(d)))offset=-previous.offset;
 return {dirs,offset,towers:dirs.map(d=>({...polar(d*Math.PI/2+offset,CONFIG.towerDistance),dir:d})),lines:[0,1,2,3].filter(d=>!dirs.includes(d)).map(d=>({...polar(d*Math.PI/2+offset,CONFIG.outerDistance),dir:d}))};
}
export class Simulation{
 constructor({role='H2',number=1,pattern='random',rng=Math.random,config={}}={}){
  this.config={...CONFIG,...config};this.rng=rng;this.pattern=pattern;this.userRole=role;this.round=0;this.elapsed=0;this.total=0;this.state='ready';this.message='';this.history=[];this.effects=[];this.layouts=[];for(let i=0;i<4;i++)this.layouts.push(makeLayout(rng,pattern,this.layouts[i-1]));
  const n=number||1+Math.floor(rng()*4),nums=[1,1,2,2,3,3,4,4];nums.splice(nums.indexOf(n),1);const rest=shuffled(nums,rng);
  this.players=ROLES.map((role,i)=>({role,number:role===this.userRole?n:rest.pop(),x:(i-3.5)*.3,y:16.4,target:null,waitUntil:0,scarUntil:0,hpUntil:0}));
  this.user=this.players.find(p=>p.role===this.userRole);const owners=shuffled(this.players,rng);this.initialOwners=owners.slice(0,2).map(p=>p.role);this.tethers=[];
 }
 get numbersVisible(){return this.total>=4}
 get towersVisible(){return this.total>=5}
 get nextTowersVisible(){return this.round<3&&this.remaining<=1+1e-8&&this.towersVisible}
 get cast(){if(this.state==='ready')return null;if(this.total<4)return {name:'サークルプログラム',remaining:4-this.total,duration:4};if(this.total>=6&&this.total<14)return {name:'ブラスター',remaining:14-this.total,duration:8};return null}
 get layout(){return this.layouts[this.round]}
 get duration(){return this.round===0?this.config.firstDuration:this.config.roundDuration}
 get remaining(){return Math.max(0,this.duration-this.elapsed)}
 rank(p){return this.players.filter(x=>x.number===p.number).indexOf(p)}
 byRole(role){return this.players.find(p=>p.role===role)}
 holding(p){return this.tethers.findIndex(t=>t.owner===p.role)}
 job(p){return action(p.number,this.round)}
 goal(p){
  const rank=this.rank(p),job=this.job(p);
  if(job==='塔')return this.layout.towers[rank];
  if(job==='線')return this.layout.lines[rank];
  return this.standbyGoal(p);
 }
 safeWaitingPoint(point){
  return this.layout.towers.every(t=>distance(point,t)>this.config.towerRadius)&&this.layout.lines.every(g=>distance(point,g)>=this.config.blastRadius);
 }
 standbyGoal(p){
  if(p.standbyRound===this.round)return p.standby;
  const next=this.round<3&&action(p.number,this.round+1)==='線';
  const line=this.layout.lines[this.rank(p)],pickup=polar(Math.atan2(line.x,-line.y),this.config.pickupRadius);
  const original=this.layout.towers[this.rank(p)],fallback={x:original.x*.67,y:original.y*.67};
  let best=fallback,score=Infinity;
  for(let r=this.config.avoidRadius;r<=17;r+=.5)for(let i=0;i<72;i++){
   const point=polar(i*Math.PI/36,r);
   if(!this.safeWaitingPoint(point)||this.layout.lines.some(g=>distance(point,g)<this.config.blastRadius+this.config.standbyBlastMargin||segmentDistance(point,g)<this.config.transferDistance+.4)||this.layout.towers.some(t=>distance(point,t)<this.config.towerRadius+.4))continue;
   const value=next?distance(point,pickup):distance(point,p);
   if(value<score){score=value;best=point}
  }
  p.standbyRound=this.round;p.standby=best;return best;
 }
 start(){if(this.state==='ready')this.state='running'}
 take(p=this.user,index=null){
  if(this.state!=='running')return false;
  if(this.holding(p)>=0){if(p===this.user)this.message='すでに線を持っています';return false}
  const candidates=this.tethers.map((t,i)=>({i,d:segmentDistance(p,this.byRole(t.owner))})).filter(t=>index===null||t.i===index).sort((a,b)=>a.d-b.d);
  const nearest=candidates[0];
  if(!nearest||nearest.d>this.config.transferDistance){if(p===this.user)this.message='線または線の持ち主に近づいてください';return false}
  const tether=this.tethers[nearest.i];
  tether.owner=p.role;
  p.tetherAcquiredAt=this.total;p.extendWaitingAt=undefined;p.extending=false;
  // A transfer changes the line geometry: require existing contacts to leave before retaking.
  tether.contacts=new Set(this.players.filter(x=>segmentDistance(x,p)<=this.config.transferDistance).map(x=>x.role));
  if(p===this.user)this.message='線を受け取りました。担当の外周へ移動';
  return true;
 }
 contact(p=this.user){
  const order=this.tethers.map((t,i)=>i),preferred=this.pickupOrder?.[this.rank(p)];
  if(this.job(p)==='線'&&preferred!==undefined)order.sort((a,b)=>(b===preferred)-(a===preferred));
  for(const i of order){
   const tether=this.tethers[i],near=segmentDistance(p,this.byRole(tether.owner))<=this.config.transferDistance;
   const entered=near&&!tether.contacts.has(p.role);
   if(near)tether.contacts.add(p.role);else tether.contacts.delete(p.role);
   if(entered&&this.holding(p)<0)this.take(p,i);
  }
 }
 move(p,target,dt,speed=this.config.moveSpeed){const d=distance(p,target);if(d<.01)return;const k=Math.min(1,speed*dt/d);p.x+=(target.x-p.x)*k;p.y+=(target.y-p.y)*k;const r=Math.hypot(p.x,p.y);if(r>19.85){p.x*=19.85/r;p.y*=19.85/r}}
 // Short tangent-and-arc detour outside the waiting tether holders, not the arena edge.
 routeTarget(p,goal,radius=this.config.avoidRadius){
  const r=Math.hypot(p.x,p.y);
  if(r<radius-.05)return polar(Math.atan2(p.x,-p.y),radius);
  const a=Math.atan2(p.x,-p.y),b=Math.atan2(goal.x,-goal.y);
  let turn=Math.atan2(Math.sin(b-a),Math.cos(b-a)),detour=false;
  for(const t of this.tethers){
   if(t.owner===p.role)continue;
   const owner=this.byRole(t.owner);
   if(Math.hypot(owner.x,owner.y)<radius-this.config.transferDistance)continue;
   const between=Math.atan2(Math.sin(Math.atan2(owner.x,-owner.y)-a),Math.cos(Math.atan2(owner.x,-owner.y)-a));
   if(Math.sign(between)===Math.sign(turn)&&Math.abs(between)<Math.abs(turn)){turn-=Math.sign(turn)*Math.PI*2;detour=true;break}
  }
  const dx=goal.x-p.x,dy=goal.y-p.y,l=dx*dx+dy*dy;
  const u=l?Math.max(0,Math.min(1,-(p.x*dx+p.y*dy)/l)):0;
  if(!detour&&Math.hypot(p.x+u*dx,p.y+u*dy)>=radius-.03)return goal;
  const sign=turn<0?-1:1,offset=Math.acos(Math.min(1,radius/r));
  return polar(a+sign*Math.max(.035,offset),radius);
 }
 peripheralMove(p,goal,dt){
  if(distance(p,goal)<.05)return;
  const hazards=this.tethers.filter(t=>t.owner!==p.role).flatMap(t=>{const owner=this.byRole(t.owner);return this.job(owner)==='線'?[{...owner},{...this.goal(owner)}]:[{...owner}]});
  const clearance=this.config.transferDistance+.12,inner=this.config.avoidRadius-.2;
  const pointSeg=(q,a,b)=>segmentDistance({x:q.x-a.x,y:q.y-a.y},{x:b.x-a.x,y:b.y-a.y});
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const origin={x:0,y:0};
  const edgeSafe=(a,b,escape=false)=>{
   if(pointSeg(origin,a,b)<inner&&!escape)return false;
   return hazards.every(h=>{
    const da=segmentDistance(a,h),db=segmentDistance(b,h);
    if(escape&&da<clearance)return db>da+.01;
    if(Math.min(da,db,pointSeg(origin,a,b),pointSeg(h,a,b))<clearance)return false;
    return !(cross(a,b,origin)*cross(a,b,h)<0&&cross(origin,h,a)*cross(origin,h,b)<0);
   });
  };
  const key=`${this.round}:${goal.x.toFixed(2)}:${goal.y.toFixed(2)}`;
  if(p.navKey!==key){p.navKey=key;p.nav=[]}
  while(p.nav?.length&&distance(p,p.nav[0])<.12)p.nav.shift();
  if(!p.nav?.length||!edgeSafe(p,p.nav[0],true)){
   const nodes=[{x:p.x,y:p.y},goal];
   for(const r of [this.config.avoidRadius,19.8])for(let i=0;i<32;i++)nodes.push(polar(i*Math.PI/16,r));
   const costs=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),done=new Set();costs[0]=0;
   for(let n=0;n<nodes.length;n++){
    let u=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(u<0||costs[i]<costs[u]))u=i;
    if(u<0||!Number.isFinite(costs[u])||u===1)break;done.add(u);
    for(let v=1;v<nodes.length;v++)if(!done.has(v)){
     const value=costs[u]+distance(nodes[u],nodes[v]);
     if(value<costs[v]&&edgeSafe(nodes[u],nodes[v],u===0)){costs[v]=value;prev[v]=u}
    }
   }
   p.nav=[];if(prev[1]>=0){let v=1;while(v!==0){p.nav.unshift(nodes[v]);v=prev[v]}}
  }
  if(p.nav.length)this.move(p,p.nav[0],dt);
 }
 assignPickup(){
  const angle=t=>{const p=this.byRole(t.owner);return (Math.atan2(p.x,-p.y)+Math.PI*2+Math.PI/4)%(Math.PI*2)};
  this.pickupOrder=this.tethers.map((t,i)=>i).sort((a,b)=>angle(this.tethers[a])-angle(this.tethers[b]));
 }
 pickupGoal(p){
  const index=this.pickupOrder?.[this.rank(p)],t=this.tethers[index];
  if(!t)return {x:p.x,y:p.y};
  const owner=this.byRole(t.owner);return polar(Math.atan2(owner.x,-owner.y),this.config.pickupRadius);
 }
 bot(p,dt){
  const job=this.job(p),rank=this.rank(p);
  if(this.total<4)return;
  if(this.round===0&&this.total<6){if(p.number===3)this.move(p,{x:0,y:4.2},dt);return}
  if(this.round===0&&p.number!==3&&this.total<6+this.config.waitDuration)return;
  if(this.total<p.waitUntil){
   if(p.retreatGoal)this.move(p,p.retreatGoal,dt);
   return;
  }
  if(job==='線'){
   if(this.holding(p)<0){
    const index=this.pickupOrder?.[rank],tether=this.tethers[index];
    if(!tether)return;
    const target=this.pickupGoal(p),owner=this.byRole(tether.owner);
    if(tether.contacts.has(p.role)){
     const angle=Math.atan2(owner.x,-owner.y);
     this.move(p,polar(angle+(rank?1:-1)*.65,this.config.pickupRadius+1),dt);
    }else{
     const a=Math.atan2(p.x,-p.y),b=Math.atan2(target.x,-target.y),r=this.config.avoidRadius;
     let turn=Math.atan2(Math.sin(b-a),Math.cos(b-a));
     const other=this.tethers.find(t=>t!==tether),otherOwner=other&&this.byRole(other.owner);
     if(otherOwner&&Math.hypot(otherOwner.x,otherOwner.y)>r-this.config.transferDistance){
      const between=Math.atan2(Math.sin(Math.atan2(otherOwner.x,-otherOwner.y)-a),Math.cos(Math.atan2(otherOwner.x,-otherOwner.y)-a));
      if(Math.sign(between)===Math.sign(turn)&&Math.abs(between)<Math.abs(turn))turn-=Math.sign(turn)*Math.PI*2;
     }
     if(Math.abs(turn)<.18)this.move(p,target,dt);
     else if(Math.hypot(p.x,p.y)>r+.15)this.move(p,polar(a,r),dt);
     else this.move(p,polar(a+Math.sign(turn)*Math.min(Math.abs(turn),this.config.moveSpeed*dt/r),r),dt);
    }
    return;
   }
   if(p.tetherAcquiredAt===undefined)p.tetherAcquiredAt=this.total;
   const destination=this.goal(p);
   const clear=this.players.filter(x=>x!==p&&this.job(x)!=='線').every(x=>
    distance(x,destination)>=this.config.blastRadius&&segmentDistance(x,destination)>this.config.transferDistance+.5);
   const waiting=polar(Math.atan2(destination.x,-destination.y),this.config.tetherWaitRadius);
   if(distance(p,waiting)<.15&&p.extendWaitingAt===undefined)p.extendWaitingAt=this.total;
   if(clear||(this.total-p.tetherAcquiredAt>=this.config.extendWaitMax-1e-8))p.extending=true;
   this.move(p,p.extending?destination:waiting,dt);
  }else this.peripheralMove(p,this.goal(p),dt);
 }
 tick(dt,{direction=null,autoUser=false}={}){
  if(this.state!=='running')return;
  dt=Math.min(dt,.05);this.elapsed+=dt;this.total+=dt;
  if(this.total>=6&&this.tethers.length===0){
   this.tethers=this.initialOwners.map(owner=>({owner,contacts:new Set()}));
   this.assignPickup();
   for(const t of this.tethers){const p=this.byRole(t.owner);p.tetherAcquiredAt=this.total;p.extendWaitingAt=undefined;p.extending=false;}
   // Players already gathered at C do not steal newly spawned lines without moving away and back.
   for(const t of this.tethers)t.contacts=new Set(this.players.filter(p=>p.number!==3&&segmentDistance(p,this.byRole(t.owner))<=this.config.transferDistance).map(p=>p.role));
  }
  for(const p of this.players)if(p!==this.user||autoUser)this.bot(p,dt);
  if(!autoUser){if(direction&&(direction.x||direction.y)){this.user.target=null;let len=Math.hypot(direction.x,direction.y);this.move(this.user,{x:this.user.x+direction.x/len,y:this.user.y+direction.y/len},dt,this.config.moveSpeed)}else if(this.user.target)this.move(this.user,this.user.target,dt,this.config.moveSpeed)}
  for(const p of this.players)this.contact(p);
  this.effects=this.effects.filter(e=>e.until>this.total);
  if(this.elapsed>=this.duration)this.resolve();
 }
 resolve(){
  const errors=[];const holders=this.tethers.map(t=>this.byRole(t.owner));
  for(let i=0;i<2;i++){
   const tower=this.layout.towers[i],expected=this.players.filter(p=>this.job(p)==='塔')[i];
   const inside=this.players.filter(p=>distance(p,tower)<=this.config.towerRadius);
   if(!inside.includes(expected))errors.push(`${expected.role}：担当の塔に入っていません`);
   if(inside.some(p=>p!==expected))errors.push(`塔に担当外の人が入っています（${inside.filter(p=>p!==expected).map(p=>p.role).join('・')}）`);
   const holder=holders[i];
   if(this.job(holder)!=='線')errors.push(`${holder.role}：次の線担当に受け渡せていません`);
   else if(distance(holder,this.goal(holder))>3.3)errors.push(`${holder.role}：線を伸ばす位置が優先度と異なります`);
   for(const p of this.players)if(p!==holder&&distance(p,holder)<this.config.blastRadius)errors.push(`${holder.role}のブラスターが${p.role}に命中`);
   this.effects.push({...holder,until:this.total+1.1,radius:this.config.blastRadius});
  }
  for(const p of this.players)if(this.job(p)!=='休み'&&p.scarUntil>this.total+.05)errors.push(`${p.role}：破滅の刻印が残ったまま連続処理`);
  this.history.push({round:this.round+1,time:this.total,errors});
  if(errors.length){this.state='failed';this.message=[...new Set(errors)].join('\n');return}
  for(const p of this.players)if(this.job(p)!=='休み'){p.scarUntil=this.total+10;if(this.job(p)==='線')p.hpUntil=this.total+10}
  if(this.round===3){this.state='cleared';this.message='4回すべての処理に成功しました';return}
  for(const p of holders){p.waitUntil=this.total+this.config.waitDuration;p.retreatGoal=polar(Math.atan2(p.x,-p.y),this.config.retreatRadius);}
  this.linesReleased=false;this.round++;this.elapsed=0;this.assignPickup();this.message=`${this.round}回目成功。次の担当へ`;
 }
}
