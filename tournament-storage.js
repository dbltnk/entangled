import { AI_PLAYERS } from './players.js';

class TournamentStorage {
    constructor() {
        this.gamesBuffer = [];
        this.BATCH_SIZE = 128;
        this.stats = {
            metadata: null,
            elo: {},
            results: {}
        };
        this.dirHandle = null;
    }

    async initializeStorage(selectedAIs, boardConfigs) {
        try {
            alert("Please select the your entangled app folder to store tournament data");
            this.dirHandle = await window.showDirectoryPicker({
                id: 'tournaments',
                mode: 'readwrite',
                startIn: 'documents'
            });

            const timestamp = new Date().toISOString();
            const board1Name = document.getElementById('tournament-board1-select').selectedOptions[0].text;
            const board2Name = document.getElementById('tournament-board2-select').selectedOptions[0].text;
            const startingConfig = boardConfigs[0].startingConfig || 'empty';

            const configString = JSON.stringify({
                timestamp,
                ais: selectedAIs,
                board1: board1Name,
                board2: board2Name,
                startingConfig
            });
            const runId = await this.hashString(configString);

            this.stats.metadata = {
                runId,
                timestamp,
                selectedAIs,
                boards: {
                    board1: board1Name,
                    board2: board2Name
                },
                startingConfig,
                totalGames: this.calculateTotalGames(selectedAIs)
            };

            await this.saveStats();
            await this.saveReplays();

        } catch (error) {
            console.error('Failed to initialize storage:', error);
            throw error;
        }
    }

    calculateTotalGames(selectedAIs) {
        const n = selectedAIs.length;
        return n * n * parseInt(document.getElementById('games-per-matchup').value);
    }

    generateFilename(type) {
        const metadata = this.stats.metadata;
        const board1Short = metadata.boards.board1.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        const board2Short = metadata.boards.board2.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        const configShort = metadata.startingConfig.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        return `${metadata.runId}-${board1Short}-${board2Short}-${configShort}-${type}.json`;
    }

    async saveStats() {
        const filename = this.generateFilename('stats');
        const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();

        const compactStats = {
            metadata: this.stats.metadata,
            elo: this.stats.elo,
            results: this.stats.results
        };

        await writable.write(JSON.stringify(compactStats, null, 2));
        await writable.close();
    }

    async saveReplays() {
        const filename = this.generateFilename('replays');
        const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();

        const replayData = {
            metadata: {
                ...this.stats.metadata,
                timestamp: new Date().toISOString()
            },
            games: this.gamesBuffer.map(({ matchup, result }) => ({
                matchup: {
                    black: matchup.black,
                    white: matchup.white
                },
                result: {
                    winner: result.winner === 'TIE' ? 'draw' : result.winner.toLowerCase(),
                    black: result.blackScore,
                    white: result.whiteScore,
                    history: result.history
                }
            }))
        };

        await writable.write(JSON.stringify(replayData, null, 2));
        await writable.close();
    }

    async addGameResult(gameData) {
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
        result.games.push({
            winner: gameData.result.winner === 'TIE' ? 'draw' : gameData.result.winner.toLowerCase(),
            black: gameData.result.blackScore,
            white: gameData.result.whiteScore
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
            await Promise.all([
                this.saveStats(),
                this.saveReplays()
            ]);
            this.gamesBuffer = [];
        }
    }
}

export default TournamentStorage;