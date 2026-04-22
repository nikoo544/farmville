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
    vehicle: { id: 'tractor_main', x: 0, y: 300, angle: 0, driver: null },
    moto: { id: 'moto_main', x: 100, y: 300, angle: 0, driver: null },
    globalDonations: 0
};

// No parcels to initialize

io.on('connection', (socket) => {
    console.log('Jugador conectado:', socket.id);

    // Initial player state
    players[socket.id] = {
        id: socket.id,
        x: (Math.random() - 0.5) * 500,
        y: (Math.random() - 0.5) * 500,
        name: 'Nuevo Jugador',
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
        currentTool: 'hoe',
        appearance: { gender: 'male', class: 'warrior', hairStyle: 0, outfitColor: '#3b82f6' },
        isRabbit: false
    };

    // Send current players and world state to the new player
    socket.emit('currentPlayers', players);
    socket.emit('worldState', worldState);

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle movement
    socket.on('playerMovement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].currentTool = data.currentTool;
            players[socket.id].name = data.name;
            players[socket.id].appearance = data.appearance;
            players[socket.id].isRabbit = data.isRabbit;
            
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Social events only

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

    // Handle Skill
    socket.on('skill', (data) => {
        const p = players[socket.id];
        if (!p) return;

        if (data.type === 'transform') {
            // Server-side transformation logic
            Object.values(players).forEach(other => {
                if (other.id !== p.id) {
                    const dist = Math.sqrt((p.x - other.x)**2 + (p.y - other.y)**2);
                    if (dist < 250) {
                        other.isRabbit = true;
                        io.emit('playerTransformed', { id: other.id, status: true });
                        setTimeout(() => {
                            if (players[other.id]) {
                                players[other.id].isRabbit = false;
                                io.emit('playerTransformed', { id: other.id, status: false });
                            }
                        }, 10000);
                    }
                }
            });
        }
        
        socket.broadcast.emit('skillEffect', { id: socket.id, type: data.type });
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Server Tick (Social Sync)
setInterval(() => {
    // Broadcast Ranking every 5 seconds
    const ranking = Object.values(players)
        .map(p => ({ name: p.name, score: p.score || 0 }))
        .sort((a, b) => b.score - a.score);
    io.emit('rankingUpdate', ranking);
}, 5000);

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
