/* KLG Block 1.9 — Caça-Pontos do Calango.
   Jogo de labirinto ORIGINAL: não utiliza marcas, personagens ou sons de terceiros.
   Partida e recorde salvos independentemente dos nove jogos anteriores. */
(() => {
  'use strict';
  const KEY='klg-caca-pontos-v1.9', BACKUP=KEY+'-backup', N=13;
  const CFG={easy:{label:'FÁCIL',enemies:1,enemyMs:780},medium:{label:'MÉDIO',enemies:2,enemyMs:580},hard:{label:'DIFÍCIL',enemies:3,enemyMs:420}};
  const $=id=>document.getElementById(id), num=v=>Number.isSafeInteger(v)&&v>=0&&v<=999999999?v:0;
  const format=v=>num(v).toLocaleString('pt-BR');
  const D={up:[-1,0],down:[1,0],left:[0,-1],right:[0,1]};
  const rand=n=>Math.floor(Math.random()*n), pos=(r,c)=>r*N+c;
  const rc=i=>[Math.floor(i/N),i%N];
  let state=null,mode=false,timer=null,lastEnemy=0,lastPlayer=0,rendered=false,touch=null,celebrateTimer=null,noticeTimer=null;
  const blank=()=>({v:1,rev:0,best:0,score:0,level:1,diff:'easy',lives:3,grid:[],player:pos(1,1),enemies:[],dir:'right',wanted:'right',powerUntil:0,invulnerableUntil:0,paused:true,ended:false,started:false,remaining:0});
  function read(k){try{return JSON.parse(localStorage.getItem(k))}catch{return null;}}
  function goodGrid(g){return Array.isArray(g)&&g.length===N*N&&g.every(c=>['#','.',' ','F','*'].includes(c));}
  function normalize(raw){let s=blank();if(!raw||raw.v!==1)return s;
    s.best=num(raw.best);s.rev=num(raw.rev);s.score=num(raw.score);s.level=Math.max(1,Math.min(99,num(raw.level)||1));
    s.diff=CFG[raw.diff]?raw.diff:'easy';s.lives=Math.max(0,Math.min(3,num(raw.lives)));
    if(goodGrid(raw.grid)&&Number.isInteger(raw.player)&&raw.player>=0&&raw.player<N*N&&raw.grid[raw.player]!=='#'){
      s.grid=[...raw.grid];s.player=raw.player;s.enemies=Array.isArray(raw.enemies)?raw.enemies.filter(i=>Number.isInteger(i)&&i>=0&&i<N*N&&s.grid[i]!=='#').slice(0,3):[];
      s.dir=D[raw.dir]?raw.dir:'right';s.wanted=D[raw.wanted]?raw.wanted:s.dir;s.remaining=s.grid.filter(c=>'.F*'.includes(c)).length;
      s.ended=Boolean(raw.ended);s.started=Boolean(raw.started);s.paused=true;
      s.best=Math.max(s.best,s.score);
    }
    return s;
  }
  function load(){const choices=[read(KEY),read(BACKUP)].filter(v=>v?.v===1).sort((a,b)=>num(b.rev)-num(a.rev));state=normalize(choices[0]);save();}
  function save(){if(!state)return;state.rev++;try{const raw=JSON.stringify(state);localStorage.setItem(KEY,raw);localStorage.setItem(BACKUP,raw);}catch{notice('⚠️ Falha ao salvar. Copie o código de recuperação.');}}
  function award(coins,xp){window.KLGBridge?.award?.(coins,xp);}
  function neighbors(i){const [r,c]=rc(i),out=[];for(const [dir,[dr,dc]] of Object.entries(D)){const y=r+dr,x=c+dc;if(y>=0&&y<N&&x>=0&&x<N&&state.grid[pos(y,x)]!=='#')out.push({dir,i:pos(y,x)});}return out;}
  function createMaze(){const a=Array(N*N).fill('#'),visited=new Set([pos(1,1)]),stack=[pos(1,1)];a[pos(1,1)]='.';
    // Gera um labirinto com caminhos conectados, sem zonas impossíveis de alcançar.
    while(stack.length){const at=stack[stack.length-1], [r,c]=rc(at),opts=[];
      for(const [dr,dc] of [[-2,0],[2,0],[0,-2],[0,2]]){const rr=r+dr,cc=c+dc,id=pos(rr,cc);if(rr>0&&rr<N-1&&cc>0&&cc<N-1&&!visited.has(id))opts.push([rr,cc,dr,dc,id]);}
      if(!opts.length){stack.pop();continue;}const [rr,cc,dr,dc,id]=opts[rand(opts.length)];visited.add(id);a[pos(r+dr/2,c+dc/2)]='.';a[pos(rr,cc)]='.';stack.push(id);
    }
    // Pequenas passagens adicionais tornam o percurso mais divertido.
    const candidates=[];for(let r=1;r<N-1;r++)for(let c=1;c<N-1;c++)if(a[pos(r,c)]==='#'){
      if(a[pos(r-1,c)]==='.'&&a[pos(r+1,c)]==='.'||a[pos(r,c-1)]==='.'&&a[pos(r,c+1)]==='.')candidates.push(pos(r,c));
    }
    for(let j=0;j<Math.min(9,candidates.length);j++){const k=rand(candidates.length);a[candidates.splice(k,1)[0]]='.';}
    const floors=a.map((x,i)=>x==='.'?i:-1).filter(i=>i>=0&&i!==pos(1,1));
    for(const idx of floors.filter((_,i)=>i%16===5))a[idx]='F';
    for(const idx of [floors[0],floors[floors.length-1],floors[Math.floor(floors.length/2)]])if(idx!==undefined)a[idx]='*';
    a[pos(1,1)]=' ';return a;
  }
  function furthest(from,count){const queue=[from],dist=Array(N*N).fill(-1);dist[from]=0;
    for(let k=0;k<queue.length;k++)for(const item of neighbors(queue[k]))if(dist[item.i]<0){dist[item.i]=dist[queue[k]]+1;queue.push(item.i);}
    return queue.sort((a,b)=>dist[b]-dist[a]).filter((i,j,all)=>i!==from&&j%Math.max(1,Math.floor(all.length/(count+2)))===0).slice(0,count);
  }
  function newGame(diff=state?.diff||'easy',level=1,keepScore=false){stop();const past=state||blank(),prevBest=past.best,score=keepScore?past.score:0;
    state={...blank(),best:prevBest,score,level,diff,grid:createMaze(),lives:keepScore?past.lives:3,started:true};
    state.remaining=state.grid.filter(c=>'.F*'.includes(c)).length;
    state.enemies=furthest(state.player,CFG[diff].enemies);state.invulnerableUntil=0;state.powerUntil=0;state.paused=true;rendered=false;save();render();notice('🦎 Toque em ▶ COMEÇAR. Fuja das joaninhas e recolha os pontos!');
  }
  function notice(msg){const box=$('chaseNotice');if(box)box.textContent=msg;}
  function showCheer(msg){const el=$('chaseCheer');if(!el)return;clearTimeout(celebrateTimer);$('chaseCheerText').textContent=msg;el.classList.remove('hidden');celebrateTimer=setTimeout(()=>el.classList.add('hidden'),1400);}
  function stop(){if(timer)clearInterval(timer);timer=null;if(state)state.paused=true;}
  function enter(){if(!state)load();window.KLGExtras16?.onHome?.();
    for(const id of ['homeScreen','gameScreen','arcadeScreen','extraScreen','klg16Screen'])$(id)?.classList.add('hidden');
    mode=true;$('chaseScreen').classList.remove('hidden');if(!state.started||state.ended)newGame();else{state.paused=true;render();notice('▶ Continue sua partida salva!');}
    window.scrollTo?.(0,0);
  }
  function exit(){stop();save();mode=false;$('chaseScreen').classList.add('hidden');window.KLGBridge?.toHome?.();updateHome();}
  function render(){if(!mode)return;
    $('chaseScore').textContent=format(state.score);$('chaseBest').textContent=format(state.best);$('chaseLives').textContent=String(state.lives);
    $('chasePause').textContent=state.ended?'FIM DE JOGO':state.paused?'▶ COMEÇAR':'⏸ PAUSAR';$('chasePause').disabled=state.ended;
    for(const d of Object.keys(CFG))$('chaseDiff_'+d).classList.toggle('selected',state.diff===d);
    const board=$('chaseBoard');if(!rendered||board.children.length!==N*N){board.replaceChildren();for(let i=0;i<N*N;i++){const cell=document.createElement('div');cell.setAttribute('role','gridcell');cell.setAttribute('aria-label','Casa '+(i+1));board.append(cell);}rendered=true;}
    const vulnerable=Date.now()<state.powerUntil,protectedNow=Date.now()<state.invulnerableUntil;
    for(let i=0;i<N*N;i++){const c=state.grid[i],el=board.children[i];el.className='chase-cell '+(c==='#'?'wall':'path')+(c==='.'?' dot':c==='*'?' star':c==='F'?' fruit':'');
      el.textContent=c==='*'?'⭐':c==='F'?'🍓':'';
      if(state.enemies.includes(i)){el.className+=' bug'+(vulnerable?' vulnerable':'');el.textContent=vulnerable?'💤':'🐞';}
      if(state.player===i){el.className+=' hero'+(protectedNow?' invulnerable':'');el.textContent='🦎';}
    }
  }
  function best(score){if(score>state.best){state.best=score;updateHome();}save();}
  function take(i){const c=state.grid[i],points=c==='.'?10:c==='F'?50:c==='*'?25:0;if(!points)return;
    state.grid[i]=' ';state.score=Math.min(999999999,state.score+points);state.remaining--;
    if(c==='*'){state.powerUntil=Date.now()+6500;notice('⭐ SUPER CALANGO! Proteção por 6 segundos!');}
    else if(c==='F')notice('🍓 Fruta! +50 pontos!');
    best(state.score);
    if(state.remaining<=0){stop();award(15+state.level*5,40+state.level*10);showCheer('🏆 FASE '+state.level+' COMPLETA!');
      setTimeout(()=>{if(mode&&state?.remaining===0&&!state.ended)newGame(state.diff,state.level+1,true);},1600);}
  }
  function collide(){if(!state.enemies.includes(state.player)||Date.now()<state.invulnerableUntil)return;
    if(Date.now()<state.powerUntil){state.score=Math.min(999999999,state.score+80);state.enemies=state.enemies.map(i=>i===state.player?pos(N-2,N-2):i);best(state.score);notice('🦎 Capturou uma joaninha! +80 pontos');return;}
    state.lives--;state.invulnerableUntil=Date.now()+2300;state.player=pos(1,1);state.dir='right';state.wanted='right';
    if(state.lives<=0){state.ended=true;stop();notice('💔 Fim de jogo! Seu recorde ficou salvo.');showCheer('TENTE NOVAMENTE!');}
    else notice('❤️ Cuidado! Ainda restam '+state.lives+' vidas.');save();
  }
  function moveHero(){const possible=neighbors(state.player),want=possible.find(o=>o.dir===state.wanted),old=possible.find(o=>o.dir===state.dir);
    const next=want||old;if(!next)return;state.player=next.i;state.dir=next.dir;
    take(next.i);collide();
  }
  function enemyStep(){state.enemies=state.enemies.map((enemy,index)=>{
    const n=neighbors(enemy);if(!n.length)return enemy;
    const scored=n.map(o=>({i:o.i,d:Math.abs(Math.floor(o.i/N)-Math.floor(state.player/N))+Math.abs(o.i%N-state.player%N)}));
    const chaseChance=state.diff==='easy'?.43:state.diff==='medium'?.63:.82;
    let choice;
    if(Date.now()<state.powerUntil){choice=scored.sort((a,b)=>b.d-a.d)[0];}
    else if(Math.random()<chaseChance){choice=scored.sort((a,b)=>a.d-b.d)[0];}
    else choice=scored[rand(scored.length)];return choice.i;
  });collide();}
  function tick(){if(!mode||state.paused||state.ended)return;const now=Date.now();
    if(now-lastPlayer>=175){lastPlayer=now;moveHero();}
    if(now-lastEnemy>=CFG[state.diff].enemyMs){lastEnemy=now;enemyStep();}
    render();
  }
  function start(){if(!mode||state.ended)return;state.paused=false;lastPlayer=Date.now();lastEnemy=Date.now();if(timer)clearInterval(timer);timer=setInterval(tick,60);render();notice('🦎 Valendo! Use as direções para guiar o Calango.');save();}
  function toggle(){if(state.ended)return;if(state.paused)start();else{stop();render();save();notice('⏸ Pausado.');}}
  function steer(dir){if(!mode||!state||state.ended||!D[dir])return;state.wanted=dir;if(state.paused)start();}
  function changeDiff(diff){if(!CFG[diff]||diff===state.diff)return;if(confirm('Iniciar outra partida na dificuldade '+CFG[diff].label+'?'))newGame(diff);}
  function updateHome(){const el=$('chaseHomeBest');if(el&&state)el.textContent='Recorde: '+format(state.best);}
  function getBest(){return num(state?.best);}
  function exportBackup(){return {v:1,best:getBest()};}
  function importBackup(raw){if(raw?.v!==1)return false;state.best=Math.max(state.best,num(raw.best));save();updateHome();return true;}
  function bind(){
    $('chaseModeBtn').addEventListener('click',enter);$('chaseBack').addEventListener('click',exit);$('chaseExit').addEventListener('click',exit);
    $('chasePause').addEventListener('click',toggle);$('chaseNew').addEventListener('click',()=>{if(confirm('Iniciar nova partida?'))newGame(state.diff);});
    for(const diff of Object.keys(CFG))$('chaseDiff_'+diff).addEventListener('click',()=>changeDiff(diff));
    for(const [dir,id] of [['up','chaseUp'],['down','chaseDown'],['left','chaseLeft'],['right','chaseRight']]){
      const btn=$(id);btn.addEventListener('pointerdown',e=>{e.preventDefault();steer(dir);});btn.addEventListener('click',()=>steer(dir));
    }
    const board=$('chaseBoard');board.addEventListener('pointerdown',e=>{touch={x:e.clientX,y:e.clientY};});
    board.addEventListener('pointerup',e=>{if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<15)return;steer(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');});
    document.addEventListener('keydown',e=>{if(!mode||$('chaseScreen').classList.contains('hidden'))return;
      if(e.key==='Escape'){exit();return;}
      const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(k){e.preventDefault();steer(k);}if(e.code==='Space'){e.preventDefault();toggle();}
    });
    document.addEventListener('visibilitychange',()=>{if(mode&&document.hidden){stop();save();}});
    window.addEventListener('pagehide',()=>{if(mode)stop();save();});
  }
  window.KLGChase19={getBest,exportBackup,importBackup};
  document.addEventListener('DOMContentLoaded',()=>{load();bind();updateHome();});
})();
