(function () {
  'use strict';

  var INK = '#14161c';
  var TAU = Math.PI * 2;
  var AMBER = '#f0a93b';

  var CLOAK = '#2f4a6b';
  var CLOAK_DARK = '#22384f';
  var CLOAK_LIGHT = '#41648c';
  var SKIN = '#e8c39e';
  var SKIN_DARK = '#c99f77';
  var BOOT = '#6b4a2f';
  var BOOT_DARK = '#4a3220';
  var IRON = '#4a4f5a';
  var IRON_DARK = '#33373f';
  var IRON_LIGHT = '#6d7482';

  function wave(t, period, phase) {
    return Math.sin(t / period + (phase || 0));
  }

  function rgba(hex, a) {
    return 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' +
      parseInt(hex.slice(5, 7), 16) + ',' + a + ')';
  }

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function ell(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  }

  function rrect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function poly(ctx, p) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
  }

  function paint(ctx, fill, lw) {
    ctx.fillStyle = fill;
    ctx.fill();
    if (lw !== 0) {
      ctx.lineWidth = lw == null ? 2 : lw;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }

  function tint(ctx, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw == null ? 1.4 : lw;
    ctx.stroke();
  }

  function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  }

  function bloom(ctx, x, y, r, hex, a) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(hex, a));
    g.addColorStop(0.4, rgba(hex, a * 0.42));
    g.addColorStop(1, rgba(hex, 0));
    ctx.fillStyle = g;
    circle(ctx, x, y, r);
    ctx.fill();
  }

  function glowDot(ctx, x, y, r, hex, spread) {
    bloom(ctx, x, y, r * (spread || 3.2), hex, 0.8);
    circle(ctx, x, y, r);
    ctx.fillStyle = hex;
    ctx.fill();
  }

  function eye(ctx, x, y, r, hi) {
    circle(ctx, x, y, r);
    ctx.fillStyle = '#1b1e26';
    ctx.fill();
    circle(ctx, x - r * 0.33, y - r * 0.36, r * 0.34);
    ctx.fillStyle = hi || 'rgba(255,255,255,0.92)';
    ctx.fill();
  }

  function shadow(ctx, y, rx, ry, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 0.35 : a;
    ctx.fillStyle = '#000000';
    ell(ctx, 0, y, rx, ry);
    ctx.fill();
    ctx.restore();
  }

  function tuft(ctx, x, y, h, lean, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    ctx.beginPath();
    ctx.moveTo(-2.6, 1.4);
    ctx.quadraticCurveTo(-2.2, -h * 0.6, -0.6, -h);
    ctx.quadraticCurveTo(0.4, -h * 0.5, 1.4, -h * 0.82);
    ctx.quadraticCurveTo(2.2, -h * 0.3, 2.6, 1.4);
    ctx.closePath();
    paint(ctx, color || '#2f5d2a', 1.5);
    ctx.restore();
  }

  function rustSpot(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x - r * 0.4, y - r * 0.9, x + r * 0.3, y - r * 0.5);
    ctx.quadraticCurveTo(x + r * 1.1, y - r * 0.1, x + r * 0.5, y + r * 0.6);
    ctx.quadraticCurveTo(x - r * 0.2, y + r * 1.1, x - r, y);
    ctx.closePath();
    ctx.fillStyle = color || 'rgba(107,61,32,0.72)';
    ctx.fill();
  }

  function rivet(ctx, x, y, color) {
    circle(ctx, x, y, 1);
    paint(ctx, color || '#d9a06a', 0.8);
  }

  function stoneBlock(ctx, x, y, w, h, r, base, dark, light) {
    rrect(ctx, x, y, w, h, r);
    paint(ctx, base, 2);
    ctx.save();
    rrect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = dark;
    poly(ctx, [x + w * 0.56, y - 1, x + w + 1, y - 1, x + w + 1, y + h + 1, x + w * 0.46, y + h + 1]);
    ctx.fill();
    ctx.fillStyle = light;
    poly(ctx, [x - 1, y - 1, x + w + 1, y - 1, x + w + 1, y + h * 0.2, x - 1, y + h * 0.34]);
    ctx.fill();
    ctx.restore();
  }

  function stoneEye(ctx, x, y, p, hex) {
    var c = hex || '#5fe3d0';
    bloom(ctx, x, y, 5.5, c, 0.42 * p);
    rrect(ctx, x - 1.5, y - 1.5, 3, 3, 0.5);
    ctx.fillStyle = rgba(c, 0.55 + 0.45 * p);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  /* ---------------- hero ---------------- */

  function heroLantern(ctx, t, swing, glow) {
    var flick = 0.5 + 0.5 * wave(t, 520);
    var flick2 = wave(t, 610, 1.3);
    ctx.save();
    ctx.rotate(swing);
    bloom(ctx, 0, 6, 15, AMBER, (0.3 + 0.14 * flick) * glow);
    ctx.beginPath();
    ctx.arc(0, 1.3, 2.3, Math.PI, 0);
    tint(ctx, IRON_LIGHT, 1.3);
    poly(ctx, [-3.4, 1.4, 3.4, 1.4, 2.6, 3.2, -2.6, 3.2]);
    paint(ctx, IRON, 1.4);
    poly(ctx, [-2.7, 3.2, 2.7, 3.2, 2.1, 9.6, -2.1, 9.6]);
    paint(ctx, IRON_DARK, 1.4);
    var fh = 4.4 + 0.8 * flick + 0.4 * flick2;
    ctx.beginPath();
    ctx.moveTo(-1.5, 9.1);
    ctx.quadraticCurveTo(-1.7, 9.1 - fh * 0.55, 0, 9.1 - fh);
    ctx.quadraticCurveTo(1.7, 9.1 - fh * 0.55, 1.5, 9.1);
    ctx.closePath();
    ctx.fillStyle = '#ffbe52';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-0.7, 9);
    ctx.quadraticCurveTo(-0.8, 9 - fh * 0.4, 0, 9 - fh * 0.66);
    ctx.quadraticCurveTo(0.8, 9 - fh * 0.4, 0.7, 9);
    ctx.closePath();
    ctx.fillStyle = '#fff0c2';
    ctx.fill();
    bloom(ctx, 0, 7, 5.5, '#ffd27a', 0.45 + 0.2 * flick);
    ctx.beginPath();
    ctx.moveTo(-2.5, 3.4);
    ctx.lineTo(-2, 9.4);
    ctx.moveTo(2.5, 3.4);
    ctx.lineTo(2, 9.4);
    tint(ctx, IRON_LIGHT, 0.9);
    rrect(ctx, -3, 9.4, 6, 1.9, 0.7);
    paint(ctx, IRON, 1.4);
    ctx.restore();
  }

  function heroBoots(ctx) {
    rrect(ctx, -6.6, 15.4, 5.6, 4.4, 1.6);
    paint(ctx, BOOT, 1.8);
    rrect(ctx, 1, 15.4, 5.6, 4.4, 1.6);
    paint(ctx, BOOT, 1.8);
    rrect(ctx, -7, 18.4, 6.4, 2, 0.9);
    paint(ctx, BOOT_DARK, 1.2);
    rrect(ctx, 0.6, 18.4, 6.4, 2, 0.9);
    paint(ctx, BOOT_DARK, 1.2);
  }

  function cloakPath(ctx, hs, hy, hem) {
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.bezierCurveTo(-11, 1, -12 - hs, 9, -10 - hs, 16 + hem);
    ctx.quadraticCurveTo(-5, 18.6 + hem, 0, 17.4 + hy + hem);
    ctx.quadraticCurveTo(5, 18.6 + hem, 10 + hs, 16 + hem);
    ctx.bezierCurveTo(12 + hs, 9, 11, 1, 8, -6);
    ctx.closePath();
  }

  function heroCloak(ctx, hs, hy, back, hem) {
    cloakPath(ctx, hs, hy, hem);
    paint(ctx, CLOAK);
    ctx.save();
    cloakPath(ctx, hs, hy, hem);
    ctx.clip();
    ctx.fillStyle = CLOAK_DARK;
    poly(ctx, [3, -8, 15, -8, 15, 21, 5, 21]);
    ctx.fill();
    ctx.fillStyle = CLOAK_LIGHT;
    ell(ctx, -5.5, 1, 3.6, 7, -0.25);
    ctx.fill();
    if (back) {
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 19 + hem);
      tint(ctx, CLOAK_DARK, 1.6);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-10 - hs, 15.3 + hem);
    ctx.quadraticCurveTo(-5, 17.9 + hem, 0, 16.7 + hy + hem);
    ctx.quadraticCurveTo(5, 17.9 + hem, 10 + hs, 15.3 + hem);
    tint(ctx, AMBER, 1.7);
    if (!back) {
      ctx.beginPath();
      ctx.moveTo(-0.6, -4);
      ctx.quadraticCurveTo(-1.5, 6, -0.9, 16.2 + hem);
      tint(ctx, AMBER, 1.2);
    }
  }

  function hoodFrontPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-10, -3);
    ctx.bezierCurveTo(-11.5, -13, -6.5, -20.5, 0, -20.5);
    ctx.bezierCurveTo(6.5, -20.5, 11.5, -13, 10, -3);
    ctx.quadraticCurveTo(0, 1.5, -10, -3);
    ctx.closePath();
  }

  function hoodSidePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(6, -3);
    ctx.bezierCurveTo(8, -13, 3, -20.5, -3, -20);
    ctx.bezierCurveTo(-9, -19.5, -12, -13, -10.5, -6);
    ctx.quadraticCurveTo(-4, -1, 6, -3);
    ctx.closePath();
  }

  function heroFront(ctx, t) {
    var b = wave(t, 950) * 1.1;
    var hs = wave(t, 780) * 1.5;
    var hy = wave(t, 780, 1.1) * 0.7;
    shadow(ctx, 20, 11, 3.2);
    heroBoots(ctx);
    ctx.save();
    ctx.translate(0, b);
    heroCloak(ctx, hs, hy, false, 0);
    limb(ctx, -6, -1, -11.5, 3, 4, CLOAK);
    limb(ctx, 6, -1, 8.5, 4, 4, CLOAK);
    circle(ctx, 8.9, 4.6, 1.9);
    paint(ctx, SKIN, 1.4);
    circle(ctx, -12, 3.4, 1.9);
    paint(ctx, SKIN, 1.4);
    ctx.save();
    ctx.translate(-12.6, 4);
    heroLantern(ctx, t, wave(t, 680) * 0.13, 1);
    ctx.restore();
    hoodFrontPath(ctx);
    paint(ctx, CLOAK);
    ctx.save();
    hoodFrontPath(ctx);
    ctx.clip();
    ctx.fillStyle = CLOAK_DARK;
    poly(ctx, [2, -22, 14, -22, 14, 3, 4, 3]);
    ctx.fill();
    ctx.fillStyle = CLOAK_LIGHT;
    ell(ctx, -5, -14, 3.4, 4.6, -0.4);
    ctx.fill();
    ctx.restore();
    ell(ctx, 0, -8, 7, 7.3);
    paint(ctx, SKIN, 1.6);
    ctx.save();
    ell(ctx, 0, -8, 7, 7.3);
    ctx.clip();
    ctx.fillStyle = SKIN_DARK;
    ell(ctx, 0, -15.5, 8.5, 5);
    ctx.fill();
    ctx.restore();
    eye(ctx, -3, -7.4, 2.1);
    eye(ctx, 3, -7.4, 2.1);
    ell(ctx, 0, -8, 7.6, 7.9);
    tint(ctx, AMBER, 1.2);
    ctx.restore();
  }

  function heroBack(ctx, t) {
    var b = wave(t, 950, 0.4) * 1.1;
    var hs = wave(t, 800, 0.7) * 1.5;
    var hy = wave(t, 800, 1.8) * 0.7;
    var flick = 0.5 + 0.5 * wave(t, 520, 0.5);
    shadow(ctx, 20, 11, 3.2);
    bloom(ctx, -13.5, 8, 15, AMBER, 0.26 + 0.12 * flick);
    bloom(ctx, 12.5, 8, 12, AMBER, 0.13 + 0.07 * flick);
    rrect(ctx, -6.2, 11, 4.8, 6.4, 1.4);
    paint(ctx, CLOAK_DARK, 1.6);
    rrect(ctx, 1.4, 11, 4.8, 6.4, 1.4);
    paint(ctx, CLOAK_DARK, 1.6);
    ctx.save();
    ctx.translate(0, b);
    heroCloak(ctx, hs, hy, true, -3.4);
    limb(ctx, -6, -2, -12.2, 1.8, 4, CLOAK);
    limb(ctx, -12.2, 1.8, -11, 6, 3.6, CLOAK_DARK);
    circle(ctx, -11.2, 6.6, 1.9);
    paint(ctx, SKIN, 1.4);
    ctx.save();
    ctx.translate(-14, 6.4);
    ctx.rotate(wave(t, 680, 0.9) * 0.1);
    bloom(ctx, 0, 3, 12, AMBER, 0.34 + 0.14 * flick);
    ctx.beginPath();
    ctx.arc(0, 0.8, 1.7, Math.PI, 0);
    tint(ctx, IRON_LIGHT, 1.2);
    poly(ctx, [-1.7, 0.8, 1.7, 0.8, 1.4, 6.6, -1.4, 6.6]);
    paint(ctx, IRON_DARK, 1.2);
    poly(ctx, [-0.9, 1.8, 0.9, 1.8, 0.7, 5.8, -0.7, 5.8]);
    ctx.fillStyle = '#ffbe52';
    ctx.fill();
    rrect(ctx, -1.9, 6.4, 3.8, 1.5, 0.6);
    paint(ctx, IRON, 1);
    ctx.restore();
    hoodFrontPath(ctx);
    paint(ctx, CLOAK);
    ctx.save();
    hoodFrontPath(ctx);
    ctx.clip();
    ctx.fillStyle = CLOAK_DARK;
    poly(ctx, [1, -22, 14, -22, 14, 3, 3, 3]);
    ctx.fill();
    ctx.fillStyle = CLOAK_LIGHT;
    ell(ctx, -5, -14, 3.4, 4.6, -0.4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.quadraticCurveTo(1.2, -10, 0, -2);
    tint(ctx, CLOAK_DARK, 1.4);
    ctx.restore();
    hoodFrontPath(ctx);
    tint(ctx, AMBER, 1.4);
    ctx.restore();
    heroBoots(ctx);
  }

  function heroSide(ctx, t) {
    var b = wave(t, 930, 0.9) * 1.1;
    var hs = wave(t, 760, 0.3) * 1.6;
    shadow(ctx, 20, 9.5, 3);
    ctx.save();
    ctx.translate(0, b);
    ctx.beginPath();
    ctx.moveTo(-5, -6);
    ctx.bezierCurveTo(-8, 1, -9 - hs, 9, -7 - hs, 15);
    ctx.quadraticCurveTo(0, 17.2, 7 + hs * 0.6, 15);
    ctx.bezierCurveTo(9, 9, 8, 1, 6, -6);
    ctx.closePath();
    paint(ctx, CLOAK);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = CLOAK_DARK;
    poly(ctx, [2, -8, 12, -8, 12, 21, 3, 21]);
    ctx.fill();
    ctx.fillStyle = CLOAK_LIGHT;
    ell(ctx, -3.5, 1, 2.8, 6.5, -0.2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-7 - hs, 14.3);
    ctx.quadraticCurveTo(0, 16.6, 7 + hs * 0.6, 14.3);
    tint(ctx, AMBER, 1.6);
    limb(ctx, -2, -2, -7.4, 1.6, 4, CLOAK);
    limb(ctx, -7.4, 1.6, -12, 3.4, 3.6, CLOAK);
    circle(ctx, -12.6, 3.8, 1.9);
    paint(ctx, SKIN, 1.4);
    ctx.save();
    ctx.translate(-13.4, 4.2);
    heroLantern(ctx, t, wave(t, 660, 0.5) * 0.15, 1);
    ctx.restore();
    hoodSidePath(ctx);
    paint(ctx, CLOAK);
    ctx.save();
    hoodSidePath(ctx);
    ctx.clip();
    ctx.fillStyle = CLOAK_DARK;
    poly(ctx, [0, -22, 10, -22, 10, 2, 1, 2]);
    ctx.fill();
    ctx.fillStyle = CLOAK_LIGHT;
    ell(ctx, -4, -15, 3, 4, -0.5);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-8.6, -13.4);
    ctx.bezierCurveTo(-12.6, -13, -14.8, -10.4, -14.2, -7.6);
    ctx.quadraticCurveTo(-15.4, -6.4, -14, -5.6);
    ctx.quadraticCurveTo(-13.2, -3.2, -10.4, -2.8);
    ctx.quadraticCurveTo(-6.4, -2.4, -4.6, -4.6);
    ctx.quadraticCurveTo(-5.6, -9.6, -8.6, -13.4);
    ctx.closePath();
    paint(ctx, SKIN, 1.5);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = SKIN_DARK;
    ell(ctx, -6, -12.4, 6.4, 4.6, -0.3);
    ctx.fill();
    ctx.restore();
    eye(ctx, -10.8, -8.4, 2.2);
    ctx.beginPath();
    ctx.moveTo(-13.6, -5.2);
    ctx.quadraticCurveTo(-12.2, -4.5, -11, -5);
    tint(ctx, SKIN_DARK, 1);
    ctx.beginPath();
    ctx.moveTo(-8.8, -13.6);
    ctx.quadraticCurveTo(-5.4, -9.6, -4.8, -4.4);
    tint(ctx, AMBER, 1.4);
    ctx.restore();
    rrect(ctx, 0.2, 15.6, 7.6, 4.4, 1.6);
    paint(ctx, BOOT_DARK, 1.8);
    rrect(ctx, -0.2, 18.6, 8.2, 1.9, 0.9);
    paint(ctx, '#3a2718', 1.1);
    rrect(ctx, -8.8, 15.2, 8.8, 4.8, 1.7);
    paint(ctx, BOOT, 1.8);
    rrect(ctx, -9.2, 18.4, 9.6, 2.1, 0.9);
    paint(ctx, BOOT_DARK, 1.2);
  }

  function drawHero(ctx, t, opts) {
    var dir = (opts && opts.dir) || 'down';
    if (dir === 'left') {
      heroSide(ctx, t);
    } else if (dir === 'right') {
      ctx.save();
      ctx.scale(-1, 1);
      heroSide(ctx, t);
      ctx.restore();
    } else if (dir === 'up') {
      heroBack(ctx, t);
    } else {
      heroFront(ctx, t);
    }
  }

  /* ---------------- 1 moss blob / c ember moss / j brass moss / E frost moss / J shadow moss ---------------- */

  var MOSS = {
    body: '#5a9e4b', dark: '#3f7434', light: '#7cc063', tuft: '#2f5d2a',
    stem: '#3f7434', leafA: '#6fbf52', leafB: '#8ed86a',
    spot: 'rgba(47,93,42,0.5)', mouth: '#2c4a26', hi: null, flame: false
  };

  var EMBER_MOSS = {
    body: '#c8503c', dark: '#8c2f26', light: '#e2795c', tuft: '#7d2a1e',
    stem: '#a8442c', leafA: '#ff9a3c', leafB: '#ffd45e',
    spot: 'rgba(124,38,26,0.5)', mouth: '#5c1c14', hi: 'rgba(255,228,150,0.95)', flame: true
  };

  var BRASS_MOSS = {
    body: '#c9a14a', dark: '#8f6d24', light: '#e8cd86', tuft: '#6b5320',
    stem: '#8f6d24', leafA: '#c9a14a', leafB: '#e8cd86',
    spot: 'rgba(107,83,32,0.5)', mouth: '#5f4718', hi: 'rgba(255,248,220,0.95)',
    flame: false, metal: true, sprout: brassSprout
  };

  var FROST_MOSS = {
    body: '#9fd3f0', dark: '#6ba8cf', light: '#e8f7ff', tuft: '#5f93bb',
    stem: '#6ba8cf', leafA: '#cfeaff', leafB: '#eaf8ff',
    spot: 'rgba(95,147,187,0.45)', mouth: '#3f6a8c', hi: 'rgba(255,255,255,0.98)',
    flame: false, glassy: true, rim: 'rgba(255,255,255,0.55)', snow: true, sprout: icicleSprout
  };

  var SHADOW_MOSS = {
    body: '#2a2230', dark: '#171122', light: '#443a52', tuft: '#191325',
    stem: '#3a2f4a', leafA: '#3a2f4a', leafB: '#4a3d5c',
    spot: 'rgba(12,8,18,0.6)', mouth: '#6a5a7a', hi: null,
    flame: false, rim: 'rgba(150,110,190,0.5)', eyeGlow: '#ff3b30', sprout: smokeSprout
  };

  function brassSprout(ctx, t, sway) {
    ctx.save();
    ctx.rotate(sway * 0.9);
    ctx.beginPath();
    ctx.moveTo(0, 0.8);
    ctx.lineTo(0, -4.6);
    tint(ctx, '#8f6d24', 2);
    rrect(ctx, -1.8, -6, 3.6, 2.4, 0.8);
    paint(ctx, '#a8843c', 1.2);
    gearShape(ctx, 0, -9.6, 4.6, 8, t / 2600);
    ctx.restore();
  }

  function icicleSprout(ctx, t, sway) {
    var g = 0.5 + 0.5 * wave(t, 900, 0.4);
    ctx.save();
    ctx.rotate(sway * 1.1);
    bloom(ctx, 0, -6, 9, '#bfe6ff', 0.18 + 0.12 * g);
    poly(ctx, [-4.4, 0.8, -3.2, -4.8, -2, 0.8]);
    paint(ctx, '#dff1ff', 1.1);
    poly(ctx, [2.2, 0.8, 3.4, -3.6, 4.6, 0.8]);
    paint(ctx, '#dff1ff', 1.1);
    poly(ctx, [-2.4, 0.6, 0, -10.4, 2.4, 0.6]);
    paint(ctx, '#cfeaff', 1.4);
    poly(ctx, [0.4, 0.4, 1, -6.4, 2.2, 0.4]);
    ctx.fillStyle = 'rgba(120,175,215,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-1.1, 0);
    ctx.lineTo(-0.2, -8.6);
    tint(ctx, '#ffffff', 1);
    ctx.restore();
  }

  function smokeSprout(ctx, t, sway) {
    ctx.save();
    ctx.rotate(sway * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, 0.8);
    ctx.quadraticCurveTo(1.2, -2, 0.4, -3.6);
    tint(ctx, '#3a2f4a', 1.6);
    for (var i = 0; i !== 3; i++) {
      var ph = ((t / 1500) + i * 0.34) % 1;
      var r = 1.6 + ph * 2.6;
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.75;
      ell(ctx, 0.4 + Math.sin(ph * 4 + i * 2) * 2.2, -3.4 - ph * 10, r, r * 0.86, 0.2);
      ctx.fillStyle = '#191325';
      ctx.fill();
      tint(ctx, 'rgba(150,110,190,0.45)', 0.8);
      ctx.restore();
    }
    ctx.restore();
  }

  function snowMotes(ctx, t) {
    for (var i = 0; i !== 2; i++) {
      var ph = ((t / 2600) + i * 0.5) % 1;
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.95;
      ctx.translate((i ? 15 : -15.5) + Math.sin(t / 1100 + i * 2.3) * 2.2, -13 + ph * 27);
      ctx.rotate(t / 1900 + i * 1.2);
      bloom(ctx, 0, 0, 4.5, '#bfe6ff', 0.35);
      ctx.beginPath();
      for (var k = 0; k !== 3; k++) {
        var a = k * Math.PI / 3;
        ctx.moveTo(-Math.cos(a) * 2.4, -Math.sin(a) * 2.4);
        ctx.lineTo(Math.cos(a) * 2.4, Math.sin(a) * 2.4);
      }
      tint(ctx, '#f2fbff', 1);
      ctx.restore();
    }
  }

  function mossEyeGlow(ctx, hex, t) {
    var p = 0.6 + 0.4 * wave(t, 760, 0.5);
    for (var i = 0; i !== 2; i++) {
      var x = i ? 6 : -5.8;
      bloom(ctx, x, -2, 9, hex, 0.32 * p);
      circle(ctx, x, -2, 2.5);
      ctx.fillStyle = rgba(hex, 0.5 + 0.4 * p);
      ctx.fill();
      circle(ctx, x, -2, 1.1);
      ctx.fillStyle = rgba('#ffe2dc', 0.45 + 0.4 * p);
      ctx.fill();
      circle(ctx, x - 1, -3, 0.7);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
    }
  }

  function emberSprout(ctx, t, sway) {
    var f = 0.5 + 0.5 * wave(t, 430);
    ctx.save();
    ctx.rotate(sway * 1.3);
    bloom(ctx, 0, -4.5, 10, '#ff8a2e', 0.26 + 0.18 * f);
    for (var i = 0; i !== 3; i++) {
      var h = (i === 1 ? 8.4 : 6) + f * (i === 1 ? 1.5 : 0.9);
      ctx.save();
      ctx.translate((i - 1) * 3.1, i === 1 ? 0 : 1.2);
      ctx.rotate((i - 1) * 0.36 + wave(t, 520, i * 1.7) * 0.13);
      ctx.beginPath();
      ctx.moveTo(-1.7, 0.6);
      ctx.quadraticCurveTo(-2.2, -h * 0.5, 0, -h);
      ctx.quadraticCurveTo(2.2, -h * 0.5, 1.7, 0.6);
      ctx.closePath();
      paint(ctx, '#ff9a3c', 1.2);
      ctx.beginPath();
      ctx.moveTo(-0.8, 0.4);
      ctx.quadraticCurveTo(-1, -h * 0.4, 0, -h * 0.66);
      ctx.quadraticCurveTo(1, -h * 0.4, 0.8, 0.4);
      ctx.closePath();
      paint(ctx, '#ffe07a', 0);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMossBlob(ctx, t, pal) {
    var p = pal || MOSS;
    var s = wave(t, 620);
    var rx = 16.5 * (1 + 0.07 * s);
    var ry = 13.8 * (1 - 0.09 * s);
    var cy = 19.5 - ry;
    var sway = wave(t, 620, 0.6) * 0.16;
    shadow(ctx, 20, rx * 0.92, 3.2);
    ctx.save();
    ctx.translate(0, cy);
    tuft(ctx, -9, -ry + 2.5, 5.2, -0.32 + sway, p.tuft);
    tuft(ctx, 0.5, -ry + 0.5, 6.4, sway, p.tuft);
    tuft(ctx, 9.5, -ry + 2.8, 4.8, 0.3 + sway, p.tuft);
    ctx.save();
    ctx.translate(3.5, -ry + 1.5);
    if (p.sprout) {
      p.sprout(ctx, t, sway);
    } else if (p.flame) {
      emberSprout(ctx, t, sway);
    } else {
      ctx.rotate(sway * 1.3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(1.6, -4.4, 0.6, -7.4);
      tint(ctx, p.stem, 1.6);
      ell(ctx, -2.2, -6.6, 2.9, 1.5, -0.5);
      paint(ctx, p.leafA, 1.3);
      ell(ctx, 2.7, -7.4, 2.7, 1.45, 0.45);
      paint(ctx, p.leafB, 1.3);
    }
    ctx.restore();
    ell(ctx, 0, 0, rx, ry);
    paint(ctx, p.body);
    ctx.save();
    ell(ctx, 0, 0, rx, ry);
    ctx.clip();
    ctx.fillStyle = p.dark;
    ell(ctx, 1, ry * 0.74, rx * 1.05, ry * 0.6);
    ctx.fill();
    ctx.fillStyle = p.light;
    ell(ctx, -rx * 0.42, -ry * 0.46, rx * 0.36, ry * 0.3, -0.4);
    ctx.fill();
    ctx.fillStyle = p.spot;
    circle(ctx, -10, 4, 1.2);
    ctx.fill();
    circle(ctx, 7.6, 6.4, 1);
    ctx.fill();
    circle(ctx, 11.2, -1.2, 1.1);
    ctx.fill();
    if (p.metal) {
      ctx.fillStyle = 'rgba(255,246,214,0.5)';
      ell(ctx, -rx * 0.3, -ry * 0.52, rx * 0.44, ry * 0.11, -0.3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.26)';
      ell(ctx, rx * 0.36, ry * 0.06, rx * 0.09, ry * 0.4, 0.18);
      ctx.fill();
      ctx.fillStyle = 'rgba(90,66,20,0.3)';
      ell(ctx, rx * 0.1, ry * 0.62, rx * 0.7, ry * 0.16, 0.05);
      ctx.fill();
    }
    if (p.glassy) {
      bloom(ctx, -rx * 0.22, -ry * 0.18, rx * 0.8, '#ffffff', 0.28);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ell(ctx, rx * 0.18, ry * 0.44, rx * 0.5, ry * 0.22, 0.14);
      ctx.fill();
    }
    ctx.restore();
    if (p.rim) {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx - 0.8, ry - 0.8, 0, 0, TAU);
      tint(ctx, p.rim, 1.3);
    }
    eye(ctx, -5.8, -2, 3.8, p.hi);
    eye(ctx, 6, -2, 3.8, p.hi);
    if (p.eyeGlow) mossEyeGlow(ctx, p.eyeGlow, t);
    ctx.beginPath();
    ctx.arc(0, 5, 2.6, 0.24 * Math.PI, 0.76 * Math.PI);
    tint(ctx, p.mouth, 1.2);
    ctx.restore();
    if (p.snow) snowMotes(ctx, t);
  }

  function drawEmberMoss(ctx, t) {
    drawMossBlob(ctx, t, EMBER_MOSS);
  }

  function drawBrassMoss(ctx, t) {
    drawMossBlob(ctx, t, BRASS_MOSS);
  }

  function drawFrostMoss(ctx, t) {
    drawMossBlob(ctx, t, FROST_MOSS);
  }

  function drawShadowMoss(ctx, t) {
    drawMossBlob(ctx, t, SHADOW_MOSS);
  }

  /* ---------------- 2 ash bat / d snow bat / F ember bat / K shadow bat ---------------- */

  var BAT = {
    body: '#83859a', dark: '#6a6c7e', light: '#9b9dae', sheen: '#b2b4c2', belly: '#a8aab8',
    ear: '#b0959c', wing: '#525462', bone: '#33353f', eye: '#ff5a5a',
    mouth: '#2a2c34', fang: '#f4f2e8', frost: false
  };

  var SNOW_BAT = {
    body: '#cfe3f2', dark: '#a6c3dd', light: '#e7f3fc', sheen: '#f8fcff', belly: '#dcebf8',
    ear: '#b6d2ea', wing: '#9cc6e8', bone: '#6b95bb', eye: '#66f0ff',
    mouth: '#3d5670', fang: '#ffffff', frost: true
  };

  var EMBER_BAT = {
    body: '#e8622c', dark: '#b03d18', light: '#ff8a4a', sheen: '#ffb877', belly: '#f2894c',
    ear: '#ff9a5c', wing: '#8c2418', bone: '#5a1a10', eye: '#ffe14a',
    mouth: '#5a1c10', fang: '#fff0d0', edge: '#ff9a3c', sparks: true
  };

  var SHADOW_BAT = {
    body: '#3a2a3a', dark: '#241a26', light: '#54405a', sheen: '#6b5273', belly: '#463450',
    ear: '#5c3a4a', wing: '#2a1e2c', bone: '#6b2a34', eye: '#ffcf4a',
    mouth: '#171018', fang: '#e8dcc8', edge: '#8e2a34'
  };

  function batWing(ctx, side, flap, mem, bone, edge) {
    var tipY = -7 + flap * 5.5;
    var midY = -1 + flap * 2.6;
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(3, -3);
    ctx.quadraticCurveTo(11, -8 + flap * 3, 20, tipY);
    ctx.quadraticCurveTo(16.4, midY + 1, 14, midY + 3);
    ctx.quadraticCurveTo(12, midY + 5.2, 9.5, midY + 4.4);
    ctx.quadraticCurveTo(7, midY + 6.6, 4, 5);
    ctx.closePath();
    paint(ctx, mem || '#525462', 1.8);
    if (edge) tint(ctx, edge, 1.1);
    ctx.beginPath();
    ctx.moveTo(3.5, -2.5);
    ctx.lineTo(19, tipY + 0.6);
    ctx.moveTo(9, -3.4 + flap * 1.6);
    ctx.lineTo(13.6, midY + 3);
    ctx.moveTo(6, -1.6 + flap);
    ctx.lineTo(9.4, midY + 4.4);
    tint(ctx, bone || '#33353f', 1.1);
    ctx.restore();
  }

  function frostShards(ctx, t) {
    for (var i = 0; i !== 3; i++) {
      var a = t / 1600 + i * TAU / 3;
      var x = Math.cos(a) * 16.5;
      var y = -4 + Math.sin(a) * 7.5;
      var r = 2 + 0.5 * Math.sin(a * 2);
      ctx.save();
      ctx.globalAlpha = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t / 420 + i * 2.1));
      ctx.translate(x, y);
      ctx.rotate(a * 0.8);
      bloom(ctx, 0, 0, 6, '#7fe6ff', 0.4);
      poly(ctx, [0, -r * 1.5, r * 0.62, -r * 0.4, r * 0.62, r * 0.5, 0, r * 1.5,
        -r * 0.62, r * 0.5, -r * 0.62, -r * 0.4]);
      paint(ctx, '#e4f4ff', 0.9);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(0, r * 1.2);
      tint(ctx, '#9ed8f5', 0.7);
      ctx.restore();
    }
  }

  function batSparks(ctx, t) {
    for (var i = 0; i !== 4; i++) {
      var ph = ((t / 1400) + i * 0.27) % 1;
      var s = i % 2 ? 1 : -1;
      var x = s * (7 + i * 2.6) + Math.sin(t / 520 + i * 1.9) * 1.4;
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      glowDot(ctx, x, 15 - ph * 26, 0.8 + 0.5 * (1 - ph), i % 2 ? '#ffd24a' : '#ff8a2e', 4);
      ctx.restore();
    }
  }

  function drawAshBat(ctx, t, pal) {
    var p = pal || BAT;
    var flap = wave(t, 560);
    var float = wave(t, 560, 0.6) * 2.4;
    shadow(ctx, 20, 8.5 - float * 0.5, 2.4 - float * 0.12, 0.22);
    if (p.sparks) batSparks(ctx, t);
    ctx.save();
    ctx.translate(0, -1.5 + float);
    ctx.scale(1.12, 1.12);
    batWing(ctx, -1, flap, p.wing, p.bone, p.edge);
    batWing(ctx, 1, flap, p.wing, p.bone, p.edge);
    poly(ctx, [-5.5, -6, -8.6, -16.5, -1.4, -8.6]);
    paint(ctx, p.body, 1.8);
    poly(ctx, [5.5, -6, 8.6, -16.5, 1.4, -8.6]);
    paint(ctx, p.body, 1.8);
    poly(ctx, [-5.4, -7.6, -7.2, -13.6, -3, -8.8]);
    paint(ctx, p.ear, 0);
    poly(ctx, [5.4, -7.6, 7.2, -13.6, 3, -8.8]);
    paint(ctx, p.ear, 0);
    ell(ctx, 0, 0, 7.4, 8.2);
    paint(ctx, p.body);
    ctx.save();
    ell(ctx, 0, 0, 7.4, 8.2);
    ctx.clip();
    ctx.fillStyle = p.dark;
    ell(ctx, 2, 7, 7.4, 4.4);
    ctx.fill();
    ctx.fillStyle = p.light;
    ell(ctx, -1.6, 2.6, 4.6, 4.8);
    ctx.fill();
    ctx.fillStyle = p.sheen;
    ell(ctx, -3, -4.6, 2.8, 2.3, -0.4);
    ctx.fill();
    ctx.restore();
    ell(ctx, 0, 3.2, 4.6, 3.1);
    ctx.fillStyle = p.belly;
    ctx.fill();
    glowDot(ctx, -3.3, -2.9, 2, p.eye, 3.2);
    glowDot(ctx, 3.3, -2.9, 2, p.eye, 3.2);
    circle(ctx, -3.9, -3.5, 0.65);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    circle(ctx, 2.7, -3.5, 0.65);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 2.4, 2.1, 0.15 * Math.PI, 0.85 * Math.PI);
    tint(ctx, p.mouth, 1.2);
    poly(ctx, [-2.1, 4.2, -1, 4.2, -1.55, 5.7]);
    paint(ctx, p.fang, 0.7);
    poly(ctx, [2.1, 4.2, 1, 4.2, 1.55, 5.7]);
    paint(ctx, p.fang, 0.7);
    limb(ctx, -2.5, 7.2, -3.2, 9.6, 1.4, p.dark);
    limb(ctx, 2.5, 7.2, 3.2, 9.6, 1.4, p.dark);
    ctx.restore();
    if (p.frost) frostShards(ctx, t);
  }

  function drawSnowBat(ctx, t) {
    drawAshBat(ctx, t, SNOW_BAT);
  }

  function drawEmberBat(ctx, t) {
    drawAshBat(ctx, t, EMBER_BAT);
  }

  function drawShadowBat(ctx, t) {
    drawAshBat(ctx, t, SHADOW_BAT);
  }

  /* ---------------- 3 bone soldier / e bone warden / x brass bone / L shadow bone ---------------- */

  var BONE_SOLDIER = {
    bone: '#cfc8b0', dark: '#a89f85', light: '#e9e3d2', socket: '#191c23', glow: '#6fd3ff',
    teeth: '#8d8670', grip: '#4a3a2a', guard: '#6e7480', blade: '#8b93a1', bladeL: '#c3cad6',
    helm: '#5a5f6a', helmL: '#7b8290', helmD: '#3f434c', trim: null, cleaver: false
  };

  var BONE_WARDEN = {
    bone: '#8f8a78', dark: '#6b6757', light: '#aca795', socket: '#14161c', glow: '#ff4a38',
    teeth: '#5b5748', grip: '#3a2c20', guard: '#caa24c', blade: '#98a0ae', bladeL: '#d6dde8',
    helm: '#4c515c', helmL: '#6d7482', helmD: '#2f333b', trim: '#e6bf5c', cleaver: true
  };

  var BRASS_BONE = {
    bone: '#a8843c', dark: '#7a5c22', light: '#dcb868', socket: '#171310', glow: '#ffb43c',
    teeth: '#6b5220', grip: '#3a2c18', guard: '#8a6a2c', blade: '#8b93a1', bladeL: '#c3cad6',
    helm: '#a8783c', helmL: '#dcae63', helmD: '#6d4c22', trim: '#e6bf5c', cleaver: false,
    gearHelm: true, rivets: '#4a3a1c'
  };

  var SHADOW_BONE = {
    bone: '#3b3040', dark: '#241c2b', light: '#5a4a62', socket: '#0c0910', glow: '#ff3b30',
    teeth: '#6a5570', grip: '#17121c', guard: '#2a2030', blade: '#141118', bladeL: '#ff5a46',
    helm: '#2a2230', helmL: '#4c3f56', helmD: '#17121c', trim: null, cleaver: false,
    rim: '#8e2a34', aura: '#c0262d', bladeGlow: '#ff3b30'
  };

  function boneGearHelm(ctx, p) {
    for (var i = 0; i !== 7; i++) {
      var a = -Math.PI * 0.9 + i * (Math.PI * 0.8 / 6);
      var ca = Math.cos(a), sa = Math.sin(a);
      var px = -sa * 1.5, py = ca * 1.5;
      poly(ctx, [ca * 8.4 + px, -2.5 + sa * 8.2 + py,
        ca * 10.6 + px * 0.7, -2.5 + sa * 10.4 + py * 0.7,
        ca * 10.6 - px * 0.7, -2.5 + sa * 10.4 - py * 0.7,
        ca * 8.4 - px, -2.5 + sa * 8.2 - py]);
      paint(ctx, p.helm, 1.4);
      ctx.beginPath();
      ctx.moveTo(ca * 9.4 + px * 0.8, -2.5 + sa * 9.2 + py * 0.8);
      ctx.lineTo(ca * 10.4 + px * 0.6, -2.5 + sa * 10.2 + py * 0.6);
      tint(ctx, p.helmL, 0.8);
    }
  }

  function drawBoneSoldier(ctx, t, pal) {
    var p = pal || BONE_SOLDIER;
    var BONE = p.bone;
    var BONE_D = p.dark;
    var BONE_L = p.light;
    var sway = wave(t, 900) * 0.045;
    var jaw = Math.abs(wave(t, 520)) * 2.1;
    var bob = wave(t, 900, 0.5) * 0.7;
    var gleam = 0.5 + 0.5 * wave(t, 780, 0.4);
    shadow(ctx, 20, 9, 2.8);
    if (p.aura) bloom(ctx, 0, -1, 21, p.aura, 0.1 + 0.07 * gleam);
    ctx.save();
    ctx.translate(0, 19);
    ctx.rotate(sway);
    ctx.translate(0, -19 + bob);
    limb(ctx, -3, 8, -4.5, 17.6, 2.4, BONE);
    limb(ctx, 3, 8, 4.5, 17.6, 2.4, BONE);
    rrect(ctx, -7.4, 17.2, 5.8, 2.8, 1.2);
    paint(ctx, BONE, 1.4);
    rrect(ctx, 1.6, 17.2, 5.8, 2.8, 1.2);
    paint(ctx, BONE, 1.4);
    rrect(ctx, -4.6, 6.4, 9.2, 3.6, 1.5);
    paint(ctx, BONE, 1.6);
    if (p.rim) {
      rrect(ctx, -4.6, 6.4, 9.2, 3.6, 1.5);
      tint(ctx, p.rim, 1);
    }
    limb(ctx, 0, -2, 0, 7, 2.2, BONE_D);
    for (var i = 0; i !== 3; i++) {
      var ry = 0.2 + i * 2.3;
      ctx.beginPath();
      ctx.moveTo(-5.6 + i * 0.5, ry);
      ctx.quadraticCurveTo(0, ry + 2.2, 5.6 - i * 0.5, ry);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 1.9;
      ctx.stroke();
    }
    limb(ctx, 5, -1, 8.6, 3.4, 2, BONE);
    limb(ctx, 8.6, 3.4, 8, 7, 2, BONE);
    circle(ctx, 8, 7.6, 1.7);
    paint(ctx, BONE, 1.3);
    limb(ctx, -5, -1, -9, 3, 2, BONE);
    limb(ctx, -9, 3, -11.2, 0.8, 2, BONE);
    ctx.save();
    ctx.translate(-11.6, 0.6);
    ctx.rotate(-0.35 + wave(t, 900, 1) * 0.06);
    rrect(ctx, -1, 0.4, 2, 4.2, 0.8);
    paint(ctx, p.grip, 1.2);
    if (p.cleaver) {
      rrect(ctx, -3.6, -0.9, 7.2, 1.7, 0.6);
      paint(ctx, p.guard, 1.2);
      poly(ctx, [-2.6, -0.9, 3.2, -0.9, 3.6, -8.2, 1.8, -10.4, -2.6, -9.8]);
      paint(ctx, p.blade, 1.4);
      ctx.beginPath();
      ctx.moveTo(2.4, -1.6);
      ctx.lineTo(2.8, -8);
      ctx.lineTo(1.5, -9.6);
      tint(ctx, p.bladeL, 1.2);
      ctx.beginPath();
      ctx.moveTo(-1.2, -2);
      ctx.lineTo(-1.4, -8.4);
      tint(ctx, p.helmD, 0.9);
      poly(ctx, [-2.6, -5.4, -1.4, -4.6, -2.6, -3.8]);
      paint(ctx, p.helmD, 0);
    } else {
      poly(ctx, [-3.1, -0.5, 3.1, -0.5, 3.1, 0.8, -3.1, 0.8]);
      paint(ctx, p.guard, 1.2);
      poly(ctx, [-1.6, -0.6, 1.6, -0.6, 1.4, -7.6, 0.4, -9.4, -0.5, -7.2, -1.6, -8.4]);
      paint(ctx, p.blade, 1.4);
      ctx.beginPath();
      ctx.moveTo(-0.7, -1.2);
      ctx.lineTo(-0.5, -7);
      tint(ctx, p.bladeL, 0.9);
      if (p.bladeGlow) {
        bloom(ctx, 0.4, -5, 7.5, p.bladeGlow, 0.24 + 0.18 * gleam);
        ctx.beginPath();
        ctx.moveTo(1.5, -1);
        ctx.lineTo(1.3, -7.4);
        ctx.lineTo(0.4, -9.2);
        tint(ctx, rgba(p.bladeGlow, 0.5 + 0.4 * gleam), 1);
      }
    }
    ctx.restore();
    if (p.rivets) {
      rivet(ctx, -4.2, 8.2, p.rivets);
      rivet(ctx, 4.2, 8.2, p.rivets);
      rivet(ctx, -4.4, 13.4, p.rivets);
      rivet(ctx, 4.4, 13.4, p.rivets);
      rivet(ctx, -5.4, 0.6, p.rivets);
      rivet(ctx, 5.4, 0.6, p.rivets);
      rivet(ctx, -9, 3, p.rivets);
      rivet(ctx, 8.6, 3.4, p.rivets);
    }
    ctx.save();
    ctx.translate(0, -9 + wave(t, 900, 0.3) * 0.4);
    ell(ctx, 0, 0, 9, 8.4);
    paint(ctx, BONE);
    ctx.save();
    ell(ctx, 0, 0, 9, 8.4);
    ctx.clip();
    ctx.fillStyle = BONE_D;
    ell(ctx, 2, 7.4, 9.5, 5);
    ctx.fill();
    ctx.fillStyle = BONE_L;
    ell(ctx, -3.5, -4, 4, 3.2, -0.4);
    ctx.fill();
    ctx.restore();
    if (p.rim) {
      ell(ctx, 0, 0, 9, 8.4);
      tint(ctx, p.rim, 1.1);
    }
    ell(ctx, -3.7, -0.6, 3, 3.2);
    paint(ctx, p.socket, 1.2);
    ell(ctx, 3.7, -0.6, 3, 3.2);
    paint(ctx, p.socket, 1.2);
    glowDot(ctx, -3.7, -0.4, 1.25, p.glow, 3);
    glowDot(ctx, 3.7, -0.4, 1.25, p.glow, 3);
    poly(ctx, [0, 2.2, -1.2, 4.2, 1.2, 4.2]);
    paint(ctx, p.socket, 0);
    rrect(ctx, -4.6, 4.6, 9.2, 2.6, 0.9);
    paint(ctx, BONE_L, 1.3);
    ctx.beginPath();
    ctx.moveTo(-2.3, 4.8);
    ctx.lineTo(-2.3, 7);
    ctx.moveTo(0, 4.8);
    ctx.lineTo(0, 7);
    ctx.moveTo(2.3, 4.8);
    ctx.lineTo(2.3, 7);
    tint(ctx, p.teeth, 0.9);
    ctx.save();
    ctx.translate(0, jaw);
    rrect(ctx, -4.2, 7.2, 8.4, 2.7, 1);
    paint(ctx, BONE, 1.4);
    ctx.beginPath();
    ctx.moveTo(-2, 7.4);
    ctx.lineTo(-2, 9.7);
    ctx.moveTo(0, 7.4);
    ctx.lineTo(0, 9.7);
    ctx.moveTo(2, 7.4);
    ctx.lineTo(2, 9.7);
    tint(ctx, p.teeth, 0.9);
    ctx.restore();
    ctx.save();
    ctx.rotate(-0.22);
    if (p.gearHelm) boneGearHelm(ctx, p);
    ctx.beginPath();
    ctx.moveTo(-9.2, -2.5);
    ctx.quadraticCurveTo(-8.4, -11.4, 0, -11.4);
    ctx.quadraticCurveTo(8.4, -11.4, 9.2, -2.5);
    ctx.lineTo(6.4, -3.5);
    ctx.lineTo(4.6, -1.8);
    ctx.closePath();
    paint(ctx, p.helm, 1.8);
    ctx.beginPath();
    ctx.moveTo(-5.4, -8.2);
    ctx.quadraticCurveTo(-1, -10.4, 3.2, -8.6);
    tint(ctx, p.helmL, 1.3);
    poly(ctx, [2.6, -9.8, 4.6, -7.6, 2.2, -6.8]);
    paint(ctx, p.helmD, 0);
    if (p.trim) {
      ctx.beginPath();
      ctx.moveTo(-9.2, -2.5);
      ctx.quadraticCurveTo(-8.4, -11.4, 0, -11.4);
      ctx.quadraticCurveTo(8.4, -11.4, 9.2, -2.5);
      tint(ctx, p.trim, 1.3);
      ctx.beginPath();
      ctx.moveTo(-8.6, -4.4);
      ctx.quadraticCurveTo(0, -6.6, 8.6, -4.4);
      tint(ctx, p.trim, 1.1);
      circle(ctx, 0, -11.2, 1.1);
      paint(ctx, p.trim, 0.9);
    }
    ctx.restore();
    ctx.restore();
    ctx.restore();
  }

  function drawBoneWarden(ctx, t) {
    ctx.save();
    ctx.scale(1.08, 1.08);
    drawBoneSoldier(ctx, t, BONE_WARDEN);
    ctx.restore();
  }

  function drawBrassBone(ctx, t) {
    drawBoneSoldier(ctx, t, BRASS_BONE);
  }

  function drawShadowBone(ctx, t) {
    drawBoneSoldier(ctx, t, SHADOW_BONE);
  }

  /* ---------------- 4 rust guard / g bronze guard / s clockwork guard / G ice guard ---------------- */

  var RUST_GUARD = {
    armor: '#b0683a', dark: '#8a4f2a', light: '#c9814f', boot: '#6b3d20',
    spot: 'rgba(107,61,32,0.72)', rivet: '#d9a06a', shaft: '#6b4a2f',
    tip: '#cfd4da', tipL: '#eef2f6', collar: IRON, slitBg: '#15171d', slit: '#ffd24a'
  };

  var BRONZE_GUARD = {
    armor: '#5f9a8a', dark: '#3d7164', light: '#8bc2b0', boot: '#2e544b',
    spot: 'rgba(43,88,76,0.72)', rivet: '#e6c15c', shaft: '#5a462a',
    tip: '#e8c463', tipL: '#fff2c0', collar: '#caa24c', slitBg: '#101819', slit: '#5fe3d0'
  };

  var CLOCK_GUARD = {
    armor: '#b98d3e', dark: '#8a6528', light: '#e2b862', boot: '#5f4419',
    spot: 'rgba(95,68,25,0.6)', rivet: '#6b4a1e', shaft: '#6b4a2f',
    tip: '#cfd4da', tipL: '#eef2f6', collar: '#8a6528', slitBg: '#17120c', slit: '#ff9a3c'
  };

  var ICE_GUARD = {
    armor: '#7fb9e6', dark: '#4f86b8', light: '#cfe9fb', boot: '#3d6a94',
    spot: 'rgba(60,110,155,0.45)', rivet: '#eaf7ff', shaft: '#6b7f96',
    tip: '#dff1ff', tipL: '#ffffff', collar: '#a9d4f0', slitBg: '#0f1a24', slit: '#ffffff',
    edge: '#ffffff', iceTip: true, iceBits: true
  };

  function clockKey(ctx, t) {
    ctx.save();
    ctx.translate(-8.5, -5);
    ctx.rotate(-0.3 + wave(t, 1150, 0.4) * 0.02);
    limb(ctx, 0, 6, 0, -5.4, 2.6, '#8a6528');
    ctx.beginPath();
    ctx.moveTo(-0.9, 4.6);
    ctx.lineTo(-0.9, -4.8);
    tint(ctx, '#e2b862', 0.9);
    rrect(ctx, -2.2, -7.2, 4.4, 2.4, 0.9);
    paint(ctx, '#b98d3e', 1.3);
    ctx.save();
    ctx.translate(0, -11);
    ctx.rotate(t / 2600);
    for (var s = -1; s <= 1; s += 2) {
      circle(ctx, s * 3.2, 0, 3);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.4;
      ctx.stroke();
      ctx.strokeStyle = '#b98d3e';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * 3.2, 0, 3.6, Math.PI * 1.05, Math.PI * 1.55);
      tint(ctx, 'rgba(255,230,176,0.55)', 0.8);
    }
    rrect(ctx, -1.7, -2.4, 3.4, 4.8, 1.1);
    paint(ctx, '#b98d3e', 1.4);
    circle(ctx, 0, 0, 1);
    paint(ctx, '#e2b862', 0.9);
    ctx.restore();
    ctx.restore();
  }

  function guardIce(ctx, t) {
    var g = 0.5 + 0.5 * wave(t, 1050, 0.6);
    var spots = [-12.6, -9.4, 9.4, 12.6];
    bloom(ctx, -10.6, -7.6, 7, '#bfe6ff', 0.12 + 0.1 * g);
    bloom(ctx, 10.6, -7.6, 7, '#bfe6ff', 0.12 + 0.1 * g);
    for (var i = 0; i !== spots.length; i++) {
      var h = 3 + (i % 3) * 1.1;
      ctx.save();
      ctx.translate(spots[i], -7.2 + (i % 2) * 0.5);
      ctx.rotate(i % 2 ? 0.18 : -0.16);
      poly(ctx, [-1.5, 0.6, 0, -h, 1.5, 0.6]);
      paint(ctx, '#e8f6ff', 1.1);
      ctx.beginPath();
      ctx.moveTo(-0.7, 0.2);
      ctx.lineTo(-0.1, -h * 0.8);
      tint(ctx, '#ffffff', 0.8);
      ctx.restore();
    }
  }

  function drawRustGuard(ctx, t, pal) {
    var p = pal || RUST_GUARD;
    var RUST = p.armor;
    var RUST_D = p.dark;
    var RUST_L = p.light;
    var breath = wave(t, 1150);
    shadow(ctx, 20, 11, 3.2);
    rrect(ctx, -6.6, 8, 5.2, 10, 1.6);
    paint(ctx, RUST_D, 1.8);
    rrect(ctx, 1.4, 8, 5.2, 10, 1.6);
    paint(ctx, RUST_D, 1.8);
    rrect(ctx, -7.8, 16.8, 7.2, 3.4, 1.3);
    paint(ctx, p.boot, 1.6);
    rrect(ctx, 0.6, 16.8, 7.2, 3.4, 1.3);
    paint(ctx, p.boot, 1.6);
    ctx.save();
    ctx.translate(12, 12);
    ctx.rotate(wave(t, 1000, 0.4) * 0.05);
    limb(ctx, 0, 8, 0, -29, 2, p.shaft);
    poly(ctx, [0, -34, 2.7, -29, 0, -25.4, -2.7, -29]);
    paint(ctx, p.tip, 1.5);
    poly(ctx, [0, -32.8, 1.2, -29.4, 0, -27]);
    paint(ctx, p.tipL, 0);
    rrect(ctx, -1.9, -25.8, 3.8, 2.3, 0.8);
    paint(ctx, p.collar, 1.2);
    if (p.iceTip) {
      bloom(ctx, 0, -29.4, 8, '#bfe6ff', 0.24);
      poly(ctx, [-3.4, -26.4, -5.2, -30.6, -2.2, -28.2]);
      paint(ctx, '#dff1ff', 1);
      poly(ctx, [3.4, -26.4, 5.2, -30.2, 2.2, -28]);
      paint(ctx, '#dff1ff', 1);
      poly(ctx, [0, -34.6, 3.2, -29.6, 0, -24.6, -3.2, -29.6]);
      ctx.fillStyle = 'rgba(223,241,255,0.6)';
      ctx.fill();
      tint(ctx, '#ffffff', 0.9);
      ctx.beginPath();
      ctx.moveTo(0, -33.8);
      ctx.lineTo(0, -25.4);
      ctx.moveTo(-2.6, -29.6);
      ctx.lineTo(2.6, -29.6);
      tint(ctx, 'rgba(255,255,255,0.75)', 0.8);
    }
    ctx.restore();
    ctx.save();
    ctx.translate(0, breath * 0.9);
    rrect(ctx, -9, -6, 18, 15, 3);
    paint(ctx, RUST);
    ctx.save();
    rrect(ctx, -9, -6, 18, 15, 3);
    ctx.clip();
    ctx.fillStyle = RUST_D;
    poly(ctx, [3, -7, 10, -7, 10, 10, 4, 10]);
    ctx.fill();
    ctx.fillStyle = RUST_L;
    poly(ctx, [-10, -7, 2, -7, 0, -3.4, -10, -2.2]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 9);
    tint(ctx, RUST_D, 1.5);
    rustSpot(ctx, -5, 4, 2.6, p.spot);
    rustSpot(ctx, 5.5, -1, 2.1, p.spot);
    ctx.restore();
    rivet(ctx, -6.6, -3.4, p.rivet);
    rivet(ctx, 6.6, -3.4, p.rivet);
    rivet(ctx, -6.6, 6.4, p.rivet);
    rivet(ctx, 6.6, 6.4, p.rivet);
    ell(ctx, -9.6, -4.6, 4.3, 3.5, -0.2);
    paint(ctx, RUST, 1.8);
    ell(ctx, 9.6, -4.6, 4.3, 3.5, 0.2);
    paint(ctx, RUST, 1.8);
    if (p.iceBits) guardIce(ctx, t);
    limb(ctx, -9.4, -2, -10.6, 5, 3.4, RUST_D);
    circle(ctx, -10.8, 5.8, 2.2);
    paint(ctx, p.boot, 1.4);
    limb(ctx, 9.4, -2, 11.4, 3.6, 3.4, RUST_D);
    circle(ctx, 11.8, 4.4, 2.2);
    paint(ctx, p.boot, 1.4);
    rrect(ctx, -8, -19.5, 16, 14, 4.6);
    paint(ctx, RUST);
    ctx.save();
    rrect(ctx, -8, -19.5, 16, 14, 4.6);
    ctx.clip();
    ctx.fillStyle = RUST_D;
    poly(ctx, [2, -21, 9, -21, 9, -4, 3, -4]);
    ctx.fill();
    ctx.fillStyle = RUST_L;
    ell(ctx, -3.6, -17, 4.2, 2.4, -0.3);
    ctx.fill();
    rustSpot(ctx, 4.6, -16.4, 2.2, p.spot);
    rustSpot(ctx, -5.4, -8.4, 1.8, p.spot);
    ctx.restore();
    rivet(ctx, -6.2, -17.4, p.rivet);
    rivet(ctx, 6.2, -17.4, p.rivet);
    if (p.edge) {
      ctx.beginPath();
      ctx.moveTo(-8.6, 6.4);
      ctx.lineTo(-8.6, -3.6);
      ctx.quadraticCurveTo(-8.4, -5.6, -6.2, -5.6);
      ctx.lineTo(1.6, -5.6);
      tint(ctx, p.edge, 1.2);
      ctx.beginPath();
      ctx.moveTo(-7.6, -8.4);
      ctx.lineTo(-7.6, -15.6);
      ctx.quadraticCurveTo(-7.4, -19.1, -4.2, -19.1);
      ctx.lineTo(1.4, -19.1);
      tint(ctx, p.edge, 1.2);
      ctx.beginPath();
      ctx.moveTo(-13.4, -5.4);
      ctx.quadraticCurveTo(-10.4, -8.4, -6.4, -7.2);
      tint(ctx, p.edge, 1);
      ctx.beginPath();
      ctx.moveTo(6.6, -7.4);
      ctx.quadraticCurveTo(10.2, -8.6, 13.2, -6);
      tint(ctx, rgba(p.edge, 0.7), 1);
    }
    rrect(ctx, -6.2, -13.6, 12.4, 3.2, 1.4);
    paint(ctx, p.slitBg, 1.3);
    glowDot(ctx, -3, -12, 1.3, p.slit, 3);
    glowDot(ctx, 3, -12, 1.3, p.slit, 3);
    ctx.beginPath();
    ctx.moveTo(-7, -8.6);
    ctx.lineTo(7, -8.6);
    tint(ctx, RUST_D, 1.4);
    ctx.restore();
  }

  function drawBronzeGuard(ctx, t) {
    drawRustGuard(ctx, t, BRONZE_GUARD);
  }

  function drawClockGuard(ctx, t) {
    clockKey(ctx, t);
    drawRustGuard(ctx, t, CLOCK_GUARD);
  }

  function drawIceGuard(ctx, t) {
    drawRustGuard(ctx, t, ICE_GUARD);
  }

  /* ---------------- 5 hex lantern / i azure lantern / I magma lantern ---------------- */

  var HEX_LANTERN = {
    frame: '#2b2e36', body: '#22252c', edge: '#3a3d47', shade: '#4a4160', chain: '#5a5f6a',
    flame: '#8a5fd0', core: '#c9a6ff', aura: '#8a5fd0', eye: '#f0e6ff', pupil: '#160f22'
  };

  var AZURE_LANTERN = {
    frame: '#8f97a6', body: '#3b4350', edge: '#c2c9d5', shade: '#6d88ad', chain: '#aab2c0',
    flame: '#4a8fe0', core: '#a8d4ff', aura: '#4a8fe0', eye: '#123a6b', pupil: '#ffffff'
  };

  var MAGMA_LANTERN = {
    frame: '#4e2620', body: '#2b1512', edge: '#9a4a30', shade: '#7a3428', chain: '#6e4038',
    flame: '#ff7a2e', core: '#ffd24a', aura: '#ff7a2e', eye: '#4a1608', pupil: '#ffe14a',
    drips: true
  };

  function moltenDrips(ctx, t) {
    var swell = 0.5 + 0.5 * wave(t, 900, 0.3);
    bloom(ctx, 0, 13.4, 7, '#ff7a2e', 0.28 + 0.2 * swell);
    ell(ctx, 0, 13.8 + swell * 0.8, 1.5 + swell * 0.5, 1.9 + swell * 0.7);
    paint(ctx, '#ff9a3c', 1);
    ell(ctx, -0.4, 13.4 + swell * 0.8, 0.6, 0.8);
    ctx.fillStyle = '#ffe9b0';
    ctx.fill();
    for (var i = 0; i !== 2; i++) {
      var ph = ((t / 1600) + i * 0.5) % 1;
      var x = i ? 2.2 : -1.8;
      var y = 14.8 + ph * 3.2;
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      bloom(ctx, x, y, 4.5, '#ff7a2e', 0.4);
      ell(ctx, x, y, 1.1, 1.5);
      paint(ctx, '#ff9a3c', 0.9);
      circle(ctx, x - 0.3, y - 0.4, 0.45);
      ctx.fillStyle = '#ffe9b0';
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHexLantern(ctx, t, pal) {
    var p = pal || HEX_LANTERN;
    var float = wave(t, 760) * 2.2;
    var sway = wave(t, 900, 0.5) * 0.07;
    var pulse = 0.5 + 0.5 * wave(t, 620, 0.2);
    shadow(ctx, 20, 7.5 - float * 0.4, 2.2 - float * 0.1, 0.2);
    ctx.save();
    ctx.translate(0, 1.2 + float);
    ctx.rotate(sway);
    ctx.scale(1.12, 1.12);
    bloom(ctx, 0, 0, 20, p.aura, 0.28 + 0.14 * pulse);
    ctx.save();
    ctx.translate(0, -15);
    ctx.rotate(wave(t, 700, 1.1) * 0.22);
    for (var i = 0; i !== 2; i++) {
      ell(ctx, 0, -1.3 - i * 1.7, 1.15, 1.3, i % 2 ? 0.5 : -0.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = p.chain;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.restore();
    poly(ctx, [-10.5, -6, 0, -13.6, 10.5, -6]);
    paint(ctx, p.frame, 1.8);
    poly(ctx, [-7.2, -6.8, 0, -12.2, 0, -6.8]);
    paint(ctx, p.shade, 0);
    circle(ctx, 0, -14.3, 1.4);
    paint(ctx, p.edge, 1.2);
    poly(ctx, [-9.5, -6, 9.5, -6, 7.6, 8, -7.6, 8]);
    paint(ctx, p.body, 1.8);
    var fh = 9.4 + 1.6 * wave(t, 540) + 0.8 * wave(t, 610, 1.4);
    ctx.beginPath();
    ctx.moveTo(-5.2, 7.2);
    ctx.bezierCurveTo(-6.2, 7.2 - fh * 0.5, -2.4, 7.2 - fh * 0.74, 0, 7.2 - fh);
    ctx.bezierCurveTo(2.4, 7.2 - fh * 0.74, 6.2, 7.2 - fh * 0.5, 5.2, 7.2);
    ctx.closePath();
    ctx.fillStyle = p.flame;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2.8, 7.1);
    ctx.bezierCurveTo(-3.5, 7.1 - fh * 0.36, -1.2, 7.1 - fh * 0.52, 0, 7.1 - fh * 0.68);
    ctx.bezierCurveTo(1.2, 7.1 - fh * 0.52, 3.5, 7.1 - fh * 0.36, 2.8, 7.1);
    ctx.closePath();
    ctx.fillStyle = p.core;
    ctx.fill();
    bloom(ctx, 0, 1.5, 8, p.core, 0.35 + 0.2 * pulse);
    ell(ctx, 0, 1.5, 3.5, 4);
    paint(ctx, p.eye, 1.2);
    ell(ctx, 0, 1.5, 1.15, 3.5);
    paint(ctx, p.pupil, 0);
    circle(ctx, -1.05, 0.1, 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, -5.6);
    ctx.lineTo(-7.2, 7.6);
    ctx.moveTo(9, -5.6);
    ctx.lineTo(7.2, 7.6);
    ctx.moveTo(-9.5, -6);
    ctx.lineTo(9.5, -6);
    tint(ctx, p.edge, 1.6);
    poly(ctx, [-8, 8, 8, 8, 6.6, 11, -6.6, 11]);
    paint(ctx, p.frame, 1.8);
    poly(ctx, [-2, 11, 2, 11, 0, 14.2]);
    paint(ctx, p.edge, 1.3);
    if (p.drips) moltenDrips(ctx, t);
    ctx.restore();
  }

  function drawAzureLantern(ctx, t) {
    drawHexLantern(ctx, t, AZURE_LANTERN);
  }

  function drawMagmaLantern(ctx, t) {
    drawHexLantern(ctx, t, MAGMA_LANTERN);
  }

  /* ---------------- 6 shadow wolf / n frost wolf / z clockwork wolf ---------------- */

  var SHADOW_WOLF = {
    body: '#3f4a6b', dark: '#2b3350', light: '#6f83b4', rim: '#8fa3d8',
    eye: '#ffe08a', fang: '#f2f0e6', nose: '#191c23', smoke: '#0d1017', smokeA: 0.34
  };

  var FROST_WOLF = {
    body: '#a8cbe6', dark: '#7ba6cc', light: '#eef7ff', rim: '#ffffff',
    eye: '#7ff0ff', fang: '#ffffff', nose: '#33465c', smoke: '#eaf6ff', smokeA: 0.42
  };

  var CLOCK_WOLF = {
    body: '#8a6f3a', dark: '#5f4a24', light: '#c2a05c', rim: '#e6c884',
    eye: '#ff9a3c', fang: '#d8d2c0', nose: '#2a2118', smoke: '#eef4fb', smokeA: 0.5,
    plates: true, lens: '#ff9a3c', steam: true
  };

  function wolfPlates(ctx) {
    ctx.beginPath();
    ctx.moveTo(-2.6, -7.4);
    ctx.quadraticCurveTo(-1.4, 0, -2.8, 10.4);
    ctx.moveTo(4.2, -7.6);
    ctx.quadraticCurveTo(5.6, 0, 4.4, 10.4);
    ctx.moveTo(-7.6, 3.4);
    ctx.quadraticCurveTo(2, 5.4, 12.6, 2.6);
    tint(ctx, '#4a3a1c', 1.3);
    ctx.beginPath();
    ctx.moveTo(-3.4, -7.2);
    ctx.quadraticCurveTo(-2.2, 0, -3.6, 10.2);
    ctx.moveTo(3.4, -7.4);
    ctx.quadraticCurveTo(4.8, 0, 3.6, 10.2);
    tint(ctx, 'rgba(230,200,132,0.45)', 0.8);
    rivet(ctx, -2.2, -4.6, '#3f3118');
    rivet(ctx, 4.9, -4.4, '#3f3118');
    rivet(ctx, -5.4, 4.2, '#3f3118');
    rivet(ctx, 8.4, 3.4, '#3f3118');
  }

  function wolfLens(ctx, x, y, hex, t) {
    var g = 0.5 + 0.5 * wave(t, 720, 0.6);
    bloom(ctx, x, y, 7, hex, 0.22 + 0.18 * g);
    circle(ctx, x, y, 2.9);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = '#c2a05c';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    circle(ctx, x, y, 2.2);
    ctx.fillStyle = rgba(hex, 0.28 + 0.24 * g);
    ctx.fill();
    circle(ctx, x, y, 1.1);
    ctx.fillStyle = rgba('#ffe9b0', 0.65 + 0.3 * g);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 2.4, Math.PI * 1.05, Math.PI * 1.5);
    tint(ctx, 'rgba(255,255,255,0.7)', 0.8);
  }

  function wolfSmoke(ctx, t, hex, alpha) {
    for (var i = 0; i !== 3; i++) {
      var ph = ((t / 1300) + i * 0.37) % 1;
      ctx.save();
      ctx.globalAlpha = (alpha == null ? 0.34 : alpha) * (1 - ph);
      ctx.fillStyle = hex || '#0d1017';
      ell(ctx, 1 + i * 6 + ph * 4.5, -4 - ph * 11, 2.2 + ph * 2.6, (2.2 + ph * 2.6) * 0.76, 0.3);
      ctx.fill();
      ctx.restore();
    }
  }

  function wolfBodyPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.bezierCurveTo(-4, -6.5, 6, -7.5, 11, -2);
    ctx.bezierCurveTo(14.2, 1.5, 13.2, 7.4, 10, 8.4);
    ctx.bezierCurveTo(4, 10.4, -3, 10.4, -7, 7);
    ctx.closePath();
  }

  function drawShadowWolf(ctx, t, pal) {
    var p = pal || SHADOW_WOLF;
    var BODY = p.body;
    var DARK = p.dark;
    var LIGHT = p.light;
    var RIM = p.rim;
    var coil = wave(t, 820);
    var tail = wave(t, 700, 0.4) * 0.13;
    shadow(ctx, 20, 13, 3);
    wolfSmoke(ctx, t, p.smoke, p.smokeA);
    ctx.save();
    ctx.translate(coil * 1.1, Math.abs(coil) * 0.6);
    ctx.save();
    ctx.translate(12, 1);
    ctx.rotate(tail);
    ctx.beginPath();
    ctx.moveTo(0, 2.4);
    ctx.bezierCurveTo(6, 0.4, 9.2, -6, 8.2, -13);
    ctx.bezierCurveTo(7.8, -15.8, 5.6, -16, 5, -13.2);
    ctx.bezierCurveTo(4.4, -7, 2, -3, -1.6, -2.4);
    ctx.closePath();
    paint(ctx, BODY, 1.8);
    ctx.beginPath();
    ctx.moveTo(6.4, -12.6);
    ctx.bezierCurveTo(7.4, -14.6, 8.2, -14.4, 8.3, -12.8);
    ctx.bezierCurveTo(8.4, -11, 7.4, -9.4, 6.4, -8.6);
    ctx.closePath();
    paint(ctx, LIGHT, 0);
    ctx.beginPath();
    ctx.moveTo(1.6, 1.2);
    ctx.bezierCurveTo(6, -0.8, 8.6, -6, 8, -12.4);
    tint(ctx, RIM, 1.2);
    ctx.restore();
    limb(ctx, 8, 6, 10.2, 12, 3, DARK);
    limb(ctx, 10.2, 12, 9.2, 17.8, 2.6, DARK);
    wolfBodyPath(ctx);
    paint(ctx, BODY);
    ctx.save();
    wolfBodyPath(ctx);
    ctx.clip();
    ctx.fillStyle = LIGHT;
    ell(ctx, 0, 8.2, 9.5, 4);
    ctx.fill();
    ctx.fillStyle = DARK;
    ell(ctx, 10, 3, 5, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7.6, 1.2);
    ctx.bezierCurveTo(-4, -6.2, 6, -7.2, 10.8, -1.8);
    tint(ctx, RIM, 1.5);
    if (p.plates) wolfPlates(ctx);
    ctx.restore();
    if (p.steam) {
      rrect(ctx, 1.4, -10.4, 3.6, 4.2, 1);
      paint(ctx, '#5f4a24', 1.4);
      rrect(ctx, 0.9, -11.6, 4.6, 1.8, 0.7);
      paint(ctx, '#c2a05c', 1.1);
      steamPuffs(ctx, t, 3.2, -12, 0.15, 0.5);
    }
    limb(ctx, -5, 6, -6, 13, 3, BODY);
    limb(ctx, -6, 13, -6.6, 17.8, 2.6, BODY);
    limb(ctx, -1, 7, -1.6, 13, 3, DARK);
    limb(ctx, -1.6, 13, -2.2, 17.8, 2.6, DARK);
    rrect(ctx, 6.6, 17.4, 5.6, 2.8, 1.2);
    paint(ctx, DARK, 1.3);
    rrect(ctx, -9.2, 17.4, 5.8, 2.8, 1.2);
    paint(ctx, DARK, 1.3);
    rrect(ctx, -4.6, 17.4, 5.8, 2.8, 1.2);
    paint(ctx, DARK, 1.3);
    ctx.beginPath();
    ctx.moveTo(-6, -2.5);
    ctx.bezierCurveTo(-8, -9, -13.5, -10.5, -16, -6);
    ctx.lineTo(-21, -2.2);
    ctx.quadraticCurveTo(-19.8, 1.6, -16.4, 2.2);
    ctx.bezierCurveTo(-13, 4, -8, 4.4, -6, 2.5);
    ctx.closePath();
    paint(ctx, BODY);
    if (p.plates) {
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(-16.8, -1.4);
      ctx.quadraticCurveTo(-12, -3.2, -7.2, -1);
      tint(ctx, '#4a3a1c', 1.2);
      ctx.beginPath();
      ctx.moveTo(-16.6, -2.2);
      ctx.quadraticCurveTo(-12, -4, -7.4, -1.8);
      tint(ctx, 'rgba(230,200,132,0.45)', 0.7);
      rivet(ctx, -14.4, -2.4, '#3f3118');
      rivet(ctx, -8.6, -3.4, '#3f3118');
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(-16, -3.4);
    ctx.lineTo(-20.8, -2.1);
    ctx.quadraticCurveTo(-19.8, 1.4, -16.4, 2);
    ctx.quadraticCurveTo(-15, 0.2, -16, -3.4);
    ctx.closePath();
    paint(ctx, LIGHT, 0);
    ctx.beginPath();
    ctx.moveTo(-15.6, -6.6);
    ctx.bezierCurveTo(-12.8, -9.4, -8.8, -8.8, -6.4, -5.2);
    tint(ctx, RIM, 1.4);
    poly(ctx, [-6.6, -8, -5, -17.2, -2.2, -7.6]);
    paint(ctx, DARK, 1.6);
    poly(ctx, [-11.5, -7.5, -13.2, -16.8, -7.6, -9.6]);
    paint(ctx, BODY, 1.6);
    poly(ctx, [-11.1, -8.8, -12.2, -14.4, -8.8, -9.8]);
    paint(ctx, DARK, 0);
    ctx.beginPath();
    ctx.moveTo(-13.1, -16.2);
    ctx.lineTo(-11.7, -8.6);
    tint(ctx, RIM, 1.1);
    glowDot(ctx, -13.6, -4.6, 1.7, p.eye, 3);
    if (p.lens) wolfLens(ctx, -13.6, -4.6, p.lens, t);
    poly(ctx, [-18.4, 0.2, -17.2, 0.3, -17.8, 2.6]);
    paint(ctx, p.fang, 0.8);
    poly(ctx, [-15.9, 0.6, -14.8, 0.7, -15.3, 2.7]);
    paint(ctx, p.fang, 0.8);
    circle(ctx, -20.5, -2.1, 1);
    paint(ctx, p.nose, 0);
    ctx.restore();
  }

  function drawFrostWolf(ctx, t) {
    drawShadowWolf(ctx, t, FROST_WOLF);
  }

  function drawClockWolf(ctx, t) {
    drawShadowWolf(ctx, t, CLOCK_WOLF);
  }

  /* ---------------- 7 stone guard / o magma golem / a ink golem / C pendulum golem ---------------- */

  var STONE_GUARD = {
    base: '#8f9aa3', dark: '#6b757e', light: '#aab4bc', gap: '#3a4048',
    crack: '#3a4048', rune: '#5fe3d0', moss: 'rgba(79,122,58,0.8)', ember: false
  };

  var MAGMA_GUARD = {
    base: '#3a2f2c', dark: '#241c1a', light: '#554440', gap: '#1b1413',
    crack: '#ff7a2e', rune: '#ff7a2e', moss: null, ember: true
  };

  var INK_GUARD = {
    base: '#2f3340', dark: '#1e222c', light: '#4a5060', gap: '#141821',
    crack: '#dfe6f2', crackCore: '#ffffff', rune: '#ffffff', moss: null, ember: false,
    seep: true, ink: true
  };

  var PENDULUM_GUARD = {
    base: '#9c7a35', dark: '#6d5322', light: '#c9a45c', gap: '#4a3818',
    crack: '#5f4a22', rune: '#ffcf4a', moss: 'rgba(79,140,110,0.65)', ember: false, clock: true
  };

  function inkSeeps(ctx, t) {
    var runs = [-6.2, 5.4, -12.4];
    var tops = [-7.6, -6.4, 2.4];
    var lens = [8.4, 10.2, 6.2];
    for (var i = 0; i !== 3; i++) {
      var f = 0.5 + 0.5 * wave(t, 1600 + i * 260, i * 1.4);
      var x = runs[i], y0 = tops[i], len = lens[i] * (0.72 + 0.28 * f);
      ctx.beginPath();
      ctx.moveTo(x - 1.5, y0);
      ctx.quadraticCurveTo(x - 1.9, y0 + len * 0.6, x - 0.9, y0 + len);
      ctx.quadraticCurveTo(x, y0 + len + 1.6, x + 0.9, y0 + len);
      ctx.quadraticCurveTo(x + 1.9, y0 + len * 0.6, x + 1.5, y0);
      ctx.closePath();
      paint(ctx, '#12151d', 0);
      ctx.beginPath();
      ctx.moveTo(x - 1.2, y0 + 0.6);
      ctx.quadraticCurveTo(x - 1.6, y0 + len * 0.6, x - 0.7, y0 + len - 0.4);
      tint(ctx, 'rgba(223,230,242,0.4)', 0.8);
      circle(ctx, x, y0 + len + 0.6, 1.1 + 0.4 * f);
      paint(ctx, '#12151d', 0);
      circle(ctx, x - 0.4, y0 + len + 0.2, 0.4);
      ctx.fillStyle = 'rgba(223,230,242,0.5)';
      ctx.fill();
    }
  }

  function stoneClock(ctx, t, p) {
    var minute = t / 900 - Math.PI / 2;
    var hour = t / 10800 - Math.PI / 2;
    var pulse = 0.5 + 0.5 * wave(t, 1100, 0.3);
    bloom(ctx, 0, 0.6, 10, p.rune, 0.22 + 0.14 * pulse);
    ctx.save();
    ctx.translate(0, 5.4);
    ctx.rotate(wave(t, 780, 0.2) * 0.34);
    limb(ctx, 0, 0, 0, 5.2, 1.2, '#6d5322');
    circle(ctx, 0, 6.4, 1.9);
    paint(ctx, '#c9a45c', 1.4);
    circle(ctx, -0.6, 5.8, 0.6);
    ctx.fillStyle = 'rgba(255,240,200,0.6)';
    ctx.fill();
    ctx.restore();
    circle(ctx, 0, 0.6, 5.6);
    paint(ctx, '#6d5322', 1.8);
    circle(ctx, 0, 0.6, 4.4);
    paint(ctx, '#f2e4c2', 1.1);
    ctx.save();
    circle(ctx, 0, 0.6, 4.4);
    ctx.clip();
    ctx.fillStyle = 'rgba(140,110,60,0.3)';
    ell(ctx, 1.8, 3.8, 4.6, 3.2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    for (var i = 0; i !== 12; i++) {
      var a = i * TAU / 12;
      var r0 = i % 3 === 0 ? 3 : 3.5;
      ctx.moveTo(Math.cos(a) * r0, 0.6 + Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * 4.1, 0.6 + Math.sin(a) * 4.1);
    }
    tint(ctx, '#6b5a3a', 0.8);
    limb(ctx, 0, 0.6, Math.cos(hour) * 2.3, 0.6 + Math.sin(hour) * 2.3, 1.4, '#3a3226');
    limb(ctx, 0, 0.6, Math.cos(minute) * 3.4, 0.6 + Math.sin(minute) * 3.4, 1, '#3a3226');
    circle(ctx, 0, 0.6, 0.8);
    paint(ctx, '#c9a45c', 0.9);
    ctx.beginPath();
    ctx.arc(0, 0.6, 3.8, Math.PI * 1.04, Math.PI * 1.52);
    tint(ctx, 'rgba(255,255,255,0.45)', 1.1);
    ctx.beginPath();
    ctx.arc(0, 0.6, 5.2, Math.PI * 1.05, Math.PI * 1.6);
    tint(ctx, rgba(p.rune, 0.45 + 0.3 * pulse), 1);
  }

  function emberMotes(ctx, t) {
    for (var i = 0; i !== 3; i++) {
      var ph = ((t / 1500) + i * 0.41) % 1;
      var x = -10 + i * 9 + Math.sin(t / 600 + i * 2.2) * 1.6;
      var y = 8 - ph * 26;
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      glowDot(ctx, x, y, 0.9 + 0.4 * (1 - ph), '#ff9a3c', 4);
      ctx.restore();
    }
  }

  function drawStoneGuard(ctx, t, pal) {
    var p = pal || STONE_GUARD;
    var STONE = p.base;
    var SD = p.dark;
    var SL = p.light;
    var GAP = p.gap;
    var sway = wave(t, 1400) * 0.018;
    var pulse = 0.55 + 0.45 * wave(t, 1100, 0.3);
    var bob = wave(t, 1400, 0.8) * 0.4;
    shadow(ctx, 20, 12, 3.4);
    ctx.save();
    ctx.translate(0, 19);
    ctx.rotate(sway);
    ctx.translate(0, -19 + bob);
    stoneBlock(ctx, -6.6, 7, 5.2, 12.6, 1.2, STONE, SD, SL);
    stoneBlock(ctx, 1.4, 7, 5.2, 12.6, 1.2, STONE, SD, SL);
    stoneBlock(ctx, -12.4, -5.4, 4.8, 5.4, 1, SD, SD, SL);
    stoneBlock(ctx, 7.6, -5.4, 4.8, 5.4, 1, SD, SD, SL);
    stoneBlock(ctx, -15.4, -1, 7.8, 9.4, 2, STONE, SD, SL);
    stoneBlock(ctx, 7.6, -1, 7.8, 9.4, 2, STONE, SD, SL);
    stoneBlock(ctx, -9, -7, 18, 15, 1.6, STONE, SD, SL);
    stoneBlock(ctx, -8, -19.5, 16, 12, 1.6, STONE, SD, SL);
    ctx.beginPath();
    ctx.moveTo(-8, -7.4);
    ctx.lineTo(8, -7.4);
    ctx.moveTo(-9, 7.6);
    ctx.lineTo(9, 7.6);
    ctx.moveTo(-2.6, 8);
    ctx.lineTo(-2.6, 19);
    ctx.moveTo(2.6, 8);
    ctx.lineTo(2.6, 19);
    tint(ctx, GAP, 1.2);
    if (p.ember || p.seep) {
      bloom(ctx, -4.6, -16, 6, p.crack, 0.24 * pulse);
      bloom(ctx, 5.4, -2.6, 6, p.crack, 0.24 * pulse);
      bloom(ctx, -12.5, 3, 5, p.crack, 0.2 * pulse);
    }
    ctx.beginPath();
    ctx.moveTo(-5.4, -19.4);
    ctx.lineTo(-3.6, -15.6);
    ctx.lineTo(-5.2, -12.4);
    ctx.moveTo(6.2, -6.6);
    ctx.lineTo(4.4, -2.6);
    ctx.lineTo(6.6, 1.4);
    ctx.moveTo(-13.6, 1.4);
    ctx.lineTo(-11.4, 4.2);
    if (p.ember || p.seep) {
      ctx.strokeStyle = rgba(p.crack, 0.2 + 0.16 * pulse);
      ctx.lineWidth = 3.6;
      ctx.stroke();
    }
    tint(ctx, p.crack, 1);
    if (p.ember || p.seep) {
      ctx.strokeStyle = rgba(p.crackCore || '#ffe0b0', 0.45 + 0.4 * pulse);
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    if (p.moss) {
      ctx.fillStyle = p.moss;
      ell(ctx, -7.4, -5.6, 3, 1.7, -0.2);
      ctx.fill();
      ell(ctx, 6.2, 6.4, 2.4, 1.4, 0.25);
      ctx.fill();
      ell(ctx, -12.6, 7.6, 2, 1.2, 0.1);
      ctx.fill();
    }
    if (p.ink) inkSeeps(ctx, t);
    if (p.clock) {
      stoneClock(ctx, t, p);
    } else {
      bloom(ctx, 0, 0.6, 9, p.rune, 0.3 * pulse);
      ctx.beginPath();
      ctx.moveTo(0, -3.4);
      ctx.lineTo(3.2, 0.6);
      ctx.lineTo(0, 4.6);
      ctx.lineTo(-3.2, 0.6);
      ctx.closePath();
      ctx.moveTo(0, -3.4);
      ctx.lineTo(0, 4.6);
      ctx.moveTo(-2.2, -1.2);
      ctx.lineTo(2.2, -1.2);
      ctx.strokeStyle = rgba(p.rune, 0.5 + 0.5 * pulse);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    stoneEye(ctx, -4.2, -14.4, pulse, p.rune);
    stoneEye(ctx, 4.2, -14.4, pulse, p.rune);
    ctx.restore();
    if (p.ember) emberMotes(ctx, t);
  }

  function drawMagmaGuard(ctx, t) {
    drawStoneGuard(ctx, t, MAGMA_GUARD);
  }

  function drawInkGuard(ctx, t) {
    drawStoneGuard(ctx, t, INK_GUARD);
  }

  function drawPendulumGuard(ctx, t) {
    drawStoneGuard(ctx, t, PENDULUM_GUARD);
  }

  /* ---------------- 8 dusk knight / p pale knight / u eclipse guard ---------------- */

  var DUSK_KNIGHT = {
    armor: '#474d63', dark: '#2c2f3a', light: '#626a86', rim: '#9a8fd6',
    cape: '#5e2430', capeD: '#421a23', capeL: '#7a3240',
    blade: '#98a0b5', bladeD: '#5c6478', guard: '#565c72', grip: '#241f2b',
    horn: '#33374a', visor: '#ff3b30', slot: '#0c0d12', emblem: false
  };

  var PALE_KNIGHT = {
    armor: '#d8d4c8', dark: '#9aa5b6', light: '#f4f1e8', rim: '#8593ab',
    cape: '#5b6b83', capeD: '#41506a', capeL: '#8494ac',
    blade: '#c2cad6', bladeD: '#7d8798', guard: '#aab3c0', grip: '#3a3f4a',
    horn: '#b0bac8', visor: '#4aa8ff', slot: '#0c0d12', emblem: false
  };

  var ECLIPSE_GUARD = {
    armor: '#16181e', dark: '#0b0d11', light: '#2c2f39', rim: '#c0262d',
    cape: '#0e1015', capeD: '#07080b', capeL: '#282a33',
    blade: '#6e7482', bladeD: '#3a3d47', guard: '#2b2e37', grip: '#101218',
    horn: '#14161c', visor: '#ffcf4a', slot: '#08090d', emblem: true
  };

  function capePath(ctx, w) {
    ctx.beginPath();
    ctx.moveTo(-8, -9);
    ctx.bezierCurveTo(-14, -2, -15 - w * 1.6, 8, -13 - w * 2.2, 16);
    ctx.lineTo(-10 - w * 1.8, 13.4);
    ctx.lineTo(-7, 17);
    ctx.lineTo(-3, 13.8);
    ctx.lineTo(1, 17.4);
    ctx.lineTo(5, 13.6);
    ctx.lineTo(9, 16.6);
    ctx.lineTo(12 + w * 1.6, 13.4);
    ctx.bezierCurveTo(14 + w * 1.4, 6, 12, -2, 8, -9);
    ctx.closePath();
  }

  function knightHelmPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.bezierCurveTo(-7.6, -17, -4, -20.6, 0, -20.6);
    ctx.bezierCurveTo(4, -20.6, 7.6, -17, 7, -8);
    ctx.closePath();
  }

  function knightEmblem(ctx, t) {
    var p = 0.5 + 0.5 * wave(t, 700, 0.9);
    ctx.save();
    ctx.translate(4.6, -5.8);
    bloom(ctx, 0, 0, 5.5, '#c0262d', 0.3 + 0.24 * p);
    circle(ctx, 0, 0, 2.4);
    ctx.strokeStyle = rgba('#ff4a3c', 0.7 + 0.3 * p);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    circle(ctx, 0, 0, 1.8);
    paint(ctx, '#07080c', 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, 2.1, Math.PI * 1.05, Math.PI * 1.75);
    tint(ctx, rgba('#ffc24a', 0.6 + 0.4 * p), 0.6);
    ctx.restore();
  }

  function drawDuskKnight(ctx, t, pal) {
    var p = pal || DUSK_KNIGHT;
    var ARMOR = p.armor;
    var AD = p.dark;
    var AL = p.light;
    var RIM = p.rim;
    var CAPE = p.cape;
    var breath = wave(t, 1200) * 0.8;
    var w = wave(t, 1000, 0.3);
    var visor = 0.5 + 0.5 * wave(t, 760, 0.6);
    shadow(ctx, 20, 11.5, 3.2);
    capePath(ctx, w);
    paint(ctx, CAPE, 1.8);
    ctx.save();
    capePath(ctx, w);
    ctx.clip();
    ctx.fillStyle = p.capeD;
    poly(ctx, [-16, -10, -8, -10, -6, 20, -16, 20]);
    ctx.fill();
    poly(ctx, [6, -10, 16, -10, 16, 20, 8, 20]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.quadraticCurveTo(-6 + w, 4, -5 + w * 1.4, 15);
    ctx.moveTo(3, -8);
    ctx.quadraticCurveTo(5 + w, 4, 4 + w * 1.4, 15);
    tint(ctx, p.capeL, 1.2);
    ctx.restore();
    ctx.save();
    ctx.translate(0, breath);
    rrect(ctx, -6.6, 5, 5.2, 13, 1.6);
    paint(ctx, AD, 1.8);
    rrect(ctx, 1.4, 5, 5.2, 13, 1.6);
    paint(ctx, AD, 1.8);
    rrect(ctx, -7.8, 16.8, 7.2, 3.4, 1.3);
    paint(ctx, ARMOR, 1.5);
    rrect(ctx, 0.6, 16.8, 7.2, 3.4, 1.3);
    paint(ctx, ARMOR, 1.5);
    rrect(ctx, -8.5, -8, 17, 15, 3);
    paint(ctx, ARMOR);
    ctx.save();
    rrect(ctx, -8.5, -8, 17, 15, 3);
    ctx.clip();
    ctx.fillStyle = AD;
    poly(ctx, [2, -9, 10, -9, 10, 8, 3, 8]);
    ctx.fill();
    ctx.fillStyle = AL;
    poly(ctx, [-9.5, -9, 1, -9, -1, -4.6, -9.5, -3.4]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-7.5, 2.4);
    ctx.lineTo(7.5, 2.4);
    tint(ctx, AD, 1.4);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-8.1, -6.4);
    ctx.lineTo(-8.1, 5.4);
    tint(ctx, RIM, 1.3);
    ell(ctx, -10, -6.6, 4.8, 3.8, -0.22);
    paint(ctx, ARMOR, 1.8);
    ell(ctx, 10, -6.6, 4.8, 3.8, 0.22);
    paint(ctx, ARMOR, 1.8);
    ctx.beginPath();
    ctx.moveTo(-14.2, -7.6);
    ctx.quadraticCurveTo(-11.6, -10.4, -6.6, -8.8);
    tint(ctx, RIM, 1.4);
    ctx.beginPath();
    ctx.moveTo(6.6, -9);
    ctx.quadraticCurveTo(10.8, -10.4, 13.8, -8);
    tint(ctx, RIM, 1);
    limb(ctx, -9.8, -4.4, -3.4, -3, 3.6, AD);
    limb(ctx, 9.8, -4.4, 3.4, -1, 3.6, AD);
    poly(ctx, [-2.9, 4.2, 2.9, 4.2, 2.3, 16.4, 0, 20.6, -2.3, 16.4]);
    paint(ctx, p.blade, 1.8);
    ctx.beginPath();
    ctx.moveTo(0, 5.2);
    ctx.lineTo(0, 16.6);
    tint(ctx, p.bladeD, 1.2);
    ctx.beginPath();
    ctx.moveTo(-2.4, 4.8);
    ctx.lineTo(-1.9, 16.2);
    tint(ctx, RIM, 1.2);
    poly(ctx, [-8.4, 1.8, 8.4, 1.8, 7.2, 4.4, -7.2, 4.4]);
    paint(ctx, p.guard, 1.6);
    ctx.beginPath();
    ctx.moveTo(-8, 2.2);
    ctx.lineTo(-7, 4);
    tint(ctx, RIM, 1.1);
    rrect(ctx, -1.8, -5.6, 3.6, 7.6, 1);
    paint(ctx, p.grip, 1.4);
    circle(ctx, 0, -6.4, 2);
    paint(ctx, p.guard, 1.4);
    rrect(ctx, -5.4, -5.4, 5.4, 4, 1.4);
    paint(ctx, ARMOR, 1.5);
    rrect(ctx, 0, -3.8, 5.4, 4, 1.4);
    paint(ctx, ARMOR, 1.5);
    ctx.beginPath();
    ctx.moveTo(-5, -4.8);
    ctx.lineTo(-5, -2);
    tint(ctx, RIM, 1);
    if (p.emblem) knightEmblem(ctx, t);
    ctx.beginPath();
    ctx.moveTo(-5.6, -15.4);
    ctx.quadraticCurveTo(-11, -18.2, -12.4, -22.2);
    ctx.quadraticCurveTo(-9, -20.4, -4.4, -18.6);
    ctx.closePath();
    paint(ctx, p.horn, 1.6);
    ctx.beginPath();
    ctx.moveTo(5.6, -15.4);
    ctx.quadraticCurveTo(11, -18.2, 12.4, -22.2);
    ctx.quadraticCurveTo(9, -20.4, 4.4, -18.6);
    ctx.closePath();
    paint(ctx, p.horn, 1.6);
    ctx.beginPath();
    ctx.moveTo(-12, -21.6);
    ctx.quadraticCurveTo(-9.4, -19.6, -5.8, -17.4);
    tint(ctx, RIM, 1.1);
    knightHelmPath(ctx);
    paint(ctx, ARMOR, 2);
    ctx.save();
    knightHelmPath(ctx);
    ctx.clip();
    ctx.fillStyle = AD;
    poly(ctx, [1, -22, 9, -22, 9, -7, 2, -7]);
    ctx.fill();
    ctx.fillStyle = AL;
    ell(ctx, -3.4, -16.4, 2.8, 3.6, -0.3);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-6.6, -9);
    ctx.bezierCurveTo(-7.2, -16, -4, -19.8, -0.6, -20);
    tint(ctx, RIM, 1.4);
    ctx.beginPath();
    ctx.moveTo(0, -20.4);
    ctx.lineTo(0, -14.6);
    tint(ctx, AL, 1.2);
    rrect(ctx, -5.2, -13.6, 10.4, 2.8, 1.3);
    paint(ctx, p.slot, 1.2);
    bloom(ctx, 0, -12.2, 9, p.visor, 0.3 + 0.4 * visor);
    rrect(ctx, -4.4, -13.1, 8.8, 1.8, 0.9);
    ctx.fillStyle = rgba(p.visor, 0.5 + 0.5 * visor);
    ctx.fill();
    ctx.restore();
  }

  function drawPaleKnight(ctx, t) {
    drawDuskKnight(ctx, t, PALE_KNIGHT);
  }

  function drawEclipseGuard(ctx, t) {
    ctx.save();
    ctx.scale(1.1, 1.1);
    drawDuskKnight(ctx, t, ECLIPSE_GUARD);
    ctx.restore();
  }

  /* ---------------- 9 eclipse priest / q bloodmoon priest / v eclipse apostle ---------------- */

  var ECLIPSE_PRIEST = {
    robe: '#a03a6a', dark: '#7a2a50', light: '#c05a86', staff: '#4a3a2a',
    ring: '#ffe9b0', ringHi: '#fff6dc', disc: '#0b0c10', hood: '#0b0c10',
    eye: '#ffffff', hand: '#2a1c22', trim: null, corona: false
  };

  var BLOOD_PRIEST = {
    robe: '#8e1f2f', dark: '#65121e', light: '#b8434f', staff: '#3a2a22',
    ring: '#ff4a52', ringHi: '#ffd2d2', disc: '#0b0c10', hood: '#0b0c10',
    eye: '#ff4a4a', hand: '#2a1418', trim: null, corona: false
  };

  var ECLIPSE_APOSTLE = {
    robe: '#16171d', dark: '#0a0b0f', light: '#31333d', staff: '#2a2118',
    ring: '#ffc24a', ringHi: '#fff0c0', disc: '#07080c', hood: '#07080c',
    eye: '#ffd24a', hand: '#1b1b22', trim: '#e0b64a', corona: true
  };

  function robePath(ctx, hem) {
    ctx.beginPath();
    ctx.moveTo(-7, -8);
    ctx.bezierCurveTo(-10, 0, -12 - hem, 10, -11 - hem, 17);
    ctx.lineTo(-8 - hem * 0.7, 14.6);
    ctx.lineTo(-5, 18);
    ctx.lineTo(-2, 15);
    ctx.lineTo(1, 18.2);
    ctx.lineTo(4, 14.8);
    ctx.lineTo(7, 17.6);
    ctx.lineTo(10 + hem * 0.7, 14.6);
    ctx.bezierCurveTo(12 + hem, 10, 10, 0, 7, -8);
    ctx.closePath();
  }

  function robeHemPath(ctx, hem) {
    ctx.beginPath();
    ctx.moveTo(-11 - hem, 17);
    ctx.lineTo(-8 - hem * 0.7, 14.6);
    ctx.lineTo(-5, 18);
    ctx.lineTo(-2, 15);
    ctx.lineTo(1, 18.2);
    ctx.lineTo(4, 14.8);
    ctx.lineTo(7, 17.6);
    ctx.lineTo(10 + hem * 0.7, 14.6);
  }

  function drawEclipsePriest(ctx, t, pal) {
    var p = pal || ECLIPSE_PRIEST;
    var ROBE = p.robe;
    var RD = p.dark;
    var RL = p.light;
    var float = wave(t, 880) * 2.2;
    var hem = wave(t, 720, 0.5) * 1.8;
    var ring = 0.5 + 0.5 * wave(t, 620, 0.9);
    shadow(ctx, 20, 8.5 - float * 0.4, 2.4 - float * 0.12, 0.22);
    ctx.save();
    ctx.translate(0, -1 + float);
    ctx.save();
    ctx.translate(13, 0);
    ctx.rotate(wave(t, 880, 1.2) * 0.03);
    limb(ctx, 0, 18, 0, -12, 2, p.staff);
    bloom(ctx, 0, -14.4, 12, p.ring, 0.32 + 0.3 * ring);
    if (p.corona) {
      ctx.save();
      ctx.translate(0, -14.4);
      ctx.rotate(t / 2600);
      for (var j = 0; j !== 10; j++) {
        var ang = j * TAU / 10;
        var rl = 2 + (j % 3) * 1.1 + ring * 1.2;
        poly(ctx, [Math.cos(ang - 0.12) * 5, Math.sin(ang - 0.12) * 5,
          Math.cos(ang) * (5 + rl), Math.sin(ang) * (5 + rl),
          Math.cos(ang + 0.12) * 5, Math.sin(ang + 0.12) * 5]);
        ctx.fillStyle = rgba(j % 2 ? '#ffc24a' : '#ff5a3c', 0.72);
        ctx.fill();
      }
      ctx.restore();
    }
    circle(ctx, 0, -14.4, 5.2);
    ctx.fillStyle = rgba(p.ring, 0.7 + 0.3 * ring);
    ctx.fill();
    circle(ctx, 0, -14.4, 4.1);
    paint(ctx, p.disc, 1.4);
    ctx.beginPath();
    ctx.arc(0, -14.4, 4.7, Math.PI * 1.05, Math.PI * 1.85);
    tint(ctx, p.ringHi, 1.1);
    ctx.restore();
    robePath(ctx, hem);
    paint(ctx, ROBE, 2);
    ctx.save();
    robePath(ctx, hem);
    ctx.clip();
    ctx.fillStyle = RD;
    poly(ctx, [2, -9, 14, -9, 14, 20, 4, 20]);
    ctx.fill();
    ctx.fillStyle = RL;
    ell(ctx, -5, 0, 3, 7.5, -0.16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.quadraticCurveTo(-3 + hem * 0.4, 6, -2 + hem * 0.6, 16);
    ctx.moveTo(3, -6);
    ctx.quadraticCurveTo(4 + hem * 0.4, 6, 3 + hem * 0.6, 16);
    tint(ctx, RD, 1.3);
    ctx.restore();
    if (p.trim) {
      robeHemPath(ctx, hem);
      tint(ctx, p.trim, 1.2);
      ctx.beginPath();
      ctx.moveTo(0.5, -6);
      ctx.quadraticCurveTo(1.5 + hem * 0.4, 6, 1 + hem * 0.6, 16.4);
      tint(ctx, p.trim, 1);
    }
    ctx.beginPath();
    ctx.moveTo(-8.5, -6);
    ctx.bezierCurveTo(-9.6, -15.4, -4.5, -19.4, 0, -19.4);
    ctx.bezierCurveTo(4.5, -19.4, 9.6, -15.4, 8.5, -6);
    ctx.quadraticCurveTo(0, -2.5, -8.5, -6);
    ctx.closePath();
    paint(ctx, ROBE, 2);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = RD;
    poly(ctx, [1, -22, 11, -22, 11, -2, 3, -2]);
    ctx.fill();
    ctx.fillStyle = RL;
    ell(ctx, -4, -15, 2.8, 3.8, -0.4);
    ctx.fill();
    ctx.restore();
    if (p.trim) {
      ctx.beginPath();
      ctx.moveTo(8.5, -6);
      ctx.quadraticCurveTo(0, -2.5, -8.5, -6);
      tint(ctx, p.trim, 1.3);
    }
    ell(ctx, 0, -10.5, 5.6, 6.2);
    paint(ctx, p.hood, 1.4);
    if (p.trim) {
      ell(ctx, 0, -10.5, 5.6, 6.2);
      tint(ctx, p.trim, 1);
    }
    glowDot(ctx, -2.4, -10.5, 1.5, p.eye, 2.6);
    glowDot(ctx, 2.4, -10.5, 1.5, p.eye, 2.6);
    limb(ctx, 5, -4, 11, 0.2, 4, ROBE);
    circle(ctx, 11.7, 0.6, 1.9);
    paint(ctx, p.hand, 1.2);
    ctx.restore();
  }

  function drawBloodPriest(ctx, t) {
    drawEclipsePriest(ctx, t, BLOOD_PRIEST);
  }

  function drawEclipseApostle(ctx, t) {
    ctx.save();
    ctx.scale(1.1, 1.1);
    drawEclipsePriest(ctx, t, ECLIPSE_APOSTLE);
    ctx.restore();
  }

  /* ---------------- 0 eclipse lord (boss) ---------------- */

  function lordMist(ctx, t) {
    for (var i = 0; i !== 5; i++) {
      var ph = t / 1200 + i * 1.3;
      var r = 5.6 - (i % 3) * 0.8;
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.2 * Math.sin(ph);
      ctx.fillStyle = i % 2 ? '#0e1016' : '#171a22';
      ell(ctx, -10 + i * 5 + Math.sin(ph) * 2.2, 13 + Math.cos(ph * 0.8) * 1.8 + (i % 2) * 2,
        r, r * 0.72, Math.sin(ph) * 0.3);
      ctx.fill();
      ctx.restore();
    }
  }

  function lordClaw(ctx, side, open) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.translate(12.5, 1);
    ctx.rotate(-0.2 + open * 0.08);
    limb(ctx, -4, -2.4, 2.4, 0.8, 3, '#1a1c24');
    for (var i = 0; i !== 3; i++) {
      ctx.save();
      ctx.rotate(-0.5 + i * 0.42 + open * 0.12);
      ctx.beginPath();
      ctx.moveTo(2, -1);
      ctx.quadraticCurveTo(7, -0.7, 9.6, 1.7);
      ctx.quadraticCurveTo(6.4, 0.9, 2, 1.2);
      ctx.closePath();
      paint(ctx, '#2a2d38', 1.2);
      ctx.restore();
    }
    ctx.restore();
  }

  function lordCloakPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.bezierCurveTo(-15, -4, -17.5, 6, -15, 13);
    ctx.lineTo(-11, 10.4);
    ctx.lineTo(-7, 14);
    ctx.lineTo(-3, 11);
    ctx.lineTo(1, 14.4);
    ctx.lineTo(5, 11);
    ctx.lineTo(9, 14);
    ctx.lineTo(13, 10.4);
    ctx.bezierCurveTo(16.5, 6, 15, -4, 9, -10);
    ctx.closePath();
  }

  function drawEclipseLord(ctx, t) {
    var bob = wave(t, 1300) * 1.4;
    var pulse = 0.5 + 0.5 * wave(t, 1100, 0.4);
    var claw = wave(t, 900, 0.2);
    ctx.save();
    ctx.scale(1.3, 1.3);
    shadow(ctx, 20, 14, 3.6, 0.4);
    bloom(ctx, 0, -2, 26, '#c0262d', 0.2 + 0.12 * pulse);
    ctx.save();
    ctx.translate(0, bob);
    lordMist(ctx, t);
    lordCloakPath(ctx);
    paint(ctx, '#c0262d', 2);
    ctx.save();
    lordCloakPath(ctx);
    ctx.clip();
    ctx.fillStyle = '#8e1c22';
    poly(ctx, [-18, -12, -9, -12, -7, 16, -18, 16]);
    ctx.fill();
    poly(ctx, [9, -12, 18, -12, 18, 16, 7, 16]);
    ctx.fill();
    ctx.fillStyle = '#e04a4a';
    ell(ctx, -4, -6, 3.4, 5.4, -0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3, -9);
    ctx.quadraticCurveTo(-5, 2, -4, 13);
    ctx.moveTo(3, -9);
    ctx.quadraticCurveTo(5, 2, 4, 13);
    tint(ctx, '#8e1c22', 1.4);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-9.4, -9.4);
    ctx.bezierCurveTo(-14.6, -3.6, -16.6, 6, -14.6, 12.4);
    tint(ctx, '#e04a4a', 1.2);
    ctx.beginPath();
    ctx.moveTo(-9, -9.6);
    ctx.quadraticCurveTo(0, -16.4, 9, -9.6);
    ctx.lineTo(7, 0);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    paint(ctx, '#15171f', 2);
    lordClaw(ctx, -1, claw);
    lordClaw(ctx, 1, claw);
    ctx.save();
    ctx.translate(0, -11);
    for (var i = 0; i !== 7; i++) {
      var a = -Math.PI * 0.92 + i * (Math.PI * 0.84 / 6);
      var len = 2.6 + (i % 2) * 1.5;
      var bx = Math.cos(a) * 7.4;
      var by = Math.sin(a) * 7.4;
      var tx = Math.cos(a) * (7.4 + len);
      var ty = Math.sin(a) * (7.4 + len);
      var px = Math.cos(a + Math.PI / 2) * 1.6;
      var py = Math.sin(a + Math.PI / 2) * 1.6;
      poly(ctx, [bx + px, by + py, tx, ty, bx - px, by - py]);
      paint(ctx, '#0d0f15', 1.3);
    }
    bloom(ctx, 0, 0, 17, '#ff5a3c', 0.38 + 0.24 * pulse);
    ctx.save();
    ctx.rotate(t / 3600);
    for (var j = 0; j !== 12; j++) {
      var ang = j * TAU / 12;
      var rl = 3 + (j % 3) * 1.5 + pulse * 1.2;
      poly(ctx, [Math.cos(ang - 0.1) * 6.5, Math.sin(ang - 0.1) * 6.5,
        Math.cos(ang) * (6.5 + rl), Math.sin(ang) * (6.5 + rl),
        Math.cos(ang + 0.1) * 6.5, Math.sin(ang + 0.1) * 6.5]);
      ctx.fillStyle = rgba(j % 2 ? '#ffc24a' : '#ff5a3c', 0.75);
      ctx.fill();
    }
    ctx.restore();
    circle(ctx, 0, 0, 7.1);
    ctx.fillStyle = rgba('#ffc24a', 0.85);
    ctx.fill();
    circle(ctx, 0, 0, 6.2);
    paint(ctx, '#07080c', 1.6);
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, Math.PI * 0.95, Math.PI * 1.85);
    tint(ctx, '#fff0c0', 1);
    ctx.restore();
    ctx.restore();
    ctx.restore();
  }

  /* ---------------- f ink wraith ---------------- */

  function inkBodyPath(ctx, tip, w, bot) {
    ctx.beginPath();
    ctx.moveTo(0, tip);
    ctx.bezierCurveTo(w * 0.62, tip + (bot - tip) * 0.46, w, bot - 7.4, w * 0.72, bot - 1.2);
    ctx.quadraticCurveTo(w * 0.44, bot + 3.4, 0, bot + 3.6);
    ctx.quadraticCurveTo(-w * 0.44, bot + 3.4, -w * 0.72, bot - 1.2);
    ctx.bezierCurveTo(-w, bot - 7.4, -w * 0.62, tip + (bot - tip) * 0.46, 0, tip);
    ctx.closePath();
  }

  function inkBeads(ctx, t, front) {
    for (var i = 0; i !== 3; i++) {
      var a = t / 1250 + i * TAU / 3;
      var depth = Math.sin(a);
      if ((depth > 0) !== front) continue;
      var x = Math.cos(a) * 16.5;
      var y = -3 + depth * 6.5;
      var r = 1.6 + 0.45 * depth;
      ctx.save();
      ctx.globalAlpha = 0.72 + 0.28 * depth;
      bloom(ctx, x, y, r * 3.6, '#4a6bd0', 0.32);
      circle(ctx, x, y, r);
      paint(ctx, '#141830', 1);
      circle(ctx, x - r * 0.32, y - r * 0.36, r * 0.3);
      ctx.fillStyle = 'rgba(184,208,255,0.85)';
      ctx.fill();
      ctx.restore();
    }
  }

  function inkDrips(ctx, t, bot) {
    for (var i = 0; i !== 3; i++) {
      var x = -5.4 + i * 5.4;
      var len = 3 + 2.6 * (0.5 + 0.5 * wave(t, 700, i * 2.1));
      ctx.beginPath();
      ctx.moveTo(x - 1.3, bot + 0.4);
      ctx.quadraticCurveTo(x - 0.6, bot + 0.4 + len, x, bot + 1.3 + len);
      ctx.quadraticCurveTo(x + 0.6, bot + 0.4 + len, x + 1.3, bot + 0.4);
      ctx.closePath();
      paint(ctx, '#12162a', 1.2);
      var ph = ((t / 1700) + i * 0.37) % 1;
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      ell(ctx, x, bot + 4.5 + ph * 11, 1.25, 1.65);
      paint(ctx, '#12162a', 1);
      ctx.restore();
    }
  }

  function inkMask(ctx, t) {
    ctx.beginPath();
    ctx.moveTo(-6.2, -8.2);
    ctx.quadraticCurveTo(0, -11, 6.2, -8.2);
    ctx.quadraticCurveTo(7, -1.6, 0, 3.4);
    ctx.quadraticCurveTo(-7, -1.6, -6.2, -8.2);
    ctx.closePath();
    paint(ctx, '#f2f0e9', 1.6);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#d2d1c9';
    poly(ctx, [1.6, -12, 8, -12, 8, 5, 3.2, 5]);
    ctx.fill();
    ell(ctx, 0.5, 3.4, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#fdfcf8';
    ell(ctx, -3, -7.2, 2.4, 1.9, -0.3);
    ctx.fill();
    ctx.restore();
    for (var i = 0; i !== 2; i++) {
      var s = i ? 1 : -1;
      ctx.save();
      ctx.translate(s * 3.1, -4.6);
      ctx.scale(s, 1);
      ctx.beginPath();
      ctx.moveTo(-2.5, 0.9);
      ctx.quadraticCurveTo(0, -2.4, 2.5, 0.1);
      ctx.quadraticCurveTo(0.2, -0.8, -2.5, 0.9);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(-5.3, -3.9);
    ctx.quadraticCurveTo(-5.7, -0.6, -5.2, 1.8);
    tint(ctx, 'rgba(22,26,44,0.45)', 1.1);
    ctx.beginPath();
    ctx.moveTo(-5.3, -4.2);
    ctx.quadraticCurveTo(-4.2, -2.4, -5.3, -1.5);
    ctx.quadraticCurveTo(-6.4, -2.4, -5.3, -4.2);
    ctx.closePath();
    paint(ctx, '#171c30', 0.8);
    var ph = (t / 2400) % 1;
    var ty = -1.6 + ph * 5.4;
    ctx.save();
    ctx.globalAlpha = Math.sin(ph * Math.PI);
    ctx.beginPath();
    ctx.moveTo(-5.2, ty - 1.9);
    ctx.quadraticCurveTo(-4.1, ty, -5.2, ty + 1.2);
    ctx.quadraticCurveTo(-6.3, ty, -5.2, ty - 1.9);
    ctx.closePath();
    paint(ctx, '#171c30', 0.8);
    ctx.restore();
  }

  function drawInkWraith(ctx, t) {
    var float = wave(t, 900) * 2.6;
    var morph = wave(t, 900, 1.2);
    shadow(ctx, 20, 7.4 - float * 0.45, 2.1 - float * 0.1, 0.2);
    ctx.save();
    ctx.translate(0, -1 + float);
    bloom(ctx, 0, -2, 19, '#3d5cc0', 0.13 + 0.05 * morph);
    inkBeads(ctx, t, false);
    var tip = -19.4 - morph * 1.3;
    var w = 11.2 - morph * 0.8;
    var bot = 6.2 + morph * 0.6;
    inkDrips(ctx, t, bot);
    inkBodyPath(ctx, tip, w, bot);
    paint(ctx, '#171b2c');
    ctx.save();
    inkBodyPath(ctx, tip, w, bot);
    ctx.clip();
    ctx.fillStyle = '#0c0f1a';
    ell(ctx, 1.5, bot + 1, w * 1.1, 6.5);
    ctx.fill();
    ctx.fillStyle = '#28325a';
    ell(ctx, -4.2, -5, 4.4, 8.4, -0.22);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,214,255,0.5)';
    ell(ctx, -4.6, -9.6, 1.7, 4.4, -0.3);
    ctx.fill();
    circle(ctx, -5.6, -14.4, 0.9);
    ctx.fillStyle = 'rgba(226,238,255,0.75)';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-0.4, tip + 0.8);
    ctx.bezierCurveTo(-w * 0.6, tip + (bot - tip) * 0.46, -w * 0.96, bot - 7.2, -w * 0.7, bot - 1.4);
    tint(ctx, '#4c5f9e', 1.3);
    inkMask(ctx, t);
    inkBeads(ctx, t, true);
    ctx.restore();
  }

  /* ---------------- m storm crow ---------------- */

  var BOLT_SPOTS = [-17, -11.5, 16, -12.5, 12.5, 8];

  function crowFeather(ctx, len, wid, base, tip) {
    ctx.beginPath();
    ctx.moveTo(0, -wid);
    ctx.quadraticCurveTo(len * 0.6, -wid * 0.95, len, 0);
    ctx.quadraticCurveTo(len * 0.6, wid * 0.95, 0, wid);
    ctx.closePath();
    paint(ctx, base, 1.5);
    ctx.beginPath();
    ctx.moveTo(len * 0.56, -wid * 0.66);
    ctx.quadraticCurveTo(len * 0.82, -wid * 0.46, len, 0);
    ctx.quadraticCurveTo(len * 0.82, wid * 0.46, len * 0.56, wid * 0.66);
    ctx.closePath();
    paint(ctx, tip, 0);
  }

  function crowWing(ctx, side, flap) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.translate(3.6, -4.2);
    ctx.rotate(-0.1 + flap * 0.36);
    for (var i = 0; i !== 5; i++) {
      ctx.save();
      ctx.translate(7.6, -0.4);
      ctx.rotate(-0.42 + i * 0.3);
      crowFeather(ctx, 10.4 - i * 0.7, 2.1, '#3b3f58', '#5d84d8');
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(-1.4, -2.6);
    ctx.quadraticCurveTo(4.6, -5.4, 9.6, -3.4);
    ctx.quadraticCurveTo(6.4, 1.6, 2.4, 3.6);
    ctx.quadraticCurveTo(-0.6, 2.4, -1.4, -2.6);
    ctx.closePath();
    paint(ctx, '#454a68', 1.8);
    ctx.beginPath();
    ctx.moveTo(-0.6, -2.2);
    ctx.quadraticCurveTo(4.4, -4.6, 8.8, -3);
    tint(ctx, '#6f92e0', 1.2);
    ctx.restore();
  }

  function crowBolt(ctx, x, y, s, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.scale(s, s);
    bloom(ctx, 0, 0, 9, '#ffe14a', 0.5);
    ctx.beginPath();
    ctx.moveTo(-1.8, -6);
    ctx.lineTo(1.8, -1.7);
    ctx.lineTo(-0.8, -0.6);
    ctx.lineTo(2.2, 6);
    ctx.strokeStyle = '#ffe14a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#fffbe0';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  function drawStormCrow(ctx, t) {
    var flap = wave(t, 500);
    var float = wave(t, 500, 0.7) * 2.4;
    shadow(ctx, 20, 8 - float * 0.5, 2.3 - float * 0.12, 0.2);
    ctx.save();
    ctx.translate(0, -1 + float);
    ctx.save();
    ctx.translate(1.4, 6);
    ctx.rotate(Math.PI / 2 + 0.1 + flap * 0.05);
    for (var i = 0; i !== 3; i++) {
      ctx.save();
      ctx.rotate(-0.28 + i * 0.28);
      crowFeather(ctx, 10.4 - Math.abs(i - 1) * 1.8, 1.9, '#31354c', '#4f6fbc');
      ctx.restore();
    }
    ctx.restore();
    crowWing(ctx, -1, flap);
    crowWing(ctx, 1, flap);
    for (var s = -1; s <= 1; s += 2) {
      var kx = s * 2.9;
      var ky = 7.2 + flap * 0.5;
      limb(ctx, kx, ky, kx + s * 0.7, ky + 3.2, 1.5, '#d9a52e');
      for (var j = -1; j <= 1; j++) {
        limb(ctx, kx + s * 0.7, ky + 3.4, kx + s * 0.7 + j * 1.9, ky + 5.6, 1.1, '#ffd23f');
      }
    }
    ell(ctx, 0, 0.6, 6.8, 8);
    paint(ctx, '#3b3f58', 2);
    ctx.save();
    ell(ctx, 0, 0.6, 6.8, 8);
    ctx.clip();
    ctx.fillStyle = '#282b3d';
    ell(ctx, 2.2, 6.4, 6.6, 4.6);
    ctx.fill();
    ctx.fillStyle = '#4e5474';
    ell(ctx, -1.8, 1.4, 4.2, 5.2, -0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4.4, 3.4);
    ctx.quadraticCurveTo(-1.6, 5, 1.2, 3.6);
    ctx.moveTo(-4, 6);
    ctx.quadraticCurveTo(-1.4, 7.6, 1.4, 6.2);
    tint(ctx, '#565c80', 1);
    ctx.restore();
    poly(ctx, [3.2, -12.6, 8, -16, 4.8, -10.4]);
    paint(ctx, '#31354c', 1.4);
    circle(ctx, -0.4, -8.6, 5.4);
    paint(ctx, '#3b3f58', 2);
    ctx.save();
    circle(ctx, -0.4, -8.6, 5.4);
    ctx.clip();
    ctx.fillStyle = '#282b3d';
    poly(ctx, [1.6, -15, 6, -15, 6, -2, 2.6, -2]);
    ctx.fill();
    ctx.fillStyle = '#4e5474';
    ell(ctx, -2.6, -11, 2.8, 2.2, -0.35);
    ctx.fill();
    ctx.restore();
    poly(ctx, [-4.6, -10.6, -11.8, -8.2, -4.4, -6.2]);
    paint(ctx, '#ffd23f', 1.5);
    ctx.beginPath();
    ctx.moveTo(-4.8, -8.5);
    ctx.lineTo(-11.4, -8.2);
    tint(ctx, '#c08a20', 1);
    ctx.beginPath();
    ctx.moveTo(-5.2, -10.1);
    ctx.lineTo(-9.6, -8.7);
    tint(ctx, '#fff0a8', 0.9);
    circle(ctx, -6.6, -9.3, 0.45);
    ctx.fillStyle = '#8a6410';
    ctx.fill();
    glowDot(ctx, -2.8, -9.9, 1.5, '#fff3a8', 3);
    glowDot(ctx, 2.4, -9.5, 1.35, '#fff3a8', 3);
    circle(ctx, -3.2, -10.3, 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    circle(ctx, 2.1, -9.9, 0.45);
    ctx.fill();
    for (var b = 0; b !== 3; b++) {
      var flick = Math.pow(0.5 + 0.5 * Math.sin(t / 145 + b * 2.4), 7);
      crowBolt(ctx, BOLT_SPOTS[b * 2], BOLT_SPOTS[b * 2 + 1] + wave(t, 700, b) * 1.2,
        b === 2 ? 0.8 : 1, 0.08 + 0.92 * flick);
    }
    ctx.restore();
  }

  /* ---------------- k gate warden (boss) ---------------- */

  var STEEL = '#7a808f';
  var STEEL_D = '#565c6b';
  var STEEL_L = '#9aa2b1';
  var STEEL_DD = '#3f444f';
  var STEEL_RIM = '#b6bdca';

  function wardenHammer(ctx, t) {
    ctx.save();
    ctx.translate(11.8, -3);
    ctx.rotate(0.14 + wave(t, 1250, 0.2) * 0.02);
    limb(ctx, 0, 9, 0, -13, 2.6, '#6b4a2f');
    rrect(ctx, -2, -13.6, 4, 2.4, 0.8);
    paint(ctx, STEEL_D, 1.2);
    rrect(ctx, -5, -19.6, 10, 7.8, 1.8);
    paint(ctx, STEEL, 2);
    ctx.save();
    rrect(ctx, -5, -19.6, 10, 7.8, 1.8);
    ctx.clip();
    ctx.fillStyle = STEEL_D;
    poly(ctx, [1.4, -20.5, 6, -20.5, 6, -11, 2.4, -11]);
    ctx.fill();
    ctx.fillStyle = STEEL_L;
    poly(ctx, [-6, -20.5, 1, -20.5, -0.4, -17.6, -6, -16.6]);
    ctx.fill();
    ctx.restore();
    rrect(ctx, -5.6, -18.8, 1.9, 6.2, 0.6);
    paint(ctx, STEEL_L, 1.3);
    rrect(ctx, 3.7, -18.8, 1.9, 6.2, 0.6);
    paint(ctx, STEEL_D, 1.3);
    rivet(ctx, -2.2, -15.7, STEEL_RIM);
    rivet(ctx, 2.2, -15.7, STEEL_RIM);
    ctx.restore();
  }

  function wardenPauldron(ctx, cx, tilt) {
    ell(ctx, cx, -6.6, 7.4, 5.4, tilt);
    paint(ctx, STEEL, 2);
    ctx.save();
    ell(ctx, cx, -6.6, 7.4, 5.4, tilt);
    ctx.clip();
    ctx.fillStyle = STEEL_D;
    ell(ctx, cx + 1.2, -1.6, 8, 3.6);
    ctx.fill();
    ctx.fillStyle = STEEL_L;
    ell(ctx, cx - 2.6, -9.6, 4.2, 2.1, -0.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 6.6, -5.6);
    ctx.quadraticCurveTo(cx, -3, cx + 6.6, -5.8);
    tint(ctx, '#4a4f5a', 1.3);
    ctx.restore();
    rivet(ctx, cx - 3.8, -8.4, STEEL_RIM);
    rivet(ctx, cx + 3.8, -8.2, STEEL_RIM);
  }

  function wardenChain(ctx, t) {
    ctx.save();
    ctx.translate(7.8, 7.2);
    ctx.rotate(wave(t, 880, 0.4) * 0.17);
    for (var i = 0; i !== 4; i++) {
      ell(ctx, 0, 1.8 + i * 2.5, 1.15, 1.55, i % 2 ? 0.5 : -0.5);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.9;
      ctx.stroke();
      ctx.strokeStyle = STEEL_L;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function wardenShield(ctx, t) {
    ctx.save();
    ctx.translate(-14.4, 2.5);
    ctx.rotate(-0.05 + wave(t, 1250, 0.6) * 0.015);
    rrect(ctx, -4.9, -17, 9.8, 33, 2.4);
    paint(ctx, '#6d7482', 2);
    ctx.save();
    rrect(ctx, -4.9, -17, 9.8, 33, 2.4);
    ctx.clip();
    ctx.fillStyle = STEEL_D;
    poly(ctx, [1.4, -18, 6, -18, 6, 17, 2.4, 17]);
    ctx.fill();
    ctx.fillStyle = STEEL_L;
    poly(ctx, [-6, -18, 0.8, -18, -0.6, -14, -6, -12.4]);
    ctx.fill();
    ctx.beginPath();
    for (var i = 0; i !== 4; i++) {
      var x = -3.3 + i * 2.2;
      ctx.moveTo(x, -15.4);
      ctx.lineTo(x, 14.6);
    }
    tint(ctx, STEEL_DD, 1.6);
    ctx.beginPath();
    for (var j = 0; j !== 4; j++) {
      var lx = -3.9 + j * 2.2;
      ctx.moveTo(lx, -15.4);
      ctx.lineTo(lx, 14.6);
    }
    tint(ctx, 'rgba(182,189,202,0.5)', 0.7);
    rrect(ctx, -5.4, -8.8, 10.8, 2.8, 0.7);
    paint(ctx, STEEL, 1.4);
    rrect(ctx, -5.4, 4.2, 10.8, 2.8, 0.7);
    paint(ctx, STEEL, 1.4);
    ctx.restore();
    rrect(ctx, -3.9, -16, 7.8, 31, 2);
    tint(ctx, STEEL_RIM, 1);
    rivet(ctx, -3.4, -14.6, STEEL_RIM);
    rivet(ctx, 3.4, -14.6, STEEL_RIM);
    rivet(ctx, -3.4, 13.6, STEEL_RIM);
    rivet(ctx, 3.4, 13.6, STEEL_RIM);
    rivet(ctx, 0, -7.4, STEEL_RIM);
    rivet(ctx, 0, 5.6, STEEL_RIM);
    ctx.restore();
  }

  function drawGateWarden(ctx, t) {
    var breath = wave(t, 1250) * 0.9;
    var glow = 0.5 + 0.5 * wave(t, 700, 0.2);
    ctx.save();
    ctx.scale(1.3, 1.3);
    shadow(ctx, 20, 15, 3.8, 0.4);
    wardenHammer(ctx, t);
    rrect(ctx, -7.6, 8, 6.4, 11, 1.8);
    paint(ctx, STEEL_D, 1.8);
    rrect(ctx, 1.2, 8, 6.4, 11, 1.8);
    paint(ctx, STEEL_D, 1.8);
    rrect(ctx, -8.8, 16.8, 8.4, 3.6, 1.4);
    paint(ctx, STEEL_DD, 1.6);
    rrect(ctx, 0.4, 16.8, 8.4, 3.6, 1.4);
    paint(ctx, STEEL_DD, 1.6);
    ctx.save();
    ctx.translate(0, breath);
    rrect(ctx, -10, -7.5, 20, 16, 3.4);
    paint(ctx, STEEL, 2);
    ctx.save();
    rrect(ctx, -10, -7.5, 20, 16, 3.4);
    ctx.clip();
    ctx.fillStyle = STEEL_D;
    poly(ctx, [3, -9, 11, -9, 11, 10, 4.5, 10]);
    ctx.fill();
    ctx.fillStyle = STEEL_L;
    poly(ctx, [-11, -9, 2, -9, 0, -4.4, -11, -3]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8.6, -1.6);
    ctx.quadraticCurveTo(0, 0.8, 8.6, -1.6);
    ctx.moveTo(-8.6, 2.2);
    ctx.quadraticCurveTo(0, 4.6, 8.6, 2.2);
    tint(ctx, '#4a4f5a', 1.4);
    ctx.restore();
    rivet(ctx, -7.6, -5.4, STEEL_RIM);
    rivet(ctx, 7.6, -5.4, STEEL_RIM);
    rrect(ctx, -10.4, 5, 20.8, 3.6, 1.2);
    paint(ctx, '#4a4f5a', 1.6);
    rrect(ctx, -2.6, 5.2, 5.2, 3.2, 1);
    paint(ctx, STEEL_L, 1.3);
    wardenChain(ctx, t);
    wardenPauldron(ctx, -12.2, -0.18);
    wardenPauldron(ctx, 12.2, 0.18);
    limb(ctx, -11.4, -3, -13.6, 3.4, 4.2, STEEL_D);
    circle(ctx, -14, 4.6, 2.6);
    paint(ctx, STEEL_DD, 1.5);
    limb(ctx, 11.4, -3, 13.4, 1.4, 4.2, STEEL_D);
    limb(ctx, 13.4, 1.4, 12.6, -2.4, 3.8, STEEL_D);
    circle(ctx, 12.5, -3.2, 2.5);
    paint(ctx, STEEL_DD, 1.5);
    rrect(ctx, -6, -8.4, 12, 3, 1);
    paint(ctx, STEEL_D, 1.4);
    rrect(ctx, -7.8, -20.6, 15.6, 13.6, 4.2);
    paint(ctx, STEEL, 2);
    ctx.save();
    rrect(ctx, -7.8, -20.6, 15.6, 13.6, 4.2);
    ctx.clip();
    ctx.fillStyle = STEEL_D;
    poly(ctx, [2, -22, 9, -22, 9, -6, 3.4, -6]);
    ctx.fill();
    ctx.fillStyle = STEEL_L;
    ell(ctx, -3.4, -18, 4.4, 2.4, -0.3);
    ctx.fill();
    ctx.restore();
    rrect(ctx, -5.8, -16.9, 11.6, 7.6, 1.2);
    paint(ctx, '#0d0f14', 1.4);
    ctx.save();
    rrect(ctx, -5.8, -16.9, 11.6, 7.6, 1.2);
    ctx.clip();
    bloom(ctx, 0, -13.2, 9.5, AMBER, 0.5 + 0.32 * glow);
    bloom(ctx, 0, -12.4, 4.6, '#ffd27a', 0.4 + 0.3 * glow);
    ctx.restore();
    for (var i = 0; i !== 5; i++) {
      var bx = -4.4 + i * 2.2;
      limb(ctx, bx, -16.6, bx, -9.6, 1.3, STEEL_L);
    }
    limb(ctx, -5.4, -13.1, 5.4, -13.1, 1.1, STEEL);
    ctx.beginPath();
    ctx.moveTo(-7.2, -17.8);
    ctx.quadraticCurveTo(0, -19.6, 7.2, -17.8);
    tint(ctx, STEEL_RIM, 1.3);
    rivet(ctx, -6.4, -19, STEEL_RIM);
    rivet(ctx, 6.4, -19, STEEL_RIM);
    wardenShield(ctx, t);
    ctx.restore();
    ctx.restore();
  }

  /* ---------------- l grimoire keeper (boss) ---------------- */

  var TOME_ROBE = '#6a4fb0';
  var TOME_ROBE_D = '#4a3480';
  var TOME_ROBE_L = '#8a70d0';
  var TOME_BONE = '#e2dcc6';
  var TOME_BONE_D = '#bfb79c';
  var TOME_BONE_L = '#f4efdd';
  var TOME_GOLD = '#e0b64a';
  var TOME_RUNE = '#b18cff';

  function keeperPages(ctx, t, front) {
    for (var i = 0; i !== 3; i++) {
      var a = t / 1700 + i * TAU / 3;
      var depth = Math.sin(a);
      if ((depth > 0) !== front) continue;
      var w = 3.4 + depth * 0.6;
      ctx.save();
      ctx.globalAlpha = 0.7 + 0.3 * depth;
      ctx.translate(Math.cos(a) * 17, -3 + depth * 8);
      ctx.rotate(Math.sin(a * 1.3) * 0.6);
      poly(ctx, [-w, -4.4, w, -3.6, w * 0.9, 4.4, -w * 0.95, 3.8]);
      paint(ctx, '#ece2c8', 1.1);
      ctx.beginPath();
      ctx.moveTo(-w * 0.6, -2);
      ctx.lineTo(w * 0.6, -1.6);
      ctx.moveTo(-w * 0.6, -0.2);
      ctx.lineTo(w * 0.5, 0.1);
      ctx.moveTo(-w * 0.6, 1.6);
      ctx.lineTo(w * 0.3, 1.9);
      tint(ctx, '#9a8fb4', 0.7);
      ctx.restore();
    }
  }

  function keeperSkull(ctx, t) {
    ctx.save();
    ctx.translate(0, -11 + wave(t, 1050, 0.4) * 0.4);
    ell(ctx, 0, 0, 7.2, 6.8);
    paint(ctx, TOME_BONE, 2);
    ctx.save();
    ell(ctx, 0, 0, 7.2, 6.8);
    ctx.clip();
    ctx.fillStyle = TOME_BONE_D;
    ell(ctx, 1.6, 6.2, 7.8, 4.4);
    ctx.fill();
    ctx.fillStyle = TOME_BONE_L;
    ell(ctx, -2.8, -3.6, 3.4, 2.6, -0.4);
    ctx.fill();
    ctx.restore();
    ell(ctx, -3, -0.6, 2.6, 2.8);
    paint(ctx, '#171820', 1.1);
    ell(ctx, 3, -0.6, 2.6, 2.8);
    paint(ctx, '#171820', 1.1);
    glowDot(ctx, -3, -0.4, 1.15, TOME_RUNE, 3);
    glowDot(ctx, 3, -0.4, 1.15, TOME_RUNE, 3);
    poly(ctx, [0, 1.6, -1, 3.4, 1, 3.4]);
    paint(ctx, '#171820', 0);
    rrect(ctx, -3.8, 3.9, 7.6, 2.4, 0.8);
    paint(ctx, TOME_BONE_L, 1.2);
    ctx.beginPath();
    ctx.moveTo(-1.9, 4.1);
    ctx.lineTo(-1.9, 6.1);
    ctx.moveTo(0, 4.1);
    ctx.lineTo(0, 6.1);
    ctx.moveTo(1.9, 4.1);
    ctx.lineTo(1.9, 6.1);
    tint(ctx, '#a9a189', 0.8);
    var glare = 0.35 + 0.3 * (0.5 + 0.5 * wave(t, 900, 0.2));
    for (var s = -1; s <= 1; s += 2) {
      circle(ctx, s * 3.4, -0.7, 3);
      ctx.fillStyle = 'rgba(190,225,255,0.16)';
      ctx.fill();
      ctx.strokeStyle = TOME_GOLD;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 3.4 - 1.7, 0.6);
      ctx.lineTo(s * 3.4 + 0.5, -2.4);
      ctx.moveTo(s * 3.4 - 0.4, 0.9);
      ctx.lineTo(s * 3.4 + 1.3, -1.5);
      tint(ctx, rgba('#ffffff', glare), 0.9);
      ctx.beginPath();
      ctx.moveTo(s * 6.3, -1.4);
      ctx.lineTo(s * 7.4, -2.4);
      tint(ctx, TOME_GOLD, 1);
    }
    ctx.beginPath();
    ctx.moveTo(-0.5, -1.1);
    ctx.quadraticCurveTo(0, -2, 0.5, -1.1);
    tint(ctx, TOME_GOLD, 1);
    rrect(ctx, -4.8, -8.8, 9.6, 4.2, 1.2);
    paint(ctx, '#2a2340', 1.6);
    poly(ctx, [-10, -8.8, 0, -12.4, 10, -8.8, 0, -5.2]);
    paint(ctx, '#332a4d', 1.8);
    poly(ctx, [-10, -8.8, 0, -12.4, 0, -8.8]);
    paint(ctx, '#463a66', 0);
    circle(ctx, 0, -8.8, 0.9);
    paint(ctx, TOME_GOLD, 0.8);
    ctx.save();
    ctx.translate(0, -8.8);
    ctx.rotate(wave(t, 900, 0.7) * 0.13);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(5.4, -1.4, 7.6, 0.6);
    ctx.quadraticCurveTo(8.4, 3, 8, 5);
    tint(ctx, TOME_GOLD, 1.2);
    poly(ctx, [6.9, 4.8, 9.1, 4.8, 8.6, 8.6, 7.4, 8.6]);
    paint(ctx, TOME_GOLD, 1.1);
    ctx.beginPath();
    ctx.moveTo(7.6, 5.4);
    ctx.lineTo(7.5, 8.2);
    ctx.moveTo(8.4, 5.4);
    ctx.lineTo(8.5, 8.2);
    tint(ctx, '#b8912f', 0.7);
    ctx.restore();
    ctx.restore();
  }

  function tomePage(ctx, side, lift) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.beginPath();
    ctx.moveTo(0.8, 0.2);
    ctx.quadraticCurveTo(7, -3.4 - lift, 13, -2.2 - lift * 1.4);
    ctx.lineTo(12.8, 4.4 - lift * 0.7);
    ctx.quadraticCurveTo(7, 3.2, 0.8, 6.6);
    ctx.closePath();
    paint(ctx, '#efe6d2', 1.5);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#d8cdb4';
    poly(ctx, [0, -5, 3.6, -5, 3.6, 8, 0, 8]);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    for (var i = 0; i !== 3; i++) {
      var y = 0.2 + i * 1.7;
      ctx.moveTo(4, y - 1.1);
      ctx.lineTo(11.4, y - 1.7 - lift * 0.8);
    }
    tint(ctx, '#9c90b0', 0.7);
    ctx.restore();
  }

  function keeperBook(ctx, t, rune) {
    var flutter = wave(t, 620, 0.4);
    ctx.save();
    ctx.translate(0, 6.5);
    bloom(ctx, 0, -1.5, 16, TOME_RUNE, 0.22 + 0.22 * rune);
    poly(ctx, [-14.2, -2.6, -0.6, 0.6, -0.6, 8.4, -14.2, 5.8]);
    paint(ctx, '#3b2a52', 1.8);
    poly(ctx, [14.2, -2.6, 0.6, 0.6, 0.6, 8.4, 14.2, 5.8]);
    paint(ctx, '#3b2a52', 1.8);
    ctx.beginPath();
    ctx.moveTo(-13.6, -1.8);
    ctx.lineTo(-1.4, 1.2);
    ctx.moveTo(13.6, -1.8);
    ctx.lineTo(1.4, 1.2);
    tint(ctx, TOME_GOLD, 1);
    tomePage(ctx, -1, flutter * 0.9);
    tomePage(ctx, 1, -flutter * 0.9);
    ctx.beginPath();
    ctx.moveTo(0, 0.6);
    ctx.lineTo(0, 7.2);
    tint(ctx, '#6a5a86', 1.5);
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * rune;
    bloom(ctx, -7.6, 1, 5, TOME_RUNE, 0.6);
    circle(ctx, -7.6, 1, 1.9);
    ctx.strokeStyle = TOME_RUNE;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9.5, 1);
    ctx.lineTo(-5.7, 1);
    ctx.moveTo(-7.6, -0.9);
    ctx.lineTo(-7.6, 2.9);
    ctx.stroke();
    bloom(ctx, 7.4, 0.6, 5, TOME_RUNE, 0.6);
    poly(ctx, [7.4, -1.4, 9.2, 1.8, 5.6, 1.8]);
    ctx.strokeStyle = TOME_RUNE;
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
    for (var i = 0; i !== 2; i++) {
      var ph = ((t / 2000) + i * 0.5) % 1;
      ctx.save();
      ctx.globalAlpha = 0.8 * Math.sin(ph * Math.PI);
      var gx = -4 + i * 8 + Math.sin(ph * 4 + i) * 1.4;
      var gy = -1 - ph * 11;
      bloom(ctx, gx, gy, 4, TOME_RUNE, 0.5);
      ctx.beginPath();
      ctx.moveTo(gx - 1.4, gy + 1.4);
      ctx.lineTo(gx, gy - 1.6);
      ctx.lineTo(gx + 1.4, gy + 1.4);
      ctx.moveTo(gx - 0.8, gy + 0.2);
      ctx.lineTo(gx + 0.8, gy + 0.2);
      ctx.strokeStyle = '#e6d8ff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function keeperQuill(ctx, t) {
    ctx.save();
    ctx.translate(10.4, -1.6);
    ctx.rotate(-0.24 + wave(t, 760, 0.5) * 0.09);
    ctx.beginPath();
    ctx.moveTo(3.4, -9.4);
    ctx.quadraticCurveTo(7.2, -5.6, 3.2, 0.8);
    ctx.quadraticCurveTo(1.4, -4, 3.4, -9.4);
    ctx.closePath();
    paint(ctx, '#d9cdf0', 1.2);
    ctx.beginPath();
    ctx.moveTo(3.4, -9.4);
    ctx.quadraticCurveTo(-0.2, -5.4, 1.4, -0.4);
    ctx.quadraticCurveTo(2.6, -4.6, 3.4, -9.4);
    ctx.closePath();
    paint(ctx, '#efe7fb', 1.2);
    ctx.beginPath();
    ctx.moveTo(3.4, -9);
    ctx.quadraticCurveTo(1.6, -3, -3.2, 6.2);
    tint(ctx, '#f6f2fc', 1.3);
    ctx.beginPath();
    ctx.moveTo(4.6, -6.4);
    ctx.lineTo(2.6, -5.2);
    ctx.moveTo(4.8, -4.2);
    ctx.lineTo(2.4, -3);
    ctx.moveTo(4.4, -2);
    ctx.lineTo(2, -1);
    tint(ctx, '#b9a9d8', 0.7);
    poly(ctx, [-3.4, 6.6, -2, 4.6, -3.6, 4.9]);
    paint(ctx, '#2a2438', 0.9);
    ctx.restore();
  }

  function drawGrimoireKeeper(ctx, t) {
    var float = wave(t, 1050) * 2.2;
    var hem = wave(t, 820, 0.5) * 1.7;
    var rune = 0.5 + 0.5 * wave(t, 680, 0.8);
    ctx.save();
    ctx.scale(1.3, 1.3);
    shadow(ctx, 20, 9.5 - float * 0.4, 2.6 - float * 0.12, 0.22);
    ctx.save();
    ctx.translate(0, -1 + float);
    bloom(ctx, 0, 1, 23, TOME_ROBE, 0.16 + 0.1 * rune);
    keeperPages(ctx, t, false);
    robePath(ctx, hem);
    paint(ctx, TOME_ROBE, 2);
    ctx.save();
    robePath(ctx, hem);
    ctx.clip();
    ctx.fillStyle = TOME_ROBE_D;
    poly(ctx, [2, -9, 14, -9, 14, 20, 4, 20]);
    ctx.fill();
    ctx.fillStyle = TOME_ROBE_L;
    ell(ctx, -5, 0, 3, 7.5, -0.16);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.quadraticCurveTo(-3 + hem * 0.4, 6, -2 + hem * 0.6, 16);
    ctx.moveTo(3, -6);
    ctx.quadraticCurveTo(4 + hem * 0.4, 6, 3 + hem * 0.6, 16);
    tint(ctx, TOME_ROBE_D, 1.3);
    ctx.restore();
    poly(ctx, [-6.6, -8.4, 6.6, -8.4, 4.6, -3.2, -4.6, -3.2]);
    paint(ctx, '#563d94', 1.6);
    ctx.beginPath();
    ctx.moveTo(-5.6, -7.6);
    ctx.lineTo(-4, -3.8);
    ctx.moveTo(5.6, -7.6);
    ctx.lineTo(4, -3.8);
    tint(ctx, TOME_GOLD, 1);
    limb(ctx, -5.6, -5.2, -8.4, -2.6, 4.4, TOME_ROBE);
    limb(ctx, -8.4, -2.6, -9.8, 0.2, 2.2, TOME_BONE);
    circle(ctx, -10.1, 0.8, 1.7);
    paint(ctx, TOME_BONE, 1.3);
    limb(ctx, 5.6, -5.2, 8.6, -3, 4.4, TOME_ROBE);
    limb(ctx, 8.6, -3, 10.2, -1.4, 2.2, TOME_BONE);
    circle(ctx, 10.5, -1, 1.7);
    paint(ctx, TOME_BONE, 1.3);
    keeperSkull(ctx, t);
    keeperBook(ctx, t, rune);
    keeperQuill(ctx, t);
    keeperPages(ctx, t, true);
    ctx.restore();
    ctx.restore();
  }

  /* ---------------- t clockwork titan (boss) ---------------- */

  var BRASS = '#b8893a';
  var BRASS_D = '#8a6528';
  var BRASS_L = '#d8a954';
  var BRASS_DD = '#5f4419';

  function gearShape(ctx, x, y, r, teeth, ang) {
    var step = TAU / teeth;
    var ri = r * 0.78;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(Math.cos(-step * 0.5) * ri, Math.sin(-step * 0.5) * ri);
    for (var i = 0; i !== teeth; i++) {
      var a = i * step;
      ctx.lineTo(Math.cos(a - step * 0.24) * r, Math.sin(a - step * 0.24) * r);
      ctx.lineTo(Math.cos(a + step * 0.24) * r, Math.sin(a + step * 0.24) * r);
      ctx.lineTo(Math.cos(a + step * 0.5) * ri, Math.sin(a + step * 0.5) * ri);
    }
    ctx.closePath();
    paint(ctx, BRASS, 1.8);
    circle(ctx, 0, 0, r * 0.56);
    paint(ctx, BRASS_D, 1.3);
    for (var j = 0; j !== 4; j++) {
      var sa = j * TAU / 4 + 0.4;
      circle(ctx, Math.cos(sa) * r * 0.36, Math.sin(sa) * r * 0.36, r * 0.13);
      ctx.fillStyle = 'rgba(20,22,28,0.7)';
      ctx.fill();
    }
    circle(ctx, 0, 0, r * 0.18);
    paint(ctx, BRASS_L, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, Math.PI * 1.02, Math.PI * 1.5);
    tint(ctx, rgba('#ffe6b0', 0.5), 1);
    ctx.restore();
  }

  function steamPuffs(ctx, t, x, y, seed, dir) {
    for (var i = 0; i !== 2; i++) {
      var ph = ((t / 1900) + seed + i * 0.5) % 1;
      var r = 1.3 + ph * 3;
      ctx.save();
      ctx.globalAlpha = 0.5 * Math.sin(ph * Math.PI);
      ctx.fillStyle = '#eef4fb';
      ell(ctx, x + dir * ph * 4 + Math.sin(ph * 5 + seed) * 0.8, y - ph * 9, r, r * 0.85);
      ctx.fill();
      ctx.restore();
    }
  }

  function titanArm(ctx, side, piston) {
    var ext = 7.4 + piston * 0.9;
    ctx.save();
    ctx.scale(side, 1);
    rrect(ctx, 9.8, -3.6, 5.8, 7.4, 1.6);
    paint(ctx, BRASS_D, 1.8);
    ctx.save();
    rrect(ctx, 9.8, -3.6, 5.8, 7.4, 1.6);
    ctx.clip();
    ctx.fillStyle = BRASS_L;
    poly(ctx, [10.4, -4.5, 12.6, -4.5, 12.2, 4.5, 10.4, 4.5]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9.8, -1.2);
    ctx.lineTo(15.6, -1.2);
    ctx.moveTo(9.8, 1.4);
    ctx.lineTo(15.6, 1.4);
    tint(ctx, BRASS_DD, 1.1);
    ctx.restore();
    limb(ctx, 12.7, 3.4, 12.9, ext, 2.4, '#9aa2b1');
    rrect(ctx, 9.9, ext - 0.4, 5.8, 4.8, 1.4);
    paint(ctx, BRASS, 1.8);
    ctx.beginPath();
    ctx.moveTo(11.3, ext + 0.4);
    ctx.lineTo(11.3, ext + 3.6);
    ctx.moveTo(12.8, ext + 0.4);
    ctx.lineTo(12.8, ext + 3.6);
    ctx.moveTo(14.3, ext + 0.4);
    ctx.lineTo(14.3, ext + 3.6);
    tint(ctx, BRASS_DD, 0.9);
    ctx.restore();
  }

  function titanClock(ctx, t) {
    var minute = t / 1100 - Math.PI / 2;
    var hour = t / 13200 - Math.PI / 2;
    circle(ctx, 0, -1.2, 7.6);
    paint(ctx, BRASS_D, 2);
    circle(ctx, 0, -1.2, 6.2);
    paint(ctx, '#f2e4c2', 1.2);
    ctx.save();
    circle(ctx, 0, -1.2, 6.2);
    ctx.clip();
    ctx.fillStyle = 'rgba(140,110,60,0.28)';
    ell(ctx, 2.4, 3.4, 6.4, 4.4);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    for (var i = 0; i !== 12; i++) {
      var a = i * TAU / 12;
      var r0 = i % 3 === 0 ? 4.5 : 5.1;
      ctx.moveTo(Math.cos(a) * r0, -1.2 + Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * 5.8, -1.2 + Math.sin(a) * 5.8);
    }
    tint(ctx, '#6b5a3a', 0.9);
    limb(ctx, 0, -1.2, Math.cos(hour) * 3.4, -1.2 + Math.sin(hour) * 3.4, 1.6, '#3a3226');
    limb(ctx, 0, -1.2, Math.cos(minute) * 5, -1.2 + Math.sin(minute) * 5, 1.1, '#3a3226');
    circle(ctx, 0, -1.2, 0.95);
    paint(ctx, BRASS, 1);
    ctx.beginPath();
    ctx.arc(0, -1.2, 5.4, Math.PI * 1.04, Math.PI * 1.52);
    tint(ctx, 'rgba(255,255,255,0.4)', 1.4);
    ctx.beginPath();
    ctx.arc(0, -1.2, 7.1, Math.PI * 1.05, Math.PI * 1.6);
    tint(ctx, rgba('#ffe6b0', 0.55), 1.1);
  }

  function drawClockworkTitan(ctx, t) {
    var sx = wave(t, 170) * 0.35;
    var sy = wave(t, 210, 1.2) * 0.3;
    var swing = wave(t, 760) * 0.38;
    var piston = wave(t, 900, 0.3);
    var spin = t / 1400;
    var lamp = 0.5 + 0.5 * wave(t, 820, 0.5);
    ctx.save();
    ctx.scale(1.3, 1.3);
    shadow(ctx, 20, 14, 3.6, 0.4);
    ctx.save();
    ctx.translate(sx, sy);
    rrect(ctx, -7.6, 6.6, 5.8, 7.6, 1.6);
    paint(ctx, BRASS_D, 1.8);
    rrect(ctx, 1.8, 6.6, 5.8, 7.6, 1.6);
    paint(ctx, BRASS_D, 1.8);
    limb(ctx, -4.7, 13.4, -4.7, 17, 3, '#9aa2b1');
    limb(ctx, 4.7, 13.4, 4.7, 17, 3, '#9aa2b1');
    rrect(ctx, -8.6, 16.6, 7.8, 3.6, 1.3);
    paint(ctx, BRASS_DD, 1.6);
    rrect(ctx, 0.8, 16.6, 7.8, 3.6, 1.3);
    paint(ctx, BRASS_DD, 1.6);
    rrect(ctx, -7.2, 4.2, 14.4, 4.6, 1.4);
    paint(ctx, BRASS_D, 1.8);
    ctx.save();
    ctx.translate(0, 5.4);
    ctx.rotate(swing);
    limb(ctx, 0, 0, 0, 9.4, 1.4, BRASS_D);
    circle(ctx, 0, 10.6, 2.9);
    paint(ctx, BRASS, 1.6);
    circle(ctx, -0.9, 9.7, 1);
    ctx.fillStyle = 'rgba(255,240,200,0.55)';
    ctx.fill();
    ctx.restore();
    titanArm(ctx, -1, piston);
    titanArm(ctx, 1, -piston);
    rrect(ctx, -10.5, -8.5, 21, 15, 3.2);
    paint(ctx, BRASS, 2);
    ctx.save();
    rrect(ctx, -10.5, -8.5, 21, 15, 3.2);
    ctx.clip();
    ctx.fillStyle = BRASS_D;
    poly(ctx, [4, -10, 12, -10, 12, 8, 5.5, 8]);
    ctx.fill();
    ctx.fillStyle = BRASS_L;
    poly(ctx, [-12, -10, 2, -10, 0, -5.4, -12, -4]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9.4, -7.2);
    ctx.lineTo(-9.4, 5.4);
    ctx.moveTo(9.4, -7.2);
    ctx.lineTo(9.4, 5.4);
    tint(ctx, BRASS_DD, 1.2);
    ctx.restore();
    rivet(ctx, -8.6, -6.6, '#e8c98a');
    rivet(ctx, 8.6, -6.6, '#e8c98a');
    rivet(ctx, -8.6, 4.6, '#e8c98a');
    rivet(ctx, 8.6, 4.6, '#e8c98a');
    titanClock(ctx, t);
    gearShape(ctx, -12.6, -7, 5.6, 9, -spin);
    gearShape(ctx, 12.6, -7, 5.6, 9, spin);
    rrect(ctx, -2.4, -11.8, 4.8, 3.6, 1);
    paint(ctx, BRASS_D, 1.4);
    rrect(ctx, -4.2, -22.8, 3.4, 4.2, 0.9);
    paint(ctx, BRASS_DD, 1.3);
    rrect(ctx, -4.8, -19.2, 9.6, 8.4, 2.4);
    paint(ctx, BRASS, 2);
    ctx.save();
    rrect(ctx, -4.8, -19.2, 9.6, 8.4, 2.4);
    ctx.clip();
    ctx.fillStyle = BRASS_D;
    poly(ctx, [1.6, -20, 6, -20, 6, -10, 2.6, -10]);
    ctx.fill();
    ctx.fillStyle = BRASS_L;
    ell(ctx, -2.4, -17.4, 2.6, 1.6, -0.3);
    ctx.fill();
    ctx.restore();
    bloom(ctx, 0.8, -15.2, 7, '#ffcf4a', 0.24 + 0.2 * lamp);
    circle(ctx, 0.8, -15.2, 3.1);
    paint(ctx, BRASS_D, 1.4);
    circle(ctx, 0.8, -15.2, 2.3);
    paint(ctx, '#241d12', 1);
    glowDot(ctx, 0.8, -15.2, 1.3, '#ffcf4a', 3);
    ctx.beginPath();
    ctx.arc(0.8, -15.2, 2.7, Math.PI * 1.05, Math.PI * 1.55);
    tint(ctx, 'rgba(255,255,255,0.5)', 0.9);
    ctx.beginPath();
    ctx.moveTo(-3.6, -18.2);
    ctx.quadraticCurveTo(0.4, -19.4, 4, -18);
    tint(ctx, BRASS_L, 1.1);
    ctx.beginPath();
    ctx.moveTo(-2.6, -12.6);
    ctx.lineTo(-2.6, -11.4);
    ctx.moveTo(-0.9, -12.6);
    ctx.lineTo(-0.9, -11.4);
    ctx.moveTo(0.8, -12.6);
    ctx.lineTo(0.8, -11.4);
    tint(ctx, BRASS_DD, 1);
    steamPuffs(ctx, t, -12.6, -11.6, 0.1, -1);
    steamPuffs(ctx, t, 12.6, -11.6, 0.55, 1);
    steamPuffs(ctx, t, -2.5, -23.2, 0.3, -0.4);
    ctx.restore();
    ctx.restore();
  }

  /* ---------------- w frostfire king (boss) ---------------- */

  var FROST = '#8fc7ee';
  var FROST_D = '#5f93c4';
  var FROST_L = '#c9e7fa';
  var FROST_W = '#f2fafe';
  var ROCK = '#3a1f1a';
  var ROCK_D = '#241310';
  var ROCK_L = '#5a352c';
  var EMBER = '#ff7a2e';
  var EMBER_L = '#ffc24a';

  function kingFlash(t, seed) {
    return Math.pow(0.5 + 0.5 * Math.sin(t / 210 + seed), 10);
  }

  function kingCrack(ctx, pulse, w) {
    var s = w == null ? 1 : w;
    ctx.strokeStyle = rgba(EMBER, 0.18 + 0.2 * pulse);
    ctx.lineWidth = 3.4 * s;
    ctx.stroke();
    tint(ctx, EMBER, 1.1 * s);
    ctx.strokeStyle = rgba('#ffe0b0', 0.3 + 0.45 * pulse);
    ctx.lineWidth = 0.5 * s;
    ctx.stroke();
  }

  function kingFlame(ctx, x, y, h, lean, t, seed) {
    var f = 0.5 + 0.5 * wave(t, 470, seed);
    var hh = h * (0.82 + 0.3 * f);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean + wave(t, 560, seed * 1.7) * 0.12);
    ctx.beginPath();
    ctx.moveTo(-1.7, 0.4);
    ctx.quadraticCurveTo(-2.1, -hh * 0.5, 0, -hh);
    ctx.quadraticCurveTo(2.1, -hh * 0.5, 1.7, 0.4);
    ctx.closePath();
    paint(ctx, EMBER, 1.1);
    ctx.beginPath();
    ctx.moveTo(-0.8, 0.3);
    ctx.quadraticCurveTo(-0.9, -hh * 0.4, 0, -hh * 0.62);
    ctx.quadraticCurveTo(0.9, -hh * 0.4, 0.8, 0.3);
    ctx.closePath();
    paint(ctx, '#ffd88a', 0);
    ctx.restore();
  }

  function kingSpike(ctx, x, y, h, lean, flash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean);
    poly(ctx, [-1.7, 0.4, 0, -h, 1.7, 0.4]);
    paint(ctx, FROST_L, 1.3);
    ctx.beginPath();
    ctx.moveTo(-1.1, -0.2);
    ctx.lineTo(-0.15, -h * 0.86);
    tint(ctx, '#f6fcff', 0.9);
    if (flash > 0.03) {
      bloom(ctx, 0, -h, 4.5, '#ffffff', 0.65 * flash);
      ctx.beginPath();
      ctx.moveTo(-1.2, 0);
      ctx.lineTo(0, -h);
      ctx.lineTo(1.2, 0);
      ctx.strokeStyle = rgba('#ffffff', 0.85 * flash);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function kingGround(ctx, t, pulse) {
    bloom(ctx, -10.5, 19.4, 10, '#bfe6ff', 0.16);
    ell(ctx, -10.5, 19.8, 8.8, 2.6);
    ctx.fillStyle = 'rgba(207,232,248,0.9)';
    ctx.fill();
    ell(ctx, -11, 19.5, 5.4, 1.5);
    ctx.fillStyle = '#eef8ff';
    ctx.fill();
    poly(ctx, [-16.4, 19.6, -15.5, 17.2, -14.6, 19.6]);
    paint(ctx, '#e8f6ff', 0.9);
    poly(ctx, [-6.2, 19.8, -5.5, 18, -4.8, 19.8]);
    paint(ctx, '#dceffb', 0.9);
    var sp = Math.pow(0.5 + 0.5 * Math.sin(t / 310 + 1.2), 8);
    if (sp > 0.05) {
      ctx.beginPath();
      ctx.moveTo(-13.3, 18.9);
      ctx.lineTo(-11.7, 18.9);
      ctx.moveTo(-12.5, 18.1);
      ctx.lineTo(-12.5, 19.7);
      ctx.strokeStyle = rgba('#ffffff', 0.8 * sp);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    bloom(ctx, 10, 19.4, 10, EMBER, 0.28 + 0.18 * pulse);
    ell(ctx, 10, 19.8, 7.8, 2.5);
    paint(ctx, '#7a2410', 1.2);
    ell(ctx, 10, 19.7, 5.6, 1.7);
    ctx.fillStyle = EMBER;
    ctx.fill();
    ell(ctx, 10.4, 19.6, 3 + 0.5 * pulse, 1);
    ctx.fillStyle = EMBER_L;
    ctx.fill();
    for (var i = 0; i !== 2; i++) {
      var ph = ((t / 1500) + i * 0.53) % 1;
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      circle(ctx, 7.6 + i * 4.6, 19.4 - ph * 1.6, 0.5 + ph * 0.8);
      ctx.fillStyle = '#ffd88a';
      ctx.fill();
      ctx.restore();
    }
  }

  function kingSword(ctx, t, iceG) {
    ctx.save();
    ctx.translate(-14.2, 0);
    bloom(ctx, 0, 9, 9, '#bfe6ff', 0.12 + 0.08 * iceG);
    poly(ctx, [-1.5, 2.2, 1.5, 2.2, 1, 15.8, 0, 20.6, -1, 15.8]);
    paint(ctx, FROST_L, 1.6);
    poly(ctx, [0.2, 2.4, 1.3, 2.4, 0.9, 15.6, 0.2, 19.8]);
    ctx.fillStyle = 'rgba(95,147,196,0.5)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 2.8);
    ctx.lineTo(0, 19.6);
    tint(ctx, '#ffffff', 0.8);
    var ph = (t / 2600) % 1;
    var gy = 3.4 + ph * 14.5;
    var ga = Math.sin(ph * Math.PI);
    if (ga > 0.04) {
      bloom(ctx, 0, gy, 3.4, '#ffffff', 0.4 * ga);
      ctx.beginPath();
      ctx.moveTo(-0.8, gy + 0.8);
      ctx.lineTo(0.8, gy - 0.8);
      ctx.strokeStyle = rgba('#ffffff', 0.85 * ga);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    poly(ctx, [-3.3, 0.6, 3.3, 0.6, 2.5, 2.4, -2.5, 2.4]);
    paint(ctx, FROST_D, 1.4);
    ctx.beginPath();
    ctx.moveTo(-2.8, 0.9);
    ctx.lineTo(2.8, 0.9);
    tint(ctx, FROST_L, 0.8);
    rrect(ctx, -1.1, -3.8, 2.2, 4.4, 0.8);
    paint(ctx, '#2e4d6b', 1.3);
    ctx.beginPath();
    ctx.moveTo(-1, -2.5);
    ctx.lineTo(1, -2.2);
    ctx.moveTo(-1, -1.1);
    ctx.lineTo(1, -0.8);
    tint(ctx, '#4a7099', 0.7);
    bloom(ctx, 0, -4.6, 4, '#bfe6ff', 0.25);
    circle(ctx, 0, -4.6, 1.5);
    paint(ctx, FROST_L, 1.2);
    circle(ctx, -0.4, -5, 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.restore();
  }

  function kingFireball(ctx, t, flare) {
    var r = 3 + 0.35 * wave(t, 640, 0.5);
    bloom(ctx, 0, -1, 11, EMBER, 0.3 + 0.2 * flare);
    kingFlame(ctx, -1.7, -1, 3.6, -0.1, t, 0.4);
    kingFlame(ctx, 0.3, -1.5, 4.8, 0, t, 2.1);
    kingFlame(ctx, 1.9, -0.8, 3.1, 0.12, t, 4);
    circle(ctx, 0, 0, r);
    paint(ctx, EMBER, 1.4);
    circle(ctx, 0, 0.3, r * 0.66);
    ctx.fillStyle = EMBER_L;
    ctx.fill();
    circle(ctx, -0.3, 0.4, r * 0.34);
    ctx.fillStyle = '#ffe9b0';
    ctx.fill();
    circle(ctx, -0.9, -0.4, 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
    bloom(ctx, 0, 5.4, 5, EMBER_L, 0.26);
  }

  function kingHead(ctx, iceG, fireG, pulse) {
    var head = [-6.6, -17.8, 6.6, -17.8, 7.6, -11, 4.4, -7.2, -4.4, -7.2, -7.6, -11];
    poly(ctx, head);
    paint(ctx, FROST, 2);
    ctx.save();
    poly(ctx, head);
    ctx.clip();
    ctx.fillStyle = ROCK;
    poly(ctx, [0, -19, 9, -19, 9, -6, 0, -6]);
    ctx.fill();
    ctx.fillStyle = FROST_L;
    poly(ctx, [-8, -19, -1, -19, -2.6, -12.6, -8, -11.6]);
    ctx.fill();
    ctx.fillStyle = FROST_D;
    poly(ctx, [-8, -10.6, -1, -9.6, -1, -6, -8, -6]);
    ctx.fill();
    ctx.fillStyle = ROCK_D;
    poly(ctx, [0, -10, 9, -9.4, 9, -6, 0, -6]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5.8, -17.4);
    ctx.lineTo(4.8, -15.4);
    ctx.lineTo(6.2, -13.8);
    kingCrack(ctx, pulse, 0.6);
    ctx.beginPath();
    ctx.moveTo(-5.6, -16.8);
    ctx.lineTo(-3.4, -15.2);
    tint(ctx, FROST_W, 1);
    ctx.restore();
    rrect(ctx, -4.6, -14.8, 9.2, 6, 1.3);
    paint(ctx, '#0a0c11', 1.4);
    ctx.save();
    rrect(ctx, -4.6, -14.8, 9.2, 6, 1.3);
    ctx.clip();
    bloom(ctx, -2.3, -11.8, 5, '#9fdcff', 0.2 + 0.35 * iceG);
    bloom(ctx, 2.3, -11.8, 5, EMBER, 0.2 + 0.35 * fireG);
    ctx.restore();
    poly(ctx, [-2.3, -13.4, -1, -11.8, -2.3, -10.2, -3.6, -11.8]);
    ctx.fillStyle = rgba('#aee4ff', 0.55 + 0.45 * iceG);
    ctx.fill();
    poly(ctx, [2.3, -13.4, 3.6, -11.8, 2.3, -10.2, 1, -11.8]);
    ctx.fillStyle = rgba('#ffb054', 0.55 + 0.45 * fireG);
    ctx.fill();
    circle(ctx, -2.6, -12.2, 0.45);
    ctx.fillStyle = rgba('#ffffff', 0.4 + 0.6 * iceG);
    ctx.fill();
    circle(ctx, 2, -12.2, 0.45);
    ctx.fillStyle = rgba('#fff0d0', 0.4 + 0.6 * fireG);
    ctx.fill();
  }

  function kingCrown(ctx, t, pulse, iceG) {
    var flare = 0.5 + 0.5 * wave(t, 620, 0.7);
    bloom(ctx, 3.6, -21.6, 8, EMBER, 0.22 + 0.16 * flare);
    bloom(ctx, -3.4, -21.4, 7, '#bfe6ff', 0.14 + 0.1 * iceG);
    poly(ctx, [-7, -17.6, -0.5, -17.6, -0.5, -20.2, -6.6, -20.6]);
    paint(ctx, FROST_D, 1.6);
    poly(ctx, [0.5, -17.6, 7, -17.6, 6.6, -20.6, 0.5, -20.2]);
    paint(ctx, ROCK_D, 1.6);
    poly(ctx, [-0.5, -20.2, 0.5, -20.2, 0.15, -19, 0.5, -17.6, -0.5, -17.6, -0.15, -19]);
    paint(ctx, '#0a0c11', 0);
    ctx.beginPath();
    ctx.moveTo(-6.5, -20.1);
    ctx.lineTo(-1, -19.8);
    tint(ctx, FROST_L, 0.9);
    ctx.beginPath();
    ctx.moveTo(1, -19.8);
    ctx.lineTo(6.5, -20.1);
    tint(ctx, rgba(EMBER, 0.55), 0.9);
    poly(ctx, [-3.6, -19.9, -2.9, -18.9, -3.6, -17.9, -4.3, -18.9]);
    paint(ctx, FROST_W, 0.8);
    poly(ctx, [3.6, -19.9, 4.3, -18.9, 3.6, -17.9, 2.9, -18.9]);
    paint(ctx, rgba(EMBER, 0.6 + 0.4 * pulse), 0.8);
    kingSpike(ctx, -5.3, -20.2, 3.4, -0.16, kingFlash(t, 1.8));
    kingSpike(ctx, -3.2, -20.4, 4.2, 0, kingFlash(t, 3.7));
    kingSpike(ctx, -1.4, -20.1, 2.9, 0.14, kingFlash(t, 5.5));
    kingFlame(ctx, 1.5, -20, 3.2, 0.06, t, 0.9);
    kingFlame(ctx, 3.6, -20.2, 4.2, 0, t, 2.6);
    kingFlame(ctx, 5.7, -20, 2.8, -0.08, t, 4.3);
  }

  function kingMotes(ctx, t) {
    var i, ph, x, y, r;
    for (i = 0; i !== 3; i++) {
      ph = ((t / 2400) + i * 0.37) % 1;
      x = -11.5 - i * 3.6 + Math.sin(t / 1000 + i * 2.1) * 1.6;
      y = -17 + ph * 32;
      r = 1.1 + (i % 2) * 0.5;
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      ctx.translate(x, y);
      ctx.rotate(t / 1500 + i * 1.3);
      bloom(ctx, 0, 0, r * 3, '#bfe6ff', 0.35);
      poly(ctx, [0, -r * 1.5, r * 0.7, 0, 0, r * 1.5, -r * 0.7, 0]);
      paint(ctx, '#e8f6ff', 0.8);
      ctx.restore();
    }
    for (i = 0; i !== 4; i++) {
      ph = ((t / 1700) + i * 0.29) % 1;
      if (i === 3) {
        x = 16.9 + Math.sin(t / 600 + 2) * 1.3;
        y = -10 - ph * 9;
      } else {
        x = 7 + i * 3.6 + Math.sin(t / 700 + i * 1.9) * 1.4;
        y = 17 - ph * 33;
      }
      ctx.save();
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      glowDot(ctx, x, y, 0.8 + 0.5 * (1 - ph), '#ff9a3c', 3.5);
      ctx.restore();
    }
  }

  function drawFrostfireKing(ctx, t) {
    var breath = wave(t, 1350);
    var iceG = 0.5 + 0.5 * wave(t, 950);
    var fireG = 0.5 + 0.5 * wave(t, 950, Math.PI);
    var pulse = 0.5 + 0.5 * wave(t, 1050, 0.3);
    var flare = 0.5 + 0.5 * wave(t, 620, 0.7);
    var body = [-10.4, -9, 10.4, -9, 12.2, -6.2, 9.8, 8.2, -9.8, 8.2, -12.2, -6.2];
    var pauldron = [-17, -5.2, -14.2, -10.6, -8.6, -9.6, -7.6, -4.6, -12.4, -2.6];
    ctx.save();
    ctx.scale(1.3, 1.3);
    shadow(ctx, 20, 15, 3.8, 0.4);
    kingGround(ctx, t, pulse);
    poly(ctx, [-8.2, 5, -1.8, 5, -2.4, 17, -8.8, 17]);
    paint(ctx, FROST, 1.8);
    ctx.save();
    poly(ctx, [-8.2, 5, -1.8, 5, -2.4, 17, -8.8, 17]);
    ctx.clip();
    ctx.fillStyle = FROST_D;
    poly(ctx, [-9, 10.8, -2, 10.2, -2, 17.5, -9, 17.5]);
    ctx.fill();
    ctx.fillStyle = FROST_L;
    poly(ctx, [-8.4, 4.5, -4.8, 4.5, -5.6, 12, -8.8, 12]);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-7.9, 5.6);
    ctx.lineTo(-8.5, 16.4);
    tint(ctx, FROST_W, 0.9);
    poly(ctx, [-9.8, 16.6, -1.6, 16.6, -1.2, 20.4, -10.4, 20.4]);
    paint(ctx, FROST_D, 1.8);
    ctx.beginPath();
    ctx.moveTo(-9.3, 17.1);
    ctx.lineTo(-2.1, 17.1);
    tint(ctx, FROST_L, 0.9);
    poly(ctx, [1.8, 5, 8.2, 5, 8.8, 17, 2.4, 17]);
    paint(ctx, ROCK, 1.8);
    ctx.save();
    poly(ctx, [1.8, 5, 8.2, 5, 8.8, 17, 2.4, 17]);
    ctx.clip();
    ctx.fillStyle = ROCK_D;
    poly(ctx, [2, 10.6, 9, 10.2, 9, 17.5, 2, 17.5]);
    ctx.fill();
    ctx.fillStyle = ROCK_L;
    ell(ctx, 4.4, 7.4, 2.2, 2, -0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5.2, 5.4);
    ctx.lineTo(4.2, 9.8);
    ctx.lineTo(6.2, 13.2);
    ctx.lineTo(5.2, 16.6);
    ctx.moveTo(4.2, 9.8);
    ctx.lineTo(7.2, 10.8);
    kingCrack(ctx, pulse, 0.7);
    ctx.restore();
    poly(ctx, [1.6, 16.6, 9.8, 16.6, 10.4, 20.4, 1.2, 20.4]);
    paint(ctx, ROCK_D, 1.8);
    ctx.beginPath();
    ctx.moveTo(3.2, 17.2);
    ctx.lineTo(5, 19.9);
    kingCrack(ctx, pulse, 0.6);
    ctx.beginPath();
    ctx.moveTo(2, 17);
    ctx.lineTo(9.4, 17);
    tint(ctx, rgba(EMBER, 0.4), 0.8);
    kingSword(ctx, t, iceG);
    ctx.save();
    ctx.translate(0, breath);
    bloom(ctx, -9, -3, 17, FROST, 0.1 + 0.07 * iceG);
    bloom(ctx, 10, -2, 19, EMBER, 0.12 + 0.1 * flare);
    poly(ctx, body);
    paint(ctx, FROST, 2);
    ctx.save();
    poly(ctx, body);
    ctx.clip();
    ctx.fillStyle = ROCK;
    poly(ctx, [0, -10, 13, -10, 13, 9.5, 0, 9.5]);
    ctx.fill();
    ctx.fillStyle = ROCK_D;
    poly(ctx, [0, 3.2, 13, 1.6, 13, 9.5, 0, 9.5]);
    ctx.fill();
    ctx.fillStyle = ROCK_L;
    ell(ctx, 6.6, -6, 3.4, 2.2, -0.2);
    ctx.fill();
    ctx.fillStyle = FROST_D;
    poly(ctx, [-13, 2.2, -0.5, 3.4, -0.5, 9.5, -13, 9.5]);
    ctx.fill();
    ctx.fillStyle = FROST_L;
    poly(ctx, [-13, -10, -2, -10, -4.2, -3, -13, -1.6]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9.6, -6.4);
    ctx.lineTo(-4.6, -3.4);
    ctx.lineTo(-8.6, 1.6);
    ctx.moveTo(-4.6, -3.4);
    ctx.lineTo(-2.2, 2.6);
    tint(ctx, FROST_D, 1.1);
    ctx.beginPath();
    ctx.moveTo(-8.9, -7.1);
    ctx.lineTo(-5.3, -4.9);
    tint(ctx, FROST_W, 1.2);
    ctx.beginPath();
    ctx.moveTo(8.6, -8.6);
    ctx.lineTo(6.4, -4.6);
    ctx.lineTo(8.8, -0.6);
    ctx.lineTo(6.6, 4);
    ctx.lineTo(8.2, 7.8);
    ctx.moveTo(6.4, -4.6);
    ctx.lineTo(3.2, -2.8);
    ctx.lineTo(4.2, 0.6);
    ctx.moveTo(8.8, -0.6);
    ctx.lineTo(11.4, 1.2);
    ctx.moveTo(3.2, -2.8);
    ctx.lineTo(1.4, -4.4);
    kingCrack(ctx, pulse, 1);
    bloom(ctx, 6.4, -4.6, 4.5, EMBER, 0.12 + 0.22 * pulse);
    bloom(ctx, 8.8, -0.6, 4, EMBER, 0.1 + 0.2 * pulse);
    ctx.beginPath();
    ctx.moveTo(0, -9.4);
    ctx.lineTo(0, 8.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.9, -8.8);
    ctx.lineTo(-0.9, 8);
    tint(ctx, 'rgba(238,248,255,0.45)', 0.8);
    ctx.beginPath();
    ctx.moveTo(0.9, -8.8);
    ctx.lineTo(0.9, 8);
    tint(ctx, rgba(EMBER, 0.25 + 0.3 * pulse), 0.8);
    ctx.restore();
    rrect(ctx, -10.1, 5.6, 10.1, 3, 0.8);
    paint(ctx, FROST_D, 1.4);
    rrect(ctx, 0, 5.6, 10.1, 3, 0.8);
    paint(ctx, ROCK_D, 1.4);
    bloom(ctx, 0.6, 7.1, 4.5, EMBER, 0.2 + 0.25 * pulse);
    poly(ctx, [0, 4.9, -2.1, 7.1, 0, 9.3]);
    paint(ctx, FROST_W, 1.2);
    poly(ctx, [0, 4.9, 2.1, 7.1, 0, 9.3]);
    paint(ctx, rgba(EMBER, 0.75 + 0.25 * pulse), 1.2);
    limb(ctx, -11.6, -4.2, -14, -1.8, 4.2, FROST_D);
    circle(ctx, -14.2, -1.5, 2.4);
    paint(ctx, FROST, 1.6);
    ctx.beginPath();
    ctx.moveTo(-15.6, -1.9);
    ctx.lineTo(-13, -1.2);
    tint(ctx, FROST_D, 0.8);
    circle(ctx, -14.9, -2.3, 0.6);
    ctx.fillStyle = FROST_W;
    ctx.fill();
    limb(ctx, 11.6, -4.2, 15.4, 0.4, 4.2, ROCK_D);
    limb(ctx, 15.4, 0.4, 16.6, -3.6, 3.6, ROCK_D);
    ctx.beginPath();
    ctx.moveTo(12.6, -3);
    ctx.lineTo(14.6, -0.4);
    tint(ctx, rgba(EMBER, 0.35 + 0.3 * pulse), 0.8);
    ell(ctx, 16.7, -4.2, 2.4, 1.7, -0.2);
    paint(ctx, ROCK, 1.5);
    ctx.beginPath();
    ctx.ellipse(16.7, -4.5, 2.1, 1.2, -0.2, Math.PI * 1.05, Math.PI * 1.95);
    tint(ctx, rgba(EMBER, 0.5 + 0.3 * flare), 0.9);
    poly(ctx, pauldron);
    paint(ctx, FROST, 1.8);
    ctx.save();
    poly(ctx, pauldron);
    ctx.clip();
    ctx.fillStyle = FROST_L;
    poly(ctx, [-17.5, -6, -14.2, -11, -9, -10, -10.6, -6.4]);
    ctx.fill();
    ctx.fillStyle = FROST_D;
    poly(ctx, [-17.5, -4.6, -7, -4.2, -12.4, -2, -17.5, -3]);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-16.3, -5.5);
    ctx.lineTo(-14, -10);
    tint(ctx, FROST_W, 1.1);
    kingSpike(ctx, -13.8, -10.1, 6.4, -0.26, kingFlash(t, 0.7));
    kingSpike(ctx, -11.6, -10.3, 8, -0.04, kingFlash(t, 2.9));
    kingSpike(ctx, -9, -9.5, 5.2, 0.16, kingFlash(t, 4.6));
    ell(ctx, 12.3, -6.6, 5.7, 4.5, 0.16);
    paint(ctx, ROCK, 1.8);
    ctx.save();
    ell(ctx, 12.3, -6.6, 5.7, 4.5, 0.16);
    ctx.clip();
    ctx.fillStyle = ROCK_D;
    ell(ctx, 13.2, -3.4, 6, 3.2);
    ctx.fill();
    ctx.fillStyle = ROCK_L;
    ell(ctx, 10.6, -9, 2.8, 1.6, -0.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9.6, -7.8);
    ctx.lineTo(12, -5.8);
    ctx.lineTo(11, -3.4);
    kingCrack(ctx, pulse, 0.7);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(8.2, -9.4);
    ctx.quadraticCurveTo(12.4, -11.4, 16.4, -9);
    tint(ctx, rgba('#ff9a4e', 0.45 + 0.25 * flare), 1.1);
    bloom(ctx, 12.4, -11, 8, EMBER, 0.2 + 0.16 * flare);
    kingFlame(ctx, 9.9, -9.7, 4.6, -0.1, t, 1.2);
    kingFlame(ctx, 12.6, -10.5, 6, 0, t, 3);
    kingFlame(ctx, 15.1, -9.2, 4, 0.12, t, 5.1);
    ctx.save();
    ctx.translate(16.9, -9 + wave(t, 640) * 1.1);
    kingFireball(ctx, t, flare);
    ctx.restore();
    kingHead(ctx, iceG, fireG, pulse);
    kingCrown(ctx, t, pulse, iceG);
    ctx.restore();
    kingMotes(ctx, t);
    ctx.restore();
  }

  /* ---------------- dispatch ---------------- */

  var ARTISTS = {
    hero: drawHero,
    '1': drawMossBlob,
    '2': drawAshBat,
    '3': drawBoneSoldier,
    '4': drawRustGuard,
    '5': drawHexLantern,
    '6': drawShadowWolf,
    '7': drawStoneGuard,
    '8': drawDuskKnight,
    '9': drawEclipsePriest,
    '0': drawEclipseLord,
    c: drawEmberMoss,
    d: drawSnowBat,
    e: drawBoneWarden,
    f: drawInkWraith,
    g: drawBronzeGuard,
    i: drawAzureLantern,
    k: drawGateWarden,
    l: drawGrimoireKeeper,
    m: drawStormCrow,
    n: drawFrostWolf,
    o: drawMagmaGuard,
    p: drawPaleKnight,
    q: drawBloodPriest,
    t: drawClockworkTitan,
    u: drawEclipseGuard,
    v: drawEclipseApostle,
    w: drawFrostfireKing,
    a: drawInkGuard,
    j: drawBrassMoss,
    s: drawClockGuard,
    x: drawBrassBone,
    z: drawClockWolf,
    C: drawPendulumGuard,
    E: drawFrostMoss,
    F: drawEmberBat,
    G: drawIceGuard,
    I: drawMagmaLantern,
    J: drawShadowMoss,
    K: drawShadowBat,
    L: drawShadowBone
  };

  function has(id) {
    return Object.prototype.hasOwnProperty.call(ARTISTS, id);
  }

  function draw(ctx, id, cx, cy, size, t, opts) {
    if (!has(id)) return;
    var time = typeof t === 'number' && isFinite(t) ? t : 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size / 48, size / 48);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ARTISTS[id](ctx, time, id === 'hero' ? (opts || {}) : null);
    ctx.restore();
  }

  window.Sprites = { has: has, draw: draw };
})();