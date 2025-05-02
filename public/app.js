const vuetify = Vuetify.createVuetify({
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: { dark: true, colors: {} },
      light: { dark: false, colors: {} }
    }
  }
});
const API_URL = window.location.hostname === 'localhost' 
    ? 'ws://localhost:2004'
    : 'https://liars-dice-twuh.onrender.com/';

Vue.createApp({
    data() {
      return {
        socket: null,
        playerName: '',
        joined: false,
        players: [],
        gameMessage: '',
        isHost: false,
        dice: [],
        messageHandlers: {},
        myColor: null,
        availableColors: ['cyan', 'green', 'pink', 'purple', 'teal'],
        gameStarted: false,
        showColorOptions: false,
        currentTurn: null,
        bidQuanity: null,
        bidFace: null,
        lastBid: null,
        bluffResult: null,
        round: 1,
        gameOver: false,
        winnerName: '',
        isReady: false,
        startAttempted: false,
        showConfirmStart: false,
        diceRollKey: 0,
        showBidDialog: false,
        selectedMode: null,
        lobbyIdInput: '',
        generatedLobbyId: '',
        diceHidden: false,
        errorMessage: '',
        showHowTo: false,
        showSettings: false,
        darkMode: true,
        soundsEnabled: true,
        hasNewBet: false,
        showLeaveConfirm: false,
        bidError: '',
        winnerName: null,
        didPlayerWin: null,


        diceBackground: Array.from({ length: 12 }, (_, i) => ({
          id: i,
          face: (i % 6) + 1,
          left: Math.random() * 100,
          top: Math.random() * 100,
          duration: 10 + Math.random() * 10
        }))        
      };
    },
    methods: {
      joinGame() {
        const lobbyId = this.selectedMode === 'create' ? this.generatedLobbyId : this.lobbyIdInput;
        if (!this.playerName.trim() || !lobbyId.trim()) return;

        this.errorMessage = '';
      
        this.socket = new WebSocket('API_URL');
      
        this.socket.onopen = () => {
          this.socket.send(JSON.stringify({
            type: 'join',
            name: this.playerName,
            lobbyId: lobbyId,
            createLobby: this.selectedMode === 'create'
          }));
        };
      
        this.socket.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          const handler = this.messageHandlers[msg.type];
          if (handler) handler(msg);
          else console.warn('Unknown message type:', msg.type);
        };
      },
      
      startGame() {
          if (this.players.length < 2) return;
        
          if (this.allOthersReady) {
            this.socket.send(JSON.stringify({ type: 'startGame' }));
          } else {
            this.showConfirmStart = true;
          }
      },
      
      confirmStartGame() {
          this.showConfirmStart = false;
          this.socket.send(JSON.stringify({ type: 'startGame' }));
      },

      createMatch() {
        this.generatedLobbyId = Math.floor(100000 + Math.random() * 900000).toString();
        this.selectedMode = 'create';
      },     

      // HANDLE METHODS
      handlePlayerList(msg) {
        const prevIds = this.players.map(p => p.id);
        const newIds = msg.players.map(p => p.id);
        const newJoins = newIds.filter(id => !prevIds.includes(id));
      
        if (newJoins.length > 0) {
          if (this.soundsEnabled) this.sounds.playerJoinedLobby.play();
        }
      
        this.joined = true;
        this.players = msg.players;
        this.isHost = (msg.players[0]?.id === this.playerName);
        this.myColor = this.players.find(p => p.id === this.playerName)?.color || null;
      },
    
      handleStartGame(msg) {
        this.currentTurn = null;
        this.gameMessage = msg.message;
        this.gameStarted = true;
      },
    
      handleNotification(msg) {
          this.gameMessage = msg.message;
      },
    
      handleYourDice(msg) {
        const player = this.players.find(p => p.id === this.playerName);
        if (player?.eliminated) return; // ❌ don’t show dice for eliminated players
      
        if (this.bluffResult) {
          this.pendingDice = msg.dice;
          return;
        }
      
        this.playDice(msg.dice);
      },

      playDice(diceArray) {
        if (this.soundsEnabled) this.sounds.diceRoll.play();
        this.diceHidden = true; // hide dice visually, not structurally
      
        setTimeout(() => {
          this.dice = diceArray;
          this.diceRollKey++;
          this.diceHidden = false;
      
          this.$nextTick(() => {
            const diceEls = document.querySelectorAll('img');
            diceEls.forEach((el, i) => {
              el.style.setProperty('--delay', `${i * 0.1}s`);
            });
          });
        }, 50);
      },      

      handleTurnUpdate(msg) {
          this.currentTurn = msg.currentTurn;
          this.round = msg.round;
      },          

      handleBidPlaced(msg) {
          this.lastBid = msg.bid;
          this.hasNewBet = true; 
          this.bluffResult = null;

          if (this.soundsEnabled) {
            this.sounds.turnWasTaken.play();
          }
      },

      handleGameOver(msg) {
        this.winnerName = msg.winner;
        this.gameOver = true;
      
        if (msg.winner === this.playerName) {
          this.didPlayerWin = true;
          if (this.soundsEnabled) this.sounds.winSound.play();
        } else {
          this.didPlayerWin = false;
          if (this.soundsEnabled) this.sounds.lossSound.play();
        }
      },

      handleToggleReady() {
          this.isReady = !this.isReady;
          this.socket.send(JSON.stringify({ type: "toggleReady" }));
      },
      
      handleError(msg) {
        this.errorMessage = msg.message;
      },
        
      chooseColor(color) {
          if (this.socket && this.joined) {
            this.socket.send(JSON.stringify({ type: 'chooseColor', color }));
          }
      },

      isColorTaken(color) {
          return this.players.some(player => player.color === color);
      },

      toggleColorOptions() {
          this.showColorOptions = !this.showColorOptions;
      },

      assignRandomName() {
        const names = ['Omar Rodriguez', 'Tyler Rogel', 'Bryan Lopez', 'Garrett Balok', 'Amra Colbert', 'Gavin Williams',
          'Ethan Mower', 'Karolis Staniulis', 'Logan Smith', 'Ashlyn Smith', 'Azalie Swain', 'Jeff Compas', 'Grandpa John',
          'Grandma Nancy', 'Mason Wilson', 'DJ Holt', 'Taylor Willard', 'Quang Phu', 'Kory Carlill'
        ];
        const random = names[Math.floor(Math.random() * names.length)];
        this.playerName = random;
      },
      

      // AFTER GAME HAS STARTED

      getPosition(playerIndex) {
          const positions = ['bottom', 'right', 'top', 'left'];
          const selfIndex = this.players.findIndex(p => p.id === this.playerName);
        
          const relativeIndex = (playerIndex - selfIndex + this.players.length) % this.players.length;
        
          return positions[relativeIndex];
      },

      sendBid() {
        if (!this.bidQuantity || !this.bidFace) return;
      
        const current = this.lastBid;
        const q = this.bidQuantity;
        const f = this.bidFace;
      
        const isValid =
          !current || // first bet
          q > current.quantity || (q === current.quantity && f > current.face);
      
        if (!isValid) {
          this.bidError = 'Invalid bet. You must raise the quantity or face.';
          return; // do NOT close the modal
        }
      
        // Clear error and send bid
        this.bidError = '';
        this.socket.send(JSON.stringify({
          type: 'bid',
          quantity: q,
          face: f
        }));
        this.showBidDialog = false;
      },

      callBluff() {
          this.socket.send(JSON.stringify({ type: 'callBluff' }));
          this.showBidDialog = false;
      },

      handleBluffResult(msg) {
        this.bluffResult = msg;
        this.currentTurn = null;
        this.hasNewBet = false;
        this.lastBid = null;
      
        if (!this.gameOver && this.soundsEnabled) {
          this.sounds.bluffWasCalled.play();
        }
      
        setTimeout(() => {
          if (!this.gameOver && this.pendingDice) {
            this.playDice(this.pendingDice);
            this.pendingDice = null;
          }
        }, 3000);
      },

      hexToRgba(hex, alpha = 1) {
        if (!hex) return `rgba(0, 0, 0, ${alpha})`;
        const shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthand, (_, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`
          : `rgba(0, 0, 0, ${alpha})`;
      },

      playAgain() {
        this.socket.send(JSON.stringify({ type: 'playAgain' }));
        this.gameOver = false;
        this.currentTurn = null;
        this.lastBid = null;
        this.bluffResult = null;
        this.round = 1;
        this.dice = [];
        this.diceHidden = false;
        this.winnerName = '';
        this.gameMessage = '';
      },

      returnToMenu() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.addEventListener('close', () => {
            this.resetGame();
            this.selectedMode = null;
          });
          this.socket.close();
        } else {
          this.resetGame();
          this.selectedMode = null;
        }
      },
      
      handleReturnToLobby() {
        this.gameOver = false;
        this.gameStarted = false;
        this.round = 1;
        this.currentTurn = null;
        this.dice = [];
        this.lastBid = null;
        this.bluffResult = null;
        this.gameMessage = '';
        this.isReady = false;
      },
      
      resetGame() {
        this.socket = null;
        this.playerName = '';
        this.joined = false;
        this.players = [];
        this.gameMessage = '';
        this.isHost = false;
        this.dice = [];
        this.myColor = null;
        this.gameStarted = false;
        this.showColorOptions = false;
        this.currentTurn = null;
        this.bidQuanity = null;
        this.bidFace = null;
        this.lastBid = null;
        this.bluffResult = null;
        this.round = 1;
        this.gameOver = false;
        this.winnerName = '';
        this.isReady = false;
        this.startAttempted = false;
        this.showConfirmStart = false;
        this.diceRollKey = 0;
        this.showBidDialog = false;
        this.selectedMode = null;
        this.lobbyIdInput = '';
        this.generatedLobbyId = '';
        this.diceHidden = false;
        this.errorMessage = '';
        this.showHowTo = false;
        this.showSettings = false;
        this.darkMode = true;
        this.soundsEnabled = true;
        this.hasNewBet = false;
      },

      setTheme(isDark) {
        const theme = isDark ? 'dark' : 'light';
        this.$vuetify.theme.global.name.value = theme;
      },
      
      toggleDarkMode() {
        this.setTheme(this.darkMode);
      },
      
      toggleSounds() {
      },

      getMinValidBetOptions() {
        if (!this.lastBid) return [];
      
        const { quantity, face } = this.lastBid;
      
        const option1 = { quantity: quantity + 1, face }; // higher quantity
        const option2 = face < 6 ? { quantity, face: face + 1 } : null; // same quantity, higher face
      
        return option2 ? [option1, option2] : [option1];
      },
      
      openBidDialog() {
        this.bidQuantity = null;
        this.bidFace = null;
        this.showBidDialog = true;
      },

      handleLeaveGame() {
        const player = this.players.find(p => p.id === this.playerName);
        const isOut = !player || player.lives === 0;
      
        if (this.gameStarted && !this.gameOver && !isOut) {
          this.showLeaveConfirm = true;
        } else {
          this.returnToMenu();
        }
      },

      confirmLeave() {
        this.showLeaveConfirm = false;
        this.returnToMenu();
      },
      
      maxQuantity() {
        return this.players.filter(p => !p.eliminated).length * 5;
      },

      enforceBidLimits() {
        const maxQ = this.maxQuantity();
      
        // Quantity
        if (typeof this.bidQuantity === 'number') {
          const clampedQuantity = Math.max(1, Math.min(this.bidQuantity, maxQ));
          this.bidQuantity = clampedQuantity;
        }
      
        // Face
        if (typeof this.bidFace === 'number') {
          const clampedFace = Math.max(1, Math.min(this.bidFace, 6));
          this.bidFace = clampedFace;
        }
      }
      

    },
    computed: {
        allOthersReady() {
          return this.players
            .filter(player => player.id !== this.playerName)
            .every(player => player.ready);
        },

        isMyTurn() {
          return this.currentTurn === this.playerName;
        }
        
      },

    created() {
      this.$vuetify = vuetify.framework;
      this.setTheme(this.darkMode);

      this.messageHandlers = {
        playerList: this.handlePlayerList,
        startGame: this.handleStartGame,
        notification: this.handleNotification,
        yourDice: this.handleYourDice,
        turnUpdate: this.handleTurnUpdate,
        bidPlaced: this.handleBidPlaced,
        bluffResult: this.handleBluffResult,
        gameOver: this.handleGameOver,
        error: this.handleError,
        returnToLobby: this.handleReturnToLobby
      };

      this.sounds = {
        buttonClick: new Audio('/sounds/buttonClick.wav'),
        buttonHover: new Audio('/sounds/buttonHover.wav'),
        playerJoinedLobby: new Audio('/sounds/playerJoinedLobby.wav'),
        diceRoll: new Audio('/sounds/diceRoll.mp3'),
        bluffWasCalled: new Audio('/sounds/bluffWasCalled.mp3'),
        turnWasTaken: new Audio('/sounds/turnWasTaken.mp3'),
        winSound: new Audio('/sounds/winSound.mp3'),
        lossSound: new Audio('/sounds/lossSound.mp3')
      };

      document.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.v-btn')) {
          if (this.soundsEnabled) this.sounds.buttonClick.play();
        }
      });
    
      document.addEventListener('mouseover', (e) => {
        if (e.target.closest('button') || e.target.closest('.v-btn')) {
          if (this.soundsEnabled) this.sounds.buttonHover.play();
        }
      });

        
      }
      
  }).use(vuetify).mount('#app');
  