export class Network {
    constructor(game) {
        this.game = game;
        this.socket = null;
    }

    connect(playerData) {
        this.socket = new WebSocket(`ws://${window.location.host}`);

        this.socket.onopen = () => {
            console.log("Conectado ao servidor!");
            this.socket.send(JSON.stringify({
                type: 'join',
                ...playerData
            }));
        };

        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };
    }

    handleMessage(message) {
    switch (message.type) {
        case 'welcome':
            this.game.setLocalPlayer(message.id, message.players);
            break;
        case 'new_player':
            this.game.addRemotePlayer(message.player);
            break;
        case 'player_leave':
            this.game.removePlayer(message.id);
            break;
        case 'state':
            // Esta função é vital para o movimento funcionar
            this.game.updatePlayers(message.players);
            break;   
    }
}
}