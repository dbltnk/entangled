// Single source of truth for board layouts and metadata

const BOARD_LAYOUTS = {
    board1: {
        name: "Top left to bottom right",
        grid: [
            ['A', 'B', 'C', 'D', 'E'],
            ['F', 'G', 'H', 'I', 'J'],
            ['K', 'L', 'M', 'N', 'O'],
            ['P', 'Q', 'R', 'S', 'T'],
            ['U', 'V', 'W', 'X', 'Y']
        ]
    },
    board2: {
        name: "Knight's Jump",
        grid: [
            ['Y', 'C', 'F', 'N', 'Q'],
            ['K', 'S', 'V', 'E', 'H'],
            ['B', 'J', 'M', 'P', 'X'],
            ['R', 'U', 'D', 'G', 'O'],
            ['I', 'L', 'T', 'W', 'A']
        ]
    },
    board3: {
        name: "Ali 24/11/2024",
        grid: [
            ['L', 'W', 'I', 'T', 'A'],
            ['D', 'O', 'U', 'G', 'R'],
            ['P', 'B', 'M', 'X', 'J'],
            ['H', 'S', 'E', 'K', 'V'],
            ['Y', 'F', 'Q', 'C', 'N']
        ]
    },
    board4: {
        name: "asymmetric",
        grid: [
            ['P', 'Y', 'N', 'C', 'G'],
            ['D', 'H', 'Q', 'U', 'O'],
            ['V', 'K', 'E', 'I', 'R'],
            ['J', 'S', 'W', 'L', 'A'],
            ['M', 'B', 'F', 'T', 'X']
        ]
    },
    board5: {
        name: "white initial stones",
        grid: [
            ['Q', 'D', 'H', 'O', 'U'],
            ['J', 'K', 'V', 'S', 'C'],
            ['X', 'R', 'E', 'F', 'L'],
            ['A', 'G', 'N', 'W', 'T'],
            ['M', 'Y', 'P', 'B', 'I']
        ]
    },
    random: {
        name: "Random Board",
        get grid() {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');
            // Shuffle all letters randomly
            for (let i = letters.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [letters[i], letters[j]] = [letters[j], letters[i]];
            }

            // Create a 5x5 grid
            const grid = [];
            let letterIndex = 0;
            for (let row = 0; row < 5; row++) {
                const gridRow = [];
                for (let col = 0; col < 5; col++) {
                    gridRow.push(letters[letterIndex]);
                    letterIndex++;
                }
                grid.push(gridRow);
            }
            return grid;
        }
    }
};

export default BOARD_LAYOUTS;