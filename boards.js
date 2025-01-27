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
    board4047117779right: {
        name: "evolved to match A-Z",
        grid: [
            ['S', 'H', 'C', 'K', 'G'],
            ['I', 'E', 'J', 'X', 'B'],
            ['Q', 'D', 'A', 'F', 'P'],
            ['L', 'U', 'T', 'W', 'N'],
            ['M', 'O', 'Y', 'R', 'V'],
        ]
    },
    board23: {
        name: "asymmetric +Z 1",
        grid: [
            ['Y', 'V', 'I', 'E', 'P'],
            ['J', 'A', 'R', 'L', 'X'],
            ['Q', 'N', 'Z', 'F', 'C'],
            ['U', 'H', 'B', 'S', 'O'],
            ['D', 'T', 'K', 'W', 'G']
        ]
    },
    board24: {
        name: "asymmetric +Z 2",
        grid: [
            ['G', 'V', 'I', 'E', 'P'],
            ['J', 'A', 'R', 'L', 'X'],
            ['Q', 'N', 'Z', 'F', 'C'],
            ['U', 'H', 'B', 'S', 'O'],
            ['D', 'T', 'K', 'W', 'Y']
        ]
    },
    board25: {
        name: "asymmetric +Z 3",
        grid: [
            ['J', 'A', 'N', 'W', 'Q'],
            ['P', 'R', 'G', 'E', 'K'],
            ['B', 'O', 'Z', 'S', 'H'],
            ['X', 'I', 'C', 'L', 'Y'],
            ['U', 'F', 'T', 'V', 'D']
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
    minidonutleft: {
        name: "mini donut A-Z",
        grid: [
            ['.', '.', 'A', 'B', '.', '.'],
            ['.', 'C', 'D', 'E', 'F', '.'],
            ['G', 'H', 'I', 'J', 'K', 'L'],
            ['M', 'N', 'O', 'P', 'Q', 'R'],
            ['.', 'S', 'T', 'U', 'V', '.'],
            ['.', '.', 'W', 'X', '.', '.']
        ]
    },
    board3072731079only: {
        name: "mini donut right proximity",
        grid: [
            ['.', '.', 'A', 'E', '.', '.'],
            ['.', 'V', 'S', 'H', 'T', '.'],
            ['J', 'W', 'K', 'B', 'F', 'I'],
            ['P', 'N', 'X', 'D', 'Q', 'O'],
            ['.', 'L', 'M', 'U', 'G', '.'],
            ['.', '.', 'R', 'C', '.', '.'],
        ]
    },
    board3747648197only: {
        name: "mini donut evo righ",
        grid: [
            ['.', '.', 'I', 'B', '.', '.'],
            ['.', 'M', 'E', 'H', 'S', '.'],
            ['O', 'Q', 'L', 'A', 'K', 'W'],
            ['F', 'D', 'G', 'X', 'N', 'J'],
            ['.', 'V', 'U', 'T', 'C', '.'],
            ['.', '.', 'R', 'P', '.', '.'],
        ]
    },
    board6x5: {
        name: "Top left to bottom right (6x5)",
        grid: [
            ['A', 'B', 'C', 'D', 'E', 'F'],
            ['G', 'H', 'I', 'J', 'K', 'L'],
            ['M', 'N', 'O', 'P', 'Q', 'R'],
            ['S', 'T', 'U', 'V', 'W', 'X'],
            ['Y', 'Z', '1', '2', '3', '4'],
            ['.', '.', '.', '.', '.', '.']
        ]
    },
    board6x4: {
        name: "Top left to bottom right (6x4)",
        grid: [
            ['.', '.', '.', '.', '.', '.'],
            ['A', 'B', 'C', 'D', 'E', 'F'],
            ['G', 'H', 'I', 'J', 'K', 'L'],
            ['M', 'N', 'O', 'P', 'Q', 'R'],
            ['S', 'T', 'U', 'V', 'W', 'X'],
            ['.', '.', '.', '.', '.', '.']
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
    donutleft: {
        name: "Donut, left",
        grid: [
            ['.', '.', 'A', 'B', 'C', '.', '.'],
            ['.', 'D', 'E', 'F', 'G', 'H', '.'],
            ['I', 'J', 'K', 'L', 'M', 'N', 'O'],
            ['P', 'Q', 'R', '.', 'S', 'T', 'U'],
            ['V', 'W', 'X', 'Y', 'Z', '1', '2'],
            ['.', '3', '4', '5', '6', '7', '.'],
            ['.', '.', '8', '9', '0', '.', '.']
        ]
    },
    donutright: {
        name: "Donut, right",
        grid: [
            ['.', '.', 'Y', 'M', 'G', '.', '.'],
            ['.', 'F', '1', 'O', 'I', 'T', '.'],
            ['E', '8', '3', '9', 'D', 'W', 'S'],
            ['K', 'A', 'U', '.', 'P', '0', 'Z'],
            ['L', 'N', '7', 'B', 'H', 'C', '6'],
            ['.', 'Q', '2', 'V', 'J', '5', '.'],
            ['.', '.', '4', 'X', 'R', '.', '.']
        ]
    },
    board2494836417right: {
        name: "evolved to match Donut A-Z",
        grid: [
            ['.', '.', 'F', 'O', '5', '.', '.'],
            ['.', 'X', 'K', 'Q', 'Y', 'P', '.'],
            ['G', 'L', '2', '1', '8', 'I', '0'],
            ['A', 'E', '4', '.', '6', 'U', 'T'],
            ['3', 'R', 'D', 'J', 'C', 'V', 'Z'],
            ['.', 'M', '7', '9', 'S', 'B', '.'],
            ['.', '.', 'W', 'H', 'N', '.', '.'],
        ]
    },
    board3568831416only: {
        name: "Proximity donut right",
        grid: [
            ['.', '.', '8', 'W', 'M', '.', '.'],
            ['.', 'U', 'Y', 'E', 'T', '9', '.'],
            ['P', '0', 'O', 'B', '3', 'D', 'C'],
            ['6', 'S', 'I', '.', 'H', '5', 'L'],
            ['2', '4', 'G', '7', 'X', 'F', 'J'],
            ['.', '1', 'Q', 'N', 'V', 'Z', '.'],
            ['.', '.', 'K', 'A', 'R', '.', '.'],
        ]
    },
    board1090660186only: {
        name: "evolved second",
        grid: [
            ['.', '.', '7', 'K', '6', '.', '.'],
            ['.', 'M', 'C', 'E', 'V', 'D', '.'],
            ['R', '9', 'I', '1', 'H', 'Z', '4'],
            ['5', 'B', 'N', '.', '2', '8', 'G'],
            ['T', '3', 'J', 'O', 'P', 'A', 'Q'],
            ['.', 'X', 'F', 'Y', 'L', '0', '.'],
            ['.', '.', 'S', 'W', 'U', '.', '.'],
        ]
    },
    board160120251804: {
        name: "evolved third",
        grid: [
            ['.', '.', '7', 'K', '6', '.', '.'],
            ['.', 'M', 'C', 'E', 'V', 'Z', '.'],
            ['R', '9', 'I', '1', 'H', 'D', '4'],
            ['5', 'B', 'N', '.', '2', '8', 'G'],
            ['T', '3', 'A', 'O', 'P', 'J', 'Q'],
            ['.', 'X', 'F', 'Y', 'L', '0', '.'],
            ['.', '.', 'S', 'W', 'U', '.', '.'],
        ]
    },
    board170120251254: {
        name: "evolved fifth",
        grid: [
            ['.', '.', '1', 'K', '6', '.', '.'],
            ['.', 'M', 'C', 'E', 'V', 'Z', '.'],
            ['R', '9', 'I', '2', 'H', 'D', '4'],
            ['5', 'B', '7', '.', 'O', '8', 'G'],
            ['T', '3', 'A', '0', 'P', 'J', 'Q'],
            ['.', 'X', 'F', 'N', 'U', 'Y', '.'],
            ['.', '.', 'S', 'W', 'L', '.', '.'],
        ]
    },
    board170120251329: {
        name: "evolved sixth",
        grid: [
            ['.', '.', '1', 'K', '6', '.', '.'],
            ['.', 'M', 'U', 'B', 'V', 'Z', '.'],
            ['R', '9', 'I', '2', 'H', 'D', '4'],
            ['5', 'E', '7', '.', 'O', '8', 'G'],
            ['T', '3', 'A', '0', 'P', 'J', 'Q'],
            ['.', 'X', 'F', 'N', 'C', 'Y', '.'],
            ['.', '.', 'S', 'W', 'L', '.', '.'],
        ]
    },
    board170120251435: {
        name: "evolved seventh",
        grid: [
            ['.', '.', '1', 'K', '4', '.', '.'],
            ['.', 'M', 'U', 'B', 'V', 'Z', '.'],
            ['R', '9', 'I', '2', 'H', 'D', '6'],
            ['5', 'E', 'O', '.', '7', '8', 'G'],
            ['T', '3', 'A', '0', 'P', 'J', 'Q'],
            ['.', 'X', 'F', 'N', 'C', 'Y', '.'],
            ['.', '.', 'S', 'W', 'L', '.', '.'],
        ]
    },
    board170120251455: {
        name: "evolved eighth",
        grid: [
            ['.', '.', '1', 'K', '4', '.', '.'],
            ['.', 'M', 'U', 'B', 'V', 'Z', '.'],
            ['R', '9', 'I', '2', 'H', 'D', '6'],
            ['5', 'E', 'O', '.', '7', '8', 'G'],
            ['T', 'J', 'A', '0', 'P', '3', 'Q'],
            ['.', 'X', 'F', 'N', 'C', 'Y', '.'],
            ['.', '.', 'S', 'W', 'L', '.', '.'],
        ]
    },
    board170120251459: {
        name: "evolved ninth",
        grid: [
            ['.', '.', 'M', 'K', '4', '.', '.'],
            ['.', 'F', 'U', 'B', 'V', 'Z', '.'],
            ['R', '9', 'I', '2', 'H', 'D', '6'],
            ['5', 'E', 'O', '.', '7', '8', 'G'],
            ['T', 'J', 'A', '0', 'P', '3', 'Q'],
            ['.', 'X', '1', 'N', 'C', 'Y', '.'],
            ['.', '.', 'S', 'W', 'L', '.', '.'],
        ]
    },
    board220120251955: {
        name: "evolved 8.1",
        grid: [git
        ['.', '.', '1', 'K', '4', '.', '.'],
        ['.', 'M', 'U', 'B', 'V', 'Z', '.'],
        ['R', '9', 'I', '2', 'H', 'D', '6'],
        ['5', 'E', 'O', '.', '3', '8', 'G'],
        ['T', 'J', 'A', '0', 'P', 'F', 'Q'],
        ['.', 'X', '7', 'N', 'C', 'Y', '.'],
        ['.', '.', 'S', 'W', 'L', '.', '.'],
        ]
    },
    board1828771697only: {
        name: "pathfind evo",
        grid: [
            ['.', '.', 'F', 'L', 'T', '.', '.'],
            ['.', 'H', '5', '7', '8', 'G', '.'],
            ['3', 'Z', 'E', '9', '1', 'X', '6'],
            ['U', 'V', 'D', '.', 'P', 'A', 'S'],
            ['Y', 'I', 'W', '0', 'J', 'B', '2'],
            ['.', 'R', 'K', 'O', '4', 'N', '.'],
            ['.', '.', 'Q', 'C', 'M', '.', '.'],
        ]
    },
    circleleft: {
        name: "Circle, left",
        grid: [
            ['.', '.', 'A', 'B', 'C', '.', '.'],
            ['.', 'D', 'E', 'F', 'G', 'H', '.'],
            ['I', 'J', 'K', 'L', 'M', 'N', 'O'],
            ['P', 'Q', 'R', 'S', 'T', 'U', 'V'],
            ['W', 'X', 'Y', 'Z', '1', '2', '3'],
            ['.', '4', '5', '6', '7', '8', '.'],
            ['.', '.', '9', '@', '#', '.', '.']
        ]
    },
    board3511490284right: {
        name: "Circle right evolved",
        grid: [
            ['.', '.', '9', 'V', '#', '.', '.'],
            ['.', 'M', 'N', 'W', 'Z', 'D', '.'],
            ['S', 'T', 'P', 'E', 'A', '8', 'Q'],
            ['3', 'Y', '5', '@', 'X', 'B', 'I'],
            ['O', '7', '6', '2', '4', 'U', 'J'],
            ['.', 'F', 'L', 'C', 'R', 'H', '.'],
            ['.', '.', 'K', '1', 'G', '.', '.'],
        ]
    },

    centeredRandom7x7: {
        name: "Centered Random (7x7)",
        board: new CenteredRandomBoard(7, 'Y'),
        get grid() {
            return this.board.grid;
        }
    },
    random4x4: {
        name: "Random Board (4x4)",
        get grid() {
            return createRandomGrid(4);
        }
    },
    random5x5: {
        name: "Random Board (5x5)",
        get grid() {
            return createRandomGrid(5);
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

export { getSymbolsForSize };
export default BOARD_LAYOUTS;