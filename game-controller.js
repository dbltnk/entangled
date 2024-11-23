// game-controller.js

import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer, AI_PLAYERS } from './players.js';

class GameController {
    constructor() {
        this.game = new EntangledGame();
        this.players = {
            [PLAYERS.BLACK]: null,
            [PLAYERS.WHITE]: null
        };
        this.isAIGame = false;
        this.setupAIControls();
    }

    setupAIControls() {
        const aiControls = document.getElementById('ai-controls');
        if (!aiControls) return;

        // Create strategy buttons using AI_PLAYERS definitions
        const strategyContainer = aiControls.querySelector('.strategy-buttons') ||
            aiControls.appendChild(document.createElement('div'));
        strategyContainer.className = 'strategy-buttons';
        strategyContainer.innerHTML = '';

        Object.values(AI_PLAYERS).forEach(player => {
            const button = document.createElement('button');
            button.setAttribute('data-strategy', player.id);
            button.title = player.description;
            button.textContent = player.name;
            button.addEventListener('click', () => this.setAIStrategy(player.id));
            strategyContainer.appendChild(button);
        });

        // Color selection
        const blackButton = aiControls.querySelector('button[data-color="black"]');
        const whiteButton = aiControls.querySelector('button[data-color="white"]');
        if (blackButton) blackButton.addEventListener('click', () => this.setPlayerColor(PLAYERS.BLACK));
        if (whiteButton) whiteButton.addEventListener('click', () => this.setPlayerColor(PLAYERS.WHITE));

        // Add AI mode toggle
        const humanVsAI = document.querySelector('button[data-mode="human-vs-ai"]');
        if (humanVsAI) {
            humanVsAI.addEventListener('click', () => {
                this.isAIGame = true;
                aiControls.style.display = 'block';
            });
        }

        const humanVsHuman = document.querySelector('button[data-mode="human-vs-human"]');
        if (humanVsHuman) {
            humanVsHuman.addEventListener('click', () => {
                this.isAIGame = false;
                aiControls.style.display = 'none';
                this.players = {
                    [PLAYERS.BLACK]: null,
                    [PLAYERS.WHITE]: null
                };
            });
        }
    }

    setAIStrategy(strategyId) {
        const aiColor = this.players[PLAYERS.BLACK] ? PLAYERS.WHITE : PLAYERS.BLACK;
        this.players[aiColor] = createPlayer(strategyId, this.game, aiColor);
        if (this.game.getCurrentPlayer() === aiColor) {
            this.makeAIMove();
        }
    }

    setPlayerColor(color) {
        const aiColor = color === PLAYERS.BLACK ? PLAYERS.WHITE : PLAYERS.BLACK;
        const currentAI = this.players[aiColor];
        const strategyId = currentAI ?
            Object.keys(AI_PLAYERS).find(key => this.players[aiColor] instanceof AI_PLAYERS[key].implementation) :
            'random';

        this.players[aiColor] = createPlayer(strategyId, this.game, aiColor);
        this.players[color] = null; // Human player

        if (this.game.getCurrentPlayer() === aiColor) {
            this.makeAIMove();
        }
    }

    makeAIMove() {
        const currentPlayer = this.game.getCurrentPlayer();
        const ai = this.players[currentPlayer];

        if (ai && !this.game.isGameOver()) {
            const move = ai.chooseMove();
            if (move) {
                this.game.makeMove(move);
            }
        }
    }
}

export { GameController };