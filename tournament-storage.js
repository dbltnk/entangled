import { AI_PLAYERS } from './players.js';

class TournamentStorage {
    constructor() {
        this.gamesBuffer = [];
        this.BATCH_SIZE = 128;
        this.stats = {
            metadata: null,
            results: {},
            playerStats: {},
            matchups: []
        };
        this.dirHandle = null;
    }

    async initializeStorage(selectedAIs, boardConfigs) {
        try {
            alert("Please select the 'tournaments' folder to store tournament data");
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
                board1: boardConfigs[0].board1Layout,
                board2: boardConfigs[0].board2Layout,
                startingConfig: startingConfig
            });
            const runId = await this.hashString(configString);

            this.stats.metadata = {
                runId,
                timestamp,
                selectedAIs,
                boardConfigs,
                board1Name,
                board2Name,
                startingConfig,
                boardSize: boardConfigs[0].board1Layout.length,
                totalGamesPlanned: this.calculateTotalGames(selectedAIs),
                eloInitial: 1500, // Store initial ELO for future reference
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
        const board1Short = metadata.board1Name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        const board2Short = metadata.board2Name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        const configShort = metadata.startingConfig.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
        return `${metadata.runId}-${board1Short}-${board2Short}-${configShort}-${type}.json`;
    }

    async saveStats() {
        const filename = this.generateFilename('stats');
        const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();

        // Enhance stats with full ELO history and player performance data
        const enhancedStats = {
            ...this.stats,
            gameProgress: {
                completed: this.gamesBuffer.length,
                total: this.stats.metadata.totalGamesPlanned,
            },
            eloHistory: {}, // Store ELO progression for each player
            playerPerformance: {}, // Store detailed player stats
        };

        await writable.write(JSON.stringify(enhancedStats, null, 2));
        await writable.close();
    }

    async saveReplays() {
        const filename = this.generateFilename('replays');
        const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();

        // Enhance replay data with full context
        const enhancedReplays = {
            metadata: this.stats.metadata,
            games: this.gamesBuffer.map(game => ({
                ...game,
                boardConfigs: {
                    board1Name: this.stats.metadata.board1Name,
                    board2Name: this.stats.metadata.board2Name,
                    startingConfig: this.stats.metadata.startingConfig,
                    boardSize: this.stats.metadata.boardSize
                }
            }))
        };

        await writable.write(JSON.stringify(enhancedReplays, null, 2));
        await writable.close();
    }

    async addGameResult(gameData) {
        const enhancedGameData = {
            ...gameData,
            timestamp: new Date().toISOString(),
            gameNumber: this.gamesBuffer.length + 1,
            matchupConfig: {
                black: {
                    id: gameData.matchup.black,
                    name: AI_PLAYERS[gameData.matchup.black].name
                },
                white: {
                    id: gameData.matchup.white,
                    name: AI_PLAYERS[gameData.matchup.white].name
                }
            }
        };

        this.gamesBuffer.push(enhancedGameData);
        this.updateStats(enhancedGameData);

        if (this.gamesBuffer.length >= this.BATCH_SIZE) {
            await this.flushBuffers();
        }
    }

    updateStats(gameData) {
        const matchupKey = `${gameData.matchup.black}-${gameData.matchup.white}`;
        if (!this.stats.results[matchupKey]) {
            this.stats.results[matchupKey] = {
                black: {
                    id: gameData.matchup.black,
                    name: AI_PLAYERS[gameData.matchup.black].name
                },
                white: {
                    id: gameData.matchup.white,
                    name: AI_PLAYERS[gameData.matchup.white].name
                },
                games: [],
                blackWins: 0,
                whiteWins: 0,
                draws: 0,
                totalBlackScore: 0,
                totalWhiteScore: 0,
                blackScores: [],
                whiteScores: [],
                timestamps: [],
                eloDelta: []
            };
        }

        const result = this.stats.results[matchupKey];
        result.games.push({
            winner: gameData.result.winner,
            blackScore: gameData.result.blackScore,
            whiteScore: gameData.result.whiteScore,
            gameNumber: gameData.gameNumber,
            timestamp: gameData.timestamp
        });

        result.blackScores.push(gameData.result.blackScore);
        result.whiteScores.push(gameData.result.whiteScore);
        result.timestamps.push(gameData.timestamp);

        if (gameData.result.winner === 'BLACK') result.blackWins++;
        else if (gameData.result.winner === 'WHITE') result.whiteWins++;
        else result.draws++;

        result.totalBlackScore += gameData.result.blackScore;
        result.totalWhiteScore += gameData.result.whiteScore;
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