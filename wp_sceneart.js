/* wp_sceneart.js — sprite-based scene (ground, container, tower) for the live wallpaper.
   Uses window.SPRITE_SRC / window.SPRITE_META (base64 atlas). Exposes window.SceneArt with
   drawField / drawContainer / drawTower and a shared towerRect() helper used by Actors. */
(function () {
  "use strict";
  var SRC = window.SPRITE_SRC || {};
  var META = window.SPRITE_META || {};
  var IMG = {};
  function load(name) { if (!SRC[name]) return null; var i = new Image(); i.src = SRC[name]; IMG[name] = i; return i; }
  load("tower"); load("container");

  function ready(name) { var i = IMG[name]; return i && i.complete && i.naturalWidth > 0; }

  // soft ground shadow ellipse
  function shadow(c, cx, baseY, w, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = "rgba(15,20,15,1)";
    c.beginPath();
    c.ellipse(cx, baseY, w * 0.5, Math.max(4, w * 0.10), 0, 0, 6.28);
    c.fill();
    c.restore();
  }

  // tower on-screen rect (shared with actors so the climber aligns to the mast)
  function towerRect(L) {
    var m = META.tower || { w: 672, h: 1000 };
    var h = L.towerH;
    var w = h * (m.w / m.h);
    var baseY = L.groundY;
    return { x: L.towerBaseX - w / 2, y: baseY - h, w: w, h: h, axisX: L.towerBaseX, topY: baseY - h, baseY: baseY };
  }

  var SceneArt = {
    towerRect: towerRect,

    drawField: function (c, L, ENV, t) {
      var amb = (ENV.palette && ENV.palette.ambient != null) ? ENV.palette.ambient : 0.6;
      var gy = L.groundY, H = L.H, W = L.W;
      // grass / ground gradient (darkened by ambient)
      var g = c.createLinearGradient(0, gy, 0, H);
      var k = 0.55 + amb * 0.45;
      function shade(r, gr, b) { return "rgb(" + Math.round(r * k) + "," + Math.round(gr * k) + "," + Math.round(b * k) + ")"; }
      g.addColorStop(0, shade(96, 120, 74));
      g.addColorStop(0.5, shade(74, 96, 58));
      g.addColorStop(1, shade(52, 70, 44));
      c.fillStyle = g; c.fillRect(0, gy, W, H - gy);

      // distant treeline / hills at the horizon for depth (behind the compound)
      c.save();
      var hy = gy;
      c.fillStyle = "rgba(" + Math.round(58 * k) + "," + Math.round(78 * k) + "," + Math.round(56 * k) + ",0.95)";
      c.beginPath(); c.moveTo(0, hy);
      for (var hx = 0; hx <= W; hx += W / 26) {
        var tt = Math.sin(hx * 0.013) * 0.5 + Math.sin(hx * 0.041 + 1.7) * 0.5;
        c.lineTo(hx, hy - (8 + (tt + 1) * 0.5 * H * 0.045));
      }
      c.lineTo(W, hy); c.closePath(); c.fill();
      // a few darker conifer silhouettes
      c.fillStyle = "rgba(" + Math.round(40 * k) + "," + Math.round(60 * k) + "," + Math.round(42 * k) + ",0.95)";
      for (var ti = 0; ti < 9; ti++) {
        var tx = (ti + 0.5) * W / 9 + Math.sin(ti * 2.3) * 30;
        var th = H * (0.035 + (Math.sin(ti * 1.7) * 0.5 + 0.5) * 0.03);
        c.beginPath(); c.moveTo(tx, hy); c.lineTo(tx - th * 0.32, hy); c.lineTo(tx, hy - th); c.lineTo(tx + th * 0.32, hy); c.closePath(); c.fill();
      }
      c.restore();

      // gravel compound pad under tower + container
      var padX = Math.min(L.containerX - W * 0.02, towerRect(L).x - W * 0.02);
      var padR = towerRect(L).x + towerRect(L).w + W * 0.03;
      var padY = gy + (H - gy) * 0.02;
      c.save();
      c.fillStyle = "rgba(" + Math.round(150 * k) + "," + Math.round(146 * k) + "," + Math.round(138 * k) + ",0.9)";
      c.beginPath();
      c.moveTo(padX, padY);
      c.lineTo(padR, padY);
      c.lineTo(padR + 40, gy + (H - gy) * 0.34);
      c.lineTo(padX - 40, gy + (H - gy) * 0.34);
      c.closePath(); c.fill();
      c.restore();
    },

    drawContainer: function (c, L, ENV, t, doorOpen) {
      var m = META.container || { w: 820, h: 556 };
      var w = L.containerW * 1.25;
      var h = w * (m.h / m.w);
      var x = L.containerX;
      var baseY = L.groundY + 2;
      var y = baseY - h;
      shadow(c, x + w / 2, baseY, w * 0.92, 0.28);
      if (ready("container")) {
        c.drawImage(IMG.container, x, y, w, h);
      } else {
        c.fillStyle = "#8c9298"; c.fillRect(x, y, w, h);
      }
      // lit window at night
      if (!ENV.isDay) {
        c.save();
        c.globalAlpha = 0.7 + 0.2 * Math.sin(t * 1.3);
        c.fillStyle = "rgba(255,214,120,0.9)";
        c.fillRect(x + w * 0.16, y + h * 0.30, w * 0.12, h * 0.18);
        c.restore();
      }
    },

    drawTower: function (c, L, ENV, t) {
      var r = towerRect(L);
      shadow(c, r.axisX, r.baseY, r.w * 0.85, 0.22);
      if (ready("tower")) {
        c.drawImage(IMG.tower, r.x, r.y, r.w, r.h);
      } else {
        c.strokeStyle = "#8a8f96"; c.lineWidth = 3;
        c.beginPath(); c.moveTo(r.axisX - r.w / 2, r.baseY); c.lineTo(r.axisX, r.topY); c.lineTo(r.axisX + r.w / 2, r.baseY); c.stroke();
      }
      // pulsing aviation beacon near the very top
      var bx = r.axisX, by = r.topY + r.h * 0.045;
      var pulse = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.2), 2);
      c.save();
      var gr = c.createRadialGradient(bx, by, 0, bx, by, r.w * 0.18);
      gr.addColorStop(0, "rgba(255,60,40," + (0.85 * pulse) + ")");
      gr.addColorStop(1, "rgba(255,60,40,0)");
      c.fillStyle = gr;
      c.beginPath(); c.arc(bx, by, r.w * 0.18, 0, 6.28); c.fill();
      c.fillStyle = "rgba(255,90,70," + (0.6 + 0.4 * pulse) + ")";
      c.beginPath(); c.arc(bx, by, Math.max(2, r.w * 0.022), 0, 6.28); c.fill();
      c.restore();
    }
  };

  window.SceneArt = SceneArt;
})();
