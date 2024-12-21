import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer, AI_PLAYERS } from './players.js';
import BOARD_LAYOUTS from './boards.js';
import ELOSystem from './elo.js';
import TournamentStorage from './tournament-storage.js';

class TournamentManager {
    constructor() {
        this.workers = [];
        this.results = new Map();
        this.matchups = [];
        this.currentMatchIndex = 0;
        this.gamesCompleted = 0;
        this.totalGames = 0;
        this.startTime = 0;
        this.boardConfigs = [];
        this.gamesPerMatchup = 0;
        this.matchCounts = new Map();
        this.elo = new ELOSystem();
        this.selectedAIs = [];
        this.storage = new TournamentStorage();
        this.initializeUI();
        this.setupEventListeners();
    }

    initializeUI() {
        const aiSelection = document.getElementById('ai-selection');
        Object.entries(AI_PLAYERS).forEach(([id, ai]) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="${id}" name="ai-select" value="${id}" 
                    ${this.isDefaultAI(id) ? 'checked' : ''}>
                <label for="${id}" style="white-space: normal;">${ai.name}</label>
            `;
            aiSelection.appendChild(div);
        });

        document.getElementById('board-size').addEventListener('change', () => this.updateBoardSelections());
        this.updateBoardSelections();
    }

    isDefaultAI(id) {
        const defaultAIs = ['hybrid-strong', 'mcts-some-rng', 'minimax-some-rng', 'defensive-some-rng'];
        //const defaultAIs = ['random', 'deterministic', 'aggressive-some-rng'];
        return defaultAIs.includes(id);
    }

    updateBoardSelections() {
        const board1Select = document.getElementById('tournament-board1-select');
        const board2Select = document.getElementById('tournament-board2-select');
        const boardSize = parseInt(document.getElementById('board-size').value);

        board1Select.innerHTML = '';
        board2Select.innerHTML = '';

        Object.entries(BOARD_LAYOUTS).forEach(([id, layout]) => {
            if (layout.grid.length === boardSize) {
                const option = new Option(layout.name, id);
                board1Select.add(option.cloneNode(true));
                board2Select.add(option.cloneNode(true));
            }
        });

        this.setDefaultBoardSelections(boardSize, board1Select, board2Select);
    }

    setDefaultBoardSelections(size, board1Select, board2Select) {
        const defaultSelections = {
            4: ['board4x4', 'random4x4'],
            5: ['board1', 'board4'],
            6: ['board6x6', 'random6x6'],
            7: ['board7x7', 'centeredRandom7x7']
        };

        const [board1Default, board2Default] = defaultSelections[size] || defaultSelections[5];
        if (this.hasOption(board1Select, board1Default)) board1Select.value = board1Default;
        if (this.hasOption(board2Select, board2Default)) board2Select.value = board2Default;
    }

    hasOption(select, value) {
        return Array.from(select.options).some(option => option.value === value);
    }

    setupEventListeners() {
        document.getElementById('start-tournament').addEventListener('click', () => this.startTournament());

        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabId}-tab`);
        });
    }

    displayBoardConfiguration() {
        const currentConfig = document.getElementById('current-config');
        currentConfig.classList.remove('hidden');

        const board1Layout = BOARD_LAYOUTS[document.getElementById('tournament-board1-select').value];
        const board2Layout = BOARD_LAYOUTS[document.getElementById('tournament-board2-select').value];
        const startingConfig = document.getElementById('tournament-starting-config').value;

        document.getElementById('board1-name').textContent = board1Layout.name;
        document.getElementById('board2-name').textContent = board2Layout.name;
        document.getElementById('config-preview').textContent = startingConfig || 'No starting stones';
    }

    getSelectedAIs() {
        const checkboxes = document.querySelectorAll('input[name="ai-select"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    generateMatchups(selectedAIs) {
        let matchups = [];
        for (let i = 0; i < selectedAIs.length; i++) {
            for (let j = i; j < selectedAIs.length; j++) {
                matchups.push({
                    black: selectedAIs[i],
                    white: selectedAIs[j]
                });
                matchups.push({
                    black: selectedAIs[j],
                    white: selectedAIs[i]
                });
            }
        }

        for (let i = matchups.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [matchups[i], matchups[j]] = [matchups[j], matchups[i]];
        }

        return matchups;
    }

    async startTournament() {
        this.selectedAIs = this.getSelectedAIs();
        if (this.selectedAIs.length < 1) {
            alert('Please select at least 1 AI for the tournament');
            return;
        }

        this.gamesPerMatchup = parseInt(document.getElementById('games-per-matchup').value);
        const parallelGames = parseInt(document.getElementById('parallel-games').value);
        const board1Layout = BOARD_LAYOUTS[document.getElementById('tournament-board1-select').value].grid;
        const board2Layout = BOARD_LAYOUTS[document.getElementById('tournament-board2-select').value].grid;
        const startingConfig = document.getElementById('tournament-starting-config').value;

        this.boardConfigs = [{
            board1Layout,
            board2Layout,
            startingConfig
        }];

        this.displayBoardConfiguration();

        this.matchups = this.generateMatchups(this.selectedAIs);
        this.totalGames = this.matchups.length * this.gamesPerMatchup;
        this.gamesCompleted = 0;
        this.currentMatchIndex = 0;
        this.results = new Map();
        this.matchCounts = new Map();
        this.startTime = Date.now();
        this.elo = new ELOSystem();

        this.matchups.forEach(matchup => {
            this.matchCounts.set(`${matchup.black}-${matchup.white}`, 0);
            this.elo.initializePlayer(matchup.black);
            this.elo.initializePlayer(matchup.white);
        });

        // Initialize storage
        await this.storage.initializeStorage(this.selectedAIs, this.boardConfigs);

        document.getElementById('progress-container').classList.remove('hidden');
        this.updateProgress();

        if (this.workers.length > 0) {
            this.workers.forEach(worker => worker.terminate());
            this.workers = [];
        }

        const workerCount = Math.min(parallelGames, navigator.hardwareConcurrency || 4);
        this.workers = Array(workerCount).fill(null).map(() => {
            const worker = new Worker(new URL('./tournament-worker.js', import.meta.url), { type: 'module' });
            worker.onmessage = (e) => this.handleWorkerMessage(e);
            return worker;
        });

        this.workers.forEach(() => this.startNextGame());
    }

    startNextGame() {
        while (this.currentMatchIndex < this.matchups.length) {
            const matchup = this.matchups[this.currentMatchIndex];
            const matchKey = `${matchup.black}-${matchup.white}`;
            const gamesPlayed = this.matchCounts.get(matchKey);

            if (gamesPlayed < this.gamesPerMatchup) {
                const boardConfig = this.boardConfigs[0];
                const gameConfig = {
                    matchup,
                    boardConfig,
                    matchIndex: this.currentMatchIndex
                };

                const worker = this.workers.find(w => !w.busy);
                if (worker) {
                    worker.busy = true;
                    worker.postMessage(gameConfig);
                    this.matchCounts.set(matchKey, gamesPlayed + 1);
                    return true;
                }
                return false;
            }

            this.currentMatchIndex++;
        }
        return false;
    }

    async handleWorkerMessage(e) {
        const { matchup, result } = e.data;
        this.gamesCompleted++;

        this.updateMatchResults(matchup, result);

        if (matchup.black !== matchup.white) {
            this.updateELORatings(matchup, result);
        }

        // Store game result
        await this.storage.addGameResult({
            matchup,
            result: {
                winner: result.winner,
                blackScore: result.blackScore,
                whiteScore: result.whiteScore,
                history: result.history
            }
        });

        this.updateProgress();
        this.updateResults();

        const worker = e.target;
        worker.busy = false;
        this.startNextGame();

        if (this.gamesCompleted === this.totalGames) {
            this.tournamentComplete();
        }
    }

    updateMatchResults(matchup, result) {
        const matchKey = `${matchup.black}-${matchup.white}`;
        if (!this.results.has(matchKey)) {
            this.results.set(matchKey, {
                black: matchup.black,
                white: matchup.white,
                blackWins: 0,
                whiteWins: 0,
                draws: 0,
                games: [],
                totalBlackScore: 0,
                totalWhiteScore: 0
            });
        }

        const matchResult = this.results.get(matchKey);
        matchResult.games.push(result);
        matchResult.totalBlackScore += result.blackScore;
        matchResult.totalWhiteScore += result.whiteScore;

        if (result.winner === PLAYERS.BLACK) {
            matchResult.blackWins++;
        } else if (result.winner === PLAYERS.WHITE) {
            matchResult.whiteWins++;
        } else {
            matchResult.draws++;
        }
    }

    updateELORatings(matchup, result) {
        const gameResult = result.winner === PLAYERS.BLACK ? 'win' :
            result.winner === PLAYERS.WHITE ? 'loss' : 'draw';

        this.elo.updateRating(matchup.black, 'black', matchup.white, 'white', gameResult);

        this.storage.updateELO(matchup.black,
            this.elo.getRating(matchup.black),
            this.elo.getConfidenceInterval(matchup.black)
        );
        this.storage.updateELO(matchup.white,
            this.elo.getRating(matchup.white),
            this.elo.getConfidenceInterval(matchup.white)
        );
    }

    updateProgress() {
        const progressPercent = (this.gamesCompleted / this.totalGames) * 100;
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const etaText = document.getElementById('eta-text');

        progressFill.style.width = `${progressPercent}%`;
        progressText.textContent = `Running matches: ${this.gamesCompleted}/${this.totalGames}`;

        const elapsed = Date.now() - this.startTime;
        if (this.gamesCompleted > 0) {
            const timePerGame = elapsed / this.gamesCompleted;
            const remaining = this.totalGames - this.gamesCompleted;
            const eta = remaining * timePerGame;
            etaText.textContent = `ETA: ${Math.ceil(eta / 1000)}s`;
        }
    }

    updateResults() {
        this.updateOverviewTab();
        this.updatePlayerStatsTab();
        this.updateMatchupsTab();
        this.updateDetailsTab();
    }

    updateOverviewTab() {
        // Update main table
        const tbody = document.querySelector('#overview-table tbody');
        tbody.innerHTML = '';

        // Calculate aggregated stats (existing code stays the same)
        const aggregatedStats = {
            totalGames: 0,
            whiteGames: 0,
            blackGames: 0,
            whiteWins: 0,
            blackWins: 0,
            whiteDraws: 0,
            blackDraws: 0,
            whiteLosses: 0,
            blackLosses: 0,
            whiteScores: [],
            blackScores: []
        };

        // Collect all non-self-play stats
        this.results.forEach((result) => {
            if (result.black === result.white) return; // Skip self-play for main table

            const blackData = {
                games: result.games.length,
                wins: result.blackWins,
                draws: result.draws,
                scores: result.games.map(g => g.blackScore)
            };
            const whiteData = {
                games: result.games.length,
                wins: result.whiteWins,
                draws: result.draws,
                scores: result.games.map(g => g.whiteScore)
            };

            aggregatedStats.totalGames += result.games.length;
            aggregatedStats.blackGames += blackData.games;
            aggregatedStats.blackWins += blackData.wins;
            aggregatedStats.blackDraws += blackData.draws;
            aggregatedStats.blackLosses += whiteData.wins;
            aggregatedStats.blackScores.push(...blackData.scores);

            aggregatedStats.whiteGames += whiteData.games;
            aggregatedStats.whiteWins += whiteData.wins;
            aggregatedStats.whiteDraws += whiteData.draws;
            aggregatedStats.whiteLosses += blackData.wins;
            aggregatedStats.whiteScores.push(...whiteData.scores);
        });

        // Calculate averages for main table
        const avgRow = this.createStatsRow('Average', {
            elo: null,
            white: {
                games: aggregatedStats.whiteGames,
                wins: aggregatedStats.whiteWins,
                draws: aggregatedStats.whiteDraws,
                losses: aggregatedStats.whiteLosses,
                scores: aggregatedStats.whiteScores
            },
            black: {
                games: aggregatedStats.blackGames,
                wins: aggregatedStats.blackWins,
                draws: aggregatedStats.blackDraws,
                losses: aggregatedStats.blackLosses,
                scores: aggregatedStats.blackScores
            }
        });
        tbody.appendChild(avgRow);

        // Add individual AI rows for main table
        const sortedAIs = Array.from(this.selectedAIs)
            .sort((a, b) => this.elo.getRating(b) - this.elo.getRating(a));

        sortedAIs.forEach(ai => {
            const aiStats = {
                elo: {
                    rating: this.elo.getRating(ai),
                    confidence: this.elo.getConfidenceInterval(ai)
                },
                white: { games: 0, wins: 0, draws: 0, losses: 0, scores: [] },
                black: { games: 0, wins: 0, draws: 0, losses: 0, scores: [] }
            };

            // Collect stats when AI plays as white/black (excluding self-play)
            this.results.forEach(result => {
                if (result.black === result.white) return; // Skip self-play

                if (result.white === ai) {
                    aiStats.white.games += result.games.length;
                    aiStats.white.wins += result.whiteWins;
                    aiStats.white.draws += result.draws;
                    aiStats.white.losses += result.blackWins;
                    aiStats.white.scores.push(...result.games.map(g => g.whiteScore));
                }
                if (result.black === ai) {
                    aiStats.black.games += result.games.length;
                    aiStats.black.wins += result.blackWins;
                    aiStats.black.draws += result.draws;
                    aiStats.black.losses += result.whiteWins;
                    aiStats.black.scores.push(...result.games.map(g => g.blackScore));
                }
            });

            const row = this.createStatsRow(AI_PLAYERS[ai].name, aiStats);
            tbody.appendChild(row);
        });

        // Update self-play table
        const selfPlayTbody = document.querySelector('#self-play-table tbody');
        selfPlayTbody.innerHTML = '';

        // Calculate self-play averages
        const selfPlayStats = {
            totalGames: 0,
            whiteGames: 0,
            blackGames: 0,
            whiteWins: 0,
            blackWins: 0,
            whiteDraws: 0,
            blackDraws: 0,
            whiteLosses: 0,
            blackLosses: 0,
            whiteScores: [],
            blackScores: []
        };

        // Collect all self-play stats
        this.results.forEach((result) => {
            if (result.black !== result.white) return; // Only include self-play

            const blackData = {
                games: result.games.length,
                wins: result.blackWins,
                draws: result.draws,
                scores: result.games.map(g => g.blackScore)
            };
            const whiteData = {
                games: result.games.length,
                wins: result.whiteWins,
                draws: result.draws,
                scores: result.games.map(g => g.whiteScore)
            };

            selfPlayStats.totalGames += result.games.length;
            selfPlayStats.blackGames += blackData.games;
            selfPlayStats.blackWins += blackData.wins;
            selfPlayStats.blackDraws += blackData.draws;
            selfPlayStats.blackLosses += whiteData.wins;
            selfPlayStats.blackScores.push(...blackData.scores);

            selfPlayStats.whiteGames += whiteData.games;
            selfPlayStats.whiteWins += whiteData.wins;
            selfPlayStats.whiteDraws += whiteData.draws;
            selfPlayStats.whiteLosses += blackData.wins;
            selfPlayStats.whiteScores.push(...whiteData.scores);
        });

        // Add average row for self-play
        const selfPlayAvgRow = this.createStatsRow('Average', {
            elo: null,
            white: {
                games: selfPlayStats.whiteGames,
                wins: selfPlayStats.whiteWins,
                draws: selfPlayStats.whiteDraws,
                losses: selfPlayStats.whiteLosses,
                scores: selfPlayStats.whiteScores
            },
            black: {
                games: selfPlayStats.blackGames,
                wins: selfPlayStats.blackWins,
                draws: selfPlayStats.blackDraws,
                losses: selfPlayStats.blackLosses,
                scores: selfPlayStats.blackScores
            }
        });
        selfPlayTbody.appendChild(selfPlayAvgRow);

        // Add individual AI rows for self-play
        sortedAIs.forEach(ai => {
            const selfPlayAiStats = {
                elo: {
                    rating: this.elo.getRating(ai),
                    confidence: this.elo.getConfidenceInterval(ai)
                },
                white: { games: 0, wins: 0, draws: 0, losses: 0, scores: [] },
                black: { games: 0, wins: 0, draws: 0, losses: 0, scores: [] }
            };

            // Collect self-play stats
            this.results.forEach(result => {
                if (result.black !== result.white || result.black !== ai) return;

                selfPlayAiStats.white.games += result.games.length;
                selfPlayAiStats.white.wins += result.whiteWins;
                selfPlayAiStats.white.draws += result.draws;
                selfPlayAiStats.white.losses += result.blackWins;
                selfPlayAiStats.white.scores.push(...result.games.map(g => g.whiteScore));

                selfPlayAiStats.black.games += result.games.length;
                selfPlayAiStats.black.wins += result.blackWins;
                selfPlayAiStats.black.draws += result.draws;
                selfPlayAiStats.black.losses += result.whiteWins;
                selfPlayAiStats.black.scores.push(...result.games.map(g => g.blackScore));
            });

            const row = this.createStatsRow(AI_PLAYERS[ai].name, selfPlayAiStats);
            selfPlayTbody.appendChild(row);
        });
    }

    createStatsRow(name, stats) {
        const row = document.createElement('tr');

        // Helper for calculating percentages
        const getPercent = (value, total) => ((value / (total || 1)) * 100).toFixed(1);

        // Helper for score stats
        const getScoreStats = (scores) => {
            if (!scores || scores.length === 0) return { avg: 0, min: 0, max: 0 };
            return {
                avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
                min: Math.min(...scores).toFixed(1),
                max: Math.max(...scores).toFixed(1)
            };
        };

        // Create stats for both colors
        const createColorStats = (colorStats) => {
            if (!colorStats || !colorStats.games) return { wins: 0, draws: 0, losses: 0, scores: [] };
            return {
                winPercent: getPercent(colorStats.wins, colorStats.games),
                drawPercent: getPercent(colorStats.draws, colorStats.games),
                lossPercent: getPercent(colorStats.losses, colorStats.games),
                scores: getScoreStats(colorStats.scores)
            };
        };

        const whiteStats = createColorStats(stats.white);
        const blackStats = createColorStats(stats.black);

        // Build row HTML
        row.innerHTML = `
            <td class="player-name">
                ${name}
                <div class="games-count" style="font-size: 12px; color: #666;">${stats.white.games + (stats.black?.games || 0)} games</div>
            </td>            
            <td class="elo-rating">
                ${stats.elo ? `
                    <span class="rating-value">${stats.elo.rating}</span>
                    <span class="confidence">±${stats.elo.confidence}</span>
                ` : '---'}
            </td>
            <td class="color-stats white-stats">
                <div class="score-stats">
                    <span class="avg-score">${whiteStats.scores.avg}</span>
                    <span class="score-range">${whiteStats.scores.min}-${whiteStats.scores.max}</span>
                </div>
            </td>
            <td class="win-percent">${whiteStats.winPercent}%</td>
            <td class="loss-percent">${whiteStats.lossPercent}%</td>
            <td class="draw-percent">${whiteStats.drawPercent}%</td>
            <td class="color-stats black-stats">
                <div class="score-stats">
                    <span class="avg-score">${blackStats.scores.avg}</span>
                    <span class="score-range">${blackStats.scores.min}-${blackStats.scores.max}</span>
                </div>
            </td>
            <td class="win-percent">${blackStats.winPercent}%</td>
            <td class="loss-percent">${blackStats.lossPercent}%</td>
            <td class="draw-percent">${blackStats.drawPercent}%</td>
        `;

        return row;
    }

    updateMatchupsTab() {
        const tbody = document.querySelector('#matchups-table tbody');
        tbody.innerHTML = '';

        this.results.forEach((result) => {
            const reverseKey = `${result.white}-${result.black}`;
            const reverseResult = this.results.get(reverseKey);

            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="white-space: normal;">${AI_PLAYERS[result.black].name}</td>
                <td style="white-space: normal;">${AI_PLAYERS[result.white].name}</td>
                <td>${result.games.length}</td>
                <td>${result.blackWins}-${result.whiteWins}-${result.draws}</td>
                <td>${reverseResult ? `${reverseResult.whiteWins}-${reverseResult.blackWins}-${reverseResult.draws}` : 'N/A'}</td>
            `;
        });
    }

    updatePlayerStatsTab() {
        const container = document.getElementById('player-stats-container');
        container.innerHTML = '';

        const sortedPlayers = this.selectedAIs
            .filter(id => AI_PLAYERS[id])
            .sort((a, b) => this.elo.getRating(b) - this.elo.getRating(a));

        sortedPlayers.forEach(playerId => {
            if (!AI_PLAYERS[playerId]) return;

            const playerStats = this.calculatePlayerStats(playerId);

            const card = document.createElement('div');
            card.className = 'player-card';
            card.style.border = '1px solid #ccc';
            card.style.padding = '10px';
            card.style.marginBottom = '10px';
            card.style.backgroundColor = '#f9f9f9';
            card.innerHTML = `
                <h3 style="color:#333;">${AI_PLAYERS[playerId].name}</h3>
                <div class="player-ratings" style="margin-bottom:5px;">
                    <div><strong>ELO Rating:</strong> ${this.elo.getFormattedRating(playerId)}</div>
                </div>
                <div class="player-performance" style="color:#555;">
                    <h4 style="margin-bottom:3px;">Performance</h4>
                    <div>Win Rate: ${playerStats.winRate}%</div>
                    <div>Games Played: ${playerStats.totalGames}</div>
                    <div>Average Score: ${playerStats.averageScore.toFixed(1)}</div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    calculatePlayerStats(playerId) {
        const stats = {
            wins: 0,
            losses: 0,
            draws: 0,
            totalGames: 0,
            totalScore: 0
        };

        this.results.forEach(result => {
            if (result.black === playerId) {
                stats.wins += result.blackWins;
                stats.losses += result.whiteWins;
                stats.draws += result.draws;
                stats.totalGames += result.games.length;
                stats.totalScore += result.totalBlackScore;
            }
            if (result.white === playerId) {
                stats.wins += result.whiteWins;
                stats.losses += result.blackWins;
                stats.draws += result.draws;
                stats.totalGames += result.games.length;
                stats.totalScore += result.totalWhiteScore;
            }
        });

        if (!stats.totalGames) {
            stats.wins = 0;
            stats.losses = 0;
            stats.draws = 0;
            stats.totalGames = 0;
            stats.totalScore = 0;
        }

        return {
            ...stats,
            winRate: stats.totalGames > 0 ? ((stats.wins + stats.draws * 0.5) / stats.totalGames * 100).toFixed(1) : '0.0',
            averageScore: stats.totalGames > 0 ? stats.totalScore / stats.totalGames : 0.0
        };
    }

    updateDetailsTab() {
        const container = document.getElementById('details-container');
        container.innerHTML = '';

        this.results.forEach((result) => {
            const matchupDiv = document.createElement('div');
            matchupDiv.className = 'game-detail';
            matchupDiv.style.marginBottom = '15px';

            const gamesHtml = result.games.map((game, index) => `
                <div class="game-result" style="margin-bottom:3px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="game-number"><strong>Game ${index + 1}:</strong></span>
                        <span class="winner-${game.winner.toLowerCase()}" style="margin-left:5px;">
                            ${game.winner === 'TIE' ? 'Draw' : game.winner + ' wins'}
                        </span>
                        <span style="margin-left:5px;">(Black: ${game.blackScore} - White: ${game.whiteScore})</span>
                    </div>
                    <button class="replay-button" data-game-index="${index}">Replay</button>
                </div>
            `).join('');

            matchupDiv.innerHTML = `
                <h3 style="margin-bottom:5px;">${AI_PLAYERS[result.black].name} (Black) vs ${AI_PLAYERS[result.white].name} (White)</h3>
                <div style="margin-bottom:5px;">Results: <strong>${result.blackWins}-${result.whiteWins}-${result.draws}</strong></div>
                <div class="game-moves">${gamesHtml}</div>
            `;

            matchupDiv.querySelectorAll('.replay-button').forEach((button, index) => {
                button.addEventListener('click', () => {
                    const gameData = {
                        history: result.games[index].history,
                        matchInfo: {
                            black: AI_PLAYERS[result.black].name,
                            white: AI_PLAYERS[result.white].name,
                            board1Name: BOARD_LAYOUTS[document.getElementById('tournament-board1-select').value].name,
                            board2Name: BOARD_LAYOUTS[document.getElementById('tournament-board2-select').value].name,
                            startingConfig: document.getElementById('tournament-starting-config').value
                        },
                        boardSize: this.boardConfigs[0].board1Layout.length
                    };

                    const replayWindow = window.open('replay.html', '_blank');
                    replayWindow.addEventListener('load', () => {
                        replayWindow.initializeReplay(gameData);
                    });
                });
            });

            container.appendChild(matchupDiv);
        });
    }

    async tournamentComplete() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        await this.storage.flushBuffers();
        console.log('Tournament complete!');
    }
}

window.addEventListener('load', () => {
    new TournamentManager();
});

export default TournamentManager;