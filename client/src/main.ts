import Phaser from 'phaser';
import './style.css';
import { BootScene } from './game/scenes/BootScene';
import { WorldScene } from './game/scenes/WorldScene';
import { GameStore, type CharacterSlot } from './game/state/GameStore';
import { GameSocket } from './game/net/GameSocket';

type SkillNode = {
  id: string;
  classId: string;
  buildKey: 'buildA' | 'buildB';
  buildLabel: string;
  label: string;
  x: number;
  prereq: string | null;
  maxPoints: number;
};

const store = new GameStore();
const socket = new GameSocket(store);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#08111b',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: innerWidth, height: innerHeight },
  scene: [new BootScene(), new WorldScene({ store, socket })]
});

const PANEL_SHORTCUTS: Record<string, string> = { c: 'char-panel', b: 'inventory-panel', v: 'skills-panel', j: 'quest-panel', m: 'worldmap-panel', g: 'party-panel', o: 'friends-panel' };
const HOTBAR_KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', '1', '2', '3', '4', '5', '6', '7', '8'];
const SKILL_STATE_STORAGE_KEY = 'noxis.skillTree.v1';
const SKILL_TREE: SkillNode[] = buildSkillTree();

let chatScope: 'local' | 'map' | 'global' = 'local';
let chatViewMode: 'expanded' | 'compact' | 'mini' | 'manual' = 'expanded';
let requestedInGameState = false;
let draggingPayload: any = null;
let selectedAreaPartyId: string | null = null;
let skillTreeTab: 'buildA' | 'buildB' = 'buildA';
let selectedAutoAttackSkillId = loadSkillState();
let targetCycleIndex = -1;
let chatManualSizing = false;
let chatManualOrigin = { x: 0, y: 0, width: 360, height: 260 };
let autoAttackEnabled = true;
let shopQuantities: Record<string, number> = {};

function buildSkillTree(): SkillNode[] {
  const defs = {
    knight: { a: ['Escudo da Fe|war_bastion_escudo_fe', 'Muralha|war_bastion_muralha', 'Renovacao|war_bastion_renovacao', 'Inabalavel|war_bastion_inabalavel', 'Impacto Sismico|war_bastion_impacto_sismico'], b: ['Frenesi|war_carrasco_frenesi', 'Lacerar|war_carrasco_lacerar', 'Ira|war_carrasco_ira', 'Golpe de Sacrificio|war_carrasco_golpe_sacrificio', 'Aniquilacao|war_carrasco_aniquilacao'], labels: ['Bastiao', 'Carrasco'] },
    archer: { a: ['Tiro Ofuscante|arc_patrulheiro_tiro_ofuscante', 'Foco Distante|arc_patrulheiro_foco_distante', 'Abrolhos|arc_patrulheiro_abrolhos', 'Salva de Flechas|arc_patrulheiro_salva_flechas', 'Passo de Vento|arc_patrulheiro_passo_vento'], b: ['Flecha Debilitante|arc_franco_flecha_debilitante', 'Ponteira Envenenada|arc_franco_ponteira_envenenada', 'Olho de Aguia|arc_franco_olho_aguia', 'Disparo Perfurante|arc_franco_disparo_perfurante', 'Tiro de Misericordia|arc_franco_tiro_misericordia'], labels: ['Patrulheiro', 'Franco'] },
    druid: { a: ['Florescer|dru_preservador_florescer', 'Casca de Ferro|dru_preservador_casca_ferro', 'Emaranhado|dru_preservador_emaranhado', 'Prece da Natureza|dru_preservador_prece_natureza', 'Avatar Espiritual|dru_preservador_avatar_espiritual'], b: ['Espinhos|dru_primal_espinhos', 'Enxame|dru_primal_enxame', 'Patada Sombria|dru_primal_patada_sombria', 'Nevoa Obscura|dru_primal_nevoa_obscura', 'Invocacao Primal|dru_primal_invocacao_primal'], labels: ['Preservador', 'Primal'] },
    assassin: { a: ['Reflexos|ass_agil_reflexos', 'Contra-Ataque|ass_agil_contra_ataque', 'Passo Fantasma|ass_agil_passo_fantasma', 'Golpe de Nervos|ass_agil_golpe_nervos', 'Miragem|ass_agil_miragem'], b: ['Expor Fraqueza|ass_letal_expor_fraqueza', 'Ocultar|ass_letal_ocultar', 'Emboscada|ass_letal_emboscada', 'Bomba de Fumaca|ass_letal_bomba_fumaca', 'Sentenca|ass_letal_sentenca'], labels: ['Agil', 'Letal'] }
  } as const;
  const out: SkillNode[] = [];
  for (const [classId, def] of Object.entries(defs)) {
    def.a.forEach((raw, idx) => { const [label, id] = raw.split('|'); out.push({ id, classId, buildKey: 'buildA', buildLabel: def.labels[0], label, x: 14, prereq: idx > 0 ? def.a[idx - 1].split('|')[1] : null, maxPoints: 5 }); });
    def.b.forEach((raw, idx) => { const [label, id] = raw.split('|'); out.push({ id, classId, buildKey: 'buildB', buildLabel: def.labels[1], label, x: 48, prereq: idx > 0 ? def.b[idx - 1].split('|')[1] : null, maxPoints: 5 }); });
  }
  return out;
}

function loadSkillState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SKILL_STATE_STORAGE_KEY) || '{}');
    return typeof parsed.autoAttackSkillId === 'string' && parsed.autoAttackSkillId ? parsed.autoAttackSkillId : 'class_primary';
  } catch {
    return 'class_primary';
  }
}

function persistSkillState() {
  try { window.localStorage.setItem(SKILL_STATE_STORAGE_KEY, JSON.stringify({ autoAttackSkillId: selectedAutoAttackSkillId })); } catch {}
}

function byId<T extends HTMLElement>(id: string) { return document.getElementById(id) as T | null; }
function setHidden(el: Element | null, hidden: boolean) { el?.classList.toggle('hidden', hidden); }
function esc(v: unknown) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function isTypingTarget(target: EventTarget | null) { const el = target as HTMLElement | null; const tag = String(el?.tagName || '').toLowerCase(); return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(el?.isContentEditable); }
function classLabel(classId: string) { const n = String(classId || '').toLowerCase(); if (n === 'archer') return 'Arqueiro'; if (n === 'druid' || n === 'shifter') return 'Druida'; if (n === 'assassin' || n === 'bandit') return 'Assassino'; return 'Cavaleiro'; }
function classIcon(classId: string) { const n = String(classId || '').toLowerCase(); if (n === 'archer') return 'A'; if (n === 'druid' || n === 'shifter') return 'D'; if (n === 'assassin' || n === 'bandit') return 'S'; return 'K'; }
function skillClass(classId: string) { const n = String(classId || '').toLowerCase(); if (n === 'bandit') return 'assassin'; if (n === 'shifter') return 'druid'; return n || 'knight'; }
function normStats(raw: any) { const s = raw && typeof raw === 'object' ? raw : {}; const toInt = (v: unknown) => Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0; return { str: toInt(s.str ?? s.for), int: toInt(s.int), dex: toInt(s.dex ?? s.des), vit: toInt(s.vit) }; }
function walletLabel(wallet: any) { const w = wallet && typeof wallet === 'object' ? wallet : {}; return [`${Number(w.diamond || 0)}d`, `${Number(w.gold || 0)}g`, `${Number(w.silver || 0)}s`, `${Number(w.copper || 0)}c`].filter((entry) => !entry.startsWith('0')).join(' ') || '0c'; }
function localPlayer() { const s = store.getState(); return s.playerId ? s.resolvedWorld?.players?.[String(s.playerId)] || null : null; }
function inventoryItems() { return Array.isArray(store.getState().inventoryState?.inventory) ? store.getState().inventoryState.inventory : []; }
function equippedBySlot() { return store.getState().inventoryState?.equippedBySlot || {}; }
function localSkillLevels() { return localPlayer()?.skillLevels && typeof localPlayer()?.skillLevels === 'object' ? localPlayer()!.skillLevels : {}; }
function skillNode(id: string) { return SKILL_TREE.find((node) => node.id === id) || null; }
function skillLevel(id: string) { return Math.max(0, Math.min(5, Number(localSkillLevels()[id] || 0))); }
function skillPoints() { return Number.isFinite(Number(localPlayer()?.skillPointsAvailable)) ? Math.max(0, Math.floor(Number(localPlayer()?.skillPointsAvailable || 0))) : 0; }
function autoAttackDef(id: string) { if (!id || id === 'class_primary') return { id: 'class_primary', label: 'Atk Basico' }; const node = skillNode(id); if (node && skillLevel(id) > 0) return { id, label: node.label }; if (id === 'mod_fire_wing') return { id, label: 'Asa de Fogo' }; return null; }
function availableAutoAttacks() { const out = [{ id: 'class_primary', label: 'Atk Basico' }]; const cls = skillClass(String(localPlayer()?.class || 'knight')); SKILL_TREE.filter((node) => node.classId === cls && skillLevel(node.id) > 0).forEach((node) => out.push({ id: node.id, label: node.label })); if ([...inventoryItems(), ...Object.values(equippedBySlot())].some((it: any) => String(it?.name || '').toLowerCase().includes('asa de fogo'))) out.push({ id: 'mod_fire_wing', label: 'Asa de Fogo' }); return out; }
function systemMessage(text: string) { store.pushChatMessage({ id: `${Date.now()}-${Math.random()}`, type: 'system', text, at: Date.now() }); }
function isHostilePlayer(player: any) { return player && Number(player.id || 0) !== Number(store.getState().playerId) && !player.dead && Number(player.hp || 0) > 0 && String(player.pvpMode || 'peace') !== 'peace'; }
function inferEquipSlot(item: any) { const slot = String(item?.slot || '').toLowerCase(); if (slot) return slot; const type = String(item?.type || '').toLowerCase(); if (type === 'weapon') return 'weapon'; if (type === 'ring') return 'ring'; if (type === 'necklace' || type === 'amulet') return 'necklace'; return type === 'equipment' ? '' : ''; }
function walletToCopper(wallet: any) { const w = wallet && typeof wallet === 'object' ? wallet : {}; return (Number(w.diamond || 0) * 1000000) + (Number(w.gold || 0) * 10000) + (Number(w.silver || 0) * 100) + Number(w.copper || 0); }
function getShopQuantity(offerId: string) { return Math.max(1, Math.min(99, Number(shopQuantities[offerId] || 1))); }
function setShopQuantity(offerId: string, nextValue: number) { shopQuantities[offerId] = Math.max(1, Math.min(99, Math.floor(Number(nextValue || 1)))); }
function showTooltip(html: string, clientX: number, clientY: number) { const el = byId<HTMLElement>('item-tooltip'); if (!el) return; el.innerHTML = html; el.classList.remove('hidden'); const rect = el.getBoundingClientRect(); const left = Math.max(8, Math.min(clientX + 12, innerWidth - rect.width - 8)); const top = Math.max(8, Math.min(clientY + 12, innerHeight - rect.height - 8)); el.style.left = `${left}px`; el.style.top = `${top}px`; }
function hideTooltip() { byId('item-tooltip')?.classList.add('hidden'); }
function itemTooltipHtml(item: any) {
  const quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
  const bonusEntries = item?.bonuses && typeof item.bonuses === 'object' ? Object.entries(item.bonuses).filter(([, value]) => Number(value || 0) !== 0) : [];
  const bonuses = bonusEntries.map(([key, value]) => `<div class="${Number(value) >= 0 ? 'tooltip-bonus-pos' : 'tooltip-bonus-neg'}">${esc(String(key).toUpperCase())}: ${Number(value) > 0 ? '+' : ''}${Number(value)}</div>`).join('');
  const requiredClass = item?.requiredClass ? `<div class="tooltip-muted">Classe: ${esc(classLabel(String(item.requiredClass)))}</div>` : '';
  const equipSlot = inferEquipSlot(item);
  const equipped = equipSlot ? equippedBySlot()[equipSlot] : null;
  const compareEntries = equipped?.bonuses && typeof equipped.bonuses === 'object' ? Object.entries(equipped.bonuses).filter(([, value]) => Number(value || 0) !== 0) : [];
  const compareBlock = equipped ? `<div class="tooltip-section"><div class="tooltip-muted">Equipado: ${esc(String(equipped.name || 'Item'))}</div>${compareEntries.map(([key, value]) => `<div class="${Number(value) >= 0 ? 'tooltip-bonus-pos' : 'tooltip-bonus-neg'}">${esc(String(key).toUpperCase())}: ${Number(value) > 0 ? '+' : ''}${Number(value)}</div>`).join('') || '<div class="tooltip-muted">Sem bonus declarados.</div>'}</div>` : '';
  if (String(item?.type || '') === 'potion_hp') return `<div class="tooltip-title">${esc(item.name || 'Pocao')}</div><div class="tooltip-muted">Consumivel</div><div>Recupera HP</div><div class="tooltip-muted">Qtd: ${quantity}</div>`;
  return `<div class="tooltip-title">${esc(item?.name || item?.templateId || 'Item')}</div><div class="tooltip-muted">Tipo: ${esc(item?.type || 'generic')}</div>${requiredClass}${bonuses || '<div class="tooltip-muted">Sem bonus declarados.</div>'}<div class="tooltip-muted">Qtd: ${quantity}</div>${compareBlock}`;
}
function skillTooltipHtml(skillId: string) { const node = skillNode(skillId); if (!node) return `<div><strong>Habilidade</strong></div>`; return `<div><strong>${esc(node.label)}</strong></div><div>Nivel: ${skillLevel(skillId)}/${node.maxPoints}</div><div>Classe: ${esc(classLabel(node.classId))}</div>`; }
function selectNearestHostileTarget(reverse = false) { const me = localPlayer(); const world = store.getState().resolvedWorld; if (!me || !world) return; const candidates: Array<{ type: 'mob' | 'player'; id: string; dist: number }> = []; for (const mob of Array.isArray(world.mobs) ? world.mobs : []) { if (!mob || Number(mob.hp || 0) <= 0) continue; candidates.push({ type: 'mob', id: String(mob.id), dist: Math.hypot(Number(mob.x || 0) - Number(me.x || 0), Number(mob.y || 0) - Number(me.y || 0)) }); } for (const player of Object.values(world.players || {})) { const safe = player as any; if (!isHostilePlayer(safe)) continue; candidates.push({ type: 'player', id: String(safe.id), dist: Math.hypot(Number(safe.x || 0) - Number(me.x || 0), Number(safe.y || 0) - Number(me.y || 0)) }); } candidates.sort((a, b) => a.dist - b.dist); if (!candidates.length) { targetCycleIndex = -1; store.update({ selectedMobId: null, selectedPlayerId: null }); systemMessage('Nenhum alvo hostil proximo.'); return; } const currentTargetKey = store.getState().selectedMobId ? `mob:${store.getState().selectedMobId}` : store.getState().selectedPlayerId ? `player:${store.getState().selectedPlayerId}` : ''; const currentIndex = candidates.findIndex((entry) => `${entry.type}:${entry.id}` === currentTargetKey); targetCycleIndex = currentIndex >= 0 ? (currentIndex + (reverse ? -1 : 1) + candidates.length) % candidates.length : 0; const next = candidates[targetCycleIndex]; if (next.type === 'mob') { store.update({ selectedMobId: next.id, selectedPlayerId: null }); socket.send({ type: 'target_mob', mobId: next.id }); return; } store.update({ selectedPlayerId: Number(next.id) || null, selectedMobId: null }); }

// RENDERERS
function renderCharacterSlots(slots: CharacterSlot[], selectedSlot: number | null) {
  const summary = byId<HTMLElement>('character-summary');
  let selected: CharacterSlot = null;
  for (let i = 0; i < 3; i += 1) {
    const button = byId<HTMLButtonElement>(`character-slot-${i}`);
    const slot = slots[i] || null;
    if (!button) continue;
    button.classList.toggle('selected', selectedSlot === i);
    button.classList.toggle('empty', !slot);
    button.innerHTML = slot ? `<span class="slot-title">${esc(slot.name)}</span><span class="slot-line">${classLabel(slot.class)} Lv.${slot.level || 1}</span>` : `<span class="slot-title">Slot ${i + 1}</span><span class="slot-line">Vazio</span>`;
    if (selectedSlot === i) selected = slot;
  }
  if (summary) summary.textContent = selected ? `Selecionado: ${selected.name} (${classLabel(selected.class)}) Nivel ${selected.level || 1}.` : 'Selecione um slot com personagem ou crie um novo.';
}

function renderChat() {
  const chatLog = byId<HTMLElement>('chat-log');
  if (!chatLog) return;
  const visibleMessages = store.getState().chatMessages.filter((entry) => entry.type === 'system' || String(entry.scope || 'local') === chatScope).slice(-60);
  chatLog.innerHTML = visibleMessages.map((entry) => entry.type === 'system' ? `<div class="chat-line"><span class="chat-tag">[system]</span> ${esc(entry.text)}</div>` : `<div class="chat-line"><span class="chat-tag">[${esc(entry.scope || 'local')}]</span> ${esc(entry.from || 'Anon')}: ${esc(entry.text)}</div>`).join('');
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderInventory() {
  const grid = byId<HTMLElement>('inventory-grid');
  const label = byId<HTMLElement>('inventory-equipped-label');
  if (!grid) return;
  grid.innerHTML = '';
  const items = inventoryItems().filter((entry: any) => entry?.equipped !== true);
  const bySlotIndex = new Map(items.map((entry: any) => [Number(entry.slotIndex), entry]));
  for (let i = 0; i < 36; i += 1) {
    const slot = document.createElement('div');
    const item = bySlotIndex.get(i);
    slot.className = 'inv-slot';
    slot.ondragover = (event) => { event.preventDefault(); slot.classList.add('hovered'); };
    slot.ondragleave = () => slot.classList.remove('hovered');
    slot.ondrop = () => {
      slot.classList.remove('hovered');
      if (!draggingPayload?.itemId) return;
      socket.send(draggingPayload.source === 'equipment' ? { type: 'inventory_unequip_to_slot', itemId: draggingPayload.itemId, toSlot: i } : { type: 'inventory_move', itemId: draggingPayload.itemId, toSlot: i });
      draggingPayload = null;
    };
    if (item) {
      const itemEl = document.createElement('div');
      itemEl.className = `inv-item item-type-${String(item.type || 'generic')}`;
      itemEl.textContent = String(item.name || item.templateId || 'Item');
      itemEl.draggable = true;
      itemEl.onmousemove = (event) => showTooltip(itemTooltipHtml(item), event.clientX, event.clientY);
      itemEl.onmouseleave = () => hideTooltip();
      itemEl.onclick = () => socket.send((String(item.type || '') === 'weapon' || String(item.type || '') === 'equipment') ? { type: 'equip_req', itemId: item.id } : { type: 'item.use', itemId: item.id });
      itemEl.ondblclick = itemEl.onclick;
      itemEl.oncontextmenu = (event) => { event.preventDefault(); store.update({ pendingDeleteItemId: String(item.id) }); };
      itemEl.ondragstart = () => { draggingPayload = { source: 'inventory', itemId: String(item.id) }; };
      itemEl.ondragend = () => { draggingPayload = null; };
      if (Number(item.quantity || 1) > 1) { const qty = document.createElement('div'); qty.className = 'inv-item-qty'; qty.textContent = String(item.quantity); itemEl.appendChild(qty); }
      slot.appendChild(itemEl);
    }
    grid.appendChild(slot);
  }
  if (label) label.innerHTML = `Arma equipada: ${esc(String(equippedBySlot().weapon?.name || 'nenhuma'))} <span class="wallet-inline">${walletLabel(store.getState().inventoryState?.wallet)}</span>`;
}

function normalizeHotbar() {
  const src = store.getState().hotbarBindings || {};
  const out: Record<string, any> = {};
  HOTBAR_KEYS.forEach((key) => { out[key] = src[key] || null; });
  if (!out['1']) out['1'] = { type: 'action', actionId: 'basic_attack' };
  return out;
}

function renderHotbar() {
  const bindings = normalizeHotbar();
  document.querySelectorAll<HTMLElement>('.skill-slot-btn').forEach((button) => {
    const key = String(button.dataset.key || '').toLowerCase();
    const binding = bindings[key];
    let icon = '', title = String(button.dataset.key || '').toUpperCase(), qty = '', iconClass = 'slot-icon';
    button.classList.remove('slot-kind-action', 'slot-kind-item', 'slot-kind-empty', 'slot-icon-potion', 'slot-ghosted');
    if (binding?.type === 'action' && binding.actionId === 'basic_attack') { icon = 'ATK'; title = autoAttackDef(selectedAutoAttackSkillId)?.label || 'Ataque Basico'; button.classList.add('slot-kind-action'); }
    else if (binding?.type === 'action' && binding.actionId === 'skill_cast') { icon = esc(String(binding.skillName || skillNode(String(binding.skillId || ''))?.label || 'Habilidade').slice(0, 18)); title = String(binding.skillName || 'Habilidade'); iconClass = 'slot-icon slot-icon-skill'; button.classList.add('slot-kind-action'); }
    else if (binding?.type === 'item') {
      const item = inventoryItems().find((entry: any) => String(entry.id) === String(binding.itemId || '')) || inventoryItems().find((entry: any) => String(entry.type || '') === String(binding.itemType || ''));
      const itemType = String(binding.itemType || item?.type || '');
      icon = itemType === 'potion_hp' ? 'HP' : itemType === 'weapon' ? 'WP' : 'IT';
      title = String(binding.itemName || item?.name || 'Item');
      if (itemType === 'potion_hp') { qty = `<span class="slot-qty">${inventoryItems().filter((entry: any) => String(entry.type || '') === 'potion_hp').reduce((sum: number, entry: any) => sum + Math.max(1, Math.floor(Number(entry.quantity || 1))), 0)}</span>`; button.classList.add('slot-icon-potion'); }
      if (!item) button.classList.add('slot-ghosted');
      button.classList.add('slot-kind-item');
    } else button.classList.add('slot-kind-empty');
    button.title = title;
    button.draggable = Boolean(binding);
    button.innerHTML = `<span class="${iconClass}">${icon}</span><span class="slot-key">${esc(String(button.dataset.key || '').toUpperCase())}</span>${qty}`;
    button.onmousemove = (event) => {
      if (binding?.type === 'item') showTooltip(itemTooltipHtml({ name: binding.itemName || binding.itemType || 'Item', type: binding.itemType || 'generic', quantity: 1 }), event.clientX, event.clientY);
      else if (binding?.type === 'action' && binding.actionId === 'skill_cast') showTooltip(skillTooltipHtml(String(binding.skillId || '')), event.clientX, event.clientY);
      else if (binding?.type === 'action' && binding.actionId === 'basic_attack') showTooltip(`<div><strong>${esc(title)}</strong></div><div>Ataque basico/auto ataque.</div>`, event.clientX, event.clientY);
    };
    button.onmouseleave = () => hideTooltip();
    button.ondragover = (event) => event.preventDefault();
    button.ondragstart = () => { draggingPayload = binding ? { source: 'hotbar', key } : null; };
    button.ondragend = () => { draggingPayload = null; };
    button.ondrop = () => {
      if (!draggingPayload) return;
      const next = normalizeHotbar();
      if (draggingPayload.source === 'hotbar') { const from = next[String(draggingPayload.key || '')]; next[String(draggingPayload.key || '')] = next[key]; next[key] = from; }
      if (draggingPayload.source === 'inventory') { const item = inventoryItems().find((entry: any) => String(entry.id) === String(draggingPayload.itemId)); if (item) next[key] = { type: 'item', itemId: String(item.id), itemType: String(item.type || ''), itemName: String(item.name || 'Item') }; }
      if (draggingPayload.source === 'skilltree') next[key] = { type: 'action', actionId: 'skill_cast', skillId: String(draggingPayload.skillId), skillName: String(draggingPayload.skillName || 'Habilidade') };
      socket.send({ type: 'hotbar.set', bindings: next }); draggingPayload = null;
    };
  });
}

function renderQuests() {
  const list = byId<HTMLElement>('quest-list');
  if (!list) return;
  const quests = Array.isArray(store.getState().questState) ? store.getState().questState : [];
  list.innerHTML = quests.length ? quests.map((entry: any) => `<div class="quest-entry"><div class="quest-title">${esc(entry.title || entry.id || 'Quest')}</div><div class="quest-status">${esc(entry.status || 'ativa')}</div></div>`).join('') : '<div class="preview-help">Nenhuma quest ativa.</div>';
}

function renderParty() {
  const state = store.getState();
  const party = state.partyState;
  const meta = byId<HTMLElement>('party-my-meta');
  const members = byId<HTMLElement>('party-members');
  const areaList = byId<HTMLElement>('party-area-list');
  if (meta) meta.textContent = party ? `Grupo ${String(party.id || '').slice(0, 8)} | Lider: ${party.members?.find((m: any) => m.role === 'leader')?.name || '-'} | ${party.members?.length || 0}/${party.maxMembers || 5}` : 'Voce nao esta em grupo.';
  if (members) {
    members.innerHTML = Array.isArray(party?.members) ? party.members.map((entry: any) => `<div class="party-member-row">[${entry.role === 'leader' ? 'L' : 'M'}] ${esc(entry.name)} Lv.${Number(entry.level || 1)} | HP ${Number(entry.hp || 0)}/${Number(entry.maxHp || 0)}${Number(party.leaderId) === Number(state.playerId) && Number(entry.playerId) !== Number(state.playerId) ? ` <button class="btn btn-outline-danger btn-sm party-kick" data-id="${Number(entry.playerId)}" type="button">Expulsar</button> <button class="btn btn-outline-light btn-sm party-promote" data-id="${Number(entry.playerId)}" type="button">Promover</button>` : ''}</div>`).join('') : '';
    members.querySelectorAll<HTMLElement>('.party-kick').forEach((button) => button.onclick = () => socket.send({ type: 'party.kick', targetPlayerId: Number(button.dataset.id) }));
    members.querySelectorAll<HTMLElement>('.party-promote').forEach((button) => button.onclick = () => socket.send({ type: 'party.promote', targetPlayerId: Number(button.dataset.id) }));
  }
  if (areaList) {
    areaList.innerHTML = state.partyAreaList.length ? state.partyAreaList.map((entry: any) => `<div class="party-area-row${selectedAreaPartyId === String(entry.partyId) ? ' selected' : ''}" data-id="${esc(entry.partyId)}">${esc(entry.leaderName)} | ${Number(entry.members || 0)}/${Number(entry.maxMembers || 5)} | Lv.${Number(entry.avgLevel || 1)}</div>`).join('') : '<div class="preview-help">Nenhum grupo na area.</div>';
    areaList.querySelectorAll<HTMLElement>('.party-area-row').forEach((row) => row.onclick = () => { selectedAreaPartyId = String(row.dataset.id || ''); renderParty(); });
  }
  setHidden(byId('party-request-wrap'), !selectedAreaPartyId || Boolean(party));
  setHidden(byId('party-create-wrap'), Boolean(party));
  setHidden(byId('party-my-leave-wrap'), !party);
  setHidden(byId('party-my-invite-wrap'), !party || Number(party.leaderId) !== Number(state.playerId));
}

function renderFriends() {
  const friendState = store.getState().friendState;
  const list = byId<HTMLElement>('friends-list');
  const incoming = byId<HTMLElement>('friends-incoming-list');
  const outgoing = byId<HTMLElement>('friends-outgoing-list');
  if (list) {
    list.innerHTML = Array.isArray(friendState?.friends) && friendState.friends.length ? friendState.friends.map((entry: any) => `<div class="friend-row">${esc(entry.name)} ${entry.online ? '(online)' : '(offline)'} <button class="btn btn-outline-danger btn-sm friend-remove" data-id="${Number(entry.playerId)}" type="button">Remover</button></div>`).join('') : '<div class="preview-help">Nenhum amigo cadastrado.</div>';
    list.querySelectorAll<HTMLElement>('.friend-remove').forEach((button) => button.onclick = () => socket.send({ type: 'friend.remove', friendPlayerId: Number(button.dataset.id) }));
  }
  if (incoming) {
    incoming.innerHTML = Array.isArray(friendState?.incoming) && friendState.incoming.length ? friendState.incoming.map((entry: any) => `<div class="friend-row">Recebido: ${esc(entry.fromName)} <button class="btn btn-primary btn-sm friend-accept" data-id="${esc(entry.requestId)}" type="button">Aceitar</button> <button class="btn btn-outline-light btn-sm friend-decline" data-id="${esc(entry.requestId)}" type="button">Recusar</button></div>`).join('') : '<div class="preview-help">Sem pedidos recebidos.</div>';
    incoming.querySelectorAll<HTMLElement>('.friend-accept').forEach((button) => button.onclick = () => socket.send({ type: 'friend.accept', requestId: button.dataset.id }));
    incoming.querySelectorAll<HTMLElement>('.friend-decline').forEach((button) => button.onclick = () => socket.send({ type: 'friend.decline', requestId: button.dataset.id }));
  }
  if (outgoing) outgoing.innerHTML = Array.isArray(friendState?.outgoing) && friendState.outgoing.length ? friendState.outgoing.map((entry: any) => `<div class="friend-row">Enviado: ${esc(entry.toName)}</div>`).join('') : '<div class="preview-help">Sem pedidos enviados.</div>';
}

function renderPartyFrames() {
  const frames = byId<HTMLElement>('party-frames');
  const members = Array.isArray(store.getState().partyState?.members) ? store.getState().partyState.members.filter((entry: any) => Number(entry.playerId) !== Number(store.getState().playerId)) : [];
  if (!frames) return;
  frames.innerHTML = members.map((entry: any) => `<div class="party-frame"><div class="party-frame-top"><div class="party-frame-avatar class-avatar class-${esc(skillClass(String(entry.class || 'knight')))}">${classIcon(String(entry.class || 'knight'))}</div><div class="party-frame-meta"><div class="party-frame-name">${entry.role === 'leader' ? '[L] ' : ''}${esc(entry.name)} Lv.${Number(entry.level || 1)}</div><div class="party-frame-hp"><div class="party-frame-hp-fill" style="width:${Math.max(0, Math.min(100, (Number(entry.hp || 0) / Math.max(1, Number(entry.maxHp || 1))) * 100))}%"></div></div></div></div></div>`).join('');
  setHidden(frames, members.length === 0);
}

function renderNotifications() {
  const partyWrap = byId<HTMLElement>('party-notifications');
  const partyList = byId<HTMLElement>('party-notifications-list');
  const friendWrap = byId<HTMLElement>('friends-notifications');
  const friendList = byId<HTMLElement>('friends-notifications-list');
  if (partyWrap && partyList) {
    const rows = [...store.getState().partyInvites.map((entry) => `<div class="party-notify-row">Convite: ${esc(entry.fromName)} <button class="btn btn-primary btn-sm party-invite-ok" data-id="${esc(entry.inviteId)}" data-party="${esc(entry.partyId)}" type="button">Aceitar</button> <button class="btn btn-outline-light btn-sm party-invite-no" data-id="${esc(entry.inviteId)}" data-party="${esc(entry.partyId)}" type="button">Recusar</button></div>`), ...store.getState().partyJoinRequests.map((entry) => `<div class="party-notify-row">Solicitacao: ${esc(entry.fromName)} <button class="btn btn-primary btn-sm party-join-ok" data-id="${esc(entry.requestId)}" type="button">Aprovar</button> <button class="btn btn-outline-light btn-sm party-join-no" data-id="${esc(entry.requestId)}" type="button">Recusar</button></div>`)];
    partyList.innerHTML = rows.join('');
    setHidden(partyWrap, rows.length === 0);
    partyList.querySelectorAll<HTMLElement>('.party-invite-ok').forEach((button) => button.onclick = () => { socket.send({ type: 'party.acceptInvite', inviteId: button.dataset.id, partyId: button.dataset.party }); store.removePartyInvite(String(button.dataset.id)); });
    partyList.querySelectorAll<HTMLElement>('.party-invite-no').forEach((button) => button.onclick = () => { socket.send({ type: 'party.declineInvite', inviteId: button.dataset.id, partyId: button.dataset.party }); store.removePartyInvite(String(button.dataset.id)); });
    partyList.querySelectorAll<HTMLElement>('.party-join-ok').forEach((button) => button.onclick = () => { socket.send({ type: 'party.approveJoin', requestId: button.dataset.id, accept: true }); store.removePartyJoinRequest(String(button.dataset.id)); });
    partyList.querySelectorAll<HTMLElement>('.party-join-no').forEach((button) => button.onclick = () => { socket.send({ type: 'party.approveJoin', requestId: button.dataset.id, accept: false }); store.removePartyJoinRequest(String(button.dataset.id)); });
  }
  if (friendWrap && friendList) {
    const incoming = Array.isArray(store.getState().friendState?.incoming) ? store.getState().friendState.incoming : [];
    friendList.innerHTML = incoming.map((entry: any) => `<div class="party-notify-row">Pedido de amizade: ${esc(entry.fromName)} <button class="btn btn-primary btn-sm friend-accept" data-id="${esc(entry.requestId)}" type="button">Aceitar</button> <button class="btn btn-outline-light btn-sm friend-decline" data-id="${esc(entry.requestId)}" type="button">Recusar</button></div>`).join('');
    setHidden(friendWrap, incoming.length === 0);
    friendList.querySelectorAll<HTMLElement>('.friend-accept').forEach((button) => button.onclick = () => socket.send({ type: 'friend.accept', requestId: button.dataset.id }));
    friendList.querySelectorAll<HTMLElement>('.friend-decline').forEach((button) => button.onclick = () => socket.send({ type: 'friend.decline', requestId: button.dataset.id }));
  }
}

function renderNpcDialog() {
  const dialog = store.getState().npcDialog;
  const panel = byId<HTMLElement>('npc-dialog-panel');
  const header = byId<HTMLElement>('npc-dialog-header');
  const body = byId<HTMLElement>('npc-dialog-body');
  if (!panel || !header || !body) return;
  if (!dialog) { panel.classList.add('hidden'); return; }
  header.textContent = String(dialog.npc?.name || 'NPC');
  const availableQuestIds = Array.isArray(dialog.availableQuestIds) ? dialog.availableQuestIds : [];
  const turnInQuestIds = Array.isArray(dialog.turnInQuestIds) ? dialog.turnInQuestIds : [];
  const quests = Array.isArray(dialog.quests) ? dialog.quests : [];
  const shopOffers = Array.isArray(dialog.shopOffers) ? dialog.shopOffers : [];
  const walletCopper = walletToCopper(store.getState().inventoryState?.wallet);
  body.innerHTML = `<div class="preview-help">${esc(dialog.npc?.greeting || '')}</div>${dialog.dungeonEntry ? `<div class="npc-dialog-quest"><div class="quest-title">${esc(dialog.dungeonEntry.name || 'Dungeon')}</div><div class="preview-help">${esc(dialog.dungeonEntry.description || '')}</div><div class="npc-dialog-actions"><button id="npc-dungeon-enter" class="btn btn-primary btn-sm" type="button">Entrar</button></div></div>` : ''}${quests.map((quest: any) => `<div class="npc-dialog-quest"><div class="quest-title">${esc(quest.title || quest.id || 'Quest')}</div><div class="quest-objective">${esc(quest.description || '')}</div>${Array.isArray(quest.objectives) ? quest.objectives.map((objective: any) => `<div class="quest-objective">${esc(objective.text || objective.id || 'Objetivo')} (${Number(objective.required || 1)})</div>`).join('') : ''}<div class="npc-dialog-actions">${availableQuestIds.includes(String(quest.id || '')) ? `<button class="btn btn-outline-light btn-sm npc-quest-accept" data-quest-id="${esc(String(quest.id || ''))}" type="button">Aceitar</button>` : ''}${turnInQuestIds.includes(String(quest.id || '')) ? `<button class="btn btn-outline-success btn-sm npc-quest-complete" data-quest-id="${esc(String(quest.id || ''))}" type="button">Concluir</button>` : ''}</div></div>`).join('')}${shopOffers.length ? `<div class="npc-dialog-quest"><div class="quest-title">Loja</div>${shopOffers.map((offer: any) => { const offerId = String(offer.offerId || ''); const qty = getShopQuantity(offerId); const totalPrice = walletToCopper(offer.price) * qty; const affordable = walletCopper >= totalPrice; return `<div class="friend-row npc-shop-offer${affordable ? '' : ' npc-shop-offer-disabled'}" data-offer-id="${esc(offerId)}"><span class="npc-shop-name">${esc(offer.name || 'Item')}</span><span class="npc-shop-price">${esc(walletLabel(offer.price))} x ${qty}</span><div class="npc-dialog-actions"><button class="btn btn-outline-light btn-sm npc-buy-qty-down" data-offer-id="${esc(offerId)}" type="button">-</button><input class="form-control form-control-sm npc-buy-qty-input" data-offer-id="${esc(offerId)}" type="number" min="1" max="99" value="${qty}"><button class="btn btn-outline-light btn-sm npc-buy-qty-up" data-offer-id="${esc(offerId)}" type="button">+</button><button class="btn btn-primary btn-sm npc-buy" data-offer-id="${esc(offerId)}" type="button"${affordable ? '' : ' disabled'}>Comprar</button></div></div>`; }).join('')}</div>` : ''}`;
  panel.classList.remove('hidden');
  byId('npc-dungeon-enter')?.addEventListener('click', () => socket.send({ type: 'dungeon.enter', npcId: dialog.npc?.id, mode: 'solo' }));
  body.querySelectorAll<HTMLElement>('.npc-quest-accept').forEach((button) => button.onclick = () => socket.send({ type: 'quest.accept', questId: button.dataset.questId }));
  body.querySelectorAll<HTMLElement>('.npc-quest-complete').forEach((button) => button.onclick = () => socket.send({ type: 'quest.complete', questId: button.dataset.questId }));
  body.querySelectorAll<HTMLElement>('.npc-buy-qty-down').forEach((button) => button.onclick = () => { const offerId = String(button.dataset.offerId || ''); setShopQuantity(offerId, getShopQuantity(offerId) - 1); renderNpcDialog(); });
  body.querySelectorAll<HTMLElement>('.npc-buy-qty-up').forEach((button) => button.onclick = () => { const offerId = String(button.dataset.offerId || ''); setShopQuantity(offerId, getShopQuantity(offerId) + 1); renderNpcDialog(); });
  body.querySelectorAll<HTMLInputElement>('.npc-buy-qty-input').forEach((input) => input.onchange = () => { const offerId = String(input.dataset.offerId || ''); setShopQuantity(offerId, Number(input.value || 1)); renderNpcDialog(); });
  body.querySelectorAll<HTMLElement>('.npc-buy').forEach((button) => button.onclick = () => { const offerId = String(button.dataset.offerId || ''); socket.send({ type: 'npc.buy', npcId: String(dialog.npc?.id || ''), offerId, quantity: getShopQuantity(offerId) }); });
  body.querySelectorAll<HTMLElement>('.npc-shop-offer').forEach((row, index) => {
    const offer = shopOffers[index];
    row.onmousemove = (event) => offer && showTooltip(itemTooltipHtml({ ...offer, quantity: getShopQuantity(String(offer.offerId || '')) }), event.clientX, event.clientY);
    row.onmouseleave = () => hideTooltip();
  });
}

function renderTargetCard() {
  const state = store.getState();
  const card = byId<HTMLElement>('target-player-card');
  if (!card) return;
  const mob = state.selectedMobId ? state.resolvedWorld?.mobs?.find((entry: any) => String(entry.id) === String(state.selectedMobId)) : null;
  const player = state.selectedPlayerId ? state.resolvedWorld?.players?.[String(state.selectedPlayerId)] : null;
  const attackButton = byId<HTMLButtonElement>('target-attack-btn');
  const inviteButton = byId<HTMLButtonElement>('target-invite-btn');
  const friendButton = byId<HTMLButtonElement>('target-friend-btn');
  if (!mob && !player) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  if (mob) {
    byId('target-player-avatar')!.className = 'target-mob-avatar';
    byId('target-player-avatar')!.textContent = 'M';
    byId('target-name-text')!.textContent = `${esc(mob.kind || 'Monstro')} Lv.${Number(mob.level || 1)}`;
    (byId('target-player-hp-fill') as HTMLElement).style.width = `${Math.max(0, Math.min(100, (Number(mob.hp || 0) / Math.max(1, Number(mob.maxHp || 1))) * 100))}%`;
    setHidden(byId('target-actions-toggle'), false);
    setHidden(attackButton, false);
    setHidden(inviteButton, true);
    setHidden(friendButton, true);
    if (attackButton) attackButton.textContent = 'Atacar';
    return;
  }
  byId('target-player-avatar')!.className = `class-avatar class-${esc(skillClass(String(player?.class || 'knight')))}`;
  byId('target-player-avatar')!.textContent = classIcon(String(player?.class || 'knight'));
  byId('target-name-text')!.textContent = `${esc(player?.name || 'Player')} Lv.${Number(player?.level || 1)}`;
  (byId('target-player-hp-fill') as HTMLElement).style.width = `${Math.max(0, Math.min(100, (Number(player?.hp || 0) / Math.max(1, Number(player?.maxHp || 1))) * 100))}%`;
  setHidden(byId('target-actions-toggle'), false);
  setHidden(attackButton, !isHostilePlayer(player));
  setHidden(inviteButton, isHostilePlayer(player));
  setHidden(friendButton, isHostilePlayer(player));
  if (attackButton) attackButton.textContent = 'Atacar';
}

function renderDungeonReady() {
  const payload = store.getState().dungeonReadyState;
  const wrap = byId<HTMLElement>('dungeon-notifications');
  const list = byId<HTMLElement>('dungeon-notifications-list');
  if (!wrap || !list) return;
  if (!payload) { wrap.classList.add('hidden'); return; }
  const members = Array.isArray(payload.members) ? payload.members : [];
  list.innerHTML = `<div>${esc(payload.purpose || 'dungeon')}</div>${members.map((entry: any) => `<div>${esc(entry.name || entry.playerId)}: ${entry.ready ? 'ok' : entry.responded ? 'nao' : '...'}</div>`).join('')}${payload.requestId ? `<div class="confirm-actions"><button id="dungeon-ready-yes" class="btn btn-primary btn-sm" type="button">Aceitar</button><button id="dungeon-ready-no" class="btn btn-outline-light btn-sm" type="button">Recusar</button></div>` : ''}`;
  wrap.classList.remove('hidden');
  byId('dungeon-ready-yes')?.addEventListener('click', () => socket.send({ type: 'dungeon.ready', requestId: payload.requestId, accept: true }));
  byId('dungeon-ready-no')?.addEventListener('click', () => socket.send({ type: 'dungeon.ready', requestId: payload.requestId, accept: false }));
}

function renderCharacterPanel() {
  const p = localPlayer();
  const body = byId<HTMLElement>('panel-body');
  if (!p || !body) return;
  byId('char-panel-name')!.textContent = `${esc(p.name)} - ${classLabel(String(p.class || 'knight'))}`;
  byId('panel-class-chip')!.textContent = classLabel(String(p.class || 'knight'));
  const slotLabels: Record<string, string> = { helmet: 'Capacete', chest: 'Peitoral', pants: 'Calca', gloves: 'Luva', boots: 'Bota', ring: 'Anel', weapon: 'Arma', necklace: 'Colar' };
  document.querySelectorAll<HTMLElement>('.equip-slot').forEach((slot) => {
    const key = String(slot.dataset.slot || '');
    const item = equippedBySlot()[key];
    slot.classList.toggle('filled', Boolean(item));
    slot.textContent = item ? String(item.name || slotLabels[key] || key) : (slotLabels[key] || key);
    slot.draggable = Boolean(item);
    slot.ondblclick = item ? () => socket.send({ type: 'equip_req', itemId: item.id }) : null;
    slot.ondragstart = item ? () => { draggingPayload = { source: 'equipment', itemId: String(item.id) }; } : null;
    slot.ondragend = () => { draggingPayload = null; };
    slot.ondragover = (event) => { event.preventDefault(); slot.classList.add('hovered'); };
    slot.ondragleave = () => slot.classList.remove('hovered');
    slot.ondrop = () => { slot.classList.remove('hovered'); const itemId = String(draggingPayload?.itemId || ''); const inv = inventoryItems().find((entry: any) => String(entry.id) === itemId); if (!inv) return; if (String(inv.type || '') === 'weapon' && key !== 'weapon') return; if (String(inv.type || '') === 'equipment' && String(inv.slot || '') && String(inv.slot || '') !== key) return; socket.send({ type: 'equip_req', itemId }); draggingPayload = null; };
  });
  const base = normStats(p.allocatedStats);
  const stats = p.stats && typeof p.stats === 'object' ? p.stats : {};
  body.innerHTML = `<div class="char-summary-grid"><div class="line">Nivel: ${Number(p.level || 1)}</div><div class="line">XP: ${Number(p.xp || 0)}/${Number(p.xpToNext || 0)}</div><div class="line">HP: ${Number(p.hp || 0)}/${Number(p.maxHp || 0)}</div></div><div class="line wallet-line">Moedas: ${walletLabel(store.getState().inventoryState?.wallet || p.wallet)}</div><div class="line stat-points-line">Pontos disponiveis: ${Number(p.unspentPoints || 0)}</div><div class="char-stats-layout"><div class="char-stats-col char-stats-col-base"><div class="line stat-col-title">Atributos Base</div><div class="line">FOR: ${base.str}</div><div class="line">INT: ${base.int}</div><div class="line">DES: ${base.dex}</div><div class="line">VIT: ${base.vit}</div></div><div class="char-stats-col char-stats-col-combat"><div class="line stat-col-title">Atributos de Combate</div><div class="line">PATK: ${Math.floor(Number(stats.physicalAttack || 0))}</div><div class="line">MATK: ${Math.floor(Number(stats.magicAttack || 0))}</div><div class="line">PDEF: ${Number(stats.physicalDefense || 0).toFixed(1)}</div><div class="line">MDEF: ${Number(stats.magicDefense || 0).toFixed(1)}</div><div class="line">ACC: ${Number(stats.accuracy || 0).toFixed(1)}</div><div class="line">EVA: ${Number(stats.evasion || 0).toFixed(1)}</div><div class="line">MSPD: ${Number(stats.moveSpeed || 0)}</div><div class="line">ASPD: ${Number(stats.attackSpeed || 0)}%</div></div></div><div class="line stat-actions"><button class="btn btn-outline-light btn-sm stat-add" data-key="str" type="button">+ FOR</button><button class="btn btn-outline-light btn-sm stat-add" data-key="int" type="button">+ INT</button><button class="btn btn-outline-light btn-sm stat-add" data-key="dex" type="button">+ DES</button><button class="btn btn-outline-light btn-sm stat-add" data-key="vit" type="button">+ VIT</button></div>`;
  body.querySelectorAll<HTMLElement>('.stat-add').forEach((button) => button.onclick = () => Number(p.unspentPoints || 0) > 0 ? socket.send({ type: 'stats.allocate', allocation: { [String(button.dataset.key || '')]: 1 } }) : systemMessage('Sem pontos de atributo disponiveis.'));
}

function renderSkillsPanel() {
  const wrap = byId<HTMLElement>('skills-tree-wrap');
  const points = byId<HTMLElement>('skills-points-label');
  const tabHoly = byId<HTMLElement>('skills-tab-holy');
  const tabBlood = byId<HTMLElement>('skills-tab-blood');
  const autoSlot = byId<HTMLElement>('skills-auto-slot');
  const modular = byId<HTMLElement>('skills-modular-grid');
  if (!wrap || !points || !tabHoly || !tabBlood || !autoSlot || !modular) return;
  const cls = skillClass(String(localPlayer()?.class || 'knight'));
  const nodes = SKILL_TREE.filter((node) => node.classId === cls);
  tabHoly.textContent = nodes.find((node) => node.buildKey === 'buildA')?.buildLabel || 'Build A';
  tabBlood.textContent = nodes.find((node) => node.buildKey === 'buildB')?.buildLabel || 'Build B';
  tabHoly.classList.toggle('active', skillTreeTab === 'buildA');
  tabBlood.classList.toggle('active', skillTreeTab === 'buildB');
  points.textContent = `Pont. Hab.: ${skillPoints()}`;
  const activeNodes = nodes.filter((node) => node.buildKey === skillTreeTab);
  wrap.innerHTML = '';
  const treeWidth = Math.max(320, Number(wrap.clientWidth || 0));
  wrap.style.setProperty('--skills-tree-content-height', `${Math.max(360, 16 + activeNodes.length * 84)}px`);
  const pos = new Map<string, { left: number; top: number }>();
  activeNodes.forEach((node, idx) => pos.set(node.id, { left: Math.round((node.x / 100) * treeWidth), top: 16 + idx * 84 }));
  activeNodes.forEach((node) => { if (!node.prereq) return; const from = pos.get(node.prereq); const to = pos.get(node.id); if (!from || !to) return; const link = document.createElement('div'); link.className = 'skills-link'; link.style.left = `${from.left + 27}px`; link.style.top = `${from.top + 58}px`; link.style.width = '4px'; link.style.height = `${Math.max(8, to.top - from.top - 56)}px`; wrap.appendChild(link); });
  activeNodes.forEach((node) => {
    const level = skillLevel(node.id);
    const prereqOk = !node.prereq || skillLevel(node.prereq) >= 1;
    const card = document.createElement('div');
    card.className = `skills-node ${node.buildKey === 'buildA' ? 'build-a' : 'build-b'}${level > 0 ? ' learned' : ''}${!prereqOk ? ' locked' : ''}${prereqOk && skillPoints() > 0 && level < node.maxPoints ? ' available' : ''}`;
    card.style.left = `${pos.get(node.id)?.left || 10}px`;
    card.style.top = `${pos.get(node.id)?.top || 16}px`;
    card.draggable = level > 0;
    card.innerHTML = `<span class="skill-icon">${esc(node.label.split(/\s+/).map((entry) => entry[0] || '').join('').slice(0, 2).toUpperCase())}</span><span class="skill-name">${esc(node.label)}</span><span class="lvl">${level}/${node.maxPoints}</span><button type="button" class="plus learn-skill" data-id="${esc(node.id)}">+</button>`;
    card.ondragstart = level > 0 ? () => { draggingPayload = { source: 'skilltree', skillId: node.id, skillName: node.label }; } : null;
    card.ondragend = () => { draggingPayload = null; };
    wrap.appendChild(card);
  });
  wrap.querySelectorAll<HTMLElement>('.learn-skill').forEach((button) => button.onclick = (event) => { event.stopPropagation(); const id = String(button.dataset.id || ''); const node = skillNode(id); if (!node) return; if (node.prereq && skillLevel(node.prereq) < 1) return systemMessage('Aprenda o pre-requisito antes desta habilidade.'); if (skillLevel(id) >= node.maxPoints) return systemMessage('Nivel maximo atingido.'); if (skillPoints() <= 0) return systemMessage('Sem pontos de habilidade disponiveis.'); socket.send({ type: 'skill.learn', skillId: id }); });
  autoSlot.textContent = autoAttackDef(selectedAutoAttackSkillId)?.label || 'Atk Basico';
  modular.innerHTML = [...Array(12)].map((_, idx) => idx === 0 && availableAutoAttacks().some((entry) => entry.id === 'mod_fire_wing') ? `<div class="skills-mod-slot filled">Asa de Fogo</div>` : '<div class="skills-mod-slot"></div>').join('');
}

function renderMinimap() {
  const world = store.getState().resolvedWorld; const p = localPlayer(); const bounds = world?.world; const mini = byId<HTMLCanvasElement>('minimap-canvas'); const full = byId<HTMLCanvasElement>('worldmap-canvas'); if (!mini || !full || !bounds) return;
  const draw = (canvas: HTMLCanvasElement, small: boolean) => { const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height); const sx = canvas.width / Math.max(1, Number(bounds.width || 1)); const sy = canvas.height / Math.max(1, Number(bounds.height || 1)); const selectedMobId = String(store.getState().selectedMobId || ''); const selectedPlayerId = Number(store.getState().selectedPlayerId || 0); ctx.fillStyle = '#071019'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = 'rgba(104,160,194,0.12)'; ctx.lineWidth = 1; for (let x = 0; x < canvas.width; x += Math.max(18, Math.round(canvas.width / 12))) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } for (let y = 0; y < canvas.height; y += Math.max(18, Math.round(canvas.height / 12))) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); } (world?.portals || []).forEach((portal: any) => { ctx.fillStyle = '#8f78ff'; ctx.fillRect(Number(portal.x || 0) * sx - 2, Number(portal.y || 0) * sy - 2, small ? 4 : 6, small ? 4 : 6); }); (world?.activeEvents || []).forEach((evt: any) => { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(Number(evt.x || 0) * sx, Number(evt.y || 0) * sy, small ? 2 : 5, 0, Math.PI * 2); ctx.fill(); }); (world?.mobs || []).forEach((mob: any) => { const selected = String(mob.id || '') === selectedMobId; ctx.fillStyle = selected ? '#ffef87' : '#cf4444'; ctx.beginPath(); ctx.arc(Number(mob.x || 0) * sx, Number(mob.y || 0) * sy, small ? 2 : 4, 0, Math.PI * 2); ctx.fill(); if (selected) { ctx.strokeStyle = '#fff7b2'; ctx.strokeRect(Number(mob.x || 0) * sx - (small ? 3 : 5), Number(mob.y || 0) * sy - (small ? 3 : 5), small ? 6 : 10, small ? 6 : 10); } }); (world?.npcs || []).forEach((npc: any) => { ctx.fillStyle = '#4fd09a'; ctx.fillRect(Number(npc.x || 0) * sx - 2, Number(npc.y || 0) * sy - 2, small ? 3 : 5, small ? 3 : 5); }); Object.values(world?.players || {}).forEach((entry: any) => { const hostile = isHostilePlayer(entry); const mine = Number(entry.id || 0) === Number(store.getState().playerId); const selected = Number(entry.id || 0) === selectedPlayerId; ctx.fillStyle = mine ? '#5bbcff' : hostile ? '#ff7b7b' : '#d8dfe8'; ctx.beginPath(); ctx.arc(Number(entry.x || 0) * sx, Number(entry.y || 0) * sy, small ? 2 : 4, 0, Math.PI * 2); ctx.fill(); if (selected) { ctx.strokeStyle = '#fff7b2'; ctx.strokeRect(Number(entry.x || 0) * sx - (small ? 3 : 5), Number(entry.y || 0) * sy - (small ? 3 : 5), small ? 6 : 10, small ? 6 : 10); } }); if (p) { ctx.strokeStyle = '#ffe082'; ctx.strokeRect(Number(p.x || 0) * sx - (small ? 2 : 4), Number(p.y || 0) * sy - (small ? 2 : 4), small ? 4 : 8, small ? 4 : 8); } };
  draw(mini, true); draw(full, false);
}

// BINDINGS
function activateHotbar(key: string) {
  const binding = normalizeHotbar()[key];
  if (!binding) return;
  if (binding.type === 'item') {
    const item = inventoryItems().find((entry: any) => String(entry.id) === String(binding.itemId || '')) || inventoryItems().find((entry: any) => String(entry.type || '') === String(binding.itemType || ''));
    if (!item) return;
    socket.send((String(item.type || '') === 'weapon') ? { type: 'equip_req', itemId: item.id } : { type: 'item.use', itemId: item.id });
    return;
  }
  if (binding.actionId === 'basic_attack') {
    const selected = autoAttackDef(selectedAutoAttackSkillId);
    if (selected?.id && selected.id !== 'class_primary' && store.getState().selectedMobId) return void socket.send({ type: 'skill.cast', skillId: selected.id, targetMobId: store.getState().selectedMobId });
    if (store.getState().selectedMobId) return void socket.send({ type: 'target_mob', mobId: store.getState().selectedMobId });
    if (store.getState().selectedPlayerId) return void socket.send({ type: 'combat.targetPlayer', targetPlayerId: store.getState().selectedPlayerId });
    return void systemMessage('Selecione um alvo primeiro.');
  }
  if (binding.actionId === 'skill_cast' && binding.skillId) {
    if (!store.getState().selectedMobId) return void systemMessage('Selecione um mob para usar a habilidade.');
    socket.send({ type: 'skill.cast', skillId: binding.skillId, targetMobId: store.getState().selectedMobId });
  }
}

function bindUi() {
  byId('tab-login')?.addEventListener('click', () => { byId('tab-login')?.classList.add('active'); byId('tab-register')?.classList.remove('active'); setHidden(byId('form-login'), false); setHidden(byId('form-register'), true); });
  byId('tab-register')?.addEventListener('click', () => { byId('tab-register')?.classList.add('active'); byId('tab-login')?.classList.remove('active'); setHidden(byId('form-login'), true); setHidden(byId('form-register'), false); });
  byId('btn-login')?.addEventListener('click', () => socket.send({ type: 'auth_login', username: String(byId<HTMLInputElement>('login-username')?.value || '').trim(), password: String(byId<HTMLInputElement>('login-password')?.value || '') }));
  byId('btn-register')?.addEventListener('click', () => socket.send({ type: 'auth_register', username: String(byId<HTMLInputElement>('register-username')?.value || '').trim(), password: String(byId<HTMLInputElement>('register-password')?.value || '') }));
  byId('btn-character-enter')?.addEventListener('click', () => Number.isInteger(store.getState().selectedCharacterSlot) && socket.send({ type: 'character_enter', slot: store.getState().selectedCharacterSlot }));
  byId('btn-character-create-from-select')?.addEventListener('click', () => store.update({ connectionPhase: 'character_create' }));
  byId('btn-character-back-login')?.addEventListener('click', () => socket.send({ type: 'character.back' }));
  byId('player-char-select')?.addEventListener('click', () => socket.send({ type: 'character.back' }));
  byId('btn-character-create-back')?.addEventListener('click', () => store.update({ connectionPhase: 'character_select' }));
  byId('btn-character-create')?.addEventListener('click', () => socket.send({ type: 'character_create', name: String(byId<HTMLInputElement>('create-char-name')?.value || '').trim(), class: String(byId<HTMLSelectElement>('create-char-class')?.value || 'knight'), gender: String(byId<HTMLSelectElement>('create-char-gender')?.value || 'male') }));
  byId('create-char-class')?.addEventListener('change', () => { byId('class-preview')!.textContent = classIcon(String(byId<HTMLSelectElement>('create-char-class')?.value || 'knight')); });
  byId('revive-btn')?.addEventListener('click', () => socket.send({ type: 'player.revive' }));
  byId('dungeon-leave-btn')?.addEventListener('click', () => socket.send({ type: 'dungeon.leave' }));
  byId('map-settings-toggle')?.addEventListener('click', () => byId('map-settings-panel')?.classList.toggle('hidden'));
  byId<HTMLInputElement>('auto-attack-toggle')?.addEventListener('change', (event) => { autoAttackEnabled = Boolean((event.currentTarget as HTMLInputElement).checked); });
  byId('player-pvp-toggle')?.addEventListener('click', () => byId('player-pvp-menu')?.classList.toggle('hidden'));
  document.querySelectorAll<HTMLElement>('.pvp-mode-option').forEach((button) => button.addEventListener('click', () => { socket.send({ type: 'player.setPvpMode', mode: String(button.dataset.mode || 'peace') }); byId('player-pvp-menu')?.classList.add('hidden'); }));
  byId<HTMLSelectElement>('instance-select')?.addEventListener('change', (event) => socket.send({ type: 'switch_instance', mapId: String((event.currentTarget as HTMLSelectElement).value || '') }));
  [['menu-attrs', 'char-panel', 'char-panel-close'], ['menu-inventory', 'inventory-panel', 'inventory-panel-close'], ['menu-skills', 'skills-panel', 'skills-panel-close'], ['menu-quests', 'quest-panel', 'quest-panel-close'], ['menu-map', 'worldmap-panel', 'worldmap-close'], ['menu-party', 'party-panel', 'party-panel-close'], ['menu-friends', 'friends-panel', 'friends-panel-close']].forEach(([buttonId, panelId, closeId]) => { byId(buttonId)?.addEventListener('click', () => byId(panelId)?.classList.toggle('hidden')); byId(closeId)?.addEventListener('click', () => byId(panelId)?.classList.add('hidden')); });
  [['char-panel', 'char-panel-header'], ['inventory-panel', 'inventory-header'], ['skills-panel', 'skills-header'], ['party-panel', 'party-header'], ['friends-panel', 'friends-header'], ['worldmap-panel', 'worldmap-header']].forEach(([panelId, headerId]) => { const panel = byId<HTMLElement>(panelId); const header = byId<HTMLElement>(headerId); if (!panel || !header) return; let dragging = false, ox = 0, oy = 0; header.addEventListener('pointerdown', (event) => { dragging = true; const rect = panel.getBoundingClientRect(); panel.style.left = `${rect.left}px`; panel.style.top = `${rect.top}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto'; ox = event.clientX - rect.left; oy = event.clientY - rect.top; }); window.addEventListener('pointermove', (event) => { if (!dragging) return; panel.style.left = `${Math.max(8, event.clientX - ox)}px`; panel.style.top = `${Math.max(8, event.clientY - oy)}px`; }); window.addEventListener('pointerup', () => { dragging = false; }); });
  for (let i = 0; i < 3; i += 1) byId<HTMLButtonElement>(`character-slot-${i}`)?.addEventListener('click', () => store.getState().characterSlots[i] && store.update({ selectedCharacterSlot: i }));
  document.querySelectorAll<HTMLElement>('.chat-scope').forEach((button) => button.addEventListener('click', () => { chatScope = String(button.dataset.scope || 'local') as 'local' | 'map' | 'global'; document.querySelectorAll('.chat-scope').forEach((entry) => entry.classList.remove('active')); button.classList.add('active'); }));
  byId<HTMLInputElement>('chat-input')?.addEventListener('keydown', (event) => { if (event.key !== 'Enter') return; const input = event.currentTarget as HTMLInputElement; const text = String(input.value || '').trim(); if (!text) return; socket.send({ type: 'chat_send', scope: chatScope, text }); input.value = ''; });
  document.querySelectorAll<HTMLElement>('.chat-mode-option').forEach((button) => button.addEventListener('click', () => {
    chatViewMode = String(button.dataset.mode || 'expanded') as typeof chatViewMode;
    document.querySelectorAll('.chat-mode-option').forEach((entry) => entry.classList.remove('active'));
    button.classList.add('active');
    const chatWrap = byId<HTMLElement>('chat-wrap');
    if (!chatWrap) return;
    chatWrap.classList.remove('chat-compact', 'chat-mini', 'chat-manual');
    if (chatViewMode === 'compact') chatWrap.classList.add('chat-compact');
    if (chatViewMode === 'mini') chatWrap.classList.add('chat-mini');
    if (chatViewMode === 'manual') chatWrap.classList.add('chat-manual');
  }));
  byId('chat-toggle')?.addEventListener('click', () => byId('chat-mode-menu')?.classList.toggle('hidden'));
  byId('chat-manual-resizer')?.addEventListener('pointerdown', (event) => {
    const chatWrap = byId<HTMLElement>('chat-wrap');
    if (!chatWrap || chatViewMode !== 'manual') return;
    chatManualSizing = true;
    chatManualOrigin = { x: event.clientX, y: event.clientY, width: chatWrap.offsetWidth, height: chatWrap.offsetHeight };
    event.preventDefault();
  });
  window.addEventListener('pointermove', (event) => {
    if (!chatManualSizing) return;
    const chatWrap = byId<HTMLElement>('chat-wrap');
    if (!chatWrap) return;
    const nextWidth = Math.max(280, Math.min(window.innerWidth * 0.8, chatManualOrigin.width + (event.clientX - chatManualOrigin.x)));
    const nextHeight = Math.max(170, Math.min(window.innerHeight * 0.7, chatManualOrigin.height + (event.clientY - chatManualOrigin.y)));
    chatWrap.style.width = `${Math.round(nextWidth)}px`;
    chatWrap.style.height = `${Math.round(nextHeight)}px`;
  });
  window.addEventListener('pointerup', () => { chatManualSizing = false; });
  byId('inventory-sort')?.addEventListener('click', () => socket.send({ type: 'inventory_sort' }));
  byId('delete-confirm-yes')?.addEventListener('click', () => { const itemId = store.getState().pendingDeleteItemId; if (itemId) socket.send({ type: 'inventory_delete', itemId }); store.update({ pendingDeleteItemId: null }); });
  byId('delete-confirm-no')?.addEventListener('click', () => store.update({ pendingDeleteItemId: null }));
  byId('party-create')?.addEventListener('click', () => socket.send({ type: 'party.create' }));
  byId('party-invite-btn')?.addEventListener('click', () => { const targetName = String(byId<HTMLInputElement>('party-invite-name')?.value || '').trim(); if (targetName) socket.send({ type: 'party.invite', targetName }); });
  byId('party-leave')?.addEventListener('click', () => socket.send({ type: 'party.leave' }));
  byId('party-request-join-btn')?.addEventListener('click', () => selectedAreaPartyId && socket.send({ type: 'party.requestJoin', partyId: selectedAreaPartyId }));
  byId('friends-add-btn')?.addEventListener('click', () => { const targetName = String(byId<HTMLInputElement>('friends-add-name')?.value || '').trim(); if (targetName) socket.send({ type: 'friend.request', targetName }); });
  byId('friends-tab-list')?.addEventListener('click', () => { setHidden(byId('friends-view-list'), false); setHidden(byId('friends-view-requests'), true); });
  byId('friends-tab-requests')?.addEventListener('click', () => { setHidden(byId('friends-view-list'), true); setHidden(byId('friends-view-requests'), false); });
  byId('party-tab-area')?.addEventListener('click', () => { setHidden(byId('party-view-area'), false); setHidden(byId('party-view-my'), true); socket.send({ type: 'party.requestAreaParties' }); });
  byId('party-tab-my')?.addEventListener('click', () => { setHidden(byId('party-view-area'), true); setHidden(byId('party-view-my'), false); });
  byId('npc-dialog-close')?.addEventListener('click', () => store.update({ npcDialog: null }));
  byId('target-actions-toggle')?.addEventListener('click', () => byId('target-actions-menu')?.classList.toggle('hidden'));
  byId('target-invite-btn')?.addEventListener('click', () => { const id = store.getState().selectedPlayerId; const target = id ? store.getState().resolvedWorld?.players?.[String(id)] : null; if (target?.name) socket.send({ type: 'party.invite', targetName: target.name }); });
  byId('target-friend-btn')?.addEventListener('click', () => { const id = store.getState().selectedPlayerId; const target = id ? store.getState().resolvedWorld?.players?.[String(id)] : null; if (target?.name) socket.send({ type: 'friend.request', targetName: target.name }); });
  [byId<HTMLCanvasElement>('minimap-canvas'), byId<HTMLCanvasElement>('worldmap-canvas')].forEach((canvas) => canvas?.addEventListener('click', (event) => {
    const world = store.getState().resolvedWorld;
    const bounds = world?.world;
    if (!canvas || !bounds) return;
    const rect = canvas.getBoundingClientRect();
    const ratioX = (event.clientX - rect.left) / Math.max(1, rect.width);
    const ratioY = (event.clientY - rect.top) / Math.max(1, rect.height);
    socket.send({ type: 'move', reqId: Date.now(), x: Math.max(0, Math.min(Number(bounds.width || 0), ratioX * Number(bounds.width || 0))), y: Math.max(0, Math.min(Number(bounds.height || 0), ratioY * Number(bounds.height || 0))) });
  }));
  byId('skills-tab-holy')?.addEventListener('click', () => { skillTreeTab = 'buildA'; renderSkillsPanel(); });
  byId('skills-tab-blood')?.addEventListener('click', () => { skillTreeTab = 'buildB'; renderSkillsPanel(); });
  byId('skills-auto-slot')?.addEventListener('click', () => { const options = availableAutoAttacks(); const idx = options.findIndex((entry) => entry.id === selectedAutoAttackSkillId); selectedAutoAttackSkillId = options[(idx + 1 + options.length) % options.length]?.id || 'class_primary'; persistSkillState(); renderSkillsPanel(); renderHotbar(); });
  byId('target-attack-btn')?.addEventListener('click', () => {
    if (store.getState().selectedMobId) {
      if (autoAttackEnabled && selectedAutoAttackSkillId !== 'class_primary') {
        socket.send({ type: 'skill.cast', skillId: selectedAutoAttackSkillId, targetMobId: store.getState().selectedMobId });
        return;
      }
      socket.send({ type: 'target_mob', mobId: store.getState().selectedMobId });
      return;
    }
    if (store.getState().selectedPlayerId) socket.send({ type: 'combat.targetPlayer', targetPlayerId: store.getState().selectedPlayerId });
  });
  byId('target-clear-btn')?.addEventListener('click', () => { byId('target-actions-menu')?.classList.add('hidden'); store.update({ selectedPlayerId: null, selectedMobId: null }); });
  window.addEventListener('keydown', (event) => { if (isTypingTarget(event.target)) return; const key = event.key.toLowerCase(); const isQuote = event.code === 'Quote' || event.key === "'" || event.key === '"'; if (isQuote) { event.preventDefault(); selectNearestHostileTarget(event.shiftKey); return; } if (event.key === 'Escape') { Object.values(PANEL_SHORTCUTS).forEach((panelId) => byId(panelId)?.classList.add('hidden')); byId('player-pvp-menu')?.classList.add('hidden'); byId('target-actions-menu')?.classList.add('hidden'); byId('chat-mode-menu')?.classList.add('hidden'); store.update({ selectedPlayerId: null, selectedMobId: null, pendingDeleteItemId: null, npcDialog: null }); hideTooltip(); return; } if (event.key === 'Enter') return void byId<HTMLInputElement>('chat-input')?.focus(); if (PANEL_SHORTCUTS[key]) { event.preventDefault(); byId(PANEL_SHORTCUTS[key])?.classList.toggle('hidden'); if (key === 'g') socket.send({ type: 'party.requestAreaParties' }); if (key === 'o') socket.send({ type: 'friend.list' }); return; } if (HOTBAR_KEYS.includes(key)) { event.preventDefault(); activateHotbar(key); } });
}

function render() {
  const state = store.getState();
  const world = state.resolvedWorld;
  const p = localPlayer();
  const inGame = state.connectionPhase === 'in_game';
  if (byId('auth-status')) byId('auth-status')!.textContent = state.authMessage || '';
  setHidden(byId('screen-login-register'), !(state.connectionPhase === 'auth' || state.connectionPhase === 'connecting' || state.connectionPhase === 'disconnected'));
  setHidden(byId('screen-character-select'), state.connectionPhase !== 'character_select');
  setHidden(byId('screen-character-create'), state.connectionPhase !== 'character_create');
  setHidden(byId('ui-container'), inGame);
  renderCharacterSlots(state.characterSlots, state.selectedCharacterSlot);
  if (byId('btn-character-enter')) byId<HTMLButtonElement>('btn-character-enter')!.disabled = !Number.isInteger(state.selectedCharacterSlot);
  ['player-card', 'minimap-wrap', 'chat-wrap', 'skillbar-wrap', 'menus-wrap', 'perf-hud'].forEach((id) => setHidden(byId(id), !inGame));
  setHidden(byId('revive-overlay'), !(inGame && (state.dead || Boolean(p?.dead) || Number(p?.hp || 0) <= 0)));
  setHidden(byId('delete-confirm'), !state.pendingDeleteItemId);
  if (!inGame) return;
  if (!requestedInGameState) { requestedInGameState = true; socket.send({ type: 'party.requestAreaParties' }); socket.send({ type: 'friend.list' }); }
  if (p && Number(p.hp || 0) > 0 && state.dead) { store.update({ dead: false }); return; }
  byId('player-avatar')!.textContent = classIcon(String(p?.class || 'knight'));
  byId('player-avatar')!.className = `class-avatar class-${esc(skillClass(String(p?.class || 'knight')))}`;
  byId('player-name')!.textContent = String(p?.name || '-').toUpperCase();
  byId('player-hp-text')!.textContent = p ? `HP: ${p.hp}/${p.maxHp}` : 'HP: -';
  (byId('player-hp-fill') as HTMLElement).style.width = `${p ? Math.max(0, Math.min(100, (Number(p.hp || 0) / Math.max(1, Number(p.maxHp || 1))) * 100)) : 0}%`;
  byId('player-pvp-toggle')!.textContent = String(p?.pvpMode || 'peace').replace('peace', 'Paz').replace('group', 'Grupo').replace('evil', 'Mal');
  byId('map-code-label')!.textContent = `Mapa ${String(world?.mapCode || '-').toUpperCase()}`;
  const coords = p ? `X: ${Math.round(Number(p.x || 0))} | Y: ${Math.round(Number(p.y || 0))}` : 'X: -- | Y: --';
  byId('minimap-coords-label')!.textContent = coords;
  byId('worldmap-coords-label')!.textContent = coords;
  const instance = byId<HTMLSelectElement>('instance-select');
  const currentMapId = String(world?.mapId || 'Z1');
  if (instance) { if (![...instance.options].some((entry) => entry.value === currentMapId)) instance.innerHTML = `<option value="${esc(currentMapId)}">${esc(currentMapId)}</option>`; instance.value = currentMapId; }
  setHidden(byId('dungeon-leave-btn'), !(currentMapId.startsWith('DNG-') || String(world?.mapKey || '').startsWith('dng_')));
  byId('perf-hud')!.textContent = `Phaser | WS ${state.socketConnected ? 'on' : 'off'} | ${String(world?.mapCode || '-')} / ${currentMapId}`;
  renderChat(); renderInventory(); renderHotbar(); renderQuests(); renderParty(); renderFriends(); renderPartyFrames(); renderNotifications(); renderNpcDialog(); renderTargetCard(); renderDungeonReady(); renderCharacterPanel(); renderSkillsPanel(); renderMinimap();
}

bindUi();
store.addEventListener('change', render as EventListener);
render();
socket.connect();
window.addEventListener('beforeunload', () => game.destroy(true));
