'use strict';
/* 结构性验收（DESIGN.md §9）。用法：node tools/audit.js [--report]
 * --report 额外打印每层的门、怪各自「守着什么」，用于设计复查。 */

var fs = require('fs');
var path = require('path');

var root = path.join(__dirname, '..');
var data = JSON.parse(fs.readFileSync(path.join(root, 'design', 'tower-data.json'), 'utf8'));
var REPORT = process.argv.indexOf('--report') >= 0;
var N = data.gridSize;
var fails = [];
var warns = [];

function fail(msg) { fails.push(msg); }
function warn(msg) { warns.push(msg); }
function tileOf(ch) { return data.tiles[ch]; }
function typeOf(ch) { var t = tileOf(ch); return t ? t.type : 'wall'; }

var ALLOWED_ITEMS = { y: 1, b: 1, r: 1, g: 1, d: 1, h: 1, H: 1, S: 1, Z: 1 };
var VALUE_NAMES = { y: '黄钥', b: '蓝钥', r: '红钥', g: '红宝', d: '蓝宝', h: '小油', H: '大油', S: '剑', Z: '盾', '>': '上楼', '<': '下楼', '*': '灯芯' };

/* ---------- 1. 格式 ---------- */
['title', 'gridSize', 'hero', 'tiles', 'monsters', 'shop', 'acts', 'floors', 'ranks'].forEach(function (k) {
  if (!(k in data)) fail('缺少顶层字段 ' + k);
});
if (typeof data.version !== 'string' || !data.version) fail('缺少版本号 version（改数值、改地图时改它，见 DESIGN §6）');
/* 1z. js/data.js 必须是用当前 tower-data.json 和 engine.js 生成的，否则上传的版本号对不上 */
(function () {
  var info = require('./build-info');
  var want = info.computeBuild(root), got = null;
  try {
    var ctx = { window: {} };
    require('vm').runInNewContext(fs.readFileSync(path.join(root, 'js', 'data.js'), 'utf8'), ctx);
    got = ctx.window.TOWER_DATA && ctx.window.TOWER_DATA.build;
  } catch (err) { got = null; }
  if (info.buildTag(got) !== info.buildTag(want)) {
    fail('js/data.js 过期：里面的版本是 ' + info.buildTag(got) + '，当前应为 ' + info.buildTag(want) + '，先跑 node tools/build-data.js');
  }
})();
['yellow', 'blue', 'red'].forEach(function (k) {
  if (!data.hero.keys || typeof data.hero.keys[k] !== 'number') fail('hero.keys 缺 ' + k);
});
Object.keys(data.tiles).forEach(function (ch) {
  var t = data.tiles[ch];
  if (t.type === 'monster' && !data.monsters[ch]) fail('怪物字符 ' + ch + ' 没有 monsters 条目');
  if (t.type === 'item' && !ALLOWED_ITEMS[ch]) fail('不允许的物品 ' + ch + '（' + t.name + '）');
  if (t.type === 'monster' && 'ybrgdh'.indexOf(ch) >= 0) fail('怪物编号占用了保留字符 ' + ch);
});
if (data.tiles.$) fail('还有金币袋 $');
Object.keys(data.monsters).forEach(function (id) {
  var m = data.monsters[id];
  ['hp', 'atk', 'def', 'gold'].forEach(function (k) {
    if (typeof m[k] !== 'number' || m[k] < 0) fail('怪物 ' + id + ' 的 ' + k + ' 不合法');
  });
});
data.shop.goods.forEach(function (g) {
  if (g.sell) fail('商品 ' + g.id + ' 还带 sell（不允许收购）');
  if (g.effect && g.effect.red) fail('商店不能卖红钥匙：' + g.id);
});

/* 1a. 新档上架时旧档如果还在卖（oldFloor），新档每金币换到的属性必须比旧档多；旧档到新档上架时就下架（hideFloor）的不比 */
['hp', 'atk', 'def'].forEach(function (stat) {
  var tiers = data.shop.goods.filter(function (g) {
    return g.effect && g.effect[stat] && Object.keys(g.effect).length === 1;
  }).sort(function (a, b) { return (a.showFloor || 1) - (b.showFloor || 1); });
  for (var i = 1; i < tiers.length; i++) {
    var prev = tiers[i - 1], cur = tiers[i];
    if (typeof prev.hideFloor === 'number' && prev.hideFloor <= (cur.showFloor || 1)) continue;
    if (!(cur.effect[stat] / cur.price > prev.effect[stat] / prev.price)) {
      fail('商店 ' + cur.id + '（' + cur.effect[stat] + ' / ' + cur.price + ' 金）每金币不比旧档 ' + prev.id + '（' + prev.effect[stat] + ' / ' + prev.price + ' 金）划算');
    }
  }
});

/* 1b. 金币要对得起数值：同一幕里数值全面不低于另一只（至少一项更高）的怪金币更多；跨幕时同标签的怪金币不少于上一幕（各幕价格不同，跨幕不直接比金币） */
function actOf(floor) {
  for (var i = 0; i < data.acts.length; i++) {
    var a = data.acts[i];
    if (a.from <= floor && floor <= a.to) return a;
  }
  return null;
}
function actNo(act) { return typeof act.id === 'number' ? act.id : data.acts.indexOf(act) + 1; }
function isBoss(m) { return m.kind === 'ADH' || m.boss === true; }

var seenMon = {};
data.floors.forEach(function (fl, fi) {
  fl.map.forEach(function (row) {
    for (var i = 0; i < row.length; i++) {
      var mch = row.charAt(i);
      if (data.monsters[mch] && !seenMon[mch]) seenMon[mch] = fi + 1;
    }
  });
});
var monIds = Object.keys(seenMon);

/* 幕内：数值全面不低于另一只（至少一项更高）的怪，金币必须更多 */
monIds.forEach(function (aid) {
  monIds.forEach(function (bid) {
    if (aid === bid) return;
    var actA = actOf(seenMon[aid]);
    if (!actA || actA !== actOf(seenMon[bid])) return;
    var a = data.monsters[aid], b = data.monsters[bid];
    if (a.hp >= b.hp && a.atk >= b.atk && a.def >= b.def &&
        (a.hp > b.hp || a.atk > b.atk || a.def > b.def) && a.gold <= b.gold) {
      fail('第' + actNo(actA) + '幕 怪物 ' + a.name + '（' + a.hp + '/' + a.atk + '/' + a.def + '，' + a.gold + ' 金）数值不低于 ' + b.name + '（' + b.hp + '/' + b.atk + '/' + b.def + '，' + b.gold + ' 金），金币却不比它多');
    }
  });
});

/* 跨幕：后一幕同标签（kind 相同）的怪，金币不少于上一幕；首领也按首领对首领比 */
monIds.forEach(function (aid) {
  var a = data.monsters[aid], actA = actOf(seenMon[aid]);
  var ai = data.acts.indexOf(actA);
  if (ai <= 0) return;
  var prevAct = data.acts[ai - 1];
  monIds.forEach(function (bid) {
    if (aid === bid) return;
    var b = data.monsters[bid];
    if (actOf(seenMon[bid]) !== prevAct) return;
    if (a.kind !== b.kind && !(isBoss(a) && isBoss(b))) return;
    if (a.gold < b.gold) {
      fail('第' + actNo(actA) + '幕 ' + a.name + '（' + a.kind + '，' + a.gold + ' 金）比上一幕同标签的 ' + b.name + '（' + b.gold + ' 金）金币还少');
    }
  });
});

var maps = data.floors.map(function (f, i) {
  if (f.map.length !== N) fail('F' + (i + 1) + ' 行数 ' + f.map.length);
  f.map.forEach(function (row, y) {
    if (row.length !== N) fail('F' + (i + 1) + ' 第 ' + y + ' 行长度 ' + row.length);
    for (var x = 0; x < row.length; x++) {
      var ch = row.charAt(x);
      if (!tileOf(ch)) fail('F' + (i + 1) + ' (' + x + ',' + y + ') 未知字符 ' + ch);
      if ((x === 0 || y === 0 || x === N - 1 || y === N - 1) && ch !== '#') fail('F' + (i + 1) + ' 外圈不是墙 (' + x + ',' + y + ')');
    }
  });
  return f.map.map(function (r) { return r.split(''); });
});

function find(f, ch) {
  var out = [];
  for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (maps[f][y][x] === ch) out.push({ x: x, y: y });
  return out;
}

/* ---------- 1b. 墙只有一格厚：任何 2×2 都不能全是墙（连外圈一起算） ---------- */
maps.forEach(function (rows, i) {
  for (var y = 0; y < N - 1; y++) for (var x = 0; x < N - 1; x++) {
    if (typeOf(rows[y][x]) === 'wall' && typeOf(rows[y][x + 1]) === 'wall' &&
        typeOf(rows[y + 1][x]) === 'wall' && typeOf(rows[y + 1][x + 1]) === 'wall') {
      fail('F' + (i + 1) + ' (' + x + ',' + y + ') 起有 2×2 的墙块（墙最多一格厚）');
    }
  }
});

/* ---------- 1c. 没有专门占位置的死路：空地格只连着一个方向就是死路，一层层剥掉，剥得掉就不合格 ---------- */
maps.forEach(function (rows, i) {
  var open = rows.map(function (r) { return r.map(function (ch) { return typeOf(ch) !== 'wall'; }); });
  var changed = true;
  while (changed) {
    changed = false;
    for (var y = 1; y < N - 1; y++) for (var x = 1; x < N - 1; x++) {
      if (!open[y][x] || rows[y][x] !== '.') continue;
      var deg = (open[y - 1][x] ? 1 : 0) + (open[y + 1][x] ? 1 : 0) + (open[y][x - 1] ? 1 : 0) + (open[y][x + 1] ? 1 : 0);
      if (deg <= 1) {
        fail('F' + (i + 1) + ' (' + x + ',' + y + ') 是空的死路');
        open[y][x] = false;
        changed = true;
      }
    }
  }
});

/* ---------- 2. 楼梯 ---------- */
var F = maps.length;
for (var f = 0; f < F; f++) {
  var ups = find(f, '>');
  var downs = find(f, '<');
  if (f === 0 && find(0, '@').length !== 1) fail('F1 要恰好一个出生点 @');
  if (f > 0 && downs.length !== 1) fail('F' + (f + 1) + ' 要恰好一个下楼梯');
  if (f < F - 1 && ups.length !== 1) fail('F' + (f + 1) + ' 要恰好一个上楼梯');
  if (f === F - 1 && find(f, '*').length + ups.length !== 1) fail('最后一层要有灯芯或上楼梯');
  if (f < F - 1 && ups.length === 1 && find(f + 1, '<').length === 1) {
    var u = ups[0], d = find(f + 1, '<')[0];
    if (u.x !== d.x || u.y !== d.y) fail('F' + (f + 1) + ' 上楼梯 (' + u.x + ',' + u.y + ') 与 F' + (f + 2) + ' 下楼梯 (' + d.x + ',' + d.y + ') 不同格');
  }
}

/* ---------- 2b. 楼梯不挡路：踩上楼梯就换层，所以楼梯两侧必须不经楼梯也能互通 ---------- */
var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function isStair(ch) { return ch === '<' || ch === '>'; }
maps.forEach(function (rows, fi) {
  /* (a) 把楼梯当墙，其余非墙格子必须连成一块 */
  var seen = {};
  var blocks = 0;
  for (var sy = 0; sy < N; sy++) for (var sx = 0; sx < N; sx++) {
    if (typeOf(rows[sy][sx]) === 'wall' || isStair(rows[sy][sx]) || seen[sy * N + sx]) continue;
    blocks++;
    seen[sy * N + sx] = true;
    var q = [[sx, sy]];
    while (q.length) {
      var c = q.shift(), cx = c[0], cy = c[1];
      DIRS.forEach(function (v) {
        var nx = cx + v[0], ny = cy + v[1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) return;
        if (seen[ny * N + nx]) return;
        var nch = rows[ny][nx];
        if (typeOf(nch) === 'wall' || isStair(nch)) return;
        seen[ny * N + nx] = true;
        q.push([nx, ny]);
      });
    }
  }
  if (blocks > 1) fail('F' + (fi + 1) + ' 被楼梯隔成 ' + blocks + ' 块：一侧只能下楼再上楼才过得去');

  /* (b) 每个楼梯：两侧邻居不打怪不开门也必须互通 */
  for (var py = 0; py < N; py++) for (var px = 0; px < N; px++) {
    if (!isStair(rows[py][px])) continue;
    var nb = [], nbSet = {};
    DIRS.forEach(function (v) {
      var nx = px + v[0], ny = py + v[1];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) return;
      var nch = rows[ny][nx];
      if (typeOf(nch) === 'wall' || isStair(nch)) return;
      nb.push([nx, ny]);
      nbSet[ny * N + nx] = true;
    });
    if (!nb.length) { fail('F' + (fi + 1) + ' 楼梯 (' + px + ',' + py + ') 四周没路'); continue; }
    var reach = {}, rq = [nb[0]];
    reach[nb[0][1] * N + nb[0][0]] = true;
    while (rq.length) {
      var rc = rq.shift(), rx = rc[0], ry = rc[1];
      DIRS.forEach(function (v) {
        var nx = rx + v[0], ny = ry + v[1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) return;
        var key = ny * N + nx;
        if (reach[key]) return;
        var nch = rows[ny][nx], t = typeOf(nch);
        var walkable = nbSet[key] || (t !== 'wall' && t !== 'door' && t !== 'monster' && !isStair(nch));
        if (!walkable) return;
        reach[key] = true;
        rq.push([nx, ny]);
      });
    }
    var blocked = nb.some(function (p) { return !reach[p[1] * N + p[0]]; });
    if (blocked) fail('F' + (fi + 1) + ' 楼梯 (' + px + ',' + py + ') 挡路：它两侧不打怪不开门只能经楼梯互通');
  }

  /* (c) 楼梯只放左下 (1,9) 和右上 (9,1)：单数层下楼梯（第 1 层是出生点）在左下、上楼梯在右上，
   *     双数层反过来；楼梯所在的角开成 2×2 小空场（两个邻格和斜对角都不是墙），邻格和斜对角不放怪、不放门 */
  var odd = fi % 2 === 0;
  var BL = [1, N - 2], TR = [N - 2, 1];
  var want = [[fi === 0 ? '@' : '<', odd ? BL : TR]];
  if (find(fi, '>').length) want.push(['>', odd ? TR : BL]);
  want.forEach(function (w) {
    var ch = w[0], p = w[1];
    if (rows[p[1]][p[0]] !== ch) { fail('F' + (fi + 1) + ' ' + (ch === '@' ? '出生点' : ch === '<' ? '下楼梯' : '上楼梯') + '应在 (' + p[0] + ',' + p[1] + ')'); return; }
    var dx = p[0] === 1 ? 1 : -1, dy = p[1] === 1 ? 1 : -1;
    [[p[0] + dx, p[1]], [p[0], p[1] + dy], [p[0] + dx, p[1] + dy]].forEach(function (c) {
      var t = typeOf(rows[c[1]][c[0]]);
      if (t === 'wall' || t === 'monster' || t === 'door') fail('F' + (fi + 1) + ' (' + p[0] + ',' + p[1] + ') 的楼梯角没开成 2×2：(' + c[0] + ',' + c[1] + ') 是' + (t === 'wall' ? '墙' : t === 'monster' ? '怪' : '门'));
    });
  });
});

/* ---------- 跨层连通 ---------- */
function entry(f) { return f === 0 ? find(0, '@')[0] : find(f, '<')[0]; }

/* blocked(f,x,y,ch) 为真的格子当墙；返回 visited 集合 "f,x,y" */
function flood(blocked) {
  var seen = {};
  var q = [];
  function push(f, x, y) {
    var k = f + ',' + x + ',' + y;
    if (seen[k]) return;
    var ch = maps[f][y][x];
    if (typeOf(ch) === 'wall' || blocked(f, x, y, ch)) return;
    seen[k] = true;
    q.push([f, x, y]);
  }
  var s = entry(0);
  push(0, s.x, s.y);
  while (q.length) {
    var c = q.shift(), cf = c[0], cx = c[1], cy = c[2];
    var ch = maps[cf][cy][cx];
    if (ch === '>' && cf + 1 < F) { var d = find(cf + 1, '<')[0]; if (d) push(cf + 1, d.x, d.y); }
    if (ch === '<' && cf > 0) { var u = find(cf - 1, '>')[0]; if (u) push(cf - 1, u.x, u.y); }
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
      var nx = cx + v[0], ny = cy + v[1];
      if (nx >= 0 && ny >= 0 && nx < N && ny < N) push(cf, nx, ny);
    });
  }
  return seen;
}

var all = flood(function () { return false; });
for (f = 0; f < F; f++) for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
  if (typeOf(maps[f][y][x]) !== 'wall' && !all[f + ',' + x + ',' + y]) fail('F' + (f + 1) + ' (' + x + ',' + y + ') 走不到');
}

/* ---------- 2d. 钥匙、门、宝石、大灯油、末层、金币的配额（DESIGN §3） ---------- */
(function () {
  var MONEY_ITEMS = 'ghdHySbrZ';
  /* 只有开这扇门才拿得到的东西 */
  function exclusive(df, dx, dy) {
    var seen = flood(function (f, x, y) { return f === df && x === dx && y === dy; }), out = [];
    for (var f = 0; f < F; f++) for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var ch = maps[f][y][x];
      if (MONEY_ITEMS.indexOf(ch) >= 0 && all[f + ',' + x + ',' + y] && !seen[f + ',' + x + ',' + y]) out.push(ch);
    }
    return out;
  }
  /* 除红门（幕末入口）外所有门都当墙还能走到的格子 = 不用钥匙就拿得到 */
  var free = flood(function (f, x, y, ch) { return typeOf(ch) === 'door' && ch !== 'R'; });
  function statPrice(actId) {
    var act = data.acts.filter(function (a) { return a.id === actId; })[0];
    if (!act) return null;
    var g = data.shop.goods.filter(function (g) { return g.effect && g.effect.atk && (g.showFloor || 1) === act.from; })[0];
    return g ? g.price : null;
  }
  data.shop.goods.forEach(function (g) { if (g.effect && g.effect.blue) fail('商店不能卖蓝钥匙：' + g.id); });
  /* 灯油：小灯油 = 一颗宝石 ×100，大灯油 = 小灯油 ×4（同一层物品倍率相同，只比基础值） */
  var hpS = data.tiles.h.effect.hp, hpB = data.tiles.H.effect.hp, gemV = data.tiles.g.effect.atk;
  if (hpS !== gemV * 100) fail('小灯油应为一颗宝石的 100 倍：' + hpS + ' ≠ ' + gemV + ' × 100');
  if (hpB !== hpS * 4) fail('大灯油应为小灯油的 4 倍：' + hpB + ' ≠ ' + hpS + ' × 4');
  var yk = data.shop.goods.filter(function (g) { return g.effect && g.effect.yellow; }).sort(function (a, b) { return (a.showFloor || 1) - (b.showFloor || 1); });
  for (var i = 1; i < yk.length; i++) if (yk[i].price !== yk[i - 1].price * 2) fail('黄钥匙每幕价格要 ×2：' + yk[i - 1].id + ' ' + yk[i - 1].price + ' → ' + yk[i].id + ' ' + yk[i].price);

  var monCount = {};
  data.acts.forEach(function (act) {
    var c = {}, gold = 0, sz = {};
    for (var f = act.from - 1; f < act.to; f++) for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var ch = maps[f][y][x];
      c[ch] = (c[ch] || 0) + 1;
      var m = data.monsters[ch];
      if (m && !m.boss) gold += m.gold;
      if (ch === 'H' && free[f + ',' + x + ',' + y]) fail('F' + (f + 1) + ' (' + x + ',' + y + ') 大灯油没有用钥匙守着');
      if (typeOf(ch) !== 'door') continue;
      var ex = exclusive(f, x, y), gems = ex.filter(function (e) { return e === 'g' || e === 'd'; }).length;
      if (ch === 'Y') {
        var bigs = ex.filter(function (e) { return e === 'H'; }).length;
        var other = ex.filter(function (e) { return 'gdH'.indexOf(e) < 0; });
        if (gems > 1 || bigs > 1 || other.length) fail('F' + (f + 1) + ' 黄门 (' + x + ',' + y + ') 后面只能放一颗宝石（可再加一瓶大灯油），现在是：' + ex.join(''));
      }
      if (ch === 'B') ex.forEach(function (e) { if (e === 'S' || e === 'Z') sz[e] = true; });
      if (ch === 'R') {
        if (f !== act.to - 2) fail('F' + (f + 1) + ' 红门应在第 ' + (act.to - 1) + ' 层，守最后一层的入口');
        var seenR = flood(function (ff, xx, yy) { return ff === f && xx === x && yy === y; });
        var lastIn = entry(act.to - 1);
        if (seenR[(act.to - 1) + ',' + lastIn.x + ',' + lastIn.y]) fail('F' + (f + 1) + ' 红门 (' + x + ',' + y + ') 没守住第 ' + act.to + ' 层的入口');
      }
    }
    var tag = '第' + act.id + '幕 ';
    if ((c.r || 0) !== 1 || (c.R || 0) !== 1) fail(tag + '红钥匙、红门各 1（现在 ' + (c.r || 0) + ' / ' + (c.R || 0) + '）');
    if ((c.b || 0) !== 2 || (c.B || 0) !== 2) fail(tag + '蓝钥匙、蓝门各 2（现在 ' + (c.b || 0) + ' / ' + (c.B || 0) + '）');
    if (!sz.S || !sz.Z) fail(tag + '剑和盾都要在蓝门后');
    var gap = (c.Y || 0) - (c.y || 0);
    if (gap < 0 || gap > 2) fail(tag + '黄门比地图上的黄钥匙最多多 2 扇（现在 黄钥 ' + (c.y || 0) + ' / 黄门 ' + (c.Y || 0) + '）');
    if ((c.g || 0) !== 10 || (c.d || 0) !== 10) fail(tag + '红、蓝宝石各 10 颗（现在 ' + (c.g || 0) + ' / ' + (c.d || 0) + '）');
    if ((c.h || 0) !== 20 || (c.H || 0) !== 5) fail(tag + '小灯油 20 瓶、大灯油 5 瓶（现在 ' + (c.h || 0) + ' / ' + (c.H || 0) + '）');
    maps[act.to - 1].forEach(function (row) { for (var i = 0; i < row.length; i++) { var m = data.monsters[row[i]];
      if (m && !m.boss && m.kind.length < 2) fail('F' + act.to + ' 最后一层只放双标签的怪：' + m.name + '（' + m.kind + '）'); } });
    var p = statPrice(act.id), pn = statPrice(act.id + 1);
    if (p && gold !== 20 * p) fail(tag + '除首领外的金币合计应为 20 次商店 = ' + 20 * p + '（现在 ' + gold + '）');
    var boss = data.monsters[act.boss];
    if (pn && boss && boss.gold !== pn) fail(tag + '首领金币应为下一幕一次商店 = ' + pn + '（现在 ' + boss.gold + '）');
  });
})();

/* ---------- 3. 房间图：墙和门、怪都当墙，剩下的连通块是「房间」，门和怪是房间之间的边 ---------- */
function isBlocker(ch) { var t = typeOf(ch); return t === 'door' || t === 'monster'; }
var roomOf = {};
var rooms = [];
for (f = 0; f < F; f++) for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
  var c0 = maps[f][y][x];
  if (typeOf(c0) === 'wall' || isBlocker(c0) || roomOf[f + ',' + x + ',' + y] !== undefined) continue;
  var id = rooms.length;
  var room = { id: id, cells: [], floors: {} };
  rooms.push(room);
  var q = [[f, x, y]];
  roomOf[f + ',' + x + ',' + y] = id;
  while (q.length) {
    var c = q.shift(), cf = c[0], cx = c[1], cy = c[2], ch = maps[cf][cy][cx];
    room.cells.push(c);
    room.floors[cf] = true;
    var nb = [];
    if (ch === '>' && cf + 1 < F) { var dd = find(cf + 1, '<')[0]; if (dd) nb.push([cf + 1, dd.x, dd.y]); }
    if (ch === '<' && cf > 0) { var uu = find(cf - 1, '>')[0]; if (uu) nb.push([cf - 1, uu.x, uu.y]); }
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) { nb.push([cf, cx + v[0], cy + v[1]]); });
    nb.forEach(function (n) {
      var k = n[0] + ',' + n[1] + ',' + n[2];
      var nch = maps[n[0]][n[2]][n[1]];
      if (typeOf(nch) === 'wall' || isBlocker(nch) || roomOf[k] !== undefined) return;
      roomOf[k] = id;
      q.push(n);
    });
  }
}
function roomText(r) {
  var counts = {};
  r.cells.forEach(function (p) {
    var ch = maps[p[0]][p[2]][p[1]];
    if (VALUE_NAMES[ch] && ch !== '<' && ch !== '>') counts[VALUE_NAMES[ch]] = (counts[VALUE_NAMES[ch]] || 0) + 1;
    if (ch === '@') counts['出生'] = 1;
    if (ch === '<' && p[0] > 0) counts['下楼'] = 1;
    if (ch === '>') counts['上楼'] = 1;
  });
  return Object.keys(counts).map(function (k) { return k + (counts[k] > 1 ? '×' + counts[k] : ''); }).join(' ') || '空';
}
var reports = [];
var roomEdges = {};
var roomBlockers = {};
for (f = 0; f < F; f++) {
  var lines = [];
  for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
    var ch = maps[f][y][x];
    if (!isBlocker(ch)) continue;
    var side = {};
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (v) {
      var r = roomOf[f + ',' + (x + v[0]) + ',' + (y + v[1])];
      if (r !== undefined) side[r] = true;
    });
    var ids = Object.keys(side).map(Number);
    var label = typeOf(ch) === 'door' ? tileOf(ch).name : data.monsters[ch].name;
    ids.forEach(function (r) { (roomEdges[r] = roomEdges[r] || []).push(label); (roomBlockers[r] = roomBlockers[r] || []).push({ f: f, x: x, y: y, ch: ch }); });
    if (ids.length < 2) {
      var nbBlock = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (v) { return isBlocker(maps[f][y + v[1]][x + v[0]]); });
      if (!nbBlock) {
        if (typeOf(ch) === 'door') fail('F' + (f + 1) + ' (' + x + ',' + y + ') ' + label + ' 两边是同一个房间（只是捷径）');
        else warn('F' + (f + 1) + ' (' + x + ',' + y + ') ' + label + ' 两边是同一个房间，不挡任何东西');
      }
    }
    lines.push('  (' + x + ',' + y + ') ' + label + '：' + ids.map(function (r) { return '#' + r; }).join(' | '));
  }
  var rlines = rooms.filter(function (r) { return r.floors[f]; }).map(function (r) {
    if (roomText(r) === '空' && (roomEdges[r.id] || []).length < 2) fail('F' + (f + 1) + ' 房间 #' + r.id + ' 是空的死路');
    return '  #' + r.id + ' ' + roomText(r);
  });
  reports.push(rlines.concat(lines));
}

/* ---------- 3b. 门后不能只有同色钥匙：开一扇黄门只换回一把黄钥匙，等于白开 ---------- */
rooms.forEach(function (r) {
  var bl = roomBlockers[r.id] || [];
  if (bl.length !== 1 || typeOf(bl[0].ch) !== 'door') return;
  var keyCh = { yellow: 'y', blue: 'b', red: 'r' }[tileOf(bl[0].ch).key];
  var items = r.cells.map(function (p) { return maps[p[0]][p[2]][p[1]]; }).filter(function (ch) { return typeOf(ch) === 'item'; });
  if (items.length && items.every(function (ch) { return ch === keyCh; })) {
    fail('F' + (bl[0].f + 1) + ' (' + bl[0].x + ',' + bl[0].y + ') ' + tileOf(bl[0].ch).name + ' 后面只有同色钥匙（开了等于白开）');
  }
});

/* ---------- 3c. 黄门要守关键道路或宝石：门后是死路房间时，里面至少要有一颗宝石 ---------- */
rooms.forEach(function (r) {
  var bl = roomBlockers[r.id] || [];
  if (bl.length !== 1 || bl[0].ch !== 'Y') return;
  var items = r.cells.map(function (p) { return maps[p[0]][p[2]][p[1]]; }).filter(function (ch) { return typeOf(ch) === 'item'; });
  if (!items.some(function (ch) { return ch === 'g' || ch === 'd'; })) {
    fail('F' + (bl[0].f + 1) + ' (' + bl[0].x + ',' + bl[0].y + ') 黄门后是死路，里面没有宝石（只有 ' + (items.join('') || '空') + '）');
  }
});

/* ---------- 3d. 门后的奖励要对得起钥匙：只有开这扇门才拿得到的东西，按商店价折成金币，不能少于这把钥匙在商店的价格 ---------- */
/* 本层在卖的那一档：showFloor <= 层号，且没有 hideFloor 或 hideFloor 还在后面 */
function shopGood(f, stat) {
  return data.shop.goods.filter(function (g) {
    return (g.showFloor || 1) <= f + 1 && !(g.hideFloor > 0 && g.hideFloor <= f + 1) &&
      g.effect && g.effect[stat] && Object.keys(g.effect).length === 1;
  })[0];
}
function unitRate(f, stat) {
  var g = shopGood(f, stat);
  return g && g.effect[stat] ? g.price / g.effect[stat] : 0;
}

/* 本层洪水填充：从入口出发，踩到楼梯、灯芯就记下但不再往下走；blocked(x,y,ch) 为真的格当墙 */
function floorReach(f, blocked) {
  var rows = maps[f], s = entry(f), seen = {}, q = [];
  function take(x, y, go) {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    var k = x + ',' + y;
    if (seen[k] || typeOf(rows[y][x]) === 'wall') return;
    if (blocked && blocked(x, y, rows[y][x])) return;
    seen[k] = true;
    if (go) q.push([x, y]);
  }
  take(s.x, s.y, true);
  while (q.length) {
    var c = q.shift(), cx = c[0], cy = c[1];
    DIRS.forEach(function (v) {
      var nx = cx + v[0], ny = cy + v[1];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) return;
      var nch = maps[f][ny][nx];
      take(nx, ny, !(isStair(nch) || nch === '*'));
    });
  }
  return seen;
}

/* 一格按商店价折成金币；rate 里的单价来自本档商品 */
function doorValue(ch, scale, rate) {
  if (data.monsters[ch]) return data.monsters[ch].gold;
  var t = tileOf(ch), e = (t && t.effect) || {};
  return (e.atk || 0) * scale * rate.atk + (e.def || 0) * scale * rate.def + (e.hp || 0) * scale * rate.hp +
    (e.yellow || 0) * rate.yellow + (e.blue || 0) * rate.blue + (e.red || 0) * rate.blue * 2;
}

for (f = 0; f < F; f++) {
  var scale = data.floors[f].itemScale || 1;
  var rate = {
    atk: unitRate(f, 'atk'), def: unitRate(f, 'def'), hp: unitRate(f, 'hp'),
    yellow: shopGood(f, 'yellow') ? shopGood(f, 'yellow').price : 0,
    blue: shopGood(f, 'blue') ? shopGood(f, 'blue').price : 0
  };
  var openA = floorReach(f, null);
  ['Y', 'B'].forEach(function (doorCh) {
    find(f, doorCh).forEach(function (p) {
      /* 把这扇门当墙，只有绕不过去才进得的格子才是它的「独占区」 */
      var withW = floorReach(f, function (x, y) { return x === p.x && y === p.y; });
      var own = Object.keys(openA).filter(function (k) {
        if (withW[k]) return false;
        var xy = k.split(',');
        return !(+xy[0] === p.x && +xy[1] === p.y);
      });
      /* 独占区里有上楼梯或灯芯：这是主路上的门，不查 */
      if (own.some(function (k) { var xy = k.split(','); var c = maps[f][+xy[1]][+xy[0]]; return c === '>' || c === '*'; })) return;
      var total = own.reduce(function (sum, k) { var xy = k.split(','); return sum + doorValue(maps[f][+xy[1]][+xy[0]], scale, rate); }, 0);
      var name = tileOf(doorCh).name, price = doorCh === 'Y' ? rate.yellow : rate.blue;
      if (total === 0) warn('F' + (f + 1) + ' ' + name + ' (' + p.x + ',' + p.y + ') 后面没有独占的东西，只是近路');
      else if (total < price) fail('F' + (f + 1) + ' ' + name + ' (' + p.x + ',' + p.y + ') 后面的东西折 ' + Math.round(total) + ' 金，不够一把钥匙 ' + price + ' 金');
    });
  });
}

/* ---------- 4. 钥匙与门的数量 ---------- */
function countAll(ch) { var n = 0; for (var i = 0; i < F; i++) n += find(i, ch).length; return n; }
var counts = { y: countAll('y'), Y: countAll('Y'), b: countAll('b'), B: countAll('B'), r: countAll('r'), R: countAll('R') };
if (!(counts.y < counts.Y)) fail('黄钥匙 ' + counts.y + ' 不少于黄门 ' + counts.Y + '（要求不足额）');
if (counts.r > counts.R) fail('红钥匙 ' + counts.r + ' 多于红门 ' + counts.R);

/* 主线必须用的红门：堵上它就到不了终点 */
var goalF = F - 1;
var goalPos = find(goalF, '*')[0] || find(goalF, '>')[0];
function reachGoal(seen) { return !!seen[goalF + ',' + goalPos.x + ',' + goalPos.y]; }
var required = [];
for (f = 0; f < F; f++) find(f, 'R').forEach(function (p) {
  if (!reachGoal(flood(function (ff, xx, yy) { return ff === f && xx === p.x && yy === p.y; }))) required.push({ f: f, x: p.x, y: p.y });
});
required.forEach(function (rd) {
  var before = flood(function (ff, xx, yy, ch) {
    return required.some(function (q) { return q.f === ff && q.x === xx && q.y === yy; });
  });
  var keys = 0, others = 0;
  Object.keys(before).forEach(function (k) {
    var p = k.split(',').map(Number), ch = maps[p[0]][p[2]][p[1]];
    if (ch === 'r') keys++;
    if (ch === 'R') others++;
  });
  if (keys - others < 1) fail('主线红门 F' + (rd.f + 1) + ' (' + rd.x + ',' + rd.y + ')：之前拿得到 ' + keys + ' 把红钥匙、却有 ' + others + ' 扇别的红门，可能被花光');
});

/* ---------- 4b. 主线不用黄、蓝钥匙：把黄门、蓝门都当墙，也要能走到终点（红门按 §3.2 单独保证） ---------- */
if (!reachGoal(flood(function (ff, xx, yy, ch) { return ch === 'Y' || ch === 'B'; }))) {
  fail('不开黄门、蓝门就走不到终点：主线不能要黄、蓝钥匙（钥匙用光会卡死）');
}

/* ---------- 5. 首领是通往终点的唯一通道 ---------- */
data.acts.forEach(function (act) {
  var bf = act.to - 1;
  var bp = find(bf, act.boss)[0];
  if (!bp) { fail(act.title + ' 第 ' + act.to + ' 层没有首领 ' + act.boss); return; }
  var target = bf === F - 1 ? goalPos : find(bf, '>')[0];
  var seen = flood(function (ff, xx, yy) { return ff === bf && xx === bp.x && yy === bp.y; });
  if (seen[bf + ',' + target.x + ',' + target.y]) fail(act.title + ' 绕过首领也能到终点');
});

/* ---------- 输出 ---------- */
function tally() {
  var items = {}, mons = {};
  for (var i = 0; i < F; i++) maps[i].forEach(function (row) {
    row.forEach(function (ch) {
      var t = typeOf(ch);
      if (t === 'item') items[ch] = (items[ch] || 0) + 1;
      if (t === 'monster') mons[ch] = (mons[ch] || 0) + 1;
    });
  });
  return { items: items, mons: mons };
}

if (REPORT) {
  for (f = 0; f < F; f++) {
    console.log('F' + (f + 1) + ' ' + data.floors[f].name);
    reports[f].forEach(function (l) { console.log(l); });
  }
  var tt = tally();
  var gold = 0;
  Object.keys(tt.mons).forEach(function (id) { gold += tt.mons[id] * data.monsters[id].gold; });
  console.log('\n物品：' + JSON.stringify(tt.items));
  console.log('怪物：' + Object.keys(tt.mons).map(function (id) { return data.monsters[id].name + '×' + tt.mons[id]; }).join(' ') + '，金币合计 ' + gold);
  console.log('钥匙 / 门：黄 ' + counts.y + '/' + counts.Y + '，蓝 ' + counts.b + '/' + counts.B + '，红 ' + counts.r + '/' + counts.R);
  console.log('');
}

warns.forEach(function (w) { console.log('提示  ' + w); });
if (fails.length) {
  fails.forEach(function (m) { console.log('不通过  ' + m); });
  console.log('\naudit：' + fails.length + ' 项不通过');
  process.exit(1);
}
console.log('audit：全部通过');
