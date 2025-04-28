import BOARD_LAYOUTS, { getSymbolsForSize } from './boards.js';

// Constants for the game
const DEFAULT_BOARD_SIZE = 5;
const DIRECTIONS = [
    [-1, 0],  // up
    [1, 0],   // down
    [0, -1],  // left
    [0, 1]    // right
];

// Hex grid directions for pointy-topped hexagons
// For hex grids, the coordinate system is slightly different:
// - Even rows: neighbors are at (-1,0), (-1,1), (0,-1), (0,1), (1,0), (1,1)
// - Odd rows: neighbors are at (-1,-1), (-1,0), (0,-1), (0,1), (1,-1), (1,0)
const HEX_DIRECTIONS = {
    even: [
        [-1, 0],  // northeast
        [-1, 1],  // northwest
        [0, -1],  // east
        [0, 1],   // west
        [1, 0],   // southeast
        [1, 1]    // southwest
    ],
    odd: [
        [-1, -1], // northeast
        [-1, 0],  // northwest
        [0, -1],  // east
        [0, 1],   // west
        [1, -1],  // southeast
        [1, 0]    // southwest
    ]
};

const PLAYERS = {
    BLACK: 'BLACK',
    WHITE: 'WHITE',
    SUPERPOSITION: 'SUPERPOSITION'
};

class EntangledGame {
    constructor(
        board1Layout = BOARD_LAYOUTS.board1.grid,
        board2Layout = BOARD_LAYOUTS.board2.grid,
        startingConfig = '',
        superpositionConfig = '',
        enableSwapRule = true,
        board1Type = 'rect',
        board2Type = 'rect'
    ) {
        // Store the symbol layouts and determine board size
        this.board1Layout = board1Layout;
        this.board2Layout = board2Layout;
        this.boardSize = board1Layout.length;

        // Store the board types
        this.board1Type = board1Type;
        this.board2Type = board2Type;

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

        // Swap rule state
        this.enableSwapRule = enableSwapRule;
        this.firstMove = null;
        this.swapAvailable = false;
        this.swapOccurred = false;

        // Superposition state
        this.superpositionStones = new Map(); // symbol -> { number, validPositions }
        this.lastPlacedStone = null;

        // Parse and place starting stones
        if (startingConfig) {
            this.placeStartingStones(startingConfig);
        }

        // Place superposition stones
        if (superpositionConfig) {
            this.placeSuperpositionStones(superpositionConfig);
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

        // First, determine which board we're working with
        const sampleCell = cluster[0];
        const board = this.board1.some(row => row.includes(PLAYERS.BLACK) || row.includes(PLAYERS.WHITE)) ? this.board1 : this.board2;
        const boardType = board === this.board1 ? this.board1Type : this.board2Type;

        // Find the cell with the most connections to other cells in cluster
        for (const cell of cluster) {
            let connections = 0;

            // Get the appropriate directions based on board type
            const directions = this.getDirections(boardType, cell.row);

            for (const [dRow, dCol] of directions) {
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
        const validSymbols = getSymbolsForSize(this.boardSize);

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

    // Helper method to get the right directions based on board type and row
    getDirections(boardType, row) {
        if (boardType === "hex") {
            return row % 2 === 0 ? HEX_DIRECTIONS.even : HEX_DIRECTIONS.odd;
        } else {
            return DIRECTIONS;
        }
    }

    placeSuperpositionStones(config) {
        const validSymbols = getSymbolsForSize(this.boardSize);

        const placements = config.split(',').map(p => p.trim().toUpperCase());

        // Validate and collect symbols
        const usedSymbols = new Set();
        const rngCount = placements.filter(p => p === 'RNG').length;
        const specificSymbols = placements.filter(p => p !== 'RNG');

        // Check for duplicate symbols
        for (const symbol of specificSymbols) {
            if (usedSymbols.has(symbol)) {
                throw new Error(`Duplicate symbol in superposition config: ${symbol}`);
            }
            if (!validSymbols.includes(symbol)) {
                throw new Error(`Invalid symbol in superposition config: ${symbol}`);
            }
            usedSymbols.add(symbol);
        }

        // Get available positions for RNG placement
        const availablePositions = [];
        for (const symbol of validSymbols) {
            if (!usedSymbols.has(symbol) && this.isValidMove(symbol)) {
                availablePositions.push(symbol);
            }
        }

        if (availablePositions.length < rngCount) {
            throw new Error('Not enough available positions for RNG placements');
        }

        // Place specific symbols
        let spLetter = 'A'; // Start with 'A'
        for (const symbol of specificSymbols) {
            const positions = this.symbolToPosition.get(symbol);
            const validPositions = [];

            // Check each board position once at creation
            if (positions.board1 && this.board1Layout[positions.board1.row][positions.board1.col] !== '.') {
                validPositions.push('board1');
                this.board1[positions.board1.row][positions.board1.col] = PLAYERS.SUPERPOSITION;
            }
            if (positions.board2 && this.board2Layout[positions.board2.row][positions.board2.col] !== '.') {
                validPositions.push('board2');
                this.board2[positions.board2.row][positions.board2.col] = PLAYERS.SUPERPOSITION;
            }

            // Store both the SP letter and valid positions
            this.superpositionStones.set(symbol, {
                number: spLetter,
                validPositions
            });
            spLetter = String.fromCharCode(spLetter.charCodeAt(0) + 1); // Increment to next letter
        }

        // Place RNG symbols
        for (let i = 0; i < rngCount; i++) {
            const randomIndex = Math.floor(Math.random() * availablePositions.length);
            const symbol = availablePositions.splice(randomIndex, 1)[0];
            const positions = this.symbolToPosition.get(symbol);
            const validPositions = [];

            if (positions.board1 && this.board1Layout[positions.board1.row][positions.board1.col] !== '.') {
                validPositions.push('board1');
                this.board1[positions.board1.row][positions.board1.col] = PLAYERS.SUPERPOSITION;
            }
            if (positions.board2 && this.board2Layout[positions.board2.row][positions.board2.col] !== '.') {
                validPositions.push('board2');
                this.board2[positions.board2.row][positions.board2.col] = PLAYERS.SUPERPOSITION;
            }

            this.superpositionStones.set(symbol, {
                number: spLetter,
                validPositions
            });
            spLetter = String.fromCharCode(spLetter.charCodeAt(0) + 1); // Increment to next letter
        }
    }

    isValidMove(symbol) {
        if (!this.symbolToPosition.has(symbol)) {
            return false;
        }
        if (symbol === '.') {
            return false;
        }

        const { board1, board2 } = this.symbolToPosition.get(symbol);

        if (board1) {
            if (this.board1Layout[board1.row][board1.col] === '.' ||
                this.board1[board1.row][board1.col] !== null) {
                return false;
            }
        }

        if (board2) {
            if (this.board2Layout[board2.row][board2.col] === '.' ||
                this.board2[board2.row][board2.col] !== null) {
                return false;
            }
        }

        // Check if this position is reserved for a superposition stone
        return !this.superpositionStones.has(symbol);
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
        this.lastPlacedStone = this.currentPlayer;

        // Store first move for swap rule
        if (this.enableSwapRule && this.playerTurns[PLAYERS.BLACK] === 0) {
            this.firstMove = symbol;
            this.swapAvailable = true;
        }

        // Check for superposition collapses
        this.checkSuperpositionCollapses(board1, board2);

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

        // After first move is made, second player can swap
        if (this.enableSwapRule && this.playerTurns[PLAYERS.BLACK] === 1 &&
            this.playerTurns[PLAYERS.WHITE] === 0) {
            this.swapAvailable = true;
        } else {
            this.swapAvailable = false;
        }

        return {
            valid: true,
            gameOver: this.gameOver,
            currentPlayer: this.currentPlayer,
            turnNumber: this.playerTurns[this.currentPlayer] + 1
        };
    }

    swapFirstMove() {
        if (!this.enableSwapRule || !this.swapAvailable || !this.firstMove) {
            throw new Error('Swap is not available');
        }

        // Find the positions of the first move
        const { board1, board2 } = this.symbolToPosition.get(this.firstMove);

        // Swap the colors
        if (board1 !== null && this.board1[board1.row][board1.col] === PLAYERS.BLACK) {
            this.board1[board1.row][board1.col] = PLAYERS.WHITE;
        }
        if (board2 !== null && this.board2[board2.row][board2.col] === PLAYERS.BLACK) {
            this.board2[board2.row][board2.col] = PLAYERS.WHITE;
        }

        // Update game state
        this.playerTurns[PLAYERS.BLACK] = 0;
        this.playerTurns[PLAYERS.WHITE] = 1;
        this.currentPlayer = PLAYERS.BLACK;  // Original first player goes again
        this.swapAvailable = false;
        this.swapOccurred = true;
        this.lastPlacedStone = PLAYERS.WHITE;  // Update last placed stone to maintain consistency

        return {
            valid: true,
            gameOver: false,
            currentPlayer: this.currentPlayer,
            turnNumber: this.playerTurns[this.currentPlayer] + 1
        };
    }

    isSwapAvailable() {
        return this.enableSwapRule && this.swapAvailable;
    }

    checkSuperpositionCollapses(board1Pos, board2Pos) {
        const checkPosition = (board, pos, boardType) => {
            if (!pos) return;
            const { row, col } = pos;

            // Get the appropriate directions based on board type
            const directions = this.getDirections(boardType, row);

            // Find superposition stones that need to collapse
            for (const [dRow, dCol] of directions) {
                const nRow = row + dRow;
                const nCol = col + dCol;

                if (nRow < 0 || nRow >= this.boardSize || nCol < 0 || nCol >= this.boardSize) continue;
                if (board[nRow][nCol] === PLAYERS.SUPERPOSITION) {
                    // Check if all neighbors are filled
                    const allNeighborsFilled = this.checkAllNeighborsFilled(board, nRow, nCol, boardType);
                    if (allNeighborsFilled) {
                        // Find the symbol at this position
                        const symbol = this.findSymbolAtPosition(board === this.board1 ? 1 : 2, nRow, nCol);
                        if (symbol) {
                            this.collapseSuperpositionStone(symbol);
                        }
                    }
                }
            }
        };

        checkPosition(this.board1, board1Pos, this.board1Type);
        checkPosition(this.board2, board2Pos, this.board2Type);
    }

    checkAllNeighborsFilled(board, row, col, boardType) {
        // Get the appropriate directions based on board type
        const directions = this.getDirections(boardType, row);

        return directions.every(([dRow, dCol]) => {
            const nRow = row + dRow;
            const nCol = col + dCol;

            // Edge of board counts as filled
            if (nRow < 0 || nRow >= this.boardSize || nCol < 0 || nCol >= this.boardSize) {
                return true;
            }

            // Check the layout to see if it's a dot position
            const layout = board === this.board1 ? this.board1Layout : this.board2Layout;
            if (layout[nRow][nCol] === '.') {
                return true;
            }

            // Superposition stones count as filled
            if (board[nRow][nCol] === PLAYERS.SUPERPOSITION) {
                return true;
            }

            // Regular stone is filled
            return board[nRow][nCol] !== null;
        });
    }

    findSymbolAtPosition(boardNum, row, col) {
        const layout = boardNum === 1 ? this.board1Layout : this.board2Layout;
        const symbol = layout[row][col];
        return symbol !== '.' ? symbol : null;
    }

    collapseSuperpositionStone(symbol) {
        const positions = this.symbolToPosition.get(symbol);
        if (!positions) return;

        // Calculate optimal color instead of defaulting to last placed stone
        let newColor = this.determineOptimalColor(symbol);

        // Update both boards
        if (positions.board1) {
            this.board1[positions.board1.row][positions.board1.col] = newColor;
        }
        if (positions.board2) {
            this.board2[positions.board2.row][positions.board2.col] = newColor;
        }

        // Find and collapse the twin stone with the same number
        const spInfo = this.superpositionStones.get(symbol);
        if (!spInfo) return;

        for (const [otherSymbol, otherInfo] of this.superpositionStones.entries()) {
            if (otherSymbol !== symbol && otherInfo.number === spInfo.number) {
                const otherPositions = this.symbolToPosition.get(otherSymbol);
                if (otherPositions) {
                    if (otherPositions.board1) {
                        this.board1[otherPositions.board1.row][otherPositions.board1.col] = newColor;
                    }
                    if (otherPositions.board2) {
                        this.board2[otherPositions.board2.row][otherPositions.board2.col] = newColor;
                    }
                    this.superpositionStones.delete(otherSymbol);
                }
                break;
            }
        }

        // Remove from superposition stones
        this.superpositionStones.delete(symbol);
    }

    determineOptimalColor(symbol) {
        const positions = this.symbolToPosition.get(symbol);
        if (!positions) return this.lastPlacedStone;

        // Get the last move that triggered the collapse
        const lastMoveSymbol = this._lastMove;
        if (!lastMoveSymbol || !this.symbolToPosition.has(lastMoveSymbol)) {
            return this.lastPlacedStone;
        }

        const lastMovePos = this.symbolToPosition.get(lastMoveSymbol);

        // Determine which board the last move was on
        const board1Used = lastMovePos.board1 &&
            this.board1Layout[lastMovePos.board1.row][lastMovePos.board1.col] !== '.' &&
            this.board1[lastMovePos.board1.row][lastMovePos.board1.col] === this.lastPlacedStone;

        let blackCount = 0;
        let whiteCount = 0;
        let lastAdjacentColor = null;

        // Count adjacent stones on the relevant board
        const countAdjacentStones = (board, row, col) => {
            const directions = this.getDirections(board === this.board1 ? this.board1Type : this.board2Type, row);

            for (const [dRow, dCol] of directions) {
                const nRow = row + dRow;
                const nCol = col + dCol;

                if (nRow < 0 || nRow >= this.boardSize || nCol < 0 || nCol >= this.boardSize) continue;

                const cell = board[nRow][nCol];
                if (cell === PLAYERS.BLACK) {
                    blackCount++;
                    lastAdjacentColor = PLAYERS.BLACK;
                } else if (cell === PLAYERS.WHITE) {
                    whiteCount++;
                    lastAdjacentColor = PLAYERS.WHITE;
                }
            }
        };

        if (board1Used && positions.board1) {
            const { row, col } = positions.board1;
            if (this.board1Layout[row][col] !== '.') {
                countAdjacentStones(this.board1, row, col);
            }
        } else if (positions.board2) {
            const { row, col } = positions.board2;
            if (this.board2Layout[row][col] !== '.') {
                countAdjacentStones(this.board2, row, col);
            }
        }

        // Use majority rule, with last adjacent stone as tiebreaker
        if (blackCount > whiteCount) {
            return PLAYERS.BLACK;
        } else if (whiteCount > blackCount) {
            return PLAYERS.WHITE;
        } else {
            // If tied, use last adjacent stone's color
            return lastAdjacentColor || this.lastPlacedStone;
        }
    }

    calculatePotentialClusterSize(board, row, col, player) {
        // Create a copy of the board for simulation
        const boardCopy = board.map(row => [...row]);

        // Temporarily place a stone of the given player's color
        boardCopy[row][col] = player;

        // Get the size of the connected group at this position
        const visited = Array(this.boardSize).fill(false)
            .map(() => Array(this.boardSize).fill(false));

        return this.exploreCluster(boardCopy, row, col, player, visited);
    }

    getSuperpositionState() {
        return {
            stones: Array.from(this.superpositionStones.entries()).map(([symbol, info]) => ({
                symbol,
                number: info.number,
                positions: this.symbolToPosition.get(symbol),
                validPositions: info.validPositions
            }))
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
        const boardType = board === this.board1 ? this.board1Type : this.board2Type;

        if (row < 0 || row >= this.boardSize ||
            col < 0 || col >= this.boardSize ||
            visited[row][col] ||
            board[row][col] !== player ||
            layout[row][col] === '.') {
            return 0;
        }

        visited[row][col] = true;
        let size = 1;

        // Get the appropriate directions based on board type
        const directions = this.getDirections(boardType, row);

        for (const [dRow, dCol] of directions) {
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
        const boardType = board === this.board1 ? this.board1Type : this.board2Type;

        if (row < 0 || row >= this.boardSize ||
            col < 0 || col >= this.boardSize ||
            visited[row][col] ||
            board[row][col] !== player ||
            layout[row][col] === '.') {
            return [];
        }

        visited[row][col] = true;
        let cells = [{ row, col }];

        // Get the appropriate directions based on board type
        const directions = this.getDirections(boardType, row);

        for (const [dRow, dCol] of directions) {
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

    findAllClusterSizes(board, player) {
        const visited = Array(this.boardSize).fill(false)
            .map(() => Array(this.boardSize).fill(false));
        const clusters = [];

        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (board[row][col] === player && !visited[row][col]) {
                    clusters.push(this.exploreCluster(board, row, col, player, visited));
                }
            }
        }

        return clusters.sort((a, b) => b - a); // Sort descending
    }

    getWinner() {
        if (!this.gameOver) {
            throw new Error('Game is not over yet');
        }

        const blackScore = this.getScore(PLAYERS.BLACK);
        const whiteScore = this.getScore(PLAYERS.WHITE);

        if (blackScore > whiteScore) return PLAYERS.BLACK;
        if (whiteScore > blackScore) return PLAYERS.WHITE;

        // Score is tied, perform detailed comparison
        const blackClusters1 = this.findAllClusterSizes(this.board1, PLAYERS.BLACK);
        const blackClusters2 = this.findAllClusterSizes(this.board2, PLAYERS.BLACK);
        const whiteClusters1 = this.findAllClusterSizes(this.board1, PLAYERS.WHITE);
        const whiteClusters2 = this.findAllClusterSizes(this.board2, PLAYERS.WHITE);

        // Get longest length to know how many levels to compare
        const maxGroups = Math.max(
            blackClusters1.length + blackClusters2.length,
            whiteClusters1.length + whiteClusters2.length
        );

        // Compare sums at each level
        let comparisonData = [];
        for (let i = 0; i < maxGroups; i++) {
            const blackBoard1 = blackClusters1[i] || 0;
            const blackBoard2 = blackClusters2[i] || 0;
            const whiteBoard1 = whiteClusters1[i] || 0;
            const whiteBoard2 = whiteClusters2[i] || 0;

            const blackSum = blackBoard1 + blackBoard2;
            const whiteSum = whiteBoard1 + whiteBoard2;

            comparisonData.push({
                level: i + 1,
                black: { board1: blackBoard1, board2: blackBoard2, sum: blackSum },
                white: { board1: whiteBoard1, board2: whiteBoard2, sum: whiteSum }
            });

            if (blackSum !== whiteSum) {
                return {
                    winner: blackSum > whiteSum ? PLAYERS.BLACK : PLAYERS.WHITE,
                    comparisonData,
                    decidingLevel: i + 1
                };
            }
        }

        return {
            winner: 'TIE',
            comparisonData,
            decidingLevel: maxGroups
        };
    }

    getEndGameStats() {
        if (!this.gameOver) return null;

        const blackScore = this.getScore(PLAYERS.BLACK);
        const whiteScore = this.getScore(PLAYERS.WHITE);

        const blackClusters1 = this.findAllClusterSizes(this.board1, PLAYERS.BLACK);
        const blackClusters2 = this.findAllClusterSizes(this.board2, PLAYERS.BLACK);
        const whiteClusters1 = this.findAllClusterSizes(this.board1, PLAYERS.WHITE);
        const whiteClusters2 = this.findAllClusterSizes(this.board2, PLAYERS.WHITE);

        // Generate comparison data like getWinner()
        const maxGroups = Math.max(
            blackClusters1.length + blackClusters2.length,
            whiteClusters1.length + whiteClusters2.length
        );

        let comparisonData = [];
        let decidingLevel = null;

        for (let i = 0; i < maxGroups; i++) {
            const blackBoard1 = blackClusters1[i] || 0;
            const blackBoard2 = blackClusters2[i] || 0;
            const whiteBoard1 = whiteClusters1[i] || 0;
            const whiteBoard2 = whiteClusters2[i] || 0;

            const blackSum = blackBoard1 + blackBoard2;
            const whiteSum = whiteBoard1 + whiteBoard2;

            comparisonData.push({
                level: i + 1,
                black: { board1: blackBoard1, board2: blackBoard2, sum: blackSum },
                white: { board1: whiteBoard1, board2: whiteBoard2, sum: whiteSum }
            });

            if (decidingLevel === null && blackSum !== whiteSum) {
                decidingLevel = i + 1;
            }
        }

        return {
            scores: {
                black: blackScore,
                white: whiteScore
            },
            clusters: {
                black: {
                    board1: blackClusters1,
                    board2: blackClusters2
                },
                white: {
                    board1: whiteClusters1,
                    board2: whiteClusters2
                }
            },
            tiebreaker: {
                comparisonData,
                decidingLevel: decidingLevel || maxGroups,
                winner: decidingLevel ?
                    (comparisonData[decidingLevel - 1].black.sum > comparisonData[decidingLevel - 1].white.sum ?
                        PLAYERS.BLACK : PLAYERS.WHITE) :
                    'TIE'
            }
        };
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

    getValidPositionsForStone(symbol) {
        const spInfo = this.superpositionStones.get(symbol);
        return spInfo ? spInfo.validPositions : null;
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
            lastPlacedStone: this.lastPlacedStone,
            largestClusters: {
                black: blackClusters,
                white: whiteClusters
            },
            swapAvailable: this.isSwapAvailable(),
            swapOccurred: this.swapOccurred,
            firstMove: this.firstMove
        };
    }
}

export { EntangledGame, PLAYERS };