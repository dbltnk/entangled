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
                            ${Object.entries(AI_PLAYERS)
                .filter(([id]) => id !== 'human')
                .map(([id, ai]) => `
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
                console.log('Selected AIs updated:', Array.from(this.selectedAIs));
                this.updateStartButton();
            });
        });

        const startButton = this.container.querySelector('#startSimulation');
        const pauseButton = this.container.querySelector('#pauseSimulation');
        const exportButton = this.container.querySelector('#exportResults');

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
        const selectedAIs = Array.from(this.selectedAIs);

        const aiConfig = {};

        // Create matchups for all combinations including reversed color assignments
        const matchups = [];
        for (let i = 0; i < selectedAIs.length; i++) {
            for (let j = 0; j < selectedAIs.length; j++) {
                // Include both color configurations for each pair
                matchups.push({
                    player1: selectedAIs[i],
                    player2: selectedAIs[j]
                });
            }
        }

        const gamesPerMatchup = parseInt(this.container.querySelector('#gamesPerMatchup').value);
        const sampleRatio = parseFloat(this.container.querySelector('#sampleRatio').value);

        const config = {
            matchups,
            gamesPerMatchup,
            sampleRatio,
            aiConfig
        };

        this.runner = new SimulationRunner(config);
        this.results = [];

        const startButton = this.container.querySelector('#startSimulation');
        const pauseButton = this.container.querySelector('#pauseSimulation');
        const progressSection = this.container.querySelector('.progress-section');

        startButton.disabled = true;
        pauseButton.disabled = false;
        progressSection.style.display = 'block';

        const progressBar = this.container.querySelector('.progress-fill');
        const progressText = this.container.querySelector('.progress-text');
        progressBar.style.width = '0%';
        progressText.textContent = '0% Complete';

        this.runner.onProgress = (progress) => {
            progressBar.style.width = `${progress * 100}%`;
            progressText.textContent = `${Math.round(progress * 100)}% Complete`;
        };

        this.runner.onResult = (result) => {
            this.results.push(result);
            this.updateResults();
        };

        try {
            await this.runner.start();
            startButton.disabled = false;
            pauseButton.disabled = true;
        } catch (error) {
            console.error('Simulation error:', error);
            startButton.disabled = false;
            pauseButton.disabled = true;
            progressText.textContent = 'Simulation failed';
        }
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

        // Calculate averages for the last 7 columns
        const averages = this.calculateAverages(stats);

        const grid = this.container.querySelector('.results-grid');

        grid.innerHTML = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>Strategy as ⚫</th>
                    <th>Strategy as ⚪</th>
                    <th>Games</th>
                    <th>⚫ Win%</th>
                    <th>⚪ Win%</th>
                    <th>Draws</th>
                    <th>Win Adv.</th>
                    <th>⚫ Score</th>
                    <th>⚪ Score</th>
                    <th>Score Adv.</th>
                </tr>
            </thead>
            <tbody>
                ${stats.map(stat => `
                    <tr>
                        <td class="black-player">${AI_PLAYERS[stat.strategy1].name}</td>
                        <td class="white-player">${AI_PLAYERS[stat.strategy2].name}</td>
                        <td>${stat.games}</td>
                        <td>${stat.blackWinRate}%</td>
                        <td>${stat.whiteWinRate}%</td>
                        <td>${stat.drawRate}%</td>
                        <td class="${parseFloat(stat.winAdvantage) > 0 ? 'positive' : 'negative'}">${stat.winAdvantage}%</td>
                        <td>${stat.avgScoreBlack}</td>
                        <td>${stat.avgScoreWhite}</td>
                        <td class="${parseFloat(stat.scoreAdvantage) > 0 ? 'positive' : 'negative'}">±${Math.abs(stat.scoreAdvantage)}</td>
                    </tr>
                `).join('')}
                <tr class="averages-row">
                    <td colspan="3">Averages</td>
                    <td>${averages.blackWinRate.toFixed(1)}%</td>
                    <td>${averages.whiteWinRate.toFixed(1)}%</td>
                    <td>${averages.drawRate.toFixed(1)}%</td>
                    <td class="${averages.winAdvantage > 0 ? 'positive' : 'negative'}">${averages.winAdvantage.toFixed(1)}%</td>
                    <td>${averages.avgScoreBlack.toFixed(1)}</td>
                    <td>${averages.avgScoreWhite.toFixed(1)}</td>
                    <td class="${averages.scoreAdvantage > 0 ? 'positive' : 'negative'}">±${Math.abs(averages.scoreAdvantage).toFixed(1)}</td>
                </tr>
            </tbody>
        </table>
    `;

        const gameSelector = this.container.querySelector('#gameSelector');
        gameSelector.innerHTML = stats.flatMap(stat =>
            stat.histories.map((_, index) => `
            <option value="${stat.strategy1}-${stat.strategy2}-${index}">
            ⚫ ${AI_PLAYERS[stat.strategy1].name} vs ⚪ ${AI_PLAYERS[stat.strategy2].name} - Game ${index + 1}
            </option>
        `)
        ).join('');

        this.container.querySelector('#exportResults').disabled = false;
    }

    calculateAverages(stats) {
        const sum = stats.reduce((acc, stat) => ({
            blackWinRate: acc.blackWinRate + parseFloat(stat.blackWinRate),
            whiteWinRate: acc.whiteWinRate + parseFloat(stat.whiteWinRate),
            drawRate: acc.drawRate + parseFloat(stat.drawRate),
            avgScoreBlack: acc.avgScoreBlack + parseFloat(stat.avgScoreBlack),
            avgScoreWhite: acc.avgScoreWhite + parseFloat(stat.avgScoreWhite),
            winAdvantage: acc.winAdvantage + parseFloat(stat.winAdvantage),
            scoreAdvantage: acc.scoreAdvantage + parseFloat(stat.scoreAdvantage)
        }), {
            blackWinRate: 0,
            whiteWinRate: 0,
            drawRate: 0,
            avgScoreBlack: 0,
            avgScoreWhite: 0,
            winAdvantage: 0,
            scoreAdvantage: 0
        });

        const count = stats.length;
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
        startButton.disabled = this.selectedAIs.size < 1;
    }

    exportResults() {
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
    }

    viewGame(gameId) {
        const [player1, player2, gameIndex] = gameId.split('-');
        const analyzer = new SimulationAnalyzer(this.results);
        const stats = analyzer.getMatchupStats();
        const matchup = stats.find(s => s.strategy1 === player1 && s.strategy2 === player2);

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