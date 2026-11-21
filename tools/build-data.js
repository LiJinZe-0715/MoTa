'use strict';

var fs = require('fs');
var path = require('path');
var info = require('./build-info');

var root = path.join(__dirname, '..');
var srcPath = path.join(root, 'design', 'tower-data.json');
var outPath = path.join(root, 'js', 'data.js');

var data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
data.build = info.computeBuild(root);
var out = 'window.TOWER_DATA = ' + JSON.stringify(data, null, 1) + ';\n';
fs.writeFileSync(outPath, out, 'utf8');

var size = fs.statSync(outPath).size;
console.log('版本: ' + info.buildTag(data.build));
console.log('层数: ' + data.floors.length);
console.log('怪物种数: ' + Object.keys(data.monsters).length);
console.log('已写出 ' + outPath + '，文件大小 ' + size + ' 字节');
