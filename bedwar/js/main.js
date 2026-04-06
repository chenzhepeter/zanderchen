import { Game } from './game.js';

// ==================== ENTRY POINT ====================
const game = new Game();
window._game = game;

// Main menu buttons
document.getElementById('btn-start').addEventListener('click', () => {
  document.getElementById('main-menu').style.display = 'none';

  // Initialize game
  game.init();

  // Show click to start
  const clickToStart = document.getElementById('click-to-start');
  clickToStart.style.display = 'flex';

  clickToStart.addEventListener('click', () => {
    clickToStart.style.display = 'none';
    game.player.requestPointerLock();
    game.start();
  });
});

// Controls overlay
document.getElementById('btn-controls').addEventListener('click', () => {
  document.getElementById('controls-overlay').style.display = 'flex';
});

document.getElementById('btn-back').addEventListener('click', () => {
  document.getElementById('controls-overlay').style.display = 'none';
});

// Prevent default browser behaviors
document.addEventListener('contextmenu', (e) => e.preventDefault());
