// simulation-screen.js
import { AI_PLAYERS } from './players.js';
import { SimulationRunner } from './simulation-runner.js';
import { SimulationAnalyzer } from './simulation-analyzer.js';

class SimulationScreen {
    constructor(containerElement) {
        console.log('Initializing SimulationScreen');
        this.container = containerElement;
        this.runner = null;
        this.results = [];
        this.selectedAIs = new Set();
        this.render();
        this.attachEventListeners();
    }

    render() {
        console.log('Rendering simulation screen');
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
                                <div class="param-group">
                                    <label for="randomize">Enable Non-deterministic Play:</label>
                                    <input type="checkbox" id="randomize">
                                </div>
                                <div class="param-group">
                                    <label for="randomThreshold">Random Threshold:</label>
                                    <input type="number" id="randomThreshold" value="0.1" min="0" max="1" step="0.01" disabled>
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
                                <div id="debug-info" style="margin-top: 10px; font-family: monospace; white-space: pre;"></div>
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
        // Previous event listeners...
        this.container.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });

        this.container.querySelectorAll('.ai-option input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedAIs.add(checkbox.value);
                } else {
                    this.selectedAIs.delete(checkbox.value);
                }
                console.log('Selected AIs updated:', Array.from(this.selectedAIs));
                this.updateStartButton();
            });
        });

        const startButton = this.container.querySelector('#startSimulation');
        const pauseButton = this.container.querySelector('#pauseSimulation');
        const exportButton = this.container.querySelector('#exportResults');
        const randomizeCheckbox = this.container.querySelector('#randomize');
        const randomThresholdInput = this.container.querySelector('#randomThreshold');

        randomizeCheckbox.addEventListener('change', () => {
            randomThresholdInput.disabled = !randomizeCheckbox.checked;
        });

        startButton.addEventListener('click', () => this.startSimulation());
        pauseButton.addEventListener('click', () => this.togglePause());
        exportButton.addEventListener('click', () => this.exportResults());

        this.container.querySelector('#viewGame').addEventListener('click', () => {
            const gameSelector = this.container.querySelector('#gameSelector');
            const selectedGame = gameSelector.value;
            if (selectedGame) {
                this.viewGame(selectedGame);
            }
        });
    }

    async startSimulation() {
        this.updateDebugInfo('Starting simulation');
        const selectedAIs = Array.from(this.selectedAIs);
        const randomize = this.container.querySelector('#randomize').checked;
        const randomThreshold = parseFloat(this.container.querySelector('#randomThreshold').value);

        // Create AI configuration for all selected AIs
        const aiConfig = {};
        selectedAIs.forEach(ai => {
            aiConfig[ai] = {
                randomize,
                randomThreshold
            };
        });

        this.updateDebugInfo(`Selected AIs: ${selectedAIs.join(', ')}`);
        this.updateDebugInfo(`AI Config: ${JSON.stringify(aiConfig, null, 2)}`);

        const matchups = [];

        // Create matchups for all combinations
        for (let i = 0; i < selectedAIs.length; i++) {
            for (let j = 0; j < selectedAIs.length; j++) {
                if (i !== j) {
                    matchups.push({
                        player1: selectedAIs[i],
                        player2: selectedAIs[j]
                    });
                }
            }
        }

        this.updateDebugInfo(`Generated ${matchups.length} matchups`);
        const gamesPerMatchup = parseInt(this.container.querySelector('#gamesPerMatchup').value);
        const sampleRatio = parseFloat(this.container.querySelector('#sampleRatio').value);

        this.updateDebugInfo(`Games per matchup: ${gamesPerMatchup}`);
        this.updateDebugInfo(`Sample ratio: ${sampleRatio}`);

        const config = {
            matchups,
            gamesPerMatchup,
            sampleRatio,
            aiConfig
        };

        this.runner = new SimulationRunner(config);
        this.results = [];

        // Update UI for simulation start
        const startButton = this.container.querySelector('#startSimulation');
        const pauseButton = this.container.querySelector('#pauseSimulation');
        const progressSection = this.container.querySelector('.progress-section');

        startButton.disabled = true;
        pauseButton.disabled = false;
        progressSection.style.display = 'block';

        // Reset progress
        const progressBar = this.container.querySelector('.progress-fill');
        const progressText = this.container.querySelector('.progress-text');
        progressBar.style.width = '0%';
        progressText.textContent = '0% Complete';

        this.runner.onProgress = (progress) => {
            progressBar.style.width = `${progress * 100}%`;
            progressText.textContent = `${Math.round(progress * 100)}% Complete`;
            this.updateDebugInfo(`Progress: ${Math.round(progress * 100)}%`);
        };

        this.runner.onResult = (result) => {
            this.updateDebugInfo(`Received result: ${result.matchup.player1} vs ${result.matchup.player2}`);
            this.results.push(result);
            this.updateResults();
        };

        try {
            this.updateDebugInfo('Starting simulation runner');
            await this.runner.start();
            this.updateDebugInfo('Simulation completed successfully');
            startButton.disabled = false;
            pauseButton.disabled = true;
        } catch (error) {
            console.error('Simulation error:', error);
            this.updateDebugInfo(`Simulation failed with error: ${error.message}`);
            startButton.disabled = false;
            pauseButton.disabled = true;
            progressText.textContent = 'Simulation failed';
        }
    }

    togglePause() {
        if (!this.runner) return;

        const pauseButton = this.container.querySelector('#pauseSimulation');
        if (this.runner.isPaused) {
            this.updateDebugInfo('Resuming simulation');
            this.runner.resume();
            pauseButton.textContent = 'Pause';
        } else {
            this.updateDebugInfo('Pausing simulation');
            this.runner.pause();
            pauseButton.textContent = 'Resume';
        }
    }

    updateResults() {
        this.updateDebugInfo('Updating results display');
        const analyzer = new SimulationAnalyzer(this.results);
        const stats = analyzer.getMatchupStats();

        this.updateDebugInfo(`Current results count: ${this.results.length}`);
        this.updateDebugInfo(`Stats generated for ${stats.length} matchups`);

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

        // Update game selector with sample games
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

    switchTab(tabId) {
        this.updateDebugInfo(`Switching to tab: ${tabId}`);
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
        this.updateDebugInfo(`Start button ${startButton.disabled ? 'disabled' : 'enabled'} (${this.selectedAIs.size} AIs selected)`);
    }

    updateDebugInfo(message) {
        const debugInfo = this.container.querySelector('#debug-info');
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        debugInfo.textContent += `[${timestamp}] ${message}\n`;
        console.log(`Debug: ${message}`);
    }

    exportResults() {
        this.updateDebugInfo('Exporting results');
        const analyzer = new SimulationAnalyzer(this.results);
        const exportData = analyzer.exportResults();

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation-results-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.updateDebugInfo('Results exported successfully');
    }

    viewGame(gameId) {
        this.updateDebugInfo(`Viewing game: ${gameId}`);
        const [player1, player2, gameIndex] = gameId.split('-');
        const analyzer = new SimulationAnalyzer(this.results);
        const stats = analyzer.getMatchupStats();
        const matchup = stats.find(s => s.player1 === player1 && s.player2 === player2);

        if (matchup && matchup.histories[gameIndex]) {
            const matchupInfo = {
                player1: AI_PLAYERS[player1].name,
                player2: AI_PLAYERS[player2].name
            };
            window.viewReplay(matchup.histories[gameIndex], matchupInfo);
        }
    }
}

export { SimulationScreen };