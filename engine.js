export const ROLES=['H1','MT','ST','D1','D2','D3','D4','H2'];
export const CONFIG={arenaRadius:20,towerRadius:2.5,towerDistance:12.4,outerDistance:18,blastRadius:16,transferDistance:1.5,moveSpeed:6,firstDuration:12,roundDuration:10};
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const polar=(a,r)=>({x:Math.sin(a)*r,y:-Math.cos(a)*r});
export const action=(n,round)=>n===round+1?'塔':n===((round+2)%4)+1?'線':'休み';
const shuffled=(a,rng)=>{a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export function segmentDistance(p,b){let l=b.x*b.x+b.y*b.y;let t=l?Math.max(0,Math.min(1,(p.x*b.x+p.y*b.y)/l)):0;return Math.hypot(p.x-b.x*t,p.y-b.y*t)}
export function makeLayout(rng=Math.random,mode='random'){
 const first=Math.floor(rng()*4), delta=mode==='opposite'?2:mode==='adjacent'?(rng()<.5?1:3):1+Math.floor(rng()*3);
 const dirs=[first,(first+delta)%4].sort((a,b)=>a-b),offset=(rng()<.5?-1:1)*Math.atan(3/12);
 return {dirs,offset,towers:dirs.map(d=>({...polar(d*Math.PI/2+offset,CONFIG.towerDistance),dir:d})),lines:[0,1,2,3].filter(d=>!dirs.includes(d)).map(d=>({...polar(d*Math.PI/2+offset,CONFIG.outerDistance),dir:d}))};
}
export class Simulation{
 constructor({role='H2',number=1,pattern='random',rng=Math.random,config={}}={}){
  this.config={...CONFIG,...config};this.rng=rng;this.pattern=pattern;this.userRole=role;this.round=0;this.elapsed=0;this.total=0;this.state='ready';this.message='';this.history=[];this.effects=[];this.layouts=Array.from({length:4},()=>makeLayout(rng,pattern));
  const n=number||1+Math.floor(rng()*4),nums=[1,1,2,2,3,3,4,4];nums.splice(nums.indexOf(n),1);const rest=shuffled(nums,rng);
  this.players=ROLES.map((role,i)=>({role,number:role===this.userRole?n:rest.pop(),...polar(i*Math.PI/4,3.5),target:null,scarUntil:0,hpUntil:0}));
  this.user=this.players.find(p=>p.role===this.userRole);const owners=shuffled(this.players,rng);this.tethers=[{owner:owners[0].role,contacts:new Set()},{owner:owners[1].role,contacts:new Set()}];
 }
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
  const t=this.layout.towers[rank];return {x:t.x*.67,y:t.y*.67};
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
  // A transfer changes the line geometry: require existing contacts to leave before retaking.
  tether.contacts=new Set(this.players.filter(x=>segmentDistance(x,p)<=this.config.transferDistance).map(x=>x.role));
  if(p===this.user)this.message='線を受け取りました。担当の外周へ移動';
  return true;
 }
 contact(p=this.user){
  for(let i=0;i<this.tethers.length;i++){
   const tether=this.tethers[i],near=segmentDistance(p,this.byRole(tether.owner))<=this.config.transferDistance;
   const entered=near&&!tether.contacts.has(p.role);
   if(near)tether.contacts.add(p.role);else tether.contacts.delete(p.role);
   if(entered&&this.holding(p)<0)this.take(p,i);
  }
 }
 move(p,target,dt,speed=this.config.moveSpeed){const d=distance(p,target);if(d<.01)return;const k=Math.min(1,speed*dt/d);p.x+=(target.x-p.x)*k;p.y+=(target.y-p.y)*k;const r=Math.hypot(p.x,p.y);if(r>19){p.x*=19/r;p.y*=19/r}}
 bot(p,dt){
  const job=this.job(p),rank=this.rank(p);
  if(job==='線'&&this.holding(p)<0){
   const available=this.tethers.map((t,i)=>i).filter(i=>this.job(this.byRole(this.tethers[i].owner))!=='線');
   const index=available.includes(rank)?rank:available[0];
   if(index===undefined)return;
   const owner=this.byRole(this.tethers[index].owner);
   const target={x:owner.x*.27,y:owner.y*.27};this.move(p,target,dt);
   if(this.elapsed>1.1+rank*.4)this.take(p,index);
  }else{
   // Receivers stay near the centre until both intended tether holders are ready.
   const holdersReady=this.tethers.every(t=>this.job(this.byRole(t.owner))==='線');
   const g=job==='線'&&(!holdersReady||this.elapsed<2)?polar((rank?1:-1)*Math.PI/2,2.5):this.goal(p);
   this.move(p,g,dt);
  }
 }
 tick(dt,{direction=null,sprint=false,autoUser=false}={}){
  if(this.state!=='running')return;
  dt=Math.min(dt,.05);this.elapsed+=dt;this.total+=dt;
  for(const p of this.players)if(p!==this.user||autoUser)this.bot(p,dt);
  if(!autoUser){if(direction&&(direction.x||direction.y)){this.user.target=null;let len=Math.hypot(direction.x,direction.y);this.move(this.user,{x:this.user.x+direction.x/len,y:this.user.y+direction.y/len},dt,this.config.moveSpeed*(sprint?1.3:1))}else if(this.user.target)this.move(this.user,this.user.target,dt,this.config.moveSpeed*(sprint?1.3:1))}
  if(!autoUser)this.contact();
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
  this.history.push({round:this.round+1,errors});
  if(errors.length){this.state='failed';this.message=[...new Set(errors)].join('\n');return}
  for(const p of this.players)if(this.job(p)!=='休み'){p.scarUntil=this.total+10;if(this.job(p)==='線')p.hpUntil=this.total+10}
  if(this.round===3){this.state='cleared';this.message='4回すべての処理に成功しました';return}
  this.round++;this.elapsed=0;this.message=`${this.round}回目成功。次の担当へ`;
 }
}
