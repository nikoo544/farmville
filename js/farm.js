export class FarmSystem {
    constructor(game) {
        this.game = game;
        this.parcels = [];
        this.parcelSize = 10; // 10x10 tiles
        this.tileSize = 64;
        
        // Generate some initial parcels around the nexus
        this.generateParcels();
    }

    generateParcels() {
        // Simple ring of parcels
        const radius = 500;
        const count = 8;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            
            this.parcels.push(new Parcel(px, py, this.parcelSize, this.tileSize));
        }
    }

    update(dt) {
        this.parcels.forEach(p => p.update(dt));
    }

    draw(ctx) {
        this.parcels.forEach(p => p.draw(ctx));
    }

    getParcelAt(x, y) {
        return this.parcels.find(p => p.contains(x, y));
    }
}

class Parcel {
    constructor(x, y, size, tileSize) {
        this.x = x - (size * tileSize) / 2;
        this.y = y - (size * tileSize) / 2;
        this.size = size;
        this.tileSize = tileSize;
        this.owner = null;
        this.width = size * tileSize;
        this.height = size * tileSize;
        
        this.tiles = Array(size * size).fill(null).map(() => ({
            type: 'grass',
            growth: 0,
            crop: null,
            watered: false
        }));

        this.machines = []; // { x, y, type }
    }

    contains(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }

    update(dt) {
        // Machines logic
        this.machines.forEach(m => {
            if (m.type === 'sprinkler') {
                // Water adjacent tiles
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const tx = m.x + dx;
                        const ty = m.y + dy;
                        if (tx >= 0 && tx < this.size && ty >= 0 && ty < this.size) {
                            this.tiles[ty * this.size + tx].watered = true;
                        }
                    }
                }
            }
        });

        // Growth logic
        this.tiles.forEach(tile => {
            if (tile.type === 'crop' && tile.growth < 100) {
                const speed = tile.watered ? 5 : 2;
                tile.growth += speed * dt;
                if (tile.growth >= 100) tile.growth = 100;
            }
            // Reset watered status for next frame machine check
            // Actually, machines run every frame, so this is fine
        });
    }

    draw(ctx) {
        // Draw border
        ctx.strokeStyle = this.owner ? 'rgba(74, 222, 128, 0.5)' : 'rgba(255, 255, 255, 0.2)';
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(this.owner ? `Granja de ${this.owner}` : 'Parcela Disponible', this.x + this.width / 2, this.y - 10);

        // Draw tiles
        for (let i = 0; i < this.tiles.length; i++) {
            const tx = i % this.size;
            const ty = Math.floor(i / this.size);
            const tile = this.tiles[i];
            const x = this.x + tx * this.tileSize;
            const y = this.y + ty * this.tileSize;

            if (tile.type === 'tilled') {
                ctx.fillStyle = '#451a03'; // Dark brown
                ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
            } else if (tile.type === 'crop') {
                ctx.fillStyle = '#451a03';
                ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
                
                // Draw crop
                const cropSize = (tile.growth / 100) * (this.tileSize * 0.6);
                ctx.fillStyle = tile.growth >= 100 ? '#fbbf24' : '#4ade80';
                if (tile.watered) ctx.strokeStyle = '#60a5fa';
                if (tile.watered) ctx.lineWidth = 2;
                
                ctx.beginPath();
                ctx.arc(x + this.tileSize / 2, y + this.tileSize / 2, cropSize / 2, 0, Math.PI * 2);
                ctx.fill();
                if (tile.watered) ctx.stroke();
            }
        }

        // Draw Machines
        this.machines.forEach(m => {
            const mx = this.x + m.x * this.tileSize;
            const my = this.y + m.y * this.tileSize;
            
            if (m.type === 'sprinkler') {
                ctx.fillStyle = '#60a5fa';
                ctx.beginPath();
                ctx.arc(mx + this.tileSize / 2, my + this.tileSize / 2, 10, 0, Math.PI * 2);
                ctx.fill();
                
                // Animation pulse
                const pulse = (Math.sin(Date.now() / 200) + 1) * 5;
                ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
                ctx.beginPath();
                ctx.arc(mx + this.tileSize / 2, my + this.tileSize / 2, 20 + pulse, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }

    interact(tx, ty, action, player) {
        if (this.owner && this.owner !== player.name) return;
        if (!this.owner) this.owner = player.name;

        const idx = ty * this.size + tx;
        const tile = this.tiles[idx];

        if (action === 'till' && tile.type === 'grass') {
            tile.type = 'tilled';
        } else if (action === 'plant' && tile.type === 'tilled') {
            tile.type = 'crop';
            tile.growth = 0;
            tile.crop = 'wheat';
        } else if (action === 'harvest' && tile.type === 'crop' && tile.growth >= 100) {
            tile.type = 'tilled';
            tile.growth = 0;
            return true; // Harvested
        } else if (action === 'sprinkler') {
            this.machines.push({ x: tx, y: ty, type: 'sprinkler' });
            return true;
        }
        return false;
    }
}
