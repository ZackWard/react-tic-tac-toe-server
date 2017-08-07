const WebSocket = require('ws');

let port = 8080;
 
const wss = new WebSocket.Server({ port });

// The server should own the game state (to prevent cheaters)
let players = [];
let games = [];
let invitations = [];

// Invitations state shape
let invitation = {
    from: "player1",
    to: "player2"
};

// Player state shape
let player = {
    username: "username",
    socket: "Websocket Object"
};

// Game state shape
let game = {
    playerX: "user1",
    playerO: "user2",
    board: [null, null, null, null, null, null, null, null, null],
    turn: "X"
};

const broadcast = (message) => {
    players.forEach(player => {
        player.socket.send(JSON.stringify(message));
    });
};

const login = (socket, player) => {
    console.log("In login function");
    let found = false;
    players.forEach( connectedPlayer => {
        if (connectedPlayer.username == player) {
            found = true;
        }
    });
    if (found) {
        socket.send(JSON.stringify({message: "A user with that name is already logged on"}));
    } else {
        let newPlayer = {
            username: player,
            socket
        };
        players.push(newPlayer);

        // Remove the player from the player list when the socket is closed
        socket.on('close', (code, reason) => {
            console.log("Socket closed! :(");
            console.log(reason);
            console.log(code);
            players = players.filter(player => {
                if (player.socket == socket) {
                    console.log("Removing player from players list: " + player.username);
                    return false;
                }
                return true;
            });
            updatePlayerList();
        });

        socket.send(JSON.stringify({type: "LOGIN_SUCCESS", message: "Logged on!", user: player}));
        updatePlayerList();
    }
};

const makeMove = (ws, username, position) => {
    console.log("Got a move for position " + position + " by " + username);

    // Find the game
    let game = false;
    games.forEach(possibleGame => {
        if (possibleGame.playerX == username || possibleGame.playerO == username) {
            console.log("Found a game for this player!");
            game = possibleGame;
        }
    });

    if (!game) {
        console.log("No game found!");
        return false;
    }

    if ( (game.turn == "X" && game.playerX != username) || (game.turn == "O" && game.playerO != username) ) {
        console.log("It is not this players turn!");
        return false;
    }

    if (game.board[position] != null) {
        console.log("This position isn't available");
        return false;
    }

    game.board[position] = (game.playerX == username ? "X" : "O");
    game.turn = (game.turn == "X" ? "O" : "X");
    console.log(game);

    
    // Send a board upate
    console.log("Sending board update");
    players.forEach(player => {
        if (player.username == game.playerX || player.username == game.playerO) {
            let message = {
                type: "MULTIPLAYER_BOARD_UPDATE",
                board: game.board
            };
            player.socket.send(JSON.stringify(message));
        }
    });
};

const updatePlayerList = () => {
    let playerList = players.map(player => player.username);
    broadcast({
        type: "MULTIPLAYER_UPDATE_PLAYER_LIST",
        players: playerList
    });
}

const handleInvitation = (from, to) => {
    console.log("Received invitation from " + from + " to " + to);
    // Verify that both players are online, add the invitation to the invitation list, and send updates to both players
    let senderOnline = false;
    let sender = null;
    let receiverOnline = false;
    let receiver = null;

    players.forEach(player => {
        if (player.username == from) {
            console.log("Found sender online");
            senderOnline = true;
            sender = player;
        }
        if (player.username == to) {
            console.log("Found receiver online");
            receiverOnline = true;
            receiver = player;
        }
    });

    if (senderOnline && receiverOnline) {
        invitations.push({
            from: sender.username,
            to: receiver.username
        });

        let invitation = {
            type: "MULTIPLAYER_NEW_INVITATION",
            from: sender.username
        };

        receiver.socket.send(JSON.stringify(invitation));
    }
};

const beginGame = (from, to) => {
    console.log("Beginning game between " + from + " and " + to);
    // First, remove all invitations from the queue involving either party
    invitations = invitations.filter(invite => invite.from != from && invite.to != to);

    // Set up game state
    let newGame = {
        playerX: from,
        playerO: to,
        board: [null, null, null, null, null, null, null, null, null],
        turn: "X"
    };
    games.push(newGame);

    // Notify players
    players.forEach(player => {
        if (player.username == newGame.playerX || player.username == newGame.playerO) {
            let message = {
                type: "MULTIPLAYER_GAME_BEGIN",
                playerMark: player.username == newGame.playerX ? "X" : "O",
                opponent: player.username == newGame.playerX ? newGame.playerO : newGame.playerX
            };
            player.socket.send(JSON.stringify(message));
        }
    });
    console.log("Socket check");
    console.log(players);
};

wss.on("ready", function (event) {
    console.log("Listening for websocket connections on port ", port);
});



wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    console.log('Received message from a client: ');
    console.log(message);

    let parsedMessage = JSON.parse(message);

    switch (parsedMessage.action) {
        case "LOGIN":
            login(ws, parsedMessage.user);
            break;
        case "INVITATION": 
            handleInvitation(parsedMessage.from, parsedMessage.to);
            break;
        case "ACCEPT_INVITATION":
            beginGame(parsedMessage.from, parsedMessage.to);
            break;
        case "MAKE_MOVE":
            makeMove(ws, parsedMessage.player, parsedMessage.position);
            break;
        default:
    }

  });
});