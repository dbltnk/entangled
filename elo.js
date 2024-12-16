class ELOSystem {
    constructor(config = {}) {
        this.K = config.K || 32;
        this.initialRating = config.initialRating || 1500;
        this.ratings = new Map();
        this.history = new Map();
        this.confidenceIntervals = new Map();
    }

    initializePlayer(playerId) {
        if (!this.ratings.has(playerId)) {
            this.ratings.set(playerId, this.initialRating);
            this.history.set(playerId, [{
                date: new Date(),
                rating: this.initialRating
            }]);
            this.updateConfidence(playerId);
        }
    }

    getExpectedScore(playerRating, opponentRating) {
        return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    }

    calculateNewRating(oldRating, expectedScore, actualScore, gamesPlayed) {
        let adjustedK = this.K;
        if (gamesPlayed > 30) adjustedK = Math.max(16, adjustedK * 0.75);
        if (gamesPlayed > 100) adjustedK = Math.max(8, adjustedK * 0.5);

        return Math.round(oldRating + adjustedK * (actualScore - expectedScore));
    }

    updateRating(playerId, color, opponentId, opponentColor, result) {
        if (playerId === opponentId) {
            return {
                oldRating: this.initialRating,
                newRating: this.initialRating,
                change: 0
            };
        }

        this.initializePlayer(playerId);
        this.initializePlayer(opponentId);

        const playerRating = this.ratings.get(playerId);
        const opponentRating = this.ratings.get(opponentId);

        const expectedScore = this.getExpectedScore(playerRating, opponentRating);
        const actualScore = result === 'win' ? 1 : result === 'loss' ? 0 : 0.5;

        const gamesPlayed = this.getGamesPlayed(playerId);
        const newRating = this.calculateNewRating(playerRating, expectedScore, actualScore, gamesPlayed);

        this.ratings.set(playerId, newRating);

        this.history.get(playerId).push({
            date: new Date(),
            rating: newRating,
            color: color
        });

        this.updateConfidence(playerId);

        return {
            oldRating: playerRating,
            newRating,
            change: newRating - playerRating
        };
    }

    updateConfidence(playerId) {
        const history = this.history.get(playerId);
        const recentGames = history.slice(-30);

        if (recentGames.length < 5) {
            this.confidenceIntervals.set(playerId, 200);
            return;
        }

        const ratings = recentGames.map(h => h.rating);
        const stdDev = this.calculateStdDev(ratings);
        const interval = Math.round(1.96 * stdDev / Math.sqrt(recentGames.length));
        this.confidenceIntervals.set(playerId, interval);
    }

    calculateStdDev(values) {
        const mean = values.reduce((a, b) => a + b) / values.length;
        const squareDiffs = values.map(value => {
            const diff = value - mean;
            return diff * diff;
        });
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
        return Math.sqrt(avgSquareDiff);
    }

    getRating(playerId) {
        if (!this.ratings.has(playerId)) {
            this.initializePlayer(playerId);
        }
        return this.ratings.get(playerId);
    }

    getConfidenceInterval(playerId) {
        return this.confidenceIntervals.get(playerId) || 200;
    }

    getRatingHistory(playerId) {
        return this.history.get(playerId) || [];
    }

    getGamesPlayed(playerId) {
        return (this.history.get(playerId)?.length || 1) - 1;
    }

    getFormattedRating(playerId) {
        const rating = this.getRating(playerId);
        const confidence = this.getConfidenceInterval(playerId);
        return `${rating} ±${confidence}`;
    }

    isSelfPlay(playerId1, playerId2) {
        return playerId1 === playerId2;
    }
}

export default ELOSystem;
