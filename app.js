(() => {
  'use strict';
  const SIZE = 8, STORAGE = 'klg-block-v1.0';
  const XP_LEVEL = 180;
  const SHAPES = [
    [[0,0]], [[0,0],[0,1]], [[0,0],[1,0]],
    [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[1,0],[2,0],[2,1]], [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[0,1],[0,2],[1,2]], [[0,1],[1,1],[2,0],[2,1]],
    [[0,1],[1,0],[1,1],[1,2]], [[0,0],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[1,1],[1,2]], [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
    [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0],[2,1],[2,2]],
    [[0,0],[1,0],[2,0],[3,0],[4,0]],
    [[0,0],[0,1],[0,2],[0,3],[0,4]],
    [[0,0],[1,0],[2,0],[2,1],[2,2]],
    [[0,0],[0,1],[0,2],[1,1],[2,1]],
    [[0,0],[0,1],[1,1]], [[0,0],[1,0],[1,1]]
  ];
  const el = id => document.getElementById(id);
  const blankBoard = () => Array.from({length: SIZE}, () => Array(SIZE).fill(null));
  const random = n => Math.floor(Math.random() * n);
  const shape = piece => SHAPES[piece.kind];
  const dims = cells => ({rows: 1 + Math.max(...cells.map(p => p[0])), cols: 1 + Math.max(...cells.map(p => p[1]))});
  const format = n => Math.max(0,n).toLocaleString('pt-BR');
  let state = {board:blankBoard(), tray:[], score:0, best:0, coins:0, xp:0, lines:0, combo:0, gameOver:false, hasGame:false, sound:true};
  let selected = null, drag = null, ghost = null, currentPreview = null, toastTimer = null, flashTimer = null, soundContext = null;
  let idSeed = 0;

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE));
      if (!data || !Array.isArray(data.board) || data.board.length !== SIZE || !data.board.every(r => Array.isArray(r) && r.length === SIZE) || !Array.isArray(data.tray) || data.tray.length !== 3) return;
      const boardValid = data.board.every(r => r.every(v => v === null || (Number.isInteger(v) && v >= 0 && v < 6)));
      const trayValid = data.tray.every(p => p === null || (p && Number.isInteger(p.kind) && p.kind >= 0 && p.kind < SHAPES.length && Number.isInteger(p.color) && p.color >= 0 && p.color < 6));
      if (!boardValid || !trayValid) return;
      state = {...state,...data,board:data.board,tray:data.tray};
      ['score','best','coins','xp','lines','combo'].forEach(k => {if (!Number.isFinite(state[k]) || state[k] < 0) state[k] = 0;});
    } catch (err) { /* arquivo anterior inválido: mantém início limpo */ }
  }
  function save() {try {localStorage.setItem(STORAGE,JSON.stringify(state));} catch (err) { /* armazenamento bloqueado */ }}
  function pieceOf(kind = random(SHAPES.length)) {return {kind,color:random(6),id:++idSeed};}
  function canFit(piece, row, col) {
    if (!piece) return false;
    return shape(piece).every(([r,c]) => row+r >= 0 && col+c >= 0 && row+r < SIZE && col+c < SIZE && state.board[row+r][col+c] === null);
  }
  function hasSpace(piece) {
    if (!piece) return false;
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) if (canFit(piece,r,c)) return true;
    return false;
  }
  function newSet() {
    let proposed;
    for (let attempt=0;attempt<40;attempt++) {
      proposed = [pieceOf(),pieceOf(),pieceOf()];
      if (proposed.some(hasSpace)) break;
    }
    // Caso o tabuleiro esteja apertado, ainda ofereça a peça mínima quando couber.
    if (!proposed.some(hasSpace) && state.board.some(r => r.includes(null))) proposed[0] = pieceOf(0);
    state.tray = proposed;
  }
  function newGame() {
    clearDrag();
    state.board=blankBoard(); state.tray=[];state.score=0;state.lines=0;state.combo=0;state.gameOver=false;state.hasGame=true;
    selected=null;newSet();save();hide('endModal');showGame();say('Arraste uma peça para jogar.');
  }
  function show(id) {el(id).classList.remove('hidden');}
  function hide(id) {el(id).classList.add('hidden');}
  function showHome() {
    clearDrag();selected=null;hide('gameScreen');show('homeScreen');hide('endModal');
    el('homeBest').textContent=format(state.best); el('homeCoins').textContent=format(state.coins);el('homeLevel').textContent=level();
    el('resumeBtn').classList.toggle('hidden',!state.hasGame || state.gameOver);
  }
  function showGame() {hide('homeScreen');show('gameScreen');render();}
  function level() {return Math.floor(state.xp / XP_LEVEL)+1;}
  function renderStats() {
    el('scoreValue').textContent=format(state.score);el('bestValue').textContent=format(state.best);el('coinsValue').textContent=format(state.coins);
    el('levelValue').textContent=level();el('levelFill').style.width=(((state.xp%XP_LEVEL)/XP_LEVEL)*100)+'%';
    el('xpText').textContent=(state.xp%XP_LEVEL)+'/'+XP_LEVEL+' XP';el('linesValue').textContent=format(state.lines);
    el('soundBtn').textContent=state.sound?'♫':'♪̸';el('soundBtn').setAttribute('aria-pressed',String(state.sound));
    el('comboBadge').textContent=state.combo>1?'🔥 COMBO ×'+state.combo:'FAÇA UM COMBO!';
    el('comboBadge').classList.toggle('hot',state.combo>1);
  }
  function renderBoard() {
    const board=el('board');const fragment=document.createDocumentFragment();
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const cell=document.createElement('button');cell.type='button';cell.className='board-cell';cell.dataset.row=r;cell.dataset.col=c;
      cell.setAttribute('role','gridcell');cell.setAttribute('aria-label',`Linha ${r+1}, coluna ${c+1}${state.board[r][c]===null?', vazio':', ocupado'}`);
      const color=state.board[r][c]; if(color!==null) cell.classList.add('filled','c'+color);
      fragment.append(cell);
    }
    board.replaceChildren(fragment);
  }
  function makePieceGrid(piece, fixedSize) {
    const cells=shape(piece);const {rows,cols}=dims(cells);const grid=document.createElement('span');
    grid.className='piece-grid';grid.style.setProperty('--rows',rows);grid.style.setProperty('--cols',cols);
    if (fixedSize) grid.style.setProperty('--piece-size',fixedSize+'px');
    for(const [r,c] of cells){const tile=document.createElement('span');tile.className='tile c'+piece.color;tile.style.gridRow=r+1;tile.style.gridColumn=c+1;grid.append(tile);}
    return grid;
  }
  function renderTray() {
    const tray=el('tray'),fragment=document.createDocumentFragment();
    state.tray.forEach((piece,index)=>{
      const slot=document.createElement('button');slot.type='button';slot.className='piece-slot'+(piece?'':' empty')+(selected===index?' selected':'');
      slot.dataset.index=index;slot.setAttribute('aria-label',piece?'Peça '+(index+1)+', '+shape(piece).length+' blocos':'Posição vazia');
      if(piece){let {cols,rows}=dims(shape(piece));const size=Math.min(23,Math.floor(94/Math.max(cols,rows)));slot.append(makePieceGrid(piece,size));}
      fragment.append(slot);
    });
    tray.replaceChildren(fragment);
  }
  function render() {renderStats();renderBoard();renderTray();}
  function say(message,isError=false){el('tip').textContent=message;el('tip').classList.toggle('warn',isError);}
  function popToast(message) {
    const node=el('toast');clearTimeout(toastTimer);node.classList.remove('show');void node.offsetWidth;node.textContent=message;node.classList.add('show');
    toastTimer=setTimeout(()=>node.classList.remove('show'),1100);
  }
  function beep(type='tap') {
    if(!state.sound) return;
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      soundContext=soundContext||new Audio();if(soundContext.state==='suspended') soundContext.resume();
      const now=soundContext.currentTime;const notes=type==='win'?[523,659,784]:type==='combo'?[523,659,784,1047]:type==='fail'?[200,170]:[510];
      notes.forEach((frequency,i)=>{
        const start=now+i*.09,osc=soundContext.createOscillator(),gain=soundContext.createGain();osc.type=type==='fail'?'triangle':'sine';osc.frequency.setValueAtTime(frequency,start);
        gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.09,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+.16);
        osc.connect(gain);gain.connect(soundContext.destination);osc.start(start);osc.stop(start+.18);
      });
    } catch(err) { /* áudio opcional */ }
  }
  function place(index,row,col) {
    if(state.gameOver || !state.tray[index]) return false;
    const piece=state.tray[index];if(!canFit(piece,row,col)){say('Não cabe aqui! Tente outro espaço.',true);beep('fail');return false;}
    const occupied=shape(piece).map(([r,c])=>[row+r,col+c]);
    for(const [r,c]of occupied) state.board[r][c]=piece.color;
    state.tray[index]=null;state.score+=occupied.length*10;state.xp+=occupied.length*2;
    const fullRows=[],fullCols=[];
    for(let r=0;r<SIZE;r++) if(state.board[r].every(v=>v!==null))fullRows.push(r);
    for(let c=0;c<SIZE;c++) if(state.board.every(r=>r[c]!==null))fullCols.push(c);
    const lineCount=fullRows.length+fullCols.length;
    let cleared=[];
    if(lineCount){
      const unique=new Set();
      fullRows.forEach(r=>{for(let c=0;c<SIZE;c++)unique.add(r+','+c);});
      fullCols.forEach(c=>{for(let r=0;r<SIZE;r++)unique.add(r+','+c);});
      cleared=[...unique].map(item=>item.split(',').map(Number));
      for(const [r,c] of cleared)state.board[r][c]=null;
      state.combo++;state.lines+=lineCount;
      const bonus=100*lineCount*lineCount+(state.combo-1)*50*lineCount;
      state.score+=bonus;state.coins+=lineCount*3+Math.max(0,state.combo-1)*2;state.xp+=lineCount*16;
      popToast(state.combo>=2?'🔥 COMBO ×'+state.combo+'!':lineCount>=2?'SUPER LIMPEZA!':'BOA, CALANGO!');
      say('Mandou bem! '+lineCount+' linha(s) eliminada(s).');beep(state.combo>=2?'combo':'win');
    } else {state.combo=0;say('Continue encaixando para completar linhas.');beep('tap');}
    if(state.score>state.best){state.best=state.score;}
    selected=null;
    if(state.tray.every(piece=>piece===null))newSet();
    state.gameOver=!state.tray.some(piece=>piece&&hasSpace(piece));
    save();render();
    if(cleared.length){clearTimeout(flashTimer);for(const [r,c]of cleared){const node=el('board').children[r*SIZE+c];if(node)node.classList.add('cleared');}flashTimer=setTimeout(()=>el('board').querySelectorAll('.cleared').forEach(n=>n.classList.remove('cleared')),450);}
    if(state.gameOver) setTimeout(endGame,600);
    return true;
  }
  function endGame() {
    el('finalScore').textContent=format(state.score);el('finalBest').textContent=format(state.best);el('finalLines').textContent=format(state.lines);
    el('endSubtitle').textContent=state.score===state.best&&state.score>0?'🏆 Seu melhor resultado até agora!':'O Calango está pronto para a próxima!';
    show('endModal');beep('fail');
  }
  function clearPreview(){
    el('board').querySelectorAll('.preview-valid,.preview-invalid').forEach(node=>node.classList.remove('preview-valid','preview-invalid'));currentPreview=null;
  }
  function cellMetrics(){
    const cells=el('board').children;if(cells.length!==64)return null;
    const a=cells[0].getBoundingClientRect(),b=cells[1].getBoundingClientRect(),c=cells[8].getBoundingClientRect();
    return {left:a.left,top:a.top,stepX:b.left-a.left,stepY:c.top-a.top,width:a.width,height:a.height};
  }
  function dragPosition(e) {
    if(!drag)return;
    const piece=state.tray[drag.index];if(!piece)return;
    const m=cellMetrics();if(!m)return;
    const dim=dims(shape(piece));const onTouch=drag.pointerType==='touch';
    const left=e.clientX-(dim.cols*m.stepX)/2;
    const top=e.clientY-(onTouch?Math.max(72,m.stepY*2.1):(dim.rows*m.stepY)/2);
    const col=Math.round((left-m.left)/m.stepX),row=Math.round((top-m.top)/m.stepY);
    if(ghost){ghost.style.left=left+'px';ghost.style.top=top+'px';}
    clearPreview();const fits=canFit(piece,row,col);
    for(const [r,c]of shape(piece)){
      const rr=row+r,cc=col+c;if(rr<0||cc<0||rr>=SIZE||cc>=SIZE)continue;
      const node=el('board').children[rr*SIZE+cc];node.classList.add(fits?'preview-valid':'preview-invalid');
    }
    if(ghost)ghost.classList.toggle('invalid',!fits);
    currentPreview={row,col,fits};
  }
  function makeGhost(index){
    const piece=state.tray[index];if(!piece)return;
    const m=cellMetrics();if(!m)return;
    const {rows,cols}=dims(shape(piece));
    const node=document.createElement('div');node.className='ghost-piece';node.style.setProperty('--cols',cols);node.style.setProperty('--rows',rows);
    node.style.setProperty('--step',m.stepX+'px');node.style.setProperty('--gap',(m.stepX-m.width)+'px');
    for(const [r,c]of shape(piece)){
      const tile=document.createElement('span');tile.className='tile c'+piece.color;tile.style.gridRow=r+1;tile.style.gridColumn=c+1;node.append(tile);
    }
    document.body.append(node);ghost=node;
  }
  function clearDrag(){
    if(ghost){ghost.remove();ghost=null;}drag=null;
    if(el('board').children.length)clearPreview();
  }
  function onPieceDown(event){
    const slot=event.target.closest('.piece-slot');if(!slot||!slot.parentElement||event.button>0)return;
    const index=Number(slot.dataset.index);if(!state.tray[index])return;
    event.preventDefault();
    drag={index,startX:event.clientX,startY:event.clientY,moved:false,pointerId:event.pointerId,pointerType:event.pointerType};
    try{slot.setPointerCapture(event.pointerId);}catch(err){}
  }
  function onPieceMove(event){
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<9)return;
    if(!drag.moved){drag.moved=true;makeGhost(drag.index);}
    dragPosition(event);
  }
  function onPieceUp(event){
    if(!drag||drag.pointerId!==event.pointerId)return;
    const index=drag.index,wasMoved=drag.moved,target=currentPreview;
    clearDrag();
    if(wasMoved){if(target?.fits)place(index,target.row,target.col);else {selected=index;renderTray();say('Arraste até um local válido ou toque no tabuleiro.',true);}}
    else {selected=selected===index?null:index;renderTray();say(selected===null?'Selecione outra peça.':'Agora toque no local onde quer encaixar a peça.');beep('tap');}
  }
  function onBoardClick(event){
    const cell=event.target.closest('.board-cell');if(!cell||selected===null||!state.tray[selected])return;
    place(selected,Number(cell.dataset.row),Number(cell.dataset.col));
  }
  function bindEvents(){
    el('playBtn').addEventListener('click',newGame);
    el('resumeBtn').addEventListener('click',()=>{if(!state.gameOver)showGame();});
    el('backBtn').addEventListener('click',showHome);
    el('howBtn').addEventListener('click',()=>show('howModal'));
    el('closeHowBtn').addEventListener('click',()=>hide('howModal'));
    el('howModal').addEventListener('click',e=>{if(e.target===el('howModal'))hide('howModal');});
    el('againBtn').addEventListener('click',newGame);
    el('endHomeBtn').addEventListener('click',showHome);
    el('restartBtn').addEventListener('click',()=>{if(confirm('Começar outra partida? A pontuação atual será reiniciada.'))newGame();});
    el('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;save();renderStats();if(state.sound)beep();});
    el('tray').addEventListener('pointerdown',onPieceDown);
    el('tray').addEventListener('pointermove',onPieceMove);
    el('tray').addEventListener('pointerup',onPieceUp);
    el('tray').addEventListener('pointercancel',clearDrag);
    el('board').addEventListener('click',onBoardClick);
    window.addEventListener('blur',clearDrag);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){hide('howModal');if(!el('gameScreen').classList.contains('hidden')&&el('endModal').classList.contains('hidden'))showHome();}});
  }
  function init(){load();bindEvents();showHome();if('serviceWorker' in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
  document.addEventListener('DOMContentLoaded',init);
})();
