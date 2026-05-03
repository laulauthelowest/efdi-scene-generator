// scripts/efdi-scene-generator.mjs
// EFDI Scene Generator – Foundry VTT Modul
// Getesteter Code direkt aus der Foundry-Konsole

const MODULE_ID = "efdi-scene-generator";

// ── Prompt-Vorlagen ─────────────────────────────────────────────
const STYLE_PROMPTS = {
  jungle:    "lush prehistoric jungle, dramatic lighting, ancient trees, dense foliage, mysterious atmosphere, cinematic wide shot, photorealistic",
  scifi:     "abandoned high-tech facility, dark corridors, flickering emergency lights, broken equipment, sci-fi thriller atmosphere",
  horror:    "dark and threatening environment, eerie fog, danger lurking in shadows, tense horror atmosphere",
  painterly: "epic fantasy painting style, dramatic clouds, wide landscape, highly detailed, concept art, matte painting",
  realistic: "photorealistic, wide angle lens, natural lighting, highly detailed, 8k resolution"
};

const LOCATION_HINTS = {
  "vulkan":       "volcanic crater with glowing lava, smoke and ash, dangerous rocky terrain",
  "dschungel":    "dense prehistoric jungle with massive trees, hanging vines, dappled light",
  "strand":       "tropical beach with dramatic cliffs, dark stormy ocean, scattered debris",
  "labor":        "abandoned scientific laboratory, broken glass tanks, overturned equipment",
  "sumpf":        "murky swamp at dusk, twisted trees, fog over still water",
  "berg":         "dramatic mountain peak above clouds, pterosaurs circling",
  "ruinen":       "ancient stone ruins overgrown with jungle, mysterious carvings",
  "see":          "dark prehistoric lake, massive underwater shadow, misty shores",
  "radioturm":    "rusted radio tower on a cliff, stormy sky",
  "brutanlage":   "dinosaur hatchery with cracked eggs, warm incubator glow",
  "zeitanomalie": "swirling purple temporal anomaly, crackling energy, distorted reality",
  "gehege":       "massive broken dinosaur enclosure, bent fences, footprints in mud",
  "kraftwerk":    "underground power plant with steam pipes, emergency lighting",
  "komplex":      "abandoned research complex, overgrown with vines, broken windows",
  "kontrollraum": "abandoned control room with dozens of screens, flickering monitors"
};

function buildPrompt(sceneName, style, extra) {
  const styleSuffix = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.jungle;
  const lower = sceneName.toLowerCase().replace(/[^\w\säöüß]/gi, "").trim();
  let hint = "";
  for (const [k, v] of Object.entries(LOCATION_HINTS)) {
    if (lower.includes(k)) { hint = v + ", "; break; }
  }
  return `Escape from Dino Island tabletop RPG scene background, ${hint}${sceneName}${extra ? ", " + extra : ""}, dinosaurs may be present, ${styleSuffix}, no text, no UI, no watermarks, landscape orientation`;
}

// ── Persistenter State ──────────────────────────────────────────
const STATE = {
  lastB64:       null,
  lastDataUrl:   null,
  lastSceneName: "",
  history:       []
};

// ── Bild zu Foundry hochladen (getesteter Code) ─────────────────
async function uploadToFoundry(b64, name) {
  const base64 = b64.includes(",") ? b64.split(",")[1] : b64;
  const binary  = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "image/png" });

  const safeName = name.replace(/[^\w\s-]/gi, "").replace(/\s+/g, "-").toLowerCase().trim() || "szene";
  const filename  = `efdi-${safeName}-${Date.now()}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
  const uploadPath = `worlds/${game.world.id}/scenes`;
  try { await FP.createDirectory("data", uploadPath, {}); } catch(_) {}

  const result = await FP.upload("data", uploadPath, file, {});
  if (!result?.path) throw new Error("Upload fehlgeschlagen.");
  return result.path;
}

// ── Szene erstellen (getesteter Code) ───────────────────────────
async function createSceneWithBackground(name, path, folderId) {
  const scene = await Scene.create({
    name,
    folder: folderId ?? null,
    width: 1792,
    height: 1024,
    grid: { type: 0, size: 100 },
    backgroundColor: "#1a2a1a",
    levels: [{
      _id: "defaultLevel0000",
      name: "Level",
      elevation: { bottom: 0, top: 20 },
      background: { src: path, color: "#121212", tint: "#ffffff", alphaThreshold: 0.75 },
      foreground: { src: null, tint: "#ffffff", alphaThreshold: 0.75 },
      fog: { src: null, tint: "#ffffff" },
      textures: { anchorX: 0.5, anchorY: 0.5, offsetX: 0, offsetY: 0, fit: "fill", scaleX: 1, scaleY: 1, rotation: 0 },
      visibility: { levels: [] },
      sort: 0,
      flags: {}
    }]
  });
  return scene;
}

// ── Dialog-HTML ─────────────────────────────────────────────────
function buildDialogHtml() {
  const apiKey = game.settings.get(MODULE_ID, "openaiApiKey") ?? "";
  const sceneOptions = game.scenes.map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join("");

  return `
<div class="efdi-sg-wrap">
  <details class="efdi-sg-settings-block">
    <summary>⚙ API Einstellungen</summary>
    <div class="efdi-sg-settings-inner">
      <label>OpenAI API-Key</label>
      <div class="efdi-sg-key-row">
        <input type="password" class="efdi-sg-api-key" value="${apiKey}" placeholder="sk-proj-..." autocomplete="off">
        <button type="button" class="efdi-sg-save-key efdi-sg-btn-sec">💾 Speichern</button>
      </div>
      <p class="efdi-sg-hint">Wird nur lokal gespeichert.
        <a href="https://platform.openai.com/api-keys" target="_blank">→ Key erstellen</a>
      </p>
    </div>
  </details>

  <div class="efdi-sg-inputs">
    <div class="efdi-sg-field">
      <label>Szenenname / Ort</label>
      <input type="text" class="efdi-sg-scene-name" placeholder="z.B. Vulkankrater, Dschungel, Labor...">
    </div>
    <div class="efdi-sg-row">
      <div class="efdi-sg-field">
        <label>Stil</label>
        <select class="efdi-sg-style">
          <option value="jungle">🌿 Dschungel-Abenteuer</option>
          <option value="scifi">🔬 Sci-Fi Komplex</option>
          <option value="horror">😱 Horror</option>
          <option value="painterly">🎨 Episches Gemälde</option>
          <option value="realistic">📷 Realistisch</option>
        </select>
      </div>
      <div class="efdi-sg-field">
        <label>Qualität</label>
        <select class="efdi-sg-quality">
          <option value="standard">Standard (~$0.04)</option>
          <option value="hd">HD (~$0.08)</option>
        </select>
      </div>
    </div>
    <div class="efdi-sg-field">
      <label>Zusätzliche Details (optional)</label>
      <input type="text" class="efdi-sg-extra" placeholder="z.B. bei Nacht, verlassen, mit Lavafluss...">
    </div>
    <button type="button" class="efdi-sg-generate efdi-sg-btn-primary">🎨 Bild generieren</button>
  </div>

  <div class="efdi-sg-prompt-section" style="display:none">
    <div class="efdi-sg-prompt-label">Verwendeter Prompt:</div>
    <div class="efdi-sg-prompt-text"></div>
  </div>

  <div class="efdi-sg-loading" style="display:none">
    <div class="efdi-sg-dino">🦕</div>
    <p>DALL-E generiert dein Bild… (ca. 15–25 Sekunden)</p>
  </div>

  <div class="efdi-sg-result" style="display:none">
    <img class="efdi-sg-preview-img" src="" alt="Generiertes Szenenbild">
  </div>

  <div class="efdi-sg-actions" style="display:none">
    <div class="efdi-sg-field">
      <label>Ordner (optional)</label>
      <input type="text" class="efdi-sg-folder" placeholder="z.B. 🌿 Natur">
    </div>
    <div class="efdi-sg-action-row">
      <button type="button" class="efdi-sg-create-scene efdi-sg-btn-primary">✅ Neue Szene anlegen</button>
      <button type="button" class="efdi-sg-regenerate efdi-sg-btn-sec">🔄 Neu</button>
      <button type="button" class="efdi-sg-download efdi-sg-btn-sec">💾</button>
    </div>
    <div class="efdi-sg-field">
      <label>Oder zu bestehender Szene hinzufügen:</label>
      <div class="efdi-sg-row">
        <select class="efdi-sg-existing-scene">
          <option value="">— Szene wählen —</option>
          ${sceneOptions}
        </select>
        <button type="button" class="efdi-sg-add-scene efdi-sg-btn-sec">📌 Hinzufügen</button>
      </div>
    </div>
  </div>

  <div class="efdi-sg-history-block">
    <div class="efdi-sg-history-title">🕐 Zuletzt generiert</div>
    <div class="efdi-sg-history-items"></div>
  </div>
</div>`;
}

// ── Dialog öffnen ───────────────────────────────────────────────
function openSceneGenerator() {
  new Dialog({
    title: "🦕 Szenenbild generieren",
    content: buildDialogHtml(),
    buttons: {},
    render: (html) => {
      const $html = html?.jquery ? html : $(html);
      if (!$html?.length) return;
      const root = $html[0];
      if (!root || typeof root.querySelector !== "function") return;

      const q    = (sel) => root.querySelector(sel);
      const val  = (sel) => q(sel)?.value ?? "";
      const show = (sel, v) => { const el = q(sel); if (el) el.style.display = v; };

      // API Key speichern
      q(".efdi-sg-save-key")?.addEventListener("click", async () => {
        const key = val(".efdi-sg-api-key").trim();
        await game.settings.set(MODULE_ID, "openaiApiKey", key);
        ui.notifications.info("✅ API-Key gespeichert!");
      });

      // Bild generieren
      const doGenerate = async () => {
        const apiKey = game.settings.get(MODULE_ID, "openaiApiKey");
        if (!apiKey) { ui.notifications.warn("Bitte erst API-Key eingeben (⚙)."); return; }
        const name = val(".efdi-sg-scene-name").trim();
        if (!name)  { ui.notifications.warn("Bitte Szenennamen eingeben."); return; }

        const style   = val(".efdi-sg-style")   || "jungle";
        const extra   = val(".efdi-sg-extra").trim();
        const quality = val(".efdi-sg-quality") || "standard";
        const prompt  = buildPrompt(name, style, extra);

        const pText = q(".efdi-sg-prompt-text");
        if (pText) pText.textContent = prompt;
        show(".efdi-sg-prompt-section", "block");

        const genBtn = q(".efdi-sg-generate");
        if (genBtn) { genBtn.disabled = true; genBtn.textContent = "⏳ Generiere..."; }
        show(".efdi-sg-result",  "none");
        show(".efdi-sg-actions", "none");
        show(".efdi-sg-loading", "block");

        try {
          const resp = await fetch("https://api.openai.com/v1/images/generations", {
            method:  "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body:    JSON.stringify({
              model: "dall-e-3", prompt, n: 1,
              size: "1792x1024", quality,
              response_format: "b64_json"
            })
          });

          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error?.message ?? resp.statusText);
          }

          const data    = await resp.json();
          const b64     = data.data[0].b64_json;
          const dataUrl = `data:image/png;base64,${b64}`;

          STATE.lastB64       = b64;
          STATE.lastDataUrl   = dataUrl;
          STATE.lastSceneName = name;
          STATE.history.unshift({ url: dataUrl, name, prompt });
          if (STATE.history.length > 6) STATE.history.pop();

          const img = q(".efdi-sg-preview-img");
          if (img) img.src = dataUrl;
          show(".efdi-sg-result",  "block");
          show(".efdi-sg-actions", "flex");
          refreshHistory(root);

        } catch(e) {
          ui.notifications.error("Fehler: " + e.message);
          console.error("EFDI-SG:", e);
        } finally {
          if (genBtn) { genBtn.disabled = false; genBtn.textContent = "🎨 Bild generieren"; }
          show(".efdi-sg-loading", "none");
        }
      };

      q(".efdi-sg-generate")?.addEventListener("click",  doGenerate);
      q(".efdi-sg-regenerate")?.addEventListener("click", doGenerate);
      q(".efdi-sg-scene-name")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doGenerate();
      });

      // Neue Szene anlegen
      q(".efdi-sg-create-scene")?.addEventListener("click", async () => {
        if (!STATE.lastB64) { ui.notifications.warn("Erst Bild generieren."); return; }
        const name   = val(".efdi-sg-scene-name").trim() || STATE.lastSceneName || "Neue Szene";
        const folder = val(".efdi-sg-folder").trim();

        ui.notifications.info("⏳ Speichere Bild...");
        let path;
        try {
          path = await uploadToFoundry(STATE.lastB64, name);
        } catch(e) {
          ui.notifications.error("Upload-Fehler: " + e.message);
          return;
        }

        let folderId = null;
        if (folder) {
          let f = game.folders.find(f => f.name === folder && f.type === "Scene");
          if (!f) f = await Folder.create({ name: folder, type: "Scene", color: "#2d5a1b" });
          folderId = f.id;
        }

        try {
          const scene = await createSceneWithBackground(name, path, folderId);
          ui.notifications.info(`✅ Szene "${name}" mit Hintergrundbild erstellt!`);
          await scene.activate();
          scene.sheet.render(true);
        } catch(e) {
          ui.notifications.error("Szenen-Fehler: " + e.message);
        }
      });

      // Zu bestehender Szene hinzufügen
      q(".efdi-sg-add-scene")?.addEventListener("click", async () => {
        if (!STATE.lastB64) { ui.notifications.warn("Erst Bild generieren."); return; }
        const sceneId = val(".efdi-sg-existing-scene");
        if (!sceneId) { ui.notifications.warn("Bitte Szene auswählen."); return; }
        const name = val(".efdi-sg-scene-name").trim() || STATE.lastSceneName || "szene";

        let path;
        try {
          path = await uploadToFoundry(STATE.lastB64, name);
        } catch(e) {
          ui.notifications.error("Upload-Fehler: " + e.message);
          return;
        }

        const targetScene = game.scenes.get(sceneId);
        const levelsData  = targetScene?.toObject().levels ?? [];
        if (levelsData.length > 0) {
          levelsData[0].background.src = path;
          await targetScene.update({ levels: levelsData });
        }
        ui.notifications.info("✅ Hintergrundbild aktualisiert!");
      });

      // Download
      q(".efdi-sg-download")?.addEventListener("click", () => {
        if (!STATE.lastDataUrl) return;
        const a = document.createElement("a");
        a.href = STATE.lastDataUrl;
        a.download = `efdi-scene-${Date.now()}.png`;
        a.click();
      });

      // History Delegation
      root.addEventListener("click", (e) => {
        const btn = e.target.closest(".efdi-sg-hist-use");
        if (!btn) return;
        STATE.lastDataUrl = btn.dataset.url;
        STATE.lastB64     = btn.dataset.url.split(",")[1] ?? "";
        const img = q(".efdi-sg-preview-img");
        if (img) img.src = btn.dataset.url;
        show(".efdi-sg-result",  "block");
        show(".efdi-sg-actions", "flex");
      });

      // Bestehendes Bild anzeigen
      if (STATE.lastDataUrl) {
        const img = q(".efdi-sg-preview-img");
        if (img) img.src = STATE.lastDataUrl;
        show(".efdi-sg-result",  "block");
        show(".efdi-sg-actions", "flex");
        refreshHistory(root);
      }
    }
  }, { width: 660, height: 780, resizable: true, classes: ["efdi-sg"], id: "efdi-scene-generator" }).render(true);
}

function refreshHistory(root) {
  const c = root.querySelector(".efdi-sg-history-items");
  if (!c) return;
  c.innerHTML = "";
  for (const item of STATE.history) {
    const d = document.createElement("div");
    d.className = "efdi-sg-hist-item";
    d.innerHTML = `
      <img src="${item.url}" title="${item.name}" class="efdi-sg-hist-thumb">
      <div class="efdi-sg-hist-name">${item.name}</div>
      <button class="efdi-sg-hist-use" data-url="${item.url}">↩</button>`;
    c.appendChild(d);
  }
}

// ── Modul Init ──────────────────────────────────────────────────
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "openaiApiKey", {
    name: "OpenAI API Key",
    hint: "Wird nur lokal in deinem Browser gespeichert.",
    scope: "client", config: true, type: String, default: ""
  });
  console.log("EFDI-SG | Modul geladen.");
});

Hooks.once("ready", () => {
  game.efdiSceneGenerator = { open: openSceneGenerator };
  console.log("EFDI-SG | Bereit. Öffnen: game.efdiSceneGenerator.open()");
  scheduleButton(null, { immediate: true });
  setTimeout(() => scheduleButton(), 300);
  setTimeout(() => scheduleButton(), 1200);
});

// ── Sidebar-Button ──────────────────────────────────────────────
let _buttonTimeout = null;
let _lastContext   = null;

function scheduleButton(contextHtml = null, options = {}) {
  if (contextHtml) _lastContext = contextHtml;
  if (_buttonTimeout !== null) return;
  const delay = options?.immediate ? 0 : 80;
  _buttonTimeout = setTimeout(() => {
    _buttonTimeout = null;
    addSceneButton(_lastContext);
    _lastContext = null;
  }, delay);
}

function addSceneButton(html) {
  const $html = html?.jquery ? html : (typeof $ !== "undefined" ? $(html ?? document) : null);
  if (!$html?.length) return;
  const root = $html[0];
  if (!root || typeof root.querySelector !== "function") return;

  const SCENE_ROOT = ".sidebar-tab[data-tab='scenes'], [data-tab='scenes'], #scenes";
  const $scene = $html.is(SCENE_ROOT) ? $html : $html.find(SCENE_ROOT).first();
  const sceneRoot = $scene?.[0];
  if (!sceneRoot) return;
  if (sceneRoot.querySelector(".efdi-sg-open-btn")) return;

  const btn = document.createElement("button");
  btn.className = "efdi-sg-open-btn";
  btn.title     = "EFDI: Szenenbild generieren";
  btn.innerHTML = "🦕🎨 Szenenbild generieren";
  btn.addEventListener("click", () => openSceneGenerator());

  const target =
    sceneRoot.querySelector(".header-actions") ??
    sceneRoot.querySelector(".action-buttons") ??
    sceneRoot.querySelector("header") ??
    sceneRoot;
  target.appendChild(btn);
}

Hooks.on("renderSceneDirectory", (app, html) => scheduleButton(html));
Hooks.on("renderSidebarTab", (app, html) => {
  const isScenes = app?.options?.id === "scenes" || app?.tabName === "scenes";
  if (!isScenes) return;
  scheduleButton(html);
});
Hooks.on("changeSidebarTab", (app, tab) => {
  if (String(tab || "").trim().toLowerCase() !== "scenes") return;
  scheduleButton(null, { immediate: true });
});
