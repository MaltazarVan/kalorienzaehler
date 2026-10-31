// db.js – die „Datenbox" der App.
// Hier liegen ALLE deine Daten lokal im Handy-Browser (IndexedDB).
// Drei Fächer:
//   foods    -> deine Lebensmittel (jedes mit eigener Nummer = id)
//   entries  -> deine Tageslisten, eine pro Tag (Schlüssel = Datum)
//   settings -> Einstellungen wie dein Kalorienziel

const DB = (() => {
  const NAME = "kalorienzaehler";   // Name der Datenbox
  const VERSION = 1;                // bei Strukturänderungen hochzählen
  let dbp = null;                   // geöffnete Verbindung wiederverwenden

  function open() {
    if (dbp) return dbp;            // schon offen? Dann die bestehende nehmen.
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;      // läuft nur beim allerersten Öffnen einmalig
        if (!db.objectStoreNames.contains("foods")) {
          db.createObjectStore("foods", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("entries")) {
          db.createObjectStore("entries", { keyPath: "date" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  // Hilfsfunktion: führt einen Befehl in einem Fach aus und liefert das Ergebnis zurück
  function withStore(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      let result;
      try {
        result = fn(t.objectStore(store));
      } catch (e) { reject(e); return; }
      if (!result || typeof result.request === "undefined") { resolve(result); return; }
      t.oncomplete = () => resolve(result.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  // Die vier „Türen", die der Rest der App benutzt:
  return {
    get: (store, key)  => withStore(store, "readonly", s => s.get(key)),     // einen Eintrag holen
    getAll: store      => withStore(store, "readonly", s => s.getAll()),     // alles aus einem Fach holen
    put: (store, value)=> withStore(store, "readwrite", s => s.put(value)),  // speichern/aktualisieren
    del: (store, key)  => withStore(store, "readwrite", s => s.delete(key))  // löschen
  };
})();
