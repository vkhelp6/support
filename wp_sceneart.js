/* wp_sceneart.js — window.SceneArt: field, 70m lattice tower, equipment container. */
(function () {
  "use strict";
  function amb(ENV) { return ENV.palette ? ENV.palette.ambient : 1; }
  function shade(c, k) { k = Math.max(0.18, Math.min(1, k)); return "rgb(" + Math.round(c[0] * k) + "," + Math.round(c[1] * k) + "," + Math.round(c[2] * k) + ")"; }
  function isSnow(ENV) { var w = ENV.weatherCode; return (w >= 71 && w <= 77) || w === 85 || w === 86; }

  function drawField(ctx, L, ENV, t) {
    var k = amb(ENV);
    var snow = isSnow(ENV) || ENV.temp < 1;
    // distant treeline along the horizon
    ctx.fillStyle = shade(snow ? [120, 130, 120] : [44, 70, 48], k * 0.85);
    ctx.beginPath(); ctx.moveTo(0, L.groundY);
    var step = Math.max(18, L.W / 60);
    for (var x = 0; x <= L.W; x += step) {
      var h = (Math.sin(x * 0.05) * 0.5 + 0.5) * 14 * L.scale + 10 * L.scale;
      ctx.lineTo(x, L.groundY - h);
    }
    ctx.lineTo(L.W, L.groundY); ctx.closePath(); ctx.fill();
    // ground
    var g = ctx.createLinearGradient(0, L.groundY, 0, L.H);
    var top = snow ? [225, 230, 235] : [88, 104, 60];
    var bot = snow ? [200, 206, 214] : [60, 72, 40];
    g.addColorStop(0, shade(top, k)); g.addColorStop(1, shade(bot, k));
    ctx.fillStyle = g; ctx.fillRect(0, L.groundY, L.W, L.H - L.groundY);
    // dirt road sweeping toward the parking spot
    ctx.strokeStyle = shade(snow ? [170, 170, 175] : [96, 80, 58], k);
    ctx.lineWidth = Math.max(16, L.H * 0.05); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-20, L.H - 6); ctx.quadraticCurveTo(L.W * 0.12, L.roadY, L.parkX + 30, L.roadY - 4); ctx.stroke();
    ctx.lineWidth = 2;
    // grass tufts / texture
    if (!snow) { ctx.strokeStyle = shade([70, 92, 48], k); for (var i = 0; i < 80; i++) { var gx = (i * 97.3) % L.W; var gy = L.groundY + ((i * 53.7) % (L.H - L.groundY)); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + 2, gy - 5 - (i % 3)); ctx.stroke(); } }
  }

  function drawTower(ctx, L, ENV, t) {
    var k = amb(ENV);
    var bx = L.towerBaseX, by = L.groundY, ty = L.towerTopY;
    var bh = L.towerBaseW / 2, th = L.towerTopW / 2;
    var sway = (ENV.windKmh || 0) * 0.06 * L.scale;
    function off(f) { return Math.sin(t * 0.7 + f * 1.2) * sway * f * f; } // f=0..1 height fraction
    function lx(f) { return bx - (bh + (th - bh) * f) + off(f); }
    function rx(f) { return bx + (bh + (th - bh) * f) + off(f); }
    function yy(f) { return by + (ty - by) * f; }
    var col = shade([150, 156, 164], k);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, 3.5 * L.scale); ctx.lineJoin = "round";
    var N = 16;
    // legs
    ctx.beginPath(); ctx.moveTo(lx(0), yy(0)); for (var i = 1; i <= N; i++) ctx.lineTo(lx(i / N), yy(i / N)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx(0), yy(0)); for (var j = 1; j <= N; j++) ctx.lineTo(rx(j / N), yy(j / N)); ctx.stroke();
    // bracing (zigzag + horizontals)
    ctx.lineWidth = Math.max(1, 1.8 * L.scale);
    for (var s = 0; s < N; s++) {
      var f0 = s / N, f1 = (s + 1) / N;
      ctx.beginPath(); ctx.moveTo(lx(f0), yy(f0)); ctx.lineTo(rx(f1), yy(f1)); ctx.moveTo(rx(f0), yy(f0)); ctx.lineTo(lx(f1), yy(f1)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx(f0), yy(f0)); ctx.lineTo(rx(f0), yy(f0)); ctx.stroke();
    }
    // platforms
    ctx.strokeStyle = shade([120, 126, 134], k); ctx.lineWidth = Math.max(2, 2.5 * L.scale);
    [0.55, 0.85].forEach(function (f) { ctx.beginPath(); ctx.moveTo(lx(f) - 4, yy(f)); ctx.lineTo(rx(f) + 4, yy(f)); ctx.stroke(); });
    // antennas (3 sector) + microwave dish near top
    var aF = 0.9, ay = yy(aF), aw = Math.max(7, 9 * L.scale), ah = Math.max(26, 34 * L.scale);
    ctx.fillStyle = shade([235, 238, 242], k);
    var axc = bx + off(aF);
    [-1, 0, 1].forEach(function (d) { var ax = axc + d * (th + 14 * L.scale) * 1.4; ctx.fillRect(ax - aw / 2, ay - ah, aw, ah); });
    // dish
    ctx.fillStyle = shade([225, 228, 232], k); ctx.beginPath(); ctx.ellipse(axc + (th + 26 * L.scale), yy(0.78), 16 * L.scale, 20 * L.scale, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = shade([120, 124, 130], k); ctx.stroke();
    // aviation light (blinks; brighter at night)
    var blink = (Math.sin(t * 3.0) > 0.2) ? 1 : 0.15;
    var glow = blink * (ENV.isDay ? 0.5 : 1);
    var tx = bx + off(1), tyT = yy(1);
    var rg = ctx.createRadialGradient(tx, tyT - ah - 6, 1, tx, tyT - ah - 6, 16 * L.scale);
    rg.addColorStop(0, "rgba(255,40,30," + glow + ")"); rg.addColorStop(1, "rgba(255,40,30,0)");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(tx, tyT - ah - 6, 16 * L.scale, 0, 6.28); ctx.fill();
    ctx.fillStyle = "rgba(255,60,50," + Math.max(0.4, glow) + ")"; ctx.beginPath(); ctx.arc(tx, tyT - ah - 6, Math.max(2.5, 3.5 * L.scale), 0, 6.28); ctx.fill();
  }

  function drawContainer(ctx, L, ENV, t, doorOpen) {
    var k = amb(ENV);
    var x = L.containerX, y = L.containerY, w = L.containerW, h = L.containerH;
    // body
    ctx.fillStyle = shade([170, 176, 182], k); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shade([150, 156, 162], k); ctx.fillRect(x, y, w, Math.max(6, h * 0.12)); // roof shade
    // corrugation ribs
    ctx.strokeStyle = shade([135, 140, 147], k); ctx.lineWidth = 1.5;
    for (var rx = x + 8; rx < x + w - 4; rx += Math.max(8, w * 0.06)) { ctx.beginPath(); ctx.moveTo(rx, y + 4); ctx.lineTo(rx, y + h); ctx.stroke(); }
    // small window
    ctx.fillStyle = doorOpen || !ENV.isDay ? shade([255, 220, 140], Math.max(k, 0.7)) : shade([90, 110, 130], k);
    ctx.fillRect(x + w * 0.12, y + h * 0.28, w * 0.16, h * 0.22);
    // door on the side facing doorX (right)
    var dw = w * 0.22, dh = h * 0.72, dx = x + w - dw - 6, dy = y + h - dh;
    if (doorOpen) {
      // interior glow
      ctx.fillStyle = shade([255, 210, 130], Math.max(k, 0.8)); ctx.fillRect(dx, dy, dw, dh);
      // open door panel angled out
      ctx.fillStyle = shade([120, 126, 132], k);
      ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx - dw * 0.8, dy + dh * 0.08); ctx.lineTo(dx - dw * 0.8, dy + dh * 0.92); ctx.lineTo(dx, dy + dh); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = shade([110, 116, 124], k); ctx.fillRect(dx, dy, dw, dh);
      ctx.fillStyle = shade([80, 84, 90], k); ctx.fillRect(dx + dw * 0.7, dy + dh * 0.45, dw * 0.12, dh * 0.08);
    }
    ctx.strokeStyle = shade([90, 94, 100], k); ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  }

  window.SceneArt = { drawField: drawField, drawTower: drawTower, drawContainer: drawContainer };
})();
