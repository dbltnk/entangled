// simulation-analyzer.js
class SimulationAnalyzer {
    constructor(results) {
        this.results = results;
    }

    getMatchupStats() {
        // Group results by strategy pairs, preserving color assignments
        const strategyPairs = new Map();

        for (const result of this.results) {
            const { matchup, winner, finalScore } = result;
            // Don't sort strategies - preserve color assignment
            const pairKey = `${matchup.player1}:${matchup.player2}`;

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

            if (winner === 'TIE') {
                stats.draws++;
            } else if (winner === 'BLACK') {
                stats.blackWins++;
            } else {
                stats.whiteWins++;
            }

            stats.blackTotalScore += finalScore.black;
            stats.whiteTotalScore += finalScore.white;

            if (result.history) {
                stats.histories.push(result.history);
            }
        }

        // Convert to final format with expanded statistics
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
            histories: stats.histories,
            // Add color-specific performance metrics
            asBlackStats: {
                strategy: stats.strategy1,
                winRate: (stats.blackWins / stats.games * 100).toFixed(1),
                avgScore: (stats.blackTotalScore / stats.games).toFixed(1)
            },
            asWhiteStats: {
                strategy: stats.strategy2,
                winRate: (stats.whiteWins / stats.games * 100).toFixed(1),
                avgScore: (stats.whiteTotalScore / stats.games).toFixed(1)
            }
        }));
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
                scoreAdvantage: stat.scoreAdvantage,
                colorSpecificStats: {
                    asBlack: stat.asBlackStats,
                    asWhite: stat.asWhiteStats
                }
            })),
            sampleGames: stats.reduce((acc, stat) => {
                acc[`${stat.strategy1}-vs-${stat.strategy2}`] = stat.histories;
                return acc;
            }, {})
        };
    }
}

export { SimulationAnalyzer };