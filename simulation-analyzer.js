// simulation-analyzer.js
class SimulationAnalyzer {
    constructor(results) {
        this.results = results;
    }

    getMatchupStats() {
        // First, group results by strategy pairs regardless of color
        const strategyPairs = new Map();

        for (const result of this.results) {
            const { matchup, winner, finalScore } = result;
            const pairKey = this.getStrategyPairKey(matchup.player1, matchup.player2);

            if (!strategyPairs.has(pairKey)) {
                strategyPairs.set(pairKey, {
                    strategy1: matchup.player1,
                    strategy2: matchup.player2,
                    games: 0,
                    blackWins: 0,
                    whiteWins: 0,
                    draws: 0,
                    blackTotalScore: 0,
                    whiteTotalScore: 0,
                    histories: []
                });
            }

            const stats = strategyPairs.get(pairKey);
            stats.games++;

            // Track wins by color
            if (winner === 'TIE') {
                stats.draws++;
            } else if (winner === 'BLACK') {
                stats.blackWins++;
            } else {
                stats.whiteWins++;
            }

            // Track scores by color
            stats.blackTotalScore += finalScore.black;
            stats.whiteTotalScore += finalScore.white;

            if (result.history) {
                stats.histories.push(result.history);
            }
        }

        // Convert to final format
        return Array.from(strategyPairs.values()).map(stats => ({
            strategy1: stats.strategy1,
            strategy2: stats.strategy2,
            games: stats.games,
            blackWinRate: (stats.blackWins / stats.games * 100).toFixed(1),
            whiteWinRate: (stats.whiteWins / stats.games * 100).toFixed(1),
            drawRate: (stats.draws / stats.games * 100).toFixed(1),
            avgScoreBlack: (stats.blackTotalScore / stats.games).toFixed(1),
            avgScoreWhite: (stats.whiteTotalScore / stats.games).toFixed(1),
            winAdvantage: ((stats.blackWins - stats.whiteWins) / stats.games * 100).toFixed(1),
            scoreAdvantage: ((stats.blackTotalScore - stats.whiteTotalScore) / stats.games).toFixed(1),
            histories: stats.histories
        }));
    }

    getStrategyPairKey(strategy1, strategy2) {
        // For mirror matchups, order doesn't matter
        if (strategy1 === strategy2) {
            return `${strategy1}:${strategy2}`;
        }
        // For different strategies, use alphabetical order for consistency
        return [strategy1, strategy2].sort().join(':');
    }

    exportResults() {
        const stats = this.getMatchupStats();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        return {
            timestamp,
            summary: stats.map(stat => ({
                matchup: `${stat.strategy1} vs ${stat.strategy2}`,
                games: stat.games,
                blackWinRate: `${stat.blackWinRate}%`,
                whiteWinRate: `${stat.whiteWinRate}%`,
                drawRate: `${stat.drawRate}%`,
                avgScoreBlack: stat.avgScoreBlack,
                avgScoreWhite: stat.avgScoreWhite,
                winAdvantage: `${stat.winAdvantage}%`,
                scoreAdvantage: stat.scoreAdvantage
            })),
            sampleGames: stats.reduce((acc, stat) => {
                acc[`${stat.strategy1}-vs-${stat.strategy2}`] = stat.histories;
                return acc;
            }, {})
        };
    }
}

export { SimulationAnalyzer };