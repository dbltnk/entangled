import { EntangledGame, PLAYERS } from './gameplay.js';
import { createPlayer, AI_PLAYERS } from './players.js';
import BOARD_LAYOUTS from './boards.js';
import ELOSystem from './elo.js';

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
        const defaultAIs = ['aggressive-some-rng', 'defensive-some-rng', 'minimax-some-rng', 'mcts'];
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
            5: ['board1', 'board2'],
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
                if (i !== j) {
                    matchups.push({
                        black: selectedAIs[j],
                        white: selectedAIs[i]
                    });
                }
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
        this.results.clear();
        this.matchCounts.clear();
        this.startTime = Date.now();

        this.matchups.forEach(matchup => {
            this.matchCounts.set(`${matchup.black}-${matchup.white}`, 0);
            this.elo.initializePlayer(matchup.black);
            this.elo.initializePlayer(matchup.white);
        });

        document.getElementById('progress-container').classList.remove('hidden');
        this.updateProgress();

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

    handleWorkerMessage(e) {
        const { matchup, result } = e.data;
        this.gamesCompleted++;

        this.updateMatchResults(matchup, result);

        if (matchup.black !== matchup.white) {
            this.updateELORatings(matchup, result);
        }

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
        // Show Overview, then Player Stats, then Matchups, then Details
        this.updateOverviewTab();
        this.updatePlayerStatsTab();
        this.updateMatchupsTab();
        this.updateDetailsTab();
    }

    updateOverviewTab() {
        const colorStats = {
            black: { wins: 0, draws: 0, total: 0, score: 0 },
            white: { wins: 0, draws: 0, total: 0, score: 0 }
        };

        this.results.forEach(result => {
            colorStats.black.wins += result.blackWins;
            colorStats.white.wins += result.whiteWins;
            colorStats.black.draws += result.draws;
            colorStats.white.draws += result.draws;
            colorStats.black.total += result.games.length;
            colorStats.white.total += result.games.length;
            colorStats.black.score += result.totalBlackScore;
            colorStats.white.score += result.totalWhiteScore;
        });

        const colorStatsBody = document.querySelector('#color-stats-table tbody');
        colorStatsBody.innerHTML = '';

        ['black', 'white'].forEach(color => {
            const stats = colorStats[color];
            const winRate = ((stats.wins + stats.draws * 0.5) / stats.total * 100).toFixed(1);
            const drawRate = (stats.draws / stats.total * 100).toFixed(1);
            const avgScore = (stats.score / stats.total).toFixed(1);

            const row = colorStatsBody.insertRow();
            row.innerHTML = `
                <td style="white-space: normal; font-weight:bold;">${color.charAt(0).toUpperCase() + color.slice(1)}</td>
                <td>${winRate}%</td>
                <td>${drawRate}%</td>
                <td>${avgScore}</td>
            `;
        });

        // Build overview data with per-color stats for each AI
        const overviewData = new Map();
        this.selectedAIs.forEach(ai => {
            overviewData.set(ai, {
                wins: 0,
                losses: 0,
                draws: 0,
                totalGames: 0,
                totalScore: 0,
                blackWins: 0,
                blackGames: 0,
                whiteWins: 0,
                whiteGames: 0
            });
        });

        this.results.forEach((result) => {
            const blackData = overviewData.get(result.black);
            const whiteData = overviewData.get(result.white);

            if (blackData) {
                blackData.wins += result.blackWins;
                blackData.losses += result.whiteWins;
                blackData.draws += result.draws;
                blackData.totalGames += result.games.length;
                blackData.totalScore += result.totalBlackScore;
                blackData.blackWins += result.blackWins;
                blackData.blackGames += result.games.length;
            }

            if (whiteData) {
                whiteData.wins += result.whiteWins;
                whiteData.losses += result.blackWins;
                whiteData.draws += result.draws;
                whiteData.totalGames += result.games.length;
                whiteData.totalScore += result.totalWhiteScore;
                whiteData.whiteWins += result.whiteWins;
                whiteData.whiteGames += result.games.length;
            }
        });

        const sortedAIs = Array.from(overviewData.entries())
            .sort((a, b) => this.elo.getRating(b[0]) - this.elo.getRating(a[0]));

        const tbody = document.querySelector('#overview-table tbody');
        tbody.innerHTML = '';

        sortedAIs.forEach(([ai, data]) => {
            const overallWR = ((data.wins + data.draws * 0.5) / (data.totalGames || 1) * 100).toFixed(1);
            const avgScore = (data.totalScore / (data.totalGames || 1)).toFixed(1);
            const blackWR = data.blackGames > 0 ? ((data.blackWins / data.blackGames) * 100).toFixed(1) : '0.0';
            const whiteWR = data.whiteGames > 0 ? ((data.whiteWins / data.whiteGames) * 100).toFixed(1) : '0.0';

            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="white-space: normal; font-weight:bold;">${AI_PLAYERS[ai].name}</td>
                <td>${this.elo.getFormattedRating(ai)}</td>
                <td>${overallWR}%</td>
                <td>${blackWR}%</td>
                <td>${whiteWR}%</td>
                <td>${data.totalGames}</td>
                <td>${avgScore}</td>
            `;
        });
    }

    updateMatchupsTab() {
        const tbody = document.querySelector('#matchups-table tbody');
        tbody.innerHTML = '';

        this.results.forEach((result) => {
            if (result.black === result.white && result.black > result.white) return;

            const isSelfPlay = result.black === result.white;
            const reverseKey = `${result.white}-${result.black}`;
            const reverseResult = this.results.get(reverseKey);

            const row = tbody.insertRow();
            row.innerHTML = `
                <td style="white-space: normal;">${AI_PLAYERS[result.black].name}</td>
                <td style="white-space: normal;">${AI_PLAYERS[result.white].name}</td>
                <td>${result.games.length * (isSelfPlay ? 1 : 2)}</td>
                <td>${result.blackWins}-${result.whiteWins}-${result.draws}</td>
                <td>${isSelfPlay || !reverseResult ? 'N/A' :
                    `${reverseResult.whiteWins}-${reverseResult.blackWins}-${reverseResult.draws}`}</td>
            `;
            // ELO Change column removed
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

        // If player never appeared in results, stats.totalGames would be 0
        // Ensure they still show up
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
                <div class="game-result" style="margin-bottom:3px;">
                    <span class="game-number"><strong>Game ${index + 1}:</strong></span>
                    <span class="winner-${game.winner.toLowerCase()}" style="margin-left:5px;">
                        ${game.winner === 'TIE' ? 'Draw' : game.winner + ' wins'}
                    </span>
                    <span style="margin-left:5px;">(Black: ${game.blackScore} - White: ${game.whiteScore})</span>
                </div>
            `).join('');

            matchupDiv.innerHTML = `
                <h3 style="margin-bottom:5px;">${AI_PLAYERS[result.black].name} (Black) vs ${AI_PLAYERS[result.white].name} (White)</h3>
                <div style="margin-bottom:5px;">Results: <strong>${result.blackWins}-${result.whiteWins}-${result.draws}</strong></div>
                <div class="game-moves">${gamesHtml}</div>
            `;

            container.appendChild(matchupDiv);
        });
    }

    tournamentComplete() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        console.log('Tournament complete!');
    }
}

window.addEventListener('load', () => {
    new TournamentManager();
});