export class Player {
    constructor(id, name, isLocal = false) {
        this.id = id;
        this.name = name;
        this.isLocal = isLocal;
        
        this.x = 0;
        this.y = 150; // Start near the nexus but not inside
        this.radius = 25;
        this.color = isLocal ? '#4ade80' : '#f87171';
        
        this.speed = 300;
        this.velocity = { x: 0, y: 0 };
        
        this.inventory = {
            money: 100,
            crops: 0,
            seeds: 10
        };

        this.currentTool = 'hoe'; // 'hoe', 'plant', 'scythe'
        
        this.input = {
            up: false,
            down: false,
            left: false,
            right: false,
            interact: false
        };

        if (this.isLocal) {
            this.setupInput();
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
            case 'Digit1': this.currentTool = 'hoe'; break;
            case 'Digit2': this.currentTool = 'plant'; break;
            case 'Digit3': this.currentTool = 'scythe'; break;
        }
    }

    update(dt) {
        if (!this.isLocal) return;

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
    }

    draw(ctx) {
        // Shadow/Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;

        // Name tag
        ctx.fillStyle = 'white';
        ctx.font = '14px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y - this.radius - 10);
    }
}
