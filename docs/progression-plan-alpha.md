# Noxis Progression Plan (Alpha)

## Goal

Transform the current playable sandbox into a closed-alpha MMORPG progression loop that supports:

- character growth from level 1 to 18
- clear map-to-map pacing
- quest-driven onboarding
- visible gear upgrades per class
- reasons to group for dungeon and event content
- enough progression depth for friend playtests lasting multiple sessions

This plan is based on the content that already exists in the codebase:

- 3 overworld maps: `forest` (A1), `lava` (A2), `undead` (A3)
- 1 dungeon: `dng_forest_ruins_mvp`
- 1 world event: `event_forest_rift`
- 3 quests in the forest
- 1 class shop / blacksmith
- generic mob tiers: `normal`, `elite`, `subboss`, `boss`
- basic item families: weapon, potion, hourglass, class equipment

Related design spec:

- see [class-combat-rework-alpha.md](./class-combat-rework-alpha.md) for the proposed attribute and skill overhaul that should support the alpha progression loop and future PvP testing
- see [necromancer-class-plan-alpha.md](./necromancer-class-plan-alpha.md) for the planned fifth-class expansion after the baseline alpha loop is stable

## Current Audit Snapshot

### Maps

- `forest / A1 / Z1` is the only region with real social and quest structure today
- `lava / A2 / Z1` and `undead / A3 / Z1` exist as world spaces with portal flow, but not as progression regions yet
- portal chain already supports `forest -> lava -> undead`

### NPCs

Current active NPCs in `forest / Z1`:

- `npc_guard_alden`: quest giver
- `npc_scout_lina`: quest giver
- `npc_ferreiro_borin`: shopkeeper
- `npc_bau_zenon`: personal storage
- `npc_dungeon_warden`: dungeon entry NPC
- `npc_cidadao_marek`: ambient civilian

### Quests

Current quest count: 3

- `q_forest_hunt_01`
- `q_forest_supply_01`
- `q_forest_report_01`

This is enough for a prototype, but not enough for a progression loop.

### Dungeons and Events

- Dungeon: `Ruinas de Alder`
- Event: `Fenda da Floresta`

These are good anchors for progression, but they need to be placed inside a broader journey.

### Itemization

Current item families:

- starter/common weapon
- rare ruby weapon
- HP potion
- skill reset hourglass
- class equipment templates for all 4 classes

Current issue:

- the item system exists, but the progression tiers are still too flat
- there is no clear map-specific equipment ladder yet

## Progression Pillars

The alpha progression should be built on five pillars:

1. Each map must answer "why am I here?"
2. Each region must introduce a new pressure: density, survivability, mechanics, group need.
3. Gear upgrades must be readable and tied to region milestones.
4. Main questline must lead players across maps without confusion.
5. Every 4 to 6 levels, the player should unlock a memorable activity: dungeon, event, elite route, or new equipment tier.

## Target Level Curve

Recommended alpha cap: level 18

Suggested pacing:

- Level 1-5: Forest onboarding
- Level 5-6: Forest dungeon introduction
- Level 6-10: Lava expansion
- Level 10-12: Lava pressure and group play
- Level 12-16: Undead campaign
- Level 16-18: Undead climax, event loop, gear chase, dungeon replay

Why 18:

- enough room for 3 maps to matter
- enough time for gear and skill progression to feel real
- still small enough to balance quickly for friend playtests

## Region Structure

## Region 1: Forest (A1)

### Purpose

- teach core systems
- establish the town hub
- introduce combat, loot, shop, storage, local chat, party, dungeon and event

### Level Range

- recommended: 1-6

### Hub Identity

Suggested hub name: `Aldeia de Alder`

This should be the tutorial village and social base.

### NPC Layout

Keep existing NPCs and expand the roster around them:

- Guarda Alden: main questline, danger briefing
- Exploradora Lina: scouting and field quests
- Ferreiro Borin: first gear progression vendor
- Guardiao do Bau: chest tutorial and item safety
- Guardiao das Ruinas: dungeon unlock and entry
- Cidadao Marek: flavor, future delivery quests

Add next:

- Curandeira Selene: potion and recovery tutorial, optional support quests
- Mestre Rowan: skills/hotbar teaching quests
- Mercadora Tessa: consumables and material exchange

### Quest Plan

Target quest count for the forest:

- 6 main quests
- 4 side quests

Suggested main chain:

1. Limpeza da Clareira
- kill normal mobs near town

2. Suprimentos de Emergencia
- collect potions / loot basics

3. Relatorio de Campo
- talk to Lina

4. Sinais da Fenda
- investigate elite activity near event area

5. Preparacao para as Ruinas
- gather consumables, talk to blacksmith, equip first upgrade

6. Ruinas de Alder
- complete first dungeon run

Suggested side quests:

- delivery between Marek and Borin
- chest tutorial with Zenon
- first world event participation
- class-specific mini quest teaching role identity

### Mob Ladder

Use the existing mob tier system, but theme the mobs by subzone:

- normal: Lobo Jovem / Javali Selvagem / Broto Corrompido
- elite: Lobo Alfa / Guardiao Corrompido
- subboss: Treant Corrompido
- boss: Guardiao das Ruinas

Design rule:

- outskirts near town = safer normal mobs
- forest mid zone = elite pockets
- ruins approach = higher density and harder patrols

### Equipment Tier

Forest should provide:

- starter gear at creation
- Tier 1 gear from quests and Borin
- first accessory choices

Suggested item tier naming:

- `Alder Common`
- `Alder Reinforced`

Rewards:

- main quests give 1 or 2 guaranteed class pieces
- Borin sells baseline replacements
- dungeon drops first "special" accessory / weapon variant

## Region 2: Lava (A2)

### Purpose

- shift from tutorial comfort to hostile field survival
- reinforce potion usage, mobility and party synergy
- introduce stronger elites and better gold flow

### Level Range

- recommended: 6-12

### Hub Identity

Suggested hub name: `Bastiao de Cinzas`

This should feel like a forward military outpost rather than a safe village.

### NPC Layout

Recommended NPC roster:

- Capitao Daren: main warfront quests
- Forjadora Kaia: lava-tier weapons and armor
- Minerador Bronn: gather/material quests
- Arcanista Veila: event and anomaly quests
- Guardiao do Cofre: local chest access
- Portalista Renn: route explanation to undead lands

### Quest Plan

Target quest count for lava:

- 7 main quests
- 4 side quests

Suggested main chain:

1. Marcha para as Cinzas
- first arrival and survey

2. Linhas de Suprimento
- collect materials / stabilize hub

3. Coracoes de Magma
- hunt elites in hot zones

4. Ruinas em Brasa
- fight in a dangerous subzone with higher density

5. Sinais no Horizonte
- scout undead corruption leaking into the frontier

6. A Bigorna Rubra
- obtain second gear milestone

7. Portal para a Desolacao
- unlock undead progression

### Mob Ladder

Suggested themed families:

- normal: Diabrete de Cinza / Salamandra Brasa
- elite: Golem de Escoria / Guerreiro Carbonizado
- subboss: Arauto Vulcanico
- boss: Colosso da Forja

### Equipment Tier

Lava should introduce Tier 2:

- `Basalto`
- `Rubro`
- `Cinzas`

Rewards:

- stronger weapon branch than forest
- visible increase in defense / attack specialization
- first map where ring/necklace variety matters

Special loot identity:

- attack-speed pieces for Archer / Assassin
- magic-defense pieces for Druid
- defense / HP pieces for Knight

### Group Content

Add one of these during lava implementation:

- a second dungeon at level 10-12
- or a stronger map event if dungeon scope is too large

Recommended first option:

- dungeon `Forja Rachada`

## Region 3: Undead (A3)

### Purpose

- deliver the darker campaign arc
- reward class mastery and group play
- close the alpha with a stronger thematic climax

### Level Range

- recommended: 12-18

### Hub Identity

Suggested hub name: `Vigia do Sepulcro`

This should feel like a defensive outpost near cursed ruins and grave fields.

### NPC Layout

Recommended NPC roster:

- Inquisidora Maelis: anti-undead main questline
- Coveiro Iagan: graveyard and relic quests
- Sacerdotisa Elowen: cleansing/support quests
- Armeiro Vorst: undead-tier gear vendor
- Guardiao do Bau: chest access
- Vigia do Mausoleu: dungeon / final challenge entry

### Quest Plan

Target quest count for undead:

- 8 main quests
- 5 side quests

Suggested main chain:

1. Ecos da Putrefacao
- arrival and scouting

2. Ossos sem Descanso
- thin out normal undead packs

3. Coracao do Pano Negro
- defeat elites and inspect cult traces

4. Lamentos no Pantano
- side route with magic-heavy enemies

5. Reliquias Profanadas
- recover quest items from dangerous ruins

6. Vigia em Colapso
- defend hub from pressure spike / event tie-in

7. A Porta do Mausoleu
- prepare final group content

8. O Senhor do Sepulcro
- alpha climax dungeon / boss run

### Mob Ladder

Suggested themed families:

- normal: Esqueleto Errante / Necrorato / Ghoul
- elite: Cavaleiro Exumado / Banshee
- subboss: Abade Corrompido
- boss: Senhor do Sepulcro

### Equipment Tier

Undead introduces Tier 3:

- `Sepulcral`
- `Profanado`
- `Reliquia Sombria`

This tier should include:

- strongest alpha gear
- best accessories
- special dungeon reward weapon variants

## Equipment Progression Model

Keep the current class-based structure, but expand it into tiers instead of isolated templates.

### Recommended Structure

Per class, each gear slot should exist in:

- Tier 0: starter
- Tier 1: forest
- Tier 2: lava
- Tier 3: undead

Slots:

- weapon
- helmet
- chest
- pants
- gloves
- boots
- ring
- necklace

### Suggested Progression Rules

- quests grant guaranteed progression pieces
- shops sell safe baseline versions
- elites and dungeon bosses drop better rolled or rarer variants
- accessories are the main build identity pieces in alpha

### Suggested Stat Direction

Knight:

- defense, maxHp, retaliation, control

Archer:

- accuracy, attack speed, range pressure, crit

Druid:

- magic attack, sustain, utility, defensive scaling

Assassin:

- attack speed, burst, evasion, mobility

## Quest Distribution Target

Recommended alpha total:

- Forest: 10 quests
- Lava: 11 quests
- Undead: 13 quests

Total: 34 quests

This is enough for progression without becoming content-heavy too early.

## Events and Dungeons

### Events

Each map should have one signature event:

- Forest: Fenda da Floresta
- Lava: Tempestade de Brasas
- Undead: Vigilia dos Mortos

Rule:

- events should reward consumables, upgrade materials and a low chance at special gear
- events should never replace quests, only accelerate progression and create social moments

### Dungeons

Recommended alpha dungeon ladder:

- Level 5-6: Ruinas de Alder
- Level 10-12: Forja Rachada
- Level 16-18: Mausoleu do Sepulcro

Dungeon goals:

- teach party play
- reward burst progression jumps
- act as memorable checkpoints

## Economy and Loot

### Currency Identity

Use current wallet ladder:

- copper for early repairs and consumables
- silver for standard gear
- gold for dungeon/event milestones
- diamond should stay rare and almost absent in alpha

### Loot Model

Normal mobs:

- low coin
- potion chance
- occasional material

Elite mobs:

- better coin
- higher potion chance
- small chance at gear or rare material

Subboss:

- guaranteed meaningful drop
- good silver / some gold

Boss:

- milestone reward
- chance at weapon / accessory / hourglass / rare crafting item

## Implementation Roadmap

## Milestone 1: Make Forest a Full Intro Arc

Deliver:

- expand forest to 10 quests
- add 2 or 3 support NPCs
- tie event and dungeon into the questline
- guarantee class gear onboarding

This is the minimum needed for better friend playtests.

## Milestone 2: Build Lava as the Midgame

Deliver:

- lava hub NPCs
- lava quest chain
- Tier 2 gear templates
- themed lava mob families
- second event or dungeon

## Milestone 3: Build Undead as Alpha Climax

Deliver:

- undead hub NPCs
- undead quest chain
- Tier 3 gear
- final alpha group content

## Milestone 4: Reward Loop and Retention

Deliver:

- rare drops per region
- repeatable event rewards
- dungeon replay incentives
- better social goals for guild / party activity

## Minimum Pre-Playtest Backlog

Before inviting a larger friend group to test progression seriously, I recommend prioritizing:

1. Expand forest from 3 to at least 8 quests.
2. Turn lava into a real level 6-10 zone with named mobs and NPCs.
3. Add at least one new gear tier beyond the current baseline shop set.
4. Define mob families per map instead of generic visual role only.
5. Attach event and dungeon rewards to progression instead of novelty only.
6. Add one clear objective after level 6 so players do not stall after the forest.

## Recommended Next Production Step

If the goal is fast value, the next design-and-implementation pass should be:

- forest quest expansion
- lava onboarding region
- tiered item templates

That gives the best progression return without requiring a full content rewrite.
