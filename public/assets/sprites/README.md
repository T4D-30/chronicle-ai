# Chronicle AI — Sprite Assets

**Ships empty by design.** No copyrighted art is included. Components render
gracefully without sprites (emoji/text fallbacks). Drop pixel-art PNGs here
to activate visuals.

## Structure
| Folder | Contents | Recommended size |
|---|---|---|
| `portraits/` | Character & NPC portraits | 64×64 or 96×96 PNG |
| `enemies/` | Enemy battle sprites | 64×64 – 128×128 PNG |
| `environments/` | Location backdrop art | 480×320 (GBA 2x) PNG |
| `items/` | Item/equipment icons | 32×32 PNG |
| `ui/` | Cursor, frame, icon sheets | as needed |

## Rendering
All sprite consumers apply `.pixel-crisp` (image-rendering: pixelated) —
author at 1x and let CSS scale. Keep palettes warm/dark per STYLE_GUIDE.md.

## Royalty-free sources
- Kenney.nl (CC0), OpenGameArt.org, itch.io free asset packs (check licenses)
