import { EntangledGame } from './gameplay.js';

class GameReplay {
    constructor() {
        this.currentMoveIndex = 0;
        this.history = [];
        this.matchInfo = {};
        this.boardSize = 5;
        this.setupEventListeners();
    }

    initialize(data) {
        this.matchInfo = data.matchInfo;
        this.boardSize = data.boardSize;

        // Handle both full state history and move-only history
        if (data.history && Array.isArray(data.history) && data.history[0].board1) {
            // Full state history from live tournament
            this.history = data.history;
        } else if (data.moves || (data.history && Array.isArray(data.history) && typeof data.history[0] === 'string')) {
            // Move-only history from saved tournament, reconstruct states
            this.reconstructHistory({
                moves: data.moves || data.history,
                board1Layout: data.board1Layout,
                board2Layout: data.board2Layout,
                initialConfig: data.initialConfig
            });
        }

        this.initializeUI();
        this.renderState(0);
    }

    reconstructHistory(data) {
        const game = new EntangledGame(data.board1Layout, data.board2Layout, data.initialConfig);

        // Initialize history with starting state
        this.history = [{
            move: null,
            board1: game.getBoard1(),
            board2: game.getBoard2(),
            currentPlayer: game.getCurrentPlayer(),
            blackScore: game.getScore('BLACK'),
            whiteScore: game.getScore('WHITE'),
            largestClusters: game.getGameState().largestClusters,
            board1Layout: data.board1Layout,
            board2Layout: data.board2Layout
        }];

        // Replay each move and record state
        for (const move of data.moves) {
            game.makeMove(move);
            const state = game.getGameState();

            this.history.push({
                move,
                board1: game.getBoard1(),
                board2: game.getBoard2(),
                currentPlayer: state.currentPlayer,
                blackScore: game.getScore('BLACK'),
                whiteScore: game.getScore('WHITE'),
                largestClusters: state.largestClusters,
                board1Layout: data.board1Layout,
                board2Layout: data.board2Layout
            });
        }
    }

    initializeUI() {
        document.title = `Game Replay - ${this.matchInfo.black} vs ${this.matchInfo.white}`;

        const playersInfo = document.getElementById('players-info');
        playersInfo.textContent = `⚫ ${this.matchInfo.black} vs ⚪ ${this.matchInfo.white}`;

        const boardInfo = document.getElementById('board-info');
        boardInfo.textContent = `Board 1: ${this.matchInfo.board1Name} | Board 2: ${this.matchInfo.board2Name} | Starting: ${this.matchInfo.startingConfig}`;

        const board1 = document.getElementById('board1');
        const board2 = document.getElementById('board2');
        board1.className = `board board-${this.boardSize}`;
        board2.className = `board board-${this.boardSize}`;

        this.initializeBoards();
    }

    initializeBoards() {
        const board1 = document.getElementById('board1');
        const board2 = document.getElementById('board2');
        board1.innerHTML = '';
        board2.innerHTML = '';

        // Set grid templates
        board1.style.gridTemplateRows = `repeat(${this.boardSize}, 1fr)`;
        board1.style.gridTemplateColumns = `repeat(${this.boardSize}, 1fr)`;
        board2.style.gridTemplateRows = `repeat(${this.boardSize}, 1fr)`;
        board2.style.gridTemplateColumns = `repeat(${this.boardSize}, 1fr)`;

        // Create cells (skipping dots)
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.history[0].board1Layout[i][j] !== '.') {
                    const cell1 = this.createCell(1, i, j);
                    board1.appendChild(cell1);
                }
                if (this.history[0].board2Layout[i][j] !== '.') {
                    const cell2 = this.createCell(2, i, j);
                    board2.appendChild(cell2);
                }
            }
        }
    }

    createCell(boardNum, row, col) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.board = boardNum;
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.style.setProperty('--grid-row', row + 1);
        cell.style.setProperty('--grid-column', col + 1);

        const letter = document.createElement('div');
        letter.className = 'cell-letter';
        letter.textContent = boardNum === 1 ?
            this.history[0].board1Layout[row][col] :
            this.history[0].board2Layout[row][col];
        cell.appendChild(letter);

        return cell;
    }

    setupEventListeners() {
        document.getElementById('first-move')?.addEventListener('click', () => this.renderState(0));
        document.getElementById('prev-move')?.addEventListener('click', () => this.prevMove());
        document.getElementById('next-move')?.addEventListener('click', () => this.nextMove());
        document.getElementById('last-move')?.addEventListener('click', () =>
            this.renderState(this.history.length - 1));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.prevMove();
            if (e.key === 'ArrowRight') this.nextMove();
            if (e.key === 'Home') this.renderState(0);
            if (e.key === 'End') this.renderState(this.history.length - 1);
        });
    }

    prevMove() {
        if (this.currentMoveIndex > 0) {
            this.renderState(this.currentMoveIndex - 1);
        }
    }

    nextMove() {
        if (this.currentMoveIndex < this.history.length - 1) {
            this.renderState(this.currentMoveIndex + 1);
        }
    }

    updateCell(boardNum, row, col, player) {
        const cell = document.querySelector(
            `.cell[data-board="${boardNum}"][data-row="${row}"][data-col="${col}"]`
        );
        if (!cell) return;  // Skip if cell is a dot position

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

    updateCellHighlights(boardNum, row, col, largestClusters) {
        const cell = document.querySelector(
            `.cell[data-board="${boardNum}"][data-row="${row}"][data-col="${col}"]`
        );
        if (!cell) return;  // Skip if cell is a dot position

        cell.classList.remove('cell-highlight-black', 'cell-highlight-white');

        const isInBlackCluster = largestClusters.black[`board${boardNum}`]
            ?.some(pos => pos.row === row && pos.col === col);
        if (isInBlackCluster) {
            cell.classList.add('cell-highlight-black');
        }

        const isInWhiteCluster = largestClusters.white[`board${boardNum}`]
            ?.some(pos => pos.row === row && pos.col === col);
        if (isInWhiteCluster) {
            cell.classList.add('cell-highlight-white');
        }
    }

    updateGroupSizes(boardElement, clusters, isBoard1) {
        const existingSizes = boardElement.querySelectorAll('.group-size');
        existingSizes.forEach(el => el.remove());

        const blackCluster = clusters.black[isBoard1 ? 'board1' : 'board2'];
        const whiteCluster = clusters.white[isBoard1 ? 'board1' : 'board2'];

        if (blackCluster?.length >= 2) {
            this.addGroupSizeIndicator(boardElement, blackCluster, true);
        }
        if (whiteCluster?.length >= 2) {
            this.addGroupSizeIndicator(boardElement, whiteCluster, false);
        }
    }

    addGroupSizeIndicator(boardElement, cluster, isBlack) {
        const centralStone = this.findMostConnectedCell(cluster);
        if (!centralStone) return;

        const cell = boardElement.querySelector(
            `.cell[data-board="${boardElement.id === 'board1' ? '1' : '2'}"][data-row="${centralStone.row}"][data-col="${centralStone.col}"]`
        );
        if (!cell) return;

        const rect = cell.getBoundingClientRect();
        const boardRect = boardElement.getBoundingClientRect();

        const sizeElement = document.createElement('div');
        sizeElement.className = `group-size ${isBlack ? 'on-black' : ''}`;
        sizeElement.textContent = cluster.length;
        sizeElement.style.left = `${rect.left - boardRect.left + (rect.width / 2)}px`;
        sizeElement.style.top = `${rect.top - boardRect.top + (rect.height / 2)}px`;
        boardElement.appendChild(sizeElement);
    }

    findMostConnectedCell(cluster) {
        if (!cluster || cluster.length === 0) return null;

        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        let bestCell = null;
        let maxConnections = -1;

        for (const cell of cluster) {
            let connections = 0;
            for (const [dRow, dCol] of directions) {
                const newRow = cell.row + dRow;
                const newCol = cell.col + dCol;
                if (cluster.some(c => c.row === newRow && c.col === newCol)) {
                    connections++;
                }
            }
            if (connections > maxConnections) {
                maxConnections = connections;
                bestCell = cell;
            }
        }

        return bestCell;
    }

    renderState(index) {
        if (!this.history || index < 0 || index >= this.history.length) return;

        this.currentMoveIndex = index;
        const state = this.history[index];
        const board1Element = document.getElementById('board1');
        const board2Element = document.getElementById('board2');

        // Update boards
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (state.board1Layout[i][j] !== '.') {
                    this.updateCell(1, i, j, state.board1[i][j]);
                    this.updateCellHighlights(1, i, j, state.largestClusters);
                }
                if (state.board2Layout[i][j] !== '.') {
                    this.updateCell(2, i, j, state.board2[i][j]);
                    this.updateCellHighlights(2, i, j, state.largestClusters);
                }
            }
        }

        // Update group sizes
        this.updateGroupSizes(board1Element, state.largestClusters, true);
        this.updateGroupSizes(board2Element, state.largestClusters, false);

        // Update move counter
        const moveCounter = document.getElementById('move-count');
        if (moveCounter) {
            moveCounter.textContent = `Move ${index}/${this.history.length - 1}`;
        }

        // Update score
        const scoreDisplay = document.getElementById('score-display');
        if (scoreDisplay) {
            scoreDisplay.textContent = `⚫ ${state.blackScore} vs ⚪ ${state.whiteScore}`;
        }

        // Update current player/winner
        const currentPlayerDisplay = document.getElementById('current-player-display');
        if (currentPlayerDisplay) {
            if (index < this.history.length - 1) {
                currentPlayerDisplay.textContent =
                    `Current player: ${state.currentPlayer === 'BLACK' ? '⚫ Black' : '⚪ White'}`;
            } else {
                const winner = state.blackScore > state.whiteScore ? '⚫ Black wins!' :
                    state.whiteScore > state.blackScore ? '⚪ White wins!' :
                        'Draw!';
                currentPlayerDisplay.textContent = winner;
            }
        }

        // Update button states
        if (document.getElementById('first-move')) {
            document.getElementById('first-move').disabled = index === 0;
            document.getElementById('prev-move').disabled = index === 0;
            document.getElementById('next-move').disabled = index === this.history.length - 1;
            document.getElementById('last-move').disabled = index === this.history.length - 1;
        }
    }
}

// Make initialization function available globally
window.initializeReplay = function (data) {
    window.gameReplay = new GameReplay();
    window.gameReplay.initialize(data);
};

// Initialize empty replay if opened directly
window.addEventListener('load', () => {
    if (!window.gameReplay) {
        window.gameReplay = new GameReplay();
    }
});