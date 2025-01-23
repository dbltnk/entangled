import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer, DeterministicPlayer, RandomPlayer, GreedyPlayer, DefensivePlayer, MinimaxPlayer, MCTSPlayer } from './players.js';

// Map of strategy IDs to their class implementations
const PLAYER_CLASSES = {
    'deterministic': DeterministicPlayer,
    'random': RandomPlayer,
    'greedy': GreedyPlayer,
    'greedy-some-rng': GreedyPlayer,
    'defensive': DefensivePlayer,
    'defensive-some-rng': DefensivePlayer,
    'minimax': MinimaxPlayer,
    'minimax-some-rng': MinimaxPlayer,
    'mcts': MCTSPlayer
};

// Log imports to check what we're getting
console.log('Worker imports:', { createPlayer, PLAYER_CLASSES });

self.onmessage = function (e) {
    const { matchup, boardConfig, matchIndex, aiPlayers } = e.data;

    // Log received data
    console.log('Worker received:', { matchup, aiPlayers });

    // Create game instance with all configuration options
    const game = new EntangledGame(
        boardConfig.board1Layout,
        boardConfig.board2Layout,
        boardConfig.startingConfig,
        boardConfig.superpositionConfig,
        boardConfig.swapRuleEnabled
    );

    // Validate AI configurations are available
    if (!aiPlayers) {
        throw new Error('aiPlayers is not defined in worker message');
    }

    // Validate matchup players exist
    if (!aiPlayers[matchup.black]) {
        throw new Error(`Black player strategy '${matchup.black}' not found in aiPlayers`);
    }
    if (!aiPlayers[matchup.white]) {
        throw new Error(`White player strategy '${matchup.white}' not found in aiPlayers`);
    }

    // Create players with their specific configurations
    // Use provided aiConfigs if available, otherwise use default config from aiPlayers
    const blackConfig = {
        ...aiPlayers[matchup.black].config,
        ...(boardConfig.aiConfigs[matchup.black] || {})
    };
    const whiteConfig = {
        ...aiPlayers[matchup.white].config,
        ...(boardConfig.aiConfigs[matchup.white] || {})
    };

    console.log('Player configs:', {
        black: { strategy: matchup.black, config: blackConfig },
        white: { strategy: matchup.white, config: whiteConfig }
    });

    // Create players using the PLAYER_CLASSES map
    const blackPlayer = new PLAYER_CLASSES[matchup.black](game, PLAYERS.BLACK, blackConfig);
    const whitePlayer = new PLAYER_CLASSES[matchup.white](game, PLAYERS.WHITE, whiteConfig);

    // Track game history
    const history = [];
    let swapOccurred = false;  // Track if a swap happened
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
            superpositionState: game.getSuperpositionState(),
            ...(history.length === 0 && {
                startingConfig: boardConfig.startingConfig,
                superpositionConfig: boardConfig.superpositionConfig,
                swapRuleEnabled: boardConfig.swapRuleEnabled
            })
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
                    swapOccurred = true;  // Mark that a swap happened
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
            swapOccurred,  // Include in result
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