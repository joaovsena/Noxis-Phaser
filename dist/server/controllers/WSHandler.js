"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSHandler = void 0;
class WSHandler {
    constructor(controller) {
        this.controller = controller;
    }
    handleMessage(ws, raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        }
        catch {
            return;
        }
        if (!ws.playerId || !this.controller.players.has(ws.playerId)) {
            if (msg.type.startsWith('auth_')) {
                this.controller.handleAuth(ws, msg);
            }
            return;
        }
        const player = this.controller.players.get(ws.playerId);
        switch (msg.type) {
            case 'move':
                this.controller.handleMove(player, msg);
                break;
            case 'target_mob':
                this.controller.handleTargetMob(player, msg);
                break;
            case 'chat_send':
                this.controller.handleChat(player, msg);
                break;
            case 'pickup_item':
                this.controller.handlePickupItem(player, msg);
                break;
            case 'equip_item':
                this.controller.handleEquipItem(player, msg);
                break;
            case 'inventory_move':
                this.controller.handleInventoryMove(player, msg);
                break;
            case 'inventory_sort':
                this.controller.handleInventorySort(player);
                break;
            case 'inventory_delete':
                this.controller.handleInventoryDelete(player, msg);
                break;
            case 'inventory_unequip_to_slot':
                this.controller.handleInventoryUnequipToSlot(player, msg);
                break;
            case 'switch_instance':
                this.controller.handleSwitchInstance(player, msg);
                break;
            case 'admin_command':
                this.controller.handleAdminCommand(player, msg);
                break;
            // Adicionar outros cases...
        }
    }
}
exports.WSHandler = WSHandler;
//# sourceMappingURL=WSHandler.js.map