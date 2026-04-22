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
        
        document.getElementById('sell-zone').onclick = () => {
            const distToNexus = Math.sqrt(this.game.localPlayer.x ** 2 + this.game.localPlayer.y ** 2);
            if (distToNexus < 200) {
                this.sellCrops();
            } else {
                alert('Debes estar en el Nexus para vender');
            }
        };

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
        if (stats.crops !== undefined) document.getElementById('crop-display').innerText = stats.crops;
        
        // Update tool indicator (we'll add this to HTML)
        const toolIcon = this.game.localPlayer?.currentTool === 'hoe' ? '⚒️' : 
                        (this.game.localPlayer?.currentTool === 'plant' ? '🌱' : 
                        (this.game.localPlayer?.currentTool === 'sprinkler' ? '⛲' : '🪓'));
        document.getElementById('tool-indicator').innerText = toolIcon;
    }

    renderShop(category) {
        const items = {
            seeds: [
                { id: 'wheat', name: 'Trigo', price: 10, icon: '🌾' },
                { id: 'carrot', name: 'Zanahoria', price: 25, icon: '🥕' },
                { id: 'corn', name: 'Maíz', price: 50, icon: '🌽' }
            ],
            tools: [
                { id: 'hoe', name: 'Azada Pro', price: 100, icon: '⚒️' },
                { id: 'can', name: 'Regadera Auto', price: 200, icon: '💧' }
            ],
            automation: [
                { id: 'sprinkler', name: 'Aspersor V1', price: 500, icon: '⛲' },
                { id: 'drone', name: 'Dron Cosechador', price: 1500, icon: '🚁' }
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

    buyItem(item) {
        const p = this.game.localPlayer;
        if (!p) return;

        if (p.inventory.money >= item.price) {
            p.inventory.money -= item.price;
            console.log('Bought:', item.name);
            
            if (item.id === 'sprinkler') {
                p.currentTool = 'sprinkler';
            }

            this.updateStats(p.inventory);
            this.toggleShop(false);
        } else {
            alert('No tienes suficiente dinero');
        }
    }

    sellCrops() {
        const p = this.game.localPlayer;
        if (!p || p.inventory.crops <= 0) return;

        const earnings = p.inventory.crops * 15; // $15 per crop
        p.inventory.money += earnings;
        p.inventory.crops = 0;
        this.updateStats(p.inventory);
        console.log('Sold crops for:', earnings);
    }
}
