import Phaser from 'phaser';
import './style.css';
import { BootScene } from './game/scenes/BootScene';
import { WorldScene } from './game/scenes/WorldScene';
import { GameStore, type CharacterSlot } from './game/state/GameStore';
import { GameSocket } from './game/net/GameSocket';
import { mountHudApp } from './svelte-hud';

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
  fps: { target: 60, min: 30, smoothStep: false },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: innerWidth, height: innerHeight },
  scene: [new BootScene(), new WorldScene({ store, socket })]
});

const PANEL_SHORTCUTS: Record<string, string> = { c: 'char-panel', b: 'inventory-panel', v: 'skills-panel', j: 'quest-panel', m: 'worldmap-panel', g: 'party-panel', o: 'friends-panel', l: 'guild-panel' };
const HOTBAR_KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', '1', '2', '3', '4', '5', '6', '7', '8'];
const SKILL_STATE_STORAGE_KEY = 'noxis.skillTree.v1';
const SKILL_TREE: SkillNode[] = buildSkillTree();
const INITIAL_DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1;
const SVELTE_AUTH_ENABLED = true;
const SVELTE_HUD_SCAFFOLD_ENABLED = new URLSearchParams(window.location.search).get('svelteHud') !== '0';

let chatScope: 'local' | 'map' | 'global' = 'local';
let chatViewMode: 'expanded' | 'compact' | 'mini' | 'manual' = 'expanded';
let requestedInGameState = false;
let draggingPayload: any = null;
let dragPointerState: {
  pointerId: number;
  startX: number;
  startY: number;
  sourceEl: HTMLElement;
  payload: any;
  previewLabel: string;
  active: boolean;
} | null = null;
let dragGhostEl: HTMLElement | null = null;
let dragHoverEl: HTMLElement | null = null;
let suppressClickUntil = 0;
const pointerActivationState = new WeakMap<HTMLElement, { lastAt: number }>();
const dragPressState = new WeakMap<HTMLElement, { lastDownAt: number; suppressNextDrag: boolean }>();
let selectedAreaPartyId: string | null = null;
let skillTreeTab: 'buildA' | 'buildB' = 'buildA';
let selectedAutoAttackSkillId = loadSkillState();
let targetCycleIndex = -1;
let chatManualSizing = false;
let chatManualOrigin = { x: 0, y: 0, width: 360, height: 260 };
let autoAttackEnabled = true;
let pathDebugEnabled = false;
let renderQueued = false;
let adminPanelOpen = false;
let shopQuantities: Record<string, number> = {};
let shopSelectedClassTab = 'knight';
let shopNpcDialogNpcId: string | null = null;
let npcDialogRenderKey = '';
let lastInventoryRenderKey = '';
let lastInventorySummaryKey = '';
let lastHotbarRenderKey = '';
let lastNpcDialogSyncKey = '';
let statAllocationPending = { str: 0, int: 0, dex: 0, vit: 0 };
let lastStatAllocationBaseKey = '';
let lastOverlayRenderAt = 0;
let nextPanelZIndex = 80;
const modalActions = new Map<string, (modalEl: HTMLElement) => void>();
const MINIMAP_CROP_SCALE = 2.7;
const DRAG_START_DISTANCE_PX = 5;
const ITEM_ICON_PLACEHOLDER = '/assets/ui/items/placeholder-transparent.svg';

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
function worldScene() {
  const scene = game.scene.getScene('world');
  return scene instanceof WorldScene ? scene : null;
}
function setHidden(el: Element | null, hidden: boolean) { el?.classList.toggle('hidden', hidden); }
function closePanelFromButton(button: HTMLElement | null) {
  if (!button) return;
  const panel = button.closest('.panel, .hud-worldmap');
  if (!panel) return;
  panel.classList.add('hidden');
}
function bringPanelToFront(panel: HTMLElement | null) {
  if (!panel) return;
  if (panel.id === 'npc-dialog-panel') {
    panel.style.zIndex = '200';
    return;
  }
  panel.style.zIndex = String(nextPanelZIndex);
  nextPanelZIndex += 1;
}
function esc(v: unknown) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function isTypingTarget(target: EventTarget | null) { const el = target as HTMLElement | null; const tag = String(el?.tagName || '').toLowerCase(); return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(el?.isContentEditable); }
function classLabel(classId: string) { const n = String(classId || '').toLowerCase(); if (n === 'archer') return 'Arqueiro'; if (n === 'druid' || n === 'shifter') return 'Druida'; if (n === 'assassin' || n === 'bandit') return 'Assassino'; return 'Cavaleiro'; }
function classIcon(classId: string) { const n = String(classId || '').toLowerCase(); if (n === 'archer') return 'A'; if (n === 'druid' || n === 'shifter') return 'D'; if (n === 'assassin' || n === 'bandit') return 'S'; return 'K'; }
function skillClass(classId: string) { const n = String(classId || '').toLowerCase(); if (n === 'bandit') return 'assassin'; if (n === 'shifter') return 'druid'; return n || 'knight'; }
function normStats(raw: any) { const s = raw && typeof raw === 'object' ? raw : {}; const toInt = (v: unknown) => Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0; return { str: toInt(s.str ?? s.for), int: toInt(s.int), dex: toInt(s.dex ?? s.des), vit: toInt(s.vit) }; }
function walletLabel(wallet: any) { const w = wallet && typeof wallet === 'object' ? wallet : {}; return [`${Number(w.diamond || 0)}d`, `${Number(w.gold || 0)}g`, `${Number(w.silver || 0)}s`, `${Number(w.copper || 0)}c`].filter((entry) => !entry.startsWith('0')).join(' ') || '0c'; }
function normalizeWallet(wallet: any) { const w = wallet && typeof wallet === 'object' ? wallet : {}; return { diamond: Math.max(0, Math.floor(Number(w.diamond || 0))), gold: Math.max(0, Math.floor(Number(w.gold || 0))), silver: Math.max(0, Math.floor(Number(w.silver || 0))), copper: Math.max(0, Math.floor(Number(w.copper || 0))) }; }
function renderWalletTokens(wallet: any, options?: { hideZero?: boolean }) {
  const safe = normalizeWallet(wallet);
  let entries = [
    { amount: safe.diamond, css: 'coin-diamond' },
    { amount: safe.gold, css: 'coin-gold' },
    { amount: safe.silver, css: 'coin-silver' },
    { amount: safe.copper, css: 'coin-copper' }
  ];
  if (options?.hideZero) {
    entries = entries.filter((entry) => entry.amount > 0);
    if (!entries.length) entries = [{ amount: 0, css: 'coin-copper' }];
  }
  return `<span class="wallet-chain">${entries.map((entry) => `<span class="wallet-token"><span class="coin-dot ${entry.css}"></span><span class="coin-amount">${entry.amount}</span></span>`).join('')}</span>`;
}
function localPlayer() { const s = store.getState(); return s.playerId ? s.resolvedWorld?.players?.[String(s.playerId)] || null : null; }
function isAdminPlayer(player = localPlayer()) { return String(player?.role || '').toLowerCase() === 'adm'; }
function playerDisplayName(player: any) { return `${String(player?.role || '').toLowerCase() === 'adm' ? '[ADM] ' : ''}${String(player?.name || '-')}`; }
function inventoryItems() { return Array.isArray(store.getState().inventoryState?.inventory) ? store.getState().inventoryState.inventory : []; }
function equippedBySlot() { return store.getState().inventoryState?.equippedBySlot || {}; }
function currentNpcShopId() { return store.getState().npcShopOpen ? String(store.getState().npcDialog?.npc?.id || '') : ''; }
function localSkillLevels() { return localPlayer()?.skillLevels && typeof localPlayer()?.skillLevels === 'object' ? localPlayer()!.skillLevels : {}; }
function skillNode(id: string) { return SKILL_TREE.find((node) => node.id === id) || null; }
function skillLevel(id: string) { return Math.max(0, Math.min(5, Number(localSkillLevels()[id] || 0))); }
function skillPoints() { return Number.isFinite(Number(localPlayer()?.skillPointsAvailable)) ? Math.max(0, Math.floor(Number(localPlayer()?.skillPointsAvailable || 0))) : 0; }
function autoAttackDef(id: string) { if (!id || id === 'class_primary') return { id: 'class_primary', label: 'Atk Basico' }; const node = skillNode(id); if (node && skillLevel(id) > 0) return { id, label: node.label }; if (id === 'mod_fire_wing') return { id, label: 'Asa de Fogo' }; return null; }
function availableAutoAttacks() { const out = [{ id: 'class_primary', label: 'Atk Basico' }]; const cls = skillClass(String(localPlayer()?.class || 'knight')); SKILL_TREE.filter((node) => node.classId === cls && skillLevel(node.id) > 0).forEach((node) => out.push({ id: node.id, label: node.label })); if ([...inventoryItems(), ...Object.values(equippedBySlot())].some((it: any) => String(it?.name || '').toLowerCase().includes('asa de fogo'))) out.push({ id: 'mod_fire_wing', label: 'Asa de Fogo' }); return out; }
function systemMessage(text: string) { store.pushChatMessage({ id: `${Date.now()}-${Math.random()}`, type: 'system', text, at: Date.now() }); }
function ensureModalRoot() {
  return byId<HTMLElement>('confirmation-modal-root');
}
function removeModalById(modalId: string) {
  modalActions.delete(modalId);
  ensureModalRoot()?.querySelector<HTMLElement>(`[data-modal-id="${modalId}"]`)?.remove();
}
function clearAllModals() {
  modalActions.clear();
  const root = ensureModalRoot();
  if (root) root.innerHTML = '';
}
function appendModalShell(modalId: string, title: string, bodyHtml: string) {
  const root = ensureModalRoot();
  if (!root) return null;
  const modal = document.createElement('div');
  modal.className = 'panel card shadow confirmation-modal';
  modal.dataset.modalId = modalId;
  modal.innerHTML = `<div class="card-body"><div class="confirmation-modal-title">${esc(title)}</div>${bodyHtml}</div>`;
  root.appendChild(modal);
  bringPanelToFront(modal);
  return modal;
}
function handleModalRootInteraction(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target) return;
  const modalEl = target.closest<HTMLElement>('[data-modal-id]');
  if (!modalEl) return;
  event.stopPropagation();
  const actionEl = target.closest<HTMLElement>('[data-modal-action]');
  if (!actionEl) return;
  event.preventDefault();
  const modalId = String(modalEl.dataset.modalId || '');
  if (!modalId) return;
  if (String(actionEl.dataset.modalAction || '') === 'cancel') {
    removeModalById(modalId);
    return;
  }
  modalActions.get(modalId)?.(modalEl);
}
function showConfirmationModal(title: string, message: string, onConfirm: () => void) {
  const modalId = `confirm-${Date.now()}-${Math.random()}`;
  modalActions.set(modalId, () => { onConfirm(); removeModalById(modalId); });
  appendModalShell(
    modalId,
    title,
    `<div class="delete-confirm-message">${esc(message)}</div><div class="confirm-actions"><button class="btn btn-danger" data-modal-action="confirm" type="button">Sim</button><button class="btn btn-outline-light" data-modal-action="cancel" type="button">Nao</button></div>`
  );
}
function hideConfirmationModal() {
  clearAllModals();
}
function showSplitStackModal(item: any) {
  const max = Math.max(1, Math.min(249, Math.floor(Number(item?.quantity || 1)) - 1));
  if (max < 1) return;
  const modalId = `split-${String(item?.id || Date.now())}`;
  modalActions.set(modalId, (modalEl) => {
    const input = modalEl.querySelector<HTMLInputElement>('input[data-split-qty]');
    const quantity = Math.max(1, Math.min(max, Math.floor(Number(input?.value || 1))));
    socket.send({ type: 'split_item_req', itemId: String(item.id || ''), slotIndex: Number(item.slotIndex ?? -1), quantity });
    removeModalById(modalId);
  });
  appendModalShell(
    modalId,
    'Dividir Pilha',
    `<div class="delete-confirm-message">Informe quantos itens deseja mover para a nova pilha.</div><input class="form-control form-control-sm split-stack-input" data-split-qty type="number" min="1" max="${max}" value="${Math.max(1, Math.floor(max / 2))}" /><div class="confirm-actions"><button class="btn btn-primary" data-modal-action="confirm" type="button">Dividir</button><button class="btn btn-outline-light" data-modal-action="cancel" type="button">Cancelar</button></div>`
  );
}
function setDeleteDropFeedback(active: boolean) {
  document.body.classList.toggle('delete-drop-active', active);
}
function resolveItemRarity(item: any) {
  const rarity = String(item?.rarity || 'common').toLowerCase();
  return ['common', 'rare', 'epic', 'legendary'].includes(rarity) ? rarity : 'common';
}
function rarityCssClass(item: any) {
  return `rarity-${resolveItemRarity(item)}`;
}
function rarityLabel(item: any) {
  const rarity = resolveItemRarity(item);
  if (rarity === 'rare') return 'Raro';
  if (rarity === 'epic') return 'Epico';
  if (rarity === 'legendary') return 'Lendario';
  return 'Comum';
}
function goldValueFromCopper(copper: number) {
  return (Math.max(0, copper) / 10000).toFixed(copper >= 10000 ? 2 : 4);
}
function computeSellCopper(item: any) {
  const priceCopper = walletToCopper(item?.price || {});
  return Math.max(0, Math.floor(priceCopper * 0.35));
}
function closeChatInput() {
  byId<HTMLInputElement>('chat-input')?.blur();
  byId('chat-mode-menu')?.classList.add('hidden');
}
function clearCurrentTargetSelection(clearCombat = true) {
  store.update({ selectedPlayerId: null, selectedMobId: null });
  if (clearCombat) socket.send({ type: 'combat.clearTarget' });
}
function setAdminPanelOpen(nextOpen: boolean) {
  adminPanelOpen = nextOpen;
  byId('admin-panel')?.classList.toggle('hidden', !nextOpen);
}
function makePanelDraggable(panelId: string, headerId: string) {
  const panel = byId<HTMLElement>(panelId);
  const header = byId<HTMLElement>(headerId);
  if (!panel || !header) return;
  let dragging = false;
  let pointerId: number | null = null;
  let ox = 0;
  let oy = 0;
  const stopDragging = () => {
    dragging = false;
    pointerId = null;
    header.classList.remove('dragging');
  };
  header.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest('button, input, select, textarea, a')) return;
    const rect = panel.getBoundingClientRect();
    const computed = window.getComputedStyle(panel);
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    pointerId = event.pointerId;
    header.classList.add('dragging');
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    if (computed.transform && computed.transform !== 'none') panel.style.transform = 'none';
    ox = event.clientX - rect.left;
    oy = event.clientY - rect.top;
    header.setPointerCapture?.(event.pointerId);
  });
  header.addEventListener('pointermove', (event) => {
    if (!dragging || pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    panel.style.left = `${Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, event.clientX - ox))}px`;
    panel.style.top = `${Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, event.clientY - oy))}px`;
  });
  header.addEventListener('pointerup', stopDragging);
  header.addEventListener('pointercancel', stopDragging);
  header.addEventListener('lostpointercapture', stopDragging);
}
function isHostilePlayer(player: any) { return player && Number(player.id || 0) !== Number(store.getState().playerId) && !player.dead && Number(player.hp || 0) > 0 && String(player.pvpMode || 'peace') !== 'peace'; }
function inferEquipSlot(item: any) { const slot = String(item?.slot || '').toLowerCase(); if (slot) return slot; const type = String(item?.type || '').toLowerCase(); if (type === 'weapon') return 'weapon'; if (type === 'ring') return 'ring'; if (type === 'necklace' || type === 'amulet') return 'necklace'; return type === 'equipment' ? '' : ''; }
function walletToCopper(wallet: any) { const w = wallet && typeof wallet === 'object' ? wallet : {}; return (Number(w.diamond || 0) * 1000000) + (Number(w.gold || 0) * 10000) + (Number(w.silver || 0) * 100) + Number(w.copper || 0); }
function getShopQuantity(offerId: string) { return Math.max(1, Math.min(99, Number(shopQuantities[offerId] || 1))); }
function setShopQuantity(offerId: string, nextValue: number) { shopQuantities[offerId] = Math.max(1, Math.min(99, Math.floor(Number(nextValue || 1)))); }
function resetPendingStatAllocation() { statAllocationPending = { str: 0, int: 0, dex: 0, vit: 0 }; }
function getPendingStatAllocationTotal() { return Number(statAllocationPending.str || 0) + Number(statAllocationPending.int || 0) + Number(statAllocationPending.dex || 0) + Number(statAllocationPending.vit || 0); }
function getPendingStatAllocationCost(baseAllocated: any = null) {
  void baseAllocated;
  return Number(statAllocationPending.str || 0)
    + Number(statAllocationPending.int || 0)
    + Number(statAllocationPending.dex || 0)
    + Number(statAllocationPending.vit || 0);
}
function getShopIconLabel(offer: any) {
  const type = String(offer?.type || '').toLowerCase();
  const slot = String(offer?.slot || '').toLowerCase();
  if (type === 'weapon') return 'ARM';
  if (type === 'equipment' && slot === 'helmet') return 'CAP';
  if (type === 'equipment' && slot === 'chest') return 'PEI';
  if (type === 'equipment' && slot === 'pants') return 'CAL';
  if (type === 'equipment' && slot === 'gloves') return 'LUV';
  if (type === 'equipment' && slot === 'boots') return 'BOT';
  if (type === 'potion_hp') return 'HP';
  return String(offer?.name || 'IT').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'IT';
}
function hudScaleValue() {
  const raw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-scale') || '1');
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}
function normalizeHudClientPoint(clientX: number, clientY: number) {
  const scale = hudScaleValue();
  return { x: clientX / scale, y: clientY / scale, scale };
}
function showTooltip(html: string, clientX: number, clientY: number) {
  const el = byId<HTMLElement>('item-tooltip');
  if (!el) return;
  const cursorGap = 18;
  const cursorSafeWidth = 28;
  const cursorSafeHeight = 28;
  const point = normalizeHudClientPoint(clientX, clientY);
  el.innerHTML = html;
  el.classList.remove('hidden');
  el.style.left = '0px';
  el.style.top = '0px';
  const rect = el.getBoundingClientRect();
  let left = point.x + cursorGap;
  let top = point.y + cursorGap;
  if (left < point.x + cursorSafeWidth && left + rect.width > point.x) left = point.x + cursorSafeWidth;
  if (top < point.y + cursorSafeHeight && top + rect.height > point.y) top = point.y + cursorSafeHeight;
  if (left + rect.width > innerWidth - 8) left = point.x - rect.width - cursorGap;
  if (top + rect.height > innerHeight - 8) top = point.y - rect.height - cursorGap;
  left = Math.max(8, Math.min(left, innerWidth - rect.width - 8));
  top = Math.max(8, Math.min(top, innerHeight - rect.height - 8));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
function updateHudDebugPanelUI() {
  const enabled = isAdminPlayer() && Boolean(byId<HTMLInputElement>('hud-debug-toggle')?.checked);
  setHidden(byId('hud-debug-panel'), !enabled);
  const minInput = byId<HTMLInputElement>('hud-scale-min');
  const maxInput = byId<HTMLInputElement>('hud-scale-max');
  if (byId('hud-scale-min-value') && minInput) byId('hud-scale-min-value')!.textContent = `${minInput.value}%`;
  if (byId('hud-scale-max-value') && maxInput) byId('hud-scale-max-value')!.textContent = `${maxInput.value}%`;
  const root = document.documentElement;
  if (!enabled || !minInput || !maxInput) {
    root.style.setProperty('--hud-scale', '1');
    return;
  }
  const minValue = Math.max(70, Math.min(110, Number(minInput.value || 84)));
  const maxValue = Math.max(minValue + 2, Math.min(140, Number(maxInput.value || 106)));
  root.style.setProperty('--hud-scale', String(((minValue + maxValue) / 2) / 100));
}
function applyHudBrowserZoomCompensation() {
  const hudRoot = byId<HTMLElement>('hud-root');
  if (!hudRoot) return;
  const currentRatio = window.devicePixelRatio || 1;
  const compensation = Phaser.Math.Clamp(INITIAL_DEVICE_PIXEL_RATIO / Math.max(0.25, currentRatio), 0.5, 2);
  hudRoot.style.setProperty('--hud-browser-compensation', String(compensation));
}
function sendAdminCommand() {
  if (!isAdminPlayer()) return;
  const input = byId<HTMLInputElement>('admin-command');
  const command = String(input?.value || '').trim();
  if (!command) return;
  socket.send({ type: 'admin_command', command });
  if (input) input.value = '';
}
function hideTooltip() { byId('item-tooltip')?.classList.add('hidden'); }
function clearUiDragHover() {
  if (!dragHoverEl) return;
  dragHoverEl.classList.remove('hovered', 'drag-hovered');
  dragHoverEl = null;
}
function setUiDragHover(target: HTMLElement | null) {
  if (dragHoverEl === target) return;
  clearUiDragHover();
  if (!target) return;
  target.classList.add('hovered', 'drag-hovered');
  dragHoverEl = target;
}
function ensureDragGhost() {
  if (dragGhostEl) return dragGhostEl;
  const ghost = document.createElement('div');
  ghost.id = 'ui-drag-ghost';
  ghost.className = 'ui-drag-ghost';
  document.body.appendChild(ghost);
  dragGhostEl = ghost;
  return ghost;
}
function createDragGhostVisual(sourceEl: HTMLElement, payload: any, previewLabel: string) {
  const ghostBody = document.createElement('div');
  ghostBody.className = 'ui-drag-ghost-copy';
  const visualSource = sourceEl.querySelector<HTMLElement>('img.inv-item-icon, .slot-icon img, .skill-icon, .inv-item-icon') || (sourceEl.matches('img.inv-item-icon') ? sourceEl : null);
  if (visualSource) {
    const clone = visualSource.cloneNode(true) as HTMLElement;
    clone.classList.add('ui-drag-ghost-icon');
    if (clone instanceof HTMLImageElement) clone.decoding = 'async';
    ghostBody.appendChild(clone);
  }
  if (!ghostBody.children.length && payload?.source === 'basicattack') {
    const fallbackIcon = document.createElement('span');
    fallbackIcon.className = 'ui-drag-ghost-icon ui-drag-ghost-fallback';
    fallbackIcon.textContent = 'ATK';
    ghostBody.appendChild(fallbackIcon);
  }
  const label = document.createElement('span');
  label.className = 'ui-drag-ghost-label';
  label.textContent = previewLabel;
  ghostBody.appendChild(label);
  return ghostBody;
}
function positionDragGhost(clientX: number, clientY: number) {
  const ghost = ensureDragGhost();
  const point = normalizeHudClientPoint(clientX, clientY);
  ghost.style.left = `${point.x + 18}px`;
  ghost.style.top = `${point.y + 18}px`;
}
function cleanupUiDrag() {
  const shouldRefreshUi = Boolean(dragPointerState?.active || draggingPayload);
  dragPointerState?.sourceEl.classList.remove('dragging');
  dragPointerState = null;
  draggingPayload = null;
  clearUiDragHover();
  if (dragGhostEl) {
    dragGhostEl.remove();
    dragGhostEl = null;
  }
  document.body.classList.remove('ui-drag-active');
  setDeleteDropFeedback(false);
  if (shouldRefreshUi) scheduleRender();
}
function bindPointerDoubleActivate(element: HTMLElement | null, callback: () => void) {
  if (!element) return;
  element.onpointerup = (event) => {
    if (event.button !== 0) return;
    if (dragPointerState?.active) return;
    const now = Date.now();
    const entry = pointerActivationState.get(element) || { lastAt: 0 };
    if (now - entry.lastAt <= 320) {
      entry.lastAt = 0;
      pointerActivationState.set(element, entry);
      event.preventDefault();
      event.stopPropagation();
      callback();
      return;
    }
    entry.lastAt = now;
    pointerActivationState.set(element, entry);
  };
}
function commitHotbarBindings(nextBindings: Record<string, any>) {
  store.update({ hotbarBindings: nextBindings });
  socket.send({ type: 'hotbar.set', bindings: nextBindings });
}
function resolveItemIconUrl(item: any) {
  const raw = String(item?.iconUrl || item?.icon_url || '').trim();
  return raw || ITEM_ICON_PLACEHOLDER;
}
function inventoryItemMarkup(item: any) {
  const label = String(item?.name || item?.templateId || 'Item');
  return `<img class="inv-item-icon" src="${esc(resolveItemIconUrl(item))}" alt="${esc(label)}" draggable="false" /><span class="inv-item-label">${esc(label)}</span>`;
}
function inventoryVisualItems() {
  return inventoryItems().filter((entry: any) => entry?.equipped !== true);
}
function inventoryRenderKey() {
  return JSON.stringify(inventoryVisualItems().map((item: any) => ({
    id: String(item?.id || ''),
    slotIndex: Number(item?.slotIndex ?? -1),
    quantity: Number(item?.quantity || 1),
    equipped: Boolean(item?.equipped),
    type: String(item?.type || ''),
    slot: String(item?.slot || ''),
    rarity: resolveItemRarity(item),
    iconUrl: resolveItemIconUrl(item),
    name: String(item?.name || item?.templateId || 'Item')
  })));
}
function inventorySummaryKey() {
  return JSON.stringify({
    equippedWeaponName: String(equippedBySlot().weapon?.name || 'nenhuma'),
    wallet: normalizeWallet(store.getState().inventoryState?.wallet)
  });
}
function hotbarRenderKey() {
  return JSON.stringify({
    bindings: normalizeHotbar(),
    items: inventoryItems().map((entry: any) => ({
      id: String(entry?.id || ''),
      type: String(entry?.type || ''),
      quantity: Number(entry?.quantity || 1),
      rarity: resolveItemRarity(entry),
      iconUrl: resolveItemIconUrl(entry),
      equipped: Boolean(entry?.equipped)
    })),
    autoAttackSkillId: selectedAutoAttackSkillId
  });
}
function findInventoryItemById(itemId: string) {
  return inventoryItems().find((entry: any) => String(entry?.id || '') === String(itemId || '')) || null;
}
function isUiDropTarget(target: HTMLElement | null) {
  if (!target) return false;
  return Boolean(
    target.closest('.inv-slot')
    || target.closest('.skill-slot-btn')
    || target.closest('.equip-slot')
    || target.closest('#char-panel')
  );
}
function queueDeleteConfirmationForPayload(payload: any) {
  const itemId = String(payload?.itemId || '');
  const item = findInventoryItemById(itemId) || Object.values(equippedBySlot()).find((entry: any) => String(entry?.id || '') === itemId);
  if (!item || !itemId) return;
  showConfirmationModal(
    'Destruir Item',
    'Deseja realmente destruir este item? Esta acao nao pode ser desfeita.',
    () => {
      socket.send({ type: 'delete_item_req', itemId, slotIndex: Number(item?.slotIndex ?? -1) });
      hideConfirmationModal();
    }
  );
}
function dispatchInventoryItemAction(itemId: string) {
  const item = findInventoryItemById(itemId);
  if (!item) return;
  hideTooltip();
  socket.send((String(item.type || '') === 'weapon' || String(item.type || '') === 'equipment')
    ? { type: 'equip_req', itemId: item.id }
    : { type: 'item.use', itemId: item.id });
}
function isInventoryDragActive() {
  if (!dragPointerState?.active) return false;
  return Boolean(
    dragPointerState.sourceEl.closest('#inventory-grid')
    || draggingPayload?.source === 'inventory'
    || draggingPayload?.source === 'equipment'
  );
}
function syncNpcDialogRender() {
  const dialog = store.getState().npcDialog;
  const nextKey = dialog ? npcDialogSignature(dialog) : 'none';
  if (nextKey === lastNpcDialogSyncKey) return;
  lastNpcDialogSyncKey = nextKey;
  if (!dialog) {
    byId('npc-dialog-panel')?.classList.add('hidden');
    npcDialogRenderKey = '';
    return;
  }
  renderNpcDialog({ force: true, focus: false });
}
function beginUiPointerDrag(event: PointerEvent, sourceEl: HTMLElement, payload: any, previewLabel: string) {
  if (event.button !== 0) return;
  dragPointerState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    sourceEl,
    payload,
    previewLabel,
    active: false
  };
}
function updateUiDragTarget(clientX: number, clientY: number) {
  if (!draggingPayload) return null;
  const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
  if (!hit) return null;
  if (draggingPayload.source === 'inventory' || draggingPayload.source === 'equipment') {
    const hotbarSlot = hit.closest('.skill-slot-btn') as HTMLElement | null;
    if (hotbarSlot) return hotbarSlot;
    const invSlot = hit.closest('.inv-slot') as HTMLElement | null;
    if (invSlot) return invSlot;
    const equipSlot = hit.closest('.equip-slot') as HTMLElement | null;
    if (equipSlot) return equipSlot;
    const charPanel = hit.closest('#char-panel') as HTMLElement | null;
    if (charPanel && draggingPayload.source === 'inventory') return charPanel;
    return null;
  }
  if (draggingPayload.source === 'hotbar' || draggingPayload.source === 'skilltree' || draggingPayload.source === 'basicattack') {
    return hit.closest('.skill-slot-btn') as HTMLElement | null;
  }
  return null;
}
function applyHotbarDrop(targetKey: string) {
  if (!draggingPayload) return;
  const next = normalizeHotbar();
  if (draggingPayload.source === 'hotbar') {
    const fromKey = String(draggingPayload.key || '');
    const from = next[fromKey];
    next[fromKey] = next[targetKey];
    next[targetKey] = from;
  }
  if (draggingPayload.source === 'inventory') {
    const item = inventoryItems().find((entry: any) => String(entry.id) === String(draggingPayload.itemId));
    if (item) next[targetKey] = { type: 'item', itemId: String(item.id), itemType: String(item.type || ''), itemName: String(item.name || 'Item') };
  }
  if (draggingPayload.source === 'skilltree') next[targetKey] = { type: 'action', actionId: 'skill_cast', skillId: String(draggingPayload.skillId), skillName: String(draggingPayload.skillName || 'Habilidade') };
  if (draggingPayload.source === 'basicattack') next[targetKey] = { type: 'action', actionId: 'basic_attack' };
  if (draggingPayload.source === 'equipment') {
    const item = Object.values(equippedBySlot()).find((entry: any) => String(entry?.id || '') === String(draggingPayload.itemId || ''));
    if (item) next[targetKey] = { type: 'item', itemId: String(item.id), itemType: String(item.type || ''), itemName: String(item.name || 'Item') };
  }
  commitHotbarBindings(next);
}
function canEquipItemInSlot(item: any, slotKey: string) {
  if (!item) return false;
  if (String(item.type || '') === 'weapon') return slotKey === 'weapon';
  if (String(item.type || '') === 'equipment') {
    const itemSlot = String(item.slot || '');
    return !itemSlot || itemSlot === slotKey;
  }
  return false;
}
function performUiDrop(target: HTMLElement | null, clientX: number, clientY: number) {
  if (!draggingPayload) return;
  if (target?.classList.contains('skill-slot-btn')) {
    applyHotbarDrop(String(target.dataset.key || '').toLowerCase());
    return;
  }
  if (target?.classList.contains('inv-slot')) {
    const toSlot = Number(target.dataset.slot ?? -1);
    if (toSlot < 0) return;
    if (!draggingPayload?.itemId) return;
    socket.send(draggingPayload.source === 'equipment'
      ? { type: 'inventory_unequip_to_slot', itemId: draggingPayload.itemId, toSlot }
      : { type: 'inventory_move', itemId: draggingPayload.itemId, toSlot });
    return;
  }
  if (target?.classList.contains('equip-slot')) {
    const itemId = String(draggingPayload.itemId || '');
    const item = inventoryItems().find((entry: any) => String(entry.id) === itemId);
    const slotKey = String(target.dataset.slot || '');
    if (canEquipItemInSlot(item, slotKey)) socket.send({ type: 'equip_req', itemId });
    return;
  }
  if (target?.id === 'char-panel') {
    const itemId = String(draggingPayload.itemId || '');
    const item = inventoryItems().find((entry: any) => String(entry.id) === itemId);
    if (!item) return;
    if (String(item.type || '') === 'weapon' || String(item.type || '') === 'equipment') socket.send({ type: 'equip_req', itemId });
    return;
  }
  if ((draggingPayload.source === 'inventory' || draggingPayload.source === 'equipment') && target?.closest('#npc-dialog-panel') && store.getState().npcShopOpen) {
    const itemId = String(draggingPayload.itemId || '');
    const item = findInventoryItemById(itemId) || Object.values(equippedBySlot()).find((entry: any) => String(entry?.id || '') === itemId);
    if (!item) return;
    socket.send({ type: 'sell_item_req', itemId, slotIndex: Number(item?.slotIndex ?? -1), npcId: currentNpcShopId() });
    return;
  }
  if (draggingPayload.source === 'hotbar') {
    const next = normalizeHotbar();
    next[String(draggingPayload.key || '')] = null;
    commitHotbarBindings(next);
    return;
  }
  if ((draggingPayload.source === 'inventory' || draggingPayload.source === 'equipment') && !target) {
    queueDeleteConfirmationForPayload(draggingPayload);
  }
}
function createNativeDragImage(sourceEl: HTMLElement, payload: any, previewLabel: string) {
  const visualSource = sourceEl.querySelector<HTMLElement>('img.inv-item-icon, .slot-icon img, .skill-icon, .inv-item-icon') || sourceEl;
  const dragImage = document.createElement('div');
  dragImage.className = 'ui-drag-ghost-copy native-drag-image';
  const visualClone = visualSource.cloneNode(true) as HTMLElement;
  visualClone.classList.add('ui-drag-ghost-icon');
  dragImage.appendChild(visualClone);
  const label = document.createElement('span');
  label.className = 'ui-drag-ghost-label';
  label.textContent = previewLabel;
  dragImage.appendChild(label);
  dragImage.style.position = 'fixed';
  dragImage.style.left = '-9999px';
  dragImage.style.top = '-9999px';
  dragImage.style.pointerEvents = 'none';
  dragImage.style.opacity = '0.7';
  document.body.appendChild(dragImage);
  if (!dragImage.children.length && payload?.source === 'basicattack') {
    const fallbackIcon = document.createElement('span');
    fallbackIcon.className = 'ui-drag-ghost-icon ui-drag-ghost-fallback';
    fallbackIcon.textContent = 'ATK';
    dragImage.prepend(fallbackIcon);
  }
  return dragImage;
}
function bindManualDragSource(element: HTMLElement | null, payloadFactory: () => any, previewFactory: () => string) {
  if (!element) return;
  element.setAttribute('draggable', 'true');
  element.onmousedown = (event) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest('button.learn-skill')) return;
    const previous = dragPressState.get(element) || { lastDownAt: 0, suppressNextDrag: false };
    const now = Date.now();
    previous.suppressNextDrag = now - previous.lastDownAt < 300;
    previous.lastDownAt = now;
    dragPressState.set(element, previous);
  };
  element.ondragstart = (event) => {
    if ((event.target as HTMLElement | null)?.closest('button.learn-skill')) {
      event.preventDefault();
      return;
    }
    const press = dragPressState.get(element);
    if (press?.suppressNextDrag) {
      press.suppressNextDrag = false;
      dragPressState.set(element, press);
      event.preventDefault();
      return;
    }
    const payload = payloadFactory();
    const previewLabel = previewFactory();
    draggingPayload = payload;
    element.classList.add('dragging');
    document.body.classList.add('ui-drag-active');
    setDeleteDropFeedback(false);
    const dragImage = createNativeDragImage(element, payload, previewLabel);
    const point = normalizeHudClientPoint(event.clientX || 0, event.clientY || 0);
    const firstVisual = dragImage.querySelector<HTMLElement>('.ui-drag-ghost-icon') || dragImage;
    const width = Number(firstVisual.getBoundingClientRect().width || 24);
    const height = Number(firstVisual.getBoundingClientRect().height || 24);
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
    event.dataTransfer?.setDragImage(dragImage, Math.round(width / (2 * point.scale)), Math.round(height / (2 * point.scale)));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    window.setTimeout(() => dragImage.remove(), 0);
  };
  element.ondragend = () => cleanupUiDrag();
}
function handleGlobalUiPointerMove(event: PointerEvent) {
  if (!dragPointerState || dragPointerState.pointerId !== event.pointerId) return;
  const dx = event.clientX - dragPointerState.startX;
  const dy = event.clientY - dragPointerState.startY;
  if (!dragPointerState.active && Math.hypot(dx, dy) <= DRAG_START_DISTANCE_PX) return;
  if (!dragPointerState.active) {
    dragPointerState.active = true;
    draggingPayload = dragPointerState.payload;
    hideTooltip();
    dragPointerState.sourceEl.classList.add('dragging');
    document.body.classList.add('ui-drag-active');
    const ghost = ensureDragGhost();
    ghost.innerHTML = '';
    ghost.appendChild(createDragGhostVisual(dragPointerState.sourceEl, dragPointerState.payload, dragPointerState.previewLabel));
  }
  positionDragGhost(event.clientX, event.clientY);
  setUiDragHover(updateUiDragTarget(event.clientX, event.clientY));
  event.preventDefault();
}
function handleGlobalUiPointerEnd(event: PointerEvent) {
  if (!dragPointerState || dragPointerState.pointerId !== event.pointerId) return;
  const wasActive = dragPointerState.active;
  if (wasActive) {
    suppressClickUntil = Date.now() + 120;
    performUiDrop(updateUiDragTarget(event.clientX, event.clientY), event.clientX, event.clientY);
    event.preventDefault();
    event.stopPropagation();
  }
  cleanupUiDrag();
}
function itemTooltipHtml(item: any) {
  const quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
  const rarity = resolveItemRarity(item);
  const bonusEntries = item?.bonuses && typeof item.bonuses === 'object' ? Object.entries(item.bonuses).filter(([, value]) => Number(value || 0) !== 0) : [];
  const bonuses = bonusEntries.map(([key, value]) => `<div class="${Number(value) >= 0 ? 'tooltip-bonus-pos' : 'tooltip-bonus-neg'}">${esc(String(key).toUpperCase())}: ${Number(value) > 0 ? '+' : ''}${Number(value)}</div>`).join('');
  const requiredClass = item?.requiredClass ? `<div class="tooltip-muted">Classe: ${esc(classLabel(String(item.requiredClass)))}</div>` : '';
  const sellLine = store.getState().npcShopOpen ? `<div class="tooltip-muted">Venda: ${goldValueFromCopper(computeSellCopper(item))} Gold</div>` : '';
  const equipSlot = inferEquipSlot(item);
  const equipped = equipSlot ? equippedBySlot()[equipSlot] : null;
  const compareEntries = equipped?.bonuses && typeof equipped.bonuses === 'object' ? Object.entries(equipped.bonuses).filter(([, value]) => Number(value || 0) !== 0) : [];
  const compareBlock = equipped ? `<div class="tooltip-section"><div class="tooltip-muted">Equipado: ${esc(String(equipped.name || 'Item'))}</div>${compareEntries.map(([key, value]) => `<div class="${Number(value) >= 0 ? 'tooltip-bonus-pos' : 'tooltip-bonus-neg'}">${esc(String(key).toUpperCase())}: ${Number(value) > 0 ? '+' : ''}${Number(value)}</div>`).join('') || '<div class="tooltip-muted">Sem bonus declarados.</div>'}</div>` : '';
  const header = `<div class="tooltip-title tooltip-rarity-${rarity}">${esc(item?.name || item?.templateId || 'Item')}</div><div class="tooltip-muted">Raridade: ${rarityLabel(item)}</div><div class="tooltip-divider"></div>`;
  if (String(item?.type || '') === 'potion_hp') return `${header}<div class="tooltip-muted">Consumivel</div><div>Recupera HP</div><div class="tooltip-muted">Qtd: ${quantity}</div>${sellLine}`;
  return `${header}<div class="tooltip-muted">Tipo: ${esc(item?.type || 'generic')}</div>${requiredClass}${bonuses || '<div class="tooltip-muted">Sem bonus declarados.</div>'}<div class="tooltip-muted">Qtd: ${quantity}</div>${sellLine}${compareBlock}`;
}
function npcDialogSignature(dialog: any) {
  if (!dialog) return 'none';
  const wallet = normalizeWallet(store.getState().inventoryState?.wallet);
  const party = store.getState().partyState;
  const partySig = party ? `${party.id}:${party.leaderId}:${Array.isArray(party.members) ? party.members.length : 0}` : 'none';
  return JSON.stringify({
    npcId: dialog.npc?.id || '',
    availableQuestIds: dialog.availableQuestIds || [],
    turnInQuestIds: dialog.turnInQuestIds || [],
    questIds: Array.isArray(dialog.quests) ? dialog.quests.map((entry: any) => entry?.id || entry?.title || '') : [],
    shopOffers: Array.isArray(dialog.shopOffers) ? dialog.shopOffers.map((entry: any) => `${entry?.offerId || ''}:${entry?.requiredClass || ''}:${walletToCopper(entry?.price)}`) : [],
    dungeon: dialog.dungeonEntry ? `${dialog.dungeonEntry.name || ''}:${dialog.dungeonEntry.opened ? 1 : 0}` : '',
    shopTab: shopSelectedClassTab,
    wallet,
    partySig
  });
}
function skillTooltipHtml(skillId: string) { const node = skillNode(skillId); if (!node) return `<div><strong>Habilidade</strong></div>`; return `<div><strong>${esc(node.label)}</strong></div><div>Nivel: ${skillLevel(skillId)}/${node.maxPoints}</div><div>Classe: ${esc(classLabel(node.classId))}</div>`; }
function selectNearestHostileTarget(reverse = false) { const me = localPlayer(); const world = store.getState().resolvedWorld; if (!me || !world) return; const candidates: Array<{ type: 'mob' | 'player'; id: string; dist: number }> = []; for (const mob of Array.isArray(world.mobs) ? world.mobs : []) { if (!mob || Number(mob.hp || 0) <= 0) continue; candidates.push({ type: 'mob', id: String(mob.id), dist: Math.hypot(Number(mob.x || 0) - Number(me.x || 0), Number(mob.y || 0) - Number(me.y || 0)) }); } for (const player of Object.values(world.players || {})) { const safe = player as any; if (!isHostilePlayer(safe)) continue; candidates.push({ type: 'player', id: String(safe.id), dist: Math.hypot(Number(safe.x || 0) - Number(me.x || 0), Number(safe.y || 0) - Number(me.y || 0)) }); } candidates.sort((a, b) => a.dist - b.dist); if (!candidates.length) { targetCycleIndex = -1; clearCurrentTargetSelection(); systemMessage('Nenhum alvo hostil proximo.'); return; } const currentTargetKey = store.getState().selectedMobId ? `mob:${store.getState().selectedMobId}` : store.getState().selectedPlayerId ? `player:${store.getState().selectedPlayerId}` : ''; const currentIndex = candidates.findIndex((entry) => `${entry.type}:${entry.id}` === currentTargetKey); targetCycleIndex = currentIndex >= 0 ? (currentIndex + (reverse ? -1 : 1) + candidates.length) % candidates.length : 0; const next = candidates[targetCycleIndex]; socket.send({ type: 'combat.clearTarget' }); if (next.type === 'mob') { store.update({ selectedMobId: next.id, selectedPlayerId: null }); return; } store.update({ selectedPlayerId: Number(next.id) || null, selectedMobId: null }); }

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
  const nextSummaryKey = inventorySummaryKey();
  if (label && nextSummaryKey !== lastInventorySummaryKey) {
    label.innerHTML = `Arma equipada: ${esc(String(equippedBySlot().weapon?.name || 'nenhuma'))} <span class="wallet-inline">${renderWalletTokens(store.getState().inventoryState?.wallet, { hideZero: false })}</span>`;
    lastInventorySummaryKey = nextSummaryKey;
  }
  const nextRenderKey = inventoryRenderKey();
  if (isInventoryDragActive() && grid.childElementCount > 0) return;
  if (nextRenderKey === lastInventoryRenderKey && grid.childElementCount > 0) return;
  lastInventoryRenderKey = nextRenderKey;
  const items = inventoryVisualItems();
  const bySlotIndex = new Map(items.map((entry: any) => [Number(entry.slotIndex), entry]));
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 36; i += 1) {
    const slot = document.createElement('div');
    const item = bySlotIndex.get(i);
    slot.className = 'inv-slot';
    slot.dataset.slot = String(i);
    if (item) {
      const itemEl = document.createElement('div');
      itemEl.className = `inv-item item-type-${String(item.type || 'generic')} ${rarityCssClass(item)}`;
      itemEl.dataset.itemId = String(item.id || '');
      itemEl.dataset.slotIndex = String(Number(item.slotIndex ?? -1));
      itemEl.setAttribute('draggable', 'true');
      itemEl.innerHTML = inventoryItemMarkup(item);
      if (Number(item.quantity || 1) > 1) { const qty = document.createElement('div'); qty.className = 'inv-item-qty'; qty.textContent = String(item.quantity); itemEl.appendChild(qty); }
      slot.appendChild(itemEl);
    }
    fragment.appendChild(slot);
  }
  grid.replaceChildren(fragment);
}

function normalizeHotbar() {
  const src = store.getState().hotbarBindings || {};
  const out: Record<string, any> = {};
  HOTBAR_KEYS.forEach((key) => { out[key] = src[key] || null; });
  return out;
}

function renderHotbar() {
  const nextRenderKey = hotbarRenderKey();
  if (nextRenderKey === lastHotbarRenderKey) return;
  lastHotbarRenderKey = nextRenderKey;
  const bindings = normalizeHotbar();
  document.querySelectorAll<HTMLElement>('.skill-slot-btn').forEach((button) => {
    const key = String(button.dataset.key || '').toLowerCase();
    const binding = bindings[key];
    let icon = '', title = String(button.dataset.key || '').toUpperCase(), qty = '', iconClass = 'slot-icon';
    button.classList.remove('slot-kind-action', 'slot-kind-item', 'slot-kind-empty', 'slot-icon-potion', 'slot-ghosted', 'rarity-common', 'rarity-rare', 'rarity-epic', 'rarity-legendary');
    if (binding?.type === 'action' && binding.actionId === 'basic_attack') { icon = 'ATK'; title = autoAttackDef(selectedAutoAttackSkillId)?.label || 'Ataque Basico'; button.classList.add('slot-kind-action'); }
    else if (binding?.type === 'action' && binding.actionId === 'skill_cast') { icon = esc(String(binding.skillName || skillNode(String(binding.skillId || ''))?.label || 'Habilidade').slice(0, 18)); title = String(binding.skillName || 'Habilidade'); iconClass = 'slot-icon slot-icon-skill'; button.classList.add('slot-kind-action'); }
    else if (binding?.type === 'item') {
      const item = inventoryItems().find((entry: any) => String(entry.id) === String(binding.itemId || '')) || inventoryItems().find((entry: any) => String(entry.type || '') === String(binding.itemType || ''));
      const itemType = String(binding.itemType || item?.type || '');
      title = String(binding.itemName || item?.name || 'Item');
      if (itemType === 'potion_hp') { qty = `<span class="slot-qty">${inventoryItems().filter((entry: any) => String(entry.type || '') === 'potion_hp').reduce((sum: number, entry: any) => sum + Math.max(1, Math.floor(Number(entry.quantity || 1))), 0)}</span>`; button.classList.add('slot-icon-potion'); }
      if (!item) button.classList.add('slot-ghosted');
      icon = `<img src="${esc(resolveItemIconUrl(item || binding))}" alt="${esc(title)}" draggable="false" />`;
      button.classList.add('slot-kind-item', rarityCssClass(item || binding));
    } else button.classList.add('slot-kind-empty');
    button.title = title;
    button.setAttribute('draggable', binding ? 'true' : 'false');
    button.innerHTML = `<span class="${iconClass}">${icon}</span><span class="slot-key">${esc(String(button.dataset.key || '').toUpperCase())}</span>${qty}`;
    button.onmousemove = (event) => {
      if (binding?.type === 'item') {
        const item = inventoryItems().find((entry: any) => String(entry.id) === String(binding.itemId || '')) || inventoryItems().find((entry: any) => String(entry.type || '') === String(binding.itemType || ''));
        showTooltip(itemTooltipHtml(item || { name: binding.itemName || binding.itemType || 'Item', type: binding.itemType || 'generic', quantity: 1, rarity: 'common' }), event.clientX, event.clientY);
      }
      else if (binding?.type === 'action' && binding.actionId === 'skill_cast') showTooltip(skillTooltipHtml(String(binding.skillId || '')), event.clientX, event.clientY);
      else if (binding?.type === 'action' && binding.actionId === 'basic_attack') showTooltip(`<div><strong>${esc(title)}</strong></div><div>Ataque basico/auto ataque.</div>`, event.clientX, event.clientY);
    };
    button.onmouseleave = () => hideTooltip();
    button.oncontextmenu = (event) => {
      event.preventDefault();
      if (!binding) return;
      const next = normalizeHotbar();
      next[key] = null;
      commitHotbarBindings(next);
    };
    if (binding) bindManualDragSource(button, () => ({ source: 'hotbar', key }), () => title);
    else {
      button.onmousedown = null;
      button.ondragstart = null;
      button.ondragend = null;
    }
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

function renderGuildPanel() {
  const player = localPlayer();
  const memberCount = Math.max(1, Array.isArray(store.getState().partyState?.members) ? store.getState().partyState.members.length : 1);
  if (byId('guild-master-name')) byId('guild-master-name')!.textContent = player ? playerDisplayName(player) : 'Sem mestre';
  if (byId('guild-member-count')) byId('guild-member-count')!.textContent = String(memberCount);
  if (byId('guild-message-text')) byId('guild-message-text')!.textContent = player
    ? `${playerDisplayName(player)} lidera o preparo da ordem. Recrutamento aberto para grupos, quests e exploracao do mapa atual.`
    : 'Recrutamento aberto. Forme grupo, fortaleça sua build e prepare-se para as dungeons.';
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

function renderNpcDialog(options?: { force?: boolean; focus?: boolean }) {
  const dialog = store.getState().npcDialog;
  const panel = byId<HTMLElement>('npc-dialog-panel');
  const title = byId<HTMLElement>('npc-dialog-title');
  const body = byId<HTMLElement>('npc-dialog-body');
  if (!panel || !title || !body) return;
  if (!dialog) { panel.classList.add('hidden'); npcDialogRenderKey = ''; return; }
  const shouldFocus = Boolean(options?.focus || panel.classList.contains('hidden'));
  const nextSignature = npcDialogSignature(dialog);
  if (!options?.force && nextSignature === npcDialogRenderKey && !panel.classList.contains('hidden')) return;
  npcDialogRenderKey = nextSignature;
  lastNpcDialogSyncKey = nextSignature;
  title.textContent = String(dialog.npc?.name || 'NPC');
  const availableQuestIds = Array.isArray(dialog.availableQuestIds) ? dialog.availableQuestIds : [];
  const turnInQuestIds = Array.isArray(dialog.turnInQuestIds) ? dialog.turnInQuestIds : [];
  const quests = Array.isArray(dialog.quests) ? dialog.quests : [];
  const shopOffers = Array.isArray(dialog.shopOffers) ? dialog.shopOffers : [];
  const walletCopper = walletToCopper(store.getState().inventoryState?.wallet);
  const party = store.getState().partyState;
  const partyMemberCount = Array.isArray(party?.members) ? party.members.length : 0;
  const hasValidParty = Boolean(party && partyMemberCount >= 1);
  const isLeader = Boolean(party && Number(party.leaderId) === Number(store.getState().playerId));
  const dungeonEntry = dialog.dungeonEntry && typeof dialog.dungeonEntry === 'object' ? dialog.dungeonEntry : null;
  const dungeonHtml = dungeonEntry ? (() => {
    const actions: string[] = [];
    let hint = '';
    const opened = Boolean(dungeonEntry.opened);
    if (!opened) {
      actions.push(`<button id="npc-dungeon-open" class="btn btn-primary btn-sm" type="button">Abrir Dungeon</button>`);
    } else if (!hasValidParty) {
      hint = `<div class="quest-objective">Entrada permitida apenas para quem estiver em grupo.</div>`;
    } else if (isLeader && partyMemberCount > 1) {
      actions.push(`<button id="npc-dungeon-enter-solo" class="btn btn-outline-light btn-sm" type="button">Entrar sozinho</button>`);
      actions.push(`<button id="npc-dungeon-enter-group" class="btn btn-primary btn-sm" type="button">Levar grupo comigo</button>`);
    } else {
      actions.push(`<button id="npc-dungeon-enter-solo" class="btn btn-primary btn-sm" type="button">Entrar sozinho</button>`);
    }
    return `<div class="npc-dialog-quest"><div class="quest-title">Dungeon: ${esc(dungeonEntry.name || 'Instancia')}</div><div class="quest-objective">${esc(dungeonEntry.description || 'Entre com seu grupo e derrote o boss.')} (Max: ${Math.max(1, Number(dungeonEntry.maxPlayers || 1))})</div>${hint}<div class="npc-dialog-actions">${actions.join('')}</div></div>`;
  })() : '';
  const questHtml = quests.map((quest: any) => `<div class="npc-dialog-quest"><div class="quest-title">${esc(quest.title || quest.id || 'Quest')}</div><div class="quest-objective">${esc(quest.description || '')}</div>${Array.isArray(quest.objectives) ? quest.objectives.map((objective: any) => `<div class="quest-objective">${esc(objective.text || objective.id || 'Objetivo')} (${Number(objective.required || 1)})</div>`).join('') : ''}<div class="npc-dialog-actions">${availableQuestIds.includes(String(quest.id || '')) ? `<button class="btn btn-outline-light btn-sm npc-quest-accept" data-quest-id="${esc(String(quest.id || ''))}" type="button">Aceitar</button>` : ''}${turnInQuestIds.includes(String(quest.id || '')) ? `<button class="btn btn-outline-success btn-sm npc-quest-complete" data-quest-id="${esc(String(quest.id || ''))}" type="button">Concluir</button>` : ''}</div></div>`).join('');
  let shopHtml = '';
  if (shopOffers.length) {
    const classTabs = [
      { id: 'knight', label: 'Cavaleiro' },
      { id: 'archer', label: 'Arqueiro' },
      { id: 'druid', label: 'Druida' },
      { id: 'assassin', label: 'Assassino' }
    ];
    const hasClassOffers = shopOffers.some((offer: any) => String(offer?.requiredClass || '').length > 0);
    const me = localPlayer();
    const fallbackTab = hasClassOffers ? String(me?.class || 'knight').toLowerCase() : '';
    if (String(shopNpcDialogNpcId || '') !== String(dialog.npc?.id || '')) {
      shopNpcDialogNpcId = String(dialog.npc?.id || '');
      shopSelectedClassTab = fallbackTab || 'knight';
    }
    if (!shopSelectedClassTab || !['knight', 'archer', 'druid', 'assassin'].includes(String(shopSelectedClassTab))) {
      shopSelectedClassTab = fallbackTab || 'knight';
    }
    const filteredOffers = hasClassOffers
      ? shopOffers.filter((offer: any) => String(offer.requiredClass || '').toLowerCase() === String(shopSelectedClassTab || '').toLowerCase())
      : shopOffers;
    shopHtml = `<div class="quest-title">Loja <span class="wallet-inline">${renderWalletTokens(store.getState().inventoryState?.wallet, { hideZero: false })}</span></div>${hasClassOffers ? `<div class="shop-tabs">${classTabs.map((tab) => `<button class="shop-tab-btn${shopSelectedClassTab === tab.id ? ' active' : ''}" data-shop-tab="${tab.id}" type="button">${tab.label}</button>`).join('')}</div>` : ''}<div class="shop-scroll-wrap">${filteredOffers.length ? `<div class="shop-item-grid">${filteredOffers.map((offer: any) => { const offerId = String(offer.offerId || ''); const affordable = walletCopper >= walletToCopper(offer.price); return `<div class="shop-item-card npc-shop-offer${affordable ? '' : ' npc-shop-offer-disabled'}" data-offer-id="${esc(offerId)}"><div class="shop-item-header"><div class="shop-item-icon item-type-${esc(String(offer.type || 'generic'))}">${esc(getShopIconLabel(offer))}</div><div><div class="quest-title">${esc(String(offer.name || 'Item'))}</div>${offer.requiredClass ? `<div class="quest-objective">Classe: ${esc(classLabel(String(offer.requiredClass)))}</div>` : ''}</div></div><div class="quest-objective">Custo: ${renderWalletTokens(offer.price, { hideZero: true })}</div><div class="shop-item-controls"><button class="btn btn-primary btn-sm npc-buy" data-offer-id="${esc(offerId)}" type="button"${affordable ? '' : ' disabled'}>Comprar</button></div></div>`; }).join('')}</div>` : `<div class="quest-objective">Sem equipamentos para esta classe.</div>`}</div>`;
  }
  body.innerHTML = `<div class="preview-help">${esc(dialog.npc?.greeting || '')}</div>${dungeonHtml}${questHtml}${shopHtml}`;
  panel.classList.remove('hidden');
  panel.style.zIndex = '100';
  if (shouldFocus && options?.focus) bringPanelToFront(panel);
  byId('npc-dungeon-open')?.addEventListener('click', () => { panel.classList.add('hidden'); socket.send({ type: 'dungeon.enter', npcId: dialog.npc?.id, mode: 'open' }); });
  byId('npc-dungeon-enter-solo')?.addEventListener('click', () => { panel.classList.add('hidden'); socket.send({ type: 'dungeon.enter', npcId: dialog.npc?.id, mode: 'solo' }); });
  byId('npc-dungeon-enter-group')?.addEventListener('click', () => { panel.classList.add('hidden'); socket.send({ type: 'dungeon.enter', npcId: dialog.npc?.id, mode: 'group' }); });
  body.querySelectorAll<HTMLElement>('[data-shop-tab]').forEach((button) => button.onclick = () => { shopSelectedClassTab = String(button.dataset.shopTab || 'knight'); renderNpcDialog({ force: true }); });
  body.querySelectorAll<HTMLElement>('.npc-quest-accept').forEach((button) => button.onclick = () => socket.send({ type: 'quest.accept', questId: button.dataset.questId }));
  body.querySelectorAll<HTMLElement>('.npc-quest-complete').forEach((button) => button.onclick = () => socket.send({ type: 'quest.complete', questId: button.dataset.questId }));
  body.querySelectorAll<HTMLElement>('.npc-buy').forEach((button) => button.onclick = () => { const offerId = String(button.dataset.offerId || ''); socket.send({ type: 'npc.buy', npcId: String(dialog.npc?.id || ''), offerId, quantity: 1 }); });
  const visibleShopOffers = body.querySelectorAll<HTMLElement>('.npc-shop-offer');
  visibleShopOffers.forEach((row) => {
    const offer = shopOffers.find((entry: any) => String(entry.offerId || '') === String(row.dataset.offerId || ''));
    row.onmousemove = (event) => offer && showTooltip(itemTooltipHtml({ ...offer, quantity: 1 }), event.clientX, event.clientY);
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
  byId('target-name-text')!.textContent = `${esc(playerDisplayName(player))} Lv.${Number(player?.level || 1)}`;
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
  const statBaseKey = JSON.stringify({ id: p.id, allocated: normStats(p.allocatedStats), unspent: Number(p.unspentPoints || 0) });
  if (statBaseKey !== lastStatAllocationBaseKey) {
    lastStatAllocationBaseKey = statBaseKey;
    resetPendingStatAllocation();
  }
  byId('char-panel-name')!.textContent = `${esc(p.name)} - ${classLabel(String(p.class || 'knight'))}`;
  byId('panel-class-chip')!.textContent = classLabel(String(p.class || 'knight'));
  const slotLabels: Record<string, string> = { helmet: 'Capacete', chest: 'Peitoral', pants: 'Calca', gloves: 'Luva', boots: 'Bota', ring: 'Anel', weapon: 'Arma', necklace: 'Colar' };
  document.querySelectorAll<HTMLElement>('.equip-slot').forEach((slot) => {
    const key = String(slot.dataset.slot || '');
    const item = equippedBySlot()[key];
    slot.classList.toggle('filled', Boolean(item));
    slot.textContent = item ? String(item.name || slotLabels[key] || key) : (slotLabels[key] || key);
    if (item) {
      bindPointerDoubleActivate(slot, () => socket.send({ type: 'equip_req', itemId: item.id }));
      slot.ondblclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        socket.send({ type: 'equip_req', itemId: item.id });
      };
      bindManualDragSource(slot, () => ({ source: 'equipment', itemId: String(item.id) }), () => String(item.name || slotLabels[key] || key));
    } else {
      slot.onmousedown = null;
      slot.ondragstart = null;
      slot.ondragend = null;
      slot.onpointerup = null;
      slot.ondblclick = null;
    }
  });
  const base = normStats(p.allocatedStats);
  const stats = p.stats && typeof p.stats === 'object' ? p.stats : {};
  const pendingCost = getPendingStatAllocationCost(p.allocatedStats);
  const remainingPoints = Math.max(0, Number(p.unspentPoints || 0) - pendingCost);
  const pending = statAllocationPending;
  const previewCombat = {
    physicalAttack: Number(stats.physicalAttack || 0) + Number(pending.str || 0) * 2,
    magicAttack: Number(stats.magicAttack || 0) + Number(pending.int || 0) * 3,
    physicalDefense: Number(stats.physicalDefense || 0) + Number(pending.str || 0) * 0.5 + Number(pending.vit || 0) * 1.2,
    magicDefense: Number(stats.magicDefense || 0) + Number(pending.int || 0) * 0.8 + Number(pending.vit || 0) * 0.5,
    accuracy: Number(stats.accuracy || 0) + Number(pending.dex || 0) * 1.5,
    evasion: Number(stats.evasion || 0) + Number(pending.dex || 0) * 0.8,
    moveSpeed: Number(stats.moveSpeed || 0),
    attackSpeed: Number(stats.attackSpeed || 0)
  };
  const statRow = (key: 'str' | 'int' | 'dex' | 'vit', label: string, value: number) => `<div class="line stat-row"><span>${label}: ${value + Number(pending[key] || 0)}${Number(pending[key] || 0) > 0 ? ` <span class="stat-preview-bonus">(+${Number(pending[key] || 0)})</span>` : ''}</span><div class="stat-controls"><button class="btn btn-outline-light btn-sm stat-add-btn stat-max" data-key="${key}" type="button">^</button><button class="btn btn-outline-light btn-sm stat-add-btn stat-plus" data-key="${key}" type="button">+</button><button class="btn btn-outline-light btn-sm stat-add-btn stat-minus" data-key="${key}" type="button">-</button></div></div>`;
  body.innerHTML = `<div class="char-summary-grid"><div class="line">Nivel: ${Number(p.level || 1)}</div><div class="line">XP: ${Number(p.xp || 0)}/${Number(p.xpToNext || 0)}</div><div class="line">HP: ${Number(p.hp || 0)}/${Number(p.maxHp || 0)}</div></div><div class="line wallet-line">Moedas: ${renderWalletTokens(store.getState().inventoryState?.wallet || p.wallet, { hideZero: false })}</div><div class="line stat-points-line">Pontos disponiveis: ${remainingPoints}</div><div class="char-stats-layout"><div class="char-stats-col char-stats-col-base"><div class="line stat-col-title">Atributos Base</div>${statRow('str', 'FOR', base.str)}${statRow('int', 'INT', base.int)}${statRow('dex', 'DES', base.dex)}${statRow('vit', 'VIT', base.vit)}</div><div class="char-stats-col char-stats-col-combat"><div class="line stat-col-title">Atributos de Combate</div><div class="line">PATK: ${Math.floor(previewCombat.physicalAttack)}</div><div class="line">MATK: ${Math.floor(previewCombat.magicAttack)}</div><div class="line">PDEF: ${previewCombat.physicalDefense.toFixed(1)}</div><div class="line">MDEF: ${previewCombat.magicDefense.toFixed(1)}</div><div class="line">ACC: ${previewCombat.accuracy.toFixed(1)}</div><div class="line">EVA: ${previewCombat.evasion.toFixed(1)}</div><div class="line">MSPD: ${previewCombat.moveSpeed}</div><div class="line">ASPD: ${previewCombat.attackSpeed}%</div></div></div><div class="line stat-actions"><button class="btn btn-primary btn-sm stat-apply" type="button"${getPendingStatAllocationTotal() <= 0 ? ' disabled' : ''}>Aplicar</button><button class="btn btn-outline-light btn-sm stat-clear" type="button"${getPendingStatAllocationTotal() <= 0 ? ' disabled' : ''}>Limpar</button>${getPendingStatAllocationTotal() > 0 ? `<span class="stat-cost-hint">Custo: ${pendingCost}</span>` : ''}</div>`;
  const allocateOne = (key: 'str' | 'int' | 'dex' | 'vit') => {
    const currentRemaining = Math.max(0, Number(p.unspentPoints || 0) - getPendingStatAllocationCost(p.allocatedStats));
    if (currentRemaining <= 0) return;
    const pendingValue = Number(statAllocationPending[key] || 0);
    if (currentRemaining < 1) return;
    statAllocationPending[key] = pendingValue + 1;
    renderCharacterPanel();
  };
  body.querySelectorAll<HTMLElement>('.stat-plus').forEach((button) => button.onpointerdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    allocateOne(String(button.dataset.key || 'str') as 'str' | 'int' | 'dex' | 'vit');
  });
  body.querySelectorAll<HTMLElement>('.stat-minus').forEach((button) => button.onpointerdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const key = String(button.dataset.key || 'str') as 'str' | 'int' | 'dex' | 'vit';
    statAllocationPending[key] = Math.max(0, Number(statAllocationPending[key] || 0) - 1);
    renderCharacterPanel();
  });
  body.querySelectorAll<HTMLElement>('.stat-max').forEach((button) => button.onpointerdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const key = String(button.dataset.key || 'str') as 'str' | 'int' | 'dex' | 'vit';
    for (let i = 0; i < 500; i += 1) {
      const before = Number(statAllocationPending[key] || 0);
      allocateOne(key);
      if (Number(statAllocationPending[key] || 0) === before) break;
    }
  });
  body.querySelector<HTMLElement>('.stat-apply')!.onpointerdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (getPendingStatAllocationTotal() <= 0) return;
    socket.send({ type: 'stats.allocate', allocation: { ...statAllocationPending } });
  };
  body.querySelector<HTMLElement>('.stat-clear')!.onpointerdown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetPendingStatAllocation();
    renderCharacterPanel();
  };
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
    card.innerHTML = `<span class="skill-icon">${esc(node.label.split(/\s+/).map((entry) => entry[0] || '').join('').slice(0, 2).toUpperCase())}</span><span class="skill-name">${esc(node.label)}</span><span class="lvl">${level}/${node.maxPoints}</span><button type="button" class="plus learn-skill" data-id="${esc(node.id)}">+</button>`;
    if (level > 0) bindManualDragSource(card, () => ({ source: 'skilltree', skillId: node.id, skillName: node.label }), () => node.label);
    else card.onpointerdown = null;
    wrap.appendChild(card);
  });
  wrap.querySelectorAll<HTMLElement>('.learn-skill').forEach((button) => button.onclick = (event) => { event.stopPropagation(); const id = String(button.dataset.id || ''); const node = skillNode(id); if (!node) return; if (node.prereq && skillLevel(node.prereq) < 1) return systemMessage('Aprenda o pre-requisito antes desta habilidade.'); if (skillLevel(id) >= node.maxPoints) return systemMessage('Nivel maximo atingido.'); if (skillPoints() <= 0) return systemMessage('Sem pontos de habilidade disponiveis.'); socket.send({ type: 'skill.learn', skillId: id }); });
  autoSlot.textContent = autoAttackDef(selectedAutoAttackSkillId)?.label || 'Atk Basico';
  autoSlot.onmousemove = (event) => showTooltip(`<div><strong>Ataque Basico</strong></div><div>Arraste para qualquer slot da barra.</div>`, event.clientX, event.clientY);
  autoSlot.onmouseleave = () => hideTooltip();
  bindManualDragSource(autoSlot, () => ({ source: 'basicattack', actionId: 'basic_attack', skillName: 'Atk Basico' }), () => autoAttackDef(selectedAutoAttackSkillId)?.label || 'Atk Basico');
  modular.innerHTML = [...Array(12)].map((_, idx) => idx === 0 && availableAutoAttacks().some((entry) => entry.id === 'mod_fire_wing') ? `<div class="skills-mod-slot filled">Asa de Fogo</div>` : '<div class="skills-mod-slot"></div>').join('');
}

function renderMinimap() {
  const world = store.getState().resolvedWorld;
  const p = localPlayer();
  const bounds = world?.world;
  const mini = byId<HTMLCanvasElement>('minimap-canvas');
  const full = byId<HTMLCanvasElement>('worldmap-canvas');
  if (!mini || !full || !bounds) return;

  const worldWidth = Math.max(1, Number(bounds.width || 1));
  const worldHeight = Math.max(1, Number(bounds.height || 1));
  const selectedMobId = String(store.getState().selectedMobId || '');
  const selectedPlayerId = Number(store.getState().selectedPlayerId || 0);
  const projectIso = (x: number, y: number, tileW: number, tileH: number) => {
    const nx = x / worldWidth;
    const ny = y / worldHeight;
    return {
      x: (nx - ny) * tileW * 0.5,
      y: (nx + ny) * tileH * 0.5
    };
  };

  const drawDiamond = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fill: string, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawMini = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const mapCode = String(world?.mapCode || '').toUpperCase();
    const palette = mapCode === 'A2'
      ? { base: '#c4a36a', accent: '#a78553', line: 'rgba(110, 77, 34, 0.28)' }
      : mapCode === 'DNG'
        ? { base: '#b8aa8d', accent: '#9b8a70', line: 'rgba(72, 56, 33, 0.24)' }
        : { base: '#a7c85f', accent: '#8fb04a', line: 'rgba(76, 109, 34, 0.24)' };
    const scene = worldScene();
    const playerX = Number(p?.x || 0);
    const playerY = Number(p?.y || 0);
    const offset = ((playerX + playerY) / 22) % 18;
    ctx.fillStyle = palette.base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    for (let x = -canvas.height; x < canvas.width + canvas.height; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x + offset, 0);
      ctx.lineTo(x + canvas.height + offset, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - offset, 0);
      ctx.lineTo(x - canvas.height - offset, canvas.height);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < canvas.height; y += 36) {
      ctx.fillRect(0, y, canvas.width, 1);
    }
    ctx.fillStyle = `rgba(0,0,0,0.06)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (scene) {
      const gameWidth = game.scale.width || 1;
      const gameHeight = game.scale.height || 1;
      const drawViewportDot = (worldX: number, worldY: number, color: string, radius: number, stroke = '') => {
        const point = scene.viewportPointFromWorld(worldX, worldY);
        const miniX = (point.x / Math.max(1, gameWidth)) * canvas.width;
        const miniY = (point.y / Math.max(1, gameHeight)) * canvas.height;
        if (miniX < -radius || miniX > canvas.width + radius || miniY < -radius || miniY > canvas.height + radius) return;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(miniX, miniY, radius, 0, Math.PI * 2);
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      };
      (world?.mobs || []).forEach((mob: any) => drawViewportDot(Number(mob.x || 0), Number(mob.y || 0), '#e24b4b', 2.6));
      Object.values(world?.players || {}).forEach((entry: any) => {
        const mine = Number(entry.id || 0) === Number(store.getState().playerId);
        drawViewportDot(Number(entry.x || 0), Number(entry.y || 0), '#4ea3ff', mine ? 3 : 2.4, mine ? '#ffe082' : '');
      });
    }
    ctx.strokeStyle = 'rgba(255, 226, 130, 0.38)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  };

  const drawWorldMap = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tileW = 18;
    const tileH = 9;
    const offsetX = canvas.width / 2;
    const offsetY = 24;
    ctx.fillStyle = '#071019';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawDiamond(ctx, offsetX, offsetY + canvas.height * 0.36, canvas.width * 0.86, canvas.height * 0.72, '#10263b', 0.96);

    const drawPoint = (x: number, y: number, color: string, size: number, stroke = '') => {
      const point = projectIso(x, y, tileW, tileH);
      const px = point.x + offsetX;
      const py = point.y + offsetY + canvas.height * 0.18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    (world?.portals || []).forEach((portal: any) => drawPoint(Number(portal.x || 0), Number(portal.y || 0), '#8f78ff', 4));
    (world?.activeEvents || []).forEach((evt: any) => drawPoint(Number(evt.x || 0), Number(evt.y || 0), '#ffd166', 5));
    (world?.mobs || []).forEach((mob: any) => {
      const selected = String(mob.id || '') === selectedMobId;
      drawPoint(Number(mob.x || 0), Number(mob.y || 0), selected ? '#ffef87' : '#cf4444', 4, selected ? '#fff7b2' : '');
    });
    (world?.npcs || []).forEach((npc: any) => drawPoint(Number(npc.x || 0), Number(npc.y || 0), '#4fd09a', 4));
    Object.values(world?.players || {}).forEach((entry: any) => {
      const hostile = isHostilePlayer(entry);
      const mine = Number(entry.id || 0) === Number(store.getState().playerId);
      const selected = Number(entry.id || 0) === selectedPlayerId;
      drawPoint(Number(entry.x || 0), Number(entry.y || 0), mine ? '#5bbcff' : hostile ? '#ff7b7b' : '#d8dfe8', 4, selected ? '#fff7b2' : '');
    });

    if (p) {
      const point = projectIso(Number(p.x || 0), Number(p.y || 0), tileW, tileH);
      const px = point.x + offsetX;
      const py = point.y + offsetY + canvas.height * 0.18;
      ctx.strokeStyle = '#ffe082';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 5, py - 5, 10, 10);
    }
  };

  drawMini(mini);
  drawWorldMap(full);
}

function queueMoveFromMinimapClick(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const scene = worldScene();
  const gameCanvas = document.querySelector<HTMLCanvasElement>('#game-root canvas');
  if (!scene || !gameCanvas) return false;
  const miniRect = canvas.getBoundingClientRect();
  const gameRect = gameCanvas.getBoundingClientRect();
  if (clientX < miniRect.left || clientX > miniRect.right || clientY < miniRect.top || clientY > miniRect.bottom) return false;
  const nx = (clientX - miniRect.left) / Math.max(1, miniRect.width);
  const ny = (clientY - miniRect.top) / Math.max(1, miniRect.height);
  const cropWidth = gameRect.width / MINIMAP_CROP_SCALE;
  const cropHeight = gameRect.height / MINIMAP_CROP_SCALE;
  const viewportClientX = gameRect.left + gameRect.width / 2 + ((nx - 0.5) * cropWidth);
  const viewportClientY = gameRect.top + gameRect.height / 2 + ((ny - 0.5) * cropHeight);
  return scene.queueMoveFromClientPoint(viewportClientX, viewportClientY);
}

function worldPointFromMinimapClick(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const scene = worldScene();
  const gameCanvas = document.querySelector<HTMLCanvasElement>('#game-root canvas');
  if (!scene || !gameCanvas) return null;
  const miniRect = canvas.getBoundingClientRect();
  const gameRect = gameCanvas.getBoundingClientRect();
  if (clientX < miniRect.left || clientX > miniRect.right || clientY < miniRect.top || clientY > miniRect.bottom) return null;
  const nx = (clientX - miniRect.left) / Math.max(1, miniRect.width);
  const ny = (clientY - miniRect.top) / Math.max(1, miniRect.height);
  const cropWidth = gameRect.width / MINIMAP_CROP_SCALE;
  const cropHeight = gameRect.height / MINIMAP_CROP_SCALE;
  const viewportClientX = gameRect.left + gameRect.width / 2 + ((nx - 0.5) * cropWidth);
  const viewportClientY = gameRect.top + gameRect.height / 2 + ((ny - 0.5) * cropHeight);
  return scene.worldFromClientPoint(viewportClientX, viewportClientY);
}

function worldPointFromIsoMapClick(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const world = store.getState().resolvedWorld;
  const p = localPlayer();
  const bounds = world?.world;
  if (!bounds) return null;
  const worldWidth = Math.max(1, Number(bounds.width || 1));
  const worldHeight = Math.max(1, Number(bounds.height || 1));
  const small = canvas.id === 'minimap-canvas';
  const tileW = small ? 22 : 18;
  const tileH = small ? 11 : 9;
  const centerWorldX = small && p ? Number(p.x || 0) : worldWidth / 2;
  const centerWorldY = small && p ? Number(p.y || 0) : worldHeight / 2;
  const centerIsoX = ((centerWorldX / worldWidth) - (centerWorldY / worldHeight)) * tileW * 0.5;
  const centerIsoY = ((centerWorldX / worldWidth) + (centerWorldY / worldHeight)) * tileH * 0.5;
  const offsetX = canvas.width / 2 - centerIsoX;
  const offsetY = canvas.height / 2 - centerIsoY + (small ? 12 : 18);
  const rect = canvas.getBoundingClientRect();
  const px = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width - offsetX;
  const py = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height - offsetY;
  const nx = (py / Math.max(1, tileH)) + (px / Math.max(1, tileW));
  const ny = (py / Math.max(1, tileH)) - (px / Math.max(1, tileW));
  return {
    x: Math.max(0, Math.min(worldWidth, nx * worldWidth)),
    y: Math.max(0, Math.min(worldHeight, ny * worldHeight))
  };
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

function toggleMapSettingsPanel(force?: boolean) {
  const panel = byId<HTMLElement>('map-settings-panel');
  if (!panel) return;
  const nextHidden = typeof force === 'boolean' ? !force : !panel.classList.contains('hidden');
  panel.classList.toggle('hidden', nextHidden);
}

function bindUi() {
  byId('hud-root')?.addEventListener('mousedown', (event) => event.stopPropagation(), true);
  window.addEventListener('pointermove', handleGlobalUiPointerMove, true);
  window.addEventListener('pointerup', handleGlobalUiPointerEnd, true);
  window.addEventListener('pointercancel', handleGlobalUiPointerEnd, true);
  document.addEventListener('dragover', (event) => {
    if (!draggingPayload) return;
    const target = updateUiDragTarget(event.clientX, event.clientY);
    setUiDragHover(target);
    const deleteCandidate = !target && (draggingPayload.source === 'inventory' || draggingPayload.source === 'equipment');
    setDeleteDropFeedback(deleteCandidate);
    if (target || deleteCandidate) event.preventDefault();
  }, true);
  document.addEventListener('drop', (event) => {
    if (!draggingPayload) return;
    const dropTarget = event.target as HTMLElement | null;
    const target = isUiDropTarget(dropTarget) ? updateUiDragTarget(event.clientX, event.clientY) : null;
    if (target || (draggingPayload.source === 'inventory' || draggingPayload.source === 'equipment')) event.preventDefault();
    performUiDrop(target, event.clientX, event.clientY);
    cleanupUiDrag();
  }, true);
  ['pointerdown', 'click', 'dblclick', 'contextmenu', 'wheel'].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('#hud-root .panel, #hud-root .hud-worldmap, #hud-root .hud-chat, #hud-root .hud-skillbar, #hud-root .hud-menus, #hud-root .hud-card, #hud-root .hud-target-player, #hud-root .hud-minimap, #hud-root .hud-party-frames, #hud-root .hud-party-notify, #hud-root .hud-friend-notify, #hud-root .hud-dungeon-notify, #item-tooltip')) return;
      event.stopPropagation();
    }, true);
  });
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
  byId('map-settings-toggle')?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleMapSettingsPanel();
  });
  byId('map-settings-toggle')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  byId('map-settings-panel')?.addEventListener('pointerdown', (event) => event.stopPropagation(), true);
  byId<HTMLInputElement>('auto-attack-toggle')?.addEventListener('change', (event) => { autoAttackEnabled = Boolean((event.currentTarget as HTMLInputElement).checked); });
  byId<HTMLInputElement>('path-debug-toggle')?.addEventListener('change', (event) => {
    if (!isAdminPlayer()) {
      (event.currentTarget as HTMLInputElement).checked = false;
      pathDebugEnabled = false;
      store.update({ pathDebugEnabled: false });
      return;
    }
    pathDebugEnabled = Boolean((event.currentTarget as HTMLInputElement).checked);
    store.update({ pathDebugEnabled });
    renderMinimap();
  });
  byId<HTMLInputElement>('interaction-debug-toggle')?.addEventListener('change', (event) => {
    if (!isAdminPlayer()) {
      (event.currentTarget as HTMLInputElement).checked = false;
      store.update({ interactionDebugEnabled: false });
      return;
    }
    store.update({ interactionDebugEnabled: Boolean((event.currentTarget as HTMLInputElement).checked) });
  });
  byId<HTMLInputElement>('hud-debug-toggle')?.addEventListener('change', (event) => {
    if (!isAdminPlayer()) {
      (event.currentTarget as HTMLInputElement).checked = false;
      return;
    }
    updateHudDebugPanelUI();
  });
  byId<HTMLInputElement>('hud-scale-min')?.addEventListener('input', updateHudDebugPanelUI);
  byId<HTMLInputElement>('hud-scale-max')?.addEventListener('input', updateHudDebugPanelUI);
  byId('hud-debug-reset')?.addEventListener('click', () => {
    if (byId<HTMLInputElement>('hud-scale-min')) byId<HTMLInputElement>('hud-scale-min')!.value = '84';
    if (byId<HTMLInputElement>('hud-scale-max')) byId<HTMLInputElement>('hud-scale-max')!.value = '106';
    if (byId<HTMLInputElement>('hud-debug-toggle')) byId<HTMLInputElement>('hud-debug-toggle')!.checked = false;
    updateHudDebugPanelUI();
  });
  byId<HTMLInputElement>('mob-peaceful-toggle')?.addEventListener('change', (event) => {
    if (!isAdminPlayer()) {
      (event.currentTarget as HTMLInputElement).checked = false;
      return;
    }
    socket.send({ type: 'admin.setMobPeaceful', enabled: Boolean((event.currentTarget as HTMLInputElement).checked) });
  });
  byId('dungeon-debug-btn')?.addEventListener('click', () => isAdminPlayer() && socket.send({ type: 'admin_command', command: 'dungeon.debug' }));
  byId('admin-send')?.addEventListener('click', sendAdminCommand);
  byId<HTMLInputElement>('admin-command')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') sendAdminCommand(); });
  byId('player-pvp-toggle')?.addEventListener('click', () => byId('player-pvp-menu')?.classList.toggle('hidden'));
  document.querySelectorAll<HTMLElement>('.pvp-mode-option').forEach((button) => button.addEventListener('click', () => { socket.send({ type: 'player.setPvpMode', mode: String(button.dataset.mode || 'peace') }); byId('player-pvp-menu')?.classList.add('hidden'); }));
  byId<HTMLSelectElement>('instance-select')?.addEventListener('change', (event) => socket.send({ type: 'switch_instance', mapId: String((event.currentTarget as HTMLSelectElement).value || '') }));
  [['menu-attrs', 'char-panel', 'char-panel-close'], ['menu-inventory', 'inventory-panel', 'inventory-panel-close'], ['menu-skills', 'skills-panel', 'skills-panel-close'], ['menu-quests', 'quest-panel', 'quest-panel-close'], ['menu-map', 'worldmap-panel', 'worldmap-close'], ['menu-party', 'party-panel', 'party-panel-close'], ['menu-friends', 'friends-panel', 'friends-panel-close'], ['menu-guild', 'guild-panel', 'guild-panel-close']].forEach(([buttonId, panelId, closeId]) => {
    byId(buttonId)?.addEventListener('click', () => {
      const panel = byId<HTMLElement>(panelId);
      if (!panel) return;
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) bringPanelToFront(panel);
    });
    byId(closeId)?.addEventListener('click', () => byId(panelId)?.classList.add('hidden'));
  });
  [['char-panel', 'char-panel-header'], ['inventory-panel', 'inventory-header'], ['skills-panel', 'skills-header'], ['party-panel', 'party-header'], ['friends-panel', 'friends-header'], ['guild-panel', 'guild-header'], ['worldmap-panel', 'worldmap-header'], ['admin-panel', 'admin-header']].forEach(([panelId, headerId]) => makePanelDraggable(panelId, headerId));
  for (let i = 0; i < 3; i += 1) byId<HTMLButtonElement>(`character-slot-${i}`)?.addEventListener('click', () => store.getState().characterSlots[i] && store.update({ selectedCharacterSlot: i }));
  document.querySelectorAll<HTMLElement>('.chat-scope').forEach((button) => button.addEventListener('click', () => { chatScope = String(button.dataset.scope || 'local') as 'local' | 'map' | 'global'; document.querySelectorAll('.chat-scope').forEach((entry) => entry.classList.remove('active')); button.classList.add('active'); }));
  byId<HTMLInputElement>('chat-input')?.addEventListener('keydown', (event) => { if (event.key !== 'Enter') return; const input = event.currentTarget as HTMLInputElement; const text = String(input.value || '').trim(); event.preventDefault(); if (!text) { closeChatInput(); return; } socket.send({ type: 'chat_send', scope: chatScope, text }); input.value = ''; closeChatInput(); });
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
  byId('inventory-grid')?.addEventListener('mousedown', (event) => {
    const itemEl = (event.target as HTMLElement | null)?.closest('.inv-item') as HTMLElement | null;
    if (!itemEl || event.button !== 0) return;
    const previous = dragPressState.get(itemEl) || { lastDownAt: 0, suppressNextDrag: false };
    const now = Date.now();
    previous.suppressNextDrag = now - previous.lastDownAt < 300;
    previous.lastDownAt = now;
    dragPressState.set(itemEl, previous);
  });
  byId('inventory-grid')?.addEventListener('dragstart', (event) => {
    const itemEl = (event.target as HTMLElement | null)?.closest('.inv-item') as HTMLElement | null;
    if (!itemEl) return;
    const press = dragPressState.get(itemEl);
    if (press?.suppressNextDrag) {
      press.suppressNextDrag = false;
      dragPressState.set(itemEl, press);
      event.preventDefault();
      return;
    }
    const itemId = String(itemEl.dataset.itemId || '');
    const item = findInventoryItemById(itemId);
    if (!item) {
      event.preventDefault();
      return;
    }
    draggingPayload = { source: 'inventory', itemId };
    itemEl.classList.add('dragging');
    document.body.classList.add('ui-drag-active');
    const dragImage = createNativeDragImage(itemEl, draggingPayload, String(item.name || item.templateId || 'Item'));
    const point = normalizeHudClientPoint(event.clientX || 0, event.clientY || 0);
    const img = dragImage.querySelector<HTMLElement>('.ui-drag-ghost-icon') || dragImage;
    const rect = img.getBoundingClientRect();
    event.dataTransfer?.setData('text/plain', itemId);
    event.dataTransfer?.setDragImage(dragImage, Math.round(rect.width / (2 * point.scale)), Math.round(rect.height / (2 * point.scale)));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    window.setTimeout(() => dragImage.remove(), 0);
  });
  byId('inventory-grid')?.addEventListener('dragend', () => cleanupUiDrag());
  byId('inventory-grid')?.addEventListener('dblclick', (event) => {
    const itemEl = (event.target as HTMLElement | null)?.closest('.inv-item') as HTMLElement | null;
    if (!itemEl) return;
    event.preventDefault();
    event.stopPropagation();
    dispatchInventoryItemAction(String(itemEl.dataset.itemId || ''));
  });
  byId('inventory-grid')?.addEventListener('click', (event) => {
    const itemEl = (event.target as HTMLElement | null)?.closest('.inv-item') as HTMLElement | null;
    if (!itemEl) return;
    const item = findInventoryItemById(String(itemEl.dataset.itemId || ''));
    if (!item) return;
    if (event.ctrlKey && Number(item.quantity || 1) > 1) {
      event.preventDefault();
      event.stopPropagation();
      showSplitStackModal(item);
      return;
    }
    if (event.shiftKey && store.getState().npcShopOpen) {
      event.preventDefault();
      event.stopPropagation();
      socket.send({ type: 'sell_item_req', itemId: String(item.id || ''), slotIndex: Number(item.slotIndex ?? -1), npcId: currentNpcShopId() });
    }
  });
  byId('inventory-grid')?.addEventListener('contextmenu', (event) => {
    const itemEl = (event.target as HTMLElement | null)?.closest('.inv-item') as HTMLElement | null;
    if (!itemEl) return;
    event.preventDefault();
    const item = findInventoryItemById(String(itemEl.dataset.itemId || ''));
    if (!item) return;
    showConfirmationModal(
      'Destruir Item',
      'Deseja realmente destruir este item? Esta acao nao pode ser desfeita.',
      () => {
        socket.send({ type: 'delete_item_req', itemId: String(item.id || ''), slotIndex: Number(item.slotIndex ?? -1) });
        hideConfirmationModal();
      }
    );
  });
  byId('inventory-grid')?.addEventListener('mousemove', (event) => {
    const itemEl = (event.target as HTMLElement | null)?.closest('.inv-item') as HTMLElement | null;
    if (!itemEl) return;
    const item = findInventoryItemById(String(itemEl.dataset.itemId || ''));
    if (!item) return;
    showTooltip(itemTooltipHtml(item), event.clientX, event.clientY);
  });
  byId('inventory-grid')?.addEventListener('mouseleave', () => hideTooltip());
  byId('confirmation-modal-root')?.addEventListener('pointerdown', handleModalRootInteraction, true);
  byId('confirmation-modal-root')?.addEventListener('click', handleModalRootInteraction, true);
  byId('party-create')?.addEventListener('click', () => socket.send({ type: 'party.create' }));
  byId('party-invite-btn')?.addEventListener('click', () => { const targetName = String(byId<HTMLInputElement>('party-invite-name')?.value || '').trim(); if (targetName) socket.send({ type: 'party.invite', targetName }); });
  byId('party-leave')?.addEventListener('click', () => socket.send({ type: 'party.leave' }));
  byId('party-request-join-btn')?.addEventListener('click', () => selectedAreaPartyId && socket.send({ type: 'party.requestJoin', partyId: selectedAreaPartyId }));
  byId('friends-add-btn')?.addEventListener('click', () => { const targetName = String(byId<HTMLInputElement>('friends-add-name')?.value || '').trim(); if (targetName) socket.send({ type: 'friend.request', targetName }); });
  byId('friends-tab-list')?.addEventListener('click', () => { setHidden(byId('friends-view-list'), false); setHidden(byId('friends-view-requests'), true); });
  byId('friends-tab-requests')?.addEventListener('click', () => { setHidden(byId('friends-view-list'), true); setHidden(byId('friends-view-requests'), false); });
  byId('guild-invite-btn')?.addEventListener('click', () => systemMessage('Sistema de guilda pronto para integrar convites quando o backend estiver disponivel.'));
  byId('guild-roster-btn')?.addEventListener('click', () => systemMessage('Roster de guilda em preparacao. Estrutura visual ja disponivel.'));
  byId('party-tab-area')?.addEventListener('click', () => { setHidden(byId('party-view-area'), false); setHidden(byId('party-view-my'), true); socket.send({ type: 'party.requestAreaParties' }); });
  byId('party-tab-my')?.addEventListener('click', () => { setHidden(byId('party-view-area'), true); setHidden(byId('party-view-my'), false); });
  byId('npc-dialog-close')?.addEventListener('click', () => store.update({ npcDialog: null, npcShopOpen: false }));
  byId('npc-dialog-panel-close')?.addEventListener('click', () => store.update({ npcDialog: null, npcShopOpen: false }));
  window.addEventListener('noxis:npc-dialog', () => {
    lastNpcDialogSyncKey = store.getState().npcDialog ? npcDialogSignature(store.getState().npcDialog) : 'none';
    renderNpcDialog({ force: true, focus: false });
  });
  byId('target-actions-toggle')?.addEventListener('click', () => byId('target-actions-menu')?.classList.toggle('hidden'));
  byId('target-invite-btn')?.addEventListener('click', () => { const id = store.getState().selectedPlayerId; const target = id ? store.getState().resolvedWorld?.players?.[String(id)] : null; if (target?.name) socket.send({ type: 'party.invite', targetName: target.name }); });
  byId('target-friend-btn')?.addEventListener('click', () => { const id = store.getState().selectedPlayerId; const target = id ? store.getState().resolvedWorld?.players?.[String(id)] : null; if (target?.name) socket.send({ type: 'friend.request', targetName: target.name }); });
  [byId<HTMLCanvasElement>('minimap-canvas'), byId<HTMLCanvasElement>('worldmap-canvas')].forEach((canvas) => {
    canvas?.addEventListener('click', (event) => {
      if (!canvas) return;
      if (canvas.id === 'minimap-canvas') {
        queueMoveFromMinimapClick(canvas, event.clientX, event.clientY);
        return;
      }
      const point = worldPointFromIsoMapClick(canvas, event.clientX, event.clientY);
      if (!point) return;
      socket.send({ type: 'move', reqId: Date.now(), x: point.x, y: point.y });
    });
    canvas?.addEventListener('auxclick', (event) => {
      if (event.button !== 1) return;
      const party = store.getState().partyState;
      if (!canvas) return;
      if (!party?.id) return void systemMessage('Voce precisa estar em um grupo para marcar waypoint.');
      event.preventDefault();
      const point = canvas.id === 'minimap-canvas'
        ? worldPointFromMinimapClick(canvas, event.clientX, event.clientY)
        : worldPointFromIsoMapClick(canvas, event.clientX, event.clientY);
      if (!point) return;
      socket.send({ type: 'party.waypointPing', x: point.x, y: point.y });
    });
  });
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
  byId('target-clear-btn')?.addEventListener('click', () => { byId('target-actions-menu')?.classList.add('hidden'); clearCurrentTargetSelection(); });
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node | null;
    const chatWrap = byId('chat-wrap');
    const chatMenu = byId('chat-mode-menu');
    if (target && !chatWrap?.contains(target) && !chatMenu?.contains(target)) closeChatInput();
  }, true);
  document.addEventListener('pointerdown', (event) => {
    const panel = (event.target as HTMLElement | null)?.closest('.panel, .hud-worldmap') as HTMLElement | null;
    if (!panel || panel.classList.contains('hidden')) return;
    bringPanelToFront(panel);
  }, true);
  document.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('#map-settings-toggle, #map-settings-panel')) return;
    toggleMapSettingsPanel(false);
  }, true);
  document.addEventListener('click', (event) => {
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const closeButton = (event.target as HTMLElement | null)?.closest('.panel-close-btn') as HTMLElement | null;
    if (!closeButton) return;
    event.preventDefault();
    event.stopPropagation();
    closePanelFromButton(closeButton);
  }, true);
  window.addEventListener('keydown', (event) => {
    if (isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const isQuote = event.code === 'Quote' || event.key === "'" || event.key === '"';
    if (isQuote) { event.preventDefault(); selectNearestHostileTarget(event.shiftKey); return; }
    if (event.key === '.') { event.preventDefault(); socket.send({ type: 'player.toggleAfk' }); return; }
    if (key === 'h' && isAdminPlayer()) { event.preventDefault(); setAdminPanelOpen(!adminPanelOpen); return; }
    if (event.key === 'Escape') { Object.values(PANEL_SHORTCUTS).forEach((panelId) => byId(panelId)?.classList.add('hidden')); setAdminPanelOpen(false); byId('player-pvp-menu')?.classList.add('hidden'); byId('target-actions-menu')?.classList.add('hidden'); byId('chat-mode-menu')?.classList.add('hidden'); closeChatInput(); store.update({ pendingDeleteItemId: null, npcDialog: null, npcShopOpen: false }); hideConfirmationModal(); clearCurrentTargetSelection(); hideTooltip(); cleanupUiDrag(); return; }
    if (event.key === 'Enter') return void byId<HTMLInputElement>('chat-input')?.focus();
    if (PANEL_SHORTCUTS[key]) {
      event.preventDefault();
      const panel = byId<HTMLElement>(PANEL_SHORTCUTS[key]);
      panel?.classList.toggle('hidden');
      if (panel && !panel.classList.contains('hidden')) bringPanelToFront(panel);
      if (key === 'g') socket.send({ type: 'party.requestAreaParties' });
      if (key === 'o') socket.send({ type: 'friend.list' });
      return;
    }
    if (HOTBAR_KEYS.includes(key)) { event.preventDefault(); activateHotbar(key); }
  });
  [byId<HTMLCanvasElement>('minimap-canvas'), byId<HTMLCanvasElement>('worldmap-canvas')].forEach((canvas) => {
    canvas?.addEventListener('mousemove', (event) => {
      if (!canvas) return;
      const point = canvas.id === 'minimap-canvas'
        ? worldPointFromMinimapClick(canvas, event.clientX, event.clientY)
        : worldPointFromIsoMapClick(canvas, event.clientX, event.clientY);
      const label = byId<HTMLElement>(canvas.id === 'minimap-canvas' ? 'minimap-coords-label' : 'worldmap-coords-label');
      if (!label) return;
      if (!point) {
        const p = localPlayer();
        label.textContent = p ? `X: ${Math.round(Number(p.x || 0))} | Y: ${Math.round(Number(p.y || 0))}` : 'X: -- | Y: --';
        return;
      }
      label.textContent = `X: ${Math.round(Number(point.x || 0))} | Y: ${Math.round(Number(point.y || 0))}`;
    });
    canvas?.addEventListener('mouseleave', () => {
      const p = localPlayer();
      const label = byId<HTMLElement>(canvas.id === 'minimap-canvas' ? 'minimap-coords-label' : 'worldmap-coords-label');
      if (label) label.textContent = p ? `X: ${Math.round(Number(p.x || 0))} | Y: ${Math.round(Number(p.y || 0))}` : 'X: -- | Y: --';
    });
  });
  updateHudDebugPanelUI();
  applyHudBrowserZoomCompensation();
  window.addEventListener('resize', applyHudBrowserZoomCompensation);
}
function render() {
  const state = store.getState();
  const world = state.resolvedWorld;
  const p = localPlayer();
  const inGame = state.connectionPhase === 'in_game';
  const isAdmin = isAdminPlayer(p);
  if (byId('auth-status')) byId('auth-status')!.textContent = state.authMessage || '';
  setHidden(byId('screen-login-register'), !(state.connectionPhase === 'auth' || state.connectionPhase === 'connecting' || state.connectionPhase === 'disconnected'));
  setHidden(byId('screen-character-select'), state.connectionPhase !== 'character_select');
  setHidden(byId('screen-character-create'), state.connectionPhase !== 'character_create');
  setHidden(byId('ui-container'), inGame && !SVELTE_HUD_SCAFFOLD_ENABLED);
  setHidden(byId('auth-screen'), SVELTE_AUTH_ENABLED || inGame);
  renderCharacterSlots(state.characterSlots, state.selectedCharacterSlot);
  if (byId('btn-character-enter')) byId<HTMLButtonElement>('btn-character-enter')!.disabled = !Number.isInteger(state.selectedCharacterSlot);
  ['player-card', 'minimap-wrap', 'chat-wrap', 'skillbar-wrap', 'menus-wrap', 'perf-hud'].forEach((id) => setHidden(byId(id), !inGame));
  setHidden(byId('hud-root'), !inGame || SVELTE_HUD_SCAFFOLD_ENABLED);
  setHidden(byId('revive-overlay'), !(inGame && (state.dead || Boolean(p?.dead) || Number(p?.hp || 0) <= 0)));
  if (!inGame || !isAdmin) adminPanelOpen = false;
  setHidden(byId('admin-panel'), !inGame || !isAdmin || !adminPanelOpen);
  setHidden(byId('afk-status'), !(inGame && Boolean(p?.afkActive)));
  setHidden(byId('path-debug-setting'), !isAdmin);
  setHidden(byId('interaction-debug-setting'), !isAdmin);
  setHidden(byId('hud-debug-setting'), !isAdmin);
  setHidden(byId('mob-peaceful-setting'), !isAdmin);
  setHidden(byId('dungeon-debug-setting'), !isAdmin);
  if (!inGame) {
    requestedInGameState = false;
    return;
  }
  if (!requestedInGameState) { requestedInGameState = true; socket.send({ type: 'party.requestAreaParties' }); socket.send({ type: 'friend.list' }); }
  if (p && Number(p.hp || 0) > 0 && state.dead) { store.update({ dead: false }); return; }
  byId('player-avatar')!.textContent = classIcon(String(p?.class || 'knight'));
  byId('player-avatar')!.className = `class-avatar class-${esc(skillClass(String(p?.class || 'knight')))}`;
  byId('player-name')!.textContent = playerDisplayName(p).toUpperCase();
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
  if (byId<HTMLInputElement>('mob-peaceful-toggle')) byId<HTMLInputElement>('mob-peaceful-toggle')!.checked = Boolean(state.adminMobPeacefulEnabled);
  if (byId<HTMLElement>('admin-result')) {
    const adminMessage = String(state.adminResult?.message || '');
    byId<HTMLElement>('admin-result')!.textContent = adminMessage;
    byId<HTMLElement>('admin-result')!.className = state.adminResult?.ok === false ? 'text-danger mt-2' : 'mt-2';
  }
  const fps = Math.round(Number(game.loop.actualFps || 0));
  byId('perf-hud')!.textContent = `FPS ${fps > 0 ? fps : '--'} | Ping ${Number.isFinite(Number(state.networkPingMs)) ? `${Math.round(Number(state.networkPingMs))}ms` : '--'} | WS ${state.socketConnected ? 'on' : 'off'} | ${String(world?.mapCode || '-')} / ${currentMapId}`;
  if (!isAdmin) {
    pathDebugEnabled = false;
    if (byId<HTMLInputElement>('path-debug-toggle')) byId<HTMLInputElement>('path-debug-toggle')!.checked = false;
    if (byId<HTMLInputElement>('interaction-debug-toggle')) byId<HTMLInputElement>('interaction-debug-toggle')!.checked = false;
    if (state.pathDebugEnabled) store.update({ pathDebugEnabled: false });
    if (state.interactionDebugEnabled) store.update({ interactionDebugEnabled: false });
    if (byId<HTMLInputElement>('hud-debug-toggle')) byId<HTMLInputElement>('hud-debug-toggle')!.checked = false;
  }
  updateHudDebugPanelUI();
  if (byId<HTMLInputElement>('path-debug-toggle') && byId<HTMLInputElement>('path-debug-toggle')!.checked !== Boolean(state.pathDebugEnabled) && isAdmin) byId<HTMLInputElement>('path-debug-toggle')!.checked = Boolean(state.pathDebugEnabled);
  if (byId<HTMLInputElement>('interaction-debug-toggle') && byId<HTMLInputElement>('interaction-debug-toggle')!.checked !== Boolean(state.interactionDebugEnabled) && isAdmin) byId<HTMLInputElement>('interaction-debug-toggle')!.checked = Boolean(state.interactionDebugEnabled);
  renderChat();
  renderHotbar();
  renderPartyFrames();
  renderNotifications();
  renderTargetCard();
  renderDungeonReady();
  renderMinimap();
  if (!state.npcDialog) byId('npc-dialog-panel')?.classList.add('hidden');
  if (!byId('inventory-panel')?.classList.contains('hidden')) renderInventory();
  if (!byId('quest-panel')?.classList.contains('hidden')) renderQuests();
  if (!byId('party-panel')?.classList.contains('hidden')) renderParty();
  if (!byId('friends-panel')?.classList.contains('hidden')) renderFriends();
  if (!byId('guild-panel')?.classList.contains('hidden')) renderGuildPanel();
  if (!byId('char-panel')?.classList.contains('hidden')) renderCharacterPanel();
  if (!byId('skills-panel')?.classList.contains('hidden')) renderSkillsPanel();
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

bindUi();
const svelteHudRuntime = (SVELTE_AUTH_ENABLED || SVELTE_HUD_SCAFFOLD_ENABLED)
  ? mountHudApp({ store, socket, target: byId('ui-container'), enableHud: SVELTE_HUD_SCAFFOLD_ENABLED })
  : null;
store.addEventListener('change', scheduleRender as EventListener);
store.addEventListener('change', syncNpcDialogRender as EventListener);
render();
socket.connect();
window.addEventListener('beforeunload', () => {
  svelteHudRuntime?.destroy();
  game.destroy(true);
});













