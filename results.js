import { AI_PLAYERS } from './players.js';
import BOARD_LAYOUTS from './boards.js';
import ELOSystem from './elo.js';

class ResultsViewer {
    constructor() {
        this.dirHandle = null;
        this.currentTournament = null;
        this.tournamentFiles = [];
        this.currentSelectionIndex = -1;
        this.isLoading = false;
        this.loadedCount = 0;
        this.totalCount = 0;
        this.setupEventListeners();
        this.populateFilterDropdowns();
    }

    showLoadingState(show, count = 0, total = 0) {
        const filterPanel = document.querySelector('.filter-panel');
        const loadingDiv = document.getElementById('loading-status') || document.createElement('div');
        loadingDiv.id = 'loading-status';

        if (show) {
            loadingDiv.textContent = `Loading Tournaments: ${count}/${total}...`;
            filterPanel.prepend(loadingDiv);
            document.getElementById('filter-board1').disabled = true;
            document.getElementById('filter-board2').disabled = true;
            document.getElementById('filter-starting').disabled = true;
        } else {
            loadingDiv.remove();
            document.getElementById('filter-board1').disabled = false;
            document.getElementById('filter-board2').disabled = false;
            document.getElementById('filter-starting').disabled = false;
        }
    }

    handleKeyNavigation(e) {
        if (!['w', 'a', 's', 'd'].includes(e.key)) {
            return;
        }

        e.preventDefault();

        const visibleItems = Array.from(document.querySelectorAll('.tournament-item'))
            .filter(item => item.style.display !== 'none' && !item.classList.contains('error'));

        if (visibleItems.length === 0) return;

        const isUp = e.key === 'w' || e.key === 'a';

        if (this.currentSelectionIndex === -1) {
            this.currentSelectionIndex = isUp ? visibleItems.length - 1 : 0;
        } else {
            if (isUp) {
                this.currentSelectionIndex = Math.max(0, this.currentSelectionIndex - 1);
            } else {
                this.currentSelectionIndex = Math.min(visibleItems.length - 1, this.currentSelectionIndex + 1);
            }
        }

        const selectedItem = visibleItems[this.currentSelectionIndex];
        if (selectedItem) {
            selectedItem.click();
        }
    }

    populateFilterDropdowns(additionalBoards = new Set()) {
        const board1Filter = document.getElementById('filter-board1');
        const board2Filter = document.getElementById('filter-board2');
        const seenBoards = new Set();

        // Clear existing options except "No filter"
        while (board1Filter.options.length > 1) board1Filter.remove(1);
        while (board2Filter.options.length > 1) board2Filter.remove(1);

        // Add standard boards
        Object.entries(BOARD_LAYOUTS).forEach(([id, layout]) => {
            if (!seenBoards.has(id)) {
                const option = new Option(layout.name, id);
                board1Filter.add(option.cloneNode(true));
                board2Filter.add(option.cloneNode(true));
                seenBoards.add(id);
            }
        });

        // Add custom boards from loaded tournaments
        this.tournamentFiles.forEach(tournament => {
            const board1 = tournament.metadata.boards.board1;
            const board2 = tournament.metadata.boards.board2;

            if (board1.isCustom && !seenBoards.has(board1.id)) {
                const option = new Option(`${board1.name} (Custom)`, board1.id);
                board1Filter.add(option.cloneNode(true));
                board2Filter.add(option.cloneNode(true));
                seenBoards.add(board1.id);
            }

            if (board2.isCustom && !seenBoards.has(board2.id)) {
                const option = new Option(`${board2.name} (Custom)`, board2.id);
                board1Filter.add(option.cloneNode(true));
                board2Filter.add(option.cloneNode(true));
                seenBoards.add(board2.id);
            }
        });

        // Add any additional boards
        additionalBoards.forEach(id => {
            if (!seenBoards.has(id)) {
                const option = new Option(id, id);
                board1Filter.add(option.cloneNode(true));
                board2Filter.add(option.cloneNode(true));
                seenBoards.add(id);
            }
        });
    }

    applyFilters() {
        const board1Filter = document.getElementById('filter-board1').value;
        const board2Filter = document.getElementById('filter-board2').value;
        const startingFilter = document.getElementById('filter-starting').value.trim();

        const tournamentList = document.getElementById('tournament-list');
        tournamentList.innerHTML = '';

        this.tournamentFiles.forEach(tournament => {
            const board1 = tournament.metadata.boards.board1;
            const board2 = tournament.metadata.boards.board2;
            const starting = tournament.metadata.startingConfig;

            if (board1Filter && board1.id !== board1Filter) return;
            if (board2Filter && board2.id !== board2Filter) return;
            if (startingFilter && starting !== startingFilter) return;

            const item = document.createElement('div');
            item.className = 'tournament-item';
            if (this.currentTournament && this.currentTournament.metadata.runId === tournament.metadata.runId) {
                item.classList.add('selected');
            }

            item.innerHTML = this.createTournamentItemHTML(tournament);
            item.addEventListener('click', () => this.selectTournament(tournament));
            tournamentList.appendChild(item);
        });
    }

    async initializeDirectoryAccess() {
        try {
            this.dirHandle = await window.showDirectoryPicker({
                id: 'tournaments',
                mode: 'read',
                startIn: 'documents'
            });
            await this.loadTournamentsFromDirectory();
        } catch (error) {
            console.error('Failed to initialize file system:', error);
            alert('Failed to access local directory. Make sure you granted the necessary permissions.');
        }
    }

    async loadTournamentsFromWeb() {
        try {
            console.log('Fetching tournaments.json...');
            const baseUrl = 'https://dbltnk.github.io/entangled/tournaments/';
            const indexResponse = await fetch(baseUrl + 'tournaments.json');
            if (!indexResponse.ok) {
                throw new Error(`Failed to fetch tournament index: ${indexResponse.status}`);
            }
            const tournamentFiles = await indexResponse.json();
            console.log('Found tournament files:', tournamentFiles);

            this.totalCount = tournamentFiles.length;
            this.showLoadingState(true, 0, this.totalCount);

            const tournaments = [];
            for (const filename of tournamentFiles) {
                try {
                    const response = await fetch(baseUrl + filename);
                    if (!response.ok) continue;
                    const data = await response.json();
                    tournaments.push({
                        data,
                        source: { type: 'web', filename }
                    });
                } catch (error) {
                    console.warn(`Error loading tournament ${filename}:`, error);
                }
                this.loadedCount++;
                this.showLoadingState(true, this.loadedCount, this.totalCount);
            }

            await this.processTournaments(tournaments);
        } catch (error) {
            console.error('Failed to load tournaments from web:', error);
            const tournamentList = document.getElementById('tournament-list');
            tournamentList.innerHTML = `
                <div class="tournament-item error">
                    <h3>Failed to load tournaments</h3>
                    <div>${error.message}</div>
                </div>`;
        } finally {
            this.isLoading = false;
            this.showLoadingState(false);
        }
    }

    async loadTournamentsFromDirectory() {
        if (!this.dirHandle) {
            const tournamentList = document.getElementById('tournament-list');
            tournamentList.innerHTML = '<div class="tournament-item error">No directory selected</div>';
            return;
        }

        try {
            await this.dirHandle.requestPermission({ mode: 'read' });

            const entries = [];
            for await (const entry of this.dirHandle.values()) {
                if (entry.name.endsWith('.json') && entry.name !== 'tournaments.json') {
                    entries.push(entry);
                }
            }

            this.totalCount = entries.length;
            this.showLoadingState(true, 0, this.totalCount);

            const tournaments = [];
            for (const entry of entries) {
                try {
                    const file = await entry.getFile();
                    const data = JSON.parse(await file.text());
                    tournaments.push({
                        data,
                        source: { type: 'local', entry }
                    });
                } catch (error) {
                    console.warn(`Error loading tournament ${entry.name}:`, error);
                }
                this.loadedCount++;
                this.showLoadingState(true, this.loadedCount, this.totalCount);
            }

            await this.processTournaments(tournaments);
        } catch (error) {
            console.error('Failed to load tournaments:', error);
            const tournamentList = document.getElementById('tournament-list');
            tournamentList.innerHTML = `<div class="tournament-item error">Failed to read directory: ${error.message}</div>`;
        } finally {
            this.isLoading = false;
            this.showLoadingState(false);
        }
    }

    async processTournaments(tournaments) {
        const tournamentList = document.getElementById('tournament-list');
        tournamentList.innerHTML = '';
        const allBoards = new Set();

        const validTournaments = tournaments
            .filter(t => t.data?.metadata?.timestamp && t.data?.metadata?.boards)
            .sort((a, b) => new Date(b.data.metadata.timestamp) - new Date(a.data.metadata.timestamp));

        validTournaments.forEach(tournament => {
            const { data, source } = tournament;

            if (data.metadata.boards.board1) allBoards.add(data.metadata.boards.board1);
            if (data.metadata.boards.board2) allBoards.add(data.metadata.boards.board2);

            const item = document.createElement('div');
            item.className = 'tournament-item';
            item.innerHTML = this.createTournamentItemHTML(data);

            if (source.type === 'web') {
                item.addEventListener('click', () => this.loadTournamentFromWeb(source.filename));
            } else {
                item.addEventListener('click', () => this.loadTournamentFromDirectory(source.entry));
            }

            tournamentList.appendChild(item);
        });

        this.populateFilterDropdowns(allBoards);
    }

    selectTournament(tournamentData) {
        const tournamentId = tournamentData.metadata.runId;
        const items = document.querySelectorAll('.tournament-item');
        items.forEach(item => item.classList.remove('selected'));

        const selectedItem = Array.from(items)
            .find(item => {
                const idElement = item.querySelector('.tournament-id');
                return idElement && idElement.textContent.includes(tournamentId);
            });

        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
    }

    createTournamentItemHTML(data) {
        let wins = 0;
        let losses = 0;
        let draws = 0;
        let totalGames = 0;

        Object.values(data.results).forEach(result => {
            result.games.forEach(game => {
                if (game.winner === 'black') wins++;
                else if (game.winner === 'white') losses++;
                else draws++;
                totalGames++;
            });
        });

        const winPercent = ((wins / totalGames) * 100).toFixed(0);
        const lossPercent = ((losses / totalGames) * 100).toFixed(0);
        const drawPercent = ((draws / totalGames) * 100).toFixed(0);

        const maxPercent = Math.max(parseInt(winPercent), parseInt(lossPercent), parseInt(drawPercent));
        const formatPercent = (percent) => {
            return parseInt(percent) === maxPercent ?
                `<strong>${percent}%</strong>` :
                `${percent}%`;
        };

        const dateOptions = {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };

        const date = new Date(data.metadata.timestamp);
        const formattedDate = date.toLocaleTimeString('en-GB', dateOptions);

        // Get board names, handling both custom and standard boards
        const board1 = data.metadata.boards.board1;
        const board2 = data.metadata.boards.board2;
        const board1Name = board1.name || (BOARD_LAYOUTS[board1]?.name || 'Unknown');
        const board2Name = board2.name || (BOARD_LAYOUTS[board2]?.name || 'Unknown');
        const board1Custom = board1.isCustom ? ' (Custom)' : '';
        const board2Custom = board2.isCustom ? ' (Custom)' : '';

        return `
            <div class="tournament-header">
                <div class="tournament-id">Tournament: ${data.metadata.runId}</div>
                <div class="tournament-date">${formattedDate}</div>
            </div>
            <div class="board-info">
                <div class="board-row">
                    <span class="board-label">Left:</span>
                    <span class="board-value">${board1Name}${board1Custom}</span>
                </div>
                <div class="board-row">
                    <span class="board-label">Right:</span>
                    <span class="board-value">${board2Name}${board2Custom}</span>
                </div>
                <div class="board-row">
                    <span class="board-label">Start:</span>
                    <span class="board-value">${data.metadata.startingConfig || 'None'}</span>
                </div>
            </div>
            <div class="result-info">
                <span class="result-label">Result:</span>
                <span class="result-value">${formatPercent(winPercent)}/${formatPercent(lossPercent)}/${formatPercent(drawPercent)} (${totalGames})</span>
            </div>
            <div class="players-info">
                <span class="players-label">Players:</span>
                <span class="players-value">${data.metadata.selectedAIs.map(id => AI_PLAYERS[id]?.name || 'Unknown AI').join(', ')}</span>
            </div>
        `;
    }

    async loadTournamentFromWeb(filename) {
        try {
            const baseUrl = 'https://dbltnk.github.io/entangled/tournaments/';
            const response = await fetch(baseUrl + filename);
            if (!response.ok) {
                throw new Error(`Failed to fetch tournament data: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            if (!data.metadata || !data.results) {
                throw new Error('Invalid tournament data structure: missing required fields');
            }

            this.currentTournament = data;
            if (!this.currentTournament.elo || Object.keys(this.currentTournament.elo).length === 0) {
                this.currentTournament.elo = this.calculateMissingELO();
            }

            this.selectTournament(this.currentTournament);
            this.updateResults();
        } catch (error) {
            console.error('Failed to load tournament data:', error);
            const container = document.getElementById('player-stats-container');
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        Failed to load tournament data: ${error.message}
                    </div>
                `;
            }
            alert(`Failed to load tournament data: ${error.message}`);
        }
    }

    async loadTournamentFromDirectory(fileEntry) {
        const file = await fileEntry.getFile();
        const content = await file.text();
        this.currentTournament = JSON.parse(content);

        if (!this.currentTournament.elo || Object.keys(this.currentTournament.elo).length === 0) {
            this.currentTournament.elo = this.calculateMissingELO();
        }

        this.selectTournament(this.currentTournament);
        this.updateResults();
    }

    calculateMissingELO() {
        if (!this.currentTournament || !this.currentTournament.results) {
            return;
        }

        const eloSystem = new ELOSystem({
            K: 32,
            initialRating: 1500
        });

        const allGames = [];
        Object.entries(this.currentTournament.results).forEach(([key, result]) => {
            result.games.forEach(game => {
                allGames.push({
                    black: result.black,
                    white: result.white,
                    winner: game.winner
                });
            });
        });

        allGames.sort((a, b) => a.moves?.length - b.moves?.length);

        allGames.forEach(game => {
            let gameResult;
            if (game.winner === 'black') {
                gameResult = 'win';
            } else if (game.winner === 'white') {
                gameResult = 'loss';
            } else {
                gameResult = 'draw';
            }

            eloSystem.updateRating(game.black, 'black', game.white, 'white', gameResult);
            eloSystem.updateRating(game.white, 'white', game.black, 'black', gameResult === 'win' ? 'loss' : gameResult === 'loss' ? 'win' : 'draw');
        });

        const elo = {};
        const players = new Set();
        Object.values(this.currentTournament.results).forEach(result => {
            players.add(result.black);
            players.add(result.white);
        });

        players.forEach(playerId => {
            elo[playerId] = {
                rating: Math.round(eloSystem.getRating(playerId)),
                confidence: Math.round(eloSystem.getConfidenceInterval(playerId))
            };
        });

        return elo;
    }

    displayTournamentConfig() {
        const board1Info = this.currentTournament.metadata.boards.board1;
        const board2Info = this.currentTournament.metadata.boards.board2;
        const startingConfig = this.currentTournament.metadata.startingConfig;
        const playerNames = this.currentTournament.metadata.selectedAIs
            .map(id => AI_PLAYERS[id].name)
            .join('\n');

        document.getElementById('board1-name').textContent =
            `${board1Info.name}${board1Info.isCustom ? ' (Custom)' : ''}`;
        document.getElementById('board2-name').textContent =
            `${board2Info.name}${board2Info.isCustom ? ' (Custom)' : ''}`;
        document.getElementById('config-preview').textContent = startingConfig || 'No starting stones';
        document.getElementById('players-preview').textContent = playerNames;
    }

    setupEventListeners() {
        document.getElementById('filter-board1').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-board2').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-starting').addEventListener('input', () => this.applyFilters());

        document.getElementById('load-directory').addEventListener('click', () => this.initializeDirectoryAccess());
        document.getElementById('load-web').addEventListener('click', () => this.loadTournamentsFromWeb());

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
        this.updateMatchupsTab();
        this.updateDetailsTab();

        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });
    }

    updateOverviewTab() {
        const results = this.currentTournament.results;
        const elos = this.currentTournament.elo;

        const tbody = document.querySelector('#overview-table tbody');
        tbody.innerHTML = '';

        const aggregatedStats = this.calculateAggregatedStats(results, false);

        const avgRow = this.createStatsRow('Average', {
            elo: null,
            white: aggregatedStats.white,
            black: aggregatedStats.black
        }, true);
        tbody.appendChild(avgRow);

        const uniqueAIs = new Set();
        Object.values(results).forEach(result => {
            uniqueAIs.add(result.black);
            uniqueAIs.add(result.white);
        });
        const sortedAIs = Array.from(uniqueAIs).sort((a, b) => {
            if (elos?.[a] && elos?.[b]) {
                return (elos[b].rating || 0) - (elos[a].rating || 0);
            }
            return AI_PLAYERS[a].name.localeCompare(AI_PLAYERS[b].name);
        });

        sortedAIs.forEach(ai => {
            const aiStats = this.calculateAIStats(ai, results, false);
            aiStats.elo = elos[ai];
            const row = this.createStatsRow(AI_PLAYERS[ai].name, aiStats, true);
            tbody.appendChild(row);
        });

        const selfPlayTbody = document.querySelector('#self-play-table tbody');
        selfPlayTbody.innerHTML = '';

        const selfPlayStats = this.calculateAggregatedStats(results, true);

        const selfPlayAvgRow = this.createStatsRow('Average', {
            elo: null,
            white: selfPlayStats.white,
            black: selfPlayStats.black
        }, false);
        selfPlayTbody.appendChild(selfPlayAvgRow);

        sortedAIs.forEach(ai => {
            const aiStats = this.calculateAIStats(ai, results, true);
            aiStats.elo = elos[ai];
            const row = this.createStatsRow(AI_PLAYERS[ai].name, aiStats, false);
            selfPlayTbody.appendChild(row);
        });
    }

    calculateAggregatedStats(results, selfPlayOnly) {
        const stats = {
            white: {
                games: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                scores: [],
                tiebreakerWins: 0
            },
            black: {
                games: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                scores: [],
                tiebreakerWins: 0
            }
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
                    if (game.black === game.white) {
                        stats.black.tiebreakerWins++;
                    }
                } else if (game.winner === 'white') {
                    stats.white.wins++;
                    stats.black.losses++;
                    if (game.black === game.white) {
                        stats.white.tiebreakerWins++;
                    }
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

    createStatsRow(name, stats, isOtherPlay = true) {
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

        if (isOtherPlay) {
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
        } else {
            row.innerHTML = `
                <td class="player-name">
                    ${name}
                    <div class="games-count" style="font-size: 12px; color: #666;">${stats.white.games + (stats.black?.games || 0)} games</div>
                </td>            
                <td class="color-stats white-stats">
                    <div class="score-stats">
                        <span class="avg-score">${whiteStats.scores.avg}</span>
                        <span class="score-range">${whiteStats.scores.min}-${whiteStats.scores.max}</span>
                    </div>
                </td>
                <td class="win-percent">${whiteStats.winPercent}%</td>
                <td class="color-stats black-stats">
                    <div class="score-stats">
                        <span class="avg-score">${blackStats.scores.avg}</span>
                        <span class="score-range">${blackStats.scores.min}-${blackStats.scores.max}</span>
                    </div>
                </td>
                <td class="win-percent">${blackStats.winPercent}%</td>
                <td class="draw-percent">${((parseFloat(whiteStats.drawPercent) + parseFloat(blackStats.drawPercent)) / 2).toFixed(1)}%</td>
            `;
        }

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

    updateDetailsTab() {
        const container = document.getElementById('details-container');
        container.innerHTML = '';

        Object.values(this.currentTournament.results).forEach(result => {
            const matchupDiv = document.createElement('div');
            matchupDiv.className = 'game-detail';

            const gamesHtml = result.games.map((game, index) => {
                let html = `
                    <div class="game-result">
                        <div>
                            <span class="game-number">Game ${index + 1}</span>
                            <span class="winner-${game.winner}">
                                ${game.winner === 'draw' ? 'Draw' : `${game.winner} wins`}
                            </span>
                            <span class="score">
                                (⚫ ${game.black} - ⚪ ${game.white})
                            </span>
                        </div>`;

                // Add tiebreaker details if scores were equal
                if (game.black === game.white && game.tiebreaker) {
                    html += `
                        <div class="tiebreaker-details" style="font-size: 0.9rem; margin: 0.5rem 0; background: #f5f5f5; padding: 0.5rem;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <th style="text-align: left;">Lvl</th>
                                    <th style="text-align: center;">⚫</th>
                                    <th style="text-align: center;">=</th>
                                    <th style="text-align: center;">⚪</th>
                                </tr>`;

                    game.tiebreaker.comparisonData.forEach((level, i) => {
                        const isDeciding = (i + 1) === game.tiebreaker.decidingLevel;
                        html += `
                            <tr style="${isDeciding ? 'background: rgba(0,0,0,0.1);' : ''}">
                                <td>${level.level}</td>
                                <td style="text-align: right;">${level.black.board1}+${level.black.board2}</td>
                                <td style="text-align: center;">${level.black.sum}</td>
                                <td style="text-align: right;">${level.white.board1}+${level.white.board2}</td>
                                <td style="text-align: left;">${level.white.sum}${isDeciding ? ' ←' : ''}</td>
                            </tr>`;
                    });

                    html += `</table></div>`;
                }

                html += `<button class="replay-button">Replay</button></div>`;
                return html;
            }).join('');

            matchupDiv.innerHTML = `
                <h3>⚫ ${AI_PLAYERS[result.black].name} vs ⚪ ${AI_PLAYERS[result.white].name}</h3>
                <div style="margin-bottom:var(--spacing-sm);">
                    Results: <strong>${result.games.filter(g => g.winner === 'black').length}-${result.games.filter(g => g.winner === 'white').length}-${result.games.filter(g => g.winner === 'draw').length}</strong>
                </div>
                <div class="game-moves">${gamesHtml}</div>
                <div class="tournament-id" style="display:none;">${this.currentTournament.metadata.runId}</div>
            `;

            matchupDiv.querySelectorAll('.replay-button').forEach((button, index) => {
                button.addEventListener('click', () => {
                    const board1 = this.currentTournament.metadata.boards.board1;
                    const board2 = this.currentTournament.metadata.boards.board2;

                    const gameData = {
                        moves: result.games[index].moves,
                        initialConfig: this.currentTournament.metadata.startingConfig,
                        board1Layout: board1.grid || BOARD_LAYOUTS[board1].grid,
                        board2Layout: board2.grid || BOARD_LAYOUTS[board2].grid,
                        matchInfo: {
                            black: AI_PLAYERS[result.black].name,
                            white: AI_PLAYERS[result.white].name,
                            board1Name: board1.name || BOARD_LAYOUTS[board1].name,
                            board2Name: board2.name || BOARD_LAYOUTS[board2].name,
                            startingConfig: this.currentTournament.metadata.startingConfig
                        },
                        boardSize: (board1.grid || BOARD_LAYOUTS[board1].grid).length
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