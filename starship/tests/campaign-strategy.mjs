import {SIDES,BUGS,CORE} from '../js/data/config.js';
import {SLOTS,canUseSlot} from '../js/battlefield.js';
import {throwBomb} from '../js/combat.js';
import {distance} from '../js/geometry.js';
import {buy, autoDeploy, upgradeDefender, repairWall, repairCore, repairDefender,relocate,occupied} from '../js/economy.js';

// A reproducible, budget-limited player build: no granted money, health or kills.
export function prepareDefense(state, {upgrades=true}={}) {
  if(state.roundIndex===0) return autoDeploy(state);
  for(const side of SIDES) while(state.walls[side].hp<720 && repairWall(state,side).ok) {}
  if(state.core.hp<1200)repairCore(state);
  for(const unit of state.defenders) if(unit.hp<unit.maxHp*0.65)repairDefender(state,unit.id);
  const plan=[['sam','air-0'],['sam','air-2'],['flamethrower','north-infantry-2'],['flamethrower','south-infantry-2']];
  if(state.roundIndex>=2)plan.push(['cannon','south-cannon-0'],['cannon','east-cannon-0'],['sam','air-1'],['sam','air-3'],['flamethrower','east-infantry-0'],['flamethrower','west-infantry-0']);
  if(state.roundIndex>=3)plan.push(['cannon','north-cannon-0'],['cannon','west-cannon-0'],['cannon','south-cannon-1'],['cannon','east-cannon-1']);
  if(state.roundIndex>=4)plan.push(...[4,5,6,7].map(i=>['sam',`air-${i}`]),...SIDES.map(side=>['flamethrower',`${side}-infantry-3`]));
  if(state.roundIndex>=5)plan.push(...SIDES.flatMap(side=>[0,1,2].map(i=>['cannon',`${side}-cannon-${i}`])));
  for(const [type,slot] of plan) if(!state.defenders.some(u=>u.hp>0&&u.slotId===slot)) {
    const withdrawn=state.defenders.find(u=>u.hp>0&&u.type===type&&!u.slotId&&!u.path.length);
    if(withdrawn)relocate(state,withdrawn.id,slot);else buy(state,type,slot);
  }
  if(upgrades && state.roundIndex>=3) {
    const order=state.defenders.filter(u=>['cannon','sam','flamethrower','machinegun'].includes(u.type)).sort((a,b)=>['cannon','sam','flamethrower','machinegun'].indexOf(a.type)-['cannon','sam','flamethrower','machinegun'].indexOf(b.type));
    const upgradeTypes=(types,level)=>{for(const unit of order)if(types.includes(unit.type))while(unit.level<level && upgradeDefender(state,unit.id).ok){}};
    upgradeTypes(['cannon'],2);
    if(state.roundIndex>=7)upgradeTypes(['sam'],2);
    if(state.roundIndex>=6)upgradeTypes(['cannon'],3);
    if(state.roundIndex>=8)upgradeTypes(['flamethrower','machinegun'],2);
    if(state.roundIndex>=9)upgradeTypes(['sam','flamethrower','machinegun'],3);
  }
  return {ok:true};
}

const lastSupport = new WeakMap(), lastReinforcement = new WeakMap();
// Models a player aiming bombs at dense ground groups in the difficult final waves.
export function supportDefense(state) {
  if(state.roundIndex<6)return;
  if(state.stats.duration-(lastReinforcement.get(state)??-10)>=2) {
    const flyers=state.enemies.filter(e=>e.hp>0&&BUGS[e.type].air).length;
    const vacancies=SLOTS.filter(p=>canUseSlot(state,p)&&!occupied(state,p.id));
    let type,slot;
    if(flyers>6 && (slot=vacancies.find(p=>p.kind==='air')))type='sam';
    else if(state.enemies.some(e=>e.hp>0&&!BUGS[e.type].air) && (slot=vacancies.find(p=>p.kind==='cannon')))type='cannon';
    else if(state.enemies.some(e=>e.hp>0&&!BUGS[e.type].air&&distance(e,CORE)<20) && (slot=vacancies.find(p=>p.kind==='infantry'&&p.side==='reserve')))type='flamethrower';
    if(type&&buy(state,type,slot.id).ok)lastReinforcement.set(state,state.stats.duration);
  }
  if(state.bombCooldown>0 || state.stats.duration-(lastSupport.get(state)??-10)<2.4)return;
  const ground=state.enemies.filter(e=>e.hp>0&&!BUGS[e.type].air&&distance(e,CORE)<34);
  let target=null,best=550;
  for(const e of ground) {
    const score=ground.filter(o=>distance(e,o)<5).reduce((sum,o)=>sum+Math.min(320,o.hp)*(o.type==='armor'?1.4:1),0)*(distance(e,CORE)<20?1.5:1);
    if(score>best){best=score;target=e;}
  }
  if(!target)return;
  if(!state.bombs && !buy(state,'bomb').ok)return;
  if(throwBomb(state,target).ok)lastSupport.set(state,state.stats.duration);
}
