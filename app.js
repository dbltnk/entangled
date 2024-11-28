import BOARD_LAYOUTS from './boards.js';
import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer, AI_PLAYERS } from './players.js';
import { GameController } from './game-controller.js';

let game = null;
let currentRandomBoards = {
    board1: null,
    board2: null
};

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
}

function populateBoardDropdowns() {
    const board1Select = document.getElementById('board1-select');
    const board2Select = document.getElementById('board2-select');

    board1Select.innerHTML = '';
    board2Select.innerHTML = '';

    Object.entries(BOARD_LAYOUTS).forEach(([id, layout]) => {
        const option = new Option(layout.name, id);
        board1Select.add(option.cloneNode(true));
        board2Select.add(option.cloneNode(true));
    });

    board1Select.value = 'board1';
    board2Select.value = 'board2';
}

function getSelectedBoardLayout(boardSelect) {
    const selectedValue = boardSelect.value;
    if (selectedValue === 'random') {
        if (!currentRandomBoards[boardSelect.id]) {
            currentRandomBoards[boardSelect.id] = BOARD_LAYOUTS.random.grid;
        }
        return currentRandomBoards[boardSelect.id];
    }
    return BOARD_LAYOUTS[selectedValue].grid;
}

const uniqueColors = {};

function generateColorForLetter(index, total) {
    const hue = (index / total) * 360;
    const saturation = 70;
    const lightness = 50;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function assignRandomUniqueColor(letterElement) {
    const letter = letterElement.textContent.toUpperCase();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    if (!uniqueColors[letter]) {
        const index = alphabet.indexOf(letter);
        if (index !== -1) {
            uniqueColors[letter] = generateColorForLetter(index, 25);
        } else {
            uniqueColors[letter] = '#000000';
        }
    }

    letterElement.style.color = uniqueColors[letter];
}

function createCell(symbol, boardNum, row, col) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.symbol = symbol;
    cell.dataset.board = boardNum;
    cell.dataset.row = row;
    cell.dataset.col = col;

    const letter = document.createElement('div');
    letter.className = 'cell-letter';
    letter.textContent = symbol;
    assignRandomUniqueColor(letter);
    cell.appendChild(letter);

    cell.addEventListener('mouseenter', () => highlightCorrespondingCells(symbol));
    cell.addEventListener('mouseleave', () => removeHighlights());
    cell.addEventListener('click', () => handleCellClick(symbol));

    return cell;
}

function createGroupSizeElement(size, isBlackStone) {
    const sizeElement = document.createElement('div');
    sizeElement.className = `group-size ${isBlackStone ? 'on-black' : ''}`;
    sizeElement.textContent = size;
    return sizeElement;
}

function calculateClusterPosition(cluster, boardElement) {
    const centralStone = game.findMostConnectedCell(cluster);
    if (!centralStone) return null;

    const cell = boardElement.children[centralStone.row * 5 + centralStone.col];
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

    cell.classList.remove('cell-highlight-black', 'cell-highlight-white');

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

function initializeBoards() {
    const board1Element = document.getElementById('board1');
    const board2Element = document.getElementById('board2');
    const board1Select = document.getElementById('board1-select');
    const board2Select = document.getElementById('board2-select');

    const board1Layout = getSelectedBoardLayout(board1Select);
    const board2Layout = getSelectedBoardLayout(board2Select);

    board1Element.innerHTML = '';
    board2Element.innerHTML = '';

    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const cell1 = createCell(board1Layout[i][j], 1, i, j);
            const cell2 = createCell(board2Layout[i][j], 2, i, j);

            board1Element.appendChild(cell1);
            board2Element.appendChild(cell2);
        }
    }
}

function highlightCorrespondingCells(symbol) {
    const cells = document.querySelectorAll(`.cell[data-symbol="${symbol}"]`);
    cells.forEach(cell => cell.classList.add('highlighted'));
}

function removeHighlights() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.remove('highlighted'));
}

function updateCell(boardNum, row, col, player) {
    const cell = document.querySelector(
        `.cell[data-board="${boardNum}"][data-row="${row}"][data-col="${col}"]`
    );

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

    document.getElementById('score-display').innerHTML =
        `<strong>⚫ ${blackScore}</strong> (${blackBoard1Score} + ${blackBoard2Score}) vs <strong>⚪ ${whiteScore}</strong> (${whiteBoard1Score} + ${whiteBoard2Score})`;

    document.getElementById('current-player-display').textContent =
        `Current player: ${state.currentPlayer === PLAYERS.BLACK ? '⚫ Black' : '⚪ White'}`;

    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
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
    if (!game || game.isGameOver()) return;

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
    if (!game || game.isGameOver()) return;

    const currentPlayer = game.getCurrentPlayer();
    const playerType = document.getElementById(`${currentPlayer.toLowerCase()}-player`).value;

    if (playerType !== 'human') {
        setTimeout(() => {
            const ai = createPlayer(playerType, game, currentPlayer);
            if (ai) {
                const move = ai.chooseMove();
                if (move) {
                    game.makeMove(move);
                    updateDisplay();

                    if (game.isGameOver()) {
                        showWinner(game.getWinner());
                    } else {
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
    populatePlayerDropdowns();
    populateBoardDropdowns();
    initializeBoards();

    document.getElementById('start-game').addEventListener('click', initializeGame);

    document.getElementById('board1-select').addEventListener('change', () => {
        const board1Select = document.getElementById('board1-select');
        if (board1Select.value === 'random') {
            currentRandomBoards.board1 = null;
        }
        initializeBoards();
    });

    document.getElementById('board2-select').addEventListener('change', () => {
        const board2Select = document.getElementById('board2-select');
        if (board2Select.value === 'random') {
            currentRandomBoards.board2 = null;
        }
        initializeBoards();
    });

    initializeGame();
}

window.addEventListener('load', init);