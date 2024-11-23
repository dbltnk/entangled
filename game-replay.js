// game-replay.js
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
                <div class="replay-header">
                    <button id="backToResults" class="secondary-button">← Back to Results</button>
                    <h2 id="matchupTitle">Game Replay</h2>
                </div>

                <div class="replay-container">
                    <div class="boards-container">
                        <div class="board-wrapper">
                            <h3>Board 1</h3>
                            <div id="replayBoard1" class="board"></div>
                        </div>
                        <div class="board-wrapper">
                            <h3>Board 2</h3>
                            <div id="replayBoard2" class="board"></div>
                        </div>
                    </div>

                    <div class="replay-controls">
                        <div class="move-info">
                            <span id="currentMove">Move: 0/0</span>
                            <span id="currentPlayer">Current Player: Black</span>
                        </div>
                        
                        <div class="control-buttons">
                            <button id="firstMove" class="control-button">⏮</button>
                            <button id="prevMove" class="control-button">◀</button>
                            <button id="playPause" class="control-button">▶</button>
                            <button id="nextMove" class="control-button">▶</button>
                            <button id="lastMove" class="control-button">⏭</button>
                        </div>

                        <div class="clusters-info">
                            <div class="player-clusters">
                                <h4>Black Clusters:</h4>
                                <p>Board 1: <span id="blackCluster1">0</span></p>
                                <p>Board 2: <span id="blackCluster2">0</span></p>
                            </div>
                            <div class="player-clusters">
                                <h4>White Clusters:</h4>
                                <p>Board 1: <span id="whiteCluster1">0</span></p>
                                <p>Board 2: <span id="whiteCluster2">0</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize empty boards
        this.initializeBoards();
    }

    initializeBoards() {
        const board1 = this.container.querySelector('#replayBoard1');
        const board2 = this.container.querySelector('#replayBoard2');
        const symbols = this.getSymbolGrid();

        [board1, board2].forEach((board, boardIndex) => {
            board.innerHTML = '';
            const grid = symbols[boardIndex];

            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 5; col++) {
                    const cell = document.createElement('div');
                    cell.className = 'board-cell';
                    cell.dataset.symbol = grid[row][col];
                    cell.textContent = grid[row][col];
                    board.appendChild(cell);
                }
            }
        });
    }

    getSymbolGrid() {
        // Reuse the board layouts from the main game
        return [BOARD_LAYOUTS.board1, BOARD_LAYOUTS.board2];
    }

    loadGame(gameHistory, matchupInfo) {
        this.stopAutoPlay();
        this.currentGame = gameHistory;
        this.currentMoveIndex = -1;

        // Update matchup title
        this.container.querySelector('#matchupTitle').textContent =
            `${matchupInfo.player1} vs ${matchupInfo.player2}`;

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
            // Dispatch event for parent to handle navigation
            this.container.dispatchEvent(new CustomEvent('backToResults'));
        });

        // Navigation controls
        this.container.querySelector('#firstMove').addEventListener('click', () => this.goToMove(0));
        this.container.querySelector('#lastMove').addEventListener('click', () => this.goToMove(this.currentGame.length - 1));
        this.container.querySelector('#prevMove').addEventListener('click', () => this.goToMove(this.currentMoveIndex - 1));
        this.container.querySelector('#nextMove').addEventListener('click', () => this.goToMove(this.currentMoveIndex + 1));
        this.container.querySelector('#playPause').addEventListener('click', () => this.toggleAutoPlay());
    }

    goToMove(moveIndex) {
        if (!this.currentGame || moveIndex < 0 || moveIndex >= this.currentGame.length) {
            return;
        }

        this.currentMoveIndex = moveIndex;
        const gameState = this.currentGame[moveIndex].state;

        // Update boards
        this.updateBoard('#replayBoard1', gameState.board1);
        this.updateBoard('#replayBoard2', gameState.board2);

        // Update move counter
        this.updateMoveCounter();

        // Update current player
        this.container.querySelector('#currentPlayer').textContent =
            `Current Player: ${gameState.currentPlayer === 'BLACK' ? 'Black' : 'White'}`;

        // Update cluster information
        this.updateClusterInfo(gameState.largestClusters);
    }

    updateBoard(boardSelector, boardState) {
        const board = this.container.querySelector(boardSelector);
        const cells = board.getElementsByClassName('board-cell');

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const cell = cells[row * 5 + col];
                const state = boardState[row][col];

                // Reset classes
                cell.classList.remove('black-stone', 'white-stone');

                // Add appropriate class based on state
                if (state === 'BLACK') {
                    cell.classList.add('black-stone');
                } else if (state === 'WHITE') {
                    cell.classList.add('white-stone');
                }
            }
        }
    }

    updateMoveCounter() {
        const moveCounter = this.container.querySelector('#currentMove');
        if (this.currentGame) {
            moveCounter.textContent = `Move: ${this.currentMoveIndex + 1}/${this.currentGame.length}`;
        } else {
            moveCounter.textContent = 'Move: 0/0';
        }
    }

    updateClusterInfo(clusters) {
        if (!clusters) return;

        const blackClusters = clusters.black;
        const whiteClusters = clusters.white;

        this.container.querySelector('#blackCluster1').textContent = blackClusters.board1.length;
        this.container.querySelector('#blackCluster2').textContent = blackClusters.board2.length;
        this.container.querySelector('#whiteCluster1').textContent = whiteClusters.board1.length;
        this.container.querySelector('#whiteCluster2').textContent = whiteClusters.board2.length;
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