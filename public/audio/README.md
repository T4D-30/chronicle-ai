# Chronicle AI — Audio Assets

**This folder ships empty by design.** No copyrighted audio is included.
The AudioManager (src/lib/audio/audioManager.ts) resolves tracks from the
manifest below and fails silently when a file is missing — the game is
fully playable without audio.

## Expected files

### music/
| File | Plays when |
|---|---|
| `menu.ogg` | Default / menus / unclassified locations |
| `town.ogg` | Location kind = town |
| `dungeon.ogg` | Location kind = dungeon |
| `forest.ogg` | Location kind = forest |
| `combat.ogg` | Combat active |
| `boss.ogg` | Boss combat active |
| `victory.ogg` | One-shot on combat victory |

### ambience/
| File | Purpose |
|---|---|
| `rain.ogg` | Rain loop |
| `thunder.ogg` | Thunder (loopable rumble) |
| `fireplace.ogg` | Campfire / rest scenes |
| `wind.ogg` | Wind loop |
| `birds.ogg` | Daytime forest/town |
| `water.ogg` | Rivers, coasts |

## Format
- OGG Vorbis preferred (small, loops cleanly); MP3 also works — update
  the manifest paths in `audioManager.ts` if you change extensions.
- Music: loop-ready (no silence at start/end), -14 LUFS or quieter.
- Ambience: 30s+ seamless loops.

## Royalty-free sources
- OpenGameArt.org (CC0 / CC-BY — check each license)
- Kenney.nl (CC0 game audio packs)
- freesound.org (filter by CC0)
- incompetech.com (CC-BY music)

Attribute CC-BY assets in this file when you add them.
