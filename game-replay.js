// game-replay.js
import BOARD_LAYOUTS from './boards.js';

class GameReplayScreen {
    constructor(containerElement) {
        this.container = containerElement;
        this.currentGame = null;
        this.currentMoveIndex = -1;
        this.matchupInfo = null;
        this.render();
        this.attachEventListeners();
    }

    initializeBoards() {
        const board1 = this.container.querySelector('#replayBoard1');
        const board2 = this.container.querySelector('#replayBoard2');

        [board1, board2].forEach((board, boardIndex) => {
            board.innerHTML = '';
            let grid;

            // Determine which board layout to use
            if (this.currentGame && this.currentGame[0]?.state?.boardConfig) {
                // Use the specified board layouts from the game state
                const layoutKey = boardIndex === 0 ?
                    this.currentGame[0].state.boardConfig.board1Layout :
                    this.currentGame[0].state.boardConfig.board2Layout;
                grid = BOARD_LAYOUTS[layoutKey]?.grid || BOARD_LAYOUTS[boardIndex === 0 ? 'board1' : 'board2'].grid;
            } else {
                // Fallback to default boards
                grid = BOARD_LAYOUTS[boardIndex === 0 ? 'board1' : 'board2'].grid;
            }

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
                        <h3>Players</h3>
                        <div class="stats">
                            <div class="player-info">
                                <div class="player-color black"></div>
                                <div class="player-strategy" id="black-strategy">Black: -</div>
                            </div>
                            <div class="player-info">
                                <div class="player-color white"></div>
                                <div class="player-strategy" id="white-strategy">White: -</div>
                            </div>
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>📊 Score</h3>
                        <div class="stats">
                            <div class="stats-row" id="score-display">
                                Black: 0 - White: 0
                            </div>
                            <div class="stats-row" id="current-player-display">
                                Current Player: Black
                            </div>
                            <div class="winner-display" id="winner-display" style="display: none;"></div>
                        </div>
                    </div>

                    <div class="control-group">
                        <h3>🎮 Navigation</h3>
                        <div id="move-counter" class="stats-row">
                            Move: 0/0
                        </div>
                        <div class="control-buttons">
                            <button id="firstMove" class="control-button" title="First Move">⏮</button>
                            <button id="prevMove" class="control-button" title="Previous Move">◀</button>
                            <button id="nextMove" class="control-button" title="Next Move">▶</button>
                            <button id="lastMove" class="control-button" title="Last Move">⏭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initializeBoards();
    }

    loadGame(gameHistory, matchupInfo) {
        this.currentGame = gameHistory;
        this.currentMoveIndex = -1;
        this.matchupInfo = matchupInfo;

        // Update player info
        this.container.querySelector('#black-strategy').textContent = `Black: ${matchupInfo.player1}`;
        this.container.querySelector('#white-strategy').textContent = `White: ${matchupInfo.player2}`;

        // Reset move counter
        this.updateMoveCounter();

        // Reset boards to initial state
        this.initializeBoards();

        // Show first move
        this.goToMove(0);
    }

    attachEventListeners() {
        this.container.querySelector('#backToResults').addEventListener('click', () => {
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

        // Update scores and winner
        this.updateScores(gameState.largestClusters);

        // Update winner display on last move
        if (moveIndex === this.currentGame.length - 1) {
            const blackScore = parseInt(gameState.largestClusters.black.board1.length) +
                parseInt(gameState.largestClusters.black.board2.length);
            const whiteScore = parseInt(gameState.largestClusters.white.board1.length) +
                parseInt(gameState.largestClusters.white.board2.length);

            const winnerDisplay = this.container.querySelector('#winner-display');
            winnerDisplay.style.display = 'block';

            if (blackScore > whiteScore) {
                winnerDisplay.textContent = '🏆 Black Wins!';
            } else if (whiteScore > blackScore) {
                winnerDisplay.textContent = '🏆 White Wins!';
            } else {
                winnerDisplay.textContent = '🤝 Game is a Draw!';
            }
        } else {
            this.container.querySelector('#winner-display').style.display = 'none';
        }

        // Update navigation buttons
        this.updateNavigationButtons();
    }

    updateBoard(boardSelector, boardState, clusters) {
        const board = this.container.querySelector(boardSelector);
        const cells = board.getElementsByClassName('board-cell');
        const isBoard1 = boardSelector === '#replayBoard1';

        // Get cluster cells for both players
        const blackClusters = clusters.black;
        const whiteClusters = clusters.white;
        const boardClusters = {
            BLACK: isBoard1 ? blackClusters.board1 : blackClusters.board2,
            WHITE: isBoard1 ? whiteClusters.board1 : whiteClusters.board2
        };

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const cell = cells[row * 5 + col];
                const state = boardState[row][col];

                // Reset classes
                cell.classList.remove('black-stone', 'white-stone', 'in-largest-cluster');

                // Add stone class if present
                if (state === 'BLACK' || state === 'WHITE') {
                    cell.classList.add(state.toLowerCase() + '-stone');

                    // Check if this cell is part of the largest cluster for its color
                    const playerClusters = boardClusters[state];
                    if (playerClusters.some(pos => pos.row === row && pos.col === col)) {
                        cell.classList.add('in-largest-cluster');
                    }
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
            `Black: ${blackTotal} - White:${whiteTotal}`;
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
}

export { GameReplayScreen };