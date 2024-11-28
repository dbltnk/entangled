// simulation-worker.js
import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer } from './players.js';
import BOARD_LAYOUTS from './boards.js';

// Create a self-contained worker context
const workerContext = self;

// Setup module imports properly for the worker
workerContext.onmessage = async function (e) {
    const { matchup, gameIndex, shouldSaveHistory, aiConfig, boardConfig } = e.data;

    try {
        // Import modules dynamically within the worker
        const gameplayModule = await import('./gameplay.js');
        const playersModule = await import('./players.js');
        const EntangledGame = gameplayModule.EntangledGame;
        const createPlayer = playersModule.createPlayer;

        const { player1, player2 } = matchup;

        // Handle both fixed and random board layouts
        const getLayout = (layoutKey, size) => {
            // For random boards, create a new layout each time
            if (layoutKey.startsWith('random')) {
                return layoutKey === 'random' ?
                    BOARD_LAYOUTS.random.grid :
                    BOARD_LAYOUTS[`random${size}x${size}`].grid;
            }
            return BOARD_LAYOUTS[layoutKey].grid;
        };

        // Get board layouts using the size information
        const size = boardConfig.boardSize || 5;
        const board1Layout = getLayout(boardConfig.board1Layout, size);
        const board2Layout = getLayout(boardConfig.board2Layout, size);

        // Create game with starting configuration
        const game = new EntangledGame(
            board1Layout,
            board2Layout,
            boardConfig?.startingConfig
        );

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
                            largestClusters: state.largestClusters,
                            winner: state.winner,
                            boardConfig: {
                                board1Layout: boardConfig.board1Layout,
                                board2Layout: boardConfig.board2Layout,
                                startingConfig: boardConfig.startingConfig,
                                boardSize: size
                            }
                        }
                    });
                }

                game.makeMove(move);
            }

            // Add final game state to history after last move
            if (shouldSaveHistory) {
                const finalState = game.getGameState();
                gameHistory.push({
                    player: finalState.currentPlayer,
                    move: null,
                    state: {
                        board1: finalState.board1,
                        board2: finalState.board2,
                        currentPlayer: finalState.currentPlayer,
                        largestClusters: finalState.largestClusters,
                        winner: game.getWinner(),
                        boardConfig: {
                            board1Layout: boardConfig.board1Layout,
                            board2Layout: boardConfig.board2Layout,
                            startingConfig: boardConfig.startingConfig,
                            boardSize: size
                        }
                    }
                });
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
                history: gameHistory,
                boardConfig: {
                    ...boardConfig,
                    boardSize: size
                }
            };

            workerContext.postMessage(result);
        } catch (error) {
            throw error;
        }
    } catch (error) {
        // Send error back to main thread
        workerContext.postMessage({
            error: true,
            gameIndex,
            matchup,
            message: error.message,
            stack: error.stack
        });
    }
};