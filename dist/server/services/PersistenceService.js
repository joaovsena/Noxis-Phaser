"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistenceService = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const hash_1 = require("../utils/hash");
const currency_1 = require("../utils/currency");
const petCatalog_1 = require("../content/petCatalog");
class PersistenceService {
    async getUser(username) {
        return await prisma_1.default.user.findUnique({
            where: { username },
            include: { players: { orderBy: { slot: 'asc' } } }
        });
    }
    async getUserById(userId) {
        return await prisma_1.default.user.findUnique({
            where: { id: userId },
            include: { players: { orderBy: { slot: 'asc' } } }
        });
    }
    async getPlayerByName(name) {
        return await prisma_1.default.player.findFirst({ where: { name } });
    }
    async createUser(username, password, profile) {
        const salt = (0, hash_1.generateSalt)();
        const passwordHash = (0, hash_1.hashPassword)(password, salt);
        const data = {
            username,
            passwordHash,
            salt
        };
        if (profile) {
            data.players = {
                create: profile
            };
        }
        return await prisma_1.default.user.create({
            data,
            include: { players: { orderBy: { slot: 'asc' } } }
        });
    }
    async createPlayerForUser(userId, slot, profile) {
        return await prisma_1.default.player.create({
            data: {
                ...profile,
                userId,
                slot
            }
        });
    }
    async savePlayer(player, options = {}) {
        const wallet = (0, currency_1.normalizeWallet)(player.wallet);
        const snapshot = {
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
    async enqueuePlayerSave(player, reason, maxAttempts = 8) {
        const wallet = (0, currency_1.normalizeWallet)(player.wallet);
        const payload = {
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
        await prisma_1.default.persistenceJob.create({
            data: {
                playerId: Number(player.id),
                kind: 'player_save',
                payload: payload,
                status: 'pending',
                attempts: 0,
                maxAttempts: Math.max(1, Math.min(20, Math.floor(Number(maxAttempts || 8)))),
                availableAt: new Date(),
                lastError: reason ? String(reason).slice(0, 250) : null
            }
        });
    }
    async processPendingPlayerSaveJobs(limit = 20) {
        const now = new Date();
        const jobs = await prisma_1.default.persistenceJob.findMany({
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
            const claimed = await prisma_1.default.persistenceJob.updateMany({
                where: { id: job.id, status: 'pending' },
                data: { status: 'processing', lockedAt: new Date(), attempts: { increment: 1 } }
            });
            if (!claimed.count)
                continue;
            const payload = job.payload;
            try {
                const result = await this.savePlayerFromSnapshot(payload, {
                    expectedVersion: Number.isFinite(Number(payload?.expectedVersion)) ? Number(payload.expectedVersion) : undefined,
                    useOptimisticLock: Number.isFinite(Number(payload?.expectedVersion))
                });
                if (result.ok || result.conflict) {
                    await prisma_1.default.persistenceJob.delete({ where: { id: job.id } });
                }
                else {
                    throw new Error('save_not_applied');
                }
                processed += 1;
            }
            catch (error) {
                const attempts = Math.max(1, Number(job.attempts || 0) + 1);
                const maxAttempts = Math.max(1, Number(job.maxAttempts || 8));
                if (attempts >= maxAttempts) {
                    await prisma_1.default.persistenceJob.update({
                        where: { id: job.id },
                        data: { status: 'failed', lastError: String(error).slice(0, 500) }
                    });
                    continue;
                }
                const backoffMs = Math.min(300000, 500 * (2 ** (attempts - 1)));
                await prisma_1.default.persistenceJob.update({
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
        return await prisma_1.default.item.findMany();
    }
    async getMobTemplates() {
        return await prisma_1.default.mobTemplate.findMany();
    }
    async getItemById(id) {
        return await prisma_1.default.item.findUnique({ where: { id } });
    }
    async createItem(item) {
        return await prisma_1.default.item.create({ data: item });
    }
    async getFriendshipsForPlayer(playerId) {
        return await prisma_1.default.friendship.findMany({
            where: {
                OR: [{ playerAId: playerId }, { playerBId: playerId }]
            }
        });
    }
    async createFriendship(playerAId, playerBId) {
        const a = Math.min(playerAId, playerBId);
        const b = Math.max(playerAId, playerBId);
        return await prisma_1.default.friendship.upsert({
            where: {
                playerAId_playerBId: { playerAId: a, playerBId: b }
            },
            update: {},
            create: { playerAId: a, playerBId: b }
        });
    }
    async deleteFriendship(playerAId, playerBId) {
        const a = Math.min(playerAId, playerBId);
        const b = Math.max(playerAId, playerBId);
        await prisma_1.default.friendship.deleteMany({
            where: { playerAId: a, playerBId: b }
        });
    }
    async findPendingFriendRequestBetween(playerAId, playerBId) {
        return await prisma_1.default.friendRequest.findFirst({
            where: {
                status: 'pending',
                OR: [
                    { fromPlayerId: playerAId, toPlayerId: playerBId },
                    { fromPlayerId: playerBId, toPlayerId: playerAId }
                ]
            }
        });
    }
    async createFriendRequest(fromPlayerId, toPlayerId, expiresAt) {
        return await prisma_1.default.friendRequest.create({
            data: { fromPlayerId, toPlayerId, expiresAt, status: 'pending' }
        });
    }
    async getPendingFriendRequestById(requestId) {
        return await prisma_1.default.friendRequest.findFirst({
            where: { id: requestId, status: 'pending' }
        });
    }
    async getPendingFriendRequestsForPlayer(playerId) {
        const [incoming, outgoing] = await Promise.all([
            prisma_1.default.friendRequest.findMany({
                where: { toPlayerId: playerId, status: 'pending' }
            }),
            prisma_1.default.friendRequest.findMany({
                where: { fromPlayerId: playerId, status: 'pending' }
            })
        ]);
        return { incoming, outgoing };
    }
    async completeFriendRequest(requestId, status) {
        await prisma_1.default.friendRequest.updateMany({
            where: { id: requestId, status: 'pending' },
            data: { status }
        });
    }
    async pruneExpiredFriendRequests(now) {
        await prisma_1.default.friendRequest.updateMany({
            where: {
                status: 'pending',
                expiresAt: { lt: now }
            },
            data: { status: 'expired' }
        });
    }
    async clearFriendRequestsForPlayer(playerId) {
        await prisma_1.default.friendRequest.updateMany({
            where: {
                status: 'pending',
                OR: [{ fromPlayerId: playerId }, { toPlayerId: playerId }]
            },
            data: { status: 'cancelled' }
        });
    }
    async getPlayerBasicByIds(ids) {
        if (!ids.length)
            return [];
        return await prisma_1.default.player.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true }
        });
    }
    async getGuildByName(name) {
        return await prisma_1.default.guild.findUnique({
            where: { name },
            include: {
                members: {
                    include: {
                        player: {
                            select: { id: true, name: true, class: true, level: true }
                        }
                    },
                    orderBy: { joinedAt: 'asc' }
                }
            }
        });
    }
    async getGuildById(guildId) {
        return await prisma_1.default.guild.findUnique({
            where: { id: guildId },
            include: {
                members: {
                    include: {
                        player: {
                            select: { id: true, name: true, class: true, level: true }
                        }
                    },
                    orderBy: { joinedAt: 'asc' }
                }
            }
        });
    }
    async getGuildMembershipForPlayer(playerId) {
        return await prisma_1.default.guildMember.findUnique({
            where: { playerId },
            include: {
                guild: {
                    include: {
                        members: {
                            include: {
                                player: {
                                    select: { id: true, name: true, class: true, level: true }
                                }
                            },
                            orderBy: { joinedAt: 'asc' }
                        }
                    }
                }
            }
        });
    }
    async createGuild(name, leaderPlayerId) {
        return await prisma_1.default.guild.create({
            data: {
                name,
                members: {
                    create: {
                        playerId: leaderPlayerId,
                        rank: 'leader'
                    }
                }
            },
            include: {
                members: {
                    include: {
                        player: {
                            select: { id: true, name: true, class: true, level: true }
                        }
                    },
                    orderBy: { joinedAt: 'asc' }
                }
            }
        });
    }
    async addGuildMember(guildId, playerId, rank = 'member') {
        return await prisma_1.default.guildMember.create({
            data: {
                guildId,
                playerId,
                rank
            }
        });
    }
    async updateGuildMemberRank(guildId, playerId, rank) {
        return await prisma_1.default.guildMember.updateMany({
            where: { guildId, playerId },
            data: { rank }
        });
    }
    async removeGuildMember(guildId, playerId) {
        await prisma_1.default.guildMember.deleteMany({
            where: { guildId, playerId }
        });
    }
    async deleteGuild(guildId) {
        await prisma_1.default.guild.deleteMany({
            where: { id: guildId }
        });
    }
    async findPendingGuildInviteBetween(guildId, fromPlayerId, toPlayerId) {
        return await prisma_1.default.guildInvite.findFirst({
            where: {
                guildId,
                fromPlayerId,
                toPlayerId,
                status: 'pending'
            }
        });
    }
    async createGuildInvite(guildId, fromPlayerId, toPlayerId, expiresAt) {
        return await prisma_1.default.guildInvite.create({
            data: {
                guildId,
                fromPlayerId,
                toPlayerId,
                expiresAt,
                status: 'pending'
            }
        });
    }
    async getPendingGuildInviteById(inviteId) {
        return await prisma_1.default.guildInvite.findFirst({
            where: {
                id: inviteId,
                status: 'pending'
            },
            include: {
                guild: true
            }
        });
    }
    async getPendingGuildInvitesForPlayer(playerId) {
        return await prisma_1.default.guildInvite.findMany({
            where: {
                toPlayerId: playerId,
                status: 'pending'
            },
            include: {
                guild: true,
                fromPlayer: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async completeGuildInvite(inviteId, status) {
        await prisma_1.default.guildInvite.updateMany({
            where: {
                id: inviteId,
                status: 'pending'
            },
            data: { status }
        });
    }
    async pruneExpiredGuildInvites(now) {
        await prisma_1.default.guildInvite.updateMany({
            where: {
                status: 'pending',
                expiresAt: { lt: now }
            },
            data: { status: 'expired' }
        });
    }
    async clearGuildInvitesForPlayer(playerId) {
        await prisma_1.default.guildInvite.updateMany({
            where: {
                status: 'pending',
                OR: [{ fromPlayerId: playerId }, { toPlayerId: playerId }]
            },
            data: { status: 'cancelled' }
        });
    }
    async getPetsForPlayer(playerId) {
        return await prisma_1.default.petOwnership.findMany({
            where: { playerId },
            orderBy: { createdAt: 'asc' }
        });
    }
    async getPetOwnershipById(ownershipId) {
        return await prisma_1.default.petOwnership.findUnique({
            where: { id: ownershipId }
        });
    }
    async createPetOwnership(playerId, templateId, name) {
        const template = (0, petCatalog_1.getPetTemplate)(templateId);
        if (!template)
            throw new Error(`unknown_pet_template:${templateId}`);
        return await prisma_1.default.petOwnership.create({
            data: {
                playerId,
                templateId,
                name: String(name || template.name || 'Pet')
            }
        });
    }
    async updatePetOwnership(ownershipId, patch) {
        const data = {};
        if (typeof patch.name === 'string')
            data.name = patch.name;
        if (Number.isFinite(Number(patch.level)))
            data.level = Math.max(1, Math.floor(Number(patch.level)));
        if (Number.isFinite(Number(patch.xp)))
            data.xp = Math.max(0, Math.floor(Number(patch.xp)));
        if (Number.isFinite(Number(patch.loyalty)))
            data.loyalty = Math.max(0, Math.min(100, Math.floor(Number(patch.loyalty))));
        if (Number.isFinite(Number(patch.hunger)))
            data.hunger = Math.max(0, Math.min(100, Math.floor(Number(patch.hunger))));
        return await prisma_1.default.petOwnership.update({
            where: { id: ownershipId },
            data
        });
    }
    async ensureStarterPetsForPlayer(playerId) {
        const existing = await prisma_1.default.petOwnership.findMany({
            where: { playerId },
            select: { templateId: true }
        });
        const existingTemplateIds = new Set(existing.map((entry) => String(entry.templateId || '')));
        const missingTemplateIds = petCatalog_1.STARTER_PET_TEMPLATE_IDS.filter((templateId) => !existingTemplateIds.has(templateId));
        if (!missingTemplateIds.length)
            return;
        for (const templateId of missingTemplateIds) {
            const template = petCatalog_1.PET_TEMPLATES[templateId];
            if (!template)
                continue;
            await prisma_1.default.petOwnership.create({
                data: {
                    playerId,
                    templateId,
                    name: String(template.name || 'Pet')
                }
            });
        }
    }
    async getActivePetForPlayer(playerId) {
        return await prisma_1.default.playerActivePet.findUnique({
            where: { playerId },
            include: { petOwnership: true }
        });
    }
    async setActivePet(playerId, petOwnershipId, behavior = 'assist') {
        return await prisma_1.default.playerActivePet.upsert({
            where: { playerId },
            update: {
                petOwnershipId,
                behavior: String(behavior || 'assist')
            },
            create: {
                playerId,
                petOwnershipId,
                behavior: String(behavior || 'assist')
            }
        });
    }
    async clearActivePet(playerId) {
        await prisma_1.default.playerActivePet.deleteMany({
            where: { playerId }
        });
    }
    async savePlayerFromSnapshot(snapshot, options = {}) {
        const playerId = Number(snapshot?.playerId);
        if (!Number.isFinite(playerId) || playerId <= 0) {
            throw new Error('invalid_player_snapshot');
        }
        const data = {
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
            const updated = await prisma_1.default.player.updateMany({
                where: { id: playerId, stateVersion: expectedVersion },
                data
            });
            if (!updated.count) {
                const current = await prisma_1.default.player.findUnique({
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
        const updated = await prisma_1.default.player.update({
            where: { id: playerId },
            data,
            select: { stateVersion: true }
        });
        return { ok: true, version: Number(updated.stateVersion || 0) };
    }
}
exports.PersistenceService = PersistenceService;
//# sourceMappingURL=PersistenceService.js.map