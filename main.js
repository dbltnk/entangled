// main.js - Integration code
import { GameRouter } from './routing.js';
import { SimulationScreen } from './simulation-screen.js';
import { GameReplayScreen } from './game-replay.js';

document.addEventListener('DOMContentLoaded', () => {
    const mainContainer = document.getElementById('game-container');
    const router = new GameRouter(mainContainer);

    // Register screens
    router.addScreen('simulation', SimulationScreen);
    router.addScreen('replay', GameReplayScreen);

    // Start with simulation screen
    router.navigate('simulation');

    // Handle navigation between screens
    window.viewReplay = (gameHistory, matchupInfo) => {
        router.navigate('replay', { gameHistory, matchupInfo });
    };
});