"use strict";

const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];

let PLAYERS = [];
let TEAMS = [];

const S = {
  difficulty: "normal",
  formation: "2-2-2",
  skips: 1,
  slots: [],
  used: new Set(),
  selected: null,
  draw: null,
  shownPlayers: [],
  name: "La tua squadra",
  speed: "normal",
  round: 0,
  standings: [],
  schedule: [],
  live: null,
  playoff: 0,
  playoffStages: [],
  lastWin: false,
  pendingPlayoff: null,
};

const FORMATIONS = {
  "2-2-2": ["POR", "DIF", "DIF", "CEN", "CEN", "ATT", "ATT"],
  "3-1-2": ["POR", "DIF", "DIF", "DIF", "CEN", "ATT", "ATT"],
  "2-1-3": ["POR", "DIF", "DIF", "CEN", "ATT", "ATT", "ATT"],
};

const positions = {
  "2-2-2": [[50, 90], [29, 69], [71, 69], [28, 44], [72, 44], [30, 19], [70, 19]],
  "3-1-2": [[50, 90], [20, 68], [50, 72], [80, 68], [50, 43], [31, 18], [69, 18]],
  "2-1-3": [[50, 90], [30, 69], [70, 69], [50, 45], [18, 18], [50, 16], [82, 18]],
};

function show(id) {
  qa(".screen").forEach((x) => x.classList.remove("active"));
  q("#" + id).classList.add("active");
  scrollTo(0, 0);
}

function rnd(a) {
  return a[Math.floor(Math.random() * a.length)];
}

function shuffle(a) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function ini(n) {
  return n.split(/\s+/).map((x) => x[0]).join("").slice(0, 3).toUpperCase();
}

async function boot() {
  try {
    [PLAYERS, TEAMS] = await Promise.all([
      fetch("players.json").then((r) => { if (!r.ok) throw new Error(`players.json: ${r.status}`); return r.json(); }),
      fetch("teams.json").then((r) => { if (!r.ok) throw new Error(`teams.json: ${r.status}`); return r.json(); }),
    ]);
  } catch (e) {
    alert("Errore caricamento database. Controlla che players.json e teams.json siano nella stessa cartella di index.html.");
    console.error(e);
    return;
  }
  bind();
}

function bind() {
  qa("#difficulty button").forEach((b) => b.onclick = () => select("#difficulty", b, "difficulty"));
  qa("#formation button").forEach((b) => b.onclick = () => select("#formation", b, "formation"));
  q("#startDraft").onclick = startDraft;
  qa("[data-go]").forEach((b) => b.onclick = () => show(b.dataset.go));
  q("#openPlayers").onclick = openPlayers;
  q("#respinPlayers").onclick = respinPlayers;
  q("#difficultyInfoToggle").onclick = toggleDifficultyInfo;
  q("#startSeason").onclick = startSeason;
  q("#playMatch").onclick = playMatch;
  q("#simRound").onclick = simulateCurrentRound;
  q("#simAll").onclick = simulateAll;
  q("#liveSpeed").onchange = (e) => S.speed = e.target.value;
  q("#pause").onclick = togglePause;
  q("#skipMatch").onclick = skipMatch;
  q("#continue").onclick = continueAfterResult;
  q("#startPlayoffs").onclick = startPlayoffs;
  q("#playoffNext").onclick = beginPlayoffMatch;
}

function select(parent, b, key) {
  qa(parent + " button").forEach((x) => x.classList.remove("selected"));
  b.classList.add("selected");
  S[key] = b.dataset.value;
}

function startDraft() {
  S.skips = 1;
  S.slots = FORMATIONS[S.formation].map((role) => ({ role, player: null }));
  S.used = new Set();
  renderPitch();
  show("draft");
}

function renderPitch() {
  q("#formationText").textContent = S.formation;
  q("#skipText").textContent = S.skips;
  qa(".skipMirror").forEach((x) => x.textContent = S.skips);
  q("#pitch").innerHTML = S.slots.map((s, i) => {
    const p = s.player;
    const [x, y] = positions[S.formation][i];
    return `<button class="slot ${p ? "filled" : ""}" data-slot="${i}" style="left:${x}%;top:${y}%">${p
      ? `<span class="ini">${ini(p.name)}</span><span class="info">${p.name}<br>${p.role} · ${S.difficulty === "hard" ? "?" : p.overall}</span>`
      : `<span><b class="plus">+</b><br><b class="role">${s.role}</b></span>`}</button>`;
  }).join("");
  qa("[data-slot]").forEach((b) => b.onclick = () => {
    const i = +b.dataset.slot;
    if (!S.slots[i].player) openDraw(i);
  });
}

function available(role) {
  return PLAYERS.filter((p) => p.role === role && !S.used.has(p.id));
}

function openDraw(i) {
  S.selected = i;
  randomDraw();
  q("#drawRole").textContent = S.slots[i].role;
  show("draw");
}

function randomDraw() {
  const pool = available(S.slots[S.selected].role);
  if (!pool.length) return alert("Nessun giocatore disponibile.");
  const p = rnd(pool);
  S.draw = { team: p.team };
  renderDraw();
}

function renderDraw() {
  q("#drawTeam").textContent = S.draw.team;
  qa(".skipMirror").forEach((x) => x.textContent = S.skips);
}

function ensureDraw() {
  const role = S.slots[S.selected].role;
  const pool = available(role).filter((p) => p.team === S.draw.team);
  if (!pool.length) {
    const p = rnd(available(role));
    S.draw = { team: p.team };
  }
}

function playerLimit(poolLength) {
  if (S.difficulty === "easy") return poolLength;
  if (S.difficulty === "normal") return Math.min(poolLength, Math.random() < 0.5 ? 4 : 5);
  return Math.min(poolLength, 3);
}

function buildShownPlayers() {
  ensureDraw();
  const role = S.slots[S.selected].role;
  const pool = available(role).filter((p) => p.team === S.draw.team);
  const limit = playerLimit(pool.length);
  S.shownPlayers = shuffle(pool).slice(0, limit);
}

function renderPlayers() {
  const role = S.slots[S.selected].role;
  q("#playersContext").textContent = S.draw.team + " · Split 2";
  q("#playersRole").textContent = role;
  q("#playersCount").textContent = `${S.shownPlayers.length} giocator${S.shownPlayers.length === 1 ? "e" : "i"} disponibili`;
  q("#playerGrid").innerHTML = S.shownPlayers.map((p) => `<button class="player-card" data-player="${p.id}"><div class="portrait"><b>${ini(p.name)}</b><span class="ovr">${p.overall}</span></div><div class="player-info"><b>${p.name}</b><small>${p.role} · ${p.team} · Split 2</small></div></button>`).join("");
  qa("[data-player]").forEach((b) => b.onclick = () => pick(b.dataset.player));
  qa(".skipMirror").forEach((x) => x.textContent = S.skips);
  q("#respinPlayers").disabled = S.skips <= 0;
}

function openPlayers() {
  buildShownPlayers();
  renderPlayers();
  show("players");
}

function respinPlayers() {
  if (S.skips <= 0) return;
  const previous = new Set(S.shownPlayers.map((p) => p.id));
  const role = S.slots[S.selected].role;
  const pool = available(role).filter((p) => p.team === S.draw.team);
  const alternatives = pool.filter((p) => !previous.has(p.id));
  const limit = playerLimit(pool.length);
  const next = shuffle(alternatives).slice(0, limit);
  if (next.length < limit) {
    next.push(...shuffle(pool.filter((p) => !next.some((x) => x.id === p.id))).slice(0, limit - next.length));
  }
  S.shownPlayers = next;
  S.skips = 0;
  renderPlayers();
  addToast("Respin utilizzato: non sarà più disponibile in questo Draft.");
}

function toggleDifficultyInfo() {
  const panel = q("#difficultyInfo");
  const button = q("#difficultyInfoToggle");
  const opening = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !opening);
  button.setAttribute("aria-expanded", String(opening));
}

function addToast(text) {
  const old = q("#toast");
  if (old) old.remove();
  document.body.insertAdjacentHTML("beforeend", `<div id="toast" class="toast">${text}</div>`);
  setTimeout(() => q("#toast")?.remove(), 2600);
}

function pick(id) {
  const p = PLAYERS.find((x) => x.id === id);
  S.slots[S.selected].player = p;
  S.used.add(id);
  renderPitch();
  S.slots.every((x) => x.player) ? summary() : show("draft");
}

function teamStrengthFromPlayers(players) {
  return Math.round(players.reduce((sum, p) => sum + p.overall, 0) / players.length);
}

function summary() {
  const ps = S.slots.map((x) => x.player);
  const avg = teamStrengthFromPlayers(ps);
  const by = (r) => {
    const z = ps.filter((p) => p.role === r);
    return z.length ? Math.round(z.reduce((a, p) => a + p.overall, 0) / z.length) : 0;
  };
  q("#teamStats").innerHTML = [["OVR", avg], ["POR", by("POR")], ["DIF", by("DIF")], ["CEN", by("CEN")], ["ATT", by("ATT")]].map((x) => `<div class="stat"><b>${S.difficulty === "hard" && x[0] === "OVR" ? "?" : x[1]}</b><small>${x[0]}</small></div>`).join("");
  q("#squadList").innerHTML = ps.map((p) => `<div class="row"><div><b>${p.name}</b><small> ${p.team} · Split 2</small></div><b>${p.role} · ${p.overall}</b></div>`).join("");
  show("summary");
}

function strength() {
  return teamStrengthFromPlayers(S.slots.map((x) => x.player));
}

function buildRoundRobin(names) {
  const teams = shuffle(names);
  if (teams.length % 2) teams.push(null);
  const rounds = [];
  const fixed = teams[0];
  let rotating = teams.slice(1);
  for (let r = 0; r < teams.length - 1; r++) {
    const lineup = [fixed, ...rotating];
    const games = [];
    for (let i = 0; i < lineup.length / 2; i++) {
      const a = lineup[i];
      const b = lineup[lineup.length - 1 - i];
      if (a && b) games.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(games);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

function startSeason() {
  S.name = q("#teamName").value.trim() || "La tua squadra";
  S.speed = q("#preSpeed").value;
  S.round = 0;
  const all = [{ name: S.name, strength: strength(), user: true }, ...TEAMS];
  S.standings = all.map((t) => ({ ...t, g: 0, w: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
  S.schedule = buildRoundRobin(all.map((t) => t.name));
  renderSeason();
}

function ranking() {
  return [...S.standings].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || b.strength - a.strength);
}

function renderTable() {
  q("#tableBody").innerHTML = ranking().map((t, i) => `<tr class="${t.user ? "user-row" : ""}"><td>${i + 1}</td><td>${t.name}</td><td>${t.g}</td><td>${t.w}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${t.gf - t.ga}</td><td>${t.pts}</td></tr>`).join("");
}

function currentUserGame() {
  return S.schedule[S.round].find(([a, b]) => a === S.name || b === S.name);
}

function currentOpponent() {
  const [a, b] = currentUserGame();
  return a === S.name ? b : a;
}

function renderSeason() {
  if (S.round >= S.schedule.length) return renderSeasonRecap();
  q("#roundTitle").textContent = "GIORNATA " + (S.round + 1);
  q("#nextMatch").textContent = S.name + "  VS  " + currentOpponent();
  renderTable();
  show("season");
}

function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function simulateScore(aStrength, bStrength) {
  const diff = aStrength - bStrength;
  const base = 3.15;
  const aLambda = Math.max(1.15, Math.min(5.7, base + diff * 0.085));
  const bLambda = Math.max(1.15, Math.min(5.7, base - diff * 0.085));
  return [poisson(aLambda), poisson(bLambda)];
}

function apply(a, b, ga, gb, winner = null) {
  const A = S.standings.find((x) => x.name === a);
  const B = S.standings.find((x) => x.name === b);
  if (!A || !B) throw new Error(`Squadra non trovata: ${a} / ${b}`);
  let shootout = false;
  if (ga === gb) {
    shootout = true;
    winner = winner || (Math.random() < A.strength / (A.strength + B.strength) ? a : b);
  } else {
    winner = ga > gb ? a : b;
  }
  A.g++; B.g++;
  A.gf += ga; A.ga += gb;
  B.gf += gb; B.ga += ga;
  if (winner === a) { A.w++; B.l++; A.pts += 3; }
  else { B.w++; A.l++; B.pts += 3; }
  return { ga, gb, winner, shootout };
}

function simulateGame(a, b) {
  const A = S.standings.find((x) => x.name === a);
  const B = S.standings.find((x) => x.name === b);
  const [ga, gb] = simulateScore(A.strength, B.strength);
  return apply(a, b, ga, gb);
}

function simulateOthers() {
  for (const [a, b] of S.schedule[S.round]) {
    if (a === S.name || b === S.name) continue;
    simulateGame(a, b);
  }
}

function simulateCurrentRound() {
  const [a, b] = currentUserGame();
  simulateGame(a, b);
  simulateOthers();
  S.round++;
  renderSeason();
}

function simulateAll() {
  if (!confirm("Simulare tutte le giornate rimanenti? Non potrai tornare indietro.")) return;
  while (S.round < S.schedule.length) {
    for (const [a, b] of S.schedule[S.round]) simulateGame(a, b);
    S.round++;
  }
  renderSeasonRecap();
}

function playMatch() {
  const opp = currentOpponent();
  const O = S.standings.find((x) => x.name === opp);
  startLiveMatch(opp, O.strength, "season", "GIORNATA " + (S.round + 1));
}

function startLiveMatch(opp, oppStrength, mode, label) {
  S.live = {
    opp, os: oppStrength, mode, label,
    m: 0, h: 0, a: 0,
    paused: false, done: false, timer: null,
    goals: [], shots: [0, 0], saves: [0, 0],
    phase: "regulation", target: null, players: 7,
    shootout: false, shootoutWinner: null,
  };
  q("#liveRound").textContent = label;
  q("#liveTeams").textContent = S.name + " vs " + opp;
  q("#feed").innerHTML = "";
  q("#pause").textContent = "Pausa";
  q("#liveSpeed").value = S.speed;
  addEvent("0' 🟢 <b>Calcio d'inizio · 7 vs 7</b>", "special");
  updateLive();
  show("live");
  scheduleLive();
}

function wait() {
  return { slow: 1500, normal: 700, fast: 180 }[S.speed];
}

function addEvent(t, c = "") {
  q("#feed").insertAdjacentHTML("beforeend", `<div class="event ${c}">${t}</div>`);
  q("#feed").scrollTop = q("#feed").scrollHeight;
}

function scheduleLive() {
  clearTimeout(S.live.timer);
  if (!S.live.paused && !S.live.done) S.live.timer = setTimeout(step, wait());
}

function attemptChance(L) {
  if (L.phase === "regulation") return 0.22;
  const byPlayers = { 7: 0.28, 6: 0.31, 5: 0.35, 4: 0.40, 3: 0.47, 2: 0.56, 1: 0.68 };
  return byPlayers[L.players] || 0.68;
}

function generateChance() {
  const L = S.live;
  const userChance = strength() / (strength() + L.os);
  const user = Math.random() < userChance;
  const idx = user ? 0 : 1;
  L.shots[idx]++;
  const openFieldBoost = L.phase === "descalado" ? (7 - L.players) * 0.025 : 0;
  const finishing = Math.max(0.34, Math.min(0.74, 0.43 + openFieldBoost + (user ? strength() - L.os : L.os - strength()) * 0.006));
  if (Math.random() < finishing) {
    if (user) L.h++; else L.a++;
    const scorers = S.slots.filter((x) => x.player.role !== "POR");
    const scorer = user ? rnd(scorers).player.name : "Giocatore avversario";
    L.goals.push({ m: L.m, scorer, user, value: 1 });
    addEvent(`${L.m}' ⚽ <b>GOOOL</b> · ${scorer} · ${L.h}-${L.a}`, "goal");
    if (L.phase === "descalado" && (L.h >= L.target || L.a >= L.target)) finish();
  } else {
    L.saves[user ? 1 : 0]++;
    addEvent(`${L.m}' 🧤 Parata decisiva`);
  }
}

function enterEndgame() {
  const L = S.live;
  if (L.h === L.a) {
    L.shootout = true;
    L.shootoutWinner = shootoutWinner(strength(), L.os);
    addEvent(`30' 🤝 Pareggio ${L.h}-${L.a}: <b>shootout immediati</b>`, "danger-event");
    addEvent(`🎯 Shootout vinti da <b>${L.shootoutWinner}</b>`, "special");
    finish();
    return;
  }
  L.phase = "descalado";
  L.target = Math.max(L.h, L.a) + 1;
  L.players = 7;
  addEvent(`30' 🔻 <b>DESCALADO</b> · 7 vs 7 · vince chi arriva a ${L.target}`, "danger-event");
}

function updateDescaladoPlayers() {
  const L = S.live;
  if (L.phase !== "descalado") return;
  const nextPlayers = Math.max(1, 37 - L.m);
  if (nextPlayers !== L.players) {
    L.players = nextPlayers;
    addEvent(`${L.m}' 🔻 <b>${L.players} vs ${L.players}</b>`, "danger-event");
  }
}

function step() {
  const L = S.live;
  if (!L || L.done) return;

  if (L.phase === "regulation" && L.m >= 30) {
    enterEndgame();
    updateLive();
    if (!L.done) scheduleLive();
    return;
  }

  if (L.phase === "descalado") updateDescaladoPlayers();

  if (Math.random() < attemptChance(L)) generateChance();
  else if (Math.random() < 0.13) addEvent(`${L.m}' ⚠️ Occasione per ${Math.random() < 0.5 ? S.name : L.opp}`);

  if (L.done) return;
  L.m++;
  updateLive();
  scheduleLive();
}

function updateLive() {
  const L = S.live;
  q("#score").textContent = L.h + " - " + L.a;
  q("#clock").textContent = L.m + "'" + (L.phase === "descalado" ? ` · ${L.players}v${L.players} · target ${L.target}` : "");
  const progress = L.phase === "regulation" ? Math.min(100, L.m / 30 * 100) : Math.min(100, 82 + (7 - L.players) * 3);
  q("#phaseFill").style.width = progress + "%";
}

function togglePause() {
  S.live.paused = !S.live.paused;
  q("#pause").textContent = S.live.paused ? "Riprendi" : "Pausa";
  if (!S.live.paused) scheduleLive();
}

function skipMatch() {
  clearTimeout(S.live.timer);
  S.live.paused = true;
  let guard = 0;
  while (!S.live.done && guard < 500) {
    step();
    guard++;
  }
  if (!S.live.done) {
    S.live.shootout = true;
    S.live.shootoutWinner = shootoutWinner(strength(), S.live.os);
    finish();
  }
}

function shootoutWinner(userStrength, oppStrength) {
  return Math.random() < userStrength / (userStrength + oppStrength) ? S.name : S.live.opp;
}

function finish() {
  const L = S.live;
  if (L.done) return;
  L.done = true;
  clearTimeout(L.timer);
  const tied = L.h === L.a;
  const winner = L.shootout ? L.shootoutWinner : (L.h > L.a ? S.name : L.opp);

  if (L.mode === "season") {
    apply(S.name, L.opp, L.h, L.a, winner);
    simulateOthers();
  } else {
    S.lastWin = winner === S.name;
  }

  const suffix = L.shootout ? ` · shootout: ${winner}` : (L.phase === "descalado" ? ` · target ${L.target}` : "");
  q("#finalResult").textContent = `${S.name} ${L.h}-${L.a} ${L.opp}${suffix}`;
  const poss = Math.max(38, Math.min(62, Math.round(50 + (strength() - L.os) / 2 + Math.random() * 8 - 4)));
  q("#matchStats").innerHTML = [["Tiri", L.shots.join("-")], ["Possesso", poss + "%-" + (100 - poss) + "%"], ["Parate", L.saves.join("-")], ["Finale", L.shootout ? "Shootout" : (L.phase === "descalado" ? "Descalado" : "Regolare")]].map((x) => `<div class="stat"><b>${x[1]}</b><small>${x[0]}</small></div>`).join("");
  q("#goalList").innerHTML = L.goals.length ? L.goals.map((g) => `<div class="row"><b>${g.m}' ${g.scorer}</b><small>${g.user ? S.name : L.opp}</small></div>`).join("") : `<div class="row"><b>Nessun gol</b></div>`;
  q("#continue").textContent = L.mode === "playoff" && (!S.lastWin || S.playoff === S.playoffStages.length - 1) ? "Nuovo draft" : "Continua";
  show("result");
}

function continueAfterResult() {
  if (S.live.mode === "season") {
    S.round++;
    renderSeason();
    return;
  }
  if (!S.lastWin || S.playoff === S.playoffStages.length - 1) {
    location.reload();
    return;
  }
  S.playoff++;
  renderPlayoffMatchup();
}

function renderSeasonRecap() {
  const table = ranking();
  const rank = table.findIndex((x) => x.user) + 1;
  const user = table.find((x) => x.user);
  q("#recapSummary").innerHTML = [["Posizione", rank + "°"], ["Vittorie", user.w], ["Sconfitte", user.l], ["Differenza reti", user.gf - user.ga]].map((x) => `<div class="stat"><b>${x[1]}</b><small>${x[0]}</small></div>`).join("");
  q("#recapTableBody").innerHTML = table.map((t, i) => `<tr class="${t.user ? "user-row" : ""}"><td>${i + 1}</td><td>${t.name}</td><td>${t.g}</td><td>${t.w}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${t.gf - t.ga}</td><td>${t.pts}</td></tr>`).join("");
  q("#startPlayoffs").textContent = rank > 10 ? "Termina stagione" : "Vai alla fase finale";
  show("recap");
}

function startPlayoffs() {
  const rank = ranking().findIndex((x) => x.user) + 1;
  S.playoff = 0;
  S.pendingPlayoff = null;
  if (rank > 10) {
    location.reload();
    return;
  }
  S.playoffStages = rank >= 7
    ? ["PLAY-IN", "QUARTI DI FINALE", "SEMIFINALE", "FINALE"]
    : ["QUARTI DI FINALE", "SEMIFINALE", "FINALE"];
  renderPlayoffMatchup();
}

function choosePlayoffOpponent() {
  const rankedCpu = ranking().filter((x) => !x.user);
  const stage = S.playoffStages[S.playoff];
  let pool;
  if (stage === "PLAY-IN") pool = rankedCpu.slice(6, 10);
  else if (stage === "QUARTI DI FINALE") pool = rankedCpu.slice(0, 7);
  else if (stage === "SEMIFINALE") pool = rankedCpu.slice(0, 5);
  else pool = rankedCpu.slice(0, 3);
  return rnd(pool.length ? pool : rankedCpu);
}

function renderPlayoffMatchup() {
  const stage = S.playoffStages[S.playoff];
  const opp = choosePlayoffOpponent();
  S.pendingPlayoff = opp;
  q("#playoffTitle").textContent = stage;
  q("#playoffBody").innerHTML = `<div class="versus">${S.name} &nbsp; VS &nbsp; ${opp.name}</div><div class="stats-grid"><div class="stat"><b>${strength()}</b><small>OVR ${S.name}</small></div><div class="stat"><b>${opp.strength}</b><small>OVR ${opp.name}</small></div></div><p class="center muted">La partita verrà mostrata con cronometro, eventi, gol e statistiche come nella Regular Season.</p>`;
  q("#playoffNext").textContent = "Gioca partita";
  show("playoffs");
}

function beginPlayoffMatch() {
  const opp = S.pendingPlayoff;
  if (!opp) return;
  startLiveMatch(opp.name, opp.strength, "playoff", S.playoffStages[S.playoff]);
}

boot();
