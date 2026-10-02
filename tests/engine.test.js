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
  const s=new Simulation({role,number,rng:random(seed)});s.start();for(let t=0;t<2700&&s.state==='running';t++)s.tick(1/60,{autoUser:true});assert.equal(s.state,'cleared',`seed=${seed} ${role} ${number}: ${s.message}`);
 }
});
test('missed tower fails and taking a distant tether is rejected',()=>{
 const s=new Simulation({rng:random(7)});s.start();s.user.x=0;s.user.y=19;assert.equal(s.take(),false);for(let t=0;t<800&&s.state==='running';t++)s.tick(1/60);assert.equal(s.state,'failed');assert.match(s.message,/H2.*塔/);
});
test('tethers persist at round transition until another player takes them',()=>{
 const s=new Simulation({rng:random(12)});s.start();while(s.round===0&&s.state==='running')s.tick(1/60,{autoUser:true});assert.equal(s.round,1);for(const t of s.tethers)assert.equal(s.byRole(t.owner).number,3);
 const previous=[...s.tethers.map(t=>t.owner)];s.state='paused';s.tick(1/60);assert.deepEqual(s.tethers.map(t=>t.owner),previous);
});
test('everyone alternates work and rest',()=>{for(let n=1;n<=4;n++){const a=[0,1,2,3].map(r=>action(n,r));assert.equal(a.filter(x=>x==='塔').length,1);assert.equal(a.filter(x=>x==='線').length,1);assert.equal(Math.abs(a.indexOf('塔')-a.indexOf('線')),2)}});
