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
        const simGame = this.simulateGame(this.gameEngine.getGameState());
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

    // Utility method for creating a game simulation
    simulateGame(state) {
        const simGame = new EntangledGame();
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                simGame.board1[i][j] = state.board1[i][j];
                simGame.board2[i][j] = state.board2[i][j];
            }
        }
        simGame.currentPlayer = state.currentPlayer;
        simGame.playerTurns = { ...state.playerTurns };
        simGame.remainingStones = { ...state.remainingStones };
        simGame.gameOver = state.gameOver;
        return simGame;
    }

    // Common evaluation function
    evaluatePosition(game) {
        const myScore = game.getScore(this.playerColor);
        const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
        const opponentScore = game.getScore(opponentColor);

        const centerBonus = this.evaluateCenterControl(game);

        return myScore - opponentScore + centerBonus;
    }

    evaluateCenterControl(game) {
        let bonus = 0;
        const center = 2;
        const centerArea = [
            { row: center, col: center },
            { row: center - 1, col: center },
            { row: center + 1, col: center },
            { row: center, col: center - 1 },
            { row: center, col: center + 1 }
        ];

        for (const pos of centerArea) {
            if (game.board1[pos.row][pos.col] === this.playerColor) bonus += 0.5;
            if (game.board2[pos.row][pos.col] === this.playerColor) bonus += 0.5;
        }

        return bonus;
    }

    // Enhanced evaluation methods that can be used by improved strategies
    evaluateConnectivity(game, board) {
        let value = 0;
        const clusters = game.findLargestClusterCells(board, this.playerColor);

        for (const cluster of clusters) {
            let emptyNeighbors = 0;
            let connectedStones = 0;

            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const newRow = cluster.row + dr;
                    const newCol = cluster.col + dc;

                    if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5) {
                        if (board[newRow][newCol] === null) {
                            emptyNeighbors++;
                        } else if (board[newRow][newCol] === this.playerColor) {
                            connectedStones++;
                        }
                    }
                }
            }

            value += connectedStones * 0.5 + emptyNeighbors * 0.3;
        }

        return value;
    }

    evaluateGrowthPotential(game) {
        return this.evaluateConnectivity(game, game.board1) +
            this.evaluateConnectivity(game, game.board2);
    }
}

// Original Simple Strategies

class RandomPlayer extends EntangledPlayer {
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
}

class GreedyHighPlayer extends EntangledPlayer {
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

class GreedyLowPlayer extends EntangledPlayer {
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

class DefensivePlayer extends EntangledPlayer {
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        return validMoves.reduce((best, move) => {
            const ourEvaluation = this.evaluateMove(move);
            const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
            const simGame = this.simulateGame(this.gameEngine.getGameState());
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

// Enhanced Versions of Original Strategies

class EnhancedGreedyPlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, lookahead = 2) {
        super(gameEngine, playerColor);
        this.lookahead = lookahead;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        return validMoves.reduce((best, move) => {
            const score = this.evaluateMoveWithLookahead(move);
            if (!best || score > best.score) {
                return { move, score };
            }
            return best;
        }, null).move;
    }

    evaluateMoveWithLookahead(move) {
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.makeMove(move);

        if (simGame.isGameOver()) {
            return this.evaluatePosition(simGame);
        }

        let score = this.evaluatePosition(simGame);
        const growthPotential = this.evaluateGrowthPotential(simGame);

        // Look ahead at opponent's best responses
        const opponentMoves = simGame.getValidMoves();
        const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';

        let bestOpponentScore = -Infinity;
        for (const oppMove of opponentMoves) {
            const oppGame = this.simulateGame(simGame.getGameState());
            oppGame.makeMove(oppMove);
            bestOpponentScore = Math.max(bestOpponentScore,
                oppGame.getScore(opponentColor) - oppGame.getScore(this.playerColor));
        }

        return score + growthPotential - (bestOpponentScore * 0.5);
    }
}

class EnhancedBalancedPlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, lookahead = 2) {
        super(gameEngine, playerColor);
        this.lookahead = lookahead;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        let bestMove = null;
        let bestScore = -Infinity;
        let bestBalance = Infinity;

        for (const move of validMoves) {
            const evaluation = this.evaluateBalancedMove(move);

            if (evaluation.balance < bestBalance ||
                (Math.abs(evaluation.balance - bestBalance) < 0.5 &&
                    evaluation.score > bestScore)) {
                bestBalance = evaluation.balance;
                bestScore = evaluation.score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    evaluateBalancedMove(move) {
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.makeMove(move);

        const board1Score = simGame.findLargestCluster(simGame.board1, this.playerColor);
        const board2Score = simGame.findLargestCluster(simGame.board2, this.playerColor);

        const balance = Math.abs(board1Score - board2Score);
        const growthPotential = this.evaluateGrowthPotential(simGame);
        const positionScore = this.evaluatePosition(simGame);

        // Consider opponent's responses if not game over
        let opponentPressure = 0;
        if (!simGame.isGameOver()) {
            const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
            const opponentMoves = simGame.getValidMoves();

            for (const oppMove of opponentMoves) {
                const oppGame = this.simulateGame(simGame.getGameState());
                oppGame.makeMove(oppMove);
                const oppBalance = Math.abs(
                    oppGame.findLargestCluster(oppGame.board1, opponentColor) -
                    oppGame.findLargestCluster(oppGame.board2, opponentColor)
                );
                opponentPressure = Math.max(opponentPressure, oppBalance);
            }
        }

        return {
            balance: balance + (opponentPressure * 0.3),
            score: positionScore + growthPotential
        };
    }
}

class EnhancedDefensivePlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, lookahead = 2) {
        super(gameEngine, playerColor);
        this.lookahead = lookahead;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        return validMoves.reduce((best, move) => {
            const score = this.evaluateDefensiveMove(move);
            if (!best || score > best.score) {
                return { move, score };
            }
            return best;
        }, null).move;
    }

    evaluateDefensiveMove(move) {
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.makeMove(move);

        const immediateScore = this.evaluatePosition(simGame);
        const growthPotential = this.evaluateGrowthPotential(simGame);
        const blockingValue = this.evaluateBlocking(simGame);

        // Consider opponent's responses
        const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
        const opponentMoves = simGame.getValidMoves();
        let opponentBestScore = -Infinity;

        for (const oppMove of opponentMoves) {
            const oppGame = this.simulateGame(simGame.getGameState());
            oppGame.makeMove(oppMove);
            const oppScore = oppGame.getScore(opponentColor);
            const oppGrowth = this.evaluateGrowthPotential(oppGame);
            opponentBestScore = Math.max(opponentBestScore, oppScore + oppGrowth);
        }

        return immediateScore + growthPotential + blockingValue - (opponentBestScore * 0.7);
    }

    evaluateBlocking(game) {
        let value = 0;
        const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';

        for (const board of [game.board1, game.board2]) {
            const opponentClusters = game.findLargestClusterCells(board, opponentColor);

            for (const cluster of opponentClusters) {
                let blockedDirections = 0;
                let openDirections = 0;

                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const newRow = cluster.row + dr;
                        const newCol = cluster.col + dc;

                        if (newRow >= 0 && newRow < 5 && newCol >= 0 && newCol < 5) {
                            if (board[newRow][newCol] === this.playerColor) {
                                blockedDirections++;
                            } else if (board[newRow][newCol] === null) {
                                openDirections++;
                            }
                        }
                    }
                }

                value += blockedDirections * 0.5 - openDirections * 0.2;
            }
        }

        return value;
    }
}

// Minimax and MCTS Players remain the same
class MinimaxPlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, depth = 2) {
        super(gameEngine, playerColor);
        this.depth = depth;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        let bestScore = -Infinity;
        let bestMove = null;

        for (const move of validMoves) {
            const simGame = this.simulateGame(this.gameEngine.getGameState());
            simGame.makeMove(move);
            const score = this.minimax(simGame, this.depth - 1, false, -Infinity, Infinity);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    minimax(game, depth, isMaximizing, alpha, beta) {
        if (depth === 0 || game.isGameOver()) {
            return this.evaluatePosition(game);
        }

        const validMoves = game.getValidMoves();

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of validMoves) {
                const simGame = this.simulateGame(game.getGameState());
                simGame.makeMove(move);
                const score = this.minimax(simGame, depth - 1, false, alpha, beta);
                maxScore = Math.max(maxScore, score);
                alpha = Math.max(alpha, score);
                if (beta <= alpha) break;
            }
            return maxScore;
        } else {
            let minScore = Infinity;
            for (const move of validMoves) {
                const simGame = this.simulateGame(game.getGameState());
                simGame.makeMove(move);
                const score = this.minimax(simGame, depth - 1, true, alpha, beta);
                minScore = Math.min(minScore, score);
                beta = Math.min(beta, score);
                if (beta <= alpha) break;
            }
            return minScore;
        }
    }
}

class MCTSPlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, simulationCount = 100) {
        super(gameEngine, playerColor);
        this.simulationCount = simulationCount;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveScores = new Map();

        for (const move of validMoves) {
            let totalScore = 0;

            for (let i = 0; i < this.simulationCount; i++) {
                const simGame = this.simulateGame(this.gameEngine.getGameState());
                simGame.makeMove(move);
                totalScore += this.playRandomGame(simGame);
            }

            moveScores.set(move, totalScore / this.simulationCount);
        }

        let bestMove = validMoves[0];
        let bestScore = moveScores.get(bestMove);

        for (const [move, score] of moveScores) {
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    playRandomGame(game) {
        const simGame = this.simulateGame(game.getGameState());

        while (!simGame.isGameOver()) {
            const moves = simGame.getValidMoves();
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            simGame.makeMove(randomMove);
        }

        return this.evaluatePosition(simGame);
    }
}

// Define all available AI players with their metadata
export const AI_PLAYERS = {
    random: {
        id: 'random',
        name: 'Random',
        description: 'Makes random valid moves',
        implementation: RandomPlayer
    },
    aggressive: {
        id: 'aggressive',
        name: 'Aggressive',
        description: 'Maximizes current turn score',
        implementation: GreedyHighPlayer
    },
    balanced: {
        id: 'balanced',
        name: 'Balanced',
        description: 'Balances cluster sizes across boards',
        implementation: GreedyLowPlayer
    },
    defensive: {
        id: 'defensive',
        name: 'Defensive',
        description: 'Considers opponent\'s potential responses',
        implementation: DefensivePlayer
    },
    enhancedAggressive: {
        id: 'enhancedAggressive',
        name: 'Enhanced Aggressive',
        description: 'Advanced aggressive strategy with lookahead',
        implementation: EnhancedGreedyPlayer
    },
    enhancedBalanced: {
        id: 'enhancedBalanced',
        name: 'Enhanced Balanced',
        description: 'Advanced balanced strategy with lookahead',
        implementation: EnhancedBalancedPlayer
    },
    enhancedDefensive: {
        id: 'enhancedDefensive',
        name: 'Enhanced Defensive',
        description: 'Advanced defensive strategy with lookahead',
        implementation: EnhancedDefensivePlayer
    },
    minimax: {
        id: 'minimax',
        name: 'Minimax',
        description: 'Uses minimax algorithm with alpha-beta pruning',
        implementation: MinimaxPlayer
    },
    mcts: {
        id: 'mcts',
        name: 'Monte Carlo',
        description: 'Uses Monte Carlo Tree Search simulation',
        implementation: MCTSPlayer
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