import { FarmSystem } from './farm.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1
        };

        this.worldSize = 5000; // Large world
        this.gridSize = 64; // Size of each tile
        
        this.entities = [];
        this.players = new Map();
        this.localPlayer = null;

        this.farmSystem = new FarmSystem(this);

        this.lastTime = 0;
        this.setup();
    }

    setup() {
        window.addEventListener('resize', () => this.resize());
        this.resize();
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    setLocalPlayer(player) {
        this.localPlayer = player;
    }

    loop(time) {
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.localPlayer) {
            this.localPlayer.update(dt);
            
            // Camera follows player
            this.camera.x = this.localPlayer.x - this.width / 2;
            this.camera.y = this.localPlayer.y - this.height / 2;
        }

        this.farmSystem.update(dt);

        // Update other entities
        this.entities.forEach(entity => entity.update?.(dt));
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        this.drawGrid();
        this.drawNexus();
        
        this.farmSystem.draw(this.ctx);

        // Draw entities
        this.entities.forEach(entity => entity.draw?.(this.ctx));
        
        // Draw local player
        if (this.localPlayer) {
            this.localPlayer.draw(this.ctx);
        }

        this.ctx.restore();
    }

    drawGrid() {
        const startX = Math.floor(this.camera.x / this.gridSize) * this.gridSize;
        const startY = Math.floor(this.camera.y / this.gridSize) * this.gridSize;
        const endX = startX + this.width + this.gridSize;
        const endY = startY + this.height + this.gridSize;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let x = startX; x < endX; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }

        for (let y = startY; y < endY; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
    }

    drawNexus() {
        // Draw the central shop hub
        const size = 300;
        const x = -size / 2;
        const y = -size / 2;

        // Glow
        const grad = this.ctx.createRadialGradient(0, 0, 50, 0, 0, 200);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
        grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(-200, -200, 400, 400);

        // Core
        this.ctx.fillStyle = '#8b5cf6';
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, size, size, 20);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#c084fc';
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        // Icon/Text
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 40px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('NEXUS', 0, 0);
        this.ctx.font = '20px Outfit';
        this.ctx.fillText('TIENDA', 0, 30);
    }
}
