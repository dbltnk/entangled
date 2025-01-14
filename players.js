// players.js
import { EntangledGame } from './gameplay.js';

// Define base player class
class EntangledPlayer {
    constructor(gameEngine, playerColor, config = {}) {
        this.gameEngine = gameEngine;
        this.playerColor = playerColor;
        this.randomize = config.randomize;
        this.randomThreshold = config.randomThreshold;
    }

    // Add new method to evaluate whether to swap colors
    evaluateColorSwap() {
        if (!this.gameEngine.getGameState().canSwapColors) {
            return false;
        }

        try {
            // Evaluate current position from both perspectives
            const currentScore = this.evaluatePosition(this.gameEngine);

            // Simulate swapping colors
            const simGame = this.simulateGame(this.gameEngine.getGameState());
            simGame.swapColors();
            const swappedScore = -this.evaluatePosition(simGame); // Negate because we're evaluating from opposite perspective

            return swappedScore > currentScore;
        } catch (error) {
            console.error('Error evaluating color swap:', error);
            return false;  // Default to not swapping if there's an error
        }
    }

    // Add new method to decide whether to swap colors
    decideColorSwap() {
        if (!this.gameEngine.getGameState().canSwapColors) {
            return false;
        }

        try {
            // Evaluate current position
            const currentGame = this.simulateGame(this.gameEngine.getGameState());
            const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';

            // Evaluate current position using our normal evaluation logic
            const currentValidMoves = currentGame.getValidMoves();
            const currentBestScore = currentValidMoves.reduce((best, move) => {
                const simGame = this.simulateGame(currentGame.getGameState());
                simGame.currentPlayer = this.playerColor;
                simGame.makeMove(move);

                const ourScore = simGame.getScore(this.playerColor);
                const remainingMoves = simGame.getValidMoves();
                const worstOpponentScore = remainingMoves.reduce((worst, oppMove) => {
                    simGame.currentPlayer = opponentColor;
                    const oppEval = new EntangledPlayer(simGame, opponentColor).evaluateMove(oppMove);
                    return Math.max(worst, oppEval.totalScore);
                }, -Infinity);

                return Math.max(best, ourScore - worstOpponentScore);
            }, -Infinity);

            // Now evaluate swapped position
            const swappedGame = this.simulateGame(this.gameEngine.getGameState());
            swappedGame.canSwapColors = true;
            swappedGame.swapColors();

            // Evaluate swapped position using same logic
            const swappedValidMoves = swappedGame.getValidMoves();
            const swappedBestScore = swappedValidMoves.reduce((best, move) => {
                const simGame = this.simulateGame(swappedGame.getGameState());
                simGame.currentPlayer = this.playerColor;
                simGame.makeMove(move);

                const ourScore = simGame.getScore(this.playerColor);
                const remainingMoves = simGame.getValidMoves();
                const worstOpponentScore = remainingMoves.reduce((worst, oppMove) => {
                    simGame.currentPlayer = opponentColor;
                    const oppEval = new EntangledPlayer(simGame, opponentColor).evaluateMove(oppMove);
                    return Math.max(worst, oppEval.totalScore);
                }, -Infinity);

                return Math.max(best, ourScore - worstOpponentScore);
            }, -Infinity);

            return swappedBestScore > currentBestScore;
        } catch (error) {
            console.error('Error in defensive player color swap evaluation:', error);
            return false;  // Default to not swapping if there's an error
        }
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
        // First check if we can swap colors
        if (this.gameEngine.getGameState().canSwapColors) {
            if (this.decideColorSwap()) {
                return 'swap';
            }
        }

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
        simGame.gameOver = state.gameOver;
        simGame.symbolToPosition = new Map(this.gameEngine.symbolToPosition);
        simGame._lastMove = state.lastMove;
        simGame.canSwapColors = state.canSwapColors;
        simGame.colorsSwapped = state.colorsSwapped;
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
        const center = Math.floor(game.boardSize / 2);
        const centerArea = [
            { row: center, col: center },
            { row: center - 1, col: center },
            { row: center + 1, col: center },
            { row: center, col: center - 1 },
            { row: center, col: center + 1 }
        ];

        for (const pos of centerArea) {
            if (pos.row >= 0 && pos.row < game.boardSize && pos.col >= 0 && pos.col < game.boardSize) {
                if (game.board1[pos.row][pos.col] === this.playerColor) bonus += 0.5;
                if (game.board2[pos.row][pos.col] === this.playerColor) bonus += 0.5;
            }
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

                    if (newRow >= 0 && newRow < game.boardSize && newCol >= 0 && newCol < game.boardSize) {
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
    decideColorSwap() {
        // Always swap colors if possible (deterministic behavior)
        return this.gameEngine.getGameState().canSwapColors;
    }

    chooseMove() {
        // Always swap colors if possible (deterministic behavior)
        if (this.gameEngine.getGameState().canSwapColors) {
            return 'swap';
        }
        const validMoves = this.gameEngine.getValidMoves();
        return validMoves[0];
    }
}

class RandomPlayer extends EntangledPlayer {
    decideColorSwap() {
        // Randomly decide to swap colors if possible
        return this.gameEngine.getGameState().canSwapColors && Math.random() < 0.5;
    }

    chooseMove() {
        // Randomly decide to swap colors if possible
        if (this.gameEngine.getGameState().canSwapColors) {
            if (this.decideColorSwap()) {
                return 'swap';
            }
        }
        const validMoves = this.gameEngine.getValidMoves();
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        return validMoves[randomIndex];
    }
}

class GreedyHighPlayer extends EntangledPlayer {
    decideColorSwap() {
        if (!this.gameEngine.getGameState().canSwapColors) {
            return false;
        }

        // Evaluate current position
        const currentGame = this.simulateGame(this.gameEngine.getGameState());
        const currentScore = currentGame.getScore(this.playerColor);

        // Evaluate swapped position
        const swappedGame = this.simulateGame(this.gameEngine.getGameState());
        swappedGame.swapColors();
        const swappedScore = swappedGame.getScore(this.playerColor);

        return swappedScore > currentScore;
    }

    evaluateMove(move) {
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.makeMove(move);

        // If this is the first move, consider opponent's swap option
        if (simGame.playerTurns[this.playerColor] === 1) {
            const score = simGame.getScore(this.playerColor);
            const swappedScore = simGame.getScore(this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK');
            // If opponent would benefit from swapping, assume they will
            if (swappedScore > score) {
                return {
                    move,
                    totalScore: -swappedScore,  // Negative because it would be opponent's score after swap
                    board1Score: simGame.findLargestCluster(simGame.board1, this.playerColor),
                    board2Score: simGame.findLargestCluster(simGame.board2, this.playerColor),
                    difference: Math.abs(simGame.findLargestCluster(simGame.board1, this.playerColor) -
                        simGame.findLargestCluster(simGame.board2, this.playerColor))
                };
            }
        }

        return super.evaluateMove(move);
    }
}

class GreedyLowPlayer extends EntangledPlayer {
    decideColorSwap() {
        if (!this.gameEngine.getGameState().canSwapColors) {
            return false;
        }

        // Evaluate current position
        const currentGame = this.simulateGame(this.gameEngine.getGameState());
        const currentEval = this.evaluateMove(currentGame.getValidMoves()[0]);
        const currentDiff = currentEval.difference;

        // Evaluate swapped position
        const swappedGame = this.simulateGame(this.gameEngine.getGameState());
        swappedGame.swapColors();
        const swappedEval = this.evaluateMove(swappedGame.getValidMoves()[0]);
        const swappedDiff = swappedEval.difference;

        return swappedDiff < currentDiff;
    }

    chooseMove() {
        if (this.gameEngine.getGameState().canSwapColors) {
            if (this.decideColorSwap()) {
                return 'swap';
            }
        }

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
    evaluateWorstOpponentResponse(game) {
        const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
        const remainingMoves = game.getValidMoves();
        let worstScore = Infinity;

        // If this is opponent's first move, consider swapping
        if (game.playerTurns[opponentColor] === 0) {
            const swapScore = game.getScore(opponentColor) - game.getScore(this.playerColor);
            worstScore = Math.min(worstScore, -swapScore);  // Negative because it's from our perspective
        }

        for (const move of remainingMoves) {
            const simGame = this.simulateGame(game.getGameState());
            simGame.makeMove(move);
            const score = simGame.getScore(this.playerColor) - simGame.getScore(opponentColor);
            worstScore = Math.min(worstScore, score);
        }

        return worstScore;
    }

    chooseMove() {
        // First check if we can swap colors
        if (this.gameEngine.getGameState().canSwapColors) {
            if (this.decideColorSwap()) {
                return 'swap';
            }
        }

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

class MinimaxPlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, config = {}) {
        super(gameEngine, playerColor, config);
        this.moveTimeLimit = config.moveTimeLimit;
        this.swapTimeLimit = config.swapTimeLimit;
        this.startTime = 0;
        this.shouldStop = false;
        this.transpositionTable = new Map();
        this.bestMove = null;

        // Validate required config values
        if (!this.moveTimeLimit) throw new Error('moveTimeLimit is required in config');
        if (!this.swapTimeLimit) throw new Error('swapTimeLimit is required in config');
    }

    isTimeUp() {
        const timeLimit = this.isSwapDecision ? this.swapTimeLimit : this.moveTimeLimit;
        return performance.now() - this.startTime >= timeLimit;
    }

    // Get a unique key for the game state
    getStateKey(game, depth, maxing) {
        const board1Key = game.board1.map(row => row.join('')).join('');
        const board2Key = game.board2.map(row => row.join('')).join('');
        return `${board1Key}|${board2Key}|${depth}|${maxing}`;
    }

    iterativeDeepening(game, maxing, alpha = -Infinity, beta = Infinity) {
        this.startTime = performance.now();
        this.shouldStop = false;
        this.bestMove = null;
        let bestScore = maxing ? -Infinity : Infinity;
        let depth = 1;
        let lastCompletedDepth = 0;
        let lastScore = null;
        let unchangedCount = 0;

        // Clear transposition table for new search
        this.transpositionTable.clear();

        // Get number of valid moves to help determine max depth
        const numValidMoves = game.getValidMoves().length;
        const maxReasonableDepth = Math.min(
            // Fewer moves = can look deeper, but cap at reasonable limits
            Math.max(numValidMoves * 2, 6),  // At least look 6 moves ahead
            20  // Never go beyond depth 20
        );

        while (!this.isTimeUp()) {
            const result = this.minimaxRoot(game, depth, maxing, alpha, beta);
            if (!this.shouldStop) {
                // Early stopping conditions:

                // 1. If score hasn't changed significantly in last few iterations
                if (lastScore !== null) {
                    const scoreDiff = Math.abs(result.score - lastScore);
                    if (scoreDiff < 0.01) { // Score basically unchanged
                        unchangedCount++;
                        if (unchangedCount >= 3) { // Stable for 3 iterations
                            console.log(`Stopping early - score stable at depth ${depth}`);
                            break;
                        }
                    } else {
                        unchangedCount = 0;
                    }
                }

                // 2. If we've reached a reasonable maximum depth
                if (depth >= maxReasonableDepth) {
                    console.log(`Stopping at reasonable max depth ${depth}`);
                    break;
                }

                // 3. If we've found a forced win/loss
                if (Math.abs(result.score) > 1000) {
                    console.log(`Stopping - found decisive outcome at depth ${depth}`);
                    break;
                }

                bestScore = result.score;
                this.bestMove = result.move;
                lastCompletedDepth = depth;
                lastScore = result.score;
                depth++;
            }
        }

        const endTime = performance.now();
        console.log(`Search completed at depth ${lastCompletedDepth} in ${Math.round(endTime - this.startTime)}ms`);
        return bestScore;
    }

    minimaxRoot(game, depth, maxing, alpha, beta) {
        if (depth === 0 || game.isGameOver() || this.isTimeUp()) {
            return { score: this.evaluatePosition(game), move: null };
        }

        const validMoves = this.orderMoves(game, game.getValidMoves());
        let bestMove = validMoves[0];
        let bestScore = maxing ? -Infinity : Infinity;

        for (const move of validMoves) {
            if (this.shouldStop) break;

            const sim = this.simulateGame(game.getGameState());
            sim.makeMove(move);

            const score = this.minimax(sim, depth - 1, !maxing, alpha, beta);

            if (maxing) {
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, bestScore);
            } else {
                if (score < bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
                beta = Math.min(beta, bestScore);
            }

            if (beta <= alpha) break;
        }

        return { score: bestScore, move: bestMove };
    }

    orderMoves(game, moves) {
        // Simple move ordering: prioritize center moves and moves that increase our score
        return moves.sort((a, b) => {
            const simA = this.simulateGame(game.getGameState());
            const simB = this.simulateGame(game.getGameState());
            simA.makeMove(a);
            simB.makeMove(b);
            const scoreA = this.evaluatePosition(simA);
            const scoreB = this.evaluatePosition(simB);
            return scoreB - scoreA;
        });
    }

    minimax(game, depth, maxing, alpha, beta) {
        if (this.isTimeUp()) {
            this.shouldStop = true;
            return this.evaluatePosition(game);
        }

        const stateKey = this.getStateKey(game, depth, maxing);
        if (this.transpositionTable.has(stateKey)) {
            return this.transpositionTable.get(stateKey);
        }

        if (depth === 0 || game.isGameOver()) {
            const score = this.evaluatePosition(game);
            this.transpositionTable.set(stateKey, score);
            return score;
        }

        const validMoves = game.getValidMoves();
        if (!validMoves || validMoves.length === 0) {
            const score = this.evaluatePosition(game);
            this.transpositionTable.set(stateKey, score);
            return score;
        }

        const currentPlayer = maxing ? this.playerColor : (this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK');

        // Consider swapping if it's the second player's first move
        if (game.playerTurns[currentPlayer] === 0 && game.playerTurns[currentPlayer === 'BLACK' ? 'WHITE' : 'BLACK'] === 1) {
            const swapScore = maxing ? -this.evaluatePosition(game) : this.evaluatePosition(game);
            if (maxing) {
                alpha = Math.max(alpha, swapScore);
            } else {
                beta = Math.min(beta, swapScore);
            }
        }

        let bestScore;
        if (maxing) {
            bestScore = -Infinity;
            for (const m of this.orderMoves(game, validMoves)) {
                if (this.shouldStop) break;
                const sim = this.simulateGame(game.getGameState());
                sim.currentPlayer = this.playerColor;
                sim.makeMove(m);
                bestScore = Math.max(bestScore, this.minimax(sim, depth - 1, false, alpha, beta));
                alpha = Math.max(alpha, bestScore);
                if (beta <= alpha) break;
            }
        } else {
            bestScore = Infinity;
            const opp = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
            for (const m of this.orderMoves(game, validMoves)) {
                if (this.shouldStop) break;
                const sim = this.simulateGame(game.getGameState());
                sim.currentPlayer = opp;
                sim.makeMove(m);
                bestScore = Math.min(bestScore, this.minimax(sim, depth - 1, true, alpha, beta));
                beta = Math.min(beta, bestScore);
                if (beta <= alpha) break;
            }
        }

        this.transpositionTable.set(stateKey, bestScore);
        return bestScore;
    }

    decideColorSwap() {
        if (!this.gameEngine.getGameState().canSwapColors) {
            return false;
        }

        this.isSwapDecision = true;  // Use swap time limit

        // Evaluate current position using iterative deepening
        const currentGame = this.simulateGame(this.gameEngine.getGameState());
        const currentScore = this.iterativeDeepening(currentGame, true);

        // Evaluate swapped position using iterative deepening
        const swappedGame = this.simulateGame(this.gameEngine.getGameState());
        swappedGame.swapColors();
        const swappedScore = this.iterativeDeepening(swappedGame, true);

        this.isSwapDecision = false;  // Reset back to move time limit
        return swappedScore > currentScore;
    }

    chooseMove() {
        if (this.gameEngine.getGameState().canSwapColors) {
            if (this.decideColorSwap()) {
                return 'swap';
            }
        }

        // Do one iterative deepening search to find the best move
        const game = this.simulateGame(this.gameEngine.getGameState());
        const score = this.iterativeDeepening(game, true);

        // Get all moves that were evaluated in the last completed depth
        const validMoves = this.gameEngine.getValidMoves();
        const moveScores = validMoves.map(move => {
            const sim = this.simulateGame(game.getGameState());
            sim.makeMove(move);
            return {
                move,
                score: this.evaluatePosition(sim)
            };
        });

        // Sort by score
        moveScores.sort((a, b) => b.score - a.score);

        // Use randomizeChoice if randomization is enabled
        return this.randomizeChoice(
            moveScores.map(m => m.move),
            moveScores.map(m => m.score)
        );
    }
}

class MCTSPlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, config = {}) {
        super(gameEngine, playerColor, config);
        this.simulationCount = config.simulationCount;
        this.moveTimeLimit = config.moveTimeLimit;
        this.swapTimeLimit = config.swapTimeLimit;
        this.clusterCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.startTime = 0;
        this.isSwapDecision = false;

        // Validate required config values
        if (!this.simulationCount) throw new Error('simulationCount is required in config');
        if (!this.moveTimeLimit) throw new Error('moveTimeLimit is required in config');
        if (!this.swapTimeLimit) throw new Error('swapTimeLimit is required in config');
    }

    isTimeUp() {
        const timeLimit = this.isSwapDecision ? this.swapTimeLimit : this.moveTimeLimit;
        return performance.now() - this.startTime >= timeLimit;
    }

    createBoardKey(board, player) {
        return board.map(row =>
            row.map(cell => cell === null ? '0' : cell === 'BLACK' ? '1' : '2').join('')
        ).join('') + player;
    }

    getCachedLargestCluster(simGame, board, player) {
        const boardKey = this.createBoardKey(board, player);

        let clusterSize = this.clusterCache.get(boardKey);
        if (clusterSize !== undefined) {
            this.cacheHits++;
            return clusterSize;
        }

        this.cacheMisses++;
        clusterSize = simGame.findLargestCluster(board, player);
        this.clusterCache.set(boardKey, clusterSize);

        return clusterSize;
    }

    decideColorSwap() {
        if (!this.gameEngine.getGameState().canSwapColors) {
            return false;
        }

        this.isSwapDecision = true;  // Use swap time limit
        this.startTime = performance.now();
        const halfTimeLimit = this.swapTimeLimit / 2;

        // Evaluate current position using MCTS with half the time
        const currentGame = this.simulateGame(this.gameEngine.getGameState());
        let currentScore = 0;
        let simCount = 0;

        while (performance.now() - this.startTime < halfTimeLimit && simCount < this.simulationCount) {
            const sim = this.simulateGame(currentGame.getGameState());
            currentScore += this.playRandomGame(sim);
            simCount++;
        }
        currentScore /= simCount;

        // Evaluate swapped position using MCTS with remaining time
        const swappedGame = this.simulateGame(this.gameEngine.getGameState());
        swappedGame.swapColors();
        let swappedScore = 0;
        simCount = 0;

        const remainingTime = this.swapTimeLimit - (performance.now() - this.startTime);
        const swapStartTime = performance.now();

        while (performance.now() - swapStartTime < remainingTime && simCount < this.simulationCount) {
            const sim = this.simulateGame(swappedGame.getGameState());
            swappedScore += this.playRandomGame(sim);
            simCount++;
        }
        swappedScore /= simCount;

        this.isSwapDecision = false;  // Reset back to move time limit
        return swappedScore > currentScore;
    }

    chooseMove() {
        this.clusterCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;

        if (this.gameEngine.getGameState().canSwapColors) {
            if (this.decideColorSwap()) {
                return 'swap';
            }
        }

        this.startTime = performance.now();
        const validMoves = this.gameEngine.getValidMoves();

        // Initial quick evaluation of all moves
        const moveEvaluations = validMoves.map(move => {
            let totalScore = 0;
            const INITIAL_SIMS = 10; // Quick initial assessment

            for (let i = 0; i < INITIAL_SIMS; i++) {
                const simGame = this.simulateGame(this.gameEngine.getGameState());
                try {
                    simGame.makeMove(move);
                    totalScore += this.playRandomGame(simGame);
                } catch (error) {
                    console.error('Simulation error:', error);
                    return { move, score: -Infinity, simCount: 0 };
                }
            }

            return {
                move,
                score: totalScore / INITIAL_SIMS,
                simCount: INITIAL_SIMS,
                lastScore: totalScore / INITIAL_SIMS, // Track last score for stability check
                unchangedCount: 0 // Count iterations where score remains stable
            };
        });

        // Sort moves by initial evaluation
        moveEvaluations.sort((a, b) => b.score - a.score);

        let roundsWithoutChange = 0;
        const STABILITY_THRESHOLD = 0.01; // Score difference threshold for stability
        const MAX_UNCHANGED_ROUNDS = 3; // Number of rounds score must be stable
        const DOMINANCE_THRESHOLD = 5.0; // Score difference threshold for clear dominance

        // Continue simulations with remaining time, focusing more on promising moves
        while (!this.isTimeUp()) {
            let roundChanged = false;
            const bestScoreBeforeRound = moveEvaluations[0].score;

            // Distribute remaining simulations based on move promise
            for (let i = 0; i < moveEvaluations.length; i++) {
                // Skip moves that performed very poorly in initial evaluation
                if (moveEvaluations[i].score === -Infinity) continue;

                // Early stopping conditions:
                // 1. If best move is clearly better than second best
                if (i === 1 &&
                    moveEvaluations[0].simCount >= 50 && // Ensure sufficient samples
                    moveEvaluations[0].score > moveEvaluations[1].score + DOMINANCE_THRESHOLD) {
                    const endTime = performance.now();
                    console.log(`MCTS stopped early due to clear best move in ${Math.round(endTime - this.startTime)}ms with simulation counts:`,
                        moveEvaluations.map(e => `${e.move}: ${e.simCount}`).join(', '));
                    return this.randomizeChoice(
                        moveEvaluations.map(m => m.move),
                        moveEvaluations.map(m => m.score)
                    );
                }

                // More promising moves get more simulations
                const simsForThisMove = Math.max(1, Math.floor(
                    (moveEvaluations.length - i) / moveEvaluations.length * 5
                ));

                for (let sim = 0; sim < simsForThisMove && !this.isTimeUp(); sim++) {
                    const simGame = this.simulateGame(this.gameEngine.getGameState());
                    try {
                        simGame.makeMove(moveEvaluations[i].move);
                        const score = this.playRandomGame(simGame);
                        const oldScore = moveEvaluations[i].score;
                        // Update running average
                        moveEvaluations[i].score = (
                            oldScore * moveEvaluations[i].simCount + score
                        ) / (moveEvaluations[i].simCount + 1);
                        moveEvaluations[i].simCount++;

                        // Check if score changed significantly
                        if (Math.abs(moveEvaluations[i].score - moveEvaluations[i].lastScore) > STABILITY_THRESHOLD) {
                            moveEvaluations[i].unchangedCount = 0;
                            roundChanged = true;
                        } else {
                            moveEvaluations[i].unchangedCount++;
                        }
                        moveEvaluations[i].lastScore = moveEvaluations[i].score;
                    } catch (error) {
                        console.error('Simulation error:', error);
                        break;
                    }
                }
            }

            // Re-sort after each round to adapt to new information
            moveEvaluations.sort((a, b) => b.score - a.score);

            // Check if the best move's score changed significantly
            if (Math.abs(moveEvaluations[0].score - bestScoreBeforeRound) <= STABILITY_THRESHOLD) {
                roundsWithoutChange++;
            } else {
                roundsWithoutChange = 0;
            }

            // Early stopping condition:
            // 2. If evaluations have stabilized for several rounds
            if (!roundChanged && roundsWithoutChange >= MAX_UNCHANGED_ROUNDS &&
                moveEvaluations[0].simCount >= 50) { // Ensure sufficient samples
                const endTime = performance.now();
                console.log(`MCTS stopped early due to stable evaluations in ${Math.round(endTime - this.startTime)}ms with simulation counts:`,
                    moveEvaluations.map(e => `${e.move}: ${e.simCount}`).join(', '));
                break;
            }
        }

        const endTime = performance.now();
        const duration = endTime - this.startTime;
        console.log(`MCTS completed in ${Math.round(duration)}ms with simulation counts:`,
            moveEvaluations.map(e => `${e.move}: ${e.simCount}`).join(', '));

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }

    playRandomGame(sim) {
        while (!sim.isGameOver()) {
            const currentPlayer = sim.currentPlayer;

            // Consider swapping if it's the second player's first move
            if (sim.canSwapColors && !sim.colorsSwapped &&
                sim.playerTurns[currentPlayer] === 0 &&
                sim.playerTurns[currentPlayer === 'BLACK' ? 'WHITE' : 'BLACK'] === 1) {
                const currentScore = sim.getScore(currentPlayer);
                const opponentScore = sim.getScore(currentPlayer === 'BLACK' ? 'WHITE' : 'BLACK');
                if (opponentScore > currentScore && Math.random() < 0.8) {  // 80% chance to swap if beneficial
                    try {
                        sim.swapColors();
                        continue;
                    } catch (error) {
                        // If swap fails, just continue with normal move
                        console.debug('Swap failed in MCTS simulation:', error);
                    }
                }
            }

            const vm = sim.getValidMoves();
            if (!vm.length) break;
            const rnd = vm[Math.floor(Math.random() * vm.length)];
            sim.makeMove(rnd);
        }
        const my = this.playerColor;
        const opp = my === 'BLACK' ? 'WHITE' : 'BLACK';
        const myScore = sim.getScore(my);
        const oppScore = sim.getScore(opp);
        return myScore - oppScore;
    }

    destroy() {
        this.clusterCache.clear();
        this.clusterCache = null;
    }
}

class HybridStrongPlayer extends EntangledPlayer {
    constructor(gameEngine, playerColor, config = {}) {
        super(gameEngine, playerColor, config);
        this.mctsCount = config.simulationCount;
        this.minimaxDepth = config.lookahead;
    }

    decideColorSwap() {
        if (!this.gameEngine.getGameState().canSwapColors) {
            return false;
        }

        // Use minimax for swap decisions since it's faster for single position evaluation
        const currentGame = this.simulateGame(this.gameEngine.getGameState());
        const currentScore = this.minimax(currentGame, this.minimaxDepth - 1, true, -Infinity, Infinity);

        const swappedGame = this.simulateGame(this.gameEngine.getGameState());
        swappedGame.swapColors();
        const swappedScore = this.minimax(swappedGame, this.minimaxDepth - 1, true, -Infinity, Infinity);

        return swappedScore > currentScore;
    }

    chooseMove() {
        if (this.gameEngine.getGameState().canSwapColors) {
            if (this.decideColorSwap()) {
                return 'swap';
            }
        }

        const validMoves = this.gameEngine.getValidMoves();

        // Use MCTS for early game (more moves) and minimax for late game (fewer moves)
        if (validMoves.length > 10) {
            return this.mctsChoice(validMoves);
        } else {
            return this.minimaxChoice(validMoves);
        }
    }

    minimaxChoice(moves) {
        const evaluations = moves.map(m => {
            const sim = this.simulateGame(this.gameEngine.getGameState());
            sim.makeMove(m);
            return { move: m, score: this.minimax(sim, this.minimaxDepth - 1, false, -Infinity, Infinity) };
        });
        evaluations.sort((a, b) => b.score - a.score);
        return this.randomizeChoice(evaluations.map(e => e.move), evaluations.map(e => e.score));
    }

    minimax(game, depth, maxing, alpha, beta) {
        if (depth === 0 || game.isGameOver()) return this.evaluatePosition(game);
        const moves = game.getValidMoves();
        if (!moves.length) return this.evaluatePosition(game);
        if (maxing) {
            let val = -Infinity;
            for (const m of moves) {
                const sim = this.simulateGame(game.getGameState());
                sim.currentPlayer = this.playerColor;
                sim.makeMove(m);
                val = Math.max(val, this.minimax(sim, depth - 1, false, alpha, beta));
                alpha = Math.max(alpha, val);
                if (beta <= alpha) break;
            }
            return val;
        } else {
            let val = Infinity;
            const opp = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
            for (const m of moves) {
                const sim = this.simulateGame(game.getGameState());
                sim.currentPlayer = opp;
                sim.makeMove(m);
                val = Math.min(val, this.minimax(sim, depth - 1, true, alpha, beta));
                beta = Math.min(beta, val);
                if (beta <= alpha) break;
            }
            return val;
        }
    }

    mctsChoice(moves) {
        const evals = moves.map(m => {
            let total = 0;
            for (let i = 0; i < this.mctsCount; i++) {
                const sim = this.simulateGame(this.gameEngine.getGameState());
                sim.makeMove(m);
                total += this.playRandomGame(sim);
            }
            return { move: m, score: total / this.mctsCount };
        });
        evals.sort((a, b) => b.score - a.score);
        return this.randomizeChoice(evals.map(e => e.move), evals.map(e => e.score));
    }

    playRandomGame(sim) {
        while (!sim.isGameOver()) {
            const currentPlayer = sim.currentPlayer;

            // Consider swapping if it's the second player's first move
            if (sim.canSwapColors && !sim.colorsSwapped &&
                sim.playerTurns[currentPlayer] === 0 &&
                sim.playerTurns[currentPlayer === 'BLACK' ? 'WHITE' : 'BLACK'] === 1) {
                const currentScore = sim.getScore(currentPlayer);
                const opponentScore = sim.getScore(currentPlayer === 'BLACK' ? 'WHITE' : 'BLACK');
                if (opponentScore > currentScore && Math.random() < 0.8) {  // 80% chance to swap if beneficial
                    try {
                        sim.swapColors();
                        continue;
                    } catch (error) {
                        // If swap fails, just continue with normal move
                        console.debug('Swap failed in Hybrid simulation:', error);
                    }
                }
            }

            const vm = sim.getValidMoves();
            if (!vm.length) break;
            const rnd = vm[Math.floor(Math.random() * vm.length)];
            sim.makeMove(rnd);
        }
        const my = this.playerColor;
        const opp = my === 'BLACK' ? 'WHITE' : 'BLACK';
        const myScore = sim.getScore(my);
        const oppScore = sim.getScore(opp);
        return myScore - oppScore;
    }
}

export const AI_PLAYERS = {
    random: {
        id: 'random',
        name: '🎲 Pure Random',
        description: 'Makes completely random moves with no strategy',
        implementation: RandomPlayer
    },
    deterministic: {
        id: 'deterministic',
        name: '🎯 Pure Deterministic',
        description: 'Always picks the first available move',
        implementation: DeterministicPlayer
    },
    'aggressive-no-rng': {
        id: 'aggressive-no-rng',
        name: '🎯 Det. Greedy',
        description: 'Maximizes immediate score without considering opponent moves',
        implementation: GreedyHighPlayer,
        defaultConfig: {
            randomize: false,
            randomThreshold: 0.1
        }
    },
    'aggressive-some-rng': {
        id: 'aggressive-some-rng',
        name: '🎲 Rand. Greedy',
        description: 'Like Greedy Score but randomly picks among good moves',
        implementation: GreedyHighPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1
        }
    },
    'defensive-no-rng': {
        id: 'defensive-no-rng',
        name: '🎯 Det. Defensive',
        description: 'Considers opponent\'s best response when choosing moves',
        implementation: DefensivePlayer,
        defaultConfig: {
            randomize: false,
            randomThreshold: 0.1
        }
    },
    'defensive-some-rng': {
        id: 'defensive-some-rng',
        name: '🎲 Rand. Defensive',
        description: 'Like Defensive but randomly picks among good moves',
        implementation: DefensivePlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1
        }
    },
    'minimax-no-rng': {
        id: 'minimax-no-rng',
        name: '🎯 Det. Minimax',
        description: 'Uses iterative deepening minimax with alpha-beta pruning (1 second per move)',
        implementation: MinimaxPlayer,
        defaultConfig: {
            randomize: false,
            randomThreshold: 0,
            moveTimeLimit: 1000,
            swapTimeLimit: 1000
        }
    },
    'minimax-some-rng': {
        id: 'minimax-some-rng',
        name: '🎲 Rand. Minimax',
        description: 'Like Minimax but randomly picks among good moves',
        implementation: MinimaxPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1,
            moveTimeLimit: 1000,
            swapTimeLimit: 1000
        }
    },
    'mcts-some-rng': {
        id: 'mcts-some-rng',
        name: '🎲 Monte Carlo Tree Search',
        description: 'Uses Monte Carlo Tree Search with time limit of 1 second per move',
        implementation: MCTSPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1,
            simulationCount: 2000,
            moveTimeLimit: 1000,
            swapTimeLimit: 1000
        }
    },
    'hybrid-strong': {
        id: 'hybrid-strong',
        name: '🎲 MCTS/Minimax Hybrid',
        description: 'Uses MCTS early game, switches to Minimax in endgame',
        implementation: HybridStrongPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1,
            simulationCount: 2000,
            lookahead: 4
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