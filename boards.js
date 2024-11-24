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
    random: {
        name: "Random Board",
        get grid() {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');
            // Shuffle the letters array randomly
            for (let i = letters.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [letters[i], letters[j]] = [letters[j], letters[i]];
            }
            // Create a 5x5 grid from the shuffled letters
            const grid = [];
            for (let row = 0; row < 5; row++) {
                grid.push(letters.slice(row * 5, row * 5 + 5));
            }
            return grid;
        }
    }
};

export default BOARD_LAYOUTS;
