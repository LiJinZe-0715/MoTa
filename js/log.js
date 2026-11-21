/* js/log.js —— 成绩上传（DESIGN.md §8.7）、札记落盘（§8.9）：本机队列 + POST，失败不影响游戏 */
(function () {
  'use strict';

  var RUN_KEY = 'emberTower.runId';
  var QUEUE_KEY = 'emberTower.pendingClears';
  var ROUTE_KEY = 'emberTower.route';
  var MSG_QUEUE_KEY = 'emberTower.msgQueue';
  var ROUTE_MAX = 30000;
  var MSG_MAX = 3000;
  var MSG_TEXT_MAX = 2000;
  var MSG_BATCH = 500;
  var MSG_BATCH_BYTES = 800 * 1024;
  var flushing = false;
  var waiters = {};
  var msgFlushing = false;
  var msgTimer = null;

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function lsGet(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }

  function lsSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* 存储不可用时只影响补传 */ }
  }

  function randomId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6);
  }

  /* 这一页加载的版本（DESIGN §8.7）：tools/build-data.js 写在 TOWER_DATA.build 里 */
  function currentBuild() {
    try {
      var b = window.TOWER_DATA && window.TOWER_DATA.build;
      if (!b || typeof b !== 'object') { return null; }
      return { version: String(b.version || ''), data: String(b.data || ''), engine: String(b.engine || '') };
    } catch (err) { return null; }
  }

  function buildTag(b) {
    return b ? (b.version || '?') + '+' + b.data + '.' + b.engine : '无版本';
  }

  function getRunId() {
    var id = lsGet(RUN_KEY);
    if (!id) {
      id = randomId();
      lsSet(RUN_KEY, id);
    }
    return id;
  }

  /* 调试模式（DESIGN §8.8）：不生成 runId、不记路线、不上传。
   * 本机上传队列里已有的正常局成绩照常补传；调用时现问引擎，不自己读网址 */
  function isDebug() {
    try {
      return !!(window.Game && typeof window.Game.isDebug === 'function' && window.Game.isDebug());
    } catch (err) { return false; }
  }

  function newRun() {
    try {
      if (isDebug()) { return null; }
      var id = randomId();
      lsSet(RUN_KEY, id);
      lsSet(ROUTE_KEY, JSON.stringify({ runId: id, entries: [], sent: 0 }));
      return id;
    } catch (err) { return null; }
  }

  /* 路线日志：本局的每一个动作，按幕切段随成绩上传（DESIGN §8.7） */
  function writeRoute(data) {
    try { lsSet(ROUTE_KEY, JSON.stringify(data)); } catch (err) { /* 存不下就只丢路线 */ }
  }

  function readRoute() {
    var runId = getRunId();
    var data = null;
    var raw = lsGet(ROUTE_KEY);
    if (raw) {
      try { data = JSON.parse(raw); } catch (err) { data = null; }
    }
    if (!data || typeof data !== 'object' || data.runId !== runId || !Array.isArray(data.entries)) {
      data = { runId: runId, entries: [], sent: 0 };
      writeRoute(data);
      return data;
    }
    if (typeof data.sent !== 'number' || data.sent < 0) { data.sent = 0; }
    if (data.sent > data.entries.length) { data.sent = data.entries.length; }
    return data;
  }

  /* 记一个动作；i 是本局路线里的序号（从 0 起），超过上限就不再追加。
   * 版本和上一条动作时不同（开局、或中途刷新到了新版本）就先插一条 { t: 'v', v: 版本 } */
  function route(entry) {
    try {
      if (!entry || typeof entry !== 'object') { return; }
      if (isDebug()) { return; }
      var data = readRoute();
      if (data.entries.length >= ROUTE_MAX) { return; }
      var tag = buildTag(currentBuild());
      if (data.build !== tag) {
        data.entries.push({ t: 'v', v: tag, i: data.entries.length });
        data.build = tag;
        if (data.entries.length >= ROUTE_MAX) { writeRoute(data); return; }
      }
      entry.i = data.entries.length;
      data.entries.push(entry);
      writeRoute(data);
    } catch (err) { /* 路线日志不能影响游戏 */ }
  }

  /* 取上一幕上传之后到现在的这一段，并把 sent 推到末尾；
   * builds 是这一段里用过的版本（段首生效的那个 + 段内的 'v' 条目，去重，按出现顺序） */
  function takeRoute() {
    var data = readRoute();
    var from = Math.max(0, Math.min(data.sent, data.entries.length));
    var segment = data.entries.slice(from);
    var builds = [];
    var start = null;
    for (var i = from - 1; i >= 0; i--) {
      if (data.entries[i] && data.entries[i].t === 'v') { start = data.entries[i].v; break; }
    }
    if (start) { builds.push(start); }
    for (var j = 0; j < segment.length; j++) {
      var e = segment[j];
      if (e && e.t === 'v' && typeof e.v === 'string' && builds.indexOf(e.v) < 0) { builds.push(e.v); }
    }
    data.sent = data.entries.length;
    writeRoute(data);
    return { entries: segment, builds: builds };
  }

  function readQueue() {
    var raw = lsGet(QUEUE_KEY);
    if (!raw) { return []; }
    try {
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (err) { return []; }
  }

  function writeQueue(list) {
    lsSet(QUEUE_KEY, JSON.stringify(list));
  }

  function removeFromQueue(id) {
    var list = readQueue();
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || list[i].id !== id) { out.push(list[i]); }
    }
    writeQueue(out);
  }

  function buildRecord(info) {
    var runId = getRunId();
    var keys = info.keys || {};
    var closedDoors = [];
    try {
      var doors = window.Game.getClosedDoors(info.act);
      if (Array.isArray(doors)) { closedDoors = doors; }
    } catch (err) { closedDoors = []; }
    return {
      v: 1,
      id: runId + '-' + info.act,
      runId: runId,
      act: info.act,
      actTitle: info.actTitle || '',
      rank: info.rank || null,
      final: !!info.final,
      floor: info.floor,
      hp: info.hp,
      atk: info.atk,
      def: info.def,
      gold: info.gold,
      keys: { yellow: keys.yellow || 0, blue: keys.blue || 0, red: keys.red || 0 },
      steps: info.steps,
      closedDoors: closedDoors,
      build: currentBuild(),
      at: new Date().toISOString()
    };
  }

  function canUpload() {
    return typeof window.location !== 'undefined' && window.location.protocol !== 'file:';
  }

  function notify(id, ok) {
    var list = waiters[id];
    delete waiters[id];
    if (!list) { return; }
    for (var i = 0; i < list.length; i++) {
      try { list[i](ok); } catch (err) { /* UI 回调出错不能影响上传 */ }
    }
  }

  function failAllWaiters() {
    var ids = [];
    for (var id in waiters) {
      if (hasOwn(waiters, id)) { ids.push(id); }
    }
    for (var i = 0; i < ids.length; i++) { notify(ids[i], false); }
  }

  function post(record, done) {
    var settled = false;
    function finish(ok) {
      if (settled) { return; }
      settled = true;
      done(ok);
    }
    var xhr;
    try {
      xhr = new XMLHttpRequest();
      xhr.open('POST', 'api/clears', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 10000;
    } catch (err) {
      finish(false);
      return;
    }
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) { return; }
      var ok = false;
      try {
        var res = JSON.parse(xhr.responseText);
        ok = !!(res && res.ok === true);
      } catch (err) { ok = false; }
      finish(ok);
    };
    try {
      xhr.send(JSON.stringify(record));
    } catch (err) {
      finish(false);
    }
  }

  /* 按顺序补传队头；成功就删掉并继续，失败则整队留在本机 */
  function flush() {
    if (flushing) { return; }
    var list = readQueue();
    if (!list.length || !canUpload()) {
      failAllWaiters();
      return;
    }
    flushing = true;
    var record = list[0];
    post(record, function (ok) {
      flushing = false;
      if (ok) { removeFromQueue(record.id); }
      notify(record.id, ok);
      if (ok) { flush(); } else { failAllWaiters(); }
    });
  }

  function recordClear(info, callback) {
    try {
      if (!info) { return; }
      /* 调试模式不上传，回调也不调用（界面不提示“成绩已上传”） */
      if (isDebug()) { return; }
      var record = buildRecord(info);
      try {
        var taken = takeRoute();
        record.route = taken.entries;
        /* 这一幕用过的版本；没有路线记录时就当只用了当前版本 */
        record.builds = taken.builds.length ? taken.builds : [buildTag(record.build)];
      } catch (err) { /* 路线缺席不影响成绩 */ }
      var list = readQueue();
      var exists = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === record.id) { exists = true; break; }
      }
      if (!exists) {
        list.push(record);
        writeQueue(list);
      }
      if (typeof callback === 'function') {
        if (!waiters[record.id]) { waiters[record.id] = []; }
        waiters[record.id].push(callback);
      }
      flush();
    } catch (err) {
      if (typeof callback === 'function') {
        try { callback(false); } catch (err2) { /* 忽略 */ }
      }
    }
  }

  /* ---------- 札记落盘（DESIGN §8.9）：每条札记进本机队列，约 1 秒后批量 POST ---------- */

  /* 调试模式写自己的队列键；调试札记也上传（只是本机日志），runId 用 null */
  function msgQueueKey() {
    return MSG_QUEUE_KEY + (isDebug() ? '.debug' : '');
  }

  function readMsgQueue() {
    var raw = lsGet(msgQueueKey());
    if (!raw) { return []; }
    try {
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (err) { return []; }
  }

  function writeMsgQueue(list) {
    lsSet(msgQueueKey(), JSON.stringify(list));
  }

  /* 当前楼层（从 1 起）；还没开局时记 1，保证服务器那边的 f 是正整数 */
  function currentFloor() {
    try {
      var state = window.Game && window.Game.state;
      var f = (state && typeof state.floor === 'number') ? state.floor + 1 : 0;
      return f >= 1 ? f : 1;
    } catch (err) { return 1; }
  }

  function scheduleMsgFlush() {
    if (msgTimer || msgFlushing) { return; }
    try {
      msgTimer = setTimeout(function () {
        msgTimer = null;
        flushMessages();
      }, 1000);
    } catch (err) { msgTimer = null; }
  }

  /* 记一条札记；队满 3000 条时丢最旧的。text 太长就截断，免得一整批超过 1 MB 卡住队列 */
  function message(text, kind) {
    try {
      if (text === null || typeof text === 'undefined') { return; }
      var body = String(text);
      if (body.length > MSG_TEXT_MAX) { body = body.slice(0, MSG_TEXT_MAX); }
      var list = readMsgQueue();
      list.push({
        at: new Date().toISOString(),
        f: currentFloor(),
        kind: (typeof kind === 'string' && kind) ? kind : 'info',
        text: body,
        v: buildTag(currentBuild()),
        r: isDebug() ? null : (lsGet(RUN_KEY) || null)   /* 记下这条属于哪一局：补传时不会挂到之后新开的局下 */
      });
      if (list.length > MSG_MAX) { list = list.slice(list.length - MSG_MAX); }
      writeMsgQueue(list);
      scheduleMsgFlush();
    } catch (err) { /* 札记落盘不能影响游戏 */ }
  }

  /* 从队头取一批（同一局的连续几条；条数和字节数都留余量），整批上传成功才删 */
  function takeMsgBatch() {
    var list = readMsgQueue();
    var out = [];
    var bytes = 0;
    for (var i = 0; i < list.length && out.length < MSG_BATCH; i++) {
      if (out.length && (list[i] && list[i].r) !== (out[0] && out[0].r)) { break; }
      var size = 0;
      try { size = JSON.stringify(list[i]).length + 1; } catch (err) { size = 0; }
      if (out.length && bytes + size > MSG_BATCH_BYTES) { break; }
      out.push(list[i]);
      bytes += size;
    }
    return out;
  }

  /* done(结果)：'ok' 成功；'bad' 服务器说格式不对（这批永远传不上，丢掉免得卡住队列）；其它 = 先留着 */
  function postMessages(lines, done) {
    var settled = false;
    var debug = isDebug();
    var runId = debug ? null : ((lines[0] && lines[0].r) || null);
    function finish(ok) {
      if (settled) { return; }
      settled = true;
      done(ok);
    }
    var xhr;
    try {
      xhr = new XMLHttpRequest();
      xhr.open('POST', 'api/messages', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 10000;
    } catch (err) {
      finish('fail');
      return;
    }
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) { return; }
      var ok = false;
      try {
        var res = JSON.parse(xhr.responseText);
        ok = !!(res && res.ok === true);
      } catch (err) { ok = false; }
      finish(ok ? 'ok' : (xhr.status === 400 ? 'bad' : 'fail'));
    };
    try {
      xhr.send(JSON.stringify({ runId: runId, debug: debug, lines: lines }));
    } catch (err) {
      finish('fail');
    }
  }

  /* 按顺序上传队头的一批；成功就删掉并继续，失败则整队留在本机 */
  function flushMessages() {
    if (msgFlushing) { return; }
    if (!canUpload()) { return; }
    var batch = takeMsgBatch();
    if (!batch.length) { return; }
    msgFlushing = true;
    postMessages(batch, function (result) {
      msgFlushing = false;
      if (result !== 'ok' && result !== 'bad') { return; }
      var list = readMsgQueue();
      list.splice(0, batch.length);
      writeMsgQueue(list);
      if (list.length) { flushMessages(); }
    });
  }

  window.RunLog = {
    newRun: newRun,
    route: route,
    recordClear: recordClear,
    message: message
  };

  /* 页面每次加载都把队列里剩下的按顺序补传（file:// 下不发请求） */
  try { flush(); } catch (err) { /* 忽略 */ }
  try { flushMessages(); } catch (err) { /* 忽略 */ }
})();