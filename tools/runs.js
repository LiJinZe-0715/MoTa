'use strict';
/* 成绩日志审计（DESIGN.md §8.7）：按局列出 logs/clears.jsonl 里的成绩，标出每一幕是在哪个版本上打的。
 * 用法：node tools/runs.js [--current]     --current 只列当前版本（js/data.js 里的版本）打的
 * 一幕里用过不止一个版本（中途刷新到了新版）会标「混版本」，这样的成绩不能拿来校难度。 */

var fs = require('fs');
var path = require('path');
var info = require('./build-info');

var root = path.join(__dirname, '..');
var file = path.join(root, 'logs', 'clears.jsonl');
var ONLY_CURRENT = process.argv.indexOf('--current') >= 0;

var current = info.buildTag(info.computeBuild(root));
var recs = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(function (l) {
  try { return JSON.parse(l); } catch (err) { return null; }
}).filter(Boolean) : [];

var runs = {}, order = [];
recs.forEach(function (r) {
  if (!runs[r.runId]) { runs[r.runId] = []; order.push(r.runId); }
  runs[r.runId].push(r);
});

console.log('当前版本：' + current);
var shown = 0;
order.forEach(function (id) {
  var list = runs[id].sort(function (a, b) { return a.act - b.act; });
  var tags = list.map(function (r) { return info.buildTag(r.build); });
  if (ONLY_CURRENT && tags.indexOf(current) < 0) return;
  shown++;
  console.log('\n局 ' + id + '（' + (list[0].at || '').slice(0, 16).replace('T', ' ') + ' UTC 起）');
  list.forEach(function (r, i) {
    var mixed = Array.isArray(r.builds) && r.builds.length > 1;
    var routeFile = path.join(root, 'logs', 'routes', r.id + '.json');
    console.log('  第 ' + r.act + ' 幕 ' + (r.rank || '-') + '  血 ' + r.hp + '  攻 ' + r.atk + ' / 防 ' + r.def +
      '  金 ' + r.gold + '  黄钥 ' + (r.keys ? r.keys.yellow : '?') + '  步 ' + r.steps +
      '  版本 ' + tags[i] + (tags[i] === current ? '（当前）' : '') +
      (mixed ? '  ⚠ 混版本：' + r.builds.join(' → ') : '') +
      (fs.existsSync(routeFile) ? '  路线 ' + (r.routeEntries || 0) + ' 条' : ''));
  });
});
if (!shown) console.log('\n（没有' + (ONLY_CURRENT ? '当前版本的' : '') + '成绩）');
