import { Player } from './player.js';

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        
        // Try to connect to socket.io (it will fail if server is not running)
        if (typeof io !== 'undefined') {
            this.socket = io();
            this.setupListeners();
        } else {
            console.warn('Socket.io no encontrado. Jugando en modo offline.');
        }
    }

    setupListeners() {
        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (id !== this.socket.id) {
                    this.addRemotePlayer(players[id]);
                }
            });
        });

        this.socket.on('newPlayer', (playerInfo) => {
            this.addRemotePlayer(playerInfo);
        });

        this.socket.on('playerMoved', (playerInfo) => {
            const remotePlayer = this.game.players.get(playerInfo.id);
            if (remotePlayer) {
                remotePlayer.x = playerInfo.x;
                remotePlayer.y = playerInfo.y;
                remotePlayer.currentTool = playerInfo.currentTool;
            }
        });

        this.socket.on('playerDisconnected', (id) => {
            this.game.players.delete(id);
            this.game.entities = this.game.entities.filter(e => e.id !== id);
        });

        this.socket.on('farmUpdated', (data) => {
            // Handle remote farm updates
            const parcel = this.game.farmSystem.parcels[data.parcelIdx];
            if (parcel) {
                parcel.interact(data.tx, data.ty, data.action, { name: data.playerName });
            }
        });
    }

    addRemotePlayer(playerInfo) {
        const remotePlayer = new Player(playerInfo.id, playerInfo.name, false);
        remotePlayer.x = playerInfo.x;
        remotePlayer.y = playerInfo.y;
        remotePlayer.color = playerInfo.color;
        this.game.players.set(playerInfo.id, remotePlayer);
        this.game.entities.push(remotePlayer);
    }

    sendMovement(x, y) {
        if (this.socket) {
            this.socket.emit('playerMovement', { 
                x, 
                y, 
                currentTool: this.game.localPlayer.currentTool 
            });
        }
    }

    sendFarmUpdate(parcelIdx, tx, ty, action, playerName) {
        if (this.socket) {
            this.socket.emit('farmUpdate', { parcelIdx, tx, ty, action, playerName });
        }
    }
}
