import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer } from './players.js';

self.onmessage = function (e) {
    const { matchup, boardConfig, matchIndex, aiConfigs } = e.data;

    // Create game instance with all configuration options
    const game = new EntangledGame(
        boardConfig.board1Layout,
        boardConfig.board2Layout,
        boardConfig.startingConfig,
        boardConfig.superpositionConfig,
        boardConfig.swapRuleEnabled
    );

    // Create players with their specific configurations
    const blackConfig = aiConfigs[matchup.black];
    const whiteConfig = aiConfigs[matchup.white];

    const blackPlayer = createPlayer(matchup.black, game, PLAYERS.BLACK, blackConfig);
    const whitePlayer = createPlayer(matchup.white, game, PLAYERS.WHITE, whiteConfig);

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
            swapAvailable: game.isSwapAvailable(),
            superpositionState: game.getSuperpositionState()
        });
    };

    // Record initial state
    recordState();

    // Play the game
    while (!game.isGameOver()) {
        const currentPlayer = game.getCurrentPlayer();
        const player = currentPlayer === PLAYERS.BLACK ? blackPlayer : whitePlayer;

        try {
            // Handle swap decision first
            if (game.isSwapAvailable() && currentPlayer === PLAYERS.WHITE) {
                if (player.shouldSwap()) {
                    game.swapFirstMove();
                    recordState();
                    continue;
                }
            }

            const move = player.chooseMove();
            if (move) {
                game.makeMove(move);
                recordState();
            } else {
                break;
            }
        } catch (error) {
            console.error('Error during game:', error);
            break;
        }
    }

    // Get final stats including detailed tiebreaker info
    const endStats = game.getEndGameStats();

    // Send result back to main thread
    self.postMessage({
        matchup,
        matchIndex,
        result: {
            winner: endStats.tiebreaker.winner,
            blackScore: endStats.scores.black,
            whiteScore: endStats.scores.white,
            history,
            tiebreaker: endStats.tiebreaker,
            clusters: endStats.clusters,
            config: {
                swapRuleEnabled: boardConfig.swapRuleEnabled,
                superpositionConfig: boardConfig.superpositionConfig,
                aiConfigs: {
                    [matchup.black]: blackConfig,
                    [matchup.white]: whiteConfig
                }
            }
        }
    });
};