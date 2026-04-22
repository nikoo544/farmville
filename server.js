import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static(__dirname));

// Game State
const players = {};
const worldState = {
    parcels: [], 
    vehicle: { id: 'tractor_main', x: 0, y: 300, angle: 0, driver: null },
    moto: { id: 'moto_main', x: 100, y: 300, angle: 0, driver: null },
    zombies: [],
    globalDonations: 0,
    communityCrops: { wheat: 0, carrot: 0, corn: 0 }
};

// Initialize worldState for 12 parcels (matching client count)
for (let i = 0; i < 12; i++) {
    worldState.parcels.push({
        ownerId: null,
        ownerName: null,
        tiles: Array(100).fill(null).map(() => ({ type: 'grass', growth: 0 })),
        machines: []
    });
}

io.on('connection', (socket) => {
    console.log('Jugador conectado:', socket.id);

    // Initial player state
    players[socket.id] = {
        id: socket.id,
        x: (Math.random() - 0.5) * 500,
        y: (Math.random() - 0.5) * 500 + 200,
        name: 'Granjero_' + socket.id.substr(0, 4),
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        currentTool: 'hoe'
    };

    // Send current players and world state to the new player
    socket.emit('currentPlayers', players);
    socket.emit('worldState', worldState);

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle movement
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].currentTool = movementData.currentTool;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Handle farm updates (e.g. planting)
    socket.on('farmUpdate', (data) => {
        const parcel = worldState.parcels[data.parcelIdx];
        if (parcel) {
            // Basic persistence logic
            if (!parcel.ownerId) {
                parcel.ownerId = data.playerId;
                parcel.ownerName = data.playerName;
            }
            
            const tileIdx = data.ty * 10 + data.tx;
            if (data.action === 'till') {
                parcel.tiles[tileIdx].type = 'tilled';
            } else if (data.action.startsWith('plant:')) {
                const cropType = data.action.split(':')[1];
                parcel.tiles[tileIdx].type = 'crop';
                parcel.tiles[tileIdx].crop = cropType;
                parcel.tiles[tileIdx].growth = 0;
            } else if (data.action === 'harvest') {
                parcel.tiles[tileIdx].type = 'tilled';
                parcel.tiles[tileIdx].growth = 0;
                parcel.tiles[tileIdx].crop = null;
            } else if (data.action === 'sprinkler') {
                parcel.machines.push({ x: data.tx, y: data.ty, type: 'sprinkler' });
            }

            socket.broadcast.emit('farmUpdated', data);
        }
    });

    // Handle Chat
    socket.on('chatMessage', (data) => {
        socket.broadcast.emit('chatMessage', data);
    });

    // Handle Vehicle
    socket.on('vehicleUpdate', (data) => {
        const v = data.id === 'moto_main' ? worldState.moto : worldState.vehicle;
        v.x = data.x;
        v.y = data.y;
        v.angle = data.angle;
        v.driver = data.driver;
        socket.broadcast.emit('vehicleMoved', data);
    });

    // Handle Shoot
    socket.on('shoot', (data) => {
        socket.broadcast.emit('shoot', data);
    });

    // Handle Donation
    socket.on('donate', (amount) => {
        worldState.globalDonations += amount;
        if (!players[socket.id].score) players[socket.id].score = 0;
        players[socket.id].score += amount;
        io.emit('donationsUpdated', worldState.globalDonations);
    });

    // Handle Gesture
    socket.on('gesture', (emoji) => {
        socket.broadcast.emit('playerGesture', { id: socket.id, emoji });
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Server Tick (Zombies and Growth)
setInterval(() => {
    // Spawn Zombies
    if (worldState.zombies.length < 15) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 2000;
        worldState.zombies.push({
            id: 'zombie_' + Date.now() + Math.random(),
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            health: 100
        });
    }

    // Move Zombies towards nearest player
    worldState.zombies.forEach(z => {
        let nearestDist = Infinity;
        let target = null;
        
        Object.values(players).forEach(p => {
            const d = Math.sqrt((p.x - z.x)**2 + (p.y - z.y)**2);
            if (d < nearestDist) {
                nearestDist = d;
                target = p;
            }
        });

        if (target) {
            const angle = Math.atan2(target.y - z.y, target.x - z.x);
            z.x += Math.cos(angle) * 3; // Server speed
            z.y += Math.sin(angle) * 3;
            
            // Safe zone check (1000 radius)
            const distToCenter = Math.sqrt(z.x**2 + z.y**2);
            if (distToCenter < 1000) {
                const pushAngle = Math.atan2(z.y, z.x);
                z.x = Math.cos(pushAngle) * 1000;
                z.y = Math.sin(pushAngle) * 1000;
            }
        }
    });

    io.emit('zombieUpdate', worldState.zombies);
    
    // Broadcast Ranking every 5 seconds
    const ranking = Object.values(players)
        .map(p => ({ name: p.name, score: p.score || 0 }))
        .sort((a, b) => b.score - a.score);
    io.emit('rankingUpdate', ranking);
}, 100);

// Drone Event (Every 60s)
setInterval(() => {
    io.emit('droneEvent', { x: 0, y: -2000 });
}, 60000);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`
🚀 AgriAuto corriendo en: http://localhost:${PORT}
--------------------------------------------------
1. Abre tu navegador en la URL de arriba.
2. Abre varias pestañas para probar el multijugador.
--------------------------------------------------
    `);
});
