import { randomUUID } from 'crypto';
import { PlayerRuntime } from '../models/types';
import { distance } from '../utils/math';
import { normalizeWallet, walletFromCopper, walletToCopper } from '../utils/currency';

type SendRawFn = (ws: any, payload: any) => void;
type PersistPlayerCriticalFn = (player: PlayerRuntime, reason?: string) => void;
type SendInventoryStateFn = (player: PlayerRuntime) => void;
type SendStatsUpdatedFn = (player: PlayerRuntime) => void;
type NormalizeInventorySlotsFn = (items: any[], equippedWeaponId: string | null) => any[];
type AddItemToInventoryFn = (player: PlayerRuntime, item: any, quantity: number) => number;

type TradeOfferEntry = {
    itemId: string;
    quantity: number;
    snapshot: any;
};

type TradeRequest = {
    id: string;
    fromPlayerId: number;
    toPlayerId: number;
    createdAt: number;
    expiresAt: number;
};

type TradeSession = {
    id: string;
    playerAId: number;
    playerBId: number;
    offers: Record<number, {
        items: TradeOfferEntry[];
        copper: number;
    }>;
    lockedBy: Set<number>;
    confirmedBy: Set<number>;
    updatedAt: number;
};

const TRADE_REQUEST_TTL_MS = 30_000;
const TRADE_INTERACT_RANGE = 240;

export class TradeService {
    private readonly requests = new Map<string, TradeRequest>();
    private readonly sessionByPlayerId = new Map<number, TradeSession>();

    constructor(
        private readonly players: Map<number, PlayerRuntime>,
        private readonly sendRaw: SendRawFn,
        private readonly persistPlayerCritical: PersistPlayerCriticalFn,
        private readonly sendInventoryState: SendInventoryStateFn,
        private readonly sendStatsUpdated: SendStatsUpdatedFn,
        private readonly normalizeInventorySlots: NormalizeInventorySlotsFn,
        private readonly addItemToInventory: AddItemToInventoryFn
    ) {}

    handleTradeRequest(player: PlayerRuntime, msg: any) {
        const target = this.resolveTarget(player, msg);
        if (!target) {
            this.sendSystem(player, 'Jogador nao encontrado para troca.');
            return;
        }
        if (target.id === player.id) {
            this.sendSystem(player, 'Voce nao pode trocar consigo mesmo.');
            return;
        }
        if (this.hasPendingOrActiveState(player.id) || this.hasPendingOrActiveState(target.id)) {
            this.sendSystem(player, 'Um dos jogadores ja esta ocupado com outra troca.');
            return;
        }
        const interactionError = this.getInteractionError(player, target);
        if (interactionError) {
            this.sendSystem(player, interactionError);
            return;
        }

        const request: TradeRequest = {
            id: randomUUID(),
            fromPlayerId: player.id,
            toPlayerId: target.id,
            createdAt: Date.now(),
            expiresAt: Date.now() + TRADE_REQUEST_TTL_MS
        };
        this.requests.set(request.id, request);
        this.sendSystem(player, `Pedido de troca enviado para ${target.name}.`);
        this.sendSystem(target, `${player.name} quer trocar com voce.`);
        this.sendState(player);
        this.sendState(target);
    }

    handleTradeRespond(player: PlayerRuntime, msg: any) {
        const requestId = String(msg?.requestId || '');
        const accept = Boolean(msg?.accept);
        const request = this.requests.get(requestId);
        if (!request || request.toPlayerId !== player.id) return;
        this.requests.delete(requestId);
        const fromPlayer = this.players.get(request.fromPlayerId) || null;
        if (!fromPlayer) {
            this.sendSystem(player, 'O jogador que iniciou a troca desconectou.');
            this.sendState(player);
            return;
        }
        if (!accept) {
            this.sendSystem(player, 'Pedido de troca recusado.');
            this.sendSystem(fromPlayer, `${player.name} recusou a troca.`);
            this.sendState(player);
            this.sendState(fromPlayer);
            return;
        }
        if (this.hasActiveSession(player.id) || this.hasActiveSession(fromPlayer.id)) {
            this.sendSystem(player, 'A troca nao pode ser iniciada agora.');
            this.sendSystem(fromPlayer, 'A troca nao pode ser iniciada agora.');
            this.sendState(player);
            this.sendState(fromPlayer);
            return;
        }
        const interactionError = this.getInteractionError(player, fromPlayer);
        if (interactionError) {
            this.sendSystem(player, interactionError);
            this.sendSystem(fromPlayer, interactionError);
            this.sendState(player);
            this.sendState(fromPlayer);
            return;
        }
        const session: TradeSession = {
            id: randomUUID(),
            playerAId: fromPlayer.id,
            playerBId: player.id,
            offers: {
                [fromPlayer.id]: { items: [], copper: 0 },
                [player.id]: { items: [], copper: 0 }
            },
            lockedBy: new Set(),
            confirmedBy: new Set(),
            updatedAt: Date.now()
        };
        this.sessionByPlayerId.set(fromPlayer.id, session);
        this.sessionByPlayerId.set(player.id, session);
        this.sendSystem(player, `Troca iniciada com ${fromPlayer.name}.`);
        this.sendSystem(fromPlayer, `Troca iniciada com ${player.name}.`);
        this.syncSession(session);
    }

    handleTradeSetItem(player: PlayerRuntime, msg: any) {
        const session = this.getSession(player.id);
        if (!session) return;
        const itemId = String(msg?.itemId || '');
        const quantity = Math.max(1, Math.floor(Number(msg?.quantity || 1)));
        const item = Array.isArray(player.inventory)
            ? player.inventory.find((entry: any) => String(entry?.id || '') === itemId)
            : null;
        if (!item) {
            this.sendSystem(player, 'Item nao encontrado para oferta.');
            return;
        }
        const tradeableError = this.getTradeableItemError(item, player);
        if (tradeableError) {
            this.sendSystem(player, tradeableError);
            return;
        }
        const maxAvailable = Math.max(1, Math.floor(Number(item.quantity || 1)));
        const safeQuantity = this.isStackableItem(item)
            ? Math.min(quantity, maxAvailable)
            : 1;
        const offer = session.offers[player.id];
        const existingIndex = offer.items.findIndex((entry) => entry.itemId === itemId);
        const entry: TradeOfferEntry = {
            itemId,
            quantity: safeQuantity,
            snapshot: this.buildItemPreview(item, safeQuantity)
        };
        if (existingIndex >= 0) offer.items[existingIndex] = entry;
        else offer.items.push(entry);
        this.resetLocks(session);
        this.syncSession(session);
    }

    handleTradeRemoveItem(player: PlayerRuntime, msg: any) {
        const session = this.getSession(player.id);
        if (!session) return;
        const itemId = String(msg?.itemId || '');
        session.offers[player.id].items = session.offers[player.id].items.filter((entry) => entry.itemId !== itemId);
        this.resetLocks(session);
        this.syncSession(session);
    }

    handleTradeSetCurrency(player: PlayerRuntime, msg: any) {
        const session = this.getSession(player.id);
        if (!session) return;
        const wallet = normalizeWallet(msg?.wallet || {});
        const offeredCopper = walletToCopper(wallet);
        const availableCopper = walletToCopper(normalizeWallet(player.wallet));
        if (offeredCopper > availableCopper) {
            this.sendSystem(player, 'Saldo insuficiente para essa oferta.');
            return;
        }
        session.offers[player.id].copper = offeredCopper;
        this.resetLocks(session);
        this.syncSession(session);
    }

    handleTradeLock(player: PlayerRuntime) {
        const session = this.getSession(player.id);
        if (!session) return;
        session.lockedBy.add(player.id);
        session.confirmedBy.delete(player.id);
        this.syncSession(session);
    }

    handleTradeConfirm(player: PlayerRuntime) {
        const session = this.getSession(player.id);
        if (!session) return;
        const partner = this.getPartner(session, player.id);
        if (!partner) {
            this.cancelSession(session, 'Troca encerrada.');
            return;
        }
        const interactionError = this.getInteractionError(player, partner);
        if (interactionError) {
            this.cancelSession(session, interactionError);
            return;
        }
        if (!session.lockedBy.has(player.id) || !session.lockedBy.has(partner.id)) {
            this.sendSystem(player, 'Ambos os jogadores precisam travar a troca antes de confirmar.');
            return;
        }
        session.confirmedBy.add(player.id);
        if (session.confirmedBy.has(player.id) && session.confirmedBy.has(partner.id)) {
            const result = this.finalizeSession(session);
            if (!result.ok) {
                this.cancelSession(session, result.message || 'Nao foi possivel concluir a troca.');
                return;
            }
            this.endSession(session);
            this.sendSystem(player, 'Troca concluida com sucesso.');
            this.sendSystem(partner, 'Troca concluida com sucesso.');
            this.sendInventoryState(player);
            this.sendInventoryState(partner);
            this.sendStatsUpdated(player);
            this.sendStatsUpdated(partner);
            this.persistPlayerCritical(player, 'trade_confirm');
            this.persistPlayerCritical(partner, 'trade_confirm');
            this.sendState(player);
            this.sendState(partner);
            return;
        }
        this.syncSession(session);
    }

    handleTradeCancel(player: PlayerRuntime) {
        const session = this.getSession(player.id);
        if (session) {
            this.cancelSession(session, `${player.name} cancelou a troca.`, player.id);
            return;
        }
        for (const [requestId, request] of this.requests.entries()) {
            if (request.fromPlayerId !== player.id && request.toPlayerId !== player.id) continue;
            this.requests.delete(requestId);
            const other = this.players.get(request.fromPlayerId === player.id ? request.toPlayerId : request.fromPlayerId) || null;
            this.sendSystem(player, 'Pedido de troca cancelado.');
            if (other) {
                this.sendSystem(other, 'Pedido de troca cancelado.');
                this.sendState(other);
            }
            this.sendState(player);
            return;
        }
    }

    pruneExpiredRequests(now: number) {
        for (const [requestId, request] of this.requests.entries()) {
            if (request.expiresAt > now) continue;
            this.requests.delete(requestId);
            const fromPlayer = this.players.get(request.fromPlayerId) || null;
            const toPlayer = this.players.get(request.toPlayerId) || null;
            if (fromPlayer) {
                this.sendSystem(fromPlayer, 'Pedido de troca expirou.');
                this.sendState(fromPlayer);
            }
            if (toPlayer) this.sendState(toPlayer);
        }
    }

    clearStateForPlayer(playerId: number, reason: string = 'Troca encerrada.') {
        for (const [requestId, request] of this.requests.entries()) {
            if (request.fromPlayerId !== playerId && request.toPlayerId !== playerId) continue;
            this.requests.delete(requestId);
            const other = this.players.get(request.fromPlayerId === playerId ? request.toPlayerId : request.fromPlayerId) || null;
            if (other) {
                this.sendSystem(other, reason);
                this.sendState(other);
            }
        }
        const session = this.getSession(playerId);
        if (session) this.cancelSession(session, reason, playerId);
    }

    sendState(player: PlayerRuntime) {
        this.sendRaw(player.ws, this.buildStatePayload(player));
    }

    private buildStatePayload(player: PlayerRuntime) {
        const incomingRequest = [...this.requests.values()].find((request) => request.toPlayerId === player.id) || null;
        const outgoingRequest = [...this.requests.values()].find((request) => request.fromPlayerId === player.id) || null;
        const session = this.getSession(player.id);
        return {
            type: 'trade.state',
            incomingRequest: incomingRequest ? this.serializeRequest(incomingRequest, true) : null,
            outgoingRequest: outgoingRequest ? this.serializeRequest(outgoingRequest, false) : null,
            session: session ? this.serializeSessionFor(player, session) : null
        };
    }

    private serializeRequest(request: TradeRequest, incoming: boolean) {
        const fromPlayer = this.players.get(request.fromPlayerId) || null;
        const toPlayer = this.players.get(request.toPlayerId) || null;
        return {
            requestId: request.id,
            fromPlayerId: request.fromPlayerId,
            fromName: fromPlayer?.name || `#${request.fromPlayerId}`,
            toPlayerId: request.toPlayerId,
            toName: toPlayer?.name || `#${request.toPlayerId}`,
            incoming,
            expiresAt: request.expiresAt
        };
    }

    private serializeSessionFor(player: PlayerRuntime, session: TradeSession) {
        const partner = this.getPartner(session, player.id);
        const ownOffer = session.offers[player.id] || { items: [], copper: 0 };
        const partnerOffer = partner ? (session.offers[partner.id] || { items: [], copper: 0 }) : { items: [], copper: 0 };
        return {
            sessionId: session.id,
            partner: partner ? {
                playerId: partner.id,
                name: partner.name,
                level: partner.level,
                class: partner.class
            } : null,
            self: {
                locked: session.lockedBy.has(player.id),
                confirmed: session.confirmedBy.has(player.id),
                wallet: walletFromCopper(ownOffer.copper),
                items: ownOffer.items.map((entry) => ({
                    itemId: entry.itemId,
                    quantity: entry.quantity,
                    item: { ...entry.snapshot, quantity: entry.quantity }
                }))
            },
            other: {
                locked: partner ? session.lockedBy.has(partner.id) : false,
                confirmed: partner ? session.confirmedBy.has(partner.id) : false,
                wallet: walletFromCopper(partnerOffer.copper),
                items: partnerOffer.items.map((entry) => ({
                    itemId: entry.itemId,
                    quantity: entry.quantity,
                    item: { ...entry.snapshot, quantity: entry.quantity }
                }))
            }
        };
    }

    private syncSession(session: TradeSession) {
        const a = this.players.get(session.playerAId) || null;
        const b = this.players.get(session.playerBId) || null;
        if (a) this.sendState(a);
        if (b) this.sendState(b);
    }

    private finalizeSession(session: TradeSession): { ok: boolean; message?: string } {
        const playerA = this.players.get(session.playerAId) || null;
        const playerB = this.players.get(session.playerBId) || null;
        if (!playerA || !playerB) return { ok: false, message: 'Um dos jogadores desconectou.' };

        const aOffer = session.offers[playerA.id] || { items: [], copper: 0 };
        const bOffer = session.offers[playerB.id] || { items: [], copper: 0 };
        const aCopperAvailable = walletToCopper(normalizeWallet(playerA.wallet));
        const bCopperAvailable = walletToCopper(normalizeWallet(playerB.wallet));
        if (aOffer.copper > aCopperAvailable || bOffer.copper > bCopperAvailable) {
            return { ok: false, message: 'Um dos jogadores nao possui mais a moeda ofertada.' };
        }

        const nextAInventory = Array.isArray(playerA.inventory) ? playerA.inventory.map((item: any) => ({ ...item })) : [];
        const nextBInventory = Array.isArray(playerB.inventory) ? playerB.inventory.map((item: any) => ({ ...item })) : [];

        const extractedA = this.extractOfferedItems(playerA, nextAInventory, aOffer.items);
        if (!extractedA.ok) return extractedA;
        const extractedATransfers = extractedA.transfers || [];
        const extractedB = this.extractOfferedItems(playerB, nextBInventory, bOffer.items);
        if (!extractedB.ok) return extractedB;
        const extractedBTransfers = extractedB.transfers || [];

        const nextAWalletCopper = aCopperAvailable - aOffer.copper + bOffer.copper;
        const nextBWalletCopper = bCopperAvailable - bOffer.copper + aOffer.copper;

        const aReceiverProxy = { ...playerA, inventory: nextAInventory, equippedWeaponId: playerA.equippedWeaponId || null } as PlayerRuntime;
        for (const transfer of extractedBTransfers) {
            const remaining = this.addItemToInventory(aReceiverProxy, transfer.item, transfer.quantity);
            if (remaining > 0) return { ok: false, message: `${playerA.name} nao possui espaco suficiente para receber a troca.` };
        }

        const bReceiverProxy = { ...playerB, inventory: nextBInventory, equippedWeaponId: playerB.equippedWeaponId || null } as PlayerRuntime;
        for (const transfer of extractedATransfers) {
            const remaining = this.addItemToInventory(bReceiverProxy, transfer.item, transfer.quantity);
            if (remaining > 0) return { ok: false, message: `${playerB.name} nao possui espaco suficiente para receber a troca.` };
        }

        playerA.inventory = this.normalizeInventorySlots(aReceiverProxy.inventory, playerA.equippedWeaponId || null);
        playerB.inventory = this.normalizeInventorySlots(bReceiverProxy.inventory, playerB.equippedWeaponId || null);
        playerA.wallet = walletFromCopper(nextAWalletCopper);
        playerB.wallet = walletFromCopper(nextBWalletCopper);
        return { ok: true };
    }

    private extractOfferedItems(player: PlayerRuntime, nextInventory: any[], offers: TradeOfferEntry[]) {
        const transfers: Array<{ item: any; quantity: number }> = [];
        for (const offer of offers) {
            const index = nextInventory.findIndex((entry: any) => String(entry?.id || '') === String(offer.itemId || ''));
            if (index === -1) return { ok: false, message: `${player.name} nao possui mais um dos itens ofertados.` };
            const liveItem = nextInventory[index];
            const tradeableError = this.getTradeableItemError(liveItem, player);
            if (tradeableError) return { ok: false, message: tradeableError };
            const available = Math.max(1, Math.floor(Number(liveItem.quantity || 1)));
            const requestedRaw = Math.max(1, Math.floor(Number(offer.quantity || 1)));
            const requested = this.isStackableItem(liveItem) ? requestedRaw : 1;
            if (requested > available) {
                return { ok: false, message: `${player.name} nao possui quantidade suficiente de um item ofertado.` };
            }
            const transferItem = {
                ...liveItem,
                quantity: requested,
                equipped: false,
                equippedSlot: null,
                slotIndex: -1
            };
            if (this.isStackableItem(liveItem) && available > requested) {
                nextInventory[index] = { ...liveItem, quantity: available - requested };
            } else {
                nextInventory.splice(index, 1);
            }
            transfers.push({ item: transferItem, quantity: requested });
        }
        return { ok: true, transfers };
    }

    private cancelSession(session: TradeSession, message: string, actorPlayerId?: number) {
        const playerA = this.players.get(session.playerAId) || null;
        const playerB = this.players.get(session.playerBId) || null;
        this.endSession(session);
        if (playerA) {
            if (actorPlayerId !== playerA.id || playerB) this.sendSystem(playerA, message);
            this.sendState(playerA);
        }
        if (playerB) {
            if (actorPlayerId !== playerB.id || playerA) this.sendSystem(playerB, message);
            this.sendState(playerB);
        }
    }

    private endSession(session: TradeSession) {
        this.sessionByPlayerId.delete(session.playerAId);
        this.sessionByPlayerId.delete(session.playerBId);
    }

    private resetLocks(session: TradeSession) {
        session.lockedBy.clear();
        session.confirmedBy.clear();
        session.updatedAt = Date.now();
    }

    private hasPendingOrActiveState(playerId: number) {
        return this.hasActiveSession(playerId)
            || [...this.requests.values()].some((request) => request.fromPlayerId === playerId || request.toPlayerId === playerId);
    }

    private hasActiveSession(playerId: number) {
        return this.sessionByPlayerId.has(playerId);
    }

    private getSession(playerId: number) {
        return this.sessionByPlayerId.get(playerId) || null;
    }

    private getPartner(session: TradeSession, playerId: number) {
        const partnerId = session.playerAId === playerId ? session.playerBId : session.playerAId;
        return this.players.get(partnerId) || null;
    }

    private resolveTarget(player: PlayerRuntime, msg: any) {
        const targetPlayerId = Number(msg?.targetPlayerId || 0);
        if (Number.isInteger(targetPlayerId) && targetPlayerId > 0) return this.players.get(targetPlayerId) || null;
        const targetName = String(msg?.targetName || '').trim().toLowerCase();
        if (!targetName) return null;
        return [...this.players.values()].find((candidate) => String(candidate.name || '').trim().toLowerCase() === targetName) || null;
    }

    private getInteractionError(player: PlayerRuntime, target: PlayerRuntime) {
        if (player.dead || target.dead || Number(player.hp || 0) <= 0 || Number(target.hp || 0) <= 0) {
            return 'A troca exige os dois jogadores vivos.';
        }
        if (String(player.mapKey || '') !== String(target.mapKey || '') || String(player.mapId || '') !== String(target.mapId || '')) {
            return 'Os jogadores precisam estar no mesmo mapa para trocar.';
        }
        if (distance(player, target) > TRADE_INTERACT_RANGE) {
            return 'Aproxime-se do jogador para trocar.';
        }
        return '';
    }

    private getTradeableItemError(item: any, player: PlayerRuntime) {
        if (!item || typeof item !== 'object') return 'Item invalido para troca.';
        const itemId = String(item.id || '');
        if (String(player.equippedWeaponId || '') === itemId || item.equipped === true) {
            return 'Remova o item equipado antes de oferta-lo na troca.';
        }
        if (item.locked === true || item.questItem === true) return 'Esse item nao pode ser trocado.';
        if (item.noTrade === true || item.nonTradable === true || item.tradable === false) return 'Esse item esta vinculado e nao pode ser trocado.';
        if (item.bound === true || item.bindOnPickup === true || item.bindOnEquip === true) return 'Esse item esta vinculado e nao pode ser trocado.';
        if (String(item.bindingType || 'unbound').toLowerCase() !== 'unbound') return 'Esse item esta vinculado e nao pode ser trocado.';
        return '';
    }

    private isStackableItem(item: any) {
        return Boolean(item?.stackable) || Number(item?.maxStack || 1) > 1;
    }

    private buildItemPreview(item: any, quantity: number) {
        return {
            id: String(item?.id || ''),
            templateId: String(item?.templateId || item?.type || ''),
            type: String(item?.type || 'misc'),
            name: String(item?.name || 'Item'),
            slot: String(item?.slot || 'misc'),
            rarity: String(item?.rarity || 'branco'),
            quality: String(item?.quality || 'normal'),
            iconUrl: item?.iconUrl || null,
            spriteId: item?.spriteId || null,
            bonuses: item?.bonuses || {},
            bonusPercents: item?.bonusPercents || {},
            requiredClass: item?.requiredClass ? String(item.requiredClass) : null,
            requiredLevel: Number.isFinite(Number(item?.requiredLevel)) ? Number(item.requiredLevel) : null,
            quantity
        };
    }

    private sendSystem(player: PlayerRuntime, text: string) {
        this.sendRaw(player.ws, { type: 'system_message', text: String(text || '') });
    }
}
