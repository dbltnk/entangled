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
    symbols: false,
    cutcake: true,
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
        7: ['donutleft', 'board2494836417right']
    };

    const defaultConfigs = {
        4: '',
        5: '',
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
        let displayText = `Current player: ${state.currentPlayer === PLAYERS.BLACK ? '⚫ Black' : '⚪ White'}`;

        // Add swap colors button if available
        if (gameSettings.cutcake && state.canSwapColors) {
            displayText += ' <button id="swap-colors" class="swap-colors-btn">Swap Colors</button>';
        }

        currentPlayerDisplay.innerHTML = displayText;

        // Add event listener for swap colors button if it exists
        const swapButton = document.getElementById('swap-colors');
        if (swapButton) {
            swapButton.addEventListener('click', () => {
                try {
                    game.swapColors();
                    // Show temporary notification with the swap-yes style
                    const notification = document.createElement('div');
                    notification.className = 'swap-notification-overlay swap-yes';
                    notification.textContent = '🔄 Colors Swapped!';
                    document.body.appendChild(notification);
                    setTimeout(() => notification.remove(), 2000);

                    updateDisplay();
                    makeAIMove();
                } catch (error) {
                    console.error('Error swapping colors:', error);
                    swapButton.remove();
                }
            });
        }
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

            const cutcakeEnabled = document.getElementById('setting-cutcake').checked;
            const ai = createPlayer(playerType, game, currentPlayer);
            if (ai) {
                try {
                    // Show consideration notification if AI can swap and cut-cake is enabled
                    if (game.getGameState().canSwapColors && cutcakeEnabled) {
                        const considerNotification = document.createElement('div');
                        considerNotification.className = 'swap-notification-overlay swap-consider';
                        considerNotification.textContent = '🤖 AI is considering color swap...';
                        document.body.appendChild(considerNotification);

                        // Remove the consideration notification after 1 second
                        setTimeout(() => {
                            considerNotification.remove();
                            // Then make the decision
                            const move = ai.chooseMove();
                            if (move === 'swap' && cutcakeEnabled) {
                                const wasSwapped = !game.getGameState().colorsSwapped;
                                game.swapColors();
                                if (wasSwapped) {
                                    const notification = document.createElement('div');
                                    notification.className = 'swap-notification-overlay swap-yes';
                                    notification.textContent = '🔄 AI chose to swap colors!';
                                    document.body.appendChild(notification);
                                    setTimeout(() => notification.remove(), 2000);
                                }
                                updateDisplay();
                                makeAIMove();
                            } else if (move && game) {
                                if (game.getGameState().canSwapColors && cutcakeEnabled) {
                                    const notification = document.createElement('div');
                                    notification.className = 'swap-notification-overlay swap-no';
                                    notification.textContent = '🤖 AI decided not to swap';
                                    document.body.appendChild(notification);
                                    setTimeout(() => notification.remove(), 2000);
                                }
                                game.makeMove(move);
                                updateDisplay();

                                if (game && game.isGameOver()) {
                                    showWinner(game.getWinner());
                                } else if (game) {
                                    makeAIMove();
                                }
                            }
                        }, 1000);
                    } else {
                        // Regular move without swap consideration
                        const move = ai.chooseMove();
                        if (move && game) {
                            if (move !== 'swap') {  // Ignore swap moves if cut-cake is disabled
                                game.makeMove(move);
                                updateDisplay();

                                if (game && game.isGameOver()) {
                                    showWinner(game.getWinner());
                                } else if (game) {
                                    makeAIMove();
                                }
                            } else {
                                // If AI tries to swap but it's disabled, make them choose a regular move instead
                                const validMoves = game.getValidMoves();
                                if (validMoves.length > 0) {
                                    game.makeMove(validMoves[0]);
                                    updateDisplay();
                                    if (game && !game.isGameOver()) {
                                        makeAIMove();
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error during AI move:', error);
                    updateDisplay();
                }
            }
        }, 10);
    }
}

function initializeGame() {
    const board1Select = document.getElementById('board1-select');
    const board2Select = document.getElementById('board2-select');
    const rawConfig = document.getElementById('starting-config').value;
    const cutcakeEnabled = document.getElementById('setting-cutcake').checked;

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

    // Pass cutcakeEnabled as the fourth parameter (enableTieBreaker)
    game = new EntangledGame(board1Layout, board2Layout, startingConfig, cutcakeEnabled);

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

    ['hover', 'groups', 'size', 'score', 'currentPlayer', 'icons', 'symbols', 'cutcake'].forEach(setting => {
        const checkbox = document.getElementById(`setting-${setting}`);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                gameSettings[setting] = e.target.checked;
                saveSettings();
                if (setting === 'cutcake' && game) {
                    game.canSwapColors = e.target.checked &&
                        game.playerTurns[PLAYERS.BLACK] === 1 &&
                        game.playerTurns[PLAYERS.WHITE] === 0 &&
                        !game.colorsSwapped;
                }
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