// players.js

import { EntangledGame } from './gameplay.js';

// Define base player class
class EntangledPlayer {
    constructor(gameEngine, playerColor) {
        this.gameEngine = gameEngine;
        this.playerColor = playerColor;
    }

    chooseMove() {
        throw new Error('Strategy not implemented');
    }

    evaluateMove(move) {
        const simGame = new EntangledGame();
        const state = this.gameEngine.getGameState();
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                simGame.board1[i][j] = state.board1[i][j];
                simGame.board2[i][j] = state.board2[i][j];
            }
        }
        simGame.currentPlayer = this.playerColor;
        simGame.makeMove(move);

        const score = simGame.getScore(this.playerColor);
        const board1Score = simGame.findLargestCluster(simGame.board1, this.playerColor);
        const board2Score = simGame.findLargestCluster(simGame.board2, this.playerColor);

        return {
            move,
            totalScore: score,
            board1Score,
            board2Score,
            difference: Math.abs(board1Score - board2Score)
        };
    }
}

// Define all available AI players with their metadata
export const AI_PLAYERS = {
    random: {
        id: 'random',
        name: 'Random',
        description: 'Makes random valid moves',
        implementation: class RandomPlayer extends EntangledPlayer {
            chooseMove() {
                const validMoves = this.gameEngine.getValidMoves();
                return validMoves[Math.floor(Math.random() * validMoves.length)];
            }
        }
    },
    aggressive: {
        id: 'aggressive',
        name: 'Aggressive',
        description: 'Maximizes current turn score',
        implementation: class GreedyHighPlayer extends EntangledPlayer {
            chooseMove() {
                const validMoves = this.gameEngine.getValidMoves();
                return validMoves.reduce((best, move) => {
                    const evaluation = this.evaluateMove(move);
                    if (!best || evaluation.totalScore > this.evaluateMove(best).totalScore) {
                        return move;
                    }
                    return best;
                }, null);
            }
        }
    },
    balanced: {
        id: 'balanced',
        name: 'Balanced',
        description: 'Balances cluster sizes across boards',
        implementation: class GreedyLowPlayer extends EntangledPlayer {
            chooseMove() {
                const validMoves = this.gameEngine.getValidMoves();
                return validMoves.reduce((best, move) => {
                    const evaluation = this.evaluateMove(move);
                    const bestEval = best ? this.evaluateMove(best) : { difference: Infinity, totalScore: -1 };

                    if (evaluation.difference < bestEval.difference ||
                        (evaluation.difference === bestEval.difference &&
                            evaluation.totalScore > bestEval.totalScore)) {
                        return move;
                    }
                    return best;
                }, null);
            }
        }
    },
    defensive: {
        id: 'defensive',
        name: 'Defensive',
        description: 'Considers opponent\'s potential responses',
        implementation: class DefensivePlayer extends EntangledPlayer {
            chooseMove() {
                const validMoves = this.gameEngine.getValidMoves();
                return validMoves.reduce((best, move) => {
                    const ourEvaluation = this.evaluateMove(move);
                    const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
                    const simGame = new EntangledGame();

                    const state = this.gameEngine.getGameState();
                    for (let i = 0; i < 5; i++) {
                        for (let j = 0; j < 5; j++) {
                            simGame.board1[i][j] = state.board1[i][j];
                            simGame.board2[i][j] = state.board2[i][j];
                        }
                    }
                    simGame.currentPlayer = this.playerColor;
                    simGame.makeMove(move);

                    const remainingMoves = simGame.getValidMoves();
                    const worstOpponentScore = remainingMoves.reduce((worst, oppMove) => {
                        simGame.currentPlayer = opponentColor;
                        const oppEval = new EntangledPlayer(simGame, opponentColor).evaluateMove(oppMove);
                        return Math.max(worst, oppEval.totalScore);
                    }, -Infinity);

                    const moveScore = ourEvaluation.totalScore - worstOpponentScore;

                    if (!best || moveScore > best.score) {
                        return { move, score: moveScore };
                    }
                    return best;
                }, null).move;
            }
        }
    }
};

// Factory function to create player instances
export function createPlayer(strategyId, gameEngine, playerColor) {
    const player = AI_PLAYERS[strategyId];
    if (!player) {
        throw new Error(`Unknown strategy: ${strategyId}`);
    }
    return new player.implementation(gameEngine, playerColor);
}