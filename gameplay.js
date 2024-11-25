import BOARD_LAYOUTS from './boards.js';

// Constants for the game
const BOARD_SIZE = 5;
const STONES_PER_PLAYER = 25;
const TURNS_PER_PLAYER = 12;
const PLAYERS = {
    BLACK: 'BLACK',
    WHITE: 'WHITE'
};
const DIRECTIONS = [
    [-1, 0],  // up
    [1, 0],   // down
    [0, -1],  // left
    [0, 1]    // right
];

class EntangledGame {
    constructor(
        board1Layout = BOARD_LAYOUTS.board1.grid,
        board2Layout = BOARD_LAYOUTS.board2.grid,
        startingPositions = {}
    ) {
        // Store the symbol layouts
        this.board1Layout = board1Layout;
        this.board2Layout = board2Layout;

        // Create the game state
        this.board1 = Array(BOARD_SIZE).fill(null)
            .map(() => Array(BOARD_SIZE).fill(null));
        this.board2 = Array(BOARD_SIZE).fill(null)
            .map(() => Array(BOARD_SIZE).fill(null));

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
            [PLAYERS.BLACK]: STONES_PER_PLAYER,
            [PLAYERS.WHITE]: STONES_PER_PLAYER
        };
        this.gameOver = false;

        // Place starting stones based on selected positions
        this.placeStartingStone(PLAYERS.BLACK, startingPositions[PLAYERS.BLACK] || { symbol: 'M', board: 1 });
        this.placeStartingStone(PLAYERS.WHITE, startingPositions[PLAYERS.WHITE] || { symbol: 'M', board: 2 });
        // Deduct initial stones
        this.remainingStones[PLAYERS.BLACK]--;
        this.remainingStones[PLAYERS.WHITE]--;
    }

    placeStartingStone(player, { symbol, board }) {
        const boardState = board === 1 ? this.board1 : this.board2;

        // Get the position of the symbol on the specified board
        const positions = this.symbolToPosition.get(symbol);

        if (!positions || !positions[`board${board}`]) {
            throw new Error(`Invalid starting position: Symbol ${symbol} not found on board ${board}`);
        }

        const { row, col } = positions[`board${board}`];

        if (boardState[row][col] !== null) {
            throw new Error(`Starting position ${symbol}${board} is already occupied`);
        }

        boardState[row][col] = player;
    }

    initializeSymbolMaps() {
        // Create mappings from symbols to their positions on both boards
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const symbol = this.board1Layout[row][col];
                this.symbolToPosition.set(symbol, {
                    board1: { row, col },
                    board2: this.findSymbolPosition(symbol, this.board2Layout)
                });
            }
        }
    }

    findSymbolPosition(symbol, board) {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] === symbol) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    isValidMove(symbol) {
        if (!this.symbolToPosition.has(symbol)) return false;
        if (this.remainingStones[this.currentPlayer] < 2) return false;
        if (this.playerTurns[this.currentPlayer] >= TURNS_PER_PLAYER) return false;

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

        // First check if this move completes White's turns
        if (this.currentPlayer === PLAYERS.WHITE &&
            this.playerTurns[PLAYERS.WHITE] === TURNS_PER_PLAYER) {
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
        const visited = Array(BOARD_SIZE).fill(false)
            .map(() => Array(BOARD_SIZE).fill(false));
        let largestClusterSize = 0;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
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
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE ||
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
        const visited = Array(BOARD_SIZE).fill(false)
            .map(() => Array(BOARD_SIZE).fill(false));
        let largestCluster = [];

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
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
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE ||
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

export { EntangledGame, PLAYERS, STONES_PER_PLAYER, TURNS_PER_PLAYER };
