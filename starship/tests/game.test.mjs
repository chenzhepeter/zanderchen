import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFENDERS, BUGS, SIDES, STORAGE_KEY, LEGACY_STORAGE_KEY, SAVE_VERSION, STARTING_CREDITS, STARTING_BOMBS, RECOMMENDED_COST, DEFAULT_SPEED, PREVIOUS_STORAGE_KEY } from '../js/data/config.js';
import { PROTOTYPE, ROUNDS, roundTotal, spawnPlan } from '../js/data/rounds.js';
import { newCampaign, startRound, nextRound, update, settleRound, togglePause } from '../js/game.js';
import { buy, undo, autoDeploy, relocate, repairWall, repairCore, repairDefender, sell, upgradeDefender } from '../js/economy.js';
import { snapshot, restoreCheckpoint, saveGame, loadGame } from '../js/state.js';
import { spawnEnemy, updateEnemies, breakWall } from '../js/enemies.js';
import { legalTarget, hurtEnemy, updateCombat, updateTroops, throwBomb } from '../js/combat.js';
import { isInside, wallSegments, SLOT_BY_ID, ROCKS, SLOTS } from '../js/battlefield.js';
import { prepareDefense, supportDefense } from './campaign-strategy.mjs';
import { crosses, coreBlocks } from '../js/geometry.js';

const step = (s, seconds) => { for (let i = 0; i < seconds * 60 && s.phase === 'combat'; i++) update(s, 1 / 60); };
function bug(s, type, x, y, side = 'north') { spawnEnemy(s, { side, lane: 0, type }); const e = s.enemies.at(-1); Object.assign(e, { x, y, target: {x,y}, route: [], vx: 0, vy: 0 }); return e; }
function mockStorage() { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) }; }

test('wave plans preserve every scheduled enemy and allow future campaign lengths', () => {
  assert.deepEqual(ROUNDS.map(roundTotal), [60,88,116,146,180,186,232,228,292,336]);
  assert.equal(ROUNDS.reduce((sum, r) => sum + spawnPlan(r).length, 0), 1864);
  for (const r of ROUNDS) { const plan = spawnPlan(r); assert.ok(plan.every((e, i) => !i || e.at >= plan[i - 1].at)); assert.deepEqual([...new Set(plan.map(e => e.side))].sort(), [...SIDES].sort()); }
  assert.equal(PROTOTYPE.rounds, ROUNDS);
});

test('invalid purchases never deduct currency or change the board', () => {
  const s = newCampaign(), before = snapshot(s);
  assert.equal(buy(s, 'cannon', 'north-heavy-0').ok, false);
  assert.equal(buy(s, 'infantry', 'north-heavy-0').ok, false);
  assert.equal(buy(s, 'not-a-unit', 'air-0').ok, false);
  assert.deepEqual(snapshot(s), before);
  buy(s, 'infantry', 'north-infantry-0'); const credits = s.credits;
  assert.equal(buy(s, 'infantry', 'north-infantry-0').ok, false); assert.equal(s.credits, credits);
  s.phase = 'combat'; assert.equal(buy(s, 'mine', 'north-mine-0').ok, false); assert.equal(s.credits, credits);
});

test('recommended deployment is affordable and undone as one transaction', () => {
  const s = newCampaign(), before = snapshot(s);
  assert.ok(autoDeploy(s).ok); assert.equal(s.credits, STARTING_CREDITS - RECOMMENDED_COST); assert.equal(s.defenders.length, 10); assert.equal(s.bombs, STARTING_BOMBS);
  assert.ok(undo(s).ok); assert.deepEqual(snapshot(s), before);
});

test('failed balance check and locked walls do not create entities', () => {
  const s = newCampaign(); s.credits = 10;
  assert.equal(buy(s, 'infantry', 'north-infantry-0').ok, false); assert.equal(s.defenders.length, 0);
  s.credits = STARTING_CREDITS; s.walls.north.hp = 0;
  assert.equal(buy(s, 'infantry', 'north-infantry-0').ok, false);
  assert.ok(buy(s, 'bomb').ok); assert.ok(buy(s, 'infantry', 'reserve-0').ok);
});

test('repairs cap health, consume resources, and undo restores the original damage', () => {
  const s = newCampaign(); s.walls.north.hp = 850;
  assert.ok(repairWall(s, 'north').ok); assert.equal(s.walls.north.hp, 900); assert.equal(s.credits, STARTING_CREDITS - 20);
  assert.ok(undo(s).ok); assert.equal(s.walls.north.hp, 850); assert.equal(s.credits, STARTING_CREDITS);
  s.walls.north.hp = 0; s.walls.north.broken = true;
  assert.ok(repairWall(s, 'north').ok); assert.equal(s.walls.north.hp, 600); assert.equal(s.walls.north.broken, false);
  breakWall(s, 'north'); assert.equal(s.walls.north.hp, 0); assert.equal(s.stats.wallsBroken, 1);
  s.core.hp = 1100; assert.ok(repairCore(s).ok); assert.equal(s.core.hp, 1300); assert.equal(repairCore(s).ok, false);
});

test('unit repair and salvage distinguish unused from veteran equipment', () => {
  const s = newCampaign(); const result = buy(s, 'infantry', 'north-infantry-0'); const u = s.defenders[0];
  u.hp = 130; assert.ok(repairDefender(s, u.id).ok); assert.equal(u.hp, 240); assert.equal(s.credits, STARTING_CREDITS - 88);
  assert.equal(sell(s, u.id).refund, 70); assert.ok(undo(s).ok);
  s.defenders[0].veteran = true; assert.equal(sell(s, result.id).refund, 28);
});

test('air/ground, range, firing arcs and core occlusion are real targeting constraints', () => {
  const s = newCampaign(); s.roundIndex = 2; s.credits = 2000;
  buy(s, 'cannon', 'north-cannon-0'); buy(s, 'sam', 'air-0'); buy(s, 'machinegun', 'south-heavy-0'); buy(s, 'infantry', 'north-infantry-1');
  const [cannon, sam, mg, infantry] = s.defenders;
  const ground = bug(s, 'warrior', 53, 16), air = bug(s, 'flyer', 53, 16);
  assert.ok(legalTarget(s, cannon, ground)); assert.equal(legalTarget(s, cannon, air), false);
  assert.ok(legalTarget(s, sam, air)); assert.equal(legalTarget(s, sam, ground), false);
  assert.equal(legalTarget(s, mg, ground), false);
  const tooFar = bug(s, 'warrior', 5, 5); assert.equal(legalTarget(s, infantry, tooFar), false);
  assert.ok(coreBlocks({ x: 50, y: 45 }, { x: 70, y: 45 }));
  const behindWall = bug(s, 'warrior', 60, 65); assert.equal(legalTarget(s, infantry, behindWall), false);
});

test('armor reduces bullets but not explosions', () => {
  const s = newCampaign(), e = bug(s, 'armor', 50, 20);
  hurtEnemy(s, e, 100, 'bullet'); assert.equal(e.hp, 615);
  hurtEnemy(s, e, 100, 'explosion'); assert.equal(e.hp, 515);
});

test('bombs fly before exploding, ignore flyers and consume exactly one inventory item', () => {
  const s = newCampaign(); s.phase = 'combat';
  const ground = bug(s, 'warrior', 52, 20), flyer = bug(s, 'flyer', 52, 20);
  assert.ok(throwBomb(s, { x: 52, y: 20 }).ok);
  assert.equal(s.bombs, STARTING_BOMBS - 1); assert.equal(ground.hp, 75);
  assert.equal(throwBomb(s, { x: 52, y: 20 }).ok, false);
  for (let i = 0; i < 100; i++) updateCombat(s, 1 / 60);
  assert.equal(ground.hp, 0); assert.equal(flyer.hp, 95); assert.equal(s.roundStats.bombsUsed, 1);
  assert.equal(s.credits, STARTING_CREDITS + 4);
  assert.equal(s.roundStats.damage.bomb, 75);
});

test('invalid bomb targets do not consume inventory, and walls block blast damage', () => {
  const s = newCampaign(), inventory = s.bombs;
  assert.equal(throwBomb(s, { x: 50, y: 20 }).ok, false);
  s.phase = 'combat';
  for (const target of [{x:-1,y:20},{x:NaN,y:1},{x:200,y:30}]) assert.equal(throwBomb(s,target).ok,false);
  assert.equal(s.bombs, inventory);
  const protectedBug = bug(s, 'warrior', 60, 29);
  assert.ok(throwBomb(s, {x:60,y:26}).ok);
  for (let i = 0; i < 100; i++) updateCombat(s, 1 / 60);
  assert.equal(protectedBug.hp,75);
});

test('ground enemies attack intact walls and use only the gap after a breach', () => {
  const s = newCampaign(), e = bug(s, 'warrior', 52, 26.8);
  for (let i = 0; i < 600; i++) updateEnemies(s, 1 / 60);
  assert.ok(!isInside(e)); assert.ok(s.walls.north.hp < 900 && s.walls.north.hp > 0);
  breakWall(s, 'north');
  for (let i = 0; i < 600; i++) { const before = { x: e.x, y: e.y }; updateEnemies(s, 1 / 60); assert.ok(!wallSegments(s.walls).some(w => crosses(before, e, w))); }
  assert.ok(isInside(e)); assert.equal(e.stage, 'inside');
});

test('troop redeployment has travel time and reserves the destination', () => {
  const s = newCampaign(); buy(s, 'infantry', 'north-infantry-1'); s.phase = 'combat'; const u = s.defenders[0], origin = { x: u.x, y: u.y };
  assert.ok(relocate(s, u.id, 'east-infantry-0').ok); assert.deepEqual({ x: u.x, y: u.y }, origin); assert.ok(u.path.length);
  const target = bug(s, 'warrior', 60, 18); assert.equal(legalTarget(s, u, target), false);
  for (let i = 0; i < 1200; i++) updateTroops(s, 1 / 60);
  assert.equal(u.slotId, 'east-infantry-0'); assert.equal(u.path.length, 0); assert.equal(u.x, SLOT_BY_ID[u.slotId].x);
});

test('pause freezes wave time, enemy movement and weapon reloads', () => {
  const s = newCampaign(); autoDeploy(s); startRound(s); step(s, 5); togglePause(s); const before = snapshot(s);
  for (let i = 0; i < 60; i++) update(s, 1 / 60);
  assert.deepEqual(snapshot(s), before); togglePause(s); update(s, 1 / 60); assert.ok(s.time > before.time);
});

test('unspawned batches and live enemies prevent early settlement', () => {
  const s = newCampaign(); assert.equal(settleRound(s), false); startRound(s);
  assert.equal(settleRound(s), false); s.spawnIndex = s.spawnQueue.length;
  bug(s, 'warrior', 50, 20); assert.equal(settleRound(s), false); assert.equal(s.credits, STARTING_CREDITS);
});

test('spawn capacity queues enemies rather than silently losing scheduled bugs', () => {
  const s = newCampaign(); startRound(s);
  for (let i = 0; i < 200; i++) bug(s, 'warrior', -100 - i, -100);
  update(s, 1 / 60); assert.equal(s.spawnIndex, 0); assert.equal(s.enemies.length, 200);
  s.enemies = []; update(s, 1 / 60); assert.ok(s.spawnIndex > 0); assert.equal(s.phase, 'combat');
});

test('checkpoint retry restores the planning budget without duplicating salvage or rewards', () => {
  const s = newCampaign(); autoDeploy(s); startRound(s); step(s, 8); s.phase = 'defeat';
  assert.ok(restoreCheckpoint(s)); assert.equal(s.phase, 'planning'); assert.equal(s.credits, STARTING_CREDITS); assert.equal(s.defenders.length, 0); assert.equal(s.stats.retries, 1);
  assert.ok(restoreCheckpoint(s)); assert.equal(s.stats.retries, 2); assert.equal(s.credits, STARTING_CREDITS);
});

test('versioned saves round-trip and malformed storage safely falls back', () => {
  const storage = mockStorage(), s = newCampaign(); autoDeploy(s); assert.ok(saveGame(s, storage)); assert.deepEqual(snapshot(loadGame(storage)), snapshot(s));
  storage.setItem(STORAGE_KEY, '{bad'); assert.equal(loadGame(storage), null);
  saveGame(s, storage); const payload = JSON.parse(storage.getItem(STORAGE_KEY)); payload.version = 99; storage.setItem(STORAGE_KEY, JSON.stringify(payload)); assert.equal(loadGame(storage), null);
  payload.version = SAVE_VERSION; payload.state.defenders[0].type = 'broken'; storage.setItem(STORAGE_KEY, JSON.stringify(payload)); assert.equal(loadGame(storage), null);
  assert.equal(saveGame(s, { setItem() { throw Error('quota'); } }), false);
});

test('loss takes priority over settlement when the core reaches zero', () => {
  const s = newCampaign(); startRound(s); s.spawnIndex = s.spawnQueue.length; s.core.hp = 0; update(s, 1 / 60);
  assert.equal(s.phase, 'defeat'); assert.equal(s.lastSettled, 0); assert.equal(s.credits, STARTING_CREDITS);
});

test('a budget-limited defense with upgrades completes all ten rounds without early victory', () => {
  const s = newCampaign();
  for (let round=0;round<ROUNDS.length;round++) {
    prepareDefense(s);assert.ok(s.credits>=0);assert.ok(startRound(s));assert.equal(s.speed,DEFAULT_SPEED);for(let frame=0;frame<130*60&&s.phase==='combat';frame++){supportDefense(s);update(s,1/60);}
    assert.equal(s.phase,round+1===ROUNDS.length?'victory':'resupply',`round ${round+1}: core ${s.core.hp}, ${s.enemies.length} enemies left`);
    assert.equal(s.roundStats.kills,roundTotal(ROUNDS[round]));
    assert.ok(s.time/DEFAULT_SPEED<50,'each round should finish within 50 real seconds in this reference defense');
    const cash=s.credits;assert.equal(settleRound(s),false);assert.equal(s.credits,cash);
    const storage=mockStorage();saveGame(s,storage);assert.equal(loadGame(storage).lastSettled,round+1);
    assert.ok(s.defenders.every(u=>!u.flameTime&&!u.fire),'weapons stop firing during resupply');
    if(s.phase==='resupply'){assert.ok(nextRound(s));assert.equal(s.roundStats.earned,0);assert.equal(s.bombCooldown,0);}
  }
  assert.equal(s.stats.kills,1864);assert.equal(s.lastSettled,10);assert.ok(s.core.hp>0);
  assert.equal(s.credits,STARTING_CREDITS+ROUNDS.reduce((sum,r)=>sum+r.supply,0)+s.stats.earned-s.stats.spent);
  assert.ok(s.defenders.some(u=>u.level===3));assert.equal(nextRound(s),false);
});

test('every kill grants its bounty exactly once, irrespective of repeated damage', () => {
  const s = newCampaign(), armor = bug(s, 'armor', 52, 20);
  hurtEnemy(s, armor, 10000, 'explosion'); const earned = s.credits;
  assert.equal(earned, STARTING_CREDITS + 35); assert.equal(s.stats.earned, 35);
  hurtEnemy(s, armor, 10000, 'bullet'); assert.equal(s.credits, earned); assert.equal(s.stats.kills,1);
});

test('combat and paused phases permit reinforcements but cannot undo battlefield purchases', () => {
  const s = newCampaign(); startRound(s); const history = s.history.length;
  const first = buy(s,'machinegun','north-heavy-0'); assert.ok(first.ok);
  const unit = s.defenders.find(u=>u.id===first.id);
  assert.equal(unit.deployTime,1.5); assert.equal(s.history.length,history); assert.equal(undo(s).ok,false);
  const target = bug(s,'warrior',53,20); assert.equal(legalTarget(s,unit,target),false);
  for(let i=0;i<92;i++)updateCombat(s,1/60);
  assert.ok(unit.deployTime<=0); assert.ok(legalTarget(s,unit,target));
  togglePause(s); assert.ok(buy(s,'infantry','south-infantry-1').ok); assert.ok(buy(s,'bomb').ok);
  assert.equal(s.bombs,STARTING_BOMBS+1);
  s.phase='victory'; const cash=s.credits; assert.equal(buy(s,'bomb').ok,false); assert.equal(s.credits,cash);
});

test('bullets travel before doing damage rather than tracing instant hits', () => {
  const s=newCampaign(); buy(s,'infantry','north-infantry-1'); const target=bug(s,'warrior',60,17);
  updateCombat(s,1/60); assert.ok(s.projectiles.some(p=>p.kind==='bullet')); assert.equal(target.hp,75);
  for(let i=0;i<15;i++)updateCombat(s,1/60);
  assert.ok(target.hp<75); assert.ok(s.effects.some(e=>e.type==='impact'));
});

test('paused bombs remain in flight until the simulation resumes', () => {
  const s=newCampaign();startRound(s);togglePause(s);assert.ok(throwBomb(s,{x:60,y:20}).ok);
  const before=snapshot(s);for(let i=0;i<60;i++)update(s,1/60);assert.deepEqual(snapshot(s),before);
  togglePause(s);update(s,1/60);assert.ok(s.projectiles[0].time>0);
});

test('legacy saves preserve their army and convert mines into bombs with a resource top-up', () => {
  const storage=mockStorage(), old=newCampaign(); buy(old,'infantry','north-infantry-1');
  old.credits=100;old.roundIndex=1;old.lastSettled=1;old.mines=[{id:'m1',type:'mine'},{id:'m2',type:'mine'}];
  delete old.bombs;delete old.bombCooldown;
  const payload={version:1,campaignId:PROTOTYPE.id,state:snapshot(old),history:[],checkpoint:null};
  const original=JSON.stringify(payload);storage.setItem(LEGACY_STORAGE_KEY,original);
  const restored=loadGame(storage);assert.ok(restored);assert.equal(restored.defenders.length,1);
  assert.equal(restored.bombs,STARTING_BOMBS+2);assert.equal(restored.credits,780);assert.equal(restored.lastSettled,1);
  assert.equal(restored.mines,undefined);assert.equal(storage.getItem(LEGACY_STORAGE_KEY),original);
  saveGame(restored,storage);assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version,SAVE_VERSION);
});

test('combat snapshots restore wave queues, bounty totals and purchased reinforcements in a paused state', () => {
  const s=newCampaign();autoDeploy(s);startRound(s);step(s,14);buy(s,'infantry','east-infantry-0');
  const storage=mockStorage();assert.ok(saveGame(s,storage));const restored=loadGame(storage);
  assert.equal(restored.phase,'paused');assert.equal(restored.time,s.time);assert.equal(restored.credits,s.credits);
  assert.equal(restored.stats.earned,s.stats.earned);assert.equal(restored.defenders.length,s.defenders.length);
  togglePause(restored);assert.equal(restored.phase,'combat');
});

test('ground bugs take varied routes around rocks without cutting through intact walls', () => {
  const s=newCampaign(42);
  for(let i=0;i<16;i++)spawnEnemy(s,{side:SIDES[i%4],type:i%3?'warrior':'runner',lane:i%2});
  assert.ok(new Set(s.enemies.map(e=>Math.round(e.x))).size>5);
  for(let i=0;i<60*60;i++) {
    const positions=s.enemies.map(e=>({x:e.x,y:e.y}));updateEnemies(s,1/60);
    for(let j=0;j<s.enemies.length;j++) {
      const e=s.enemies[j];assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));
      assert.ok(!wallSegments(s.walls).some(w=>crosses(positions[j],e,w)));
      for(const rock of ROCKS)assert.ok(Math.hypot(e.x-rock.x,e.y-rock.y)>=rock.r+BUGS[e.type].radius-0.01);
    }
  }
  assert.ok(s.enemies.every(e=>e.route.length===0),'all approach waypoints should be reachable');
});


test('a travelling ground bullet stops at the command building instead of hitting through cover', () => {
  const s=newCampaign(), target=bug(s,'warrior',67,45);
  s.projectiles.push({id:'test-bullet',kind:'bullet',x:54,y:45,tx:67,ty:45,damage:100,time:0,life:1,air:false,trail:[]});
  for(let i=0;i<20;i++)updateCombat(s,1/60);
  assert.equal(target.hp,75);assert.equal(s.projectiles.length,0);
});


test('cannons deploy in the first round even when all machinegun positions are occupied', () => {
  const s=newCampaign();s.credits=10000;
  assert.equal(SLOTS.length,54);assert.equal(new Set(SLOTS.map(p=>p.id)).size,54);
  for(const slot of SLOTS.filter(p=>p.kind==='heavy'))assert.ok(buy(s,'machinegun',slot.id).ok);
  for(const slot of SLOTS.filter(p=>p.kind==='cannon'))assert.ok(buy(s,'cannon',slot.id).ok);
  assert.equal(s.defenders.filter(u=>u.type==='cannon').length,12);
  for(let i=0;i<SLOTS.length;i++)for(let j=i+1;j<SLOTS.length;j++)assert.ok(Math.hypot(SLOTS[i].x-SLOTS[j].x,SLOTS[i].y-SLOTS[j].y)>=3,'deployment positions must not overlap');
});

test('interior cannon pads remain deployable behind a breached wall', () => {
  const s=newCampaign();s.walls.north.hp=0;s.phase='combat';
  assert.ok(buy(s,'cannon','north-cannon-0').ok);
  const cash=s.credits;assert.equal(buy(s,'machinegun','north-heavy-0').ok,false);assert.equal(s.credits,cash);
});

test('flying bugs move much faster than ground bugs, weave and disengage after a diving hit', () => {
  const s=newCampaign(), fly=bug(s,'flyer',60,0), ground=bug(s,'warrior',60,0);ground.target={x:60,y:26.8};
  let lateral=0;for(let i=0;i<60;i++){updateEnemies(s,1/60);lateral=Math.max(lateral,Math.abs(fly.x-60));}
  assert.ok(Math.hypot(fly.x-60,fly.y)>Math.hypot(ground.x-60,ground.y)*1.8);
  assert.ok(lateral>0.15,'approach includes lateral weaving');
  const fight=newCampaign();buy(fight,'infantry','north-infantry-1');const defender=fight.defenders[0];
  const attacker=bug(fight,'flyer',60,28.5);attacker.attackTimer=0;updateEnemies(fight,1/60);
  assert.ok(defender.hp<defender.maxHp);assert.ok(attacker.evadeTime>0);
  const firstHp=defender.hp;for(let i=0;i<20;i++)updateEnemies(fight,1/60);
  assert.equal(defender.hp,firstHp);assert.ok(Math.hypot(attacker.x-defender.x,attacker.y-defender.y)>2);
});

test('flamethrowers hit multiple bugs in the cone, leave burns, and spare flyers and flanking targets', () => {
  const s=newCampaign();s.roundIndex=1;assert.ok(buy(s,'flamethrower','north-infantry-1').ok);
  const u=s.defenders[0],a=bug(s,'warrior',60,24),b=bug(s,'warrior',63,24),flank=bug(s,'warrior',67,29),fly=bug(s,'flyer',60,24);
  updateCombat(s,1/60);assert.equal(a.hp,66);assert.equal(b.hp,66);assert.equal(flank.hp,75);assert.equal(fly.hp,95);assert.ok(u.flameTime>0);
  u.path=[{x:60,y:33}];for(let i=0;i<60;i++)updateCombat(s,1/60);
  assert.ok(a.hp<59 && a.hp>55);assert.equal(flank.hp,75);assert.equal(fly.hp,95);assert.equal(u.hp,u.maxHp);
});

test('flames cannot pass through intact walls and armor resists some fire damage', () => {
  const s=newCampaign();s.roundIndex=1;buy(s,'flamethrower','reserve-0');s.defenders[0].angle=Math.PI;
  const outside=bug(s,'warrior',36.8,45,'west');updateCombat(s,1/60);assert.equal(outside.hp,75);assert.ok(!s.defenders[0].flameTime);
  const armor=bug(s,'armor',40,20);hurtEnemy(s,armor,100,'fire');assert.equal(armor.hp,585);
});

test('upgrades require real funds, increase firepower, undo atomically and respect the three-level limit', () => {
  const s=newCampaign();s.roundIndex=1;buy(s,'flamethrower','north-infantry-1');const before=snapshot(s),id=s.defenders[0].id;
  assert.ok(upgradeDefender(s,id).ok);assert.equal(s.credits,STARTING_CREDITS-270);assert.equal(s.defenders[0].maxHp,350);
  assert.ok(undo(s).ok);assert.deepEqual(snapshot(s),before);
  assert.ok(upgradeDefender(s,id).ok);assert.ok(upgradeDefender(s,id).ok);assert.equal(s.credits,STARTING_CREDITS-450);
  const cash=s.credits;assert.equal(upgradeDefender(s,id).ok,false);assert.equal(s.credits,cash);
  const target=bug(s,'warrior',60,24);updateCombat(s,1/60);assert.ok(Math.abs(target.hp-56.55)<1e-9);
  assert.equal(sell(s,id).refund,450);
  const poor=newCampaign();buy(poor,'infantry','north-infantry-1');poor.credits=1;const snapshotPoor=snapshot(poor);
  assert.equal(upgradeDefender(poor,poor.defenders[0].id).ok,false);assert.deepEqual(snapshot(poor),snapshotPoor);
});

test('old three-round victories continue into round four and old cannons move to independent pads', () => {
  const s=newCampaign();buy(s,'cannon','north-cannon-0');s.defenders[0].slotId='north-heavy-1';s.defenders[0].x=67;s.defenders[0].y=28.6;
  s.roundIndex=2;s.lastSettled=3;s.phase='victory';s.report={round:3,name:'钢甲来袭',supply:900,kills:116,damage:{},broken:[],coreLost:0};
  const storage=mockStorage(),raw=JSON.stringify({version:2,campaignId:PROTOTYPE.id,state:snapshot(s),checkpoint:s.checkpoint,history:s.history});storage.setItem(PREVIOUS_STORAGE_KEY,raw);
  const restored=loadGame(storage);assert.ok(restored);assert.equal(restored.phase,'resupply');assert.equal(restored.credits,s.credits);
  assert.equal(restored.defenders[0].slotId,'north-cannon-0');assert.equal(restored.defenders[0].x,52);assert.equal(restored.speed,DEFAULT_SPEED);
  assert.ok(nextRound(restored));assert.equal(restored.roundIndex,3);assert.equal(storage.getItem(PREVIOUS_STORAGE_KEY),raw);
  saveGame(restored,storage);assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version,3);
});

test('the campaign compresses wave schedules and raises late-round pressure sharply', () => {
  assert.equal(DEFAULT_SPEED,2);assert.equal(STARTING_CREDITS,1000);
  assert.ok(ROUNDS.every(r=>spawnPlan(r).at(-1).at<35));
  assert.ok(ROUNDS[9].threat.health>=ROUNDS[5].threat.health*2);
  assert.ok(ROUNDS[9].threat.damage>=ROUNDS[5].threat.damage*2.5);
  assert.ok(roundTotal(ROUNDS[9])>roundTotal(ROUNDS[5])*1.7);
});


test('round settlement completes outstanding troop movement so preparation cannot leave troops stuck', () => {
  const s=newCampaign();buy(s,'infantry','north-infantry-1');const id=s.defenders[0].id;startRound(s);
  assert.ok(relocate(s,id,'reserve-0').ok);assert.ok(s.defenders[0].path.length);
  s.spawnIndex=s.spawnQueue.length;assert.ok(settleRound(s));assert.equal(s.defenders[0].path.length,0);
  assert.equal(s.defenders[0].slotId,'reserve-0');assert.ok(nextRound(s));assert.ok(relocate(s,id,'south-infantry-1').ok);
});
