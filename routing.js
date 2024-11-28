// routing.js
class GameRouter {
    constructor(container) {
        this.container = container;
        this.currentScreen = null;
        this.screens = {};
        this.currentBoardSize = 5; // Default board size

        // Add listener at class level instead of per-navigation
        this.handleBack = (event) => {
            this.navigate('simulation', {
                results: event.detail?.results,
                boardSize: this.currentBoardSize
            });
        };

        this.handleBoardSizeChange = (event) => {
            this.currentBoardSize = event.detail.size;
            if (this.currentScreen && typeof this.currentScreen.onBoardSizeChange === 'function') {
                this.currentScreen.onBoardSizeChange(event.detail.size);
            }
        };
    }

    addScreen(name, screenClass) {
        this.screens[name] = screenClass;
    }

    navigate(screenName, params = {}) {
        // Clean up current screen if exists
        if (this.currentScreen) {
            // Remove old listeners
            this.container.removeEventListener('backToResults', this.handleBack);
            this.container.removeEventListener('boardSizeChange', this.handleBoardSizeChange);
            this.container.innerHTML = '';
        }

        // Create and render new screen
        const ScreenClass = this.screens[screenName];
        if (!ScreenClass) {
            throw new Error(`Screen "${screenName}" not found`);
        }

        // Pass board size to new screen
        params.boardSize = params.boardSize || this.currentBoardSize;
        this.currentScreen = new ScreenClass(this.container, params);

        // Handle screen-specific initialization
        if (screenName === 'replay' && params.gameHistory) {
            this.currentScreen.loadGame(params.gameHistory, params.matchupInfo);
        } else if (screenName === 'simulation' && params.results) {
            // Restore simulation results from params
            this.currentScreen.results = params.results;
            this.currentScreen.container.simulationResults = params.results;
            this.currentScreen.updateResults();
        }

        // Add new listeners
        this.container.addEventListener('backToResults', this.handleBack);
        this.container.addEventListener('boardSizeChange', this.handleBoardSizeChange);
    }
}

export { GameRouter };