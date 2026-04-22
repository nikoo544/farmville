export class UI {
    constructor(game) {
        this.game = game;
        this.shopMenu = document.getElementById('shop-menu');
        this.closeShopBtn = document.getElementById('close-shop');
        this.shopItemsContainer = document.getElementById('shop-items');
        this.loadingScreen = document.getElementById('loading-screen');
        this.moneyDisplay = document.getElementById('money-display');
        
        this.setupListeners();
        this.renderShop('seeds');
    }

    setupListeners() {
        this.closeShopBtn.onclick = () => this.toggleShop(false);
        
        // Chat
        const chatInput = document.getElementById('chat-input');
        chatInput.onkeydown = (e) => {
            if (e.code === 'Enter' && chatInput.value.trim()) {
                this.game.app.network.sendMessage(chatInput.value.trim());
                chatInput.value = '';
                chatInput.blur();
            }
        };

        // Emojis
        document.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.onclick = () => {
                const emoji = btn.dataset.emoji;
                this.game.localPlayer.gesture = emoji;
                setTimeout(() => this.game.localPlayer.gesture = null, 3000);
                this.game.app.network.sendGesture(emoji);
            };
        });

        document.getElementById('sell-zone').onclick = () => {
            const distToNexus = Math.sqrt(this.game.localPlayer.x ** 2 + this.game.localPlayer.y ** 2);
            if (distToNexus < 200) {
                this.sellCrops();
            } else {
                alert('Debes estar en el Nexus para vender');
            }
        };

        // Donation Chest Interaction
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyE') {
                const p = this.game.localPlayer;
                if (!p) return;
                
                // Dist to chest (at 0, 130 approx)
                const distToChest = Math.sqrt(p.x ** 2 + (p.y - 130) ** 2);
                if (distToChest < 80 && p.inventory.money >= 100) {
                    p.inventory.money -= 100;
                    this.game.app.network.sendDonation(100);
                    this.updateStats(p.inventory);
                }
            }
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderShop(btn.dataset.tab);
            };
        });

        // Toggle shop with Tab or ESC
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Tab' || e.code === 'Escape') {
                e.preventDefault();
                this.toggleShop(!this.isShopOpen());
            }
        });
    }

    hideLoading() {
        this.loadingScreen.classList.add('hidden');
    }

    toggleShop(show) {
        if (show) {
            this.shopMenu.classList.remove('hidden');
        } else {
            this.shopMenu.classList.add('hidden');
        }
    }

    isShopOpen() {
        return !this.shopMenu.classList.contains('hidden');
    }

    updateStats(stats) {
        if (stats.money !== undefined) this.moneyDisplay.innerText = stats.money;
        
        // Sum all crops for display
        const totalCrops = (stats.wheat || 0) + (stats.carrot || 0) + (stats.corn || 0);
        document.getElementById('crop-display').innerText = totalCrops;
        
        // Update tool indicator
        const toolIcon = this.game.localPlayer?.currentTool === 'hoe' ? '⚒️' : 
                        (this.game.localPlayer?.currentTool.startsWith('plant') ? '🌱' : 
                        (this.game.localPlayer?.currentTool === 'sprinkler' ? '⛲' : '🪓'));
        document.getElementById('tool-indicator').innerText = toolIcon;
    }

    renderShop(category) {
        if (category === 'inventory') {
            this.renderInventory();
            return;
        }

        const items = {
            seeds: [
                { id: 'plant:wheat', name: 'Trigo', price: 10, icon: '🌾' },
                { id: 'plant:carrot', name: 'Zanahoria', price: 25, icon: '🥕' },
                { id: 'plant:corn', name: 'Maíz', price: 50, icon: '🌽' }
            ],
            tools: [
                { id: 'hoe', name: 'Azada Pro', price: 100, icon: '⚒️' },
                { id: 'scythe', name: 'Hoz Maestro', price: 100, icon: '🪓' },
                { id: 'moto', name: 'Moto Deportiva', price: 0, icon: '🏍️' }
            ],
            automation: [
                { id: 'sprinkler', name: 'Aspersor V1', price: 500, icon: '⛲' }
            ],
            weapons: [
                { id: 'weapon:pistol', name: 'Pistola 9mm', price: 0, icon: '🔫' },
                { id: 'weapon:bow', name: 'Arco Largo', price: 0, icon: '🏹' },
                { id: 'weapon:bazooka', name: 'Bazooka RPG', price: 0, icon: '🚀' }
            ]
        };

        this.shopItemsContainer.innerHTML = '';
        
        items[category].forEach(item => {
            const el = document.createElement('div');
            el.className = 'shop-item';
            el.innerHTML = `
                <div class="item-icon">${item.icon}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-price">$${item.price}</div>
            `;
            el.onclick = () => this.buyItem(item);
            this.shopItemsContainer.appendChild(el);
        });
    }

    renderInventory() {
        const p = this.game.localPlayer;
        if (!p) return;

        this.shopItemsContainer.innerHTML = '';
        
        const invItems = [
            { name: 'Dinero', value: `$${p.inventory.money}`, icon: '💰' },
            { name: 'Cosecha', value: p.inventory.crops, icon: '🌾' },
            { name: 'Semillas', value: p.inventory.seeds, icon: '🌱' },
            { name: 'Herramienta', value: p.currentTool, icon: '⚒️' }
        ];

        invItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'shop-item inventory-item';
            el.innerHTML = `
                <div class="item-icon">${item.icon}</div>
                <div class="item-name">${item.name}</div>
                <div class="item-price">${item.value}</div>
            `;
            this.shopItemsContainer.appendChild(el);
        });
    }

    buyItem(item) {
        const p = this.game.localPlayer;
        if (!p) return;

        if (p.inventory.money >= item.price) {
            p.inventory.money -= item.price;
            
            if (item.id.startsWith('plant:')) {
                p.currentTool = item.id;
            } else if (item.id.startsWith('weapon:')) {
                p.currentTool = item.id;
            } else if (item.id === 'sprinkler') {
                p.currentTool = 'sprinkler';
            } else if (item.id === 'scythe') {
                p.currentTool = 'scythe';
            }

            this.updateStats(p.inventory);
            this.toggleShop(false);
        } else {
            alert('No tienes suficiente dinero');
        }
    }

    sellCrops() {
        const p = this.game.localPlayer;
        if (!p) return;

        const wheatVal = (p.inventory.wheat || 0) * 15;
        const carrotVal = (p.inventory.carrot || 0) * 40;
        const cornVal = (p.inventory.corn || 0) * 100;
        
        const earnings = wheatVal + carrotVal + cornVal;
        if (earnings <= 0) return;

        p.inventory.money += earnings;
        p.inventory.wheat = 0;
        p.inventory.carrot = 0;
        p.inventory.corn = 0;
        
        this.updateStats(p.inventory);
    }

    receiveMessage(name, text) {
        const chatMessages = document.getElementById('chat-messages');
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg';
        msgEl.innerHTML = `<span class="name">${name}:</span><span class="text">${text}</span>`;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}
