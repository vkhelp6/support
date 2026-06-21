/* wp_main.js — core engine for the MTS tower live wallpaper.
   Owns: canvas, LAYOUT, real weather + day/night (Open-Meteo, Bryansk), sky,
   sun/moon, stars, clouds, precipitation, fog, and the render loop.
   Plugs in window.SceneArt (field/tower/container) and window.Actors (truck/engineers). */
(function () {
  "use strict";
  var LAT = 53.2435, LON = 34.3641;
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var LAYOUT = {};
  var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var groundY = Math.round(H * 0.80);
    var towerBaseX = Math.round(W * 0.66);
    var towerH = Math.round(H * 0.66);
    LAYOUT = {
      W: W, H: H, groundY: groundY, horizonY: Math.round(H * 0.62),
      towerBaseX: towerBaseX, towerBaseW: Math.max(60, Math.round(W * 0.07)),
      towerTopY: groundY - towerH, towerTopW: Math.max(16, Math.round(W * 0.018)),
      towerH: towerH,
      containerX: Math.round(W * 0.40), containerY: groundY - Math.round(H * 0.085),
      containerW: Math.round(W * 0.13), containerH: Math.round(H * 0.085),
      roadY: groundY + Math.round((H - groundY) * 0.45),
      parkX: Math.round(W * 0.24), doorX: Math.round(W * 0.40 + W * 0.105),
      scale: H / 1080
    };
    var stars = []; for (var i = 0; i < 140; i++) stars.push({ x: Math.random() * W, y: Math.random() * LAYOUT.horizonY, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6.28 });
    ENV._stars = stars;
    var clouds = []; for (var j = 0; j < 14; j++) clouds.push({ x: Math.random() * W, y: Math.random() * LAYOUT.horizonY * 0.8 + 10, s: Math.random() * 0.6 + 0.6, v: Math.random() * 6 + 3 });
    ENV._clouds = clouds;
  }

  // ---- weather (real, Open-Meteo) ----
  var WX = { code: 2, cloud: 0.4, windKmh: 8, precip: 0, temp: 15, sunrise: 5, sunset: 21, ok: false };
  function hh(iso) { var d = new Date(iso); return d.getHours() + d.getMinutes() / 60; }
  function fetchWeather() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
      "&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,is_day,precipitation&daily=sunrise,sunset&timezone=auto";
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var c = d.current || {};
      WX.code = c.weather_code | 0; WX.cloud = (c.cloud_cover || 0) / 100;
      WX.windKmh = c.wind_speed_10m || 0; WX.precip = c.precipitation || 0; WX.temp = c.temperature_2m;
      if (d.daily) { WX.sunrise = hh(d.daily.sunrise[0]); WX.sunset = hh(d.daily.sunset[0]); }
      WX.ok = true;
    }).catch(function () {});
  }
  fetchWeather(); setInterval(fetchWeather, 10 * 60 * 1000);

  // ---- ENV: day/night + palette ----
  var ENV = { _stars: [], _clouds: [], windKmh: 8, weatherCode: 2, cloud: 0.4, precip: 0, temp: 15, isDay: true, phase: "day", sunAlt: 0.5, sunX: 0, sunY: 0, moonX: 0, moonY: 0, palette: {} };
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) { return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))]; }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  var SKY = {
    night: { top: [8, 12, 28], bot: [22, 28, 54], amb: 0.25 },
    dawn: { top: [40, 50, 95], bot: [240, 150, 100], amb: 0.55 },
    day: { top: [90, 150, 220], bot: [180, 210, 240], amb: 1.0 },
    dusk: { top: [50, 45, 90], bot: [230, 120, 90], amb: 0.5 }
  };
  function computeEnv(t) {
    var now = new Date();
    var hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    ENV.windKmh = WX.windKmh; ENV.weatherCode = WX.code; ENV.cloud = WX.cloud; ENV.precip = WX.precip; ENV.temp = WX.temp;
    var sr = WX.sunrise, ss = WX.sunset;
    var isDay = hour >= sr && hour <= ss; ENV.isDay = isDay;
    var top, bot, amb, phase;
    var tw = 1.0; // twilight window hrs
    if (hour > sr - tw && hour < sr + tw) { phase = "dawn"; var k = (hour - (sr - tw)) / (2 * tw); top = mix(SKY.night.top, SKY.day.top, k); bot = mix(SKY.dawn.bot, SKY.day.bot, k); amb = lerp(SKY.night.amb, SKY.day.amb, k); }
    else if (hour > ss - tw && hour < ss + tw) { phase = "dusk"; var k2 = (hour - (ss - tw)) / (2 * tw); top = mix(SKY.day.top, SKY.night.top, k2); bot = mix(SKY.dusk.bot, SKY.night.bot, k2); amb = lerp(SKY.day.amb, SKY.night.amb, k2); }
    else if (isDay) { phase = "day"; top = SKY.day.top.slice(); bot = SKY.day.bot.slice(); amb = SKY.day.amb; }
    else { phase = "night"; top = SKY.night.top.slice(); bot = SKY.night.bot.slice(); amb = SKY.night.amb; }
    // cloud desaturates / greys the sky
    var grey = [120, 125, 132];
    top = mix(top, grey, WX.cloud * 0.55); bot = mix(bot, [150, 155, 160], WX.cloud * 0.55);
    amb *= (1 - WX.cloud * 0.35);
    ENV.phase = phase; ENV.palette = { skyTop: rgb(top), skyBottom: rgb(bot), ambient: amb, groundTint: amb };
    // sun/moon position along an arc
    var dayProg = (hour - sr) / Math.max(0.1, (ss - sr));
    ENV.sunAlt = isDay ? Math.sin(Math.max(0, Math.min(1, dayProg)) * Math.PI) : -0.3;
    ENV.sunX = LAYOUT.W * (0.08 + 0.84 * Math.max(0, Math.min(1, dayProg)));
    ENV.sunY = LAYOUT.horizonY - ENV.sunAlt * LAYOUT.horizonY * 0.8;
    var nProg = ((hour < sr) ? (hour + 24 - ss) : (hour - ss)) / Math.max(0.1, (24 - (ss - sr)));
    ENV.moonX = LAYOUT.W * (0.08 + 0.84 * Math.max(0, Math.min(1, nProg)));
    ENV.moonY = LAYOUT.horizonY - Math.sin(Math.max(0, Math.min(1, nProg)) * Math.PI) * LAYOUT.horizonY * 0.7;
  }

  // ---- sky & celestial & weather overlays (engine-owned) ----
  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, LAYOUT.groundY);
    g.addColorStop(0, ENV.palette.skyTop); g.addColorStop(1, ENV.palette.skyBottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, LAYOUT.groundY);
    if (!ENV.isDay) { for (var i = 0; i < ENV._stars.length; i++) { var s = ENV._stars[i]; var a = 0.6 + 0.4 * Math.sin(t * 2 + s.p); ctx.globalAlpha = a * (1 - ENV.cloud * 0.7) * 0.9; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill(); } ctx.globalAlpha = 1; }
    if (ENV.isDay) { var r = Math.max(18, H * 0.04); var grd = ctx.createRadialGradient(ENV.sunX, ENV.sunY, 2, ENV.sunX, ENV.sunY, r * 3); grd.addColorStop(0, "rgba(255,245,200,0.95)"); grd.addColorStop(0.4, "rgba(255,230,150,0.5)"); grd.addColorStop(1, "rgba(255,230,150,0)"); ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(ENV.sunX, ENV.sunY, r * 3, 0, 6.28); ctx.fill(); ctx.fillStyle = "#fff7d6"; ctx.beginPath(); ctx.arc(ENV.sunX, ENV.sunY, r, 0, 6.28); ctx.fill(); }
    else { var mr = Math.max(14, H * 0.03); ctx.fillStyle = "rgba(235,240,255,0.95)"; ctx.beginPath(); ctx.arc(ENV.moonX, ENV.moonY, mr, 0, 6.28); ctx.fill(); ctx.fillStyle = ENV.palette.skyTop; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(ENV.moonX + mr * 0.4, ENV.moonY - mr * 0.3, mr * 0.85, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; }
  }
  function drawClouds() {
    var cnt = Math.round(ENV._clouds.length * (0.2 + ENV.cloud)); var spd = (ENV.windKmh + 4) * 0.4;
    ctx.save();
    for (var i = 0; i < Math.min(cnt, ENV._clouds.length); i++) {
      var c = ENV._clouds[i]; c.x += (c.v * 0.001 * spd); if (c.x > W + 200) c.x = -200;
      var br = ENV.isDay ? 245 : 90; ctx.fillStyle = "rgba(" + br + "," + br + "," + (br + 8) + "," + (0.18 + ENV.cloud * 0.5) + ")";
      var s = c.s * H * 0.05;
      for (var k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(c.x + k * s * 0.8, c.y + Math.sin(k) * s * 0.2, s * (1 - k * 0.12), 0, 6.28); ctx.fill(); }
    }
    ctx.restore();
  }
  var drops = [];
  function drawWeather() {
    var code = ENV.weatherCode;
    var rain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    var snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
    var fog = code === 45 || code === 48;
    var want = (rain || snow) ? (60 + Math.min(220, (ENV.precip * 40 + 60))) : 0;
    while (drops.length < want) drops.push({ x: Math.random() * W, y: Math.random() * H, sp: Math.random() * 0.5 + 0.75 });
    if (drops.length > want) drops.length = want;
    var wind = (ENV.windKmh / 30);
    if (rain) { ctx.strokeStyle = "rgba(170,190,210,0.5)"; ctx.lineWidth = 1.1; ctx.beginPath(); for (var i = 0; i < drops.length; i++) { var d = drops[i]; var len = 14 * d.sp; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + wind * len, d.y + len); d.y += (10 + 14 * d.sp); d.x += wind * 6; if (d.y > H) { d.y = -10; d.x = Math.random() * W; } } ctx.stroke(); }
    else if (snow) { ctx.fillStyle = "rgba(255,255,255,0.85)"; for (var j = 0; j < drops.length; j++) { var f = drops[j]; ctx.beginPath(); ctx.arc(f.x, f.y, 1.6 * f.sp, 0, 6.28); ctx.fill(); f.y += (1.2 + 1.6 * f.sp); f.x += Math.sin(t + j) * 0.6 + wind * 2; if (f.y > H) { f.y = -6; f.x = Math.random() * W; } } }
    if (fog) { ctx.fillStyle = "rgba(200,205,210,0.28)"; ctx.fillRect(0, 0, W, H); }
    // night ambient darkening overlay
    if (ENV.palette.ambient < 0.6) { ctx.fillStyle = "rgba(6,8,20," + (0.6 - ENV.palette.ambient) * 0.7 + ")"; ctx.fillRect(0, 0, W, H); }
  }

  // ---- stubs (replaced by subagent modules window.SceneArt / window.Actors) ----
  var SceneStub = {
    drawField: function (c, L) { c.fillStyle = "#5a6b4a"; c.fillRect(0, L.groundY, L.W, L.H - L.groundY); },
    drawTower: function (c, L) { c.strokeStyle = "#888"; c.lineWidth = 3; c.beginPath(); c.moveTo(L.towerBaseX - L.towerBaseW / 2, L.groundY); c.lineTo(L.towerBaseX, L.towerTopY); c.lineTo(L.towerBaseX + L.towerBaseW / 2, L.groundY); c.stroke(); },
    drawContainer: function (c, L) { c.fillStyle = "#9aa"; c.fillRect(L.containerX, L.containerY, L.containerW, L.containerH); }
  };
  var ActorStub = { update: function () {}, draw: function () {}, getDoorOpen: function () { return false; } };

  // ---- main loop ----
  var t = 0, last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    computeEnv(t);
    var S = window.SceneArt || SceneStub;
    var A = window.Actors || ActorStub;
    ctx.clearRect(0, 0, W, H);
    drawSky(); drawClouds();
    (S.drawField || SceneStub.drawField)(ctx, LAYOUT, ENV, t);
    try { A.update(dt, t, LAYOUT, ENV); } catch (e) {}
    var doorOpen = false; try { doorOpen = A.getDoorOpen ? A.getDoorOpen() : false; } catch (e) {}
    (S.drawContainer || SceneStub.drawContainer)(ctx, LAYOUT, ENV, t, doorOpen);
    (S.drawTower || SceneStub.drawTower)(ctx, LAYOUT, ENV, t);
    try { A.draw(ctx, LAYOUT, ENV, t); } catch (e) {}
    drawWeather();
    requestAnimationFrame(frame);
  }
  window.addEventListener("resize", resize);
  resize(); requestAnimationFrame(frame);
})();
