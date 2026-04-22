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
    parcels: [], // Array of parcel states
    vehicle: { x: 0, y: 300, angle: 0, driver: null }
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
        worldState.vehicle.x = data.x;
        worldState.vehicle.y = data.y;
        worldState.vehicle.angle = data.angle;
        worldState.vehicle.driver = data.driver;
        socket.broadcast.emit('vehicleMoved', data);
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

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
