// simulation-runner.js
class SimulationRunner {
    constructor(config) {
        this.config = config;
        this.results = [];
        this.workers = [];
        this.activeGames = 0;
        this.completedGames = 0;
        this.isPaused = false;
        this.onProgress = null;
        this.onResult = null;
    }

    async start() {
        const { matchups, gamesPerMatchup, sampleRatio, maxWorkers = 4 } = this.config;
        this.totalGames = matchups.length * gamesPerMatchup;
        this.results = [];
        this.completedGames = 0;
        this.isPaused = false;

        // Create matchup configurations for both color assignments
        const gameConfigs = matchups.flatMap(({ player1, player2 }) => [
            { player1, player2, asBlack: true },
            { player1, player2, asBlack: false }
        ]);

        // Initialize worker pool
        const workerCount = Math.min(maxWorkers, navigator.hardwareConcurrency || 4);
        this.workers = Array(workerCount).fill(null).map(() =>
            new Worker(new URL('./simulation-worker.js', import.meta.url), { type: 'module' })
        );

        // Set up worker message handlers
        this.workers.forEach(worker => {
            worker.onmessage = (e) => {
                this.handleGameResult(e.data);
                if (!this.isPaused) {
                    this.scheduleNextGame();
                }
            };
        });

        // Start initial batch of games
        for (let i = 0; i < workerCount; i++) {
            this.scheduleNextGame();
        }
    }

    handleGameResult(result) {
        this.results.push(result);
        this.completedGames++;
        this.activeGames--;

        if (this.onProgress) {
            this.onProgress(this.completedGames / this.totalGames);
        }
        if (this.onResult) {
            this.onResult(result);
        }
    }

    scheduleNextGame() {
        if (this.completedGames >= this.totalGames) {
            if (this.activeGames === 0) {
                this.cleanup();
            }
            return;
        }

        const gameIndex = this.completedGames + this.activeGames;
        const matchupIndex = Math.floor(gameIndex / 2) % this.config.matchups.length;
        const matchup = this.config.matchups[matchupIndex];

        // Determine if this game should save history based on sample ratio
        const shouldSaveHistory = Math.random() < this.config.sampleRatio;

        // Find available worker
        const worker = this.workers.find(w => w && !w.busy);
        if (worker) {
            worker.busy = true;
            worker.postMessage({ matchup, gameIndex, shouldSaveHistory });
            this.activeGames++;
        }
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;

        // Resume scheduling games
        const availableWorkers = this.workers.filter(w => !w.busy).length;
        for (let i = 0; i < availableWorkers; i++) {
            this.scheduleNextGame();
        }
    }

    cleanup() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
    }
}

export { SimulationRunner };