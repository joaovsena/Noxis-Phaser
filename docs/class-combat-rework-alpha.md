# Noxis Class Combat Rework (Alpha PvE/PvP)

## Purpose

Replace the current skill set with a cleaner class kit that:

- reads better in combat
- supports PvE progression and open-world play
- supports party play
- unlocks readable PvP without instant chaos
- preserves the current 4-class structure of the project

This document is a combat design spec, not an implementation log.

Post-alpha class expansion note:

- see [necromancer-class-plan-alpha.md](./necromancer-class-plan-alpha.md) for the proposed fifth class expansion built on top of this combat baseline

## Core Combat Pillars

1. Every class must have a clear job at first glance.
2. Every class must have a weakness that creates counterplay.
3. PvE and PvP must share the same kit whenever possible.
4. Burst, sustain and control must never peak at the same time on the same build.
5. Crowd control should be short and tactical.

## Primary Attributes

Keep the current four attributes:

| Attribute | Main Use |
| --- | --- |
| STR | melee physical damage, armor penetration, heavy-hit scaling |
| DEX | ranged physical damage, accuracy, crit, evasion, attack speed |
| INT | magic damage, healing, buff potency |
| VIT | HP, mitigation, sustain, resistance |

## Suggested Class Stat Identity

| Class | Priority | Role Summary |
| --- | --- | --- |
| Knight | VIT > STR > DEX > INT | frontliner, peel, engage, anti-burst |
| Archer | DEX > STR > VIT > INT | poke, kite, control, long-range pressure |
| Druid | INT > VIT > DEX > STR | sustain, zone control, support, magic pressure |
| Assassin | DEX > STR > VIT > INT | flank, burst, disruption, execution |

## Suggested Base Class Templates

These can replace the current class templates later with only moderate balancing work.

| Class | STR | INT | DEX | VIT | Initial HP | Move Speed | Attack Speed | Attack Range | Damage Type |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Knight | 9 | 3 | 5 | 13 | 190 | 95 | 95 | 64 | physical |
| Archer | 6 | 4 | 13 | 7 | 120 | 112 | 130 | 260 | physical |
| Druid | 4 | 13 | 6 | 9 | 135 | 100 | 100 | 250 | magic |
| Assassin | 8 | 3 | 13 | 5 | 105 | 118 | 140 | 68 | physical |

## Global PvP Rules

Recommended global rules for the alpha:

- hard CC duration target: `0.8s` to `1.4s`
- slows are more common than stuns
- self-healing in PvP should be reduced to about `60%` efficiency
- stealth must break on offensive action
- executes should require low target HP to gain full value
- repeated CC should suffer diminishing returns in PvP
- damage-over-time effects should pressure, not solo-kill healthy targets

## Base Attack Identity

Each class should keep one reliable baseline action:

| Class | Base Attack | Function |
| --- | --- | --- |
| Knight | Shield Slash | short-range stable damage with threat generation |
| Archer | Quick Shot | reliable ranged poke and kiting anchor |
| Druid | Nature Bolt | safe magic attack for filler damage |
| Assassin | Twin Stab | fast melee filler for pressure windows |

## Knight

### Identity

The Knight is the anchor class. It should feel durable, decisive and honest. It wins through presence, space control and forcing bad trades.

### Branch A: Vanguard

Tank, peel and front line control.

| Skill | Type | Target | Effect |
| --- | --- | --- | --- |
| Shield Rush | engage | mob/player | short dash that hits and briefly staggers the first target |
| Iron Oath | buff | self | raises physical and magical defense for a short window |
| Ground Lock | control | area | slams the ground, slowing enemies in a small circle |
| Rallying Guard | support | self/party aura | grants temporary damage reduction to nearby allies |
| Last Bastion | ultimate-style active | self | strong defensive stance, reduced mobility, high survivability, ideal for holding point or boss |

### Branch B: Reaver

Bruiser, pressure and anti-frontline.

| Skill | Type | Target | Effect |
| --- | --- | --- | --- |
| Cleaving Arc | attack | cone | broad melee swing that hits multiple targets |
| Bonebreaker | attack/debuff | mob/player | heavy hit that lowers target armor briefly |
| Blood Roar | buff | self | increases damage and lifesteal for a short burst window |
| Chain Rend | combo | mob/player | fast follow-up strike that deals bonus damage to already wounded targets |
| Headsman | execute | mob/player | high-impact finisher that scales strongly on low-health targets |

## Archer

### Identity

The Archer controls pace. It should win through spacing, accuracy and punishing bad positioning.

### Branch A: Ranger

Kite, control and battlefield tempo.

| Skill | Type | Target | Effect |
| --- | --- | --- | --- |
| Crippling Shot | attack/control | mob/player | ranged shot that applies a slow |
| Snare Trap | control | ground target | places a trap that roots the first enemy stepping on it |
| Windstep | mobility | self | quick movement burst with short collision forgiveness |
| Arrow Rain | area | area | raining volley over a small zone for repeated light hits |
| Scout Mark | utility/debuff | mob/player | reveals and marks target, increasing team damage taken slightly |

### Branch B: Sharpshooter

Pickoff, burst and single-target kill pressure.

| Skill | Type | Target | Effect |
| --- | --- | --- | --- |
| Steady Aim | buff | self | improves crit rate and accuracy for a few shots |
| Piercing Arrow | attack | line | strong shot that can pass through the first target |
| Suppressing Bolt | attack/debuff | mob/player | lowers target attack speed or cast rhythm briefly |
| Eagle Sight | buff | self | extends range and empowers the next offensive skill |
| Mercy Shot | execute | mob/player | long-range finisher with bonus damage on low-health targets |

## Druid

### Identity

The Druid is a hybrid controller. It should feel like a sustain-and-zones specialist, not a pure healer or pure nuker.

### Branch A: Lifebinder

Healing, protection and anti-attrition.

| Skill | Type | Target | Effect |
| --- | --- | --- | --- |
| Bloom | heal | self/ally later | direct heal with good efficiency and short cast feel |
| Barkskin | buff | self | increases durability and lowers incoming burst |
| Grasping Roots | control | mob/player/area | roots targets in a small area for a short duration |
| Spirit Current | sustain | self/party aura | small regenerative pulse over time |
| Sanctuary Grove | area support | ground target | creates a protective field that heals allies and weakens enemy pressure inside |

### Branch B: Blightcaller

Magic pressure, attrition and zone denial.

| Skill | Type | Target | Effect |
| --- | --- | --- | --- |
| Thorn Lash | attack | mob/player | focused magical strike with reliable mid-range damage |
| Swarm Cloud | damage-over-time | area | cloud that applies ticking damage in a zone |
| Rot Seed | delayed burst | mob/player | plants a seed that detonates after a delay or on repeat hit |
| Mire Veil | control | area | dark marsh field that slows and hinders movement |
| Eclipse Bloom | burst | mob/player/area | high-impact magical detonation, strongest when the target is already afflicted |

## Assassin

### Identity

The Assassin is a pressure predator. It should force respect through mobility and threat, but fail if it commits at the wrong time.

### Branch A: Duelist

Skirmish, mobility and short trade control.

| Skill | Type | Target | Effect |
| --- | --- | --- | --- |
| Lunge | engage | mob/player | quick forward stab to stick to a target |
| Riposte | reactive | self | brief defensive window that punishes direct melee retaliation |
| Shadowstep | mobility | self/targeted jump | fast reposition behind or around target |
| Nerve Cut | debuff | mob/player | precise strike that lowers move speed and attack rhythm |
| Blade Dance | area burst | self area | rapid multi-hit spin for close-range pressure |

### Branch B: Shade

Stealth, pickoff and backline execution.

| Skill | Type | Target | Effect |
| --- | --- | --- | --- |
| Hunter's Mark | buff/debuff | mob/player | increases the assassin's burst against one target |
| Veil | stealth | self | enter stealth for a short setup window |
| Ambush | opener | mob/player | stealth opener with strong bonus damage and short stagger |
| Smoke Screen | control | area | creates vision and pressure disruption, helping escape or engage |
| Nightfall | execute | mob/player | delayed or conditional finisher for committed kill windows |

## Passive Design Direction

Each class should also have two passive lanes:

| Class | Passive Lane 1 | Passive Lane 2 |
| --- | --- | --- |
| Knight | durability, guard, anti-burst | wound pressure, armor break, sustain on hit |
| Archer | kiting, speed, precision | crit, pickoff, execution |
| Druid | healing, shields, regen | dots, curse, zone amplification |
| Assassin | mobility, evasion, combo flow | stealth, burst, finisher pressure |

## Skill Progression Structure

Recommended progression for the alpha:

- level 1: base attack + first branch skill
- level 3: first defensive or control tool
- level 5: first signature class button
- level 8: branch identity becomes clear
- level 12: first strong PvP-defining skill
- level 16+: finisher / large field-control skill

## PvE and PvP Use Cases

### Knight

- PvE: tank packs, create safe front line, lead bosses
- PvP: peel assassins, hold choke points, punish overextension

### Archer

- PvE: clear packs from distance, help isolate elites
- PvP: kite bruisers, chip down targets, secure fleeing kills

### Druid

- PvE: stabilize party, control waves, soften large pulls
- PvP: deny space, prolong fights, punish teams that clump

### Assassin

- PvE: kill priority targets, rotate quickly, punish isolated mobs
- PvP: threaten backline, force reactions, create chaos in short windows

## Recommended Implementation Order

1. Rework class templates and target stat baselines.
2. Replace current skill tree labels and summaries in the HUD.
3. Rebuild `SKILL_DEFS` on the server using this new identity.
4. Add PvP-specific tuning multipliers after PvE baseline feels correct.
5. Only then balance equipment and merchants around these new class roles.

## Migration Notes

To keep implementation manageable, preserve:

- class ids: `knight`, `archer`, `druid`, `assassin`
- two branches per class
- five core branch skills for the alpha
- current hotbar and skill-tree architecture

What should change:

- names
- summaries
- effects
- scaling
- role identity
- cooldown philosophy
