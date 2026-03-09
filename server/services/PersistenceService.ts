import prisma from '../utils/prisma';
import { PlayerRuntime } from '../models/types';
import { hashPassword, generateSalt } from '../utils/hash';
import { normalizeWallet } from '../utils/currency';

type SavePlayerOptions = {
    expectedVersion?: number;
    useOptimisticLock?: boolean;
};

type SavePlayerResult = {
    ok: boolean;
    version: number;
    conflict?: boolean;
};

type PlayerSaveSnapshot = {
    playerId: number;
    expectedVersion?: number;
    level: number;
    xp: number;
    hp: number;
    role: string;
    stats: any;
    allocatedStats: any;
    unspentPoints: number;
    statusOverrides: any;
    pvpMode: string;
    mapKey: string;
    mapId: string;
    posX: number;
    posY: number;
    inventory: any;
    equippedWeaponId: string | null;
    currencyCopper: number;
    currencySilver: number;
    currencyGold: number;
    currencyDiamond: number;
};

export class PersistenceService {
    async getUser(username: string) {
        return await prisma.user.findUnique({
            where: { username },
            include: { players: { orderBy: { slot: 'asc' } } }
        });
    }

    async getUserById(userId: string) {
        return await prisma.user.findUnique({
            where: { id: userId },
            include: { players: { orderBy: { slot: 'asc' } } }
        });
    }

    async getPlayerByName(name: string) {
        return await prisma.player.findFirst({ where: { name } });
    }

    async createUser(username: string, password: string, profile?: any) {
        const salt = generateSalt();
        const passwordHash = hashPassword(password, salt);
        const data: any = {
            username,
            passwordHash,
            salt
        };
        if (profile) {
            data.players = {
                create: profile
            };
        }
        return await prisma.user.create({
            data,
            include: { players: { orderBy: { slot: 'asc' } } }
        });
    }

    async createPlayerForUser(userId: string, slot: number, profile: any) {
        return await prisma.player.create({
            data: {
                ...profile,
                userId,
                slot
            }
        });
    }

    async savePlayer(player: PlayerRuntime, options: SavePlayerOptions = {}): Promise<SavePlayerResult> {
        const wallet = normalizeWallet(player.wallet);
        const snapshot: PlayerSaveSnapshot = {
            playerId: Number(player.id),
            expectedVersion: Number.isFinite(Number(options.expectedVersion)) ? Number(options.expectedVersion) : undefined,
            level: Number(player.level || 1),
            xp: Number(player.xp || 0),
            hp: Number(player.hp || 0),
            role: String(player.role || 'player'),
            stats: player.stats,
            allocatedStats: player.allocatedStats,
            unspentPoints: Number(player.unspentPoints || 0),
            statusOverrides: player.statusOverrides,
            pvpMode: String(player.pvpMode || 'peace'),
            mapKey: String(player.mapKey || 'forest'),
            mapId: String(player.mapId || 'Z1'),
            posX: Number(player.x || 0),
            posY: Number(player.y || 0),
            inventory: player.inventory,
            equippedWeaponId: player.equippedWeaponId ? String(player.equippedWeaponId) : null,
            currencyCopper: wallet.copper,
            currencySilver: wallet.silver,
            currencyGold: wallet.gold,
            currencyDiamond: wallet.diamond
        };
        return await this.savePlayerFromSnapshot(snapshot, options);
    }

    async enqueuePlayerSave(player: PlayerRuntime, reason: string, maxAttempts: number = 8) {
        const wallet = normalizeWallet(player.wallet);
        const payload: PlayerSaveSnapshot = {
            playerId: Number(player.id),
            expectedVersion: Number.isFinite(Number(player.persistenceVersion)) ? Number(player.persistenceVersion) : undefined,
            level: Number(player.level || 1),
            xp: Number(player.xp || 0),
            hp: Number(player.hp || 0),
            role: String(player.role || 'player'),
            stats: player.stats,
            allocatedStats: player.allocatedStats,
            unspentPoints: Number(player.unspentPoints || 0),
            statusOverrides: player.statusOverrides,
            pvpMode: String(player.pvpMode || 'peace'),
            mapKey: String(player.mapKey || 'forest'),
            mapId: String(player.mapId || 'Z1'),
            posX: Number(player.x || 0),
            posY: Number(player.y || 0),
            inventory: player.inventory,
            equippedWeaponId: player.equippedWeaponId ? String(player.equippedWeaponId) : null,
            currencyCopper: wallet.copper,
            currencySilver: wallet.silver,
            currencyGold: wallet.gold,
            currencyDiamond: wallet.diamond
        };
        await prisma.persistenceJob.create({
            data: {
                playerId: Number(player.id),
                kind: 'player_save',
                payload: payload as any,
                status: 'pending',
                attempts: 0,
                maxAttempts: Math.max(1, Math.min(20, Math.floor(Number(maxAttempts || 8)))),
                availableAt: new Date(),
                lastError: reason ? String(reason).slice(0, 250) : null
            }
        });
    }

    async processPendingPlayerSaveJobs(limit: number = 20) {
        const now = new Date();
        const jobs = await prisma.persistenceJob.findMany({
            where: {
                kind: 'player_save',
                status: 'pending',
                availableAt: { lte: now }
            },
            orderBy: { createdAt: 'asc' },
            take: Math.max(1, Math.min(100, Math.floor(Number(limit || 20))))
        });
        let processed = 0;
        for (const job of jobs) {
            const claimed = await prisma.persistenceJob.updateMany({
                where: { id: job.id, status: 'pending' },
                data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 } }
            });
            if (!claimed.count) continue;

            const payload = job.payload as any;
            try {
                const result = await this.savePlayerFromSnapshot(payload, {
                    expectedVersion: Number.isFinite(Number(payload?.expectedVersion)) ? Number(payload.expectedVersion) : undefined,
                    useOptimisticLock: Number.isFinite(Number(payload?.expectedVersion))
                });
                if (result.ok || result.conflict) {
                    await prisma.persistenceJob.delete({ where: { id: job.id } });
                } else {
                    throw new Error('save_not_applied');
                }
                processed += 1;
            } catch (error) {
                const attempts = Math.max(1, Number(job.attempts || 0) + 1);
                const maxAttempts = Math.max(1, Number(job.maxAttempts || 8));
                if (attempts >= maxAttempts) {
                    await prisma.persistenceJob.update({
                        where: { id: job.id },
                        data: { status: 'failed', lastError: String(error).slice(0, 500) }
                    });
                    continue;
                }
                const backoffMs = Math.min(300_000, 500 * (2 ** (attempts - 1)));
                await prisma.persistenceJob.update({
                    where: { id: job.id },
                    data: {
                        status: 'pending',
                        availableAt: new Date(Date.now() + backoffMs),
                        lastError: String(error).slice(0, 500)
                    }
                });
            }
        }
        return { processed, fetched: jobs.length };
    }

    async getItems() {
        return await prisma.item.findMany();
    }

    async getMobTemplates() {
        return await prisma.mobTemplate.findMany();
    }

    async getItemById(id: string) {
        return await prisma.item.findUnique({ where: { id } });
    }

    async createItem(item: any) {
        return await prisma.item.create({ data: item });
    }

    async getFriendshipsForPlayer(playerId: number) {
        return await prisma.friendship.findMany({
            where: {
                OR: [{ playerAId: playerId }, { playerBId: playerId }]
            }
        });
    }

    async createFriendship(playerAId: number, playerBId: number) {
        const a = Math.min(playerAId, playerBId);
        const b = Math.max(playerAId, playerBId);
        return await prisma.friendship.upsert({
            where: {
                playerAId_playerBId: { playerAId: a, playerBId: b } as any
            } as any,
            update: {},
            create: { playerAId: a, playerBId: b }
        });
    }

    async deleteFriendship(playerAId: number, playerBId: number) {
        const a = Math.min(playerAId, playerBId);
        const b = Math.max(playerAId, playerBId);
        await prisma.friendship.deleteMany({
            where: { playerAId: a, playerBId: b }
        });
    }

    async findPendingFriendRequestBetween(playerAId: number, playerBId: number) {
        return await prisma.friendRequest.findFirst({
            where: {
                status: 'pending',
                OR: [
                    { fromPlayerId: playerAId, toPlayerId: playerBId },
                    { fromPlayerId: playerBId, toPlayerId: playerAId }
                ]
            }
        });
    }

    async createFriendRequest(fromPlayerId: number, toPlayerId: number, expiresAt: Date) {
        return await prisma.friendRequest.create({
            data: { fromPlayerId, toPlayerId, expiresAt, status: 'pending' }
        });
    }

    async getPendingFriendRequestById(requestId: number) {
        return await prisma.friendRequest.findFirst({
            where: { id: requestId, status: 'pending' }
        });
    }

    async getPendingFriendRequestsForPlayer(playerId: number) {
        const [incoming, outgoing] = await Promise.all([
            prisma.friendRequest.findMany({
                where: { toPlayerId: playerId, status: 'pending' }
            }),
            prisma.friendRequest.findMany({
                where: { fromPlayerId: playerId, status: 'pending' }
            })
        ]);
        return { incoming, outgoing };
    }

    async completeFriendRequest(requestId: number, status: 'accepted' | 'declined') {
        await prisma.friendRequest.updateMany({
            where: { id: requestId, status: 'pending' },
            data: { status }
        });
    }

    async pruneExpiredFriendRequests(now: Date) {
        await prisma.friendRequest.updateMany({
            where: {
                status: 'pending',
                expiresAt: { lt: now }
            },
            data: { status: 'expired' }
        });
    }

    async clearFriendRequestsForPlayer(playerId: number) {
        await prisma.friendRequest.updateMany({
            where: {
                status: 'pending',
                OR: [{ fromPlayerId: playerId }, { toPlayerId: playerId }]
            },
            data: { status: 'cancelled' }
        });
    }

    async getPlayerBasicByIds(ids: number[]) {
        if (!ids.length) return [];
        return await prisma.player.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true }
        });
    }

    private async savePlayerFromSnapshot(snapshot: any, options: SavePlayerOptions = {}): Promise<SavePlayerResult> {
        const playerId = Number(snapshot?.playerId);
        if (!Number.isFinite(playerId) || playerId <= 0) {
            throw new Error('invalid_player_snapshot');
        }
        const data: any = {
            level: Number(snapshot?.level || 1),
            xp: Number(snapshot?.xp || 0),
            hp: Number(snapshot?.hp || 0),
            role: String(snapshot?.role || 'player'),
            stats: snapshot?.stats ?? {},
            allocatedStats: snapshot?.allocatedStats ?? {},
            unspentPoints: Number(snapshot?.unspentPoints || 0),
            statusOverrides: snapshot?.statusOverrides ?? {},
            pvpMode: String(snapshot?.pvpMode || 'peace'),
            mapKey: String(snapshot?.mapKey || 'forest'),
            mapId: String(snapshot?.mapId || 'Z1'),
            posX: Number(snapshot?.posX || 0),
            posY: Number(snapshot?.posY || 0),
            inventory: snapshot?.inventory ?? [],
            equippedWeaponId: snapshot?.equippedWeaponId ? String(snapshot.equippedWeaponId) : null,
            currencyCopper: Number(snapshot?.currencyCopper || 0),
            currencySilver: Number(snapshot?.currencySilver || 0),
            currencyGold: Number(snapshot?.currencyGold || 0),
            currencyDiamond: Number(snapshot?.currencyDiamond || 0),
            stateVersion: { increment: 1 }
        };

        const useOptimistic = Boolean(options.useOptimisticLock) && Number.isFinite(Number(options.expectedVersion));
        if (useOptimistic) {
            const expectedVersion = Number(options.expectedVersion);
            const updated = await prisma.player.updateMany({
                where: { id: playerId, stateVersion: expectedVersion },
                data
            });
            if (!updated.count) {
                const current = await prisma.player.findUnique({
                    where: { id: playerId },
                    select: { stateVersion: true }
                });
                return {
                    ok: false,
                    conflict: true,
                    version: Number(current?.stateVersion || expectedVersion || 0)
                };
            }
            return { ok: true, version: expectedVersion + 1 };
        }

        const updated = await prisma.player.update({
            where: { id: playerId as any },
            data,
            select: { stateVersion: true }
        });
        return { ok: true, version: Number(updated.stateVersion || 0) };
    }
}
