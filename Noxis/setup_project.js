const fs = require('fs');
const path = require('path');

const folders = [
    'public/assets/sprites',
    'public/css',
    'public/js/entities',
    'public/js/core',
    'public/js/ui',
    'server'
];

const files = {
    // HTML PRINCIPAL
    'public/index.html': `
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Meu MMORPG Profissional</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div id="ui-container">
        <div id="char-creation" class="screen">
            <h1>Criação de Personagem</h1>
            <div class="setup-box">
                <div id="preview-box">
                    <div id="class-preview" class="preview-knight"></div>
                </div>
                <div class="controls">
                    <input type="text" id="char-name" placeholder="Nome do herói..." maxlength="12">
                    <select id="char-gender">
                        <option value="male">Masculino</option>
                        <option value="female">Feminino</option>
                    </select>
                    <select id="char-class">
                        <option value="knight">Cavaleiro (Azul)</option>
                        <option value="shifter">Metamorfo (Verde)</option>
                    </select>
                    <button id="btn-start">Iniciar Jornada</button>
                </div>
            </div>
        </div>
    </div>
    <canvas id="gameCanvas" style="display:none;"></canvas>
    <script type="module" src="js/main.js"></script>
</body>
</html>`,

    // CSS DE INTERFACE
    'public/css/style.css': `
body, html { margin: 0; padding: 0; background: #1a1a1a; color: white; font-family: sans-serif; overflow: hidden; }
#ui-container { position: absolute; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 10; }
.setup-box { background: #2a2a2a; padding: 30px; border: 2px solid #444; border-radius: 10px; display: flex; gap: 40px; }
#preview-box { width: 150px; height: 150px; background: #111; display: flex; align-items: center; justify-content: center; border: 2px solid #555; }
#class-preview { width: 60px; height: 60px; transition: 0.3s; }
.preview-knight { background: #00a8ff; box-shadow: 0 0 15px #00a8ff; }
.preview-shifter { background: #4cd137; box-shadow: 0 0 15px #4cd137; }
.controls { display: flex; flex-direction: column; gap: 15px; width: 200px; }
input, select, button { padding: 10px; border-radius: 5px; border: none; }
button { background: #e84118; color: white; font-weight: bold; cursor: pointer; }`,

    // JS MAIN (Ponto de entrada)
    'public/js/main.js': `
import { MenuUI } from './ui/Menu.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Jogo Inicializado");
    const menu = new MenuUI();
});`,

    // JS UI (Lógica do Menu)
    'public/js/ui/Menu.js': `
export class MenuUI {
    constructor() {
        this.screen = document.getElementById('char-creation');
        this.selectClass = document.getElementById('char-class');
        this.preview = document.getElementById('class-preview');
        this.btnStart = document.getElementById('btn-start');
        
        this.initEvents();
    }

    initEvents() {
        this.selectClass.addEventListener('change', (e) => {
            const val = e.target.value;
            this.preview.className = val === 'knight' ? 'preview-knight' : 'preview-shifter';
        });

        this.btnStart.addEventListener('click', () => {
            const name = document.getElementById('char-name').value;
            if(name.length < 3) return alert("Nome muito curto!");
            
            this.screen.style.display = 'none';
            document.getElementById('gameCanvas').style.display = 'block';
            console.log("Iniciando jogo com a classe:", this.selectClass.value);
        });
    }
}`,

    // SERVIDOR BASE
    'server/server.js': `
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, '../public')));

app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});`
};

// EXECUÇÃO
console.log("--- Criando Estrutura Profissional ---");

folders.forEach(f => {
    fs.mkdirSync(f, { recursive: true });
    console.log("Pasta criada:", f);
});

Object.entries(files).forEach(([name, content]) => {
    fs.writeFileSync(name, content.trim());
    console.log("Arquivo gerado:", name);
});

console.log("\\nSucesso! Agora mova seus sprites para public/assets/sprites/ e rode 'node server/server.js'");