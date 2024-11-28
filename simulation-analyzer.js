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

    getMaxPossibleScore(boardSize) {
        return boardSize * boardSize;  // Maximum score for one board
    }

    getResultsByBoardCombination() {
        const combinations = {};

        for (const result of this.results) {
            if (!result.boardConfig) continue;

            const boardKey = this.getBoardCombinationKey(result.boardConfig);
            if (!boardKey) continue;

            if (!combinations[boardKey]) {
                combinations[boardKey] = [];
            }

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
                    boardConfig: result.boardConfig,
                    // Track separate scores for each board
                    blackBoard1Total: 0,
                    blackBoard2Total: 0,
                    whiteBoard1Total: 0,
                    whiteBoard2Total: 0,
                    // Track highest scores achieved
                    blackHighestScore: 0,
                    whiteHighestScore: 0
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

            // Track per-board scores
            const board1Black = result.largestClusters.black.board1.length;
            const board2Black = result.largestClusters.black.board2.length;
            const board1White = result.largestClusters.white.board1.length;
            const board2White = result.largestClusters.white.board2.length;

            matchup.blackBoard1Total += board1Black;
            matchup.blackBoard2Total += board2Black;
            matchup.whiteBoard1Total += board1White;
            matchup.whiteBoard2Total += board2White;

            // Update highest scores
            const blackScore = board1Black + board2Black;
            const whiteScore = board1White + board2White;
            matchup.blackHighestScore = Math.max(matchup.blackHighestScore, blackScore);
            matchup.whiteHighestScore = Math.max(matchup.whiteHighestScore, whiteScore);

            if (result.history) {
                matchup.histories.push(result.history);
            }
        }

        // Calculate derived statistics for each matchup
        Object.values(combinations).forEach(matchups => {
            matchups.forEach(matchup => {
                const maxBoardScore = this.getMaxPossibleScore(matchup.boardConfig.boardSize);
                const maxTotalScore = maxBoardScore * 2;

                matchup.blackWinRate = (matchup.blackWins / matchup.games) * 100;
                matchup.whiteWinRate = (matchup.whiteWins / matchup.games) * 100;
                matchup.drawRate = (matchup.draws / matchup.games) * 100;
                matchup.avgScoreBlack = matchup.blackTotalScore / matchup.games;
                matchup.avgScoreWhite = matchup.whiteTotalScore / matchup.games;
                matchup.winAdvantage = matchup.blackWinRate - matchup.whiteWinRate;
                matchup.scoreAdvantage = matchup.avgScoreBlack - matchup.avgScoreWhite;

                // Calculate average per-board scores
                matchup.avgBlackBoard1 = matchup.blackBoard1Total / matchup.games;
                matchup.avgBlackBoard2 = matchup.blackBoard2Total / matchup.games;
                matchup.avgWhiteBoard1 = matchup.whiteBoard1Total / matchup.games;
                matchup.avgWhiteBoard2 = matchup.whiteBoard2Total / matchup.games;

                // Calculate score percentages
                matchup.blackScorePercentage = (matchup.avgScoreBlack / maxTotalScore) * 100;
                matchup.whiteScorePercentage = (matchup.avgScoreWhite / maxTotalScore) * 100;
                matchup.blackHighestPercentage = (matchup.blackHighestScore / maxTotalScore) * 100;
                matchup.whiteHighestPercentage = (matchup.whiteHighestScore / maxTotalScore) * 100;
            });

            // Sort matchups
            matchups.sort((a, b) => {
                const aSelf = a.player1 === a.player2;
                const bSelf = b.player1 === b.player2;
                if (aSelf !== bSelf) return aSelf ? -1 : 1;
                if (a.player1 === b.player1) return a.player2.localeCompare(b.player2);
                return a.player1.localeCompare(b.player1);
            });
        });

        return combinations;
    }

    getMatchupStats() {
        return Object.values(this.getResultsByBoardCombination()).flat();
    }

    exportResults() {
        const combinationResults = this.getResultsByBoardCombination();
        return {
            timestamp: new Date().toISOString(),
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
                        avgBlackBoard1: matchup.avgBlackBoard1,
                        avgBlackBoard2: matchup.avgBlackBoard2,
                        avgWhiteBoard1: matchup.avgWhiteBoard1,
                        avgWhiteBoard2: matchup.avgWhiteBoard2,
                        winAdvantage: matchup.winAdvantage,
                        scoreAdvantage: matchup.scoreAdvantage,
                        blackScorePercentage: matchup.blackScorePercentage,
                        whiteScorePercentage: matchup.whiteScorePercentage,
                        blackHighestScore: matchup.blackHighestScore,
                        whiteHighestScore: matchup.whiteHighestScore,
                        blackHighestPercentage: matchup.blackHighestPercentage,
                        whiteHighestPercentage: matchup.whiteHighestPercentage,
                        boardSize: matchup.boardConfig.boardSize
                    },
                    sampleGames: matchup.histories
                }))
            }))
        };
    }

    calculateAverages(matchups) {
        if (!matchups || matchups.length === 0) return null;

        const totals = matchups.reduce((acc, matchup) => {
            const maxBoardScore = this.getMaxPossibleScore(matchup.boardConfig.boardSize);
            const maxTotalScore = maxBoardScore * 2;

            return {
                blackWinRate: acc.blackWinRate + matchup.blackWinRate,
                whiteWinRate: acc.whiteWinRate + matchup.whiteWinRate,
                drawRate: acc.drawRate + matchup.drawRate,
                avgScoreBlack: acc.avgScoreBlack + matchup.avgScoreBlack,
                avgScoreWhite: acc.avgScoreWhite + matchup.avgScoreWhite,
                avgBlackBoard1: acc.avgBlackBoard1 + matchup.avgBlackBoard1,
                avgBlackBoard2: acc.avgBlackBoard2 + matchup.avgBlackBoard2,
                avgWhiteBoard1: acc.avgWhiteBoard1 + matchup.avgWhiteBoard1,
                avgWhiteBoard2: acc.avgWhiteBoard2 + matchup.avgWhiteBoard2,
                winAdvantage: acc.winAdvantage + matchup.winAdvantage,
                scoreAdvantage: acc.scoreAdvantage + matchup.scoreAdvantage,
                blackScorePercentage: acc.blackScorePercentage + matchup.blackScorePercentage,
                whiteScorePercentage: acc.whiteScorePercentage + matchup.whiteScorePercentage,
                blackHighestPercentage: acc.blackHighestPercentage + matchup.blackHighestPercentage,
                whiteHighestPercentage: acc.whiteHighestPercentage + matchup.whiteHighestPercentage
            };
        }, {
            blackWinRate: 0,
            whiteWinRate: 0,
            drawRate: 0,
            avgScoreBlack: 0,
            avgScoreWhite: 0,
            avgBlackBoard1: 0,
            avgBlackBoard2: 0,
            avgWhiteBoard1: 0,
            avgWhiteBoard2: 0,
            winAdvantage: 0,
            scoreAdvantage: 0,
            blackScorePercentage: 0,
            whiteScorePercentage: 0,
            blackHighestPercentage: 0,
            whiteHighestPercentage: 0
        });

        const count = matchups.length;
        return Object.fromEntries(
            Object.entries(totals).map(([key, value]) => [key, value / count])
        );
    }
}

export { SimulationAnalyzer };