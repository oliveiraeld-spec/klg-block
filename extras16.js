/* KLG BLOCK 1.6: modos adicionais isolados. Chaves da versão 1.5 nunca são sobrescritas. */
(() => {
'use strict';
const KEY='klg-games-v1.6', BACKUP='klg-games-v1.6-backup';
const MODES=['sequence','maze','crystals'];
const NAMES={sequence:'SEQUÊNCIA DO CALANGO',maze:'LABIRINTO',crystals:'CAMPO DE CRISTAIS'};
const DIFF={easy:{name:'FÁCIL',size:7,mines:5,sequence:5,mult:1},medium:{name:'MÉDIO',size:9,mines:11,sequence:7,mult:2},hard:{name:'DIFÍCIL',size:11,mines:19,sequence:9,mult:3}};
const $=id=>document.getElementById(id), good=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999999?n:0;
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const fmt=n=>good(n).toLocaleString('pt-BR');
const makeDefault=()=>({v:1,revision:0,bests:{sequence:0,maze:0,crystals:0},games:{sequence:null,maze:null,crystals:null},stats:{played:0,won:0,trophies:0},daily:{day:today(),best:{sequence:0,maze:0,crystals:0},claimed:[]},achievements:[]});
let state=makeDefault(),mode=null,level='easy',timers=[],presenting=false,activeSession=0,noticeTimer=null;
function sanitizeGame(raw,m){if(!raw||typeof raw!=='object')return null;
  const d=DIFF[raw.level];if(!d||raw.mode!==m||typeof raw.finished!=='boolean')return null;
  if(m==='sequence'){
    if(!Array.isArray(raw.pattern)||raw.pattern.length>100||raw.pattern.some(x=>!Number.isInteger(x)||x<0||x>3))return null;
    if(!Number.isInteger(raw.round)||raw.round<0||raw.round>100)return null;
    return {mode:m,level:raw.level,pattern:raw.pattern,round:raw.round,inputIndex:0,score:good(raw.score),finished:raw.finished};
  }
  if(m==='maze'){
    if(!Array.isArray(raw.map)||raw.map.length!==d.size*d.size||raw.map.some(x=>x!==0&&x!==1)||!Number.isInteger(raw.pos)||raw.pos<0||raw.pos>=raw.map.length||raw.map[raw.pos]===1)return null;
    return {mode:m,level:raw.level,map:raw.map,pos:raw.pos,steps:good(raw.steps),score:good(raw.score),finished:raw.finished};
  }
  if(!Array.isArray(raw.bombs)||raw.bombs.length!==d.size*d.size||raw.bombs.some(x=>x!==0&&x!==1)||raw.bombs.filter(Boolean).length!==d.mines||!Array.isArray(raw.open)||raw.open.length!==raw.bombs.length||raw.open.some(x=>typeof x!=='boolean')||!Array.isArray(raw.flags)||raw.flags.length!==raw.bombs.length||raw.flags.some(x=>typeof x!=='boolean'))return null;
  return {mode:m,level:raw.level,bombs:raw.bombs,open:raw.open,flags:raw.flags,first:!!raw.first,flagMode:!!raw.flagMode,steps:good(raw.steps),score:good(raw.score),finished:raw.finished};
}
function normalized(raw){const s=makeDefault();s.revision=good(raw?.revision);for(const m of MODES){s.bests[m]=good(raw?.bests?.[m]);s.games[m]=sanitizeGame(raw?.games?.[m],m);}for(const k of Object.keys(s.stats))s.stats[k]=good(raw?.stats?.[k]);
  if(raw?.daily?.day===today()){for(const m of MODES)s.daily.best[m]=good(raw?.daily?.best?.[m]);s.daily.claimed=Array.isArray(raw.daily.claimed)?[...new Set(raw.daily.claimed.filter(x=>MODES.includes(x)))]:[];}
  if(Array.isArray(raw?.achievements))s.achievements=[...new Set(raw.achievements.filter(x=>['first','three','expert'].includes(x)))];return s;}
function read(k){try{let val=JSON.parse(localStorage.getItem(k));return val&&val.v===1?val:null}catch{return null}}
function load(){const candidates=[read(KEY),read(BACKUP)].filter(Boolean).sort((a,b)=>good(b.revision)-good(a.revision));state=normalized(candidates[0]);}
function fixDay(){if(state.daily.day!==today())state.daily={day:today(),best:{sequence:0,maze:0,crystals:0},claimed:[]};}
function save(){try{fixDay();state.revision++;const raw=JSON.stringify(state);localStorage.setItem(KEY,raw);localStorage.setItem(BACKUP,raw);return true}catch{return false}}
const random=n=>Math.floor(Math.random()*n);
function choose(list){return list[random(list.length)]}
function neighbours(i,size){const r=Math.floor(i/size),c=i%size, out=[];if(r>0)out.push(i-size);if(r<size-1)out.push(i+size);if(c>0)out.push(i-1);if(c<size-1)out.push(i+1);return out;}
function shuffled(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=random(i+1);[b[i],b[j]]=[b[j],b[i]]}return b;}
function newMaze(size){const cells=Array(size*size).fill(1),visited=new Set([size+1]),stack=[size+1];cells[size+1]=0;while(stack.length){const at=stack[stack.length-1],r=Math.floor(at/size),c=at%size;
  const opts=[[2,0],[-2,0],[0,2],[0,-2]].map(([dr,dc])=>[r+dr,c+dc]).filter(([nr,nc])=>nr>0&&nr<size-1&&nc>0&&nc<size-1&&!visited.has(nr*size+nc));
  if(!opts.length){stack.pop();continue}const [nr,nc]=choose(opts),ni=nr*size+nc;visited.add(ni);cells[ni]=0;cells[(Math.floor((r+nr)/2))*size+Math.floor((c+nc)/2)]=0;stack.push(ni);
 }return cells;}
function createGame(m,diff){const cfg=DIFF[diff],size=cfg.size;
 if(m==='sequence')return {mode:m,level:diff,pattern:[random(4),random(4)],round:0,inputIndex:0,score:0,finished:false};
 if(m==='maze')return {mode:m,level:diff,map:newMaze(size),pos:size+1,steps:0,score:0,finished:false};
 const bombs=Array(size*size).fill(0);for(const i of shuffled([...Array(size*size).keys()]).slice(0,cfg.mines))bombs[i]=1;
 return {mode:m,level:diff,bombs,open:Array(size*size).fill(false),flags:Array(size*size).fill(false),first:false,flagMode:false,steps:0,score:0,finished:false};}
function resetTimers(){for(const t of timers)clearTimeout(t);timers=[];clearTimeout(noticeTimer);activeSession++;presenting=false;$('klg16Celebration')?.classList.add('hidden');}
function announce(txt){$('klg16Notice').textContent=txt;}
function award(coins,xp){return window.KLGBridge?.award?.(coins,xp)===true;}
function celebrate(msg){const box=$('klg16Celebration');$('klg16Cheers').textContent=msg;box.classList.remove('hidden');box.classList.remove('cheer-animate');void box.offsetWidth;box.classList.add('cheer-animate');const sid=activeSession;timers.push(setTimeout(()=>{if(sid===activeSession)box.classList.add('hidden')},1900));}
function complete(points,label){const g=state.games[mode];if(!g||g.finished)return;g.finished=true;g.score=good(points);state.bests[mode]=Math.max(state.bests[mode],g.score);state.stats.won++;fixDay();state.daily.best[mode]=Math.max(state.daily.best[mode],g.score);
  const prize=Math.min(60,5+DIFF[g.level].mult*5),xp=prize*3;award(prize,xp);save();updateHome();announce(`🏆 ${label} +${prize} moedas e +${xp} XP!`);celebrate(label);render();}
function fail(msg){const g=state.games[mode];g.finished=true;save();announce(msg+' Toque em NOVA PARTIDA para tentar novamente.');render();}
function begin(m=mode,diff=level){resetTimers();mode=m;level=diff;state.games[m]=createGame(m,diff);state.stats.played++;save();render();if(m==='sequence')startShowing();}
function enter(m){if(!MODES.includes(m))return;resetTimers();mode=m;$('homeScreen').classList.add('hidden');$('gameScreen').classList.add('hidden');$('arcadeScreen').classList.add('hidden');$('extraScreen').classList.add('hidden');$('klg16Screen').classList.remove('hidden');
  const game=state.games[m];level=game?.level||'easy';if(!game||game.finished)begin();else {render();if(m==='sequence')startShowing();else announce('Partida restaurada! Continue de onde parou.');}window.scrollTo?.(0,0);}
function exit(){if(!mode)return;resetTimers();save();mode=null;$('klg16Screen').classList.add('hidden');window.KLGBridge?.toHome?.();updateHome();}
function updateHome(){for(const m of MODES){const n=$(m+'HomeBest');if(n)n.textContent='Recorde: '+fmt(state.bests[m]);}}
function createTile(idx,css,label,txt=''){const button=document.createElement('button');button.type='button';button.className=css;button.dataset.index=idx;button.setAttribute('aria-label',label);button.textContent=txt;return button;}
function render(){if(!mode)return;const g=state.games[mode],board=$('klg16Board');if(!g)return;
  $('klg16Title').textContent=NAMES[mode];$('klg16Score').textContent=fmt(g.score);$('klg16Best').textContent=fmt(state.bests[mode]);$('klg16Difficulty').textContent=DIFF[g.level].name;
  $('klg16Coins').textContent=$('homeCoins')?.textContent||'0';$('klg16Level').textContent=$('homeLevel')?.textContent||'1';
  for(const key of Object.keys(DIFF))$('klg16Diff_'+key).classList.toggle('selected',level===key);
  board.replaceChildren();board.className='klg16-board klg16-'+mode;const controls=$('klg16Controls');controls.replaceChildren();
  if(mode==='sequence'){
   $('klg16MetricLabel').textContent='RODADA';$('klg16Metric').textContent=(g.round+1)+'/'+DIFF[g.level].sequence;
   $('klg16Hint').textContent='Observe as luzes e depois repita a sequência. Não toque enquanto o Calango demonstra.';
   for(let i=0;i<4;i++){const b=createTile(i,'klg16-tile klg16-pad pad-'+i,'Cor '+(i+1),'★');b.disabled=g.finished||presenting;board.append(b);}
   if(!g.finished){let b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent='▶ REPETIR A SEQUÊNCIA';b.addEventListener('click',startShowing);controls.append(b);}
  } else if(mode==='maze'){
   $('klg16MetricLabel').textContent='PASSOS';$('klg16Metric').textContent=fmt(g.steps);
   $('klg16Hint').textContent='Leve o Calango 🦎 até a estrela ⭐. Use as setas ou deslize o dedo pelo labirinto.';
   const size=DIFF[g.level].size;board.style.setProperty('--klg16-size',size);
   for(let i=0;i<g.map.length;i++){const wall=g.map[i]===1,goal=i===g.map.length-size-2,player=i===g.pos;const v=createTile(i,'klg16-tile klg16-maze-cell'+(wall?' wall':'')+(player?' player':'')+(goal?' goal':''),wall?'Parede':goal?'Chegada':player?'Calango':'Caminho',player?'🦎':goal?'⭐':'');v.disabled=wall||g.finished;board.append(v);}
   const arrows=[['↑','up'],['←','left'],['↓','down'],['→','right']];for(const [txt,dir]of arrows){const b=document.createElement('button');b.type='button';b.className='klg16-dir';b.textContent=txt;b.setAttribute('aria-label','Mover '+dir);b.addEventListener('click',()=>moveMaze(dir));controls.append(b)}
  } else {
   $('klg16MetricLabel').textContent='ABERTAS';$('klg16Metric').textContent=fmt(g.open.filter(Boolean).length)+'/'+fmt(g.bombs.length-DIFF[g.level].mines);
   $('klg16Hint').textContent='Abra as casas sem atingir 💣. Os números mostram quantas bombas há ao redor. Use 🚩 para marcar suspeitas.';
   const size=DIFF[g.level].size;board.style.setProperty('--klg16-size',size);
   for(let i=0;i<g.bombs.length;i++){let txt='',cl='klg16-tile klg16-mine-cell';const revealed=g.open[i];if(revealed){cl+=' opened';txt=g.bombs[i]?'💣':(mineCount(g,i)||'');}else if(g.flags[i])txt='🚩';else txt='◆';
     const b=createTile(i,cl,revealed?'Casa revelada '+txt:'Casa '+(i+1),txt);b.disabled=g.finished||revealed;board.append(b);}
   const toggle=document.createElement('button');toggle.type='button';toggle.className='secondary-btn';toggle.textContent=g.flagMode?'🚩 MARCAR: LIGADO':'🚩 MARCAR: DESLIGADO';toggle.addEventListener('click',()=>{g.flagMode=!g.flagMode;save();render()});controls.append(toggle);
  }
  if(g.finished)announce('Partida concluída! Comece uma nova para continuar.');
}
function startShowing(){if(mode!=='sequence')return;const g=state.games.sequence;if(!g||g.finished)return;resetTimers();presenting=true;announce('👀 Atenção! Observe a sequência.');render();const session=activeSession;let t=350;
  const pattern=g.pattern;for(const val of pattern){timers.push(setTimeout(()=>{if(session!==activeSession)return;const b=$('klg16Board')?.querySelector(`[data-index="${val}"]`);if(b)b.classList.add('flash')},t));t+=520;
   timers.push(setTimeout(()=>{if(session!==activeSession)return;const b=$('klg16Board')?.querySelector(`[data-index="${val}"]`);if(b)b.classList.remove('flash')},t-120));t+=180;}
  timers.push(setTimeout(()=>{if(session!==activeSession)return;presenting=false;g.inputIndex=0;announce('Sua vez! Repita as '+pattern.length+' cores.');render()},t+80));}
function tapSequence(i){if(mode!=='sequence'||presenting)return;const g=state.games.sequence;if(g.finished)return;
  if(i!==g.pattern[g.inputIndex]){fail('🔄 Sequência incorreta.');return;}
  g.inputIndex++;if(g.inputIndex<g.pattern.length){announce(`${g.inputIndex}/${g.pattern.length} acertos`);return;}
  g.round++;g.score=good(g.score+120*DIFF[g.level].mult);if(g.round>=DIFF[g.level].sequence){complete(g.score,'SEQUÊNCIA PERFEITA!');return;}
  g.pattern.push(random(4));g.inputIndex=0;save();render();announce('🦎 Acertou! Próxima rodada.');celebrate('BOA!');const session=activeSession;timers.push(setTimeout(()=>{if(session===activeSession)startShowing()},1550));}
function moveMaze(dir){if(mode!=='maze')return;const g=state.games.maze;if(!g||g.finished)return;const size=DIFF[g.level].size, delta={up:-size,down:size,left:-1,right:1}[dir];if(!delta)return;const next=g.pos+delta;
  if(next<0||next>=g.map.length||g.map[next]===1||(dir==='left'&&g.pos%size===0)||(dir==='right'&&g.pos%size===size-1))return;
  g.pos=next;g.steps++;g.score=good(Math.max(30,(size*size*10-g.steps*9)*DIFF[g.level].mult));if(next===g.map.length-size-2){complete(g.score,'LABIRINTO VENCIDO!');return;}save();render();}
function mineCount(g,i){const size=DIFF[g.level].size,r=Math.floor(i/size),c=i%size;let num=0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<size&&nc>=0&&nc<size)num+=g.bombs[nr*size+nc];}return num;}
function firstSafe(g,i){if(g.first)return;g.first=true;if(!g.bombs[i])return;const safe=shuffled([...g.bombs.keys()].filter(j=>g.bombs[j]===0&&j!==i))[0];if(safe===undefined)return;g.bombs[i]=0;g.bombs[safe]=1;}
function openMine(g,i){const stack=[i];while(stack.length){const cur=stack.pop();if(g.open[cur]||g.flags[cur]||g.bombs[cur])continue;g.open[cur]=true;if(mineCount(g,cur)===0){const size=DIFF[g.level].size,r=Math.floor(cur/size),c=cur%size;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<size&&nc>=0&&nc<size&&!g.open[nr*size+nc]&&!g.bombs[nr*size+nc])stack.push(nr*size+nc);}}}}
function tapCrystal(i){if(mode!=='crystals')return;const g=state.games.crystals;if(!g||g.finished||g.open[i])return;
 if(g.flagMode){g.flags[i]=!g.flags[i];save();render();return;}
 if(g.flags[i])return;firstSafe(g,i);g.steps++;
 if(g.bombs[i]){g.open[i]=true;fail('💥 Ops! Você encontrou uma bomba.');return;}
 openMine(g,i);const opened=g.open.filter(Boolean).length,total=g.open.length-DIFF[g.level].mines;g.score=good((opened*15+100)*DIFF[g.level].mult);if(opened===total){complete(g.score,'CRISTAIS CONQUISTADOS!');return;}save();render();}
function showChampionship(){fixDay();$('klg16ChampDay').textContent='📅 '+state.daily.day.split('-').reverse().join('/')+' · 🏆 '+fmt(state.stats.trophies)+' troféus locais';
 const missions=[{m:'sequence',target:600,coins:18,xp:35},{m:'maze',target:250,coins:20,xp:40},{m:'crystals',target:400,coins:22,xp:45}],host=$('klg16Challenges');host.replaceChildren();
 for(const ch of missions){const done=state.daily.best[ch.m]>=ch.target,claimed=state.daily.claimed.includes(ch.m),wrap=document.createElement('div');wrap.className='tournament-item';const info=document.createElement('div');info.className='tournament-text';const title=document.createElement('strong');title.textContent=NAMES[ch.m];const val=document.createElement('small');val.textContent=`${fmt(state.daily.best[ch.m])}/${fmt(ch.target)} pontos hoje`;const reward=document.createElement('small');reward.textContent=`🪙 ${ch.coins} moedas · ⚡ ${ch.xp} XP`;info.append(title,val,reward);
   const b=document.createElement('button');b.type='button';b.className='tournament-claim';b.textContent=claimed?'RESGATADO':done?'RESGATAR':'EM ANDAMENTO';b.disabled=claimed||!done;b.addEventListener('click',()=>{fixDay();if(state.daily.claimed.includes(ch.m)||state.daily.best[ch.m]<ch.target)return;
   if(!award(ch.coins,ch.xp)){b.textContent='ERRO AO CREDITAR';return;}state.daily.claimed.push(ch.m);state.stats.trophies++;save();showChampionship();});wrap.append(info,b);host.append(wrap);}
 const achievements=[{id:'first',name:'🏅 Primeira vitória',done:state.stats.won>=1,coins:8,xp:20},{id:'three',name:'🎖️ Três vitórias',done:state.stats.won>=3,coins:15,xp:35},{id:'expert',name:'🏆 Mestre do Calango',done:state.stats.won>=9,coins:30,xp:60}],list=$('klg16Achievements');list.replaceChildren();
 for(const item of achievements){const div=document.createElement('div');div.className='tournament-item';const txt=document.createElement('strong');txt.textContent=item.name;const done=state.achievements.includes(item.id),b=document.createElement('button');b.className='tournament-claim';b.type='button';b.disabled=done||!item.done;b.textContent=done?'RESGATADO':item.done?'RESGATAR':'BLOQUEADO';b.addEventListener('click',()=>{if(state.achievements.includes(item.id)||!item.done)return;if(!award(item.coins,item.xp))return;state.achievements.push(item.id);state.stats.trophies++;save();showChampionship()});div.append(txt,b);list.append(div);}
 const old=window.KLGArcade?.exportBackup?.()||{}, old15=window.KLGExtras15?.exportBackup?.()||{};
 const classic=Number(($('homeBest')?.textContent||'0').replace(/[^0-9]/g,''))||0;
 const ranking=[['🧩 Block Clássico',classic],['🧱 Queda de Blocos',good(old.fallBest)],['🔢 Fusão 2048',good(old.mergeBest)],['🧠 Memória',good(old15.bests?.memory)],['🧩 Quebra-cabeça',good(old15.bests?.puzzle)],['🌈 Fusão de Cores',good(old15.bests?.colors)],['🦎 Sequência',state.bests.sequence],['🌿 Labirinto',state.bests.maze],['💎 Campo de Cristais',state.bests.crystals]];
 const rank=$('klg16Rankings');rank.replaceChildren();ranking.sort((a,b)=>b[1]-a[1]).forEach(([name,score],i)=>{const row=document.createElement('div');row.className='ranking-entry';const a=document.createElement('span');a.textContent=(i+1)+'º '+name;const b=document.createElement('strong');b.textContent=fmt(score);row.append(a,b);rank.append(row);});
 $('klg16ChampModal').classList.remove('hidden');}
function exportBackup(){return {v:1,bests:{...state.bests},stats:{...state.stats},trophies:state.stats.trophies,achievements:[...state.achievements]};}
function importBackup(raw){if(raw?.v!==1||!raw.bests||typeof raw.bests!=='object')return false;for(const m of MODES)state.bests[m]=Math.max(state.bests[m],good(raw.bests[m]));if(raw.stats)for(const k of Object.keys(state.stats))state.stats[k]=Math.max(state.stats[k],good(raw.stats[k]));if(Array.isArray(raw.achievements))state.achievements=[...new Set([...state.achievements,...raw.achievements.filter(x=>['first','three','expert'].includes(x))])];save();updateHome();return true;}
function bind(){for(const m of MODES)$(m+'ModeBtn').addEventListener('click',()=>enter(m));$('klg16Back').addEventListener('click',exit);$('klg16Exit').addEventListener('click',exit);
 $('klg16New').addEventListener('click',()=>{if(confirm('Começar outra partida?'))begin()});for(const key of Object.keys(DIFF))$('klg16Diff_'+key).addEventListener('click',()=>{if(key===level)return;if(confirm('Mudar a dificuldade e iniciar outra partida?'))begin(mode,key)});
 $('klg16Board').addEventListener('click',e=>{const target=e.target.closest('button[data-index]');if(!target)return;const i=Number(target.dataset.index);if(mode==='sequence')tapSequence(i);else if(mode==='crystals')tapCrystal(i);else if(mode==='maze'&&state.games.maze&&!state.games.maze.finished){const size=DIFF[level].size,at=state.games.maze.pos,possible={[-size]:'up',[size]:'down',[-1]:'left',[1]:'right'};const direction=possible[i-at];if(direction)moveMaze(direction);}});
 let touch=null;$('klg16Board').addEventListener('pointerdown',e=>{if(mode==='maze')touch={x:e.clientX,y:e.clientY}});$('klg16Board').addEventListener('pointerup',e=>{if(!touch||mode!=='maze')return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<25)return;moveMaze(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up')});
 document.addEventListener('keydown',e=>{if(!mode||$('klg16Screen').classList.contains('hidden'))return;if(e.key==='Escape'){exit();return}if(mode==='maze'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();moveMaze(e.key.slice(5).toLowerCase())}});
 $('klg16ChampBtn').addEventListener('click',showChampionship);$('klg16ChampClose').addEventListener('click',()=>$('klg16ChampModal').classList.add('hidden'));
 $('klg16ChampModal').addEventListener('click',e=>{if(e.target===$('klg16ChampModal'))$('klg16ChampModal').classList.add('hidden')});
 window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden){resetTimers();save();}});}
window.KLGExtras16={exportBackup,importBackup,onHome:updateHome};document.addEventListener('DOMContentLoaded',()=>{load();bind();updateHome()});
})();
