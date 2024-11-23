// Player strategy implementations for Entangled game
class EntangledPlayer {
    constructor(gameEngine, playerColor) {
        this.gameEngine = gameEngine;
        this.playerColor = playerColor;
    }

    // To be implemented by specific strategies
    chooseMove() {
        throw new Error('Strategy not implemented');
    }

    // Utility method to evaluate potential moves
    evaluateMove(move) {
        // Create a new game state to simulate the move
        const simGame = new EntangledGame(
            this.gameEngine.board1Layout,
            this.gameEngine.board2Layout
        );

        // Copy current game state
        const state = this.gameEngine.getGameState();
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                simGame.board1[i][j] = state.board1[i][j];
                simGame.board2[i][j] = state.board2[i][j];
            }
        }
        simGame.currentPlayer = this.playerColor;

        // Make the move
        simGame.makeMove(move);

        // Get cluster sizes after move
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
            // Simulate our move
            const ourEvaluation = this.evaluateMove(move);

            // Simulate opponent's best response
            const opponentColor = this.playerColor === 'BLACK' ? 'WHITE' : 'BLACK';
            const simGame = new EntangledGame(
                this.gameEngine.board1Layout,
                this.gameEngine.board2Layout
            );

            // Copy current game state and make our move
            const state = this.gameEngine.getGameState();
            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 5; j++) {
                    simGame.board1[i][j] = state.board1[i][j];
                    simGame.board2[i][j] = state.board2[i][j];
                }
            }
            simGame.currentPlayer = this.playerColor;
            simGame.makeMove(move);

            // Find opponent's best possible score after our move
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

// Factory function to create players
function createPlayer(strategy, gameEngine, playerColor) {
    const strategies = {
        'random': RandomPlayer,
        'greedy-high': GreedyHighPlayer,
        'greedy-low': GreedyLowPlayer,
        'defensive': DefensivePlayer
    };

    const PlayerClass = strategies[strategy.toLowerCase()];
    if (!PlayerClass) {
        throw new Error(`Unknown strategy: ${strategy}`);
    }

    return new PlayerClass(gameEngine, playerColor);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createPlayer,
        RandomPlayer,
        GreedyHighPlayer,
        GreedyLowPlayer,
        DefensivePlayer
    };
}