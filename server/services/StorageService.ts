import { PlayerRuntime } from '../models/types';
import { NPC_BY_ID } from '../content/npcs';
import { distance } from '../utils/math';

type SendRawFn = (ws: any, payload: any) => void;
type PersistPlayerFn = (player: PlayerRuntime) => void;
type SendInventoryStateFn = (player: PlayerRuntime) => void;
type NormalizeInventorySlotsFn = (items: any[], equippedWeaponId: string | null) => any[];
type AddItemToInventoryFn = (player: PlayerRuntime, item: any, quantity: number) => number;

const STORAGE_CAPACITY = 36;

export class StorageService {
    private readonly openStorageNpcByPlayerId = new Map<number, string>();

    constructor(
        private readonly sendRaw: SendRawFn,
        private readonly persistPlayer: PersistPlayerFn,
        private readonly sendInventoryState: SendInventoryStateFn,
        private readonly normalizeInventorySlots: NormalizeInventorySlotsFn,
        private readonly addItemToInventory: AddItemToInventoryFn
    ) {}

    handleOpenStorage(player: PlayerRuntime, npcId?: string) {
        const safeNpcId = String(npcId || '');
        const npc = NPC_BY_ID[safeNpcId];
        if (!npc || npc.role !== 'chest_keeper') {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Bau nao encontrado.' });
            return;
        }
        if (String(npc.mapKey || '') !== String(player.mapKey || '') || String(npc.mapId || '') !== String(player.mapId || '')) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Esse bau nao esta neste mapa.' });
            return;
        }
        const range = Math.max(80, Number(npc.interactRange || 170));
        if (distance(player, npc as any) > range) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Aproxime-se do bau para acessa-lo.' });
            return;
        }
        this.openStorageNpcByPlayerId.set(player.id, safeNpcId);
        this.sendState(player);
    }

    handleCloseStorage(player: PlayerRuntime) {
        this.openStorageNpcByPlayerId.delete(player.id);
        this.sendState(player);
    }

    handleDeposit(player: PlayerRuntime, msg: any) {
        if (!this.isOpenFor(player)) return;
        const itemId = String(msg?.itemId || '');
        const quantity = Math.max(1, Math.floor(Number(msg?.quantity || 1)));
        const itemIndex = Array.isArray(player.inventory)
            ? player.inventory.findIndex((entry: any) => String(entry?.id || '') === itemId)
            : -1;
        if (itemIndex === -1) return;
        const item = player.inventory[itemIndex];
        if (String(player.equippedWeaponId || '') === itemId || item?.equipped === true) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Remova o item equipado antes de guarda-lo.' });
            return;
        }

        const storage = this.getStorageItems(player);
        const movedQuantity = this.isStackableItem(item)
            ? Math.min(quantity, Math.max(1, Math.floor(Number(item.quantity || 1))))
            : 1;
        const transferItem = {
            ...item,
            quantity: movedQuantity,
            equipped: false,
            equippedSlot: null,
            slotIndex: -1
        };
        const nextStorage = storage.map((entry: any) => ({ ...entry }));
        const receiverProxy = { ...player, inventory: nextStorage, equippedWeaponId: null } as PlayerRuntime;
        const remaining = this.addItemToInventory(receiverProxy, transferItem, movedQuantity);
        if (remaining > 0) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Seu bau esta cheio.' });
            return;
        }

        const available = Math.max(1, Math.floor(Number(item.quantity || 1)));
        if (this.isStackableItem(item) && available > movedQuantity) {
            player.inventory[itemIndex] = { ...item, quantity: available - movedQuantity };
        } else {
            player.inventory.splice(itemIndex, 1);
        }

        player.inventory = this.normalizeInventorySlots(player.inventory, player.equippedWeaponId || null);
        this.setStorageItems(player, receiverProxy.inventory);
        this.persistPlayer(player);
        this.sendInventoryState(player);
        this.sendState(player);
    }

    handleWithdraw(player: PlayerRuntime, msg: any) {
        if (!this.isOpenFor(player)) return;
        const itemId = String(msg?.itemId || '');
        const quantity = Math.max(1, Math.floor(Number(msg?.quantity || 1)));
        const storage = this.getStorageItems(player);
        const index = storage.findIndex((entry: any) => String(entry?.id || '') === itemId);
        if (index === -1) return;

        const item = storage[index];
        const movedQuantity = this.isStackableItem(item)
            ? Math.min(quantity, Math.max(1, Math.floor(Number(item.quantity || 1))))
            : 1;
        const transferItem = {
            ...item,
            quantity: movedQuantity,
            equipped: false,
            equippedSlot: null,
            slotIndex: -1
        };
        const inventoryProxy = {
            ...player,
            inventory: Array.isArray(player.inventory) ? player.inventory.map((entry: any) => ({ ...entry })) : [],
            equippedWeaponId: player.equippedWeaponId || null
        } as PlayerRuntime;
        const remaining = this.addItemToInventory(inventoryProxy, transferItem, movedQuantity);
        if (remaining > 0) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Inventario cheio.' });
            return;
        }

        if (this.isStackableItem(item) && Number(item.quantity || 1) > movedQuantity) {
            storage[index] = { ...item, quantity: Number(item.quantity || 1) - movedQuantity };
        } else {
            storage.splice(index, 1);
        }

        player.inventory = this.normalizeInventorySlots(inventoryProxy.inventory, player.equippedWeaponId || null);
        this.setStorageItems(player, storage);
        this.persistPlayer(player);
        this.sendInventoryState(player);
        this.sendState(player);
    }

    clearForPlayer(playerId: number) {
        this.openStorageNpcByPlayerId.delete(playerId);
    }

    sendState(player: PlayerRuntime) {
        const npcId = this.openStorageNpcByPlayerId.get(player.id) || null;
        const npc = npcId ? NPC_BY_ID[npcId] || null : null;
        this.sendRaw(player.ws, {
            type: 'storage.state',
            open: Boolean(npc),
            npc: npc ? { id: npc.id, name: npc.name, greeting: npc.greeting } : null,
            capacity: STORAGE_CAPACITY,
            items: this.getStorageItems(player)
        });
    }

    private isOpenFor(player: PlayerRuntime) {
        return this.openStorageNpcByPlayerId.has(player.id);
    }

    private getStorageItems(player: PlayerRuntime) {
        const raw = player.statusOverrides && typeof player.statusOverrides === 'object'
            ? player.statusOverrides.__personalStorage
            : [];
        const items = Array.isArray(raw) ? raw.map((entry: any) => ({
            ...entry,
            equipped: false,
            equippedSlot: null
        })) : [];
        return this.normalizeInventorySlots(items, null)
            .filter((entry: any) => Number(entry?.slotIndex) >= 0)
            .slice(0, STORAGE_CAPACITY);
    }

    private setStorageItems(player: PlayerRuntime, items: any[]) {
        if (!player.statusOverrides || typeof player.statusOverrides !== 'object') player.statusOverrides = {};
        player.statusOverrides.__personalStorage = this.normalizeInventorySlots(items, null)
            .filter((entry: any) => Number(entry?.slotIndex) >= 0)
            .slice(0, STORAGE_CAPACITY);
    }

    private isStackableItem(item: any) {
        return Boolean(item?.stackable) || Number(item?.maxStack || 1) > 1;
    }
}
