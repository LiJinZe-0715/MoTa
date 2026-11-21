/* js/render.js —— 《烬光之塔》棋盘绘制（Canvas 2D，全部现画，无外部素材） */
(function () {
  'use strict';

  var FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
  var LOGICAL = 624;
  var TILE = 48;
  var SIZE = 13;
  var TAU = Math.PI * 2;

  var C = {
    floor: '#262a33',
    seam: '#1e222a',
    wall: '#4b5060',
    mortar: '#33363f',
    accent: '#f0a93b',
    accentHi: '#ffd489',
    ember: '#ff6a3d',
    ice: '#5fb4e8',
    good: '#74d17a',
    bad: '#ff6b5e'
  };

  var DOOR_KEY = { Y: 'yellow', B: 'blue', R: 'red' };
  var ITEM_KEY = { y: 'yellow', b: 'blue', r: 'red' };
  var KEY_COLOR = { yellow: '#e2b33c', blue: '#4a8fe0', red: '#d0483c' };
  var DIR_VEC = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  var canvas = null;
  var ctx = null;
  var ratio = 1;
  var warmLight = null;
  var vignette = null;

  var flashes = [];
  var floats = [];
  var rafId = null;
  var running = false;
  var drawn = false;
  var infoCache = {};
  var spriteFailed = {};

  var staticLayer = null;
  var staticCtx = null;
  var staticKey = '';
  var monsterCells = [];
  var goalCell = null;

  /* ---------- 小工具 ---------- */

  function now() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  }

  function rgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
    var n = parseInt(h, 16);
    if (h.length !== 6 || isNaN(n)) { return { r: 160, g: 160, b: 160 }; }
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a) {
    var c = rgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function mix(hex, amount) {
    var c = rgb(hex);
    var target = amount < 0 ? 0 : 255;
    var p = Math.abs(amount);
    return 'rgb(' + Math.round(c.r + (target - c.r) * p) + ',' +
      Math.round(c.g + (target - c.g) * p) + ',' +
      Math.round(c.b + (target - c.b) * p) + ')';
  }

  function isLight(hex) {
    var c = rgb(hex);
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 150;
  }

  function hash(x, y) {
    var n = (x * 73856093) ^ (y * 19349663);
    return Math.abs(n) % 1024;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function glyph(g, text, cx, cy, size, fill, outline, outlineWidth) {
    g.font = 'bold ' + size + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (outline) {
      g.lineJoin = 'round';
      g.lineWidth = outlineWidth || 3;
      g.strokeStyle = outline;
      g.strokeText(text, cx, cy);
    }
    g.fillStyle = fill;
    g.fillText(text, cx, cy);
  }

  function halo(g, cx, cy, radius, color, strength) {
    var grad = g.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
    grad.addColorStop(0, rgba(color, strength));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, radius, 0, TAU);
    g.fill();
  }

  function monsterInfo(id) {
    if (infoCache[id]) { return infoCache[id]; }
    var table = (window.TOWER_DATA && window.TOWER_DATA.monsters) || {};
    var base = table[id] || {};
    var info = window.Game.getBattleInfo(id) || {};
    var merged = {
      id: id,
      name: info.name || base.name || '影中之物',
      glyph: info.glyph || base.glyph || '影',
      color: info.color || base.color || '#6b7280',
      boss: !!(info.boss || base.boss),
      canHit: !!info.canHit,
      canWin: !!info.canWin,
      damage: typeof info.damage === 'number' ? info.damage : null
    };
    infoCache[id] = merged;
    return merged;
  }

  /* ---------- 角色形象（js/sprites.js；缺席或出错就退回棋子） ---------- */

  var FOOT_Y = 20;      /* 形象按 48×48 设计坐标作画，脚底一律在 +20 */
  var POOL_INNER = 'rgba(255,236,200,0.10)';
  var POOL_MID = 'rgba(255,236,200,0.055)';
  var POOL_OUT = 'rgba(255,236,200,0)';

  function spriteReady(id) {
    var S = window.Sprites;
    if (!S || spriteFailed[id] || typeof S.draw !== 'function' || typeof S.has !== 'function') { return false; }
    return !!S.has(id);
  }

  function paintSprite(g, id, cx, cy, size, t, opts) {
    if (!spriteReady(id)) { return false; }
    g.save();
    try {
      window.Sprites.draw(g, id, cx, cy, size, t, opts);
    } catch (err) {
      spriteFailed[id] = true;
      g.restore();
      return false;
    }
    g.restore();
    return true;
  }

  /* 脚边的一小片地光，深色形象靠它从暗地板里浮出来 */
  function footPool(g, cx, feetY, w, h, inner, mid) {
    g.save();
    g.translate(cx, feetY);
    g.scale(1, h / w);
    var grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.5, mid);
    grad.addColorStop(1, POOL_OUT);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, w / 2, 0, TAU);
    g.fill();
    g.restore();
  }

  /* ---------- 各种格子的画法 ---------- */

  function drawFloor(g, px, py, x, y) {
    var n = hash(x, y);
    g.fillStyle = C.floor;
    g.fillRect(px, py, TILE, TILE);
    g.fillStyle = 'rgba(255,255,255,' + (0.006 + (n % 5) * 0.004) + ')';
    g.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(px + 7 + (n % 31), py + 9 + ((n >> 4) % 29), 2, 2);
    g.lineWidth = 1;
    g.strokeStyle = C.seam;
    g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }

  function drawWall(g, px, py, x, y) {
    g.fillStyle = C.mortar;
    g.fillRect(px, py, TILE, TILE);
    for (var r = 0; r < 2; r++) {
      var by = py + r * 24 + 2;
      var offset = ((r + x + y) % 2) ? -12 : 0;
      for (var i = -1; i < 3; i++) {
        var bx = px + offset + i * 24 + 2;
        var left = Math.max(bx, px + 1.5);
        var right = Math.min(bx + 20, px + TILE - 1.5);
        if (right <= left) { continue; }
        var tone = (hash(x * 4 + i, y * 2 + r) % 7) - 3;
        g.fillStyle = mix(C.wall, tone * 0.018);
        g.fillRect(left, by, right - left, 20);
        g.fillStyle = 'rgba(255,255,255,0.07)';
        g.fillRect(left, by, right - left, 1.5);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(left, by + 18.5, right - left, 1.5);
      }
    }
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  }

  function drawDoor(g, px, py, x, y, ch) {
    var color = KEY_COLOR[DOOR_KEY[ch]] || C.accent;
    var cx = px + TILE / 2;
    g.fillStyle = '#1b1e25';
    g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
    halo(g, cx, py + 26, 29, color, 0.3);

    g.beginPath();
    g.moveTo(px + 6, py + TILE - 4);
    g.lineTo(px + 6, py + 20);
    g.arc(cx, py + 20, TILE / 2 - 6, Math.PI, 0);
    g.lineTo(px + TILE - 6, py + TILE - 4);
    g.closePath();
    var grad = g.createLinearGradient(px, py, px + TILE, py + TILE);
    grad.addColorStop(0, mix(color, 0.24));
    grad.addColorStop(0.55, color);
    grad.addColorStop(1, mix(color, -0.32));
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = mix(color, -0.52);
    g.stroke();

    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.moveTo(cx - 8, py + 13);
    g.lineTo(cx - 8, py + TILE - 6);
    g.moveTo(cx + 8, py + 13);
    g.lineTo(cx + 8, py + TILE - 6);
    g.stroke();

    g.fillStyle = 'rgba(0,0,0,0.24)';
    g.fillRect(px + 8, py + 24, TILE - 16, 3);

    g.fillStyle = '#191b21';
    g.beginPath();
    g.arc(cx, py + 32, 3.6, 0, TAU);
    g.fill();
    g.beginPath();
    g.moveTo(cx - 2.4, py + 33);
    g.lineTo(cx + 2.4, py + 33);
    g.lineTo(cx + 4, py + 41);
    g.lineTo(cx - 4, py + 41);
    g.closePath();
    g.fill();

    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(255,255,255,0.26)';
    g.beginPath();
    g.arc(cx, py + 20, TILE / 2 - 9, Math.PI * 1.16, Math.PI * 1.84);
    g.stroke();
  }

  function drawKey(g, px, py, x, y, ch) {
    var color = KEY_COLOR[ITEM_KEY[ch]] || C.accent;
    var cx = px + TILE / 2;
    var cy = py + TILE / 2;
    halo(g, cx, cy, 21, color, 0.26);
    g.save();
    g.translate(cx, cy);
    g.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass === 0 ? 'rgba(10,11,15,0.85)' : color;
      g.lineWidth = pass === 0 ? 6 : 3.4;
      g.beginPath();
      g.arc(-6.5, -6.5, 6, 0, TAU);
      g.moveTo(-2, -2);
      g.lineTo(9.5, 9.5);
      g.moveTo(4.5, 4.5);
      g.lineTo(8, 1);
      g.moveTo(7.5, 7.5);
      g.lineTo(11, 4);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.arc(-8.5, -8.5, 1.5, 0, TAU);
    g.fill();
    g.restore();
  }

  var GEM_COLOR = { g: '#d63a55', d: '#3f7ce0' };

  function drawGem(g, px, py, x, y, ch) {
    var color = GEM_COLOR[ch] || C.accent;
    var cx = px + TILE / 2;
    var cy = py + TILE / 2;
    halo(g, cx, cy, 22, color, 0.3);
    g.save();
    g.translate(cx, cy);

    function facet(pts, fill) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) { g.lineTo(pts[i][0], pts[i][1]); }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    }

    var outline = [[-6, -12], [6, -12], [13, -3], [0, 15], [-13, -3]];
    var body = g.createLinearGradient(-13, -12, 13, 15);
    body.addColorStop(0, mix(color, 0.2));
    body.addColorStop(0.55, color);
    body.addColorStop(1, mix(color, -0.3));
    facet(outline, body);

    /* 冠部与亭部切面：台面最亮，右下最暗 */
    facet([[-6, -12], [6, -12], [4, -4], [-4, -4]], mix(color, 0.42));
    facet([[-6, -12], [-4, -4], [-13, -3]], mix(color, 0.16));
    facet([[6, -12], [13, -3], [4, -4]], mix(color, -0.08));
    facet([[-4, -4], [4, -4], [0, 15]], mix(color, 0.1));
    facet([[-13, -3], [-4, -4], [0, 15]], mix(color, -0.16));
    facet([[13, -3], [4, -4], [0, 15]], mix(color, -0.34));

    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,255,255,0.26)';
    g.beginPath();
    g.moveTo(-13, -3);
    g.lineTo(13, -3);
    g.moveTo(-6, -12);
    g.lineTo(-4, -4);
    g.lineTo(0, 15);
    g.moveTo(6, -12);
    g.lineTo(4, -4);
    g.lineTo(0, 15);
    g.moveTo(-4, -4);
    g.lineTo(4, -4);
    g.stroke();

    g.lineWidth = 1.6;
    g.strokeStyle = mix(color, -0.52);
    g.beginPath();
    g.moveTo(outline[0][0], outline[0][1]);
    for (var i = 1; i < outline.length; i++) { g.lineTo(outline[i][0], outline[i][1]); }
    g.closePath();
    g.stroke();

    /* 高光：台面左上一道斜光加一点星芒 */
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.moveTo(-4.5, -10.5);
    g.lineTo(-1, -10.5);
    g.lineTo(-3.5, -6);
    g.lineTo(-6.5, -6);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(-8.5, -6.5, 1.3, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawOil(g, px, py, x, y, ch) {
    var big = ch === 'H';
    var cx = px + TILE / 2;
    var cy = py + TILE / 2;
    var s = big ? 1.18 : 0.94;
    /* 大灯油用红光晕和红灯油液，跟琥珀色的小灯油一眼分得开 */
    var haloColor = big ? '#ff5a48' : C.accent;
    halo(g, cx, cy, big ? 25 : 19, haloColor, big ? 0.42 : 0.24);
    g.save();
    g.translate(cx, cy);
    g.scale(s, s);

    g.fillStyle = '#7a5a30';
    g.fillRect(-4.5, -19, 9, 4.5);
    g.fillStyle = 'rgba(220,232,245,0.16)';
    g.fillRect(-3, -15, 6, 7);

    g.beginPath();
    g.moveTo(-3, -9);
    g.quadraticCurveTo(-11, -5, -11, 4);
    g.lineTo(-11, 9);
    g.quadraticCurveTo(-11, 15, -5, 15);
    g.lineTo(5, 15);
    g.quadraticCurveTo(11, 15, 11, 9);
    g.lineTo(11, 4);
    g.quadraticCurveTo(11, -5, 3, -9);
    g.closePath();
    g.save();
    g.clip();
    var liquid = g.createLinearGradient(0, -4, 0, 15);
    liquid.addColorStop(0, big ? '#ff7a6b' : '#f0a93b');
    liquid.addColorStop(1, big ? '#c62828' : '#c9761f');
    g.fillStyle = liquid;
    g.fillRect(-12, big ? -5 : -1, 24, 22);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(-12, big ? -5 : -1, 24, 1.6);
    g.restore();

    g.lineWidth = 1.8;
    g.strokeStyle = big ? 'rgba(255,170,160,0.9)' : 'rgba(232,226,208,0.6)';
    g.stroke();

    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(-7.5, -2, 2.2, 11);
    g.restore();
  }

  function drawSword(g, px, py) {
    var cx = px + TILE / 2;
    var cy = py + TILE / 2;
    halo(g, cx, cy, 21, C.accent, 0.22);
    g.save();
    g.translate(cx, cy);
    g.beginPath();
    g.moveTo(0, -17);
    g.lineTo(3.6, -9);
    g.lineTo(3.6, 4);
    g.lineTo(-3.6, 4);
    g.lineTo(-3.6, -9);
    g.closePath();
    var blade = g.createLinearGradient(-4, 0, 4, 0);
    blade.addColorStop(0, '#8d97a8');
    blade.addColorStop(0.45, '#eef2f8');
    blade.addColorStop(1, '#9aa4b4');
    g.fillStyle = blade;
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(20,22,28,0.7)';
    g.stroke();
    g.fillStyle = C.accent;
    g.fillRect(-9.5, 4, 19, 3.6);
    g.fillStyle = '#6b563a';
    g.fillRect(-2.2, 7.6, 4.4, 7);
    g.beginPath();
    g.arc(0, 16, 2.8, 0, TAU);
    g.fillStyle = C.accentHi;
    g.fill();
    g.restore();
  }

  function drawShield(g, px, py) {
    var cx = px + TILE / 2;
    var cy = py + TILE / 2;
    halo(g, cx, cy, 21, C.ice, 0.18);
    g.save();
    g.translate(cx, cy);
    g.beginPath();
    g.moveTo(0, -16);
    g.lineTo(12, -11);
    g.lineTo(11, 3);
    g.quadraticCurveTo(9, 12, 0, 16);
    g.quadraticCurveTo(-9, 12, -11, 3);
    g.lineTo(-12, -11);
    g.closePath();
    var plate = g.createLinearGradient(-12, -16, 12, 16);
    plate.addColorStop(0, '#e3e9f2');
    plate.addColorStop(0.5, '#aab4c4');
    plate.addColorStop(1, '#78828f');
    g.fillStyle = plate;
    g.fill();
    g.lineWidth = 1.6;
    g.strokeStyle = 'rgba(20,22,28,0.75)';
    g.stroke();
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(5, -1);
    g.lineTo(0, 8);
    g.lineTo(-5, -1);
    g.closePath();
    g.fillStyle = C.accent;
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.arc(-7, -8, 1.4, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(7, -8, 1.4, 0, TAU);
    g.fill();
    g.restore();
  }

  function drawStairs(g, px, py, x, y, ch) {
    var up = ch === '>';
    var tint = up ? C.accent : C.ice;
    var cx = px + TILE / 2;
    halo(g, cx, py + 26, 24, tint, 0.18);
    for (var i = 0; i < 4; i++) {
      var w = 34 - i * 7;
      var sx = px + (TILE - w) / 2;
      var sy = up ? (py + 37 - i * 7) : (py + 10 + i * 7);
      g.fillStyle = mix('#6c7484', -0.06 * i);
      g.fillRect(sx, sy, w, 6);
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(sx, sy, w, 1.4);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(sx, sy + 5, w, 1);
    }
    glyph(g, up ? '▲' : '▼', cx, up ? py + 10 : py + 42, 13, tint, 'rgba(10,11,15,0.9)', 3);
  }

  function drawGoal(g, px, py, x, y, ch, t) {
    var cx = px + TILE / 2;
    var cy = py + TILE / 2;
    var flick = 0.5 + 0.32 * Math.sin(t / 190) + 0.18 * Math.sin(t / 71 + 1.3);
    halo(g, cx, cy - 2, 30 + flick * 6, '#ffb347', 0.34 + flick * 0.22);

    g.fillStyle = '#4a3a20';
    g.fillRect(cx - 9, cy + 13, 18, 4);
    g.fillStyle = '#2b2118';
    g.fillRect(cx - 2, cy + 6, 4, 8);

    g.save();
    g.translate(cx, cy + 6);
    g.scale(1 + 0.05 * Math.sin(t / 130 + 0.7), 1 + 0.09 * Math.sin(t / 165));
    g.beginPath();
    g.moveTo(0, -26);
    g.bezierCurveTo(9, -16, 12, -8, 10, -2);
    g.bezierCurveTo(8, 5, 3, 7, 0, 7);
    g.bezierCurveTo(-3, 7, -8, 5, -10, -2);
    g.bezierCurveTo(-12, -8, -9, -16, 0, -26);
    g.closePath();
    var flame = g.createLinearGradient(0, -26, 0, 7);
    flame.addColorStop(0, '#fff6da');
    flame.addColorStop(0.35, '#ffcf7c');
    flame.addColorStop(0.72, C.accent);
    flame.addColorStop(1, C.ember);
    g.fillStyle = flame;
    g.fill();

    g.beginPath();
    g.moveTo(0, -15);
    g.bezierCurveTo(5, -8, 6, -3, 4, 1);
    g.bezierCurveTo(2, 5, -2, 5, -4, 1);
    g.bezierCurveTo(-6, -3, -5, -8, 0, -15);
    g.closePath();
    g.fillStyle = 'rgba(255,252,238,' + (0.6 + flick * 0.3) + ')';
    g.fill();
    g.restore();
  }

  function drawPiece(g, cx, cy, radius, monster, glow) {
    var info = monster || {};
    if (info.id !== undefined && info.id !== null &&
      paintSprite(g, String(info.id), cx, cy, radius * 2, now())) { return; }
    var color = info.color || '#6b7280';
    var text = info.glyph || '影';
    g.save();
    halo(g, cx, cy, radius * 1.75, color, typeof glow === 'number' ? glow : 0.34);

    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.beginPath();
    g.ellipse(cx, cy + radius * 0.72, radius * 0.82, radius * 0.3, 0, 0, TAU);
    g.fill();

    var disc = g.createLinearGradient(cx, cy - radius, cx, cy + radius);
    disc.addColorStop(0, mix(color, 0.24));
    disc.addColorStop(0.55, color);
    disc.addColorStop(1, mix(color, -0.24));
    g.beginPath();
    g.arc(cx, cy, radius, 0, TAU);
    g.fillStyle = disc;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(232,226,208,0.78)';
    g.stroke();

    if (info.boss) {
      g.beginPath();
      g.arc(cx, cy, radius + 3.5, 0, TAU);
      g.lineWidth = 2;
      g.strokeStyle = '#f5cd76';
      g.stroke();
    }

    g.beginPath();
    g.arc(cx, cy, radius - 3.5, Math.PI * 1.18, Math.PI * 1.82);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.stroke();

    var light = isLight(color);
    glyph(g, text, cx, cy + 1, Math.round(radius * 1.06),
      light ? '#1d2029' : '#f7f3e7',
      light ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)', 3);
    g.restore();
  }

  function drawDamageTag(g, px, py, info) {
    var text;
    var color;
    var damage = typeof info.damage === 'number' ? info.damage : 0;
    if (!info.canHit) {
      text = '???';
      color = C.bad;
    } else if (damage === 0) {
      text = '0';
      color = C.good;
    } else {
      text = String(damage);
      color = info.canWin ? '#f4f0e4' : C.bad;
    }
    var cx = px + TILE / 2;
    var cy = py + TILE - 7.5;
    g.font = 'bold 11px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    var w = Math.max(20, g.measureText(text).width + 10);
    roundRect(g, cx - w / 2, cy - 6.5, w, 13, 6);
    g.fillStyle = 'rgba(9,10,14,0.74)';
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = rgba(color, 0.45);
    g.stroke();
    glyph(g, text, cx, cy + 0.5, 11, color, 'rgba(6,7,10,0.95)', 3);
  }

  function drawMonster(g, px, py, x, y, ch, t) {
    var cx = px + TILE / 2;
    var info = monsterInfo(ch);
    var boss = info.boss;
    if (spriteReady(ch)) {
      var size = TILE * (boss ? 1.1 : 1.3);   /* 首领自己内部已经放大 1.3 倍 */
      var cy = py + TILE / 2 - TILE * 0.08;
      var feet = cy + FOOT_Y * (size / 48) * (boss ? 1.3 : 1);
      footPool(g, cx, feet, TILE * 0.9, TILE * 0.45, POOL_INNER, POOL_MID);
      if (paintSprite(g, ch, cx, cy, size, t)) { return; }
    }
    /* 还没画形象的怪物退回棋子：尺寸和地光都跟形象一致，深色棋子才浮得出来 */
    var radius = TILE * (boss ? 0.46 : 0.4);
    var discY = py + TILE * 0.4;
    footPool(g, cx, discY + radius * 0.8, TILE * 0.9, TILE * 0.45, POOL_INNER, POOL_MID);
    drawPiece(g, cx, discY, radius, info, 0.2);
  }

  function drawHero(g, t) {
    var hero = window.Game.state.hero;
    var cx = hero.x * TILE + TILE / 2;
    var cy = hero.y * TILE + TILE / 2;
    if (spriteReady('hero')) {
      var breath = Math.sin(t / 620);
      var size = TILE * 1.3;
      var fy = cy - TILE * 0.08;
      footPool(g, cx, fy + FOOT_Y * (size / 48), TILE * 0.9, TILE * 0.45,
        'rgba(255,226,168,' + (0.22 + breath * 0.04) + ')',
        'rgba(255,214,150,' + (0.11 + breath * 0.02) + ')');
      halo(g, cx, fy + 8, 31 + breath * 2, C.accent, 0.2 + breath * 0.045);
      if (paintSprite(g, 'hero', cx, fy, size, t, { dir: hero.dir })) { return; }
    }

    var r = 16;
    halo(g, cx, cy, 40, C.accent, 0.3);

    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.ellipse(cx, cy + 15, 13, 4.5, 0, 0, TAU);
    g.fill();

    var disc = g.createLinearGradient(cx, cy - r, cx, cy + r);
    disc.addColorStop(0, '#ffdda0');
    disc.addColorStop(0.55, C.accent);
    disc.addColorStop(1, '#c8801e');
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fillStyle = disc;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = '#fff1cf';
    g.stroke();

    glyph(g, '守', cx, cy + 1, 19, '#2a1c06', 'rgba(255,240,205,0.35)', 2);

    var d = DIR_VEC[hero.dir] || DIR_VEC.down;
    g.save();
    g.translate(cx + d.x * (r + 6), cy + d.y * (r + 6));
    g.rotate(Math.atan2(d.y, d.x));
    g.beginPath();
    g.moveTo(4.5, 0);
    g.lineTo(-3, -4.4);
    g.lineTo(-3, 4.4);
    g.closePath();
    g.fillStyle = '#ffe3a8';
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(20,16,8,0.8)';
    g.stroke();
    g.restore();
  }

  /* 字符 → 画法。静物画进缓存层，怪物和灯芯每帧重画 */
  var STATIC_PAINTERS = {
    '#': drawWall,
    'Y': drawDoor, 'B': drawDoor, 'R': drawDoor,
    'y': drawKey, 'b': drawKey, 'r': drawKey,
    'g': drawGem, 'd': drawGem,
    'h': drawOil, 'H': drawOil,
    'S': drawSword, 'Z': drawShield,
    '>': drawStairs, '<': drawStairs
  };

  /* 怪物编号里有数字也有小写字母，只认数据里的 type */
  var monsterChars = null;

  function isMonster(ch) {
    if (!monsterChars) {
      monsterChars = {};
      var tiles = (window.TOWER_DATA && window.TOWER_DATA.tiles) || {};
      for (var k in tiles) {
        if (Object.prototype.hasOwnProperty.call(tiles, k) && tiles[k] && tiles[k].type === 'monster') {
          monsterChars[k] = true;
        }
      }
    }
    return monsterChars[ch] === true;
  }

  /* ---------- 整帧 ---------- */

  function drawAtmosphere(g) {
    if (warmLight) {
      g.fillStyle = warmLight;
      g.fillRect(0, 0, LOGICAL, LOGICAL);
    }
    if (vignette) {
      g.fillStyle = vignette;
      g.fillRect(0, 0, LOGICAL, LOGICAL);
    }
  }

  function drawEffects(g, t) {
    var i, f, p, a;
    for (i = 0; i < flashes.length; i++) {
      f = flashes[i];
      p = Math.max(0, Math.min(1, (t - f.start) / f.dur));
      a = (1 - p) * 0.85;
      var px = f.x * TILE;
      var py = f.y * TILE;
      var burst = g.createRadialGradient(px + TILE / 2, py + TILE / 2, 2, px + TILE / 2, py + TILE / 2, 36);
      burst.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      burst.addColorStop(0.55, 'rgba(255,240,210,' + (a * 0.45) + ')');
      burst.addColorStop(1, 'rgba(255,220,160,0)');
      g.fillStyle = burst;
      g.fillRect(px - 12, py - 12, TILE + 24, TILE + 24);
      roundRect(g, px + 2.5, py + 2.5, TILE - 5, TILE - 5, 8);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(255,255,255,' + (a * 0.85) + ')';
      g.stroke();
    }
    for (i = 0; i < floats.length; i++) {
      f = floats[i];
      p = Math.max(0, Math.min(1, (t - f.start) / f.dur));
      a = p < 0.62 ? 1 : Math.max(0, 1 - (p - 0.62) / 0.38);
      var rise = 30 * (1 - (1 - p) * (1 - p));
      var size = 14;
      g.font = 'bold ' + size + 'px ' + FONT;
      var w = g.measureText(f.text).width;
      if (w > 88) {
        size = Math.max(10, Math.floor(size * 88 / w));
        g.font = 'bold ' + size + 'px ' + FONT;
        w = g.measureText(f.text).width;
      }
      var fx = Math.max(w / 2 + 4, Math.min(LOGICAL - w / 2 - 4, f.x * TILE + TILE / 2));
      var fy = Math.max(12, f.y * TILE + 8 - rise - f.offset);
      g.globalAlpha = a;
      glyph(g, f.text, fx, fy, size, f.color, 'rgba(8,9,13,0.92)', 3.5);
      g.globalAlpha = 1;
    }
  }

  function scanMap() {
    var key = String(window.Game.state.floor);
    var cells = [];
    var goal = null;
    /* 行优先收集：形象会探出格子上沿，必须自上而下画才有正确的前后遮挡 */
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var ch = window.Game.getTile(x, y);
        key += ch;
        if (isMonster(ch)) { cells.push({ x: x, y: y, ch: ch }); }
        else if (ch === '*') { goal = { x: x, y: y }; }
      }
    }
    monsterCells = cells;
    goalCell = goal;
    return key;
  }

  function buildStaticLayer() {
    if (!staticLayer) {
      staticLayer = document.createElement('canvas');
      staticLayer.width = canvas.width;
      staticLayer.height = canvas.height;
      staticCtx = staticLayer.getContext('2d');
    }
    var g = staticCtx;
    var x, y, ch, painter;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, LOGICAL, LOGICAL);
    g.lineJoin = 'round';
    for (y = 0; y < SIZE; y++) {
      for (x = 0; x < SIZE; x++) {
        drawFloor(g, x * TILE, y * TILE, x, y);
      }
    }
    for (y = 0; y < SIZE; y++) {
      for (x = 0; x < SIZE; x++) {
        ch = window.Game.getTile(x, y);
        painter = STATIC_PAINTERS[ch];
        if (painter) { painter(g, x * TILE, y * TILE, x, y, ch, 0); }
      }
    }
  }

  /* 地板与静物 → 怪物（逐行自上而下）→ 主角 → 伤害数字 → 特效 */
  function render(t) {
    var g = ctx;
    var key = scanMap();
    if (!staticLayer || key !== staticKey) {
      buildStaticLayer();
      staticKey = key;
    }
    infoCache = {};
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.shadowBlur = 0;
    g.lineJoin = 'round';
    g.clearRect(0, 0, LOGICAL, LOGICAL);
    g.drawImage(staticLayer, 0, 0, LOGICAL, LOGICAL);

    if (goalCell) { drawGoal(g, goalCell.x * TILE, goalCell.y * TILE, goalCell.x, goalCell.y, '*', t); }
    drawAtmosphere(g);

    var i, cell;
    for (i = 0; i < monsterCells.length; i++) {
      cell = monsterCells[i];
      drawMonster(g, cell.x * TILE, cell.y * TILE, cell.x, cell.y, cell.ch, t);
    }
    drawHero(g, t);
    for (i = 0; i < monsterCells.length; i++) {
      cell = monsterCells[i];
      drawDamageTag(g, cell.x * TILE, cell.y * TILE, monsterInfo(cell.ch));
    }
    drawEffects(g, t);
  }

  function prune(t) {
    var i;
    for (i = flashes.length - 1; i >= 0; i--) {
      if (t - flashes[i].start >= flashes[i].dur) { flashes.splice(i, 1); }
    }
    for (i = floats.length - 1; i >= 0; i--) {
      if (t - floats[i].start >= floats[i].dur) { floats.splice(i, 1); }
    }
  }

  function frame() {
    rafId = null;
    if (!running || document.hidden || !ctx || !window.Game) { return; }
    var t = now();
    prune(t);
    render(t);
    rafId = window.requestAnimationFrame(frame);
  }

  function schedule() {
    if (rafId === null && running && !document.hidden && ctx) {
      rafId = window.requestAnimationFrame(frame);
    }
  }

  function start() {
    running = true;
    schedule();
  }

  function onVisibility() {
    if (document.hidden) {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else {
      schedule();
    }
  }

  document.addEventListener('visibilitychange', onVisibility);

  /* ---------- 对外接口 ---------- */

  /* ---------- 画布倍率（按实际显示尺寸算，逻辑坐标始终是 624） ---------- */

  function computeRatio() {
    var cssW = 0;
    if (canvas && typeof canvas.getBoundingClientRect === 'function') {
      cssW = canvas.getBoundingClientRect().width || 0;
    }
    var dpr = window.devicePixelRatio || 1;
    return cssW > 0 ? Math.max(1, Math.min(3, cssW * dpr / LOGICAL)) : Math.min(dpr, 2);
  }

  function buildGradients() {
    warmLight = ctx.createRadialGradient(LOGICAL / 2, 80, 20, LOGICAL / 2, 80, 470);
    warmLight.addColorStop(0, 'rgba(240,169,59,0.075)');
    warmLight.addColorStop(1, 'rgba(240,169,59,0)');
    vignette = ctx.createRadialGradient(LOGICAL / 2, LOGICAL / 2, LOGICAL * 0.33, LOGICAL / 2, LOGICAL / 2, LOGICAL * 0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.36)');
  }

  /* 改画布像素尺寸会重置上下文：静态层和渐变都挂在旧上下文上，一并丢弃重建 */
  function applyRatio() {
    canvas.width = Math.round(LOGICAL * ratio);
    canvas.height = Math.round(LOGICAL * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    staticLayer = null;
    staticCtx = null;
    staticKey = '';
    warmLight = null;
    vignette = null;
    buildGradients();
  }

  function init(target) {
    canvas = target;
    ctx = canvas.getContext('2d');
    SIZE = (window.Game && window.Game.SIZE) || 13;
    TILE = LOGICAL / SIZE;
    ratio = computeRatio();
    drawn = false;
    monsterChars = null;
    infoCache = {};
    applyRatio();
  }

  function draw() {
    if (!ctx || !window.Game) { return; }
    render(now());
    drawn = true;
    start();
  }

  function resize() {
    if (!canvas || !ctx) { return; }
    var next = computeRatio();
    if (Math.abs(Math.round(LOGICAL * next) - canvas.width) < 1) { return; }
    ratio = next;
    applyRatio();
    if (drawn && window.Game) { render(now()); }
  }

  function flash(x, y) {
    flashes.push({ x: x, y: y, start: now(), dur: 150 });
    schedule();
  }

  function floatText(x, y, text, color) {
    var offset = 0;
    for (var i = 0; i < floats.length; i++) {
      if (floats[i].x === x && floats[i].y === y) { offset += 15; }
    }
    floats.push({ x: x, y: y, text: String(text), color: color || C.accentHi, start: now(), dur: 650, offset: offset });
    schedule();
  }

  window.Renderer = {
    init: init,
    draw: draw,
    resize: resize,
    flash: flash,
    floatText: floatText,
    drawPiece: drawPiece
  };
})();