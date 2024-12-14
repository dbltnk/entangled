import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer } from './players.js';

self.onmessage = function (e) {
    const { matchup, boardConfig, matchIndex } = e.data;

    // Create game instance
    const game = new EntangledGame(
        boardConfig.board1Layout,
        boardConfig.board2Layout,
        boardConfig.startingConfig
    );

    // Create players
    const blackPlayer = createPlayer(matchup.black, game, PLAYERS.BLACK);
    const whitePlayer = createPlayer(matchup.white, game, PLAYERS.WHITE);

    // Play the game
    while (!game.isGameOver()) {
        const currentPlayer = game.getCurrentPlayer();
        const player = currentPlayer === PLAYERS.BLACK ? blackPlayer : whitePlayer;

        try {
            const move = player.chooseMove();
            if (move) {
                game.makeMove(move);
            } else {
                break;
            }
        } catch (error) {
            console.error('Error during game:', error);
            break;
        }
    }

    // Get final scores
    const blackScore = game.getScore(PLAYERS.BLACK);
    const whiteScore = game.getScore(PLAYERS.WHITE);
    let winner;

    if (blackScore > whiteScore) {
        winner = PLAYERS.BLACK;
    } else if (whiteScore > blackScore) {
        winner = PLAYERS.WHITE;
    } else {
        winner = 'TIE';
    }

    // Send result back to main thread
    self.postMessage({
        matchup,
        matchIndex,
        result: {
            winner,
            blackScore,
            whiteScore
        }
    });
};