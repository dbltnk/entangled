// players.js
import { EntangledGame, PLAYERS } from './gameplay.js';

// Define base player class
class EntangledPlayer {
    constructor(gameEngine, playerColor, config = {}) {
        this.gameEngine = gameEngine;
        this.playerColor = playerColor;
        this.randomize = config.randomize;
        this.randomThreshold = config.randomThreshold;
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

        // If it's a superposition stone, evaluate potential outcomes
        if (simGame.superpositionStones.has(move)) {
            return this.evaluateSuperpositionMove(move, simGame);
        }

        simGame.makeMove(move);

        const score = simGame.getScore(this.playerColor);
        const board1Score = simGame.findLargestCluster(simGame.board1, this.playerColor);
        const board2Score = simGame.findLargestCluster(simGame.board2, this.playerColor);

        return {
            move,
            totalScore: score,
            board1Score,
            board2Score,
            difference: Math.abs(board1Score - board2Score),
            isSuperposition: false
        };
    }

    evaluateSuperpositionMove(move, simGame) {
        // Get possible positions for this superposition stone
        const positions = simGame.getValidPositionsForStone(move);
        if (!positions || positions.length === 0) {
            return {
                move,
                totalScore: -Infinity,
                board1Score: 0,
                board2Score: 0,
                difference: 0,
                isSuperposition: true
            };
        }

        // Evaluate each possible position
        const outcomes = positions.map(pos => {
            const gameCopy = this.simulateGame(simGame.getGameState());
            gameCopy.makeMove(move, pos);

            const board1Score = gameCopy.findLargestCluster(gameCopy.board1, this.playerColor);
            const board2Score = gameCopy.findLargestCluster(gameCopy.board2, this.playerColor);
            const score = board1Score + board2Score;

            return {
                position: pos,
                score,
                board1Score,
                board2Score
            };
        });

        // Calculate average and worst-case scores
        const avgScore = outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length;
        const worstScore = Math.min(...outcomes.map(o => o.score));
        const avgBoard1 = outcomes.reduce((sum, o) => sum + o.board1Score, 0) / outcomes.length;
        const avgBoard2 = outcomes.reduce((sum, o) => sum + o.board2Score, 0) / outcomes.length;

        return {
            move,
            totalScore: avgScore * 0.7 + worstScore * 0.3, // Balance between average and worst case
            board1Score: avgBoard1,
            board2Score: avgBoard2,
            difference: Math.abs(avgBoard1 - avgBoard2),
            isSuperposition: true,
            outcomes
        };
    }

    evaluatePosition(game) {
        const myScore = game.getScore(this.playerColor);
        const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
        const opponentScore = game.getScore(opponentColor);
        const centerBonus = this.evaluateCenterControl(game);
        // Only add superposition bonus if there are SP stones in the game
        const spState = game.getSuperpositionState();
        const superpositionBonus = spState && spState.stones.length > 0 ?
            this.evaluateSuperpositionState(game) : 0;
        return myScore - opponentScore + centerBonus + superpositionBonus;
    }

    evaluateSuperpositionState(game) {
        let bonus = 0;
        const spState = game.getSuperpositionState();

        // Bonus for having superposition stones available
        for (const stone of spState.stones) {
            const positions = game.getValidPositionsForStone(stone.symbol);
            if (positions && positions.length > 0) {
                bonus += positions.length * 0.2; // Small bonus for each valid position
            }
        }

        return bonus;
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
        // Use game engine's cluster finding methods
        const clusters = game.findLargestClusterCells(board, this.playerColor);
        let value = 0;

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

    simulateGame(state) {
        if (!state || !state.board1 || !state.board2) return null;
        return new SimulatedGame(this.gameEngine, state);
    }

    // Add shouldSwap method to base class
    shouldSwap() {
        if (!this.gameEngine.isSwapAvailable()) {
            return false;
        }

        // Default implementation evaluates the first move position
        const firstMove = this.gameEngine.firstMove;
        if (!firstMove) return false;

        // Simulate taking over the move
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.swapFirstMove();
        const scoreAfterSwap = this.evaluatePosition(simGame);

        // Simulate our best move as second player
        const originalGame = this.simulateGame(this.gameEngine.getGameState());
        const validMoves = originalGame.getValidMoves();
        let bestMoveScore = -Infinity;

        for (const move of validMoves) {
            const moveGame = this.simulateGame(originalGame.getGameState());
            moveGame.makeMove(move);
            const score = this.evaluatePosition(moveGame);
            bestMoveScore = Math.max(bestMoveScore, score);
        }

        // Compare the two scenarios
        return scoreAfterSwap > bestMoveScore;
    }
}

class SimulatedGame extends EntangledGame {
    constructor(originalGame, state) {
        super(originalGame.board1Layout, originalGame.board2Layout);

        // Copy board state from passed state
        for (let i = 0; i < state.board1.length; i++) {
            for (let j = 0; j < state.board1[i].length; j++) {
                this.board1[i][j] = state.board1[i][j];
                this.board2[i][j] = state.board2[i][j];
            }
        }

        // Copy game state from passed state
        this.currentPlayer = state.currentPlayer;
        this.playerTurns = { ...state.playerTurns };
        this.gameOver = state.gameOver;
        this._lastMove = state.lastMove;
        this.lastPlacedStone = state.lastPlacedStone;

        // Copy swap rule state
        this.enableSwapRule = originalGame.enableSwapRule;
        this.firstMove = state.firstMove;
        this.swapAvailable = state.swapAvailable;
        this.swapOccurred = state.swapOccurred;

        // Copy required maps and methods from original game
        this.symbolToPosition = new Map(originalGame.symbolToPosition);
        this.superpositionStones = new Map(originalGame.superpositionStones || new Map());

        // Copy over any additional methods that might be needed
        this.getValidPositionsForStone = originalGame.getValidPositionsForStone.bind(this);
        this.getSuperpositionState = originalGame.getSuperpositionState.bind(this);
        this.findSymbolAtPosition = originalGame.findSymbolAtPosition.bind(this);
        this.checkAllNeighborsFilled = originalGame.checkAllNeighborsFilled.bind(this);
        this.collapseSuperpositionStone = originalGame.collapseSuperpositionStone.bind(this);
    }
}

class DeterministicPlayer extends EntangledPlayer {
    shouldSwap() {
        // Always take predictable action based on board position
        return this.gameEngine.firstMove &&
            this.gameEngine.firstMove.charCodeAt(0) % 2 === 0;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        return validMoves[0];
    }
}

class RandomPlayer extends EntangledPlayer {
    shouldSwap() {
        // Random 50/50 decision
        return this.gameEngine.isSwapAvailable() && Math.random() < 0.5;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        return validMoves[randomIndex];
    }
}

class GreedyHighPlayer extends EntangledPlayer {
    shouldSwap() {
        if (!this.gameEngine.isSwapAvailable()) return false;

        // Evaluate immediate position after swap
        const simGame = this.simulateGame(this.gameEngine.getGameState());
        simGame.swapFirstMove();
        const swapScore = this.evaluatePosition(simGame);

        // Compare with best immediate move
        const validMoves = this.gameEngine.getValidMoves();
        let bestMoveScore = -Infinity;

        for (const move of validMoves) {
            const moveGame = this.simulateGame(this.gameEngine.getGameState());
            moveGame.makeMove(move);
            const score = this.evaluatePosition(moveGame);
            bestMoveScore = Math.max(bestMoveScore, score);
        }

        return swapScore > bestMoveScore;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => {
            const evaluation = this.evaluateMove(move);
            // Only apply SP bonus if it's actually a superposition move
            const superpositionBonus = evaluation.isSuperposition ?
                (Object.values(this.gameEngine.playerTurns).reduce((a, b) => a + b) < 10 ? 2 : 0) : 0;
            return {
                move,
                score: evaluation.totalScore + superpositionBonus
            };
        });

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
            // Only apply SP bonus if it's actually a superposition move
            const gameProgress = Object.values(this.gameEngine.playerTurns).reduce((a, b) => a + b);
            const superpositionBonus = moveEval.isSuperposition && gameProgress < 15 ? 1 : 0;
            return {
                move,
                score: -moveEval.difference + (moveEval.totalScore * 0.001) + superpositionBonus
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
        console.log(`[DefensivePlayer] Valid moves:`, validMoves);

        const moveEvaluations = validMoves.map(move => {
            console.log(`[DefensivePlayer] Evaluating move: ${move}`);

            // First simulate our move
            const ourGame = this.simulateGame(this.gameEngine.getGameState());
            console.log(`[DefensivePlayer] Simulated game state:`, {
                currentPlayer: ourGame.currentPlayer,
                superpositionStones: Array.from(ourGame.superpositionStones.entries())
            });

            // Handle superposition stones differently only if they exist
            if (ourGame.superpositionStones && ourGame.superpositionStones.has(move)) {
                const spEval = this.evaluateMove(move);
                // Defensive players prefer superposition stones in mid-game
                const gameProgress = Object.values(this.gameEngine.playerTurns).reduce((a, b) => a + b);
                const midGameBonus = gameProgress >= 5 && gameProgress <= 15 ? 3 : 0;
                return {
                    move,
                    score: spEval.totalScore + midGameBonus
                };
            }

            // Original defensive evaluation logic for non-SP stones
            ourGame.currentPlayer = this.playerColor;
            try {
                ourGame.makeMove(move);
            } catch (error) {
                console.error(`[DefensivePlayer] Error making move ${move}:`, error);
                return {
                    move,
                    score: -Infinity
                };
            }

            const ourScore = ourGame.getScore(this.playerColor);
            console.log(`[DefensivePlayer] Our score after move: ${ourScore}`);

            const remainingMoves = ourGame.getValidMoves();
            console.log(`[DefensivePlayer] Remaining moves for opponent:`, remainingMoves);

            const worstOpponentScore = remainingMoves.reduce((worst, oppMove) => {
                // Skip superposition stones for opponent only if they exist
                if (ourGame.superpositionStones && ourGame.superpositionStones.has(oppMove)) {
                    return worst;
                }

                const oppGame = this.simulateGame(ourGame.getGameState());
                oppGame.currentPlayer = this.playerColor === PLAYERS.BLACK ? PLAYERS.WHITE : PLAYERS.BLACK;

                try {
                    oppGame.makeMove(oppMove);
                    const oppScore = oppGame.getScore(oppGame.currentPlayer);
                    console.log(`[DefensivePlayer] Opponent score for move ${oppMove}: ${oppScore}`);
                    return Math.max(worst, oppScore);
                } catch (error) {
                    console.error(`[DefensivePlayer] Error simulating opponent move ${oppMove}:`, error);
                    return worst;
                }
            }, -Infinity);

            console.log(`[DefensivePlayer] Worst opponent score: ${worstOpponentScore}`);
            return {
                move,
                score: ourScore - worstOpponentScore
            };
        });

        // Filter out invalid moves
        const validEvaluations = moveEvaluations.filter(evaluation => evaluation.score !== -Infinity);

        if (validEvaluations.length === 0) {
            console.warn('[DefensivePlayer] No valid moves found, falling back to first available move');
            return validMoves[0];
        }

        validEvaluations.sort((a, b) => b.score - a.score);
        console.log(`[DefensivePlayer] Move evaluations:`, validEvaluations);

        return this.randomizeChoice(
            validEvaluations.map(m => m.move),
            validEvaluations.map(m => m.score)
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

                        if (newRow >= 0 && newRow < game.boardSize && newCol >= 0 && newCol < game.boardSize) {
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
        this.lookahead = config.lookahead;
    }

    shouldSwap() {
        if (!this.gameEngine.isSwapAvailable()) return false;

        // Evaluate swap position with minimax
        const swapGame = this.simulateGame(this.gameEngine.getGameState());
        swapGame.swapFirstMove();
        const swapScore = this.minimax(swapGame, this.lookahead - 1, true, -Infinity, Infinity);

        // Evaluate best regular move with minimax
        const validMoves = this.gameEngine.getValidMoves();
        let bestMoveScore = -Infinity;

        for (const move of validMoves) {
            const moveGame = this.simulateGame(this.gameEngine.getGameState());
            moveGame.makeMove(move);
            const score = this.minimax(moveGame, this.lookahead - 1, false, -Infinity, Infinity);
            bestMoveScore = Math.max(bestMoveScore, score);
        }

        return swapScore > bestMoveScore;
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        const moveEvaluations = validMoves.map(move => {
            const simGame = this.simulateGame(this.gameEngine.getGameState());

            // For superposition stones, evaluate all possible outcomes
            if (simGame.superpositionStones.has(move)) {
                const spEval = this.evaluateMove(move);
                // Minimax players prefer superposition stones in early-mid game
                const gameProgress = Object.values(this.gameEngine.playerTurns).reduce((a, b) => a + b);
                const superpositionBonus = gameProgress < 15 ? 2 : 0;
                return {
                    move,
                    score: spEval.totalScore + superpositionBonus
                };
            }

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
        this.timeLimit = config.timeLimit;
        // Reusable game state for simulations
        this.baseSimGame = null;
        this.simBoards = {
            board1: Array(gameEngine.boardSize).fill(null).map(() => Array(gameEngine.boardSize).fill(null)),
            board2: Array(gameEngine.boardSize).fill(null).map(() => Array(gameEngine.boardSize).fill(null))
        };
    }

    shouldSwap() {
        if (!this.gameEngine.isSwapAvailable()) return false;

        const startTime = performance.now();
        let swapWins = 0;
        let regularWins = 0;
        let totalSimulations = 0;

        // Initialize base simulation game
        this.initBaseSimGame(this.gameEngine.getGameState());

        while (performance.now() - startTime < this.timeLimit / 2) {
            // Simulate swap scenario
            const swapGame = this.getSimulationGame();
            swapGame.swapFirstMove();
            const swapScore = this.playRandomGame(swapGame);
            swapWins += swapScore > 0 ? 1 : 0;

            // Simulate regular move
            const regularGame = this.getSimulationGame();
            const validMoves = regularGame.getValidMoves();
            if (validMoves.length > 0) {
                const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                regularGame.makeMove(randomMove);
                const regularScore = this.playRandomGame(regularGame);
                regularWins += regularScore > 0 ? 1 : 0;
            }

            totalSimulations++;
        }

        return swapWins > regularWins;
    }

    // Fast board state copy without object creation
    copyBoardState(source, target) {
        for (let i = 0; i < source.length; i++) {
            for (let j = 0; j < source[i].length; j++) {
                target[i][j] = source[i][j];
            }
        }
    }

    // Initialize base simulation game once
    initBaseSimGame(gameState) {
        if (!this.baseSimGame) {
            this.baseSimGame = new SimulatedGame(this.gameEngine, gameState);
        } else {
            // Update existing base game state
            this.copyBoardState(gameState.board1, this.baseSimGame.board1);
            this.copyBoardState(gameState.board2, this.baseSimGame.board2);
            this.baseSimGame.currentPlayer = gameState.currentPlayer;
            this.baseSimGame.playerTurns = { ...gameState.playerTurns };
            this.baseSimGame.gameOver = gameState.gameOver;
            this.baseSimGame._lastMove = gameState.lastMove;
            this.baseSimGame.lastPlacedStone = gameState.lastPlacedStone;
            this.baseSimGame.superpositionStones = new Map(this.gameEngine.superpositionStones);
        }
    }

    // Fast game state copy for simulation
    getSimulationGame() {
        // Copy board states to reusable boards
        this.copyBoardState(this.baseSimGame.board1, this.simBoards.board1);
        this.copyBoardState(this.baseSimGame.board2, this.simBoards.board2);

        // Create a proper game state for simulation
        return new SimulatedGame(this.gameEngine, {
            board1: this.simBoards.board1,
            board2: this.simBoards.board2,
            currentPlayer: this.baseSimGame.currentPlayer,
            playerTurns: { ...this.baseSimGame.playerTurns },
            gameOver: this.baseSimGame.gameOver,
            lastMove: this.baseSimGame.lastMove,
            lastPlacedStone: this.baseSimGame.lastPlacedStone,
            firstMove: this.baseSimGame.firstMove,
            swapAvailable: this.baseSimGame.swapAvailable,
            swapOccurred: this.baseSimGame.swapOccurred
        });
    }

    chooseMove() {
        const startTime = performance.now();
        const validMoves = this.gameEngine.getValidMoves();
        const hasSuperposition = validMoves.some(move =>
            this.gameEngine.superpositionStones && this.gameEngine.superpositionStones.has(move));

        // Initialize base simulation game
        this.initBaseSimGame(this.gameEngine.getGameState());

        // Track simulations per move for balanced exploration
        const moveSimulations = validMoves.map(() => 0);
        const moveScores = validMoves.map(() => 0);

        // Keep simulating until time limit is reached
        while (performance.now() - startTime < this.timeLimit) {
            // Find move with least simulations
            const minSims = Math.min(...moveSimulations);
            const moveIndices = moveSimulations
                .map((sims, i) => sims === minSims ? i : -1)
                .filter(i => i !== -1);
            const moveIndex = moveIndices[Math.floor(Math.random() * moveIndices.length)];
            const move = validMoves[moveIndex];

            try {
                if (this.gameEngine.superpositionStones && this.gameEngine.superpositionStones.has(move)) {
                    const positions = this.gameEngine.getValidPositionsForStone(move);
                    if (positions && positions.length > 0) {
                        const randomPos = positions[Math.floor(Math.random() * positions.length)];
                        this.baseSimGame.makeMove(move, randomPos);
                        moveScores[moveIndex] += this.playRandomGame(this.getSimulationGame());
                        moveSimulations[moveIndex]++;
                        // Reset base game state
                        this.initBaseSimGame(this.gameEngine.getGameState());
                    } else {
                        moveScores[moveIndex] -= 1000;
                        moveSimulations[moveIndex]++;
                        continue;
                    }
                } else {
                    this.baseSimGame.makeMove(move);
                    moveScores[moveIndex] += this.playRandomGame(this.getSimulationGame());
                    moveSimulations[moveIndex]++;
                    // Reset base game state
                    this.initBaseSimGame(this.gameEngine.getGameState());
                }
            } catch (error) {
                moveScores[moveIndex] -= 1000;
                moveSimulations[moveIndex]++;
            }
        }

        // Convert to move evaluations
        const moveEvaluations = validMoves.map((move, i) => ({
            move,
            score: moveSimulations[i] > 0 ? moveScores[i] / moveSimulations[i] : -Infinity,
            simulations: moveSimulations[i]
        }));

        moveEvaluations.sort((a, b) => b.score - a.score);

        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }

    playRandomGame(simGame) {
        let validMoves = simGame.getValidMoves();
        const maxMoves = simGame.boardSize * simGame.boardSize;
        let moveCount = 0;

        while (!simGame.isGameOver() && moveCount < maxMoves && validMoves.length > 0) {
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];

            try {
                simGame.makeMove(randomMove);
                moveCount++;
                validMoves = simGame.getValidMoves();
            } catch (error) {
                break;
            }
        }

        const blackScore =
            simGame.findLargestCluster(simGame.board1, 'BLACK') +
            simGame.findLargestCluster(simGame.board2, 'BLACK');

        const whiteScore =
            simGame.findLargestCluster(simGame.board1, 'WHITE') +
            simGame.findLargestCluster(simGame.board2, 'WHITE');

        return this.playerColor === 'BLACK' ? blackScore - whiteScore : whiteScore - blackScore;
    }

    destroy() {
        this.baseSimGame = null;
        this.simBoards = null;
    }
}

class HybridStrongPlayer extends MinimaxPlayer {
    constructor(gameEngine, playerColor, config = {}) {
        super(gameEngine, playerColor, config);
        this.timeLimit = config.timeLimit;
        this.minimaxDepth = config.lookahead;
        // Create reusable MCTS components
        this.baseSimGame = null;
        this.simBoards = {
            board1: Array(gameEngine.boardSize).fill(null).map(() => Array(gameEngine.boardSize).fill(null)),
            board2: Array(gameEngine.boardSize).fill(null).map(() => Array(gameEngine.boardSize).fill(null))
        };
    }

    // Copy necessary MCTS methods
    copyBoardState(source, target) {
        for (let i = 0; i < source.length; i++) {
            for (let j = 0; j < source[i].length; j++) {
                target[i][j] = source[i][j];
            }
        }
    }

    initBaseSimGame(gameState) {
        if (!this.baseSimGame) {
            this.baseSimGame = new SimulatedGame(this.gameEngine, gameState);
        } else {
            this.copyBoardState(gameState.board1, this.baseSimGame.board1);
            this.copyBoardState(gameState.board2, this.baseSimGame.board2);
            this.baseSimGame.currentPlayer = gameState.currentPlayer;
            this.baseSimGame.playerTurns = { ...gameState.playerTurns };
            this.baseSimGame.gameOver = gameState.gameOver;
            this.baseSimGame._lastMove = gameState.lastMove;
            this.baseSimGame.lastPlacedStone = gameState.lastPlacedStone;
            this.baseSimGame.superpositionStones = new Map(this.gameEngine.superpositionStones);
        }
    }

    getSimulationGame() {
        this.copyBoardState(this.baseSimGame.board1, this.simBoards.board1);
        this.copyBoardState(this.baseSimGame.board2, this.simBoards.board2);

        return {
            board1: this.simBoards.board1,
            board2: this.simBoards.board2,
            currentPlayer: this.baseSimGame.currentPlayer,
            playerTurns: { ...this.baseSimGame.playerTurns },
            gameOver: this.baseSimGame.gameOver,
            boardSize: this.baseSimGame.boardSize,
            getValidMoves: () => {
                return this.baseSimGame.getValidMoves().filter(move =>
                    !this.baseSimGame.superpositionStones || !this.baseSimGame.superpositionStones.has(move)
                );
            },
            makeMove: (symbol) => {
                const positions = this.baseSimGame.symbolToPosition.get(symbol);
                if (positions.board1) {
                    this.simBoards.board1[positions.board1.row][positions.board1.col] = this.currentPlayer;
                }
                if (positions.board2) {
                    this.simBoards.board2[positions.board2.row][positions.board2.col] = this.currentPlayer;
                }
                this.currentPlayer = this.currentPlayer === 'BLACK' ? 'WHITE' : 'BLACK';
            },
            isGameOver: () => {
                return this.getValidMoves().length === 0;
            },
            findLargestCluster: (board, player) => {
                return this.baseSimGame.findLargestCluster(board, player);
            },
            getScore: (player) => {
                const board1Score = this.baseSimGame.findLargestCluster(this.simBoards.board1, player);
                const board2Score = this.baseSimGame.findLargestCluster(this.simBoards.board2, player);
                return board1Score + board2Score;
            }
        };
    }

    chooseMove() {
        const validMoves = this.gameEngine.getValidMoves();
        if (!validMoves.length) return null;

        const hasSuperposition = this.gameEngine.superpositionStones &&
            validMoves.some(move => this.gameEngine.superpositionStones.has(move));

        if (hasSuperposition || validMoves.length >= 10) {
            return this.mctsChoice(validMoves);
        } else {
            return this.minimaxChoice(validMoves);
        }
    }

    minimaxChoice(moves) {
        const evaluations = moves.map(m => {
            const sim = this.simulateGame(this.gameEngine.getGameState());
            sim.makeMove(m);
            return {
                move: m,
                score: this.minimax(sim, this.minimaxDepth - 1, false, -Infinity, Infinity)
            };
        });
        evaluations.sort((a, b) => b.score - a.score);
        return this.randomizeChoice(evaluations.map(e => e.move), evaluations.map(e => e.score));
    }

    mctsChoice(moves) {
        const startTime = performance.now();
        this.initBaseSimGame(this.gameEngine.getGameState());

        const moveSimulations = moves.map(() => 0);
        const moveScores = moves.map(() => 0);

        while (performance.now() - startTime < this.timeLimit) {
            const minSims = Math.min(...moveSimulations);
            const moveIndices = moveSimulations
                .map((sims, i) => sims === minSims ? i : -1)
                .filter(i => i !== -1);
            const moveIndex = moveIndices[Math.floor(Math.random() * moveIndices.length)];
            const move = moves[moveIndex];

            try {
                if (this.gameEngine.superpositionStones && this.gameEngine.superpositionStones.has(move)) {
                    const positions = this.gameEngine.getValidPositionsForStone(move);
                    if (positions && positions.length > 0) {
                        const randomPos = positions[Math.floor(Math.random() * positions.length)];
                        this.baseSimGame.makeMove(move, randomPos);
                        moveScores[moveIndex] += this.playRandomGame(this.getSimulationGame());
                        moveSimulations[moveIndex]++;
                        this.initBaseSimGame(this.gameEngine.getGameState());
                    } else {
                        moveScores[moveIndex] -= 1000;
                        moveSimulations[moveIndex]++;
                        continue;
                    }
                } else {
                    this.baseSimGame.makeMove(move);
                    moveScores[moveIndex] += this.playRandomGame(this.getSimulationGame());
                    moveSimulations[moveIndex]++;
                    this.initBaseSimGame(this.gameEngine.getGameState());
                }
            } catch (error) {
                moveScores[moveIndex] -= 1000;
                moveSimulations[moveIndex]++;
            }
        }

        const moveEvaluations = moves.map((move, i) => ({
            move,
            score: moveSimulations[i] > 0 ? moveScores[i] / moveSimulations[i] : -Infinity,
            simulations: moveSimulations[i]
        }));

        moveEvaluations.sort((a, b) => b.score - a.score);
        return this.randomizeChoice(
            moveEvaluations.map(m => m.move),
            moveEvaluations.map(m => m.score)
        );
    }

    playRandomGame(simGame) {
        let validMoves = simGame.getValidMoves();
        const maxMoves = simGame.boardSize * simGame.boardSize;
        let moveCount = 0;

        while (!simGame.isGameOver() && moveCount < maxMoves && validMoves.length > 0) {
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            try {
                simGame.makeMove(randomMove);
                moveCount++;
                validMoves = simGame.getValidMoves();
            } catch (error) {
                break;
            }
        }

        const blackScore =
            simGame.findLargestCluster(simGame.board1, 'BLACK') +
            simGame.findLargestCluster(simGame.board2, 'BLACK');
        const whiteScore =
            simGame.findLargestCluster(simGame.board1, 'WHITE') +
            simGame.findLargestCluster(simGame.board2, 'WHITE');

        return this.playerColor === 'BLACK' ? blackScore - whiteScore : whiteScore - blackScore;
    }

    destroy() {
        this.baseSimGame = null;
        this.simBoards = null;
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
    'mcts-no-rng': {
        id: 'mcts-no-rng',
        name: 'MCTS (no rng)',
        description: 'Uses Monte Carlo Tree Search simulation without randomization',
        implementation: MCTSPlayer,
        defaultConfig: {
            randomize: false,
            timeLimit: 1000
        }
    },
    'mcts-some-rng': {
        id: 'mcts-some-rng',
        name: 'MCTS (some rng)',
        description: 'Uses Monte Carlo Tree Search simulation with randomization',
        implementation: MCTSPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.1,
            timeLimit: 1000
        }
    },
    'hybrid-strong': {
        id: 'hybrid-strong',
        name: 'Hybrid Strong Player',
        description: 'Combines MCTS and Minimax adaptively',
        implementation: HybridStrongPlayer,
        defaultConfig: {
            randomize: true,
            randomThreshold: 0.05,
            timeLimit: 1000,
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