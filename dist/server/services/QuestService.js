"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestService = void 0;
const math_1 = require("../utils/math");
const config_1 = require("../config");
const npcs_1 = require("../content/npcs");
const dungeons_1 = require("../content/dungeons");
const QUESTS = [
    {
        id: 'q_forest_hunt_01',
        category: 'main',
        title: 'Limpeza da Clareira',
        description: 'Guarda Alden precisa reduzir a pressao de monstros na borda da aldeia antes do amanhecer.',
        giverNpcId: 'npc_guard_alden',
        turnInNpcId: 'npc_guard_alden',
        objectives: [
            { id: 'kill_outskirts', type: 'kill', targetKinds: ['normal', 'elite'], mapKey: 'forest', required: 6, text: 'Derrote 6 monstros na borda da aldeia' }
        ],
        rewards: {
            xp: 120,
            currency: { copper: 70, silver: 2 },
            items: [{ templateId: 'potion_hp', quantity: 2 }]
        }
    },
    {
        id: 'q_forest_report_01',
        category: 'main',
        title: 'Relatorio de Campo',
        description: 'Alden quer um relatorio atualizado da ponte. Fale com Lina e volte com a situacao da patrulha.',
        giverNpcId: 'npc_guard_alden',
        turnInNpcId: 'npc_guard_alden',
        requiresCompletedIds: ['q_forest_hunt_01'],
        objectives: [
            { id: 'talk_lina', type: 'talk', npcId: 'npc_scout_lina', required: 1, text: 'Converse com a Exploradora Lina' }
        ],
        rewards: {
            xp: 140,
            currency: { silver: 4 },
            items: [{ classEquipmentSlot: 'boots', quantity: 1 }]
        }
    },
    {
        id: 'q_forest_supply_01',
        category: 'main',
        title: 'Suprimentos de Emergencia',
        description: 'Selene quer reorganizar a retaguarda. Coordene reforcos com Borin e Tessa.',
        giverNpcId: 'npc_curandeira_selene',
        turnInNpcId: 'npc_curandeira_selene',
        requiresCompletedIds: ['q_forest_report_01'],
        objectives: [
            { id: 'talk_borin_supply', type: 'talk', npcId: 'npc_ferreiro_borin', required: 1, text: 'Converse com Borin sobre armaduras de campanha' },
            { id: 'talk_tessa_supply', type: 'talk', npcId: 'npc_mercadora_tessa', required: 1, text: 'Converse com Tessa sobre mantimentos' }
        ],
        rewards: {
            xp: 180,
            currency: { silver: 5, copper: 20 },
            items: [
                { classEquipmentSlot: 'gloves', quantity: 1 },
                { templateId: 'potion_hp', quantity: 2 }
            ]
        }
    },
    {
        id: 'q_forest_rift_01',
        category: 'main',
        title: 'Sinais da Fenda',
        description: 'Lina detectou presencas mais agressivas perto da fenda. Abata os alvos perigosos e retorne.',
        giverNpcId: 'npc_scout_lina',
        turnInNpcId: 'npc_guard_alden',
        requiresCompletedIds: ['q_forest_supply_01'],
        objectives: [
            { id: 'kill_elites', type: 'kill', targetKinds: ['elite', 'subboss'], mapKey: 'forest', required: 3, text: 'Derrote 3 elites ou subchefes na floresta' }
        ],
        rewards: {
            xp: 220,
            currency: { silver: 7 },
            items: [{ classEquipmentSlot: 'helmet', quantity: 1 }]
        }
    },
    {
        id: 'q_forest_ruins_prep_01',
        category: 'main',
        title: 'Preparacao para as Ruinas',
        description: 'Alden so abrira passagem para as ruinas quando voce revisar postura e equipamento com Rowan e Borin.',
        giverNpcId: 'npc_guard_alden',
        turnInNpcId: 'npc_dungeon_warden',
        requiresCompletedIds: ['q_forest_rift_01'],
        objectives: [
            { id: 'talk_rowan_prep', type: 'talk', npcId: 'npc_mestre_rowan', required: 1, text: 'Consulte Rowan sobre combate e hotbar' },
            { id: 'talk_borin_prep', type: 'talk', npcId: 'npc_ferreiro_borin', required: 1, text: 'Revise seu equipamento com Borin' }
        ],
        rewards: {
            xp: 240,
            currency: { silver: 8 },
            items: [{ classEquipmentSlot: 'chest', quantity: 1 }]
        }
    },
    {
        id: 'q_forest_dungeon_01',
        category: 'main',
        title: 'Ruinas de Alder',
        description: 'Entre nas ruinas e derrote o Guardiao das Ruinas para estabilizar a fronteira da aldeia.',
        giverNpcId: 'npc_dungeon_warden',
        turnInNpcId: 'npc_guard_alden',
        requiresCompletedIds: ['q_forest_ruins_prep_01'],
        objectives: [
            { id: 'kill_ruins_boss', type: 'kill', targetKinds: ['boss'], mapKey: 'dng_forest_ruins_mvp', required: 1, text: 'Derrote o Guardiao das Ruinas' }
        ],
        rewards: {
            xp: 420,
            currency: { gold: 1, silver: 20 },
            items: [
                { templateId: 'weapon_rubi', quantity: 1 },
                { templateId: 'skill_reset_hourglass', quantity: 1 }
            ]
        }
    },
    {
        id: 'q_forest_storage_01',
        category: 'side',
        title: 'Cofre Organizado',
        description: 'Zenon quer garantir que os aventureiros conhecam o deposito da aldeia. Fale com Marek e volte.',
        giverNpcId: 'npc_bau_zenon',
        turnInNpcId: 'npc_bau_zenon',
        requiresCompletedIds: ['q_forest_hunt_01'],
        objectives: [
            { id: 'talk_marek_storage', type: 'talk', npcId: 'npc_cidadao_marek', required: 1, text: 'Converse com Marek sobre mantimentos e armazenamento' }
        ],
        rewards: {
            xp: 90,
            currency: { copper: 90 },
            items: [{ classEquipmentSlot: 'pants', quantity: 1 }]
        }
    },
    {
        id: 'q_forest_market_01',
        category: 'side',
        title: 'Circuito do Mercado',
        description: 'Marek precisa alinhar o fluxo do mercado. Passe por Tessa e Borin antes de retornar.',
        giverNpcId: 'npc_cidadao_marek',
        turnInNpcId: 'npc_cidadao_marek',
        requiresCompletedIds: ['q_forest_report_01'],
        objectives: [
            { id: 'talk_tessa_market', type: 'talk', npcId: 'npc_mercadora_tessa', required: 1, text: 'Converse com Tessa sobre os suprimentos do mercado' },
            { id: 'talk_borin_market', type: 'talk', npcId: 'npc_ferreiro_borin', required: 1, text: 'Converse com Borin sobre o fluxo de encomendas' }
        ],
        rewards: {
            xp: 110,
            currency: { silver: 3 },
            items: [{ templateId: 'potion_hp', quantity: 3 }]
        }
    },
    {
        id: 'q_forest_rowan_01',
        category: 'side',
        title: 'Treino de Rowan',
        description: 'Rowan quer ver se voce consegue manter controle no campo antes de avancar para as ruinas.',
        giverNpcId: 'npc_mestre_rowan',
        turnInNpcId: 'npc_mestre_rowan',
        requiresCompletedIds: ['q_forest_supply_01'],
        objectives: [
            { id: 'kill_normals_rowan', type: 'kill', targetKinds: ['normal'], mapKey: 'forest', required: 5, text: 'Derrote 5 monstros comuns na floresta' }
        ],
        rewards: {
            xp: 140,
            currency: { silver: 4 },
            items: [{ classEquipmentSlot: 'ring', quantity: 1 }]
        }
    },
    {
        id: 'q_forest_selene_01',
        category: 'side',
        title: 'Linha de Socorro',
        description: 'Selene precisa de mais espaco para tratar os feridos. Reduza a pressao dos elites proximos a aldeia.',
        giverNpcId: 'npc_curandeira_selene',
        turnInNpcId: 'npc_curandeira_selene',
        requiresCompletedIds: ['q_forest_supply_01'],
        objectives: [
            { id: 'kill_elites_selene', type: 'kill', targetKinds: ['elite', 'subboss'], mapKey: 'forest', required: 2, text: 'Derrote 2 elites ou subchefes perto da aldeia' }
        ],
        rewards: {
            xp: 150,
            currency: { silver: 5 },
            items: [
                { classEquipmentSlot: 'necklace', quantity: 1 },
                { templateId: 'potion_hp', quantity: 3 }
            ]
        }
    },
    {
        id: 'q_lava_watch_01',
        category: 'main',
        title: 'Vigia das Brasas',
        description: 'Kael precisa de uma primeira varredura segura nas bordas de lava antes de liberar a travessia completa.',
        giverNpcId: 'npc_vigia_kael',
        turnInNpcId: 'npc_vigia_kael',
        requiresCompletedIds: ['q_forest_dungeon_01'],
        objectives: [
            { id: 'kill_lava_front', type: 'kill', targetKinds: ['normal'], mapKey: 'lava', required: 6, text: 'Derrote 6 monstros comuns nas bordas de lava' }
        ],
        rewards: {
            xp: 280,
            currency: { silver: 10, copper: 40 },
            items: [{ classWeapon: true, tier: 2, rarity: 'verde', quality: 'bom', quantity: 1 }]
        }
    },
    {
        id: 'q_lava_ember_01',
        category: 'main',
        title: 'Brasas Coletadas',
        description: 'Iris precisa de amostras do campo de magma para reforcar equipamentos e preparar a avancada.',
        giverNpcId: 'npc_pesquisadora_iris',
        turnInNpcId: 'npc_pesquisadora_iris',
        requiresCompletedIds: ['q_lava_watch_01'],
        objectives: [
            { id: 'collect_lava_ember', type: 'collect', templateId: 'material_lava_ember', required: 4, text: 'Colete 4 Brasas de Lava' },
            { id: 'collect_lava_ore', type: 'collect', templateId: 'material_lava_ore', required: 2, text: 'Colete 2 Minerios de Obsidiana' }
        ],
        rewards: {
            xp: 320,
            currency: { silver: 14 },
            items: [
                { classEquipmentSlot: 'ring', tier: 2, rarity: 'verde', quality: 'otimo', quantity: 1 },
                { templateId: 'potion_hp_major', quantity: 2 }
            ]
        }
    },
    {
        id: 'q_lava_crater_01',
        category: 'main',
        title: 'Cratera da Vigia',
        description: 'Kael quer o caminho ate a cratera principal estabilizado. Elimine as maiores ameacas e retorne com o relatorio.',
        giverNpcId: 'npc_vigia_kael',
        turnInNpcId: 'npc_pesquisadora_iris',
        requiresCompletedIds: ['q_lava_ember_01'],
        objectives: [
            { id: 'kill_lava_elites', type: 'kill', targetKinds: ['elite', 'subboss'], mapKey: 'lava', required: 3, text: 'Derrote 3 elites ou subchefes na lava' }
        ],
        rewards: {
            xp: 380,
            currency: { gold: 1, silver: 4 },
            items: [
                { classEquipmentSlot: 'chest', tier: 2, rarity: 'azul', quality: 'bom', quantity: 1 },
                { templateId: 'material_lava_ore', quantity: 3 }
            ]
        }
    },
    {
        id: 'q_undead_watch_01',
        category: 'main',
        title: 'Lamparinas no Brejo',
        description: 'Sera precisa reduzir a presenca dos mortos-vivos na entrada do brejo antes do cair da noite.',
        giverNpcId: 'npc_exorcista_sera',
        turnInNpcId: 'npc_exorcista_sera',
        requiresCompletedIds: ['q_lava_crater_01'],
        objectives: [
            { id: 'kill_undead_front', type: 'kill', targetKinds: ['normal'], mapKey: 'undead', required: 7, text: 'Derrote 7 mortos-vivos comuns no brejo' }
        ],
        rewards: {
            xp: 430,
            currency: { gold: 1, silver: 18 },
            items: [{ classWeapon: true, tier: 3, rarity: 'azul', quality: 'bom', quantity: 1 }]
        }
    },
    {
        id: 'q_undead_relics_01',
        category: 'side',
        title: 'Restos que Falam',
        description: 'Doran pede restos uteis do cemitério e quer que voce o informe sobre a atividade perto do mausoleu.',
        giverNpcId: 'npc_coveiro_doran',
        turnInNpcId: 'npc_coveiro_doran',
        requiresCompletedIds: ['q_undead_watch_01'],
        objectives: [
            { id: 'collect_bone', type: 'collect', templateId: 'material_undead_bone', required: 4, text: 'Colete 4 Ossos Malditos' },
            { id: 'collect_ectoplasm', type: 'collect', templateId: 'material_undead_ectoplasm', required: 2, text: 'Colete 2 Ectoplasmas' }
        ],
        rewards: {
            xp: 340,
            currency: { silver: 28 },
            items: [
                { classEquipmentSlot: 'necklace', tier: 3, rarity: 'azul', quality: 'otimo', quantity: 1 },
                { templateId: 'potion_hp_major', quantity: 3 }
            ]
        }
    },
    {
        id: 'q_undead_mausoleum_01',
        category: 'main',
        title: 'Portao do Mausoleu',
        description: 'Sera precisa de uma abertura segura para o mausoleu. Derrube as liderancas da nevoa e limpe o acesso.',
        giverNpcId: 'npc_exorcista_sera',
        turnInNpcId: 'npc_exorcista_sera',
        requiresCompletedIds: ['q_undead_relics_01'],
        objectives: [
            { id: 'kill_undead_elites', type: 'kill', targetKinds: ['elite', 'subboss'], mapKey: 'undead', required: 3, text: 'Derrote 3 elites ou subchefes no territorio morto-vivo' }
        ],
        rewards: {
            xp: 520,
            currency: { gold: 2, silver: 40 },
            items: [
                { classEquipmentSlot: 'chest', tier: 3, rarity: 'roxo', quality: 'bom', quantity: 1 },
                { templateId: 'skill_reset_hourglass', quantity: 1 }
            ]
        }
    }
];
const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
class QuestService {
    constructor(sendRaw, persistPlayer, persistPlayerCritical, grantXp, grantRewardItem, grantCurrency, getDungeonUiState) {
        this.sendRaw = sendRaw;
        this.persistPlayer = persistPlayer;
        this.persistPlayerCritical = persistPlayerCritical;
        this.grantXp = grantXp;
        this.grantRewardItem = grantRewardItem;
        this.grantCurrency = grantCurrency;
        this.getDungeonUiState = getDungeonUiState;
    }
    getNpcsForMap(mapKey, mapId) {
        return npcs_1.NPCS.filter((n) => n.mapKey === mapKey && n.mapId === mapId).map((n) => ({
            id: n.id,
            name: n.name,
            x: n.x,
            y: n.y,
            role: n.role,
            spriteKey: n.spriteKey || null,
            hitbox: n.hitbox || { w: 54, h: 80, offsetX: 0, offsetY: 0 },
            anchor: n.anchor || { x: 0.5, y: 1 },
            interactRange: Number(n.interactRange || npcs_1.NPC_INTERACT_RANGE)
        }));
    }
    getNpcById(npcId) {
        return npcs_1.NPC_BY_ID[String(npcId || '')] || null;
    }
    getShopOffers(npcId) {
        const defs = config_1.NPC_SHOPS[String(npcId || '')] || [];
        return defs
            .map((entry) => {
            const template = config_1.BUILTIN_ITEM_TEMPLATE_BY_ID[String(entry.templateId || '')];
            if (!template)
                return null;
            return {
                offerId: String(entry.offerId || ''),
                npcId: String(npcId || ''),
                templateId: String(template.id || template.type || ''),
                name: String(template.name || 'Item'),
                spriteId: template.spriteId ? String(template.spriteId) : null,
                iconUrl: template.iconUrl ? String(template.iconUrl) : '/assets/ui/items/placeholder-transparent.svg',
                type: String(template.type || 'misc'),
                slot: String(template.slot || 'misc'),
                quantity: Math.max(1, Number(entry.quantity || 1)),
                requiredClass: template.requiredClass ? String(template.requiredClass) : null,
                requiredLevel: Number.isFinite(Number(template.requiredLevel)) ? Number(template.requiredLevel) : null,
                quality: template.quality ? String(template.quality) : 'normal',
                bonusPercents: template.bonusPercents || {},
                price: template.price || {},
                bonuses: template.bonuses || {}
            };
        })
            .filter(Boolean);
    }
    sendQuestState(player) {
        this.sendRaw(player.ws, {
            type: 'quest.state',
            quests: this.buildQuestStatePayload(player)
        });
    }
    handleNpcInteract(player, msg) {
        const npcId = String(msg?.npcId || '');
        const npc = npcs_1.NPC_BY_ID[npcId];
        if (!npc)
            return;
        if (npc.mapKey !== player.mapKey || npc.mapId !== player.mapId)
            return;
        const interactRange = Number(npc.interactRange || npcs_1.NPC_INTERACT_RANGE);
        if ((0, math_1.distance)(player, npc) > interactRange) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Voce esta longe demais do NPC.' });
            return;
        }
        const changedByTalk = this.applyTalkProgress(player, npc.id);
        const questState = this.getQuestState(player);
        const availableQuestIds = QUESTS
            .filter((q) => q.giverNpcId === npc.id)
            .filter((q) => this.isQuestAvailableForPlayer(q, questState))
            .map((q) => q.id);
        const activeQuestIds = QUESTS
            .filter((q) => q.giverNpcId === npc.id || q.turnInNpcId === npc.id)
            .filter((q) => {
            const entry = questState.accepted[q.id];
            return Boolean(entry && entry.status === 'active');
        })
            .map((q) => q.id);
        const turnInQuestIds = QUESTS
            .filter((q) => q.turnInNpcId === npc.id)
            .filter((q) => questState.accepted[q.id]?.status === 'ready')
            .map((q) => q.id);
        this.sendRaw(player.ws, {
            type: 'npc.dialog',
            npc: { id: npc.id, name: npc.name, greeting: npc.greeting },
            dungeonEntry: this.getDungeonEntryForNpc(npc.id, player),
            availableQuestIds,
            activeQuestIds,
            turnInQuestIds,
            shopOffers: this.getShopOffers(npc.id),
            quests: QUESTS
                .filter((q) => availableQuestIds.includes(q.id) || activeQuestIds.includes(q.id) || turnInQuestIds.includes(q.id))
                .map((q) => ({
                id: q.id,
                category: q.category,
                title: q.title,
                description: q.description,
                objectives: q.objectives.map((o) => ({ id: o.id, type: o.type, text: o.text, required: Number(o.required || 1) })),
                rewards: this.resolveQuestRewardsForPlayer(player, q.rewards)
            }))
        });
        if (changedByTalk)
            this.sendQuestState(player);
    }
    getDungeonEntryForNpc(npcId, player) {
        const dungeon = dungeons_1.DUNGEON_BY_ENTRY_NPC[String(npcId || '')];
        if (!dungeon)
            return null;
        const uiState = player && this.getDungeonUiState
            ? this.getDungeonUiState(player, npcId)
            : null;
        return {
            templateId: dungeon.id,
            name: dungeon.name,
            description: dungeon.description,
            maxPlayers: dungeon.maxPlayers,
            ...(uiState || {})
        };
    }
    handleQuestAccept(player, msg) {
        const questId = String(msg?.questId || '');
        const quest = QUEST_BY_ID[questId];
        if (!quest)
            return;
        const giver = npcs_1.NPC_BY_ID[quest.giverNpcId];
        const giverRange = Number(giver?.interactRange || npcs_1.NPC_INTERACT_RANGE);
        if (!giver || giver.mapKey !== player.mapKey || giver.mapId !== player.mapId || (0, math_1.distance)(player, giver) > giverRange) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Aproxime-se do NPC para aceitar a quest.' });
            return;
        }
        const state = this.getQuestState(player);
        if (state.completedIds.includes(questId)) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Essa quest ja foi concluida.' });
            return;
        }
        if (state.accepted[questId]) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Essa quest ja esta ativa.' });
            return;
        }
        if (!this.areQuestRequirementsMet(quest, state)) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Voce ainda nao cumpriu os requisitos desta quest.' });
            return;
        }
        const progress = {};
        for (const obj of quest.objectives)
            progress[obj.id] = 0;
        state.accepted[questId] = {
            status: 'active',
            progress,
            acceptedAt: Date.now()
        };
        this.setQuestState(player, state);
        this.persistPlayer(player);
        this.sendRaw(player.ws, { type: 'system_message', text: `Quest aceita: ${quest.title}` });
        this.sendQuestState(player);
    }
    handleQuestComplete(player, msg) {
        const questId = String(msg?.questId || '');
        const quest = QUEST_BY_ID[questId];
        if (!quest)
            return;
        const turnInNpc = npcs_1.NPC_BY_ID[quest.turnInNpcId];
        const turnInRange = Number(turnInNpc?.interactRange || npcs_1.NPC_INTERACT_RANGE);
        if (!turnInNpc || turnInNpc.mapKey !== player.mapKey || turnInNpc.mapId !== player.mapId || (0, math_1.distance)(player, turnInNpc) > turnInRange) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Aproxime-se do NPC correto para concluir.' });
            return;
        }
        const state = this.getQuestState(player);
        const entry = state.accepted[questId];
        if (!entry || entry.status !== 'ready') {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Objetivos da quest ainda nao concluidos.' });
            return;
        }
        entry.status = 'completed';
        entry.completedAt = Date.now();
        delete state.accepted[questId];
        if (!state.completedIds.includes(questId))
            state.completedIds.push(questId);
        const resolvedRewards = this.resolveQuestRewardsForPlayer(player, quest.rewards);
        this.setQuestState(player, state);
        this.persistPlayer(player);
        this.grantXp(player, Number(quest.rewards.xp || 0), { mapKey: player.mapKey, mapId: player.mapId });
        if (quest.rewards.currency && typeof quest.rewards.currency === 'object') {
            this.grantCurrency(player, quest.rewards.currency, `Quest: ${quest.title}`);
        }
        if (Array.isArray(resolvedRewards.items)) {
            for (const reward of resolvedRewards.items) {
                if (!reward)
                    continue;
                const left = this.grantRewardItem(player, String(reward.templateId), Math.max(1, Number(reward.quantity || 1)));
                if (left > 0) {
                    this.sendRaw(player.ws, { type: 'system_message', text: `Inventario cheio: faltou receber ${left}x ${reward.name || reward.templateId}.` });
                }
            }
        }
        this.persistPlayerCritical(player, 'quest_complete');
        this.sendRaw(player.ws, { type: 'system_message', text: `Quest concluida: ${quest.title}` });
        this.sendQuestState(player);
    }
    onMobKilled(player, mob) {
        const mobKind = String(mob?.kind || '');
        if (!mobKind)
            return;
        const state = this.getQuestState(player);
        let changed = false;
        for (const [questId, entry] of Object.entries(state.accepted)) {
            if (!entry || entry.status !== 'active')
                continue;
            const quest = QUEST_BY_ID[questId];
            if (!quest)
                continue;
            for (const obj of quest.objectives) {
                if (obj.type !== 'kill')
                    continue;
                if (obj.mapKey && String(player.mapKey || '') !== String(obj.mapKey))
                    continue;
                if (obj.mapId && String(player.mapId || '') !== String(obj.mapId))
                    continue;
                if (Array.isArray(obj.targetKinds) && obj.targetKinds.length > 0 && !obj.targetKinds.includes(mobKind))
                    continue;
                const prev = Number(entry.progress[obj.id] || 0);
                const next = Math.min(Number(obj.required || 1), prev + 1);
                if (next !== prev) {
                    entry.progress[obj.id] = next;
                    changed = true;
                }
            }
            if (this.areAllObjectivesDone(quest, entry)) {
                entry.status = 'ready';
                changed = true;
                this.sendRaw(player.ws, { type: 'system_message', text: `Quest pronta para entrega: ${quest.title}` });
            }
        }
        if (!changed)
            return;
        this.setQuestState(player, state);
        this.persistPlayer(player);
        this.sendQuestState(player);
    }
    onItemCollected(player, templateId, quantity) {
        const tid = String(templateId || '');
        const qty = Math.max(0, Math.floor(Number(quantity || 0)));
        if (!tid || qty <= 0)
            return;
        const state = this.getQuestState(player);
        let changed = false;
        for (const [questId, entry] of Object.entries(state.accepted)) {
            if (!entry || entry.status !== 'active')
                continue;
            const quest = QUEST_BY_ID[questId];
            if (!quest)
                continue;
            for (const obj of quest.objectives) {
                if (obj.type !== 'collect')
                    continue;
                if (String(obj.templateId) !== tid)
                    continue;
                const prev = Number(entry.progress[obj.id] || 0);
                const next = Math.min(Number(obj.required || 1), prev + qty);
                if (next !== prev) {
                    entry.progress[obj.id] = next;
                    changed = true;
                }
            }
            if (this.areAllObjectivesDone(quest, entry)) {
                entry.status = 'ready';
                changed = true;
                this.sendRaw(player.ws, { type: 'system_message', text: `Quest pronta para entrega: ${quest.title}` });
            }
        }
        if (!changed)
            return;
        this.setQuestState(player, state);
        this.persistPlayer(player);
        this.sendQuestState(player);
    }
    buildQuestStatePayload(player) {
        const state = this.getQuestState(player);
        const out = [];
        for (const [questId, entry] of Object.entries(state.accepted)) {
            const quest = QUEST_BY_ID[questId];
            if (!quest)
                continue;
            out.push({
                id: quest.id,
                category: quest.category,
                title: quest.title,
                description: quest.description,
                status: entry.status,
                giverNpcId: quest.giverNpcId,
                turnInNpcId: quest.turnInNpcId,
                objectives: quest.objectives.map((obj) => ({
                    id: obj.id,
                    type: obj.type,
                    text: obj.text,
                    current: Math.max(0, Math.floor(Number(entry.progress[obj.id] || 0))),
                    required: Math.max(1, Math.floor(Number(obj.required || 1)))
                })),
                rewards: this.resolveQuestRewardsForPlayer(player, quest.rewards)
            });
        }
        return out;
    }
    areAllObjectivesDone(quest, entry) {
        return quest.objectives.every((obj) => Number(entry.progress[obj.id] || 0) >= Number(obj.required || 1));
    }
    areQuestRequirementsMet(quest, state) {
        const required = Array.isArray(quest.requiresCompletedIds) ? quest.requiresCompletedIds : [];
        return required.every((questId) => state.completedIds.includes(String(questId || '')));
    }
    isQuestAvailableForPlayer(quest, state) {
        if (state.completedIds.includes(quest.id))
            return false;
        if (state.accepted[quest.id])
            return false;
        return this.areQuestRequirementsMet(quest, state);
    }
    applyTalkProgress(player, npcId) {
        const state = this.getQuestState(player);
        let changed = false;
        for (const [questId, entry] of Object.entries(state.accepted)) {
            if (!entry || entry.status !== 'active')
                continue;
            const quest = QUEST_BY_ID[questId];
            if (!quest)
                continue;
            for (const obj of quest.objectives) {
                if (obj.type !== 'talk')
                    continue;
                if (String(obj.npcId) !== String(npcId))
                    continue;
                const prev = Number(entry.progress[obj.id] || 0);
                const next = Math.min(Number(obj.required || 1), prev + 1);
                if (next !== prev) {
                    entry.progress[obj.id] = next;
                    changed = true;
                }
            }
            if (this.areAllObjectivesDone(quest, entry)) {
                entry.status = 'ready';
                changed = true;
                this.sendRaw(player.ws, { type: 'system_message', text: `Quest pronta para entrega: ${quest.title}` });
            }
        }
        if (!changed)
            return false;
        this.setQuestState(player, state);
        this.persistPlayer(player);
        return true;
    }
    resolveQuestRewardsForPlayer(player, rewards) {
        const items = Array.isArray(rewards?.items)
            ? rewards.items
                .map((entry) => {
                const templateId = this.resolveQuestRewardTemplateId(player, entry);
                if (!templateId)
                    return null;
                const template = config_1.BUILTIN_ITEM_TEMPLATE_BY_ID[String(templateId || '')];
                return {
                    templateId,
                    quantity: Math.max(1, Number(entry.quantity || 1)),
                    name: String(template?.name || templateId),
                    rarity: String(template?.rarity || 'branco'),
                    quality: String(template?.quality || 'normal')
                };
            })
                .filter(Boolean)
            : [];
        return {
            xp: Number(rewards?.xp || 0),
            currency: rewards?.currency || {},
            items
        };
    }
    resolveQuestRewardTemplateId(player, reward) {
        if (reward?.templateId) {
            const explicit = String(reward.templateId);
            if (explicit === 'weapon_rubi') {
                return (0, config_1.resolveClassWeaponTemplateId)(String(player?.class || 'knight'), 2, 'roxo', 'bom');
            }
            if (explicit === 'weapon_teste') {
                return (0, config_1.resolveClassWeaponTemplateId)(String(player?.class || 'knight'), 1, 'branco', 'normal');
            }
            return explicit;
        }
        const classId = String(player?.class || 'knight').toLowerCase();
        const tier = Math.max(1, Number(reward?.tier || 1));
        const rarity = String(reward?.rarity || 'branco');
        const quality = String(reward?.quality || 'normal');
        if (reward?.classWeapon) {
            const candidate = (0, config_1.resolveClassWeaponTemplateId)(classId, tier, rarity, quality);
            return config_1.BUILTIN_ITEM_TEMPLATE_BY_ID[candidate] ? candidate : '';
        }
        const slot = String(reward?.classEquipmentSlot || '').trim();
        if (!slot)
            return '';
        const candidate = (0, config_1.resolveClassEquipmentTemplateId)(classId, slot, tier, rarity, quality);
        return config_1.BUILTIN_ITEM_TEMPLATE_BY_ID[candidate] ? candidate : '';
    }
    getQuestState(player) {
        const overrides = player.statusOverrides && typeof player.statusOverrides === 'object'
            ? player.statusOverrides
            : {};
        const raw = overrides.__quests && typeof overrides.__quests === 'object'
            ? overrides.__quests
            : {};
        const accepted = raw.accepted && typeof raw.accepted === 'object' ? raw.accepted : {};
        const completedIdsRaw = Array.isArray(raw.completedIds) ? raw.completedIds : [];
        return {
            accepted: { ...accepted },
            completedIds: [...new Set(completedIdsRaw.map((id) => String(id || '')).filter(Boolean))]
        };
    }
    setQuestState(player, state) {
        if (!player.statusOverrides || typeof player.statusOverrides !== 'object')
            player.statusOverrides = {};
        player.statusOverrides.__quests = {
            accepted: state.accepted,
            completedIds: state.completedIds
        };
    }
}
exports.QuestService = QuestService;
//# sourceMappingURL=QuestService.js.map