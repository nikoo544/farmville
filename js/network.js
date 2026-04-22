import { Player } from './player.js';

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;

        if (typeof io !== 'undefined') {
            this.socket = io();
            this.setupListeners();
        } else {
            console.warn('Socket.io no encontrado. Modo offline.');
        }
    }

    setupListeners() {
        // World state sync
        this.socket.on('worldState', (state) => {
            if (state.globalDonations !== undefined) this.game.donations = state.globalDonations;
        });

        // Player list (online scoreboard)
        this.socket.on('rankingUpdate', (ranking) => {
            const list = document.getElementById('score-list');
            if (!list) return;
            list.innerHTML = ranking.slice(0, 8).map(p => `
                <div class="score-item">
                    <span class="score-name">${p.icon || '⚔️'} ${p.name}</span>
                    <span class="score-class">${p.className || ''}</span>
                </div>
            `).join('') || '<div style="color:rgba(255,255,255,0.3);font-size:12px;">Nadie conectado aún</div>';
        });

        // Player gestures
        this.socket.on('playerGesture', (data) => {
            const remote = this.game.players.get(data.id);
            if (remote) {
                remote.gesture = data.emoji;
                setTimeout(() => remote.gesture = null, 3000);
            }
        });

        // Transformation (Mage skill)
        this.socket.on('playerTransformed', (data) => {
            if (data.id === this.socket.id) {
                if (this.game.localPlayer) {
                    this.game.localPlayer.isRabbit = data.status;
                    this.game.app.ui.receiveMessage('MAGIA', 
                        data.status ? '🐇 ¡Un mago te transformó en conejo!' : '✨ Has vuelto a la normalidad.',
                        'system'
                    );
                }
            } else {
                const remote = this.game.players.get(data.id);
                if (remote) remote.isRabbit = data.status;
            }
        });

        // Skill effects (Fairy sparkle, Warrior taunt)
        this.socket.on('skillEffect', (data) => {
            const p = this.game.players.get(data.id);
            const name = p ? p.name : 'Alguien';
            const effects = {
                transform: `🧙 ${name} lanzó un hechizo de transformación`,
                sparkle:   `🧚 ${name} lanzó destellos de hada ✨`,
                taunt:     `⚔️ ${name} lanzó un grito de batalla`,
            };
            this.game.app.ui.receiveMessage('MAGIA', effects[data.type] || `${name} usó una habilidad`, 'combat');
        });

        // Current players on connect
        this.socket.on('currentPlayers', (players) => {
            Object.values(players).forEach(info => {
                if (info.id !== this.socket.id) this.addRemotePlayer(info);
            });
        });

        // New player joins
        this.socket.on('newPlayer', (info) => {
            this.addRemotePlayer(info);
            this.game.app.ui.receiveMessage('CITADELA', `${info.name} ha entrado a la Citadela 🏰`, 'system');
        });

        // Player movement update
        this.socket.on('playerMoved', (info) => {
            const remote = this.game.players.get(info.id);
            if (remote) {
                // Smooth interpolation
                remote.targetX = info.x;
                remote.targetY = info.y;
                remote.currentTool = info.currentTool;
                remote.inVehicle = info.inVehicle;
                remote.name = info.name;
                if (info.appearance) remote.appearance = info.appearance;
                if (info.isRabbit !== undefined) remote.isRabbit = info.isRabbit;
                if (info.mood !== undefined) remote.mood = info.mood;
            }
        });

        // Chat
        this.socket.on('chatMessage', (data) => {
            this.game.app.ui.receiveMessage(data.name, data.text);
        });

        // Vehicle sync
        this.socket.on('vehicleMoved', (data) => {
            const v = this.game.moto;
            if (v && data.id === 'moto_main') {
                v.x = data.x;
                v.y = data.y;
                v.angle = data.angle;
                v.driver = data.driver;
            }
        });

        // Projectiles
        this.socket.on('shoot', (data) => {
            this.game.spawnProjectile(data.x, data.y, data.angle, data.type, data.id);
        });

        // Disconnect
        this.socket.on('playerDisconnected', (id) => {
            const p = this.game.players.get(id);
            if (p) {
                this.game.app.ui.receiveMessage('CITADELA', `${p.name} ha abandonado la Citadela`, 'system');
            }
            this.game.players.delete(id);
            this.game.entities = this.game.entities.filter(e => e.id !== id);
        });
    }

    addRemotePlayer(info) {
        if (this.game.players.has(info.id)) return;
        const remote = new Player(info.id, info.name, false);
        remote.x = info.x || 0;
        remote.y = info.y || 0;
        remote.targetX = remote.x;
        remote.targetY = remote.y;
        remote.color = info.color || '#f87171';
        if (info.appearance) remote.appearance = { ...remote.appearance, ...info.appearance };
        this.game.players.set(info.id, remote);
        this.game.entities.push(remote);
    }

    sendMovement(x, y) {
        if (!this.socket || !this.game.localPlayer) return;
        this.socket.emit('playerMovement', {
            x, y,
            currentTool: this.game.localPlayer.currentTool,
            inVehicle: this.game.localPlayer.inVehicle,
            name: this.game.localPlayer.name,
            appearance: this.game.localPlayer.appearance,
            isRabbit: this.game.localPlayer.isRabbit,
            mood: this.game.localPlayer.mood
        });
    }

    sendMessage(text) {
        if (!this.socket || !this.game.localPlayer) return;
        const name = this.game.localPlayer.name;
        this.socket.emit('chatMessage', { name, text });
        this.game.app.ui.receiveMessage(name, text);
    }

    sendVehicleUpdate(vehicle) {
        if (!this.socket) return;
        this.socket.emit('vehicleUpdate', {
            id: vehicle.id,
            x: vehicle.x,
            y: vehicle.y,
            angle: vehicle.angle,
            driver: vehicle.driver
        });
    }

    sendShoot(x, y, angle, type) {
        if (!this.socket) return;
        this.socket.emit('shoot', { x, y, angle, type, id: this.socket.id });
        this.game.spawnProjectile(x, y, angle, type, this.socket.id);
    }

    sendSkill(type) {
        if (!this.socket) return;
        this.socket.emit('skill', { type });
    }

    sendGesture(emoji) {
        if (!this.socket) return;
        this.socket.emit('gesture', emoji);
    }
}
