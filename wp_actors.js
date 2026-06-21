/* wp_actors.js — sprite-based actors (Mitsubishi L200 + two field engineers).
   Engineer A climbs the mast (smooth up / work / down loop); engineer B inspects on the ground.
   Uses window.SPRITE_SRC/META and window.SceneArt.towerRect for mast alignment. */
(function () {
  "use strict";
  var SRC = window.SPRITE_SRC || {};
  var META = window.SPRITE_META || {};
  var IMG = {};
  function load(name) { if (!SRC[name]) return null; var i = new Image(); i.src = SRC[name]; IMG[name] = i; return i; }
  load("truck"); load("eng_stand"); load("eng_climb");
  function ready(n) { var i = IMG[n]; return i && i.complete && i.naturalWidth > 0; }

  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  // draw a sprite centered on cx, sitting on baseY, scaled to height h (aspect preserved)
  function blit(c, name, cx, baseY, h, flip, rot) {
    var m = META[name]; if (!m) return;
    var w = h * (m.w / m.h);
    c.save();
    c.translate(cx, baseY);
    if (rot) c.rotate(rot);
    if (flip) c.scale(-1, 1);
    if (ready(name)) c.drawImage(IMG[name], -w / 2, -h, w, h);
    else { c.fillStyle = "#c8412f"; c.fillRect(-w / 2, -h, w, h); }
    c.restore();
  }

  function shadow(c, cx, baseY, w, a) {
    c.save(); c.globalAlpha = a; c.fillStyle = "rgba(15,20,15,1)";
    c.beginPath(); c.ellipse(cx, baseY, w * 0.5, Math.max(3, w * 0.14), 0, 0, 6.28); c.fill(); c.restore();
  }

  // ---- state ----
  var CYCLE = { up: 22, work: 8, down: 16, rest: 6 };
  var TOTAL = CYCLE.up + CYCLE.work + CYCLE.down + CYCLE.rest;
  var st = { climbP: 0, climbing: false, working: false, t: 0 };

  var Actors = {
    update: function (dt, t, L, ENV) {
      st.t = t;
      var ph = t % TOTAL;
      if (ph < CYCLE.up) { st.climbP = smooth(ph / CYCLE.up); st.climbing = true; st.working = false; }
      else if (ph < CYCLE.up + CYCLE.work) { st.climbP = 1; st.climbing = false; st.working = true; }
      else if (ph < CYCLE.up + CYCLE.work + CYCLE.down) { st.climbP = 1 - smooth((ph - CYCLE.up - CYCLE.work) / CYCLE.down); st.climbing = true; st.working = false; }
      else { st.climbP = 0; st.climbing = false; st.working = false; }
    },

    getDoorOpen: function () { return false; },

    draw: function (c, L, ENV, t) {
      var H = L.H, W = L.W;

      // --- Mitsubishi L200, parked in the foreground ---
      var truckH = Math.max(70, H * 0.135);
      var truckCx = L.parkX;
      var truckBaseY = L.groundY + (H - L.groundY) * 0.42;
      var tm = META.truck || { w: 880, h: 596 };
      var truckW = truckH * (tm.w / tm.h);
      shadow(c, truckCx, truckBaseY, truckW * 0.92, 0.30);
      blit(c, "truck", truckCx, truckBaseY, truckH, false, 0);
      // headlights glow at night (truck faces right -> lights on right side)
      if (!ENV.isDay) {
        c.save();
        var hx = truckCx + truckW * 0.46, hy = truckBaseY - truckH * 0.42;
        var gr = c.createRadialGradient(hx, hy, 0, hx, hy, truckW * 0.9);
        gr.addColorStop(0, "rgba(255,244,200,0.45)");
        gr.addColorStop(1, "rgba(255,244,200,0)");
        c.fillStyle = gr; c.beginPath();
        c.moveTo(hx, hy); c.lineTo(hx + truckW * 0.95, hy - truckH * 0.25);
        c.lineTo(hx + truckW * 0.95, hy + truckH * 0.35); c.closePath(); c.fill();
        c.restore();
      }

      // --- Engineer A: climbing the mast ---
      var r = (window.SceneArt && window.SceneArt.towerRect) ? window.SceneArt.towerRect(L) : null;
      if (r) {
        var engH = Math.max(34, H * 0.07);
        var bottomY = r.baseY - 4;
        var topY = r.topY + r.h * 0.16;
        var ey = bottomY + (topY - bottomY) * st.climbP;
        var ex = r.axisX + r.w * 0.02;
        if (st.climbing) {
          // hand-over-hand bob + slight sway
          var bob = Math.sin(t * 6.5) * engH * 0.04;
          var sway = Math.sin(t * 3.2) * engH * 0.05;
          shadowOnMast(c, ex, ey);
          blit(c, "eng_climb", ex + sway, ey + bob, engH, false, Math.sin(t * 3.2) * 0.03);
        } else if (st.working) {
          var wob = Math.sin(t * 2.5) * engH * 0.03;
          blit(c, "eng_stand", ex, ey + wob, engH, false, 0);
          // tool spark while working
          c.save();
          c.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 9));
          c.fillStyle = "rgba(255,230,160,0.9)";
          c.beginPath(); c.arc(ex + engH * 0.18, ey - engH * 0.55, engH * 0.05, 0, 6.28); c.fill();
          c.restore();
        } else {
          // resting at base, looking up
          blit(c, "eng_stand", ex, bottomY, engH, false, 0);
        }
      }

      // --- Engineer B: inspecting on the ground between the truck and the compound ---
      var bH = Math.max(44, H * 0.095);
      var bx = W * 0.31;
      var by = L.groundY + 2;
      var idleBob = Math.sin(t * 1.6) * bH * 0.02;
      var faceLeft = false; // faces the tower/compound to the right
      shadow(c, bx, by, bH * 0.5, 0.28);
      blit(c, "eng_stand", bx, by + idleBob, bH, faceLeft, 0);
    }
  };

  function shadowOnMast(c, x, y) {
    c.save(); c.globalAlpha = 0.18; c.fillStyle = "rgba(0,0,0,1)";
    c.beginPath(); c.ellipse(x, y, 10, 4, 0, 0, 6.28); c.fill(); c.restore();
  }

  window.Actors = Actors;
})();
