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
        this.projectiles = [];
        this.enemies = [];
        this.players = new Map();
        this.localPlayer = null;
        
        this.vehicle = new Vehicle(0, 300); // Tractor
        this.moto = new Motorcycle(100, 300); // Moto
        this.entities.push(this.vehicle, this.moto);

        this.farmSystem = new FarmSystem(this);
        
        this.spawnTimer = 0;

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

        // Update Projectiles
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.projectiles.forEach(p => {
            p.update(dt);
            
            // Collision with enemies
            this.enemies.forEach(e => {
                const dist = Math.sqrt((p.x - e.x)**2 + (p.y - e.y)**2);
                if (dist < e.radius + p.radius) {
                    const damage = p.type === 'rocket' ? 100 : (p.type === 'arrow' ? 40 : 25);
                    e.health -= damage;
                    p.dead = true;
                    if (e.health <= 0) e.dead = true;
                }
            });
        });

        // Update Enemies
        this.spawnTimer += dt;
        if (this.spawnTimer > 3) {
            this.spawnZombie();
            this.spawnTimer = 0;
        }
        this.enemies = this.enemies.filter(e => !e.dead);
        this.enemies.forEach(e => e.update(dt, this.localPlayer, this.players));

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

        this.projectiles.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));

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

    spawnZombie() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1500;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        this.enemies.push(new Zombie(x, y));
    }

    spawnProjectile(x, y, angle, type, ownerId) {
        this.projectiles.push(new Projectile(x, y, angle, type, ownerId));
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

class Motorcycle {
    constructor(x, y) {
        this.id = 'moto_main';
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 30;
        this.color = '#3b82f6'; // Blue
        this.driver = null;
        this.speed = 800; // Faster than tractor
        this.angle = 0;
        this.velocity = { x: 0, y: 0 };
    }

    update(dt) {
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-this.width/2 - 10, -5, 20, 10);
        ctx.fillRect(this.width/2 - 10, -5, 20, 10);
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, angle, type, ownerId) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.type = type;
        this.ownerId = ownerId;
        this.speed = type === 'rocket' ? 400 : 1000;
        this.radius = type === 'rocket' ? 10 : 4;
        this.dead = false;
        this.life = type === 'rocket' ? 3 : 1;
    }

    update(dt) {
        this.x += Math.cos(this.angle) * this.speed * dt;
        this.y += Math.sin(this.angle) * this.speed * dt;
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    draw(ctx) {
        ctx.fillStyle = this.type === 'rocket' ? '#f43f5e' : (this.type === 'arrow' ? '#d4d4d8' : '#fbbf24');
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Zombie {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 25;
        this.speed = 100 + Math.random() * 50;
        this.health = 100;
        this.dead = false;
        this.color = '#166534'; // Zombie Green
    }

    update(dt, localPlayer, remotePlayers) {
        // Find nearest target (local or remote)
        let targets = [];
        if (localPlayer) targets.push(localPlayer);
        remotePlayers.forEach(p => targets.push(p));

        let nearest = null;
        let minDist = Infinity;
        targets.forEach(t => {
            const d = Math.sqrt((t.x - this.x)**2 + (t.y - this.y)**2);
            if (d < minDist) {
                minDist = d;
                nearest = t;
            }
        });

        if (nearest) {
            const angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Health bar
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 20, this.y - 40, 40, 5);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x - 20, this.y - 40, 40 * (this.health/100), 5);
    }
}

class Vehicle {
    constructor(x, y) {
        this.id = 'tractor_main';
        this.x = x;
        this.y = y;
        this.width = 120;
        this.height = 80;
        this.color = '#e11d48'; // Rose/Red
        this.driver = null;
        this.passengers = [];
        this.velocity = { x: 0, y: 0 };
        this.speed = 500;
        this.angle = 0;
    }

    update(dt) {
        if (this.driver) {
            // Logic handled by the driver (authoritative)
        } else {
            // Friction
            this.velocity.x *= 0.95;
            this.velocity.y *= 0.95;
            this.x += this.velocity.x * dt;
            this.y += this.velocity.y * dt;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-this.width/2, -this.height/2, this.width, this.height, 10);
        ctx.fill();
        
        // Cab
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, -this.height/2 + 10, this.width/2 - 10, this.height - 20);

        // Wheels
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-this.width/2 + 5, -this.height/2 - 5, 30, 10);
        ctx.fillRect(-this.width/2 + 5, this.height/2 - 5, 30, 10);
        ctx.fillRect(this.width/2 - 35, -this.height/2 - 5, 30, 10);
        ctx.fillRect(this.width/2 - 35, this.height/2 - 5, 30, 10);

        ctx.restore();
        
        // Passengers label
        if (this.driver || this.passengers.length > 0) {
            ctx.fillStyle = 'white';
            ctx.font = '12px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText(`Abordo: ${this.driver ? 1 : 0} + ${this.passengers.length}`, this.x, this.y - 60);
        }
    }
}
