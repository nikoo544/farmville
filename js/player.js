export class Player {
    constructor(id, name, isLocal = false) {
        this.id = id;
        this.name = name;
        this.isLocal = isLocal;
        
        this.x = 0;
        this.y = 150; // Start near the nexus but not inside
        this.radius = 25;
        this.color = isLocal ? '#4ade80' : '#f87171';
        this.gesture = null;
        
        // Appearance (D&D style)
        this.appearance = {
            gender: 'male', 
            class: 'warrior', // 'mage', 'warrior', 'fairy'
            hairStyle: 0,
            hairColor: '#451a03',
            outfitColor: '#3b82f6',
            skinColor: '#fcd34d'
        };

        this.isRabbit = false;
        this.skillCooldown = 0;
        this.mood = '';
        
        this.speed = 350;
        this.velocity = { x: 0, y: 0 };
        
        this.inventory = {
            money: 100,
            wheat: 0,
            carrot: 0,
            corn: 0,
            seeds: 10
        };

        this.currentTool = 'hoe'; // 'hoe', 'plant:wheat', 'weapon:pistol', etc
        this.inVehicle = false;
        this.isEntering = false;
        
        this.input = {
            up: false,
            down: false,
            left: false,
            right: false,
            interact: false,
            vehicle: false,
            shoot: false,
            skill: false
        };

        this.mousePos = { x: 0, y: 0 };
        this.shootTimer = 0;

        if (this.isLocal) {
            this.setupInput();
            window.addEventListener('mousedown', () => this.input.shoot = true);
            window.addEventListener('mouseup', () => this.input.shoot = false);
            window.addEventListener('mousemove', (e) => {
                this.mousePos.x = e.clientX;
                this.mousePos.y = e.clientY;
            });
        }
    }

    setupInput() {
        window.addEventListener('keydown', (e) => this.handleKey(e.code, true));
        window.addEventListener('keyup', (e) => this.handleKey(e.code, false));
    }

    handleKey(code, isDown) {
        switch (code) {
            case 'KeyW': case 'ArrowUp': this.input.up = isDown; break;
            case 'KeyS': case 'ArrowDown': this.input.down = isDown; break;
            case 'KeyA': case 'ArrowLeft': this.input.left = isDown; break;
            case 'KeyD': case 'ArrowRight': this.input.right = isDown; break;
            case 'KeyE': this.input.interact = isDown; break;
            case 'KeyV': this.input.vehicle = isDown; break;
            case 'KeyQ': this.input.skill = isDown; break;
            case 'Digit1': this.currentTool = 'hoe'; break;
            case 'Digit2': this.currentTool = 'plant:wheat'; break;
            case 'Digit3': this.currentTool = 'scythe'; break;
        }
    }

    update(dt) {
        if (!this.isLocal) {
            // Simple bot movement to make them feel alive
            if (Math.random() < 0.01) {
                this.targetDir = {
                    x: (Math.random() - 0.5),
                    y: (Math.random() - 0.5)
                };
            }
            if (this.targetDir) {
                this.x += this.targetDir.x * 50 * dt;
                this.y += this.targetDir.y * 50 * dt;
            }
            return;
        }

        let moveX = 0;
        let moveY = 0;

        if (this.input.up) moveY -= 1;
        if (this.input.down) moveY += 1;
        if (this.input.left) moveX -= 1;
        if (this.input.right) moveX += 1;

        // Normalize vector
        if (moveX !== 0 || moveY !== 0) {
            const length = Math.sqrt(moveX * moveX + moveY * moveY);
            moveX /= length;
            moveY /= length;
        }

        // Apply smooth acceleration/momentum (Agar.io style feel)
        const targetVelX = moveX * this.speed;
        const targetVelY = moveY * this.speed;

        this.velocity.x += (targetVelX - this.velocity.x) * 10 * dt;
        this.velocity.y += (targetVelY - this.velocity.y) * 10 * dt;

        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;

        // Combat
        this.shootTimer -= dt;
        if (this.input.shoot && this.shootTimer <= 0 && this.currentTool.startsWith('weapon:')) {
            this.shoot();
        }

        // Skill
        if (this.input.skill && this.skillCooldown <= 0) {
            this.useSkill();
        }
        if (this.skillCooldown > 0) this.skillCooldown -= dt;
    }

    useSkill() {
        this.skillCooldown = 3;
        const pClass = this.appearance.class;
        if (pClass === 'mage') {
            window.app.network.sendSkill('transform');
        } else if (pClass === 'fairy') {
            window.app.network.sendSkill('sparkle');
        } else if (pClass === 'warrior') {
            this.gesture = '🛡️ ¡RESISTID!';
            setTimeout(() => this.gesture = null, 3000);
            window.app.network.sendSkill('taunt');
        }
    }

    shoot() {
        const weaponType = this.currentTool.split(':')[1];
        const game = window.app.game; // Access game via window or app
        
        const rect = game.canvas.getBoundingClientRect();
        const worldMouseX = this.mousePos.x - rect.left + game.camera.x;
        const worldMouseY = this.mousePos.y - rect.top + game.camera.y;
        
        const angle = Math.atan2(worldMouseY - this.y, worldMouseX - this.x);
        
        // Notify network (which will also spawn locally)
        window.app.network.sendShoot(this.x, this.y, angle, weaponType);
        
        const cooldown = weaponType === 'bazooka' ? 1.5 : (weaponType === 'bow' ? 0.8 : 0.2);
        this.shootTimer = cooldown;
    }

    draw(ctx) {
        if (this.inVehicle) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Transformation check
        if (this.isRabbit) {
            this.drawRabbit(ctx);
            ctx.restore();
            return;
        }

        // --- DRAW BODY ---
        const isFemale = this.appearance.gender === 'female';
        const pClass = this.appearance.class;
        
        // Feet/Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 10, 25, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wings (Fairy only)
        if (pClass === 'fairy') {
            ctx.fillStyle = 'rgba(232, 121, 249, 0.4)';
            ctx.beginPath();
            ctx.ellipse(-20, -20, 30, 15, -Math.PI/4, 0, Math.PI * 2);
            ctx.ellipse(20, -20, 30, 15, Math.PI/4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Torso/Clothes
        ctx.fillStyle = pClass === 'warrior' ? '#94a3b8' : this.appearance.outfitColor;
        if (isFemale) {
            ctx.beginPath();
            ctx.moveTo(-18, 10); ctx.lineTo(18, 10); ctx.lineTo(12, -25); ctx.lineTo(-12, -25);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillRect(-18, -25, 36, 35);
        }

        // Head
        ctx.fillStyle = this.appearance.skinColor;
        ctx.beginPath();
        ctx.arc(0, -40, 18, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-6, -42, 2.5, 0, Math.PI * 2);
        ctx.arc(6, -42, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Class Specific Headgear
        if (pClass === 'mage') {
            ctx.fillStyle = '#312e81';
            ctx.beginPath();
            ctx.moveTo(-25, -50); ctx.lineTo(0, -90); ctx.lineTo(25, -50);
            ctx.closePath();
            ctx.fill();
        } else if (pClass === 'warrior') {
            ctx.fillStyle = '#475569';
            ctx.fillRect(-20, -60, 40, 15);
            ctx.fillStyle = '#f43f5e'; // Plume
            ctx.fillRect(-2, -75, 4, 15);
        }

        // Name Tag (Moved up for headgear)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = 'bold 14px Outfit';
        const nameWidth = ctx.measureText(this.name).width;
        ctx.fillRect(-nameWidth/2 - 5, -115, nameWidth + 10, 20);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, 0, -100);

        // Mood/Status
        if (this.mood) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = 'italic 12px Outfit';
            ctx.fillText(`"${this.mood}"`, 0, -82);
        }

        ctx.restore();
    }

    drawRabbit(ctx) {
        ctx.fillStyle = '#e5e7eb';
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, -5, 8, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.fillRect(8, -20, 3, 10);
        ctx.fillRect(12, -20, 3, 10);
        
        ctx.fillStyle = 'black';
        ctx.font = 'bold 12px Outfit';
        ctx.fillText(this.name, 0, -30);
    }
}
