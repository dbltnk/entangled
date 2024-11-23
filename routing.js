// routing.js
class GameRouter {
    constructor(container) {
        this.container = container;
        this.currentScreen = null;
        this.screens = {};
    }

    addScreen(name, screenClass) {
        this.screens[name] = screenClass;
    }

    navigate(screenName, params = {}) {
        // Clean up current screen if exists
        if (this.currentScreen) {
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
        }

        // Set up navigation listeners
        this.container.addEventListener('backToResults', () => {
            this.navigate('simulation');
        });
    }
}

export { GameRouter };