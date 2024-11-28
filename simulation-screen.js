import { AI_PLAYERS } from './players.js';
import { SimulationRunner } from './simulation-runner.js';
import { SimulationAnalyzer } from './simulation-analyzer.js';
import BOARD_LAYOUTS from './boards.js';

class SimulationScreen {
    constructor(containerElement) {
        this.container = containerElement;
        this.runner = null;
        this.results = [];
        this.container.simulationResults = this.results;
        this.selectedCombinations = new Set();
        this.currentBoardSize = 5; // Default board size
        this.render();
        this.attachEventListeners();
    }

    render() {
        const aiOptionsFirst = Object.entries(AI_PLAYERS)
            .filter(([id]) => id !== 'human')
            .map(([id, ai]) => `
                <option value="${id}" ${id === 'mcts' ? 'selected' : ''}>${ai.name}</option>
            `).join('');

        const aiOptionsSecond = Object.entries(AI_PLAYERS)
            .filter(([id]) => id !== 'human')
            .map(([id, ai]) => `
                <option value="${id}">${ai.name}</option>
            `).join('');

        this.container.innerHTML = `
            <div class="panel simulation-panel">
                <div class="simulation-header">
                    <h2>AI Strategy Analysis</h2>
                </div>

                <div class="config-section">
                    <div class="ai-selection">
                        <h3>Compare AIs</h3>
                        <div class="ai-selectors">
                            <select id="firstAI" class="ai-select">
                                ${aiOptionsFirst}
                            </select>
                            <span>vs</span>
                            <select id="secondAI" class="ai-select">
                                <option value="" selected>None (self-play only)</option>
                                ${aiOptionsSecond}
                            </select>
                        </div>
                    </div>

                    <div class="board-combinations">
                        <h3>Board Combinations</h3>
                        <div class="board-setup">
                            <div class="board-columns">
                                <div class="board-column">
                                    <label>Board Size:</label>
                                    <select id="board-size" class="board-select">
                                        <option value="4">4×4</option>
                                        <option value="5" selected>5×5</option>
                                        <option value="6">6×6</option>
                                        <option value="7">7×7</option>
                                    </select>
                                </div>
                                <div class="board-column">
                                    <label>Left Board</label>
                                    <select id="leftBoard" class="board-select">
                                    </select>
                                </div>
                                <div class="board-column">
                                    <label>Right Board</label>
                                    <select id="rightBoard" class="board-select">
                                    </select>
                                </div>
                                <div class="board-column">
                                    <label>Starting Setup</label>
                                    <input type="text" id="startingSetup" 
                                           value="WM1,BM2"
                                           placeholder="e.g., WM1,BM2"
                                           title="Required format: B|W followed by letter A-Y followed by 1|2, separated by commas">
                                </div>
                                <button id="addCombination" class="primary-button">Add Combination</button>
                            </div>
                        </div>

                        <div class="selected-combinations">
                            <h4>Selected Combinations</h4>
                            <div id="combinationsList"></div>
                        </div>

                        <div class="simulation-params">
                            <div class="param-group">
                                <label for="gamesPerMatchup">Games per Combination:</label>
                                <input type="number" id="gamesPerMatchup" value="100" min="10" max="10000">
                            </div>
                            <div class="param-group">
                                <label for="samplesToStore">Samples to Save:</label>
                                <input type="number" id="samplesToStore" value="5" min="0" max="100">
                            </div>
                        </div>

                        <div class="simulation-controls">
                            <button id="startSimulation" class="primary-button">Start Analysis</button>
                            <button id="pauseSimulation" class="secondary-button" disabled>Pause</button>
                            <button id="exportResults" class="secondary-button" disabled>Export Results</button>
                        </div>

                        <div class="progress-section" style="display: none;">
                            <div class="progress-bar">
                                <div class="progress-fill"></div>
                            </div>
                            <div class="progress-text">0% Complete</div>
                        </div>
                    </div>
                </div>

                <div id="resultsContainer" class="results-section">
                    <div class="results-controls">
                        <select id="resultSort" class="sort-select">
                            <option value="blackWinRate">Sort by Black Win Rate</option>
                            <option value="winAdvantage">Sort by Win Advantage</option>
                            <option value="scoreAdvantage">Sort by Score Advantage</option>
                        </select>
                    </div>
                    <div id="resultsGrid"></div>
                </div>
            </div>
        `;

        this.updateBoardsForSize(this.currentBoardSize);
    }

    getBoardsBySize(size) {
        return Object.entries(BOARD_LAYOUTS)
            .filter(([id, layout]) => layout.grid.length === size && !id.startsWith('random'))
            .map(([id, layout]) => ({ id, name: layout.name }));
    }

    getRandomBoardId(size) {
        return size === 5 ? 'random' : `random${size}x${size}`;
    }

    updateBoardsForSize(size) {
        const leftBoard = this.container.querySelector('#leftBoard');
        const rightBoard = this.container.querySelector('#rightBoard');
        const startingSetup = this.container.querySelector('#startingSetup');

        leftBoard.innerHTML = '';
        rightBoard.innerHTML = '';

        // Get all boards for this size
        const boards = this.getBoardsBySize(size);
        const randomBoardId = this.getRandomBoardId(size);

        // Add regular boards
        boards.forEach(board => {
            leftBoard.add(new Option(board.name, board.id));
            rightBoard.add(new Option(board.name, board.id));
        });

        // Add random board option
        const randomOption = new Option(`Random ${size}×${size}`, randomBoardId);
        leftBoard.add(randomOption.cloneNode(true));
        rightBoard.add(randomOption.cloneNode(true));

        // Set default values
        if (size === 5) {
            leftBoard.value = 'board1';
            rightBoard.value = 'board2';
            startingSetup.value = 'WM1,BM2';
        } else {
            const defaultBoard = `board${size}x${size}`;
            leftBoard.value = defaultBoard;
            rightBoard.value = randomBoardId;
            // Clear starting setup as the default might not be valid for this size
            startingSetup.value = '';
        }
    }

    formatBoardCombination(combo) {
        try {
            const [boards, setup] = combo.split(' ');
            const [board1, board2] = boards.split('+');

            // Check if the board layouts exist
            const board1Layout = BOARD_LAYOUTS[board1];
            const board2Layout = BOARD_LAYOUTS[board2];

            if (!board1Layout || !board2Layout) {
                console.warn('Invalid board layouts:', { board1, board2, available: Object.keys(BOARD_LAYOUTS) });
                return `Unknown boards (${board1} + ${board2})${setup ? ' (' + setup + ')' : ''}`;
            }

            return `${board1Layout.name} + ${board2Layout.name}${setup ? ' (' + setup + ')' : ''}`;
        } catch (error) {
            console.warn('Error formatting board combination:', { combo, error });
            return combo;
        }
    }

    createResultTable(combinationResults, boardCombo, gamesPlayed) {
        const table = document.createElement('div');
        table.className = 'result-combination';

        const [boards, setup] = boardCombo.split(' ');
        const [board1, board2] = boards.split('+');
        const displayName = this.formatBoardCombination(boardCombo);
        const boardSize = BOARD_LAYOUTS[board1].grid.length;

        table.innerHTML = `
            <h3>${displayName} (${boardSize}×${boardSize}) - ${gamesPlayed} games completed</h3>
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Matchup</th>
                        <th>Black Wins</th>
                        <th>White Wins</th>
                        <th>Draws</th>
                        <th>Black Score</th>
                        <th>White Score</th>
                        <th>Win Adv.</th>
                        <th>Score Adv.</th>
                        <th>Replays</th>
                    </tr>
                </thead>
                <tbody>
                    ${combinationResults.map(result => `
                        <tr>
                            <td>${result.matchupName}</td>
                            <td>${result.blackWinRate.toFixed(1)}%</td>
                            <td>${result.whiteWinRate.toFixed(1)}%</td>
                            <td>${result.drawRate.toFixed(1)}%</td>
                            <td>${result.avgScoreBlack.toFixed(1)}</td>
                            <td>${result.avgScoreWhite.toFixed(1)}</td>
                            <td class="${parseFloat(result.winAdvantage) > 0 ? 'positive' : 'negative'}">
                                ${result.winAdvantage > 0 ? '+' : ''}${result.winAdvantage.toFixed(1)}%
                            </td>
                            <td class="${parseFloat(result.scoreAdvantage) > 0 ? 'positive' : 'negative'}">
                                ${result.scoreAdvantage > 0 ? '+' : ''}${result.scoreAdvantage.toFixed(1)}
                            </td>
                            <td>
                                <select class="replay-select" data-matchup="${result.matchupId}">
                                    <option value="">Select replay...</option>
                                    ${result.histories.map((history, index) => {
            const lastState = history[history.length - 1];
            const winner = lastState.state.winner;
            const outcome = winner === 'TIE' ? 'Draw' :
                winner === 'BLACK' ? 'Black Won' :
                    'White Won';
            return `<option value="${index}">Game ${index + 1} (${outcome})</option>`;
        }).join('')}
                                </select>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        table.querySelectorAll('.replay-select').forEach(select => {
            select.addEventListener('change', (e) => {
                if (e.target.value === '') return;
                const matchupId = e.target.dataset.matchup;
                const gameIndex = parseInt(e.target.value);
                const matchup = combinationResults.find(r => r.matchupId === matchupId);
                if (matchup && matchup.histories[gameIndex]) {
                    // Store results before viewing replay
                    this.container.simulationResults = this.results;
                    window.viewReplay(matchup.histories[gameIndex], {
                        player1: matchup.player1Name,
                        player2: matchup.player2Name,
                        simulationResults: this.results
                    });
                }
            });
        });

        return table;
    }

    updateResults() {
        const analyzer = new SimulationAnalyzer(this.results);
        const resultsByCombo = analyzer.getResultsByBoardCombination();
        const container = this.container.querySelector('#resultsGrid');
        container.innerHTML = '';

        // Sort based on selected criterion
        const sortSelect = this.container.querySelector('#resultSort');
        const sortCriterion = sortSelect.value;

        Object.entries(resultsByCombo).forEach(([combo, results]) => {
            const gamesPlayed = results[0]?.games || 0;
            container.appendChild(this.createResultTable(results, combo, gamesPlayed));
        });

        this.container.querySelector('#exportResults').disabled = this.results.length === 0;
    }

    attachEventListeners() {
        // Board size change handler
        this.container.querySelector('#board-size').addEventListener('change', (e) => {
            this.currentBoardSize = parseInt(e.target.value);
            this.updateBoardsForSize(this.currentBoardSize);
            this.updateCombinationsList();
        });

        // Add combination button
        this.container.querySelector('#addCombination').addEventListener('click', () => {
            const leftBoard = this.container.querySelector('#leftBoard').value;
            const rightBoard = this.container.querySelector('#rightBoard').value;
            const setup = this.container.querySelector('#startingSetup').value
                .toUpperCase()
                .replace(/\s+/g, '')
                .replace(/[,.;\s]+$/, '');

            const combination = `${leftBoard}+${rightBoard} ${setup}`;
            this.selectedCombinations.add(combination);
            this.updateCombinationsList();
        });

        // Start button
        const startButton = this.container.querySelector('#startSimulation');
        const pauseButton = this.container.querySelector('#pauseSimulation');

        startButton.addEventListener('click', () => this.startSimulation());
        pauseButton.addEventListener('click', () => this.togglePause());

        // Sort select
        this.container.querySelector('#resultSort').addEventListener('change', () => {
            if (this.results.length > 0) {
                this.updateResults();
            }
        });

        // Export button
        this.container.querySelector('#exportResults').addEventListener('click', () => this.exportResults());
    }

    updateCombinationsList() {
        const list = this.container.querySelector('#combinationsList');
        list.innerHTML = Array.from(this.selectedCombinations).map(combo => `
            <div class="combination-item">
                <span>${this.formatBoardCombination(combo)}</span>
                <button class="remove-combination" data-combo="${combo}">×</button>
            </div>
        `).join('');

        // Add remove handlers
        list.querySelectorAll('.remove-combination').forEach(button => {
            button.addEventListener('click', () => {
                this.selectedCombinations.delete(button.dataset.combo);
                this.updateCombinationsList();
            });
        });

        // Update start button state
        this.container.querySelector('#startSimulation').disabled =
            this.selectedCombinations.size === 0 ||
            !this.container.querySelector('#firstAI').value;
    }

    async startSimulation() {
        const firstAI = this.container.querySelector('#firstAI').value;
        const secondAI = this.container.querySelector('#secondAI').value;
        const gamesPerMatchup = parseInt(this.container.querySelector('#gamesPerMatchup').value);
        const samplesToStore = parseInt(this.container.querySelector('#samplesToStore').value);

        // Create all necessary matchups
        const matchups = [];
        this.selectedCombinations.forEach(combo => {
            const [boards, setup] = combo.split(' ');
            const [board1, board2] = boards.split('+');

            // Always do self-play for first AI
            matchups.push({
                player1: firstAI,
                player2: firstAI,
                boardConfig: {
                    board1Layout: board1,
                    board2Layout: board2,
                    startingConfig: setup || '',
                    boardSize: BOARD_LAYOUTS[board1].grid.length
                }
            });

            // If second AI selected, do both cross-play configurations
            if (secondAI) {
                matchups.push(
                    {
                        player1: firstAI,
                        player2: secondAI,
                        boardConfig: {
                            board1Layout: board1,
                            board2Layout: board2,
                            startingConfig: setup || '',
                            boardSize: BOARD_LAYOUTS[board1].grid.length
                        }
                    },
                    {
                        player1: secondAI,
                        player2: firstAI,
                        boardConfig: {
                            board1Layout: board1,
                            board2Layout: board2,
                            startingConfig: setup || '',
                            boardSize: BOARD_LAYOUTS[board1].grid.length
                        }
                    },
                    {
                        player1: secondAI,
                        player2: secondAI,
                        boardConfig: {
                            board1Layout: board1,
                            board2Layout: board2,
                            startingConfig: setup || '',
                            boardSize: BOARD_LAYOUTS[board1].grid.length
                        }
                    }
                );
            }
        });

        const config = {
            matchups,
            gamesPerMatchup,
            samplesToStore,
            aiConfig: {}
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
        progressBar.style.animation = 'pulse 1s ease-in-out infinite';
        progressText.textContent = 'Simulating...';

        this.runner.onProgress = (progress) => {
            progressBar.style.width = `${progress * 100}%`;
            if (progress > 0) {
                progressText.textContent = `${Math.round(progress * 100)}% Complete`;
            }
            if (progress >= 1) {
                progressBar.style.animation = 'none';
            }
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

    exportResults() {
        const analyzer = new SimulationAnalyzer(this.results);
        const exportData = analyzer.exportResults();

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export { SimulationScreen };