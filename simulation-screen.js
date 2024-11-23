// simulation-screen.js
import { AI_PLAYERS } from './players.js';
import { SimulationRunner } from './simulation-runner.js';
import { SimulationAnalyzer } from './simulation-analyzer.js';

class SimulationScreen {
    constructor(containerElement) {
        this.container = containerElement;
        this.runner = null;
        this.results = [];
        this.selectedAIs = new Set();
        this.render();
        this.attachEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="panel simulation-panel">
                <div class="simulation-header">
                    <h2>AI Strategy Analysis</h2>
                    <div class="tab-navigation">
                        <button class="tab-button active" data-tab="config">Configuration</button>
                        <button class="tab-button" data-tab="results">Results</button>
                    </div>
                </div>

                <div class="tab-content">
                    <div class="tab-pane active" id="config-pane">
                        <div class="config-section">
                            <h3>Select AI Strategies</h3>
                            <div class="ai-grid">
                                ${Object.entries(AI_PLAYERS).map(([id, ai]) => `
                                    <div class="ai-option">
                                        <input type="checkbox" id="${id}" value="${id}">
                                        <label for="${id}">${ai.name}</label>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="simulation-params">
                                <div class="param-group">
                                    <label for="gamesPerMatchup">Games per Matchup:</label>
                                    <input type="number" id="gamesPerMatchup" value="1000" min="100" max="10000">
                                </div>
                                <div class="param-group">
                                    <label for="sampleRatio">Sample Ratio:</label>
                                    <input type="number" id="sampleRatio" value="0.01" min="0" max="1" step="0.01">
                                </div>
                            </div>

                            <div class="simulation-controls">
                                <button id="startSimulation" class="primary-button">Start Simulation</button>
                                <button id="pauseSimulation" class="secondary-button" disabled>Pause</button>
                            </div>

                            <div class="progress-section" style="display: none;">
                                <div class="progress-bar">
                                    <div class="progress-fill"></div>
                                </div>
                                <div class="progress-text">0% Complete</div>
                            </div>
                        </div>
                    </div>

                    <div class="tab-pane" id="results-pane">
                        <div class="results-section">
                            <div class="results-controls">
                                <button id="exportResults" class="secondary-button" disabled>Export Results</button>
                            </div>
                            <div class="results-grid"></div>
                            <div class="sample-games-section">
                                <h3>Sample Games</h3>
                                <select id="gameSelector"></select>
                                <button id="viewGame" class="secondary-button">View Game</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Tab navigation
        this.container.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });

        // AI selection
        this.container.querySelectorAll('.ai-option input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedAIs.add(checkbox.value);
                } else {
                    this.selectedAIs.delete(checkbox.value);
                }
                this.updateStartButton();
            });
        });

        // Simulation controls
        const startButton = this.container.querySelector('#startSimulation');
        const pauseButton = this.container.querySelector('#pauseSimulation');
        const exportButton = this.container.querySelector('#exportResults');

        startButton.addEventListener('click', () => this.startSimulation());
        pauseButton.addEventListener('click', () => this.togglePause());
        exportButton.addEventListener('click', () => this.exportResults());

        // Game viewer
        this.container.querySelector('#viewGame').addEventListener('click', () => {
            const gameSelector = this.container.querySelector('#gameSelector');
            const selectedGame = gameSelector.value;
            if (selectedGame) {
                this.viewGame(selectedGame);
            }
        });
    }

    switchTab(tabId) {
        this.container.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        this.container.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabId}-pane`);
        });
    }

    updateStartButton() {
        const startButton = this.container.querySelector('#startSimulation');
        startButton.disabled = this.selectedAIs.size < 2;
    }

    async startSimulation() {
        const selectedAIs = Array.from(this.selectedAIs);
        const matchups = [];

        // Create matchups for all combinations
        for (let i = 0; i < selectedAIs.length; i++) {
            for (let j = i + 1; j < selectedAIs.length; j++) {
                matchups.push({
                    player1: selectedAIs[i],
                    player2: selectedAIs[j]
                });
            }
        }

        const config = {
            matchups,
            gamesPerMatchup: parseInt(this.container.querySelector('#gamesPerMatchup').value),
            sampleRatio: parseFloat(this.container.querySelector('#sampleRatio').value)
        };

        this.runner = new SimulationRunner(config);
        this.results = [];

        // Update UI for simulation start
        this.container.querySelector('#startSimulation').disabled = true;
        this.container.querySelector('#pauseSimulation').disabled = false;
        this.container.querySelector('.progress-section').style.display = 'block';

        this.runner.onProgress = (progress) => {
            const progressBar = this.container.querySelector('.progress-fill');
            const progressText = this.container.querySelector('.progress-text');
            progressBar.style.width = `${progress * 100}%`;
            progressText.textContent = `${Math.round(progress * 100)}% Complete`;
        };

        this.runner.onResult = (result) => {
            this.results.push(result);
            this.updateResults();
        };

        await this.runner.start();
    }

    togglePause() {
        if (!this.runner) return;

        const pauseButton = this.container.querySelector('#pauseSimulation');
        if (this.runner.isPaused) {
            this.runner.resume();
            pauseButton.textContent = 'Pause';
        } else {
            this.runner.pause();
            pauseButton.textContent = 'Resume';
        }
    }

    updateResults() {
        const analyzer = new SimulationAnalyzer(this.results);
        const stats = analyzer.getMatchupStats();
        const grid = this.container.querySelector('.results-grid');

        grid.innerHTML = `
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Matchup</th>
                        <th>Games</th>
                        <th>Player 1 Wins</th>
                        <th>Player 2 Wins</th>
                        <th>Draws</th>
                        <th>Avg Score 1</th>
                        <th>Avg Score 2</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.map(stat => `
                        <tr>
                            <td>${AI_PLAYERS[stat.player1].name} vs ${AI_PLAYERS[stat.player2].name}</td>
                            <td>${stat.games}</td>
                            <td>${(stat.player1Wins / stat.games * 100).toFixed(1)}%</td>
                            <td>${(stat.player2Wins / stat.games * 100).toFixed(1)}%</td>
                            <td>${(stat.draws / stat.games * 100).toFixed(1)}%</td>
                            <td>${stat.avgScore1.toFixed(1)}</td>
                            <td>${stat.avgScore2.toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Update game selector
        const gameSelector = this.container.querySelector('#gameSelector');
        gameSelector.innerHTML = stats.flatMap(stat =>
            stat.histories.map((_, index) => `
                <option value="${stat.player1}-${stat.player2}-${index}">
                    ${AI_PLAYERS[stat.player1].name} vs ${AI_PLAYERS[stat.player2].name} - Game ${index + 1}
                </option>
            `)
        ).join('');

        this.container.querySelector('#exportResults').disabled = false;
    }

    exportResults() {
        const analyzer = new SimulationAnalyzer(this.results);
        const exportData = analyzer.exportResults();

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation-results-${exportData.timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    viewGame(gameId) {
        // We'll implement this in the next batch with the game replay functionality
        console.log('Viewing game:', gameId);
    }
}

export { SimulationScreen };