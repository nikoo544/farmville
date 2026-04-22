export class UI {
    constructor(game) {
        this.game = game;
        this.inventoryPanel = document.getElementById('inventory-panel');
        this.shopItemsContainer = document.getElementById('shop-items');
        this.loadingScreen = document.getElementById('loading-screen');
        this.currentTab = 'equipment';

        this.setupListeners();
    }

    setupListeners() {
        // Close inventory
        document.getElementById('close-inventory').onclick = () => this.toggleInventory(false);

        // Chat
        const chatInput = document.getElementById('chat-input');
        chatInput.onkeydown = (e) => {
            if (e.code === 'Enter' && chatInput.value.trim()) {
                const val = chatInput.value.trim();
                if (val.startsWith('/')) {
                    this.handleCommand(val);
                } else {
                    this.game.app.network.sendMessage(val);
                }
                chatInput.value = '';
                chatInput.blur();
            }
        };

        // Emojis
        document.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.onclick = () => {
                if (!this.game.localPlayer) return;
                const emoji = btn.dataset.emoji;
                // 🎲 dice button triggers d20 roll
                if (emoji === '🎲') {
                    this.handleCommand('/d20');
                    return;
                }
                this.game.localPlayer.gesture = emoji;
                setTimeout(() => { if (this.game.localPlayer) this.game.localPlayer.gesture = null; }, 3000);
                this.game.app.network.sendGesture(emoji);
            };
        });

        // Inventory tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTab = btn.dataset.tab;
                this.renderPanel(this.currentTab);
            };
        });

        // Toggle inventory with TAB or ESC
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Tab') {
                e.preventDefault();
                this.toggleInventory(!this.isInventoryOpen());
            }
            if (e.code === 'Escape') {
                this.toggleInventory(false);
            }
        });
    }

    hideLoading() {
        this.loadingScreen.classList.add('hidden');
    }

    toggleInventory(show) {
        if (show) {
            this.inventoryPanel.classList.remove('hidden');
            this.renderPanel(this.currentTab);
        } else {
            this.inventoryPanel.classList.add('hidden');
        }
    }

    isInventoryOpen() {
        return !this.inventoryPanel.classList.contains('hidden');
    }

    updateStats(inv) {
        const moneyEl = document.getElementById('money-display');
        if (moneyEl && inv.gold !== undefined) moneyEl.textContent = inv.gold;

        const toolIcon = this.game.localPlayer?.currentTool?.includes('sword') ? '⚔️' :
                         this.game.localPlayer?.currentTool?.includes('bow') ? '🏹' :
                         this.game.localPlayer?.currentTool?.includes('staff') ? '🪄' : '✨';
        const toolEl = document.getElementById('tool-indicator');
        if (toolEl) toolEl.textContent = toolIcon;
    }

    renderPanel(tab) {
        if (tab === 'inventory') {
            this.renderInventory();
            return;
        }

        const catalog = {
            equipment: [
                { id: 'weapon:sword', name: 'Espada de Acero', price: 0, icon: '⚔️', desc: 'Arma básica del Guerrero' },
                { id: 'weapon:bow',   name: 'Arco Largo',      price: 50, icon: '🏹', desc: 'Disparo a distancia' },
                { id: 'weapon:staff', name: 'Báculo Místico',  price: 100, icon: '🪄', desc: 'Proyectil arcano' }
            ],
            potions: [
                { id: 'item:hp_potion',   name: 'Poción de Vida', price: 20, icon: '🧪', desc: 'Restaura vitalidad' },
                { id: 'item:mana_potion', name: 'Poción de Maná', price: 30, icon: '🍷', desc: 'Recarga energía mágica' }
            ],
            spells: [
                { id: 'spell:fireball', name: 'Bola de Fuego',  price: 150, icon: '🔥', desc: 'Proyectil explosivo' },
                { id: 'spell:blink',    name: 'Parpadeo',       price: 200, icon: '✨', desc: 'Teletransporte corto' }
            ]
        };

        this.shopItemsContainer.innerHTML = '';
        const items = catalog[tab] || [];
        const p = this.game.localPlayer;

        items.forEach(item => {
            const isEquipped = p?.currentTool === item.id;
            const canAfford = (p?.inventory.gold ?? 0) >= item.price;
            const el = document.createElement('div');
            el.className = 'shop-item';
            el.style.opacity = canAfford || isEquipped ? '1' : '0.5';
            el.innerHTML = `
                <div class="item-icon">${item.icon}</div>
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${item.price === 0 ? 'Gratis' : `${item.price} 💰`}</div>
                    ${isEquipped ? '<div class="item-equipped">✓ Equipado</div>' : ''}
                </div>
            `;
            el.onclick = () => this.buyItem(item);
            this.shopItemsContainer.appendChild(el);
        });
    }

    renderInventory() {
        const p = this.game.localPlayer;
        if (!p) return;

        this.shopItemsContainer.innerHTML = '';

        const items = [
            { name: 'Oro',         value: p.inventory.gold,    icon: '💰' },
            { name: 'Pociones',    value: p.inventory.potions,  icon: '🧪' },
            { name: 'Pergaminos',  value: p.inventory.scrolls,  icon: '📜' },
            { name: 'Maná',        value: p.inventory.mana,     icon: '✨' },
            { name: 'Arma',        value: p.currentTool.replace('weapon:', ''), icon: '⚔️' },
            { name: 'Clase',       value: { warrior: 'Guerrero', mage: 'Mago', fairy: 'Hada' }[p.appearance.class] || '?', icon: '🎭' }
        ];

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'shop-item';
            el.innerHTML = `
                <div class="item-icon">${item.icon}</div>
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${item.value}</div>
                </div>
            `;
            this.shopItemsContainer.appendChild(el);
        });
    }

    buyItem(item) {
        const p = this.game.localPlayer;
        if (!p) return;

        if (p.inventory.gold >= item.price) {
            p.inventory.gold -= item.price;
            if (item.id.startsWith('weapon:')) {
                p.currentTool = item.id;
                this.receiveMessage('ARMERÍA', `Has equipado: ${item.name}`, 'system');
            } else {
                const key = item.id.split(':')[1];
                p.inventory[key] = (p.inventory[key] || 0) + 1;
                this.receiveMessage('TIENDA', `Has obtenido: ${item.name}`, 'system');
            }
            this.updateStats(p.inventory);
            this.renderPanel(this.currentTab);
        } else {
            this.receiveMessage('SISTEMA', 'No tienes suficiente oro.', 'system');
        }
    }

    handleCommand(cmd) {
        const parts = cmd.split(' ');
        const action = parts[0].toLowerCase();

        if (action === '/d20') {
            const roll = Math.floor(Math.random() * 20) + 1;
            const critical = roll === 20 ? ' ¡CRÍTICO NATURAL! 🎉' : (roll === 1 ? ' ¡PIFIA TOTAL! 💀' : '');
            this.game.app.network.sendMessage(`🎲 tiró un d20 y sacó ${roll}${critical}`);
            if (this.game.localPlayer) {
                this.game.localPlayer.gesture = `🎲${roll}`;
                setTimeout(() => { if (this.game.localPlayer) this.game.localPlayer.gesture = null; }, 4000);
            }
        } else if (action === '/mood') {
            const mood = parts.slice(1).join(' ').slice(0, 30);
            if (this.game.localPlayer) {
                this.game.localPlayer.mood = mood;
                this.receiveMessage('SISTEMA', `Estado actualizado: "${mood}"`, 'system');
            }
        } else if (action === '/clase' || action === '/class') {
            const p = this.game.localPlayer;
            if (p) {
                const classNames = { warrior: 'Guerrero', mage: 'Mago', fairy: 'Hada' };
                this.receiveMessage('SISTEMA', `Tu clase: ${classNames[p.appearance.class]}. Habilidad: Q`, 'system');
            }
        } else if (action === '/ayuda' || action === '/help') {
            this.receiveMessage('SISTEMA', 'Comandos: /d20, /mood [texto], /clase, /ayuda', 'system');
        } else {
            this.receiveMessage('SISTEMA', `Comando desconocido. Usa /ayuda`, 'system');
        }
    }

    receiveMessage(name, text, type = '') {
        const chatMessages = document.getElementById('chat-messages');
        const msgEl = document.createElement('div');
        msgEl.className = `chat-msg ${type}`;
        msgEl.innerHTML = `<span class="name">${name}:</span><span class="text"> ${text}</span>`;
        chatMessages.appendChild(msgEl);

        // Keep last 50 messages
        while (chatMessages.children.length > 50) chatMessages.removeChild(chatMessages.firstChild);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}
