const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server);
const path = require('path');

// Хранение данных о комнатах и пользователях
let rooms = {};
let votesRevealedState = {};

// Настройка статической папки
app.use(express.static(path.join(__dirname, 'public')));

// Обработка GET-запроса для динамических маршрутов
app.get('/:roomId?', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Вспомогательная функция для обновления состояния комнаты
const updateRoomState = (roomId) => {
  io.to(roomId).emit('updateVotesRevealed', votesRevealedState[roomId]);
  io.to(roomId).emit('updateUsers', rooms[roomId]);
};

io.on('connection', (socket) => {
  console.log('Новое соединение:', socket.id);

  socket.on('joinRoom', ({ roomId, username, group }) => {
    socket.join(roomId);

    // Инициализация комнаты, если она ещё не существует
    if (!rooms[roomId]) {
      rooms[roomId] = [];
      votesRevealedState[roomId] = false;
    }

    // Добавление пользователя в комнату
    rooms[roomId].push({ id: socket.id, username, group, vote: 0 });

    updateRoomState(roomId);
  });

  socket.on('sendVote', ({ roomId, vote }) => {
    const user = rooms[roomId]?.find(u => u.id === socket.id);
    if (user) {
      user.vote = vote;
      updateRoomState(roomId);
    }
  });

  socket.on('resetVotes', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].forEach(u => u.vote = 0);
      votesRevealedState[roomId] = false;
      updateRoomState(roomId);
    }
  });

  socket.on('requestUpdate', (roomId) => {
    if (votesRevealedState[roomId] !== undefined) {
      votesRevealedState[roomId] = true;
      updateRoomState(roomId);
    }
  });

  socket.on('hideUpdate', (roomId) => {
    if (votesRevealedState[roomId] !== undefined) {
      votesRevealedState[roomId] = false;
      updateRoomState(roomId);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
      if (rooms[roomId].length === 0) {
        // Удаляем комнату, если она пуста
        delete rooms[roomId];
        delete votesRevealedState[roomId];
      } else {
        updateRoomState(roomId);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Сервер запущен на порту 3000');
});
