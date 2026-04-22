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
        
        // Appearance (Habbo style)
        this.appearance = {
            gender: 'male', // 'male', 'female'
            hairStyle: 0,
            hairColor: '#451a03',
            outfitColor: '#3b82f6',
            skinColor: '#fcd34d'
        };
        
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
            shoot: false
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

        // Name Tag
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = 'bold 14px Outfit';
        const nameWidth = ctx.measureText(this.name).width;
        ctx.fillRect(-nameWidth/2 - 5, -85, nameWidth + 10, 20);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, 0, -70);

        // Gesture/Emoji
        if (this.gesture) {
            ctx.font = '40px Outfit';
            ctx.fillText(this.gesture, 0, -110);
        }

        // --- DRAW BODY ---
        const isFemale = this.appearance.gender === 'female';
        
        // Feet/Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 10, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Torso/Clothes
        ctx.fillStyle = this.appearance.outfitColor;
        if (isFemale) {
            // Dress style
            ctx.beginPath();
            ctx.moveTo(-15, 10);
            ctx.lineTo(15, 10);
            ctx.lineTo(10, -20);
            ctx.lineTo(-10, -20);
            ctx.closePath();
            ctx.fill();
        } else {
            // Shirt style
            ctx.fillRect(-15, -20, 30, 30);
        }

        // Arms
        ctx.fillStyle = this.appearance.skinColor;
        ctx.fillRect(-22, -15, 8, 15);
        ctx.fillRect(14, -15, 8, 15);

        // Head
        ctx.fillStyle = this.appearance.skinColor;
        ctx.beginPath();
        ctx.arc(0, -35, 15, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(-5, -38, 2, 0, Math.PI * 2);
        ctx.arc(5, -38, 2, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = this.appearance.hairColor;
        const style = this.appearance.hairStyle;
        
        if (style === 0) { // Short
            ctx.beginPath();
            ctx.arc(0, -42, 16, Math.PI, 0);
            ctx.fill();
        } else if (style === 1) { // Long/Pigtails
            ctx.beginPath();
            ctx.arc(0, -42, 16, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(-18, -40, 8, 30);
            ctx.fillRect(10, -40, 8, 30);
        } else if (style === 2) { // Spiky/Cool
            ctx.beginPath();
            ctx.moveTo(-16, -40);
            ctx.lineTo(0, -60);
            ctx.lineTo(16, -40);
            ctx.fill();
        }

        ctx.restore();
    }
}
