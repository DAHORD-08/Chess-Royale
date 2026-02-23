const CANVAS = document.getElementById('gameCanvas');
const CTX = CANVAS.getContext('2d');
const BOARD_SIZE = 600;
const SQUARE_SIZE = BOARD_SIZE / 8;

const COLORS = {
    light: '#eccfa9', dark: '#ad764c',
    highlight: 'rgba(100, 255, 100, 0.5)',
    attack: 'rgba(255, 50, 50, 0.6)',
    check: 'rgba(255, 0, 0, 0.7)',
    zone: 'rgba(100, 200, 255, 0.3)',
    aoe_freeze: 'rgba(0, 255, 255, 0.4)',
    aoe_poison: 'rgba(0, 255, 0, 0.4)',
    ability_target: 'rgba(255, 255, 0, 0.5)',
    blue: '#4dabf7', red: '#ff6b6b'
};

const CHESS_STATS = { 'P': 2, 'N': 3, 'B': 3, 'R': 4, 'Q': 5, 'K': 999 };

// --- GESTION DES IMAGES ---
const CARD_IMAGES = {};

const ALL_AVAILABLE_CARDS = [
    { id: 1, name: "B. de Feu", cost: 3, desc: "3 Dégâts", type: "spell_dmg", value: 3, range: "any", imgName: "boule_de_feu" },
    { id: 2, name: "Gel", cost: 3, desc: "Zone 2x2 (2 Tours)", type: "spell_freeze", value: 2, range: "any", imgName: "gel" },
    { id: 3, name: "Rocket", cost: 5, desc: "5 Dégâts", type: "spell_dmg", value: 5, range: "any", imgName: "rocket" },
    { id: 4, name: "Cab. Cav.", cost: 7, desc: "Génère Cavalier", type: "troop", value: "HutK", range: "empty", imgName: "cabane_a_cavalier" },
    { id: 5, name: "Cab. Fou", cost: 7, desc: "Génère Fou", type: "troop", value: "HutB", range: "empty", imgName: "cabane_a_fou" },
    { id: 6, name: "Valkyrie", cost: 4, desc: "Attaque Zone", type: "troop", value: "Valkyrie", range: "empty", imgName: "valkyrie" },
    { id: 7, name: "Pekka", cost: 6, desc: "Lent, One-Shot", type: "troop", value: "Pekka", range: "empty", imgName: "pekka" },
    { id: 8, name: "Zap", cost: 3, desc: "1 Dégât + Stun", type: "spell_zap", value: 1, range: "any", imgName: "zap" },
    { id: 9, name: "Poison", cost: 4, desc: "Zone 2x2 (2T, 1Dgt/T)", type: "spell_poison", value: 2, range: "any", imgName: "poison" },
    { id: 10, name: "Mineur", cost: 3, desc: "Pose Partout, Dgt Spawn", type: "troop", value: "Miner", range: "any", imgName: "mineur" },
    { id: 11, name: "Archer M.", cost: 4, desc: "Tir Perçant (2 cases)", type: "troop", value: "ArcherM", range: "empty", imgName: "archer_magique" },
    { id: 12, name: "Princesse", cost: 3, desc: "Portée 2 cases", type: "troop", value: "Princess", range: "empty", imgName: "princesse" },
    { id: 13, name: "Sorcière", cost: 4, desc: "Atk Diag, Capacité Pions", type: "troop", value: "Witch", range: "empty", imgName: "sorcière" },
    { id: 14, name: "Méga Chev.", cost: 7, desc: "Atk Zone, Saut (Capacité)", type: "troop", value: "MegaK", range: "empty", imgName: "mega_chevalier" }
];

function getImgPath(imgName) {
    return `./cartes/${imgName}.png`;
}

let gameState = {
    phase: 'draft', 
    draftPlayer: 'w', 
    selectedCardsW: [],
    selectedCardsB: [],
    board: [], turn: 'w', elixir: { w: 5, b: 5 }, maxElixir: 10,
    hands: { w: [], b: [] }, decks: { w: [], b: [] },
    selectedPiece: null, validMoves: [], selectedCardIdx: null,
    gameOver: false, winner: null, endReason: "",
    checkState: { w: false, b: false },
    hoverSq: null,
    autoFlip: true,
    isTargetingAbility: false, abilitySource: null, abilityType: null
};

ALL_AVAILABLE_CARDS.forEach(c => {
    let img = new Image();
    img.src = getImgPath(c.imgName);
    img.onload = () => { if(gameState.phase === 'playing') drawBoard(); }
    CARD_IMAGES[c.imgName] = img; 
});

const CR_UNITS = {
    'Valkyrie': { hp: 4, dmg: 2, symbol: 'V', color: '#ff9f43', imgName: "valkyrie" },
    'Pekka':    { hp: 5, dmg: 99, symbol: 'P', color: '#5f27cd', imgName: "pekka" },
    'HutK':     { hp: 6, dmg: 0, symbol: '⛺♞', color: '#8e44ad', imgName: "cabane_a_cavalier" },
    'HutB':     { hp: 6, dmg: 0, symbol: '⛺♝', color: '#8e44ad', imgName: "cabane_a_fou" },
    'Miner':    { hp: 2, dmg: 1, symbol: '⛏️', color: '#7f8c8d', imgName: "mineur" },
    'ArcherM':  { hp: 4, dmg: 2, symbol: '🏹', color: '#2ecc71', imgName: "archer_magique" },
    'Princess': { hp: 2, dmg: 1, symbol: '👸', color: '#f1c40f', imgName: "princesse" },
    'Witch':    { hp: 3, dmg: 2, symbol: '🧙‍♀️', color: '#9b59b6', imgName: "sorcière" },
    'MegaK':    { hp: 6, dmg: 3, symbol: '🛡️', color: '#34495e', imgName: "mega_chevalier" } 
};

const PIECE_ICONS = {
    'P': '\uf443', 'N': '\uf441', 'B': '\uf43a', 'R': '\uf447', 'Q': '\uf445', 'K': '\uf43f'
};

document.getElementById('toggle-autoflip').addEventListener('change', (e) => {
    gameState.autoFlip = e.target.checked;
    drawBoard();
});

function getOrientedCoords(r, c) {
    if (gameState.autoFlip && gameState.turn === 'b') return { r: 7 - r, c: 7 - c };
    return { r, c };
}

// --- DRAFT LOGIC ---
function initDraft() {
    const screen = document.getElementById('draft-screen');
    const grid = document.getElementById('draft-grid');
    const status = document.getElementById('draft-status');
    const btn = document.getElementById('draft-confirm');
    
    screen.style.display = 'flex';
    document.getElementById('game-wrapper').style.display = 'none'; 
    grid.innerHTML = '';
    
    let isBlue = gameState.draftPlayer === 'w';
    status.innerText = isBlue ? "Joueur BLEU : Choisissez 6 Cartes" : "Joueur ROUGE : Choisissez 6 Cartes";
    status.className = isBlue ? "text-xl font-bold mb-4 text-blue-400" : "text-xl font-bold mb-4 text-red-400";
    
    let currentSelection = isBlue ? gameState.selectedCardsW : gameState.selectedCardsB;
    
    ALL_AVAILABLE_CARDS.forEach(card => {
        let div = document.createElement('div');
        div.className = 'db-card';
        if (currentSelection.some(c => c.id === card.id)) div.classList.add('picked');
        
        div.innerHTML = `
            <div class="db-cost">${card.cost}</div>
            <div class="font-bold text-white text-sm mb-1">${card.name}</div>
            <div class="text-gray-400 text-[10px] leading-tight">${card.desc}</div>
            <div class="db-img-container">
                <img src="${getImgPath(card.imgName)}" alt="${card.name}" onerror="this.style.display='none'">
            </div>
        `;
        
        div.onclick = () => {
            let idx = currentSelection.findIndex(c => c.id === card.id);
            if (idx >= 0) {
                currentSelection.splice(idx, 1);
                div.classList.remove('picked');
            } else if (currentSelection.length < 6) {
                currentSelection.push(card);
                div.classList.add('picked');
            }
            updateDraftButton(btn, currentSelection.length);
        };
        grid.appendChild(div);
    });
    updateDraftButton(btn, currentSelection.length);
}

function updateDraftButton(btn, count) {
    if (count === 6) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.innerText = "Confirmer Deck (6/6)";
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.innerText = `Choisir ${6 - count} cartes`;
    }
}

document.getElementById('draft-confirm').onclick = () => {
    if (gameState.draftPlayer === 'w') {
        gameState.draftPlayer = 'b';
        initDraft(); 
    } else {
        document.getElementById('draft-screen').style.display = 'none';
        document.getElementById('game-wrapper').style.display = 'flex';
        startGame();
    }
};

// --- GAME INIT ---
function startGame() {
    gameState.phase = 'playing';
    gameState.board = Array(8).fill(null).map(() => Array(8).fill(null));
    gameState.gameOver = false;
    gameState.checkState = { w: false, b: false };
    gameState.selectedPiece = null;
    gameState.selectedCardIdx = null;

    const setupRow = (row, color, types) => {
        types.forEach((type, col) => gameState.board[row][col] = createPiece(type, color, true));
    };
    setupRow(0, 'b', ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']);
    setupRow(1, 'b', Array(8).fill('P'));
    setupRow(6, 'w', Array(8).fill('P'));
    setupRow(7, 'w', ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']);

    ['w', 'b'].forEach(p => {
        let chosen = p === 'w' ? gameState.selectedCardsW : gameState.selectedCardsB;
        let deck = JSON.parse(JSON.stringify(chosen));
        deck.sort(() => Math.random() - 0.5);
        gameState.hands[p] = deck.splice(0, 4);
        gameState.decks[p] = deck;
    });

    gameState.turn = 'w';
    gameState.elixir = { w: 5, b: 5 };
    
    document.fonts.load('900 40px "Font Awesome 6 Free"').then(() => {
        updateGameState(); 
        updateUI();
        drawBoard();
    });
}

function createPiece(type, color, isChessPiece) {
    return {
        type, color, isChessPiece,
        frozenTurns: 0, stunned: 0, poisonedTurns: 0,
        maxHp: isChessPiece ? (CHESS_STATS[type] || 1) : CR_UNITS[type].hp,
        hp: isChessPiece ? (CHESS_STATS[type] || 1) : CR_UNITS[type].hp,
        attack: isChessPiece ? 999 : CR_UNITS[type].dmg,
        canMove: true, lifeTimer: type.includes("Hut") ? 3 : -1,
        hasMoved: false
    };
}

// --- LOGIQUE JEU ---
function isSquareAttacked(r, c, attackerColor) {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let p = gameState.board[i][j];
            if (p && p.color === attackerColor && p.frozenTurns === 0 && p.stunned === 0) {
                let diffR = Math.abs(i - r);
                let diffC = Math.abs(j - c);
                if (p.isChessPiece) {
                    if (p.type === 'P') {
                        let dir = p.color === 'w' ? -1 : 1;
                        if (i + dir === r && diffC === 1) return true;
                    } else if (p.type === 'N') { if (diffR * diffC === 2) return true; }
                    else if (p.type === 'K') { if (diffR <= 1 && diffC <= 1) return true; }
                    else {
                        let dr = Math.sign(r - i), dc = Math.sign(c - j);
                        if (((dr === 0 || dc === 0) && 'RQ'.includes(p.type)) || (diffR === diffC && 'BQ'.includes(p.type))) {
                            let b = false, cr = i + dr, cc = j + dc;
                            while (cr !== r || cc !== c) { if (gameState.board[cr][cc]) { b = true; break; } cr += dr; cc += dc; }
                            if (!b) return true;
                        }
                    }
                } else {
                    if (p.type === 'Miner' && diffR + diffC === 1) return true;
                    if (p.type === 'Princess' && diffR <= 2 && diffC <= 2) return true;
                    if (p.type === 'ArcherM' && diffR <= 2 && diffC <= 2 && (diffR===0 || diffC===0 || diffR===diffC)) return true;
                    if (!p.type.includes("Hut") && diffR <= 1 && diffC <= 1) return true;
                }
            }
        }
    }
    return false;
}

function getPseudoLegalMoves(r, c) {
    let p = gameState.board[r][c];
    if (!p || p.frozenTurns > 0 || p.stunned > 0) return [];
    let moves = [];
    const add = (tr, tc) => { if (tr>=0 && tr<8 && tc>=0 && tc<8) { let t = gameState.board[tr][tc]; if (!t || t.color !== p.color) moves.push({r: tr, c: tc}); } };

    if (p.isChessPiece) {
        if (p.type === 'P') {
            let d = p.color === 'w' ? -1 : 1;
            if (!gameState.board[r+d][c]) { moves.push({r: r+d, c: c}); if (r === (p.color==='w'?6:1) && !gameState.board[r+d*2][c]) moves.push({r: r+d*2, c: c}); }
            [-1, 1].forEach(dc => { let t = gameState.board[r+d]?.[c+dc]; if (t && t.color !== p.color) moves.push({r: r+d, c: c+dc}); });
        } else if (p.type === 'N') [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(m => add(r+m[0], c+m[1]));
        else if (p.type === 'K') {
            [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(m => add(r+m[0], c+m[1]));
            if (!p.hasMoved && !isInCheck(p.color)) {
                let row = p.color === 'w' ? 7 : 0;
                if (gameState.board[row][7]?.type === 'R' && !gameState.board[row][7].hasMoved && !gameState.board[row][5] && !gameState.board[row][6] && !isSquareAttacked(row, 5, p.color==='w'?'b':'w') && !isSquareAttacked(row, 6, p.color==='w'?'b':'w')) moves.push({r: row, c: 6, isCastle: true});
                if (gameState.board[row][0]?.type === 'R' && !gameState.board[row][0].hasMoved && !gameState.board[row][1] && !gameState.board[row][2] && !gameState.board[row][3] && !isSquareAttacked(row, 3, p.color==='w'?'b':'w') && !isSquareAttacked(row, 2, p.color==='w'?'b':'w')) moves.push({r: row, c: 2, isCastle: true});
            }
        } else {
            let dirs = [];
            if ('RQ'.includes(p.type)) dirs.push([0,1],[0,-1],[1,0],[-1,0]);
            if ('BQ'.includes(p.type)) dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
            dirs.forEach(d => { for (let i=1; i<8; i++) { let nr=r+d[0]*i, nc=c+d[1]*i; if (nr<0||nr>=8||nc<0||nc>=8) break; let t=gameState.board[nr][nc]; if(!t) moves.push({r:nr,c:nc}); else { if(t.color!==p.color) moves.push({r:nr,c:nc}); break; } } });
        }
    } else {
        if (p.type.includes("Hut")) [[0,1],[0,-1],[1,0],[-1,0]].forEach(m => { let tr=r+m[0], tc=c+m[1]; if (tr>=0 && tr<8 && tc>=0 && tc<8 && !gameState.board[tr][tc]) moves.push({r: tr, c: tc}); });
        else if (p.type === 'Princess') {
            [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(m => add(r+m[0], c+m[1]));
            for(let i=-2;i<=2;i++) for(let j=-2;j<=2;j++) { if(i===0&&j===0)continue; let tr=r+i, tc=c+j; if(tr>=0&&tr<8&&tc>=0&&tc<8 && gameState.board[tr][tc]?.color && gameState.board[tr][tc].color !== p.color) moves.push({r:tr,c:tc,isRanged:true}); }
        } else if (p.type === 'ArcherM') {
            [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(m => { add(r+m[0], c+m[1]); let tr2=r+m[0]*2, tc2=c+m[1]*2; if(tr2>=0&&tr2<8&&tc2>=0&&tc2<8 && gameState.board[tr2][tc2]?.color && gameState.board[tr2][tc2].color!==p.color) moves.push({r:tr2,c:tc2,isPierce:true}); });
        } else [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(m => add(r+m[0], c+m[1]));
    }
    return moves;
}

function getValidMoves(r, c) {
    let p = gameState.board[r][c];
    return getPseudoLegalMoves(r, c).filter(m => {
        let target = gameState.board[m.r][m.c];
        if (m.isRanged) return true;
        gameState.board[r][c] = null; gameState.board[m.r][m.c] = p;
        let safe = !isInCheck(p.color);
        gameState.board[r][c] = p; gameState.board[m.r][m.c] = target;
        return safe;
    });
}

function executeMove(tr, tc) {
    let sr = gameState.selectedPiece.r, sc = gameState.selectedPiece.c, attacker = gameState.board[sr][sc];
    let moveData = gameState.validMoves.find(m => m.r === tr && m.c === tc);
    
    if (moveData?.isCastle) {
        if (tc === 6) { gameState.board[sr][5] = gameState.board[sr][7]; gameState.board[sr][7] = null; gameState.board[sr][5].hasMoved = true; }
        else { gameState.board[sr][3] = gameState.board[sr][0]; gameState.board[sr][0] = null; gameState.board[sr][3].hasMoved = true; }
    }

    let target = gameState.board[tr][tc];
    if (moveData?.isRanged || moveData?.isPierce) {
        if (target) { target.hp -= attacker.attack; if (target.hp <= 0) { gameState.board[tr][tc] = null; if (target.type === 'K') { endGame(true); return; } } }
        if (moveData.isPierce) {
            let dr=Math.sign(tr-sr), dc=Math.sign(tc-sc), mr=sr+dr, mc=sc+dc, mid=gameState.board[mr][mc];
            if (mid && mid.color !== attacker.color) { mid.hp -= attacker.attack; if (mid.hp <= 0) gameState.board[mr][mc] = null; }
        }
        passTurn(); return;
    }

    if (attacker.type.includes("Hut")) { gameState.board[tr][tc] = createPiece(attacker.type === 'HutK' ? 'N' : 'B', attacker.color, true); passTurn(); return; }

    if (target) {
        if (attacker.isChessPiece || target.type === 'K') { gameState.board[tr][tc] = null; if (target.type === 'K') { endGame(true); return; } }
        else {
            target.hp -= attacker.attack;
            if (attacker.type === 'Miner') [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => { let nr=sr+d[0], nc=sc+d[1], t=gameState.board[nr]?.[nc]; if(t && t.color!==attacker.color && t.type!=='K') { t.hp-=1; if(t.hp<=0) gameState.board[nr][nc]=null; } });
            if (attacker.type === 'MegaK') for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) { let nr=tr+i, nc=tc+j, t=gameState.board[nr]?.[nc]; if(t && t.color!==attacker.color && t.type!=='K') { t.hp-=attacker.attack; if(t.hp<=0) gameState.board[nr][nc]=null; } }
            if (target.hp <= 0) gameState.board[tr][tc] = null; else { attacker.hasMoved = true; passTurn(); return; }
        }
    }
    
    gameState.board[sr][sc] = null; gameState.board[tr][tc] = attacker; attacker.hasMoved = true;
    if (attacker.type === 'Valkyrie') for(let i=-1;i<=1;i++) for(let j=-1;j<=1;j++) { let nr=tr+i, nc=tc+j, t=gameState.board[nr]?.[nc]; if(t && t.color!==attacker.color && t.type!=='K') { t.hp-=2; if(t.hp<=0) gameState.board[nr][nc]=null; } }
    passTurn();
}

// --- CAPACITES ET SORTS ---
function castCard(r, c) {
    if (gameState.gameOver) return;
    let handIdx = gameState.selectedCardIdx, card = gameState.hands[gameState.turn][handIdx], target = gameState.board[r][c];

    if (card.type === 'troop' && card.value !== 'Miner' && ((gameState.turn === 'w' && r < 4) || (gameState.turn === 'b' && r > 3))) { log("Zone ennemie !"); return; }
    if (target && target.type === 'K' && card.type.includes('spell')) { log("Roi immunisé !"); return; }
    if (target && card.type === 'troop') { log("Case occupée !"); return; }

    if (gameState.checkState[gameState.turn]) {
        if (!testCardMoveSafety(r, c, card)) { log("❌ Vous devez parer l'échec !"); return; }
    }

    if (card.type.includes('spell')) {
        if (['spell_freeze', 'spell_poison'].includes(card.type)) {
            for(let i=0; i<2; i++) for(let j=0; j<2; j++) { let t = gameState.board[r+i]?.[c+j]; if(t && t.type !== 'K') { if (card.type === 'spell_freeze') t.frozenTurns = card.value; else t.poisonedTurns = card.value; } }
        } else if (target) {
            target.hp -= card.value; if (card.type === 'spell_zap') target.stunned = 2;
            if (target.hp <= 0) gameState.board[r][c] = null;
        }
    } else {
        gameState.board[r][c] = createPiece(card.value, gameState.turn, false);
        if (card.value === 'Miner') [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => { let nr=r+d[0], nc=c+d[1], t=gameState.board[nr]?.[nc]; if(t && t.color!==gameState.turn && t.type!=='K') { t.hp-=1; if(t.hp<=0) gameState.board[nr][nc]=null; } });
    }

    gameState.elixir[gameState.turn] -= card.cost;
    let used = gameState.hands[gameState.turn].splice(handIdx, 1)[0];
    gameState.decks[gameState.turn].push(used);
    gameState.hands[gameState.turn].push(gameState.decks[gameState.turn].shift());
    passTurn();
}

function testCardMoveSafety(r, c, card) {
    let boardBak = JSON.parse(JSON.stringify(gameState.board));

    if (card.type === 'spell_dmg') {
        let t = gameState.board[r][c];
        if (t) { t.hp -= card.value; if (t.hp <= 0) gameState.board[r][c] = null; }
    } else if (card.type === 'spell_zap') {
        let t = gameState.board[r][c];
        if (t) { t.hp -= card.value; t.stunned = 2; if (t.hp <= 0) gameState.board[r][c] = null; }
    } else if (card.type === 'spell_freeze') {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
            let t = gameState.board[r+i]?.[c+j];
            if (t && t.type !== 'K') t.frozenTurns = card.value;
        }
    } else if (card.type === 'spell_poison') {
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
            let t = gameState.board[r+i]?.[c+j];
            if (t && t.type !== 'K') { t.hp -= 1; if (t.hp <= 0) gameState.board[r+i][c+j] = null; }
        }
    } else if (card.type === 'troop') {
        gameState.board[r][c] = createPiece(card.value, gameState.turn, false);
    }

    let safe = !isInCheck(gameState.turn);
    gameState.board = boardBak;
    return safe;
}

function passTurn() {
    gameState.selectedPiece = null; gameState.selectedCardIdx = null; gameState.validMoves = []; gameState.isTargetingAbility = false;
    gameState.turn = gameState.turn === 'w' ? 'b' : 'w';
    if (gameState.elixir[gameState.turn] < gameState.maxElixir) gameState.elixir[gameState.turn]++;
    updateStartOfTurn(); updateGameState(); checkEndConditions(); updateUI(); drawBoard();
}

function canAnyCardResolveCheck(color) {
    let hand = gameState.hands[color];
    for (let card of hand) {
        if (card.cost > gameState.elixir[color]) continue;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let target = gameState.board[r][c];
                if (card.type === 'spell_dmg' || card.type === 'spell_zap') {
                    if (!target || target.type === 'K') continue;
                } else if (card.type === 'spell_freeze' || card.type === 'spell_poison') {
                    if (r > 6 || c > 6) continue;
                } else if (card.type === 'troop') {
                    if (target) continue;
                    if (card.value !== 'Miner' && ((color === 'w' && r < 4) || (color === 'b' && r > 3))) continue;
                }
                if (testCardMoveSafety(r, c, card)) return true;
            }
        }
    }
    return false;
}

function checkEndConditions() {
    let color = gameState.turn, inCheck = gameState.checkState[color];
    let hasMoves = false;
    for(let r=0; r<8; r++) for(let c=0; c<8; c++) if(gameState.board[r][c]?.color === color && getValidMoves(r, c).length > 0) hasMoves = true;

    if (inCheck) {
        let cardCanSave = canAnyCardResolveCheck(color);
        if (!hasMoves && !cardCanSave) { endGame(true); return; }
        if (!hasMoves) {
            document.getElementById('status-msg').innerHTML = "<span class='check-alert'>SAUVEZ-VOUS AVEC UNE CARTE !</span>";
        }
    } else {
        let canPlayCard = gameState.hands[color].some(c => c.cost <= gameState.elixir[color]);
        if (!hasMoves && !canPlayCard) endGame(false);
    }
}

function isInCheck(color) {
    let kr, kc;
    for(let r=0; r<8; r++) for(let c=0; c<8; c++) if(gameState.board[r][c]?.type === 'K' && gameState.board[r][c].color === color) { kr=r; kc=c; break; }
    return kr !== undefined ? isSquareAttacked(kr, kc, color==='w'?'b':'w') : true;
}

function updateStartOfTurn() {
    for(let r=0; r<8; r++) for(let c=0; c<8; c++) {
        let p = gameState.board[r][c];
        if (p?.color === gameState.turn) {
            if (p.poisonedTurns > 0) { p.hp -= 1; p.poisonedTurns--; if (p.hp <= 0) gameState.board[r][c] = null; }
            if (p.frozenTurns > 0) p.frozenTurns--; if (p.stunned > 0) p.stunned--;
            if (p.type === 'Pekka') p.canMove = !p.canMove;
            if (p.type.includes("Hut")) { p.lifeTimer--; if (p.lifeTimer <= 0) gameState.board[r][c] = null; }
        }
    }
}

function updateGameState() {
    gameState.checkState.w = isInCheck('w');
    gameState.checkState.b = isInCheck('b');
}

function endGame(isMate) {
    gameState.gameOver = true;
    gameState.winner = gameState.turn === 'w' ? 'ROUGE' : 'BLEU';
    gameState.endReason = isMate ? "ECHEC ET MAT" : "PAT";
    drawBoard();
}

function updateUI() {
    let isBlue = gameState.turn === 'w', ind = document.getElementById('turn-indicator');
    ind.innerText = `Tour : ${isBlue ? 'BLEU' : 'ROUGE'}`;
    ind.className = `text-xl font-bold ${isBlue ? 'text-blue-400' : 'text-red-400'}`;
    document.getElementById('elixir-text').innerText = `${gameState.elixir[gameState.turn]}/${gameState.maxElixir}`;
    document.getElementById('elixir-fill').style.width = `${(gameState.elixir[gameState.turn]/gameState.maxElixir)*100}%`;

    let cont = document.getElementById('cards-container'); cont.innerHTML = '';
    gameState.hands[gameState.turn].forEach((c, i) => {
        let div = document.createElement('div');
        div.className = `card ${gameState.selectedCardIdx === i ? 'selected' : ''}`;
        if (gameState.elixir[gameState.turn] < c.cost) div.style.opacity = 0.5;
        div.innerHTML = `<div class="card-cost">${c.cost}</div><div class="card-info"><div class="card-name">${c.name}</div><div class="card-desc">${c.desc}</div></div><img src="${getImgPath(c.imgName)}" class="card-img-mini">`;
        div.onclick = () => { if(!gameState.gameOver && gameState.elixir[gameState.turn]>=c.cost) { gameState.selectedCardIdx = (gameState.selectedCardIdx===i?null:i); gameState.selectedPiece=null; updateUI(); drawBoard(); } };
        cont.appendChild(div);
    });
}

function drawBoard() {
    CTX.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const vis = getOrientedCoords(r, c), x = vis.c * SQUARE_SIZE, y = vis.r * SQUARE_SIZE;
            CTX.fillStyle = (r + c) % 2 === 0 ? COLORS.light : COLORS.dark;
            CTX.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE);

            if (gameState.selectedCardIdx !== null) {
                let card = gameState.hands[gameState.turn][gameState.selectedCardIdx];
                if (card.type === 'troop' && (card.value === 'Miner' || (gameState.turn === 'w' ? r >= 4 : r <= 3))) { CTX.fillStyle = COLORS.zone; CTX.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE); }
            }

            let p = gameState.board[r][c];
            if (p?.type === 'K' && gameState.checkState[p.color]) { CTX.fillStyle = COLORS.check; CTX.beginPath(); CTX.arc(x+SQUARE_SIZE/2, y+SQUARE_SIZE/2, 30, 0, Math.PI*2); CTX.fill(); }
            if (gameState.selectedPiece?.r === r && gameState.selectedPiece?.c === c) { CTX.fillStyle = COLORS.highlight; CTX.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE); }
            if (gameState.validMoves.find(m => m.r === r && m.c === c)) { CTX.fillStyle = gameState.board[r][c] ? COLORS.attack : COLORS.highlight; CTX.beginPath(); CTX.arc(x+SQUARE_SIZE/2, y+SQUARE_SIZE/2, 12, 0, Math.PI*2); CTX.fill(); }
            if (p) drawPiece(p, x, y);
        }
    }
    if (gameState.gameOver) renderGameOverOverlay();
}

function drawPiece(p, x, y) {
    let cx = x + SQUARE_SIZE/2, cy = y + SQUARE_SIZE/2;
    CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
    if (p.isChessPiece) {
        CTX.font = "900 40px 'Font Awesome 6 Free'"; CTX.fillStyle = p.color === 'w' ? COLORS.blue : COLORS.red;
        CTX.fillText(PIECE_ICONS[p.type], cx, cy);
    } else {
        let img = CARD_IMAGES[CR_UNITS[p.type].imgName];
        if (img?.complete) CTX.drawImage(img, x+4, y+4, SQUARE_SIZE-8, SQUARE_SIZE-8);
    }
    if (p.type !== 'K') {
        CTX.fillStyle = "#00b894"; CTX.fillRect(x+SQUARE_SIZE-17, y+2, 15, 15);
        CTX.fillStyle = "white"; CTX.font = "bold 10px Arial"; CTX.fillText(p.hp, x+SQUARE_SIZE-9, y+10);
    }
}

function renderGameOverOverlay() {
    CTX.fillStyle = "rgba(0,0,0,0.7)"; CTX.fillRect(0, 0, 600, 600);
    CTX.fillStyle = "white"; CTX.font = "bold 40px Arial"; CTX.fillText("GAME OVER", 300, 250);
    CTX.font = "bold 30px Arial"; CTX.fillText(`VICTOIRE : ${gameState.winner}`, 300, 310);
    CTX.font = "20px Arial"; CTX.fillText(gameState.endReason, 300, 350);
    CTX.fillText("Cliquez pour rejouer", 300, 420);
}

function fixCoords(e) {
    let rect = CANVAS.getBoundingClientRect(), x = (e.clientX - rect.left) * (600 / rect.width), y = (e.clientY - rect.top) * (600 / rect.height);
    let vc = Math.floor(x / SQUARE_SIZE), vr = Math.floor(y / SQUARE_SIZE);
    if (gameState.autoFlip && gameState.turn === 'b') return { r: 7 - vr, c: 7 - vc };
    return { r: vr, c: vc };
}

function log(m) {
    let d = document.createElement('div'); d.className = 'log-entry'; d.innerText = m;
    let b = document.getElementById('log-box'); b.appendChild(d); b.scrollTop = b.scrollHeight;
}

CANVAS.addEventListener('click', e => {
    if (gameState.gameOver) { gameState.phase = 'draft'; gameState.selectedCardsW = []; gameState.selectedCardsB = []; gameState.draftPlayer = 'w'; initDraft(); return; }
    let pos = fixCoords(e), r = pos.r, c = pos.c;
    if (gameState.selectedCardIdx !== null) { castCard(r, c); return; }
    let move = gameState.validMoves.find(m => m.r===r && m.c===c);
    if (move) { executeMove(r, c); return; }
    let p = gameState.board[r][c];
    if (p?.color === gameState.turn) { gameState.selectedPiece = {r, c}; gameState.validMoves = getValidMoves(r, c); drawBoard(); updateUI(); }
    else { gameState.selectedPiece = null; gameState.validMoves = []; drawBoard(); updateUI(); }
});

initDraft();