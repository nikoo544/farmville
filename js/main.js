import { Game } from './game.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { NetworkManager } from './network.js';

class App {
    constructor() {
        window.app = this;
        this.game = new Game();
        this.game.app = this;
        this.ui = new UI(this.game);
        this.network = new NetworkManager(this.game);
        this.init();
    }

    async init() {
        const joinScreen = document.getElementById('join-screen');
        const nameInput = document.getElementById('player-name-input');
        const btnStart = document.getElementById('btn-start');
        const previewCanvas = document.getElementById('preview-canvas');
        const previewClassName = document.getElementById('preview-class-name');
        const previewClassDesc = document.getElementById('preview-class-desc');

        let selectedGender = 'male';
        let selectedHair = 0;
        let selectedClass = 'warrior';
        let selectedColor = '#3b82f6';

        const classInfo = {
            warrior: { icon: '⚔️', name: 'Guerrero', desc: 'Valiente y resistente. Su grito de batalla inspira a sus aliados cercanos.' },
            mage:    { icon: '🧙', name: 'Mago',     desc: 'Maestro de los arcanos. Puede transformar enemigos en conejos por 10 segundos.' },
            fairy:   { icon: '🧚', name: 'Hada',     desc: 'Ser mágico y veloz. Lanza destellos de polvo de hada sobre la Citadela.' }
        };

        const updatePreview = () => {
            const ctx = previewCanvas.getContext('2d');
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

            // Background
            ctx.fillStyle = 'rgba(30, 10, 60, 0.4)';
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            const preview = new Player('preview', '', false);
            preview.x = previewCanvas.width / 2;
            preview.y = previewCanvas.height / 2 + 40;
            preview.appearance = {
                gender: selectedGender,
                class: selectedClass,
                hairStyle: selectedHair,
                outfitColor: selectedColor,
                hairColor: '#451a03',
                skinColor: '#fcd34d'
            };
            preview.draw(ctx);

            // Update text
            const info = classInfo[selectedClass];
            previewClassName.textContent = `${info.icon} ${info.name}`;
            previewClassDesc.textContent = info.desc;
        };

        setTimeout(updatePreview, 100);

        // Class selection
        document.querySelectorAll('.class-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedClass = btn.dataset.class;
                updatePreview();
            };
        });

        // Gender selection
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedGender = btn.dataset.gender;
                updatePreview();
            };
        });

        // Hair selection
        document.querySelectorAll('.hair-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.hair-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedHair = parseInt(btn.dataset.style);
                updatePreview();
            };
        });

        // Outfit color
        document.getElementById('outfit-color').oninput = (e) => {
            selectedColor = e.target.value;
            updatePreview();
        };

        // Enter world
        btnStart.onclick = () => {
            const name = nameInput.value.trim() || 'Héroe_' + Math.floor(Math.random() * 9999);
            joinScreen.classList.add('hidden');
            this.startGame(name, {
                gender: selectedGender,
                hairStyle: selectedHair,
                outfitColor: selectedColor,
                class: selectedClass,
                hairColor: '#451a03',
                skinColor: '#fcd34d'
            });
        };

        // Also allow Enter key to start
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnStart.click();
        });
    }

    async startGame(name, appearance) {
        document.getElementById('loading-screen').classList.remove('hidden');
        await new Promise(resolve => setTimeout(resolve, 1200));

        const id = this.network.socket?.id || 'local_' + Date.now();
        const localPlayer = new Player(id, name, true);
        localPlayer.appearance = { ...localPlayer.appearance, ...appearance };

        this.game.setLocalPlayer(localPlayer);

        // Update HUD with player info
        const info = { warrior: '⚔️ Guerrero', mage: '🧙 Mago', fairy: '🧚 Hada' };
        document.getElementById('hud-player-name').textContent = name;
        document.getElementById('hud-class-icon').textContent = { warrior: '⚔️', mage: '🧙', fairy: '🧚' }[appearance.class] || '✨';
        document.getElementById('hud-player-class').textContent = { warrior: 'Guerrero', mage: 'Mago', fairy: 'Hada' }[appearance.class] || '';
        document.getElementById('skill-icon').textContent = { warrior: '🛡️', mage: '🐇', fairy: '✨' }[appearance.class] || '✨';

        document.getElementById('loading-screen').classList.add('hidden');
        this.ui.updateStats(localPlayer.inventory);

        this.ui.receiveMessage('CITADELA', `¡Bienvenido, ${name}! Usa WASD para moverte y Q para tu habilidad de clase.`, 'system');

        this.startLoop();
    }

    startLoop() {
        const loop = () => {
            this.handleInteractions();
            if (this.game.localPlayer && this.network.socket) {
                this.network.sendMovement(this.game.localPlayer.x, this.game.localPlayer.y);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    handleInteractions() {
        const p = this.game.localPlayer;
        if (!p) return;

        // --- MOTO ---
        if (this.game.moto) {
            const distToMoto = Math.hypot(p.x - this.game.moto.x, p.y - this.game.moto.y);

            if (p.input.vehicle && !p.isEntering) {
                p.isEntering = true;
                if (p.inVehicle) {
                    p.inVehicle = false;
                    this.game.moto.driver = null;
                    this.network.sendVehicleUpdate(this.game.moto);
                } else if (distToMoto < 100 && !this.game.moto.driver) {
                    p.inVehicle = true;
                    this.game.moto.driver = p.id;
                    this.network.sendVehicleUpdate(this.game.moto);
                }
                setTimeout(() => p.isEntering = false, 500);
            }

            if (p.inVehicle && this.game.moto.driver === p.id) {
                const v = this.game.moto;
                let move = 0;
                if (p.input.up) move = 1;
                if (p.input.down) move = -1;
                if (p.input.left) v.angle -= 5 * 0.016;
                if (p.input.right) v.angle += 5 * 0.016;
                v.velocity.x = Math.cos(v.angle) * move * v.speed;
                v.velocity.y = Math.sin(v.angle) * move * v.speed;
                v.x += v.velocity.x * 0.016;
                v.y += v.velocity.y * 0.016;
                p.x = v.x;
                p.y = v.y;
                this.network.sendVehicleUpdate(v);
            }
        }

        // --- PROMPTS ---
        const distToCenter = Math.hypot(p.x, p.y);
        const prompt = document.getElementById('interaction-prompt');

        if (distToCenter < 350) {
            prompt.classList.remove('hidden');
            const classSkill = { warrior: 'Gritar de Batalla', mage: 'Transformar en Conejo', fairy: 'Destellos Mágicos' };
            const skill = classSkill[p.appearance.class] || 'Habilidad';
            prompt.innerHTML = `✨ Plaza Central · <span class="key">Q</span> ${skill} · <span class="key">TAB</span> Inventario`;
        } else {
            prompt.classList.add('hidden');
        }

        // --- SKILL COOLDOWN UI ---
        const pct = Math.max(0, 1 - p.skillCooldown / 3);
        const bar = document.getElementById('skill-cooldown-bar');
        if (bar) {
            if (p.skillCooldown > 0) {
                bar.style.display = 'block';
                bar.style.background = `conic-gradient(rgba(0,0,0,0.6) ${pct * 360}deg, transparent 0)`;
                bar.style.position = 'absolute';
                bar.style.inset = '0';
                bar.style.borderRadius = '50%';
            } else {
                bar.style.display = 'none';
            }
        }
    }
}

new App();
