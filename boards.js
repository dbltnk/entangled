// Single source of truth for board layouts and metadata

const getSymbolsForSize = (size) => {
    if (size === 4) return 'ABCDEFGHIJKLMNOP';
    if (size === 5) return 'ABCDEFGHIJKLMNOPQRSTUVWXY';
    if (size === 6) return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    if (size === 7) return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-=/?!~';
    return '';
};

const createRandomGrid = (size) => {
    const symbols = getSymbolsForSize(size);

    // Split and shuffle symbols
    const chars = symbols.split('');
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    // Create the grid
    const grid = [];
    let charIndex = 0;
    for (let row = 0; row < size; row++) {
        const gridRow = [];
        for (let col = 0; col < size; col++) {
            gridRow.push(chars[charIndex]);
            charIndex++;
        }
        grid.push(gridRow);
    }
    return grid;
};

const createCenteredRandomGrid = (size, centerSymbol) => {
    const symbols = getSymbolsForSize(size);
    const centerPos = Math.floor(size / 2);

    // Split and shuffle symbols, excluding the center symbol
    const chars = symbols.split('').filter(c => c !== centerSymbol);
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    // Create the grid
    const grid = [];
    let charIndex = 0;
    for (let row = 0; row < size; row++) {
        const gridRow = [];
        for (let col = 0; col < size; col++) {
            if (row === centerPos && col === centerPos) {
                gridRow.push(centerSymbol);
            } else {
                gridRow.push(chars[charIndex++]);
            }
        }
        grid.push(gridRow);
    }
    return grid;
};

class CenteredRandomBoard {
    constructor(size, centerSymbol) {
        this._grid = createCenteredRandomGrid(size, centerSymbol);
    }

    get grid() {
        return this._grid;
    }
}

const BOARD_LAYOUTS = {
    board1: {
        name: "Top left to bottom right (5x5)",
        grid: [
            ['A', 'B', 'C', 'D', 'E'],
            ['F', 'G', 'H', 'I', 'J'],
            ['K', 'L', 'M', 'N', 'O'],
            ['P', 'Q', 'R', 'S', 'T'],
            ['U', 'V', 'W', 'X', 'Y']
        ]
    },
    board2: {
        name: "Knight's Jump (5x5)",
        grid: [
            ['Y', 'C', 'F', 'N', 'Q'],
            ['K', 'S', 'V', 'E', 'H'],
            ['B', 'J', 'M', 'P', 'X'],
            ['R', 'U', 'D', 'G', 'O'],
            ['I', 'L', 'T', 'W', 'A']
        ]
    },
    board3: {
        name: "Ali 24/11/2024 (5x5)",
        grid: [
            ['L', 'W', 'I', 'T', 'A'],
            ['D', 'O', 'U', 'G', 'R'],
            ['P', 'B', 'M', 'X', 'J'],
            ['H', 'S', 'E', 'K', 'V'],
            ['Y', 'F', 'Q', 'C', 'N']
        ]
    },
    board4: {
        name: "asymmetric (5x5)",
        grid: [
            ['P', 'Y', 'N', 'C', 'G'],
            ['D', 'H', 'Q', 'U', 'O'],
            ['V', 'K', 'E', 'I', 'R'],
            ['J', 'S', 'W', 'L', 'A'],
            ['M', 'B', 'F', 'T', 'X']
        ]
    },
    board7: {
        name: "asymmetric 2",
        grid: [
            ['M', 'V', 'F', 'T', 'D'],
            ['J', 'S', 'C', 'L', 'U'],
            ['B', 'K', 'Y', 'I', 'R'],
            ['X', 'H', 'Q', 'A', 'O'],
            ['P', 'E', 'N', 'W', 'G']
        ]
    },
    board8: {
        name: "asymmetric 3",
        grid: [
            ['M', 'V', 'P', 'J', 'D'],
            ['T', 'I', 'C', 'L', 'U'],
            ['B', 'K', 'Y', 'S', 'H'],
            ['X', 'R', 'G', 'A', 'O'],
            ['F', 'E', 'N', 'W', 'Q']
        ]
    },
    board9: {
        name: "asymmetric 4",
        grid: [
            ['M', 'X', 'F', 'T', 'B'],
            ['J', 'Q', 'C', 'N', 'U'],
            ['D', 'K', 'Y', 'G', 'R'],
            ['V', 'H', 'S', 'A', 'O'],
            ['P', 'E', 'L', 'W', 'I']
        ]
    },
    board10: {
        name: "asymmetric 5",
        grid: [
            ['S', 'C', 'L', 'U', 'J'],
            ['K', 'Y', 'I', 'R', 'B'],
            ['H', 'Q', 'A', 'O', 'X'],
            ['E', 'N', 'W', 'G', 'P'],
            ['V', 'F', 'T', 'D', 'M']
        ]
    },
    board11: {
        name: "asymmetric 6",
        grid: [
            ['I', 'C', 'L', 'U', 'T'],
            ['K', 'Y', 'S', 'H', 'B'],
            ['R', 'G', 'A', 'O', 'X'],
            ['E', 'N', 'W', 'Q', 'F'],
            ['V', 'P', 'J', 'D', 'M']
        ]
    },
    board12: {
        name: "asymmetric 7",
        grid: [
            ['Q', 'C', 'N', 'U', 'J'],
            ['K', 'Y', 'G', 'R', 'D'],
            ['H', 'S', 'A', 'O', 'V'],
            ['E', 'L', 'W', 'I', 'P'],
            ['X', 'F', 'T', 'B', 'M']
        ]
    },
    board20: {
        name: "b+w initial stones 5",
        grid: [
            ['H', 'O', 'S', 'U', 'B'],
            ['P', 'V', 'C', 'J', 'N'],
            ['E', 'I', 'K', 'Q', 'W'],
            ['L', 'R', 'Y', 'D', 'F'],
            ['X', 'A', 'G', 'M', 'T']
        ]
    },
    board21: {
        name: "b+w initial stones 6",
        grid: [
            ['H', 'L', 'T', 'U', 'D'],
            ['P', 'X', 'C', 'G', 'O'],
            ['B', 'J', 'K', 'S', 'W'],
            ['N', 'R', 'V', 'E', 'F'],
            ['Y', 'A', 'I', 'M', 'Q']
        ]
    },
    board3893435730left: {
        name: "evolved left",
        grid: [
            ['G', 'B', 'H', 'O', 'U'],
            ['P', 'D', 'X', 'F', 'C'],
            ['T', 'S', 'W', 'R', 'Q'],
            ['N', 'A', 'K', 'L', 'M'],
            ['I', 'J', 'Y', 'V', 'E'],
        ]
    },
    board3893435730right: {
        name: "evolved right",
        grid: [
            ['F', 'D', 'J', 'T', 'L'],
            ['S', 'I', 'C', 'B', 'K'],
            ['P', 'M', 'E', 'O', 'Y'],
            ['R', 'U', 'N', 'G', 'X'],
            ['A', 'H', 'Q', 'V', 'W'],
        ]
    },
    board4x4: {
        name: "Top left to bottom right (4x4)",
        grid: [
            ['A', 'B', 'C', 'D'],
            ['E', 'F', 'G', 'H'],
            ['I', 'J', 'K', 'L'],
            ['M', 'N', 'O', 'P']
        ]
    },
    board6x6: {
        name: "Top left to bottom right (6x6)",
        grid: [
            ['A', 'B', 'C', 'D', 'E', 'F'],
            ['G', 'H', 'I', 'J', 'K', 'L'],
            ['M', 'N', 'O', 'P', 'Q', 'R'],
            ['S', 'T', 'U', 'V', 'W', 'X'],
            ['Y', 'Z', '1', '2', '3', '4'],
            ['5', '6', '7', '8', '9', '0']
        ]
    },
    board22: {
        name: "6x6 board 1",
        grid: [
            ['V', 'O', 'J', 'Z', 'D', 'K'],
            ['X', 'S', '6', 'B', '2', 'I'],
            ['Q', 'E', '0', '5', 'M', 'T'],
            ['8', '1', 'F', 'A', '7', '3'],
            ['G', '4', 'N', 'W', 'L', 'P'],
            ['C', 'U', '9', 'Y', 'H', 'R']
        ]
    },
    board7x7: {
        name: "Top left to bottom right (7x7)",
        grid: [
            ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
            ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
            ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
            ['V', 'W', 'X', 'Y', 'Z', '1', '2'],
            ['3', '4', '5', '6', '7', '8', '9'],
            ['0', '@', '#', '$', '%', '&', '*'],
            ['+', '-', '=', '/', '?', '!', '~']
        ]
    },
    centeredRandom7x7: {
        name: "Centered Random (7x7)",
        board: new CenteredRandomBoard(7, 'Y'),
        get grid() {
            return this.board.grid;
        }
    },
    random5x5: {
        name: "Random Board (5x5)",
        get grid() {
            return createRandomGrid(5);
        }
    },
    random4x4: {
        name: "Random Board (4x4)",
        get grid() {
            return createRandomGrid(4);
        }
    },
    random6x6: {
        name: "Random Board (6x6)",
        get grid() {
            return createRandomGrid(6);
        }
    },
    random7x7: {
        name: "Random Board (7x7)",
        get grid() {
            return createRandomGrid(7);
        }
    }
};

export default BOARD_LAYOUTS;