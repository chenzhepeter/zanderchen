import { TEAM_RED, SHOP_CATEGORIES, RECIPES, ITEMS } from './constants.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.notificationTimer = 0;
    this.lastHotbarState = '';

    // Cache DOM elements
    this.elements = {
      hud: document.getElementById('hud'),
      hpBar: document.getElementById('hp-bar'),
      hungerBar: document.getElementById('hunger-bar'),
      armorBar: document.getElementById('armor-bar'),
      hotbar: document.getElementById('hotbar'),
      currency: document.getElementById('currency-display'),
      handItem: document.getElementById('hand-item'),
      teamLeft: document.getElementById('team-panel-left'),
      teamRight: document.getElementById('team-panel-right'),
      timer: document.getElementById('game-timer'),
      notification: document.getElementById('notification'),
      phaseBanner: document.getElementById('phase-banner'),
      shopOverlay: document.getElementById('shop-overlay'),
      shopPanel: document.getElementById('shop-panel'),
      shopTitle: document.getElementById('shop-title'),
      shopTabs: document.getElementById('shop-tabs'),
      shopItems: document.getElementById('shop-items'),
      shopClose: document.getElementById('shop-close'),
      commandMenu: document.getElementById('command-menu'),
      deathScreen: document.getElementById('death-screen'),
      respawnTimer: document.getElementById('respawn-timer'),
      deathMsg: document.getElementById('death-msg'),
      gameoverScreen: document.getElementById('gameover-screen'),
      gameoverTitle: document.getElementById('gameover-title'),
      gameoverMsg: document.getElementById('gameover-msg'),
      mainMenu: document.getElementById('main-menu'),
      clickToStart: document.getElementById('click-to-start'),
      inventoryOverlay: document.getElementById('inventory-overlay'),
      invGrid: document.getElementById('inv-grid'),
      invClose: document.getElementById('inv-close'),
      craftingOverlay: document.getElementById('crafting-overlay'),
      craftItems: document.getElementById('craft-items'),
      craftClose: document.getElementById('craft-close'),
    };

    this._initShopUI();
    this._initCommandUI();
    this._initInventoryUI();
    this._initCraftingUI();
  }

  show() { this.elements.hud.style.display = 'block'; }
  hide() { this.elements.hud.style.display = 'none'; }

  update(dt) {
    const player = this.game.player;

    // HP bar
    this._updateBar(this.elements.hpBar, player.hp, player.maxHp, 'heart', '❤');

    // Hunger bar
    this._updateBar(this.elements.hungerBar, player.hunger, player.maxHunger, 'hunger', '🍖');

    // Armor bar
    this._updateBar(this.elements.armorBar, player.armor, 10, 'armor-icon', '🛡️');

    // Hotbar
    this._updateHotbar(player);

    // Currency
    this._updateCurrency(player);

    // Hand item with swing animation
    const sel = player.getSelectedItem();
    this.elements.handItem.textContent = sel ? sel.item.icon : '✋';
    if (player.swingTimer > 0) {
      const swing = Math.sin(player.swingTimer * 10) * 30;
      this.elements.handItem.style.transform = `rotate(${-15 + swing}deg) translateY(${-swing * 0.5}px)`;
    } else {
      this.elements.handItem.style.transform = 'rotate(-15deg)';
    }

    // Team panels
    this._updateTeamPanels();

    // Timer
    const time = Math.floor(this.game.gameTime);
    const min = Math.floor(time / 60).toString().padStart(2, '0');
    const sec = (time % 60).toString().padStart(2, '0');
    this.elements.timer.textContent = `${min}:${sec}`;

    // Death screen
    if (!player.alive && !player.eliminated) {
      this.elements.deathScreen.style.display = 'flex';
      this.elements.respawnTimer.textContent = Math.ceil(player.respawnTimer);
      const bedAlive = player.team === TEAM_RED ? this.game.world.redBedAlive : this.game.world.blueBedAlive;
      this.elements.deathMsg.textContent = bedAlive ? '复活中...' : '你已被永久淘汰!';
    } else {
      this.elements.deathScreen.style.display = 'none';
    }

    // Phase banner
    if (this.game.phase === 'prep') {
      this.elements.phaseBanner.style.display = 'block';
      const remaining = Math.ceil(this.game.prepTimer);
      this.elements.phaseBanner.textContent = `准备阶段 - ${remaining} 秒`;
    } else {
      this.elements.phaseBanner.style.display = 'none';
    }

    // Notification fade
    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) {
        this.elements.notification.classList.remove('show');
      }
    }
  }

  _updateBar(el, value, max, className, symbol) {
    const count = Math.ceil(max / 2);
    let html = '';
    for (let i = 0; i < count; i++) {
      const val = value - i * 2;
      if (val >= 2) {
        html += `<span class="${className}">${symbol}</span>`;
      } else if (val >= 1) {
        html += `<span class="${className}" style="opacity:0.6">${symbol}</span>`;
      } else {
        html += `<span class="${className} empty">${symbol}</span>`;
      }
    }
    el.innerHTML = html;
  }

  _updateHotbar(player) {
    // Only rebuild if changed
    let state = player.selectedSlot + '|';
    for (let i = 0; i < 5; i++) {
      const slot = player.inventory[i];
      state += slot ? `${slot.item.id}:${slot.count}` : 'empty';
      state += '|';
    }

    if (state === this.lastHotbarState) return;
    this.lastHotbarState = state;

    let html = '';
    for (let i = 0; i < 5; i++) {
      const slot = player.inventory[i];
      const selected = i === player.selectedSlot ? ' selected' : '';
      const icon = slot ? slot.item.icon : '';
      const count = slot && slot.count > 1 ? `<span class="slot-count">${slot.count}</span>` : '';
      html += `<div class="hotbar-slot${selected}"><span class="slot-key">${i + 1}</span>${icon}${count}</div>`;
    }
    this.elements.hotbar.innerHTML = html;
  }

  _updateCurrency(player) {
    this.elements.currency.innerHTML =
      `🪙 ${player.currency.copper} &nbsp; ⬜ ${player.currency.iron} &nbsp; 💎 ${player.currency.diamond} &nbsp; 🥇 ${player.currency.gold}`;
  }

  _updateTeamPanels() {
    const player = this.game.player;
    const redTeam = this.game.getTeamMembers(TEAM_RED);
    const blueTeam = this.game.getTeamMembers('blue');

    // Left panel (player's team = red)
    let leftHtml = '<div style="font-weight:bold;margin-bottom:4px;">🔴 红队</div>';
    // Add player
    leftHtml += this._memberHtml('你', player.hp, player.maxHp, player.alive, player.eliminated);
    for (const m of redTeam) {
      leftHtml += this._memberHtml(m.name, m.hp, m.maxHp, m.alive, m.eliminated);
    }
    const redBedIcon = this.game.world.redBedAlive ? '🛏️ 床:完好' : '🛏️ 床:已毁';
    leftHtml += `<div style="margin-top:4px;font-size:12px;color:${this.game.world.redBedAlive ? '#5f5' : '#f55'}">${redBedIcon}</div>`;
    this.elements.teamLeft.innerHTML = leftHtml;

    // Right panel (blue team)
    let rightHtml = '<div style="font-weight:bold;margin-bottom:4px;">🔵 蓝队</div>';
    for (const m of blueTeam) {
      rightHtml += this._memberHtml(m.name, m.hp, m.maxHp, m.alive, m.eliminated);
    }
    const blueBedIcon = this.game.world.blueBedAlive ? '🛏️ 床:完好' : '🛏️ 床:已毁';
    rightHtml += `<div style="margin-top:4px;font-size:12px;color:${this.game.world.blueBedAlive ? '#5f5' : '#f55'}">${blueBedIcon}</div>`;
    this.elements.teamRight.innerHTML = rightHtml;
  }

  _memberHtml(name, hp, maxHp, alive, eliminated) {
    if (eliminated) {
      return `<div class="team-member dead">💀 ${name} (已淘汰)</div>`;
    }
    if (!alive) {
      return `<div class="team-member dead">💤 ${name} (复活中)</div>`;
    }
    const hearts = Math.ceil(hp / 2);
    const heartStr = '❤'.repeat(Math.min(hearts, 5));
    return `<div class="team-member">● ${name} <span class="hearts">${heartStr}</span></div>`;
  }

  showNotification(text, duration = 3) {
    this.elements.notification.textContent = text;
    this.elements.notification.classList.add('show');
    this.notificationTimer = duration;
  }

  showBedDestroyed(team) {
    const el = document.createElement('div');
    el.className = 'bed-destroyed-alert';
    el.textContent = team === TEAM_RED ? '🛏️ 红队的床被摧毁了!' : '🛏️ 蓝队的床被摧毁了!';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  // ==================== SHOP ====================
  _initShopUI() {
    this.currentShopTab = 'weapons';

    this.elements.shopClose.onclick = () => this.closeShop();

    // Build tabs
    this._buildShopTabs();
    this._buildShopItems();
  }

  _buildShopTabs() {
    let html = '';
    for (const [key, cat] of Object.entries(SHOP_CATEGORIES)) {
      const active = key === this.currentShopTab ? ' active' : '';
      html += `<div class="shop-tab${active}" data-tab="${key}">${cat.name}</div>`;
    }
    this.elements.shopTabs.innerHTML = html;

    this.elements.shopTabs.querySelectorAll('.shop-tab').forEach(tab => {
      tab.onclick = () => {
        this.currentShopTab = tab.dataset.tab;
        this._buildShopTabs();
        this._buildShopItems();
      };
    });
  }

  _buildShopItems() {
    const cat = SHOP_CATEGORIES[this.currentShopTab];
    if (!cat) return;

    const player = this.game.player;
    let html = '';

    for (const shopItem of cat.items) {
      const canAfford = this._canAfford(shopItem.price, player);
      const affordClass = canAfford ? '' : ' cant-afford';
      const priceStr = this._priceString(shopItem.price);
      const qtyStr = shopItem.qty ? ` ×${shopItem.qty}` : '';

      html += `<div class="shop-item${affordClass}" data-item="${shopItem.item.id}">
        <div class="item-icon">${shopItem.item.icon}</div>
        <div class="item-info">
          <div class="item-name">${shopItem.item.name}${qtyStr}</div>
          <div class="item-desc">${shopItem.desc}</div>
        </div>
        <div class="item-price">${priceStr}</div>
      </div>`;
    }

    this.elements.shopItems.innerHTML = html;

    // Click handlers
    this.elements.shopItems.querySelectorAll('.shop-item').forEach(el => {
      el.onclick = () => {
        const itemId = el.dataset.item;
        this._buyItem(itemId);
      };
    });
  }

  _canAfford(price, player) {
    for (const [currency, amount] of Object.entries(price)) {
      if ((player.currency[currency] || 0) < amount) return false;
    }
    return true;
  }

  _priceString(price) {
    const icons = { copper: '🪙', iron: '⬜', diamond: '💎', gold: '🥇' };
    return Object.entries(price).map(([k, v]) => `${icons[k]}${v}`).join(' ');
  }

  _buyItem(itemId) {
    const cat = SHOP_CATEGORIES[this.currentShopTab];
    const shopItem = cat.items.find(i => i.item.id === itemId);
    if (!shopItem) return;

    const player = this.game.player;
    if (!this._canAfford(shopItem.price, player)) {
      this.showNotification('资源不足!');
      return;
    }

    // Deduct price
    for (const [currency, amount] of Object.entries(shopItem.price)) {
      player.currency[currency] -= amount;
    }

    // Give item
    const qty = shopItem.qty || 1;
    player.addItem(shopItem.item, qty);
    this.showNotification(`购买了 ${shopItem.item.name}${qty > 1 ? ' ×' + qty : ''}`);

    // Refresh
    this._buildShopItems();
  }

  openShop() {
    this.elements.shopOverlay.classList.add('active');
    this._buildShopTabs();
    this._buildShopItems();
    try { document.exitPointerLock(); } catch(e) {}
  }

  closeShop() {
    this.elements.shopOverlay.classList.remove('active');
  }

  isShopOpen() {
    return this.elements.shopOverlay.classList.contains('active');
  }

  // ==================== COMMAND MENU ====================
  _initCommandUI() {
    document.querySelectorAll('.cmd-btn[data-cmd]').forEach(btn => {
      btn.onclick = () => {
        const cmd = btn.dataset.cmd;
        this.game.setTeamCommand(cmd);
        this.closeCommandMenu();
      };
    });

    document.getElementById('cmd-cancel').onclick = () => this.closeCommandMenu();
  }

  openCommandMenu() {
    this.elements.commandMenu.classList.add('active');
    try { document.exitPointerLock(); } catch(e) {}
  }

  closeCommandMenu() {
    this.elements.commandMenu.classList.remove('active');
  }

  isCommandMenuOpen() {
    return this.elements.commandMenu.classList.contains('active');
  }

  // ==================== INVENTORY ====================
  _initInventoryUI() {
    this.elements.invClose.onclick = () => this.closeInventory();
  }

  openInventory() {
    this.elements.inventoryOverlay.classList.add('active');
    this._buildInventoryGrid();
    try { document.exitPointerLock(); } catch(e) {}
  }

  closeInventory() {
    this.elements.inventoryOverlay.classList.remove('active');
  }

  isInventoryOpen() {
    return this.elements.inventoryOverlay.classList.contains('active');
  }

  _buildInventoryGrid() {
    const player = this.game.player;
    let html = '';
    for (let i = 0; i < 20; i++) {
      const slot = player.inventory[i];
      const icon = slot ? slot.item.icon : '';
      const count = slot && slot.count > 1 ? `<span class="inv-count">${slot.count}</span>` : '';
      const name = slot ? `<span class="inv-name">${slot.item.name}</span>` : '';
      html += `<div class="inv-slot" data-slot="${i}">${icon}${count}${name}</div>`;
    }
    this.elements.invGrid.innerHTML = html;

    // Click to move to hotbar
    this.elements.invGrid.querySelectorAll('.inv-slot').forEach(el => {
      el.onclick = () => {
        const slotIdx = parseInt(el.dataset.slot);
        if (slotIdx >= 5 && player.inventory[slotIdx]) {
          // Find empty hotbar slot or swap with selected
          const target = player.selectedSlot;
          const temp = player.inventory[target];
          player.inventory[target] = player.inventory[slotIdx];
          player.inventory[slotIdx] = temp;
          this._buildInventoryGrid();
        }
      };
    });
  }

  // ==================== CRAFTING ====================
  _initCraftingUI() {
    this.elements.craftClose.onclick = () => this.closeCrafting();
  }

  openCrafting() {
    this.elements.craftingOverlay.classList.add('active');
    this._buildCraftingList();
    try { document.exitPointerLock(); } catch(e) {}
  }

  closeCrafting() {
    this.elements.craftingOverlay.classList.remove('active');
  }

  isCraftingOpen() {
    return this.elements.craftingOverlay.classList.contains('active');
  }

  _buildCraftingList() {
    const player = this.game.player;
    let html = '';

    for (const recipe of RECIPES) {
      const canCraft = this._canCraft(recipe, player);
      const cls = canCraft ? '' : ' cant-craft';
      const matsStr = Object.entries(recipe.materials)
        .map(([id, qty]) => {
          const item = Object.values(ITEMS).find(i => i.id === id);
          return `${item ? item.icon : id} ×${qty}`;
        }).join(' + ');

      html += `<div class="craft-item${cls}" data-recipe="${recipe.result.id}">
        <div class="item-icon">${recipe.result.icon}</div>
        <div class="item-info">
          <div class="item-name">${recipe.result.name}${recipe.qty > 1 ? ' ×' + recipe.qty : ''}</div>
          <div class="item-materials">需要: ${matsStr}</div>
        </div>
      </div>`;
    }

    this.elements.craftItems.innerHTML = html;

    this.elements.craftItems.querySelectorAll('.craft-item').forEach(el => {
      el.onclick = () => {
        const recipeId = el.dataset.recipe;
        this._craftItem(recipeId);
      };
    });
  }

  _canCraft(recipe, player) {
    for (const [matId, qty] of Object.entries(recipe.materials)) {
      if (player.countItem(matId) < qty) return false;
    }
    return true;
  }

  _craftItem(recipeId) {
    const recipe = RECIPES.find(r => r.result.id === recipeId);
    if (!recipe) return;

    const player = this.game.player;
    if (!this._canCraft(recipe, player)) {
      this.showNotification('材料不足!');
      return;
    }

    // Remove materials
    for (const [matId, qty] of Object.entries(recipe.materials)) {
      player.removeItem(matId, qty);
    }

    // Give result
    player.addItem(recipe.result, recipe.qty || 1);
    this.showNotification(`合成了 ${recipe.result.name}`);
    this._buildCraftingList();
  }

  // ==================== GAME OVER ====================
  showGameOver(won) {
    this.elements.gameoverScreen.style.display = 'flex';
    this.elements.gameoverScreen.className = won ? 'win' : 'lose';
    this.elements.gameoverTitle.textContent = won ? '🏆 胜利!' : '💀 失败!';
    this.elements.gameoverMsg.textContent = won
      ? '你的队伍摧毁了敌方并赢得了比赛!'
      : '你的队伍被敌方消灭了...';

    document.getElementById('btn-restart').onclick = () => {
      location.reload();
    };
  }

  // ==================== MAIN MENU ====================
  showMainMenu() {
    this.elements.mainMenu.style.display = 'flex';
  }

  hideMainMenu() {
    this.elements.mainMenu.style.display = 'none';
  }

  showClickToStart() {
    this.elements.clickToStart.style.display = 'flex';
  }

  hideClickToStart() {
    this.elements.clickToStart.style.display = 'none';
  }
}
