import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,ROLES,action,makeLayout} from '../engine.js';
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
test('numbers are paired, selected number and H2 priority are preserved',()=>{
 for(let n=1;n<=4;n++){const s=new Simulation({number:n,rng:random(n)});assert.equal(s.user.number,n);assert.equal(s.rank(s.user),1);for(let i=1;i<=4;i++)assert.equal(s.players.filter(p=>p.number===i).length,2)}
});
test('all patterns have two different tower directions and complementary tether directions',()=>{
 for(let seed=0;seed<100;seed++)for(const mode of ['random','adjacent','opposite']){const l=makeLayout(random(seed),mode);assert.equal(new Set([...l.towers,...l.lines].map(x=>x.dir)).size,4);let d=Math.abs(l.dirs[0]-l.dirs[1]);if(mode==='opposite')assert.equal(d,2);if(mode==='adjacent')assert.ok(d===1||d===3)}
});
test('automatic processing clears all roles and numbers over many seeded patterns',()=>{
 for(let seed=0;seed<48;seed++)for(const role of ROLES)for(let number=1;number<=4;number++){
  const s=new Simulation({role,number,rng:random(seed)});const take=s.take.bind(s);s.take=(p,index)=>{const ok=take(p,index);if(ok&&s.job(p)==='線')assert.equal(s.holding(p),s.pickupOrder[s.rank(p)],`pickup priority seed=${seed} ${role} ${number}`);return ok};s.start();for(let t=0;t<2700&&s.state==='running';t++)s.tick(1/60,{autoUser:true});assert.equal(s.state,'cleared',`seed=${seed} ${role} ${number}: ${s.message}`);
 }
});
test('missed tower fails and taking a distant tether is rejected',()=>{
 const s=new Simulation({rng:random(7)});s.start();s.user.x=0;s.user.y=19;assert.equal(s.take(),false);for(let t=0;t<1000&&s.state==='running';t++)s.tick(1/60);assert.equal(s.state,'failed');assert.match(s.message,/H2.*塔/);
});
test('tethers persist at round transition until another player takes them',()=>{
 const s=new Simulation({rng:random(12)});s.start();while(s.round===0&&s.state==='running')s.tick(1/60,{autoUser:true});assert.equal(s.round,1);for(const t of s.tethers)assert.equal(s.byRole(t.owner).number,3);
 const previous=[...s.tethers.map(t=>t.owner)];s.state='paused';s.tick(1/60);assert.deepEqual(s.tethers.map(t=>t.owner),previous);
});
test('everyone alternates work and rest',()=>{for(let n=1;n<=4;n++){const a=[0,1,2,3].map(r=>action(n,r));assert.equal(a.filter(x=>x==='塔').length,1);assert.equal(a.filter(x=>x==='線').length,1);assert.equal(Math.abs(a.indexOf('塔')-a.indexOf('線')),2)}});
test('manual player receives on contact without input, including off-duty contact',()=>{
 const s=new Simulation({number:1,rng:random(7)});s.bot=()=>{};
 const owner=s.players.find(p=>p!==s.user),other=s.players.find(p=>p!==s.user&&p!==owner);
 Object.assign(owner,{x:10,y:0});Object.assign(other,{x:0,y:-10});
 s.tethers=[{owner:owner.role,contacts:new Set()},{owner:other.role,contacts:new Set()}];
 Object.assign(s.user,{x:5,y:3});s.start();s.tick(.01);assert.equal(s.holding(s.user),-1);
 s.user.y=1;s.tick(.01);assert.equal(s.holding(s.user),0);assert.equal(s.job(s.user),'塔');
 // Another player takes the line at the same position. Standing still must not steal it back.
 Object.assign(owner,{x:5,y:1});assert.equal(s.take(owner,0),true);
 for(let i=0;i<20;i++)s.tick(.01);assert.equal(s.tethers[0].owner,owner.role);
 s.user.y=4;s.tick(.01);s.user.y=1;s.tick(.01);assert.equal(s.tethers[0].owner,s.user.role);
 assert.equal(s.tethers.filter(t=>t.owner===s.user.role).length,1);
});
test('contact is inactive while ready or paused',()=>{
 const s=new Simulation({rng:random(8)});s.bot=()=>{};
 s.user.x=0;s.user.y=0;const owners=s.tethers.map(t=>t.owner);
 s.tick(.05);assert.deepEqual(s.tethers.map(t=>t.owner),owners);
 s.state='paused';s.tick(.05);assert.deepEqual(s.tethers.map(t=>t.owner),owners);
});
test('opening reveal, casts and next tower previews follow the requested timeline',()=>{
 const s=new Simulation({rng:random(2)});s.start();
 const until=t=>{while(s.total<t-1e-7&&s.state==='running')s.tick(Math.min(.01,t-s.total),{autoUser:true})};
 assert.ok(s.players.every(p=>p.y===16.4));assert.equal(s.tethers.length,0);
 until(3.99);assert.equal(s.numbersVisible,false);assert.equal(s.cast.name,'サークルプログラム');
 until(4.01);assert.equal(s.numbersVisible,true);assert.equal(s.towersVisible,false);assert.equal(s.cast,null);
 until(5.01);assert.equal(s.towersVisible,true);assert.equal(s.tethers.length,0);
 until(6.01);assert.equal(s.tethers.length,2);assert.equal(s.cast.name,'ブラスター');
 until(7.49);assert.ok(s.players.filter(p=>p.number!==3).every(p=>p.y===16.4));
 until(12.99);assert.equal(s.nextTowersVisible,false);
 until(13.01);assert.equal(s.nextTowersVisible,true);
 until(14.02);assert.equal(s.round,1);assert.equal(s.cast,null);
 const old=s.players.filter(p=>p.number===3),positions=old.map(p=>({x:p.x,y:p.y}));
 until(15.49);assert.deepEqual(old.map(p=>({x:p.x,y:p.y})),positions);
 until(15.6);assert.ok(old.some((p,i)=>p.x!==positions[i].x||p.y!==positions[i].y));
 until(21.02);assert.equal(s.nextTowersVisible,true);
 until(38.1);assert.equal(s.state,'cleared');
 assert.equal(s.history.length,4);s.history.forEach((h,i)=>assert.ok(Math.abs(h.time-(14+8*i))<.05));
});
test('consecutive layouts never reuse a tower position',()=>{
 for(const pattern of ['random','adjacent','opposite'])for(let seed=0;seed<100;seed++){
  const s=new Simulation({pattern,rng:random(seed)});
  for(let i=1;i<4;i++)for(const t of s.layouts[i].towers)for(const prev of s.layouts[i-1].towers){
   assert.ok(Math.hypot(t.x-prev.x,t.y-prev.y)>1);
   if(t.dir===prev.dir)assert.equal(s.layouts[i].offset,-s.layouts[i-1].offset);
  }
 }
});
test('NPC and manual movement use the same speed without catch-up or sprint',()=>{
 for(const pattern of ['random','adjacent','opposite'])for(let seed=0;seed<12;seed++){
  const s=new Simulation({pattern,rng:random(seed)});s.start();
  for(let i=0;i<2500&&s.state==='running';i++){
   const before=s.players.map(p=>({x:p.x,y:p.y}));s.tick(1/60,{autoUser:true});
   s.players.forEach((p,j)=>assert.ok(Math.hypot(p.x-before[j].x,p.y-before[j].y)<=s.config.moveSpeed/60+1e-8));
  }
  assert.equal(s.state,'cleared',`${pattern} ${seed}: ${s.message}`);
 }
 const s=new Simulation();s.start();const before={...s.user};s.tick(.05,{direction:{x:1,y:0},sprint:true});
 assert.ok(Math.abs(Math.hypot(s.user.x-before.x,s.user.y-before.y)-s.config.moveSpeed*.05)<1e-8);
});

test('pickup priority treats both north candidates before east, south and west',()=>{
 const s=new Simulation();s.tethers=[{owner:'H1',contacts:new Set()},{owner:'MT',contacts:new Set()}];
 Object.assign(s.byRole('H1'),{x:-3,y:-12});Object.assign(s.byRole('MT'),{x:12,y:3});s.assignPickup();assert.deepEqual(s.pickupOrder,[0,1]);
 Object.assign(s.byRole('H1'),{x:-12,y:3});Object.assign(s.byRole('MT'),{x:3,y:12});s.assignPickup();assert.deepEqual(s.pickupOrder,[1,0]);
});
test('waiting players may occupy any safe point outside towers',()=>{
 const s=new Simulation({rng:random(12)});s.start();s.total=14;s.elapsed=14;
 for(const p of s.players)Object.assign(p,s.goal(p));
 const holders=s.players.filter(p=>s.job(p)==='線');s.tethers=holders.map(p=>({owner:p.role,contacts:new Set()}));
 const rest=s.players.filter(p=>s.job(p)==='休み');
 const candidates=[];for(let x=-17;x<=17;x+=1)for(let y=-17;y<=17;y+=1){const q={x,y};if(Math.hypot(x,y)<19&&s.safeWaitingPoint(q))candidates.push(q)}
 for(const p of rest){const original=s.goal(p),q=candidates.find(q=>Math.hypot(q.x-original.x,q.y-original.y)>4);assert.ok(q);Object.assign(p,q)}
 s.resolve();assert.equal(s.history[0].errors.length,0);assert.equal(s.round,1);
});
test('line extension begins immediately when clear or no later than 3 seconds after pickup',()=>{
 const s=new Simulation({rng:random(1)});s.start();s.total=10;s.elapsed=10;
 const p=s.players.find(p=>s.job(p)==='線'),other=s.players.find(x=>x!==p&&s.job(x)==='線');
 s.tethers=[{owner:p.role,contacts:new Set()},{owner:other.role,contacts:new Set()}];
 for(const x of s.players)Object.assign(x,s.goal(x));
 const g=s.goal(p),r=s.config.pickupRadius;Object.assign(p,{x:g.x/18*r,y:g.y/18*r,tetherAcquiredAt:10,extending:false});
 s.bot(p,.01);assert.equal(p.extending,true);
 const block=s.players.find(x=>s.job(x)==='休み');Object.assign(block,g);p.extending=false;p.tetherAcquiredAt=10;
 s.total=12.99;s.bot(p,.01);assert.equal(p.extending,false);
 s.total=13;s.bot(p,.01);assert.equal(p.extending,true);
});
test('next tether receivers wait safely closer to their assigned line',()=>{
 for(let seed=0;seed<20;seed++){
  const s=new Simulation({rng:random(seed)});
  for(const p of s.players.filter(p=>p.number===4)){
   const point=s.goal(p),rank=s.rank(p),line=s.layout.lines[rank],pickup={x:line.x/18*s.config.pickupRadius,y:line.y/18*s.config.pickupRadius};
   const old={x:s.layout.towers[rank].x*.67,y:s.layout.towers[rank].y*.67};
   assert.ok(s.safeWaitingPoint(point));assert.ok(Math.hypot(point.x-pickup.x,point.y-pickup.y)<=Math.hypot(old.x-pickup.x,old.y-pickup.y));
  }
 }
});
