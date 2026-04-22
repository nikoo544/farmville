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
        this.socket.on('worldState', (state) => {
            state.parcels.forEach((pData, i) => {
                const parcel = this.game.farmSystem.parcels[i];
                if (parcel && pData.ownerId) {
                    parcel.ownerId = pData.ownerId;
                    parcel.ownerName = pData.ownerName;
                    parcel.tiles = pData.tiles;
                    parcel.machines = pData.machines;
                }
            });
        });

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
                remotePlayer.inVehicle = playerInfo.inVehicle;
                remotePlayer.name = playerInfo.name; // Ensure name is synced
            }
        });

        this.socket.on('chatMessage', (data) => {
            this.game.app.ui.receiveMessage(data.name, data.text);
        });

        this.socket.on('vehicleMoved', (data) => {
            let v = this.game.vehicle;
            if (data.id === 'moto_main') v = this.game.moto;
            v.x = data.x;
            v.y = data.y;
            v.angle = data.angle;
            v.driver = data.driver;
        });

        this.socket.on('shoot', (data) => {
            this.game.spawnProjectile(data.x, data.y, data.angle, data.type, data.id);
        });

        this.socket.on('playerDisconnected', (id) => {
            this.game.players.delete(id);
            this.game.entities = this.game.entities.filter(e => e.id !== id);
        });

        this.socket.on('farmUpdated', (data) => {
            // Handle remote farm updates
            const parcel = this.game.farmSystem.parcels[data.parcelIdx];
            if (parcel) {
                parcel.interact(data.tx, data.ty, data.action, { 
                    id: data.playerId, 
                    name: data.playerName 
                });
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
                currentTool: this.game.localPlayer.currentTool,
                inVehicle: this.game.localPlayer.inVehicle,
                name: this.game.localPlayer.name
            });
        }
    }

    sendMessage(text) {
        if (this.socket) {
            this.socket.emit('chatMessage', { 
                name: this.game.localPlayer.name, 
                text 
            });
            // Show locally too
            this.game.app.ui.receiveMessage(this.game.localPlayer.name, text);
        }
    }

    sendVehicleUpdate(vehicle) {
        if (this.socket) {
            this.socket.emit('vehicleUpdate', {
                id: vehicle.id,
                x: vehicle.x,
                y: vehicle.y,
                angle: vehicle.angle,
                driver: vehicle.driver
            });
        }
    }

    sendShoot(x, y, angle, type) {
        if (this.socket) {
            this.socket.emit('shoot', { x, y, angle, type, id: this.socket.id });
            // Spawn locally too
            this.game.spawnProjectile(x, y, angle, type, this.socket.id);
        }
    }

    sendFarmUpdate(parcelIdx, tx, ty, action, p) {
        if (this.socket) {
            this.socket.emit('farmUpdate', { 
                parcelIdx, 
                tx, 
                ty, 
                action, 
                playerId: p.id,
                playerName: p.name 
            });
        }
    }
}
