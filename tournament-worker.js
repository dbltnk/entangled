import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer } from './players.js';

self.onmessage = function (e) {
    const { matchup, boardConfig, matchIndex } = e.data;

    // Create game instance
    const game = new EntangledGame(
        boardConfig.board1Layout,
        boardConfig.board2Layout,
        boardConfig.startingConfig,
        boardConfig.cutTheCake
    );

    // Create players
    const blackPlayer = createPlayer(matchup.black, game, PLAYERS.BLACK);
    const whitePlayer = createPlayer(matchup.white, game, PLAYERS.WHITE);

    // Track game history
    const history = [];
    const recordState = () => {
        const state = game.getGameState();
        history.push({
            move: history.length > 0 ? state.lastMove : null,
            board1: state.board1,
            board2: state.board2,
            currentPlayer: state.currentPlayer,
            blackScore: game.getScore(PLAYERS.BLACK),
            whiteScore: game.getScore(PLAYERS.WHITE),
            largestClusters: state.largestClusters,
            board1Layout: boardConfig.board1Layout,
            board2Layout: boardConfig.board2Layout,
            colorsSwapped: state.colorsSwapped
        });
    };

    // Record initial state
    recordState();

    // Play the game
    let gameError = null;
    while (!game.isGameOver()) {
        const currentPlayer = game.getCurrentPlayer();
        const player = currentPlayer === PLAYERS.BLACK ? blackPlayer : whitePlayer;

        const move = player.chooseMove();
        if (!move) {
            console.error(`[Game Error] Player ${currentPlayer} (${player.constructor.name}) returned null move`);
            continue;
        }

        try {
            game.makeMove(move);
        } catch (error) {
            console.error(`[Game Error] Player ${currentPlayer} (${player.constructor.name}) error:`, error.message);
            console.error(`[Game Error] Move details:`, {
                player: currentPlayer,
                playerType: player.constructor.name,
                lastMove: game.getGameState().lastMove,
                validMoves: game.getValidMoves(),
                gameState: game.getGameState()
            });
            continue;
        }

        recordState();
    }

    // Get final stats including detailed tiebreaker info
    const endStats = gameError ? {
        tiebreaker: {
            winner: null,
            reason: 'invalid_move'
        },
        scores: {
            black: game.getScore(PLAYERS.BLACK),
            white: game.getScore(PLAYERS.WHITE)
        },
        clusters: {
            black: {
                board1: game.findLargestCluster(game.board1, PLAYERS.BLACK),
                board2: game.findLargestCluster(game.board2, PLAYERS.BLACK)
            },
            white: {
                board1: game.findLargestCluster(game.board1, PLAYERS.WHITE),
                board2: game.findLargestCluster(game.board2, PLAYERS.WHITE)
            }
        }
    } : game.getEndGameStats();

    // Send result back to main thread
    self.postMessage({
        matchup,
        matchIndex,
        result: {
            winner: endStats.tiebreaker.winner || 'ERROR',
            blackScore: endStats.scores.black,
            whiteScore: endStats.scores.white,
            history,
            tiebreaker: endStats.tiebreaker,
            clusters: endStats.clusters,
            cutTheCakeEnabled: boardConfig.cutTheCake,
            colorsSwapped: game.getGameState().colorsSwapped,
            error: gameError ? gameError.message : null
        }
    });
};