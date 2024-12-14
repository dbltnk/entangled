// ELO Rating System for Entangled Tournament

class ELOSystem {
    constructor(config = {}) {
        this.K = config.K || 32; // Base K-factor
        this.initialRating = config.initialRating || 1500;
        this.ratings = new Map(); // {playerId: {black: rating, white: rating}}
        this.history = new Map(); // {playerId: [{date, blackRating, whiteRating}]}
        this.confidenceIntervals = new Map();
    }

    initializePlayer(playerId) {
        if (!this.ratings.has(playerId)) {
            this.ratings.set(playerId, {
                black: this.initialRating,
                white: this.initialRating
            });
            this.history.set(playerId, [{
                date: new Date(),
                blackRating: this.initialRating,
                whiteRating: this.initialRating
            }]);
            this.updateConfidence(playerId);
        }
    }

    getExpectedScore(playerRating, opponentRating) {
        return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    }

    calculateNewRating(oldRating, expectedScore, actualScore, gamesPlayed) {
        // Adjust K-factor based on number of games played
        let adjustedK = this.K;
        if (gamesPlayed > 30) adjustedK = Math.max(16, adjustedK * 0.75);
        if (gamesPlayed > 100) adjustedK = Math.max(8, adjustedK * 0.5);

        return Math.round(oldRating + adjustedK * (actualScore - expectedScore));
    }

    updateRating(playerId, color, opponentId, opponentColor, result) {
        this.initializePlayer(playerId);
        this.initializePlayer(opponentId);

        const playerRating = this.ratings.get(playerId)[color];
        const opponentRating = this.ratings.get(opponentId)[opponentColor];

        const expectedScore = this.getExpectedScore(playerRating, opponentRating);
        const actualScore = result === 'win' ? 1 : result === 'loss' ? 0 : 0.5;

        const gamesPlayed = this.getGamesPlayed(playerId);
        const newRating = this.calculateNewRating(playerRating, expectedScore, actualScore, gamesPlayed);

        // Update ratings
        const currentRatings = this.ratings.get(playerId);
        currentRatings[color] = newRating;

        // Record history
        const history = this.history.get(playerId);
        history.push({
            date: new Date(),
            blackRating: currentRatings.black,
            whiteRating: currentRatings.white
        });

        // Update confidence intervals
        this.updateConfidence(playerId);

        return {
            oldRating: playerRating,
            newRating,
            change: newRating - playerRating
        };
    }

    updateConfidence(playerId) {
        const history = this.history.get(playerId);
        const recentGames = history.slice(-30); // Last 30 games for confidence

        if (recentGames.length < 5) {
            this.confidenceIntervals.set(playerId, {
                black: 200,
                white: 200
            });
            return;
        }

        // Calculate standard deviation for both colors
        const blackRatings = recentGames.map(h => h.blackRating);
        const whiteRatings = recentGames.map(h => h.whiteRating);

        const blackStdDev = this.calculateStdDev(blackRatings);
        const whiteStdDev = this.calculateStdDev(whiteRatings);

        // 95% confidence interval = 1.96 * stdDev / sqrt(n)
        const blackInterval = Math.round(1.96 * blackStdDev / Math.sqrt(recentGames.length));
        const whiteInterval = Math.round(1.96 * whiteStdDev / Math.sqrt(recentGames.length));

        this.confidenceIntervals.set(playerId, {
            black: blackInterval,
            white: whiteInterval
        });
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

    getRating(playerId, color) {
        if (!this.ratings.has(playerId)) {
            this.initializePlayer(playerId);
        }
        return this.ratings.get(playerId)[color];
    }

    getConfidenceInterval(playerId, color) {
        return this.confidenceIntervals.get(playerId)?.[color] || 200;
    }

    getRatingHistory(playerId) {
        return this.history.get(playerId) || [];
    }

    getGamesPlayed(playerId) {
        return (this.history.get(playerId)?.length || 1) - 1;
    }

    getFormattedRating(playerId, color) {
        const rating = this.getRating(playerId, color);
        const confidence = this.getConfidenceInterval(playerId, color);
        return `${rating} ±${confidence}`;
    }
}

export default ELOSystem;