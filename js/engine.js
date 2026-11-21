(function () {
  'use strict';

  var DATA = window.TOWER_DATA;
  var SIZE = DATA.gridSize;
  var SAVE_KEY = 'emberTower.save.v6';
  var CHECKPOINT_KEY = 'emberTower.checkpoint.v6';

  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var DIR_NAMES = ['up', 'down', 'left', 'right'];
  var STAT_KEYS = ['hp', 'atk', 'def'];
  var KEY_KINDS = ['yellow', 'blue', 'red'];
  var ITEM_KINDS = ['lamp'];
  var STAT_NAMES = { hp: '生命', atk: '攻击', def: '防御' };
  var KEY_NAMES = { yellow: '黄钥匙', blue: '蓝钥匙', red: '红钥匙' };

  var maps = [];
  var floorIndex = 0;
  var hero = null;
  var steps = 0;
  var won = false;
  var maxFloor = 0;
  var startPos = { x: 1, y: 1 };

  /* 调试模式（DESIGN §8.8）：脚本加载时自己看网址。
   * 读不到 location（tools/playtest.js 在 Node 里跑）就当正常模式 */
  var debug = false;
  try {
    if (typeof location !== 'undefined' && location && typeof location.search === 'string' &&
        location.search.indexOf('debug') >= 0) {
      debug = true;
    }
  } catch (err) { debug = false; }

  /* 调试模式用自己的一套存储键：调试局读不到、也写不坏正常局的存档 */
  function storageKey(key) {
    return debug ? key + '.debug' : key;
  }

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isInt(v) {
    return isNum(v) && v % 1 === 0;
  }

  function findChar(rows, ch) {
    for (var y = 0; y < rows.length; y++) {
      var x = rows[y].indexOf(ch);
      if (x >= 0) return { x: x, y: y };
    }
    return null;
  }

  function tileDef(ch) {
    return DATA.tiles[ch] || DATA.tiles['#'];
  }

  function isMonster(ch) {
    return tileDef(ch).type === 'monster';
  }

  function setTile(x, y, ch) {
    maps[floorIndex][y][x] = ch;
  }

  function getItemScale() {
    return DATA.floors[floorIndex].itemScale;
  }

  function scaleEffect(effect) {
    if (!effect) return effect;
    var scale = getItemScale();
    var out = {};
    Object.keys(effect).forEach(function (k) {
      out[k] = STAT_KEYS.indexOf(k) >= 0 ? Math.round(effect[k] * scale) : effect[k];
    });
    return out;
  }

  function applyEffect(effect) {
    if (!effect) return;
    if (effect.gold) hero.gold += effect.gold;
    STAT_KEYS.forEach(function (k) {
      if (effect[k]) hero[k] += effect[k];
    });
    KEY_KINDS.forEach(function (k) {
      if (effect[k]) hero.keys[k] += effect[k];
    });
    ITEM_KINDS.forEach(function (k) {
      if (effect[k]) hero.items[k] += effect[k];
    });
  }

  function statText(effect, skipName) {
    var parts = [];
    STAT_KEYS.forEach(function (k) {
      if (effect && effect[k]) parts.push(STAT_NAMES[k] + ' +' + effect[k]);
    });
    KEY_KINDS.forEach(function (k) {
      if (!effect || !effect[k]) return;
      var name = KEY_NAMES[k];
      if (skipName && skipName === name) return;
      parts.push(name + ' +' + effect[k]);
    });
    if (effect && effect.gold) parts.push('金币 +' + effect.gold);
    return parts.join('，');
  }

  function keysFrom(source) {
    var keys = {};
    KEY_KINDS.forEach(function (k) {
      var v = source ? source[k] : 0;
      keys[k] = isInt(v) && v >= 0 ? v : 0;
    });
    return keys;
  }

  function publish() {
    Game.state = {
      floor: floorIndex,
      hero: {
        x: hero.x, y: hero.y, dir: hero.dir,
        hp: hero.hp, atk: hero.atk, def: hero.def, gold: hero.gold,
        keys: keysFrom(hero.keys),
        items: { lamp: hero.items.lamp }
      },
      steps: steps,
      won: won,
      maxFloor: maxFloor
    };
  }

  function init() {
    maps = DATA.floors.map(function (floor) {
      return floor.map.map(function (row) {
        return row.split('');
      });
    });
    floorIndex = 0;
    steps = 0;
    won = false;
    maxFloor = 0;
    hero = {
      x: 1, y: 1, dir: 'down',
      hp: DATA.hero.hp, atk: DATA.hero.atk, def: DATA.hero.def, gold: DATA.hero.gold,
      keys: keysFrom(DATA.hero.keys),
      items: { lamp: DATA.hero.items.lamp }
    };
    for (var f = 0; f < maps.length; f++) {
      var spawn = findChar(maps[f], '@');
      if (spawn) {
        maps[f][spawn.y][spawn.x] = '.';
        floorIndex = f;
        hero.x = spawn.x;
        hero.y = spawn.y;
        startPos = { x: spawn.x, y: spawn.y };
        break;
      }
    }
    publish();
  }

  function getFloorName() {
    return DATA.floors[floorIndex].name;
  }

  function getTile(x, y) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return '#';
    var ch = maps[floorIndex][y][x];
    return ch === '@' ? '.' : ch;
  }

  /* 货架上本档（没变旧）的强化货，只按加成项找，取数据顺序第一件 */
  function findStatGoods(stat) {
    var goods = DATA.shop.goods;
    for (var i = 0; i < goods.length; i++) {
      var g = goods[i];
      if (onShelf(g) && !isOld(g) && g.effect && typeof g.effect[stat] === 'number') {
        return g;
      }
    }
    return null;
  }

  function goldBuys(gold, price) {
    if (!price || price <= 0) return 0;
    return Math.floor(gold / price);
  }

  /* 与 getBattleInfo 里 turns / damage 同一个算法；打不动返回 null */
  function prospectDamage(m, atk, def) {
    if (atk <= m.def) return null;
    var turns = Math.ceil(m.hp / (atk - m.def));
    return (turns - 1) * Math.max(0, m.atk - def);
  }

  function getBattleInfo(id) {
    var m = DATA.monsters[id];
    if (!m) return null;
    var canHit = hero.atk > m.def;
    var turns = null;
    var damage = null;
    var critAtk = null;
    if (canHit) {
      turns = Math.ceil(m.hp / (hero.atk - m.def));
      damage = (turns - 1) * Math.max(0, m.atk - hero.def);
      if (turns > 1) {
        critAtk = Math.ceil(m.hp / (turns - 1)) - (hero.atk - m.def);
      }
    } else {
      critAtk = m.def + 1 - hero.atk;
    }
    var critDamage = null;
    if (critAtk !== null) {
      var critTurns = Math.ceil(m.hp / (hero.atk + critAtk - m.def));
      critDamage = (critTurns - 1) * Math.max(0, m.atk - hero.def);
    }
    var critSave = null;
    if (canHit && critAtk !== null) {
      critSave = damage - critDamage;
    }
    var safeDef = Math.max(0, m.atk - hero.def);
    var defGoods = findStatGoods('def');
    var defStep = defGoods ? defGoods.effect.def : null;
    var defPrice = defGoods ? defGoods.price : null;
    var defSave = null;
    if (canHit && defStep !== null) {
      defSave = damage - (turns - 1) * Math.max(0, m.atk - (hero.def + defStep));
    }
    /* 花光金币的预估：只买本档攻击 / 只买本档防御 */
    var atkGoods = findStatGoods('atk');
    var atkStep = atkGoods ? atkGoods.effect.atk : null;
    var atkBuys = atkGoods ? goldBuys(hero.gold, atkGoods.price) : 0;
    var goldDefBuys = defGoods ? goldBuys(hero.gold, defGoods.price) : 0;
    var goldAtk = atkStep === null ? 0 : atkStep * atkBuys;
    var goldDef = defStep === null ? 0 : defStep * goldDefBuys;
    var goldAtkDamage = prospectDamage(m, hero.atk + goldAtk, hero.def);
    var goldDefDamage = prospectDamage(m, hero.atk, hero.def + goldDef);
    var goldAtkSave = null;
    var goldAtkUnlock = false;
    if (goldAtkDamage !== null) {
      if (damage === null) {
        goldAtkUnlock = true;
      } else {
        goldAtkSave = damage - goldAtkDamage;
      }
    }
    var goldDefSave = null;
    var goldDefUnlock = false;
    if (goldDefDamage !== null) {
      if (damage === null) {
        goldDefUnlock = true;
      } else {
        goldDefSave = damage - goldDefDamage;
      }
    }
    return {
      id: id, name: m.name, glyph: m.glyph, color: m.color,
      hp: m.hp, atk: m.atk, def: m.def, gold: m.gold, boss: !!m.boss,
      canHit: canHit, turns: turns, damage: damage,
      critAtk: critAtk, critDamage: critDamage, critSave: critSave, safeDef: safeDef,
      defStep: defStep, defPrice: defPrice, defSave: defSave,
      goldAtk: goldAtk, goldDef: goldDef,
      goldAtkDamage: goldAtkDamage, goldDefDamage: goldDefDamage,
      goldAtkSave: goldAtkSave, goldDefSave: goldDefSave,
      goldAtkUnlock: goldAtkUnlock, goldDefUnlock: goldDefUnlock,
      /* 调试模式下打得动就能打赢：战斗规则照常算，只是不会战死 */
      canWin: canHit && (debug || damage < hero.hp)
    };
  }

  function getFloorMonsters() {
    var counts = {};
    var rows = maps[floorIndex];
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var ch = rows[y][x];
        if (isMonster(ch)) counts[ch] = (counts[ch] || 0) + 1;
      }
    }
    var order = Object.keys(DATA.monsters).filter(function (id) {
      return counts[id];
    });
    var normal = order.filter(function (id) {
      return !DATA.monsters[id].boss;
    });
    var bosses = order.filter(function (id) {
      return DATA.monsters[id].boss;
    });
    return normal.concat(bosses).map(function (id) {
      var info = getBattleInfo(id);
      info.count = counts[id];
      return info;
    });
  }

  function getGoldPlan() {
    var atkGoods = findStatGoods('atk');
    var defGoods = findStatGoods('def');
    var atkStep = atkGoods ? atkGoods.effect.atk : null;
    var atkPrice = atkGoods ? atkGoods.price : null;
    var defStep = defGoods ? defGoods.effect.def : null;
    var defPrice = defGoods ? defGoods.price : null;
    var atkBuys = atkGoods ? goldBuys(hero.gold, atkPrice) : 0;
    var defBuys = defGoods ? goldBuys(hero.gold, defPrice) : 0;
    var plan = {
      gold: hero.gold,
      atkStep: atkStep, atkPrice: atkPrice, atkBuys: atkBuys,
      goldAtk: atkStep === null ? 0 : atkStep * atkBuys,
      defStep: defStep, defPrice: defPrice, defBuys: defBuys,
      goldDef: defStep === null ? 0 : defStep * defBuys,
      floorAtkSave: 0, floorDefSave: 0
    };
    getFloorMonsters().forEach(function (info) {
      if (info.goldAtkSave !== null) plan.floorAtkSave += info.goldAtkSave * info.count;
      if (info.goldDefSave !== null) plan.floorDefSave += info.goldDefSave * info.count;
    });
    return plan;
  }

  /* 这一幕此刻还关着的门：读当前地图（开过的门已是地板），不改状态 */
  function getClosedDoors(actId) {
    var act = findAct(actId);
    if (!act) return [];
    var list = [];
    for (var f = act.from - 1; f <= act.to - 1; f++) {
      var rows = maps[f];
      for (var y = 0; y < rows.length; y++) {
        for (var x = 0; x < rows[y].length; x++) {
          var ch = rows[y][x];
          if (ch === 'Y' || ch === 'B' || ch === 'R') {
            list.push([f + 1, x, y, ch]);
          }
        }
      }
    }
    return list;
  }

  function getActMonsters() {
    var act = getAct();
    var from = act ? act.from - 1 : floorIndex;
    var to = act ? act.to - 1 : floorIndex;
    var totals = {};
    var counts = {};
    var floorCounts = {};
    function tally(rows, dest) {
      for (var y = 0; y < rows.length; y++) {
        for (var x = 0; x < rows[y].length; x++) {
          var ch = rows[y][x];
          if (isMonster(ch)) dest[ch] = (dest[ch] || 0) + 1;
        }
      }
    }
    for (var f = from; f <= to; f++) {
      tally(DATA.floors[f].map, totals);
      tally(maps[f], counts);
    }
    tally(maps[floorIndex], floorCounts);
    var groups = [[], [], []];
    Object.keys(DATA.monsters).forEach(function (id) {
      if (!totals[id]) return;
      var g = floorCounts[id] > 0 ? 0 : (counts[id] > 0 ? 1 : 2);
      groups[g].push(id);
    });
    var result = [];
    groups.forEach(function (ids) {
      var normal = ids.filter(function (id) { return !DATA.monsters[id].boss; });
      var bosses = ids.filter(function (id) { return DATA.monsters[id].boss; });
      normal.concat(bosses).forEach(function (id) {
        var info = getBattleInfo(id);
        info.total = totals[id];
        info.count = counts[id] || 0;
        info.floorCount = floorCounts[id] || 0;
        result.push(info);
      });
    });
    return result;
  }

  function getShopName() {
    return DATA.shop.name;
  }

  function findGoods(id) {
    var goods = DATA.shop.goods;
    for (var i = 0; i < goods.length; i++) {
      if (goods[i].id === id) return goods[i];
    }
    return null;
  }

  function shownAt(g, reached) {
    return reached >= (g.showFloor || 1);
  }

  function hiddenAt(g, reached) {
    return g.hideFloor > 0 && reached >= g.hideFloor;
  }

  function isShown(g) {
    return shownAt(g, maxFloor + 1);
  }

  function isHidden(g) {
    return hiddenAt(g, maxFloor + 1);
  }

  function onShelf(g) {
    return isShown(g) && !isHidden(g);
  }

  /* 到过的最高层（1 起算，口径同 showFloor / hideFloor）达到 oldFloor 后，这件货挪进「旧档强化」 */
  function isOld(g) {
    return g.oldFloor > 0 && maxFloor + 1 >= g.oldFloor;
  }

  function isLocked(g) {
    return g.unlockFloor > 0 && maxFloor + 1 < g.unlockFloor;
  }

  function lockText(g) {
    return '到达第 ' + g.unlockFloor + ' 层解锁';
  }

  function isOwned(g) {
    if (!g.once) return false;
    var effect = g.effect || {};
    for (var i = 0; i < ITEM_KINDS.length; i++) {
      var k = ITEM_KINDS[i];
      if (effect[k] && hero.items[k] > 0) return true;
    }
    return false;
  }

  function getShopGoods() {
    var shelf = DATA.shop.goods.filter(onShelf);
    /* 先是本档没变旧的货（数据顺序），再是旧档（oldFloor 从大到小，新档在前；同档内保持数据顺序） */
    var oldGoods = shelf.filter(isOld);
    oldGoods.sort(function (a, b) {
      return (b.oldFloor - a.oldFloor) || (shelf.indexOf(a) - shelf.indexOf(b));
    });
    var list = shelf.filter(function (g) {
      return !isOld(g);
    }).concat(oldGoods);
    return list.map(function (g) {
      var old = isOld(g);
      var locked = isLocked(g);
      var owned = isOwned(g);
      var affordable = hero.gold >= g.price;
      return {
        id: g.id, group: old ? 'old' : g.group, label: g.label, desc: g.desc, price: g.price,
        old: old,
        locked: locked,
        lockHint: locked ? lockText(g) : '',
        owned: owned,
        affordable: affordable,
        canBuy: !locked && !owned && affordable && !won
      };
    });
  }

  function buyGoods(id) {
    if (won) return { ok: false, message: '灯已经点亮了' };
    var g = findGoods(id);
    if (!g) return { ok: false, message: '没有这件商品' };
    if (!isShown(g)) return { ok: false, message: '这件货还没上架' };
    if (isHidden(g)) return { ok: false, message: '这件货已经下架了' };
    if (isLocked(g)) return { ok: false, message: '还没解锁：' + lockText(g) };
    if (isOwned(g)) return { ok: false, message: '已经拥有 ' + g.label };
    if (hero.gold < g.price) return { ok: false, message: '金币不够' };
    hero.gold -= g.price;
    applyEffect(g.effect);
    publish();
    var text = statText(g.effect, g.label);
    return { ok: true, message: '购买 ' + g.label + (text ? '，' + text : '') };
  }

  function getVisitedFloors() {
    var list = [];
    for (var f = 0; f <= maxFloor; f++) {
      list.push({ floor: f, name: DATA.floors[f].name });
    }
    return list;
  }

  function getActs() {
    return DATA.acts || [];
  }

  function actIdOfFloor(f) {
    var a = DATA.floors[f].act;
    return isNum(a) ? a : 0;
  }

  function findAct(id) {
    var acts = getActs();
    for (var i = 0; i < acts.length; i++) {
      if (acts[i].id === id) return acts[i];
    }
    return null;
  }

  function getAct() {
    return findAct(actIdOfFloor(floorIndex));
  }

  function rankForHp(act, hp) {
    if (!act || !Array.isArray(act.ranks)) return null;
    for (var i = 0; i < act.ranks.length; i++) {
      if (hp >= act.ranks[i].min) {
        return { label: act.ranks[i].label, text: act.ranks[i].text };
      }
    }
    return null;
  }

  function enterNewAct(oldMax, events) {
    if (!getActs().length) return;
    if (maxFloor <= oldMax) return;
    var newId = actIdOfFloor(floorIndex);
    var oldId = actIdOfFloor(oldMax);
    if (newId <= oldId) return;
    var prev = findAct(oldId);
    var next = findAct(newId);
    var rank = rankForHp(prev, hero.hp);
    saveCheckpoint();
    events.push({
      type: 'act',
      act: newId,
      title: next ? next.title : '',
      intro: next ? next.intro : '',
      cleared: { act: oldId, title: prev ? prev.title : '', rank: rank }
    });
  }

  function stepTo(x, y, events) {
    hero.x = x;
    hero.y = y;
    steps++;
    events.push({ type: 'move', x: x, y: y });
  }

  function openDoor(x, y, def, events) {
    var key = def.key;
    if (hero.keys[key] > 0) {
      hero.keys[key]--;
      setTile(x, y, '.');
      events.push({
        type: 'door', x: x, y: y, key: key,
        message: '用' + KEY_NAMES[key] + '打开了门'
      });
    } else {
      events.push({ type: 'blocked', reason: 'nokey', message: '没有' + KEY_NAMES[key] });
    }
  }

  function fight(x, y, id, events) {
    var info = getBattleInfo(id);
    if (!info.canHit) {
      events.push({ type: 'blocked', reason: 'weak', message: '打不动 ' + info.name + '（攻击不足）' });
      return;
    }
    if (!info.canWin) {
      events.push({ type: 'blocked', reason: 'lethal', message: '现在打 ' + info.name + ' 会战死' });
      return;
    }
    /* 调试模式下不扣生命：金币照拿、怪照样消失，damage / turns 照常算给界面看 */
    if (!debug) { hero.hp -= info.damage; }
    hero.gold += info.gold;
    setTile(x, y, '.');
    events.push({
      type: 'battle', x: x, y: y, id: id, name: info.name,
      damage: info.damage, turns: info.turns, gold: info.gold,
      message: '击败 ' + info.name + '，损失 ' + info.damage + ' 生命，获得 ' + info.gold + ' 金币'
    });
    stepTo(x, y, events);
  }

  function takeStairs(up, events) {
    var to = floorIndex + (up ? 1 : -1);
    var landing = null;
    if (to >= 0 && to < maps.length) landing = findChar(maps[to], up ? '<' : '>');
    if (!landing) {
      events.push({ type: 'blocked', reason: 'wall', message: '' });
      return;
    }
    var from = floorIndex;
    var oldMax = maxFloor;
    floorIndex = to;
    maxFloor = Math.max(maxFloor, to);
    hero.x = landing.x;
    hero.y = landing.y;
    steps++;
    events.push({ type: 'stairs', from: from, to: to });
    enterNewAct(oldMax, events);
    save();
  }

  function move(dir) {
    if (won) return [];
    if (DIR_NAMES.indexOf(dir) < 0) return [];
    hero.dir = dir;
    var events = [];
    var x = hero.x + DIRS[dir][0];
    var y = hero.y + DIRS[dir][1];
    var ch = getTile(x, y);
    var def = tileDef(ch);

    switch (def.type) {
      case 'door':
        openDoor(x, y, def, events);
        break;
      case 'monster':
        fight(x, y, ch, events);
        break;
      case 'stairsUp':
        takeStairs(true, events);
        break;
      case 'stairsDown':
        takeStairs(false, events);
        break;
      case 'item':
        var effect = scaleEffect(def.effect);
        applyEffect(effect);
        setTile(x, y, '.');
        stepTo(x, y, events);
        var text = statText(effect, def.name);
        events.push({
          type: 'item', x: x, y: y, tile: ch, name: def.name,
          message: '获得 ' + def.name + (text ? '，' + text : '')
        });
        break;
      case 'goal':
        stepTo(x, y, events);
        won = true;
        events.push({ type: 'win' });
        break;
      case 'wall':
        events.push({ type: 'blocked', reason: 'wall', message: '' });
        break;
      default:
        stepTo(x, y, events);
        break;
    }

    publish();
    return events;
  }

  function useLamp(floor) {
    if (hero.items.lamp <= 0) {
      return [{ type: 'blocked', reason: 'noitem', message: '没有引路灯符' }];
    }
    if (!isInt(floor) || floor < 0 || floor > maxFloor) {
      return [{ type: 'blocked', reason: 'badfloor', message: '没去过这一层' }];
    }
    if (floor === floorIndex) {
      return [{ type: 'blocked', reason: 'samefloor', message: '你已经在这一层了' }];
    }
    var landing = floor === 0 ? startPos : findChar(maps[floor], '<');
    if (!landing) {
      return [{ type: 'blocked', reason: 'badfloor', message: '那一层没有落脚点' }];
    }
    var from = floorIndex;
    floorIndex = floor;
    hero.x = landing.x;
    hero.y = landing.y;
    hero.dir = 'down';
    save();
    publish();
    return [{
      type: 'stairs', from: from, to: floor, via: 'lamp',
      message: '引路灯符一闪，来到 ' + DATA.floors[floor].name
    }];
  }

  function lampJumpIssue(dir) {
    if (hero.items.lamp <= 0) {
      return { type: 'blocked', reason: 'noitem', message: '没有引路灯符' };
    }
    if (dir !== 'up' && dir !== 'down') {
      return { type: 'blocked', reason: 'badfloor', message: '没去过这一层' };
    }
    var to = floorIndex + (dir === 'up' ? 1 : -1);
    if (to < 0) {
      return { type: 'blocked', reason: 'badfloor', message: '已经是最底层了' };
    }
    if (to >= maps.length || (dir === 'up' && to > maxFloor)) {
      return { type: 'blocked', reason: 'badfloor', message: '上面那层还没去过' };
    }
    var landing = findChar(maps[to], dir === 'up' ? '<' : '>');
    if (!landing) {
      return { type: 'blocked', reason: 'badfloor', message: '那一层没有落脚点' };
    }
    return { type: null, to: to, landing: landing };
  }

  function canLampJump(dir) {
    if (won) return false;
    return !lampJumpIssue(dir).type;
  }

  function lampJump(dir) {
    if (won) return [];
    var issue = lampJumpIssue(dir);
    if (issue.type) return [issue];
    var to = issue.to;
    var from = floorIndex;
    floorIndex = to;
    hero.x = issue.landing.x;
    hero.y = issue.landing.y;
    save();
    publish();
    return [{
      type: 'stairs', from: from, to: to, via: 'lamp',
      message: '引路灯符一闪，' + (dir === 'up' ? '上到 ' : '下到 ') + DATA.floors[to].name
    }];
  }

  function useItem(id, arg) {
    if (won) return [];
    if (id === 'lamp') return useLamp(arg);
    return [{ type: 'blocked', reason: 'unknown', message: '不认识的道具' }];
  }

  function saveData() {
    return {
      version: 6,
      floor: floorIndex,
      hero: hero,
      steps: steps,
      won: won,
      maxFloor: maxFloor,
      maps: maps.map(function (rows) {
        return rows.map(function (row) {
          return row.join('');
        });
      })
    };
  }

  function save() {
    try {
      localStorage.setItem(storageKey(SAVE_KEY), JSON.stringify(saveData()));
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveCheckpoint() {
    try {
      localStorage.setItem(storageKey(CHECKPOINT_KEY), JSON.stringify(saveData()));
      return true;
    } catch (e) {
      return false;
    }
  }

  function validSave(s) {
    if (!s || typeof s !== 'object') return false;
    if (!isInt(s.floor) || s.floor < 0 || s.floor >= DATA.floors.length) return false;
    if (!isInt(s.maxFloor) || s.maxFloor < s.floor || s.maxFloor >= DATA.floors.length) return false;
    if (!isNum(s.steps) || s.steps < 0) return false;
    if (typeof s.won !== 'boolean') return false;
    var h = s.hero;
    if (!h || typeof h !== 'object') return false;
    if (!isInt(h.x) || !isInt(h.y) || h.x < 0 || h.y < 0 || h.x >= SIZE || h.y >= SIZE) return false;
    if (DIR_NAMES.indexOf(h.dir) < 0) return false;
    if (!isNum(h.hp) || !isNum(h.atk) || !isNum(h.def) || !isNum(h.gold)) return false;
    if (!h.keys || typeof h.keys !== 'object') return false;
    for (var i = 0; i < KEY_KINDS.length; i++) {
      var kv = h.keys[KEY_KINDS[i]];
      if (!isInt(kv) || kv < 0) return false;
    }
    if (!h.items || !isInt(h.items.lamp)) return false;
    if (h.items.lamp < 0) return false;
    if (!Array.isArray(s.maps) || s.maps.length !== DATA.floors.length) return false;
    for (var f = 0; f < s.maps.length; f++) {
      var rows = s.maps[f];
      if (!Array.isArray(rows) || rows.length !== SIZE) return false;
      for (var y = 0; y < rows.length; y++) {
        if (typeof rows[y] !== 'string' || rows[y].length !== SIZE) return false;
        for (var x = 0; x < SIZE; x++) {
          if (!DATA.tiles[rows[y].charAt(x)]) return false;
        }
      }
    }
    return true;
  }

  function readStored(key) {
    var raw = null;
    try {
      raw = localStorage.getItem(storageKey(key));
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    var s = null;
    try {
      s = JSON.parse(raw);
    } catch (e) {
      return null;
    }
    return validSave(s) ? s : null;
  }

  function restore(s) {
    maps = s.maps.map(function (rows) {
      return rows.map(function (row) {
        return row.split('');
      });
    });
    floorIndex = s.floor;
    steps = s.steps;
    won = s.won;
    maxFloor = s.maxFloor;
    hero = {
      x: s.hero.x, y: s.hero.y, dir: s.hero.dir,
      hp: s.hero.hp, atk: s.hero.atk, def: s.hero.def, gold: s.hero.gold,
      keys: keysFrom(s.hero.keys),
      items: { lamp: s.hero.items.lamp }
    };
    publish();
  }

  function load() {
    var s = readStored(SAVE_KEY);
    if (!s) return false;
    restore(s);
    return true;
  }

  function hasSave() {
    try {
      return !!localStorage.getItem(storageKey(SAVE_KEY));
    } catch (e) {
      return false;
    }
  }

  function hasCheckpoint() {
    return !!readStored(CHECKPOINT_KEY);
  }

  function getCheckpointInfo() {
    var s = readStored(CHECKPOINT_KEY);
    if (!s) return null;
    var act = findAct(actIdOfFloor(s.floor));
    return {
      act: act ? act.id : null,
      title: act ? act.title : '',
      floor: s.floor,
      floorName: DATA.floors[s.floor].name,
      steps: s.steps
    };
  }

  function loadCheckpoint() {
    var s = readStored(CHECKPOINT_KEY);
    if (!s) return false;
    restore(s);
    save();
    return true;
  }

  function newGame() {
    try {
      localStorage.removeItem(storageKey(CHECKPOINT_KEY));
    } catch (e) {}
    init();
  }

  /* 调试模式开关（DESIGN §8.8）：只改内存里的标记，不写存档、不写 localStorage。
   * 切换后存储键也跟着换（storageKey 每次现算） */
  function setDebug(on) {
    debug = !!on;
  }

  function isDebug() {
    return debug;
  }

  var Game = {
    SIZE: SIZE,
    state: null,
    init: newGame,
    getFloorName: getFloorName,
    getItemScale: getItemScale,
    getTile: getTile,
    move: move,
    getBattleInfo: getBattleInfo,
    getFloorMonsters: getFloorMonsters,
    getActMonsters: getActMonsters,
    getGoldPlan: getGoldPlan,
    getClosedDoors: getClosedDoors,
    getShopName: getShopName,
    getShopGoods: getShopGoods,
    buyGoods: buyGoods,
    getVisitedFloors: getVisitedFloors,
    getAct: getAct,
    getActs: getActs,
    useItem: useItem,
    lampJump: lampJump,
    canLampJump: canLampJump,
    save: save,
    load: load,
    hasSave: hasSave,
    hasCheckpoint: hasCheckpoint,
    getCheckpointInfo: getCheckpointInfo,
    loadCheckpoint: loadCheckpoint,
    setDebug: setDebug,
    isDebug: isDebug
  };

  window.Game = Game;
  init();
})();