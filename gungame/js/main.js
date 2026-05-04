import { Game } from './game.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);
window._game = game;

const overlay = document.getElementById('click-to-play');
const hud = document.getElementById('hud');

function showOverlay() {
  // Don't cover the in-base weapon picker or the end screen
  if (document.getElementById('weapon-picker').style.display === 'flex') return;
  if (document.getElementById('end-screen').style.display === 'flex') return;
  if (document.getElementById('main-menu').style.display !== 'none') return;
  overlay.style.display = 'flex';
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    overlay.style.display = 'none';
  } else {
    showOverlay();
  }
});

overlay.addEventListener('click', () => canvas.requestPointerLock?.());

const start = document.getElementById('btn-start');
start.addEventListener('click', () => {
  document.getElementById('main-menu').style.display = 'none';
  hud.style.display = 'block';
  const sel = document.querySelector('input[name="start-weapon"]:checked');
  game.player.setMain(parseInt(sel.value, 10));
  game.start();
  // Show the overlay; clicking it will request pointer lock from the user gesture.
  showOverlay();
});
