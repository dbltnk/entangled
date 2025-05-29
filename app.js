import BOARD_LAYOUTS, { getSymbolsForSize } from './boards.js';
import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer, AI_PLAYERS } from './players.js';
import { GameController } from './game-controller.js';

// Scorecard constants
const SCORECARD_STORAGE_KEY = 'entangled_scorecard';
const CHALLENGES = {
    MAXIMUM_ENTROPY: {
        id: 'maximum-entropy',
        levels: [
            { name: 'Engineer', target: 50 },
            { name: 'Cipher', target: 60 },
            { name: 'Weaver', target: 65 },
            { name: 'Master', target: 68 }
        ]
    },
    COLLAPSE_CONTROL: {
        id: 'collapse-control',
        levels: [
            { name: 'Engineer', target: 40, isLowerBetter: true },
            { name: 'Cipher', target: 30, isLowerBetter: true },
            { name: 'Weaver', target: 20, isLowerBetter: true },
            { name: 'Master', target: 15, isLowerBetter: true }
        ]
    },
    QUANTUM_UNCERTAINTY: {
        id: 'quantum-uncertainty',
        levels: [
            { name: 'Engineer', target: 0 },
            { name: 'Cipher', target: 10 },
            { name: 'Weaver', target: 15 },
            { name: 'Master', target: 20 }
        ]
    },
    QUANTUM_COHERENCE: {
        id: 'quantum-coherence',
        levels: [
            { name: 'Basic tie', target: 0 },
            { name: 'Perfect tie', target: 0, requiresPerfect: true }
        ]
    }
};

// Scorecard helper functions
function loadScorecard() {
    const data = localStorage.getItem(SCORECARD_STORAGE_KEY);
    return data ? JSON.parse(data) : {
        maximumEntropy: { best: 0, achievements: [] },
        collapseControl: { best: Infinity, achievements: [] },
        quantumUncertainty: { best: 0, achievements: [] },
        quantumCoherence: { best: 0, perfectTie: false, achievements: [] }
    };
}

function saveScorecard(data) {
    localStorage.setItem(SCORECARD_STORAGE_KEY, JSON.stringify(data));
}

function updateAchievements(challengeId, score, isGameOver = false, achievements = []) {
    const challenge = Object.values(CHALLENGES).find(c => c.id === challengeId);
    if (!challenge) return;

    const achievementsDiv = document.querySelector(`#${challengeId} .achievements`);
    achievementsDiv.innerHTML = '';

    challenge.levels.forEach(level => {
        let isCompleted = false;

        if (challengeId === 'quantum-coherence') {
            // For quantum coherence, we need to check the actual game state
            if (isGameOver && game) {
                const stats = game.getEndGameStats();
                const isTied = stats.scores.black === stats.scores.white;
                const isPerfectTie = isTied &&
                    stats.tiebreaker &&
                    stats.tiebreaker.winner === 'TIE' &&
                    stats.tiebreaker.comparisonData.every(level => level.black.sum === level.white.sum);

                if (level.name === 'Basic tie') {
                    isCompleted = isTied;
                } else if (level.name === 'Perfect tie') {
                    isCompleted = isPerfectTie;
                }
            }
        } else {
            // For other challenges, use the standard completion check
            isCompleted = isGameOver && (level.isLowerBetter ?
                score <= level.target :
                score >= level.target);
        }

        const achievement = document.createElement('div');
        achievement.className = `achievement ${isCompleted ? 'completed' : ''}`;

        const checkbox = document.createElement('div');
        checkbox.className = 'achievement-checkbox';

        const label = document.createElement('span');
        if (challengeId === 'quantum-coherence') {
            if (level.name === 'Basic tie') {
                label.textContent = 'Both players are tied';
            } else if (level.name === 'Perfect tie') {
                label.textContent = 'All groups are tied';
            } else {
                label.textContent = level.name;
            }
        } else {
            label.textContent = `${level.name} (${level.isLowerBetter ? '<' : ''}${level.target}${level.isLowerBetter ? '' : '+'})`;
        }

        achievement.appendChild(checkbox);
        achievement.appendChild(label);
        achievementsDiv.appendChild(achievement);
    });

    // No extra text-only completed achievements appended here.
}

function showNewRecord(challengeId, score) {
    const bestScoreDiv = document.querySelector(`#${challengeId} .best-score`);
    const scoreSpan = bestScoreDiv.querySelector('.score');

    scoreSpan.textContent = score;
    bestScoreDiv.classList.add('new-record');

    // Remove the animation class after it completes
    setTimeout(() => {
        bestScoreDiv.classList.remove('new-record');
    }, 1000);
}

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
    boardConfig: false,
    additionalBots: false,
    theme: 'light' // Default to light theme
};

// Theme management functions
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';

    // Update checkbox state
    const themeCheckbox = document.getElementById('setting-theme');
    if (themeCheckbox) {
        themeCheckbox.checked = theme === 'dark';
    }
}

// Add system theme change listener
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
systemThemeQuery.addListener(() => {
    if (gameSettings.theme === 'system') {
        applyTheme('system');
    }
});

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
    const settings = JSON.parse(localStorage.getItem('gameSettings') || '{}');
    gameSettings = {
        hover: true,
        groups: true,
        size: true,
        score: true,
        currentPlayer: true,
        icons: true,
        symbols: false,
        boardConfig: false,
        additionalBots: false,
        theme: 'light',
        ...settings
    };

    // Apply settings to checkboxes
    Object.entries(gameSettings).forEach(([key, value]) => {
        const checkbox = document.getElementById(`setting-${key}`);
        if (checkbox) {
            checkbox.checked = key === 'theme' ? value === 'dark' : value;
        }
    });

    applySettings();
    applyTheme(gameSettings.theme);
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(gameSettings));
}

function applySettings() {
    // Apply hover setting
    const cells = document.querySelectorAll('.cell, .hex-cell');
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

    const humanOption = new Option('Human', 'human');
    blackSelect.add(humanOption.cloneNode(true));
    whiteSelect.add(humanOption.cloneNode(true));

    Object.values(AI_PLAYERS).forEach(player => {
        const option = new Option(`${player.name}`, player.id);
        option.title = player.description;
        blackSelect.add(option.cloneNode(true));
        whiteSelect.add(option.cloneNode(true));
    });

    // Set default values
    blackSelect.value = 'human';
    whiteSelect.value = 'defensive-some-rng';

    // Update thinking time visibility for initial values
    updateThinkingTimeVisibility('black-player');
    updateThinkingTimeVisibility('white-player');
}

function getBoardSize(boardId) {

    // Check if it's a custom board first
    if (customBoards.has(boardId)) {
        const customBoard = customBoards.get(boardId);
        return customBoard.grid.length;
    }

    // If not custom, try standard board layouts
    const layout = BOARD_LAYOUTS[boardId];
    if (layout) {
        return layout.grid.length;
    }

    // Default fallback
    return 7;
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

    // Add standard boards first
    let standardBoardCount = 0;
    Object.entries(BOARD_LAYOUTS).forEach(([id, layout]) => {
        if (getBoardSize(id) === size) {
            const option = new Option(layout.name, id);
            board1Select.add(option.cloneNode(true));
            board2Select.add(option.cloneNode(true));
            standardBoardCount++;
        }
    });

    // Add custom boards for this size
    let customBoardCount = 0;
    customBoards.forEach((board, id) => {
        if (getBoardSize(id) === size) {
            const option = new Option(`Custom: ${board.name}`, id);
            board1Select.add(option.cloneNode(true));
            board2Select.add(option.cloneNode(true));
            customBoardCount++;
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
    const board1Options = Array.from(board1Select.options).map(opt => opt.value);
    const board2Options = Array.from(board2Select.options).map(opt => opt.value);

    if (board1Options.includes(currentBoard1)) {
        board1Select.value = currentBoard1;
    } else {
        board1Select.value = defaultBoards[size][0];
    }

    if (board2Options.includes(currentBoard2)) {
        board2Select.value = currentBoard2;
    } else {
        board2Select.value = defaultBoards[size][1];
    }

    startingConfigInput.value = defaultConfigs[size];
}

function getSelectedBoardLayout(boardSelect) {
    const selectedValue = boardSelect.value;
    const currentSize = parseInt(document.getElementById('board-size').value);


    // Safety check for empty selection
    if (!selectedValue) {
        console.error(`Empty board selection for ${boardSelect.id}`);
        // Default to the first option in the dropdown
        const firstOption = boardSelect.options[0]?.value;
        if (firstOption) {
            console.log(`Defaulting to first option: ${firstOption}`);
            boardSelect.value = firstOption;
            return getSelectedBoardLayout(boardSelect);
        }
        // If no options available, use a fallback board
        console.log(`No options available, using fallback board`);
        return {
            grid: BOARD_LAYOUTS[`board${currentSize}x${currentSize}`].grid,
            type: "rect"
        };
    }

    if (selectedValue.startsWith('random')) {
        if (!currentRandomBoards[boardSelect.id]) {
            currentRandomBoards[boardSelect.id] = BOARD_LAYOUTS[`random${currentSize}x${currentSize}`].grid;
        } else {
        }
        return {
            grid: currentRandomBoards[boardSelect.id],
            type: "rect" // Random boards are always rectangular
        };
    }

    // Check custom boards first
    if (customBoards.has(selectedValue)) {
        const customBoard = customBoards.get(selectedValue);
        return {
            grid: customBoard.grid,
            type: customBoard.type || "rect" // Default to rect if not specified
        };
    }

    // Check if the selected board exists in BOARD_LAYOUTS
    if (!BOARD_LAYOUTS[selectedValue]) {
        console.error(`Board layout not found for ${selectedValue}, using fallback`);
        const fallbackKey = Object.keys(BOARD_LAYOUTS)[0];
        return {
            grid: BOARD_LAYOUTS[fallbackKey].grid,
            type: BOARD_LAYOUTS[fallbackKey].type || "rect"
        };
    }

    return {
        grid: BOARD_LAYOUTS[selectedValue].grid,
        type: BOARD_LAYOUTS[selectedValue].type || "rect"
    };
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

    const currentSize = getBoardSize(boardNum);
    if (!currentSize) return null;

    // Cache check - use board-specific cache to handle different layouts
    const cacheKey = `${letter}-${currentSize}-${boardNum}`;
    if (uniqueColors.has(cacheKey)) {
        return uniqueColors.get(cacheKey);
    }

    // For board 2, we want to use the same colors as board 1
    if (boardNum === 2) {
        const board1Color = generateColorForLetter(letter, 1, row, col);
        uniqueColors.set(cacheKey, board1Color);
        return board1Color;
    }

    // Get all symbols for current board size
    const tiles = [];
    const layout = getSelectedBoardLayout(document.getElementById(`board${boardNum}-select`));
    const isHexGrid = layout.type === 'hex';

    if (layout && layout.grid) {
        for (let r = 0; r < layout.grid.length; r++) {
            for (let c = 0; c < layout.grid[r].length; c++) {
                const symbol = layout.grid[r][c];
                if (symbol !== '.') {
                    tiles.push({ symbol, row: r, col: c });
                }
            }
        }
    }

    if (tiles.length === 0) {
        console.warn('No layout found for color generation');
        return 'hsl(240, 85%, 60%)';
    }

    // Calculate center for the current board size
    const centerRow = (currentSize - 1) / 2;
    const centerCol = (currentSize - 1) / 2;

    // Calculate positions and angles
    tiles.forEach(tile => {
        const deltaY = tile.row - centerRow;
        const deltaX = tile.col - centerCol;
        // Adjust angle calculation for hex grids
        if (isHexGrid) {
            // Hex grid uses 60-degree spacing
            tile.angle = ((-Math.atan2(deltaY * Math.sqrt(3) / 2, deltaX) + Math.PI / 2) * (180 / Math.PI) + 360) % 360;
        } else {
            tile.angle = ((-Math.atan2(deltaY, deltaX) + Math.PI / 2) * (180 / Math.PI) + 360) % 360;
        }
        tile.dist = Math.sqrt(Math.pow(deltaY, 2) + Math.pow(deltaX, 2)) /
            Math.sqrt(Math.pow(centerRow, 2) + Math.pow(centerCol, 2));
    });

    // Sort tiles by angle to distribute colors evenly
    tiles.sort((a, b) => a.angle - b.angle);

    // Find our tile's index
    const index = tiles.findIndex(t => t.symbol === letter);
    if (index === -1) {
        console.warn(`Letter ${letter} not found in tiles array`);
        return 'hsl(240, 85%, 60%)';
    }

    // Generate color
    const hue = ((index / tiles.length) * 360 + 0) % 360;
    const currentDist = tiles[index].dist;
    const saturation = 85 + (currentDist * 15);
    const lightness = 60 - (currentDist * 10);

    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    uniqueColors.set(cacheKey, color);
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

// Function to assign gradient numbers to cells on the bottom board
function assignGradientNumbers() {
    // Create a mapping from symbols to gradient numbers
    const symbolToGradient = new Map();
    const boardSize = game?.boardSize || parseInt(document.getElementById('board-size').value);

    // Get all unique symbols that exist on both boards
    const allSymbols = new Set();
    const board1Select = document.getElementById('board1-select');
    const board2Select = document.getElementById('board2-select');
    const board1Layout = getSelectedBoardLayout(board1Select);
    const board2Layout = getSelectedBoardLayout(board2Select);

    // We'll use board2 as our reference for the gradient (bottom board)
    const referenceBoard = board2Layout.grid;

    // Collect all symbols from the reference board
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            const symbol = referenceBoard[i][j];
            if (symbol !== '.') {
                allSymbols.add(symbol);
            }
        }
    }

    // Create a position map for each symbol in the reference board
    const symbolPositions = new Map();
    for (let i = 0; i < boardSize; i++) {
        for (let j = 0; j < boardSize; j++) {
            const symbol = referenceBoard[i][j];
            if (symbol !== '.') {
                symbolPositions.set(symbol, { row: i, col: j });
            }
        }
    }

    // Sort symbols by position (top to bottom, left to right)
    const sortedSymbols = Array.from(allSymbols).sort((a, b) => {
        const posA = symbolPositions.get(a);
        const posB = symbolPositions.get(b);

        if (!posA || !posB) return 0;

        // Sort by row first, then by column
        if (posA.row !== posB.row) {
            return posA.row - posB.row;
        }
        return posA.col - posB.col;
    });

    // Assign numbers in ascending order (lowest at top-left)
    let currentNumber = 1; // Start from 1 instead of the length
    sortedSymbols.forEach(symbol => {
        symbolToGradient.set(symbol, currentNumber++); // Increment instead of decrement
    });

    return symbolToGradient;
}

function createCell(symbol, boardNum, row, col, cellType = "rect") {
    if (symbol === '.') return null;

    // Create the appropriate cell type
    const cell = document.createElement('div');

    if (cellType === "hex") {
        cell.className = 'hex-cell';
    } else {
        cell.className = 'cell';
        // Rect specific positioning
        cell.style.gridColumn = (col + 1).toString();
        cell.style.gridRow = (row + 1).toString();
    }

    // Set data attributes
    cell.setAttribute('data-symbol', symbol);
    cell.setAttribute('data-position', `${row},${col}`);

    // Common properties
    cell.dataset.board = boardNum;
    cell.dataset.row = row;
    cell.dataset.col = col;
    cell.dataset.cellType = cellType;

    const colors = getBackgroundColor(symbol, boardNum, row, col);
    cell.style.backgroundColor = colors.background;

    // Add icon
    const icon = document.createElement('i');
    icon.className = `${cellType === "hex" ? "cell-icon" : "cell-icon"} fa-solid ${ICON_MAPPINGS[symbol] || 'fa-circle'}`;
    icon.style.color = colors.icon;
    cell.appendChild(icon);

    // Add letter element for display number
    const letter = document.createElement('div');
    letter.className = 'cell-letter';

    // Keep the original symbol in a data attribute for functionality
    letter.dataset.originalSymbol = symbol;

    // Add the letter element to the cell
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

function createGroupSizeElement(size, isWhiteStone) {
    const sizeElement = document.createElement('div');
    sizeElement.className = `group-size ${isWhiteStone ? 'on-white' : ''}`;
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
    const selector = `[data-board="${boardNum}"][data-row="${row}"][data-col="${col}"]`;
    const cell = document.querySelector(selector);

    if (!cell) return;

    // Reset highlights
    cell.classList.remove('cell-highlight-black', 'cell-highlight-white');

    // Get the correct clusters for this board
    const boardKey = boardNum === 1 ? 'board1' : 'board2';
    const blackClusters = largestClusters?.black[boardKey] || [];
    const whiteClusters = largestClusters?.white[boardKey] || [];

    // Apply new highlights if in largest cluster
    const inBlackCluster = blackClusters.some(c => c.row === row && c.col === col);
    const inWhiteCluster = whiteClusters.some(c => c.row === row && c.col === col);

    if (inBlackCluster) {
        cell.classList.add('cell-highlight-black');
    } else if (inWhiteCluster) {
        cell.classList.add('cell-highlight-white');
    }
}

function updateGroupSizes(boardElement, clusters, isBoard1) {
    // Remove existing group size elements
    boardElement.querySelectorAll('.group-size').forEach(el => el.remove());

    // No groups to display or setting is off
    if (!gameSettings.size || !clusters) return;

    // Get the clusters for the current board
    const blackClusters = clusters.black[isBoard1 ? 'board1' : 'board2'];
    const whiteClusters = clusters.white[isBoard1 ? 'board1' : 'board2'];

    // Create group size elements for black clusters
    if (blackClusters && blackClusters.length > 0) {
        const centerCell = findMostCenteredCell(blackClusters, boardElement, isBoard1);
        if (centerCell) {
            // Black stones should have white text on dark background (default style)
            const sizeEl = createGroupSizeElement(blackClusters.length, false);
            centerCell.appendChild(sizeEl);
        }
    }

    // Create group size elements for white clusters
    if (whiteClusters && whiteClusters.length > 0) {
        const centerCell = findMostCenteredCell(whiteClusters, boardElement, isBoard1);
        if (centerCell) {
            // White stones should have black text on light background (on-white class)
            const sizeEl = createGroupSizeElement(whiteClusters.length, true);
            centerCell.appendChild(sizeEl);
        }
    }
}

// Find the most centered cell in a cluster for placing the group size
function findMostCenteredCell(cells, boardElement, isBoard1) {
    if (!cells || cells.length === 0) return null;

    // Calculate the center of the board
    const boardCenter = game.boardSize / 2;

    // Find the most central cell
    let bestCell = null;
    let bestDistance = Infinity;

    for (const { row, col } of cells) {
        // Find the cell element
        const cellSelector = `[data-board="${isBoard1 ? 1 : 2}"][data-row="${row}"][data-col="${col}"]`;
        const cell = boardElement.querySelector(cellSelector);

        if (!cell) continue;

        // Calculate distance from center (Euclidean distance for better centrality)
        const distX = col - boardCenter;
        const distY = row - boardCenter;
        const distance = Math.sqrt(distX * distX + distY * distY);

        // Keep the cell with the smallest distance to center
        if (distance < bestDistance) {
            bestDistance = distance;
            bestCell = cell;
        }
    }

    return bestCell;
}

function stopGame() {
    game = null;
    const existingWinner = document.querySelector('.winner');
    if (existingWinner) {
        existingWinner.remove();
    }

    // Hide mobile game over elements
    const mobileGameOver = document.getElementById('mobile-game-over');
    const showGameOverButton = document.getElementById('show-game-over');

    if (mobileGameOver) {
        mobileGameOver.classList.remove('show');
    }

    if (showGameOverButton) {
        showGameOverButton.classList.remove('visible');
    }

    document.getElementById('score-display').textContent = 'Dark: 0 - Light: 0';
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

    // Clear previous boards
    board1Element.innerHTML = '';
    board2Element.innerHTML = '';

    // Get selected board layouts
    const board1Layout = getSelectedBoardLayout(board1Select);
    const board2Layout = getSelectedBoardLayout(board2Select);

    // Generate symbol to gradient number mapping
    const symbolToGradient = assignGradientNumbers();

    // Add board size class
    const currentSize = board1Layout.grid.length;

    // Set up the base classes for each board
    board1Element.className = `board board-${currentSize}`;
    board2Element.className = `board board-${currentSize}`;

    // Store the gradient mapping on the boards for later use
    board1Element.dataset.gradientMap = JSON.stringify(Array.from(symbolToGradient.entries()));
    board2Element.dataset.gradientMap = JSON.stringify(Array.from(symbolToGradient.entries()));

    // For rectangular grids, use CSS grid
    if (board1Layout.type === "rect") {
        board1Element.style.gridTemplateRows = `repeat(${currentSize}, 1fr)`;
        board1Element.style.gridTemplateColumns = `repeat(${currentSize}, 1fr)`;
    } else {
        board1Element.classList.add('hex-grid');
        // For hex grids, clear any grid template
        board1Element.style.gridTemplateRows = '';
        board1Element.style.gridTemplateColumns = '';
    }

    if (board2Layout.type === "rect") {
        board2Element.style.gridTemplateRows = `repeat(${currentSize}, 1fr)`;
        board2Element.style.gridTemplateColumns = `repeat(${currentSize}, 1fr)`;
    } else {
        board2Element.classList.add('hex-grid');
        // For hex grids, clear any grid template
        board2Element.style.gridTemplateRows = '';
        board2Element.style.gridTemplateColumns = '';
    }

    // Create grids based on board type
    if (board1Layout.type === "hex") {
        createHexGrid(board1Element, board1Layout.grid, 1);
    } else {
        createRectGrid(board1Element, board1Layout.grid, 1);
    }

    if (board2Layout.type === "hex") {
        createHexGrid(board2Element, board2Layout.grid, 2);
    } else {
        createRectGrid(board2Element, board2Layout.grid, 2);
    }

    // Apply gradient numbers to all cells after boards are created
    applyGradientNumbers();
}

// Function to apply gradient numbers to all cells
function applyGradientNumbers() {
    const board1Element = document.getElementById('board1');
    const board2Element = document.getElementById('board2');

    // Get the gradient mapping from the board
    let symbolToGradient;
    try {
        symbolToGradient = new Map(JSON.parse(board1Element.dataset.gradientMap));
    } catch (e) {
        console.error("Error parsing gradient map:", e);
        return;
    }

    // Apply to all cells on both boards
    document.querySelectorAll('.cell-letter, .hex-cell .cell-letter').forEach(letter => {
        const symbol = letter.dataset.originalSymbol;
        const gradientNumber = symbolToGradient.get(symbol) || 0;

        // Format as two-digit number with leading zero if needed
        letter.textContent = gradientNumber.toString().padStart(2, '0');
    });
}

// Helper function to create rectangular grid
function createRectGrid(boardElement, layout, boardNum) {
    const currentSize = layout.length;
    for (let i = 0; i < currentSize; i++) {
        for (let j = 0; j < currentSize; j++) {
            const cell = createCell(layout[i][j], boardNum, i, j, "rect");
            if (cell) boardElement.appendChild(cell);
        }
    }
}

// Helper function to create hexagonal grid
function createHexGrid(boardElement, layout, boardNum) {
    const currentSize = layout.length;

    for (let i = 0; i < currentSize; i++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'hex-row';

        for (let j = 0; j < currentSize; j++) {
            if (layout[i][j] === '.') continue;

            // Create container for hex cell
            const cellContainer = document.createElement('div');
            cellContainer.className = 'hex-cell-container';

            // Create hex cell
            const cell = createCell(layout[i][j], boardNum, i, j, "hex");
            if (cell) {
                cellContainer.appendChild(cell);
                rowDiv.appendChild(cellContainer);
            }
        }

        boardElement.appendChild(rowDiv);
    }
}

function isHumanTurn() {
    if (!game || game.isGameOver()) return false;
    const currentPlayer = game.getCurrentPlayer().toLowerCase();
    const playerSelect = currentPlayer === 'black' ? 'black-player' : 'white-player';
    const playerType = document.getElementById(playerSelect)?.value;
    return playerType === 'human';
}

function highlightCorrespondingCells(symbol) {
    if (!gameSettings.hover || symbol === '.') return;
    const cells = document.querySelectorAll(`[data-symbol="${symbol}"]`);
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
    document.querySelectorAll('.cell.highlighted, .hex-cell.highlighted').forEach(cell => {
        cell.classList.remove('highlighted', 'black-turn', 'white-turn');
    });
}

function updateCell(boardNum, row, col, player) {
    // Find the cell by data attributes
    const selector = `[data-board="${boardNum}"][data-row="${row}"][data-col="${col}"]`;
    const cell = document.querySelector(selector);

    if (!cell) return;

    // Remove any existing stone
    const existingStone = cell.querySelector('.stone');
    if (existingStone) {
        cell.removeChild(existingStone);
    }

    // Don't add a stone for null player (removal)
    if (player === null) {
        cell.classList.remove('has-stone');
        return;
    }

    // Create and add the stone
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
}

function updateDisplay() {
    if (!game) return;

    const state = game.getGameState();
    const board1Element = document.getElementById('board1');
    const board2Element = document.getElementById('board2');

    updateGroupSizes(board1Element, state.largestClusters, true);
    updateGroupSizes(board2Element, state.largestClusters, false);

    // Make sure gradient numbers are still displayed correctly
    applyGradientNumbers();

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
            `Current player: ${state.currentPlayer === PLAYERS.BLACK ? '⚫ Dark' : '⚪ Light'}`;
    }

    // Update swap button visibility
    const swapContainer = document.getElementById('swap-button-container');
    const currentPlayerType = document.getElementById(`${state.currentPlayer.toLowerCase()}-player`).value;

    if (state.swapAvailable && currentPlayerType === 'human') {
        swapContainer.style.display = 'block';
    } else {
        swapContainer.style.display = 'none';
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

    // Update mobile score display
    const mobileScoreDisplay = document.getElementById('mobile-score-display');
    if (mobileScoreDisplay) {
        mobileScoreDisplay.textContent = ` ${blackScore} : ${whiteScore} `;
    }

    // Update mobile current player display
    const mobileBlackPlayer = document.getElementById('mobile-black-player');
    const mobileWhitePlayer = document.getElementById('mobile-white-player');
    if (mobileBlackPlayer && mobileWhitePlayer) {
        if (state.currentPlayer === PLAYERS.BLACK) {
            mobileBlackPlayer.classList.add('active');
            mobileWhitePlayer.classList.remove('active');
        } else {
            mobileBlackPlayer.classList.remove('active');
            mobileWhitePlayer.classList.add('active');
        }
    }

    // Update mobile start button text
    const mobileStartButton = document.getElementById('mobile-start-game');
    if (mobileStartButton) {
        mobileStartButton.textContent = 'Restart';
    }
}

function updateScorecard() {
    if (!game || !game.isGameOver()) return;

    // Check if both players are human
    const blackPlayerType = document.getElementById('black-player').value;
    const whitePlayerType = document.getElementById('white-player').value;
    const isHumanVsHuman = blackPlayerType === 'human' && whitePlayerType === 'human';

    // Skip achievement tracking completely for non-human vs human games
    if (!isHumanVsHuman) {
        return;
    }

    const stats = game.getEndGameStats();
    if (!stats) return;

    const scorecard = loadScorecard();

    // Maximum Entropy
    const totalScore = stats.scores.black + stats.scores.white;
    if (totalScore > scorecard.maximumEntropy.best) {
        scorecard.maximumEntropy.best = totalScore;
        showNewRecord('maximum-entropy', totalScore);
    }
    // Update achievements (never remove existing ones)
    CHALLENGES.MAXIMUM_ENTROPY.levels.forEach(level => {
        if (totalScore >= level.target) {
            if (!scorecard.maximumEntropy.achievements.includes(level.name)) {
                scorecard.maximumEntropy.achievements.push(level.name);
            }
        }
    });

    // Collapse Control
    if (totalScore < scorecard.collapseControl.best) {
        scorecard.collapseControl.best = totalScore;
        showNewRecord('collapse-control', totalScore);
    }
    // Update achievements
    CHALLENGES.COLLAPSE_CONTROL.levels.forEach(level => {
        if (totalScore <= level.target) {
            if (!scorecard.collapseControl.achievements.includes(level.name)) {
                scorecard.collapseControl.achievements.push(level.name);
            }
        }
    });

    // Quantum Uncertainty
    const scoreDiff = Math.abs(stats.scores.black - stats.scores.white);
    if (scoreDiff > scorecard.quantumUncertainty.best) {
        scorecard.quantumUncertainty.best = scoreDiff;
        showNewRecord('quantum-uncertainty', scoreDiff);
    }
    // Update achievements
    CHALLENGES.QUANTUM_UNCERTAINTY.levels.forEach(level => {
        if (scoreDiff >= level.target) {
            if (!scorecard.quantumUncertainty.achievements.includes(level.name)) {
                scorecard.quantumUncertainty.achievements.push(level.name);
            }
        }
    });

    // Quantum Coherence
    const isTied = stats.scores.black === stats.scores.white;
    // A perfect tie is only when scores are tied AND the tiebreaker explicitly results in 'TIE'
    // (not when one player wins in the tiebreaker)
    const isPerfectTie = isTied &&
        stats.tiebreaker &&
        stats.tiebreaker.winner === 'TIE' &&
        stats.tiebreaker.comparisonData.every(level => level.black.sum === level.white.sum);

    if (isTied && stats.scores.black > scorecard.quantumCoherence.best) {
        scorecard.quantumCoherence.best = stats.scores.black;
        scorecard.quantumCoherence.perfectTie = isPerfectTie;
        showNewRecord('quantum-coherence', `Tied at ${stats.scores.black}${isPerfectTie ? ' (Perfect!)' : ''}`);
    }

    // Update achievements - only add perfect tie if we have a basic tie first
    if (isTied && !scorecard.quantumCoherence.achievements.includes('Basic tie')) {
        scorecard.quantumCoherence.achievements.push('Basic tie');
    }
    if (isPerfectTie &&
        scorecard.quantumCoherence.achievements.includes('Basic tie') &&
        !scorecard.quantumCoherence.achievements.includes('Perfect tie')) {
        scorecard.quantumCoherence.achievements.push('Perfect tie');
    }

    saveScorecard(scorecard);

    // Update display with current game results and all achievements
    updateAchievements('maximum-entropy', totalScore, true, scorecard.maximumEntropy.achievements);
    updateAchievements('collapse-control', totalScore, true, scorecard.collapseControl.achievements);
    updateAchievements('quantum-uncertainty', scoreDiff, true, scorecard.quantumUncertainty.achievements);
    updateAchievements('quantum-coherence', isTied ? stats.scores.black : 0, true, scorecard.quantumCoherence.achievements);
}

function initializeScorecard() {
    const scorecard = loadScorecard();

    // Initialize Maximum Entropy
    showNewRecord('maximum-entropy', scorecard.maximumEntropy.best);
    updateAchievements('maximum-entropy', scorecard.maximumEntropy.best, false, scorecard.maximumEntropy.achievements);

    // Initialize Collapse Control
    showNewRecord('collapse-control', scorecard.collapseControl.best === Infinity ? 0 : scorecard.collapseControl.best);
    updateAchievements('collapse-control', scorecard.collapseControl.best, false, scorecard.collapseControl.achievements);

    // Initialize Quantum Uncertainty
    showNewRecord('quantum-uncertainty', scorecard.quantumUncertainty.best);
    updateAchievements('quantum-uncertainty', scorecard.quantumUncertainty.best, false, scorecard.quantumUncertainty.achievements);

    // Initialize Quantum Coherence
    showNewRecord('quantum-coherence', scorecard.quantumCoherence.best ?
        `Tied at ${scorecard.quantumCoherence.best}${scorecard.quantumCoherence.perfectTie ? ' (Perfect!)' : ''}` :
        'No tie yet');
    updateAchievements('quantum-coherence', scorecard.quantumCoherence.best, false, scorecard.quantumCoherence.achievements);
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

    // Handle mobile game over display
    const mobileGameOverDetails = document.getElementById('mobile-game-over-details');
    const showGameOverButton = document.getElementById('show-game-over');
    const mobileGameOver = document.getElementById('mobile-game-over');

    if (mobileGameOverDetails && showGameOverButton) {
        // Copy the same content to the mobile popup
        mobileGameOverDetails.innerHTML = content;

        // Only show on mobile devices
        if (window.innerWidth <= 1024) {
            // Show the button to open the popup
            showGameOverButton.classList.add('visible');

            // Automatically show the popup
            if (mobileGameOver) {
                mobileGameOver.classList.add('show');
            }
        }
    }

    // Update scorecard after showing winner
    updateScorecard();
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
            // Schedule AI move to happen after a short delay
            setTimeout(makeAIMove, 100);
        }
    }
}

function updateThinkingTimeVisibility(playerId) {
    const playerSelect = document.getElementById(playerId);
    const thinkingTimeContainer = document.querySelector(`#${playerId}-controls .thinking-time-container`);

    if (!playerSelect || !thinkingTimeContainer) return;

    const selectedValue = playerSelect.value;
    // Only show thinking time for minimax, mcts, and hybrid players
    const showThinkingTime = ['minimax', 'minimax-some-rng', 'mcts', 'hybrid'].includes(selectedValue);
    thinkingTimeContainer.style.display = showThinkingTime ? 'flex' : 'none';
}

function setupThinkingTimeHandlers() {
    const playerIds = ['black-player', 'white-player'];

    // Set up change event handlers
    playerIds.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.addEventListener('change', () => updateThinkingTimeVisibility(id));
        }
    });

    // Initialize visibility based on default selections
    updateThinkingTimeVisibility('black-player');
    updateThinkingTimeVisibility('white-player');
}

function getThinkingTime(playerId) {
    const input = document.querySelector(`#${playerId}-controls .thinking-time-input`);
    if (!input) return null;
    // Convert seconds to milliseconds
    return parseFloat(input.value) * 1000;
}

function makeAIMove() {
    if (!game || game.isGameOver()) return;

    const currentPlayerId = game.getCurrentPlayer() === PLAYERS.BLACK ? 'black-player' : 'white-player';
    const playerType = document.getElementById(currentPlayerId).value;

    if (playerType === 'human' || playerType === 'remote') return;

    const thinkingTime = getThinkingTime(currentPlayerId);
    if (!thinkingTime) {
        console.error(`No thinking time provided for ${currentPlayerId}`);
        return;
    }

    disableUI();
    const player = createPlayer(playerType, game, game.getCurrentPlayer(), { thinkingTime });

    try {
        // First check if we should swap
        if (game.isSwapAvailable()) {
            // First show that AI is considering the swap
            showToast('🤔 Opponent is considering whether to swap...');

            const shouldSwap = player.shouldSwap();
            if (shouldSwap) {
                // Wait a moment before showing the decision
                setTimeout(() => {
                    showToast('🔄 Opponent took over the first move.');
                    updateDisplay();
                    enableUI();
                    // Delay the swap until the toast is gone, then schedule next AI move
                    setTimeout(() => {
                        game.swapFirstMove();
                        updateDisplay();
                        // Schedule next AI move after swap is complete
                        setTimeout(makeAIMove, 100);
                    }, 100);
                }, 2000);
                return;
            }
        }

        // Choose and make the move
        const move = player.chooseMove();
        if (!move) {
            console.error(`${playerType} returned no move`);
            enableUI();
            if (game.getValidMoves().length === 0) {
                showWinner(game.getWinner());
            }
            return;
        }

        const positions = game.superpositionStones && game.superpositionStones.has(move) ?
            game.getValidPositionsForStone(move) : null;

        if (positions && positions.length > 0) {
            // For superposition stones, pick a random valid position
            const randomPos = positions[Math.floor(Math.random() * positions.length)];
            game.makeMove(move, randomPos);
        } else {
            game.makeMove(move);
        }

        updateDisplay();

        if (game.isGameOver()) {
            showWinner(game.getWinner());
        } else {
            // Schedule next AI move
            setTimeout(makeAIMove, 100);
        }
    } catch (error) {
        console.error('Error during AI move:', error);
        enableUI();
        return;
    } finally {
        enableUI();
        // Clean up player resources
        if (player.destroy) {
            player.destroy();
        }
    }
}

function showToast(message) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create and show new toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function initializeGame() {
    // Get settings
    const settings = {
        showScore: document.getElementById('setting-score').checked,
        showGroups: document.getElementById('setting-groups').checked,
        showSize: document.getElementById('setting-size').checked,
        showSymbols: document.getElementById('setting-symbols').checked
    };

    // Get game configuration
    const gameConfig = {
        boardSize: parseInt(document.getElementById('board-size').value),
        board1Layout: document.getElementById('board1-select').value,
        board2Layout: document.getElementById('board2-select').value,
        startingStones: document.getElementById('starting-config').value,
        superpositionStones: document.getElementById('enable-superposition').checked ? document.getElementById('superposition').value : '',
        enableSwapRule: document.getElementById('swap-rule').checked,
        player1: document.getElementById('black-player').value,
        player2: document.getElementById('white-player').value,
        settings
    };

    currentRandomBoards = {
        board1: null,
        board2: null
    };

    const board1Layout = getSelectedBoardLayout(document.getElementById('board1-select'));
    const board2Layout = getSelectedBoardLayout(document.getElementById('board2-select'));

    try {
        game = new EntangledGame(
            board1Layout.grid,
            board2Layout.grid,
            gameConfig.startingStones,
            gameConfig.superpositionStones,
            gameConfig.enableSwapRule,
            board1Layout.type,
            board2Layout.type
        );
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

        // First, try to detect if input is a property of an object
        const propertyMatch = input.match(/^([a-zA-Z0-9_]+):\s*({[\s\S]*})[\s,]*$/);

        let boardStr;
        let extractedKey = null;

        if (propertyMatch) {
            // We have a property format: key: {...}
            extractedKey = propertyMatch[1];
            boardStr = propertyMatch[2];
        } else {
            // Try a more flexible pattern to match property
            const flexMatch = input.match(/^([a-zA-Z0-9_]+[a-zA-Z0-9_\-]*):\s*\{/);

            if (flexMatch) {
                // Just prepend with return to make it a valid object
                boardStr = `return {${input}}`;
            } else {
                // Try to extract a standalone board object
                const objectMatch = input.match(/^[^{]*({[\s\S]*})[^}]*$/);

                if (!objectMatch) {
                    console.error('Could not extract valid JSON object');
                    throw new Error('Invalid board format - cannot extract object');
                }
                boardStr = objectMatch[1];
            }
        }


        // Try different parsing approaches
        let boardObj;

        try {
            // Try Function approach first
            if (extractedKey) {
                // For property format, make a temporary object
                const tempObj = Function(`return {${extractedKey}: ${boardStr}}`)();
                boardObj = tempObj[extractedKey];
            } else if (boardStr.startsWith('return')) {
                // For property with return statement
                boardObj = Function(boardStr)();
            } else {
                // For standalone object
                boardObj = Function(`return ${boardStr}`)();
            }
        } catch (e) {
            console.error('Function parsing failed:', e);

            try {
                // Try direct JSON parsing as fallback
                // This will only work for properly formatted JSON without comments
                boardObj = JSON.parse(boardStr);
            } catch (jsonError) {
                console.error('JSON parsing also failed:', jsonError);
                throw new Error('Could not parse board configuration');
            }
        }


        if (!boardObj.name) {
            console.error('Missing name property');
            throw new Error('Board must have a name property');
        }

        if (!boardObj.grid) {
            console.error('Missing grid property');
            throw new Error('Board must have a grid property');
        }

        if (!Array.isArray(boardObj.grid)) {
            console.error('Grid is not an array:', boardObj.grid);
            throw new Error('Grid must be an array');
        }


        // Check board type - should be either 'rect' or 'hex'
        console.log('Board type:', boardObj.type);
        if (boardObj.type && boardObj.type !== 'rect' && boardObj.type !== 'hex') {
            console.error('Invalid board type:', boardObj.type);
            throw new Error('Board type must be either "rect" or "hex"');
        }

        // Set default type to 'rect' if not specified
        if (!boardObj.type) {
            boardObj.type = 'rect';
            console.log('No board type specified, defaulting to rectangular grid');
        }

        // Validate grid
        const size = boardObj.grid.length;
        const validSymbols = getSymbolsForSize(size);

        for (let i = 0; i < boardObj.grid.length; i++) {
            const row = boardObj.grid[i];

            if (!Array.isArray(row)) {
                console.error(`Row ${i} is not an array:`, row);
                throw new Error(`Invalid grid: row ${i} is not an array`);
            }

            if (row.length !== size) {
                console.error(`Row ${i} has incorrect length:`, row.length, 'expected:', size);
                throw new Error(`Invalid grid dimensions: row ${i} has length ${row.length}, expected ${size}`);
            }

            for (let j = 0; j < row.length; j++) {
                const cell = row[j];
                if (cell !== '.' && !validSymbols.includes(cell)) {
                    console.error(`Invalid symbol at [${i},${j}]:`, cell);
                    throw new Error(`Invalid symbol: ${cell} at position [${i},${j}]`);
                }
            }
        }

        return boardObj;
    } catch (error) {
        console.error('----------- PARSE CUSTOM BOARD ERROR -----------');
        console.error('Board parsing error:', error);
        console.error('Original input:', input);
        console.error('Stack trace:', error.stack);
        console.error('----------- PARSE CUSTOM BOARD ERROR END -----------');
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
            console.log('--- ADDING CUSTOM BOARD ---');
            console.log('Raw textarea input:', textarea.value);

            // Simple pre-validation to inform user before parsing fails
            if (!textarea.value.trim()) {
                throw new Error('Please enter a board configuration');
            }

            // Try to find the key if it's in property format
            const propMatch = textarea.value.trim().match(/^([a-zA-Z0-9_]+[a-zA-Z0-9_\-]*):\s*\{/);
            let customName = '';

            if (propMatch) {
                console.log('Detected property format with key:', propMatch[1]);
                customName = propMatch[1];
            }

            const boardObj = parseCustomBoard(textarea.value);
            console.log('Board parsed successfully:', boardObj);

            // Use timestamp or detected name for the custom board ID
            const id = customName ? `custom_${customName}_${Date.now()}` : `custom_${Date.now()}`;
            console.log('Generated custom board ID:', id);

            customBoards.set(id, boardObj);
            console.log('Added custom board to customBoards map');

            // Refresh board options
            const currentSize = parseInt(document.getElementById('board-size').value);
            console.log('Refreshing board options for size:', currentSize);
            populateBoardsBySize(currentSize);

            // Select the new custom board
            const targetSelect = document.getElementById(currentTarget);
            if (!targetSelect) {
                console.error(`Target select not found: ${currentTarget}`);
            } else {
                console.log(`Target select found: ${currentTarget}`);
                console.log(`Setting value to: ${id}`);
                console.log(`Dropdown options:`, Array.from(targetSelect.options).map(opt => opt.value));

                // Make sure the option exists
                let optionExists = false;
                for (let i = 0; i < targetSelect.options.length; i++) {
                    if (targetSelect.options[i].value === id) {
                        optionExists = true;
                        break;
                    }
                }

                if (!optionExists) {
                    console.error(`Option with value ${id} not found in dropdown`);
                    // Create the option if it doesn't exist
                    const newOption = document.createElement('option');
                    newOption.value = id;
                    newOption.textContent = `Custom: ${boardObj.name}`;
                    targetSelect.appendChild(newOption);
                    console.log(`Added option to dropdown`);
                }

                targetSelect.value = id;
                console.log(`Selected new custom board in dropdown: ${id}, now selected: ${targetSelect.value}`);

                // Make sure the value actually got set
                if (targetSelect.value !== id) {
                    console.error(`Failed to set dropdown value. Trying again...`);
                    setTimeout(() => {
                        targetSelect.value = id;
                        console.log(`Retry result: ${targetSelect.value}`);
                    }, 0);
                }
            }

            hideModal();
            console.log('Modal hidden');

            // Initialize boards once
            console.log('Initializing boards with new custom board');
            initializeBoards();
            console.log('--- CUSTOM BOARD ADDED SUCCESSFULLY ---');

            // Show a success toast
            showToast(`Added custom board: ${boardObj.name}`);
        } catch (error) {
            console.error('--- CUSTOM BOARD ADDITION FAILED ---');
            console.error('Error adding custom board:', error);
            console.error('Input was:', textarea.value);
            console.error('Stack trace:', error.stack);
            alert(`Error: ${error.message}`);
        }
    });
}

function disableUI() {
    // Disable all interactive elements during AI moves
    document.getElementById('start-game').disabled = true;
    document.getElementById('board-size').disabled = true;
    document.getElementById('board1-select').disabled = true;
    document.getElementById('board2-select').disabled = true;
    document.getElementById('black-player').disabled = true;
    document.getElementById('white-player').disabled = true;
    document.getElementById('starting-config').disabled = true;
    document.getElementById('superposition').disabled = true;
    document.getElementById('enable-superposition').disabled = true;
    document.getElementById('swap-rule').disabled = true;
    document.getElementById('swap-first-move').disabled = true;

    // Add visual feedback
    document.body.style.cursor = 'wait';
}

function enableUI() {
    // Re-enable all interactive elements
    document.getElementById('start-game').disabled = false;
    document.getElementById('board-size').disabled = false;
    document.getElementById('board1-select').disabled = false;
    document.getElementById('board2-select').disabled = false;
    document.getElementById('black-player').disabled = false;
    document.getElementById('white-player').disabled = false;
    document.getElementById('starting-config').disabled = false;
    document.getElementById('superposition').disabled = false;
    document.getElementById('enable-superposition').disabled = false;
    document.getElementById('swap-rule').disabled = false;
    document.getElementById('swap-first-move').disabled = false;

    // Restore normal cursor
    document.body.style.cursor = 'default';
}

function resetScorecard() {
    if (confirm('Are you sure you want to reset all solo challenge scores and achievements? This cannot be undone.')) {
        localStorage.removeItem(SCORECARD_STORAGE_KEY);
        initializeScorecard();
        showToast('Solo challenge scores have been reset');
    }
}

function updateScoreCardVisibility() {
    const blackPlayerType = document.getElementById('black-player').value;
    const whitePlayerType = document.getElementById('white-player').value;
    const isHumanVsHuman = blackPlayerType === 'human' && whitePlayerType === 'human';

    const scorecard = document.querySelector('.scorecard');
    if (scorecard) {
        scorecard.style.display = isHumanVsHuman ? '' : 'none';
    }
}

function init() {
    loadSettings();
    setupCustomBoardHandling();

    // First populate dropdowns (which sets default values)
    populatePlayerDropdowns();

    // Then set up thinking time handlers
    setupThinkingTimeHandlers();

    // Set default value for superposition input
    document.getElementById('superposition').value = 'rng,rng,rng,rng';

    // Initialize scorecard
    initializeScorecard();

    // Add reset scorecard handler
    document.getElementById('reset-scorecard').addEventListener('click', resetScorecard);

    // Add player type change handlers
    document.getElementById('black-player').addEventListener('change', updateScoreCardVisibility);
    document.getElementById('white-player').addEventListener('change', updateScoreCardVisibility);

    // Initial visibility check
    updateScoreCardVisibility();

    // Add event listener for mobile start button
    const mobileStartButton = document.getElementById('mobile-start-game');
    if (mobileStartButton) {
        mobileStartButton.addEventListener('click', function () {
            // Call the same function as the main start button
            document.getElementById('start-game').click();
        });
    }

    document.getElementById('toggle-settings').addEventListener('click', () => {
        const content = document.querySelector('.settings-content');
        const icon = document.querySelector('.toggle-icon');
        content.classList.toggle('hidden');
        icon.classList.toggle('rotated');
    });

    ['hover', 'groups', 'size', 'score', 'currentPlayer', 'icons', 'symbols', 'board-config'].forEach(setting => {
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

    // Add theme change handler
    const themeCheckbox = document.getElementById('setting-theme');
    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', (e) => {
            gameSettings.theme = e.target.checked ? 'dark' : 'light';
            saveSettings();
            applyTheme(gameSettings.theme);
        });
    }

    // Add board config visibility handler
    const boardConfigCheckbox = document.getElementById('setting-board-config');
    if (boardConfigCheckbox) {
        boardConfigCheckbox.addEventListener('change', (e) => {
            const elements = [
                'board-size',
                'board1-select',
                'custom-board1-btn',
                'board2-select',
                'custom-board2-btn',
                'starting-config',
                'superposition'
            ];

            // Hide/show the elements
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.parentElement.style.display = e.target.checked ? '' : 'none';
                }
            });

            // Hide/show the labels
            const labels = document.querySelectorAll('.field-label');
            labels.forEach(label => {
                if (label.htmlFor === 'board1-select' ||
                    label.htmlFor === 'board2-select' ||
                    label.htmlFor === 'board-size' ||
                    label.htmlFor === 'starting-config' ||
                    label.htmlFor === 'superposition') {
                    label.parentElement.style.display = e.target.checked ? '' : 'none';
                }
            });
        });

        // Set initial visibility
        boardConfigCheckbox.dispatchEvent(new Event('change'));
    }

    // Add additional bots visibility handler
    const additionalBotsCheckbox = document.getElementById('setting-additional-bots');
    if (additionalBotsCheckbox) {
        additionalBotsCheckbox.addEventListener('change', (e) => {
            const hiddenBots = [
                'deterministic',
                'random',
                'greedy',
                'greedy-some-rng',
                'defensive',
                'minimax'
            ];

            // Update both player dropdowns
            ['black-player', 'white-player'].forEach(playerId => {
                const select = document.getElementById(playerId);
                if (select) {
                    Array.from(select.options).forEach(option => {
                        if (hiddenBots.includes(option.value)) {
                            option.style.display = e.target.checked ? '' : 'none';
                        }
                    });
                }
            });
        });

        // Set initial visibility
        additionalBotsCheckbox.dispatchEvent(new Event('change'));
    }

    // Add swap button handler
    document.getElementById('swap-first-move').addEventListener('click', () => {
        if (game && game.isSwapAvailable()) {
            game.swapFirstMove();
            updateDisplay();
            makeAIMove();
        }
    });

    // Add board size change handler
    document.getElementById('board-size').addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value);
        populateBoardsBySize(newSize);
        initializeBoards();
        stopGame();
    });

    populateBoardsBySize(7);

    document.getElementById('start-game').addEventListener('click', () => {
        stopGame();
        initializeGame();

        // Switch to game tab if we're in mobile view
        if (window.innerWidth <= 1024) {
            const gameTabButton = document.querySelector('.tab-button[data-target="game-section"]');
            if (gameTabButton) {
                gameTabButton.click();
            }
        }
    });

    const settingsElements = [
        'board1-select',
        'board2-select',
        'black-player',
        'white-player',
        'starting-config',
        'superposition',
        'enable-superposition',
        'swap-rule'
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
            } else if (elementId === 'starting-config' || elementId === 'superposition' || elementId === 'enable-superposition' || elementId === 'swap-rule') {
                // For stone configurations and swap rule, restart the game immediately
                stopGame();
                initializeGame();
            } else {
                // For other settings, just stop the game
                stopGame();
            }
        });
    });

    initializeBoards();
    document.getElementById('start-game').click();

    // Setup responsive tab navigation
    setupResponsiveNavigation();

    // Setup mobile game over popup handlers
    setupMobileGameOverHandlers();
}

// Function to handle responsive tab navigation
function setupResponsiveNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const sections = document.querySelectorAll('.section');

    // Function to check if we're in mobile view
    function isMobileView() {
        return window.innerWidth <= 1024;
    }

    // Initial setup based on screen size
    function updateSectionsVisibility() {
        if (isMobileView()) {
            // In mobile view, only show the active section
            const activeButton = document.querySelector('.tab-button.active');
            if (activeButton) {
                const targetId = activeButton.getAttribute('data-target');
                sections.forEach(section => {
                    section.classList.toggle('active', section.id === targetId);
                });
            } else if (tabButtons.length > 0) {
                // If no active button, activate the Game tab by default
                const gameButton = document.querySelector('.tab-button[data-target="game-section"]');
                if (gameButton) {
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    gameButton.classList.add('active');

                    // Show game section, hide others
                    sections.forEach(section => {
                        section.classList.toggle('active', section.id === 'game-section');
                    });
                } else {
                    // Fallback to first tab if game tab not found
                    tabButtons[0].classList.add('active');
                    const firstTargetId = tabButtons[0].getAttribute('data-target');
                    document.getElementById(firstTargetId)?.classList.add('active');
                }
            }

            // Add mobile-view class to body
            document.body.classList.add('mobile-view');
        } else {
            // In desktop view, show all sections
            sections.forEach(section => {
                section.classList.add('active');
            });

            // Remove mobile-view class from body
            document.body.classList.remove('mobile-view');
        }
    }

    // Add game stats to game section for mobile view
    function moveStatsForMobile() {
        // Remove the game stats container if it exists
        const gameStatsContainer = document.getElementById('game-stats-container');
        if (gameStatsContainer) {
            gameStatsContainer.remove();
        }

        // We're no longer creating the game stats container on mobile
        // Stats will only be visible in the controls section
    }

    // Update both stats displays when they change
    const originalUpdateDisplay = updateDisplay;
    updateDisplay = function () {
        originalUpdateDisplay();

        // We no longer need to update the cloned stats since we removed the container
    };

    // Run initial setup
    updateSectionsVisibility();
    moveStatsForMobile();

    // Update on window resize
    window.addEventListener('resize', () => {
        updateSectionsVisibility();
        moveStatsForMobile();
    });

    // Handle tab button clicks
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');

            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Only change section visibility in mobile view
            if (isMobileView()) {
                // Show target section, hide others
                sections.forEach(section => {
                    if (section.id === targetId) {
                        section.classList.add('active');
                        // Scroll to top when changing tabs
                        window.scrollTo({
                            top: 0,
                            behavior: 'smooth'
                        });
                    } else {
                        section.classList.remove('active');
                    }
                });

                // Special handling for rules panel
                if (targetId === 'rules-section') {
                    document.getElementById('rules-panel').classList.remove('hidden');
                }
            }
        });
    });
}

function setupMobileGameOverHandlers() {
    const mobileGameOver = document.getElementById('mobile-game-over');
    const closeGameOver = document.getElementById('close-game-over');
    const showGameOver = document.getElementById('show-game-over');

    if (mobileGameOver && closeGameOver && showGameOver) {
        // Show popup when button is clicked
        showGameOver.addEventListener('click', () => {
            mobileGameOver.classList.add('show');
        });

        // Hide popup when close button is clicked
        closeGameOver.addEventListener('click', () => {
            mobileGameOver.classList.remove('show');
        });

        // Also hide popup when clicking outside the content
        mobileGameOver.addEventListener('click', (e) => {
            if (e.target === mobileGameOver) {
                mobileGameOver.classList.remove('show');
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', init);

// --- Tooltip positioning for help icons ---
function positionHelpTooltip(e) {
    const icon = e.currentTarget;
    const tooltipText = icon.getAttribute('data-tooltip');
    if (!tooltipText) return;

    // Force the ::after to be visible so we can measure it
    icon.classList.add('tooltip-visible');

    // Find the generated ::after element
    // We can't access pseudo-elements directly, so we create a hidden div for measurement
    let tooltipDiv = document.getElementById('help-tooltip-measure');
    if (!tooltipDiv) {
        tooltipDiv = document.createElement('div');
        tooltipDiv.id = 'help-tooltip-measure';
        tooltipDiv.style.position = 'fixed';
        tooltipDiv.style.zIndex = '9999';
        tooltipDiv.style.visibility = 'hidden';
        tooltipDiv.style.pointerEvents = 'none';
        tooltipDiv.style.padding = '8px 12px';
        tooltipDiv.style.background = getComputedStyle(document.documentElement).getPropertyValue('--theme-panel-bg');
        tooltipDiv.style.color = getComputedStyle(document.documentElement).getPropertyValue('--theme-text');
        tooltipDiv.style.fontSize = '0.8rem';
        tooltipDiv.style.borderRadius = '8px';
        tooltipDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        tooltipDiv.style.border = '1px solid ' + getComputedStyle(document.documentElement).getPropertyValue('--theme-border');
        tooltipDiv.style.boxSizing = 'border-box';
        tooltipDiv.style.width = 'max(200px, 20vw)';
        tooltipDiv.style.whiteSpace = 'normal';
        tooltipDiv.style.textAlign = 'center';
        document.body.appendChild(tooltipDiv);
    }
    tooltipDiv.textContent = tooltipText;
    tooltipDiv.style.display = 'block';

    // Get icon and tooltip sizes/positions
    const iconRect = icon.getBoundingClientRect();
    const tooltipRect = tooltipDiv.getBoundingClientRect();
    const spacing = 8;
    let top = iconRect.top - tooltipRect.height - spacing;
    let left = iconRect.left + (iconRect.width - tooltipRect.width) / 2;

    // If not enough space above, try below
    if (top < 0) {
        top = iconRect.bottom + spacing;
    }
    // If still not enough space, clamp to top
    if (top < 0) top = 0;

    // Clamp horizontally
    if (left < 0) left = spacing;
    if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - spacing;
    }

    // Set the position for the pseudo-element via CSS variables
    icon.style.setProperty('--help-tooltip-left', `${left}px`);
    icon.style.setProperty('--help-tooltip-top', `${top}px`);

    // Now, use a MutationObserver to update the ::after position
    // But since we can't move ::after, we use a global event to update its position
    // Instead, we use a global style tag to inject the position for this icon
    let styleTag = document.getElementById('help-tooltip-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'help-tooltip-style';
        document.head.appendChild(styleTag);
    }
    // Use a unique selector for this icon
    const iconId = icon.dataset.helpTooltipId || `help-tooltip-${Math.random().toString(36).slice(2)}`;
    icon.dataset.helpTooltipId = iconId;
    styleTag.textContent = `
      .help-icon[data-help-tooltip-id="${iconId}"].tooltip-visible::after {
        left: ${left}px !important;
        top: ${top}px !important;
      }
    `;

    // Clean up the measurement div
    tooltipDiv.style.display = 'none';
}

function hideHelpTooltip(e) {
    const icon = e.currentTarget;
    icon.classList.remove('tooltip-visible');
    // Remove the injected style for this icon
    const iconId = icon.dataset.helpTooltipId;
    if (iconId) {
        let styleTag = document.getElementById('help-tooltip-style');
        if (styleTag) {
            // Only clear the style if it matches this icon
            // (If you want to support multiple tooltips at once, you'd need a more robust system)
            styleTag.textContent = '';
        }
    }
    // Remove the CSS variables so ::after doesn't get left/top 0
    icon.style.removeProperty('--help-tooltip-left');
    icon.style.removeProperty('--help-tooltip-top');
}

// Attach handlers to all .help-icon elements
function setupHelpTooltips() {
    document.querySelectorAll('.help-icon').forEach(icon => {
        icon.addEventListener('mouseenter', positionHelpTooltip);
        icon.addEventListener('mouseleave', hideHelpTooltip);
        icon.addEventListener('focus', positionHelpTooltip);
        icon.addEventListener('blur', hideHelpTooltip);
    });
}

// Call after DOMContentLoaded and after any dynamic content changes
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHelpTooltips);
} else {
    setupHelpTooltips();
}
// If you dynamically add .help-icon elements elsewhere, call setupHelpTooltips() again.