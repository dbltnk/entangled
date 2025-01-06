import BOARD_LAYOUTS from './boards.js';
import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer, AI_PLAYERS } from './players.js';
import { GameController } from './game-controller.js';

// Settings management
const SETTINGS_KEY = 'entangled_settings';
let gameSettings = {
    hover: true,
    groups: true,
    size: true,
    score: true,
    currentPlayer: true,
    icons: true,
    symbols: false
};

let game = null;
let currentRandomBoards = {
    board1: null,
    board2: null
};

// Icon mappings for all possible symbols
const ICON_MAPPINGS = {
    'A': 'fa-atom',
    'B': 'fa-droplet',
    'C': 'fa-flask-vial',
    'D': 'fa-dna',
    'E': 'fa-microscope',
    'F': 'fa-flask',
    'G': 'fa-database',
    'H': 'fa-brain',
    'I': 'fa-infinity',
    'J': 'fa-magnet',
    'K': 'fa-virus',
    'L': 'fa-laptop-code',
    'M': 'fa-mortar-pestle',
    'N': 'fa-network-wired',
    'O': 'fa-satellite',
    'P': 'fa-pills',
    'Q': 'fa-radiation',
    'R': 'fa-robot',
    'S': 'fa-square-root-variable',
    'T': 'fa-temperature-high',
    'U': 'fa-user-astronaut',
    'V': 'fa-vial',
    'W': 'fa-wave-square',
    'X': 'fa-circle-nodes',
    'Y': 'fa-bolt',
    'Z': 'fa-filter',
    '0': 'fa-meteor',
    '1': 'fa-rocket',
    '2': 'fa-satellite-dish',
    '3': 'fa-server',
    '4': 'fa-shield-virus',
    '5': 'fa-star-of-life',
    '6': 'fa-thermometer',
    '7': 'fa-satellite-dish',
    '8': 'fa-tornado',
    '9': 'fa-wind',
    '@': 'fa-microchip',
    '#': 'fa-cube',
    '$': 'fa-tachograph-digital',
    '%': 'fa-disease',
    '&': 'fa-virus-covid',
    '*': 'fa-burst',
    '+': 'fa-compress',
    '-': 'fa-staff-snake',
    '=': 'fa-code-branch',
    '/': 'fa-tower-broadcast',
    '?': 'fa-biohazard',
    '!': 'fa-explosion',
    '~': 'fa-hurricane'
};

function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
        gameSettings = { ...gameSettings, ...JSON.parse(saved) };
    }

    // Initialize checkboxes
    Object.entries(gameSettings).forEach(([key, value]) => {
        const checkbox = document.getElementById(`setting-${key}`);
        if (checkbox) checkbox.checked = value;
    });

    applySettings();
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(gameSettings));
}

function applySettings() {
    // Apply hover setting
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.removeEventListener('mouseenter', () => highlightCorrespondingCells(cell.dataset.symbol));
        cell.removeEventListener('mouseleave', removeHighlights);

        if (gameSettings.hover) {
            cell.addEventListener('mouseenter', () => highlightCorrespondingCells(cell.dataset.symbol));
            cell.addEventListener('mouseleave', removeHighlights);
        }
    });

    // Apply icon and symbol settings
    cells.forEach(cell => {
        cell.classList.toggle('symbols-hidden', !gameSettings.symbols);
        cell.classList.toggle('icons-hidden', !gameSettings.icons);

        // When symbols are hidden but icons are enabled, use darker icons
        if (!gameSettings.symbols && gameSettings.icons) {
            const icon = cell.querySelector('.cell-icon');
            if (icon) icon.style.opacity = '0.8';
        }
    });

    // Apply groups setting
    cells.forEach(cell => {
        if (!gameSettings.groups) {
            cell.classList.add('groups-hidden');
        } else {
            cell.classList.remove('groups-hidden');
        }
    });

    // Apply size setting
    const sizes = document.querySelectorAll('.group-size');
    sizes.forEach(size => {
        if (!gameSettings.size) {
            size.classList.add('size-hidden');
        } else {
            size.classList.remove('size-hidden');
        }
    });

    // Apply score setting
    const scoreRow = document.querySelector('.stats-row:first-child');
    if (scoreRow) {
        if (!gameSettings.score) {
            scoreRow.classList.add('score-hidden');
        } else {
            scoreRow.classList.remove('score-hidden');
        }
    }

    // Apply current player setting
    const currentPlayerDisplay = document.getElementById('current-player-display');
    if (currentPlayerDisplay) {
        currentPlayerDisplay.style.display = gameSettings.currentPlayer ? '' : 'none';
    }
}

function populatePlayerDropdowns() {
    const blackSelect = document.getElementById('black-player');
    const whiteSelect = document.getElementById('white-player');

    blackSelect.innerHTML = '';
    whiteSelect.innerHTML = '';

    const humanOption = new Option('👤 Human', 'human');
    blackSelect.add(humanOption.cloneNode(true));
    whiteSelect.add(humanOption.cloneNode(true));

    Object.values(AI_PLAYERS).forEach(player => {
        const option = new Option(`🤖 ${player.name}`, player.id);
        option.title = player.description;
        blackSelect.add(option.cloneNode(true));
        whiteSelect.add(option.cloneNode(true));
    });

    whiteSelect.value = 'defensive-some-rng';
}

function getBoardSize(boardId) {
    const layout = BOARD_LAYOUTS[boardId];
    return layout ? layout.grid.length : 5;
}

function populateBoardsBySize(size) {
    const board1Select = document.getElementById('board1-select');
    const board2Select = document.getElementById('board2-select');
    const startingConfigInput = document.getElementById('starting-config');

    board1Select.innerHTML = '';
    board2Select.innerHTML = '';

    Object.entries(BOARD_LAYOUTS).forEach(([id, layout]) => {
        if (layout.grid.length === size) {
            const option = new Option(layout.name, id);
            board1Select.add(option.cloneNode(true));
            board2Select.add(option.cloneNode(true));
        }
    });

    const defaultBoards = {
        4: ['board4x4', 'random4x4'],
        5: ['board1', 'board7'],
        6: ['board6x6', 'random6x6'],
        7: ['board7x7', 'centeredRandom7x7']
    };

    const defaultConfigs = {
        4: '',
        5: 'WD1,WD2',
        6: '',
        7: ''
    };

    board1Select.value = defaultBoards[size][0];
    board2Select.value = defaultBoards[size][1];
    startingConfigInput.value = defaultConfigs[size];
}

function getSelectedBoardLayout(boardSelect) {
    const selectedValue = boardSelect.value;
    const currentSize = parseInt(document.getElementById('board-size').value);

    if (selectedValue.startsWith('random')) {
        if (!currentRandomBoards[boardSelect.id]) {
            currentRandomBoards[boardSelect.id] = BOARD_LAYOUTS[`random${currentSize}x${currentSize}`].grid;
        }
        return currentRandomBoards[boardSelect.id];
    }
    return BOARD_LAYOUTS[selectedValue].grid;
}

const uniqueColors = {};

function generateColorForLetter(letter) {
    const currentSize = parseInt(document.getElementById('board-size').value);
    let totalSymbols;

    // Determine how many symbols we need for this board size
    switch (currentSize) {
        case 4: totalSymbols = 16; break;  // A-P
        case 5: totalSymbols = 25; break;  // A-Y
        case 6: totalSymbols = 36; break;  // A-Z + 0-9
        case 7: totalSymbols = 49; break;  // A-Z + 0-9 + special chars
        default: totalSymbols = 25;
    }

    // Get position of letter in sequence for current board size
    const sequence = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=/?!~";
    const index = sequence.indexOf(letter);

    // Always use full 360 degrees but space based on needed symbols
    const hue = (index / totalSymbols) * 360;
    const saturation = 70;
    const lightness = 50;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getBackgroundColor(letter) {
    const color = generateColorForLetter(letter);
    return {
        background: color.replace('50%', '95%'),
        icon: color.replace('50%', '35%')
    };
}

function createCell(symbol, boardNum, row, col) {
    if (symbol === '.') return null;

    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.symbol = symbol;
    cell.dataset.board = boardNum;
    cell.dataset.row = row;
    cell.dataset.col = col;
    cell.style.gridColumn = (col + 1).toString();
    cell.style.gridRow = (row + 1).toString();

    const colors = getBackgroundColor(symbol);
    cell.style.backgroundColor = colors.background;

    // Add icon
    const icon = document.createElement('i');
    icon.className = `cell-icon fa-solid ${ICON_MAPPINGS[symbol] || 'fa-circle'}`;
    icon.style.color = colors.icon;
    cell.appendChild(icon);

    // Add letter
    const letter = document.createElement('div');
    letter.className = 'cell-letter';
    letter.textContent = symbol;
    cell.appendChild(letter);

    if (gameSettings.hover) {
        cell.addEventListener('mouseenter', () => highlightCorrespondingCells(symbol));
        cell.addEventListener('mouseleave', removeHighlights);
    }

    cell.addEventListener('click', () => handleCellClick(symbol));

    // Apply current settings
    if (!gameSettings.symbols) cell.classList.add('symbols-hidden');
    if (!gameSettings.icons) cell.classList.add('icons-hidden');
    if (!gameSettings.groups) cell.classList.add('groups-hidden');

    return cell;
}

function createGroupSizeElement(size, isBlackStone) {
    const sizeElement = document.createElement('div');
    sizeElement.className = `group-size ${isBlackStone ? 'on-black' : ''}`;
    if (!gameSettings.size) {
        sizeElement.classList.add('size-hidden');
    }
    sizeElement.textContent = size;
    return sizeElement;
}

function calculateClusterPosition(cluster, boardElement) {
    const centralStone = game.findMostConnectedCell(cluster);
    if (!centralStone) return null;

    const cell = boardElement.querySelector(
        `.cell[data-row="${centralStone.row}"][data-col="${centralStone.col}"]`
    );

    if (!cell) return null;

    const rect = cell.getBoundingClientRect();
    const boardRect = boardElement.getBoundingClientRect();

    return {
        left: rect.left - boardRect.left + (rect.width / 2),
        top: rect.top - boardRect.top + (rect.height / 2)
    };
}

function updateCellHighlights(boardNum, row, col, largestClusters) {
    const cell = document.querySelector(
        `.cell[data-board="${boardNum}"][data-row="${row}"][data-col="${col}"]`
    );

    if (!cell) return;

    cell.classList.remove('cell-highlight-black', 'cell-highlight-white');

    if (!gameSettings.groups) {
        cell.classList.add('groups-hidden');
        return;
    }

    const isInBlackCluster = largestClusters.black[`board${boardNum}`]
        .some(pos => pos.row === row && pos.col === col);
    if (isInBlackCluster) {
        cell.classList.add('cell-highlight-black');
    }

    const isInWhiteCluster = largestClusters.white[`board${boardNum}`]
        .some(pos => pos.row === row && pos.col === col);
    if (isInWhiteCluster) {
        cell.classList.add('cell-highlight-white');
    }
}

function updateGroupSizes(boardElement, clusters, isBoard1) {
    const existingSizes = boardElement.querySelectorAll('.group-size');
    existingSizes.forEach(el => el.remove());

    if (!gameSettings.size) return;

    const blackCluster = clusters.black[isBoard1 ? 'board1' : 'board2'];
    const whiteCluster = clusters.white[isBoard1 ? 'board1' : 'board2'];

    if (blackCluster.length >= 2) {
        const pos = calculateClusterPosition(blackCluster, boardElement);
        if (pos) {
            const sizeElement = createGroupSizeElement(blackCluster.length, true);
            sizeElement.style.left = `${pos.left}px`;
            sizeElement.style.top = `${pos.top}px`;
            boardElement.appendChild(sizeElement);
        }
    }

    if (whiteCluster.length >= 2) {
        const pos = calculateClusterPosition(whiteCluster, boardElement);
        if (pos) {
            const sizeElement = createGroupSizeElement(whiteCluster.length, false);
            sizeElement.style.left = `${pos.left}px`;
            sizeElement.style.top = `${pos.top}px`;
            boardElement.appendChild(sizeElement);
        }
    }
}

function stopGame() {
    game = null;
    const existingWinner = document.querySelector('.winner');
    if (existingWinner) {
        existingWinner.remove();
    }
    document.getElementById('score-display').textContent = 'Black: 0 - White: 0';
    document.getElementById('current-player-display').textContent = '';
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const stone = cell.querySelector('.stone');
        if (stone) {
            cell.removeChild(stone);
        }
        cell.classList.remove('has-stone', 'cell-highlight-black', 'cell-highlight-white', 'groups-hidden');
    });
    const groupSizes = document.querySelectorAll('.group-size');
    groupSizes.forEach(el => el.remove());
}

function initializeBoards() {
    const board1Element = document.getElementById('board1');
    const board2Element = document.getElementById('board2');
    const board1Select = document.getElementById('board1-select');
    const board2Select = document.getElementById('board2-select');

    const board1Layout = getSelectedBoardLayout(board1Select);
    const board2Layout = getSelectedBoardLayout(board2Select);
    const currentSize = board1Layout.length;

    board1Element.innerHTML = '';
    board2Element.innerHTML = '';

    board1Element.className = `board board-${currentSize}`;
    board2Element.className = `board board-${currentSize}`;

    board1Element.style.gridTemplateRows = `repeat(${currentSize}, 1fr)`;
    board1Element.style.gridTemplateColumns = `repeat(${currentSize}, 1fr)`;
    board2Element.style.gridTemplateRows = `repeat(${currentSize}, 1fr)`;
    board2Element.style.gridTemplateColumns = `repeat(${currentSize}, 1fr)`;

    for (let i = 0; i < currentSize; i++) {
        for (let j = 0; j < currentSize; j++) {
            const cell1 = createCell(board1Layout[i][j], 1, i, j);
            const cell2 = createCell(board2Layout[i][j], 2, i, j);

            if (cell1) board1Element.appendChild(cell1);
            if (cell2) board2Element.appendChild(cell2);
        }
    }
}

function isHumanTurn() {
    if (!game || game.isGameOver()) return false;
    const currentPlayer = game.getCurrentPlayer().toLowerCase();
    const playerType = document.getElementById(`${currentPlayer}-player`)?.value;
    return playerType === 'human';
}

function highlightCorrespondingCells(symbol) {
    if (!gameSettings.hover || symbol === '.') return;
    const cells = document.querySelectorAll(`.cell[data-symbol="${symbol}"]`);
    const showHoverStones = isHumanTurn();

    cells.forEach(cell => {
        cell.classList.add('highlighted');
        if (showHoverStones && !cell.classList.contains('has-stone')) {
            if (game.getCurrentPlayer() === PLAYERS.BLACK) {
                cell.classList.add('black-turn');
            } else {
                cell.classList.add('white-turn');
            }
        }
    });
}

function removeHighlights() {
    if (!gameSettings.hover) return;
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.classList.remove('highlighted');
        cell.classList.remove('black-turn', 'white-turn');
    });
}

function updateCell(boardNum, row, col, player) {
    const cell = document.querySelector(
        `.cell[data-board="${boardNum}"][data-row="${row}"][data-col="${col}"]`
    );

    if (!cell) return;

    const existingStone = cell.querySelector('.stone');
    if (existingStone) {
        cell.removeChild(existingStone);
    }

    if (player) {
        const stone = document.createElement('div');
        stone.className = `stone ${player.toLowerCase()}`;
        cell.appendChild(stone);
        cell.classList.add('has-stone');
    } else {
        cell.classList.remove('has-stone');
    }
}

function updateDisplay() {
    if (!game) return;

    const state = game.getGameState();
    const board1Element = document.getElementById('board1');
    const board2Element = document.getElementById('board2');

    updateGroupSizes(board1Element, state.largestClusters, true);
    updateGroupSizes(board2Element, state.largestClusters, false);

    const blackScore = game.getScore(PLAYERS.BLACK);
    const blackBoard1Score = game.findLargestCluster(game.getBoard1(), PLAYERS.BLACK);
    const blackBoard2Score = game.findLargestCluster(game.getBoard2(), PLAYERS.BLACK);

    const whiteScore = game.getScore(PLAYERS.WHITE);
    const whiteBoard1Score = game.findLargestCluster(game.getBoard1(), PLAYERS.WHITE);
    const whiteBoard2Score = game.findLargestCluster(game.getBoard2(), PLAYERS.WHITE);

    const scoreDisplay = document.getElementById('score-display');
    scoreDisplay.innerHTML = `<strong>⚫ ${blackScore}</strong> (${blackBoard1Score} + ${blackBoard2Score}) vs <strong>⚪ ${whiteScore}</strong> (${whiteBoard1Score} + ${whiteBoard2Score})`;
    if (!gameSettings.score) {
        scoreDisplay.parentElement.classList.add('score-hidden');
    } else {
        scoreDisplay.parentElement.classList.remove('score-hidden');
    }

    const currentPlayerDisplay = document.getElementById('current-player-display');
    if (!gameSettings.currentPlayer) {
        currentPlayerDisplay.style.display = 'none';
    } else {
        currentPlayerDisplay.style.display = '';
        currentPlayerDisplay.textContent =
            `Current player: ${state.currentPlayer === PLAYERS.BLACK ? '⚫ Black' : '⚪ White'}`;
    }

    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.classList.remove('black-turn', 'white-turn');
        if (!cell.classList.contains('has-stone') && isHumanTurn()) {
            if (state.currentPlayer === PLAYERS.BLACK) {
                cell.classList.add('black-turn');
            } else {
                cell.classList.add('white-turn');
            }
        }
    });

    for (let i = 0; i < game.boardSize; i++) {
        for (let j = 0; j < game.boardSize; j++) {
            updateCell(1, i, j, state.board1[i][j]);
            updateCell(2, i, j, state.board2[i][j]);
            updateCellHighlights(1, i, j, state.largestClusters);
            updateCellHighlights(2, i, j, state.largestClusters);
        }
    }
}

function showWinner(winner) {
    const existingWinner = document.querySelector('.winner');
    if (existingWinner) {
        existingWinner.remove();
    }

    const winnerDisplay = document.createElement('div');
    winnerDisplay.className = 'winner';

    if (winner === 'TIE') {
        winnerDisplay.textContent = 'Game Over - Tie!';
    } else {
        const blackScore = game.getScore(PLAYERS.BLACK);
        const whiteScore = game.getScore(PLAYERS.WHITE);
        winnerDisplay.textContent = `${winner} wins! (${blackScore} - ${whiteScore})`;
    }

    document.querySelector('.stats').appendChild(winnerDisplay);
}

function handleCellClick(symbol) {
    if (!game || game.isGameOver() || symbol === '.') return;

    const currentPlayer = game.getCurrentPlayer();
    const playerType = document.getElementById(`${currentPlayer.toLowerCase()}-player`).value;

    if (playerType !== 'human') return;

    if (game.isValidMove(symbol)) {
        game.makeMove(symbol);
        updateDisplay();

        if (game.isGameOver()) {
            showWinner(game.getWinner());
        } else {
            makeAIMove();
        }
    }
}

function makeAIMove() {
    if (!game) return;

    const currentPlayer = game.getCurrentPlayer();
    const playerType = document.getElementById(`${currentPlayer.toLowerCase()}-player`).value;

    if (playerType !== 'human') {
        setTimeout(() => {
            if (!game) return;

            const ai = createPlayer(playerType, game, currentPlayer);
            if (ai) {
                const move = ai.chooseMove();
                if (move && game) {
                    game.makeMove(move);
                    updateDisplay();

                    if (game && game.isGameOver()) {
                        showWinner(game.getWinner());
                    } else if (game) {
                        makeAIMove();
                    }
                }
            }
        }, 500);
    }
}

function initializeGame() {
    const board1Select = document.getElementById('board1-select');
    const board2Select = document.getElementById('board2-select');
    const rawConfig = document.getElementById('starting-config').value;

    const startingConfig = rawConfig
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[,.;\s]+$/, '');

    currentRandomBoards = {
        board1: null,
        board2: null
    };

    const board1Layout = getSelectedBoardLayout(board1Select);
    const board2Layout = getSelectedBoardLayout(board2Select);

    game = new EntangledGame(board1Layout, board2Layout, startingConfig);

    const existingWinner = document.querySelector('.winner');
    if (existingWinner) {
        existingWinner.remove();
    }

    initializeBoards();
    updateDisplay();
    makeAIMove();
}

function init() {
    loadSettings();

    document.getElementById('toggle-settings').addEventListener('click', () => {
        const content = document.querySelector('.settings-content');
        const icon = document.querySelector('.toggle-icon');
        content.classList.toggle('hidden');
        icon.classList.toggle('rotated');
    });

    ['hover', 'groups', 'size', 'score', 'currentPlayer', 'icons', 'symbols'].forEach(setting => {
        const checkbox = document.getElementById(`setting-${setting}`);
        checkbox.addEventListener('change', (e) => {
            gameSettings[setting] = e.target.checked;
            saveSettings();
            applySettings();
            if (game) {
                updateDisplay();
            }
        });
    });

    populatePlayerDropdowns();

    const boardSizeSelect = document.getElementById('board-size');
    boardSizeSelect.addEventListener('change', (e) => {
        stopGame();
        const size = parseInt(e.target.value);
        populateBoardsBySize(size);
        currentRandomBoards = { board1: null, board2: null };
        initializeBoards();
    });

    populateBoardsBySize(5);

    document.getElementById('start-game').addEventListener('click', () => {
        stopGame();
        initializeGame();
    });

    const settingsElements = [
        'board1-select',
        'board2-select',
        'black-player',
        'white-player',
        'starting-config'
    ];

    settingsElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        element.addEventListener('change', () => {
            stopGame();
            if (elementId.startsWith('board') && element.value.startsWith('random')) {
                currentRandomBoards[elementId] = null;
            }
            initializeBoards();
        });
    });

    initializeBoards();
    document.getElementById('start-game').click();
}

window.addEventListener('load', init);