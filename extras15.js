/* KLG Block 1.5 — três minijogos isolados, progresso e desafios locais.
   Não altera as partidas nem as chaves de salvamento das versões 1.0–1.4. */
(() => {
  'use strict';
  const KEY = 'klg-minigames-v1.5', BACKUP = 'klg-minigames-v1.5-backup';
  const MODES = ['memory', 'puzzle', 'colors'];
  const NAMES = {memory:'MEMÓRIA DO CALANGO', puzzle:'QUEBRA-CABEÇA', colors:'FUSÃO DE CORES'};
  const EMOJI = ['🦎','🌴','🍉','🌻','🥥','⭐','🐸','🍍'];
  const COLORS = ['#5ec9f3','#ed77ad','#a7ee72','#ffc65f','#b68af2','#ff9372'];
  const GOALS = [
    {id:'memory',title:'Memória perfeita',target:600,coins:18,xp:35},
    {id:'puzzle',title:'Montador do dia',target:400,coins:20,xp:40},
    {id:'colors',title:'Mestre das cores',target:500,coins:16,xp:32}
  ];
  const $=id=>document.getElementById(id);
  const safe=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999999?n:0;
  const fmt=n=>safe(n).toLocaleString('pt-BR');
  const day=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const blank=(mode)=>mode==='memory'?{cards:[],matched:[],flipped:[],moves:0,best:0,score:0,started:false,finished:false}:mode==='puzzle'?{tiles:[],moves:0,best:0,score:0,started:false,finished:false}:{grid:[],moves:0,best:0,score:0,started:false,finished:false,selected:-1,combos:0};
  const defaults=()=>({v:1,rev:0,memory:blank('memory'),puzzle:blank('puzzle'),colors:blank('colors'),daily:{date:day(),scores:{memory:0,puzzle:0,colors:0},claimed:[]},stats:{games:0,wins:0,matches:0,colorClears:0,trophies:0}});
  let state=defaults(), mode=null, lock=false, flipTimer=null, cheerTimer=null, noticeTimer=null;
  const validMemory=g=>Array.isArray(g?.cards)&&g.cards.length===16&&g.cards.every(x=>Number.isInteger(x)&&x>=0&&x<8)&&Array.isArray(g.matched)&&g.matched.length===16&&g.matched.every(x=>typeof x==='boolean');
  const validPuzzle=g=>Array.isArray(g?.tiles)&&g.tiles.length===9&&new Set(g.tiles).size===9&&g.tiles.every(x=>Number.isInteger(x)&&x>=0&&x<=8);
  const validColors=g=>Array.isArray(g?.grid)&&g.grid.length===36&&g.grid.every(x=>Number.isInteger(x)&&x>=0&&x<COLORS.length);
  function normalized(raw){
    const s=defaults();s.rev=safe(raw?.rev);
    for(const m of MODES){
      const g=raw?.[m];if(!g)continue;
      const valid=m==='memory'?validMemory(g):m==='puzzle'?validPuzzle(g):validColors(g);
      s[m].best=safe(g.best);
      if(!valid)continue;
      s[m]={...s[m],...g,moves:safe(g.moves),score:safe(g.score),best:Math.max(safe(g.best),safe(g.score)),started:Boolean(g.started),finished:Boolean(g.finished)};
      if(m==='memory')s[m].flipped=[]; // Não restaurar cartas temporariamente abertas.
      if(m==='colors'){s[m].selected=-1;s[m].combos=safe(g.combos);}
    }
    if(raw?.daily?.date===day()){
      s.daily.scores=Object.fromEntries(MODES.map(m=>[m,safe(raw.daily?.scores?.[m])]));
      s.daily.claimed=Array.isArray(raw.daily.claimed)?[...new Set(raw.daily.claimed.filter(m=>MODES.includes(m)))]:[];
    }
    if(raw?.stats){for(const key of Object.keys(s.stats))s.stats[key]=safe(raw.stats[key]);}
    return s;
  }
  function read(k){try{const value=JSON.parse(localStorage.getItem(k));return value?.v===1?value:null;}catch(e){return null;}}
  function load(){const candidates=[read(KEY),read(BACKUP)].filter(Boolean).sort((a,b)=>safe(b.rev)-safe(a.rev));state=normalized(candidates[0]);}
  function daily(){if(state.daily.date!==day())state.daily={date:day(),scores:{memory:0,puzzle:0,colors:0},claimed:[]};}
  function save(){try{daily();state.rev++;const serialized=JSON.stringify(state);localStorage.setItem(KEY,serialized);localStorage.setItem(BACKUP,serialized);return true;}catch(e){status('Não foi possível salvar. Faça um código de recuperação.');return false;}}
  function record(m,points){const g=state[m];g.score=safe(points);g.best=Math.max(g.best,g.score);daily();state.daily.scores[m]=Math.max(state.daily.scores[m],g.score);save();renderHome();}
  function award(coins,xp){return window.KLGBridge?.award?.(coins,xp)===true;}
  function status(text){if($('extraStatus'))$('extraStatus').textContent=text;}
  function victorySound(){if(!window.KLGBridge?.soundEnabled?.())return;
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;const ctx=new Audio();
      [523,659,784].forEach((freq,i)=>{const osc=ctx.createOscillator(),volume=ctx.createGain(),time=ctx.currentTime+i*.1;
        osc.type='sine';osc.frequency.value=freq;volume.gain.setValueAtTime(.001,time);volume.gain.linearRampToValueAtTime(.09,time+.025);volume.gain.exponentialRampToValueAtTime(.001,time+.17);
        osc.connect(volume).connect(ctx.destination);osc.start(time);osc.stop(time+.19);});setTimeout(()=>ctx.close().catch(()=>{}),650);
    }catch(e){} }
  function cheer(text){victorySound();const n=$('extraCelebration');$('extraCelebrateMessage').textContent=text;n.classList.remove('hidden');n.classList.remove('pop');void n.offsetWidth;n.classList.add('pop');clearTimeout(cheerTimer);cheerTimer=setTimeout(()=>n.classList.add('hidden'),1950);}
  function clearTimers(){clearTimeout(flipTimer);clearTimeout(cheerTimer);clearTimeout(noticeTimer);lock=false;$('extraCelebration').classList.add('hidden');}
  function win(m,points,message){const g=state[m];if(g.finished)return;g.finished=true;state.stats.wins++;record(m,points);cheer(message);status('🏆 Desafio concluído! Confira o torneio para resgatar prêmios.');render();}
  function freshMemory(){const cards=shuffle([...Array(8).keys(),...Array(8).keys()]);return {...blank('memory'),best:state.memory.best,cards,matched:Array(16).fill(false),started:true};}
  function freshPuzzle(){let a=[1,2,3,4,5,6,7,8,0],prev=-1;for(let k=0;k<85;k++){
    const zero=a.indexOf(0),candidates=adjacent(zero,3).filter(v=>v!==prev),to=candidates[Math.floor(Math.random()*candidates.length)];
    [a[zero],a[to]]=[a[to],a[zero]];prev=zero;
  }if(a.every((v,i)=>v===[1,2,3,4,5,6,7,8,0][i]))[a[7],a[8]]=[a[8],a[7]];
    return {...blank('puzzle'),best:state.puzzle.best,tiles:a,started:true};}
  const adjacent=(pos,w)=>{const r=Math.floor(pos/w),c=pos%w,out=[];if(r>0)out.push(pos-w);if(r<w-1)out.push(pos+w);if(c>0)out.push(pos-1);if(c<w-1)out.push(pos+1);return out;};
  function matches(grid){const found=new Set();for(let r=0;r<6;r++)for(let c=0;c<6;c++){
    const i=r*6+c,val=grid[i];if(c<=3&&val===grid[i+1]&&val===grid[i+2]){let n=c;while(n<6&&grid[r*6+n]===val){found.add(r*6+n);n++;}}
    if(r<=3&&val===grid[i+6]&&val===grid[i+12]){let n=r;while(n<6&&grid[n*6+c]===val){found.add(n*6+c);n++;}}
  }return [...found];}
  function swap(grid,a,b){[grid[a],grid[b]]=[grid[b],grid[a]];}
  function hasMove(grid){for(let i=0;i<36;i++)for(const j of adjacent(i,6)){swap(grid,i,j);const good=matches(grid).length>0;swap(grid,i,j);if(good)return true;}return false;}
  function makeColors(){for(let t=0;t<140;t++){const a=[];for(let i=0;i<36;i++){
    let val;do{val=Math.floor(Math.random()*COLORS.length);}while((i%6>=2&&a[i-1]===val&&a[i-2]===val)||(i>=12&&a[i-6]===val&&a[i-12]===val));a.push(val);
  }if(hasMove(a))return a;}
    return Array.from({length:36},(_,i)=>i%6);}
  function freshColors(){return {...blank('colors'),best:state.colors.best,grid:makeColors(),started:true};}
  function newGame(ask=false){if(!mode)return;if(ask&&!confirm('Começar outra partida neste modo?'))return;
    clearTimers();state[mode]=mode==='memory'?freshMemory():mode==='puzzle'?freshPuzzle():freshColors();state.stats.games++;save();status('');render();}
  function enter(m){if(!MODES.includes(m))return;clearTimers();mode=m;$('homeScreen').classList.add('hidden');$('gameScreen').classList.add('hidden');$('arcadeScreen').classList.add('hidden');$('extraScreen').classList.remove('hidden');
    if(!state[m].started||state[m].finished)newGame();else{status('Partida restaurada. Continue de onde parou!');render();}window.scrollTo?.(0,0);}
  function exit(){if(!mode)return;clearTimers();if(mode==='memory')state.memory.flipped=[];save();mode=null;$('extraScreen').classList.add('hidden');window.KLGBridge?.toHome?.();renderHome();}
  function onMemory(i){const g=state.memory;if(lock||g.finished||g.matched[i]||g.flipped.includes(i))return;
    g.flipped.push(i);render();if(g.flipped.length<2){save();return;}
    g.moves++;const [a,b]=g.flipped;if(g.cards[a]===g.cards[b]){
      g.matched[a]=true;g.matched[b]=true;g.flipped=[];state.stats.matches++;save();
      if(g.matched.every(Boolean))win('memory',Math.max(100,1300-g.moves*35),'MEMÓRIA TOP!');else{status('🦎 Par encontrado!');render();}
    }else{lock=true;status('Tente lembrar onde estavam as figuras.');save();flipTimer=setTimeout(()=>{if(mode!=='memory')return;g.flipped=[];lock=false;save();render();},850);}
  }
  function onPuzzle(i){const g=state.puzzle;if(g.finished)return;const z=g.tiles.indexOf(0);if(!adjacent(z,3).includes(i))return;
    [g.tiles[z],g.tiles[i]]=[g.tiles[i],g.tiles[z]];g.moves++;if(g.tiles.every((x,j)=>x===[1,2,3,4,5,6,7,8,0][j]))win('puzzle',Math.max(100,1600-g.moves*12),'QUEBRA-CABEÇA!');else{save();render();}
  }
  function refillColors(grid){for(let c=0;c<6;c++){
    const vals=[];for(let r=5;r>=0;r--)if(grid[r*6+c]!==null)vals.push(grid[r*6+c]);
    for(let r=5;r>=0;r--)grid[r*6+c]=r>=6-vals.length?vals[5-r]:Math.floor(Math.random()*COLORS.length);
  }}
  function onColors(i){const g=state.colors;if(g.finished)return;
    if(g.selected<0){g.selected=i;render();return;}
    if(g.selected===i){g.selected=-1;render();return;}
    if(!adjacent(g.selected,6).includes(i)){g.selected=i;render();return;}
    const a=g.selected;g.selected=-1;swap(g.grid,a,i);let found=matches(g.grid);
    if(!found.length){swap(g.grid,a,i);status('Troca sem trio: escolha outras duas cores vizinhas.');render();return;}
    g.moves++;let chain=0,total=0,points=0;
    while(found.length&&chain<25){chain++;total+=found.length;points+=found.length*20*chain;for(const k of found)g.grid[k]=null;refillColors(g.grid);found=matches(g.grid);}
    g.combos=Math.max(g.combos,chain);state.stats.colorClears+=total;
    if(!hasMove(g.grid))g.grid=makeColors();
    record('colors',Math.min(999999999,g.score+points));if(chain>=2)cheer('COMBO ×'+chain+'!');
    status('🌈 '+total+' blocos eliminados! +'+points+' pontos.');render();
  }
  function clickCell(i){if(!mode||!Number.isInteger(i))return;if(mode==='memory')onMemory(i);else if(mode==='puzzle')onPuzzle(i);else onColors(i);}
  function makeButton(index,text,cls,description){const button=document.createElement('button');button.type='button';button.dataset.index=index;button.className='extra-tile '+cls;button.textContent=text;button.setAttribute('aria-label',description);return button;}
  function render(){if(!mode)return;const g=state[mode],board=$('extraBoard');board.replaceChildren();board.className='extra-board '+mode+'-grid';
    $('extraTitle').textContent=NAMES[mode];$('extraScore').textContent=fmt(g.score);$('extraBest').textContent=fmt(g.best);
    $('extraMovesLabel').textContent=mode==='memory'?'TENTATIVAS':mode==='puzzle'?'MOVIMENTOS':'TROCAS';$('extraMoves').textContent=fmt(g.moves);
    if(mode==='memory'){
      g.cards.forEach((n,i)=>{const open=g.matched[i]||g.flipped.includes(i);const cell=makeButton(i,open?EMOJI[n]:'?',open?'card-up':'card-down',open?'Figura revelada':'Carta virada para baixo');if(g.matched[i])cell.classList.add('matched');board.append(cell);});
      $('extraInstructions').textContent='Toque em duas cartas para descobrir os 8 pares. Menos tentativas = mais pontos.';
    }else if(mode==='puzzle'){
      g.tiles.forEach((n,i)=>{const cell=makeButton(i,n||'',n?'puzzle-tile':'puzzle-empty',n?'Peça '+n:'Espaço vazio');if(!n)cell.disabled=true;board.append(cell);});
      $('extraInstructions').textContent='Deslize tocando em uma peça vizinha do espaço vazio. Organize de 1 a 8.';
    }else{
      g.grid.forEach((n,i)=>{const cell=makeButton(i,'','color-tile','Cor '+(n+1));cell.style.setProperty('--tile',COLORS[n]);if(g.selected===i)cell.classList.add('selected');board.append(cell);});
      $('extraInstructions').textContent='Toque em duas cores vizinhas para trocar. Forme trios na horizontal ou vertical.';
    }
    $('extraCoins').textContent=$('homeCoins')?.textContent||'0';$('extraLevel').textContent=$('homeLevel')?.textContent||'1';
    if(g.finished)status('🏆 Você concluiu! Toque em NOVA PARTIDA para jogar novamente.');
  }
  function renderHome(){for(const m of MODES){const el=$(m+'HomeBest');if(el)el.textContent='Recorde: '+fmt(state[m].best);}}
  function rankData(){const classic=Number(($('homeBest')?.textContent||'0').replace(/[^0-9]/g,''))||0;const legacy=window.KLGArcade?.exportBackup?.()||{};
    return [{name:'🧩 Block Clássico',value:classic},{name:'🧱 Queda de Blocos',value:safe(legacy.fallBest)},{name:'🔢 Fusão 2048',value:safe(legacy.mergeBest)},
      {name:'🧠 Memória',value:state.memory.best},{name:'🧩 Quebra-Cabeça',value:state.puzzle.best},{name:'🌈 Fusão de Cores',value:state.colors.best}];}
  function showTournament(){daily();const host=$('tournamentChallenges');host.replaceChildren();$('tournamentDate').textContent='📅 '+state.daily.date.split('-').reverse().join('/')+' · 🏆 '+fmt(state.stats.trophies)+' troféu(s)';
    for(const goal of GOALS){const achieved=state.daily.scores[goal.id]>=goal.target,claimed=state.daily.claimed.includes(goal.id);
      const item=document.createElement('div');item.className='tournament-item';const label=document.createElement('div');label.className='tournament-text';
      const title=document.createElement('strong');title.textContent=goal.title;
      const text=document.createElement('small');text.textContent=NAMES[goal.id]+' · '+fmt(state.daily.scores[goal.id])+'/'+fmt(goal.target)+' pontos';
      const reward=document.createElement('small');reward.textContent='🪙 '+goal.coins+' moedas · ⚡ '+goal.xp+' XP';label.append(title,text,reward);
      const btn=document.createElement('button');btn.type='button';btn.className='tournament-claim';btn.textContent=claimed?'RESGATADO':achieved?'RESGATAR':'EM ANDAMENTO';btn.disabled=claimed||!achieved;
      btn.addEventListener('click',()=>{daily();if(state.daily.claimed.includes(goal.id)||state.daily.scores[goal.id]<goal.target)return;
        if(!award(goal.coins,goal.xp)){btn.textContent='ERRO AO CREDITAR';return;}
        state.daily.claimed.push(goal.id);state.stats.trophies++;save();showTournament();renderHome();});item.append(label,btn);host.append(item);
    }
    const rank=$('personalRankings');rank.replaceChildren();rankData().sort((a,b)=>b.value-a.value).forEach((entry,i)=>{
      const row=document.createElement('div');row.className='ranking-entry';const left=document.createElement('span');left.textContent=(i+1)+'º '+entry.name;const right=document.createElement('strong');right.textContent=fmt(entry.value);row.append(left,right);rank.append(row);
    });$('tournamentModal').classList.remove('hidden');}
  function exportBackup(){return {v:1,bests:Object.fromEntries(MODES.map(m=>[m,state[m].best])),stats:{...state.stats}};}
  function importBackup(raw){if(raw?.v!==1||!raw.bests||typeof raw.bests!=='object')return false;
    for(const m of MODES)state[m].best=Math.max(state[m].best,safe(raw.bests[m]));
    if(raw.stats)for(const key of Object.keys(state.stats))state.stats[key]=Math.max(state.stats[key],safe(raw.stats[key]));
    save();renderHome();return true;}
  function bind(){for(const m of MODES)$(m+'ModeBtn').addEventListener('click',()=>enter(m));
    $('extraBack').addEventListener('click',exit);$('extraExit').addEventListener('click',exit);
    $('extraNew').addEventListener('click',()=>newGame(true));$('extraRestartTop').addEventListener('click',()=>newGame(true));
    $('extraBoard').addEventListener('click',e=>{const tile=e.target.closest('button[data-index]');if(tile)clickCell(Number(tile.dataset.index));});
    $('tournamentBtn').addEventListener('click',showTournament);$('closeTournament').addEventListener('click',()=>$('tournamentModal').classList.add('hidden'));
    $('tournamentModal').addEventListener('click',e=>{if(e.target===$('tournamentModal'))$('tournamentModal').classList.add('hidden');});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('tournamentModal').classList.contains('hidden')){$('tournamentModal').classList.add('hidden');return;}if(mode)exit();}});
    window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden){if(mode==='memory'){clearTimeout(flipTimer);lock=false;state.memory.flipped=[];}save();}});
  }
  window.KLGExtras15={exportBackup,importBackup,refreshHome:renderHome};
  document.addEventListener('DOMContentLoaded',()=>{load();bind();renderHome();});
})();
