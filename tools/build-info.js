'use strict';
/* 版本信息（DESIGN.md §6、§8.7）：build-data.js 写进 js/data.js，audit.js 用它检查 data.js 是否过期。
 *   version：tower-data.json 里手写的版本号（改数值、改地图时改它）
 *   data   ：tower-data.json 内容的指纹（忘了改版本号也能区分）
 *   engine ：js/engine.js 的指纹（规则变了也能区分）
 * 指纹取 sha1 前 8 位；先统一换行符，所以 CRLF / LF 不影响结果。 */

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

function hash8(text) {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 8);
}

function computeBuild(root) {
  var data = JSON.parse(fs.readFileSync(path.join(root, 'design', 'tower-data.json'), 'utf8'));
  var engine = fs.readFileSync(path.join(root, 'js', 'engine.js'), 'utf8').replace(/\r\n/g, '\n');
  return {
    version: data.version || '',
    data: hash8(JSON.stringify(data)),
    engine: hash8(engine)
  };
}

/* 一个版本的短写法：v1+3fa2c1d0.9be01a77 */
function buildTag(b) {
  return b ? (b.version || '?') + '+' + b.data + '.' + b.engine : '无版本';
}

module.exports = { computeBuild: computeBuild, buildTag: buildTag };
