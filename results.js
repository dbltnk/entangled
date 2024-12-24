import { AI_PLAYERS } from './players.js';
import BOARD_LAYOUTS from './boards.js';

class ResultsViewer {
    constructor() {
        this.dirHandle = null;
        this.currentTournament = null;
        this.tournamentFiles = [];
        this.setupEventListeners();

        // Add click handlers for both loading methods
        document.getElementById('load-directory').addEventListener('click', () => {
            this.initializeFileSystem();
        });

        document.getElementById('load-web').addEventListener('click', () => {
            this.loadFromWeb();
        });
    }

    async initializeFileSystem() {
        try {
            this.dirHandle = await window.showDirectoryPicker({
                id: 'tournaments',
                mode: 'read',
                startIn: 'documents'
            });
            await this.loadTournamentList();
        } catch (error) {
            console.error('Failed to initialize file system:', error);
            alert('Failed to access local directory. Make sure you granted the necessary permissions.');
        }
    }

    async loadFromWeb() {
        const tournamentListElement = document.getElementById('tournament-list');
        tournamentListElement.innerHTML = '';

        try {
            // First fetch the index file
            console.log('Fetching tournaments.json...');
            const baseUrl = 'https://dbltnk.github.io/entangled/';
            const indexResponse = await fetch(baseUrl + 'tournaments.json');
            if (!indexResponse.ok) {
                throw new Error(`Failed to fetch tournament index: ${indexResponse.status} ${indexResponse.statusText}`);
            }
            const tournamentFiles = await indexResponse.json();
            console.log('Found tournament files:', tournamentFiles);

            let loadedCount = 0;
            let errorCount = 0;
            const errors = new Set();

            for (const filename of tournamentFiles) {
                try {
                    console.log(`Fetching ${filename}...`);
                    const response = await fetch(baseUrl + filename);
                    if (!response.ok) {
                        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
                    }
                    const data = await response.json();

                    const playerNames = data.metadata.selectedAIs
                        .map(id => AI_PLAYERS[id].name)
                        .join(', ');

                    const item = document.createElement('div');
                    item.className = 'tournament-item';
                    item.innerHTML = `
                        <h3>Tournament ${data.metadata.runId}</h3>
                        <div class="tournament-info">
                            <div><strong>Players:</strong> ${playerNames}</div>
                            <div><strong>Games:</strong> ${data.metadata.totalGames}</div>
                            <div><strong>Boards:</strong> ${data.metadata.boards.board1} vs ${data.metadata.boards.board2}</div>
                            <div><strong>Start:</strong> ${data.metadata.startingConfig || 'None'}</div>
                        </div>
                    `;

                    item.addEventListener('click', () => this.loadWebTournament(filename));
                    tournamentListElement.appendChild(item);
                    loadedCount++;
                } catch (error) {
                    console.error(`Error processing tournament ${filename}:`, error);
                    errors.add(`${filename}: ${error.message}`);
                    errorCount++;
                }
            }

            // Show summary of load results
            if (errorCount > 0) {
                const errorSummary = document.createElement('div');
                errorSummary.className = 'tournament-item error';
                errorSummary.innerHTML = `
                    <h3>Loading Summary</h3>
                    <div>Successfully loaded: ${loadedCount} files</div>
                    <div>Failed to load: ${errorCount} files</div>
                    <details>
                        <summary>Show Error Details</summary>
                        <pre>${Array.from(errors).join('\n')}</pre>
                    </details>
                `;
                tournamentListElement.insertBefore(errorSummary, tournamentListElement.firstChild);
            }

            if (loadedCount === 0) {
                tournamentListElement.innerHTML = '<div class="tournament-item">No tournament files found</div>';
            }

        } catch (error) {
            console.error('Failed to load tournaments from web:', error);
            tournamentListElement.innerHTML = `
                <div class="tournament-item error">
                    <h3>Failed to load tournaments</h3>
                    <div>${error.message}</div>
                    <div>Please check browser console for details.</div>
                </div>`;
        }
    }

    async loadWebTournament(filename) {
        try {
            const baseUrl = 'https://dbltnk.github.io/entangled/';
            const response = await fetch(baseUrl + filename);
            if (!response.ok) {
                throw new Error(`Failed to fetch tournament data: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            // Update selected state in list
            const items = document.querySelectorAll('.tournament-item');
            items.forEach(item => item.classList.remove('selected'));
            const selectedItem = Array.from(items)
                .find(item => item.querySelector('h3').textContent.includes(filename));
            if (selectedItem) {
                selectedItem.classList.add('selected');
            }

            this.currentTournament = data;
            this.displayTournamentConfig();
            this.updateResults();
        } catch (error) {
            console.error('Failed to load tournament data:', error);
            alert(`Failed to load tournament data: ${error.message}`);
        }
    }

    async loadTournamentList() {
        const tournamentList = document.getElementById('tournament-list');
        tournamentList.innerHTML = '';

        if (!this.dirHandle) {
            tournamentList.innerHTML = '<div class="tournament-item error">No directory selected</div>';
            return;
        }

        // Verify we still have read permission
        try {
            await this.dirHandle.requestPermission({ mode: 'read' });
        } catch (error) {
            console.error('Permission error:', error);
            tournamentList.innerHTML = '<div class="tournament-item error">Directory permission denied. Please try selecting the directory again.</div>';
            return;
        }

        let loadedCount = 0;
        let errorCount = 0;
        const errors = new Set();

        try {
            for await (const entry of this.dirHandle.values()) {
                if (entry.name.endsWith('.json')) {
                    if (entry.name === 'tournaments.json') continue; // Skip tournaments.json
                    try {
                        const file = await entry.getFile();
                        const content = await file.text();
                        const data = JSON.parse(content);

                        // Validate expected data structure
                        if (!data.metadata || !data.metadata.selectedAIs || !data.metadata.boards) {
                            throw new Error('Invalid tournament file structure');
                        }

                        const playerNames = data.metadata.selectedAIs
                            .map(id => AI_PLAYERS[id]?.name || 'Unknown AI')
                            .join(', ');

                        const item = document.createElement('div');
                        item.className = 'tournament-item';
                        item.innerHTML = `
                            <h3>Tournament ${data.metadata.runId}</h3>
                            <div class="tournament-info">
                                <div><strong>Players:</strong> ${playerNames}</div>
                                <div><strong>Games:</strong> ${data.metadata.totalGames}</div>
                                <div><strong>Boards:</strong> ${data.metadata.boards.board1} vs ${data.metadata.boards.board2}</div>
                                <div><strong>Start:</strong> ${data.metadata.startingConfig || 'None'}</div>
                            </div>
                        `;

                        item.addEventListener('click', () => this.loadTournament(entry));
                        tournamentList.appendChild(item);
                        this.tournamentFiles.push(entry);
                        loadedCount++;
                    } catch (error) {
                        console.error(`Error processing tournament file ${entry.name}:`, error);
                        errors.add(`${entry.name}: ${error.message}`);
                        errorCount++;
                    }
                }
            }

            // Show summary of load results
            if (errorCount > 0) {
                const errorSummary = document.createElement('div');
                errorSummary.className = 'tournament-item error';
                errorSummary.innerHTML = `
                    <h3>Loading Summary</h3>
                    <div>Successfully loaded: ${loadedCount} files</div>
                    <div>Failed to load: ${errorCount} files</div>
                    <details>
                        <summary>Show Error Details</summary>
                        <pre>${Array.from(errors).join('\n')}</pre>
                    </details>
                `;
                tournamentList.insertBefore(errorSummary, tournamentList.firstChild);
            }

            if (loadedCount === 0) {
                tournamentList.innerHTML = '<div class="tournament-item">No tournament files found</div>';
            }
        } catch (error) {
            console.error('Error reading directory:', error);
            tournamentList.innerHTML = `<div class="tournament-item error">Failed to read directory: ${error.message}</div>`;
        }
    }

    async loadTournament(fileEntry) {
        // Update selected state in list
        const items = document.querySelectorAll('.tournament-item');
        items.forEach(item => item.classList.remove('selected'));
        const selectedItem = Array.from(items)
            .find(item => item.querySelector('h3').textContent.includes(fileEntry.name));
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        // Load and parse tournament data
        const file = await fileEntry.getFile();
        const content = await file.text();
        this.currentTournament = JSON.parse(content);

        // Update configuration display
        this.displayTournamentConfig();

        // Update all result tabs
        this.updateResults();
    }

    displayTournamentConfig() {
        const board1Layout = BOARD_LAYOUTS[this.currentTournament.metadata.boards.board1];
        const board2Layout = BOARD_LAYOUTS[this.currentTournament.metadata.boards.board2];
        const startingConfig = this.currentTournament.metadata.startingConfig;
        const playerNames = this.currentTournament.metadata.selectedAIs
            .map(id => AI_PLAYERS[id].name)
            .join('\n');

        document.getElementById('board1-name').textContent = board1Layout.name;
        document.getElementById('board2-name').textContent = board2Layout.name;
        document.getElementById('config-preview').textContent = startingConfig || 'No starting stones';
        document.getElementById('players-preview').textContent = playerNames;
    }

    setupEventListeners() {
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

    updateResults() {
        this.updateOverviewTab();
        this.updatePlayerStatsTab();
        this.updateMatchupsTab();
        this.updateDetailsTab();
    }

    updateOverviewTab() {
        const results = this.currentTournament.results;
        const elos = this.currentTournament.elo;

        // Update main table
        const tbody = document.querySelector('#overview-table tbody');
        tbody.innerHTML = '';

        // Calculate aggregated stats
        const aggregatedStats = this.calculateAggregatedStats(results, false);

        // Add average row
        const avgRow = this.createStatsRow('Average', {
            elo: null,
            white: aggregatedStats.white,
            black: aggregatedStats.black
        });
        tbody.appendChild(avgRow);

        // Add individual AI rows
        const sortedAIs = Object.keys(elos)
            .sort((a, b) => elos[b].rating - elos[a].rating);

        sortedAIs.forEach(ai => {
            const aiStats = this.calculateAIStats(ai, results, false);
            aiStats.elo = elos[ai];

            const row = this.createStatsRow(AI_PLAYERS[ai].name, aiStats);
            tbody.appendChild(row);
        });

        // Update self-play table
        const selfPlayTbody = document.querySelector('#self-play-table tbody');
        selfPlayTbody.innerHTML = '';

        // Calculate self-play stats
        const selfPlayStats = this.calculateAggregatedStats(results, true);

        // Add average row for self-play
        const selfPlayAvgRow = this.createStatsRow('Average', {
            elo: null,
            white: selfPlayStats.white,
            black: selfPlayStats.black
        });
        selfPlayTbody.appendChild(selfPlayAvgRow);

        // Add individual AI rows for self-play
        sortedAIs.forEach(ai => {
            const aiStats = this.calculateAIStats(ai, results, true);
            aiStats.elo = elos[ai];

            const row = this.createStatsRow(AI_PLAYERS[ai].name, aiStats);
            selfPlayTbody.appendChild(row);
        });
    }

    calculateAggregatedStats(results, selfPlayOnly) {
        const stats = {
            white: { games: 0, wins: 0, draws: 0, losses: 0, scores: [] },
            black: { games: 0, wins: 0, draws: 0, losses: 0, scores: [] }
        };

        Object.values(results).forEach(result => {
            if (selfPlayOnly && result.black !== result.white) return;
            if (!selfPlayOnly && result.black === result.white) return;

            result.games.forEach(game => {
                stats.black.games++;
                stats.white.games++;
                stats.black.scores.push(game.black);
                stats.white.scores.push(game.white);

                if (game.winner === 'black') {
                    stats.black.wins++;
                    stats.white.losses++;
                } else if (game.winner === 'white') {
                    stats.white.wins++;
                    stats.black.losses++;
                } else {
                    stats.black.draws++;
                    stats.white.draws++;
                }
            });
        });

        return stats;
    }

    calculateAIStats(aiId, results, selfPlayOnly) {
        const stats = {
            white: { games: 0, wins: 0, draws: 0, losses: 0, scores: [] },
            black: { games: 0, wins: 0, draws: 0, losses: 0, scores: [] }
        };

        Object.values(results).forEach(result => {
            if (selfPlayOnly && result.black !== result.white) return;
            if (!selfPlayOnly && result.black === result.white) return;

            if (result.white === aiId) {
                result.games.forEach(game => {
                    stats.white.games++;
                    stats.white.scores.push(game.white);
                    if (game.winner === 'white') stats.white.wins++;
                    else if (game.winner === 'black') stats.white.losses++;
                    else stats.white.draws++;
                });
            }

            if (result.black === aiId) {
                result.games.forEach(game => {
                    stats.black.games++;
                    stats.black.scores.push(game.black);
                    if (game.winner === 'black') stats.black.wins++;
                    else if (game.winner === 'white') stats.black.losses++;
                    else stats.black.draws++;
                });
            }
        });

        return stats;
    }

    createStatsRow(name, stats) {
        const row = document.createElement('tr');

        const getPercent = (value, total) => ((value / (total || 1)) * 100).toFixed(1);
        const getScoreStats = (scores) => {
            if (!scores || scores.length === 0) return { avg: 0, min: 0, max: 0 };
            return {
                avg: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
                min: Math.min(...scores).toFixed(1),
                max: Math.max(...scores).toFixed(1)
            };
        };

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

        Object.entries(this.currentTournament.results).forEach(([key, result]) => {
            const reverseKey = `${result.white}-${result.black}`;
            const reverseResult = this.currentTournament.results[reverseKey];

            const row = tbody.insertRow();
            row.innerHTML = `
                            <td style="white-space: normal;">${AI_PLAYERS[result.black].name}</td>
                            <td style="white-space: normal;">${AI_PLAYERS[result.white].name}</td>
                            <td>${result.games.length}</td>
                            <td>${result.games.filter(g => g.winner === 'black').length}-${result.games.filter(g => g.winner === 'white').length}-${result.games.filter(g => g.winner === 'draw').length}</td>
                            <td>${reverseResult ? `${reverseResult.games.filter(g => g.winner === 'white').length}-${reverseResult.games.filter(g => g.winner === 'black').length}-${reverseResult.games.filter(g => g.winner === 'draw').length}` : 'N/A'}</td>
                        `;
        });
    }

    updatePlayerStatsTab() {
        const container = document.getElementById('player-stats-container');
        container.innerHTML = '';

        const elos = this.currentTournament.elo;
        const results = this.currentTournament.results;

        const sortedPlayers = Object.keys(elos)
            .sort((a, b) => elos[b].rating - elos[a].rating);

        sortedPlayers.forEach(playerId => {
            const playerStats = this.calculatePlayerStats(playerId, results);

            const card = document.createElement('div');
            card.className = 'player-card';
            card.innerHTML = `
                            <h3>${AI_PLAYERS[playerId].name}</h3>
                            <div class="player-ratings">
                                <div><strong>ELO Rating:</strong> ${elos[playerId].rating} ±${elos[playerId].confidence}</div>
                            </div>
                            <div class="player-performance">
                                <h4>Performance</h4>
                                <div>Win Rate: ${playerStats.winRate}%</div>
                                <div>Games Played: ${playerStats.totalGames}</div>
                                <div>Average Score: ${playerStats.averageScore.toFixed(1)}</div>
                            </div>
                        `;
            container.appendChild(card);
        });
    }

    calculatePlayerStats(playerId, results) {
        const stats = {
            wins: 0,
            losses: 0,
            draws: 0,
            totalGames: 0,
            totalScore: 0
        };

        Object.values(results).forEach(result => {
            if (result.black === playerId) {
                result.games.forEach(game => {
                    stats.totalGames++;
                    stats.totalScore += game.black;
                    if (game.winner === 'black') stats.wins++;
                    else if (game.winner === 'white') stats.losses++;
                    else stats.draws++;
                });
            }
            if (result.white === playerId) {
                result.games.forEach(game => {
                    stats.totalGames++;
                    stats.totalScore += game.white;
                    if (game.winner === 'white') stats.wins++;
                    else if (game.winner === 'black') stats.losses++;
                    else stats.draws++;
                });
            }
        });

        return {
            ...stats,
            winRate: ((stats.wins + stats.draws * 0.5) / stats.totalGames * 100).toFixed(1),
            averageScore: stats.totalGames > 0 ? stats.totalScore / stats.totalGames : 0
        };
    }

    updateDetailsTab() {
        const container = document.getElementById('details-container');
        container.innerHTML = '';

        Object.values(this.currentTournament.results).forEach(result => {
            const matchupDiv = document.createElement('div');
            matchupDiv.className = 'game-detail';

            const gamesHtml = result.games.map((game, index) => `
                            <div class="game-result">
                                <div>
                                    <span class="game-number"><strong>Game ${index + 1}:</strong></span>
                                    <span class="winner-${game.winner}" style="margin-left:5px;">
                                        ${game.winner === 'draw' ? 'Draw' : game.winner + ' wins'}
                                    </span>
                                    <span style="margin-left:5px;">(Black: ${game.black} - White: ${game.white})</span>
                                </div>
                                <button class="replay-button" data-game-index="${index}">Replay</button>
                            </div>
                        `).join('');

            matchupDiv.innerHTML = `
                            <h3>${AI_PLAYERS[result.black].name} (Black) vs ${AI_PLAYERS[result.white].name} (White)</h3>
                            <div style="margin-bottom:5px;">Results: <strong>${result.games.filter(g => g.winner === 'black').length}-${result.games.filter(g => g.winner === 'white').length}-${result.games.filter(g => g.winner === 'draw').length}</strong></div>
                            <div class="game-moves">${gamesHtml}</div>
                        `;

            matchupDiv.querySelectorAll('.replay-button').forEach((button, index) => {
                button.addEventListener('click', () => {
                    const gameData = {
                        moves: result.games[index].moves,
                        initialConfig: this.currentTournament.metadata.startingConfig,
                        board1Layout: BOARD_LAYOUTS[this.currentTournament.metadata.boards.board1].grid,
                        board2Layout: BOARD_LAYOUTS[this.currentTournament.metadata.boards.board2].grid,
                        matchInfo: {
                            black: AI_PLAYERS[result.black].name,
                            white: AI_PLAYERS[result.white].name,
                            board1Name: BOARD_LAYOUTS[this.currentTournament.metadata.boards.board1].name,
                            board2Name: BOARD_LAYOUTS[this.currentTournament.metadata.boards.board2].name,
                            startingConfig: this.currentTournament.metadata.startingConfig
                        },
                        boardSize: BOARD_LAYOUTS[this.currentTournament.metadata.boards.board1].grid.length
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
}

window.addEventListener('load', () => {
    new ResultsViewer();
});

export default ResultsViewer;