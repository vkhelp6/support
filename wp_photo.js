/* wp_photo.js — live wallpaper engine: cohesive day/night hero scene cross-fade
   (window.HERO.day / .night) + animated beacon, stars, drifting clouds and real
   Bryansk weather (Open-Meteo). Pure overlay animation on a single painted scene. */
(function () {
  "use strict";
  var LAT = 53.2435, LON = 34.3641;
  var BEACON = { fx: 0.78, fy: 0.098 };   // tower-top beacon position in the hero art
  var WINDOW = { fx: 0.665, fy: 0.80 };    // lit container window
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

  var day = new Image(), night = new Image();
  day.src = window.HERO.day.uri; night.src = window.HERO.night.uri;
  var IW = window.HERO.day.w, IH = window.HERO.day.h;

  var stars = [], clouds = [];
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stars = []; for (var i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random() * 0.5, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.28 });
    clouds = []; for (var j = 0; j < 6; j++) clouds.push({ x: Math.random(), y: 0.08 + Math.random() * 0.32, s: 0.5 + Math.random() * 0.8, v: 0.4 + Math.random() * 0.7 });
  }

  // cover-fit mapping
  function fit() {
    var s = Math.max(W / IW, H / IH);
    var dw = IW * s, dh = IH * s;
    return { s: s, dw: dw, dh: dh, ox: (W - dw) / 2, oy: (H - dh) / 2 };
  }
  function P(f, fx, fy) { return { x: f.ox + fx * f.dw, y: f.oy + fy * f.dh }; }

  // ---- weather (real, Open-Meteo) ----
  var WX = { code: 1, wind: 8, precip: 0, sr: 5, ss: 21, ok: false };
  function hh(iso) { var d = new Date(iso); return d.getHours() + d.getMinutes() / 60; }
  function fetchWeather() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=weather_code,wind_speed_10m,precipitation&daily=sunrise,sunset&timezone=auto";
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var c = d.current || {};
      WX.code = c.weather_code | 0; WX.wind = c.wind_speed_10m || 0; WX.precip = c.precipitation || 0;
      if (d.daily) { WX.sr = hh(d.daily.sunrise[0]); WX.ss = hh(d.daily.sunset[0]); }
      WX.ok = true;
    }).catch(function () {});
  }
  fetchWeather(); setInterval(fetchWeather, 10 * 60 * 1000);

  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function nightAmount() {
    if (typeof window.__FORCE_NIGHT === "number") return window.__FORCE_NIGHT;
    var n = new Date(); var hour = n.getHours() + n.getMinutes() / 60 + n.getSeconds() / 3600;
    var sr = WX.sr, ss = WX.ss, tw = 1.0, day1;
    if (hour <= sr - tw || hour >= ss + tw) day1 = 0;
    else if (hour < sr + tw) day1 = smooth((hour - (sr - tw)) / (2 * tw));
    else if (hour < ss - tw) day1 = 1;
    else day1 = 1 - smooth((hour - (ss - tw)) / (2 * tw));
    return 1 - day1;
  }

  var drops = [];
  function drawWeather(t, na) {
    var code = WX.code;
    var rain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    var snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    var fog = code === 45 || code === 48;
    var want = (rain || snow) ? (70 + Math.min(200, WX.precip * 40 + 60)) : 0;
    while (drops.length < want) drops.push({ x: Math.random() * W, y: Math.random() * H, sp: Math.random() * 0.5 + 0.75 });
    if (drops.length > want) drops.length = want;
    var wind = WX.wind / 30;
    if (rain) {
      ctx.strokeStyle = "rgba(180,200,220,0.45)"; ctx.lineWidth = 1.1; ctx.beginPath();
      for (var i = 0; i < drops.length; i++) { var d = drops[i]; var len = 13 * d.sp; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + wind * len, d.y + len); d.y += (10 + 14 * d.sp); d.x += wind * 6; if (d.y > H) { d.y = -10; d.x = Math.random() * W; } }
      ctx.stroke();
    } else if (snow) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (var j = 0; j < drops.length; j++) { var f = drops[j]; ctx.beginPath(); ctx.arc(f.x, f.y, 1.6 * f.sp, 0, 6.28); ctx.fill(); f.y += (1.1 + 1.5 * f.sp); f.x += Math.sin(t + j) * 0.6 + wind * 2; if (f.y > H) { f.y = -6; f.x = Math.random() * W; } }
    }
    if (fog) { ctx.fillStyle = "rgba(205,210,216," + (0.18 + 0.12 * (1 - na)) + ")"; ctx.fillRect(0, 0, W, H); }
  }

  function frame(now) {
    var t = now / 1000;
    var na = nightAmount();
    var f = fit();
    ctx.clearRect(0, 0, W, H);
    if (day.complete && day.naturalWidth) ctx.drawImage(day, f.ox, f.oy, f.dw, f.dh);
    else { ctx.fillStyle = "#10243a"; ctx.fillRect(0, 0, W, H); }
    if (na > 0.01 && night.complete && night.naturalWidth) { ctx.globalAlpha = na; ctx.drawImage(night, f.ox, f.oy, f.dw, f.dh); ctx.globalAlpha = 1; }

    // extra twinkling stars at night (over the sky band)
    if (na > 0.05) {
      ctx.save();
      for (var i = 0; i < stars.length; i++) { var s = stars[i]; var a = (0.5 + 0.5 * Math.sin(t * 2 + s.p)) * na * 0.9; ctx.globalAlpha = a; ctx.fillStyle = "#eef4ff"; ctx.beginPath(); ctx.arc(f.ox + s.x * f.dw, f.oy + s.y * f.dh, s.r, 0, 6.28); ctx.fill(); }
      ctx.restore();
    }

    // slow drifting cloud wisps (subtle, fade out at deep night)
    ctx.save();
    var cloudA = 0.10 * (1 - na * 0.7);
    for (var k = 0; k < clouds.length; k++) {
      var c = clouds[k]; c.x += c.v * 0.00002 * (WX.wind + 5); if (c.x > 1.2) c.x = -0.25;
      var cx = f.ox + c.x * f.dw, cy = f.oy + c.y * f.dh, rs = c.s * f.dh * 0.05;
      ctx.fillStyle = "rgba(255,255,255," + cloudA + ")";
      for (var m = 0; m < 4; m++) { ctx.beginPath(); ctx.arc(cx + m * rs * 0.9, cy + Math.sin(m) * rs * 0.25, rs * (1 - m * 0.12), 0, 6.28); ctx.fill(); }
    }
    ctx.restore();

    // pulsing aviation beacon (brighter at night)
    var bp = P(f, BEACON.fx, BEACON.fy);
    var pulse = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.2), 2);
    var bI = (0.35 + 0.65 * na) * pulse;
    var br = f.dh * 0.03;
    ctx.save();
    var gr = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, br * 3.2);
    gr.addColorStop(0, "rgba(255,70,50," + (0.9 * bI) + ")");
    gr.addColorStop(1, "rgba(255,70,50,0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bp.x, bp.y, br * 3.2, 0, 6.28); ctx.fill();
    ctx.fillStyle = "rgba(255,120,90," + (0.5 + 0.5 * bI) + ")"; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(1.5, br * 0.35), 0, 6.28); ctx.fill();
    ctx.restore();

    // gentle warm flicker on the lit container window at night
    if (na > 0.2) {
      var wp = P(f, WINDOW.fx, WINDOW.fy);
      ctx.save();
      var wa = na * (0.18 + 0.06 * Math.sin(t * 1.7));
      var wg = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, f.dh * 0.08);
      wg.addColorStop(0, "rgba(255,210,120," + wa + ")"); wg.addColorStop(1, "rgba(255,210,120,0)");
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(wp.x, wp.y, f.dh * 0.08, 0, 6.28); ctx.fill();
      ctx.restore();
    }

    drawWeather(t, na);
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize(); requestAnimationFrame(frame);
})();
