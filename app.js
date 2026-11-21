(() => {
  'use strict';
  const SIZE = 8, STORAGE = 'klg-block-v1.0', PROFILE_KEY = 'klg-block-profile-v1', PROFILE_BACKUP = 'klg-block-profile-backup-v1';
  const EXTRAS_KEY = 'klg-block-extras-v1', EXTRAS_BACKUP = 'klg-block-extras-backup-v1';
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
  let selected = null, drag = null, ghost = null, currentPreview = null, toastTimer = null, flashTimer = null, soundContext = null, cheerTimer = null, particleTimer = null;
  let idSeed = 0, saveRevision = 0, storageWorking = true;
  let daily = {date:'', pieces:0, lines:0, combos:0, claimed:[]};
  const MISSIONS = [
    {id:'lines',name:'Limpa-linhas',description:'Complete 5 linhas ou colunas.',target:5,coins:12,xp:30,icon:'🧱'},
    {id:'combos',name:'Rei do combo',description:'Faça 2 combos de sequência ×2 ou maior.',target:2,coins:15,xp:40,icon:'🔥'},
    {id:'pieces',name:'Mestre dos blocos',description:'Encaixe 20 peças no tabuleiro.',target:20,coins:8,xp:25,icon:'🧩'}
  ];
  // A Loja, as estatísticas e as conquistas usam uma chave nova para preservar
  // integralmente a partida e o perfil aprovados na versão 1.2.
  const THEMES = [
    {id:'classic',name:'Clássico KLG',icon:'🌿',price:0,minLevel:1,colors:['#5ed8ef','#a4f36d','#ffa860','#db91fa','#ffd56e','#fc7e9d']},
    {id:'selva',name:'Selva Calango',icon:'🌳',price:25,minLevel:1,colors:['#54c6ad','#6de679','#f1c35c','#7dc2aa','#b0eb7e','#e88b6f']},
    {id:'neon',name:'Neon Turbo',icon:'⚡',price:60,minLevel:2,colors:['#28e5fa','#7eff36','#ff7b2f','#bf63ff','#f9ef32','#ff55c0']},
    {id:'doce',name:'Doces Coloridos',icon:'🍬',price:90,minLevel:3,colors:['#82cfef','#b5efa0','#f9adbb','#cfb2f4','#fbe59b','#ee96ca']},
    {id:'ouro',name:'Tesouro do Calango',icon:'🏆',price:120,minLevel:5,colors:['#ffe19a','#ffb84a','#ff8c3e','#f6d264','#fff1b0','#e6a92d']}
  ];
  const ACHIEVEMENTS = [
    {id:'explorer',name:'Explorador',description:'Comece 3 partidas.',key:'games',target:3,coins:10,xp:20,icon:'🦎'},
    {id:'combo',name:'Faísca KLG',description:'Faça 1 combo de sequência ×2.',key:'combos',target:1,coins:12,xp:25,icon:'🔥'},
    {id:'blocks',name:'Construtor',description:'Encaixe 40 peças.',key:'pieces',target:40,coins:18,xp:35,icon:'🧩'},
    {id:'lines',name:'Mestre das Linhas',description:'Elimine 20 linhas ou colunas.',key:'lines',target:20,coins:24,xp:45,icon:'🏆'}
  ];
  const freshStats = () => ({games:0,pieces:0,lines:0,combos:0,bestCombo:0,points:0});
  let extras={owned:['classic'],active:'classic',stats:freshStats(),claimed:[],leveledTo:1}, extrasRevision=0;
  const today = () => {const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
  const validNumber = v => Number.isSafeInteger(v) && v >= 0 && v <= 999999999;
  const safeNumber = v => validNumber(v) ? v : 0;
  const isBoardValid = board => Array.isArray(board) && board.length === SIZE && board.every(r => Array.isArray(r) && r.length === SIZE && r.every(v => v === null || (Number.isInteger(v) && v >= 0 && v < 6)));
  const isTrayValid = tray => Array.isArray(tray) && tray.length === 3 && tray.every(p => p === null || (p && Number.isInteger(p.kind) && p.kind >= 0 && p.kind < SHAPES.length && Number.isInteger(p.color) && p.color >= 0 && p.color < 6));
  function parsed(key) {try{const data=JSON.parse(localStorage.getItem(key));return data&&typeof data==='object'?data:null;}catch(e){return null;}}
  function normalizeDaily(value) {
    if(!value || typeof value !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date||'')) return {date:today(),pieces:0,lines:0,combos:0,claimed:[]};
    return {date:value.date,pieces:safeNumber(value.pieces),lines:safeNumber(value.lines),combos:safeNumber(value.combos),claimed:Array.isArray(value.claimed)?value.claimed.filter(v => MISSIONS.some(m=>m.id===v)):[]};
  }
  function refreshDaily(){if(daily.date!==today())daily={date:today(),pieces:0,lines:0,combos:0,claimed:[]};}
  function normalizedExtras(raw) {
    const owned = Array.isArray(raw?.owned)?raw.owned.filter(id=>THEMES.some(t=>t.id===id)):[];
    const distinct=[...new Set(['classic',...owned])];
    const stats=freshStats();
    if(raw?.stats && typeof raw.stats==='object')for(const key of Object.keys(stats))stats[key]=safeNumber(raw.stats[key]);
    const claimed=Array.isArray(raw?.claimed)?[...new Set(raw.claimed.filter(id=>ACHIEVEMENTS.some(a=>a.id===id)))]:[];
    const active=distinct.includes(raw?.active)?raw.active:'classic';
    return {owned:distinct,active,stats,claimed,leveledTo:validNumber(raw?.leveledTo)?raw.leveledTo:level()};
  }
  function validExtrasRecord(raw){return raw && raw.v===1 && validNumber(raw.rev);}
  function addStat(key,value=1){extras.stats[key]=Math.min(999999999,extras.stats[key]+value);}
  function applyTheme(){document.body.dataset.theme=extras.active;}
  function grantLevelRewards(previousLevel){
    const target=level();let gained=0;
    // Apenas níveis ganhos agora recebem bônus; não há créditos retroativos.
    if(target>previousLevel){
      for(let n=Math.max(previousLevel+1,extras.leveledTo+1);n<=target&&n<10000;n++)gained+=8;
      state.coins=Math.min(999999999,state.coins+gained);
      extras.leveledTo=Math.max(extras.leveledTo,target);
      if(gained && !el('gameScreen').classList.contains('hidden'))celebrate('NÍVEL '+target+'!',2);
    }
    return gained;
  }
  function renderShop(){
    const host=el('shopList');if(!host)return;host.replaceChildren();
    for(const theme of THEMES){
      const owned=extras.owned.includes(theme.id),active=extras.active===theme.id;
      const item=document.createElement('div');item.className='shop-item'+(active?' active':'');
      const title=document.createElement('strong');title.textContent=theme.icon+' '+theme.name;
      const preview=document.createElement('div');preview.className='shop-palette';
      theme.colors.forEach(color=>{const tile=document.createElement('span');tile.style.backgroundColor=color;preview.append(tile);});
      const meta=document.createElement('div');meta.className='shop-description';
      meta.textContent=owned?'Desbloqueado':`🪙 ${theme.price} moedas · Nível ${theme.minLevel}`;
      const btn=document.createElement('button');btn.type='button';btn.className='shop-buy';
      btn.textContent=active?'EM USO':owned?'USAR':level()<theme.minLevel?'NÍVEL '+theme.minLevel:state.coins<theme.price?'FALTAM MOEDAS':'COMPRAR';
      btn.disabled=active||(!owned&&(level()<theme.minLevel||state.coins<theme.price));
      btn.addEventListener('click',()=>useTheme(theme.id));
      item.append(title,preview,meta,btn);host.append(item);
    }
    el('shopWallet').textContent=format(state.coins);
  }
  function useTheme(id){
    const theme=THEMES.find(t=>t.id===id);if(!theme)return;
    if(!extras.owned.includes(id)){
      if(level()<theme.minLevel||state.coins<theme.price)return;
      state.coins-=theme.price;extras.owned.push(id);
    }
    extras.active=id;applyTheme();save();renderShop();renderStats();beep('win');
    el('shopMessage').textContent='Estilo '+theme.name+' aplicado! Seu progresso foi preservado.';
    el('homeCoins').textContent=format(state.coins);
  }
  function renderAchievements(){
    const host=el('achievementList');host.replaceChildren();
    for(const achievement of ACHIEVEMENTS){
      const progress=Math.min(achievement.target,extras.stats[achievement.key]),claimed=extras.claimed.includes(achievement.id);
      const item=document.createElement('div');item.className='achievement-item';
      const title=document.createElement('strong');title.textContent=achievement.icon+' '+achievement.name;
      const note=document.createElement('small');note.textContent=achievement.description;
      const foot=document.createElement('div');foot.className='achievement-foot';
      const count=document.createElement('span');count.textContent=progress+'/'+achievement.target+' · 🪙 '+achievement.coins+' · ⚡ '+achievement.xp+' XP';
      const btn=document.createElement('button');btn.type='button';btn.className='achievement-claim';
      btn.textContent=claimed?'RESGATADO':progress===achievement.target?'RESGATAR':'EM ANDAMENTO';
      btn.disabled=claimed||progress!==achievement.target;
      btn.addEventListener('click',()=>claimAchievement(achievement.id));
      foot.append(count,btn);item.append(title,note,foot);host.append(item);
    }
  }
  function renderLifetime(){
    for(const key of Object.keys(extras.stats)){const node=el('stat-'+key);if(node)node.textContent=format(extras.stats[key]);}
    el('stat-level').textContent=level();el('stat-totalxp').textContent=format(state.xp);
    renderAchievements();
  }
  function claimAchievement(id){
    const a=ACHIEVEMENTS.find(item=>item.id===id);
    if(!a||extras.claimed.includes(id)||extras.stats[a.key]<a.target)return;
    extras.claimed.push(id);const previous=level();state.coins+=a.coins;state.xp+=a.xp;
    const bonus=grantLevelRewards(previous);save();renderLifetime();renderStats();renderMissions();
    el('homeCoins').textContent=format(state.coins);el('homeLevel').textContent=level();
    el('statsMessage').textContent='Conquista resgatada! +'+(a.coins+bonus)+' moedas e +'+a.xp+' XP.';
    beep('win');
  }
  function profileIsValid(obj){return obj && obj.v===1 && ['best','coins','xp'].every(k=>validNumber(obj[k])) && validNumber(obj.rev);}
  function load() {
    // A partida e as conquistas são recuperadas independentemente. Um tabuleiro
    // incompleto não pode apagar recordes, moedas ou XP já conquistados.
    const old=parsed(STORAGE);
    if(old){
      for(const k of ['best','coins','xp'])state[k]=safeNumber(old[k]);
      if(isBoardValid(old.board) && isTrayValid(old.tray)){
        state={...state,...old,board:old.board,tray:old.tray};
        for(const k of ['score','best','coins','xp','lines','combo'])state[k]=safeNumber(state[k]);
        state.hasGame=Boolean(old.hasGame);state.gameOver=Boolean(old.gameOver);state.sound=old.sound!==false;
      }
    }
    const candidates=[parsed(PROFILE_KEY),parsed(PROFILE_BACKUP)].filter(profileIsValid);
    candidates.sort((a,b)=>b.rev-a.rev);
    if(candidates.length){
      const profile=candidates[0];saveRevision=profile.rev;
      state.best=Math.max(state.best,profile.best);
      state.coins=profile.coins;state.xp=profile.xp;
      daily=normalizeDaily(profile.daily);
    }
    const extraCandidates=[parsed(EXTRAS_KEY),parsed(EXTRAS_BACKUP)].filter(validExtrasRecord).sort((a,b)=>b.rev-a.rev);
    if(extraCandidates.length){
      extrasRevision=extraCandidates[0].rev;
      extras=normalizedExtras(extraCandidates[0]);
    }else {extras=normalizedExtras(null);extras.leveledTo=level();}
    applyTheme();
    // best é pelo menos a pontuação da partida atual.
    state.best=Math.max(state.best,state.score);
    refreshDaily();
    try{const key='klg-block-storage-check';localStorage.setItem(key,'ok');storageWorking=localStorage.getItem(key)==='ok';localStorage.removeItem(key);}catch(e){storageWorking=false;}
  }
  function updateSaveStatus(){
    const node=el('saveStatus');if(!node)return;
    node.textContent=storageWorking?'✓ Progresso guardado neste aparelho':'⚠ Não foi possível salvar. Faça um código de backup.';
    node.classList.toggle('save-error',!storageWorking);
  }
  function save() {
    try {
      refreshDaily();
      // Mantém o formato legado para migrar de 1.0 e 1.1 sem perder a partida.
      localStorage.setItem(STORAGE,JSON.stringify(state));
      const profile={v:1,rev:++saveRevision,best:state.best,coins:state.coins,xp:state.xp,daily};
      localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));
      localStorage.setItem(PROFILE_BACKUP,JSON.stringify(profile));
      const newExtra={v:1,rev:++extrasRevision,...extras};
      localStorage.setItem(EXTRAS_KEY,JSON.stringify(newExtra));
      localStorage.setItem(EXTRAS_BACKUP,JSON.stringify(newExtra));
      storageWorking=true;
    } catch(e) { storageWorking=false; }
    updateSaveStatus();return storageWorking;
  }
  function missionReadyCount(){refreshDaily();return MISSIONS.filter(m=>daily[m.id]>=m.target&&!daily.claimed.includes(m.id)).length;}
  function updateMissionProgress(lines,combo){
    refreshDaily();
    const before=missionReadyCount();
    daily.pieces=Math.min(999999999,daily.pieces+1);
    daily.lines=Math.min(999999999,daily.lines+lines);
    if(combo>=2)daily.combos=Math.min(999999999,daily.combos+1);
    return missionReadyCount()>before;
  }
  function renderMissions(){
    refreshDaily();const container=el('missionList');if(!container)return;
    container.replaceChildren();
    for(const mission of MISSIONS){
      const progress=Math.min(mission.target,daily[mission.id]);const claimed=daily.claimed.includes(mission.id);
      const box=document.createElement('div');box.className='mission-item';
      const head=document.createElement('div');head.className='mission-head';
      const icon=document.createElement('span');icon.className='mission-icon';icon.textContent=mission.icon;
      const info=document.createElement('div');const title=document.createElement('strong');title.textContent=mission.name;
      const sub=document.createElement('small');sub.textContent=mission.description;info.append(title,sub);head.append(icon,info);
      const track=document.createElement('div');track.className='mission-track';const fill=document.createElement('span');fill.style.width=(100*progress/mission.target)+'%';track.append(fill);
      const footer=document.createElement('div');footer.className='mission-bottom';
      const progressLabel=document.createElement('span');progressLabel.textContent=progress+'/'+mission.target+' · 🪙 '+mission.coins+' · ⚡ '+mission.xp+' XP';
      const btn=document.createElement('button');btn.type='button';btn.className='mission-claim';btn.textContent=claimed?'RESGATADO':progress>=mission.target?'RESGATAR':'EM ANDAMENTO';btn.disabled=claimed||progress<mission.target;
      btn.addEventListener('click',()=>claimMission(mission.id));footer.append(progressLabel,btn);box.append(head,track,footer);container.append(box);
    }
    el('missionDate').textContent=daily.date.split('-').reverse().join('/');
    el('missionBtn').textContent=missionReadyCount()?'🎁 MISSÕES ('+missionReadyCount()+')':'🎯 MISSÕES DIÁRIAS';
    el('gameMissionBtn').textContent=missionReadyCount()?'🎁 RESGATAR':'🎯 MISSÕES';
  }
  function claimMission(id){
    refreshDaily();const mission=MISSIONS.find(m=>m.id===id);
    if(!mission || daily.claimed.includes(id) || daily[id]<mission.target)return;
    daily.claimed.push(id);const oldLevel=level();state.coins+=mission.coins;state.xp+=mission.xp;grantLevelRewards(oldLevel);save();
    el('homeCoins').textContent=format(state.coins);el('homeLevel').textContent=level();renderStats();renderMissions();beep('win');
    el('missionMessage').textContent='Prêmio recebido! +'+mission.coins+' moedas e +'+mission.xp+' XP.';
  }
  function backupCode(){return 'KLG-'+btoa(JSON.stringify({v:2,b:state.best,c:state.coins,x:state.xp,e:extras,a:window.KLGArcade?.exportBackup?.()||null,m:window.KLGExtras15?.exportBackup?.()||null}));}
  function showBackup(){el('backupCode').value=backupCode();el('restoreCode').value='';el('backupMessage').textContent='Guarde o código antes de reinstalar o aplicativo.';show('backupModal');}
  async function copyBackup(){
    const field=el('backupCode');field.focus();field.select();
    try {
      if(navigator.clipboard && navigator.clipboard.writeText){await navigator.clipboard.writeText(field.value);}
      else if(!document.execCommand('copy')){throw new Error('Clipboard indisponível');}
      el('backupMessage').textContent='Código copiado! Guarde em um local seguro.';
    }catch(e){el('backupMessage').textContent='Selecione e copie o código manualmente (toque e segure).';}
  }
  function restoreBackup(){
    try {
      const raw=el('restoreCode').value.trim().replace(/\s/g,'').replace(/^KLG-/i,'');
      const data=JSON.parse(atob(raw));
      if(![1,2].includes(data.v)||!validNumber(data.b)||!validNumber(data.c)||!validNumber(data.x))throw new Error('Código inválido');
      // Recuperação nunca reduz as conquistas existentes.
      state.best=Math.max(state.best,data.b);state.coins=Math.max(state.coins,data.c);state.xp=Math.max(state.xp,data.x);
      if(data.v===2&&data.e){
        const restored=normalizedExtras(data.e);
        extras.owned=[...new Set([...extras.owned,...restored.owned])];
        if(extras.owned.includes(restored.active))extras.active=restored.active;
        for(const key of Object.keys(extras.stats))extras.stats[key]=Math.max(extras.stats[key],restored.stats[key]);
        extras.claimed=[...new Set([...extras.claimed,...restored.claimed])];
        extras.leveledTo=Math.max(extras.leveledTo,restored.leveledTo);
      }
      extras.leveledTo=Math.max(extras.leveledTo,level());applyTheme();
      if(data.a && window.KLGArcade?.importBackup)window.KLGArcade.importBackup(data.a);
      if(data.m && window.KLGExtras15?.importBackup)window.KLGExtras15.importBackup(data.m);
      save();el('backupCode').value=backupCode();el('backupMessage').textContent='Conquistas recuperadas! Confira recorde, moedas e nível na tela inicial.';
      el('homeBest').textContent=format(state.best);el('homeCoins').textContent=format(state.coins);el('homeLevel').textContent=level();renderStats();renderShop();renderLifetime();
    }catch(e){el('backupMessage').textContent='Código inválido. Confira se foi copiado por inteiro.';}
  }

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
    clearDrag();clearCheer();
    state.board=blankBoard(); state.tray=[];state.score=0;state.lines=0;state.combo=0;state.gameOver=false;state.hasGame=true;
    selected=null;newSet();addStat('games');save();hide('endModal');showGame();say('Arraste uma peça para jogar.');
  }
  function show(id) {el(id).classList.remove('hidden');}
  function hide(id) {el(id).classList.add('hidden');}
  function showHome() {
    clearDrag();clearCheer();selected=null;hide('gameScreen');show('homeScreen');hide('endModal');
    el('homeBest').textContent=format(state.best); el('homeCoins').textContent=format(state.coins);el('homeLevel').textContent=level();
    el('resumeBtn').classList.toggle('hidden',!state.hasGame || state.gameOver);renderMissions();updateSaveStatus();
  }
  function showGame() {hide('homeScreen');show('gameScreen');render();}
  function level() {return Math.floor(state.xp / XP_LEVEL)+1;}
  function renderStats() {
    el('scoreValue').textContent=format(state.score);el('bestValue').textContent=format(state.best);el('coinsValue').textContent=format(state.coins);
    el('levelValue').textContent=level();el('levelFill').style.width=(((state.xp%XP_LEVEL)/XP_LEVEL)*100)+'%';
    el('xpText').textContent=(state.xp%XP_LEVEL)+'/'+XP_LEVEL+' XP';el('linesValue').textContent=format(state.lines);
    el('soundBtn').textContent=state.sound?'♫':'♪̸';el('soundBtn').setAttribute('aria-pressed',String(state.sound));
    el('comboBadge').textContent=state.combo>1?'🔥 COMBO ×'+state.combo:'FAÇA UM COMBO!';
    el('comboBadge').classList.toggle('hot',state.combo>1);if(el('gameMissionBtn'))el('gameMissionBtn').textContent=missionReadyCount()?'🎁 RESGATAR':'🎯 MISSÕES';
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
  function clearCheer(){
    clearTimeout(cheerTimer);clearTimeout(particleTimer);
    const cheer=el('mascotCheer'),wrap=document.querySelector('.board-wrap');
    if(cheer)cheer.classList.remove('show');
    if(wrap)wrap.classList.remove('party-time');
    const particles=el('partyParticles');if(particles)particles.replaceChildren();
  }
  function celebrate(message, intensity=1){
    clearCheer();
    const cheer=el('mascotCheer'),wrap=document.querySelector('.board-wrap'),particles=el('partyParticles');
    if(!cheer||!wrap||!particles)return;
    el('mascotSpeech').textContent=message;
    void cheer.offsetWidth;cheer.classList.add('show');wrap.classList.add('party-time');
    const count=Math.min(38,13+intensity*6),colors=['#ffcc55','#87ff94','#7de9ff','#ff7ab4','#bf94ff'];
    const fragment=document.createDocumentFragment();
    for(let i=0;i<count;i++){
      const p=document.createElement('span');p.className='particle';
      p.style.setProperty('--x',(28+Math.random()*54)+'%');
      p.style.setProperty('--y',(18+Math.random()*54)+'%');
      p.style.setProperty('--sz',(4+Math.random()*7)+'px');
      p.style.setProperty('--dx',((Math.random()-.5)*250)+'px');
      p.style.setProperty('--dy',((Math.random()-.6)*250)+'px');
      p.style.setProperty('--spin',((Math.random()-.5)*900)+'deg');
      p.style.setProperty('--clr',colors[i%colors.length]);fragment.append(p);
    }
    particles.append(fragment);
    cheerTimer=setTimeout(()=>{cheer.classList.remove('show');wrap.classList.remove('party-time');},1400);
    particleTimer=setTimeout(()=>particles.replaceChildren(),1150);
  }

  function beep(type='tap') {
    if(!state.sound) return;
    try {
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      soundContext=soundContext||new Audio();if(soundContext.state==='suspended') soundContext.resume();
      const now=soundContext.currentTime;const notes=type==='win'?[523,659,784]:type==='combo'?[523,659,784,1047,1318]:type==='super'?[659,784,988,1174,1568]:type==='fail'?[200,170]:[510];
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
    const scoreBefore=state.score,levelBefore=level(),bestBefore=state.best;
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
      celebrate(state.combo>=3?'COMBO INSANO!':state.combo>=2?'QUE COMBO!':lineCount>=2?'SENSACIONAL!':'MANDOU BEM!',Math.max(lineCount,state.combo));
      say('Mandou bem! '+lineCount+' linha(s) eliminada(s).');beep(lineCount>=3||state.combo>=3?'super':state.combo>=2?'combo':'win');
    } else {state.combo=0;say('Continue encaixando para completar linhas.');beep('tap');}
    const missionComplete=updateMissionProgress(lineCount,state.combo);
    addStat('pieces');addStat('lines',lineCount);addStat('points',state.score-scoreBefore);
    if(state.combo>=2)addStat('combos');
    extras.stats.bestCombo=Math.max(extras.stats.bestCombo,state.combo);
    if(state.score>state.best){state.best=state.score;}
    const levelBonus=grantLevelRewards(levelBefore);
    if(bestBefore>0&&state.best>bestBefore&&!lineCount)celebrate('NOVO RECORDE!',1);
    selected=null;
    if(state.tray.every(piece=>piece===null))newSet();
    state.gameOver=!state.tray.some(piece=>piece&&hasSpace(piece));
    save();render();
    if(missionComplete) say('🎁 Missão concluída! Resgate o prêmio em MISSÕES.');
    else if(levelBonus)say('⚡ Novo nível! +'+levelBonus+' moedas de recompensa.');
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
    el('missionBtn').addEventListener('click',()=>{el('missionMessage').textContent='';renderMissions();show('missionsModal');});
    el('gameMissionBtn').addEventListener('click',()=>{el('missionMessage').textContent='';renderMissions();show('missionsModal');});
    el('closeMissionBtn').addEventListener('click',()=>hide('missionsModal'));
    el('missionsModal').addEventListener('click',e=>{if(e.target===el('missionsModal'))hide('missionsModal');});
    const openShop=()=>{el('shopMessage').textContent='';renderShop();show('shopModal');};
    el('shopBtn').addEventListener('click',openShop);
    el('gameShopBtn').addEventListener('click',openShop);
    el('closeShopBtn').addEventListener('click',()=>hide('shopModal'));
    el('shopModal').addEventListener('click',e=>{if(e.target===el('shopModal'))hide('shopModal');});
    el('statsBtn').addEventListener('click',()=>{el('statsMessage').textContent='';renderLifetime();show('statsModal');});
    el('closeStatsBtn').addEventListener('click',()=>hide('statsModal'));
    el('statsModal').addEventListener('click',e=>{if(e.target===el('statsModal'))hide('statsModal');});
    el('backupBtn').addEventListener('click',showBackup);
    el('closeBackupBtn').addEventListener('click',()=>hide('backupModal'));
    el('backupModal').addEventListener('click',e=>{if(e.target===el('backupModal'))hide('backupModal');});
    el('restoreBtn').addEventListener('click',restoreBackup);
    el('copyBackupBtn').addEventListener('click',copyBackup);
    window.addEventListener('pagehide',save);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
    el('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;save();renderStats();if(state.sound)beep();});
    el('tray').addEventListener('pointerdown',onPieceDown);
    el('tray').addEventListener('pointermove',onPieceMove);
    el('tray').addEventListener('pointerup',onPieceUp);
    el('tray').addEventListener('pointercancel',clearDrag);
    el('board').addEventListener('click',onBoardClick);
    window.addEventListener('blur',clearDrag);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){hide('howModal');hide('missionsModal');hide('backupModal');hide('shopModal');hide('statsModal');if(!el('gameScreen').classList.contains('hidden')&&el('endModal').classList.contains('hidden'))showHome();}});
  }
  // Ponte controlada: os modos extras acessam a carteira sem tocar nas
  // chaves de salvamento do clássico ou redefinir a partida anterior.
  window.KLGBridge={
    award(coins,xp){
      if(!validNumber(coins)||!validNumber(xp)||coins>200||xp>500)return false;
      const before=level();
      state.coins=Math.min(999999999,state.coins+coins);
      state.xp=Math.min(999999999,state.xp+xp);
      grantLevelRewards(before);save();
      el('homeCoins').textContent=format(state.coins);
      el('homeLevel').textContent=level();
      return true;
    },
    toHome:showHome,
    refreshHome:showHome,
    soundEnabled:()=>state.sound
  };
  function init(){load();bindEvents();showHome();if('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'appassets.androidplatform.net')navigator.serviceWorker.register('./sw.js').catch(()=>{});}
  document.addEventListener('DOMContentLoaded',init);
})();
