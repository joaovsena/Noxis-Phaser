export interface PlayerRuntime {
    id: number;
    userId: string | number;
    username: string;
    name: string;
    class: string;
    gender: string;
    level: number;
    xp: number;
    hp: number;
    maxHp: number;
    baseStats: any;
    stats: any;
    allocatedStats: any;
    unspentPoints: number;
    statusOverrides: any;
    pvpMode: 'peace' | 'group' | 'evil';
    role: string;
    inventory: any;
    equippedWeaponId: string | null;
    wallet: {
        copper: number;
        silver: number;
        gold: number;
        diamond: number;
    };
    persistenceVersion?: number;
    ws: any;
    mapKey: string;
    mapId: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    autoAttackActive: boolean;
    attackTargetId: string | null;
    lastAttackAt: number;
    lastCombatAt: number;
    lastPortalAt?: number;
    pvpAutoAttackActive?: boolean;
    attackTargetPlayerId?: number | null;
    dead?: boolean;
    deathX?: number;
    deathY?: number;
    partyId?: string | null;
    guildId?: string | null;
    guildName?: string | null;
    guildRank?: 'leader' | 'officer' | 'member' | null;
    skillCooldowns?: Record<string, number>;
    skillLevels?: Record<string, number>;
    activeSkillEffects?: Array<any>;
    movePath?: Array<{ x: number; y: number }>;
    rawMovePath?: Array<{ x: number; y: number }>;
    nextPathfindAt?: number;
    pathDestinationX?: number;
    pathDestinationY?: number;
    lastMoveCheckX?: number;
    lastMoveCheckY?: number;
    lastMoveProgressAt?: number;
    pendingSkillCast?: {
        skillId: string;
        targetMobId?: string | null;
        targetPlayerId?: number | null;
        issuedAt: number;
        nextAttemptAt?: number;
    } | null;
    lastPathRequestKey?: string;
    lastPathRequestAt?: number;
    afkActive?: boolean;
    afkOriginX?: number;
    afkOriginY?: number;
    afkOriginMapKey?: string;
    afkOriginMapId?: string;
    afkNextThinkAt?: number;
    petOwnerships?: PetOwnershipRecord[];
    activePetOwnershipId?: string | null;
    petBehavior?: PetBehavior;
}

export type PetRole = 'offensive' | 'support' | 'defensive';
export type PetMoveStyle = 'ground' | 'flying' | 'heavy' | 'ranged';
export type PetBehavior = 'follow' | 'assist' | 'passive';

export interface PetOwnershipRecord {
    id: string;
    templateId: string;
    name: string;
    level: number;
    xp: number;
    loyalty: number;
    hunger: number;
    role: PetRole;
    moveStyle: PetMoveStyle;
    biomeKey: string;
}

export interface PetRuntime {
    id: string;
    ownershipId: string;
    templateId: string;
    ownerPlayerId: number;
    ownerName: string;
    name: string;
    role: PetRole;
    moveStyle: PetMoveStyle;
    biomeKey: string;
    mapKey: string;
    mapId: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    level: number;
    xp: number;
    loyalty: number;
    hunger: number;
    behavior: PetBehavior;
    lastActionAt: number;
    lastSupportAt: number;
    visualSeed: number;
}

export interface Mob {
    id: string;
    x: number;
    y: number;
    kind: string;
    color: string;
    size: number;
    hp: number;
    maxHp: number;
    physicalDefense: number;
    magicDefense: number;
    xpReward: number;
    mapId: string;
    level?: number;
    state?: 'idle' | 'wander' | 'aggro' | 'attack_windup' | 'leash_return';
    homeX?: number;
    homeY?: number;
    spawnX?: number;
    spawnY?: number;
    wanderTargetX?: number | null;
    wanderTargetY?: number | null;
    nextThinkAt?: number;
    nextAttackAt?: number;
    nextRepathAt?: number;
    ignoreDamage?: boolean;
    hateTable?: Record<string, number>;
    invulnerableUntil?: number;
    targetPlayerId?: number | null;
    lastAttackAt?: number;
    noRespawn?: boolean;
    eventId?: string | null;
    eventName?: string | null;
    eventLootTable?: Array<{
        type: 'weapon' | 'potion_hp' | 'skill_reset_hourglass';
        chance: number;
    }>;
}

export interface GroundItem {
    id: string;
    templateId?: string;
    rarity?: string | null;
    quality?: string | null;
    spriteId?: string | null;
    iconUrl?: string | null;
    type: string;
    name: string;
    slot: string;
    bonuses: any;
    bonusPercents?: any;
    requiredClass?: string | null;
    requiredLevel?: number | null;
    bindingType?: string | null;
    quantity?: number;
    stackable?: boolean;
    maxStack?: number;
    healPercent?: number;
    x: number;
    y: number;
    mapId: string;
    ownerId?: number | null;
    ownerPartyId?: string | null;
    reservedUntil?: number;
    expiresAt?: number;
}

export interface AuthMessage {
    type: 'auth_register' | 'auth_login';
    username: string;
    password: string;
    name?: string;
    class?: string;
}

export interface CharacterCreateMessage {
    type: 'character_create';
    name: string;
    class: string;
    gender?: string;
}

export interface CharacterEnterMessage {
    type: 'character_enter';
    slot?: number;
}

export interface CharacterBackMessage {
    type: 'character.back';
}

export interface MoveMessage {
    type: 'move';
    reqId?: string;
    x: number;
    y: number;
}

export interface TargetMobMessage {
    type: 'target_mob';
    mobId: string;
}

export interface ChatMessage {
    type: 'chat_send';
    scope: 'local' | 'map' | 'global' | 'world' | 'group' | 'guild' | 'whisper' | 'trade';
    text: string;
    targetName?: string;
}

export interface PetSummonMessage {
    type: 'pet.summon';
    petOwnershipId: string;
}

export interface PetUnsummonMessage {
    type: 'pet.unsummon';
}

export interface PetFeedMessage {
    type: 'pet.feed';
    petOwnershipId?: string;
}

export interface PetRenameMessage {
    type: 'pet.rename';
    petOwnershipId: string;
    name: string;
}

export interface PetSetBehaviorMessage {
    type: 'pet.setBehavior';
    behavior: PetBehavior;
}

export interface PetStateRequestMessage {
    type: 'pet.state';
}

export interface PickupItemMessage {
    type: 'pickup_item';
    itemId: string;
}

export interface EquipItemMessage {
    type: 'equip_item';
    itemId: string | null;
}

export interface EquipRequestMessage {
    type: 'equip_req';
    itemId: string | null;
}

export interface InventoryMoveMessage {
    type: 'inventory_move';
    itemId: string;
    toSlot: number;
}

export interface InventorySortMessage {
    type: 'inventory_sort';
}

export interface InventoryDeleteMessage {
    type: 'inventory_delete';
    itemId: string;
}

export interface DeleteItemRequestMessage {
    type: 'delete_item_req';
    itemId?: string;
    slotIndex?: number;
}

export interface SplitItemRequestMessage {
    type: 'split_item_req';
    itemId?: string;
    slotIndex?: number;
    quantity: number;
}

export interface SellItemRequestMessage {
    type: 'sell_item_req';
    itemId?: string;
    slotIndex?: number;
    npcId?: string;
}

export interface InventoryUnequipToSlotMessage {
    type: 'inventory_unequip_to_slot';
    itemId: string;
    toSlot: number;
}

export interface ItemUseMessage {
    type: 'item.use';
    itemId: string;
}

export interface SwitchInstanceMessage {
    type: 'switch_instance';
    mapId: string;
}

export interface AdminCommandMessage {
    type: 'admin_command';
    command: string;
}

export interface AdminSetMobPeacefulMessage {
    type: 'admin.setMobPeaceful';
    enabled: boolean;
}

export interface PartyCreateMessage {
    type: 'party.create';
}

export interface PartyInviteMessage {
    type: 'party.invite';
    targetName: string;
}

export interface PartyAcceptInviteMessage {
    type: 'party.acceptInvite';
    partyId: string;
    inviteId?: string;
}

export interface PartyDeclineInviteMessage {
    type: 'party.declineInvite';
    partyId: string;
    inviteId?: string;
}

export interface PartyLeaveMessage {
    type: 'party.leave';
}

export interface PartyKickMessage {
    type: 'party.kick';
    targetPlayerId: number;
}

export interface PartyPromoteMessage {
    type: 'party.promote';
    targetPlayerId: number;
}

export interface PartyRequestAreaPartiesMessage {
    type: 'party.requestAreaParties';
}

export interface PartyRequestJoinMessage {
    type: 'party.requestJoin';
    partyId: string;
}

export interface PartyApproveJoinMessage {
    type: 'party.approveJoin';
    requestId: string;
    accept: boolean;
}

export interface PartyWaypointPingMessage {
    type: 'party.waypointPing';
    x: number;
    y: number;
}

export interface FriendRequestMessage {
    type: 'friend.request';
    targetPlayerId?: number;
    targetName?: string;
}

export interface FriendAcceptMessage {
    type: 'friend.accept';
    requestId: string;
}

export interface FriendDeclineMessage {
    type: 'friend.decline';
    requestId: string;
}

export interface FriendRemoveMessage {
    type: 'friend.remove';
    friendPlayerId: number;
}

export interface FriendListMessage {
    type: 'friend.list';
}

export interface TradeRequestMessage {
    type: 'trade.request';
    targetPlayerId?: number;
    targetName?: string;
}

export interface TradeRespondMessage {
    type: 'trade.respond';
    requestId: string;
    accept: boolean;
}

export interface TradeSetItemMessage {
    type: 'trade.setItem';
    itemId: string;
    quantity: number;
}

export interface TradeRemoveItemMessage {
    type: 'trade.removeItem';
    itemId: string;
}

export interface TradeSetCurrencyMessage {
    type: 'trade.setCurrency';
    wallet: {
        copper?: number;
        silver?: number;
        gold?: number;
        diamond?: number;
    };
}

export interface TradeLockMessage {
    type: 'trade.lock';
}

export interface TradeConfirmMessage {
    type: 'trade.confirm';
}

export interface TradeCancelMessage {
    type: 'trade.cancel';
}

export interface StorageOpenMessage {
    type: 'storage.open';
    npcId?: string;
}

export interface StorageCloseMessage {
    type: 'storage.close';
}

export interface StorageDepositMessage {
    type: 'storage.deposit';
    itemId: string;
    quantity?: number;
}

export interface StorageWithdrawMessage {
    type: 'storage.withdraw';
    itemId: string;
    quantity?: number;
}

export interface GuildCreateMessage {
    type: 'guild.create';
    name: string;
}

export interface GuildInviteMessage {
    type: 'guild.invite';
    targetName: string;
}

export interface GuildRespondInviteMessage {
    type: 'guild.respondInvite';
    inviteId: string;
    accept: boolean;
}

export interface GuildLeaveMessage {
    type: 'guild.leave';
}

export interface GuildKickMessage {
    type: 'guild.kick';
    targetPlayerId: number;
}

export interface GuildSetRankMessage {
    type: 'guild.setRank';
    targetPlayerId: number;
    rank: 'leader' | 'officer' | 'member';
}

export interface GuildStateMessage {
    type: 'guild.state';
}

export interface StatsAllocateMessage {
    type: 'stats.allocate';
    allocation: {
        str?: number;
        int?: number;
        dex?: number;
        vit?: number;
        // Compatibilidade com payload legado.
        physicalAttack?: number;
        magicAttack?: number;
        physicalDefense?: number;
        magicDefense?: number;
    };
}

export interface PlayerSetPvpModeMessage {
    type: 'player.setPvpMode';
    mode: 'peace' | 'group' | 'evil';
}

export interface CombatAttackMessage {
    type: 'combat.attack';
    targetPlayerId: number;
}

export interface CombatTargetPlayerMessage {
    type: 'combat.targetPlayer';
    targetPlayerId: number;
}

export interface CombatClearTargetMessage {
    type: 'combat.clearTarget';
}

export interface PlayerReviveMessage {
    type: 'player.revive';
}

export interface SkillCastMessage {
    type: 'skill.cast';
    skillId: string;
    targetMobId?: string | null;
    targetPlayerId?: number | null;
}

export interface SkillLearnMessage {
    type: 'skill.learn';
    skillId: string;
}

export interface NpcInteractMessage {
    type: 'npc.interact';
    npcId: string;
}

export interface NpcBuyMessage {
    type: 'npc.buy';
    npcId: string;
    offerId: string;
    quantity?: number;
}

export interface QuestAcceptMessage {
    type: 'quest.accept';
    questId: string;
}

export interface QuestCompleteMessage {
    type: 'quest.complete';
    questId: string;
}

export interface DungeonEnterMessage {
    type: 'dungeon.enter';
    npcId: string;
    mode?: 'solo' | 'group' | 'open';
}

export interface DungeonReadyMessage {
    type: 'dungeon.ready';
    requestId: string;
    accept: boolean;
}

export interface DungeonLeaveMessage {
    type: 'dungeon.leave';
}

export interface PlayerToggleAfkMessage {
    type: 'player.toggleAfk';
}

export interface HotbarSetMessage {
    type: 'hotbar.set';
    bindings: Record<string, any>;
}

export interface PingMessage {
    type: 'ping';
    nonce?: number;
}

export type WSMessage =
    | AuthMessage
    | CharacterCreateMessage
    | CharacterEnterMessage
    | CharacterBackMessage
    | MoveMessage
    | TargetMobMessage
    | ChatMessage
    | PickupItemMessage
    | EquipItemMessage
    | EquipRequestMessage
    | InventoryMoveMessage
    | InventorySortMessage
    | InventoryDeleteMessage
    | DeleteItemRequestMessage
    | SplitItemRequestMessage
    | SellItemRequestMessage
    | InventoryUnequipToSlotMessage
    | ItemUseMessage
    | SwitchInstanceMessage
    | AdminCommandMessage
    | AdminSetMobPeacefulMessage
    | PartyCreateMessage
    | PartyInviteMessage
    | PartyAcceptInviteMessage
    | PartyDeclineInviteMessage
    | PartyLeaveMessage
    | PartyKickMessage
    | PartyPromoteMessage
    | PartyRequestAreaPartiesMessage
    | PartyRequestJoinMessage
    | PartyApproveJoinMessage
    | PartyWaypointPingMessage
    | FriendRequestMessage
    | FriendAcceptMessage
    | FriendDeclineMessage
    | FriendRemoveMessage
    | FriendListMessage
    | TradeRequestMessage
    | TradeRespondMessage
    | TradeSetItemMessage
    | TradeRemoveItemMessage
    | TradeSetCurrencyMessage
    | TradeLockMessage
    | TradeConfirmMessage
    | TradeCancelMessage
    | StorageOpenMessage
    | StorageCloseMessage
    | StorageDepositMessage
    | StorageWithdrawMessage
    | PetSummonMessage
    | PetUnsummonMessage
    | PetFeedMessage
    | PetRenameMessage
    | PetSetBehaviorMessage
    | PetStateRequestMessage
    | GuildCreateMessage
    | GuildInviteMessage
    | GuildRespondInviteMessage
    | GuildLeaveMessage
    | GuildKickMessage
    | GuildSetRankMessage
    | GuildStateMessage
    | StatsAllocateMessage
    | PlayerSetPvpModeMessage
    | CombatAttackMessage
    | CombatTargetPlayerMessage
    | CombatClearTargetMessage
    | PlayerReviveMessage
    | SkillCastMessage
    | SkillLearnMessage
    | NpcInteractMessage
    | NpcBuyMessage
    | QuestAcceptMessage
    | QuestCompleteMessage
    | DungeonEnterMessage
    | DungeonReadyMessage
    | DungeonLeaveMessage
    | PlayerToggleAfkMessage
    | HotbarSetMessage
    | PingMessage;
