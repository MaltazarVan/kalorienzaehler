// app.js – das Gehirn der App.
// Hier passiert alles, was du siehst und tippst: Tabs wechseln, Tage blättern,
// Essen loggen & löschen, Tagesziel + Fortschrittsbalken, Lebensmittel anlegen.

const $ = id => document.getElementById(id);

let foods = [];                // deine Lebensmittel (aus der Datenbox)
let currentDay = new Date();   // der Tag, den du gerade ansiehst

/* ---------- kleine Helfer ---------- */

// Macht aus einem Datum eine feste Schreibweise wie "2026-10-31" (Speicher-Schlüssel)
function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Erzeugt eine kleine, fast eindeutige Nummer für jeden Eintrag
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Macht Namen aus dem Eingabefeld unschädlich für die Anzeige (z. B. ein "<")
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&", "<": "<", ">": ">", '"': "&quot;", "'": "&#39;" }[c]));

function fmtDate(d) {
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/* ---------- Tabs umschalten ---------- */

function showView(name) {
  $("view-today").classList.toggle("hidden", name !== "today");
  $("view-foods").classList.toggle("hidden", name !== "foods");
  $("tab-today").classList.toggle("active", name === "today");
  $("tab-foods").classList.toggle("active", name === "foods");
}

$("tab-today").addEventListener("click", () => showView("today"));
$("tab-foods").addEventListener("click", () => { renderFoods(); showView("foods"); });

/* ---------- Tagesziel & Fortschrittsbalken ---------- */

// Holt dein Ziel aus der Datenbox (falls schon eines gesetzt ist)
function getGoal() {
  return DB.get("settings", "goal").then(s => (s && s.value > 0) ? s.value : null);
}

$("set-goal").addEventListener("click", async () => {
  const v = parseInt($("goal-input").value, 10);
  if (!v || v <= 0) { alert("Bitte gib eine Zahl ein, z. B. 2000"); return; }
  await DB.put("settings", { key: "goal", value: v });
  loadDay(); // Balken und Anzeige sofort neu berechnen
});

/* ---------- Tage blättern (Pfeile ← →) ---------- */

$("prev-day").addEventListener("click", () => { currentDay.setDate(currentDay.getDate() - 1); loadDay(); });
$("next-day").addEventListener("click", () => { currentDay.setDate(currentDay.getDate() + 1); loadDay(); });

// Lädt den gerade angezeigten Tag aus der Datenbox
async function loadDay() {
  const key = dateKey(currentDay);
  $("day-label").textContent = (key === dateKey()) ? "Heute" : fmtDate(currentDay);
  const rec = await DB.get("entries", key);
  renderDay(rec && rec.items ? rec.items : []);
}

// Zeichnet die Tagesansicht: Summe, Zielbalken und die Eintragsliste
async function renderDay(items) {
  const total = items.reduce((sum, e) => sum + e.kcal, 0);
  const goal = (await getGoal()) || 0;

  // Zielfeld beim ersten Öffnen befüllen, falls schon ein Ziel gespeichert ist
  if (!$("goal-input").value && goal > 0) $("goal-input").value = String(goal);

  $("total-label").textContent = `Gesamt: ${total} kcal`;

  if (goal > 0) {
    const rest = goal - total;
    $("remaining-label").textContent = rest >= 0 ? `Noch ${rest}` : `${-rest} über Ziel`;
    $("goal-fill").style.width = Math.min(100, (total / goal) * 100) + "%";
    $("goal-bar").classList.toggle("over", total > goal); // Balken wird rot bei Überschreitung
  } else {
    $("remaining-label").textContent = "Kein Ziel gesetzt";
    $("goal-fill").style.width = "0%";
    $("goal-bar").classList.remove("over");
  }

  // Die Liste der Einträge für diesen Tag
  const list = $("entry-list");
  if (!items.length) {
    list.innerHTML = '<p class="empty">Noch nichts geloggt – wähle ein Lebensmittel und tippe „Loggen".</p>';
    return;
  }

  const key = dateKey(currentDay); // wird beim Löschen unten gebraucht
  list.innerHTML = items.map((e, i) => `
    <li>
      <span class="entry-name">${esc(e.name)}</span>
      <span class="entry-kcal">${e.kcal} kcal</span>
      <button data-i="${i}" title="Eintrag löschen">×</button>
    </li>`).join("");

  // Jeder „×"-Button löscht seinen Eintrag
  list.querySelectorAll("button[data-i]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const rec = await DB.get("entries", key);
      if (!rec) return;
      rec.items.splice(parseInt(btn.dataset.i, 10), 1);
      await DB.put("entries", rec);
      loadDay(); // Anzeige aktualisieren
    });
  });
}

/* ---------- Essen loggen (die „Loggen"-Taste) ---------- */

// Füllt das Auswahl-Feld mit allen Lebensmitteln aus der Datenbox
function fillFoodSelect() {
  const sel = $("food-select");
  if (!sel) return;
  sel.innerHTML = '<option value="">– Lebensmittel wählen –</option>' +
    foods.map(f => `<option value="${f.id}">${esc(f.name)} · ${f.kcal} kcal</option>`).join("");
}

$("log-btn").addEventListener("click", async () => {
  const id = $("food-select").value;
  const food = foods.find(f => f.id === id);
  if (!food) { alert("Wähle zuerst ein Lebensmittel aus der Auswahl."); return; }

  const key = dateKey(currentDay);
  let rec = await DB.get("entries", key);
  if (!rec) rec = { date: key, items: [] }; // Tag existiert noch nicht? Dann neu anlegen.
  rec.items.push({ id: uid(), name: food.name, kcal: food.kcal });
  await DB.put("entries", rec);
  loadDay(); // neuer Eintrag + neuer Balken in der Anzeige
});

/* ---------- Lebensmittel verwalten (Tab „Lebensmittel") ---------- */

async function renderFoods() {
  const list = $("food-list");
  if (!list) return;
  if (!foods.length) {
    list.innerHTML = '<p class="empty">Noch keine Lebensmittel – lege unten das erste an.</p>';
    return;
  }
  list.innerHTML = foods.map(f => `
    <li>
      <span>${esc(f.name)}</span>
      <span class="entry-kcal">${f.kcal} kcal</span>
      <button data-id="${f.id}" title="Lebensmittel löschen">×</button>
    </li>`).join("");

  // „×" löscht das Lebensmittel überall (auch aus dem Auswahl-Feld)
  list.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await DB.del("foods", btn.dataset.id);
      foods = (await DB.getAll("foods")).sort((a, b) => a.name.localeCompare(b.name, "de"));
      fillFoodSelect();
      renderFoods();
    });
  });
}

// Neues Lebensmittel anlegen
$("add-food-btn").addEventListener("click", async () => {
  const name = $("food-name").value.trim();
  const kcal = parseInt($("food-kcal").value, 10);
  if (!name) { alert('Gib einen Namen ein – am besten mit Menge, z. B. „Haferflocken (40 g)"'); return; }
  if (!kcal || kcal <= 0) { alert("Gib die Kalorien als Zahl ein, z. B. 150."); return; }
  await DB.put("foods", { id: uid(), name, kcal });

  $("food-name").value = "";   // Formular leeren für das nächste
  $("food-kcal").value = "";

  foods = (await DB.getAll("foods")).sort((a, b) => a.name.localeCompare(b.name, "de"));
  fillFoodSelect();
  renderFoods();
});

/* ---------- Startdaten beim allerersten Öffnen ---------- */

// Damit du sofort testen kannst: Beim aller ersten Mal legt die App
// sechs Beispiel-Lebensmittel an. Nur dann – danach bleibt alles bei dir.
async function ensureSeedFoods() {
  const all = await DB.getAll("foods");
  if (all.length > 0) { foods = all; return; } // schon etwas da? Dann nichts anfassen.
  const seed = [
    ["Haferflocken (40 g)", 150],
    ["Reis gekocht (200 g)", 230],
    ["Ei (1 Stück, ca. 60 g)", 90],
    ["Brot mager (1 Scheibe, 50 g)", 85],
    ["Apfel (1 mittel, ca. 200 g)", 100],
    ["Magerquark (150 g)", 130]
  ];
  for (const [name, kcal] of seed) {
    await DB.put("foods", { id: uid(), name, kcal });
  }
  foods = (await DB.getAll("foods")).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/* ---------- Offline-Versicherung anbinden ---------- */
// sw.js kommt gleich als Datei Nr. 4 – bis sie im Depot liegt, ist eine
// kleine Meldung unten in der Browser-Konsole harmlos und verschwindet dann.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---------- Los geht's! ---------- */

(async () => {
  try {
    await ensureSeedFoods(); // nur beim allerersten Mal wirklich etwas tun
    fillFoodSelect();        // Auswahl-Feld befüllen
    loadDay();               // Tagesansicht anzeigen
  } catch (err) {
    alert("Hmm, da ist etwas schiefgelaufen: " + err.message);
  }
})();
