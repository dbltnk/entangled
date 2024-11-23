// game-replay.js
import BOARD_LAYOUTS from './boards.js';

class GameReplayScreen {
    constructor(containerElement) {
        this.container = containerElement;
        this.currentGame = null;
        this.currentMoveIndex = -1;
        this.autoPlayInterval = null;
        this.render();
        this.attachEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="panel replay-panel">
                <div class="replay-container">
                    <div class="replay-header">
                        <button id="backToResults" class="back-button">← Back to Results</button>
                    </div>

                    <div class="boards-container">
                        <div class="board-wrapper">
                            <div id="replayBoard1" class="board"></div>
                        </div>
                        <div class="board-wrapper">
                            <div id="replayBoard2" class="board"></div>
                        </div>
                    </div>
                </div>

                <div class="replay-controls">
                    <div class="control-group">
                        <h3>📊 Score</h3>
                        <div class="stats">
                            <div class="stats-row" id="score-display">
                                Black: 0 - White: 0
                            </div>
                            <div class="stats-row" id="current-player-display">
                                Current Player: Black
                            </div>
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>🎮 Playback Controls</h3>
                        <div id="move-counter" class="stats-row">
                            Move: 0/0
                        </div>
                        <div class="control-buttons">
                            <button id="firstMove" class="control-button" title="First Move">⏮</button>
                            <button id="prevMove" class="control-button" title="Previous Move">◀</button>
                            <button id="playPause" class="control-button" title="Play/Pause">▶</button>
                            <button id="nextMove" class="control-button" title="Next Move">▶</button>
                            <button id="lastMove" class="control-button" title="Last Move">⏭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initializeBoards();
    }

    initializeBoards() {
        const board1 = this.container.querySelector('#replayBoard1');
        const board2 = this.container.querySelector('#replayBoard2');

        [board1, board2].forEach((board, boardIndex) => {
            board.innerHTML = '';
            const grid = boardIndex === 0 ? BOARD_LAYOUTS.board1 : BOARD_LAYOUTS.board2;

            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    const cell = document.createElement('div');
                    cell.className = 'board-cell';
                    const symbol = document.createElement('span');
                    symbol.className = 'symbol';
                    symbol.textContent = grid[row][col];
                    cell.appendChild(symbol);
                    board.appendChild(cell);
                }
            }
        });
    }

    loadGame(gameHistory, matchupInfo) {
        this.stopAutoPlay();
        this.currentGame = gameHistory;
        this.currentMoveIndex = -1;

        // Reset move counter
        this.updateMoveCounter();

        // Reset boards to initial state
        this.initializeBoards();

        // Show first move
        this.goToMove(0);
    }

    attachEventListeners() {
        this.container.querySelector('#backToResults').addEventListener('click', () => {
            this.stopAutoPlay();
            this.container.dispatchEvent(new CustomEvent('backToResults'));
        });

        // Navigation controls
        this.container.querySelector('#firstMove').addEventListener('click', () => this.goToMove(0));
        this.container.querySelector('#lastMove').addEventListener('click', () =>
            this.goToMove(this.currentGame.length - 1));
        this.container.querySelector('#prevMove').addEventListener('click', () =>
            this.goToMove(this.currentMoveIndex - 1));
        this.container.querySelector('#nextMove').addEventListener('click', () =>
            this.goToMove(this.currentMoveIndex + 1));
        this.container.querySelector('#playPause').addEventListener('click', () =>
            this.toggleAutoPlay());
    }

    goToMove(moveIndex) {
        if (!this.currentGame || moveIndex < 0 || moveIndex >= this.currentGame.length) {
            return;
        }

        this.currentMoveIndex = moveIndex;
        const gameState = this.currentGame[moveIndex].state;

        // Update boards
        this.updateBoard('#replayBoard1', gameState.board1, gameState.largestClusters);
        this.updateBoard('#replayBoard2', gameState.board2, gameState.largestClusters);

        // Update move counter
        this.updateMoveCounter();

        // Update current player
        this.updateCurrentPlayer(gameState.currentPlayer);

        // Update scores
        this.updateScores(gameState.largestClusters);

        // Update navigation buttons
        this.updateNavigationButtons();
    }

    updateBoard(boardSelector, boardState, clusters) {
        const board = this.container.querySelector(boardSelector);
        const cells = board.getElementsByClassName('board-cell');
        const isBoard1 = boardSelector === '#replayBoard1';

        // Get cluster cells for current player
        const currentPlayer = this.currentGame[this.currentMoveIndex].state.currentPlayer;
        const playerClusters = clusters[currentPlayer.toLowerCase()];
        const boardClusters = isBoard1 ? playerClusters.board1 : playerClusters.board2;

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const cell = cells[row * 5 + col];
                const state = boardState[row][col];

                // Reset classes
                cell.classList.remove('black-stone', 'white-stone', 'in-largest-cluster');

                // Add stone class if present
                if (state === 'BLACK') {
                    cell.classList.add('black-stone');
                } else if (state === 'WHITE') {
                    cell.classList.add('white-stone');
                }

                // Add largest cluster highlight if cell is part of it
                if (boardClusters.some(pos => pos.row === row && pos.col === col)) {
                    cell.classList.add('in-largest-cluster');
                }
            }
        }
    }

    updateMoveCounter() {
        const moveCounter = this.container.querySelector('#move-counter');
        if (this.currentGame) {
            moveCounter.textContent = `Move: ${this.currentMoveIndex + 1}/${this.currentGame.length}`;
        } else {
            moveCounter.textContent = 'Move: 0/0';
        }
    }

    updateCurrentPlayer(player) {
        const playerDisplay = this.container.querySelector('#current-player-display');
        playerDisplay.textContent = `Current Player: ${player.charAt(0) + player.slice(1).toLowerCase()}`;
    }

    updateScores(clusters) {
        if (!clusters) return;

        const blackTotal = clusters.black.board1.length + clusters.black.board2.length;
        const whiteTotal = clusters.white.board1.length + clusters.white.board2.length;
        this.container.querySelector('#score-display').textContent =
            `Black: ${blackTotal} - White: ${whiteTotal}`;
    }

    updateNavigationButtons() {
        const firstButton = this.container.querySelector('#firstMove');
        const prevButton = this.container.querySelector('#prevMove');
        const nextButton = this.container.querySelector('#nextMove');
        const lastButton = this.container.querySelector('#lastMove');

        firstButton.disabled = this.currentMoveIndex <= 0;
        prevButton.disabled = this.currentMoveIndex <= 0;
        nextButton.disabled = this.currentMoveIndex >= this.currentGame.length - 1;
        lastButton.disabled = this.currentMoveIndex >= this.currentGame.length - 1;
    }

    toggleAutoPlay() {
        const playPauseButton = this.container.querySelector('#playPause');

        if (this.autoPlayInterval) {
            this.stopAutoPlay();
        } else {
            this.startAutoPlay();
        }

        playPauseButton.textContent = this.autoPlayInterval ? '⏸' : '▶';
    }

    startAutoPlay() {
        if (this.autoPlayInterval) return;

        this.autoPlayInterval = setInterval(() => {
            if (this.currentMoveIndex >= this.currentGame.length - 1) {
                this.stopAutoPlay();
                return;
            }
            this.goToMove(this.currentMoveIndex + 1);
        }, 1000);
    }

    stopAutoPlay() {
        if (this.autoPlayInterval) {
            clearInterval(this.autoPlayInterval);
            this.autoPlayInterval = null;
            this.container.querySelector('#playPause').textContent = '▶';
        }
    }
}

export { GameReplayScreen };