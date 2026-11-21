'use strict';
/* 从 tower-data.json 重新生成 DATA.md 的 §4–§6（楼层表、怪物表、地图）。
 * 用法：node tools/gen-data-md.js */

var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var data = JSON.parse(fs.readFileSync(path.join(root, 'design', 'tower-data.json'), 'utf8'));
var mdPath = path.join(root, 'design', 'DATA.md');
var md = fs.readFileSync(mdPath, 'utf8');

var ACT_META = [
  { no: 4, from: 1, to: 10, title: '第一幕 · 塔基', intro: '长夜压着塔基。十层之上，守闸铁卫把着通往塔身的闸门。' },
  { no: 5, from: 11, to: 20, title: '第二幕 · 禁书库', intro: '闸门之后是禁书库。书架间游荡着墨与咒，禁书馆长守着第二十层。' },
  { no: 6, from: 21, to: 30, title: '第三幕 · 钟楼', intro: '禁书库之上是钟楼。齿轮和摆锤日夜不停，钟楼巨械守着第三十层。' }
];

function countRow(row, chars) {
  var c = {};
  for (var i = 0; i < row.length; i++) { var ch = row.charAt(i); if (chars.indexOf(ch) >= 0) c[ch] = (c[ch] || 0) + 1; }
  return c;
}
function monText(floor) {
  var c = {};
  floor.map.forEach(function (row) {
    for (var i = 0; i < row.length; i++) { var ch = row.charAt(i); if (data.monsters[ch]) c[ch] = (c[ch] || 0) + 1; }
  });
  var parts = Object.keys(c).map(function (id) {
    var name = data.monsters[id].name + (data.monsters[id].boss ? '（首领）' : '');
    return name + '×' + c[id];
  });
  return parts.length ? parts.join('、') : '—';
}

var out = [];
ACT_META.forEach(function (meta) {
  var floors = [];
  for (var f = meta.from - 1; f < meta.to; f++) floors.push({ i: f, fl: data.floors[f] });

  /* 楼层表 */
  out.push('## ' + meta.no + '. ' + meta.title + '（第 ' + meta.from + '–' + meta.to + ' 层）');
  out.push('');
  out.push('- 黄钥匙 / 黄门 15 / 20，蓝钥匙 / 蓝门 2 / 2，红钥匙 / 红门 1 / 1；红宝石 10、蓝宝石 10；小灯油 20、大灯油 5；剑、盾各 1。');
  out.push('- 幕介绍：' + meta.intro);
  out.push('');

  /* 怪物表 */
  out.push('### ' + meta.no + '.1 怪物');
  out.push('');
  out.push('| 怪物 | 编号 | 标签 | 生命 | 攻击 | 防御 | 金币 | 只数 | 出现 |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  var monIds = [], monCount = {}, monFloors = {};
  floors.forEach(function (o) {
    o.fl.map.forEach(function (row) {
      for (var i = 0; i < row.length; i++) {
        var ch = row.charAt(i);
        if (!data.monsters[ch]) continue;
        if (monIds.indexOf(ch) < 0) { monIds.push(ch); monFloors[ch] = []; }
        monCount[ch] = (monCount[ch] || 0) + 1;
        if (monFloors[ch].indexOf(o.i + 1) < 0) monFloors[ch].push(o.i + 1);
      }
    });
  });
  monIds.sort(function (a, b) { return monFloors[a][0] - monFloors[b][0]; });
  monIds.forEach(function (id) {
    var m = data.monsters[id];
    var fs = monFloors[id];
    var range = fs.length === 1 ? 'F' + fs[0] : (fs[fs.length - 1] - fs[0] === fs.length - 1 ? 'F' + fs[0] + '–F' + fs[fs.length - 1] : fs.map(function (n) { return 'F' + n; }).join('、'));
    out.push('| ' + m.name + ' | `' + id + '` | ' + (m.boss ? '首领' : m.kind) + ' | ' + m.hp + ' | ' + m.atk + ' | ' + m.def + ' | ' + m.gold + ' | ' + monCount[id] + ' | ' + range + ' |');
  });
  out.push('');

  /* 楼层表 */
  out.push('### ' + meta.no + '.2 楼层');
  out.push('');
  out.push('| 层 | 名字 | 怪 | 黄钥 / 黄门 | 蓝钥 / 蓝门 | 红钥 / 红门 | 红宝 / 蓝宝 | 小 / 大灯油 | 剑盾 |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  floors.forEach(function (o) {
    var c = { y: 0, Y: 0, b: 0, B: 0, r: 0, R: 0, g: 0, d: 0, h: 0, H: 0, S: 0, Z: 0 };
    o.fl.map.forEach(function (row) { for (var i = 0; i < row.length; i++) { var ch = row.charAt(i); if (ch in c) c[ch]++; } });
    var sw = c.S || c.Z ? [c.S ? '剑' : '', c.Z ? '盾' : ''].filter(Boolean).join('') : '—';
    out.push('| ' + (o.i + 1) + ' | ' + o.fl.name.replace(/^第 \d+ 层 · /, '') + ' | ' + monText(o.fl) + ' | ' + c.y + ' / ' + c.Y + ' | ' + c.b + ' / ' + c.B + ' | ' + c.r + ' / ' + c.R + ' | ' + c.g + ' / ' + c.d + ' | ' + c.h + ' / ' + c.H + ' | ' + sw + ' |');
  });
  out.push('');

  /* 地图 */
  out.push('### ' + meta.no + '.3 地图');
  out.push('');
  out.push('```');
  floors.forEach(function (o) {
    out.push(o.fl.name);
    o.fl.map.forEach(function (row) { out.push(row); });
    out.push('');
  });
  out.pop();
  out.push('```');
  out.push('');
  out.push('---');
  out.push('');
});

var newSection = out.join('\n');
var start = md.indexOf('## 4. 第一幕');
var tail = md.indexOf('地图字符：');
if (start < 0 || tail < 0) throw new Error('DATA.md 结构不符，找不到 §4 或地图字符说明');
var result = md.slice(0, start) + newSection + md.slice(tail);
fs.writeFileSync(mdPath, result, 'utf8');
console.log('已重写 DATA.md §4–§6');
