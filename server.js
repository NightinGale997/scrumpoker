const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);
const path = require('path');

// Хранение данных о комнатах и пользователях
let rooms = {};

// Настройка статической папки
app.use(express.static(path.join(__dirname, 'public')));

// Обработка GET-запроса на корень
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка GET-запроса на корень и на динамические маршруты
app.get('/:roomId?', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Добавим переменную для хранения состояния открытия оценок для каждой комнаты
let votesRevealedState = {};

io.on('connection', (socket) => {
  console.log('Новое соединение:', socket.id);

  socket.on('joinRoom', ({ roomId, username, group }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      votesRevealedState[roomId] = false; // Инициализируем состояние
    }

    rooms[roomId].push({
      id: socket.id,
      username,
      group,
      vote: 0,
    });

    io.to(roomId).emit('updateVotesRevealed', votesRevealedState[roomId]); // Отправляем состояние новому пользователю
    io.to(roomId).emit('updateUsers', rooms[roomId]);
  });

  socket.on('sendVote', ({ roomId, vote }) => {
    const user = rooms[roomId].find(u => u.id === socket.id);
    if (user) {
      user.vote = vote;
      io.to(roomId).emit('updateUsers', rooms[roomId]);
    }
  });

  socket.on('resetVotes', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].forEach(u => u.vote = 0);
      votesRevealedState[roomId] = false; // Сбрасываем состояние открытия оценок
      io.to(roomId).emit('updateUsers', rooms[roomId]);
      io.to(roomId).emit('updateVotesRevealed', votesRevealedState[roomId]); // Обновляем состояние для всех
    }
  });

  socket.on('requestUpdate', (roomId) => {
    if (votesRevealedState[roomId] !== undefined) {
      votesRevealedState[roomId] = true;
      io.to(roomId).emit('updateUsers', rooms[roomId]);
      io.to(roomId).emit('updateVotesRevealed', votesRevealedState[roomId]);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
      io.to(roomId).emit('updateUsers', rooms[roomId]);
    }
  });
});


server.listen(3000, () => {
  console.log('Сервер запущен на порту 3000');
});
