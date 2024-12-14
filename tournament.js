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

        this.initializeUI();
        this.setupEventListeners();
    }

    initializeUI() {
        // Populate AI selection checkboxes
        const aiSelection = document.getElementById('ai-selection');
        Object.entries(AI_PLAYERS).forEach(([id, ai]) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="${id}" name="ai-select" value="${id}" 
                    ${this.isDefaultAI(id) ? 'checked' : ''}>
                <label for="${id}">${ai.name}</label>
            `;
            aiSelection.appendChild(div);
        });

        // Set up board size change handler
        document.querySelectorAll('input[name="board-size"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateBoardSelections());
        });

        this.updateBoardSelections();
    }

    isDefaultAI(id) {
        const defaultAIs = ['aggressive-some-rng', 'defensive-some-rng', 'minimax-some-rng', 'mcts'];
        return defaultAIs.includes(id);
    }

    updateBoardSelections() {
        const board1Select = document.getElementById('tournament-board1-select');
        const board2Select = document.getElementById('tournament-board2-select');

        board1Select.innerHTML = '';
        board2Select.innerHTML = '';

        const selectedSizes = Array.from(document.querySelectorAll('input[name="board-size"]:checked'))
            .map(cb => parseInt(cb.value));

        Object.entries(BOARD_LAYOUTS).forEach(([id, layout]) => {
            if (selectedSizes.includes(layout.grid.length)) {
                const option = new Option(layout.name, id);
                board1Select.add(option.cloneNode(true));
                board2Select.add(option.cloneNode(true));
            }
        });

        // Set default selections based on size
        const defaultSize = selectedSizes[0] || 5;
        this.setDefaultBoardSelections(defaultSize, board1Select, board2Select);
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

        // Tab switching
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

        // Display board previews
        this.displayBoardPreview('board1-preview', board1Layout.grid);
        this.displayBoardPreview('board2-preview', board2Layout.grid);

        // Display starting configuration
        document.getElementById('config-preview').textContent = startingConfig || 'No starting stones';
    }

    displayBoardPreview(elementId, grid) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${grid.length}, 1fr)`;
        container.style.gap = '2px';
        container.style.backgroundColor = '#ddd';
        container.style.padding = '2px';
        container.style.width = '200px';
        container.style.aspectRatio = '1';

        grid.forEach(row => {
            row.forEach(symbol => {
                const cell = document.createElement('div');
                cell.style.backgroundColor = 'white';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
                cell.style.aspectRatio = '1';
                cell.style.fontSize = '12px';
                cell.textContent = symbol;
                container.appendChild(cell);
            });
        });
    }

    getSelectedAIs() {
        const checkboxes = document.querySelectorAll('input[name="ai-select"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    generateMatchups(selectedAIs) {
        const matchups = [];
        for (let i = 0; i < selectedAIs.length; i++) {
            for (let j = i + 1; j < selectedAIs.length; j++) {
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
        return matchups;
    }

    async startTournament() {
        const selectedAIs = this.getSelectedAIs();
        if (selectedAIs.length < 2) {
            alert('Please select at least 2 AIs for the tournament');
            return;
        }

        // Get tournament settings
        this.gamesPerMatchup = parseInt(document.getElementById('games-per-matchup').value);
        const parallelGames = parseInt(document.getElementById('parallel-games').value);

        // Get board configurations
        const board1Layout = BOARD_LAYOUTS[document.getElementById('tournament-board1-select').value].grid;
        const board2Layout = BOARD_LAYOUTS[document.getElementById('tournament-board2-select').value].grid;
        const startingConfig = document.getElementById('tournament-starting-config').value;

        this.boardConfigs = [{
            board1Layout,
            board2Layout,
            startingConfig
        }];

        // Display current configuration
        this.displayBoardConfiguration();

        // Generate all matchups
        this.matchups = this.generateMatchups(selectedAIs);
        this.totalGames = this.matchups.length * this.gamesPerMatchup;
        this.gamesCompleted = 0;
        this.currentMatchIndex = 0;
        this.results.clear();
        this.matchCounts.clear();
        this.startTime = Date.now();

        // Initialize match counts and ELO ratings
        this.matchups.forEach(matchup => {
            this.matchCounts.set(`${matchup.black}-${matchup.white}`, 0);
            this.elo.initializePlayer(matchup.black);
            this.elo.initializePlayer(matchup.white);
        });

        // Show progress container
        document.getElementById('progress-container').classList.remove('hidden');
        this.updateProgress();

        // Initialize worker pool
        const workerCount = Math.min(parallelGames, navigator.hardwareConcurrency || 4);
        this.workers = Array(workerCount).fill(null).map(() => {
            const worker = new Worker(new URL('./tournament-worker.js', import.meta.url), { type: 'module' });
            worker.onmessage = (e) => this.handleWorkerMessage(e);
            return worker;
        });

        // Start initial batch of games
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

        // Update match results
        this.updateMatchResults(matchup, result);

        // Update ELO ratings
        this.updateELORatings(matchup, result);

        // Update UI
        this.updateProgress();
        this.updateResults();

        // Mark worker as available and start next game
        const worker = e.target;
        worker.busy = false;
        this.startNextGame();

        // Check if tournament is complete
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
        this.updateOverviewTab();
        this.updateMatchupsTab();
        this.updatePlayerStatsTab();
        this.updateDetailsTab();
    }

    updateOverviewTab() {
        const overviewData = new Map();

        // Initialize data for each AI
        this.results.forEach((result) => {
            [result.black, result.white].forEach(ai => {
                if (!overviewData.has(ai)) {
                    overviewData.set(ai, {
                        blackGames: 0,
                        whiteGames: 0,
                        blackWins: 0,
                        whiteWins: 0,
                        blackDraws: 0,
                        whiteDraws: 0,
                        blackScore: 0,
                        whiteScore: 0
                    });
                }
            });
        });

        // Compile statistics
        this.results.forEach((result) => {
            const blackData = overviewData.get(result.black);
            const whiteData = overviewData.get(result.white);

            const games = result.games.length;
            blackData.blackGames += games;
            whiteData.whiteGames += games;

            blackData.blackWins += result.blackWins;
            whiteData.whiteWins += result.whiteWins;

            blackData.blackDraws += result.draws;
            whiteData.whiteDraws += result.draws;

            blackData.blackScore += result.totalBlackScore;
            whiteData.whiteScore += result.totalWhiteScore;
        });

        // Update overview table
        const tbody = document.querySelector('#overview-table tbody');
        tbody.innerHTML = '';

        overviewData.forEach((data, ai) => {
            const blackWinRate = ((data.blackWins + data.blackDraws * 0.5) / data.blackGames * 100).toFixed(1);
            const whiteWinRate = ((data.whiteWins + data.whiteDraws * 0.5) / data.whiteGames * 100).toFixed(1);
            const avgBlackScore = (data.blackScore / data.blackGames).toFixed(1);
            const avgWhiteScore = (data.whiteScore / data.whiteGames).toFixed(1);

            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${AI_PLAYERS[ai].name}</td>
<td>${this.elo.getFormattedRating(ai, 'black')}</td>
                <td>${this.elo.getFormattedRating(ai, 'white')}</td>
                <td>${blackWinRate}% (${data.blackWins}-${data.blackGames - data.blackWins - data.blackDraws}-${data.blackDraws})</td>
                <td>${whiteWinRate}% (${data.whiteWins}-${data.whiteGames - data.whiteWins - data.whiteDraws}-${data.whiteDraws})</td>
                <td>${data.blackGames + data.whiteGames}</td>
                <td>${((parseFloat(avgBlackScore) + parseFloat(avgWhiteScore)) / 2).toFixed(1)}</td>
            `;
        });

        // Update color statistics
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
                <td>${color.charAt(0).toUpperCase() + color.slice(1)}</td>
                <td>${winRate}%</td>
                <td>${drawRate}%</td>
                <td>${avgScore}</td>
            `;
        });
    }

    updateMatchupsTab() {
        const tbody = document.querySelector('#matchups-table tbody');
        tbody.innerHTML = '';

        this.results.forEach((result) => {
            // Find reverse matchup for complete head-to-head stats
            const reverseKey = `${result.white}-${result.black}`;
            const reverseResult = this.results.get(reverseKey);

            if (reverseResult && result.black < result.white) { // Only show each pairing once
                const blackElo = this.elo.getRating(result.black, 'black');
                const whiteElo = this.elo.getRating(result.white, 'white');

                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${AI_PLAYERS[result.black].name}</td>
                    <td>${AI_PLAYERS[result.white].name}</td>
                    <td>${result.games.length * 2}</td>
                    <td>${result.blackWins}-${result.whiteWins}-${result.draws}</td>
                    <td>${reverseResult.whiteWins}-${reverseResult.blackWins}-${reverseResult.draws}</td>
                    <td>
                        <span class="elo-change ${blackElo >= 0 ? 'positive' : 'negative'}">
                            ${result.black}: ${blackElo > 0 ? '+' : ''}${blackElo}
                        </span>
                        <br>
                        <span class="elo-change ${whiteElo >= 0 ? 'positive' : 'negative'}">
                            ${result.white}: ${whiteElo > 0 ? '+' : ''}${whiteElo}
                        </span>
                    </td>
                `;
            }
        });
    }

    updatePlayerStatsTab() {
        const container = document.getElementById('player-stats-container');
        container.innerHTML = '';

        // Collect all AI players
        const players = new Set();
        this.results.forEach(result => {
            players.add(result.black);
            players.add(result.white);
        });

        // Create detailed stats for each player
        players.forEach(playerId => {
            const card = document.createElement('div');
            card.className = 'player-card';

            const playerStats = this.calculatePlayerStats(playerId);
            const history = this.elo.getRatingHistory(playerId);

            card.innerHTML = `
                <h3>${AI_PLAYERS[playerId].name}</h3>
                <div class="player-ratings">
                    <div>Black ELO: ${this.elo.getFormattedRating(playerId, 'black')}</div>
                    <div>White ELO: ${this.elo.getFormattedRating(playerId, 'white')}</div>
                </div>
                <div class="player-performance">
                    <h4>Performance</h4>
                    <div>As Black: ${playerStats.blackWinRate}% (${playerStats.blackWins}-${playerStats.blackLosses}-${playerStats.blackDraws})</div>
                    <div>As White: ${playerStats.whiteWinRate}% (${playerStats.whiteWins}-${playerStats.whiteLosses}-${playerStats.whiteDraws})</div>
                    <div>Average Score: ${playerStats.averageScore.toFixed(1)}</div>
                </div>
            `;

            container.appendChild(card);
        });
    }

    calculatePlayerStats(playerId) {
        const stats = {
            blackGames: 0, blackWins: 0, blackLosses: 0, blackDraws: 0,
            whiteGames: 0, whiteWins: 0, whiteLosses: 0, whiteDraws: 0,
            totalScore: 0
        };

        this.results.forEach(result => {
            if (result.black === playerId) {
                stats.blackGames += result.games.length;
                stats.blackWins += result.blackWins;
                stats.blackLosses += result.whiteWins;
                stats.blackDraws += result.draws;
                stats.totalScore += result.totalBlackScore;
            }
            if (result.white === playerId) {
                stats.whiteGames += result.games.length;
                stats.whiteWins += result.whiteWins;
                stats.whiteLosses += result.blackWins;
                stats.whiteDraws += result.draws;
                stats.totalScore += result.totalWhiteScore;
            }
        });

        return {
            ...stats,
            blackWinRate: ((stats.blackWins + stats.blackDraws * 0.5) / stats.blackGames * 100).toFixed(1),
            whiteWinRate: ((stats.whiteWins + stats.whiteDraws * 0.5) / stats.whiteGames * 100).toFixed(1),
            averageScore: stats.totalScore / (stats.blackGames + stats.whiteGames)
        };
    }

    updateDetailsTab() {
        const container = document.getElementById('details-container');
        container.innerHTML = '';

        this.results.forEach((result) => {
            const matchupDiv = document.createElement('div');
            matchupDiv.className = 'game-detail';

            const gamesHtml = result.games.map((game, index) => `
                <div class="game-result">
                    <span class="game-number">Game ${index + 1}:</span>
                    <span class="winner-${game.winner.toLowerCase()}">
                        ${game.winner === 'TIE' ? 'Draw' : game.winner + ' wins'}
                    </span>
                    (Black: ${game.blackScore} - White: ${game.whiteScore})
                </div>
            `).join('');

            matchupDiv.innerHTML = `
                <h3>${AI_PLAYERS[result.black].name} (Black) vs ${AI_PLAYERS[result.white].name} (White)</h3>
                <div>Results: ${result.blackWins}-${result.whiteWins}-${result.draws}</div>
                <div class="game-moves">${gamesHtml}</div>
            `;

            container.appendChild(matchupDiv);
        });
    }

    tournamentComplete() {
        // Clean up workers
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];

        console.log('Tournament complete!');
    }
}

// Initialize tournament manager when page loads
window.addEventListener('load', () => {
    new TournamentManager();
});