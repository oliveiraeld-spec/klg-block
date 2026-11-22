(() => {
  'use strict';
  // Os jogos extras usam chaves separadas para não modificar a partida clássica.
  const KEY='klg-arcade-1.4', BACKUP='klg-arcade-1.4-backup';
  const WIDTH=10, HEIGHT=18, MERGE_SIZE=4;
  // Fase derivada da pontuação: preserva partidas e recordes das versões anteriores.
  const POINTS_PER_LEVEL=400, BASE_FALL_MS=800, FASTER_EACH_LEVEL_MS=70, MIN_FALL_MS=120;
  const fallLevel=score=>Math.floor(num(score)/POINTS_PER_LEVEL)+1;
  const fallInterval=score=>Math.max(MIN_FALL_MS,BASE_FALL_MS-(fallLevel(score)-1)*FASTER_EACH_LEVEL_MS);
  const $=id=>document.getElementById(id);
  const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999999;
  const num=n=>valid(n)?n:0;
  const format=n=>num(n).toLocaleString('pt-BR');
  const empty=()=>Array.from({length:HEIGHT},()=>Array(WIDTH).fill(null));
  const emptyMerge=()=>Array.from({length:MERGE_SIZE},()=>Array(MERGE_SIZE).fill(0));
  const SHAPES=[
    [[0,0],[0,1],[0,2],[0,3]], // barra
    [[0,0],[0,1],[1,0],[1,1]], // quadrado
    [[0,1],[1,0],[1,1],[1,2]], // T
    [[0,1],[0,2],[1,0],[1,1]], // S
    [[0,0],[0,1],[1,1],[1,2]], // Z
    [[0,0],[1,0],[1,1],[1,2]], // L
    [[0,2],[1,0],[1,1],[1,2]]  // J
  ];
  const fallDefault=()=>({board:empty(),active:null,score:0,best:0,lines:0,ended:false,paused:true,started:false});
  const mergeDefault=()=>({grid:emptyMerge(),score:0,best:0,moves:0,ended:false,started:false});
  let data={v:1,rev:0,fall:fallDefault(),merge:mergeDefault()};
  let mode=null, ticker=null, lastTick=0, touch=null;
  let context=null,noticeTimer=null;
  function sound(){
    if(!window.KLGBridge?.soundEnabled?.())return;
    try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      context=context||new AC();const o=context.createOscillator(),g=context.createGain();
      o.type='sine';o.frequency.value=530;g.gain.setValueAtTime(.045,context.currentTime);g.gain.exponentialRampToValueAtTime(.001,context.currentTime+.11);
      o.connect(g).connect(context.destination);o.start();o.stop(context.currentTime+.12);
    }catch(e){}
  }
  function validBoard(b){return Array.isArray(b)&&b.length===HEIGHT&&b.every(r=>Array.isArray(r)&&r.length===WIDTH&&r.every(x=>x===null||(Number.isInteger(x)&&x>=0&&x<SHAPES.length)));}
  function validGrid(g){return Array.isArray(g)&&g.length===4&&g.every(r=>Array.isArray(r)&&r.length===4&&r.every(n=>n===0||(Number.isInteger(n)&&n>=2&&n<=131072&&(n&(n-1))===0)));}
  function validActive(a){return a===null || (a&&Number.isInteger(a.type)&&a.type>=0&&a.type<7&&Number.isInteger(a.r)&&a.r>=-4&&a.r<HEIGHT&&Number.isInteger(a.c)&&a.c>=-4&&a.c<WIDTH&&Array.isArray(a.cells)&&a.cells.length===4&&a.cells.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isInteger(n)&&n>=0&&n<5)));}
  function normalize(raw){
    const d={v:1,rev:num(raw?.rev),fall:fallDefault(),merge:mergeDefault()};
    if(raw?.fall){const f=raw.fall;d.fall.best=num(f.best);if(validBoard(f.board)&&validActive(f.active))d.fall={board:f.board,active:f.active,score:num(f.score),best:Math.max(num(f.best),num(f.score)),lines:num(f.lines),ended:Boolean(f.ended),paused:true,started:Boolean(f.started)};}
    if(raw?.merge){const m=raw.merge;d.merge.best=num(m.best);if(validGrid(m.grid))d.merge={grid:m.grid,score:num(m.score),best:Math.max(num(m.best),num(m.score)),moves:num(m.moves),ended:Boolean(m.ended),started:Boolean(m.started)};}
    return d;
  }
  function fromKey(key){try{return JSON.parse(localStorage.getItem(key));}catch(e){return null;}}
  function load(){
    const all=[fromKey(KEY),fromKey(BACKUP)].filter(v=>v&&v.v===1&&valid(v.rev)).sort((a,b)=>b.rev-a.rev);
    data=normalize(all[0]);
  }
  function save(){try{data.rev++;const value=JSON.stringify(data);localStorage.setItem(KEY,value);localStorage.setItem(BACKUP,value);}catch(e){announce('Espaço insuficiente para salvar. Use o código de recuperação.');}}
  function award(coins,xp){window.KLGBridge?.award?.(coins,xp);}
  function announce(message,persistent=false){const n=$('arcadeNotice');clearTimeout(noticeTimer);n.textContent=message;n.classList.remove('hidden');if(!persistent)noticeTimer=setTimeout(clearNotice,1500);}
  function clearNotice(){clearTimeout(noticeTimer);const n=$('arcadeNotice');n.classList.add('hidden');n.textContent='';}
  let levelToastTimer=null;
  function showLevelToast(level){const el=$('fallLevelToast');if(!el)return;clearTimeout(levelToastTimer);el.textContent='🎉 NÍVEL '+level+'!';el.classList.remove('hidden','level-pop');void el.offsetWidth;el.classList.add('level-pop');levelToastTimer=setTimeout(()=>el.classList.add('hidden'),1850);}
  function updateHome(){if($('fallHomeBest'))$('fallHomeBest').textContent='Recorde: '+format(data.fall.best);if($('mergeHomeBest'))$('mergeHomeBest').textContent='Recorde: '+format(data.merge.best);}
  function randomPiece(){const type=Math.floor(Math.random()*7);return {type,r:-1,c:Math.floor((WIDTH-3)/2),cells:SHAPES[type].map(p=>[...p])};}
  function collision(piece,r=piece.r,c=piece.c,cells=piece.cells){return cells.some(([y,x])=>{const yy=r+y,xx=c+x;return xx<0||xx>=WIDTH||yy>=HEIGHT||(yy>=0&&data.fall.board[yy][xx]!==null);});}
  function spawn(){const f=data.fall;f.active=randomPiece();if(collision(f.active)){f.ended=true;f.paused=true;f.active=null;announce('Fim de jogo! Toque em NOVA PARTIDA para tentar novamente.',true);}}
  function beginFall(){data.fall={...fallDefault(),started:true,paused:false,best:data.fall.best};spawn();save();clearNotice();render();}
  function moveFall(dc){const f=data.fall;if(!f.started||f.paused||f.ended||!f.active)return;
    if(!collision(f.active,f.active.r,f.active.c+dc))f.active.c+=dc;
    save();render();
  }
  function rotateFall(){const f=data.fall;if(!f.started||f.paused||f.ended||!f.active)return;
    const p=f.active;let rotated=p.cells.map(([r,c])=>[c,-r]);let minR=Math.min(...rotated.map(x=>x[0])),minC=Math.min(...rotated.map(x=>x[1]));
    rotated=rotated.map(([r,c])=>[r-minR,c-minC]);
    for(const offset of [0,-1,1,-2,2])if(!collision(p,p.r,p.c+offset,rotated)){p.cells=rotated;p.c+=offset;break;}
    save();render();
  }
  function downFall(){const f=data.fall;if(!f.started||f.paused||f.ended||!f.active)return false;
    const p=f.active;if(!collision(p,p.r+1,p.c)){p.r++;save();render();return true;}
    lockPiece();return false;
  }
  function hardDrop(){const f=data.fall;if(!f.started||f.paused||f.ended||!f.active)return;
    const scoreBefore=f.score;
    let count=0;while(!collision(f.active,f.active.r+1,f.active.c)&&count<HEIGHT+4){f.active.r++;count++;}
    f.score=Math.min(999999999,f.score+count);lockPiece(scoreBefore);
  }
  function lockPiece(scoreBefore=data.fall.score){const f=data.fall,p=f.active;if(!p)return;
    if(p.cells.some(([r])=>p.r+r<0)){f.ended=true;f.paused=true;f.active=null;announce('Fim de jogo!',true);save();render();return;}
    for(const [r,c]of p.cells){f.board[p.r+r][p.c+c]=p.type;}
    const kept=f.board.filter(row=>row.some(x=>x===null));const removed=HEIGHT-kept.length;
    if(removed){f.board=Array.from({length:removed},()=>Array(WIDTH).fill(null)).concat(kept);f.lines+=removed;
      const gain=[0,100,250,450,800][removed]*(Math.floor(f.lines/10)+1);
      f.score=Math.min(999999999,f.score+gain);award(removed*3,removed*12);sound();
      announce('🦎 Calango limpou '+removed+' linha(s)! +'+(removed*3)+' moedas');
    }
    if(f.score>f.best)f.best=f.score;
    const newLevel=fallLevel(f.score);
    if(newLevel>fallLevel(scoreBefore)){
      sound();announce('🦎 Você subiu para o nível '+newLevel+'!');showLevelToast(newLevel);
      lastTick=Date.now();
    }
    spawn();save();render();updateHome();
  }
  function startTicker(){stopTicker();lastTick=Date.now();ticker=setInterval(()=>{
    if(mode!=='fall'||data.fall.paused||data.fall.ended)return;
    const interval=fallInterval(data.fall.score);
    if(Date.now()-lastTick>=interval){lastTick=Date.now();downFall();}
  },70);}
  function stopTicker(){if(ticker)clearInterval(ticker);ticker=null;}
  function fallView(){
    const f=data.fall,arr=f.board.map(row=>[...row]);
    if(f.active){const p=f.active;let ghostY=p.r;while(!collision(p,ghostY+1,p.c))ghostY++;
      for(const [r,c]of p.cells){const y=ghostY+r,x=p.c+c;if(y>=0&&y<HEIGHT&&arr[y][x]===null)arr[y][x]='ghost';}
      for(const [r,c]of p.cells){const y=p.r+r,x=p.c+c;if(y>=0&&y<HEIGHT)arr[y][x]=p.type;}
    }
    return arr;
  }
  function showFallBoard(){const board=$('arcadeBoard');board.className='arcade-board fall-board';
    const tiles=fallView().flat();const frag=document.createDocumentFragment();
    for(const color of tiles){const cell=document.createElement('div');cell.className='arcade-cell '+(color===null?'':color==='ghost'?'ghost':'filled color-'+color);cell.setAttribute('role','gridcell');frag.append(cell);}
    board.replaceChildren(frag);
  }
  function beginMerge(){data.merge={...mergeDefault(),best:data.merge.best,started:true};spawnMerge();spawnMerge();save();clearNotice();render();}
  function spawnMerge(){const m=data.merge,blanks=[];
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(m.grid[r][c]===0)blanks.push([r,c]);
    if(blanks.length===0)return;const [r,c]=blanks[Math.floor(Math.random()*blanks.length)];m.grid[r][c]=Math.random()<.9?2:4;
  }
  function transpose(grid){return grid[0].map((_,i)=>grid.map(row=>row[i]));}
  function mergeLine(line){let vals=line.filter(Boolean),gain=0;
    for(let i=0;i<vals.length-1;i++)if(vals[i]===vals[i+1]){vals[i]*=2;gain+=vals[i];vals.splice(i+1,1);}
    return {values:vals.concat(Array(4-vals.length).fill(0)),gain};
  }
  function moveMerge(direction){const m=data.merge;if(mode!=='merge'||m.ended||!m.started)return;
    const before=m.grid.map(r=>[...r]);let grid=before.map(r=>[...r]),scoreGain=0;
    if(['up','down'].includes(direction))grid=transpose(grid);
    for(let i=0;i<4;i++){
      const reversed=direction==='right'||direction==='down';let line=reversed?[...grid[i]].reverse():grid[i];
      const merged=mergeLine(line);grid[i]=reversed?merged.values.reverse():merged.values;scoreGain+=merged.gain;
    }
    if(['up','down'].includes(direction))grid=transpose(grid);
    if(grid.every((row,i)=>row.every((v,j)=>v===before[i][j])))return;
    m.grid=grid;m.moves++;const oldScore=m.score;m.score=Math.min(999999999,m.score+scoreGain);m.best=Math.max(m.score,m.best);
    spawnMerge();
    const earned=Math.floor(m.score/128)-Math.floor(oldScore/128);
    if(earned>0){award(Math.min(earned*2,200),Math.min(earned*6,500));sound();announce('🦎 Fusão! +'+(earned*2)+' moedas e +'+(earned*6)+' XP');}
    else clearNotice();
    if(!mergeCanMove(m.grid)){m.ended=true;announce('Fim de jogo! Você chegou até '+Math.max(...m.grid.flat())+'.',true);}
    save();render();updateHome();
  }
  function mergeCanMove(grid){
    for(let r=0;r<4;r++)for(let c=0;c<4;c++){
      if(!grid[r][c]||(r<3&&grid[r][c]===grid[r+1][c])||(c<3&&grid[r][c]===grid[r][c+1]))return true;
    }return false;
  }
  function showMergeBoard(){const board=$('arcadeBoard');board.className='arcade-board merge-board';
    const frag=document.createDocumentFragment();for(const n of data.merge.grid.flat()){
      const cell=document.createElement('div');cell.className='arcade-cell '+(n?'merge-'+Math.min(n,2048):'');cell.textContent=n?n:'';cell.setAttribute('role','gridcell');frag.append(cell);
    }board.replaceChildren(frag);
  }
  function render(){if(!mode)return;
    $('arcadeScreen').classList.toggle('retro-fall',mode==='fall');
    $('fallLevelPanel').classList.toggle('hidden',mode!=='fall');
    if(mode==='fall'){
      const f=data.fall;$('arcadeTitle').textContent='QUEDA DE BLOCOS';$('arcadeSubtitle').textContent='LCD RETRÔ • CALANGO';
      const level=fallLevel(f.score), interval=fallInterval(f.score);
      $('fallLevel').textContent=String(level);
      $('fallSpeed').textContent=(interval/1000).toFixed(2).replace('.',',')+' s';
      $('fallNext').textContent=format(POINTS_PER_LEVEL-(f.score%POINTS_PER_LEVEL));
      $('fallProgressFill').style.width=((f.score%POINTS_PER_LEVEL)/POINTS_PER_LEVEL*100)+'%';
      $('arcadeScore').textContent=format(f.score);$('arcadeBest').textContent=format(f.best);
      $('arcadeMetricLabel').textContent='LINHAS';$('arcadeMetric').textContent=format(f.lines);
      $('fallControls').classList.remove('hidden');$('mergeControls').classList.add('hidden');
      $('arcadeTip').textContent='Cursor amarelo: ◀ ▶ ▼ · botão grande: girar · ⤓: soltar. Nova fase a cada 400 pontos.';
      $('arcadePause').classList.remove('hidden');$('arcadePause').textContent=f.paused?'▶':'Ⅱ';
      showFallBoard();
      if(f.paused&&!f.ended)announce('PAUSADO · Toque em ▶ para continuar.',true);
      else if(f.ended)announce('FIM DE JOGO · Comece outra partida.',true);
      else if($('arcadeNotice').textContent.startsWith('PAUSADO'))clearNotice();
    }else{
      const m=data.merge;$('arcadeTitle').textContent='FUSÃO 2048';$('arcadeSubtitle').textContent='UNA NÚMEROS • KLG';
      $('arcadeScore').textContent=format(m.score);$('arcadeBest').textContent=format(m.best);
      $('arcadeMetricLabel').textContent='MOVIMENTOS';$('arcadeMetric').textContent=format(m.moves);
      $('fallControls').classList.add('hidden');$('mergeControls').classList.remove('hidden');
      $('arcadeTip').textContent='Deslize o dedo no tabuleiro ou use as setas para unir números iguais.';
      $('arcadePause').classList.add('hidden');showMergeBoard();
    }
  }
  function enter(next){if(next!=='fall'&&next!=='merge')return;mode=next;
    $('homeScreen').classList.add('hidden');$('gameScreen').classList.add('hidden');$('arcadeScreen').classList.remove('hidden');clearNotice();
    if(next==='fall'){
      if(!data.fall.started||data.fall.ended)beginFall();
      else {data.fall.paused=false;save();}
      lastTick=Date.now();startTicker();
    }else{stopTicker();if(!data.merge.started||data.merge.ended)beginMerge();}
    render();
  }
  function goHome(){if($('fallLevelToast'))$('fallLevelToast').classList.add('hidden');if(mode==='fall'&&data.fall.started&&!data.fall.ended)data.fall.paused=true;
    stopTicker();save();mode=null;$('arcadeScreen').classList.add('hidden');clearNotice();updateHome();window.KLGBridge?.toHome?.();
  }
  function restart(){if(!mode)return;
    if(mode==='fall')beginFall();else beginMerge();lastTick=Date.now();
  }
  function togglePause(){if(mode!=='fall'||data.fall.ended)return;
    data.fall.paused=!data.fall.paused;lastTick=Date.now();if(!data.fall.paused)clearNotice();save();render();
  }
  function exportBackup(){return {v:1,fallBest:data.fall.best,mergeBest:data.merge.best};}
  function importBackup(payload){if(!payload||payload.v!==1||!valid(payload.fallBest)||!valid(payload.mergeBest))return false;
    data.fall.best=Math.max(data.fall.best,payload.fallBest);data.merge.best=Math.max(data.merge.best,payload.mergeBest);save();updateHome();return true;
  }
  function bind(){
    $('fallModeBtn').addEventListener('click',()=>enter('fall'));
    $('mergeModeBtn').addEventListener('click',()=>enter('merge'));
    $('classicModeBtn').addEventListener('click',()=>$('playBtn').click());
    $('arcadeBack').addEventListener('click',goHome);$('arcadeHome').addEventListener('click',goHome);
    $('arcadeRestart').addEventListener('click',()=>{if(confirm('Reiniciar esta partida?'))restart();});
    $('arcadePause').addEventListener('click',togglePause);
    $('fallLeft').addEventListener('click',()=>moveFall(-1));$('fallRight').addEventListener('click',()=>moveFall(1));
    $('fallRotate').addEventListener('click',rotateFall);$('fallUp').addEventListener('click',rotateFall);$('fallDown').addEventListener('click',()=>{downFall();lastTick=Date.now();});$('fallDrop').addEventListener('click',()=>{hardDrop();lastTick=Date.now();});
    for(const dir of ['Up','Down','Left','Right'])$('merge'+dir).addEventListener('click',()=>moveMerge(dir.toLowerCase()));
    document.addEventListener('keydown',e=>{
      if(!mode||$('arcadeScreen').classList.contains('hidden'))return;
      const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Escape'];if(!keys.includes(e.key))return;
      e.preventDefault();if(e.key==='Escape'){goHome();return;}
      if(mode==='fall'){if(e.key==='ArrowLeft')moveFall(-1);else if(e.key==='ArrowRight')moveFall(1);else if(e.key==='ArrowUp')rotateFall();else if(e.key==='ArrowDown')downFall();else if(e.key===' ')hardDrop();}
      else{const directions={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};if(directions[e.key])moveMerge(directions[e.key]);}
    });
    $('arcadeBoard').addEventListener('pointerdown',e=>{if(mode&&!data.fall?.paused)touch={x:e.clientX,y:e.clientY};else if(mode==='merge')touch={x:e.clientX,y:e.clientY};});
    $('arcadeBoard').addEventListener('pointerup',e=>{
      if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;
      if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;
      if(mode==='merge')moveMerge(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');
      if(mode==='fall'){if(Math.abs(dx)>Math.abs(dy))moveFall(dx>0?1:-1);else if(dy<0)rotateFall();else hardDrop();}
    });
    $('arcadeBoard').addEventListener('pointercancel',()=>touch=null);
    window.addEventListener('pagehide',save);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){if(mode==='fall')data.fall.paused=true;save();}else if(mode==='fall')render();});
  }
  window.KLGArcade={exportBackup,importBackup,onHome:updateHome};
  document.addEventListener('DOMContentLoaded',()=>{load();bind();updateHome();});
})();
