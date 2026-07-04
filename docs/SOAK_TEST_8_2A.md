# Chronicle AI — Phase 8.2A Soak Test
**Annotated production stability test — 2–4 hour continuous session**

> Run this only after Phase 8.2 infrastructure checklist is complete:
> Supabase migrations applied, `narrate` function deployed, all secrets set,
> Vercel env vars configured. Use a fresh browser profile with no DevTools open.

---

## Known Limitations Before You Start

Read these before interpreting results. They are architectural constraints, not bugs.

| What the test asks | What will actually happen | Is it a bug? |
|---|---|---|
| "Quest progression" | QuestsPanel shows placeholder text — no quest system exists yet | No — Phase 3 deferred |
| "Codex usage" | CodexPanel shows placeholder text | No — Phase 3 deferred |
| "Level up → verify new abilities" | Banner appears when XP threshold crossed; **no level-up button exists** — you cannot advance level in-session yet | No — Phase 5.1 deferred |
| "NPCs remember earlier conversations" | AI context is last **8 turns** only; events >8 turns ago drop from Director context | No — known window limit |
| "AI remembers campaign context" (cross-day) | Last 20 turns restored from DB on resume; earlier turns not in AI prompt | No — same context limit |

If you encounter any of these, note it as **expected** and continue.

---

## Pre-Test Setup

```
[ ] Phase 8.2 infrastructure complete (migrations, secrets, Vercel env vars)
[ ] Production URL confirmed loading: https://<your-domain>/
[ ] Incognito / fresh browser profile (no existing Chronicle AI session)
[ ] Supabase Dashboard open in a second tab for log monitoring
    > Edge Functions > Logs > narrate
    > Postgres > Logs
[ ] Browser DevTools Memory tab open (track heap over time — Phase 6 stability)
[ ] Notepad / doc open for logging issues with timestamp
[ ] git tag v0.1.0-pre-soak  (rollback point before soak test)
```

---

## Phase 1 — Account & Adventure Setup (~15 min)

```
[ ] Navigate to https://<your-domain>/
[ ] Page loads in < 3s, animations play, value props visible
[ ] Click "Begin Your Chronicle" → /signup
[ ] Create account with a real email address
    (use an email you can check — confirm receipt of confirmation email if enabled)
[ ] Log in → /dashboard

CHARACTER CREATION
[ ] Click "Create Character"
[ ] Complete all 9 wizard steps
    Identity → Species → Class → Background → Ability Scores → Skills → Equipment → Portrait → Review
[ ] Submit → character appears in /characters list
[ ] Open character sheet → verify all stats are correct:
    - HP = 10 + CON_mod + (level × (hitDie_avg + CON_mod))
    - AC = 10 + DEX_mod (or as set by equipment)
    - Proficiency bonus = +2 at level 1–4
[ ] Note the character's name — you'll use it to verify AI consistency

CAMPAIGN CREATION
[ ] Click "Create Campaign" → complete 8-step wizard
[ ] Assign the character you just created
[ ] Open Campaign Detail → "Begin Adventure" button visible
[ ] Click "Begin Adventure" → /adventure/<campaign-id> loads
[ ] AdventureHub shows:
    [ ] Character name + HP/AC in sidebar
    [ ] Story panel with input bar
    [ ] 7 tab nav items (no Debug tab)
    [ ] No JavaScript errors in browser console
```

---

## Phase 2 — Continuous Gameplay (2–4 hours)

Play as you would a real campaign. Aim for variety over speed.

**Action variety checklist** (check off as you perform each at least once):

```
Exploration
[ ] Describe the scene / "I look around"
[ ] Move to a new location
[ ] Examine an object / "I inspect the door"

NPC interaction
[ ] Speak to an NPC
[ ] Ask an NPC a follow-up question referencing their earlier answer
    ⚠ Expected: AI may not remember if >8 turns have passed — log if it forgets

Skill checks
[ ] Attempt a Perception check
[ ] Attempt a Persuasion or Deception check
[ ] Attempt a Stealth or Athletics check

Inventory & equipment
[ ] Pick up an item (if Director offers one)
[ ] Open Character Sidebar → verify inventory shows correctly
[ ] Check Equipment tab on character sheet

Resting
[ ] Ask to rest / "I make camp for the night"

Journal
[ ] Open Journal tab → session summary visible with turn history

Atlas
[ ] Open Atlas tab
    [ ] Empty state shown before any locations discovered, OR
    [ ] Locations shown if Director has added them to WorldState
    [ ] If locations exist: click one → detail view opens, back button works

Character sheet (mid-session)
[ ] Navigate to /characters/<id> in a new tab
[ ] Verify stats match what's shown in the sidebar
[ ] Return to /adventure/<campaign-id>
```

**During play, watch for:**
```
[ ] Each AI response arrives within 10 seconds
[ ] Streaming text begins within 3 seconds of submitting action
[ ] No "An unexpected error occurred" banners
[ ] No blank Story panel after submission
[ ] Story Panel correctly shows turn history scrolling
```

---

## Phase 3 — Combat Stress Test (within the 2–4 hour session)

Trigger at least **2 separate combat encounters**. Use actions like "I attack the guard" or "I provoke the creature" to escalate.

**For each combat encounter:**
```
[ ] CombatPanel opens (replaces main panel area)
[ ] Initiative tracker shows all combatants with their initiative rolls
[ ] Round counter starts at 1
[ ] Player turn: Attack / Defend / Flee buttons visible
[ ] Enemy turn: "Resolve Enemy Turn" button visible
[ ] HP bars update correctly after each hit
[ ] Death save tracker appears if player HP reaches 0

ON COMBAT END
[ ] Summary screen shows outcome (VICTORY / ESCAPED / FALLEN)
[ ] XP amount displayed (or 0 if no enemies defeated)
[ ] Loot displayed if Director provided any
[ ] Click "Continue" once — ⚠ do NOT double-click
[ ] AdventureHub returns to exploration (Story Panel visible)
[ ] Journal tab → combat turn appears in turn history (mode: 'combat')
[ ] If enough XP earned: level-up banner appears at top of hub
    ⚠ Banner is informational only — no level-up mechanic exists yet

AFTER SECOND COMBAT
[ ] Re-open Character Sidebar → HP reflects post-combat state
[ ] Inventory → any looted items appear (if Director provided loot)
[ ] XP on character sheet → open /characters/<id> in new tab and verify
```

---

## Phase 4 — Persistence Testing

Run these deliberately at different points during the session.

```
MID-SESSION SAVE/RESUME
[ ] Click "Pause Session" in the status bar
[ ] Session status shows "paused"
[ ] Click "Resume" → session state restored, turn history intact

BROWSER REFRESH
[ ] Press F5 / Cmd+R on the /adventure/<id> page
[ ] Page reloads and reconnects to the session
[ ] Turn history visible (last 20 turns)
[ ] Character stats correct
[ ] No extra blank turns added

TAB CLOSE & REOPEN
[ ] Close the browser tab
[ ] Reopen https://<your-domain>/adventure/<campaign-id> directly
[ ] Session loads correctly
[ ] Story resumes at the correct turn number

VERIFY AFTER EACH RELOAD
[ ] [ ] No duplicate turns in turn history
[ ] [ ] No missing turns (turn numbers sequential)
[ ] [ ] Inventory unchanged from before reload
[ ] [ ] Character HP unchanged from before reload
```

---

## Phase 5 — AI Consistency

Track these throughout the session. Note the turn number when each first appears.

```
NPC CONSISTENCY
[ ] An NPC introduced in turn N is still called by the same name in later turns
[ ] NPC alive/dead status is respected (deceased NPCs not re-introduced)
    ⚠ Known limit: AI context is last 8 turns; forgetting is expected after that

LOCATION CONSISTENCY
[ ] Location names remain consistent turn-to-turn
[ ] Atlas locations (if populated) match what the AI narrates

NARRATIVE COHERENCE
[ ] The AI references a player action from 2–3 turns ago correctly
[ ] The AI does NOT contradict a fact established in the same session
    (contradictions after >8 turns are expected — log but not a blocker)

COMBAT CONTEXT
[ ] During combat, AI narration references the actual enemies in the fight
[ ] Post-combat narration acknowledges the battle result (victory/defeat)

CHARACTER NAME
[ ] The AI uses the correct character name throughout
    (misnamed character is a prompt builder bug — log immediately if found)
```

---

## Phase 6 — Long Session Stability

Check at the **1-hour mark** and again at the **2-hour mark**.

```
PERFORMANCE
[ ] UI still responsive (input bar, tab switching < 200ms)
[ ] AI response latency comparable to session start (< 10s)
[ ] No browser tab crash or "Page Unresponsive" dialog

MEMORY (open Chrome DevTools → Memory → Heap Snapshot)
[ ] Heap size at 30 min: note it _____ MB
[ ] Heap size at 60 min: note it _____ MB
[ ] Heap size at 120 min: note it _____ MB
[ ] Growth < 50MB over 2 hours is acceptable
[ ] Growth > 100MB over 2 hours = potential memory leak — log with heap snapshot

NETWORK
[ ] No persistent "Connection lost" banners
[ ] After a brief network interruption (toggle WiFi off/on for 5s):
    [ ] The app recovers without refresh
    [ ] Next submitted action succeeds

SUPABASE LOGS (check in dashboard)
[ ] No 500 errors in Edge Function logs
[ ] No RLS violation errors in Postgres logs
[ ] narrate function p99 latency < 8s
```

---

## Phase 7 — Level Progression

XP to level 2 = 300. With `calculateXp` awarding `floor(maxHp/2)` per enemy, you need
enemies with combined maxHp of ~600 to reach level 2 from 0.

```
IF level-up banner appears:
[ ] Banner reads "⬆ Level up available — visit your character sheet to level up!"
[ ] Banner appears in AdventureHub header area
[ ] Journal tab shows the level-up notice in SessionSummaryPanel
[ ] Navigate to /characters/<id>
    ⚠ No level-up button exists — this is a known gap
    [ ] Current level still shows correctly (has NOT auto-incremented)
    [ ] XP total is correct on the Overview tab
[ ] Return to adventure — banner persists until you manually level the character
    (manual: edit the level field on the character sheet if the field is editable)

IF banner does NOT appear (not enough XP):
[ ] This phase is skipped — note total XP earned in your log
```

---

## Phase 8 — Cross-Day Resume

End the session when you've completed the 2-hour minimum. Then:

```
DAY 1 — END SESSION
[ ] Click "End Session" in the status bar
[ ] Confirm session ends → returns to Campaign Detail page
[ ] Note: current character XP, inventory item count, turn count

WAIT — minimum 8 hours (overnight preferred)

DAY 2 — RESUME
[ ] Log in to the production app
[ ] Navigate to /campaigns → your campaign visible
[ ] Click the campaign → Campaign Detail shows session status
[ ] Click "Resume Adventure" or "Continue Adventure"
[ ] AdventureHub loads

VERIFY AFTER RESUME
[ ] Turn history shows last session's turns (last 20 displayed)
[ ] Character HP and XP match Day 1 end state
[ ] Inventory items present (including any combat loot from Day 1)
[ ] Atlas locations from Day 1 still visible
[ ] Type a new action referencing something from Day 1
    ⚠ AI context is last 20 turns from DB; events > 20 turns back are not in context
    [ ] AI correctly references recent (last 8 turns) Day 1 events
    [ ] Document any contradictions or forgetting of Day 1 context
```

---

## Failure Log Template

Copy this for each issue found:

```
ISSUE #___
Time:        HH:MM into session
Phase:       (which soak test phase)
Turn number: (if relevant)
Severity:    BLOCKER / HIGH / MEDIUM / LOW
Description: (what happened)
Steps to reproduce: (what you did immediately before)
Expected:    (what should have happened)
Screenshots: (attach)
Supabase logs: (paste relevant error lines)
```

**Severity guide:**
- **BLOCKER**: Data loss, session corruption, crash, duplicate XP/loot awarded, auth failure
- **HIGH**: AI returns error, combat stuck, turn history incorrect after reload
- **MEDIUM**: AI forgets context > 8 turns (expected), narration quality issue, UI glitch
- **LOW**: Cosmetic, slow response once, level-up banner confusing

---

## Exit Criteria

The soak test passes when all of the following are true:

```
[ ] ≥ 2 hours of uninterrupted gameplay completed
[ ] ≥ 2 combat encounters completed without duplicate XP/loot
[ ] ≥ 3 save/reload cycles passed (pause+resume, browser refresh, tab close+reopen)
[ ] Cross-day resume successful with data intact
[ ] Zero BLOCKER severity issues
[ ] Zero HIGH severity issues (or all documented with known root causes)
[ ] AI narrated consistently for the first 8 turns of each sub-session
[ ] No data loss at any point
[ ] Supabase logs show no 500 errors on the narrate function
[ ] Heap growth < 100MB over 2 hours
```

---

## If the Soak Test Fails

| Failure type | Action |
|---|---|
| BLOCKER found | Stop test. File issue. Do not open to closed alpha until resolved. |
| HIGH found | Evaluate. If data integrity is at risk, fix before alpha. If UX-only, can proceed with caution. |
| Soak test passes with only MEDIUM/LOW issues | Proceed to Phase 9 closed alpha. Document known issues in a `KNOWN_ISSUES.md`. |

---

*Document version: Phase 8.2A pre-flight*
*Code state: 1324/1324 tests passing · 0 TypeScript errors · build clean*
*Double-submit bug on CombatPanel Continue fixed before this test was written*
