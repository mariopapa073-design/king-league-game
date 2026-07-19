
"use strict";
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
let PLAYERS=[],TEAMS=[];
const S={
 difficulty:"normal",formation:"2-2-2",skips:2,slots:[],used:new Set(),selected:null,draw:null,
 name:"La tua squadra",speed:"normal",round:0,standings:[],schedule:[],live:null,playoff:0
};
const FORMATIONS={"2-2-2":["POR","DIF","DIF","CEN","CEN","ATT","ATT"],"3-1-2":["POR","DIF","DIF","DIF","CEN","ATT","ATT"],"2-1-3":["POR","DIF","DIF","CEN","ATT","ATT","ATT"]};
const positions={"2-2-2":[[50,90],[29,69],[71,69],[28,44],[72,44],[30,19],[70,19]],"3-1-2":[[50,90],[20,68],[50,72],[80,68],[50,43],[31,18],[69,18]],"2-1-3":[[50,90],[30,69],[70,69],[50,45],[18,18],[50,16],[82,18]]};
function show(id){qa(".screen").forEach(x=>x.classList.remove("active"));q("#"+id).classList.add("active");scrollTo(0,0)}
function rnd(a){return a[Math.floor(Math.random()*a.length)]}
function ini(n){return n.split(/\s+/).map(x=>x[0]).join("").slice(0,3).toUpperCase()}
async function boot(){
 try{
  [PLAYERS,TEAMS]=await Promise.all([fetch("data/players.json").then(r=>r.json()),fetch("data/teams.json").then(r=>r.json())]);
 }catch(e){
  alert("Errore caricamento database. Apri il gioco tramite GitHub Pages, non dall'anteprima File.");
  console.error(e);return;
 }
 bind();
}
function bind(){
 qa("#difficulty button").forEach(b=>b.onclick=()=>select("#difficulty",b,"difficulty"));
 qa("#formation button").forEach(b=>b.onclick=()=>select("#formation",b,"formation"));
 q("#startDraft").onclick=startDraft;
 qa("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));
 q("#changeTeam").onclick=()=>changeDraw("team");q("#changeEdition").onclick=()=>changeDraw("edition");
 q("#openPlayers").onclick=openPlayers;q("#startSeason").onclick=startSeason;q("#playMatch").onclick=playMatch;
 q("#simRound").onclick=simulateCurrentRound;q("#simAll").onclick=simulateAll;
 q("#liveSpeed").onchange=e=>S.speed=e.target.value;
 q("#pause").onclick=togglePause;q("#skipMatch").onclick=skipMatch;q("#continue").onclick=()=>{S.round++;renderSeason()};
 q("#playoffNext").onclick=nextPlayoff;
}
function select(parent,b,key){qa(parent+" button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");S[key]=b.dataset.value}
function startDraft(){S.skips={easy:3,normal:2,hard:1}[S.difficulty];S.slots=FORMATIONS[S.formation].map(role=>({role,player:null}));S.used=new Set();renderPitch();show("draft")}
function renderPitch(){
 q("#formationText").textContent=S.formation;q("#skipText").textContent=S.skips;qa(".skipMirror").forEach(x=>x.textContent=S.skips);
 q("#pitch").innerHTML=S.slots.map((s,i)=>{let p=s.player,[x,y]=positions[S.formation][i];return `<button class="slot ${p?"filled":""}" data-slot="${i}" style="left:${x}%;top:${y}%">${p?`<span class="ini">${ini(p.name)}</span><span class="info">${p.name}<br>${p.role} · ${S.difficulty==="hard"?"?":p.overall}</span>`:`<span><b class="plus">+</b><br><b class="role">${s.role}</b></span>`}</button>`}).join("");
 qa("[data-slot]").forEach(b=>b.onclick=()=>{let i=+b.dataset.slot;if(!S.slots[i].player)openDraw(i)});
}
function available(role){return PLAYERS.filter(p=>p.role===role&&!S.used.has(p.id))}
function openDraw(i){S.selected=i;randomDraw();q("#drawRole").textContent=S.slots[i].role;show("draw")}
function randomDraw(){
 let pool=available(S.slots[S.selected].role);if(!pool.length)return alert("Nessun giocatore disponibile.");
 let p=rnd(pool);S.draw={team:p.team,edition:p.edition};renderDraw();
}
function renderDraw(){q("#drawTeam").textContent=S.draw.team;q("#drawEdition").textContent=S.draw.edition;qa(".skipMirror").forEach(x=>x.textContent=S.skips);q("#changeTeam").disabled=q("#changeEdition").disabled=S.skips<=0}
function changeDraw(k){
 if(S.skips<=0)return;S.skips--;
 let role=S.slots[S.selected].role,pool=available(role).filter(p=>p[k]!==S.draw[k]);if(!pool.length)pool=available(role);
 let p=rnd(pool);S.draw[k]=p[k];ensureDraw();renderDraw()
}
function ensureDraw(){
 let role=S.slots[S.selected].role,pool=available(role).filter(p=>p.team===S.draw.team&&p.edition===S.draw.edition);
 if(!pool.length){let p=rnd(available(role));S.draw={team:p.team,edition:p.edition}}
}
function openPlayers(){
 ensureDraw();let role=S.slots[S.selected].role,pool=available(role).filter(p=>p.team===S.draw.team&&p.edition===S.draw.edition);
 q("#playersContext").textContent=S.draw.team+" · "+S.draw.edition;q("#playersRole").textContent=role;
 q("#playerGrid").innerHTML=pool.map(p=>`<button class="player-card" data-player="${p.id}"><div class="portrait"><b>${ini(p.name)}</b>${S.difficulty==="hard"?"":`<span class="ovr">${p.overall}</span>`}</div><div class="player-info"><b>${p.name}</b><small>${p.role} · ${p.team} · ${p.edition}</small></div></button>`).join("");
 qa("[data-player]").forEach(b=>b.onclick=()=>pick(b.dataset.player));show("players")
}
function pick(id){let p=PLAYERS.find(x=>x.id===id);S.slots[S.selected].player=p;S.used.add(id);renderPitch();S.slots.every(x=>x.player)?summary():show("draft")}
function summary(){
 let ps=S.slots.map(x=>x.player),avg=Math.round(ps.reduce((a,p)=>a+p.overall,0)/ps.length),by=r=>{let z=ps.filter(p=>p.role===r);return z.length?Math.round(z.reduce((a,p)=>a+p.overall,0)/z.length):0};
 q("#teamStats").innerHTML=[["OVR",avg],["POR",by("POR")],["DIF",by("DIF")],["CEN",by("CEN")],["ATT",by("ATT")]].map(x=>`<div class="stat"><b>${S.difficulty==="hard"&&x[0]==="OVR"?"?":x[1]}</b><small>${x[0]}</small></div>`).join("");
 q("#squadList").innerHTML=ps.map(p=>`<div class="row"><div><b>${p.name}</b><small> ${p.team} · ${p.edition}</small></div><b>${p.role}</b></div>`).join("");show("summary")
}
function strength(){return Math.round(S.slots.reduce((a,x)=>a+x.player.overall,0)/S.slots.length)}
function startSeason(){
 S.name=q("#teamName").value.trim()||"La tua squadra";S.speed=q("#preSpeed").value;S.round=0;
 let all=[{name:S.name,strength:strength(),user:true},...TEAMS];S.standings=all.map(t=>({...t,g:0,w:0,l:0,gf:0,ga:0,pts:0}));
 S.schedule=[...TEAMS].sort(()=>Math.random()-.5).slice(0,11).map(t=>t.name);renderSeason()
}
function ranking(){return [...S.standings].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf)}
function renderTable(){q("#tableBody").innerHTML=ranking().map((t,i)=>`<tr class="${t.user?"user-row":""}"><td>${i+1}</td><td>${t.name}</td><td>${t.g}</td><td>${t.w}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${t.gf-t.ga}</td><td>${t.pts}</td></tr>`).join("")}
function renderSeason(){if(S.round>=11)return startPlayoffs();q("#roundTitle").textContent="GIORNATA "+(S.round+1);q("#nextMatch").textContent=S.name+"  VS  "+S.schedule[S.round];renderTable();show("season")}
function goalCount(str){return Math.max(0,Math.round((str-68)/7+Math.random()*3))}
function apply(a,b,ga,gb){
 let A=S.standings.find(x=>x.name===a),B=S.standings.find(x=>x.name===b);
 if(ga===gb){if(Math.random()<.5)ga++;else gb++;}
 A.g++;B.g++;A.gf+=ga;A.ga+=gb;B.gf+=gb;B.ga+=ga;
 if(ga>gb){A.w++;B.l++;A.pts+=3}else{B.w++;A.l++;B.pts+=3}
 return {ga,gb};
}
function simulateOthers(exclude){
 let arr=TEAMS.map(x=>x.name).filter(x=>x!==exclude).sort(()=>Math.random()-.5);
 while(arr.length>1){let a=arr.pop(),b=arr.pop(),A=S.standings.find(x=>x.name===a),B=S.standings.find(x=>x.name===b);apply(a,b,goalCount(A.strength),goalCount(B.strength))}
}
function simulateCurrentRound(){
 let o=S.schedule[S.round],O=S.standings.find(x=>x.name===o);apply(S.name,o,goalCount(strength()),goalCount(O.strength));simulateOthers(o);S.round++;renderSeason()
}
function simulateAll(){
 if(!confirm("Simulare tutte le giornate rimanenti? Non potrai tornare indietro."))return;
 while(S.round<11){let o=S.schedule[S.round],O=S.standings.find(x=>x.name===o);apply(S.name,o,goalCount(strength()),goalCount(O.strength));simulateOthers(o);S.round++}
 startPlayoffs()
}
function playMatch(){
 let opp=S.schedule[S.round],O=S.standings.find(x=>x.name===opp);S.live={opp,os:O.strength,m:0,h:0,a:0,paused:false,done:false,timer:null,goals:[],shots:[0,0],saves:[0,0]};
 q("#liveRound").textContent="GIORNATA "+(S.round+1);q("#liveTeams").textContent=S.name+" vs "+opp;q("#feed").innerHTML="";q("#liveSpeed").value=S.speed;updateLive();show("live");schedule()
}
function wait(){return {slow:1500,normal:700,fast:180}[S.speed]}
function addEvent(t,c=""){q("#feed").insertAdjacentHTML("beforeend",`<div class="event ${c}">${t}</div>`);q("#feed").scrollTop=q("#feed").scrollHeight}
function phase(m){return ({0:["0' 🟢 <b>Inizio Escalado</b>","special"],5:["5' ✅ Squadre al completo","special"],17:["17' ⭐ <b>Goal x2</b>","special"],20:["20' 🎲 <b>Fase del dado</b>","special"],23:["23' 🔁 Fine dado","special"],36:["36' 🔻 <b>Matchball / Descalado</b>","danger-event"],40:["40' 🏁 Fine","special"]})[m]}
function schedule(){clearTimeout(S.live.timer);if(!S.live.paused&&!S.live.done)S.live.timer=setTimeout(step,wait())}
function step(){
 let L=S.live,m=L.m,p=phase(m);if(p)addEvent(...p);
 let chance=m<5?.28:(m>=20&&m<23?.35:(m>=36?.30:.18));
 if(m>0&&m<40&&Math.random()<chance){
   let user=Math.random()<strength()/(strength()+L.os),idx=user?0:1;L.shots[idx]++;
   if(Math.random()<.43){let value=m>=17&&m<20?2:1;if(user)L.h+=value;else L.a+=value;let scorer=user?rnd(S.slots.filter(x=>x.player.role!=="POR")).player.name:"Giocatore avversario";L.goals.push({m,scorer,user,value});addEvent(`${m}' ⚽ <b>GOOOL${value===2?" x2":""}</b> · ${scorer} · ${L.h}-${L.a}`,"goal")}else{L.saves[user?1:0]++;addEvent(`${m}' 🧤 Parata decisiva`)}
 }else if(m>5&&m<40&&Math.random()<.11)addEvent(`${m}' ⚠️ Occasione per ${Math.random()<.5?S.name:L.opp}`);
 L.m++;updateLive();if(L.m>40)return finish();schedule()
}
function updateLive(){let L=S.live;q("#score").textContent=L.h+" - "+L.a;q("#clock").textContent=Math.min(L.m,40)+"'";q("#phaseFill").style.width=(Math.min(L.m,40)/40*100)+"%"}
function togglePause(){S.live.paused=!S.live.paused;q("#pause").textContent=S.live.paused?"Riprendi":"Pausa";if(!S.live.paused)schedule()}
function skipMatch(){clearTimeout(S.live.timer);while(!S.live.done&&S.live.m<=40)step()}
function finish(){
 let L=S.live;if(L.done)return;L.done=true;clearTimeout(L.timer);let regulationTie=L.h===L.a,res=apply(S.name,L.opp,L.h,L.a);L.h=res.ga;L.a=res.gb;simulateOthers(L.opp);
 q("#finalResult").textContent=`${S.name} ${L.h}-${L.a} ${L.opp}${regulationTie?" · dopo shootout":""}`;
 let poss=Math.max(38,Math.min(62,Math.round(50+(strength()-L.os)/2+Math.random()*8-4)));
 q("#matchStats").innerHTML=[["Tiri",L.shots.join("-")],["Possesso",poss+"%-"+(100-poss)+"%"],["Parate",L.saves.join("-")],["MVP",(L.goals.find(x=>x.user)||{}).scorer||rnd(S.slots).player.name]].map(x=>`<div class="stat"><b>${x[1]}</b><small>${x[0]}</small></div>`).join("");
 q("#goalList").innerHTML=L.goals.length?L.goals.map(g=>`<div class="row"><b>${g.m}' ${g.scorer}${g.value===2?" (x2)":""}</b><small>${g.user?S.name:L.opp}</small></div>`).join(""):`<div class="row"><b>Nessun gol</b></div>`;show("result")
}
function startPlayoffs(){S.playoff=0;renderPlayoff();show("playoffs")}
function renderPlayoff(){
 let rank=ranking().findIndex(x=>x.user)+1,labels=["PLAY-IN","QUARTI DI FINALE","SEMIFINALE","FINALE"];
 if(rank>10&&S.playoff===0){q("#playoffTitle").textContent="STAGIONE TERMINATA";q("#playoffBody").innerHTML=`<div class="champion"><h3>${rank}° posto</h3><p>Non qualificato.</p></div>`;q("#playoffNext").textContent="Nuovo draft";S.playoff=99;return}
 let opp=rnd(TEAMS),win=Math.random()<strength()/(strength()+opp.strength),us=2+Math.floor(Math.random()*5),them=win?Math.max(0,us-1):us+1;
 q("#playoffTitle").textContent=labels[S.playoff];q("#playoffBody").innerHTML=`<div class="row"><b>${S.name}</b><strong>${win?us:them}</strong></div><div class="row"><b>${opp.name}</b><strong>${win?them:us}</strong></div>${win&&S.playoff===3?`<div class="champion"><h2>🏆 CAMPIONE!</h2></div>`:""}`;
 S.lastWin=win;q("#playoffNext").textContent=win&&S.playoff<3?"Continua":"Nuovo draft"
}
function nextPlayoff(){if(S.playoff===99||!S.lastWin||S.playoff===3)return location.reload();S.playoff++;renderPlayoff()}
boot();
