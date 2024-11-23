// simulation-analyzer.js
class SimulationAnalyzer {
    constructor(results) {
        this.results = results;
    }

    getMatchupStats() {
        const matchupStats = new Map();

        for (const result of this.results) {
            const { matchup, winner, finalScore } = result;
            const key = this.getMatchupKey(matchup);

            if (!matchupStats.has(key)) {
                matchupStats.set(key, {
                    player1: matchup.player1,
                    player2: matchup.player2,
                    games: 0,
                    player1Wins: 0,
                    player2Wins: 0,
                    draws: 0,
                    avgScore1: 0,
                    avgScore2: 0,
                    avgMoves: 0,
                    histories: []
                });
            }

            const stats = matchupStats.get(key);
            stats.games++;

            if (winner === 'TIE') {
                stats.draws++;
            } else if (
                (winner === 'BLACK' && matchup.asBlack) ||
                (winner === 'WHITE' && !matchup.asBlack)
            ) {
                stats.player1Wins++;
            } else {
                stats.player2Wins++;
            }

            // Update running averages
            const score1 = matchup.asBlack ? finalScore.black : finalScore.white;
            const score2 = matchup.asBlack ? finalScore.white : finalScore.black;

            stats.avgScore1 = updateRunningAverage(stats.avgScore1, score1, stats.games);
            stats.avgScore2 = updateRunningAverage(stats.avgScore2, score2, stats.games);
            stats.avgMoves = updateRunningAverage(stats.avgMoves, result.moves, stats.games);

            if (result.history) {
                stats.histories.push(result.history);
            }
        }

        return Array.from(matchupStats.values());
    }

    getMatchupKey(matchup) {
        return `${matchup.player1}-vs-${matchup.player2}`;
    }

    exportResults() {
        const stats = this.getMatchupStats();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        return {
            timestamp,
            summary: stats.map(stat => ({
                matchup: `${stat.player1} vs ${stat.player2}`,
                totalGames: stat.games,
                player1WinRate: (stat.player1Wins / stat.games * 100).toFixed(1) + '%',
                player2WinRate: (stat.player2Wins / stat.games * 100).toFixed(1) + '%',
                drawRate: (stat.draws / stat.games * 100).toFixed(1) + '%',
                avgScore1: stat.avgScore1.toFixed(1),
                avgScore2: stat.avgScore2.toFixed(1),
                avgMoves: stat.avgMoves.toFixed(1)
            })),
            sampleGames: stats.reduce((acc, stat) => {
                acc[`${stat.player1}-vs-${stat.player2}`] = stat.histories;
                return acc;
            }, {})
        };
    }
}

function updateRunningAverage(currentAvg, newValue, count) {
    return currentAvg + (newValue - currentAvg) / count;
}

export { SimulationAnalyzer };