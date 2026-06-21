/* wp_actors.js — window.Actors: Mitsubishi L200 + two engineers + event state machine. */
(function () {
  "use strict";
  var st = {
    phase: "IDLE", timer: 0, doorOpen: false,
    truckX: -9999, climbF: 0, work: 0,
    eng: [{ x: 0, y: 0, walk: 0, mode: "hidden" }, { x: 0, y: 0, walk: 0, mode: "hidden" }]
  };
  var DUR = { IDLE: 7, ARRIVE: 6, EXIT: 1.6, WALK_IN: 4, ENTER: 2.2, CLIMB: 7, WORK: 5, DESCEND: 6, WALK_OUT: 4, LEAVE: 6 };
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function next(p) {
    var order = ["IDLE", "ARRIVE", "EXIT", "WALK_IN", "ENTER", "CLIMB", "WORK", "DESCEND", "WALK_OUT", "LEAVE"];
    var i = order.indexOf(p); return order[(i + 1) % order.length];
  }

  function update(dt, t, L, ENV) {
    st.timer += dt;
    var startX = -L.W * 0.15, parkX = L.parkX, doorX = L.doorX, gy = L.groundY;
    var d = DUR[st.phase] || 4, p = Math.min(1, st.timer / d);
    var e0 = st.eng[0], e1 = st.eng[1];
    switch (st.phase) {
      case "IDLE": st.truckX = startX; st.doorOpen = false; e0.mode = e1.mode = "hidden"; st.climbF = 0; break;
      case "ARRIVE": st.truckX = lerp(startX, parkX, ease(p)); break;
      case "EXIT": st.truckX = parkX; e0.mode = e1.mode = "walk"; e0.x = parkX + L.W * 0.02; e1.x = parkX + L.W * 0.03; e0.y = e1.y = gy; break;
      case "WALK_IN": e0.x = lerp(parkX + L.W * 0.02, doorX, p); e1.x = lerp(parkX + L.W * 0.03, doorX - L.W * 0.02, p); e0.walk += dt * 8; e1.walk += dt * 8; if (p > 0.7) st.doorOpen = true; break;
      case "ENTER": st.doorOpen = true; e0.mode = "idle"; e1.mode = "idle"; e0.x = doorX; e1.x = doorX - L.W * 0.02; break;
      case "CLIMB": st.doorOpen = false; st.climbF = ease(p); e0.mode = "climb"; e1.mode = "idle"; e1.x = L.containerX - L.W * 0.01; e1.y = gy; break;
      case "WORK": st.climbF = 1; st.work += dt; e0.mode = "climb"; break;
      case "DESCEND": st.climbF = 1 - ease(p); e0.mode = "climb"; break;
      case "WALK_OUT": st.doorOpen = false; e0.mode = "walk"; e1.mode = "walk"; e0.x = lerp(L.towerBaseX, parkX + L.W * 0.02, p); e0.y = gy; e1.x = lerp(L.containerX - L.W * 0.01, parkX + L.W * 0.03, p); e0.walk += dt * 8; e1.walk += dt * 8; break;
      case "LEAVE": e0.mode = e1.mode = "hidden"; st.truckX = lerp(parkX, L.W + L.W * 0.2, ease(p)); break;
    }
    if (st.timer >= d) { st.timer = 0; st.phase = next(st.phase); }
  }

  function getDoorOpen() { return st.doorOpen; }

  function drawTruck(ctx, L, ENV, x) {
    if (x < -L.W * 0.14 || x > L.W + L.W * 0.18) return;
    var sc = L.scale, gy = L.roadY;
    var bw = Math.max(150, L.W * 0.12), bh = bw * 0.32;
    var bodyY = gy - bh;
    ctx.save();
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(x + bw * 0.5, gy + 4, bw * 0.5, bh * 0.18, 0, 0, 6.28); ctx.fill();
    // bed + body (silver)
    ctx.fillStyle = "#d6dade"; ctx.fillRect(x, bodyY + bh * 0.25, bw, bh * 0.5);
    // double cab
    ctx.fillStyle = "#e7eaec"; ctx.beginPath();
    ctx.moveTo(x + bw * 0.32, bodyY + bh * 0.25);
    ctx.lineTo(x + bw * 0.40, bodyY - bh * 0.18);
    ctx.lineTo(x + bw * 0.74, bodyY - bh * 0.18);
    ctx.lineTo(x + bw * 0.80, bodyY + bh * 0.25);
    ctx.closePath(); ctx.fill();
    // windows
    ctx.fillStyle = ENV.isDay ? "#6b8aa0" : "#22303c";
    ctx.fillRect(x + bw * 0.42, bodyY - bh * 0.12, bw * 0.14, bh * 0.3);
    ctx.fillRect(x + bw * 0.58, bodyY - bh * 0.12, bw * 0.14, bh * 0.3);
    // bed rails
    ctx.strokeStyle = "#b9bec2"; ctx.lineWidth = 2 * sc; ctx.strokeRect(x + bw * 0.02, bodyY + bh * 0.12, bw * 0.28, bh * 0.16);
    // wheels
    ctx.fillStyle = "#1b1d20";
    [x + bw * 0.22, x + bw * 0.80].forEach(function (wx) { ctx.beginPath(); ctx.arc(wx, gy, bh * 0.26, 0, 6.28); ctx.fill(); ctx.fillStyle = "#55585c"; ctx.beginPath(); ctx.arc(wx, gy, bh * 0.1, 0, 6.28); ctx.fill(); ctx.fillStyle = "#1b1d20"; });
    // headlight at dusk/night
    if (!ENV.isDay) { var lg = ctx.createRadialGradient(x + bw, bodyY + bh * 0.1, 1, x + bw, bodyY + bh * 0.1, bw * 0.5); lg.addColorStop(0, "rgba(255,240,180,0.45)"); lg.addColorStop(1, "rgba(255,240,180,0)"); ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x + bw, bodyY); ctx.lineTo(x + bw * 1.5, bodyY - bh * 0.2); ctx.lineTo(x + bw * 1.5, bodyY + bh * 0.5); ctx.closePath(); ctx.fill(); }
    // red MTS-ish accent stripe
    ctx.fillStyle = "#e30611"; ctx.fillRect(x, bodyY + bh * 0.46, bw, bh * 0.06);
    ctx.restore();
  }

  function drawEngineer(ctx, L, ENV, e, t) {
    if (e.mode === "hidden") return;
    var sc = L.scale, hh = 30 * sc; // figure height
    var x = e.x, y = e.y;
    var swing = (e.mode === "walk") ? Math.sin(e.walk) * 5 * sc : 0;
    var k = ENV.palette ? Math.max(0.4, ENV.palette.ambient) : 1;
    function col(c) { return "rgb(" + Math.round(c[0] * k) + "," + Math.round(c[1] * k) + "," + Math.round(c[2] * k) + ")"; }
    ctx.save();
    // legs
    ctx.strokeStyle = col([40, 44, 52]); ctx.lineWidth = 3 * sc; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y - hh * 0.45); ctx.lineTo(x - swing * 0.4, y); ctx.moveTo(x, y - hh * 0.45); ctx.lineTo(x + swing * 0.4, y); ctx.stroke();
    // body (red jacket)
    ctx.fillStyle = col([210, 40, 40]); ctx.fillRect(x - 4 * sc, y - hh, 8 * sc, hh * 0.58);
    // reflective stripe
    ctx.fillStyle = col([240, 240, 180]); ctx.fillRect(x - 4 * sc, y - hh * 0.62, 8 * sc, 2 * sc);
    // arms
    ctx.strokeStyle = col([210, 40, 40]); ctx.lineWidth = 3 * sc;
    if (e.mode === "climb") { ctx.beginPath(); ctx.moveTo(x, y - hh * 0.85); ctx.lineTo(x - 5 * sc, y - hh); ctx.moveTo(x, y - hh * 0.85); ctx.lineTo(x + 5 * sc, y - hh * 0.7); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(x, y - hh * 0.8); ctx.lineTo(x - swing * 0.5, y - hh * 0.5); ctx.moveTo(x, y - hh * 0.8); ctx.lineTo(x + swing * 0.5, y - hh * 0.5); ctx.stroke(); }
    // head + hard hat
    ctx.fillStyle = col([225, 195, 165]); ctx.beginPath(); ctx.arc(x, y - hh - 1 * sc, 4.5 * sc, 0, 6.28); ctx.fill();
    ctx.fillStyle = col([240, 200, 30]); ctx.beginPath(); ctx.arc(x, y - hh - 2.5 * sc, 5.2 * sc, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 6 * sc, y - hh - 2.5 * sc, 12 * sc, 1.6 * sc);
    ctx.restore();
  }

  function draw(ctx, L, ENV, t) {
    drawTruck(ctx, L, ENV, st.truckX);
    // climbing engineer on the tower
    if (st.climbF > 0.001 || st.phase === "CLIMB" || st.phase === "WORK" || st.phase === "DESCEND") {
      var cx = L.towerBaseX, cy = lerp(L.groundY, L.towerTopY + 16 * L.scale, st.climbF);
      var ce = { x: cx, y: cy, mode: "climb", walk: 0 };
      drawEngineer(ctx, L, ENV, ce, t);
      if (st.phase === "WORK") { // tool sparkle while swapping antenna
        var s = (Math.sin(t * 20) > 0) ? 1 : 0.2; ctx.fillStyle = "rgba(255,220,120," + s + ")";
        ctx.beginPath(); ctx.arc(cx + 8 * L.scale, cy - 26 * L.scale, 2.5 * L.scale, 0, 6.28); ctx.fill();
      }
    }
    // ground engineers
    drawEngineer(ctx, L, ENV, st.eng[0].mode === "climb" ? { mode: "hidden" } : st.eng[0], t);
    drawEngineer(ctx, L, ENV, st.eng[1], t);
  }

  window.Actors = { update: update, draw: draw, getDoorOpen: getDoorOpen };
})();
