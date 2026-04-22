import { Game } from './game.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { NetworkManager } from './network.js';

class App {
    constructor() {
        window.app = this; // Global access for modules
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

        let selectedGender = 'male';
        let selectedHair = 0;
        let selectedClass = 'warrior';

        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedGender = btn.dataset.gender;
            };
        });

        document.querySelectorAll('.class-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedClass = btn.dataset.class;
            };
        });

        document.querySelectorAll('.hair-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.hair-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedHair = parseInt(btn.dataset.style);
            };
        });

        btnStart.onclick = () => {
            const name = nameInput.value.trim() || 'Heroe_' + Math.floor(Math.random() * 1000);
            const outfit = document.getElementById('outfit-color').value;
            
            joinScreen.classList.add('hidden');
            this.startGame(name, {
                gender: selectedGender,
                hairStyle: selectedHair,
                outfitColor: outfit,
                class: selectedClass
            });
        };
    }

    async startGame(name, appearance) {
        this.ui.loadingScreen.classList.remove('hidden');
        
        // Simulate loading
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create local player
        const localPlayer = new Player(this.network.socket?.id || 'local', name, true);
        localPlayer.appearance = { ...localPlayer.appearance, ...appearance };
        
        this.game.setLocalPlayer(localPlayer);
        
        // Hide loading screen
        this.ui.hideLoading();
        
        console.log('AgriAuto Initialized for:', name);
        
        // Initial setup
        this.ui.updateStats(localPlayer.inventory);

        // Only add dummy players if offline
        if (!this.network.socket) {
            this.createDummyPlayers();
        }

        // Start interaction loop
        this.startLoop();
    }

    createDummyPlayers() {
        const names = ['Pedro_88', 'MariaFarm', 'Robot_X', 'HarvestKing'];
        const colors = ['#f87171', '#60a5fa', '#fbbf24', '#c084fc'];
        
        names.forEach((name, i) => {
            const dummy = new Player(`dummy_${i}`, name, false);
            dummy.x = (Math.random() - 0.5) * 2000;
            dummy.y = (Math.random() - 0.5) * 2000;
            dummy.color = colors[i];
            this.game.entities.push(dummy);
        });
    }

    startLoop() {
        const loop = () => {
            this.handleInteractions();
            
            // Send movement to server
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

        // Vehicle interaction (Only Moto now)
        const distToMoto = Math.sqrt((p.x - this.game.moto.x) ** 2 + (p.y - this.game.moto.y) ** 2);
        
        // Handle Vehicle Exit/Enter
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

        if (p.inVehicle) {
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
            return;
        }

        // Interaction Prompt for Social Plaza
        const distToCenter = Math.sqrt(p.x * p.x + p.y * p.y);
        const prompt = document.getElementById('interaction-prompt');
        
        if (distToCenter < 300) {
            prompt.classList.remove('hidden');
            prompt.innerHTML = `🌟 Estás en la Plaza Central. ¡Usa <span class="key">Q</span> para tu poder!`;
        } else {
            prompt.classList.add('hidden');
        }
    }
}

// Start the application
new App();
