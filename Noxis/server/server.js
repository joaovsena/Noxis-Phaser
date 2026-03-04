const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, '../public')));

const players = {};

wss.on('connection', (ws) => {
    console.log('Cliente conectou ao WebSocket');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            if (message.type === 'join') {
                const id = Math.random().toString(36).substr(2, 9);
                players[id] = {
                    id: id,
                    name: message.name,
                    class: message.class,
                    x: 400, y: 300,
                    targetX: 400, targetY: 300
                };
                ws.playerId = id; // VINCULA O ID AO SOCKET
                ws.send(JSON.stringify({ type: 'welcome', id, players }));
                broadcast({ type: 'new_player', player: players[id] });
                console.log(`Jogador ${message.name} entrou com ID: ${id}`);
            }

            if (message.type === 'move') {
                const p = players[ws.playerId];
                if (p) {
                    p.targetX = message.x;
                    p.targetY = message.y;
                    console.log(`Movendo ${p.name} para: ${p.targetX}, ${p.targetY}`);
                } else {
                    console.log("Comando de movimento ignorado: Jogador não identificado no servidor.");
                }
            }
        } catch (e) { console.error("Erro no processamento:", e); }
    });

    ws.on('close', () => {
        if (ws.playerId) {
            delete players[ws.playerId];
            broadcast({ type: 'player_leave', id: ws.playerId });
        }
    });
});

// FÍSICA
setInterval(() => {
    for (let id in players) {
        const p = players[id];
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 2) {
            const speed = 5;
            p.x += (dx / dist) * speed;
            p.y += (dy / dist) * speed;
        }
    }
    if (Object.keys(players).length > 0) broadcast({ type: 'state', players });
}, 1000 / 60);

function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

server.listen(3000, () => console.log("Servidor rodando na porta 3000"));