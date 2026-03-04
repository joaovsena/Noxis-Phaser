import { Network } from './Network.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.network = new Network(this);
        this.players = {};
        this.localId = null;

        // MAPA
        this.tileSize = 64;
        this.mapCols = 100;
        this.mapRows = 100;
        this.mapWidth = this.mapCols * this.tileSize;
        this.mapHeight = this.mapRows * this.tileSize;

        this.grass = new Image();
        this.grass.src = '/assets/grass.png';

        this.camera = { x: 0, y: 0 };

        // MOB
        this.mobs = [
            {
                id: "mob1",
                x: 800,
                y: 800,
                size: 40,
                hp: 100,
                maxHp: 100,
                hovered: false,
                hitEffect: 0
            }
        ];

        setInterval(() => {
            this.moveMobsRandomly();
        }, 5000);

        this.setupEvents();
    }

    setupEvents() {

        window.addEventListener('gameStart', (e) => {
            const ui = document.getElementById('ui-container');
            if (ui) ui.style.display = 'none';

            this.canvas.style.display = 'block';
            this.resize();
            this.network.connect(e.detail);
            this.startLoop();
        });

        // HOVER
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + this.camera.x;
            const mouseY = e.clientY - rect.top + this.camera.y;

            for (let mob of this.mobs) {
                const half = mob.size / 2;

                mob.hovered =
                    mouseX >= mob.x - half &&
                    mouseX <= mob.x + half &&
                    mouseY >= mob.y - half &&
                    mouseY <= mob.y + half;
            }
        });

        // CLIQUE
        this.canvas.addEventListener('mousedown', (e) => {

            const rect = this.canvas.getBoundingClientRect();
            const mouseWorldX = e.clientX - rect.left + this.camera.x;
            const mouseWorldY = e.clientY - rect.top + this.camera.y;

            // VERIFICA SE CLICOU NO MOB
            for (let mob of this.mobs) {
                if (mob.hovered && mob.hp > 0) {
                    this.attackMob(mob);
                    return; // NÃO MOVE O PLAYER
                }
            }

            // Caso contrário, move normalmente
            if (!this.localId || !this.network.socket) return;

            this.network.socket.send(JSON.stringify({
                type: 'move',
                x: mouseWorldX,
                y: mouseWorldY
            }));
        });

        window.addEventListener('resize', () => this.resize());
    }

    attackMob(mob) {
        mob.hp -= 50;
        if (mob.hp < 0) mob.hp = 0;
        mob.hitEffect = 10; // 10 frames de flash
    }

    moveMobsRandomly() {
        for (let mob of this.mobs) {

            const steps = 2 + Math.floor(Math.random() * 2);

            for (let i = 0; i < steps; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 50;

                mob.x += Math.cos(angle) * distance;
                mob.y += Math.sin(angle) * distance;
            }

            mob.x = Math.max(0, Math.min(this.mapWidth, mob.x));
            mob.y = Math.max(0, Math.min(this.mapHeight, mob.y));
        }
    }

    setLocalPlayer(id, currentPlayers) {
        this.localId = id;
        this.players = currentPlayers;
    }

    addRemotePlayer(p) {
        this.players[p.id] = p;
    }

    removePlayer(id) {
        delete this.players[id];
    }

    updatePlayers(serverPlayers) {

        for (let id in this.players) {
            if (!serverPlayers[id]) {
                delete this.players[id];
            }
        }

        for (let id in serverPlayers) {
            if (this.players[id]) {
                this.players[id].x = serverPlayers[id].x;
                this.players[id].y = serverPlayers[id].y;
            } else {
                this.players[id] = serverPlayers[id];
            }
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    startLoop() {
        const loop = () => {
            this.draw();
            requestAnimationFrame(loop);
        };
        loop();
    }

    draw() {

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // CAMERA FOLLOW
        if (this.localId && this.players[this.localId]) {
            const player = this.players[this.localId];

            this.camera.x = player.x - this.canvas.width / 2;
            this.camera.y = player.y - this.canvas.height / 2;

            this.camera.x = Math.max(0, Math.min(this.camera.x, this.mapWidth - this.canvas.width));
            this.camera.y = Math.max(0, Math.min(this.camera.y, this.mapHeight - this.canvas.height));
        }

        // MAPA
        if (this.grass.complete) {
            for (let row = 0; row < this.mapRows; row++) {
                for (let col = 0; col < this.mapCols; col++) {

                    const worldX = col * this.tileSize;
                    const worldY = row * this.tileSize;

                    const screenX = worldX - this.camera.x;
                    const screenY = worldY - this.camera.y;

                    this.ctx.drawImage(
                        this.grass,
                        screenX,
                        screenY,
                        this.tileSize,
                        this.tileSize
                    );
                }
            }
        }

        // DESENHAR MOBS
        for (let mob of this.mobs) {

            const screenX = mob.x - this.camera.x;
            const screenY = mob.y - this.camera.y;
            const half = mob.size / 2;

            // Corpo
            this.ctx.fillStyle = "red";
            this.ctx.fillRect(screenX - half, screenY - half, mob.size, mob.size);

            // Outline hover
            if (mob.hovered) {
                this.ctx.strokeStyle = "yellow";
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = "yellow";
                this.ctx.shadowBlur = 10;
                this.ctx.strokeRect(screenX - half, screenY - half, mob.size, mob.size);
                this.ctx.shadowBlur = 0;
            }

            // Barra de vida
            const hpPercent = mob.hp / mob.maxHp;

            this.ctx.fillStyle = "black";
            this.ctx.fillRect(screenX - half, screenY - half - 10, mob.size, 6);

            this.ctx.fillStyle = "lime";
            this.ctx.fillRect(screenX - half, screenY - half - 10, mob.size * hpPercent, 6);

            // Efeito hit
            if (mob.hitEffect > 0) {
                this.ctx.globalAlpha = 0.5;
                this.ctx.fillStyle = "white";
                this.ctx.fillRect(screenX - half, screenY - half, mob.size, mob.size);
                this.ctx.globalAlpha = 1;
                mob.hitEffect--;
            }
        }

        // PLAYERS
        for (let id in this.players) {
            const p = this.players[id];
            const screenX = p.x - this.camera.x;
            const screenY = p.y - this.camera.y;

            this.ctx.fillStyle = p.class === 'knight' ? '#00a8ff' : '#4cd137';
            this.ctx.fillRect(screenX - 20, screenY - 20, 40, 40);

            this.ctx.fillStyle = "white";
            this.ctx.textAlign = "center";
            this.ctx.font = "bold 14px Arial";
            this.ctx.fillText(p.name, screenX, screenY - 30);
        }
    }
}