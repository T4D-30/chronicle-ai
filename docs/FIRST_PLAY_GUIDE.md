# Chronicle AI — First Play Guide

Welcome. This is a solo tabletop RPG with an AI Dungeon Master. No group
required — just you, your character, and a story that responds to what you
actually do.

This guide walks through your first session. It's written for players, not
developers — if you're looking for setup/deployment instructions, see
[PUBLIC_TEST_PLAY.md](PUBLIC_TEST_PLAY.md) instead.

---

## 1. Create an account

Sign up with an email and password. Confirm your email if prompted.

## 2. Create your character

Click **Create Character** and work through the wizard:

1. **Identity** — name your character
2. **Species** — ancestry (human, elf, dwarf, etc.)
3. **Class** — your archetype (fighter, wizard, rogue, etc.)
4. **Background** — where they came from
5. **Ability Scores** — point-buy system; you have a fixed budget to spend across STR/DEX/CON/INT/WIS/CHA
6. **Skills** — pick your proficiencies
7. **Equipment** — starting gear for your class
8. **Portrait** — optional image upload
9. **Review** — confirm everything, then save

Your character is real from this point — HP, AC, and modifiers are all
calculated by the actual game engine, not decoration.

Your progress saves automatically as you go. If you close the browser or
navigate away mid-wizard, you'll be offered a chance to resume exactly
where you left off the next time you start creating a character.

**Already have a character sheet?** Click **Import Character** instead of
Create Character. Upload a PDF, PNG, or JPG — you'll land on the same
Review step above, with a summary of what was (or wasn't) detected. As of
this release, automatic extraction isn't implemented yet, so you'll fill
in the fields yourself, but the upload and review flow is fully functional
and will get smarter over time.

## 3. Create a campaign

Click **Create Campaign** and set:

- **Title & premise** — what's this story about?
- **Tone** — heroic, grim, mysterious, or comedic. This genuinely changes how the AI narrates.
- **Difficulty** — easy, standard, or brutal. Changes how forgiving outcomes are.
- **Rules style** — how much mechanical detail shows up in the prose
- **Director configuration** — advanced pacing options if you want them
- Assign the character you just created

**Have a campaign document already?** Click **Import Campaign** instead.
Upload a PDF, DOCX, TXT, Markdown, or JSON file — a campaign bible, an
adventure module, or your own notes. You'll land on the same Review step
above. As with character import, automatic extraction isn't implemented
yet, so you'll fill in the title, premise, and other details yourself —
including assigning a character, which import can't do for you.

## 4. Begin your adventure

From the campaign page, click **Begin Adventure**. You'll land in the
Adventure Hub — the main play screen.

### What you'll see

- **World tab**: the primary playable overworld, with contextual interaction prompts and dialogue docked over the still-visible scene
- **Story tab**: the story so far, suggested actions, and a text box to type what you do next
- **Sidebars** (wider screens): navigation plus a consolidated character/party/world-status panel
- **Tab bar**: Story, World, Character, Dice, Journal, Quests, Atlas, Codex

### How to play

Just type what your character does, in plain English:

> I push open the tavern door and look around.

The AI Director reads your action and narrates what happens. If your
action calls for a real skill check — forcing something open, sneaking,
persuading, investigating, and so on — the engine rolls it deterministically
before the Director ever sees the outcome, and the Director's narration
will reflect that exact roll. You'll also see the actual roll on screen —
the die face, your modifier, the total, and the DC — right below the
narration, so you never have to take the outcome on faith. Simple
narration, movement, or dialogue doesn't roll anything — not every line
of play needs to be mechanical. The AI never invents a dice result and
never rolls a different outcome than what actually happened.

You'll also see **quick-action buttons** (Look, Inventory, Character,
Atlas, Journal, Quests, Rest, Dice) for common actions without typing, and
**suggested actions** the Director offers after each turn.

In the **World** tab, move with the arrow keys or WASD, interact with
Enter/Space/E, and press Escape for the pause menu. The layout adapts to
small screens, but overworld movement is currently keyboard-only; touch
movement controls are not yet implemented.

## 5. Combat

If your action leads to a fight, the screen switches to a tactical combat
view automatically. You'll get an action menu:

- **Attack** — pick a weapon (or fight unarmed)
- **Spell** — cast a prepared spell, if you have one
- **Item** — use something from your inventory
- **Defend / Move / Flee**

Damage numbers pop up on hit, critical hits flash the screen, and HP bars
update live. When combat ends, you'll see a summary with XP and any loot.

## 6. Leveling up

When you've earned enough XP, a banner appears in your **Journal** tab:
"Level Up Available." Click the **Level Up** button — you'll see an exact
preview of your new HP and proficiency bonus (calculated by the same
engine that runs everything else) before you confirm. Once confirmed,
you'll get a brief moment of celebration before the panel closes.

## 7. Quests and Codex

As you play, the Director notices when a real goal emerges — a request, a
mystery, something worth pursuing — and adds it to your **Quest Log**
automatically. Named NPCs you meet get recorded in your **Codex**, along
with their attitude toward you and what you've learned about them.

Neither of these will show anything until the Director actually surfaces
it in the story. There's no filler content — if the log is empty, it's
because nothing quest-worthy has happened yet.

## 8. Saving your progress

Click **Pause** any time — you'll see a "Progress saved" confirmation.
Come back later and resume exactly where you left off, even after closing
the browser. Refreshing mid-session is also safe.

## 9. Ending a session

Click **End** when you're done for good with this session. You can always
start a new session on the same campaign later — your character, world
state, quests, and Codex all persist.

---

## Tips for a better first session

- **Be specific.** "I search the desk for anything hidden" gets a richer
  response than "I look around."
- **Try the tone that matches your mood.** Heroic and grim campaigns feel
  genuinely different, not just re-skinned.
- **The Director remembers real facts long-term**, but not every line of
  old narration — if you want something to matter later, make it a clear
  moment (a promise, a name, a decision), not a throwaway detail.
- **Combat is real, not scripted.** You can lose. Death saves are tracked
  properly if you go down.

Have fun. If something breaks, see
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) — it's possible you found a
known gap rather than a bug.
