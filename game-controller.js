import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer } from './players.js';

class GameController {
    constructor() {
        this.game = new EntangledGame();
        this.players = {
            [PLAYERS.BLACK]: null,
            [PLAYERS.WHITE]: null
        };
        this.setupControls();
    }

    setupControls() {
        const blackSelect = document.getElementById('black-player');
        const whiteSelect = document.getElementById('white-player');
        const startButton = document.getElementById('start-game');

        if (startButton) {
            startButton.addEventListener('click', () => {
                // Reset game
                this.game = new EntangledGame();

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