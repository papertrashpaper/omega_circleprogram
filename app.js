import {Simulation,ROLES,action,polar,distance} from './engine.js';
const $=id=>document.getElementById(id),canvas=$('arena'),ctx=canvas.getContext('2d');
let sim,keys=new Set(),last=0,lastUI=0;const colors={H1:'#83dab8',H2:'#83dab8',MT:'#81b7ff',ST:'#81b7ff',D1:'#f493a0',D2:'#f493a0',D3:'#f493a0',D4:'#f493a0'};
const S=18.2,C=450,px=p=>({x:C+p.x*S,y:C+p.y*S});
function reset(){sim=new Simulation({role:$('role').value,number:Number($('number').value),pattern:$('pattern').value,config:{blastRadius:Number($('blastRadius').value)||16}});keys.clear();ui();draw()}
function start(){sim.start();canvas.focus();ui()}
function pause(){if(sim.state==='running')sim.state='paused';else if(sim.state==='paused')sim.state='running';keys.clear();ui()}
$('start').onclick=start;$('pause').onclick=pause;$('retry').onclick=()=>{reset();start()};
for(const id of ['role','number','pattern','blastRadius'])$(id).onchange=reset;
function pathCircle(p,r,fill,stroke,width=1){const q=px(p);ctx.beginPath();ctx.arc(q.x,q.y,r*S,0,2*Math.PI);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function text(t,p,size,color,weight=500){const q=px(p);ctx.font=`${weight} ${size}px system-ui,sans-serif`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,q.x,q.y)}
function line(a,b,color,width=2,dash=[]){a=px(a);b=px(b);ctx.beginPath();ctx.setLineDash(dash);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([])}
function draw(){
 ctx.clearRect(0,0,900,900);
 const grad=ctx.createRadialGradient(450,450,30,450,450,405);grad.addColorStop(0,'#1b2c3c');grad.addColorStop(1,'#0e1b2a');pathCircle({x:0,y:0},20,grad,'#518296',2);
 ctx.save();ctx.beginPath();ctx.arc(C,C,20*S,0,2*Math.PI);ctx.clip();for(let i=-20;i<=20;i+=2.5){line({x:i,y:-20},{x:i,y:20},'#2c425242',1);line({x:-20,y:i},{x:20,y:i},'#2c425242',1)}ctx.restore();
 pathCircle({x:0,y:0},19.4,null,'#314d61',1);pathCircle({x:0,y:0},12.4,null,'#314958',1);
 for(let i=0;i<4;i++){const a=i*Math.PI/2,c=['#f78b9c','#eed576','#8ac6fa','#bd9aee'][i];const p=polar(a,16.4);pathCircle(p,.82,'#132230',c,2);text('ABCD'[i],p,24,c,650);const n=polar(a+Math.PI/4,16.4),q=px(n);ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.strokeRect(q.x-14,q.y-14,28,28);text(String(i+1),n,19,c)}
 // Tower candidates are all shown faintly before starting.
 if(sim.state==='ready'){for(let i=0;i<4;i++)for(const sign of [-1,1])pathCircle(polar(i*Math.PI/2+sign*Math.atan(3/12),12.4),.4,'#556b7844',null)}
 if(sim.state!=='ready'){
  for(const t of (sim.towersVisible?sim.layout.towers:[])){pathCircle(t,sim.config.towerRadius,'#eed17320','#f1d38a',3);pathCircle(t,sim.config.towerRadius*.76,null,'#f1d38a50',1);text(String(sim.round+1),t,30,'#ffe9aa',650);const q=px(t);ctx.beginPath();ctx.arc(q.x,q.y,sim.config.towerRadius*S+5,-Math.PI/2,-Math.PI/2+Math.PI*2*sim.elapsed/sim.duration);ctx.strokeStyle='#fff2c9';ctx.lineWidth=3;ctx.stroke()}
  if(sim.nextTowersVisible)for(const t of sim.layouts[sim.round+1].towers){pathCircle(t,sim.config.towerRadius,'#91c9ff10','#91c9ff',2);text(`次 ${sim.round+2}`,t,18,'#b7dcff',600)}
  for(const tether of sim.tethers){const p=sim.byRole(tether.owner);line({x:0,y:0},p,'#f6aa56',4);pathCircle(p,1,null,'#ffd490',2)}
  for(const e of sim.effects)pathCircle(e,e.radius,'#ff637c28','#ff7889a0',2);
  if($('hints').checked&&sim.state!=='cleared'&&sim.towersVisible){
   const g=sim.goal(sim.user);line(sim.user,g,'#76eddb70',2,[6,7]);pathCircle(g,1.05,'#6ee7d11c','#6ee7d1',2);text('目標',{x:g.x,y:g.y-1.8},16,'#99f5e4',600);
   if(sim.tethers.length&&sim.job(sim.user)==='線'&&sim.holding(sim.user)<0){const owner=sim.byRole(sim.tethers[sim.rank(sim.user)].owner);pathCircle({x:owner.x*.3,y:owner.y*.3},1,null,'#ffc473',2)}
  }
 }
 pathCircle({x:0,y:0},2.1,'#263849','#8a9fab',2);text('Ω',{x:0,y:-.25},34,'#cad9df',600);text('OMEGA',{x:0,y:1.1},10,'#91a6b6');
 for(const p of sim.players){const you=p===sim.user;if(you)pathCircle(p,.87,null,'#ffffff',2.5);pathCircle(p,.57,colors[p.role],'#0b1723',2);text(sim.numbersVisible?String(p.number):'?',p,14,'#0b1723',750);text(p.role+(you?' · YOU':''),{x:p.x,y:p.y-1.15},you?17:14,you?'#ffffff':colors[p.role],650);if(p.hpUntil>sim.total)text('HP↓',{x:p.x,y:p.y+1.1},12,'#ffb6ba')}
}
function ui(){
 const p=sim.user,r=sim.round,job=sim.job(p),ready=sim.state==='ready';
 $('clock').textContent=`${String(Math.floor(sim.total/60)).padStart(2,'0')}:${(sim.total%60).toFixed(1).padStart(4,'0')}`;
 $('status').textContent={ready:'準備完了',running:`第${r+1}回 / 4  ·  ${job==='休み'?'安全な場所で待機':job==='塔'?'塔を踏む':'線を受け取り、外周へ'}`,paused:'一時停止中',failed:'処理失敗',cleared:'CLEAR'}[sim.state];
 $('next').textContent=ready?'開始すると4秒間の詠唱が始まります':`塔・ブラスター発動まで ${sim.remaining.toFixed(1)} 秒`;
 const cast=sim.cast;$('cast').hidden=!cast;if(cast){$('castName').textContent=cast.name;$('castTime').textContent=`${cast.remaining.toFixed(1)}秒`;$('castProgress').value=1-cast.remaining/cast.duration}
 $('badge').textContent=sim.numbersVisible?p.number:'?' ;$('myrole').innerHTML=`${p.role} <span>優先度：${sim.numbersVisible?(sim.rank(p)?'低':'高'):'未付与'}</span>`;$('task').textContent=!sim.numbersVisible?'番号付与を待つ':`${r+1}回目：${job==='休み'?'待機':job==='塔'?'塔を踏む':'線を取る'}`;
 $('instruction').textContent=(!sim.numbersVisible?'Cマーカーに集合。サークルプログラムの詠唱完了を待ちます。':sim.round===0&&sim.total<8.5?(p.number===3?'Cからまっすぐボスへ近づき、出現した線を受け取ります。':'線出現後2.5秒はCで待機してから移動します。'):sim.total<p.waitUntil?'爆発位置で2.5秒待機し、次の担当へ線を渡します。':sim.message)||({塔:'担当の塔に入り、発動まで待ちます。',線:'線に触れて受け取り、所持を確認して担当の外周まで伸ばします。',休み:'塔には入らず、塔側の安全な位置で待機します。'}[job]);
 $('tetherstate').textContent=sim.holding(p)>=0?'線：所持中 — 次の担当が受け取るまで残ります':'線：未所持';
 $('timeline').innerHTML=Array.from({length:4},(_,i)=>`<div class="step ${i===r?'active':i<r?'done':''}"><small>${i+1}回目</small>${sim.numbersVisible?action(p.number,i):'？'}</div>`).join('');
 $('party').innerHTML=sim.players.map((x,i)=>`<div class="party-row ${x===p?'you':''}"><span class="dot" style="background:${colors[x.role]}"></span><strong>${x.role}</strong><span>${sim.numbersVisible?x.number:"？"}</span><span class="debuff">${sim.holding(x)>=0?'線 ':''}${x.scarUntil>sim.total?'刻印 '+Math.ceil(x.scarUntil-sim.total)+'s':sim.numbersVisible?sim.job(x):"未付与"}${x.hpUntil>sim.total?' / HP↓':''}</span></div>`).join('');
 $('start').disabled=!ready;$('pause').disabled=!['running','paused'].includes(sim.state);$('pause').textContent=sim.state==='paused'?'再開':'一時停止';
 for(const id of ['role','number','pattern','blastRadius'])$(id).disabled=sim.state==='running'||sim.state==='paused';
 const b=$('banner');b.hidden=sim.state==='running';b.className='banner'+(sim.state==='failed'?' error':sim.state==='cleared'?' success':'');
 if(!b.hidden){const headings={ready:'自分の役割を選んで、練習開始',paused:'一時停止',failed:`第${r+1}回：もう一度練習しよう`,cleared:'全4回の処理に成功'};b.replaceChildren();const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=headings[sim.state];span.textContent=sim.state==='ready'?`${p.role}・${p.number}番 / 正解ガイドは設定で切り替えできます`:sim.state==='paused'?'再開ボタンまたは Space で続ける':sim.state==='failed'?sim.message.split('\n').slice(0,4).join('\n'):'おつかれさまでした。次はガイドなしにも挑戦できます。';b.append(strong,span)}
}
const controlKeys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','Shift'];
window.addEventListener('keydown',e=>{if(['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName))return;if(controlKeys.includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase())}if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();if(!e.repeat)pause()}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();if(sim.state==='running')pause()});
canvas.addEventListener('pointerdown',e=>{const rect=canvas.getBoundingClientRect();const x=((e.clientX-rect.left)/rect.width*900-C)/S,y=((e.clientY-rect.top)/rect.height*900-C)/S;sim.user.target={x,y};canvas.focus();e.preventDefault()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sim.state==='running')pause()});
function frame(time){let dt=Math.min((time-last)/1000||0,.05);last=time;const direction={x:(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y:(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)};sim.tick(dt*Number($('speed').value),{direction,sprint:keys.has('shift')});draw();if(time-lastUI>80){ui();lastUI=time}requestAnimationFrame(frame)}
reset();requestAnimationFrame(frame);
