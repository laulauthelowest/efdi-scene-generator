// scripts/efdi-scene-generator.mjs
// EFDI Scene Generator – Foundry VTT Modul
// Generiert Szenenbilder via OpenAI DALL-E API

// ── Prompt-Vorlagen pro Stil ────────────────────────────────────
const STYLE_PROMPTS = {
  jungle: "lush prehistoric jungle, dramatic lighting, ancient trees, dense foliage, mysterious atmosphere, cinematic wide shot, photorealistic",
  scifi:  "abandoned high-tech facility, dark corridors, flickering emergency lights, broken equipment, sci-fi thriller atmosphere, cinematic",
  horror: "dark and threatening environment, eerie fog, danger lurking in shadows, tense horror atmosphere, dramatic lighting",
  painterly: "epic fantasy painting style, dramatic clouds, wide landscape, highly detailed, concept art, matte painting",
  realistic: "photorealistic, wide angle lens, natural lighting, highly detailed, 8k resolution, professional photography"
};

const LOCATION_HINTS = {
  "vulkan":      "volcanic crater with glowing lava, smoke and ash in the air, dangerous rocky terrain",
  "dschungel":   "dense prehistoric jungle with massive trees, hanging vines, dappled light",
  "strand":      "tropical beach with dramatic cliffs, dark stormy ocean, scattered debris",
  "labor":       "abandoned scientific laboratory, broken glass tanks, overturned equipment, specimen jars",
  "höhle":       "dark cave system with bioluminescent plants, stalactites, hidden depths",
  "komplex":     "abandoned research complex, overgrown with vines, broken windows, jungle reclaiming it",
  "kontrollraum":"abandoned control room with dozens of screens, flickering monitors, dust and cobwebs",
  "sumpf":       "murky swamp at dusk, twisted trees, fog over still water, dangerous stillness",
  "berg":        "dramatic mountain peak above clouds, ancient and imposing, pterosaurs circling",
  "ruinen":      "ancient stone ruins overgrown with jungle, mysterious carvings, hidden temple",
  "see":         "dark prehistoric lake, massive underwater shadow visible, misty shores",
  "radioturm":   "rusted radio tower on a cliff, stormy sky, birds nesting in the structure",
  "brutanlage":  "dinosaur hatchery with cracked eggs, warm incubator glow, broken containment",
  "zeitanomalie":"swirling purple temporal anomaly, crackling energy, distorted reality",
  "gehege":      "massive broken dinosaur enclosure, bent fences, massive footprints in mud",
  "kraftwerk":   "underground power plant with steam pipes, emergency lighting, industrial decay",
  "einschienenbahn": "elevated monorail track through jungle canopy, rusted and overgrown",
};

// ── Prompt generieren ───────────────────────────────────────────
function buildPrompt(sceneName, style, extra) {
  const styleSuffix = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.jungle;

  // Schaue ob wir einen Hinweis für diesen Ort haben
  const lowerName = sceneName.toLowerCase().replace(/[🌋🌲🏖️⛰️💧🌊🌫️🔬🕳️🏛️🚝🦅⚡📡🚁✈️⚓🏠🌀🗿🏕️]/g, "").trim();
  let locationHint = "";
  for (const [key, hint] of Object.entries(LOCATION_HINTS)) {
    if (lowerName.includes(key)) {
      locationHint = hint + ", ";
      break;
    }
  }

  const extraPart = extra ? `, ${extra}` : "";
  return `Escape from Dino Island tabletop RPG scene background, ${locationHint}${sceneName}${extraPart}, dinosaurs may be present in background, ${styleSuffix}, no text, no UI, no watermarks, landscape orientation, immersive game background`;
}

// ── Hauptklasse ─────────────────────────────────────────────────
class EfdiSceneGenerator extends Application {
  constructor(options = {}) {
    super(options);
    this._generating = false;
    this._lastImageUrl = null;
    this._lastImageB64 = null;
    this._history = [];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "efdi-scene-generator",
      title: game.i18n.localize("EFDI_SG.Title"),
      template: "modules/efdi-scene-generator/templates/scene-generator.html",
      width: 660,
      height: 780,
      resizable: true,
      classes: ["efdi-sg"]
    });
  }

  getData() {
    return {
      apiKey: game.settings.get("efdi-scene-generator", "openaiApiKey") ?? "",
      history: this._history,
      generating: this._generating,
      lastImageUrl: this._lastImageUrl,
      scenes: game.scenes.map(s => ({ id: s.id, name: s.name }))
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // API Key speichern
    html.find(".efdi-sg-save-key").on("click", async () => {
      const key = html.find(".efdi-sg-api-key").val().trim();
      await game.settings.set("efdi-scene-generator", "openaiApiKey", key);
      ui.notifications.info("API-Key gespeichert!");
    });

    // Bild generieren
    html.find(".efdi-sg-generate").on("click", async () => {
      await this._onGenerate(html);
    });

    // Enter im Namensfeld
    html.find(".efdi-sg-scene-name").on("keydown", async (ev) => {
      if (ev.key === "Enter") await this._onGenerate(html);
    });

    // Als neue Szene anlegen
    html.find(".efdi-sg-create-scene").on("click", async () => {
      await this._onCreateScene(html);
    });

    // Zu bestehender Szene hinzufügen
    html.find(".efdi-sg-add-to-scene").on("click", async () => {
      await this._onAddToScene(html);
    });

    // Herunterladen
    html.find(".efdi-sg-download").on("click", () => {
      if (this._lastImageUrl) {
        const a = document.createElement("a");
        a.href = this._lastImageUrl;
        a.download = `efdi-scene-${Date.now()}.png`;
        a.click();
      }
    });

    // Neu generieren
    html.find(".efdi-sg-regenerate").on("click", async () => {
      await this._onGenerate(html);
    });

    // History Bild wiederverwenden
    html.on("click", ".efdi-sg-history-use", (ev) => {
      const url = ev.currentTarget.dataset.url;
      this._lastImageUrl = url;
      this._showPreview(html, url);
    });
  }

  // ── Bild generieren ───────────────────────────────────────────
  async _onGenerate(html) {
    const apiKey = game.settings.get("efdi-scene-generator", "openaiApiKey");
    if (!apiKey) {
      ui.notifications.warn(game.i18n.localize("EFDI_SG.NoKey"));
      return;
    }

    const sceneName = html.find(".efdi-sg-scene-name").val().trim();
    if (!sceneName) {
      ui.notifications.warn(game.i18n.localize("EFDI_SG.NoName"));
      return;
    }

    const style    = html.find(".efdi-sg-style").val();
    const extra    = html.find(".efdi-sg-extra").val().trim();
    const quality  = html.find(".efdi-sg-quality").val();
    const prompt   = buildPrompt(sceneName, style, extra);

    // Prompt anzeigen
    html.find(".efdi-sg-prompt-preview").text(prompt);
    html.find(".efdi-sg-prompt-section").show();

    // Loading-State
    this._generating = true;
    const btn = html.find(".efdi-sg-generate");
    btn.prop("disabled", true).text(game.i18n.localize("EFDI_SG.Generating"));
    html.find(".efdi-sg-result").hide();
    html.find(".efdi-sg-loading").show();

    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1792x1024",
          quality: quality,
          response_format: "url"
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message ?? response.statusText);
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      this._lastImageUrl = imageUrl;
      this._lastSceneName = sceneName;

      // History
      this._history.unshift({ url: imageUrl, name: sceneName, prompt });
      if (this._history.length > 6) this._history.pop();

      this._showPreview(html, imageUrl);
      this._updateHistory(html);

    } catch (err) {
      ui.notifications.error(game.i18n.localize("EFDI_SG.ErrorPrefix") + err.message);
      console.error("EFDI Scene Generator:", err);
    } finally {
      this._generating = false;
      btn.prop("disabled", false).text(game.i18n.localize("EFDI_SG.Generate"));
      html.find(".efdi-sg-loading").hide();
    }
  }

  // ── Vorschau anzeigen ─────────────────────────────────────────
  _showPreview(html, url) {
    html.find(".efdi-sg-preview-img").attr("src", url);
    html.find(".efdi-sg-result").show();
    html.find(".efdi-sg-actions").show();
  }

  // ── History aktualisieren ─────────────────────────────────────
  _updateHistory(html) {
    const container = html.find(".efdi-sg-history-items");
    container.empty();
    for (const item of this._history) {
      container.append(`
        <div class="efdi-sg-history-item">
          <img src="${item.url}" title="${item.name}" class="efdi-sg-history-thumb">
          <div class="efdi-sg-history-name">${item.name}</div>
          <button class="efdi-sg-history-use" data-url="${item.url}">Verwenden</button>
        </div>
      `);
    }
  }

  // ── Als neue Szene anlegen ────────────────────────────────────
  async _onCreateScene(html) {
    if (!this._lastImageUrl) return;

    const sceneName = html.find(".efdi-sg-scene-name").val().trim() || this._lastSceneName || "Neue Szene";
    const folderName = html.find(".efdi-sg-folder").val().trim();

    // Bild in Foundry World speichern
    let savedPath;
    try {
      savedPath = await this._saveImageToWorld(this._lastImageUrl, sceneName);
    } catch(e) {
      // Fallback: URL direkt nutzen (funktioniert nur solange URL gültig)
      savedPath = this._lastImageUrl;
      ui.notifications.warn("Bild konnte nicht lokal gespeichert werden, nutze temporäre URL.");
    }

    // Ordner finden oder erstellen
    let folderId = null;
    if (folderName) {
      let folder = game.folders.find(f => f.name === folderName && f.type === "Scene");
      if (!folder) folder = await Folder.create({ name: folderName, type: "Scene", color: "#2d5a1b" });
      folderId = folder.id;
    }

    // Szene erstellen
    const scene = await Scene.create({
      name: sceneName,
      folder: folderId,
      width: 1792,
      height: 1024,
      grid: { type: 1, size: 100 },
      background: { src: savedPath },
      backgroundColor: "#1a2a1a"
    });

    ui.notifications.info(`✅ Szene "${sceneName}" erstellt!`);

    // Szene direkt aktivieren und anzeigen
    await scene.activate();
    scene.sheet.render(true);
  }

  // ── Zu bestehender Szene hinzufügen ──────────────────────────
  async _onAddToScene(html) {
    if (!this._lastImageUrl) return;
    const sceneId = html.find(".efdi-sg-existing-scene").val();
    if (!sceneId) { ui.notifications.warn("Bitte eine Szene auswählen."); return; }

    let savedPath;
    try {
      const sceneName = html.find(".efdi-sg-scene-name").val().trim() || "scene";
      savedPath = await this._saveImageToWorld(this._lastImageUrl, sceneName);
    } catch(e) {
      savedPath = this._lastImageUrl;
    }

    await game.scenes.get(sceneId)?.update({ "background.src": savedPath });
    ui.notifications.info("✅ Hintergrundbild aktualisiert!");
  }

  // ── Bild in Foundry-World speichern ──────────────────────────
  async _saveImageToWorld(url, name) {
    // Bild als Blob herunterladen
    const response = await fetch(url);
    const blob = await response.blob();

    // Sicherer Dateiname
    const safeName = name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
    const filename = `efdi-scene-${safeName}-${Date.now()}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    // In Foundry hochladen
    const result = await FilePicker.upload("data", "worlds/" + game.world.id + "/scenes/", file, {});
    return result.path;
  }
}

// ── Modul initialisieren ────────────────────────────────────────
Hooks.once("init", () => {
  // Einstellungen registrieren
  game.settings.register("efdi-scene-generator", "openaiApiKey", {
    name: "OpenAI API Key",
    hint: "Dein OpenAI API-Key für DALL-E 3. Wird nur lokal gespeichert.",
    scope: "client",
    config: true,
    type: String,
    default: ""
  });

  console.log("EFDI Scene Generator | Modul geladen.");
});

Hooks.once("ready", () => {
  game.efdiSceneGenerator = new EfdiSceneGenerator();
});

// ── Button in Szenen-Toolbar ────────────────────────────────────
Hooks.on("getSceneDirectoryEntryContext", () => {});

Hooks.on("renderSceneDirectory", (app, html) => {
  // Button in der Szenen-Sidebar oben einfügen
  const btn = $(`
    <button class="efdi-sg-open-btn" title="${game.i18n.localize("EFDI_SG.ButtonTooltip")}">
      🦕🎨 Szenenbild generieren
    </button>
  `);
  btn.on("click", () => game.efdiSceneGenerator.render(true));
  html.find(".directory-header .action-buttons").append(btn);
});
