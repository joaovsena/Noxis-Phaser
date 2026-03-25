import { WebSocket } from 'ws';

interface ExtendedWebSocket extends WebSocket {
    playerId?: number;
    authUserId?: string;
    authUsername?: string;
    authRole?: string;
    pendingPlayerProfiles?: any[];
    bootstrapReady?: boolean;
}
import { GameController } from './GameController';
import { WSMessage } from '../models/types';

export class WSHandler {
    private controller: GameController;

    constructor(controller: GameController) {
        this.controller = controller;
    }

    handleMessage(ws: ExtendedWebSocket, raw: string) {
        let msg: WSMessage;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }

        if (msg.type === 'ping') {
            try {
                ws.send(JSON.stringify({ type: 'pong', nonce: (msg as any).nonce ?? null, serverTime: Date.now() }));
            } catch {
                // noop
            }
            return;
        }

        if (!ws.playerId || !this.controller.players.has(ws.playerId)) {
            if (msg.type.startsWith('auth_')) {
                this.controller.handleAuth(ws, msg as any);
                return;
            }
            if (msg.type === 'character.back') {
                void this.controller.handleCharacterBack(ws as any);
                return;
            }
            if (msg.type === 'character_create') {
                void this.controller.handleCharacterCreate(ws, msg as any);
                return;
            }
            if (msg.type === 'character_enter') {
                ws.bootstrapReady = false;
                void this.controller.handleCharacterEnter(ws, msg as any);
            }
            return;
        }

        const player = this.controller.players.get(ws.playerId)!;

        if ((msg as any).type === 'bootstrap.ready') {
            ws.bootstrapReady = true;
            return;
        }

        switch (msg.type) {
            case 'move':
                this.controller.handleMove(player, msg as any);
                break;
            case 'target_mob':
                this.controller.handleTargetMob(player, msg as any);
                break;
            case 'chat_send':
                this.controller.handleChat(player, msg as any);
                break;
            case 'pickup_item':
                this.controller.handlePickupItem(player, msg as any);
                break;
            case 'equip_item':
                this.controller.handleEquipItem(player, msg as any);
                break;
            case 'equip_req':
                this.controller.handleEquipItem(player, msg as any);
                break;
            case 'inventory_move':
                this.controller.handleInventoryMove(player, msg as any);
                break;
            case 'inventory_sort':
                this.controller.handleInventorySort(player);
                break;
            case 'inventory_delete':
                this.controller.handleInventoryDelete(player, msg as any);
                break;
            case 'delete_item_req':
                this.controller.handleInventoryDelete(player, msg as any);
                break;
            case 'split_item_req':
                this.controller.handleInventorySplit(player, msg as any);
                break;
            case 'sell_item_req':
                this.controller.handleSellItem(player, msg as any);
                break;
            case 'inventory_unequip_to_slot':
                this.controller.handleInventoryUnequipToSlot(player, msg as any);
                break;
            case 'item.use':
                this.controller.handleItemUse(player, msg as any);
                break;
            case 'switch_instance':
                this.controller.handleSwitchInstance(player, msg as any);
                break;
            case 'admin_command':
                void this.controller.handleAdminCommand(player, msg as any);
                break;
            case 'admin.setMobPeaceful':
                this.controller.handleAdminSetMobPeaceful(player, msg as any);
                break;
            case 'party.create':
                this.controller.handlePartyCreate(player);
                break;
            case 'party.invite':
                this.controller.handlePartyInvite(player, msg as any);
                break;
            case 'party.acceptInvite':
                this.controller.handlePartyAcceptInvite(player, msg as any);
                break;
            case 'party.declineInvite':
                this.controller.handlePartyDeclineInvite(player, msg as any);
                break;
            case 'party.leave':
                this.controller.handlePartyLeave(player);
                break;
            case 'party.kick':
                this.controller.handlePartyKick(player, msg as any);
                break;
            case 'party.promote':
                this.controller.handlePartyPromote(player, msg as any);
                break;
            case 'party.requestAreaParties':
                this.controller.handlePartyRequestAreaParties(player);
                break;
            case 'party.requestJoin':
                this.controller.handlePartyRequestJoin(player, msg as any);
                break;
            case 'party.approveJoin':
                this.controller.handlePartyApproveJoin(player, msg as any);
                break;
            case 'party.waypointPing':
                this.controller.handlePartyWaypointPing(player, msg as any);
                break;
            case 'friend.request':
                this.controller.handleFriendRequest(player, msg as any);
                break;
            case 'friend.accept':
                this.controller.handleFriendAccept(player, msg as any);
                break;
            case 'friend.decline':
                this.controller.handleFriendDecline(player, msg as any);
                break;
            case 'friend.remove':
                this.controller.handleFriendRemove(player, msg as any);
                break;
            case 'friend.list':
                this.controller.handleFriendList(player);
                break;
            case 'trade.request':
                this.controller.handleTradeRequest(player, msg as any);
                break;
            case 'trade.respond':
                this.controller.handleTradeRespond(player, msg as any);
                break;
            case 'trade.setItem':
                this.controller.handleTradeSetItem(player, msg as any);
                break;
            case 'trade.removeItem':
                this.controller.handleTradeRemoveItem(player, msg as any);
                break;
            case 'trade.setCurrency':
                this.controller.handleTradeSetCurrency(player, msg as any);
                break;
            case 'trade.lock':
                this.controller.handleTradeLock(player);
                break;
            case 'trade.confirm':
                this.controller.handleTradeConfirm(player);
                break;
            case 'trade.cancel':
                this.controller.handleTradeCancel(player);
                break;
            case 'storage.open':
                this.controller.handleStorageOpen(player, msg as any);
                break;
            case 'storage.close':
                this.controller.handleStorageClose(player);
                break;
            case 'storage.deposit':
                this.controller.handleStorageDeposit(player, msg as any);
                break;
            case 'storage.withdraw':
                this.controller.handleStorageWithdraw(player, msg as any);
                break;
            case 'pet.summon':
                void this.controller.handlePetSummon(player, msg as any);
                break;
            case 'pet.unsummon':
                void this.controller.handlePetUnsummon(player);
                break;
            case 'pet.feed':
                void this.controller.handlePetFeed(player, msg as any);
                break;
            case 'pet.rename':
                void this.controller.handlePetRename(player, msg as any);
                break;
            case 'pet.setBehavior':
                void this.controller.handlePetSetBehavior(player, msg as any);
                break;
            case 'pet.state':
                void this.controller.handlePetState(player);
                break;
            case 'guild.create':
                this.controller.handleGuildCreate(player, msg as any);
                break;
            case 'guild.invite':
                this.controller.handleGuildInvite(player, msg as any);
                break;
            case 'guild.respondInvite':
                this.controller.handleGuildRespondInvite(player, msg as any);
                break;
            case 'guild.leave':
                this.controller.handleGuildLeave(player);
                break;
            case 'guild.kick':
                this.controller.handleGuildKick(player, msg as any);
                break;
            case 'guild.setRank':
                this.controller.handleGuildSetRank(player, msg as any);
                break;
            case 'guild.state':
                this.controller.handleGuildState(player);
                break;
            case 'stats.allocate':
                this.controller.handleStatsAllocate(player, msg as any);
                break;
            case 'player.setPvpMode':
                this.controller.handleSetPvpMode(player, msg as any);
                break;
            case 'combat.attack':
                this.controller.handleCombatAttack(player, msg as any);
                break;
            case 'combat.targetPlayer':
                this.controller.handleCombatTargetPlayer(player, msg as any);
                break;
            case 'combat.clearTarget':
                this.controller.handleCombatClearTarget(player);
                break;
            case 'player.revive':
                this.controller.handlePlayerRevive(player);
                break;
            case 'skill.cast':
                this.controller.handleSkillCast(player, msg as any);
                break;
            case 'skill.learn':
                this.controller.handleSkillLearn(player, msg as any);
                break;
            case 'npc.interact':
                this.controller.handleNpcInteract(player, msg as any);
                break;
            case 'npc.buy':
                this.controller.handleNpcBuy(player, msg as any);
                break;
            case 'dungeon.enter':
                this.controller.handleDungeonEnter(player, msg as any);
                break;
            case 'dungeon.ready':
                this.controller.handleDungeonReady(player, msg as any);
                break;
            case 'dungeon.leave':
                this.controller.handleDungeonLeave(player);
                break;
            case 'quest.accept':
                this.controller.handleQuestAccept(player, msg as any);
                break;
            case 'quest.complete':
                this.controller.handleQuestComplete(player, msg as any);
                break;
            case 'player.toggleAfk':
                this.controller.handleToggleAfk(player);
                break;
            case 'hotbar.set':
                this.controller.handleHotbarSet(player, msg as any);
                break;
            case 'character.back':
                void this.controller.handleCharacterBack(ws as any);
                break;
            // Adicionar outros cases...
        }
    }
}
