/* js/ui.js —— 《烬光之塔》输入、控制台、弹窗与启动流程 */
(function () {
  'use strict';

  var KEY_DIR = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right'
  };
  var MODAL_KEYS = ['title', 'codex', 'travel', 'help', 'win', 'confirm', 'act'];
  var UNCLOSABLE = { title: true, win: true };
  var NO_BACKDROP = { act: true };   /* 点遮罩不关的弹窗：只能按 Esc 或点“继续” */
  var KEY_NAME = { yellow: '黄钥匙', blue: '蓝钥匙', red: '红钥匙' };
  var KEY_COLOR = { yellow: '#e2b33c', blue: '#4a8fe0', red: '#d0483c' };
  var EFFECT_NAME = { hp: '生命', atk: '攻击', def: '防御', gold: '金币', yellow: '黄钥匙', blue: '蓝钥匙', red: '红钥匙' };
  var GROUP_TITLE = { stat: '强化', key: '钥匙', old: '旧档强化' };
  /* 怪物特点：数据里的 kind 字段（大小写敏感的怪物编号原样查表） */
  var KIND_LABEL = {
    L: '杂兵', A: '高攻', D: '高防', H: '高血',
    AD: '高攻 高防', AH: '高攻 高血', DH: '高防 高血', ADH: '首领'
  };
  /* 每幕一色，按 acts 顺序取用 */
  var ZONE_COLOR = ['#f0a93b', '#8a5fd0', '#5f9a8a', '#4f9fe8', '#c0262d'];
  var WIDE_DESC = 12;
  var SHORTCUTS = '12345';
  var REPEAT_MS = 110;
  var MAX_MSG = 40;
  var ITEM_COLOR = '#74d17a';
  var DAMAGE_COLOR = '#ff6b5e';
  var GOLD_COLOR = '#ffd489';

  var IDS = {
    board: 'board', frame: 'board-frame', veil: 'board-veil', track: 'tower-track', dpad: 'dpad',
    floorName: 'floor-name', actName: 'act-name', steps: 'step-count', itemScale: 'item-scale',
    hp: 'stat-hp', atk: 'stat-atk', def: 'stat-def', gold: 'stat-gold',
    keyYellow: 'key-yellow', keyBlue: 'key-blue', keyRed: 'key-red',
    debugBadge: 'debug-badge',
    btnCodex: 'btn-codex', btnSave: 'btn-save', btnLoad: 'btn-load', btnRestart: 'btn-restart', btnHelp: 'btn-help',
    messages: 'messages', overlay: 'overlay',
    title: 'modal-title', codex: 'modal-codex', travel: 'modal-travel',
    help: 'modal-help', win: 'modal-win', confirm: 'modal-confirm', act: 'modal-act',
    btnContinue: 'btn-continue', btnNew: 'btn-new', titleHint: 'title-hint',
    titleFigure: 'title-figure', titleLamp: 'title-lamp', titleHero: 'title-hero',
    codexFloor: 'codex-floor', codexGold: 'codex-gold', codexWrap: 'codex-table-wrap', codexBody: 'codex-body', codexEmpty: 'codex-empty',
    shopPanel: 'shop-panel', shopName: 'shop-name', shopGold: 'shop-gold',
    shopGoods: 'shop-goods', shopNote: 'shop-note',
    bag: 'bag', bagLampCount: 'bag-lamp-count',
    travelList: 'travel-list', travelEmpty: 'travel-empty',
    winSteps: 'win-steps', winHp: 'win-hp', winAtkDef: 'win-atkdef', winGold: 'win-gold', btnAgain: 'btn-again',
    winRank: 'win-rank', winRankLetter: 'win-rank-letter', winRankText: 'win-rank-text',
    btnYes: 'btn-confirm-yes', btnCheckpoint: 'btn-checkpoint', checkpointSub: 'checkpoint-sub',
    actTitle: 'act-heading', actIntro: 'act-intro', actRank: 'act-rank',
    actRankLetter: 'act-rank-letter', actRankAct: 'act-rank-act', actRankText: 'act-rank-text',
    btnActOk: 'btn-act-ok'
  };

  var el = {};
  var pips = [];
  var pipBoss = [];
  var pipMark = [];
  var zoneBoxes = [];
  var zones = [];
  var messages = [];
  var msgSeq = 0;
  var msgSig = null;
  var lastTopMsg = 0;
  var shown = {};
  var held = [];
  var repeatTimer = null;
  var padDir = null;
  var padBtn = null;
  var stack = [];
  var actOpenedAt = 0;   /* “进入新的一幕”弹窗的打开时刻：刚开时挡住同一次输入的误关 */
  var actOkArmed = false;   /* “继续”按钮是否在本次按下的位置上按下过：挡住触屏抬手补发的 click */
  var started = false;
  var ready = false;
  var figureRaf = null;
  var figureJobs = [];
  var codexJobs = [];
  var codexSig = null;
  var titleJob = null;
  var goodsList = [];
  var goodsRefs = {};
  var goodsSig = '';
  var goodsIds = null;
  var goodsFloor = -1;
  var freshGoods = {};
  var bagBtns = {};
  var resizeTimer = null;
  var debugMode = false;   /* 调试模式（DESIGN §8.8）：启动时问引擎，状态区显示 ∞ 和调试标记 */

  /* ---------- 通用小工具 ---------- */

  function nowMs() {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  }

  function spriteHas(id) {
    var S = window.Sprites;
    return !!(S && typeof S.draw === 'function' && typeof S.has === 'function' && S.has(id));
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function formatNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n.toLocaleString('en-US') : '0';
  }

  /* 大数字不折行也不缩写：太长时换小一档字号 */
  function fitNum(node, text) {
    var len = String(text).length;
    node.classList.toggle('num-long', len >= 8 && len < 11);
    node.classList.toggle('num-huge', len >= 11);
  }

  function setValue(node, value, key) {
    var text = formatNumber(value);
    if (shown[key] === text) { return; }
    shown[key] = text;
    node.textContent = text;
    fitNum(node, text);
    node.classList.remove('is-bump');
    void node.offsetWidth;
    node.classList.add('is-bump');
  }

  /* 调试模式生命显示 ∞，鼠标悬停的 title 里给真实数值（DESIGN §8.8） */
  function setHpValue(value) {
    if (debugMode) {
      if (shown.hp !== '∞') {
        shown.hp = '∞';
        el.hp.textContent = '∞';
        fitNum(el.hp, '∞');
        el.hp.classList.remove('is-bump');
        void el.hp.offsetWidth;
        el.hp.classList.add('is-bump');
      }
      el.hp.title = '实际生命 ' + formatNumber(value);
      return;
    }
    if (el.hp.title) { el.hp.title = ''; }
    setValue(el.hp, value, 'hp');
  }

  function replay(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function closest(node, selector) {
    return (node && typeof node.closest === 'function') ? node.closest(selector) : null;
  }

  /* ---------- 区域配色 ---------- */

  function rgbOf(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
    var n = parseInt(h, 16);
    if (!isFinite(n)) { return [240, 169, 59]; }
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lighten(rgb, amount) {
    var out = [];
    for (var i = 0; i < 3; i++) { out.push(Math.round(rgb[i] + (255 - rgb[i]) * amount)); }
    return 'rgb(' + out.join(',') + ')';
  }

  function paintZone(node, index) {
    var hex = ZONE_COLOR[index % ZONE_COLOR.length];
    var rgb = rgbOf(hex);
    node.style.setProperty('--zone', hex);
    node.style.setProperty('--zone-hi', lighten(rgb, 0.5));
    node.style.setProperty('--zone-line', 'rgba(' + rgb.join(',') + ',0.34)');
    node.style.setProperty('--zone-dim', 'rgba(' + rgb.join(',') + ',0.13)');
    node.style.setProperty('--zone-glow', 'rgba(' + rgb.join(',') + ',0.5)');
  }

  function floorsData() {
    return (window.TOWER_DATA && window.TOWER_DATA.floors) || [];
  }

  function scaleOf(floor) {
    var f = floorsData()[floor];
    var s = f && f.itemScale;
    return (typeof s === 'number' && s > 0) ? s : 1;
  }

  function cnCount(n) {
    var cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    var num = Number(n);
    if (!(num >= 0 && num % 1 === 0)) { return String(n); }
    if (num < 10) { return cn[num]; }
    if (num < 20) { return '十' + (num % 10 ? cn[num % 10] : ''); }
    if (num < 100) { return cn[Math.floor(num / 10)] + '十' + (num % 10 ? cn[num % 10] : ''); }
    return String(num);
  }

  function tileByName(name) {
    var tiles = (window.TOWER_DATA && window.TOWER_DATA.tiles) || {};
    for (var ch in tiles) {
      if (hasOwn(tiles, ch) && tiles[ch] && tiles[ch].name === name) { return tiles[ch]; }
    }
    return null;
  }

  function effectAmount(tile, key) {
    var effect = tile && tile.effect;
    return (effect && typeof effect[key] === 'number') ? effect[key] : null;
  }

  /* 幕信息优先问引擎，引擎没有就读数据 */
  function actsData() {
    var G = window.Game;
    if (G && typeof G.getActs === 'function') {
      var list = G.getActs();
      if (Array.isArray(list) && list.length) { return list; }
    }
    var data = window.TOWER_DATA;
    return (data && Array.isArray(data.acts)) ? data.acts : [];
  }

  function bossNameOf(act) {
    var monsters = (window.TOWER_DATA && window.TOWER_DATA.monsters) || {};
    var def = act && act.boss !== undefined && act.boss !== null ? monsters[act.boss] : null;
    return (def && def.name) || '';
  }

  /* 层数、首领名、终点名都从数据里取 */
  function actInfo() {
    var data = window.TOWER_DATA || {};
    var floors = floorsData();
    var acts = actsData();
    var count = floors.length;
    var tiles = data.tiles || {};
    var monsters = data.monsters || {};
    var boss = '';
    var goal = '';
    var lastAct = acts.length ? acts[acts.length - 1] : null;
    boss = bossNameOf(lastAct);
    var last = count ? floors[count - 1] : null;
    var rows = (last && last.map) || [];
    var y, x, ch, def;
    for (y = 0; y < rows.length && !boss; y++) {
      for (x = 0; x < String(rows[y]).length; x++) {
        ch = String(rows[y]).charAt(x);
        def = tiles[ch];
        if (def && def.type === 'monster' && monsters[ch] && monsters[ch].boss && monsters[ch].name) {
          boss = monsters[ch].name;
          break;
        }
      }
    }
    if (!boss) {
      for (ch in monsters) {
        if (hasOwn(monsters, ch) && monsters[ch] && monsters[ch].boss && monsters[ch].name) {
          boss = monsters[ch].name;
          break;
        }
      }
    }
    for (ch in tiles) {
      if (hasOwn(tiles, ch) && tiles[ch] && tiles[ch].type === 'goal' && tiles[ch].name) {
        goal = tiles[ch].name;
        break;
      }
    }
    return {
      count: count,
      countCn: cnCount(count),
      acts: acts,
      actsCn: cnCount(acts.length),
      boss: boss || '首领',
      goal: goal || '灯芯'
    };
  }

  /* 区域 = 一幕；数据没有 acts 时退回“itemScale 相同的连续楼层” */
  function buildZones() {
    var floors = floorsData();
    var acts = actsData();
    var out = [];
    var i;
    if (acts.length && floors.length) {
      for (i = 0; i < acts.length; i++) {
        var a = acts[i];
        if (!a) { continue; }
        var from = (typeof a.from === 'number' ? a.from : 1) - 1;
        var to = (typeof a.to === 'number' ? a.to : from + 1) - 1;
        if (from < 0) { from = 0; }
        if (to > floors.length - 1) { to = floors.length - 1; }
        if (to < from) { continue; }
        out.push({
          index: out.length, from: from, to: to,
          scale: (typeof a.scale === 'number' && a.scale > 0) ? a.scale : scaleOf(from),
          name: a.name || a.title || ('第 ' + (i + 1) + ' 幕'),
          title: a.title || a.name || '',
          act: a
        });
      }
      if (out.length) { return out; }
    }
    var last = null;
    for (i = 0; i < floors.length; i++) {
      var s = scaleOf(i);
      if (!out.length || s !== last) {
        out.push({
          scale: s, from: i, to: i, index: out.length,
          name: '第 ' + (out.length + 1) + ' 区', title: '', act: null
        });
        last = s;
      } else {
        out[out.length - 1].to = i;
      }
    }
    return out;
  }

  function zoneOf(floor) {
    for (var i = 0; i < zones.length; i++) {
      if (floor >= zones[i].from && floor <= zones[i].to) { return zones[i]; }
    }
    return { scale: scaleOf(floor), from: floor, to: floor, index: 0, name: '', title: '', act: null };
  }

  function zoneTitle(zone) {
    if (zone.title) { return zone.title; }
    var span = (zone.from + 1) + '–' + (zone.to + 1) + ' 层';
    return zone.name + ' · ' + span + (zone.scale > 1 ? ' · 物品 ×' + zone.scale : '');
  }

  function zoneTooltip(zone) {
    var span = '第 ' + (zone.from + 1) + '–' + (zone.to + 1) + ' 层';
    var scale = zone.scale > 1 ? ' · 物品 ×' + zone.scale : '';
    return zoneTitle(zone) + ' · ' + span + scale;
  }

  /* 当前所在的一幕：优先问引擎，否则按楼层查 */
  function currentAct() {
    var G = window.Game;
    if (G && typeof G.getAct === 'function') {
      var a = G.getAct();
      if (a) { return a; }
    }
    var floor = (G && G.state) ? G.state.floor : 0;
    return zoneOf(floor).act;
  }

  /* 首领所在层：扫每层地图里 boss 为真的怪物字符 */
  function bossFloors() {
    var data = window.TOWER_DATA || {};
    var tiles = data.tiles || {};
    var monsters = data.monsters || {};
    var floors = floorsData();
    var out = [];
    for (var f = 0; f < floors.length; f++) {
      var rows = (floors[f].map) || [];
      var found = false;
      for (var y = 0; y < rows.length && !found; y++) {
        var row = String(rows[y]);
        for (var x = 0; x < row.length; x++) {
          var ch = row.charAt(x);
          var def = tiles[ch];
          if (def && def.type === 'monster' && monsters[ch] && monsters[ch].boss) { found = true; break; }
        }
      }
      out.push(found);
    }
    return out;
  }

  /* ---------- 消息栏 ---------- */

  function pushMessage(text, kind) {
    if (!text) { return; }
    msgSeq += 1;
    messages.unshift({ id: msgSeq, text: String(text), kind: kind || 'info' });
    if (messages.length > MAX_MSG) { messages.length = MAX_MSG; }
    renderMessages();
  }

  function renderMessages() {
    var sig = '';
    for (var m = 0; m < messages.length; m++) { sig += messages[m].id + ','; }
    if (sig === msgSig) { return; }
    msgSig = sig;
    el.messages.textContent = '';
    if (!messages.length) {
      el.messages.appendChild(make('li', 'msg msg-empty', '灯下暂无记事。'));
      lastTopMsg = 0;
      return;
    }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < messages.length; i++) {
      var fresh = (i === 0 && messages[i].id !== lastTopMsg) ? ' msg-new' : '';
      frag.appendChild(make('li', 'msg msg-' + messages[i].kind + fresh, messages[i].text));
    }
    lastTopMsg = messages[0].id;
    el.messages.appendChild(frag);
  }

  /* ---------- 状态 ---------- */

  function buildTrack() {
    var floors = floorsData();
    var count = floors.length;
    zones = buildZones();
    var boss = bossFloors();
    el.track.textContent = '';
    pips = [];
    pipBoss = [];
    pipMark = [];
    zoneBoxes = [];
    for (var z = 0; z < zones.length; z++) {
      var zone = zones[z];
      var mid = zone.from + Math.floor((zone.to - zone.from) / 2);
      var markAll = (zone.to - zone.from + 1) <= 12;   /* 每幕十层：每格都写层号 */
      var box = make('div', 'track-zone');
      box.title = zoneTooltip(zone);
      paintZone(box, zone.index);
      box.appendChild(make('span', 'track-name', zone.name));
      for (var f = zone.from; f <= zone.to && f < count; f++) {
        var name = (floors[f] && floors[f].name) || ('第 ' + (f + 1) + ' 层');
        var mark = markAll || (f === zone.from || f === zone.to || f === mid || !!boss[f]);
        var pip = make('span', 'pip' + (mark ? ' is-mark' : ''), String(f + 1));
        pip.title = name + (boss[f] ? ' · 首领守关' : '') + (zone.scale > 1 ? ' · 物品 ×' + zone.scale : '');
        box.appendChild(pip);
        /* 格与格之间留一个空白文本节点：纯空白不会被 flex 渲染，但能让层号在 textContent 里分开 */
        box.appendChild(document.createTextNode(' '));
        pips.push(pip);
        pipBoss.push(!!boss[f]);
        pipMark.push(mark);
      }
      el.track.appendChild(box);
      zoneBoxes.push(box);
    }
  }

  function renderScale() {
    var G = window.Game;
    var scale = (G && typeof G.getItemScale === 'function') ? G.getItemScale() : 0;
    if (!(typeof scale === 'number' && scale > 1)) {
      el.itemScale.hidden = true;
      return;
    }
    el.itemScale.textContent = '';
    el.itemScale.appendChild(document.createTextNode('本层物品效果 '));
    el.itemScale.appendChild(make('b', '', '×' + scale));
    el.itemScale.hidden = false;
  }

  function renderActName() {
    var act = currentAct();
    var title = (act && act.title) || '';
    el.actName.textContent = title;
    el.actName.hidden = !title;
  }

  function refresh() {
    if (!ready) { return; }
    var state = window.Game.state;
    var hero = state.hero;
    el.floorName.textContent = window.Game.getFloorName();
    el.floorName.title = window.Game.getFloorName();
    renderActName();
    el.steps.textContent = formatNumber(state.steps);
    setHpValue(hero.hp);
    setValue(el.atk, hero.atk, 'atk');
    setValue(el.def, hero.def, 'def');
    setValue(el.gold, hero.gold, 'gold');
    setValue(el.keyYellow, hero.keys.yellow || 0, 'keyYellow');
    setValue(el.keyBlue, hero.keys.blue || 0, 'keyBlue');
    setValue(el.keyRed, hero.keys.red || 0, 'keyRed');
    el.btnLoad.disabled = !window.Game.hasSave();
    var reached = typeof state.maxFloor === 'number' ? state.maxFloor : state.floor;
    for (var i = 0; i < pips.length; i++) {
      pips[i].className = 'pip' + (pipMark[i] ? ' is-mark' : '') + (pipBoss[i] ? ' is-boss' : '') +
        (i === state.floor ? ' is-current' : (i <= reached ? ' is-climbed' : ''));
    }
    for (var z = 0; z < zoneBoxes.length; z++) {
      var zone = zones[z];
      zoneBoxes[z].classList.toggle('is-active', !!zone && state.floor >= zone.from && state.floor <= zone.to);
    }
    renderScale();
    renderShop();
    renderBag();
    renderMessages();
    /* 图鉴开着时金币 / 属性 / 剩余数一变就重画（买货、打怪后走同一条刷新路） */
    if (started && topModal() === 'codex') {
      var snap = codexSnapshot();
      if (snap.sig !== codexSig) {
        renderCodex(snap);
        updateFigures('codex');
      }
    }
  }

  /* ---------- 弹窗里的小画布（标题主角 / 图鉴形象） ---------- */

  function setupTitleHero() {
    if (!spriteHas('hero')) { return; }
    var box = 96;
    var scale = Math.min(window.devicePixelRatio || 1, 2);
    el.titleHero.width = Math.round(box * scale);
    el.titleHero.height = Math.round(box * scale);
    var g = el.titleHero.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    titleJob = { g: g, box: box, scale: scale, hero: true };
    el.titleHero.hidden = false;
    el.titleLamp.hidden = true;
    el.titleFigure.classList.add('has-hero');
  }

  function drawFigures() {
    var t = nowMs();
    for (var i = 0; i < figureJobs.length; i++) {
      var job = figureJobs[i];
      var g = job.g;
      g.setTransform(job.scale, 0, 0, job.scale, 0, 0);
      g.clearRect(0, 0, job.box, job.box);
      if (job.hero) {
        window.Sprites.draw(g, 'hero', job.box / 2, job.box / 2, job.box, t, { dir: 'down' });
      } else {
        window.Renderer.drawPiece(g, job.box / 2, job.box / 2, job.radius, job.monster);
      }
    }
  }

  function scheduleFigures() {
    if (figureRaf === null && figureJobs.length && !document.hidden) {
      figureRaf = window.requestAnimationFrame(figuresTick);
    }
  }

  function stopFigures() {
    if (figureRaf !== null) {
      window.cancelAnimationFrame(figureRaf);
      figureRaf = null;
    }
  }

  function disableFigures() {
    stopFigures();
    figureJobs = [];
    codexJobs = [];
    if (titleJob) {
      titleJob = null;
      el.titleHero.hidden = true;
      el.titleLamp.hidden = false;
      el.titleFigure.classList.remove('has-hero');
    }
  }

  function paintFigures() {
    try {
      drawFigures();
      return true;
    } catch (err) {
      disableFigures();
      return false;
    }
  }

  function figuresTick() {
    figureRaf = null;
    if (paintFigures()) { scheduleFigures(); }
  }

  /* 只有当前弹窗里真的有会动的形象时才转 */
  function updateFigures(top) {
    stopFigures();
    figureJobs = [];
    if (top === 'codex') {
      figureJobs = codexJobs.slice();
    } else {
      codexJobs = [];
      if (top === 'title' && titleJob) { figureJobs = [titleJob]; }
    }
    if (figureJobs.length && paintFigures()) { scheduleFigures(); }
  }

  /* ---------- 弹窗 ---------- */

  function topModal() {
    return stack.length ? stack[stack.length - 1] : null;
  }

  function syncModals() {
    var top = topModal();
    el.overlay.hidden = !top;
    for (var i = 0; i < MODAL_KEYS.length; i++) {
      el[MODAL_KEYS[i]].hidden = (MODAL_KEYS[i] !== top);
    }
    document.body.classList.toggle('modal-open', !!top);
    updateFigures(top);
  }

  function focusTop() {
    var panel = el[topModal()];
    if (!panel) { return; }
    var target = panel.querySelector('[data-autofocus]:not([disabled]):not([hidden])') ||
      panel.querySelector('button:not([disabled]):not([hidden])');
    if (target) { target.focus(); }
  }

  function blurActive() {
    var active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') { active.blur(); }
  }

  function openModal(name) {
    if (stack.indexOf(name) >= 0) { return; }
    clearHeld();
    stack.push(name);
    if (name === 'act') { actOpenedAt = Date.now(); actOkArmed = false; }
    syncModals();
    focusTop();
  }

  /* 一幕弹窗刚打开的一小会儿不认关闭操作：触屏点穿 / 同一次按键会顺手把它关掉 */
  function actGuarded() {
    return topModal() === 'act' && Date.now() - actOpenedAt < 700;
  }

  function closeTop() {
    if (!stack.length) { return; }
    stack.pop();
    syncModals();
    if (stack.length) { focusTop(); } else { blurActive(); }
  }

  function closeAll() {
    stack.length = 0;
    syncModals();
    blurActive();
  }

  function openTitle() {
    el.btnContinue.hidden = !window.Game.hasSave();
    el.btnContinue.disabled = false;
    el.titleHint.textContent = '方向键 / WASD 移动 · 1–5 买货 · F 灯符 · E/Q 灯符上下层 · X 图鉴 · K 存档 · L 读档 · H 帮助';
    openModal('title');
  }

  /* ---------- 五幕版文案（幕数、层数、各幕名字、首领名、终点名都从数据生成） ---------- */

  function setCopy(id, text) {
    var node = document.getElementById(id);
    if (node) { node.textContent = text; }
  }

  /* 本档（没变旧）的货：数字键和角标只认这几件 */
  function shelfGoods() {
    var out = [];
    for (var i = 0; i < goodsList.length; i++) {
      if (!goodsList[i].old) { out.push(goodsList[i]); }
    }
    return out;
  }

  /* 第一层货架上有几件本档的货：引擎能给就问引擎，否则按 showFloor / hideFloor 算 */
  function shelfCount() {
    var G = window.Game;
    if (G && typeof G.getShopGoods === 'function' && G.state) {
      var list = G.getShopGoods();
      if (Array.isArray(list) && list.length) {
        var count = 0;
        for (var i = 0; i < list.length; i++) {
          if (!list[i].old) { count++; }
        }
        if (count) { return count; }
      }
    }
    var shop = window.TOWER_DATA && window.TOWER_DATA.shop;
    var goods = (shop && shop.goods) || [];
    var n = 0;
    for (var i = 0; i < goods.length; i++) {
      var g = goods[i];
      if (!g) { continue; }
      if ((g.showFloor || 1) <= 1 && !(g.hideFloor > 0 && g.hideFloor <= 1)) { n++; }
    }
    return n;
  }

  function applyCopy() {
    var info = actInfo();
    var n = info.count;
    var acts = info.acts;
    var i;

    setCopy('title-eyebrow', acts.length ? info.actsCn + '幕 · ' + info.countCn + '层' : info.countCn + '层');
    setCopy('title-story-1', '长夜压着高塔，山下的村子只等一盏灯。');
    setCopy('title-story-2', '你是最后一名守夜人学徒，提着一盏小灯闯进塔里。' +
      (acts.length ? '塔分' + info.actsCn + '幕，每一幕尽头有一名首领；' : '') +
      '每一层都要掂量先打谁、钥匙用在哪。打倒' + info.boss + '，点亮' + info.goal + '。');

    setCopy('travel-sub', '灯符只认你走过的路。这里按幕列出到过的楼层，列表可以滚动；选一层立刻回到那一层的下楼梯，回第 1 层则落在出生点。');

    setCopy('help-act-heading', acts.length ? info.actsCn + '幕' + info.countCn + '层' : info.countCn + '层');
    var per = acts.length ? (acts[0].to - acts[0].from + 1) : 0;
    var uniform = acts.length > 0;
    for (i = 0; i < acts.length; i++) {
      if (acts[i].to - acts[i].from + 1 !== per) { uniform = false; }
    }
    setCopy('help-act-summary', '这座塔共 ' + (acts.length || 1) + ' 幕、' + n + ' 层' +
      (uniform ? '，每一幕 ' + per + ' 层' : '') + '，每一幕最后一层的首领堵在上楼梯前：');
    var actList = document.getElementById('help-act-list');
    if (actList) {
      actList.textContent = '';
      for (i = 0; i < acts.length; i++) {
        var a = acts[i];
        var bossName = bossNameOf(a) || '首领';
        actList.appendChild(make('li', '', (a.title || a.name || '') + '：第 ' + a.from + '–' + a.to +
          ' 层，首领「' + bossName + '」堵在第 ' + a.to + ' 层的上楼梯前。'));
      }
    }
    setCopy('help-act-boss', '打倒第 ' + n + ' 层的首领「' + info.boss + '」，走上「' + info.goal + '」即通关。');
    setCopy('help-act-scale', '主角的属性、钥匙、金币跨层、跨幕都保留；进入新一幕时钥匙不合并、不折现，原样带走。');
    setCopy('help-track-text', '右侧的塔层进度每幕一行' + (acts.length ? '，共 ' + acts.length + ' 行' : '') +
      '：每一格都写着层号；亮起来的是走过的层，右上角带金点的是首领层，跳起发光的是脚下这一层，整行加亮的是当前这一幕。鼠标停在格子上能看到层名。');
    setCopy('help-goal-rule', '走上第 ' + n + ' 层的「' + info.goal + '」即通关。这里没有死亡，打不过只会被拦住。');

    var slots = Math.min(shelfCount(), SHORTCUTS.length);
    setCopy('help-buy-range', slots > 1 ? '1–' + slots : '1');

    var monsters = (window.TOWER_DATA && window.TOWER_DATA.monsters) || {};
    var kinds = {};
    var ids = [];
    var id, m, kind;
    for (id in monsters) {
      if (!hasOwn(monsters, id)) { continue; }
      ids.push(id);
      m = monsters[id];
      kind = m && m.kind;
      if (typeof kind === 'string' && hasOwn(KIND_LABEL, kind)) {
        if (!kinds[kind]) { kinds[kind] = []; }
        if (m.name) { kinds[kind].push(m.name); }
      }
    }
    var kindOrder = ['L', 'A', 'D', 'H', 'AD', 'AH', 'DH', 'ADH'];
    var parts = [];
    for (var k = 0; k < kindOrder.length; k++) {
      kind = kindOrder[k];
      if (kinds[kind] && kinds[kind].length) { parts.push(KIND_LABEL[kind] + '：' + kinds[kind].join('、')); }
    }
    var monsterText = '全塔共 ' + ids.length + ' 种怪';
    if (ids.length <= 12 && parts.length) {
      monsterText += '。' + parts.join('；') + '。';
    } else {
      monsterText += '，图鉴的「特点」标签写出每种怪强在哪。';
    }
    setCopy('help-monster-count', monsterText);

    var gemAtk = tileByName('红宝石');
    var gemDef = tileByName('蓝宝石');
    var hpSmall = tileByName('小灯油');
    var hpBig = tileByName('大灯油');
    var sword = tileByName('守夜人之剑');
    var shield = tileByName('守夜人之盾');
    if (gemAtk) {
      setCopy('legend-atk', (gemAtk.name || '红宝石') + ' 攻击 +' + (effectAmount(gemAtk, 'atk') || 0));
    }
    if (gemDef) {
      setCopy('legend-def', (gemDef.name || '蓝宝石') + ' 防御 +' + (effectAmount(gemDef, 'def') || 0));
    }
    if (hpSmall) {
      setCopy('legend-hp', (hpSmall.name || '小灯油') + ' 生命 +' + (effectAmount(hpSmall, 'hp') || 0));
    }
    if (hpBig) {
      setCopy('legend-hp-big', (hpBig.name || '大灯油') + ' 生命 +' + (effectAmount(hpBig, 'hp') || 0));
    }
    if (sword || shield) {
      setCopy('legend-gear', '守夜人之剑 / 盾 攻击 +' + (effectAmount(sword, 'atk') || 0) + ' / 防御 +' + (effectAmount(shield, 'def') || 0) + '（红门后）');
    }
    setCopy('legend-goal', info.goal + ' 第 ' + n + ' 层终点');
    setCopy('legend-sub', '提灯的小人是你的守夜人，会朝移动的方向转身；其余形象都是怪物，脚下的小数字是这一战的预计损失。金环描边的是首领。');

    setCopy('win-story', info.boss + '倒下，' + info.goal + '重新亮起，长夜退去，山下的窗子一扇接一扇透出光——守夜人学徒，你做到了。');
  }

  /* ---------- 开局 / 存读档 ---------- */

  function startNew(message) {
    window.Game.init();
    if (window.RunLog && typeof window.RunLog.newRun === 'function') {
      try { window.RunLog.newRun(); } catch (err) { /* 上传功能不能影响开局 */ }
    }
    routeLog({ t: 'new' });
    started = true;
    closeAll();
    messages.length = 0;
    msgSig = null;
    lastTopMsg = 0;
    shown = {};
    resetShopTracking();
    pushMessage(message, 'floor');
    refresh();
    window.Renderer.draw();
    syncCanvasRatio();
  }

  function continueGame() {
    if (window.Game.load()) {
      started = true;
      routeLog({ t: 'load' });
      closeAll();
      messages.length = 0;
      msgSig = null;
      lastTopMsg = 0;
      shown = {};
      resetShopTracking();
      pushMessage('回到存档：' + window.Game.getFloorName(), 'floor');
      refresh();
      window.Renderer.draw();
      syncCanvasRatio();
      if (window.Game.state.won) { openWin(); }
    } else {
      pushMessage('读档失败：没有找到可用的存档。', 'danger');
      el.titleHint.textContent = '存档读取失败，请开始新游戏。';
      el.btnContinue.disabled = true;
    }
  }

  function doSave() {
    if (!ready || !started) { return; }
    var ok = window.Game.save();
    pushMessage(ok ? '已存档，下次可以从这里继续。' : '存档失败：浏览器存储不可用。', ok ? 'good' : 'danger');
    if (ok) { routeLog({ t: 'save' }); }
    refresh();
  }

  function doLoad() {
    if (!ready || !started) { return; }
    if (!window.Game.hasSave()) {
      pushMessage('还没有存档，先按 K 存一次。', 'warn');
      return;
    }
    if (window.Game.load()) {
      closeAll();
      routeLog({ t: 'load' });
      shown = {};
      resetShopTracking();
      pushMessage('已读取存档：' + window.Game.getFloorName(), 'good');
      refresh();
      window.Renderer.draw();
      syncCanvasRatio();
      if (window.Game.state.won) { openWin(); }
    } else {
      pushMessage('读档失败：存档已损坏或不可用。', 'danger');
    }
  }

  /* ---------- 图鉴 ---------- */

  function lossInfo(m) {
    if (!m.canHit) { return { text: '???', tone: 'tone-bad', tip: '攻击破不了防，现在打不动' }; }
    var damage = typeof m.damage === 'number' ? m.damage : 0;
    if (damage === 0) { return { text: '0', tone: 'tone-good', tip: '无伤取胜' }; }
    if (m.canWin) { return { text: String(damage), tone: 'tone-plain', tip: '能打赢，损失 ' + damage + ' 生命' }; }
    return { text: String(damage), tone: 'tone-bad', tip: '损失不小于当前生命，会战死' };
  }

  function numCell(value) {
    var td = make('td', '', formatNumber(value));
    fitNum(td, td.textContent);
    return td;
  }

  /* 引擎给了临界字段就直接用；还没给时按战斗公式本地补算 */
  function critValues(m) {
    var hero = (window.Game && window.Game.state) ? window.Game.state.hero : null;
    var atk = hero ? hero.atk : null;
    var def = hero ? hero.def : null;
    var critAtk = m ? m.critAtk : undefined;
    var critDamage = m ? m.critDamage : undefined;
    if (typeof critAtk === 'undefined' && m) {
      if (!m.canHit) {
        critAtk = (atk !== null && typeof m.def === 'number') ? (m.def + 1 - atk) : null;
      } else if (typeof m.turns === 'number') {
        if (m.turns <= 1) { critAtk = null; }
        else if (atk !== null && typeof m.hp === 'number' && typeof m.def === 'number') {
          critAtk = Math.ceil(m.hp / (m.turns - 1)) - (atk - m.def);
        } else { critAtk = null; }
      } else { critAtk = null; }
    }
    if (typeof critDamage === 'undefined' && typeof critAtk === 'number' &&
      atk !== null && def !== null && m && typeof m.hp === 'number' && typeof m.atk === 'number') {
      var per = (atk + critAtk) - m.def;
      if (per > 0) {
        var turns = Math.ceil(m.hp / per);
        critDamage = (turns - 1) * Math.max(0, m.atk - def);
      }
    }
    var critSave = m ? m.critSave : undefined;
    if (typeof critSave === 'undefined' && m && m.canHit &&
      typeof critDamage === 'number' && typeof m.damage === 'number') {
      critSave = m.damage - critDamage;
    }
    var defStep = m ? m.defStep : null;
    var defPrice = m ? m.defPrice : null;
    var defSave = m ? m.defSave : null;
    return { critAtk: critAtk, critDamage: critDamage, critSave: critSave, defStep: defStep, defPrice: defPrice, defSave: defSave };
  }

  /* “临界”列：第一行攻击临界，第二行防御临界；算不出来时留“—” */
  function critCell(m) {
    var td = document.createElement('td');
    td.className = 'cell-crit';
    var crit = critValues(m);
    var lines = 0;
    var first = '';
    if (m && !m.canHit && typeof crit.critAtk === 'number') {
      first = '攻 +' + crit.critAtk + ' 才打得动';
    } else if (m && m.canHit && crit.critAtk === null) {
      first = '一回合击杀';
    } else if (m && m.canHit && typeof crit.critAtk === 'number') {
      var save = (typeof crit.critSave === 'number') ? String(crit.critSave) : '—';
      first = '攻 +' + crit.critAtk + ' → 少扣 ' + save;
    }
    if (first) {
      var atkLine = make('span', 'crit-line crit-atk', first);
      fitNum(atkLine, first);
      td.appendChild(atkLine);
      lines++;
    }
    var second = '';
    if (m && m.damage === 0) {
      second = '已无伤';
    } else if (m && !m.canHit) {
      second = '打不动';
    } else if (typeof crit.defSave === 'number') {
      second = '买防 +' + crit.defStep + ' → 少扣 ' + crit.defSave;
    } else {
      second = '—';
    }
    if (second) {
      td.appendChild(make('span', 'crit-line crit-def', second));
      lines++;
    }
    if (!lines) { td.appendChild(make('span', 'crit-line crit-none', '—')); }
    var tip = '第一行：再加多少攻击能少打一回合、少扣多少血；第二行：';
    tip += (typeof crit.defPrice === 'number') ? '花 ' + crit.defPrice + ' 金币买一次防御' : '买一次防御';
    if (typeof crit.defStep === 'number') { tip += '（+' + crit.defStep + '）'; }
    tip += '能少扣多少血';
    td.title = tip;
    return td;
  }

  /* 「花光金币」总览行：数据来自 Game.getGoldPlan()，接口缺席时整行隐藏 */
  function renderCodexGold(plan) {
    var node = el.codexGold;
    if (!node) { return; }
    node.textContent = '';
    if (!plan) { node.hidden = true; return; }
    node.hidden = false;
    var gold = formatNumber(plan.gold);
    var atkBuys = Number(plan.atkBuys) || 0;
    var defBuys = Number(plan.defBuys) || 0;
    var goldAtk = Number(plan.goldAtk) || 0;
    var goldDef = Number(plan.goldDef) || 0;
    if (atkBuys <= 0 && defBuys <= 0) {
      node.textContent = '现有 ' + gold + ' 金，还不够买一次强化';
      return;
    }
    node.appendChild(make('span', '', '现有 ' + gold + ' 金：'));
    var atkText = (atkBuys > 0 && goldAtk > 0)
      ? '全买攻击 +' + formatNumber(goldAtk) + '（买 ' + atkBuys + ' 次）→ 本层少扣 ' + formatNumber(plan.floorAtkSave)
      : '全买攻击买不起';
    node.appendChild(make('span', 'gold-atk', atkText));
    node.appendChild(make('span', '', ' ／ '));
    var defText = (defBuys > 0 && goldDef > 0)
      ? '全买防御 +' + formatNumber(goldDef) + '（买 ' + defBuys + ' 次）→ 本层少扣 ' + formatNumber(plan.floorDefSave)
      : '全买防御买不起';
    node.appendChild(make('span', 'gold-def', defText));
  }

  /* 「花光金币」列：两小行（攻 / 防），省血更多的一行高亮 */
  function goldCell(m) {
    var td = make('td', 'cell-gold');
    var atkStep = (m && typeof m.goldAtk === 'number') ? m.goldAtk : 0;
    var defStep = (m && typeof m.goldDef === 'number') ? m.goldDef : 0;
    var atkUnlock = !!(m && m.goldAtkUnlock);
    var defUnlock = !!(m && m.goldDefUnlock);
    var atkSave = (m && typeof m.goldAtkSave === 'number') ? m.goldAtkSave : null;
    var defSave = (m && typeof m.goldDefSave === 'number') ? m.goldDefSave : null;
    var atkText = '—';
    var defText = '—';
    if (atkStep > 0) {
      if (atkUnlock) { atkText = '全买攻 +' + formatNumber(atkStep) + ' → 打得动了'; }
      else if (atkSave !== null) { atkText = '全买攻 +' + formatNumber(atkStep) + ' → 少扣 ' + formatNumber(atkSave); }
      else { atkText = '全买攻 +' + formatNumber(atkStep) + ' → 仍打不动'; }
    }
    if (defStep > 0) {
      if (defUnlock) { defText = '全买防 +' + formatNumber(defStep) + ' → 打得动了'; }
      else if (defSave !== null) { defText = '全买防 +' + formatNumber(defStep) + ' → 少扣 ' + formatNumber(defSave); }
      else { defText = '全买防 +' + formatNumber(defStep) + ' → 仍打不动'; }
    }
    /* 打得动了视作省血最多；两边一样多（或都没省）就不高亮 */
    var atkScore = atkUnlock ? Infinity : ((atkStep > 0 && atkSave !== null) ? atkSave : -1);
    var defScore = defUnlock ? Infinity : ((defStep > 0 && defSave !== null) ? defSave : -1);
    var atkLine = make('span', 'crit-line gold-line ' + (atkStep > 0 ? 'gold-atk' : 'gold-none'), atkText);
    var defLine = make('span', 'crit-line gold-line ' + (defStep > 0 ? 'gold-def' : 'gold-none'), defText);
    if (atkScore > defScore && atkScore > 0) { atkLine.classList.add('is-best'); }
    if (defScore > atkScore && defScore > 0) { defLine.classList.add('is-best'); }
    fitNum(atkLine, atkText);
    fitNum(defLine, defText);
    td.appendChild(atkLine);
    td.appendChild(defLine);
    td.title = '把现有金币全买攻击 / 全买防御后，打这只怪少扣的血；亮色加粗的一行省血更多';
    return td;
  }

  /* 特点来自数据的 kind；没有这个字段就留空 */
  function kindCell(id) {
    var monsters = (window.TOWER_DATA && window.TOWER_DATA.monsters) || null;
    var def = (monsters && id !== undefined && id !== null) ? monsters[id] : null;
    var kind = def && def.kind;
    var td = make('td', 'cell-kind');
    if (typeof kind === 'string' && hasOwn(KIND_LABEL, kind)) {
      td.appendChild(make('span', 'kind-tag kind-' + kind.toLowerCase(), KIND_LABEL[kind]));
    }
    return td;
  }

  function codexRow(m) {
    var tr = document.createElement('tr');
    if (typeof m.floorCount === 'number' && m.floorCount > 0) { tr.classList.add('is-here'); }
    if (typeof m.count === 'number' && m.count === 0) { tr.classList.add('is-cleared'); }
    var box = 56;
    var radius = m.boss ? 22 : 26;   /* drawPiece 用 radius*2 当形象尺寸：56 格里画 52，首领 44 */
    var scale = Math.min(window.devicePixelRatio || 1, 2);
    var icon = document.createElement('canvas');
    icon.width = Math.round(box * scale);
    icon.height = Math.round(box * scale);
    icon.style.width = box + 'px';
    icon.style.height = box + 'px';
    var g = icon.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    window.Renderer.drawPiece(g, box / 2, box / 2, radius, m);
    if (spriteHas(m.id)) {
      codexJobs.push({ g: g, box: box, scale: scale, radius: radius, monster: m });
    }

    var tdIcon = document.createElement('td');
    tdIcon.className = 'cell-figure';
    tdIcon.appendChild(icon);
    tr.appendChild(tdIcon);

    var tdName = make('td', 'cell-name');
    tdName.appendChild(make('span', '', m.name));
    if (m.boss) { tdName.appendChild(make('span', 'boss-tag', 'BOSS')); }
    tr.appendChild(tdName);

    tr.appendChild(kindCell(m.id));
    tr.appendChild(numCell(m.hp));
    tr.appendChild(numCell(m.atk));
    tr.appendChild(numCell(m.def));
    tr.appendChild(numCell(m.gold));

    /* “剩余”列：本幕还剩几只；当前层也有时第二行写本层 */
    var tdCount = make('td', 'cell-count');
    var actLine = make('span', 'crit-line count-act', '本幕 ' + formatNumber(m.count));
    fitNum(actLine, actLine.textContent);
    tdCount.appendChild(actLine);
    if (typeof m.floorCount === 'number' && m.floorCount > 0) {
      var floorLine = make('span', 'crit-line count-floor', '本层 ' + formatNumber(m.floorCount));
      fitNum(floorLine, floorLine.textContent);
      tdCount.appendChild(floorLine);
    }
    tr.appendChild(tdCount);

    var info = lossInfo(m);
    var tdLoss = document.createElement('td');
    tdLoss.title = info.tip;
    var lossSpan = make('span', 'loss ' + info.tone, info.text);
    fitNum(lossSpan, info.text);
    tdLoss.appendChild(lossSpan);
    if (m.canHit && typeof m.turns === 'number') {
      tdLoss.appendChild(make('span', 'loss-turns', m.turns + ' 回合'));
    }
    tr.appendChild(tdLoss);
    tr.appendChild(critCell(m));
    tr.appendChild(goldCell(m));
    return tr;
  }

  /* 图鉴当前内容 + 指纹：金币、属性、层号、各种怪剩余数变了才值得重画 */
  function codexSnapshot() {
    var G = window.Game;
    var byAct = typeof G.getActMonsters === 'function';
    var list = (byAct ? G.getActMonsters() : G.getFloorMonsters()) || [];
    var plan = (typeof G.getGoldPlan === 'function') ? G.getGoldPlan() : null;
    var hero = G.state.hero;
    var parts = [G.state.floor, hero.hp, hero.atk, hero.def, hero.gold];
    for (var i = 0; i < list.length; i++) {
      parts.push(list[i].id + ':' + list[i].count + ':' + (list[i].floorCount || 0));
    }
    return { byAct: byAct, list: list, plan: plan, sig: parts.join(',') };
  }

  function renderCodex(snap) {
    var G = window.Game;
    var list = snap.list;
    if (snap.byAct) {
      var left = 0;
      for (var n = 0; n < list.length; n++) { left += Number(list[n].count) || 0; }
      var act = (typeof G.getAct === 'function') ? G.getAct() : null;
      var actTitle = act ? (act.title || act.name) : '';
      el.codexFloor.textContent = actTitle + ' · ' + G.getFloorName() + ' · 本幕还剩 ' + left + ' 只';
    } else {
      el.codexFloor.textContent = G.getFloorName() + ' · 还活着 ' + list.length + ' 种怪物';
    }
    renderCodexGold(snap.plan);
    el.codexBody.textContent = '';
    el.codexEmpty.hidden = list.length > 0;
    el.codexWrap.hidden = list.length === 0;
    codexJobs = [];
    for (var i = 0; i < list.length; i++) {
      el.codexBody.appendChild(codexRow(list[i]));
    }
    codexSig = snap.sig;
  }

  function openCodex() {
    if (!ready || !started) { return; }
    renderCodex(codexSnapshot());
    openModal('codex');
  }

  /* ---------- 随身售货机 ---------- */

  function shopReady() {
    var G = window.Game;
    return !!(ready && G && typeof G.getShopGoods === 'function' && typeof G.buyGoods === 'function');
  }

  function resetShopTracking() {
    goodsIds = null;
    goodsFloor = -1;
    goodsSig = '';
    goodsRefs = {};
    freshGoods = {};
  }

  /* 分组顺序与标题来自数据；数据没给 groups 就按商品出现顺序兜底 */
  function groupOrder(list) {
    var data = window.TOWER_DATA;
    var declared = (data && data.shop && data.shop.groups) || null;
    var order = [];
    var titles = {};
    var i, id;
    if (Array.isArray(declared)) {
      for (i = 0; i < declared.length; i++) {
        id = declared[i] && declared[i].id;
        if (!id || hasOwn(titles, id)) { continue; }
        titles[id] = (declared[i] && declared[i].title) || GROUP_TITLE[id] || id;
        order.push(id);
      }
    }
    for (i = 0; i < list.length; i++) {
      id = list[i].group || 'stat';
      if (!hasOwn(titles, id)) {
        titles[id] = GROUP_TITLE[id] || id;
        order.push(id);
      }
    }
    return { order: order, titles: titles };
  }

  function goodsButton(item, index) {
    var cell = make('div', 'goods-cell');
    var btn = make('button', 'goods-btn');
    btn.type = 'button';
    btn.setAttribute('data-goods-id', item.id);
    /* 旧档和超出 1–5 的货没有数字键：留出角标的列宽保持对齐，但不显示数字 */
    var shortcut = (index >= 0 && index < SHORTCUTS.length) ? SHORTCUTS.charAt(index) : '';
    var num = make('span', 'goods-num', shortcut);
    if (!shortcut) { num.style.visibility = 'hidden'; }
    btn.appendChild(num);
    btn.appendChild(make('span', 'goods-label', item.label));
    btn.appendChild(make('span', 'goods-desc', item.desc));

    var tail = make('span', 'goods-tail');
    var price = make('span', 'goods-price', formatNumber(item.price));
    var lock = make('span', 'goods-lock');
    lock.appendChild(make('i', 'lock-icon'));
    var hint = make('span', 'goods-hint');
    lock.appendChild(hint);
    var owned = make('span', 'goods-owned', '已拥有');
    tail.appendChild(price);
    tail.appendChild(lock);
    tail.appendChild(owned);
    btn.appendChild(tail);
    cell.appendChild(btn);

    return { cell: cell, btn: btn, price: price, lock: lock, hint: hint, owned: owned };
  }

  function buildGoods(list) {
    el.shopGoods.textContent = '';
    goodsRefs = {};
    var meta = groupOrder(list);
    var buckets = {};
    var shelfIndex = {};
    var shelf = 0;
    var i, item, key;
    for (i = 0; i < list.length; i++) {
      item = list[i];
      key = item.group || 'stat';
      if (!hasOwn(buckets, key)) { buckets[key] = []; }
      buckets[key].push(item);
      if (!item.old) { shelfIndex[item.id] = shelf++; }
    }
    for (i = 0; i < meta.order.length; i++) {
      key = meta.order[i];
      var entries = buckets[key];
      if (!entries || !entries.length) { continue; }   /* 整组下架时连标题一起消失 */
      var wide = false;
      for (var e = 0; e < entries.length; e++) {
        if (String(entries[e].desc || '').length > WIDE_DESC) { wide = true; }
      }
      var section = make('div', 'goods-group');
      section.appendChild(make('p', 'goods-head', meta.titles[key]));
      var grid = make('div', 'goods-grid' + (wide ? ' is-wide' : ''));
      for (var j = 0; j < entries.length; j++) {
        item = entries[j];
        var ref = goodsButton(item, hasOwn(shelfIndex, item.id) ? shelfIndex[item.id] : -1);
        goodsRefs[item.id] = ref;
        grid.appendChild(ref.cell);
      }
      section.appendChild(grid);
      el.shopGoods.appendChild(section);
    }
  }

  function updateGoods(item) {
    var ref = goodsRefs[item.id];
    if (!ref) { return; }
    var poor = !item.affordable && !item.locked && !item.owned;
    ref.btn.className = 'goods-btn' + (item.locked ? ' is-locked' : '') +
      (item.owned ? ' is-owned' : '') + (poor ? ' is-poor' : '') +
      (freshGoods[item.id] ? ' is-new' : '');
    ref.btn.disabled = !item.canBuy;
    ref.price.hidden = item.locked || item.owned;
    ref.lock.hidden = !item.locked;
    ref.owned.hidden = !item.owned;
    if (item.locked) { ref.hint.textContent = item.lockHint || '尚未解锁'; }
    ref.btn.title = item.label + ' · ' + item.desc + ' · ' + formatNumber(item.price) + ' 金币' +
      (item.locked ? ' · ' + (item.lockHint || '尚未解锁') : (item.owned ? ' · 已拥有' : (poor ? ' · 金币不够' : '')));
  }

  /* 换层后新上架的货：写一条札记，售货机和新货各闪一下 */
  function announceGoods(list, floor) {
    var ids = '';
    var i;
    for (i = 0; i < list.length; i++) { ids += list[i].id + ','; }
    if (goodsIds !== null && ids !== goodsIds && floor !== goodsFloor) {
      var before = ',' + goodsIds;
      var added = [];
      freshGoods = {};
      for (i = 0; i < list.length; i++) {
        if (!list[i].old && before.indexOf(',' + list[i].id + ',') < 0) {
          added.push(list[i].label);
          freshGoods[list[i].id] = true;
        }
      }
      if (added.length) {
        pushMessage('控制台上新：' + added.join('、'), 'good');
        callShop();
      }
    } else if (floor !== goodsFloor) {
      freshGoods = {};
    }
    goodsIds = ids;
    goodsFloor = floor;
  }

  function renderShop() {
    var G = window.Game;
    var gold = (G && G.state && G.state.hero) ? G.state.hero.gold : 0;
    setValue(el.shopGold, gold, 'shopGold');
    var list = shopReady() ? (G.getShopGoods() || []) : [];
    if (!list.length) {
      el.shopGoods.textContent = '';
      el.shopNote.hidden = false;
      goodsList = [];
      resetShopTracking();
      return;
    }
    el.shopNote.hidden = true;
    el.shopName.textContent = (typeof G.getShopName === 'function' && G.getShopName()) || '随身售货机';
    goodsList = list;
    announceGoods(list, G.state ? G.state.floor : 0);
    var sig = '';
    for (var i = 0; i < list.length; i++) {
      sig += list[i].id + '/' + list[i].group + ',';
    }
    if (sig !== goodsSig) {
      buildGoods(list);
      goodsSig = sig;
    }
    for (i = 0; i < list.length; i++) { updateGoods(list[i]); }
  }

  function buy(id) {
    if (!ready || !started || stack.length) { return; }
    if (!shopReady()) {
      pushMessage('售货机暂不可用。', 'warn');
      return;
    }
    var result = window.Game.buyGoods(id) || { ok: false, message: '购买失败。' };
    pushMessage(result.message, result.ok ? 'good' : 'warn');
    refresh();
    window.Renderer.draw();
    if (!result.ok) { return; }
    var ref = goodsRefs[id];
    if (ref) { replay(ref.btn, 'is-bought'); }
    var hero = window.Game.state.hero;
    for (var i = 0; i < goodsList.length; i++) {
      if (goodsList[i].id === id) {
        window.Renderer.floatText(hero.x, hero.y, goodsList[i].label, ITEM_COLOR);
        break;
      }
    }
    routeLog({ t: 'buy', id: id });
  }

  function buyByIndex(index) {
    if (!goodsList.length) {
      if (ready && started && !stack.length) { pushMessage('售货机暂不可用。', 'warn'); }
      return;
    }
    var item = shelfGoods()[index];
    if (item) { buy(item.id); }
  }

  /* 新货上架时闪两下，把视线引到控制台的售货机 */
  function callShop() {
    replay(el.shopPanel, 'is-called');
    if (window.innerWidth < 900 && typeof el.shopPanel.scrollIntoView === 'function') {
      el.shopPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ---------- 道具栏 ---------- */

  function renderBag() {
    var G = window.Game;
    var state = G && G.state;
    var items = (state && state.hero && state.hero.items) || null;
    var usable = !!(items && typeof G.useItem === 'function' && !state.won);
    var lamp = items ? items.lamp : 0;
    el.bagLampCount.textContent = lamp > 0 ? '已拥有' : '未拥有';
    bagBtns.lamp.disabled = !(usable && lamp > 0);
    var jumpable = !!(state && typeof G.canLampJump === 'function');
    bagBtns.up.disabled = !(jumpable && G.canLampJump('up'));
    bagBtns.down.disabled = !(jumpable && G.canLampJump('down'));
  }

  function openTravel() {
    if (!ready || !started || stack.length) { return; }
    var G = window.Game;
    var items = G.state.hero.items;
    if (typeof G.useItem !== 'function' || typeof G.getVisitedFloors !== 'function') {
      pushMessage('道具暂不可用。', 'warn');
      return;
    }
    if (!items || !(items.lamp > 0)) {
      pushMessage('没有引路灯符。', 'warn');
      return;
    }
    var floors = G.getVisitedFloors() || [];
    var current = G.state.floor;
    /* 默认停在离脚下最近的一层，省得每次从头滚 */
    var focusFloor = -1;
    var i;
    for (i = 0; i < floors.length; i++) {
      if (floors[i].floor === current) { continue; }
      if (focusFloor < 0 || Math.abs(floors[i].floor - current) < Math.abs(focusFloor - current)) {
        focusFloor = floors[i].floor;
      }
    }
    el.travelList.textContent = '';
    var lastZone = -1;
    for (i = 0; i < floors.length; i++) {
      var f = floors[i];
      var zone = zoneOf(f.floor);
      if (zone.index !== lastZone) {
        var head = make('p', 'travel-zone', zoneTitle(zone));
        paintZone(head, zone.index);
        el.travelList.appendChild(head);
        lastZone = zone.index;
      }
      var here = f.floor === current;
      var btn = make('button', 'travel-btn');
      btn.type = 'button';
      btn.setAttribute('data-floor', String(f.floor));
      btn.disabled = here;
      paintZone(btn, zone.index);
      btn.appendChild(make('span', 'travel-num', String(f.floor + 1)));
      btn.appendChild(make('span', 'travel-name', f.name));
      if (zone.scale > 1) {
        btn.appendChild(make('span', 'travel-scale', '×' + zone.scale));
      }
      btn.appendChild(make('span', 'travel-tag', here ? '当前' : '传送'));
      if (f.floor === focusFloor) { btn.setAttribute('data-autofocus', ''); }
      el.travelList.appendChild(btn);
    }
    el.travelEmpty.hidden = focusFloor >= 0;
    openModal('travel');
  }

  function travelTo(floor) {
    if (!ready || !started) { return; }
    var events = window.Game.useItem('lamp', floor) || [];
    closeTop();
    for (var i = 0; i < events.length; i++) { handleEvent(events[i]); }
    refresh();
    window.Renderer.draw();
  }

  /* 灯符快捷上下楼：事件走和 lamp 传送同一条 handleEvent 路 */
  function lampJump(dir) {
    if (!ready || !started || stack.length) { return; }
    var G = window.Game;
    if (typeof G.lampJump !== 'function') {
      pushMessage('道具暂不可用。', 'warn');
      return;
    }
    var events = G.lampJump(dir) || [];
    for (var i = 0; i < events.length; i++) { handleEvent(events[i]); }
    refresh();
    window.Renderer.draw();
  }

  /* ---------- 通关 ---------- */

  function openWin() {
    var state = window.Game.state;
    el.winSteps.textContent = formatNumber(state.steps);
    el.winHp.textContent = formatNumber(state.hero.hp);
    el.winAtkDef.textContent = formatNumber(state.hero.atk) + ' / ' + formatNumber(state.hero.def);
    el.winGold.textContent = formatNumber(state.hero.gold);
    fitNum(el.winSteps, el.winSteps.textContent);
    fitNum(el.winHp, el.winHp.textContent);
    fitNum(el.winAtkDef, el.winAtkDef.textContent);
    fitNum(el.winGold, el.winGold.textContent);

    var ranks = (window.TOWER_DATA && Array.isArray(window.TOWER_DATA.ranks)) ? window.TOWER_DATA.ranks : null;
    var rank = null;
    if (ranks) {
      for (var i = 0; i < ranks.length; i++) {
        var r = ranks[i];
        if (r && typeof r.min === 'number' && state.hero.hp >= r.min) { rank = r; break; }
      }
    }
    if (rank) {
      el.winRankLetter.textContent = rank.label || '';
      el.winRankText.textContent = rank.text || '';
      el.winRank.hidden = false;
    } else {
      el.winRank.hidden = true;
    }
    openModal('win');
  }

  /* ---------- 进入新的一幕 ---------- */

  function openAct(ev) {
    el.actTitle.textContent = ev.title || '';
    el.actIntro.textContent = ev.intro || '';
    el.actIntro.hidden = !ev.intro;

    var cleared = ev.cleared || null;
    var rank = cleared && cleared.rank;
    if (rank && rank.label) {
      el.actRankLetter.textContent = rank.label;
      el.actRankAct.textContent = (cleared.title || '上一幕') + ' · 评级';
      el.actRankText.textContent = rank.text || '';
      el.actRank.hidden = false;
    } else {
      el.actRank.hidden = true;
    }

    /* 弹窗染上这一幕的颜色 */
    for (var z = 0; z < zones.length; z++) {
      if (zones[z].act && ev.act !== undefined && zones[z].act.id === ev.act) {
        paintZone(el.act, zones[z].index);
        break;
      }
    }
    openModal('act');
  }

  /* ---------- 幕间存档 ---------- */

  function syncCheckpointButton() {
    var G = window.Game;
    var has = !!(G && typeof G.hasCheckpoint === 'function' && G.hasCheckpoint());
    el.btnCheckpoint.hidden = !has;
    if (!has) { return; }
    var info = (typeof G.getCheckpointInfo === 'function') ? G.getCheckpointInfo() : null;
    el.checkpointSub.textContent = (info && typeof info.floor === 'number')
      ? (info.title || '') + ' · 第 ' + (info.floor + 1) + ' 层'
      : '';
  }

  function backToCheckpoint() {
    var G = window.Game;
    if (!G || typeof G.loadCheckpoint !== 'function') { return; }
    var info = (typeof G.getCheckpointInfo === 'function') ? G.getCheckpointInfo() : null;
    var title = info && info.title;
    if (G.loadCheckpoint()) {
      closeAll();
      routeLog({ t: 'cp' });
      shown = {};
      resetShopTracking();
      if (!title) {
        var act = currentAct();
        title = act && act.title;
      }
      pushMessage('回到 ' + (title || '本幕') + ' 的开头', 'floor');
      refresh();
      window.Renderer.draw();
      syncCanvasRatio();
    } else {
      pushMessage('幕间存档读取失败。', 'danger');
      syncCheckpointButton();
    }
  }

  /* ---------- 移动与事件 ---------- */

  /* 打通一幕记一条成绩（§8.7）；RunLog 缺席或出错都不影响游戏 */
  function reportClear(act, actTitle, rankLabel, isFinal) {
    var RL = window.RunLog;
    if (!RL || typeof RL.recordClear !== 'function') { return; }
    try {
      var state = window.Game.state;
      var hero = state.hero;
      var name = actTitle || '本幕';
      RL.recordClear({
        act: act,
        actTitle: actTitle || '',
        rank: rankLabel || null,
        final: !!isFinal,
        floor: state.floor + 1,
        hp: hero.hp,
        atk: hero.atk,
        def: hero.def,
        gold: hero.gold,
        keys: hero.keys,
        steps: state.steps
      }, function (ok) {
        pushMessage(ok ? name + '成绩已上传' : name + '成绩已存在本机，连上服务器后补传', ok ? 'good' : 'warn');
      });
    } catch (err) { /* 忽略 */ }
  }

  function winRankLabel(act) {
    if (!act || !Array.isArray(act.ranks)) { return null; }
    var hp = window.Game.state.hero.hp;
    for (var i = 0; i < act.ranks.length; i++) {
      var r = act.ranks[i];
      if (r && typeof r.min === 'number' && hp >= r.min) { return r.label || null; }
    }
    return null;
  }

  function canMove() {
    return ready && started && !stack.length && !window.Game.state.won;
  }

  /* 飘字要和引擎的提示一致：生命/攻击/防御乘本层 itemScale，钥匙不乘 */
  function effectText(tile) {
    var tiles = (window.TOWER_DATA && window.TOWER_DATA.tiles) || {};
    var def = tiles[tile];
    var effect = def && def.effect;
    if (!effect) { return ''; }
    var G = window.Game;
    var scale = (G && typeof G.getItemScale === 'function') ? G.getItemScale() : 1;
    if (!(typeof scale === 'number' && scale > 0)) { scale = 1; }
    var parts = [];
    for (var key in effect) {
      if (!hasOwn(effect, key)) { continue; }
      var amount = effect[key];
      if (key === 'hp' || key === 'atk' || key === 'def') { amount = Math.round(amount * scale); }
      parts.push((EFFECT_NAME[key] || key) + ' +' + amount);
    }
    return parts.join(' ');
  }

  /* ---------- 路线日志（DESIGN §8.7）：每个动作都记一条，带当时的状态快照 ---------- */

  var DIR_STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function routeLog(entry, dir) {
    try {
      if (!window.RunLog || typeof window.RunLog.route !== 'function') { return; }
      var G = window.Game;
      var state = G && G.state;
      if (!state || !entry) { return; }
      var hero = state.hero || {};
      var keys = hero.keys || {};
      entry.s = state.steps;
      entry.f = state.floor + 1;
      entry.hp = hero.hp;
      entry.atk = hero.atk;
      entry.def = hero.def;
      entry.gold = hero.gold;
      entry.k = [keys.yellow || 0, keys.blue || 0, keys.red || 0];
      /* 被拦住的这一步没有坐标：用主角位置加方向补出目标格 */
      if (dir && DIR_STEP[dir] && typeof entry.x !== 'number') {
        entry.x = hero.x + DIR_STEP[dir][0];
        entry.y = hero.y + DIR_STEP[dir][1];
      }
      window.RunLog.route(entry);
    } catch (err) { /* 路线日志不能影响游戏 */ }
  }

  function handleEvent(ev, dir) {
    if (!ev || !ev.type) { return; }
    var R = window.Renderer;
    var hero;
    switch (ev.type) {
      case 'blocked':
        if (ev.message) {
          pushMessage(ev.message, ev.reason === 'nokey' ? 'warn' : (ev.reason === 'wall' ? 'info' : 'danger'));
          if (ev.reason !== 'wall') { replay(el.frame, 'is-nudge'); }
        }
        if (ev.reason !== 'wall') {
          var blocked = { t: 'x', why: ev.reason };
          if (typeof ev.x === 'number' && typeof ev.y === 'number') {
            blocked.x = ev.x;
            blocked.y = ev.y;
          }
          routeLog(blocked, dir);
        }
        break;
      case 'door':
        pushMessage(ev.message, 'good');
        R.flash(ev.x, ev.y);
        R.floatText(ev.x, ev.y, (KEY_NAME[ev.key] || '钥匙') + ' -1', KEY_COLOR[ev.key] || '#f0a93b');
        routeLog({ t: 'd', c: ev.key, x: ev.x, y: ev.y });
        break;
      case 'item':
        pushMessage(ev.message, 'good');
        R.flash(ev.x, ev.y);
        R.floatText(ev.x, ev.y, effectText(ev.tile) || ev.name || '获得物品', ITEM_COLOR);
        routeLog({ t: 'i', c: ev.tile, x: ev.x, y: ev.y });
        break;
      case 'battle':
        R.flash(ev.x, ev.y);
        hero = window.Game.state.hero;
        if (ev.damage > 0) { R.floatText(hero.x, hero.y, '-' + ev.damage, DAMAGE_COLOR); }
        if (ev.gold > 0) { R.floatText(ev.x, ev.y, '+' + ev.gold + ' 金', GOLD_COLOR); }
        pushMessage(ev.message, 'battle');
        routeLog({ t: 'b', m: ev.id, x: ev.x, y: ev.y, dmg: ev.damage, g: ev.gold });
        break;
      case 'stairs':
        pushMessage(ev.via === 'lamp' && ev.message ? ev.message : '来到 ' + window.Game.getFloorName(), 'floor');
        replay(el.veil, 'is-lit');
        routeLog({ t: 's', from: ev.from + 1, to: ev.to + 1, lamp: ev.via === 'lamp' });
        break;
      case 'act':
        /* 上一幕的路线要在 reportClear 之前收尾，这条也会算进上一幕 */
        routeLog({ t: 'a', act: ev.act, cleared: (ev.cleared && ev.cleared.rank) ? ev.cleared.rank.label : null });
        /* pushMessage 是 unshift：先推通关记录，才能让它排在“进入 …”下面 */
        if (ev.cleared && ev.cleared.rank && ev.cleared.rank.label) {
          pushMessage((ev.cleared.title || '上一幕') + ' 通关 · 评级 ' + ev.cleared.rank.label, 'good');
        }
        pushMessage('进入 ' + (ev.title || '新的一幕'), 'floor');
        if (ev.cleared) {
          reportClear(ev.cleared.act, ev.cleared.title,
            ev.cleared.rank && ev.cleared.rank.label, false);
        }
        openAct(ev);
        break;
      case 'win':
        routeLog({ t: 'w' });
        pushMessage('灯芯重燃，长夜结束了。', 'floor');
        var winAct = (typeof window.Game.getAct === 'function') ? window.Game.getAct() : null;
        if (winAct) {
          reportClear(winAct.id, winAct.title || winAct.name, winRankLabel(winAct), true);
        }
        openWin();
        break;
    }
  }

  function step(dir) {
    if (!canMove()) { return; }
    var events = window.Game.move(dir) || [];
    for (var i = 0; i < events.length; i++) { handleEvent(events[i], dir); }
    refresh();
    window.Renderer.draw();
  }

  /* ---------- 输入 ---------- */

  function stopRepeat() {
    if (repeatTimer !== null) {
      window.clearInterval(repeatTimer);
      repeatTimer = null;
    }
  }

  function clearHeld() {
    held.length = 0;
    stopRepeat();
    padDir = null;
    if (padBtn) {
      padBtn.classList.remove('is-down');
      padBtn = null;
    }
  }

  function press(dir) {
    if (!canMove()) { return; }
    if (held.indexOf(dir) < 0) { held.push(dir); }
    step(dir);
    if (!canMove() || !held.length) {
      clearHeld();
      return;
    }
    if (repeatTimer === null) {
      repeatTimer = window.setInterval(function () {
        var next = held[held.length - 1];
        if (!next) { return; }
        if (!canMove()) { clearHeld(); return; }
        step(next);
      }, REPEAT_MS);
    }
  }

  function release(dir) {
    var i = held.indexOf(dir);
    if (i >= 0) { held.splice(i, 1); }
    if (!held.length) { stopRepeat(); }
  }

  function endPad() {
    if (!padDir) { return; }
    release(padDir);
    padDir = null;
    if (padBtn) {
      padBtn.classList.remove('is-down');
      padBtn = null;
    }
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    var key = e.key;
    if (!key) { return; }
    var k = key.length === 1 ? key.toLowerCase() : key;
    var dir = KEY_DIR[k];
    if (dir) {
      e.preventDefault();
      if (!e.repeat) { press(dir); }
      return;
    }
    if (k === 'Escape') {
      e.preventDefault();
      var top = topModal();
      if (top && !UNCLOSABLE[top] && !actGuarded()) { closeTop(); }
      return;
    }
    if (topModal() === 'act' && k === 'Enter') {
      e.preventDefault();
      if (!actGuarded()) { closeTop(); }
      return;
    }
    if (topModal() === 'title' && k === 'h') {
      e.preventDefault();
      openModal('help');
      return;
    }
    if (stack.length || !ready || !started) { return; }
    var slot = SHORTCUTS.indexOf(k);
    if (slot >= 0) { e.preventDefault(); buyByIndex(slot); }
    else if (k === 'f') { e.preventDefault(); openTravel(); }
    else if (k === 'e') { e.preventDefault(); if (!e.repeat) { lampJump('up'); } }
    else if (k === 'q') { e.preventDefault(); if (!e.repeat) { lampJump('down'); } }
    else if (k === 'x') { e.preventDefault(); openCodex(); }
    else if (k === 'k') { e.preventDefault(); doSave(); }
    else if (k === 'l') { e.preventDefault(); doLoad(); }
    else if (k === 'h') { e.preventDefault(); openModal('help'); }
  }

  function onKeyUp(e) {
    var key = e.key;
    if (!key) { return; }
    var dir = KEY_DIR[key.length === 1 ? key.toLowerCase() : key];
    if (dir) { release(dir); }
  }

  function bindPad(btn) {
    var dir = btn.getAttribute('data-dir');
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!canMove()) { return; }
      endPad();
      padDir = dir;
      padBtn = btn;
      btn.classList.add('is-down');
      press(dir);
    });
    btn.addEventListener('click', function (e) {
      if (e.detail === 0) { step(dir); }
    });
  }

  function onOverlayClick(e) {
    var target = e.target;
    if (closest(target, '[data-close]')) {
      if (!actGuarded()) { closeTop(); }
      return;
    }
    if (target === el.overlay) {
      var top = topModal();
      if (top && !UNCLOSABLE[top] && !NO_BACKDROP[top]) { closeTop(); }
    }
  }

  function onGoodsClick(e) {
    var btn = closest(e.target, '[data-goods-id]');
    if (!btn || btn.disabled) { return; }
    buy(btn.getAttribute('data-goods-id'));
  }

  function onBagClick(e) {
    var jump = closest(e.target, '[data-lamp-jump]');
    if (jump) {
      if (!jump.disabled) { lampJump(jump.getAttribute('data-lamp-jump')); }
      return;
    }
    var btn = closest(e.target, '[data-item-id]');
    if (!btn || btn.disabled) { return; }
    var id = btn.getAttribute('data-item-id');
    if (id === 'lamp') { openTravel(); }
  }

  function onTravelClick(e) {
    var btn = closest(e.target, '[data-floor]');
    if (!btn || btn.disabled) { return; }
    var floor = parseInt(btn.getAttribute('data-floor'), 10);
    if (isFinite(floor)) { travelTo(floor); }
  }

  /* ---------- 启动 ---------- */

  function syncCanvasRatio() {
    window.requestAnimationFrame(function () {
      if (window.Renderer && typeof window.Renderer.resize === 'function') {
        window.Renderer.resize();
      }
    });
  }

  function onWindowResize() {
    if (resizeTimer !== null) { window.clearTimeout(resizeTimer); }
    resizeTimer = window.setTimeout(function () {
      resizeTimer = null;
      if (window.Renderer && typeof window.Renderer.resize === 'function') {
        window.Renderer.resize();
      }
    }, 120);
  }

  function cacheElements() {
    for (var name in IDS) {
      if (hasOwn(IDS, name)) { el[name] = document.getElementById(IDS[name]); }
    }
    bagBtns.lamp = el.bag.querySelector('[data-item-id="lamp"]');
    bagBtns.up = el.bag.querySelector('[data-lamp-jump="up"]');
    bagBtns.down = el.bag.querySelector('[data-lamp-jump="down"]');
  }

  function bind() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearHeld(); stopFigures(); }
      else { scheduleFigures(); }
    });
    window.addEventListener('pointerup', endPad);
    window.addEventListener('pointercancel', endPad);
    window.addEventListener('resize', onWindowResize);

    var pads = el.dpad.querySelectorAll('.pad');
    for (var i = 0; i < pads.length; i++) { bindPad(pads[i]); }
    el.dpad.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    el.btnCodex.addEventListener('click', openCodex);
    el.btnSave.addEventListener('click', doSave);
    el.btnLoad.addEventListener('click', doLoad);
    el.btnRestart.addEventListener('click', function () {
      syncCheckpointButton();
      openModal('confirm');
    });
    el.btnHelp.addEventListener('click', function () { openModal('help'); });
    el.btnNew.addEventListener('click', function () {
      var info = actInfo();
      startNew('守夜开始。提灯向上，穿过' + (info.acts.length ? info.actsCn + '幕' : '') + info.countCn + '层。');
    });
    el.btnContinue.addEventListener('click', continueGame);
    el.btnAgain.addEventListener('click', function () { startNew('再一次向上，灯还等着被点亮。'); });
    el.btnYes.addEventListener('click', function () { startNew('重新守夜，回到第 1 层。'); });
    el.btnCheckpoint.addEventListener('click', backToCheckpoint);
    el.btnActOk.addEventListener('pointerdown', function () {
      /* 只在真的按在按钮上才算数：触屏抬手时浏览器补发的 click 不会有这一步 */
      actOkArmed = true;
    });
    el.btnActOk.addEventListener('click', function (e) {
      if (actGuarded()) { return; }
      if (e.detail !== 0 && !actOkArmed) { return; }
      closeTop();
    });
    el.overlay.addEventListener('click', onOverlayClick);
    el.shopGoods.addEventListener('click', onGoodsClick);
    el.bag.addEventListener('click', onBagClick);
    el.travelList.addEventListener('click', onTravelClick);
  }

  function boot() {
    cacheElements();
    /* 调试模式由引擎按网址判断（DESIGN §8.8）：必须在第一次 refresh 之前问好 */
    try {
      debugMode = !!(window.Game && typeof window.Game.isDebug === 'function' && window.Game.isDebug());
    } catch (err) { debugMode = false; }
    if (debugMode && el.debugBadge) { el.debugBadge.hidden = false; }
    applyCopy();
    buildTrack();
    bind();
    if (!window.Game || !window.Renderer) {
      el.btnNew.disabled = true;
      el.btnContinue.hidden = true;
      el.titleHint.textContent = '未能加载 js/data.js 或 js/engine.js，请确认它们和 index.html 在同一份目录下。';
      openModal('title');
      return;
    }
    window.Renderer.init(el.board);
    ready = true;
    setupTitleHero();
    refresh();
    window.Renderer.draw();
    syncCanvasRatio();
    openTitle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();