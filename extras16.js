/* KLG Block 1.7 — Sequência, Cobrinha e Estoura-Bolhas.
   Mantém os jogos 1.0-1.5 e migra apenas os dados 1.6; grava recordes a cada pontuação. */
(() => {
'use strict';
const KEY='klg-games-v1.7', BACKUP=KEY+'-backup', RECORDS='klg-recordes-v1.7';
const OLD='klg-games-v1.6', OLD_BACKUP=OLD+'-backup';
const MODES=['sequence','snake','bubbles'], NAMES={sequence:'SEQUÊNCIA DO CALANGO',snake:'COBRINHA DO CALANGO',bubbles:'ESTOURA-BOLHAS'};
const DIFF={easy:{name:'FÁCIL',snake:9,speed:600,bubbles:6,colors:4,sequence:5,mult:1},medium:{name:'MÉDIO',snake:11,speed:420,bubbles:7,colors:5,sequence:7,mult:2},hard:{name:'DIFÍCIL',snake:13,speed:270,bubbles:8,colors:6,sequence:9,mult:3}};
const COLORS=['#25bbf0','#ffba38','#f2689e','#8adb52','#b78af5','#ff7d45'];
const $=id=>document.getElementById(id), good=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999999?n:0;
const date=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const fmt=n=>good(n).toLocaleString('pt-BR'), random=n=>Math.floor(Math.random()*n);
const fresh=()=>({v:2,revision:0,bests:{sequence:0,snake:0,bubbles:0},games:{sequence:null,snake:null,bubbles:null},stats:{played:0,won:0,trophies:0},daily:{day:date(),best:{sequence:0,snake:0,bubbles:0},claimed:[]},achievements:[],legacy:{maze:0,crystals:0}});
let data=fresh(),mode=null,level='easy',showTimers=[],snakeTimer=null,presenting=false,session=0,steered=false,renderedMode=null;
function read(k){try{const x=JSON.parse(localStorage.getItem(k));return x&&typeof x==='object'?x:null;}catch{return null;}}
function validGame(raw,m){if(!raw||raw.mode!==m||!DIFF[raw.level]||typeof raw.finished!=='boolean')return null;
  const cfg=DIFF[raw.level],score=good(raw.score);
  if(m==='sequence'){
    if(!Array.isArray(raw.pattern)||raw.pattern.length>100||raw.pattern.some(x=>!Number.isInteger(x)||x<0||x>3)||!Number.isInteger(raw.round)||raw.round<0||raw.round>100)return null;
    return {mode:m,level:raw.level,pattern:[...raw.pattern],round:raw.round,inputIndex:0,score,finished:raw.finished};
  }
  if(m==='snake'){
    const n=cfg.snake;if(!Array.isArray(raw.body)||!raw.body.length||raw.body.length>n*n||new Set(raw.body).size!==raw.body.length||raw.body.some(x=>!Number.isInteger(x)||x<0||x>=n*n))return null;
    if(!Number.isInteger(raw.food)||raw.food<0||raw.food>=n*n||!['up','down','left','right'].includes(raw.dir))return null;
    return {mode:m,level:raw.level,body:[...raw.body],food:raw.food,dir:raw.dir,score,foods:good(raw.foods),finished:raw.finished,paused:true};
  }
  const n=cfg.bubbles;if(!Array.isArray(raw.grid)||raw.grid.length!==n*n||raw.grid.some(x=>!Number.isInteger(x)||x<-1||x>=cfg.colors))return null;
  return {mode:m,level:raw.level,grid:[...raw.grid],score,round:good(raw.round),moves:good(raw.moves),finished:raw.finished};
}
function normalized(raw){const s=fresh();if(!raw)return s;s.revision=good(raw.revision);for(const m of MODES){s.bests[m]=good(raw.bests?.[m]);s.games[m]=validGame(raw.games?.[m],m);if(s.games[m])s.bests[m]=Math.max(s.bests[m],s.games[m].score);}
 for(const k of Object.keys(s.stats))s.stats[k]=good(raw.stats?.[k]);if(raw.daily?.day===date()){for(const m of MODES)s.daily.best[m]=good(raw.daily?.best?.[m]);s.daily.claimed=[...new Set((Array.isArray(raw.daily.claimed)?raw.daily.claimed:[]).filter(x=>MODES.includes(x)))];}
 if(Array.isArray(raw.achievements))s.achievements=[...new Set(raw.achievements.filter(x=>['first','three','expert'].includes(x)))];s.legacy.maze=good(raw.legacy?.maze);s.legacy.crystals=good(raw.legacy?.crystals);return s;}
function load(){const versions=[read(KEY),read(BACKUP)].filter(x=>x?.v===2).sort((a,b)=>good(b.revision)-good(a.revision));if(versions.length)data=normalized(versions[0]);else{
 const old=[read(OLD),read(OLD_BACKUP)].filter(x=>x?.v===1).sort((a,b)=>good(b.revision)-good(a.revision))[0];data=fresh();if(old){data.bests.sequence=good(old.bests?.sequence);data.games.sequence=validGame(old.games?.sequence,'sequence');if(data.games.sequence)data.bests.sequence=Math.max(data.bests.sequence,data.games.sequence.score);data.legacy={maze:good(old.bests?.maze),crystals:good(old.bests?.crystals)};
 for(const k of Object.keys(data.stats))data.stats[k]=good(old.stats?.[k]);data.achievements=Array.isArray(old.achievements)?[...new Set(old.achievements.filter(x=>['first','three','expert'].includes(x)))]:[];
 if(old.daily?.day===date())data.daily.best.sequence=good(old.daily.best?.sequence);
 }}
 const rec=read(RECORDS);if(rec?.v===1)for(const m of MODES)data.bests[m]=Math.max(data.bests[m],good(rec.bests?.[m]));
 save();}
function dayReset(){if(data.daily.day!==date())data.daily={day:date(),best:{sequence:0,snake:0,bubbles:0},claimed:[]};}
function save(){dayReset();data.revision++;try{
 const raw=JSON.stringify(data);localStorage.setItem(KEY,raw);localStorage.setItem(BACKUP,raw);
 const oldRec=read(RECORDS);const max={};for(const m of MODES)max[m]=Math.max(data.bests[m],good(oldRec?.bests?.[m]));localStorage.setItem(RECORDS,JSON.stringify({v:1,bests:max}));
 return localStorage.getItem(KEY)===raw;
 }catch{notice('⚠️ Falha ao salvar. Copie o código em SALVAR / RECUPERAR PROGRESSO.');return false;}}
function record(m,score){const v=good(score),g=data.games[m];if(g)g.score=v;data.bests[m]=Math.max(data.bests[m],v);dayReset();data.daily.best[m]=Math.max(data.daily.best[m],v);const ok=save();updateHome();return ok;}
function notice(s){const n=$('klg16Notice');if(n)n.textContent=s;}
function sound(){if(!window.KLGBridge?.soundEnabled?.())return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;const a=new Audio(),o=a.createOscillator(),v=a.createGain();o.frequency.setValueAtTime(530,a.currentTime);o.frequency.exponentialRampToValueAtTime(790,a.currentTime+.12);v.gain.setValueAtTime(.05,a.currentTime);v.gain.exponentialRampToValueAtTime(.001,a.currentTime+.15);o.connect(v).connect(a.destination);o.start();o.stop(a.currentTime+.15);setTimeout(()=>a.close().catch(()=>{}),450);}catch{}}
function award(c,x){return window.KLGBridge?.award?.(c,x)===true;}
function celebrate(msg){const box=$('klg16Celebration');$('klg16Cheers').textContent=msg;box.classList.remove('hidden','cheer-animate');void box.offsetWidth;box.classList.add('cheer-animate');const cur=session;showTimers.push(setTimeout(()=>{if(cur===session)box.classList.add('hidden')},1550));sound();}
function pause(){clearInterval(snakeTimer);snakeTimer=null;for(const t of showTimers)clearTimeout(t);showTimers=[];session++;presenting=false;const el=$('klg16Celebration');if(el)el.classList.add('hidden');}
function finish(message,win){const g=data.games[mode];if(!g||g.finished)return;pause();g.finished=true;if(win){data.stats.won++;const prize=5+DIFF[g.level].mult*5;award(prize,prize*3);}record(mode,g.score);render();notice(message+(win?' 🪙 Prêmio creditado!':' · Toque em NOVA PARTIDA.'));if(win)celebrate(message);}
function newFood(body,n){const free=[];for(let i=0;i<n*n;i++)if(!body.includes(i))free.push(i);return free.length?free[random(free.length)]:-1;}
function group(grid,index,n){if(index<0||grid[index]<0)return [];const color=grid[index],seen=new Set([index]),stack=[index];while(stack.length){const at=stack.pop(),r=Math.floor(at/n),c=at%n;for(const [rr,cc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]){const j=rr*n+cc;if(rr>=0&&rr<n&&cc>=0&&cc<n&&!seen.has(j)&&grid[j]===color){seen.add(j);stack.push(j);}}}return [...seen];}
function anyGroup(grid,n){return grid.some((v,i)=>v>=0&&group(grid,i,n).length>=2);}
function create(m,d){const cfg=DIFF[d];if(m==='sequence')return {mode:m,level:d,pattern:[random(4),random(4)],round:0,inputIndex:0,score:0,finished:false};
 if(m==='snake'){const n=cfg.snake,c=Math.floor(n/2),center=c*n+c,body=[center,center-1,center-2];return {mode:m,level:d,body,food:newFood(body,n),dir:'right',score:0,foods:0,finished:false,paused:true};}
 const n=cfg.bubbles;let tiles;for(let attempt=0;attempt<50;attempt++){tiles=Array.from({length:n*n},()=>random(cfg.colors));if(anyGroup(tiles,n))break;}
 return {mode:m,level:d,grid:tiles,score:0,round:1,moves:0,finished:false};}
function begin(m=mode,d=level){pause();renderedMode=null;mode=m;level=d;data.games[m]=create(m,d);data.stats.played++;steered=false;save();render();if(m==='sequence')showSequence();if(m==='snake')notice('🐍 Toque em ▶ COMEÇAR para mover. Setas ou deslize o dedo.');}
function enter(m){if(!MODES.includes(m))return;pause();mode=m;renderedMode=null;level=data.games[m]?.level||'easy';for(const id of ['homeScreen','gameScreen','arcadeScreen','extraScreen'])$(id)?.classList.add('hidden');$('klg16Screen').classList.remove('hidden');if(!data.games[m]||data.games[m].finished)begin(m,level);else{render();if(m==='sequence')showSequence();else if(m==='snake')notice('🦎 Partida restaurada e pausada. Toque em CONTINUAR.');else notice('Partida recuperada!');}window.scrollTo?.(0,0);}
function exit(){if(!mode)return;pause();renderedMode=null;if(mode==='snake'&&data.games.snake)data.games.snake.paused=true;save();mode=null;$('klg16Screen').classList.add('hidden');window.KLGBridge?.toHome?.();updateHome();}
function updateHome(){for(const m of MODES){const n=$(m+'HomeBest');if(n)n.textContent='Recorde: '+fmt(data.bests[m]);}}
function tile(index,classes,label,txt=''){const b=document.createElement('button');b.type='button';b.dataset.index=index;b.className=classes;b.setAttribute('aria-label',label);b.textContent=txt;return b;}
function render(){if(!mode)return;const g=data.games[mode],b=$('klg16Board'),controls=$('klg16Controls');if(!g)return;$('klg16Title').textContent=NAMES[mode];$('klg16Score').textContent=fmt(g.score);$('klg16Best').textContent=fmt(Math.max(data.bests[mode],g.score));$('klg16Difficulty').textContent=DIFF[g.level].name;
 $('klg16Coins').textContent=$('homeCoins')?.textContent||'0';$('klg16Level').textContent=$('homeLevel')?.textContent||'1';for(const k of Object.keys(DIFF))$('klg16Diff_'+k).classList.toggle('selected',level===k);
 const freshControls=renderedMode!==mode;if(freshControls){controls.replaceChildren();renderedMode=mode;}
 if(!(mode==='snake' && b.classList.contains('klg16-snake') && b.childElementCount===DIFF[g.level].snake**2))b.replaceChildren();
 b.className='klg16-board klg16-'+mode;b.style.removeProperty('--klg16-size');
 if(mode==='sequence'){
 $('klg16MetricLabel').textContent='RODADA';$('klg16Metric').textContent=(g.round+1)+'/'+DIFF[g.level].sequence;$('klg16Hint').textContent='Observe as luzes e repita a sequência colorida.';
 for(let i=0;i<4;i++){const t=tile(i,'klg16-tile klg16-pad pad-'+i,'Cor '+(i+1),'★');t.disabled=g.finished||presenting;b.append(t);}
 if(freshControls){const c=document.createElement('button');c.type='button';c.className='secondary-btn';c.id='klg19ShowSequence';c.textContent='▶ VER SEQUÊNCIA';c.addEventListener('click',showSequence);controls.append(c);}const c=$('klg19ShowSequence');if(c)c.disabled=g.finished;
 } else if(mode==='snake'){
 const n=DIFF[g.level].snake;$('klg16MetricLabel').textContent='FRUTAS';$('klg16Metric').textContent=fmt(g.foods);$('klg16Hint').textContent='Use as setas ou deslize o dedo. Coma frutas 🍎, evite paredes e a própria cauda.';b.style.setProperty('--klg16-size',n);
 for(let i=0;i<n*n;i++){const head=g.body[0]===i,body=g.body.includes(i),food=g.food===i;let cell=b.children[i];if(!cell){cell=tile(i,'klg16-tile klg17-snake-cell','Campo');b.append(cell);}cell.className='klg16-tile klg17-snake-cell'+(head?' head':body?' tail':food?' fruit':'');cell.textContent=head?'🦎':food?'🍎':'';cell.setAttribute('aria-label',head?'Cabeça':body?'Corpo':food?'Fruta':'Campo');}
 if(freshControls){const restart=document.createElement('button');restart.type='button';restart.id='klg19SnakeToggle';restart.className='klg17-toggle';restart.addEventListener('click',()=>{if(snakeTimer){clearInterval(snakeTimer);snakeTimer=null;g.paused=true;save();render();notice('⏸ Jogo pausado.');}else startSnake();});controls.append(restart);
 for(const [label,dir]of [['▲','up'],['◀','left'],['▼','down'],['▶','right']]){const btn=document.createElement('button');btn.type='button';btn.className='klg16-dir';btn.textContent=label;btn.setAttribute('aria-label','Mover '+dir);btn.addEventListener('pointerdown',e=>{e.preventDefault();steer(dir);});btn.addEventListener('click',()=>steer(dir));controls.append(btn);}}
 const restart=$('klg19SnakeToggle');if(restart){restart.textContent=g.finished?'FIM DA PARTIDA':snakeTimer?'⏸ PAUSAR':'▶ COMEÇAR';restart.disabled=g.finished;}
 } else {
 const n=DIFF[g.level].bubbles;$('klg16MetricLabel').textContent='GRUPOS';$('klg16Metric').textContent=fmt(g.moves);$('klg16Hint').textContent='Toque em um grupo de duas ou mais bolhas iguais. Grupos grandes valem mais pontos.';b.style.setProperty('--klg16-size',n);
 for(let i=0;i<g.grid.length;i++){const v=g.grid[i],btn=tile(i,'klg16-tile klg17-bubble'+(v<0?' empty':''),v<0?'Vazio':'Bolha colorida',v<0?'':'●');if(v>=0)btn.style.setProperty('--bubble-color',COLORS[v]);btn.disabled=v<0||g.finished;b.append(btn);}
 if(freshControls){const c=document.createElement('span');c.className='klg17-tip';c.textContent='💥 Toque em 2+ bolhas vizinhas iguais';controls.append(c);}
 }
}
function showSequence(){const g=data.games.sequence;if(mode!=='sequence'||!g||g.finished)return;pause();presenting=true;render();notice('👀 Preste atenção nas luzes!');const now=session;let t=300;
 for(const v of g.pattern){showTimers.push(setTimeout(()=>{if(now!==session)return;bFlash(v,true)},t));t+=450;showTimers.push(setTimeout(()=>{if(now!==session)return;bFlash(v,false)},t));t+=180;}
 showTimers.push(setTimeout(()=>{if(now!==session)return;presenting=false;g.inputIndex=0;render();notice('Sua vez! Repita as '+g.pattern.length+' cores.')},t+20));}
function bFlash(i,on){const b=$('klg16Board')?.querySelector(`button[data-index="${i}"]`);b?.classList.toggle('flash',on);}
function tapSequence(i){const g=data.games.sequence;if(!g||presenting||g.finished)return;if(i!==g.pattern[g.inputIndex]){record('sequence',g.score);finish('🔄 Sequência incorreta!',false);return;}
 g.inputIndex++;if(g.inputIndex<g.pattern.length){notice(g.inputIndex+'/'+g.pattern.length+' cores certas');return;}
 g.round++;const v=good(g.score+120*DIFF[g.level].mult);record('sequence',v);sound();if(g.round>=DIFF[g.level].sequence){finish('SEQUÊNCIA PERFEITA!',true);return;}
 g.pattern.push(random(4));g.inputIndex=0;save();render();notice('🦎 Boa! Próxima rodada!');const now=session;showTimers.push(setTimeout(()=>{if(now===session)showSequence()},850));}
function steer(dir){if(mode!=='snake')return;const g=data.games.snake;if(!g||g.finished||steered)return;const opposite={up:'down',down:'up',left:'right',right:'left'};if(dir!==opposite[g.dir]){g.dir=dir;steered=true;save();}}
function startSnake(){if(mode!=='snake')return;const g=data.games.snake;if(!g||g.finished)return;clearInterval(snakeTimer);g.paused=false;steered=false;snakeTimer=setInterval(tickSnake,DIFF[g.level].speed);save();render();notice('🐍 Pegue as frutas!');}
function tickSnake(){const g=data.games.snake;if(!g||mode!=='snake'||g.finished||g.paused)return;const n=DIFF[g.level].snake,head=g.body[0],r=Math.floor(head/n),c=head%n,delta={up:[-1,0],down:[1,0],left:[0,-1],right:[0,1]}[g.dir],rr=r+delta[0],cc=c+delta[1];steered=false;
 if(rr<0||rr>=n||cc<0||cc>=n){finish('💥 Encostou na parede!',false);return;}
 const at=rr*n+cc,ate=at===g.food,collision=g.body.slice(0,ate?undefined:-1).includes(at);if(collision){finish('💥 Encostou na cauda!',false);return;}
 g.body.unshift(at);if(!ate)g.body.pop();else{g.foods++;const points=good(g.score+100*DIFF[g.level].mult);record('snake',points);if(g.foods%3===0){award(3*DIFF[g.level].mult,12*DIFF[g.level].mult);sound();}g.food=newFood(g.body,n);if(g.food<0){finish('🏆 COBRINHA CAMPEÃ!',true);return;}notice('🍎 +'+(100*DIFF[g.level].mult)+' pontos! Recorde salvo.');}
 save();render();}
function dropBubbles(g,n){for(let c=0;c<n;c++){const values=[];for(let r=n-1;r>=0;r--)if(g.grid[r*n+c]>=0)values.push(g.grid[r*n+c]);for(let r=n-1;r>=0;r--)g.grid[r*n+c]=(n-1-r)<values.length?values[n-1-r]:-1;}}
function pressBubble(i){const g=data.games.bubbles;if(!g||g.finished)return;const n=DIFF[g.level].bubbles,found=group(g.grid,i,n);if(found.length<2){notice('💡 Toque em uma cor que esteja encostada em outra igual.');return;}
 found.forEach(k=>{g.grid[k]=-1});g.moves++;const gain=good(found.length*found.length*10*DIFF[g.level].mult);record('bubbles',good(g.score+gain));dropBubbles(g,n);for(let i=0;i<g.grid.length;i++)if(g.grid[i]<0)g.grid[i]=random(DIFF[g.level].colors);if(!anyGroup(g.grid,n)){for(let r=0;r<2;r++)g.grid[r*n]=g.grid[r*n+1]=random(DIFF[g.level].colors);}
 sound();save();render();notice(`💥 ${found.length} bolhas! +${gain} pontos · Recorde salvo!`);}
function championship(){dayReset();$('klg16ChampTitle').textContent='Campeonato do Calango 1.9';$('klg16ChampDay').textContent='📅 '+data.daily.day.split('-').reverse().join('/')+' · 🏆 '+fmt(data.stats.trophies)+' troféus';
 const missions=[{m:'sequence',target:240,coins:12,xp:25},{m:'snake',target:200,coins:16,xp:30},{m:'bubbles',target:200,coins:18,xp:35}],host=$('klg16Challenges');host.replaceChildren();
 for(const ch of missions){const div=document.createElement('div');div.className='tournament-item';const info=document.createElement('div');info.className='tournament-text';const title=document.createElement('strong');title.textContent=NAMES[ch.m];const progress=document.createElement('small');progress.textContent=`${fmt(data.daily.best[ch.m])}/${fmt(ch.target)} pontos hoje`;const prize=document.createElement('small');prize.textContent=`🪙 ${ch.coins} moedas · ⚡ ${ch.xp} XP`;info.append(title,progress,prize);const claim=document.createElement('button');claim.className='tournament-claim';claim.type='button';const done=data.daily.best[ch.m]>=ch.target,claimed=data.daily.claimed.includes(ch.m);claim.textContent=claimed?'RESGATADO':done?'RESGATAR':'EM ANDAMENTO';claim.disabled=!done||claimed;claim.addEventListener('click',()=>{dayReset();if(data.daily.claimed.includes(ch.m)||data.daily.best[ch.m]<ch.target)return;if(!award(ch.coins,ch.xp)){notice('Falha ao conceder o prêmio.');return;}data.daily.claimed.push(ch.m);data.stats.trophies++;save();championship();});div.append(info,claim);host.append(div);}
 const awards=[{id:'first',label:'🏅 Primeira vitória',target:1,coins:8,xp:20},{id:'three',label:'🎖️ Três vitórias',target:3,coins:15,xp:35},{id:'expert',label:'🏆 Mestre do Calango',target:9,coins:30,xp:60}],awardsBox=$('klg16Achievements');awardsBox.replaceChildren();for(const a of awards){const div=document.createElement('div');div.className='tournament-item';const title=document.createElement('strong');title.textContent=a.label;const claim=document.createElement('button');claim.className='tournament-claim';claim.type='button';const claimed=data.achievements.includes(a.id),done=data.stats.won>=a.target;claim.textContent=claimed?'RESGATADO':done?'RESGATAR':'BLOQUEADO';claim.disabled=claimed||!done;claim.addEventListener('click',()=>{if(data.achievements.includes(a.id)||!done)return;if(!award(a.coins,a.xp))return;data.achievements.push(a.id);data.stats.trophies++;save();championship()});div.append(title,claim);awardsBox.append(div);}
 const old=window.KLGArcade?.exportBackup?.()||{},old15=window.KLGExtras15?.exportBackup?.()||{};const classic=Number(($('homeBest')?.textContent||'0').replace(/[^0-9]/g,''))||0;
 const entries=[['🧩 Block Clássico',classic],['🧱 Queda de Blocos',good(old.fallBest)],['🔢 Fusão 2048',good(old.mergeBest)],['🧠 Memória',good(old15.bests?.memory)],['🧩 Quebra-cabeça',good(old15.bests?.puzzle)],['🌈 Fusão de Cores',good(old15.bests?.colors)],['🦎 Sequência',data.bests.sequence],['🐍 Cobrinha',data.bests.snake],['🫧 Estoura-Bolhas',data.bests.bubbles],['🦎 Caça-Pontos',window.KLGChase19?.getBest?.()||0]];
 const list=$('klg16Rankings');list.replaceChildren();entries.sort((a,b)=>b[1]-a[1]).forEach(([name,score],i)=>{const row=document.createElement('div');row.className='ranking-entry';const txt=document.createElement('span');txt.textContent=(i+1)+'º '+name;const val=document.createElement('strong');val.textContent=fmt(score);row.append(txt,val);list.append(row)});$('klg16ChampModal').classList.remove('hidden');}
function exportBackup(){return {v:2,bests:{...data.bests},stats:{...data.stats},achievements:[...data.achievements],legacy:{...data.legacy}};}
function importBackup(raw){if(!raw||!raw.bests||![1,2].includes(raw.v))return false;
 if(raw.v===1){data.bests.sequence=Math.max(data.bests.sequence,good(raw.bests.sequence));data.legacy.maze=Math.max(data.legacy.maze,good(raw.bests.maze));data.legacy.crystals=Math.max(data.legacy.crystals,good(raw.bests.crystals));}
 else{for(const m of MODES)data.bests[m]=Math.max(data.bests[m],good(raw.bests[m]));data.legacy.maze=Math.max(data.legacy.maze,good(raw.legacy?.maze));data.legacy.crystals=Math.max(data.legacy.crystals,good(raw.legacy?.crystals));}
 for(const k of Object.keys(data.stats))data.stats[k]=Math.max(data.stats[k],good(raw.stats?.[k]));if(Array.isArray(raw.achievements))data.achievements=[...new Set([...data.achievements,...raw.achievements.filter(x=>['first','three','expert'].includes(x))])];save();updateHome();return true;}
function bind(){for(const m of MODES)$(m+'ModeBtn').addEventListener('click',()=>enter(m));$('klg16Back').addEventListener('click',exit);$('klg16Exit').addEventListener('click',exit);$('klg16New').addEventListener('click',()=>{if(confirm('Começar uma nova partida?'))begin()});for(const k of Object.keys(DIFF))$('klg16Diff_'+k).addEventListener('click',()=>{if(k!==level&&confirm('Alterar dificuldade e começar outra partida?'))begin(mode,k)});
 $('klg16Board').addEventListener('click',e=>{const b=e.target.closest('button[data-index]');if(!b)return;const i=Number(b.dataset.index);if(mode==='sequence')tapSequence(i);else if(mode==='bubbles')pressBubble(i);});
 let touch=null;$('klg16Board').addEventListener('pointerdown',e=>{if(mode==='snake')touch={x:e.clientX,y:e.clientY}});$('klg16Board').addEventListener('pointerup',e=>{if(!touch||mode!=='snake')return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;steer(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up')});
 document.addEventListener('keydown',e=>{if(!mode||$('klg16Screen').classList.contains('hidden'))return;if(e.key==='Escape'){exit();return;}if(mode==='snake'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();steer(e.key.slice(5).toLowerCase())}});
 $('klg16ChampBtn').addEventListener('click',championship);$('klg16ChampClose').addEventListener('click',()=>$('klg16ChampModal').classList.add('hidden'));$('klg16ChampModal').addEventListener('click',e=>{if(e.target===$('klg16ChampModal'))$('klg16ChampModal').classList.add('hidden')});
 window.addEventListener('pagehide',()=>{if(mode==='snake'&&data.games.snake)data.games.snake.paused=true;pause();save()});document.addEventListener('visibilitychange',()=>{if(document.hidden){if(mode==='snake'&&data.games.snake)data.games.snake.paused=true;pause();save();}else if(mode==='snake'&&!$('klg16Screen').classList.contains('hidden')){render();notice('Partida pausada. Toque em CONTINUAR.');}});}
window.KLGExtras16={exportBackup,importBackup,onHome:updateHome};document.addEventListener('DOMContentLoaded',()=>{load();bind();updateHome()});
})();
