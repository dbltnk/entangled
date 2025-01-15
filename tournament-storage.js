import { AI_PLAYERS } from './players.js';

class TournamentStorage {
    constructor() {
        this.gamesBuffer = [];
        this.BATCH_SIZE = 16;
        this.stats = {
            metadata: null,
            elo: {},
            results: {}
        };
        this.dirHandle = null;
        this.currentTournamentComplete = false;
    }

    async initializeStorage(selectedAIs, boardConfigs) {
        try {
            if (!this.dirHandle) {
                this.dirHandle = await window.showDirectoryPicker({
                    id: 'tournaments',
                    mode: 'readwrite',
                    startIn: 'documents'
                });
            }

            // Reset state for new tournament
            this.currentTournamentComplete = false;
            this.gamesBuffer = [];
            this.stats = {
                metadata: null,
                elo: {},
                results: {}
            };

            const timestamp = new Date().toISOString();
            const config = boardConfigs[0];

            const configString = JSON.stringify({
                timestamp,
                ais: selectedAIs,
                board1: config.board1Id,
                board2: config.board2Id,
                startingConfig: config.startingConfig || 'empty',
                cutTheCake: config.cutTheCake
            });
            const runId = await this.hashString(configString);

            this.stats.metadata = {
                runId,
                timestamp,
                selectedAIs,
                boards: {
                    board1: config.board1Id,
                    board2: config.board2Id
                },
                startingConfig: config.startingConfig,
                cutTheCake: config.cutTheCake,
                totalGames: this.calculateTotalGames(selectedAIs)
            };

        } catch (error) {
            console.error('Failed to initialize storage:', error);
            throw error;
        }
    }

    calculateTotalGames(selectedAIs) {
        const n = selectedAIs.length;
        const gamesPerMatchup = parseInt(document.getElementById('games-per-matchup').value);
        return n * n * gamesPerMatchup;
    }

    generateFilename() {
        const metadata = this.stats.metadata;
        const board1Short = metadata.boards.board1.slice(0, 10);
        const board2Short = metadata.boards.board2.slice(0, 10);
        const configShort = metadata.startingConfig.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        return `${metadata.runId}-${board1Short}-${board2Short}-${configShort}.json`;
    }

    async saveData() {
        const filename = this.generateFilename();
        const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();

        const tournamentData = {
            metadata: this.stats.metadata,
            elo: this.stats.elo,
            results: this.stats.results
        };

        await writable.write(JSON.stringify(tournamentData, null, 2));
        await writable.close();
    }

    async addGameResult(gameData) {
        if (this.currentTournamentComplete) return;

        this.gamesBuffer.push(gameData);
        this.updateStats(gameData);

        if (this.gamesBuffer.length >= this.BATCH_SIZE) {
            await this.flushBuffers();
        }
    }

    updateStats(gameData) {
        const matchupKey = `${gameData.matchup.black}-${gameData.matchup.white}`;
        if (!this.stats.results[matchupKey]) {
            this.stats.results[matchupKey] = {
                black: gameData.matchup.black,
                white: gameData.matchup.white,
                games: []
            };
        }

        const result = this.stats.results[matchupKey];
        const moves = gameData.result.history.slice(1)
            .filter((state, index) => {
                return index !== 0 || state.colorsSwapped || state.move !== gameData.result.history[1].move;
            })
            .map(state => state.move);

        result.games.push({
            winner: gameData.result.winner === 'TIE' ? 'draw' : gameData.result.winner.toLowerCase(),
            black: gameData.result.blackScore,
            white: gameData.result.whiteScore,
            moves: moves,
            tiebreaker: gameData.result.tiebreaker,
            clusters: gameData.result.clusters,
            cutTheCakeEnabled: gameData.result.cutTheCakeEnabled,
            colorsSwapped: gameData.result.colorsSwapped,
            swapDecision: gameData.result.history.length > 1 ? gameData.result.history[1].colorsSwapped : false
        });
    }

    updateELO(playerId, rating, confidence) {
        this.stats.elo[playerId] = {
            rating,
            confidence
        };
    }

    async hashString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
    }

    async flushBuffers() {
        if (this.gamesBuffer.length > 0) {
            await this.saveData();
            this.gamesBuffer = [];  // Clear buffer after successful save
        }
    }

    async finishTournament() {
        if (!this.currentTournamentComplete) {
            this.currentTournamentComplete = true;
            await this.flushBuffers();
        }
    }
}

export default TournamentStorage;