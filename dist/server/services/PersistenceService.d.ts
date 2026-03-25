import { PlayerRuntime } from '../models/types';
type SavePlayerOptions = {
    expectedVersion?: number;
    useOptimisticLock?: boolean;
};
type SavePlayerResult = {
    ok: boolean;
    version: number;
    conflict?: boolean;
};
export declare class PersistenceService {
    getUser(username: string): Promise<({
        players: {
            id: number;
            createdAt: Date;
            slot: number;
            name: string;
            userId: string;
            class: string;
            gender: string;
            level: number;
            xp: number;
            hp: number;
            maxHp: number;
            baseStats: import("@prisma/client/runtime/client").JsonValue;
            stats: import("@prisma/client/runtime/client").JsonValue;
            allocatedStats: import("@prisma/client/runtime/client").JsonValue | null;
            unspentPoints: number;
            statusOverrides: import("@prisma/client/runtime/client").JsonValue | null;
            pvpMode: string;
            mapKey: string;
            mapId: string;
            posX: number;
            posY: number;
            role: string;
            inventory: import("@prisma/client/runtime/client").JsonValue;
            equippedWeaponId: string | null;
            currencyCopper: number;
            currencySilver: number;
            currencyGold: number;
            currencyDiamond: number;
            stateVersion: number;
            updatedAt: Date;
        }[];
    } & {
        id: string;
        username: string;
        passwordHash: string;
        salt: string;
        createdAt: Date;
    }) | null>;
    getUserById(userId: string): Promise<({
        players: {
            id: number;
            createdAt: Date;
            slot: number;
            name: string;
            userId: string;
            class: string;
            gender: string;
            level: number;
            xp: number;
            hp: number;
            maxHp: number;
            baseStats: import("@prisma/client/runtime/client").JsonValue;
            stats: import("@prisma/client/runtime/client").JsonValue;
            allocatedStats: import("@prisma/client/runtime/client").JsonValue | null;
            unspentPoints: number;
            statusOverrides: import("@prisma/client/runtime/client").JsonValue | null;
            pvpMode: string;
            mapKey: string;
            mapId: string;
            posX: number;
            posY: number;
            role: string;
            inventory: import("@prisma/client/runtime/client").JsonValue;
            equippedWeaponId: string | null;
            currencyCopper: number;
            currencySilver: number;
            currencyGold: number;
            currencyDiamond: number;
            stateVersion: number;
            updatedAt: Date;
        }[];
    } & {
        id: string;
        username: string;
        passwordHash: string;
        salt: string;
        createdAt: Date;
    }) | null>;
    getPlayerByName(name: string): Promise<{
        id: number;
        createdAt: Date;
        slot: number;
        name: string;
        userId: string;
        class: string;
        gender: string;
        level: number;
        xp: number;
        hp: number;
        maxHp: number;
        baseStats: import("@prisma/client/runtime/client").JsonValue;
        stats: import("@prisma/client/runtime/client").JsonValue;
        allocatedStats: import("@prisma/client/runtime/client").JsonValue | null;
        unspentPoints: number;
        statusOverrides: import("@prisma/client/runtime/client").JsonValue | null;
        pvpMode: string;
        mapKey: string;
        mapId: string;
        posX: number;
        posY: number;
        role: string;
        inventory: import("@prisma/client/runtime/client").JsonValue;
        equippedWeaponId: string | null;
        currencyCopper: number;
        currencySilver: number;
        currencyGold: number;
        currencyDiamond: number;
        stateVersion: number;
        updatedAt: Date;
    } | null>;
    createUser(username: string, password: string, profile?: any): Promise<{
        players: {
            id: number;
            createdAt: Date;
            slot: number;
            name: string;
            userId: string;
            class: string;
            gender: string;
            level: number;
            xp: number;
            hp: number;
            maxHp: number;
            baseStats: import("@prisma/client/runtime/client").JsonValue;
            stats: import("@prisma/client/runtime/client").JsonValue;
            allocatedStats: import("@prisma/client/runtime/client").JsonValue | null;
            unspentPoints: number;
            statusOverrides: import("@prisma/client/runtime/client").JsonValue | null;
            pvpMode: string;
            mapKey: string;
            mapId: string;
            posX: number;
            posY: number;
            role: string;
            inventory: import("@prisma/client/runtime/client").JsonValue;
            equippedWeaponId: string | null;
            currencyCopper: number;
            currencySilver: number;
            currencyGold: number;
            currencyDiamond: number;
            stateVersion: number;
            updatedAt: Date;
        }[];
    } & {
        id: string;
        username: string;
        passwordHash: string;
        salt: string;
        createdAt: Date;
    }>;
    createPlayerForUser(userId: string, slot: number, profile: any): Promise<{
        id: number;
        createdAt: Date;
        slot: number;
        name: string;
        userId: string;
        class: string;
        gender: string;
        level: number;
        xp: number;
        hp: number;
        maxHp: number;
        baseStats: import("@prisma/client/runtime/client").JsonValue;
        stats: import("@prisma/client/runtime/client").JsonValue;
        allocatedStats: import("@prisma/client/runtime/client").JsonValue | null;
        unspentPoints: number;
        statusOverrides: import("@prisma/client/runtime/client").JsonValue | null;
        pvpMode: string;
        mapKey: string;
        mapId: string;
        posX: number;
        posY: number;
        role: string;
        inventory: import("@prisma/client/runtime/client").JsonValue;
        equippedWeaponId: string | null;
        currencyCopper: number;
        currencySilver: number;
        currencyGold: number;
        currencyDiamond: number;
        stateVersion: number;
        updatedAt: Date;
    }>;
    savePlayer(player: PlayerRuntime, options?: SavePlayerOptions): Promise<SavePlayerResult>;
    enqueuePlayerSave(player: PlayerRuntime, reason: string, maxAttempts?: number): Promise<void>;
    processPendingPlayerSaveJobs(limit?: number): Promise<{
        processed: number;
        fetched: number;
    }>;
    getItems(): Promise<{
        id: string;
        slot: string;
        name: string;
        type: string;
        bonuses: import("@prisma/client/runtime/client").JsonValue;
    }[]>;
    getMobTemplates(): Promise<{
        id: string;
        maxHp: number;
        kind: string;
        size: number;
        color: string;
        xpReward: number;
        physicalDefense: number;
        magicDefense: number;
        aggroRange: number | null;
        leashRange: number | null;
        attackRange: number | null;
        attackCadenceMs: number | null;
        moveSpeed: number | null;
        wanderRadius: number | null;
        repathMs: number | null;
        idleMinMs: number | null;
        idleMaxMs: number | null;
        luckyStrikeChance: number | null;
        accuracy: number | null;
        evasion: number | null;
    }[]>;
    getItemById(id: string): Promise<{
        id: string;
        slot: string;
        name: string;
        type: string;
        bonuses: import("@prisma/client/runtime/client").JsonValue;
    } | null>;
    createItem(item: any): Promise<{
        id: string;
        slot: string;
        name: string;
        type: string;
        bonuses: import("@prisma/client/runtime/client").JsonValue;
    }>;
    getFriendshipsForPlayer(playerId: number): Promise<{
        id: number;
        createdAt: Date;
        playerAId: number;
        playerBId: number;
    }[]>;
    createFriendship(playerAId: number, playerBId: number): Promise<{
        id: number;
        createdAt: Date;
        playerAId: number;
        playerBId: number;
    }>;
    deleteFriendship(playerAId: number, playerBId: number): Promise<void>;
    findPendingFriendRequestBetween(playerAId: number, playerBId: number): Promise<{
        id: number;
        createdAt: Date;
        status: string;
        fromPlayerId: number;
        toPlayerId: number;
        expiresAt: Date;
    } | null>;
    createFriendRequest(fromPlayerId: number, toPlayerId: number, expiresAt: Date): Promise<{
        id: number;
        createdAt: Date;
        status: string;
        fromPlayerId: number;
        toPlayerId: number;
        expiresAt: Date;
    }>;
    getPendingFriendRequestById(requestId: number): Promise<{
        id: number;
        createdAt: Date;
        status: string;
        fromPlayerId: number;
        toPlayerId: number;
        expiresAt: Date;
    } | null>;
    getPendingFriendRequestsForPlayer(playerId: number): Promise<{
        incoming: {
            id: number;
            createdAt: Date;
            status: string;
            fromPlayerId: number;
            toPlayerId: number;
            expiresAt: Date;
        }[];
        outgoing: {
            id: number;
            createdAt: Date;
            status: string;
            fromPlayerId: number;
            toPlayerId: number;
            expiresAt: Date;
        }[];
    }>;
    completeFriendRequest(requestId: number, status: 'accepted' | 'declined'): Promise<void>;
    pruneExpiredFriendRequests(now: Date): Promise<void>;
    clearFriendRequestsForPlayer(playerId: number): Promise<void>;
    getPlayerBasicByIds(ids: number[]): Promise<{
        id: number;
        name: string;
    }[]>;
    getGuildByName(name: string): Promise<({
        members: ({
            player: {
                id: number;
                name: string;
                class: string;
                level: number;
            };
        } & {
            id: number;
            playerId: number;
            joinedAt: Date;
            guildId: string;
            rank: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        motd: string | null;
    }) | null>;
    getGuildById(guildId: string): Promise<({
        members: ({
            player: {
                id: number;
                name: string;
                class: string;
                level: number;
            };
        } & {
            id: number;
            playerId: number;
            joinedAt: Date;
            guildId: string;
            rank: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        motd: string | null;
    }) | null>;
    getGuildMembershipForPlayer(playerId: number): Promise<({
        guild: {
            members: ({
                player: {
                    id: number;
                    name: string;
                    class: string;
                    level: number;
                };
            } & {
                id: number;
                playerId: number;
                joinedAt: Date;
                guildId: string;
                rank: string;
            })[];
        } & {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            motd: string | null;
        };
    } & {
        id: number;
        playerId: number;
        joinedAt: Date;
        guildId: string;
        rank: string;
    }) | null>;
    createGuild(name: string, leaderPlayerId: number): Promise<{
        members: ({
            player: {
                id: number;
                name: string;
                class: string;
                level: number;
            };
        } & {
            id: number;
            playerId: number;
            joinedAt: Date;
            guildId: string;
            rank: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        motd: string | null;
    }>;
    addGuildMember(guildId: string, playerId: number, rank?: 'leader' | 'officer' | 'member'): Promise<{
        id: number;
        playerId: number;
        joinedAt: Date;
        guildId: string;
        rank: string;
    }>;
    updateGuildMemberRank(guildId: string, playerId: number, rank: 'leader' | 'officer' | 'member'): Promise<import(".prisma/client").Prisma.BatchPayload>;
    removeGuildMember(guildId: string, playerId: number): Promise<void>;
    deleteGuild(guildId: string): Promise<void>;
    findPendingGuildInviteBetween(guildId: string, fromPlayerId: number, toPlayerId: number): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        fromPlayerId: number;
        toPlayerId: number;
        expiresAt: Date;
        guildId: string;
    } | null>;
    createGuildInvite(guildId: string, fromPlayerId: number, toPlayerId: number, expiresAt: Date): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        fromPlayerId: number;
        toPlayerId: number;
        expiresAt: Date;
        guildId: string;
    }>;
    getPendingGuildInviteById(inviteId: string): Promise<({
        guild: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            motd: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        status: string;
        fromPlayerId: number;
        toPlayerId: number;
        expiresAt: Date;
        guildId: string;
    }) | null>;
    getPendingGuildInvitesForPlayer(playerId: number): Promise<({
        guild: {
            id: string;
            createdAt: Date;
            name: string;
            updatedAt: Date;
            motd: string | null;
        };
        fromPlayer: {
            id: number;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        status: string;
        fromPlayerId: number;
        toPlayerId: number;
        expiresAt: Date;
        guildId: string;
    })[]>;
    completeGuildInvite(inviteId: string, status: 'accepted' | 'declined' | 'expired' | 'cancelled'): Promise<void>;
    pruneExpiredGuildInvites(now: Date): Promise<void>;
    clearGuildInvitesForPlayer(playerId: number): Promise<void>;
    getPetsForPlayer(playerId: number): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        level: number;
        xp: number;
        updatedAt: Date;
        playerId: number;
        templateId: string;
        loyalty: number;
        hunger: number;
    }[]>;
    getPetOwnershipById(ownershipId: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        level: number;
        xp: number;
        updatedAt: Date;
        playerId: number;
        templateId: string;
        loyalty: number;
        hunger: number;
    } | null>;
    createPetOwnership(playerId: number, templateId: string, name?: string): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        level: number;
        xp: number;
        updatedAt: Date;
        playerId: number;
        templateId: string;
        loyalty: number;
        hunger: number;
    }>;
    updatePetOwnership(ownershipId: string, patch: {
        name?: string;
        level?: number;
        xp?: number;
        loyalty?: number;
        hunger?: number;
    }): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        level: number;
        xp: number;
        updatedAt: Date;
        playerId: number;
        templateId: string;
        loyalty: number;
        hunger: number;
    }>;
    ensureStarterPetsForPlayer(playerId: number): Promise<void>;
    getActivePetForPlayer(playerId: number): Promise<({
        petOwnership: {
            id: string;
            createdAt: Date;
            name: string;
            level: number;
            xp: number;
            updatedAt: Date;
            playerId: number;
            templateId: string;
            loyalty: number;
            hunger: number;
        };
    } & {
        createdAt: Date;
        updatedAt: Date;
        playerId: number;
        petOwnershipId: string;
        behavior: string;
    }) | null>;
    setActivePet(playerId: number, petOwnershipId: string, behavior?: string): Promise<{
        createdAt: Date;
        updatedAt: Date;
        playerId: number;
        petOwnershipId: string;
        behavior: string;
    }>;
    clearActivePet(playerId: number): Promise<void>;
    private savePlayerFromSnapshot;
}
export {};
//# sourceMappingURL=PersistenceService.d.ts.map