import BOARD_LAYOUTS from './boards.js';

// Constants for the game
const DEFAULT_BOARD_SIZE = 5;
const DIRECTIONS = [
    [-1, 0],  // up
    [1, 0],   // down
    [0, -1],  // left
    [0, 1]    // right
];

const PLAYERS = {
    BLACK: 'BLACK',
    WHITE: 'WHITE'
};

class EntangledGame {
    constructor(
        board1Layout = BOARD_LAYOUTS.board1.grid,
        board2Layout = BOARD_LAYOUTS.board2.grid,
        startingConfig = ''
    ) {
        // Store the symbol layouts and determine board size
        this.board1Layout = board1Layout;
        this.board2Layout = board2Layout;
        this.boardSize = board1Layout.length;

        // Calculate stones per player based on board size
        this.stonesPerPlayer = Math.floor((this.boardSize * this.boardSize) / 2);
        this.turnsPerPlayer = Math.floor(this.stonesPerPlayer / 2);

        // Create the game state
        this.board1 = Array(this.boardSize).fill(null)
            .map(() => Array(this.boardSize).fill(null));
        this.board2 = Array(this.boardSize).fill(null)
            .map(() => Array(this.boardSize).fill(null));

        // Create symbol position maps for quick lookups
        this.symbolToPosition = new Map();
        this.initializeSymbolMaps();

        // Game state
        this.currentPlayer = PLAYERS.BLACK;
        this.playerTurns = {
            [PLAYERS.BLACK]: 0,
            [PLAYERS.WHITE]: 0
        };
        this.remainingStones = {
            [PLAYERS.BLACK]: this.stonesPerPlayer,
            [PLAYERS.WHITE]: this.stonesPerPlayer
        };
        this.gameOver = false;

        // Parse and place starting stones
        if (startingConfig) {
            this.placeStartingStones(startingConfig);
        }
    }

    findMostConnectedCell(cluster) {
        if (!cluster || cluster.length === 0) return null;
        let bestCell = null;
        let maxConnections = -1;

        for (const cell of cluster) {
            let connections = 0;
            for (const [dRow, dCol] of DIRECTIONS) {
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

    placeStartingStones(config) {
        // Valid characters for board cells based on size
        const validSymbols = this.boardSize === 4 ? 'ABCDEFGHIJKLMNOP' :
            this.boardSize === 5 ? 'ABCDEFGHIJKLMNOPQRSTUVWXY' :
                this.boardSize === 6 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' :
                    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=/?!~';

        // Split the config string by commas
        const placements = config.split(',').map(p => p.trim());

        // Process each placement
        for (const placement of placements) {
            if (placement.length < 3) continue;

            const player = placement[0] === 'B' ? PLAYERS.BLACK : PLAYERS.WHITE;
            const symbol = placement[1];
            const board = parseInt(placement[2]);

            // Skip if symbol isn't valid for current board size
            if (!validSymbols.includes(symbol)) continue;
            if (board !== 1 && board !== 2) continue;

            const boardState = board === 1 ? this.board1 : this.board2;
            const positions = this.symbolToPosition.get(symbol);

            if (!positions || !positions[`board${board}`]) continue;

            const { row, col } = positions[`board${board}`];

            if (boardState[row][col] !== null) continue;

            boardState[row][col] = player;
            this.remainingStones[player]--;
        }
    }

    initializeSymbolMaps() {
        // Create mappings from symbols to their positions on both boards
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const symbol = this.board1Layout[row][col];
                this.symbolToPosition.set(symbol, {
                    board1: { row, col },
                    board2: this.findSymbolPosition(symbol, this.board2Layout)
                });
            }
        }
    }

    findSymbolPosition(symbol, board) {
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (board[row][col] === symbol) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    isValidMove(symbol) {
        if (!this.symbolToPosition.has(symbol)) return false;

        const { board1, board2 } = this.symbolToPosition.get(symbol);
        return this.board1[board1.row][board1.col] === null &&
            this.board2[board2.row][board2.col] === null;
    }

    makeMove(symbol) {
        if (this.gameOver) {
            throw new Error('Game is already over');
        }

        if (!this.isValidMove(symbol)) {
            throw new Error('Invalid move');
        }

        const { board1, board2 } = this.symbolToPosition.get(symbol);

        // Place stones on both boards
        this.board1[board1.row][board1.col] = this.currentPlayer;
        this.board2[board2.row][board2.col] = this.currentPlayer;

        // Update game state
        this.remainingStones[this.currentPlayer] -= 2;
        this.playerTurns[this.currentPlayer]++;

        // Check if all cells are filled
        let isBoardFull = true;
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board1[i][j] === null || this.board2[i][j] === null) {
                    isBoardFull = false;
                    break;
                }
            }
            if (!isBoardFull) break;
        }

        if (isBoardFull) {
            this.gameOver = true;
        }

        if (!this.gameOver) {
            // Switch players if game isn't over
            this.currentPlayer =
                this.currentPlayer === PLAYERS.BLACK ? PLAYERS.WHITE : PLAYERS.BLACK;
        }

        return {
            valid: true,
            gameOver: this.gameOver,
            currentPlayer: this.currentPlayer,
            turnNumber: this.playerTurns[this.currentPlayer] + 1
        };
    }

    findLargestCluster(board, player) {
        const visited = Array(this.boardSize).fill(false)
            .map(() => Array(this.boardSize).fill(false));
        let largestClusterSize = 0;

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (board[row][col] === player && !visited[row][col]) {
                    largestClusterSize = Math.max(
                        largestClusterSize,
                        this.exploreCluster(board, row, col, player, visited)
                    );
                }
            }
        }

        return largestClusterSize;
    }

    exploreCluster(board, row, col, player, visited) {
        if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize ||
            visited[row][col] || board[row][col] !== player) {
            return 0;
        }

        visited[row][col] = true;
        let size = 1;

        for (const [dRow, dCol] of DIRECTIONS) {
            size += this.exploreCluster(
                board,
                row + dRow,
                col + dCol,
                player,
                visited
            );
        }

        return size;
    }

    findLargestClusterCells(board, player) {
        const visited = Array(this.boardSize).fill(false)
            .map(() => Array(this.boardSize).fill(false));
        let largestCluster = [];

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (board[row][col] === player && !visited[row][col]) {
                    const currentCluster = this.exploreClusterCells(board, row, col, player, visited);
                    if (currentCluster.length > largestCluster.length) {
                        largestCluster = currentCluster;
                    }
                }
            }
        }

        return largestCluster;
    }

    exploreClusterCells(board, row, col, player, visited) {
        if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize ||
            visited[row][col] || board[row][col] !== player) {
            return [];
        }

        visited[row][col] = true;
        let cells = [{ row, col }];

        for (const [dRow, dCol] of DIRECTIONS) {
            cells = cells.concat(this.exploreClusterCells(
                board,
                row + dRow,
                col + dCol,
                player,
                visited
            ));
        }

        return cells;
    }

    getScore(player) {
        const board1Score = this.findLargestCluster(this.board1, player);
        const board2Score = this.findLargestCluster(this.board2, player);
        return board1Score + board2Score;
    }

    getWinner() {
        if (!this.gameOver) {
            throw new Error('Game is not over yet');
        }

        const blackScore = this.getScore(PLAYERS.BLACK);
        const whiteScore = this.getScore(PLAYERS.WHITE);

        if (blackScore > whiteScore) return PLAYERS.BLACK;
        if (whiteScore > blackScore) return PLAYERS.WHITE;
        return 'TIE';
    }

    getBoard1() {
        return this.board1.map(row => [...row]);
    }

    getBoard2() {
        return this.board2.map(row => [...row]);
    }

    getCurrentPlayer() {
        return this.currentPlayer;
    }

    getCurrentTurn() {
        return this.playerTurns[this.currentPlayer] + 1;
    }

    getRemainingStones(player) {
        return this.remainingStones[player];
    }

    isGameOver() {
        return this.gameOver;
    }

    getValidMoves() {
        return Array.from(this.symbolToPosition.keys())
            .filter(symbol => this.isValidMove(symbol));
    }

    getGameState() {
        const blackClusters = {
            board1: this.findLargestClusterCells(this.board1, PLAYERS.BLACK),
            board2: this.findLargestClusterCells(this.board2, PLAYERS.BLACK)
        };
        const whiteClusters = {
            board1: this.findLargestClusterCells(this.board1, PLAYERS.WHITE),
            board2: this.findLargestClusterCells(this.board2, PLAYERS.WHITE)
        };

        return {
            board1: this.getBoard1(),
            board2: this.getBoard2(),
            currentPlayer: this.currentPlayer,
            currentTurn: this.getCurrentTurn(),
            gameOver: this.gameOver,
            remainingStones: { ...this.remainingStones },
            playerTurns: { ...this.playerTurns },
            validMoves: this.getValidMoves(),
            largestClusters: {
                black: blackClusters,
                white: whiteClusters
            }
        };
    }
}

export { EntangledGame, PLAYERS };