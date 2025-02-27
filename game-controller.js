// game-controller.js
import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer } from './players.js';
import BOARD_LAYOUTS from './boards.js';

class GameController {
    constructor() {
        this.game = this.createNewGame();
        this.players = {
            [PLAYERS.BLACK]: null,
            [PLAYERS.WHITE]: null
        };
        this.setupControls();
    }

    createNewGame() {
        // Get selected board layouts from dropdowns
        const board1Select = document.getElementById('board1-select');
        const board2Select = document.getElementById('board2-select');

        const board1Layout = board1Select ?
            BOARD_LAYOUTS[board1Select.value].grid :
            BOARD_LAYOUTS.board1.grid;

        const board2Layout = board2Select ?
            BOARD_LAYOUTS[board2Select.value].grid :
            BOARD_LAYOUTS.board2.grid;

        const board1Type = board1Select ?
            BOARD_LAYOUTS[board1Select.value].type || 'rect' :
            'rect';

        const board2Type = board2Select ?
            BOARD_LAYOUTS[board2Select.value].type || 'rect' :
            'rect';

        // Create new game instance
        const game = new EntangledGame(
            board1Layout,
            board2Layout,
            '',
            '',
            true,
            board1Type,
            board2Type
        );

        // Dispatch board size change event
        document.dispatchEvent(new CustomEvent('boardSizeChange', {
            detail: {
                size: game.boardSize,
                element: document.querySelector('.board')
            }
        }));

        return game;
    }

    setupControls() {
        const blackSelect = document.getElementById('black-player');
        const whiteSelect = document.getElementById('white-player');
        const startButton = document.getElementById('start-game');

        if (startButton) {
            startButton.addEventListener('click', () => {
                // Reset game with current board selections
                this.game = this.createNewGame();

                // Set up players based on dropdowns
                this.players[PLAYERS.BLACK] = blackSelect.value === 'human' ?
                    null : createPlayer(blackSelect.value, this.game, PLAYERS.BLACK);

                this.players[PLAYERS.WHITE] = whiteSelect.value === 'human' ?
                    null : createPlayer(whiteSelect.value, this.game, PLAYERS.WHITE);

                // Make AI move if AI is playing black
                if (this.players[PLAYERS.BLACK]) {
                    this.makeAIMove();
                }
            });
        }
    }

    makeAIMove() {
        const currentPlayer = this.game.getCurrentPlayer();
        const ai = this.players[currentPlayer];

        if (ai && !this.game.isGameOver()) {
            const move = ai.chooseMove();
            if (move) {
                this.game.makeMove(move);

                // Check if next player is also AI
                const nextPlayer = this.game.getCurrentPlayer();
                if (this.players[nextPlayer]) {
                    // Add small delay for better visualization
                    setTimeout(() => this.makeAIMove(), 500);
                }
            }
        }
    }
}

export { GameController };