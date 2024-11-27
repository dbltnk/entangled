// routing.js
class GameRouter {
    constructor(container) {
        this.container = container;
        this.currentScreen = null;
        this.screens = {};

        // Add listener at class level instead of per-navigation
        this.handleBack = (event) => {
            this.navigate('simulation', { results: event.detail?.results });
        };
    }

    addScreen(name, screenClass) {
        this.screens[name] = screenClass;
    }

    navigate(screenName, params = {}) {
        // Clean up current screen if exists
        if (this.currentScreen) {
            // Remove old listener
            this.container.removeEventListener('backToResults', this.handleBack);
            this.container.innerHTML = '';
        }

        // Create and render new screen
        const ScreenClass = this.screens[screenName];
        if (!ScreenClass) {
            throw new Error(`Screen "${screenName}" not found`);
        }

        this.currentScreen = new ScreenClass(this.container);

        // Handle screen-specific initialization
        if (screenName === 'replay' && params.gameHistory) {
            this.currentScreen.loadGame(params.gameHistory, params.matchupInfo);
        } else if (screenName === 'simulation' && params.results) {
            // Restore simulation results from params
            this.currentScreen.results = params.results;
            this.currentScreen.container.simulationResults = params.results;
            this.currentScreen.updateResults();
        }

        // Add new listener
        this.container.addEventListener('backToResults', this.handleBack);
    }
}

export { GameRouter };