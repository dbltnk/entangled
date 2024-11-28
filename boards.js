// Single source of truth for board layouts and metadata

const getSymbolsForSize = (size) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '@#$%&*+-=/?!~';

    const symbolsNeeded = size * size;

    if (symbolsNeeded <= 26) {
        return letters.slice(0, symbolsNeeded);
    } else if (symbolsNeeded <= 36) {
        return letters + numbers.slice(0, symbolsNeeded - 26);
    } else {
        return letters + numbers + special.slice(0, symbolsNeeded - 36);
    }
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
    board5: {
        name: "white initial stones (5x5)",
        grid: [
            ['Q', 'D', 'H', 'O', 'U'],
            ['J', 'K', 'V', 'S', 'C'],
            ['X', 'R', 'E', 'F', 'L'],
            ['A', 'G', 'N', 'W', 'T'],
            ['M', 'Y', 'P', 'B', 'I']
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
    random: {
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