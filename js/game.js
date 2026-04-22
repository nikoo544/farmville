import { Player } from './player.js';

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

        this.assets = {};

        this.worldSize = 5000; // Large world
        this.gridSize = 64; // Size of each tile
        
        this.entities = [];
        this.projectiles = [];
        this.enemies = [];
        this.players = new Map();
        this.localPlayer = null;
        
        this.moto = new Motorcycle(100, 300); // Moto
        this.entities.push(this.moto);

        this.donations = 0;
        this.drone = null;
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
        if (this.paused) return;
        
        if (this.localPlayer) {
            this.localPlayer.update(dt);
            
            // Camera follows player
            this.camera.x = this.localPlayer.x - this.width / 2;
            this.camera.y = this.localPlayer.y - this.height / 2;
        }

        // Update Projectiles
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.projectiles.forEach(p => {
            p.update(dt);
            
            // Collision with server-side enemies
            this.enemies.forEach(e => {
                const dist = Math.sqrt((p.x - e.x)**2 + (p.y - e.y)**2);
                if (dist < e.radius + p.radius) {
                    const damage = p.type === 'rocket' ? 100 : (p.type === 'arrow' ? 40 : 25);
                    e.health -= damage;
                    p.dead = true;
                    // Note: Health sync back to server would be better, but for now we just show feedback
                    if (e.health <= 0) e.dead = true;
                }
            });
        });

        // Enemies are updated via Network events now
        // But we still filter dead ones for smoothness
        this.enemies = this.enemies.filter(e => !e.dead);

        if (this.drone) {
            this.drone.update(dt);
            if (this.drone.dead) this.drone = null;
        }

        // Update other entities
        this.entities.forEach(entity => entity.update?.(dt));
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.ctx.fillRect(-this.camera.x, -this.camera.y, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        this.drawGrid();
        this.drawNexus();
        
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        if (this.drone) this.drone.draw(this.ctx);

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
        // Draw green meadow with paths
        this.ctx.fillStyle = '#14532d'; // Dark green
        this.ctx.fillRect(-this.worldSize/2, -this.worldSize/2, this.worldSize, this.worldSize);
        
        // Draw some "Nature" details
        this.ctx.fillStyle = '#15803d';
        for(let i = -10; i < 10; i++) {
            for(let j = -10; j < 10; j++) {
                if((i+j) % 3 === 0) {
                    this.ctx.beginPath();
                    this.ctx.arc(i * 400, j * 400, 100, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }

    spawnZombie() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 2000 + Math.random() * 500; // Spawn much further out
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        this.enemies.push(new Zombie(x, y));
    }

    spawnProjectile(x, y, angle, type, ownerId) {
        this.projectiles.push(new Projectile(x, y, angle, type, ownerId));
    }

    drawNexus() {
        this.drawCitadel();
    }

    drawCitadel() {
        // Draw Central Plaza
        this.ctx.fillStyle = '#475569';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 400, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw Houses around the plaza
        const houseCount = 6;
        for (let i = 0; i < houseCount; i++) {
            const angle = (i / houseCount) * Math.PI * 2;
            const hx = Math.cos(angle) * 600;
            const hy = Math.sin(angle) * 600;
            this.drawHouse(hx, hy);
        }

        // Title
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 50px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('CITADELA MÁGICA', 0, 0);
    }

    drawHouse(x, y) {
        this.ctx.save();
        this.ctx.translate(x, y);
        // Base
        this.ctx.fillStyle = '#92400e';
        this.ctx.fillRect(-60, -40, 120, 80);
        // Roof
        this.ctx.fillStyle = '#7f1d1d';
        this.ctx.beginPath();
        this.ctx.moveTo(-70, -40);
        this.ctx.lineTo(0, -90);
        this.ctx.lineTo(70, -40);
        this.ctx.fill();
        // Door
        this.ctx.fillStyle = '#451a03';
        this.ctx.fillRect(-15, 10, 30, 30);
        this.ctx.restore();
    }
}

class Drone {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.target = { x: 0, y: 130 }; // Community chest
        this.speed = 300;
        this.state = 'approaching'; // 'approaching', 'collecting', 'leaving'
        this.timer = 0;
    }

    update(dt) {
        if (this.state === 'approaching') {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 10) {
                this.state = 'collecting';
                this.timer = 3; // Stay 3 seconds
            } else {
                this.x += (dx/dist) * this.speed * dt;
                this.y += (dy/dist) * this.speed * dt;
            }
        } else if (this.state === 'collecting') {
            this.timer -= dt;
            if (this.timer <= 0) this.state = 'leaving';
        } else if (this.state === 'leaving') {
            this.y -= this.speed * dt;
            if (this.y < -3000) this.dead = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Drone Body
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-20, -10, 40, 20);
        // Props
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-30, -20, 10, 5);
        ctx.fillRect(20, -20, 10, 5);
        ctx.fillRect(-30, 15, 10, 5);
        ctx.fillRect(20, 15, 10, 5);
        
        if (this.state === 'collecting') {
            ctx.fillStyle = '#facc15';
            ctx.font = '10px Outfit';
            ctx.fillText('COBRANDO...', -30, -30);
        }
        ctx.restore();
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
            
            // Move towards target
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;

            // Safe Zone Restriction: Don't enter radius 1000 (Parcels area)
            const distToCenter = Math.sqrt(this.x**2 + this.y**2);
            if (distToCenter < 1000) {
                const pushAngle = Math.atan2(this.y, this.x);
                this.x = Math.cos(pushAngle) * 1000;
                this.y = Math.sin(pushAngle) * 1000;
            }
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
