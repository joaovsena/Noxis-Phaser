import { MenuUI } from './ui/Menu.js';
import { Game } from './core/Game.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("MMO Inicializado");
    const menu = new MenuUI();
    const game = new Game(); // O jogo fica "ouvindo" em standby
});