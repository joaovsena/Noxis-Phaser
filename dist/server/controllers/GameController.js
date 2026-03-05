"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;
const crypto_1 = require("crypto");
const hash_1 = require("../utils/hash");
const math_1 = require("../utils/math");
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class GameController {
    constructor(persistence, mobService) {
        this.players = new Map();
        this.usernameToPlayerId = new Map();
        this.groundItems = [];
        this.persistence = persistence;
        this.mobService = mobService;
    }
    async handleAuth(ws, msg) {
        if (msg.type === 'auth_register') {
            await this.handleRegister(ws, msg);
            return;
        }
        if (msg.type === 'auth_login') {
            await this.handleLogin(ws, msg);
        }
    }
    async handleRegister(ws, msg) {
        const username = String(msg.username || '').trim().toLowerCase();
        const password = String(msg.password || '');
        const name = String(msg.name || '').trim();
        const selectedClass = config_1.CLASS_TEMPLATES[msg.class] ? msg.class : 'knight';
        const gender = 'male';
        if (username.length < 3 || password.length < 3 || name.length < 3) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Preencha usuario, senha e nome com ao menos 3 caracteres.' }));
            return;
        }
        const existing = await this.persistence.getUser(username);
        if (existing) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Usuario ja existe.' }));
            return;
        }
        const existingPlayer = await this.persistence.getPlayerByName(name);
        if (existingPlayer) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Ja existe um personagem com esse nome.' }));
            return;
        }
        const baseStats = { ...config_1.CLASS_TEMPLATES[selectedClass] };
        const profile = {
            name,
            class: selectedClass,
            gender,
            level: 1,
            xp: 0,
            hp: baseStats.maxHp,
            maxHp: baseStats.maxHp,
            role: 'player',
            statusOverrides: {},
            inventory: [],
            equippedWeaponId: null,
            baseStats,
            stats: (0, math_1.levelUpStats)(baseStats, 1)
        };
        await this.persistence.createUser(username, password, profile);
        ws.send(JSON.stringify({ type: 'auth_ok', message: 'Registro concluido. Agora faca login.' }));
    }
    async handleLogin(ws, msg) {
        const username = String(msg.username || '').trim().toLowerCase();
        const password = String(msg.password || '');
        try {
            const account = await this.persistence.getUser(username);
            if (!account || !account.player) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Usuario ou senha invalidos.' }));
                return;
            }
            const incomingHash = (0, hash_1.hashPassword)(password, account.salt);
            if (incomingHash !== account.passwordHash) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Usuario ou senha invalidos.' }));
                return;
            }
            if (this.usernameToPlayerId.has(username)) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Esse usuario ja esta online.' }));
                return;
            }
            const player = this.createRuntimePlayer(username, account.player);
            player.ws = ws;
            this.players.set(player.id, player);
            this.usernameToPlayerId.set(username, player.id);
            ws.playerId = player.id;
            ws.send(JSON.stringify({
                type: 'auth_success',
                playerId: player.id,
                world: config_1.WORLD,
                role: player.role,
                statusIds: config_1.STATUS_IDS
            }));
            ws.send(JSON.stringify({
                type: 'inventory_state',
                inventory: player.inventory,
                equippedWeaponId: player.equippedWeaponId
            }));
            ws.send(JSON.stringify(this.buildWorldSnapshot(player.mapId, player.mapKey)));
            (0, logger_1.logEvent)('INFO', 'user_login', { username, playerId: player.id });
        }
        catch (error) {
            (0, logger_1.logEvent)('ERROR', 'login_error', { username, error: String(error) });
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Erro ao fazer login.' }));
        }
    }
    createRuntimePlayer(username, profile) {
        const spawn = { x: 400 + Math.floor(Math.random() * 600), y: 400 + Math.floor(Math.random() * 600) };
        const parsedId = Number(profile?.id);
        const id = Number.isInteger(parsedId) ? parsedId : Math.floor(Date.now() % 2147483647);
        const maxHp = profile.stats.maxHp || profile.baseStats.maxHp || 100;
        const runtime = {
            ...profile,
            id,
            ws: null,
            username,
            inventory: this.normalizeInventorySlots(Array.isArray(profile.inventory) ? profile.inventory : []),
            mapKey: config_1.DEFAULT_MAP_KEY,
            mapId: config_1.DEFAULT_MAP_ID,
            x: spawn.x,
            y: spawn.y,
            targetX: spawn.x,
            targetY: spawn.y,
            autoAttackActive: false,
            attackTargetId: null,
            lastAttackAt: 0,
            lastCombatAt: 0,
            lastPortalAt: 0
        };
        this.recomputePlayerStats(runtime);
        return runtime;
    }
    handleMove(player, msg) {
        const incomingX = Number(msg.x);
        const incomingY = Number(msg.y);
        player.autoAttackActive = false;
        player.attackTargetId = null;
        player.targetX = (0, math_1.clamp)(Number.isFinite(incomingX) ? incomingX : player.x, 0, config_1.WORLD.width);
        player.targetY = (0, math_1.clamp)(Number.isFinite(incomingY) ? incomingY : player.y, 0, config_1.WORLD.height);
        player.ws.send(JSON.stringify({
            type: 'move_ack',
            reqId: msg.reqId,
            targetX: player.targetX,
            targetY: player.targetY
        }));
    }
    handleTargetMob(player, msg) {
        const mobId = String(msg.mobId || '');
        const mob = this.mobService.getMobs().find((m) => m.id === mobId && m.mapId === this.mapInstanceId(player.mapKey, player.mapId));
        if (!mob) {
            player.autoAttackActive = false;
            player.attackTargetId = null;
            return;
        }
        player.autoAttackActive = true;
        player.attackTargetId = mob.id;
    }
    handleChat(player, msg) {
        const scope = msg.scope === 'global' || msg.scope === 'map' ? msg.scope : 'local';
        const text = String(msg.text || '').trim();
        if (!text)
            return;
        const payload = {
            type: 'chat_message',
            id: (0, crypto_1.randomUUID)(),
            fromId: player.id,
            scope,
            from: player.name,
            mapId: player.mapId,
            mapKey: player.mapKey,
            text: text.slice(0, 180),
            at: Date.now()
        };
        if (scope === 'global') {
            this.broadcastRaw(payload);
            return;
        }
        this.sendRaw(player.ws, payload);
        for (const receiver of this.players.values()) {
            if (receiver.id === player.id)
                continue;
            if (scope === 'map') {
                if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey)
                    continue;
                this.sendRaw(receiver.ws, payload);
                continue;
            }
            if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey)
                continue;
            if ((0, math_1.distance)(receiver, player) > config_1.LOCAL_CHAT_RADIUS)
                continue;
            this.sendRaw(receiver.ws, payload);
        }
    }
    handleSwitchInstance(player, msg) {
        const target = config_1.MAP_IDS.includes(msg.mapId) ? msg.mapId : null;
        if (!target || target === player.mapId)
            return;
        const inCombat = Date.now() - (player.lastCombatAt || 0) < config_1.COMBAT_LOCK_MS;
        if (inCombat) {
            player.ws.send(JSON.stringify({ type: 'system_message', text: 'Voce esta em combate. Aguarde 10s sem atacar.' }));
            return;
        }
        // Regra pedida: ao trocar E1 <-> E2, mantem a mesma coordenada X,Y.
        player.mapId = target;
        player.targetX = player.x;
        player.targetY = player.y;
        player.attackTargetId = null;
        player.autoAttackActive = false;
        player.ws.send(JSON.stringify({ type: 'system_message', text: `Instancia alterada para ${target}.` }));
    }
    handlePickupItem(player, msg) {
        const itemId = String(msg.itemId || '');
        const index = this.groundItems.findIndex((it) => it.id === itemId && it.mapId === this.mapInstanceId(player.mapKey, player.mapId));
        if (index === -1)
            return;
        const item = this.groundItems[index];
        if ((0, math_1.distance)(player, item) > config_1.ITEM_PICKUP_RANGE)
            return;
        const freeSlot = this.firstFreeInventorySlot(player.inventory);
        if (freeSlot === -1)
            return;
        this.groundItems.splice(index, 1);
        player.inventory.push({ ...item, slotIndex: freeSlot });
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleEquipItem(player, msg) {
        const itemId = msg.itemId ? String(msg.itemId) : null;
        if (!itemId) {
            player.equippedWeaponId = null;
            this.recomputePlayerStats(player);
            this.persistPlayer(player);
            this.sendInventoryState(player);
            return;
        }
        const found = player.inventory.find((it) => it.id === itemId && it.type === 'weapon');
        if (!found)
            return;
        player.equippedWeaponId = found.id;
        this.recomputePlayerStats(player);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleInventoryMove(player, msg) {
        const itemId = String(msg.itemId || '');
        const toSlot = Number(msg.toSlot);
        if (!Number.isInteger(toSlot) || toSlot < 0 || toSlot >= config_1.INVENTORY_SIZE)
            return;
        const item = player.inventory.find((it) => it.id === itemId);
        if (!item)
            return;
        const occupant = player.inventory.find((it) => it.slotIndex === toSlot);
        const fromSlot = item.slotIndex;
        item.slotIndex = toSlot;
        if (occupant && occupant.id !== item.id)
            occupant.slotIndex = fromSlot;
        player.inventory = this.normalizeInventorySlots(player.inventory);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleInventorySort(player) {
        const sorted = [...player.inventory].sort((a, b) => {
            const byName = String(a.name || '').localeCompare(String(b.name || ''));
            if (byName !== 0)
                return byName;
            return String(a.id).localeCompare(String(b.id));
        });
        for (let i = 0; i < sorted.length && i < config_1.INVENTORY_SIZE; i++) {
            sorted[i].slotIndex = i;
        }
        player.inventory = this.normalizeInventorySlots(sorted);
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
        player.inventory.splice(index, 1);
        player.inventory = this.normalizeInventorySlots(player.inventory);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleInventoryUnequipToSlot(player, msg) {
        const itemId = String(msg.itemId || '');
        const toSlot = Number(msg.toSlot);
        if (!Number.isInteger(toSlot) || toSlot < 0 || toSlot >= config_1.INVENTORY_SIZE)
            return;
        if (player.equippedWeaponId !== itemId)
            return;
        const item = player.inventory.find((it) => it.id === itemId);
        if (!item)
            return;
        const occupant = player.inventory.find((it) => it.slotIndex === toSlot && it.id !== itemId);
        const fromSlot = item.slotIndex;
        item.slotIndex = toSlot;
        if (occupant)
            occupant.slotIndex = fromSlot;
        player.equippedWeaponId = null;
        this.recomputePlayerStats(player);
        player.inventory = this.normalizeInventorySlots(player.inventory);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }
    handleAdminCommand(player, msg) {
        if (player.role !== 'adm')
            return;
        const raw = String(msg.command || '').trim();
        const parts = raw.split(/\s+/);
        if (parts.length < 4 || parts[0].toLowerCase() !== 'setstatus') {
            this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Uso: setstatus {id} {quantia} {jogador}' });
            return;
        }
        const statusId = String(parts[1]);
        const key = config_1.STATUS_BY_ID[statusId];
        const value = Number(parts[2]);
        const username = String(parts[3]).toLowerCase();
        const target = [...this.players.values()].find((p) => p.username === username);
        if (!key || !Number.isFinite(value) || !target) {
            this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Comando invalido.' });
            return;
        }
        target.statusOverrides = target.statusOverrides || {};
        target.statusOverrides[key] = value;
        this.recomputePlayerStats(target);
        this.persistPlayer(target);
        this.sendInventoryState(target);
        this.sendRaw(player.ws, { type: 'admin_result', ok: true, message: `Status ${key} de ${username} = ${value}` });
    }
    tick(deltaSeconds, now) {
        for (const player of this.players.values()) {
            this.movePlayerTowardTarget(player, deltaSeconds);
            this.processPortalCollision(player, now);
            this.processAutoAttack(player, now);
        }
    }
    buildWorldSnapshot(mapId = config_1.DEFAULT_MAP_ID, mapKey = config_1.DEFAULT_MAP_KEY) {
        const mapInstanceId = this.mapInstanceId(mapKey, mapId);
        const publicPlayers = {};
        for (const [id, player] of this.players.entries()) {
            if (player.mapId !== mapId || player.mapKey !== mapKey)
                continue;
            publicPlayers[String(id)] = this.sanitizePublicPlayer(player);
        }
        return {
            type: 'world_state',
            players: publicPlayers,
            mobs: this.mobService.getMobsByMap(mapInstanceId),
            groundItems: this.groundItems.filter((it) => it.mapId === mapInstanceId),
            mapKey,
            mapTheme: config_1.MAP_THEMES[mapKey] || 'forest',
            portals: config_1.PORTALS_BY_MAP_KEY[mapKey] || [],
            mapId,
            world: config_1.WORLD
        };
    }
    getPlayerByRuntimeId(playerId) {
        return this.players.get(playerId);
    }
    async handleDisconnect(playerId) {
        const player = this.players.get(playerId);
        if (!player)
            return;
        await this.persistence.savePlayer(player);
        this.usernameToPlayerId.delete(player.username);
        this.players.delete(playerId);
    }
    firstFreeInventorySlot(items) {
        const used = new Set(items.map((it) => it.slotIndex).filter((n) => Number.isInteger(n)));
        for (let i = 0; i < config_1.INVENTORY_SIZE; i++) {
            if (!used.has(i))
                return i;
        }
        return -1;
    }
    sanitizePublicPlayer(player) {
        const weapon = Array.isArray(player.inventory) ? player.inventory.find((it) => it.id === player.equippedWeaponId) : null;
        return {
            id: player.id,
            username: player.username,
            name: player.name,
            class: player.class,
            gender: player.gender,
            x: player.x,
            y: player.y,
            mapKey: player.mapKey,
            mapId: player.mapId,
            role: player.role || 'player',
            level: player.level,
            hp: player.hp,
            maxHp: player.maxHp,
            equippedWeaponName: weapon ? weapon.name : null,
            xp: player.xp,
            xpToNext: (0, math_1.xpRequired)(player.level),
            stats: player.stats
        };
    }
    movePlayerTowardTarget(player, deltaSeconds) {
        const rawMoveSpeed = Number(player.stats?.moveSpeed);
        const moveSpeedStat = Number.isFinite(rawMoveSpeed) && rawMoveSpeed > 0 ? rawMoveSpeed : 100;
        const speed = config_1.BASE_MOVE_SPEED * (moveSpeedStat / 100);
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 0.01)
            return;
        const step = speed * deltaSeconds;
        if (step >= dist) {
            player.x = player.targetX;
            player.y = player.targetY;
            return;
        }
        player.x += (dx / dist) * step;
        player.y += (dy / dist) * step;
    }
    processAutoAttack(player, now) {
        if (!player.autoAttackActive || !player.attackTargetId)
            return;
        const mob = this.mobService.getMobs().find((m) => m.id === player.attackTargetId && m.mapId === this.mapInstanceId(player.mapKey, player.mapId));
        if (!mob) {
            player.autoAttackActive = false;
            player.attackTargetId = null;
            return;
        }
        const currentDistance = (0, math_1.distance)(player, mob);
        const edgeDistance = currentDistance - (mob.size / 2 + config_1.PLAYER_HALF_SIZE);
        const attackRange = Number(player.stats?.attackRange || 60);
        const inRange = edgeDistance <= attackRange;
        if (!inRange) {
            const desiredDistance = mob.size / 2 + config_1.PLAYER_HALF_SIZE + Math.max(2, attackRange - 4);
            const dx = player.x - mob.x;
            const dy = player.y - mob.y;
            const norm = Math.sqrt(dx * dx + dy * dy) || 1;
            player.targetX = (0, math_1.clamp)(mob.x + (dx / norm) * desiredDistance, 0, config_1.WORLD.width);
            player.targetY = (0, math_1.clamp)(mob.y + (dy / norm) * desiredDistance, 0, config_1.WORLD.height);
            return;
        }
        player.targetX = player.x;
        player.targetY = player.y;
        const rawAttackSpeed = Number(player.stats?.attackSpeed);
        const attackSpeedStat = Number.isFinite(rawAttackSpeed) && rawAttackSpeed > 0 ? rawAttackSpeed : 100;
        const attackIntervalMs = 1000 * (100 / attackSpeedStat);
        if (now - player.lastAttackAt < attackIntervalMs)
            return;
        player.lastAttackAt = now;
        let rawAttack = Number(player.stats?.physicalAttack || 1);
        let mobDefense = mob.physicalDefense;
        if (player.stats?.damageType === 'magic') {
            rawAttack = Number(player.stats?.magicAttack || 1);
            mobDefense = mob.magicDefense;
        }
        const damage = Math.max(1, Math.floor(rawAttack - mobDefense * 0.5));
        mob.hp = Math.max(0, mob.hp - damage);
        player.lastCombatAt = now;
        for (const receiver of this.players.values()) {
            if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey)
                continue;
            try {
                receiver.ws?.send(JSON.stringify({
                    type: 'combat_hit',
                    attackerId: player.id,
                    mobId: mob.id,
                    attackerX: player.x,
                    attackerY: player.y,
                    mobX: mob.x,
                    mobY: mob.y
                }));
            }
            catch {
                // Ignore socket send failures; cleanup happens on disconnect.
            }
        }
        if (mob.hp === 0) {
            this.grantXp(player, mob.xpReward);
            if (Math.random() < 0.5) {
                this.dropWeaponAt(mob.x, mob.y, this.mapInstanceId(player.mapKey, player.mapId));
            }
            this.mobService.removeMob(mob.id);
        }
    }
    processPortalCollision(player, now) {
        if (now - (player.lastPortalAt || 0) < config_1.PORTAL_COOLDOWN_MS)
            return;
        const portals = config_1.PORTALS_BY_MAP_KEY[player.mapKey] || [];
        for (const portal of portals) {
            const insideX = player.x >= portal.x && player.x <= portal.x + portal.w;
            const insideY = player.y >= portal.y && player.y <= portal.y + portal.h;
            if (!insideX || !insideY)
                continue;
            player.mapKey = portal.toMapKey;
            player.x = (0, math_1.clamp)(portal.toX, 0, config_1.WORLD.width);
            player.y = (0, math_1.clamp)(portal.toY, 0, config_1.WORLD.height);
            player.targetX = player.x;
            player.targetY = player.y;
            player.attackTargetId = null;
            player.autoAttackActive = false;
            player.lastPortalAt = now;
            player.ws?.send(JSON.stringify({ type: 'system_message', text: `Portal: ${portal.toMapKey.toUpperCase()}` }));
            return;
        }
    }
    mapInstanceId(mapKey, mapId) {
        return (0, config_1.composeMapInstanceId)(mapKey, mapId);
    }
    grantXp(player, amount) {
        player.xp += amount;
        let next = (0, math_1.xpRequired)(player.level);
        while (player.xp >= next) {
            player.xp -= next;
            player.level += 1;
            next = (0, math_1.xpRequired)(player.level);
        }
        this.recomputePlayerStats(player);
        this.persistPlayer(player);
    }
    normalizeInventorySlots(items) {
        const out = [];
        const used = new Set();
        for (const item of items) {
            const clone = { ...item };
            if (!Number.isInteger(clone.slotIndex) || clone.slotIndex < 0 || clone.slotIndex >= config_1.INVENTORY_SIZE || used.has(clone.slotIndex)) {
                clone.slotIndex = this.firstFreeInventorySlot(out);
            }
            if (clone.slotIndex === -1)
                continue;
            used.add(clone.slotIndex);
            out.push(clone);
        }
        return out;
    }
    getEquippedWeapon(player) {
        if (!player.equippedWeaponId)
            return null;
        return Array.isArray(player.inventory) ? player.inventory.find((item) => item.id === player.equippedWeaponId) || null : null;
    }
    recomputePlayerStats(player) {
        const leveled = (0, math_1.levelUpStats)(player.baseStats, player.level);
        const overrides = player.statusOverrides && typeof player.statusOverrides === 'object' ? player.statusOverrides : {};
        for (const [key, value] of Object.entries(overrides)) {
            if (typeof leveled[key] === 'number' && Number.isFinite(value)) {
                leveled[key] = value;
            }
        }
        const weapon = this.getEquippedWeapon(player);
        if (weapon && weapon.bonuses) {
            player.stats = {
                ...leveled,
                physicalAttack: Number(leveled.physicalAttack || 0) + Number(weapon.bonuses.physicalAttack || 0),
                magicAttack: Number(leveled.magicAttack || 0) + Number(weapon.bonuses.magicAttack || 0),
                moveSpeed: Number(leveled.moveSpeed || 0) + Number(weapon.bonuses.moveSpeed || 0),
                attackSpeed: Number(leveled.attackSpeed || 0) + Number(weapon.bonuses.attackSpeed || 0)
            };
        }
        else {
            player.stats = leveled;
        }
        player.maxHp = Number(leveled.maxHp || player.maxHp || 100);
        player.hp = (0, math_1.clamp)(Number(player.hp || player.maxHp), 1, player.maxHp);
    }
    sendInventoryState(player) {
        this.sendRaw(player.ws, {
            type: 'inventory_state',
            inventory: [...player.inventory].sort((a, b) => Number(a.slotIndex) - Number(b.slotIndex)),
            equippedWeaponId: player.equippedWeaponId
        });
    }
    dropWeaponAt(x, y, mapId) {
        this.groundItems.push({
            id: (0, crypto_1.randomUUID)(),
            type: 'weapon',
            name: config_1.WEAPON_TEMPLATE.name,
            slot: config_1.WEAPON_TEMPLATE.slot,
            bonuses: { ...config_1.WEAPON_TEMPLATE.bonuses },
            x,
            y,
            mapId
        });
    }
    persistPlayer(player) {
        void this.persistence.savePlayer(player).catch((error) => {
            (0, logger_1.logEvent)('ERROR', 'save_player_error', { playerId: player.id, error: String(error) });
        });
    }
    sendRaw(ws, payload) {
        try {
            ws?.send(JSON.stringify(payload));
        }
        catch {
            // Ignore socket send failures; cleanup happens on disconnect.
        }
    }
    broadcastRaw(payload) {
        for (const player of this.players.values()) {
            this.sendRaw(player.ws, payload);
        }
    }
}
exports.GameController = GameController;
//# sourceMappingURL=GameController.js.map