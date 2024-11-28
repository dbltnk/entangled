// main.js - Integration code
import { GameRouter } from './routing.js';
import { SimulationScreen } from './simulation-screen.js';
import { GameReplayScreen } from './game-replay.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize main container
    const mainContainer = document.getElementById('game-container');

    // Initialize router
    const router = new GameRouter(mainContainer);

    // Register screens
    router.addScreen('simulation', SimulationScreen);
    router.addScreen('replay', GameReplayScreen);

    // Set up global event handlers for board size changes
    document.addEventListener('boardSizeChange', (event) => {
        const { size, element } = event.detail;
        if (element) {
            element.classList.remove('board-4', 'board-5', 'board-6', 'board-7');
            element.classList.add(`board-${size}`);
        }
    });

    // Start with simulation screen
    router.navigate('simulation');

    // Handle navigation between screens
    window.viewReplay = (gameHistory, matchupInfo) => {
        router.navigate('replay', { gameHistory, matchupInfo });
    };
});