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

            // Store complete board information for custom boards
            const board1Info = {
                id: config.board1Id,
                name: config.board1Name,
                grid: config.board1Layout,
                isCustom: config.isCustomBoard1
            };

            const board2Info = {
                id: config.board2Id,
                name: config.board2Name,
                grid: config.board2Layout,
                isCustom: config.isCustomBoard2
            };

            const configString = JSON.stringify({
                timestamp,
                ais: selectedAIs,
                board1: board1Info,
                board2: board2Info,
                startingConfig: config.startingConfig,
                superpositionConfig: config.superpositionConfig,
                swapRuleEnabled: config.swapRuleEnabled,
                aiConfigs: config.aiConfigs || {}
            });
            const runId = await this.hashString(configString);

            this.stats.metadata = {
                runId,
                timestamp,
                selectedAIs,
                boards: {
                    board1: board1Info,
                    board2: board2Info
                },
                startingConfig: config.startingConfig || 'empty',
                superpositionConfig: config.superpositionConfig,
                swapRuleEnabled: config.swapRuleEnabled,
                aiConfigs: config.aiConfigs || {},
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
        const { metadata } = this.stats;
        const timestamp = metadata.timestamp.slice(0, 19).replace(/[T:]/g, '-');
        const board1Id = metadata.boards.board1.id || metadata.boards.board1;
        const board2Id = metadata.boards.board2.id || metadata.boards.board2;
        const startingConfig = metadata.startingConfig || 'empty';
        const filename = `tournament_${timestamp}_${board1Id}_${board2Id}_${startingConfig}.json`;
        return filename;
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
        const gameHistory = gameData.result.history;
        const enhancedMoves = [];

        for (let i = 1; i < gameHistory.length; i++) {
            const state = gameHistory[i];
            if (state.move === 'SWAP') {
                enhancedMoves.push({ type: 'swap' });
            } else {
                enhancedMoves.push({
                    type: 'move',
                    move: state.move
                });
            }
        }

        result.games.push({
            winner: gameData.result.winner === 'TIE' ? 'draw' : gameData.result.winner.toLowerCase(),
            black: gameData.result.blackScore,
            white: gameData.result.whiteScore,
            moves: enhancedMoves,
            tiebreaker: gameData.result.tiebreaker,
            clusters: gameData.result.clusters,
            config: {
                ...gameData.result.config,
                superpositionCollapse: undefined
            }
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