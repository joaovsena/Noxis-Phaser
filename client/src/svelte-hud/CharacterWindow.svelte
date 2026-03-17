<script lang="ts">
  import Window from './components/Window.svelte';
  import Slot from './components/Slot.svelte';
  import { beginDrag, dragStore, equipInventoryItem, equippedSlots, playerStats, unequipItem } from './stores/gameUi';

  const slotLabels: Record<string, string> = {
    helmet: 'Capacete',
    chest: 'Peitoral',
    pants: 'Calcas',
    gloves: 'Luvas',
    boots: 'Botas',
    ring: 'Anel',
    weapon: 'Arma',
    necklace: 'Colar'
  };

  const orderedSlots = ['helmet', 'chest', 'pants', 'gloves', 'boots', 'ring', 'weapon', 'necklace'];

  function handleEquipDrop(slotKey: string, event: DragEvent) {
    event.preventDefault();
    const payload = $dragStore;
    if (!payload) return;
    if (payload.source === 'inventory') equipInventoryItem(payload.itemId);
  }
</script>

<Window title="Personagem" subtitle="Equipamentos e atributos" width="420px">
  <div class="hero-strip">
    <div class="hero-core">{$playerStats.className}</div>
    <div class="hero-meta">
      <div class="hero-level">Nivel {$playerStats.level}</div>
      <div class="hero-xp">XP {$playerStats.xp} / {$playerStats.xpToNext}</div>
    </div>
  </div>

  <div class="equipment-grid">
    {#each orderedSlots as slotKey}
      <div class="equip-shell" role="group" aria-label={slotLabels[slotKey]} on:dragover|preventDefault on:drop={(event) => handleEquipDrop(slotKey, event)}>
        <div class="equip-label">{slotLabels[slotKey]}</div>
        <Slot
          item={$equippedSlots[slotKey]}
          size={56}
          on:dragstart={(event) => event.detail && beginDrag({ source: 'equipment', itemId: String(event.detail.id), slot: slotKey })}
          on:dblactivate={(event) => event.detail && unequipItem(event.detail)}
        />
      </div>
    {/each}
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-head">Base</div>
      <div>FOR {$playerStats.base.str || 0}</div>
      <div>INT {$playerStats.base.int || 0}</div>
      <div>DES {$playerStats.base.dex || 0}</div>
      <div>VIT {$playerStats.base.vit || 0}</div>
    </div>
    <div class="stat-card">
      <div class="stat-head">Combate</div>
      <div>PATK {$playerStats.combat.physicalAttack}</div>
      <div>MATK {$playerStats.combat.magicAttack}</div>
      <div>PDEF {$playerStats.combat.physicalDefense}</div>
      <div>MDEF {$playerStats.combat.magicDefense}</div>
      <div>ACC {$playerStats.combat.accuracy}</div>
      <div>EVA {$playerStats.combat.evasion}</div>
    </div>
  </div>
</Window>

<style>
  .hero-strip {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .hero-core,
  .stat-card {
    clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(15, 12, 10, 0.96), rgba(8, 8, 8, 0.98));
  }

  .hero-core {
    min-width: 82px;
    min-height: 82px;
    display: grid;
    place-items: center;
    padding: 8px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    color: #f2dfb7;
  }

  .hero-meta {
    display: grid;
    gap: 6px;
    color: rgba(228, 218, 194, 0.8);
    font-size: 0.82rem;
  }

  .hero-level {
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    color: #efdcb3;
  }

  .equipment-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .equip-shell {
    display: grid;
    gap: 6px;
    justify-items: center;
  }

  .equip-label,
  .stat-head {
    font-family: 'Cinzel', serif;
    font-size: 0.64rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.76);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .stat-card {
    padding: 12px;
    display: grid;
    gap: 6px;
    color: rgba(233, 223, 200, 0.78);
    font-size: 0.78rem;
  }

  @media (max-width: 560px) {
    .equipment-grid,
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
