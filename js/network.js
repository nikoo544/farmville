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
            this.game.donations = state.globalDonations;
        });

        this.socket.on('zombieUpdate', (zombies) => {
            this.game.enemies = zombies.map(z => {
                const zombie = new Zombie(z.x, z.y);
                zombie.id = z.id;
                zombie.health = z.health;
                return zombie;
            });
        });

        this.socket.on('donationsUpdated', (amount) => {
            this.game.donations = amount;
            this.game.app.ui.receiveMessage('SISTEMA', `¡Donación recibida! Total global: $${amount}`);
        });

        this.socket.on('rankingUpdate', (ranking) => {
            const list = document.getElementById('score-list');
            list.innerHTML = ranking.map((p, i) => `
                <div class="score-item">
                    <span>${i+1}. ${p.name}</span>
                    <span>$${p.score}</span>
                </div>
            `).join('');
        });

        this.socket.on('droneEvent', (data) => {
            this.game.drone = new Drone(data.x, data.y);
            this.game.app.ui.receiveMessage('SISTEMA', '🚁 El Dron de recolección está llegando al Nexus...');
        });

        this.socket.on('playerGesture', (data) => {
            const remotePlayer = this.game.players.get(data.id);
            if (remotePlayer) {
                remotePlayer.gesture = data.emoji;
                setTimeout(() => remotePlayer.gesture = null, 3000);
            }
        });

        this.socket.on('playerTransformed', (data) => {
            if (data.id === this.socket.id) {
                this.game.localPlayer.isRabbit = data.status;
                this.game.app.ui.receiveMessage('SISTEMA', data.status ? '¡Te han convertido en conejo!' : 'Has vuelto a la normalidad.');
            } else {
                const remote = this.game.players.get(data.id);
                if (remote) remote.isRabbit = data.status;
            }
        });

        this.socket.on('skillEffect', (data) => {
            // Visual feedback could be added here
            const p = this.game.players.get(data.id);
            const name = p ? p.name : 'Alguien';
            this.game.app.ui.receiveMessage('COMBATE', `${name} usó una habilidad: ${data.type}`);
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
                remotePlayer.name = playerInfo.name; 
                remotePlayer.appearance = playerInfo.appearance; // Sync appearance
                remotePlayer.isRabbit = playerInfo.isRabbit;
                remotePlayer.mood = playerInfo.mood; // Sync mood
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
    }

    addRemotePlayer(playerInfo) {
        const remotePlayer = new Player(playerInfo.id, playerInfo.name, false);
        remotePlayer.x = playerInfo.x;
        remotePlayer.y = playerInfo.y;
        remotePlayer.color = playerInfo.color;
        remotePlayer.appearance = playerInfo.appearance; // Initial appearance
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
                name: this.game.localPlayer.name,
                appearance: this.game.localPlayer.appearance,
                isRabbit: this.game.localPlayer.isRabbit,
                mood: this.game.localPlayer.mood
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

    sendSkill(type) {
        if (this.socket) {
            this.socket.emit('skill', { type });
        }
    }

    sendDonation(amount) {
        if (this.socket) {
            this.socket.emit('donate', amount);
        }
    }

    sendGesture(emoji) {
        if (this.socket) {
            this.socket.emit('gesture', emoji);
        }
    }
}
