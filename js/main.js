import { Game } from './game.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { NetworkManager } from './network.js';

class App {
    constructor() {
        this.game = new Game();
        this.ui = new UI(this.game);
        this.network = new NetworkManager(this.game);
        
        this.init();
    }

    async init() {
        const joinScreen = document.getElementById('join-screen');
        const nameInput = document.getElementById('player-name-input');
        const btnStart = document.getElementById('btn-start');

        btnStart.onclick = () => {
            const name = nameInput.value.trim() || 'Granjero_' + Math.floor(Math.random() * 1000);
            joinScreen.classList.add('hidden');
            this.startGame(name);
        };
    }

    async startGame(name) {
        this.ui.loadingScreen.classList.remove('hidden');
        
        // Simulate loading
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create local player
        const localPlayer = new Player(this.network.socket?.id || 'local', name, true);
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

        // Check Nexus proximity (Shop)
        const distToNexus = Math.sqrt(p.x * p.x + p.y * p.y);
        const nearNexus = distToNexus < 200;

        // Check Parcel proximity
        const parcel = this.game.farmSystem.getParcelAt(p.x, p.y);
        
        const prompt = document.getElementById('interaction-prompt');
        
        if (nearNexus) {
            prompt.classList.remove('hidden');
            prompt.innerHTML = `Presiona <span class="key">E</span> para Abrir Tienda`;
            if (p.input.interact && !this.ui.isShopOpen()) {
                this.ui.toggleShop(true);
                p.input.interact = false; // Prevent multiple triggers
            }
        } else if (parcel) {
            prompt.classList.remove('hidden');
            let actionName = 'Arar';
            let action = 'till';

            if (p.currentTool === 'plant') { actionName = 'Plantar'; action = 'plant'; }
            if (p.currentTool === 'scythe') { actionName = 'Cosechar'; action = 'harvest'; }
            if (p.currentTool === 'sprinkler') { actionName = 'Colocar Aspersor'; action = 'sprinkler'; }

            prompt.innerHTML = `Presiona <span class="key">E</span> para ${actionName}`;
            
            if (p.input.interact) {
                const tx = Math.floor((p.x - parcel.x) / parcel.tileSize);
                const ty = Math.floor((p.y - parcel.y) / parcel.tileSize);
                
                const success = parcel.interact(tx, ty, action, p);
                if (success) {
                    if (action === 'harvest') {
                        p.inventory.crops++;
                    } else if (action === 'sprinkler') {
                        p.currentTool = 'hoe'; // Reset to hoe after placing
                    }
                    
                    // Sync farm update
                    const parcelIdx = this.game.farmSystem.parcels.indexOf(parcel);
                    this.network.sendFarmUpdate(parcelIdx, tx, ty, action, p);
                    
                    this.ui.updateStats(p.inventory);
                }
                
                p.input.interact = false;
            }
        } else {
            prompt.classList.add('hidden');
        }
    }
}

// Start the application
new App();
