// simulation-worker.js
import { EntangledGame } from './gameplay.js';
import { createPlayer } from './players.js';

self.onmessage = function (e) {
    const { matchup, gameIndex, shouldSaveHistory } = e.data;
    const { player1, player2, asBlack } = matchup;

    const game = new EntangledGame();
    const blackPlayer = createPlayer(asBlack ? player1 : player2, game, 'BLACK');
    const whitePlayer = createPlayer(asBlack ? player2 : player1, game, 'WHITE');

    const gameHistory = shouldSaveHistory ? [] : null;

    while (!game.isGameOver()) {
        const currentPlayer = game.getCurrentPlayer() === 'BLACK' ? blackPlayer : whitePlayer;
        const move = currentPlayer.chooseMove();

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
};