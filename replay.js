import { EntangledGame } from './gameplay.js';
import BOARD_LAYOUTS from './boards.js';

class GameReplay {
    constructor() {
        this.currentMoveIndex = 0;
        this.history = [];
        this.matchInfo = {};
        this.boardSize = 5;
        this.setupEventListeners();
    }

    initialize(data) {
        console.log('Initializing replay with data:', {
            hasHistory: !!data.history,
            hasMoves: !!data.moves,
            hasResults: !!data.results,
            metadata: data.metadata,
            matchInfo: data.matchInfo
        });

        this.matchInfo = {
            black: data.matchInfo?.black || data.results?.[Object.keys(data.results)[0]]?.black || 'Black',
            white: data.matchInfo?.white || data.results?.[Object.keys(data.results)[0]]?.white || 'White',
            board1Name: data.matchInfo?.board1Name || data.metadata?.boards?.board1 || 'Board 1',
            board2Name: data.matchInfo?.board2Name || data.metadata?.boards?.board2 || 'Board 2',
            startingConfig: data.matchInfo?.startingConfig || data.metadata?.startingConfig || ''
        };

        // Get board layouts
        const board1Layout = data.board1Layout || BOARD_LAYOUTS[data.metadata?.boards?.board1]?.grid;
        const board2Layout = data.board2Layout || BOARD_LAYOUTS[data.metadata?.boards?.board2]?.grid;

        console.log('Board layouts:', {
            board1Name: this.matchInfo.board1Name,
            board2Name: this.matchInfo.board2Name,
            hasBoard1Layout: !!board1Layout,
            hasBoard2Layout: !!board2Layout,
            board1Size: board1Layout?.length,
            board2Size: board2Layout?.length
        });

        if (!board1Layout || !board2Layout) {
            throw new Error('Could not determine board layouts');
        }

        this.boardSize = board1Layout.length;

        // Handle both full state history and move-only history
        if (data.history && Array.isArray(data.history) && data.history[0].board1) {
            console.log('Using full state history');
            // Full state history from live tournament
            this.history = data.history;
        } else if (data.moves || (data.history && Array.isArray(data.history) && typeof data.history[0] === 'string') || data.results) {
            console.log('Using move-only history');
            // Move-only history from saved tournament, reconstruct states
            const moves = data.moves || data.history || data.results?.[Object.keys(data.results)[0]]?.games?.[0]?.moves;
            if (!moves) {
                throw new Error('No moves found in replay data');
            }

            console.log('Found moves:', {
                moveCount: moves.length,
                firstMove: moves[0],
                lastMove: moves[moves.length - 1]
            });

            // Get cut-the-cake info from either metadata or game results
            const gameResult = data.results?.[Object.keys(data.results)[0]]?.games?.[0];
            const cutTheCake = gameResult?.cutTheCakeEnabled ?? data.metadata?.cutTheCake ?? true;
            const colorsSwapped = gameResult?.colorsSwapped ?? false;

            console.log('Cut-the-cake settings:', {
                cutTheCake,
                colorsSwapped,
                fromGameResult: !!gameResult?.cutTheCakeEnabled,
                fromMetadata: !!data.metadata?.cutTheCake
            });

            this.reconstructHistory({
                moves,
                board1Layout,
                board2Layout,
                initialConfig: this.matchInfo.startingConfig,
                cutTheCake,
                colorsSwapped
            });
        }

        this.initializeUI();
        this.renderState(0);
    }

    reconstructHistory(data) {
        console.log('Starting history reconstruction with:', {
            cutTheCake: data.cutTheCake,
            colorsSwapped: data.colorsSwapped,
            initialConfig: data.initialConfig,
            totalMoves: data.moves.length,
            moves: data.moves
        });

        const game = new EntangledGame(
            data.board1Layout,
            data.board2Layout,
            data.initialConfig,
            data.cutTheCake !== false
        );

        console.log('Initial game state:', {
            currentPlayer: game.getCurrentPlayer(),
            canSwapColors: game.getGameState().canSwapColors,
            board1: game.getBoard1(),
            board2: game.getBoard2()
        });

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
            board2Layout: data.board2Layout,
            canSwapColors: game.getGameState().canSwapColors,
            colorsSwapped: false
        }];

        // If colors were swapped, we need to apply it after the first move
        let shouldSwapAfterFirstMove = data.colorsSwapped;
        console.log('Should swap after first move:', shouldSwapAfterFirstMove);

        // Replay each move and record state
        for (let i = 0; i < data.moves.length; i++) {
            const move = data.moves[i];
            try {
                console.log(`Processing move ${i + 1}:`, {
                    move,
                    currentPlayer: game.getCurrentPlayer(),
                    shouldSwapAfterFirstMove,
                    gameState: game.getGameState(),
                    validMoves: game.getGameState().validMoves
                });

                if (shouldSwapAfterFirstMove && i === 0) {
                    console.log('Swapping colors after first move');
                    game.swapColors();
                    shouldSwapAfterFirstMove = false;
                }

                game.makeMove(move);
                const state = game.getGameState();

                console.log('Move processed successfully:', {
                    move,
                    newCurrentPlayer: state.currentPlayer,
                    canSwapColors: state.canSwapColors,
                    colorsSwapped: state.colorsSwapped,
                    blackScore: game.getScore('BLACK'),
                    whiteScore: game.getScore('WHITE')
                });

                this.history.push({
                    move,
                    board1: game.getBoard1(),
                    board2: game.getBoard2(),
                    currentPlayer: state.currentPlayer,
                    blackScore: game.getScore('BLACK'),
                    whiteScore: game.getScore('WHITE'),
                    largestClusters: state.largestClusters,
                    board1Layout: data.board1Layout,
                    board2Layout: data.board2Layout,
                    canSwapColors: state.canSwapColors,
                    colorsSwapped: state.colorsSwapped || data.colorsSwapped
                });
            } catch (error) {
                console.error('Error reconstructing move:', error, {
                    move,
                    moveIndex: i + 1,
                    currentPlayer: game.getCurrentPlayer(),
                    gameState: game.getGameState(),
                    validMoves: game.getGameState().validMoves,
                    board1: game.getBoard1(),
                    board2: game.getBoard2()
                });
                throw new Error(`Failed to reconstruct game history at move: ${move}`);
            }
        }

        console.log('History reconstruction completed:', {
            totalStates: this.history.length,
            finalState: this.history[this.history.length - 1],
            moves: data.moves
        });
    }

    initializeUI() {
        document.title = `Game Replay - ${this.matchInfo.black} vs ${this.matchInfo.white}`;

        const playersInfo = document.getElementById('players-info');
        playersInfo.textContent = `⚫ ${this.matchInfo.black} vs ⚪ ${this.matchInfo.white}`;

        const boardInfo = document.getElementById('board-info');
        boardInfo.textContent = `Board 1: ${this.matchInfo.board1Name} | Board 2: ${this.matchInfo.board2Name} | Starting: ${this.matchInfo.startingConfig}`;

        const cutCakeInfo = document.getElementById('cut-cake-info');
        if (cutCakeInfo) {
            if (this.history[0].canSwapColors === false) {
                cutCakeInfo.textContent = 'Cut the cake rule is disabled';
                cutCakeInfo.classList.add('disabled');
            } else {
                cutCakeInfo.textContent = 'Cut the cake rule is enabled (White can swap colors after Black\'s first move)';
                cutCakeInfo.classList.add('enabled');
            }
        }

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

        // Create all cells, including dots
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                const cell1 = this.createCell(1, i, j);
                const cell2 = this.createCell(2, i, j);

                // Add dot class for dot positions
                if (this.history[0].board1Layout[i][j] === '.') {
                    cell1.classList.add('dot-cell');
                }
                if (this.history[0].board2Layout[i][j] === '.') {
                    cell2.classList.add('dot-cell');
                }

                board1.appendChild(cell1);
                board2.appendChild(cell2);
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
        const symbol = boardNum === 1 ?
            this.history[0].board1Layout[row][col] :
            this.history[0].board2Layout[row][col];
        letter.textContent = symbol === '.' ? '' : symbol;
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

        // Remove any existing cut-the-cake related classes
        cell.classList.remove('can-swap-colors', 'colors-swapped');
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

    updateBoardState(boardElement, state) {
        // Remove any existing cut-the-cake related classes
        boardElement.classList.remove('can-swap-colors', 'colors-swapped');

        // Add appropriate classes based on game state
        if (state.canSwapColors) {
            boardElement.classList.add('can-swap-colors');
            boardElement.title = 'White player can choose to swap colors with Black';
        } else if (state.colorsSwapped && this.currentMoveIndex === 1) {
            boardElement.classList.add('colors-swapped');
            boardElement.title = 'Colors have been swapped: Black is now White and White is now Black';
        } else {
            boardElement.title = ''; // Clear any existing tooltip
        }
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

        // Update board states for cut-the-cake visualization
        this.updateBoardState(board1Element, state);
        this.updateBoardState(board2Element, state);

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
            if (state.colorsSwapped) {
                scoreDisplay.title = 'Colors were swapped after Black\'s first move';
            } else {
                scoreDisplay.title = '';
            }
        }

        // Update current player/winner and cut-the-cake status
        const currentPlayerDisplay = document.getElementById('current-player-display');
        if (currentPlayerDisplay) {
            if (index < this.history.length - 1) {
                let displayText = `Current player: ${state.currentPlayer === 'BLACK' ? '⚫ Black' : '⚪ White'}`;
                if (state.canSwapColors) {
                    displayText += ' (Can swap colors)';
                    currentPlayerDisplay.title = 'White player can choose to swap colors with Black';
                } else if (state.colorsSwapped && index === 1) {
                    displayText += ' (Colors swapped)';
                    currentPlayerDisplay.title = 'White chose to swap colors with Black';
                } else {
                    currentPlayerDisplay.title = '';
                }
                currentPlayerDisplay.textContent = displayText;
            } else {
                // Create a game instance to get final stats
                const finalGame = new EntangledGame(
                    state.board1Layout,
                    state.board2Layout,
                    '',
                    this.history[0].canSwapColors !== false
                );

                // Replay all moves to get to final state
                for (let i = 1; i < this.history.length; i++) {
                    try {
                        finalGame.makeMove(this.history[i].move);
                    } catch (error) {
                        console.error('Error replaying move:', error);
                        currentPlayerDisplay.textContent = 'Error: Could not replay game moves';
                        return;
                    }
                }

                try {
                    const endStats = finalGame.getEndGameStats();
                    if (!endStats) {
                        console.error('No end stats returned', {
                            gameState: finalGame.getGameState(),
                            isGameOver: finalGame.isGameOver(),
                            lastMove: this.history[this.history.length - 1].move
                        });
                        currentPlayerDisplay.textContent = 'Error: Could not determine game outcome';
                        return;
                    }

                    let content = `
                        <div class="final-state">
                            Base scores: ⚫ ${endStats.scores.black} vs ⚪ ${endStats.scores.white}<br>`;

                    if (endStats.scores.black === endStats.scores.white) {
                        content += `<table class="tiebreaker-table" style="margin-top:0.5rem; font-size:0.9em; width:100%;">
                            <tr>
                                <th>Lvl</th><th>⚫</th><th>=</th><th>⚪</th><th>=</th>
                            </tr>`;

                        endStats.tiebreaker.comparisonData.forEach((level, i) => {
                            const isDeciding = (i + 1) === endStats.tiebreaker.decidingLevel;
                            content += `
                                <tr ${isDeciding ? 'style="background:rgba(0,0,0,0.1)"' : ''}>
                                    <td>${level.level}</td>
                                    <td>${level.black.board1}+${level.black.board2}</td>
                                    <td>${level.black.sum}</td>
                                    <td>${level.white.board1}+${level.white.board2}</td>
                                    <td>${level.white.sum}${isDeciding ? ' ←' : ''}</td>
                                </tr>`;
                        });
                        content += `</table>`;

                        if (endStats.tiebreaker.winner !== 'TIE') {
                            const symbol = endStats.tiebreaker.winner === 'BLACK' ? '⚫' : '⚪';
                            content += `<div style="margin-top:0.5rem">${symbol} wins at level ${endStats.tiebreaker.decidingLevel}!</div>`;
                        } else {
                            content += '<div style="margin-top:0.5rem">Complete tie!</div>';
                        }
                    } else {
                        const winner = endStats.scores.black > endStats.scores.white ? 'BLACK' : 'WHITE';
                        const symbol = winner === 'BLACK' ? '⚫' : '⚪';
                        content += `<div>${symbol} wins ${Math.max(endStats.scores.black, endStats.scores.white)}-${Math.min(endStats.scores.black, endStats.scores.white)}!</div>`;
                    }
                    content += '</div>';
                    currentPlayerDisplay.innerHTML = content;
                } catch (error) {
                    console.error('Error calculating end game stats:', error);
                    currentPlayerDisplay.textContent = 'Error: Could not calculate final game statistics';
                }
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