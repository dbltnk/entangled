// simulation-runner.js
class SimulationRunner {
    constructor(config) {
        console.log('SimulationRunner initialized with config:', config);
        this.config = config;
        this.results = [];
        this.workers = [];
        this.activeGames = 0;
        this.completedGames = 0;
        this.isPaused = false;
        this.onProgress = null;
        this.onResult = null;
        this.totalGames = 0;
        this.currentMatchupIndex = 0;
        this.currentGameInMatchup = 0;
    }

    async start() {
        const {
            matchups,
            gamesPerMatchup,
            maxWorkers = 16,
            aiConfig = {},
            boardConfig = {
                board1Layout: 'board1',
                board2Layout: 'board2'
            }
        } = this.config;

        console.log(`Starting simulation with ${matchups.length} matchups, ${gamesPerMatchup} games each`);
        console.log('AI Configuration:', aiConfig);
        console.log('Board Configuration:', boardConfig);

        // Each matchup configuration will be played equally
        const fullMatchups = matchups;
        console.log('Full matchups:', fullMatchups);

        this.totalGames = fullMatchups.length * gamesPerMatchup;
        console.log(`Total games to run: ${this.totalGames}`);
        this.results = [];
        this.completedGames = 0;
        this.isPaused = false;
        this.currentMatchupIndex = 0;
        this.currentGameInMatchup = 0;

        // Initialize worker pool
        const workerCount = Math.min(maxWorkers, navigator.hardwareConcurrency);
        console.log(`Initializing ${workerCount} workers`);
        this.workers = Array(workerCount).fill(null).map(() => {
            const worker = new Worker(new URL('./simulation-worker.js', import.meta.url), { type: 'module' });
            worker.busy = false;
            return worker;
        });

        // Set up worker message handlers
        this.workers.forEach((worker, index) => {
            worker.onmessage = (e) => {
                console.log(`Worker ${index} completed game`, e.data);
                this.handleGameResult(e.data);
                worker.busy = false;
                if (!this.isPaused) {
                    this.scheduleNextGame(fullMatchups, gamesPerMatchup);
                }
            };
        });

        // Start initial batch of games
        console.log('Starting initial batch of games');
        for (let i = 0; i < workerCount; i++) {
            this.scheduleNextGame(fullMatchups, gamesPerMatchup);
        }

        // Return a promise that resolves when all games are complete
        return new Promise((resolve) => {
            this.resolveSimulation = resolve;
        });
    }

    handleGameResult(result) {
        console.log(`Handling game result for matchup ${result.matchup.player1} vs ${result.matchup.player2}`);
        this.results.push(result);
        this.completedGames++;
        this.activeGames--;

        if (this.onProgress) {
            const progress = this.completedGames / this.totalGames;
            this.onProgress(progress);
        }

        if (this.onResult) {
            this.onResult(result);
        }

        console.log(`Completed ${this.completedGames}/${this.totalGames} games`);
        if (this.completedGames >= this.totalGames && this.activeGames === 0) {
            console.log('All games completed, cleaning up');
            this.cleanup();
            if (this.resolveSimulation) {
                this.resolveSimulation(this.results);
            }
        }
    }

    scheduleNextGame(fullMatchups, gamesPerMatchup) {
        const totalGames = fullMatchups.length * gamesPerMatchup;

        if (this.completedGames + this.activeGames >= totalGames) {
            console.log('All games scheduled');
            return;
        }

        // Calculate which matchup and game number we're on
        const currentTotal = this.completedGames + this.activeGames;
        const matchupIndex = Math.floor(currentTotal / gamesPerMatchup);
        const gameInMatchup = currentTotal % gamesPerMatchup;

        // If we've gone past our matchups, stop
        if (matchupIndex >= fullMatchups.length) {
            console.log('No more matchups to process');
            return;
        }

        const matchup = fullMatchups[matchupIndex];
        console.log(`Scheduling matchup ${matchupIndex + 1}/${fullMatchups.length}: ${matchup.player1} vs ${matchup.player2} (game ${gameInMatchup + 1}/${gamesPerMatchup})`);

        // Determine if this game should save history based on sample ratio
        const shouldSaveHistory = gameInMatchup < this.config.samplesToStore;

        // Find available worker
        const worker = this.workers.find(w => w && !w.busy);
        if (worker) {
            worker.busy = true;
            worker.postMessage({
                matchup,
                gameIndex: currentTotal,
                shouldSaveHistory,
                aiConfig: this.config.aiConfig,
                boardConfig: matchup.boardConfig || this.config.boardConfig
            });
            this.activeGames++;
        }
    }

    pause() {
        console.log('Pausing simulation');
        this.isPaused = true;
    }

    resume() {
        console.log('Resuming simulation');
        if (!this.isPaused) return;
        this.isPaused = false;

        // Resume scheduling games
        const fullMatchups = this.config.matchups;
        console.log(`Resuming with ${fullMatchups.length} matchups`);

        const availableWorkers = this.workers.filter(w => !w.busy).length;
        console.log(`${availableWorkers} workers available for resumption`);
        for (let i = 0; i < availableWorkers; i++) {
            this.scheduleNextGame(fullMatchups, this.config.gamesPerMatchup);
        }
    }

    cleanup() {
        console.log('Cleaning up workers');
        this.workers.forEach(worker => {
            if (worker) {
                worker.terminate();
            }
        });
        this.workers = [];
    }
}

export { SimulationRunner };
