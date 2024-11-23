// simulation-worker.js
import { EntangledGame } from './gameplay.js';
import { createPlayer } from './players.js';

self.onmessage = function (e) {
    const { matchup, gameIndex, shouldSaveHistory, aiConfig } = e.data;
    const { player1, player2 } = matchup;

    const game = new EntangledGame();

    // Create players with AI configuration
    const player1Config = aiConfig[player1] || {};
    const player2Config = aiConfig[player2] || {};

    const blackPlayer = createPlayer(player1, game, 'BLACK', player1Config);
    const whitePlayer = createPlayer(player2, game, 'WHITE', player2Config);

    const gameHistory = shouldSaveHistory ? [] : null;

    try {
        while (!game.isGameOver()) {
            const currentPlayer = game.getCurrentPlayer() === 'BLACK' ? blackPlayer : whitePlayer;
            const move = currentPlayer.chooseMove();

            if (!move) {
                throw new Error(`Player ${currentPlayer.playerColor} returned null move`);
            }

            if (!game.isValidMove(move)) {
                throw new Error(`Player ${currentPlayer.playerColor} attempted invalid move: ${move}`);
            }

            if (shouldSaveHistory) {
                const state = game.getGameState();
                gameHistory.push({
                    player: game.getCurrentPlayer(),
                    move,
                    state: {
                        board1: state.board1,
                        board2: state.board2,
                        currentPlayer: state.currentPlayer,
                        largestClusters: state.largestClusters
                    }
                });
            }

            game.makeMove(move);
        }

        const finalState = game.getGameState();
        const result = {
            gameIndex,
            matchup,
            winner: game.getWinner(),
            finalScore: {
                black: game.getScore('BLACK'),
                white: game.getScore('WHITE')
            },
            moves: finalState.playerTurns.BLACK + finalState.playerTurns.WHITE,
            largestClusters: finalState.largestClusters,
            history: gameHistory
        };

        self.postMessage(result);
    } catch (error) {
        // Send error back to main thread
        self.postMessage({
            error: true,
            gameIndex,
            matchup,
            message: error.message,
            stack: error.stack
        });
    }
};  