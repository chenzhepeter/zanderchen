import test from 'node:test';
import assert from 'node:assert/strict';
import {UI} from '../js/ui.js';
import {newCampaign,startRound,togglePause,update} from '../js/game.js';
import {buy,relocate,occupied,upgradeDefender} from '../js/economy.js';
import {updateCombat,legalTarget} from '../js/combat.js';
import {snapshot,saveGame,loadGame} from '../js/state.js';
import {spawnEnemy} from '../js/enemies.js';
import {SLOT_BY_ID} from '../js/battlefield.js';

function withUI(state,check) {
  const previous=globalThis.document;
  const overlay={innerHTML:''},appElement={classList:{remove(){}}};
  globalThis.document={getElementById:id=>id==='overlay'?overlay:appElement};
  const ui=Object.create(UI.prototype);ui.app={state,menu:false};ui.messages=[];
  ui.save=()=>{};ui.refresh=()=>{};ui.toast=message=>ui.messages.push(message);
  try {check(ui);} finally {if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}

test('buying finishes placement and immediately selects the new defender for unit controls',()=>{
  const state=newCampaign();withUI(state,ui=>{
    ui.pending={mode:'buy',type:'infantry'};ui.clickMap(SLOT_BY_ID['north-infantry-1']);
    assert.equal(state.defenders.length,1);assert.equal(ui.pending,null);
    assert.deepEqual(ui.selection,{kind:'unit',id:state.defenders[0].id});
    const dock=ui.renderUnitActions(state);assert.match(dock,/data-action="upgrade"/);assert.match(dock,/data-action="move"/);
  });
});

test('tapping an existing defender while a shop card is selected opens its controls without buying',()=>{
  const state=newCampaign();buy(state,'infantry','north-infantry-1');const before=snapshot(state);
  withUI(state,ui=>{
    ui.pending={mode:'buy',type:'machinegun'};ui.clickMap(state.defenders[0]);
    assert.equal(ui.pending,null);assert.equal(ui.selection.id,state.defenders[0].id);
    assert.deepEqual(snapshot(state),before);assert.deepEqual(ui.messages,[]);
  });
});

test('unit controls explain insufficient funds and fixed-weapon movement restrictions',()=>{
  const state=newCampaign();buy(state,'cannon','north-cannon-0');state.credits=0;
  withUI(state,ui=>{
    ui.selectUnit(state.defenders[0].id);assert.match(ui.renderUnitActions(state),/军需不足/);
    state.phase='combat';assert.match(ui.renderUnitActions(state),/固定武器仅整备时搬迁/);
    assert.equal(ui.startMove(state.defenders[0].id),false);assert.match(ui.messages.at(-1),/固定武器/);
  });
});

test('the move command shows valid destinations and can relocate a cannon during preparation',()=>{
  const state=newCampaign();buy(state,'cannon','north-cannon-0');const unit=state.defenders[0];
  withUI(state,ui=>{
    assert.ok(ui.startMove(unit.id));assert.match(ui.renderUnitActions(state),/点选高亮空位完成移动/);
    assert.equal(ui.nearestSlot(SLOT_BY_ID[unit.slotId]),null,'current position is not a free destination');
    ui.clickMap(SLOT_BY_ID['east-cannon-0']);assert.equal(unit.slotId,'east-cannon-0');assert.equal(ui.pending,null);
  });
});

test('combat upgrades cost real money, pause firing for two seconds and cannot be double-charged during refitting',()=>{
  const state=newCampaign();buy(state,'infantry','north-infantry-1');startRound(state);const unit=state.defenders[0];
  const history=state.history.length,cash=state.credits;assert.ok(upgradeDefender(state,unit.id).ok);
  assert.equal(state.credits,cash-56);assert.equal(state.history.length,history);assert.equal(unit.level,2);assert.equal(unit.deployTime,2);
  const after=state.credits;assert.equal(upgradeDefender(state,unit.id).ok,false);assert.equal(state.credits,after);
  spawnEnemy(state,{side:'north',lane:0,type:'warrior'});const enemy=state.enemies.at(-1);enemy.x=60;enemy.y=20;
  assert.equal(legalTarget(state,unit,enemy),false);assert.equal(relocate(state,unit.id,'south-infantry-1').ok,false);
  for(let i=0;i<119;i++)updateCombat(state,1/60);
  assert.equal(state.projectiles.length,0);assert.equal(enemy.hp,75);
  for(let i=0;i<4;i++)updateCombat(state,1/60);
  assert.equal(unit.refitting,false);assert.ok(legalTarget(state,unit,enemy));assert.ok(state.projectiles.length>0);
});

test('paused refitting is saved, remains frozen and resumes with the battle',()=>{
  const state=newCampaign();buy(state,'cannon','north-cannon-0');startRound(state);togglePause(state);
  assert.ok(upgradeDefender(state,state.defenders[0].id).ok);const before=snapshot(state);
  for(let i=0;i<120;i++)update(state,1/60);assert.deepEqual(snapshot(state),before);
  let value;const storage={setItem(_key,v){value=v;},getItem(){return value??null;}};
  assert.ok(saveGame(state,storage));const restored=loadGame(storage);assert.equal(restored.phase,'paused');assert.equal(restored.defenders[0].refitting,true);
  togglePause(restored);for(let i=0;i<122;i++)update(restored,1/60);assert.equal(restored.defenders[0].refitting,false);
});

test('preparation can redirect a unit left mid-movement by an older save',()=>{
  const state=newCampaign();buy(state,'infantry','north-infantry-1');const unit=state.defenders[0];
  unit.path=[{x:47,y:45}];unit.destination='reserve-0';assert.ok(occupied(state,'reserve-0'));
  assert.ok(relocate(state,unit.id,'south-infantry-1').ok);assert.equal(unit.path.length,0);assert.equal(unit.destination,null);
  assert.equal(occupied(state,'reserve-0'),false);assert.equal(unit.slotId,'south-infantry-1');
});
