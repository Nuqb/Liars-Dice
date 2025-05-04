# Liars' Dice Game

A real-time multiplayer implementation of the classic Liars' Dice game using Node.js, Express, and WebSocket technology.

![Liars' Dice Game](https://img.shields.io/badge/status-active-success.svg)
![Node.js](https://img.shields.io/badge/Node.js-v23.11.0-green)
![Express](https://img.shields.io/badge/Express-v5.1.0-blue)
![WebSocket](https://img.shields.io/badge/WebSocket-v8.18.1-orange)

## 🎮 Play Online
You can play the game online at: [https://liars-dice-twuh.onrender.com](https://liars-dice-twuh.onrender.com)

> Note: The deployed site may take around 30 seconds to start up when first accessed. This is normal behavior for the hosting platform as I have a free plan :)

## 🎲 About the Game

Liars' Dice is a classic dice game where players try to deceive each other about the dice they have. Players roll dice in secret and make bids about the number of dice of a certain value exist among all players' dice. The game combines elements of probability, deception, and strategy.

## 🚀 Features

- Real-time multiplayer gameplay
- WebSocket-based communication
- Modern and responsive UI
- Secure game sessions
- Easy-to-use interface

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/liars-dice.git
cd liars-dice
```

2. Install dependencies:
```bash
npm install express@5.1.0 ws@8.18.1
```

## 🚀 Running the Application

### Local Development
1. Start the server:
```bash
node index.js
```

2. Open your web browser and navigate to:
```
http://localhost:3000
```

## 🎮 How to Play

1. Join a game room or create a new one
2. Each player starts with 5 dice
3. Players take turns making bids about the number of dice of a certain value
4. Players can either:
   - Make a higher bid
   - Challenge the previous bid
5. If a bid is challenged, all players reveal their dice
6. If the bid was correct, the challenger loses a die
7. If the bid was incorrect, the bidder loses a die
8. The last player with dice remaining wins!

## 🛠️ Built With

- [Node.js](https://nodejs.org/) - JavaScript runtime
- [Express](https://expressjs.com/) - Web framework
- [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) - Real-time communication

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- Sayre Alexander

## 🙏 Acknowledgments

- Inspired by the video game Liar's Bar