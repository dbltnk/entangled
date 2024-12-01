// players.js
import { EntangledGame } from './gameplay.js';

// Define base player class
class EntangledPlayer {
    constructor(gameEngine, playerColor, config = {}) {
        this.gameEngine = gameEngine;
        this.playerColor = playerColor;
        this.randomize = config.randomize || false;
        this.randomThreshold = config.randomThreshold || 0.1;
    }

    randomizeChoice(moves, scores) {
        if (!moves || moves.length === 0) {
            return null;
        }

        // Ensure we have valid scores array matching moves
        if (!scores || scores.length !== moves.length) {
            return moves[0];
        }

        if (!this.randomize) {
            // When not randomizing, find and return the move with the highest score
            let bestScore = scores[0];
            let bestMoveIndex = 0;

            for (let i = 1; i < scores.length; i++) {
                if (scores[i] > bestScore) {
                    bestScore = scores[i];
                    bestMoveIndex = i;
                }
            }

            return moves[bestMoveIndex];
        }

        // Find best score
        const bestScore = Math.max(...scores);

        // Filter valid moves within threshold
        const viableMoves = moves.filter((move, i) => {
            // Protect against NaN or invalid scores
            if (typeof scores[i] !== 'number' || isNaN(scores[i])) {
                return false;
            }
            return bestScore - scores[i] <= this.randomThreshold * Math.abs(bestScore);
        });

        // If no viable moves found, return first valid move
        if (viableMoves.length === 0) {
            return moves[0];
        }

        // Select random viable move
        const randomIndex = Math.floor(Math.random() * viableMoves.length);
        return viableMoves[randomIndex];
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        if (!validMoves || validMoves.length === 0) {
            return null;
        }
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

    simulateGame(state) {
        if (!state || !state.board1 || !state.board2) return null;

        const simGame = new EntangledGame(this.gameEngine.board1Layout, this.gameEngine.board2Layout);
        for (let i = 0; i < state.board1.length; i++) {
            for (let j = 0; j < state.board1[i].length; j++) {
                simGame.board1[i][j] = state.board1[i][j];
                simGame.board2[i][j] = state.board2[i][j];
            }
        }
        simGame.currentPlayer = state.currentPlayer;
        simGame.playerTurns = { ...state.playerTurns };
        simGame.remainingStones = { ...state.remainingStones };
        simGame.gameOver = state.gameOver;
        simGame.symbolToPosition = new Map(this.gameEngine.symbolToPosition);
        return simGame;
    }

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

class DeterministicPlayer extends EntangledPlayer {
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        return validMoves[0];
    }
}

class RandomPlayer extends EntangledPlayer {
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        return validMoves[randomIndex];
    }
}

class GreedyHighPlayer extends EntangledPlayer {
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => ({
            move,
            score: this.evaluateMove(move).totalScore
        }));

        moveEvaluations.sort((a, b) => b.score - a.score);

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }
}

class GreedyLowPlayer extends EntangledPlayer {
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => {
            const moveEval = this.evaluateMove(move);
            return {
                move,
                score: -moveEval.difference + (moveEval.totalScore * 0.001) // Small weight for total score as tiebreaker
            };
        });

        moveEvaluations.sort((a, b) => b.score - a.score);

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }
}

class DefensivePlayer extends EntangledPlayer {
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => {
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

            return {
                move,
                score: ourEvaluation.totalScore - worstOpponentScore
            };
        });

        moveEvaluations.sort((a, b) => b.score - a.score);

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }
}

class EnhancedGreedyPlayer extends EntangledPlayer {
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => ({
            move,
            score: this.evaluateMoveWithLookahead(move)
        }));

        moveEvaluations.sort((a, b) => b.score - a.score);

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }

    evaluateMoveWithLookahead(move) {
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.makeMove(move);

        if (simGame.isGameOver()) {
            return this.evaluatePosition(simGame);
        }

        let score = this.evaluatePosition(simGame);
        const growthPotential = this.evaluateGrowthPotential(simGame);

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
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => {
            const evaluation = this.evaluateBalancedMove(move);
            return {
                move,
                score: -evaluation.balance + (evaluation.score * 0.001)
            };
        });

        moveEvaluations.sort((a, b) => b.score - a.score);

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }

    evaluateBalancedMove(move) {
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.makeMove(move);

        const board1Score = simGame.findLargestCluster(simGame.board1, this.playerColor);
        const board2Score = simGame.findLargestCluster(simGame.board2, this.playerColor);

        const balance = Math.abs(board1Score - board2Score);
        const growthPotential = this.evaluateGrowthPotential(simGame);
        const positionScore = this.evaluatePosition(simGame);

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
    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => ({
            move,
            score: this.evaluateDefensiveMove(move)
        }));

        moveEvaluations.sort((a, b) => b.score - a.score);

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }

    evaluateDefensiveMove(move) {
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.makeMove(move);

        const immediateScore = this.evaluatePosition(simGame);
        const growthPotential = this.evaluateGrowthPotential(simGame);
        const blockingValue = this.evaluateBlocking(simGame);

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

class MinimaxPlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, config = {}) {
        super(gameEngine, playerColor, config);
        this.lookahead = config.lookahead || 2;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => {
            const simGame = this.simulateGame(this.gameEngine.getGameState());
            simGame.makeMove(move);
            return {
                move,
                score: this.minimax(simGame, this.lookahead - 1, false, -Infinity, Infinity)
            };
        });

        moveEvaluations.sort((a, b) => b.score - a.score);

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }

    minimax(game, depth, isMaximizing, alpha, beta) {
        if (depth === 0 || game.isGameOver()) {
            return this.evaluatePosition(game);
        }

        const validMoves = game.getValidMoves();

        if (!validMoves || validMoves.length === 0) {
            return this.evaluatePosition(game);
        }

        if (isMaximizing) {
            let maxScore = -Infinity;
            for (const move of validMoves) {
                const simGame = this.simulateGame(game.getGameState());
                simGame.currentPlayer = this.playerColor;
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
                const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
                simGame.currentPlayer = opponentColor;
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
    constructor(gameEngine, playerColor, config = {}) {
        super(gameEngine, playerColor, config);
        this.simulationCount = config.simulationCount || 100;
    }

    chooseMove() {
        const startTime = performance.now();
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => {
            let totalScore = 0;

            for (let i = 0; i < this.simulationCount; i++) {
                const simGame = this.simulateGame(this.gameEngine.getGameState());
                try {
                    simGame.makeMove(move);
                    totalScore += this.playRandomGame(simGame);
                } catch (error) {
                    console.error('Simulation error:', error);
                    totalScore -= 1000; // Penalize invalid moves
                }
            }

            return {
                move,
                score: totalScore / this.simulationCount
            };
        });

        moveEvaluations.sort((a, b) => b.score - a.score);

        const selectedMove = this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );

        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`MCTS agent (${this.playerColor}) turn took ${duration.toFixed(2)} milliseconds.`);

        return selectedMove;
    }

    playRandomGame(game) {
        const simGame = this.simulateGame(game.getGameState());

        while (!simGame.isGameOver()) {
            const moves = simGame.getValidMoves();
            if (!moves || moves.length === 0) {
                break; // End simulation if no valid moves
            }

            try {
                const randomMove = moves[Math.floor(Math.random() * moves.length)];
                if (!simGame.isValidMove(randomMove)) {
                    break; // End simulation if selected move is invalid
                }
                simGame.makeMove(randomMove);
            } catch (error) {
                console.error('Random play error:', error);
                break; // End simulation on error
            }
        }

        return this.evaluatePosition(simGame);
    }
}

export const AI_PLAYERS = {
    random: {
        id: 'random',
        name: 'Fully Random',
        description: 'Makes random valid moves',
        implementation: RandomPlayer
    },
    deterministic: {
        id: 'deterministic',
        name: 'A-to-Z Deterministic',
        description: 'Always uses the first available move',
        implementation: DeterministicPlayer
    },
    'aggressive-no-rng': {
        id: 'aggressive-no-rng',
        name: 'Greedy (no-rng)',
        description: 'Maximizes current turn score',
        implementation: GreedyHighPlayer,
        defaultConfig: {
            randomize: false,
            randomThreshold: 0.1
        }
    },
    'aggressive-some-rng': {
        id: 'aggressive-some-rng',
        name: 'Greedy (some-rng)',
        description: 'Maximizes current turn score with randomization',
        implementation: GreedyHighPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1
        }
    },
    //'balanced-no-rng': {
    //    id: 'balanced-no-rng',
    //    name: 'Greedy Low AI (no-rng)',
    //    description: 'Balances cluster sizes across boards',
    //    implementation: GreedyLowPlayer,
    //    defaultConfig: {
    //        randomize: false,
    //        randomThreshold: 0.1
    //    }
    //},
    //'balanced-some-rng': {
    //    id: 'balanced-some-rng',
    //    name: 'Greedy Low AI (some-rng)',
    //    description: 'Balances cluster sizes across boards with randomization',
    //    implementation: GreedyLowPlayer,
    //    defaultConfig: {
    //        randomize: true,
    //        randomThreshold: 0.1
    //    }
    //},
    'defensive-no-rng': {
        id: 'defensive-no-rng',
        name: 'Defensive (no-rng)',
        description: 'Considers opponent\'s potential responses',
        implementation: DefensivePlayer,
        defaultConfig: {
            randomize: false,
            randomThreshold: 0.1
        }
    },
    'defensive-some-rng': {
        id: 'defensive-some-rng',
        name: 'Defensive (some-rng)',
        description: 'Considers opponent\'s potential responses with randomization',
        implementation: DefensivePlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1
        }
    },
    //'enhancedAggressive-no-rng': {
    //    id: 'enhancedAggressive-no-rng',
    //    name: 'Enhanced Greedy AI (no-rng)',
    //    description: 'Advanced aggressive strategy with lookahead',
    //    implementation: EnhancedGreedyPlayer,
    //    defaultConfig: {
    //        randomize: false,
    //        randomThreshold: 0.1,
    //        lookahead: 10
    //    }
    //},
    //'enhancedAggressive-some-rng': {
    //    id: 'enhancedAggressive-some-rng',
    //    name: 'Enhanced Greedy AI (some-rng)',
    //    description: 'Advanced aggressive strategy with lookahead and randomization',
    //    implementation: EnhancedGreedyPlayer,
    //    defaultConfig: {
    //        randomize: true,
    //        randomThreshold: 0.1,
    //        lookahead: 10
    //    }
    //},
    //'enhancedBalanced-no-rng': {
    //    id: 'enhancedBalanced-no-rng',
    //    name: 'Enhanced Balanced AI (no-rng)',
    //    description: 'Advanced balanced strategy with lookahead',
    //    implementation: EnhancedBalancedPlayer,
    //    defaultConfig: {
    //        randomize: false,
    //        randomThreshold: 0.1,
    //        lookahead: 10
    //    }
    //},
    //'enhancedBalanced-some-rng': {
    //    id: 'enhancedBalanced-some-rng',
    //    name: 'Enhanced Balanced AI (some-rng)',
    //    description: 'Advanced balanced strategy with lookahead and randomization',
    //    implementation: EnhancedBalancedPlayer,
    //    defaultConfig: {
    //        randomize: true,
    //        randomThreshold: 0.1,
    //          lookahead: 10
    //    }
    //},
    //'enhancedDefensive-no-rng': {
    //    id: 'enhancedDefensive-no-rng',
    //    name: 'Enhanced Defensive AI (no-rng)',
    //    description: 'Advanced defensive strategy with lookahead',
    //    implementation: EnhancedDefensivePlayer,
    //    defaultConfig: {
    //        randomize: false,
    //        randomThreshold: 0.1,
    //        lookahead: 10
    //    }
    //},
    //'enhancedDefensive-some-rng': {
    //    id: 'enhancedDefensive-some-rng',
    //    name: 'Enhanced Defensive AI (some-rng)',
    //    description: 'Advanced defensive strategy with lookahead and randomization',
    //    implementation: EnhancedDefensivePlayer,
    //    defaultConfig: {
    //        randomize: true,
    //        randomThreshold: 0.1,
    //        lookahead: 10
    //    }
    //},
    'minimax-no-rng': {
        id: 'minimax-no-rng',
        name: 'Minimax (no-rng)',
        description: 'Uses minimax algorithm with alpha-beta pruning',
        implementation: MinimaxPlayer,
        defaultConfig: {
            randomize: false,
            randomThreshold: 0.1,
            lookahead: 4
        }
    },
    'minimax-some-rng': {
        id: 'minimax-some-rng',
        name: 'Minimax (some-rng)',
        description: 'Uses minimax algorithm with alpha-beta pruning and randomization',
        implementation: MinimaxPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1,
            lookahead: 4
        }
    },
    'mcts': {
        id: 'mcts',
        name: 'Monte Carlo Tree Search',
        description: 'Uses Monte Carlo Tree Search simulation with randomization',
        implementation: MCTSPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1,
            simulationCount: 300
        }
    }
};

export function createPlayer(strategyId, gameEngine, playerColor, config = {}) {
    const player = AI_PLAYERS[strategyId];
    if (!player) {
        throw new Error(`Unknown strategy: ${strategyId}`);
    }

    // Merge default config with provided config
    const finalConfig = {
        ...player.defaultConfig,
        ...config
    };

    return new player.implementation(gameEngine, playerColor, finalConfig);
}
