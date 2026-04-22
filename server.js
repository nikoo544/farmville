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

io.on('connection', (socket) => {
    console.log('Jugador conectado:', socket.id);

    // Initial player state
    players[socket.id] = {
        id: socket.id,
        x: (Math.random() - 0.5) * 500,
        y: (Math.random() - 0.5) * 500 + 200,
        name: 'Granjero_' + socket.id.substr(0, 4),
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
    };

    // Send current players to the new player
    socket.emit('currentPlayers', players);

    // Broadcast new player to others
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // Handle movement
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // Handle farm updates (e.g. planting)
    socket.on('farmUpdate', (data) => {
        socket.broadcast.emit('farmUpdated', data);
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
