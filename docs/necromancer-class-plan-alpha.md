# Necromancer Class Plan (Alpha Expansion)

## Goal

Add a fifth class, `necromancer`, using the current player sprite pipeline for now while introducing:

- a readable dark-mage identity
- summoned allies as a core fantasy
- a corpse-charge system tied to kills
- party-friendly PvE value
- controlled PvP pressure without army spam

This is a planning document, not an implementation log.

## High-Level Recommendation

The safest path is to add Necromancer as a post-alpha expansion class after the current 4-class baseline is stable.

The class should reuse:

- the same player sprite as the other classes for now
- the current 2-branch skill tree structure
- the same 5-rank skill progression model
- the current hotbar and cooldown architecture

What must be added:

- a new class template
- a new skill catalog branch set
- a new summon runtime
- a corpse-charge resource
- necromancer-specific equipment generation
- UI support for summon charges and active summon count

## Class Identity

### Fantasy

The Necromancer is a dark battlefield controller inspired by classic MMORPG and action-RPG necromancer fantasies:

- raises fallen enemies as temporary allies
- pressures space with bone and shadow magic
- scales through preparation, not instant burst
- feels strongest in extended fights and wave content

### Combat Role

- PvE: attrition caster, summoner, pack-control specialist
- PvP: anti-frontline pressure, zone denial, summon harassment, delayed threat

### Weaknesses

- low mobility
- low direct burst without setup
- vulnerable if summons are cleared quickly
- relies on kill momentum or corpse generation to hit full value

## Attributes and Base Template

### Attribute Priority

`INT > VIT > DEX > STR`

### Template Recommendation

| Class | STR | INT | DEX | VIT | Initial HP | Move Speed | Attack Speed | Attack Range | Damage Type |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Necromancer | 3 | 14 | 6 | 9 | 128 | 98 | 102 | 265 | magic |

### Stat Meaning

- `INT`: summon damage, summon durability scaling, magic damage, curse potency
- `VIT`: personal survivability and a smaller secondary boost to summon HP
- `DEX`: minor cast rhythm and accuracy interaction only
- `STR`: irrelevant for class gear and should never appear on necromancer equipment

## Base Attack

### Basic Attack

`Soul Bolt`

- reliable magic projectile
- single target
- moderate range
- no summon interaction by itself

This becomes the basic filler when no corpse setup is ready.

## Core System: Grave Charges

### Purpose

Create the signature mechanic you described:

- kill a monster
- gain a charge from that monster
- use the summon skill
- summon one allied version per charge consumed
- hard cap of `10`

### Proposed Runtime Model

Each necromancer should track:

- `graveCharges: number` from `0` to `10`
- `graveTemplateId: string | null`
- `graveFamily: string | null`
- `activeSummons: SummonRuntime[]`

### Recommended Rule Set

For alpha, use **one active grave imprint at a time**:

1. Killing an eligible mob stores its `graveTemplateId`.
2. If the next kill is from the same family/template, charges increase.
3. If the next kill is a different eligible mob, the imprint switches to the new mob family and charges reset to `1`.
4. Maximum charges: `10`.

This is the simplest model to understand and implement.

### Why This Model

It avoids:

- a huge multi-type corpse inventory
- complex UI to select which corpse family to raise
- extremely large world-state payloads
- edge cases with mixed mob packs and map swaps

### Eligible Enemies

Recommended for alpha:

- normal mobs: yes
- elite mobs: yes, but converted to toned-down elite summons
- subboss/boss: no direct copy

For subboss/boss kills, grant:

- `+2` or `+3` charges
- and imprint the nearest valid family from that zone, not the boss itself

This prevents boss-sized summons from breaking readability and PvP.

## Summon Design

### Summon Skill

`Raise Dead`

Behavior:

- consumes all current charges
- summons the stored mob family
- `1 charge = 1 summon`
- `5 charges = 5 summons`
- `10 charges = 10 summons`

### Summon Limits

- maximum active summons: `10`
- summon duration: `22s` to `30s`
- despawn on map change unless specifically restored by runtime rules
- despawn when owner dies

### Summon Stats

Summons should not be full copies of world mobs.

Recommended alpha scaling:

- summon HP: `38%` to `52%` of original mob template
- summon damage: `42%` to `58%` of original mob template
- summon move speed: `100%` to `108%` of original mob template
- summon aggro: assist owner target only

### Visual Rule

Summons should use:

- the same silhouette family as the slain mob when possible
- a necrotic tint or spectral overlay
- smaller scale for oversized mobs

This preserves the fantasy of “raising what you killed” without making visuals unreadable.

## Skill Branches

The current project uses 2 branches with 5 skills each. Necromancer should follow the same structure.

## Branch A: Gravecaller

Summon-heavy branch.

### Identity

- corpse generation
- summon control
- sustained pressure
- party attrition value

### Skills

1. `Raise Dead`
   - signature summon skill
   - consumes current grave charges
   - raises one allied minion per charge

2. `Harvest`
   - single-target magic hit
   - if the target dies within a short window, grants `+1` extra grave charge
   - useful for securing summon tempo

3. `Command Dead`
   - orders all active summons to rush the current target
   - short damage spike and better focus fire

4. `Bone Ward`
   - defensive spell
   - grants the necromancer a bone shield
   - each active summon slightly strengthens the shield

5. `Legion Call`
   - big cooldown
   - instantly grants a few temporary grave charges or refreshes summon duration
   - used to recover summon momentum in bosses or PvP

## Branch B: Bonecaller

Direct caster branch with summon synergy.

### Identity

- stronger personal magic damage
- area pressure
- corpse setup
- fewer but stronger summon windows

### Skills

1. `Bone Spear`
   - piercing magic projectile
   - high single-target pressure

2. `Corpse Burst`
   - consumes a small number of grave charges
   - creates an area explosion around target point
   - primary AoE tool for PvE groups

3. `Blight Field`
   - shadow zone on the ground
   - ticking magic damage and slow

4. `Soul Leech`
   - life siphon
   - damages target and lightly heals the caster
   - reduced efficiency in PvP

5. `Army of Shadows`
   - major cooldown
   - temporarily empowers current summons or creates skeletal shades if no summons are active

## Recommended Skill Progression

- level 1: `Soul Bolt`
- level 1: `Raise Dead`
- level 3: `Harvest` or `Bone Spear`
- level 5: first defensive option (`Bone Ward`)
- level 8: first AoE spell (`Corpse Burst` or `Blight Field`)
- level 12: first major control/power skill (`Command Dead`)
- level 16+: `Legion Call` / `Army of Shadows`

## Skill Rank Scaling

Necromancer should use the same 5-rank scheme as the other classes.

### Scaling Direction

- rank 1: baseline access
- rank 2: +power and +duration
- rank 3: clear breakpoint
- rank 4: improved control or summon durability
- rank 5: signature value spike

### Raise Dead Example

| Rank | Summon Damage Mult | Summon HP Mult | Duration |
| --- | ---: | ---: | ---: |
| 1 | 0.42 | 0.38 | 22s |
| 2 | 0.46 | 0.42 | 23s |
| 3 | 0.50 | 0.46 | 24s |
| 4 | 0.54 | 0.49 | 26s |
| 5 | 0.58 | 0.52 | 28s |

## PvP Rules for Necromancer

Necromancer can work in PvP, but summons must be constrained.

Recommended alpha PvP rules:

- summon damage against players at `55%` to `65%` of PvE value
- summon crowd control should be minimal or none
- maximum simultaneous active summons in PvP can remain `10`, but they must be fragile
- `Soul Leech` healing reduced to about `60%` in PvP
- `Raise Dead` should not work on player kills, only monster kills

This prevents snowball abuse in duels and open-world PvP.

## Equipment Plan

Necromancer needs to be added to the class item generator.

### Weapon Theme

Use `staff` temporarily in the current item icon generator.

Suggested weapon title:

`Cajado Funebre`

### Relevant Stats

- `magicAttack`
- `magicDefense`
- `maxHp`
- `attackSpeed` or cast rhythm proxy

### Stats That Must Never Roll

- `physicalAttack`
- `accuracy`
- `physicalDefense` as a primary scaling identity

### Slot Theme

Necromancer gear should bias:

- chest/pants/helmet: magicDefense and maxHp
- gloves/ring/necklace: magicAttack and summon-support stats
- boots: moveSpeed and magicDefense

## Merchant and Progression Fit

Necromancer fits naturally into the city merchant layout:

- weapon from arcane/occult vendor or shared caster merchant
- armor from light/ritual armor vendor
- jewelry from the jeweler
- skill reset and summoning reagents from a utility merchant later

For alpha progression:

- Forest should be the first map where corpse accumulation feels strong
- Lava should reward smaller but tougher summon windows
- Undead should be the strongest biome fantasy match for the class

## UI and HUD Requirements

Necromancer needs extra UI support beyond normal classes.

### Must-Have

- grave charge counter near the player HUD or hotbar
- label of the current grave imprint
- active summon count

### Nice to Have

- small icon preview of the stored mob family
- summon timer on the Necromancer panel

## Technical Integration Plan

### Server

Files likely affected:

- [server/config/index.ts](/c:/Users/joaovictor.martins/Desktop/Noxis-Phaser/server/config/index.ts)
- [server/content/skillCatalog.ts](/c:/Users/joaovictor.martins/Desktop/Noxis-Phaser/server/content/skillCatalog.ts)
- [server/content/itemCatalog.ts](/c:/Users/joaovictor.martins/Desktop/Noxis-Phaser/server/content/itemCatalog.ts)
- combat services
- runtime types

Needs:

- add `necromancer` to class templates
- add skill defs and chains
- add corpse charge accumulation on eligible kills
- add summon runtime and snapshot sync

### Client

Files likely affected:

- HUD store and skill tree
- skill icon generator
- world scene for summon rendering and VFX
- tooltip/item class labels

Needs:

- add necromancer to skill tree UI
- add icons and branch names
- add summon rendering
- add grave charge HUD

## Recommended Implementation Order

1. Add `necromancer` class template and client-facing labels.
2. Add necromancer gear profile to the item generator.
3. Add skill branches and icons.
4. Add grave charge resource and kill hooks.
5. Add summon runtime.
6. Render summons in the world.
7. Add HUD charge/imprint tracking.
8. PvE tuning first.
9. PvP tuning after PvE feels stable.

## Final Recommendation

Yes, this class fits the project well.

The best alpha version is:

- one sprite shared with current player visuals
- one summon resource: `graveCharges`
- one stored corpse family at a time
- one core summon button: `Raise Dead`
- one direct-damage branch and one summon-control branch

That gives the fantasy you want without exploding complexity too early.
