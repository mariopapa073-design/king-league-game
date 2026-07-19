"use strict";

const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];

let PLAYERS = [];
let TEAMS = [];

const S = {
  difficulty: "normal",
  formation: "2-2-2",
  skips: 2,
  slots: [],
  used: new Set(),
  selected: null,
  draw: null,
  name: "La tua squadra",
  speed: "normal",
  round: 0,
  standings: [],
  schedule: [],
  live: null,
  playoff: 0,
  playoffStages: [],
  lastWin: false,
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
      fetch("data/players.json").then((r) => r.json()),
      fetch("data/teams.json").then((r) => r.json()),
    ]);
  } catch (e) {
    alert("Errore caricamento database. Apri il gioco tramite GitHub Pages o un server locale.");
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
  q("#changeTeam").onclick = () => changeDraw("team");
  q("#changeEdition").onclick = () => changeDraw("edition");
  q("#openPlayers").onclick = openPlayers;
  q("#startSeason").onclick = startSeason;
  q("#playMatch").onclick = playMatch;
  q("#simRound").onclick = simulateCurrentRound;
  q("#simAll").onclick = simulateAll;
  q("#liveSpeed").onchange = (e) => S.speed = e.target.value;
  q("#pause").onclick = togglePause;
  q("#skipMatch").onclick = skipMatch;
  q("#continue").onclick = () => { S.round++; renderSeason(); };
  q("#playoffNext").onclick = nextPlayoff;
}

function select(parent, b, key) {
  qa(parent + " button").forEach((x) => x.classList.remove("selected"));
  b.classList.add("selected");
  S[key] = b.dataset.value;
}

function startDraft() {
  S.skips = { easy: 3, normal: 2, hard: 1 }[S.difficulty];
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
  S.draw = { team: p.team, edition: p.edition };
  renderDraw();
}

function renderDraw() {
  q("#drawTeam").textContent = S.draw.team;
  q("#drawEdition").textContent = S.draw.edition;
  qa(".skipMirror").forEach((x) => x.textContent = S.skips);
  q("#changeTeam").disabled = q("#changeEdition").disabled = S.skips <= 0;
}

function changeDraw(k) {
  if (S.skips <= 0) return;
  S.skips--;
  const role = S.slots[S.selected].role;
  let pool = available(role).filter((p) => p[k] !== S.draw[k]);
  if (!pool.length) pool = available(role);
  const p = rnd(pool);
  S.draw[k] = p[k];
  ensureDraw();
  renderDraw();
}

function ensureDraw() {
  const role = S.slots[S.selected].role;
  const pool = available(role).filter((p) => p.team === S.draw.team && p.edition === S.draw.edition);
  if (!pool.length) {
    const p = rnd(available(role));
    S.draw = { team: p.team, edition: p.edition };
  }
}

function openPlayers() {
  ensureDraw();
  const role = S.slots[S.selected].role;
  const pool = available(role).filter((p) => p.team === S.draw.team && p.edition === S.draw.edition);
  q("#playersContext").textContent = S.draw.team + " · " + S.draw.edition;
  q("#playersRole").textContent = role;
  q("#playerGrid").innerHTML = pool.map((p) => `<button class="player-card" data-player="${p.id}"><div class="portrait"><b>${ini(p.name)}</b>${S.difficulty === "hard" ? "" : `<span class="ovr">${p.overall}</span>`}</div><div class="player-info"><b>${p.name}</b><small>${p.role} · ${p.team} · ${p.edition}</small></div></button>`).join("");
  qa("[data-player]").forEach((b) => b.onclick = () => pick(b.dataset.player));
  show("players");
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
  q("#squadList").innerHTML = ps.map((p) => `<div class="row"><div><b>${p.name}</b><small> ${p.team} · ${p.edition}</small></div><b>${p.role} · ${p.overall}</b></div>`).join("");
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
  if (S.round >= S.schedule.length) return startPlayoffs();
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
  startPlayoffs();
}

function playMatch() {
  const opp = currentOpponent();
  const O = S.standings.find((x) => x.name === opp);
  S.live = { opp, os: O.strength, m: 0, h: 0, a: 0, paused: false, done: false, timer: null, goals: [], shots: [0, 0], saves: [0, 0] };
  q("#liveRound").textContent = "GIORNATA " + (S.round + 1);
  q("#liveTeams").textContent = S.name + " vs " + opp;
  q("#feed").innerHTML = "";
  q("#liveSpeed").value = S.speed;
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

function phase(m) {
  return ({
    0: ["0' 🟢 <b>Inizio Escalado</b>", "special"],
    5: ["5' ✅ Squadre al completo", "special"],
    17: ["17' ⭐ <b>Goal x2</b>", "special"],
    20: ["20' 🎲 <b>Fase del dado</b>", "special"],
    23: ["23' 🔁 Fine dado", "special"],
    36: ["36' 🔻 <b>Matchball / Descalado</b>", "danger-event"],
    40: ["40' 🏁 Fine", "special"],
  })[m];
}

function scheduleLive() {
  clearTimeout(S.live.timer);
  if (!S.live.paused && !S.live.done) S.live.timer = setTimeout(step, wait());
}

function step() {
  const L = S.live;
  const m = L.m;
  const p = phase(m);
  if (p) addEvent(...p);

  const phaseChance = m < 5 ? 0.26 : (m >= 20 && m < 23 ? 0.36 : (m >= 36 ? 0.31 : 0.18));
  if (m > 0 && m < 40 && Math.random() < phaseChance) {
    const userChance = strength() / (strength() + L.os);
    const user = Math.random() < userChance;
    const idx = user ? 0 : 1;
    L.shots[idx]++;
    const finishing = Math.max(0.34, Math.min(0.55, 0.43 + (user ? strength() - L.os : L.os - strength()) * 0.006));
    if (Math.random() < finishing) {
      const value = m >= 17 && m < 20 ? 2 : 1;
      if (user) L.h += value; else L.a += value;
      const scorers = S.slots.filter((x) => x.player.role !== "POR");
      const scorer = user ? rnd(scorers).player.name : "Giocatore avversario";
      L.goals.push({ m, scorer, user, value });
      addEvent(`${m}' ⚽ <b>GOOOL${value === 2 ? " x2" : ""}</b> · ${scorer} · ${L.h}-${L.a}`, "goal");
    } else {
      L.saves[user ? 1 : 0]++;
      addEvent(`${m}' 🧤 Parata decisiva`);
    }
  } else if (m > 5 && m < 40 && Math.random() < 0.11) {
    addEvent(`${m}' ⚠️ Occasione per ${Math.random() < 0.5 ? S.name : L.opp}`);
  }

  L.m++;
  updateLive();
  if (L.m > 40) return finish();
  scheduleLive();
}

function updateLive() {
  const L = S.live;
  q("#score").textContent = L.h + " - " + L.a;
  q("#clock").textContent = Math.min(L.m, 40) + "'";
  q("#phaseFill").style.width = (Math.min(L.m, 40) / 40 * 100) + "%";
}

function togglePause() {
  S.live.paused = !S.live.paused;
  q("#pause").textContent = S.live.paused ? "Riprendi" : "Pausa";
  if (!S.live.paused) scheduleLive();
}

function skipMatch() {
  clearTimeout(S.live.timer);
  const wasPaused = S.live.paused;
  S.live.paused = true;
  while (!S.live.done && S.live.m <= 40) step();
  S.live.paused = wasPaused;
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
  const winner = tied ? shootoutWinner(strength(), L.os) : (L.h > L.a ? S.name : L.opp);
  apply(S.name, L.opp, L.h, L.a, winner);
  simulateOthers();
  q("#finalResult").textContent = `${S.name} ${L.h}-${L.a} ${L.opp}${tied ? ` · shootout: ${winner}` : ""}`;
  const poss = Math.max(38, Math.min(62, Math.round(50 + (strength() - L.os) / 2 + Math.random() * 8 - 4)));
  q("#matchStats").innerHTML = [["Tiri", L.shots.join("-")], ["Possesso", poss + "%-" + (100 - poss) + "%"], ["Parate", L.saves.join("-")], ["MVP", (L.goals.find((x) => x.user) || {}).scorer || rnd(S.slots).player.name]].map((x) => `<div class="stat"><b>${x[1]}</b><small>${x[0]}</small></div>`).join("");
  q("#goalList").innerHTML = L.goals.length ? L.goals.map((g) => `<div class="row"><b>${g.m}' ${g.scorer}${g.value === 2 ? " (x2)" : ""}</b><small>${g.user ? S.name : L.opp}</small></div>`).join("") : `<div class="row"><b>Nessun gol</b></div>`;
  show("result");
}

function playoffMatch(opponent) {
  const userStrength = strength();
  const [us, them] = simulateScore(userStrength, opponent.strength);
  let winner;
  let shootout = false;
  if (us === them) {
    shootout = true;
    winner = Math.random() < userStrength / (userStrength + opponent.strength) ? S.name : opponent.name;
  } else winner = us > them ? S.name : opponent.name;
  return { us, them, winner, shootout, win: winner === S.name };
}

function startPlayoffs() {
  const rank = ranking().findIndex((x) => x.user) + 1;
  S.playoff = 0;
  if (rank > 10) {
    S.playoffStages = [];
  } else if (rank >= 7) {
    S.playoffStages = ["PLAY-IN", "QUARTI DI FINALE", "SEMIFINALE", "FINALE"];
  } else {
    S.playoffStages = ["QUARTI DI FINALE", "SEMIFINALE", "FINALE"];
  }
  renderPlayoff();
  show("playoffs");
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

function renderPlayoff() {
  const rank = ranking().findIndex((x) => x.user) + 1;
  if (!S.playoffStages.length) {
    q("#playoffTitle").textContent = "STAGIONE TERMINATA";
    q("#playoffBody").innerHTML = `<div class="champion"><h3>${rank}° posto</h3><p>Non qualificato ai playoff.</p></div>`;
    q("#playoffNext").textContent = "Nuovo draft";
    S.playoff = 99;
    return;
  }

  const stage = S.playoffStages[S.playoff];
  const opp = choosePlayoffOpponent();
  const result = playoffMatch(opp);
  q("#playoffTitle").textContent = stage;
  q("#playoffBody").innerHTML = `<div class="row"><b>${S.name}</b><strong>${result.us}</strong></div><div class="row"><b>${opp.name}</b><strong>${result.them}</strong></div>${result.shootout ? `<div class="row"><small>Vincitore shootout</small><b>${result.winner}</b></div>` : ""}${result.win && stage === "FINALE" ? `<div class="champion"><h2>🏆 CAMPIONE!</h2></div>` : ""}`;
  S.lastWin = result.win;
  q("#playoffNext").textContent = result.win && stage !== "FINALE" ? "Continua" : "Nuovo draft";
}

function nextPlayoff() {
  if (S.playoff === 99 || !S.lastWin || S.playoff === S.playoffStages.length - 1) return location.reload();
  S.playoff++;
  renderPlayoff();
}

boot();
