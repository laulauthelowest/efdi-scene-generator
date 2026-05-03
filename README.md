# 🦕🎨 EFDI Scene Generator

Ein Foundry VTT Modul für **Escape from Dino Island** das Szenenbilder mit **DALL-E 3** (OpenAI) generiert und direkt als Foundry-Szenen anlegt.

## Features

- 🎨 **DALL-E 3** Bildgenerierung direkt aus Foundry
- 5 **vordefinierte Stile** (Dschungel, Sci-Fi, Horror, Gemälde, Realistisch)
- **Automatische Prompts** basierend auf dem Szenennamen (Vulkan, Labor, Dschungel etc.)
- **Direkt als Szene anlegen** oder zu bestehender Szene hinzufügen
- **Bild automatisch** in der Foundry World gespeichert
- **History** der letzten 6 generierten Bilder
- Button direkt in der **Szenen-Sidebar**

## Installation

1. In Foundry: **Module installieren** → Manifest-URL einfügen:
```
https://raw.githubusercontent.com/laulauthelowest/efdi-scene-generator/main/module.json
```

2. Modul in deiner Welt **aktivieren**

3. **OpenAI API-Key** eingeben:
   - Geh auf https://platform.openai.com/api-keys
   - Neuen Key erstellen
   - In Foundry: Szenen-Sidebar → "🦕🎨 Szenenbild generieren" → ⚙ Einstellungen → Key eingeben

## Kosten

DALL-E 3 kostet pro Bild:
- **Standard**: ca. $0.04 (1792×1024)
- **HD**: ca. $0.08 (1792×1024)

## Verwendung

1. Szenen-Sidebar öffnen
2. "🦕🎨 Szenenbild generieren" klicken
3. Szenenname eingeben (z.B. "Vulkankrater", "Verlassenes Labor")
4. Stil wählen
5. "🎨 Bild generieren" klicken
6. "✅ Als neue Szene anlegen" klicken

## Lizenz

MIT License – Community-Projekt für Escape from Dino Island
