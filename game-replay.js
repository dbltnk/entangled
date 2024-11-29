// game-replay.js
import BOARD_LAYOUTS from './boards.js';

// Map to store unique colors for letters
const uniqueColors = {};

// Function to generate evenly spaced colors with good contrast
function generateColorForLetter(index, total) {
    const hue = (index / total) * 360; // Evenly spaced hues
    const saturation = 70; // High saturation for vivid colors
    const lightness = 50; // Moderate lightness for good contrast on white
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Function to assign an evenly spaced color with good contrast to a letter element
function assignRandomUniqueColor(letterElement) {
    const letter = letterElement.textContent.toUpperCase();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=/?!~';

    if (!uniqueColors[letter]) {
        const index = alphabet.indexOf(letter);
        if (index !== -1) {
            uniqueColors[letter] = generateColorForLetter(index, alphabet.length);
        } else {
            uniqueColors[letter] = '#000000';
        }
    }

    letterElement.style.color = uniqueColors[letter];
}

class GameReplayScreen {
    constructor(containerElement) {
        this.container = containerElement;
        this.currentGame = null;
        this.currentMoveIndex = -1;
        this.matchupInfo = null;
        this.boardSize = 5; // Default size
        this.render();
        this.attachEventListeners();
    }

    createCell(symbol, boardNum, row, col) {
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

        return cell;
    }

    createGroupSizeElement(size, isBlackStone) {
        const sizeElement = document.createElement('div');
        sizeElement.className = `group-size ${isBlackStone ? 'on-black' : ''}`;
        sizeElement.textContent = size;
        return sizeElement;
    }

    calculateClusterPosition(cluster, boardElement) {
        if (!cluster || cluster.length === 0) return null;

        // Find most connected cell manually
        let bestCell = null;
        let maxConnections = -1;
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

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

        if (!bestCell) return null;

        const cell = boardElement.children[bestCell.row * this.boardSize + bestCell.col];
        const rect = cell.getBoundingClientRect();
        const boardRect = boardElement.getBoundingClientRect();

        return {
            left: rect.left - boardRect.left + (rect.width / 2),
            top: rect.top - boardRect.top + (rect.height / 2)
        };
    }

    updateGroupSizes(boardElement, clusters, isBoard1) {
        const existingSizes = boardElement.querySelectorAll('.group-size');
        existingSizes.forEach(el => el.remove());

        const blackCluster = clusters.black[isBoard1 ? 'board1' : 'board2'];
        const whiteCluster = clusters.white[isBoard1 ? 'board1' : 'board2'];

        if (blackCluster.length >= 2) {
            const pos = this.calculateClusterPosition(blackCluster, boardElement);
            if (pos) {
                const sizeElement = this.createGroupSizeElement(blackCluster.length, true);
                sizeElement.style.left = `${pos.left}px`;
                sizeElement.style.top = `${pos.top}px`;
                boardElement.appendChild(sizeElement);
            }
        }

        if (whiteCluster.length >= 2) {
            const pos = this.calculateClusterPosition(whiteCluster, boardElement);
            if (pos) {
                const sizeElement = this.createGroupSizeElement(whiteCluster.length, false);
                sizeElement.style.left = `${pos.left}px`;
                sizeElement.style.top = `${pos.top}px`;
                boardElement.appendChild(sizeElement);
            }
        }
    }

    initializeBoards() {
        const board1 = this.container.querySelector('#replayBoard1');
        const board2 = this.container.querySelector('#replayBoard2');

        [board1, board2].forEach((board, boardIndex) => {
            board.innerHTML = '';
            // Set the board size class
            board.className = `board board-${this.boardSize}`;

            let grid;

            // Determine which board layout to use
            if (this.currentGame && this.currentGame[0]?.state?.boardConfig) {
                // Use the specified board layouts from the game state
                const layoutKey = boardIndex === 0 ?
                    this.currentGame[0].state.boardConfig.board1Layout :
                    this.currentGame[0].state.boardConfig.board2Layout;

                // Handle both fixed and random layouts
                if (layoutKey.startsWith('random')) {
                    // For random boards, use the actual board state since it's already generated
                    grid = this.currentGame[0].state[`board${boardIndex + 1}`].map(row =>
                        row.map(() => this.getNextRandomSymbol())
                    );
                } else {
                    grid = BOARD_LAYOUTS[layoutKey]?.grid || BOARD_LAYOUTS[boardIndex === 0 ? 'board1' : 'board2'].grid;
                }
            } else {
                // Fallback to default boards
                grid = BOARD_LAYOUTS[boardIndex === 0 ? 'board1' : 'board2'].grid;
            }

            for (let row = 0; row < this.boardSize; row++) {
                for (let col = 0; col < this.boardSize; col++) {
                    const cell = this.createCell(grid[row][col], boardIndex + 1, row, col);
                    board.appendChild(cell);
                }
            }
        });
    }

    // Get next available symbol for random boards
    getNextRandomSymbol() {
        const symbolSets = {
            4: 'ABCDEFGHIJKLMNOP',
            5: 'ABCDEFGHIJKLMNOPQRSTUVWXY',
            6: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            7: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=/?!~'
        };
        const symbols = symbolSets[this.boardSize].split('');
        return symbols[Math.floor(Math.random() * symbols.length)];
    }

    render() {
        this.container.innerHTML = `
            <div class="panel replay-panel">
                <div class="navigation panel">
                    <div class="navigation-header">
                        <button id="backToResults" class="back-button">← Back to Results</button>
                    </div>
                    <div class="control-group">
                        <h3><span>🎮</span> Navigation</h3>
                        <div class="nav-content">
                            <div id="move-counter" class="move-counter">
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

                <div class="boards panel">
                    <div class="board-container">
                        <div id="replayBoard1" class="board"></div>
                    </div>
                    <div class="board-container">
                        <div id="replayBoard2" class="board"></div>
                    </div>
                </div>

                <div class="game-info panel">
                    <div class="control-group">
                        <h3><span>📊</span> Score</h3>
                        <div class="stats">
                            <div class="stone-count" id="score-display">
                                Black: 0 - White: 0
                            </div>
                            <div class="stats-row" id="current-player-display">
                                Current Player: Black
                            </div>
                            <div class="winner-display" id="winner-display" style="display: none;"></div>
                        </div>
                    </div>

                    <div class="control-group">
                        <h3><span>👥</span> Players</h3>
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
                        <h3><span>🎲</span> Game Setup</h3>
                        <div class="stats">
                            <div class="setup-info" id="board-setup">
                                Layout: Board 1 vs Board 2
                            </div>
                            <div class="setup-info" id="starting-setup">
                                Start: WM1,BM2
                            </div>
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

        // Get board size from game history
        if (this.currentGame[0]?.state?.boardConfig?.boardSize) {
            this.boardSize = this.currentGame[0].state.boardConfig.boardSize;
        }

        // Update player info
        this.container.querySelector('#black-strategy').textContent = `Black: ${matchupInfo.player1}`;
        this.container.querySelector('#white-strategy').textContent = `White: ${matchupInfo.player2}`;

        // Update setup info
        const boardConfig = this.currentGame[0].state.boardConfig;
        const board1Name = BOARD_LAYOUTS[boardConfig.board1Layout].name;
        const board2Name = BOARD_LAYOUTS[boardConfig.board2Layout].name;
        this.container.querySelector('#board-setup').textContent =
            `Layout: ${board1Name} vs ${board2Name}`;
        this.container.querySelector('#starting-setup').textContent =
            `Start: ${boardConfig.startingConfig || 'None'}`;

        // Reset move counter
        this.updateMoveCounter();

        // Reset boards to initial state
        this.initializeBoards();

        // Show first move
        this.goToMove(0);
    }

    attachEventListeners() {
        this.container.querySelector('#backToResults').addEventListener('click', () => {
            const simulationResults = this.container.simulationResults;
            this.container.dispatchEvent(new CustomEvent('backToResults', {
                detail: { results: simulationResults }
            }));
        });
        this.container.querySelector('#firstMove').addEventListener('click', () => this.goToMove(0));
        this.container.querySelector('#lastMove').addEventListener('click', () =>
            this.goToMove(this.currentGame.length - 1));
        this.container.querySelector('#prevMove').addEventListener('click', () =>
            this.goToMove(this.currentMoveIndex - 1));
        this.container.querySelector('#nextMove').addEventListener('click', () =>
            this.goToMove(this.currentMoveIndex + 1));
    }

    updateCell(boardNum, row, col, player) {
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

    updateCellHighlights(boardNum, row, col, largestClusters) {
        const cell = document.querySelector(
            `.cell[data-board="${boardNum}"][data-row="${row}"][data-col="${col}"]`
        );

        // Remove existing highlights
        cell.classList.remove('cell-highlight-black', 'cell-highlight-white');

        // Check if cell is in black's largest cluster
        const isInBlackCluster = largestClusters.black[`board${boardNum}`]
            .some(pos => pos.row === row && pos.col === col);
        if (isInBlackCluster) {
            cell.classList.add('cell-highlight-black');
        }

        // Check if cell is in white's largest cluster
        const isInWhiteCluster = largestClusters.white[`board${boardNum}`]
            .some(pos => pos.row === row && pos.col === col);
        if (isInWhiteCluster) {
            cell.classList.add('cell-highlight-white');
        }
    }

    goToMove(moveIndex) {
        if (!this.currentGame || moveIndex < 0 || moveIndex >= this.currentGame.length) {
            return;
        }

        this.currentMoveIndex = moveIndex;
        const gameState = this.currentGame[moveIndex].state;

        // Update boards
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                this.updateCell(1, i, j, gameState.board1[i][j]);
                this.updateCell(2, i, j, gameState.board2[i][j]);
                this.updateCellHighlights(1, i, j, gameState.largestClusters);
                this.updateCellHighlights(2, i, j, gameState.largestClusters);
            }
        }

        // Update move counter
        this.updateMoveCounter();

        // Update current player
        this.updateCurrentPlayer(gameState.currentPlayer);

        // Update scores
        this.updateScores(gameState.largestClusters);

        // Update board sizes
        const board1Element = this.container.querySelector('#replayBoard1');
        const board2Element = this.container.querySelector('#replayBoard2');
        this.updateGroupSizes(board1Element, gameState.largestClusters, true);
        this.updateGroupSizes(board2Element, gameState.largestClusters, false);

        // Update winner display on last move
        if (moveIndex === this.currentGame.length - 1) {
            const blackScore = gameState.largestClusters.black.board1.length +
                gameState.largestClusters.black.board2.length;
            const whiteScore = gameState.largestClusters.white.board1.length +
                gameState.largestClusters.white.board2.length;

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
        const blackBoard1 = clusters.black.board1.length;
        const blackBoard2 = clusters.black.board2.length;
        const whiteBoard1 = clusters.white.board1.length;
        const whiteBoard2 = clusters.white.board2.length;

        // Calculate percentages of maximum possible score
        const maxBoardScore = this.boardSize * this.boardSize;
        const blackPercentage = ((blackTotal / (maxBoardScore * 2)) * 100).toFixed(1);
        const whitePercentage = ((whiteTotal / (maxBoardScore * 2)) * 100).toFixed(1);

        this.container.querySelector('#score-display').innerHTML =
            `<strong>⚫ ${blackTotal}</strong> (${blackBoard1} + ${blackBoard2}) vs ` +
            `<strong>⚪ ${whiteTotal}</strong> (${whiteBoard1} + ${whiteBoard2})`;
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