"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const crypto_1 = require("crypto");
const config_1 = require("../config");
const math_1 = require("../utils/math");
const EQUIPMENT_SLOTS = new Set(['helmet', 'chest', 'pants', 'gloves', 'boots', 'ring', 'necklace']);
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
    }
    handleEquipItem(player, msg) {
        const itemId = msg.itemId ? String(msg.itemId) : null;
        if (!itemId) {
            const equipped = player.equippedWeaponId
                ? player.inventory.find((it) => it.id === player.equippedWeaponId && it.type === 'weapon')
                : null;
            if (equipped && (!Number.isInteger(equipped.slotIndex) || equipped.slotIndex < 0)) {
                equipped.slotIndex = this.firstFreeInventorySlot(player.inventory, new Set([equipped.id]));
            }
            player.equippedWeaponId = null;
            player.inventory = this.normalizeInventorySlots(player.inventory, null);
            this.recomputePlayerStats(player);
            this.persistPlayer(player);
            this.sendInventoryState(player);
            return;
        }
        const found = player.inventory.find((it) => it.id === itemId);
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
                found.slotIndex = this.firstFreeInventorySlot(player.inventory, new Set([String(found.id)]));
                player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
                this.recomputePlayerStats(player);
                this.persistPlayer(player);
                this.sendInventoryState(player);
                return;
            }
            const equippedOnSameSlot = player.inventory.find((it) => it.id !== found.id
                && it.equipped === true
                && String(it.equippedSlot || '') === equipSlot);
            if (equippedOnSameSlot) {
                equippedOnSameSlot.equipped = false;
                equippedOnSameSlot.equippedSlot = null;
                equippedOnSameSlot.slotIndex = this.firstFreeInventorySlot(player.inventory, new Set([String(equippedOnSameSlot.id), String(found.id)]));
            }
            found.equipped = true;
            found.equippedSlot = equipSlot;
            found.slotIndex = -1;
            player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
            this.recomputePlayerStats(player);
            this.persistPlayer(player);
            this.sendInventoryState(player);
            return;
        }
        if (player.equippedWeaponId === found.id) {
            found.slotIndex = this.firstFreeInventorySlot(player.inventory, new Set([String(found.id)]));
            player.equippedWeaponId = null;
            player.inventory = this.normalizeInventorySlots(player.inventory, null);
            this.recomputePlayerStats(player);
            this.persistPlayer(player);
            this.sendInventoryState(player);
            return;
        }
        const previousEquippedId = player.equippedWeaponId && player.equippedWeaponId !== found.id ? player.equippedWeaponId : null;
        if (previousEquippedId) {
            const oldEquipped = player.inventory.find((it) => it.id === previousEquippedId && it.type === 'weapon');
            if (oldEquipped) {
                oldEquipped.slotIndex = Number.isInteger(found.slotIndex) && found.slotIndex >= 0
                    ? found.slotIndex
                    : this.firstFreeInventorySlot(player.inventory, new Set([oldEquipped.id, found.id]));
            }
        }
        found.slotIndex = -1;
        player.equippedWeaponId = found.id;
        player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
        this.recomputePlayerStats(player);
        this.persistPlayer(player);
        this.sendInventoryState(player);
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
        const index = player.inventory.findIndex((it) => it.id === itemId);
        if (index === -1)
            return;
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
            const clone = { ...item };
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
            existing.maxStack = max;
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
                maxStack: max,
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
        const max = Number(item?.maxStack || 1);
        return Number.isInteger(max) && max > 1 ? max : 1;
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