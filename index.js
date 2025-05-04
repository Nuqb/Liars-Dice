// =============================================
// Dependencies and Server Setup
// =============================================
const WebSocket = require('ws');
const express = require('express');

const app = express();
app.use(express.static('public'));

const server = app.listen(2004, function () {
  console.log("Server started on port 2004");
});

const wss = new WebSocket.WebSocketServer({ server: server });

// =============================================
// Game State and Constants
// =============================================
let playerCount = 0;
let turnIndex = 0;
let turnOrder = []; // stores array of player IDs
let lastBid = null;
let roundNumber = 1;
let turnsTaken = 0;

const emojiPool = ['🎲', '🦊', '🐍', '🐙', '🐸', '🐧', '🦉', '🐯', '🐝', '🐺'];
const players = new Map(); // key: ws, value: { id }
const lobbies = new Map(); // key = lobbyId, value = { players, gameState, etc }
const availableColors = ['cyan', 'green', 'pink', 'purple', 'blue', 'teal'];

// =============================================
// Message Handlers Registration
// =============================================
const messageHandlers = { 
  join: handleJoin,
  startGame: handleStartGame,
  chooseColor: handleChooseColor,
  bid: handleBid,
  callBluff: handleCallBluff,
  toggleReady: handleToggleReady,
  playAgain: handlePlayAgain
};

// =============================================
// WebSocket Connection Handler
// =============================================
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      ws.send('Invalid JSON');
      return;
    }

    const handler = messageHandlers[msg.type];
    if (handler) {
      handler(ws, msg);
    } else {
      ws.send('Unknown message type');
    }
  });

  ws.on('close', () => {
    const lobbyId = ws.lobbyId;
    if (!lobbyId || !lobbies.has(lobbyId)) return;
  
    const lobby = lobbies.get(lobbyId);
    const wasHost = ws === Array.from(lobby.players.keys())[0];

    let playerEntry = null;
    for (const [client, p] of lobby.players.entries()) {
      if (client === ws) {
        playerEntry = { client, player: p };
        break;
      }
    }

    const player = playerEntry?.player;
  
    if (player) {
      // Mark as disconnected instead of removing
      player.disconnected = true;

      // If the disconnected player was the current turn, advance to next player
      if (lobby.turnOrder?.length > 0 && lobby.gameStarted) {
        const currentPlayerId = lobby.turnOrder[lobby.turnIndex];
        if (currentPlayerId === player.id) {
          const aliveConnected = Array.from(lobby.players.values())
            .filter(p => !p.eliminated && !p.disconnected)
            .map(p => p.id);

          if (aliveConnected.length === 1) {
            // Only one player left
            broadcastToLobby(lobbyId, {
              type: 'gameOver',
              winner: aliveConnected[0]
            });
          } else {
            // Advance to next valid player
            const currentIndex = lobby.turnIndex;
            let nextIndex = (currentIndex + 1) % lobby.turnOrder.length;

            while (
              lobby.players &&
              (lobby.players.getKeyById?.(lobby.turnOrder[nextIndex])?.disconnected ||
              lobby.players.getKeyById?.(lobby.turnOrder[nextIndex])?.eliminated)
            ) {
              nextIndex = (nextIndex + 1) % lobby.turnOrder.length;
            }

            lobby.turnIndex = nextIndex;
            broadcastTurn(lobbyId);
          }
        }
      }
    }

    const shouldRemove = !lobby.gameStarted || !player?.wantsToPlayAgain;
    if (shouldRemove) {
      lobby.players.delete(ws);
    } else {
      player.disconnected = true;
    }
    
    // Always check for winner if game is running
    if (lobby.gameStarted) {
      checkWinner(lobbyId);
    }
    
    // Reassign host if they leave
    if (wasHost) {
      const remaining = Array.from(lobby.players.keys()).filter(client => client !== ws);
      const newHost = remaining[0];
      if (newHost) {
        broadcastToLobby(lobbyId, {
          type: 'notification',
          message: `${lobby.players.get(newHost).id} is now the host.`
        });

        newHost.send(JSON.stringify({
          type: 'matchCode',
          code: lobbyId
        }));
      }
    }
    broadcastPlayerList(lobbyId);
  });
});

// =============================================
// Game Action Handlers
// =============================================
function handleJoin(ws, msg) {
  const { name, lobbyId } = msg;
  if (!name || !lobbyId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Missing name or lobby ID' }));
    return;
  }

  if (!lobbies.has(lobbyId)) {
    if (msg.createLobby) {
      lobbies.set(lobbyId, {
        players: new Map(),
        turnOrder: [],
        turnIndex: 0,
        lastBid: null,
        roundNumber: 1,
        gameStarted: false
      });
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Match with code does not exist.' }));
      return;
    }
  }  

  const lobby = lobbies.get(lobbyId);
  const nameTaken = Array.from(lobby.players.values()).some(p => p.id === name);

  if (nameTaken) {
    ws.send(JSON.stringify({ type: 'error', message: 'Name already taken in this lobby.' }));
    return;
  }

  ws.lobbyId = lobbyId;

  lobby.players.set(ws, {
    id: name,
    color: null,
    lives: 2,
    emoji: '',
    ready: false,
    eliminated: false,
    disconnected: false,
    wantsToPlayAgain: true
  });

  console.log(`${name} joined lobby ${lobbyId}`);

  broadcastToLobby(lobbyId, {
    type: 'notification',
    message: `${name} has joined the game.`
  });

  broadcastPlayerList(lobbyId);
}

function handleStartGame(ws, msg) {
  const lobbyId = ws.lobbyId;
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;

  const player = lobby.players.get(ws);
  const playerNames = Array.from(lobby.players.values()).map(p => p.id);
  const isHost = ws === Array.from(lobby.players.keys())[0];

  if (!isHost) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the host can start the game.' }));
    return;
  }

  if (playerNames.length < 2 || playerNames.length > 4) {
    ws.send(JSON.stringify({ type: 'error', message: 'You need 2 to 4 players to start the game.' }));
    return;
  }

  lobby.turnOrder = Array.from(lobby.players.values()).map(p => p.id);
  lobby.turnIndex = Math.floor(Math.random() * lobby.turnOrder.length);
  lobby.roundNumber = 1;
  lobby.lastBid = null;
  lobby.gameStarted = true;

  console.log(`Game started in lobby ${lobbyId} with players: ${playerNames.join(', ')}`);

  // Assign 5 dice to each player
  for (const [client, player] of lobby.players.entries()) {
    const dice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
    player.dice = dice;

    client.send(JSON.stringify({
      type: 'yourDice',
      dice: dice
    }));
  }

  // Notify all players that game has started
  broadcastToLobby(lobbyId, {
    type: 'startGame',
    message: `Game starting with ${playerNames.join(', ')}!`
  });

  broadcastTurn(lobbyId);
}

function handleChooseColor(ws, msg) {
  const lobbyId = ws.lobbyId;
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;

  const color = msg.color;
  const isTaken = Array.from(lobby.players.values()).some(player => player.color === color);
  const isValid = availableColors.includes(color);

  if (!isValid || isTaken) {
    ws.send(JSON.stringify({
      type: 'colorError',
      message: 'Color is invalid or already taken.'
    }));
    return;
  }

  const player = lobby.players.get(ws);
  if (player) {
    player.color = color;
    broadcastPlayerList(lobbyId);
  }
}

function handleBid(ws, msg) {
  const lobbyId = ws.lobbyId;
  const lobby = lobbies.get(lobbyId);
  if (!lobby || !lobby.gameStarted) return;

  const { quantity, face } = msg;
  const player = lobby.players.get(ws);
  const currentPlayerId = lobby.turnOrder[lobby.turnIndex];

  if (!player || player.id !== currentPlayerId) {
    ws.send(JSON.stringify({ type: 'error', message: "It's not your turn." }));
    return;
  }

  // Enforce valid bid progression
  const last = lobby.lastBid;
  if (last) {
    const valid =
      quantity > last.quantity ||
      (quantity === last.quantity && face > last.face);
    if (!valid) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid bid. Must increase quantity or face.' }));
      return;
    }
  }

  lobby.lastBid = { player: player.id, quantity, face };
  const alive = lobby.turnOrder.filter(id => {
    const p = Array.from(lobby.players.values()).find(p => p.id === id);
    return p && !p.eliminated && !p.disconnected;
  });
  
  let nextIndex = (lobby.turnIndex + 1) % lobby.turnOrder.length;
  while (!alive.includes(lobby.turnOrder[nextIndex])) {
    nextIndex = (nextIndex + 1) % lobby.turnOrder.length;
  }
  lobby.turnIndex = nextIndex;
  
  broadcastToLobby(lobbyId, {
    type: 'bidPlaced',
    bid: lobby.lastBid
  });

  broadcastTurn(lobbyId);
}

function handleCallBluff(ws, msg) {
  const lobbyId = ws.lobbyId;
  const lobby = lobbies.get(lobbyId);
  if (!lobby || !lobby.lastBid) return;

  const accuser = lobby.players.get(ws);
  const currentPlayerId = lobby.turnOrder[lobby.turnIndex];

  if (!accuser || accuser.id !== currentPlayerId) {
    ws.send(JSON.stringify({ type: 'error', message: "It's not your turn to call bluff." }));
    return;
  }

  const bidder = Array.from(lobby.players.values()).find(p => p.id === lobby.lastBid.player);

  let totalMatches = 0;
  for (const player of lobby.players.values()) {
    if (!player.eliminated && !player.disconnected) {
      for (const die of player.dice || []) {
        if (die === lobby.lastBid.face || die === 1) {
          totalMatches++;
        }
      }
    }
  }
  

  const bidIsTrue = totalMatches >= lobby.lastBid.quantity;

  let loser = null;
  if (bidIsTrue) {
    accuser.lives--;
    loser = accuser;
  } else {
    bidder.lives--;
    loser = bidder;
  }

  broadcastToLobby(lobbyId, {
    type: 'bluffResult',
    bid: lobby.lastBid,
    result: bidIsTrue ? 'valid' : 'bluff',
    matches: totalMatches,
    loser: loser.id,
    remainingLives: loser.lives,
    accuser: accuser.id
  });

  // Handle elimination
  for (const [client, player] of lobby.players.entries()) {
    if (player.lives <= 0 && !player.eliminated) {
      player.eliminated = true;
      client.send(JSON.stringify({ type: 'eliminated' }));
    }
  }
  
  broadcastPlayerList(lobbyId);
  checkWinner(lobbyId);

  lobby.lastBid = null;
  const alivePlayers = Array.from(lobby.players.values())
    .filter(p => !p.eliminated)
    .map(p => p.id);
  lobby.turnOrder = alivePlayers;
  const loserIndex = alivePlayers.indexOf(loser.id);
  lobby.turnIndex = (loserIndex + 1) % alivePlayers.length;

  // Reroll dice
  for (const [client, player] of lobby.players.entries()) {
    if (!player.eliminated && !player.disconnected) {
      const dice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
      player.dice = dice;
  
      client.send(JSON.stringify({
        type: 'yourDice',
        dice: dice
      }));
    } else {
      player.dice = []; // clear dice for eliminated players
    }
  }
  

  setTimeout(() => {
    broadcastTurn(lobbyId);
  }, 3000);  
}

function handleToggleReady(ws) {
  const lobbyId = ws.lobbyId;
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;

  const player = lobby.players.get(ws);
  if (player) {
    player.ready = !player.ready;
    broadcastPlayerList(lobbyId);
  }
}

function handlePlayAgain(ws) {
  const lobbyId = ws.lobbyId;
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;

  for (const [client, player] of lobby.players.entries()) {
    if (player.disconnected) {
      lobby.players.delete(client);
    }
  }

  const player = lobby.players.get(ws);
  if (player) {
    player.ready = false;
    player.lives = 2;
    player.eliminated = false;
    player.wantsToPlayAgain = true;
  }

  ws.send(JSON.stringify({ type: 'returnToLobby' }));
  broadcastPlayerList(lobbyId);
}

// =============================================
// Broadcasting Functions
// =============================================
function broadcastToLobby(lobbyId, obj) {
  const lobby = lobbies.get(lobbyId);
  const msg = JSON.stringify(obj);
  lobby.players.forEach((_, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function broadcastPlayerList(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  const playerData = Array.from(lobby.players.values()).map(player => ({
    id: player.id,
    color: player.color,
    ready: player.ready,
    lives: player.lives,
    emoji: player.emoji,
    eliminated: player.eliminated || false,
    disconnected: player.disconnected || false,
    wantsToPlayAgain: player.wantsToPlayAgain || false
  }));

  broadcastToLobby(lobbyId, {
    type: 'playerList',
    players: playerData
  });
}

function broadcastTurn(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || !lobby.turnOrder || lobby.turnOrder.length === 0) return;

  let currentPlayerId = lobby.turnOrder[lobby.turnIndex];
  let currentPlayer = Array.from(lobby.players.values()).find(p => p.id === currentPlayerId);
  
  while (currentPlayer?.eliminated || currentPlayer?.disconnected) {
    lobby.turnIndex = (lobby.turnIndex + 1) % lobby.turnOrder.length;
    currentPlayerId = lobby.turnOrder[lobby.turnIndex];
    currentPlayer = Array.from(lobby.players.values()).find(p => p.id === currentPlayerId);
  }
    
  broadcastToLobby(lobbyId, {
    type: 'turnUpdate',
    currentTurn: currentPlayerId
  });

  checkWinner(lobbyId);
}

// =============================================
// Game Logic Helper Functions
// =============================================
function calculateTotalDice(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return 0;

  let total = 0;
  for (const player of lobby.players.values()) {
    if (!player.eliminated && player.dice) {
      total += player.dice.length;
    }
  }
  return total;
}

function checkWinner(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;

  const alivePlayers = Array.from(lobby.players.values()).filter(p => !p.eliminated && !p.disconnected);
  if (alivePlayers.length === 1) {
    // Reset all players
    for (const player of lobby.players.values()) {
      player.wantsToPlayAgain = false;
      player.ready = false;
    }

    const winner = alivePlayers[0];
    broadcastToLobby(lobbyId, {
      type: 'gameOver',
      winner: winner.id
    });
  }
}

