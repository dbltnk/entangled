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

        // Calculate stones per player excluding dot positions
        this.stonesPerPlayer = this.calculatePlayablePositions() / 2;
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
        this.gameOver = false;

        // Parse and place starting stones
        if (startingConfig) {
            this.placeStartingStones(startingConfig);
        }

        this._lastMove = null;
    }

    calculatePlayablePositions() {
        let count = 0;
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board1Layout[i][j] !== '.' && this.board2Layout[i][j] !== '.') {
                    count++;
                }
            }
        }
        return count;
    }

    findMostConnectedCell(cluster) {
        if (!cluster || cluster.length === 0) return null;
        let bestCell = null;
        let maxScore = -1;

        // First, find the cell with the most connections to other cells in cluster
        for (const cell of cluster) {
            let connections = 0;
            for (const [dRow, dCol] of DIRECTIONS) {
                const newRow = cell.row + dRow;
                const newCol = cell.col + dCol;
                if (cluster.some(c => c.row === newRow && c.col === newCol)) {
                    connections++;
                }
            }

            // Prefer cells not on the edges of the board or near dots
            const positionPenalty =
                (cell.row === 0 || cell.row === this.boardSize - 1 ||
                    cell.col === 0 || cell.col === this.boardSize - 1) ? 0.5 : 0;

            // Calculate score giving preference to center-most cells with most connections
            const centerScore = this.boardSize - (
                Math.abs(cell.row - Math.floor(this.boardSize / 2)) +
                Math.abs(cell.col - Math.floor(this.boardSize / 2))
            );

            const score = connections + centerScore - positionPenalty;

            if (score > maxScore) {
                maxScore = score;
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
            const layout = board === 1 ? this.board1Layout : this.board2Layout;

            // Skip if position is a dot or already occupied
            if (layout[row][col] === '.' || boardState[row][col] !== null) continue;

            boardState[row][col] = player;
        }
    }

    initializeSymbolMaps() {
        // First pass - add all symbols from board1
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const symbol = this.board1Layout[row][col];
                if (symbol !== '.') {
                    this.symbolToPosition.set(symbol, {
                        board1: { row, col },
                        board2: this.findSymbolPosition(symbol, this.board2Layout)
                    });
                }
            }
        }

        // Second pass - add any symbols that only appear in board2
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const symbol = this.board2Layout[row][col];
                if (symbol !== '.' && !this.symbolToPosition.has(symbol)) {
                    this.symbolToPosition.set(symbol, {
                        board1: null,
                        board2: { row, col }
                    });
                }
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
        if (symbol === '.') return false;

        const { board1, board2 } = this.symbolToPosition.get(symbol);
        if (board1) {
            if (this.board1Layout[board1.row][board1.col] === '.' ||
                this.board1[board1.row][board1.col] !== null) return false;
        }

        if (board2) {
            if (this.board2Layout[board2.row][board2.col] === '.' ||
                this.board2[board2.row][board2.col] !== null) return false;
        }

        return true;
    }

    makeMove(symbol) {
        if (this.gameOver) {
            throw new Error('Game is already over');
        }

        if (!this.isValidMove(symbol)) {
            throw new Error('Invalid move');
        }

        const { board1, board2 } = this.symbolToPosition.get(symbol);

        // Place stones on both boards, if possible
        if (board1 !== null && this.board1Layout[board1.row][board1.col] !== '.') {
            this.board1[board1.row][board1.col] = this.currentPlayer;
        }

        if (board2 !== null && this.board2Layout[board2.row][board2.col] !== '.') {
            this.board2[board2.row][board2.col] = this.currentPlayer;
        }

        this._lastMove = symbol;

        // Update game state
        this.playerTurns[this.currentPlayer]++;

        // Check if all non-dot positions are filled
        let isBoardFull = true;
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if ((this.board1Layout[i][j] !== '.' && this.board1[i][j] === null) ||
                    (this.board2Layout[i][j] !== '.' && this.board2[i][j] === null)) {
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
        const layout = board === this.board1 ? this.board1Layout : this.board2Layout;

        if (row < 0 || row >= this.boardSize ||
            col < 0 || col >= this.boardSize ||
            visited[row][col] ||
            board[row][col] !== player ||
            layout[row][col] === '.') {
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
        const layout = board === this.board1 ? this.board1Layout : this.board2Layout;

        if (row < 0 || row >= this.boardSize ||
            col < 0 || col >= this.boardSize ||
            visited[row][col] ||
            board[row][col] !== player ||
            layout[row][col] === '.') {
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
            playerTurns: { ...this.playerTurns },
            validMoves: this.getValidMoves(),
            lastMove: this._lastMove,
            largestClusters: {
                black: blackClusters,
                white: whiteClusters
            }
        };
    }
}

export { EntangledGame, PLAYERS };