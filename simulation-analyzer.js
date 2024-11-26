// simulation-analyzer.js
import { AI_PLAYERS } from './players.js';

class SimulationAnalyzer {
    constructor(results) {
        this.results = results;
    }

    getBoardCombinationKey(boardConfig) {
        if (!boardConfig) return null;
        return `${boardConfig.board1Layout}+${boardConfig.board2Layout} ${boardConfig.startingConfig || ''}`.trim();
    }

    getResultsByBoardCombination() {
        const combinations = {};

        for (const result of this.results) {
            if (!result.boardConfig) continue;

            // Create board combination key
            const boardKey = this.getBoardCombinationKey(result.boardConfig);
            if (!boardKey) continue;

            if (!combinations[boardKey]) {
                combinations[boardKey] = [];
            }

            // Find existing matchup or create new one
            const matchupKey = `${result.matchup.player1}-${result.matchup.player2}`;
            let matchup = combinations[boardKey].find(m => m.matchupId === matchupKey);

            if (!matchup) {
                matchup = {
                    matchupId: matchupKey,
                    matchupName: `${AI_PLAYERS[result.matchup.player1].name} vs ${AI_PLAYERS[result.matchup.player2].name}`,
                    player1: result.matchup.player1,
                    player2: result.matchup.player2,
                    player1Name: AI_PLAYERS[result.matchup.player1].name,
                    player2Name: AI_PLAYERS[result.matchup.player2].name,
                    games: 0,
                    blackWins: 0,
                    whiteWins: 0,
                    draws: 0,
                    blackTotalScore: 0,
                    whiteTotalScore: 0,
                    histories: [],
                    boardConfig: result.boardConfig
                };
                combinations[boardKey].push(matchup);
            }

            // Update matchup stats
            matchup.games++;

            if (result.winner === 'TIE') {
                matchup.draws++;
            } else if (result.winner === 'BLACK') {
                matchup.blackWins++;
            } else if (result.winner === 'WHITE') {
                matchup.whiteWins++;
            }

            matchup.blackTotalScore += result.finalScore.black;
            matchup.whiteTotalScore += result.finalScore.white;

            if (result.history) {
                matchup.histories.push(result.history);
            }
        }

        // Calculate derived statistics for each matchup
        Object.values(combinations).forEach(matchups => {
            matchups.forEach(matchup => {
                matchup.blackWinRate = (matchup.blackWins / matchup.games) * 100;
                matchup.whiteWinRate = (matchup.whiteWins / matchup.games) * 100;
                matchup.drawRate = (matchup.draws / matchup.games) * 100;
                matchup.avgScoreBlack = matchup.blackTotalScore / matchup.games;
                matchup.avgScoreWhite = matchup.whiteTotalScore / matchup.games;
                matchup.winAdvantage = matchup.blackWinRate - matchup.whiteWinRate;
                matchup.scoreAdvantage = matchup.avgScoreBlack - matchup.avgScoreWhite;
            });

            // Sort matchups within each combination by player names for consistent ordering
            matchups.sort((a, b) => {
                // Self-play matchups first
                const aSelf = a.player1 === a.player2;
                const bSelf = b.player1 === b.player2;
                if (aSelf !== bSelf) return aSelf ? -1 : 1;

                // Then sort by player names
                if (a.player1 === b.player1) {
                    return a.player2.localeCompare(b.player2);
                }
                return a.player1.localeCompare(b.player1);
            });
        });

        return combinations;
    }

    getMatchupStats() {
        // Get all stats grouped by board combination
        const combinationResults = this.getResultsByBoardCombination();

        // Flatten and return all matchups
        return Object.values(combinationResults).flat();
    }

    exportResults() {
        const combinationResults = this.getResultsByBoardCombination();
        const timestamp = new Date().toISOString();

        return {
            timestamp,
            results: Object.entries(combinationResults).map(([combination, matchups]) => ({
                combination,
                boardConfig: matchups[0].boardConfig,
                matchups: matchups.map(matchup => ({
                    players: {
                        black: matchup.player1,
                        white: matchup.player2
                    },
                    stats: {
                        games: matchup.games,
                        blackWinRate: matchup.blackWinRate,
                        whiteWinRate: matchup.whiteWinRate,
                        drawRate: matchup.drawRate,
                        avgScoreBlack: matchup.avgScoreBlack,
                        avgScoreWhite: matchup.avgScoreWhite,
                        winAdvantage: matchup.winAdvantage,
                        scoreAdvantage: matchup.scoreAdvantage
                    },
                    sampleGames: matchup.histories
                }))
            }))
        };
    }

    calculateAverages(matchups) {
        if (!matchups || matchups.length === 0) return null;

        const sum = matchups.reduce((acc, matchup) => ({
            blackWinRate: acc.blackWinRate + matchup.blackWinRate,
            whiteWinRate: acc.whiteWinRate + matchup.whiteWinRate,
            drawRate: acc.drawRate + matchup.drawRate,
            avgScoreBlack: acc.avgScoreBlack + matchup.avgScoreBlack,
            avgScoreWhite: acc.avgScoreWhite + matchup.avgScoreWhite,
            winAdvantage: acc.winAdvantage + matchup.winAdvantage,
            scoreAdvantage: acc.scoreAdvantage + matchup.scoreAdvantage
        }), {
            blackWinRate: 0,
            whiteWinRate: 0,
            drawRate: 0,
            avgScoreBlack: 0,
            avgScoreWhite: 0,
            winAdvantage: 0,
            scoreAdvantage: 0
        });

        const count = matchups.length;
        return {
            blackWinRate: sum.blackWinRate / count,
            whiteWinRate: sum.whiteWinRate / count,
            drawRate: sum.drawRate / count,
            avgScoreBlack: sum.avgScoreBlack / count,
            avgScoreWhite: sum.avgScoreWhite / count,
            winAdvantage: sum.winAdvantage / count,
            scoreAdvantage: sum.scoreAdvantage / count
        };
    }
}

export { SimulationAnalyzer };