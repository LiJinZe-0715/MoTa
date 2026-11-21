'use strict';
/* 用真实引擎（js/data.js + js/engine.js）跑几种玩家，报告谁能通、卡在哪、剩多少血。
 * 用法：node tools/playtest.js [--verbose] [--only 名字]
 *
 * 玩家只通过 Game 接口行动（move / buyGoods / getBattleInfo / save），地图从存档里读，
 * 所以测到的就是真实规则。每一步：
 *   1. 把能免费走到的物品全捡了（跨楼层）。
 *   2. 在所有挡在可达区域边上的怪和门里，挑「收益 − 代价」最大的一个处理掉。
 *      收益 = 新打开区域里的东西折成生命 + 怪的金币；代价 = 掉的血或用掉的钥匙。
 *   3. 按自己的习惯花钱。
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..');
var VERBOSE = process.argv.indexOf('--verbose') >= 0;
/* 核心原则（用户定）：金币只买攻防不买血；先打「金币 / 耗血」最高的怪。--old 用回旧的打法 */
var CORE = process.argv.indexOf('--old') < 0;
var onlyIdx = process.argv.indexOf('--only');
var ONLY = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

function makeGame() {
  var store = {};
  var ctx = {
    console: console,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'engine.js'), 'utf8'), ctx);
  return { Game: ctx.Game, store: store, data: ctx.TOWER_DATA };
}

var DIRS = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];

function Player(profile) {
  var env = makeGame();
  var Game = env.Game, DATA = env.data, store = env.store;
  var N = DATA.gridSize;
  var log = [];
  var floorLog = {};

  function snap() {
    Game.save();
    var s = JSON.parse(store['emberTower.save.v6']);
    return { maps: s.maps.map(function (r) { return r.map(function (row) { return row.split(''); }); }), st: Game.state };
  }
  function type(ch) { var t = DATA.tiles[ch]; return t ? t.type : 'wall'; }
  function findIn(rows, ch) {
    for (var y = 0; y < N; y++) { var x = rows[y].indexOf(ch); if (x >= 0) return { x: x, y: y }; }
    return null;
  }
  function key(f, x, y) { return f + ',' + x + ',' + y; }

  /* 跨层 BFS：返回可达格子（含路径）与边界上的阻挡物 */
  function explore(sn) {
    var maps = sn.maps, h = sn.st.hero;
    var start = [sn.st.floor, h.x, h.y];
    var prev = {};
    prev[key(start[0], start[1], start[2])] = null;
    var q = [start];
    var frontier = {};
    var nodes = [];
    while (q.length) {
      var c = q.shift();
      nodes.push(c);
      for (var i = 0; i < 4; i++) {
        var d = DIRS[i], nf = c[0], nx = c[1] + d[1], ny = c[2] + d[2];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        var ch = maps[nf][ny][nx], t = type(ch);
        if (t === 'wall') continue;
        if (t === 'monster' || t === 'door') {
          var fk = key(nf, nx, ny);
          if (!frontier[fk]) frontier[fk] = { f: nf, x: nx, y: ny, ch: ch, from: c, dir: d[0] };
          continue;
        }
        var tf = nf, tx = nx, ty = ny;
        if (t === 'stairsUp' && nf + 1 < maps.length) { var dn = findIn(maps[nf + 1].map(function (r) { return r.join(''); }), '<'); if (!dn) continue; tf = nf + 1; tx = dn.x; ty = dn.y; }
        else if (t === 'stairsDown' && nf > 0) { var up = findIn(maps[nf - 1].map(function (r) { return r.join(''); }), '>'); if (!up) continue; tf = nf - 1; tx = up.x; ty = up.y; }
        else if (t === 'stairsDown' || t === 'stairsUp') continue;
        var k = key(tf, tx, ty);
        if (k in prev) continue;
        prev[k] = { from: c, dir: d[0], via: [nf, nx, ny] };
        q.push([tf, tx, ty]);
      }
    }
    return { nodes: nodes, prev: prev, frontier: frontier };
  }

  function pathTo(ex, target) {
    var dirs = [];
    var k = key(target[0], target[1], target[2]);
    while (ex.prev[k]) { dirs.unshift(ex.prev[k].dir); var p = ex.prev[k].from; k = key(p[0], p[1], p[2]); }
    return dirs;
  }

  function walk(dirs) {
    for (var i = 0; i < dirs.length; i++) {
      var ev = Game.move(dirs[i]);
      for (var j = 0; j < ev.length; j++) {
        if (ev[j].type === 'blocked') throw new Error('走路被拦：' + ev[j].message);
        if (ev[j].type === 'win') return true;
      }
    }
    return false;
  }

  /* ---------- 估值（折成生命） ---------- */
  function dmg(m, atk, def) {
    if (atk <= m.def) return null;
    var turns = Math.ceil(m.hp / (atk - m.def));
    return (turns - 1) * Math.max(0, m.atk - def);
  }
  function remainingMonsters(sn) {
    var list = [];
    sn.maps.forEach(function (rows) { rows.forEach(function (row) { row.forEach(function (ch) { if (type(ch) === 'monster') list.push(DATA.monsters[ch]); }); }); });
    return list;
  }
  function statValue(sn, dAtk, dDef) {
    var h = sn.st.hero, total = 0;
    remainingMonsters(sn).forEach(function (m) {
      var a = dmg(m, h.atk, h.def), b = dmg(m, h.atk + dAtk, h.def + dDef);
      var w = m.boss ? 1 : profile.futureWeight;
      if (a === null && b === null) return;
      if (a === null) { total += w * 150; return; }
      total += w * (a - b);
    });
    return total;
  }
  function goldHp(sn) {
    return Math.max(200, statValue(sn, 2, 0), statValue(sn, 0, 2)) / 25;
  }
  function itemValue(sn, ch) {
    var e = (DATA.tiles[ch] || {}).effect || {};
    var v = 0;
    if (e.hp) v += e.hp;
    if (e.atk) v += statValue(sn, e.atk, 0);
    if (e.def) v += statValue(sn, 0, e.def);
    if (e.yellow) v += 10 * goldHp(sn) * profile.keyWeight;
    if (e.blue) v += 40 * goldHp(sn) * profile.keyWeight;
    if (e.red) v += 400;
    return v;
  }

  /* 去掉阻挡物 b 之后，新打开区域里的东西 */
  function opened(sn, ex, b) {
    var seen = {};
    ex.nodes.forEach(function (n) { seen[key(n[0], n[1], n[2])] = true; });
    var q = [[b.f, b.x, b.y]], val = 0, newFloor = false, goal = false;
    var mark = {};
    mark[key(b.f, b.x, b.y)] = true;
    var maxF = sn.st.maxFloor;
    while (q.length) {
      var c = q.shift();
      for (var i = 0; i < 4; i++) {
        var nx = c[1] + DIRS[i][1], ny = c[2] + DIRS[i][2], nf = c[0];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        var k = key(nf, nx, ny);
        if (mark[k] || seen[k]) continue;
        var ch = sn.maps[nf][ny][nx], t = type(ch);
        if (t === 'wall' || t === 'monster' || t === 'door') continue;
        mark[k] = true;
        if (t === 'item') val += itemValue(sn, ch);
        if (t === 'goal') goal = true;
        if (t === 'stairsUp' && nf >= maxF) newFloor = true;
        if (t === 'stairsUp' || t === 'stairsDown') continue;
        q.push([nf, nx, ny]);
      }
    }
    return { value: val, newFloor: newFloor, goal: goal };
  }

  function keyName(k) { return { yellow: 'ykey', blue: 'bkey', red: 'rkey' }[k]; }
  function shopId(prefix) {
    var goods = Game.getShopGoods();
    for (var i = 0; i < goods.length; i++) {
      if (goods[i].id.indexOf(prefix) !== 0 || goods[i].old) continue;
      var id = goods[i].id;
      return DATA.shop.goods.filter(function (g) { return g.id === id; })[0];
    }
    return null;
  }

  function candidates(sn, ex) {
    var out = [];
    var h = sn.st.hero;
    Object.keys(ex.frontier).forEach(function (k) {
      var b = ex.frontier[k];
      var t = type(b.ch);
      var gain = opened(sn, ex, b);
      var c = { b: b, gain: gain.value, newFloor: gain.newFloor, goal: gain.goal };
      if (t === 'monster') {
        var info = Game.getBattleInfo(b.ch);
        if (!info.canHit || info.damage >= h.hp) return;
        c.kind = 'fight';
        c.cost = info.damage;
        c.gain += info.gold * goldHp(sn);
        c.name = info.name;
      } else {
        var kk = DATA.tiles[b.ch].key;
        c.kind = 'door';
        c.keyKind = kk;
        c.name = DATA.tiles[b.ch].name;
        if (h.keys[kk] > 0) c.cost = (kk === 'yellow' ? 10 : kk === 'blue' ? 40 : 0) * goldHp(sn) * profile.keyWeight + (kk === 'red' ? 400 : 0);
        else {
          var g = shopId(keyName(kk));
          if (!g || h.gold < g.price) return;
          c.buy = g.id;
          c.cost = g.price * goldHp(sn);
        }
      }
      c.score = c.gain - c.cost + (c.newFloor ? profile.explore : 0) + (c.goal ? 1e6 : 0);
      out.push(c);
    });
    return out;
  }

  function shop() {
    var n = 0;
    for (;;) {
      var sn = snap();
      var h = sn.st.hero;
      var hp = shopId('hp'), atk = shopId('atk'), def = shopId('def');
      /* 核心原则（用户定）：金币只买攻防，不买血 */
      var cheapest = Math.min(atk ? atk.price : Infinity, def ? def.price : Infinity);
      if (!isFinite(cheapest) || h.gold < cheapest) return n;
      var reserve = profile.reserve || 0;
      if (h.gold - cheapest < reserve) return n;
      var pick = null;
      if (profile.shop === 'none') return n;
      if (profile.shop === 'atk') pick = atk;
      else if (profile.shop === 'hp' && !CORE) pick = hp;
      else if (profile.shop === 'def') pick = def;
      else if (profile.shop === 'even') pick = (evenCount++ % 2) ? def : atk;
      else {
        var va = statValue(sn, atk.effect.atk, 0), vd = statValue(sn, 0, def.effect.def), vh = hp.effect.hp;
        pick = CORE ? (va >= vd ? atk : def) : (va >= vd && va >= vh ? atk : vd >= vh ? def : hp);
      }
      if (!pick || h.gold < pick.price) return n;
      Game.buyGoods(pick.id);
      n++;
    }
  }

  var scriptPos = 0;
  /* 每幕打通时的快照（第一次走到下一幕的那一刻；最后一幕在通关时记），口径同成绩上传（DESIGN §8.7） */
  var actSnaps = {};
  function snapHero() {
    var h = Game.state.hero;
    return { hp: h.hp, atk: h.atk, def: h.def, gold: h.gold, yellow: h.keys.yellow };
  }
  var floorSnaps = {};
  function checkActs(won) {
    var mf = Game.state.maxFloor + 1;
    if (!floorSnaps[mf]) floorSnaps[mf] = snapHero();
    (DATA.acts || []).forEach(function (a, i, all) {
      if (actSnaps[a.id]) return;
      if (Game.state.maxFloor >= a.to || (won && i === all.length - 1)) actSnaps[a.id] = snapHero();
    });
  }
  var evenCount = 0;
  var minHp = Infinity, minHpAt = '';
  this.run = function () {
    var guard = 0;
    for (;;) {
      if (++guard > 5000) return finish('循环过多');
      checkActs(false);
      if (!profile.script) shop();
      var sn = snap();
      var ex = explore(sn);
      /* 1. 捡免费物品 */
      var item = null;
      for (var i = 0; i < ex.nodes.length; i++) {
        var n = ex.nodes[i], ch = sn.maps[n[0]][n[2]][n[1]], t = type(ch);
        if (t === 'goal') { walk(pathTo(ex, n)); return finish('通关'); }
        if (t === 'item') { item = n; break; }
      }
      if (item) { walk(pathTo(ex, item)); continue; }
      /* 2. 处理一个阻挡物 */
      if (profile.script) {
        var act = profile.script[scriptPos++];
        if (!act) return finish('剧本走完');
        if (act.buy) { var br = Game.buyGoods(act.buy); if (!br.ok) return finish('买不了 ' + act.buy + '：' + br.message); continue; }
        var fb = ex.frontier[key(act.f, act.x, act.y)];
        if (!fb) return finish('剧本里的 F' + (act.f + 1) + ' (' + act.x + ',' + act.y + ') 不在边界上');
        if (type(fb.ch) === 'door') {
          var kk2 = DATA.tiles[fb.ch].key;
          if (!(Game.state.hero.keys[kk2] > 0)) { var g2 = shopId(keyName(kk2)); if (!g2 || !Game.buyGoods(g2.id).ok) return finish('买不到钥匙'); }
        }
        walk(pathTo(ex, fb.from));
        var ev2 = Game.move(fb.dir);
        if (!ev2.some(function (e) { return e.type === 'battle' || e.type === 'door'; })) return finish('剧本动作被拦：' + JSON.stringify(ev2));
        if (VERBOSE) log.push('F' + (fb.f + 1) + ' ' + (type(fb.ch) === 'door' ? '开 ' + DATA.tiles[fb.ch].name : '打 ' + DATA.monsters[fb.ch].name) + '  hp=' + Game.state.hero.hp + ' atk=' + Game.state.hero.atk + ' def=' + Game.state.hero.def + ' gold=' + Game.state.hero.gold + ' 钥匙=' + JSON.stringify(Game.state.hero.keys));
        continue;
      }
      var list = candidates(sn, ex);
      if (profile.doorsFirst) {
        var doors = list.filter(function (c) { return c.kind === 'door' && !c.buy; });
        if (doors.length) list = doors;
      }
      if (!list.length) {
        /* 还有钱就买血 / 攻击再试一次 */
        var before = Game.state.hero.gold;
        var hpG = shopId('hp');
        if (CORE) {
          var aG = shopId('atk'), dG = shopId('def');
          var tryG = profile.shop === 'def' ? dG : aG;
          if (tryG && before >= tryG.price && profile.shop !== 'none') { Game.buyGoods(tryG.id); continue; }
          if (aG && before >= aG.price && profile.shop !== 'none') { Game.buyGoods(aG.id); continue; }
        } else if (hpG && before >= hpG.price && profile.shop !== 'none') { Game.buyGoods(profile.shop === 'atk' ? shopId('atk').id : hpG.id); continue; }
        return finish('卡住');
      }
      var c;
      if (CORE && !profile.doorsFirst) {
        /* 核心原则（用户定）：有钥匙、开了划算的门先开；然后打「金币 / 耗血」最高的怪（不掉血的最先）；最后才买钥匙开门 */
        var ownDoors = list.filter(function (x) { return x.kind === 'door' && !x.buy && x.score > 0; }).sort(function (a, b) { return b.score - a.score; });
        var fights = list.filter(function (x) { return x.kind === 'fight'; }).map(function (x) {
          x.ratio = DATA.monsters[x.b.ch].gold / Math.max(0.001, x.cost); return x;
        }).sort(function (a, b) { return b.ratio - a.ratio || a.cost - b.cost; });
        var rest = list.filter(function (x) { return x.kind === 'door'; }).sort(function (a, b) { return b.score - a.score; });
        c = ownDoors[0] || fights[0] || rest[0];
      } else {
        list.sort(function (a, b) { return b.score - a.score; });
        c = list[0];
      }
      if (c.buy) Game.buyGoods(c.buy);
      walk(pathTo(ex, c.b.from));
      var ev = Game.move(c.b.dir);
      var hit = ev.filter(function (e) { return e.type === 'battle' || e.type === 'door'; })[0];
      if (!hit) return finish('意外被拦：' + JSON.stringify(ev));
      var fl = c.b.f + 1;
      if (Game.state.hero.hp < minHp) { minHp = Game.state.hero.hp; minHpAt = 'F' + fl; }
      (floorLog[fl] = floorLog[fl] || []).push(c.kind === 'fight' ? c.name + '-' + c.cost : c.name);
      if (VERBOSE) log.push('F' + fl + ' ' + (c.kind === 'fight' ? '打 ' + c.name + ' 损 ' + c.cost : '开 ' + c.name) + '  hp=' + Game.state.hero.hp + ' atk=' + Game.state.hero.atk + ' def=' + Game.state.hero.def + ' gold=' + Game.state.hero.gold);
    }
    function finish(result) {
      checkActs(result === '通关');
      var h = Game.state.hero;
      return { result: result, actSnaps: actSnaps, floorSnaps: floorSnaps, minHp: minHp, minHpAt: minHpAt, floor: Game.state.floor + 1, maxFloor: Game.state.maxFloor + 1, hp: h.hp, atk: h.atk, def: h.def, gold: h.gold, keys: h.keys, log: log, floorLog: floorLog };
    }
  };
}

/* ---------- 高手：束搜索（快速模型），找到的路线再用真实引擎回放验证 ---------- */
function beamSearch(width, STATW) {
  var DATA = makeGame().data;
  var N = DATA.gridSize, F = DATA.floors.length, CELLS = N * N;
  var grid = [];
  DATA.floors.forEach(function (fl) { fl.map.forEach(function (row) { for (var x = 0; x < N; x++) grid.push(row.charAt(x)); }); });
  function T(ch) { var t = DATA.tiles[ch]; return t ? t.type : 'wall'; }
  var startIdx = grid.indexOf('@');
  /* 邻接：同层四邻 + 楼梯（> 与上一层同格的 < 相连） */
  var nbr = [];
  for (var i = 0; i < grid.length; i++) {
    var f = Math.floor(i / CELLS), r = i % CELLS, x = r % N, y = Math.floor(r / N), list = [];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var nx = x + d[0], ny = y + d[1];
      if (nx >= 0 && ny >= 0 && nx < N && ny < N) list.push(f * CELLS + ny * N + nx);
    });
    if (grid[i] === '>' && f + 1 < F) list.push(i + CELLS);
    if (grid[i] === '<' && f > 0) list.push(i - CELLS);
    nbr.push(list);
  }
  var mons = [];
  for (i = 0; i < grid.length; i++) if (T(grid[i]) === 'monster') mons.push(i);
  var goods = {};
  DATA.shop.goods.forEach(function (g) { if (!g.hideFloor && !g.showFloor || true) goods[g.id] = g; });
  var price = { hp: goods.hp1, atk: goods.atk1, def: goods.def1, yellow: goods.ykey1, blue: goods.bkey1 };

  function dmg(m, atk, def) {
    if (atk <= m.def) return null;
    return (Math.ceil(m.hp / (atk - m.def)) - 1) * Math.max(0, m.atk - def);
  }
  /* 状态：removed 是 Uint8Array（1 = 已清除），其余是数值 */
  function region(st) {
    var seen = new Uint8Array(grid.length), q = [startIdx], frontier = [], items = [], goal = false;
    seen[startIdx] = 1;
    while (q.length) {
      var c = q.pop();
      var ch = grid[c], t = T(ch);
      if (t === 'goal') goal = true;
      if (t === 'item' && !st.rm[c]) items.push(c);
      var nb = nbr[c];
      for (var k = 0; k < nb.length; k++) {
        var n = nb[k];
        if (seen[n]) continue;
        var nt = T(grid[n]);
        if (nt === 'wall') continue;
        if ((nt === 'monster' || nt === 'door') && !st.rm[n]) { seen[n] = 1; frontier.push(n); continue; }
        seen[n] = 1;
        q.push(n);
      }
    }
    return { frontier: frontier, items: items, goal: goal };
  }
  function collect(st) {
    var rg = region(st);
    rg.items.forEach(function (c) {
      var e = DATA.tiles[grid[c]].effect;
      st.rm[c] = 1;
      st.hp += e.hp || 0; st.atk += e.atk || 0; st.def += e.def || 0;
      st.y += e.yellow || 0; st.b += e.blue || 0; st.r += e.red || 0;
    });
    st.goal = rg.goal;
    return rg;
  }
  function clone(st) {
    return { rm: st.rm.slice(), hp: st.hp, atk: st.atk, def: st.def, gold: st.gold, y: st.y, b: st.b, r: st.r, acts: st.acts, goal: false };
  }
  function evalState(st) {
    var va = 0, vd = 0;
    for (var k = 0; k < mons.length; k++) {
      if (st.rm[mons[k]]) continue;
      var m = DATA.monsters[grid[mons[k]]], w = m.boss ? 1 : 0.35;
      var a = dmg(m, st.atk, st.def), b = dmg(m, st.atk + 1, st.def), c = dmg(m, st.atk, st.def + 1);
      if (a === null) { if (b !== null) va += w * 100; continue; }
      va += w * (a - b); vd += w * (a - c);
    }
    return st.hp + va * STATW + vd * STATW + st.gold * 8 + st.y * 70 + st.b * 250 + st.r * 600;
  }
  var root = { rm: new Uint8Array(grid.length), hp: DATA.hero.hp, atk: DATA.hero.atk, def: DATA.hero.def, gold: DATA.hero.gold,
    y: DATA.hero.keys.yellow, b: DATA.hero.keys.blue, r: DATA.hero.keys.red, acts: null };
  collect(root);
  var beam = [root], best = null, layer = 0, lastBeam = null;
  while (beam.length && layer < 400) {
    layer++;
    var next = [], seenKey = {};
    beam.forEach(function (st) {
      var rg = region(st);
      function push(child, act) {
        child.acts = { act: act, prev: st.acts };
        collect(child);
        if (child.goal) { if (!best || child.hp > best.hp) best = child; return; }
        var hk = child.hp + ',' + child.atk + ',' + child.def + ',' + child.gold + ',' + child.y + ',' + child.b + ',' + child.r + ',' + Array.prototype.join.call(child.rm, '');
        if (seenKey[hk]) return;
        seenKey[hk] = 1;
        child.score = evalState(child);
        next.push(child);
      }
      rg.frontier.forEach(function (c) {
        var ch = grid[c], t = T(ch), f = Math.floor(c / CELLS), rr = c % CELLS, act = { f: f, x: rr % N, y: Math.floor(rr / N) };
        var child;
        if (t === 'monster') {
          var m = DATA.monsters[ch], d = dmg(m, st.atk, st.def);
          if (d === null || d >= st.hp) return;
          child = clone(st); child.hp -= d; child.gold += m.gold; child.rm[c] = 1;
          push(child, act);
        } else {
          var kk = DATA.tiles[ch].key, slot = kk === 'yellow' ? 'y' : kk === 'blue' ? 'b' : 'r';
          child = clone(st);
          if (child[slot] > 0) child[slot]--;
          else if (price[kk] && child.gold >= price[kk].price) child.gold -= price[kk].price;
          else return;
          child.rm[c] = 1;
          push(child, act);
        }
      });
      ['atk', 'def', 'hp'].forEach(function (k) {
        if (st.gold < price[k].price) return;
        var child = clone(st);
        child.gold -= price[k].price;
        var e = price[k].effect;
        child.hp += e.hp || 0; child.atk += e.atk || 0; child.def += e.def || 0;
        push(child, { buy: price[k].id });
      });
    });
    next.sort(function (a, b) { return b.score - a.score; });
    beam = next.slice(0, width);
    if (beam.length) lastBeam = beam;
  }
  if (!best && lastBeam && VERBOSE) {
    var top = lastBeam[0], fl = 0;
    for (var q2 = 0; q2 < grid.length; q2++) if (top.rm[q2]) fl = Math.max(fl, Math.floor(q2 / CELLS));
    console.log('搜索停在第 ' + layer + ' 步：最好的状态 hp=' + top.hp + ' atk=' + top.atk + ' def=' + top.def + ' gold=' + top.gold + ' 钥匙 ' + top.y + '/' + top.b + '/' + top.r + '，清到 F' + (fl + 1));
    var rg2 = region(top);
    rg2.frontier.forEach(function (c) { var ch = grid[c]; var m = DATA.monsters[ch]; console.log('   边界 F' + (Math.floor(c / CELLS) + 1) + ' (' + (c % CELLS) % N + ',' + Math.floor((c % CELLS) / N) + ') ' + (m ? m.name + ' 损 ' + dmg(m, top.atk, top.def) : DATA.tiles[ch].name)); });
  }
  if (!best) return null;
  var acts = [];
  for (var a = best.acts; a; a = a.prev) acts.unshift(a.act);
  return { hp: best.hp, atk: best.atk, def: best.def, gold: best.gold, acts: acts };
}

var PROFILES = [
  { name: '会算账 · 按收益买', shop: 'smart', reserve: 10, futureWeight: 0.6, keyWeight: 1, explore: 0 },
  { name: '会算账 · 只买攻击', shop: 'atk', reserve: 10, futureWeight: 0.6, keyWeight: 1, explore: 0 },
  { name: '会算账 · 只买防御', shop: 'def', reserve: 10, futureWeight: 0.6, keyWeight: 1, explore: 0 },
  { name: '会算账 · 攻防轮流', shop: 'even', reserve: 10, futureWeight: 0.6, keyWeight: 1, explore: 0 },
  { name: '开门优先 · 有钥匙就开', shop: 'smart', futureWeight: 0.6, keyWeight: 0, explore: 0, doorsFirst: true },
  { name: '只买血', shop: 'hp', futureWeight: 0.6, keyWeight: 1, explore: 0 },
  { name: '一分不花', shop: 'none', futureWeight: 0.6, keyWeight: 1, explore: 0 }
];

if (process.argv.indexOf('--sweep') >= 0) {
  var runs = [], stuckAt = {};
  var SHOPS = process.env.SWEEP_SHOPS ? process.env.SWEEP_SHOPS.split(',') : ['smart', 'even', 'atk', 'def'];
  SHOPS.forEach(function (shop) {
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(function (fw) {
      [0.5, 1, 2].forEach(function (kw) {
        [0, 10, 20].forEach(function (rs) {
          var r = new Player({ shop: shop, futureWeight: fw, keyWeight: kw, reserve: rs, explore: 0 }).run();
          runs.push({ shop: shop, fw: fw, kw: kw, rs: rs, r: r });
          if (r.result !== '通关') stuckAt['F' + r.maxFloor] = (stuckAt['F' + r.maxFloor] || 0) + 1;
        });
      });
    });
  });
  var wins = runs.filter(function (x) { return x.r.result === '通关'; });
  var hps = wins.map(function (x) { return x.r.hp; }).sort(function (a, b) { return a - b; });
  console.log('习惯扫描：' + runs.length + ' 种里通关 ' + wins.length + ' 种（' + Math.round(100 * wins.length / runs.length) + '%）');
  if (hps.length) console.log('通关剩血：最少 ' + hps[0] + '，中位 ' + hps[Math.floor(hps.length / 2)] + '，最多 ' + hps[hps.length - 1]);
  console.log('没通关的最远到：' + JSON.stringify(stuckAt));
  var acts = makeGame().data.acts;
  function q(arr, f) { if (!arr.length) return '-'; var a = arr.slice().sort(function (x, y) { return x - y; }); return a[Math.min(a.length - 1, Math.floor(f * a.length))]; }
  acts.forEach(function (a) {
    var snaps = runs.map(function (x) { return x.r.actSnaps[a.id]; }).filter(Boolean);
    var hp = snaps.map(function (s) { return s.hp; }), gold = snaps.map(function (s) { return s.gold; }), yk = snaps.map(function (s) { return s.yellow; });
    console.log('  ' + a.title + '：打通 ' + snaps.length + '/' + runs.length + '，打通时生命 中位 ' + q(hp, 0.5) + ' / 前 10% ' + q(hp, 0.9) + ' / 最高 ' + q(hp, 1) +
      '；攻 / 防 中位 ' + q(snaps.map(function (s) { return s.atk; }), 0.5) + ' / ' + q(snaps.map(function (s) { return s.def; }), 0.5) + '；剩金 中位 ' + q(gold, 0.5) + ' / 最高 ' + q(gold, 1) + '；剩黄钥 中位 ' + q(yk, 0.5) + ' / 最高 ' + q(yk, 1));
  });
  if (process.argv.indexOf('--floors') >= 0) {
    console.log('  第一次到达各层（中位，按买法）  层: 攻/防/血/金');
    var floorJson = {};
    SHOPS.forEach(function (shop) {
      var line = [];
      floorJson[shop] = {};
      for (var f = 1, NF = makeGame().data.floors.length; f <= NF; f++) {
        var ss = runs.filter(function (x) { return x.shop === shop; }).map(function (x) { return x.r.floorSnaps[f]; }).filter(Boolean);
        if (!ss.length) break;
        floorJson[shop][f] = [q(ss.map(function (s) { return s.atk; }), 0.5), q(ss.map(function (s) { return s.def; }), 0.5)];
        line.push('F' + f + ' ' + q(ss.map(function (s) { return s.atk; }), 0.5) + '/' + q(ss.map(function (s) { return s.def; }), 0.5) + '/' + q(ss.map(function (s) { return s.hp; }), 0.5) + '/' + q(ss.map(function (s) { return s.gold; }), 0.5) + '(' + ss.length + ')');
      }
      console.log('  ' + shop + '：' + line.join('  '));
    });
    if (process.env.FLOORS_OUT) require('fs').writeFileSync(process.env.FLOORS_OUT, JSON.stringify(floorJson));
  }
  SHOPS.forEach(function (shop) {
    var a = runs.filter(function (x) { return x.shop === shop; }), w = a.filter(function (x) { return x.r.result === '通关'; });
    var hps = w.map(function (x) { return x.r.hp; }).sort(function (p, q2) { return p - q2; });
    console.log('  ' + shop + '：' + w.length + '/' + a.length + (hps.length ? '，通关剩血中位 ' + hps[Math.floor(hps.length / 2)] : ''));
  });
  process.exit(0);
}

var widx = process.argv.indexOf('--search');
if (widx >= 0) {
  var width = Number(process.argv[widx + 1]) || 200;
  var t0 = Date.now();
  var sol = null;
  [0.5, 1, 2, 3].forEach(function (w) {
    var s1 = beamSearch(width, w);
    if (VERBOSE) console.log('  权重 ' + w + '：' + (s1 ? '通关剩 ' + s1.hp : '没通关'));
    if (s1 && (!sol || s1.hp > sol.hp)) sol = s1;
  });
  if (!sol) { console.log('高手（束宽 ' + width + '）：没找到通关路线'); process.exit(1); }
  var rep = new Player({ script: sol.acts }).run();
  console.log('高手（束宽 ' + width + '，' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒）：模型里通关剩 ' + sol.hp + ' 血；真实引擎回放 ' + rep.result + '，剩 ' + rep.hp + ' 血，攻 ' + rep.atk + ' 防 ' + rep.def + ' 金 ' + rep.gold);
  if (VERBOSE) rep.log.forEach(function (l) { console.log('   ' + l); });
  process.exit(0);
}

PROFILES.forEach(function (p) {
  if (ONLY && p.name.indexOf(ONLY) < 0) return;
  var r = new Player(p).run();
  var line = (p.name + '　　　　　　　　').slice(0, 14) + ' ' + r.result + (r.result === '通关' ? '' : '（F' + r.floor + '，到过 F' + r.maxFloor + '）') +
    '  生命 ' + r.hp + '  攻 ' + r.atk + '  防 ' + r.def + '  金 ' + r.gold + '  钥匙 黄' + r.keys.yellow + ' 蓝' + r.keys.blue + ' 红' + r.keys.red + '  最低生命 ' + r.minHp + '（' + r.minHpAt + '）';
  console.log(line);
  if (VERBOSE) { r.log.forEach(function (l) { console.log('   ' + l); }); console.log(''); }
});
