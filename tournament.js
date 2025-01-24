import { AI_PLAYERS, MinimaxPlayer, MCTSPlayer } from './players.js';
import BOARD_LAYOUTS, { getSymbolsForSize } from './boards.js';
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
        this.tournamentConfigs = [];
        this.currentConfigIndex = 0;
        this.tournamentCards = new Map();
        this.isCompletingTournament = false;
        this.customBoards = new Map();
        this.currentCustomTarget = null;
        this.aiConfigs = new Map();
        this.initializeUI();
        this.setupEventListeners();
        this.initializeFirstConfig();
    }

    initializeUI() {
        const aiSelection = document.getElementById('ai-selection');
        Object.entries(AI_PLAYERS).forEach(([id, ai]) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            const needsThinkingTime = ai.class.prototype instanceof MinimaxPlayer ||
                ai.class.prototype instanceof MCTSPlayer;

            div.innerHTML = `
                <div class="ai-select-row">
                    <input type="checkbox" id="${id}" name="ai-select" value="${id}" 
                        ${this.isDefaultAI(id) ? 'checked' : ''}>
                    <label for="${id}" style="white-space: normal;">${ai.name}</label>
                    ${needsThinkingTime ? `
                        <div class="thinking-time-container">
                            <input type="number" 
                                id="${id}-thinking-time" 
                                class="thinking-time-input" 
                                value="1.0" 
                                min="0.1" 
                                max="60.0" 
                                step="0.1">
                            <label>sec</label>
                        </div>
                    ` : ''}
                </div>
            `;
            aiSelection.appendChild(div);
        });
    }

    initializeFirstConfig() {
        const firstConfig = document.querySelector('.tournament-config');
        this.attachConfigListeners(firstConfig);
        this.updateBoardSelectionsForConfig(firstConfig);
    }

    isDefaultAI(id) {
        const defaultAIs = [
            'mcts',
            'mcts-some-rng',
            'minimax',
            'minimax-some-rng',
            'defensive',
            'defensive-some-rng',
            'aggressive',
            'aggressive-some-rng',
            'greedy',
            'greedy-some-rng',
            'random',
            'deterministic'
        ];
        return defaultAIs.includes(id);
    }

    setupEventListeners() {
        document.getElementById('add-config').addEventListener('click', () => {
            const configCount = document.querySelectorAll('.tournament-config').length;
            const template = document.querySelector('.tournament-config').cloneNode(true);

            if (configCount > 0) {
                const removeButton = document.createElement('button');
                removeButton.className = 'remove-config tournament-button';
                removeButton.textContent = 'Remove Configuration';
                removeButton.addEventListener('click', (e) => {
                    e.target.closest('.tournament-config').remove();
                });
                template.appendChild(removeButton);
            }

            // Reset values for the new configuration
            template.querySelector('.tournament-starting-config').value = '';
            template.querySelector('.superposition-config').value = '';
            template.querySelector('.swap-rule-toggle').checked = true;

            document.getElementById('tournament-configs').appendChild(template);
            this.attachConfigListeners(template);
            this.updateBoardSelectionsForConfig(template);
        });

        document.getElementById('start-tournament').addEventListener('click', () => this.startTournament());

        // Add custom board modal handling
        const modal = document.getElementById('custom-board-modal');
        const textarea = document.getElementById('custom-board-input');
        const saveBtn = document.getElementById('custom-board-save');
        const cancelBtn = document.getElementById('custom-board-cancel');

        document.querySelectorAll('.custom-board-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const configElement = e.target.closest('.tournament-config');
                const isBoard1 = e.target.previousElementSibling.classList.contains('tournament-board1-select');
                this.currentCustomTarget = {
                    configElement,
                    isBoard1
                };
                modal.classList.add('show');
                textarea.value = '';
            });
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            this.currentCustomTarget = null;
        });

        saveBtn.addEventListener('click', () => {
            try {
                const boardObj = this.parseCustomBoard(textarea.value);
                const id = `custom_${Date.now()}`;
                this.customBoards.set(id, boardObj);

                if (this.currentCustomTarget) {
                    const { configElement, isBoard1 } = this.currentCustomTarget;
                    const select = configElement.querySelector(
                        isBoard1 ? '.tournament-board1-select' : '.tournament-board2-select'
                    );

                    // Add option to select
                    const option = new Option(`Custom: ${boardObj.name}`, id);
                    select.add(option);
                    select.value = id;
                }

                modal.classList.remove('show');
                this.currentCustomTarget = null;
            } catch (error) {
                alert(error.message);
            }
        });
    }

    parseCustomBoard(input) {
        try {
            // Clean up input
            input = input.trim();

            // Extract the board object part
            const match = input.match(/^[^{]*({[\s\S]*})[^}]*$/);
            if (!match) {
                throw new Error('Invalid board format');
            }

            const boardStr = match[1];
            console.log('Parsing board string:', boardStr);

            // Parse the board object
            const boardObj = Function(`return ${boardStr}`)();
            console.log('Parsed board object:', boardObj);

            if (!boardObj.name || !boardObj.grid || !Array.isArray(boardObj.grid)) {
                throw new Error('Invalid board structure');
            }

            // Validate grid
            const size = boardObj.grid.length;
            const validSymbols = getSymbolsForSize(size);

            for (const row of boardObj.grid) {
                if (!Array.isArray(row) || row.length !== size) {
                    throw new Error('Invalid grid dimensions');
                }

                for (const cell of row) {
                    if (cell !== '.' && !validSymbols.includes(cell)) {
                        throw new Error(`Invalid symbol: ${cell}`);
                    }
                }
            }

            return boardObj;
        } catch (error) {
            console.error('Board parsing error:', error);
            throw new Error(`Failed to parse board: ${error.message}`);
        }
    }

    attachConfigListeners(configElement) {
        const sizeSelect = configElement.querySelector('.board-size');
        sizeSelect.addEventListener('change', () => {
            this.updateBoardSelectionsForConfig(configElement);
        });

        // Add listeners for new configuration options
        const swapToggle = configElement.querySelector('.swap-rule-toggle');
        const superpositionInput = configElement.querySelector('.superposition-config');

        if (swapToggle) {
            swapToggle.addEventListener('change', () => {
                this.validateConfig(configElement);
            });
        }

        if (superpositionInput) {
            superpositionInput.addEventListener('input', () => {
                this.validateConfig(configElement);
            });
        }
    }

    validateConfig(configElement) {
        const superpositionInput = configElement.querySelector('.superposition-config');
        const startingConfig = configElement.querySelector('.tournament-starting-config');
        const size = parseInt(configElement.querySelector('.board-size').value);

        if (superpositionInput.value.trim()) {
            const validSymbols = getSymbolsForSize(size);
            const config = superpositionInput.value.trim();
            const positions = config.split(',').map(p => p.trim());

            // Check if all values are 'rng'
            if (positions.every(pos => pos === 'rng')) return true;

            // Check for specific positions
            const valid = positions.every(pos => validSymbols.includes(pos));

            if (!valid) {
                alert(`Invalid superposition configuration. Valid symbols for size ${size} are: ${validSymbols}`);
                return false;
            }
        }

        return true;
    }

    getConfigFromElement(configElement) {
        return {
            boardSize: parseInt(configElement.querySelector('.board-size').value),
            board1: configElement.querySelector('.tournament-board1-select').value,
            board2: configElement.querySelector('.tournament-board2-select').value,
            startingConfig: configElement.querySelector('.tournament-starting-config').value,
            superpositionConfig: configElement.querySelector('.superposition-config').value,
            swapRuleEnabled: configElement.querySelector('.swap-rule-toggle').checked
        };
    }

    updateBoardSelectionsForConfig(configElement) {
        const size = parseInt(configElement.querySelector('.board-size').value);
        const board1Select = configElement.querySelector('.tournament-board1-select');
        const board2Select = configElement.querySelector('.tournament-board2-select');

        board1Select.innerHTML = '';
        board2Select.innerHTML = '';

        // Add standard boards
        Object.entries(BOARD_LAYOUTS).forEach(([id, layout]) => {
            if (layout.grid.length === size) {
                const option = new Option(layout.name, id);
                board1Select.add(option.cloneNode(true));
                board2Select.add(option.cloneNode(true));
            }
        });

        // Add custom boards for this size
        this.customBoards.forEach((board, id) => {
            if (board.grid.length === size) {
                const option = new Option(`Custom: ${board.name}`, id);
                board1Select.add(option.cloneNode(true));
                board2Select.add(option.cloneNode(true));
            }
        });

        this.setDefaultBoardSelections(size, board1Select, board2Select);
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

    cleanupCurrentTournament() {
        if (this.workers) {
            this.workers.forEach(worker => worker.terminate());
            this.workers = [];
        }
    }

    initializeTournamentCards() {
        const cardsContainer = document.getElementById('tournament-cards');
        cardsContainer.innerHTML = '';
        this.tournamentCards.clear();

        this.tournamentConfigs.forEach((config, index) => {
            const card = this.createTournamentCard(config, index);
            cardsContainer.appendChild(card);
            this.tournamentCards.set(index, card);
        });
    }

    createTournamentCard(config, index) {
        const card = document.createElement('div');
        card.className = 'tournament-card';
        card.dataset.index = index;
        card.dataset.state = 'pending';

        // Get board layouts, handling both standard and custom boards
        const getLayout = (boardId) => {
            if (boardId.startsWith('custom_')) {
                return this.customBoards.get(boardId);
            }
            return BOARD_LAYOUTS[boardId];
        };

        const board1Layout = getLayout(config.board1);
        const board2Layout = getLayout(config.board2);

        card.innerHTML = `
            <div class="tournament-card-header">
                <h3>Tournament ${index + 1}</h3>
                <span class="tournament-card-status pending">Pending</span>
            </div>
            <div class="tournament-card-config">
                <div class="config-row">
                    <label>Board 1:</label>
                    <span>${board1Layout.name}${config.board1.startsWith('custom_') ? ' (Custom)' : ''}</span>
                </div>
                <div class="config-row">
                    <label>Board 2:</label>
                    <span>${board2Layout.name}${config.board2.startsWith('custom_') ? ' (Custom)' : ''}</span>
                </div>
                <div class="config-row">
                    <label>Starting:</label>
                    <span>${config.startingConfig || 'None'}</span>
                </div>
            </div>
            <div class="tournament-card-progress">
                <div class="progress-info">
                    <span class="games-count">0 / 0 games</span>
                    <span class="eta"></span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            </div>
        `;

        return card;
    }

    updateTournamentProgress() {
        const currentCard = this.tournamentCards.get(this.currentConfigIndex);
        if (!currentCard) return;

        const state = currentCard.dataset.state;
        if (state === 'completed') return;

        const progressPercent = (this.gamesCompleted / this.totalGames) * 100;
        const progressFill = currentCard.querySelector('.progress-fill');
        const gamesCount = currentCard.querySelector('.games-count');
        const eta = currentCard.querySelector('.eta');
        const status = currentCard.querySelector('.tournament-card-status');

        if (!progressFill || !gamesCount || !eta || !status) {
            console.error('Missing UI elements for tournament card', this.currentConfigIndex);
            return;
        }

        currentCard.dataset.state = 'active';
        currentCard.classList.add('active');
        currentCard.classList.remove('completed', 'pending');

        progressFill.style.width = `${progressPercent}%`;
        gamesCount.textContent = `${this.gamesCompleted} / ${this.totalGames} games`;
        status.textContent = 'In Progress';
        status.className = 'tournament-card-status active';

        const elapsed = Date.now() - this.startTime;
        if (this.gamesCompleted > 0) {
            const timePerGame = elapsed / this.gamesCompleted;
            const remaining = this.totalGames - this.gamesCompleted;
            const etaSeconds = (remaining * timePerGame) / 1000;
            eta.textContent = `ETA: ${Math.ceil(etaSeconds)}s`;
        }
    }

    setConfigurationEditingEnabled(enabled) {
        const elements = document.querySelectorAll(
            '.tournament-config select, .tournament-config input, ' +
            '.thinking-time-input, .swap-rule-toggle, .superposition-config, ' +
            '#add-config, #start-tournament, #games-per-matchup, #parallel-games, .remove-config'
        );
        elements.forEach(element => element.disabled = !enabled);
    }

    async startTournament() {
        this.selectedAIs = this.getSelectedAIs();
        if (this.selectedAIs.length < 1) {
            alert('Please select at least 1 AI for the tournament');
            return;
        }

        // Collect and validate AI configurations
        this.aiConfigs.clear();
        for (const aiId of this.selectedAIs) {
            const ai = AI_PLAYERS[aiId];
            if (ai.class.prototype instanceof MinimaxPlayer ||
                ai.class.prototype instanceof MCTSPlayer) {
                const thinkingTimeInput = document.getElementById(`${aiId}-thinking-time`);
                const thinkingTime = parseFloat(thinkingTimeInput.value);

                if (isNaN(thinkingTime) || thinkingTime < 0.1 || thinkingTime > 60.0) {
                    alert(`Invalid thinking time for ${ai.name}. Must be between 0.1 and 60.0 seconds.`);
                    return;
                }

                this.aiConfigs.set(aiId, {
                    ...AI_PLAYERS[aiId].config,
                    thinkingTime
                });
            } else {
                // For non-thinking time AIs, still copy their config
                this.aiConfigs.set(aiId, { ...AI_PLAYERS[aiId].config });
            }
        }

        // Validate all tournament configurations
        const configs = document.querySelectorAll('.tournament-config');
        for (const config of configs) {
            if (!this.validateConfig(config)) {
                return;
            }
        }

        // Collect tournament configurations
        this.tournamentConfigs = Array.from(configs)
            .map(config => ({
                ...this.getConfigFromElement(config),
                aiConfigs: Object.fromEntries(this.aiConfigs)
            }));

        if (this.tournamentConfigs.length === 0) {
            alert('Please add at least one board configuration');
            return;
        }

        // Set up the first board configuration
        this.boardConfigs = [this.tournamentConfigs[0]];

        this.setConfigurationEditingEnabled(false);
        this.gamesPerMatchup = parseInt(document.getElementById('games-per-matchup').value);

        this.currentConfigIndex = 0;
        this.initializeTournamentCards();
        await this.startNextTournament();
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

    async startNextTournament() {
        if (this.currentConfigIndex >= this.tournamentConfigs.length) {
            this.setConfigurationEditingEnabled(true);
            const notification = document.createElement('div');
            notification.className = 'tournament-notification';
            notification.textContent = 'All tournaments complete!';
            document.querySelector('.progress-panel').prepend(notification);
            setTimeout(() => notification.remove(), 5000);
            return;
        }

        this.cleanupCurrentTournament();

        const config = this.tournamentConfigs[this.currentConfigIndex];

        this.results = new Map();
        this.matchups = [];
        this.currentMatchIndex = 0;
        this.gamesCompleted = 0;
        this.matchCounts = new Map();
        this.elo = new ELOSystem();

        // Get board layouts, handling both standard and custom boards
        const getLayout = (boardId) => {
            if (boardId.startsWith('custom_')) {
                return this.customBoards.get(boardId);
            }
            return BOARD_LAYOUTS[boardId];
        };

        this.boardConfigs = [{
            board1Layout: getLayout(config.board1).grid,
            board2Layout: getLayout(config.board2).grid,
            startingConfig: config.startingConfig,
            board1Id: config.board1,
            board2Id: config.board2,
            board1Name: getLayout(config.board1).name,
            board2Name: getLayout(config.board2).name,
            isCustomBoard1: config.board1.startsWith('custom_'),
            isCustomBoard2: config.board2.startsWith('custom_')
        }];

        try {
            await this.storage.initializeStorage(this.selectedAIs, this.boardConfigs);

            this.matchups = this.generateMatchups(this.selectedAIs);
            this.totalGames = this.matchups.length * this.gamesPerMatchup;
            this.gamesCompleted = 0;
            this.startTime = Date.now();

            this.matchups.forEach(matchup => {
                this.matchCounts.set(`${matchup.black}-${matchup.white}`, 0);
            });

            const parallelGames = parseInt(document.getElementById('parallel-games').value);
            const workerCount = Math.min(parallelGames, navigator.hardwareConcurrency || 4);
            this.workers = Array(workerCount).fill(null).map(() => {
                const worker = new Worker(new URL('./tournament-worker.js', import.meta.url), { type: 'module' });
                worker.onmessage = (e) => this.handleWorkerMessage(e);
                return worker;
            });

            this.updateTournamentProgress();

            this.workers.forEach(() => this.startNextGame());
        } catch (error) {
            console.error('Error starting tournament:', error);
            this.handleTournamentError('Failed to start tournament');
        }
    }

    handleTournamentError(message) {
        const currentCard = this.tournamentCards.get(this.currentConfigIndex);
        if (currentCard) {
            const status = currentCard.querySelector('.tournament-card-status');
            if (status) {
                status.textContent = 'Error';
                status.className = 'tournament-card-status error';
            }
        }

        const notification = document.createElement('div');
        notification.className = 'tournament-notification error';
        notification.textContent = message;
        document.querySelector('.progress-panel').prepend(notification);
        setTimeout(() => notification.remove(), 5000);
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
                    matchIndex: this.currentMatchIndex,
                    aiConfigs: {
                        [matchup.black]: this.aiConfigs.get(matchup.black),
                        [matchup.white]: this.aiConfigs.get(matchup.white)
                    }
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

        try {
            await this.storage.addGameResult({
                matchup,
                result: {
                    winner: result.winner,
                    blackScore: result.blackScore,
                    whiteScore: result.whiteScore,
                    history: result.history
                }
            });

            this.updateTournamentProgress();

            const worker = e.target;
            worker.busy = false;

            // Check if this was the actual last game and tournament isn't already completing
            if (this.gamesCompleted === this.totalGames && !this.isCompletingTournament) {
                this.isCompletingTournament = true; // Add flag to prevent multiple completions
                try {
                    await this.tournamentComplete();
                } finally {
                    this.isCompletingTournament = false;
                }
            } else {
                this.startNextGame();
            }
        } catch (error) {
            console.error('Error handling worker message:', error);
            this.handleTournamentError('Error processing game result');
        }
    }

    async tournamentComplete() {
        const currentCard = this.tournamentCards.get(this.currentConfigIndex);
        if (!currentCard) {
            console.warn('No tournament card found for index:', this.currentConfigIndex);
            return;
        }

        // Check the state at the start with proper error handling
        if (currentCard.dataset.state === 'completed') {
            console.warn('Tournament already completed:', this.currentConfigIndex);
            return;
        }

        try {
            await this.storage.finishTournament(); // Wait for tournament to finish
            await this.storage.flushBuffers();

            currentCard.dataset.state = 'completed';
            const status = currentCard.querySelector('.tournament-card-status');
            if (status) {
                status.textContent = 'Completed';
                status.className = 'tournament-card-status completed';
            }
            currentCard.classList.remove('active');
            currentCard.classList.add('completed');

            // Store final game count for completed tournament
            const gamesCount = currentCard.querySelector('.games-count');
            if (gamesCount) {
                gamesCount.textContent = `${this.totalGames} / ${this.totalGames} games`;
            }

            const progressFill = currentCard.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = '100%';
            }

            this.currentConfigIndex++;

            // Add clean waiting period between tournaments
            if (this.currentConfigIndex < this.tournamentConfigs.length) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Clean delay
                await this.startNextTournament();
            } else {
                this.setConfigurationEditingEnabled(true);
                const notification = document.createElement('div');
                notification.className = 'tournament-notification';
                notification.textContent = 'All tournaments complete!';
                document.querySelector('.progress-panel').prepend(notification);
                setTimeout(() => notification.remove(), 5000);
            }
        } catch (error) {
            console.error('Error completing tournament:', error);
            this.handleTournamentError('Error completing tournament');
            this.isCompletingTournament = false; // Reset flag on error
        }
    }
}

window.addEventListener('load', () => {
    new TournamentManager();
});

export default TournamentManager;