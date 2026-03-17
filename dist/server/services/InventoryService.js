"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const crypto_1 = require("crypto");
const config_1 = require("../config");
const math_1 = require("../utils/math");
const EQUIPMENT_SLOTS = new Set(['helmet', 'chest', 'pants', 'gloves', 'boots', 'ring', 'necklace']);
const GLOBAL_MAX_STACK = 250;
class InventoryService {
    constructor(getGroundItems, setGroundItems, mapInstanceId, persistPlayer, recomputePlayerStats, sendInventoryState, sendStatsUpdated, normalizeHotbarBindings, firstFreeInventorySlot, getSpentSkillPoints, sendRaw, normalizeClassId, onItemCollected) {
        this.getGroundItems = getGroundItems;
        this.setGroundItems = setGroundItems;
        this.mapInstanceId = mapInstanceId;
        this.persistPlayer = persistPlayer;
        this.recomputePlayerStats = recomputePlayerStats;
        this.sendInventoryState = sendInventoryState;
        this.sendStatsUpdated = sendStatsUpdated;
        this.normalizeHotbarBindings = normalizeHotbarBindings;
        this.firstFreeInventorySlot = firstFreeInventorySlot;
        this.getSpentSkillPoints = getSpentSkillPoints;
        this.sendRaw = sendRaw;
        this.normalizeClassId = normalizeClassId;
        this.onItemCollected = onItemCollected;
    }
    handlePickupItem(player, msg) {
        const itemId = String(msg.itemId || '');
        const items = this.getGroundItems();
        const index = items.findIndex((it) => it.id === itemId && it.mapId === this.mapInstanceId(player.mapKey, player.mapId));
        if (index === -1)
            return;
        const item = items[index];
        if (typeof item.expiresAt === 'number' && item.expiresAt <= Date.now()) {
            items.splice(index, 1);
            this.setGroundItems(items);
            return;
        }
        const now = Date.now();
        const reservedUntil = Number(item.reservedUntil || 0);
        if (reservedUntil > now) {
            const ownerId = Number(item.ownerId || 0);
            const ownerPartyId = String(item.ownerPartyId || '');
            const sameOwner = ownerId > 0 && ownerId === Number(player.id);
            const sameParty = ownerPartyId && String(player.partyId || '') === ownerPartyId;
            if (!sameOwner && !sameParty) {
                this.sendRaw(player.ws, { type: 'system_message', text: 'Item temporariamente reservado para outro jogador/grupo.' });
                return;
            }
        }
        if ((0, math_1.distance)(player, item) > config_1.ITEM_PICKUP_RANGE)
            return;
        const requestedQty = Math.max(1, Math.floor(Number(item.quantity || 1)));
        let remaining = requestedQty;
        remaining = this.addItemToInventory(player, item, remaining);
        const collectedQty = Math.max(0, requestedQty - remaining);
        if (remaining <= 0) {
            items.splice(index, 1);
        }
        else {
            items[index] = { ...item, quantity: remaining };
        }
        this.setGroundItems(items);
        this.persistPlayer(player);
        this.sendInventoryState(player);
        if (collectedQty > 0 && this.onItemCollected) {
            this.onItemCollected(player, String(item.templateId || item.type || ''), collectedQty);
        }
    }
    handleHotbarSet(player, msg) {
        const raw = msg && typeof msg.bindings === 'object' ? msg.bindings : null;
        if (!raw)
            return;
        const normalized = this.normalizeHotbarBindings(raw);
        if (!player.statusOverrides || typeof player.statusOverrides !== 'object')
            player.statusOverrides = {};
        player.statusOverrides.__hotbarBindings = normalized;
        this.persistPlayer(player);
        this.sendRaw(player.ws, { type: 'hotbar.state', bindings: normalized });
    }
    commitInventoryEquipTransaction(player, nextInventory, nextEquippedWeaponId) {
        player.equippedWeaponId = nextEquippedWeaponId;
        player.inventory = this.normalizeInventorySlots(nextInventory, nextEquippedWeaponId);
        this.recomputePlayerStats(player);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    enrichItemVisuals(item) {
        const templateKey = String(item?.templateId || item?.id || item?.type || '');
        const template = config_1.BUILTIN_ITEM_TEMPLATE_BY_ID[templateKey] || config_1.BUILTIN_ITEM_TEMPLATE_BY_ID[String(item?.type || '')] || null;
        return {
            ...item,
            rarity: String(item?.rarity || template?.rarity || 'common'),
            spriteId: item?.spriteId || item?.sprite_id || template?.spriteId || null,
            iconUrl: item?.iconUrl || item?.icon_url || template?.iconUrl || '/assets/ui/items/placeholder-transparent.svg',
            maxStack: this.isStackableItem(item || template) ? GLOBAL_MAX_STACK : Number(item?.maxStack || template?.maxStack || 1)
        };
    }
    handleEquipItem(player, msg) {
        const itemId = msg.itemId ? String(msg.itemId) : null;
        const workingInventory = Array.isArray(player.inventory) ? player.inventory.map((entry) => ({ ...entry })) : [];
        if (!itemId) {
            const equipped = player.equippedWeaponId
                ? workingInventory.find((it) => it.id === player.equippedWeaponId && it.type === 'weapon')
                : null;
            if (equipped && (!Number.isInteger(equipped.slotIndex) || equipped.slotIndex < 0)) {
                equipped.slotIndex = this.firstFreeInventorySlot(workingInventory, new Set([equipped.id]));
            }
            if (equipped) {
                equipped.equipped = false;
                equipped.equippedSlot = null;
            }
            this.commitInventoryEquipTransaction(player, workingInventory, null);
            return;
        }
        const found = workingInventory.find((it) => it.id === itemId);
        if (!found)
            return;
        const itemType = String(found.type || '');
        if (itemType !== 'weapon' && !this.isEquippableArmorOrAccessory(found))
            return;
        if (itemType !== 'weapon') {
            const requiredClass = String(found.requiredClass || '').trim();
            if (requiredClass) {
                const playerClass = this.normalizeClassId(player.class);
                if (this.normalizeClassId(requiredClass) !== playerClass) {
                    this.sendRaw(player.ws, {
                        type: 'system_message',
                        text: `Classe invalida para esse item. Classe: ${requiredClass}.`
                    });
                    return;
                }
            }
        }
        if (itemType !== 'weapon') {
            const equipSlot = String(found.slot || '');
            if (!EQUIPMENT_SLOTS.has(equipSlot))
                return;
            if (found.equipped === true && String(found.equippedSlot || '') === equipSlot) {
                found.equipped = false;
                found.equippedSlot = null;
                found.slotIndex = this.firstFreeInventorySlot(workingInventory, new Set([String(found.id)]));
                this.commitInventoryEquipTransaction(player, workingInventory, player.equippedWeaponId || null);
                return;
            }
            const equippedOnSameSlot = workingInventory.find((it) => it.id !== found.id
                && it.equipped === true
                && String(it.equippedSlot || '') === equipSlot);
            if (equippedOnSameSlot) {
                equippedOnSameSlot.equipped = false;
                equippedOnSameSlot.equippedSlot = null;
                equippedOnSameSlot.slotIndex = this.firstFreeInventorySlot(workingInventory, new Set([String(equippedOnSameSlot.id), String(found.id)]));
            }
            found.equipped = true;
            found.equippedSlot = equipSlot;
            found.slotIndex = -1;
            this.commitInventoryEquipTransaction(player, workingInventory, player.equippedWeaponId || null);
            return;
        }
        if (player.equippedWeaponId === found.id) {
            found.slotIndex = this.firstFreeInventorySlot(workingInventory, new Set([String(found.id)]));
            found.equipped = false;
            found.equippedSlot = null;
            this.commitInventoryEquipTransaction(player, workingInventory, null);
            return;
        }
        const previousEquippedId = player.equippedWeaponId && player.equippedWeaponId !== found.id ? player.equippedWeaponId : null;
        if (previousEquippedId) {
            const oldEquipped = workingInventory.find((it) => it.id === previousEquippedId && it.type === 'weapon');
            if (oldEquipped) {
                oldEquipped.equipped = false;
                oldEquipped.equippedSlot = null;
                oldEquipped.slotIndex = Number.isInteger(found.slotIndex) && found.slotIndex >= 0
                    ? found.slotIndex
                    : this.firstFreeInventorySlot(workingInventory, new Set([oldEquipped.id, found.id]));
            }
        }
        for (const entry of workingInventory) {
            if (String(entry?.type || '') === 'weapon') {
                entry.equipped = false;
                entry.equippedSlot = null;
            }
        }
        found.slotIndex = -1;
        found.equipped = true;
        found.equippedSlot = 'weapon';
        this.commitInventoryEquipTransaction(player, workingInventory, found.id);
    }
    handleInventoryMove(player, msg) {
        const itemId = String(msg.itemId || '');
        const toSlot = Number(msg.toSlot);
        if (!Number.isInteger(toSlot) || toSlot < 0 || toSlot >= config_1.INVENTORY_SIZE)
            return;
        if (player.equippedWeaponId && player.equippedWeaponId === itemId)
            return;
        const item = player.inventory.find((it) => it.id === itemId);
        if (!item)
            return;
        if (item.equipped === true)
            return;
        const occupant = player.inventory.find((it) => it.slotIndex === toSlot);
        const fromSlot = item.slotIndex;
        if (occupant && occupant.id !== item.id && this.canItemsStack(occupant, item)) {
            const max = Math.min(this.getItemMaxStack(occupant), this.getItemMaxStack(item));
            const occupantQty = Math.max(1, Math.floor(Number(occupant.quantity || 1)));
            const itemQty = Math.max(1, Math.floor(Number(item.quantity || 1)));
            const room = Math.max(0, max - occupantQty);
            if (room > 0) {
                const moved = Math.min(room, itemQty);
                occupant.quantity = occupantQty + moved;
                occupant.stackable = true;
                occupant.maxStack = max;
                const remaining = itemQty - moved;
                if (remaining <= 0) {
                    const idx = player.inventory.findIndex((it) => it.id === item.id);
                    if (idx !== -1)
                        player.inventory.splice(idx, 1);
                }
                else {
                    item.quantity = remaining;
                    item.stackable = true;
                    item.maxStack = max;
                    item.slotIndex = fromSlot;
                }
                player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
                this.persistPlayer(player);
                this.sendInventoryState(player);
                return;
            }
        }
        item.slotIndex = toSlot;
        if (occupant && occupant.id !== item.id)
            occupant.slotIndex = fromSlot;
        player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleInventorySort(player) {
        const equippedId = player.equippedWeaponId || null;
        const equippedArmorIds = new Set((Array.isArray(player.inventory) ? player.inventory : [])
            .filter((it) => it?.equipped === true)
            .map((it) => String(it.id || '')));
        const sorted = [...player.inventory]
            .filter((it) => it.id !== equippedId && !equippedArmorIds.has(String(it.id || '')))
            .sort((a, b) => {
            const byName = String(a.name || '').localeCompare(String(b.name || ''));
            if (byName !== 0)
                return byName;
            return String(a.id).localeCompare(String(b.id));
        });
        for (let i = 0; i < sorted.length && i < config_1.INVENTORY_SIZE; i++) {
            sorted[i].slotIndex = i;
        }
        if (equippedId) {
            const equipped = player.inventory.find((it) => it.id === equippedId);
            if (equipped)
                sorted.push({ ...equipped, slotIndex: -1 });
        }
        for (const eqId of equippedArmorIds) {
            const equipped = player.inventory.find((it) => String(it.id || '') === eqId);
            if (equipped)
                sorted.push({ ...equipped, slotIndex: -1 });
        }
        player.inventory = this.normalizeInventorySlots(sorted, player.equippedWeaponId);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleInventoryDelete(player, msg) {
        const itemId = String(msg.itemId || '');
        const slotIndex = Number(msg.slotIndex);
        const index = itemId
            ? player.inventory.findIndex((it) => String(it.id || '') === itemId)
            : (Number.isInteger(slotIndex) ? player.inventory.findIndex((it) => Number(it?.slotIndex) === slotIndex) : -1);
        if (index === -1)
            return;
        const item = player.inventory[index];
        if (!this.isItemDestroyable(item)) {
            this.sendRaw(player.ws, {
                type: 'system_message',
                text: 'Este item nao pode ser destruido.'
            });
            return;
        }
        if (player.equippedWeaponId === itemId) {
            player.equippedWeaponId = null;
            this.recomputePlayerStats(player);
        }
        if (player.inventory[index].equipped === true) {
            this.recomputePlayerStats(player);
        }
        player.inventory.splice(index, 1);
        player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleInventorySplit(player, msg) {
        const itemId = String(msg?.itemId || '');
        const slotIndex = Number(msg?.slotIndex);
        const splitQuantity = Math.max(1, Math.floor(Number(msg?.quantity || 0)));
        const index = itemId
            ? player.inventory.findIndex((it) => String(it?.id || '') === itemId)
            : (Number.isInteger(slotIndex) ? player.inventory.findIndex((it) => Number(it?.slotIndex) === slotIndex) : -1);
        if (index === -1)
            return;
        const source = player.inventory[index];
        if (!this.isStackableItem(source))
            return;
        const sourceQty = Math.max(1, Math.floor(Number(source.quantity || 1)));
        if (sourceQty <= 1)
            return;
        if (splitQuantity >= sourceQty)
            return;
        const freeSlot = this.firstFreeInventorySlot(player.inventory, new Set([String(source.id || '')]));
        if (freeSlot === -1) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Inventario cheio.' });
            return;
        }
        const nextInventory = Array.isArray(player.inventory) ? player.inventory.map((entry) => ({ ...entry })) : [];
        const nextSource = nextInventory[index];
        nextSource.quantity = sourceQty - splitQuantity;
        nextSource.stackable = true;
        nextSource.maxStack = GLOBAL_MAX_STACK;
        nextInventory.push({
            ...nextSource,
            id: (0, crypto_1.randomUUID)(),
            quantity: splitQuantity,
            slotIndex: freeSlot,
            equipped: false,
            equippedSlot: null,
            stackable: true,
            maxStack: GLOBAL_MAX_STACK
        });
        player.inventory = this.normalizeInventorySlots(nextInventory, player.equippedWeaponId);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    isItemDestroyable(item) {
        if (!item || typeof item !== 'object')
            return false;
        if (item.questItem === true)
            return false;
        if (item.locked === true)
            return false;
        if (item.noDelete === true || item.nonDestructible === true)
            return false;
        if (String(item.templateId || '').toLowerCase().startsWith('quest_'))
            return false;
        return true;
    }
    isItemSellable(item) {
        if (!item || typeof item !== 'object')
            return false;
        if (!this.isItemDestroyable(item))
            return false;
        if (item.noSell === true || item.nonSellable === true)
            return false;
        const typeKey = String(item.templateId || item.type || '');
        return Boolean(config_1.BUILTIN_ITEM_TEMPLATE_BY_ID[typeKey] || item.price);
    }
    handleInventoryUnequipToSlot(player, msg) {
        const itemId = String(msg.itemId || '');
        const toSlot = Number(msg.toSlot);
        if (!Number.isInteger(toSlot) || toSlot < 0 || toSlot >= config_1.INVENTORY_SIZE)
            return;
        const item = player.inventory.find((it) => it.id === itemId);
        if (!item)
            return;
        const isEquippedWeapon = player.equippedWeaponId === itemId;
        const isEquippedAccessory = item.equipped === true;
        if (!isEquippedWeapon && !isEquippedAccessory)
            return;
        const occupant = player.inventory.find((it) => it.slotIndex === toSlot && it.id !== itemId);
        const fromSlot = item.slotIndex;
        item.slotIndex = toSlot;
        if (occupant)
            occupant.slotIndex = fromSlot;
        if (isEquippedWeapon) {
            player.equippedWeaponId = null;
        }
        else {
            item.equipped = false;
            item.equippedSlot = null;
        }
        this.recomputePlayerStats(player);
        player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleItemUse(player, msg) {
        if (player.dead || player.hp <= 0)
            return;
        const itemId = String(msg?.itemId || '');
        if (!itemId)
            return;
        const index = player.inventory.findIndex((it) => String(it?.id || '') === itemId);
        if (index === -1)
            return;
        const item = player.inventory[index];
        const itemType = String(item?.type || '');
        if (itemType !== 'potion_hp' && itemType !== 'skill_reset_hourglass')
            return;
        let returnedPoints = 0;
        if (itemType === 'potion_hp') {
            const healPercent = Number.isFinite(Number(item?.healPercent)) ? Number(item.healPercent) : Number(config_1.HP_POTION_TEMPLATE.healPercent || 0.5);
            const amount = Math.max(1, Math.floor(Number(player.maxHp || 1) * Math.max(0, healPercent)));
            player.hp = (0, math_1.clamp)(Number(player.hp || 0) + amount, 1, Number(player.maxHp || 1));
        }
        else {
            returnedPoints = this.getSpentSkillPoints(player);
            player.skillLevels = {};
            if (!player.statusOverrides || typeof player.statusOverrides !== 'object')
                player.statusOverrides = {};
            player.statusOverrides.__skillLevels = {};
            player.skillCooldowns = {};
            player.activeSkillEffects = [];
            this.recomputePlayerStats(player);
        }
        const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
        if (quantity > 1) {
            item.quantity = quantity - 1;
        }
        else {
            player.inventory.splice(index, 1);
        }
        player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
        this.persistPlayer(player);
        this.sendInventoryState(player);
        this.sendStatsUpdated(player);
        if (itemType === 'skill_reset_hourglass') {
            this.sendRaw(player.ws, {
                type: 'system_message',
                text: `Ampulheta usada: habilidades resetadas e ${returnedPoints} ponto(s) devolvido(s).`
            });
        }
    }
    normalizeInventorySlots(items, equippedWeaponId = null) {
        const out = [];
        const used = new Set();
        for (const item of items) {
            const clone = this.enrichItemVisuals({ ...item });
            if (clone.id === equippedWeaponId) {
                clone.slotIndex = -1;
                clone.equipped = true;
                clone.equippedSlot = 'weapon';
                out.push(clone);
                continue;
            }
            const armorEquipped = clone.equipped === true && EQUIPMENT_SLOTS.has(String(clone.equippedSlot || clone.slot || ''));
            if (armorEquipped) {
                clone.slotIndex = -1;
                clone.equipped = true;
                clone.equippedSlot = String(clone.equippedSlot || clone.slot || '');
                out.push(clone);
                continue;
            }
            clone.equipped = false;
            clone.equippedSlot = null;
            if (!Number.isInteger(clone.slotIndex) || clone.slotIndex < 0 || clone.slotIndex >= config_1.INVENTORY_SIZE || used.has(clone.slotIndex)) {
                clone.slotIndex = this.firstFreeInventorySlot(out.filter((it) => it.id !== equippedWeaponId));
            }
            if (Number.isInteger(clone.slotIndex) && clone.slotIndex >= 0)
                used.add(clone.slotIndex);
            out.push(clone);
        }
        return out;
    }
    addItemToInventory(player, item, quantity) {
        let remaining = Math.max(0, Math.floor(Number(quantity || 0)));
        if (remaining <= 0)
            return 0;
        if (!this.isStackableItem(item)) {
            while (remaining > 0) {
                const freeSlot = this.firstFreeInventorySlot(player.inventory);
                if (freeSlot === -1)
                    break;
                player.inventory.push({ ...item, id: (0, crypto_1.randomUUID)(), quantity: 1, slotIndex: freeSlot });
                remaining -= 1;
            }
            return remaining;
        }
        const max = this.getItemMaxStack(item);
        for (const existing of player.inventory) {
            if (remaining <= 0)
                break;
            if (!this.canItemsStack(existing, item))
                continue;
            const current = Math.max(1, Math.floor(Number(existing.quantity || 1)));
            if (current >= max)
                continue;
            const add = Math.min(max - current, remaining);
            existing.quantity = current + add;
            existing.maxStack = GLOBAL_MAX_STACK;
            existing.stackable = true;
            remaining -= add;
        }
        while (remaining > 0) {
            const freeSlot = this.firstFreeInventorySlot(player.inventory);
            if (freeSlot === -1)
                break;
            const add = Math.min(max, remaining);
            player.inventory.push({
                ...item,
                id: (0, crypto_1.randomUUID)(),
                quantity: add,
                stackable: true,
                maxStack: GLOBAL_MAX_STACK,
                slotIndex: freeSlot
            });
            remaining -= add;
        }
        return remaining;
    }
    isStackableItem(item) {
        return Boolean(item?.stackable) || Number(item?.maxStack || 1) > 1;
    }
    getItemMaxStack(item) {
        if (!this.isStackableItem(item))
            return 1;
        return GLOBAL_MAX_STACK;
    }
    canItemsStack(a, b) {
        if (!a || !b)
            return false;
        if (!this.isStackableItem(a) || !this.isStackableItem(b))
            return false;
        const at = String(a.templateId || a.type || '');
        const bt = String(b.templateId || b.type || '');
        return at.length > 0 && at === bt;
    }
    isEquippableArmorOrAccessory(item) {
        if (!item || typeof item !== 'object')
            return false;
        const slot = String(item.slot || '');
        if (!EQUIPMENT_SLOTS.has(slot))
            return false;
        return String(item.type || '') === 'equipment';
    }
}
exports.InventoryService = InventoryService;
//# sourceMappingURL=InventoryService.js.map