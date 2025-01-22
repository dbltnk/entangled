import BOARD_LAYOUTS, { getSymbolsForSize } from './boards.js';
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
    symbols: false,
};

let game = null;
let currentRandomBoards = {
    board1: null,
    board2: null
};
let customBoards = new Map();

// Icon mappings for all possible symbols
const ICON_MAPPINGS = {
    'A': 'fa-atom',
    'B': 'fa-droplet',
    'C': 'fa-flask-vial',
    'D': 'fa-dna',
    'E': 'fa-microscope',
    'F': 'fa-biohazard',
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
    '7': 'fa-chart-pie',
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
    '?': 'fa-flask',
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

    // Store current selections if any
    const currentBoard1 = board1Select.value;
    const currentBoard2 = board2Select.value;

    board1Select.innerHTML = '';
    board2Select.innerHTML = '';

    Object.entries(BOARD_LAYOUTS).forEach(([id, layout]) => {
        if (getBoardSize(id) === size) {
            const option = new Option(layout.name, id);
            board1Select.add(option.cloneNode(true));
            board2Select.add(option.cloneNode(true));
        }
    });

    // Add custom boards for this size
    customBoards.forEach((board, id) => {
        if (getBoardSize(id) === size) {
            const option = new Option(`Custom: ${board.name}`, id);
            board1Select.add(option.cloneNode(true));
            board2Select.add(option.cloneNode(true));
        }
    });

    const defaultBoards = {
        4: ['board4x4', 'random4x4'],
        5: ['board1', 'board7'],
        6: ['minidonutleft', 'board3072731079only'],
        7: ['donutleft', 'board220120251955']
    };

    const defaultConfigs = {
        4: '',
        5: '',
        6: '',
        7: ''
    };

    // Try to restore previous selections if they're valid for this size
    const options = Array.from(board1Select.options).map(opt => opt.value);
    if (options.includes(currentBoard1)) {
        board1Select.value = currentBoard1;
    } else {
        board1Select.value = defaultBoards[size][0];
    }

    if (options.includes(currentBoard2)) {
        board2Select.value = currentBoard2;
    } else {
        board2Select.value = defaultBoards[size][1];
    }

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

    // Check custom boards first
    if (customBoards.has(selectedValue)) {
        console.log('Using custom board:', selectedValue);
        console.log('Board data:', customBoards.get(selectedValue));
        return customBoards.get(selectedValue).grid;
    }

    return BOARD_LAYOUTS[selectedValue].grid;
}

const uniqueColors = new Map();
let currentDistances = null;

function calculateManhattanDistances(board, size) {
    // If we already calculated distances for this board set, reuse them
    if (currentDistances) {
        return currentDistances;
    }

    // Step 1: Group symbols by their manhattan distance
    const distanceGroups = new Map();  // distance -> symbols[]
    let maxDistance = 0;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] !== '.') {
                const distance = r + c;
                maxDistance = Math.max(maxDistance, distance);
                if (!distanceGroups.has(distance)) {
                    distanceGroups.set(distance, []);
                }
                distanceGroups.get(distance).push(board[r][c]);
            }
        }
    }

    // Step 2: Create normalized distances, keeping same-distance symbols together
    const distances = new Map();
    const uniqueDistances = Array.from(distanceGroups.keys()).sort((a, b) => a - b);
    const totalGroups = uniqueDistances.length;

    uniqueDistances.forEach((distance, groupIndex) => {
        const ratio = groupIndex / (totalGroups - 1);
        const symbols = distanceGroups.get(distance);
        symbols.forEach(symbol => {
            distances.set(symbol, ratio);
        });
    });

    currentDistances = { distances, maxDistance: 1 };
    return currentDistances;
}

function generateColorForLetter(letter, boardNum, row, col) {
    if (letter === '.') return null;

    // If we already computed this letter's color, reuse it
    if (uniqueColors.has(letter)) {
        return uniqueColors.get(letter);
    }

    // For board 2, force computation using board 1's position
    if (boardNum === 2) {
        return generateColorForLetter(letter, 1, row, col);
    }

    // Only compute colors for board 1
    const currentSize = parseInt(document.getElementById('board-size').value);
    const board = getSelectedBoardLayout(document.getElementById('board1-select'));

    // First, collect all actual tiles and their positions
    const tiles = [];
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            if (board[r][c] !== '.') {
                tiles.push({
                    symbol: board[r][c],
                    row: r,
                    col: c
                });
            }
        }
    }

    // Find the position of our current letter
    const currentTile = tiles.find(t => t.symbol === letter);
    if (!currentTile) {
        const color = 'hsl(240, 85%, 60%)';
        uniqueColors.set(letter, color);
        return color;
    }

    // Calculate angle from center for each tile
    const centerRow = (currentSize - 1) / 2;
    const centerCol = (currentSize - 1) / 2;

    tiles.forEach(tile => {
        const deltaY = tile.row - centerRow;
        const deltaX = tile.col - centerCol;
        // Start from top (negative Y-axis) and go clockwise
        tile.angle = ((-Math.atan2(deltaY, deltaX) + Math.PI / 2) * (180 / Math.PI) + 360) % 360;

        // Calculate distance from center (normalized)
        tile.dist = Math.sqrt(Math.pow(deltaY, 2) + Math.pow(deltaX, 2)) /
            Math.sqrt(Math.pow(centerRow, 2) + Math.pow(centerCol, 2));
    });

    // Sort tiles by angle to distribute colors evenly around the spectrum
    tiles.sort((a, b) => a.angle - b.angle);

    // Find our tile's index in the sorted array
    const index = tiles.findIndex(t => t.symbol === letter);

    // Map index to hue (0-360), distribute evenly across the spectrum
    const hue = ((index / tiles.length) * 360 + 0) % 360;  // Add offset here (e.g., 120 degrees)

    // Use the distance from center to adjust saturation and lightness
    const currentDist = tiles[index].dist;
    const saturation = 85 + (currentDist * 15); // 85-100%
    const lightness = 60 - (currentDist * 10);  // 50-60%

    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    uniqueColors.set(letter, color);
    return color;
}

function getBackgroundColor(letter, boardNum, row, col) {
    const color = generateColorForLetter(letter, boardNum, row, col);
    if (!color) return { background: 'transparent', icon: 'transparent' };

    // Extract the hue from the HSL color
    const hue = color.match(/hsl\((\d+)/)[1];

    return {
        background: `hsl(${hue}, 100%, 93%)`,  // Light, slightly desaturated background
        icon: `hsl(${hue}, 100%, 35%)`        // Dark, fully saturated icon
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

    const colors = getBackgroundColor(symbol, boardNum, row, col);
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
    currentDistances = null;
    uniqueColors.clear();
    const board1Element = document.getElementById('board1');
    const board2Element = document.getElementById('board2');
    const board1Select = document.getElementById('board1-select');
    const board2Select = document.getElementById('board2-select');

    // Get layouts once and reuse
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

    // Create all cells in one pass
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
        if (player === PLAYERS.SUPERPOSITION) {
            stone.className = 'stone superposition';
            // Find the superposition number for this cell
            const symbol = cell.dataset.symbol;
            const spState = game.getSuperpositionState();
            const spStone = spState.stones.find(s => s.symbol === symbol);
            if (spStone) {
                stone.dataset.number = spStone.number;
            }
        } else {
            stone.className = `stone ${player.toLowerCase()}`;
        }
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

function showWinner(winnerData) {
    const existingWinner = document.querySelector('.winner');
    if (existingWinner) {
        existingWinner.remove();
    }

    const winnerDisplay = document.createElement('div');
    winnerDisplay.className = 'winner';

    const endStats = game.getEndGameStats();
    const scores = endStats.scores;

    // Create header content
    let content = `
        <div style="margin-bottom: 1rem;">
            Game Over! Base scores:<br>⚫ ${scores.black} vs ⚪ ${scores.white}
        </div>
    `;

    if (scores.black === scores.white) {
        content += `
            <div style="margin-bottom: 1rem;">
                Scores tied - checking groups...
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; font-size: 0.9rem; border-collapse: collapse; margin-bottom: 1rem;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 2px;">Lvl</th>
                            <th style="text-align: center; padding: 2px;">⚫</th>
                            <th style="text-align: center; padding: 2px;">=</th>
                            <th style="text-align: center; padding: 2px;">⚪</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        winnerData.comparisonData.forEach((level, index) => {
            const isDeciding = (index + 1) === winnerData.decidingLevel;
            const rowStyle = isDeciding ? 'background-color: rgba(0,0,0,0.1);' : '';
            const decider = isDeciding ? ' ←' : '';

            content += `
                <tr style="${rowStyle}">
                    <td style="padding: 2px;">${level.level}</td>
                    <td style="text-align: right; padding: 2px;">${level.black.board1}+${level.black.board2}</td>
                    <td style="text-align: left; padding: 2px;">=${level.black.sum}</td>
                    <td style="text-align: right; padding: 2px;">${level.white.board1}+${level.white.board2}</td>
                    <td style="text-align: left; padding: 2px;">=${level.white.sum}${decider}</td>
                </tr>
            `;
        });

        content += `
                </tbody>
            </table>
        </div>
        `;

        if (winnerData.winner !== 'TIE') {
            const symbol = winnerData.winner === PLAYERS.BLACK ? '⚫' : '⚪';
            content += `<div style="font-weight: bold;">${symbol} wins at level ${winnerData.decidingLevel}!</div>`;
        } else {
            content += '<div>Complete tie!</div>';
        }
    } else {
        // Regular win without tiebreaker
        const winner = scores.black > scores.white ? 'BLACK' : 'WHITE';
        const symbol = winner === 'BLACK' ? '⚫' : '⚪';
        content += `<div style="font-weight: bold;">${symbol} ${winner} wins with ${Math.max(scores.black, scores.white)}!</div>`;
    }

    winnerDisplay.innerHTML = content;
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
    const rawSuperpositionConfig = document.getElementById('superposition-config').value;

    const startingConfig = rawConfig
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[,.;\s]+$/, '');

    const superpositionConfig = rawSuperpositionConfig
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[,.;\s]+$/, '');

    currentRandomBoards = {
        board1: null,
        board2: null
    };

    const board1Layout = getSelectedBoardLayout(board1Select);
    const board2Layout = getSelectedBoardLayout(board2Select);

    try {
        game = new EntangledGame(board1Layout, board2Layout, startingConfig, superpositionConfig);
    } catch (error) {
        alert(error.message);
        return;
    }

    const existingWinner = document.querySelector('.winner');
    if (existingWinner) {
        existingWinner.remove();
    }

    initializeBoards();
    updateDisplay();
    makeAIMove();
}

// Custom board handling
function parseCustomBoard(input) {
    try {
        // Clean up input
        input = input.trim();

        // Extract the board object part
        const match = input.match(/^[^{]*({[\s\S]*})[^}]*$/);
        if (!match) {
            throw new Error('Invalid board format');
        }

        const boardStr = match[1];
        console.log('Parsing board string:', boardStr);

        // Parse the board object
        const boardObj = Function(`return ${boardStr}`)();
        console.log('Parsed board object:', boardObj);

        if (!boardObj.name || !boardObj.grid || !Array.isArray(boardObj.grid)) {
            throw new Error('Invalid board structure');
        }

        // Validate grid
        const size = boardObj.grid.length;
        const validSymbols = getSymbolsForSize(size);

        for (const row of boardObj.grid) {
            if (!Array.isArray(row) || row.length !== size) {
                throw new Error('Invalid grid dimensions');
            }

            for (const cell of row) {
                if (cell !== '.' && !validSymbols.includes(cell)) {
                    throw new Error(`Invalid symbol: ${cell}`);
                }
            }
        }

        return boardObj;
    } catch (error) {
        console.error('Board parsing error:', error);
        throw new Error(`Failed to parse board: ${error.message}`);
    }
}

function setupCustomBoardHandling() {
    const modal = document.getElementById('custom-board-modal');
    const textarea = document.getElementById('custom-board-input');
    const saveBtn = document.getElementById('custom-board-save');
    const cancelBtn = document.getElementById('custom-board-cancel');
    let currentTarget = null;

    function showModal(targetId) {
        currentTarget = targetId;
        modal.classList.add('show');
        textarea.value = '';
    }

    function hideModal() {
        modal.classList.remove('show');
        textarea.value = '';
        currentTarget = null;
    }

    document.getElementById('custom-board1-btn').addEventListener('click', () => showModal('board1-select'));
    document.getElementById('custom-board2-btn').addEventListener('click', () => showModal('board2-select'));
    cancelBtn.addEventListener('click', hideModal);

    saveBtn.addEventListener('click', () => {
        try {
            const boardObj = parseCustomBoard(textarea.value);
            const id = `custom_${Date.now()}`;
            customBoards.set(id, boardObj);

            // Refresh board options
            const currentSize = parseInt(document.getElementById('board-size').value);
            populateBoardsBySize(currentSize);

            // Select the new custom board
            const targetSelect = document.getElementById(currentTarget);
            targetSelect.value = id;

            hideModal();

            // Initialize boards once
            initializeBoards();
        } catch (error) {
            alert(error.message);
        }
    });
}

function init() {
    loadSettings();
    setupCustomBoardHandling();

    document.getElementById('toggle-settings').addEventListener('click', () => {
        const content = document.querySelector('.settings-content');
        const icon = document.querySelector('.toggle-icon');
        content.classList.toggle('hidden');
        icon.classList.toggle('rotated');
    });

    ['hover', 'groups', 'size', 'score', 'currentPlayer', 'icons', 'symbols'].forEach(setting => {
        const checkbox = document.getElementById(`setting-${setting}`);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                gameSettings[setting] = e.target.checked;
                saveSettings();
                applySettings();
                if (game) {
                    updateDisplay();
                }
            });
        }
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

    populateBoardsBySize(7);

    document.getElementById('start-game').addEventListener('click', () => {
        stopGame();
        initializeGame();
    });

    const settingsElements = [
        'board1-select',
        'board2-select',
        'black-player',
        'white-player',
        'starting-config',
        'superposition-config'
    ];

    settingsElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        element.addEventListener('change', () => {
            if (elementId.startsWith('board')) {
                if (element.value.startsWith('random')) {
                    currentRandomBoards[elementId] = null;
                }
                // Only reinitialize boards if a board selection changes
                initializeBoards();
            } else {
                // For other settings, stop the game
                stopGame();
            }
        });
    });

    initializeBoards();
    document.getElementById('start-game').click();
}

window.addEventListener('load', init);