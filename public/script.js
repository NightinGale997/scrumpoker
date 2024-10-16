const socket = io();

let votesRevealed = false;
let username;

window.addEventListener('load', () => {
  const roomIdInput = document.getElementById('roomId');
  const roomIdContainer = document.getElementById('roomIdContainer');
  const roomId = getRoomIdFromURL();

  if (roomId) {
    roomIdInput.value = roomId;
    roomIdInput.disabled = true;
    roomIdContainer.style.display = 'none';
  }
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  const roomId = document.getElementById('roomId').value;
  username = document.getElementById('username').value;
  const group = document.getElementById('group').value;

  if (!roomId) {
    roomId = generateRoomId();
    window.location.href = `/${roomId}`;
    return;
  }

  if (username && group) {
    socket.emit('joinRoom', { roomId, username, group });
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('roomScreen').classList.remove('hidden');
    document.getElementById('roomTitle').innerText = roomId;
  }
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

function getRoomIdFromURL() {
  const path = window.location.pathname;
  const roomId = path.substring(1);
  return roomId || null;
}

socket.on('updateVotesRevealed', (state) => {
  votesRevealed = state;
});

socket.on('updateUsers', (users) => {
  const usersDiv = document.getElementById('users');
  usersDiv.innerHTML = '';

  const groups = {
    Development: [],
    Analysis: [],
    Testing: [],
    PO: []
  };

  users.forEach(user => {
    groups[user.group].push(user);
  });

  if (votesRevealed) {
    for (const group in groups) {
      groups[group].sort((a, b) => {
        const voteA = isNaN(a.vote) ? 0.1 : Number(a.vote);
        const voteB = isNaN(b.vote) ? 0.1 : Number(b.vote);
        return voteA - voteB;
      });
    }
  }

  for (const group in groups) {
    const groupDiv = document.createElement('div');
    groupDiv.classList.add('p-4', 'bg-white', 'rounded', 'shadow-md');

    let groupColor = '';
    switch (group) {
      case 'Development':
        groupColor = 'text-blue-500';
        groupName = 'Разработка';
        break;
      case 'Analysis':
        groupColor = 'text-green-500';
        groupName = 'Анализ';
        break;
      case 'Testing':
        groupColor = 'text-red-500';
        groupName = 'Тестирование';
        break;
      case 'PO':
        groupColor = 'text-gray-500';
        groupName = 'Другое';
        groupDiv.classList.add('col-start-2')
        break;
    }

    groupDiv.innerHTML = `<h3 class="text-xl font-bold mb-2 ${groupColor}">${groupName}</h3>`;
    
    groups[group].forEach(user => {
      const userDiv = document.createElement('div');
      userDiv.classList.add('flex', 'justify-between', 'max-w-3xl', 'items-center', 'mb-0','mt-0', 'py-1', 'px-3', 'rounded-b-none', 'border-b', 'border-gray-300', 'shadow-sm');

      // Создаем контейнер для имени и оценки
      const userInfoDiv = document.createElement('div');
      userInfoDiv.classList.add('flex', 'items-center');

      const userNameSpan = document.createElement('div');
      userNameSpan.innerText = user.username;

      const userVoteDiv = document.createElement('div');
      userVoteDiv.classList.add('p-2', 'w-12', 'flex', 'items-center', 'm-1', 'mr-2', 'rounded', 'shadow-md');
      const userVoteSpan = document.createElement('p');
      userVoteSpan.classList.add('font-bold', 'text-center', 'w-full');
      userVoteDiv.append(userVoteSpan);

      if (user.vote !== null && user.vote !== 0) {
        userVoteSpan.innerText = votesRevealed ? user.vote : '★';
      } else {
        userVoteSpan.innerText = '—';
      }

      // Добавляем имя и оценку в контейнер
      userInfoDiv.appendChild(userNameSpan);

      userDiv.appendChild(userInfoDiv);
      userDiv.appendChild(userVoteDiv);

      // Добавляем окрашивание строки в зависимости от оценки после открытия оценок
      if (votesRevealed && user.vote !== null) {
        color = getColorClassByVote(user.vote);
        if (color !== null) userVoteDiv.classList.add(color);
      }

      groupDiv.appendChild(userDiv);
    });

    usersDiv.appendChild(groupDiv);
  }
  selectedCard = users.every((user) => user.vote === 0) ? null : selectedCard;
  updateSelectedCard();
});

document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('click', () => {
    const vote = card.getAttribute('data-value');
    const roomId = document.getElementById('roomTitle').innerText;
    socket.emit('sendVote', { roomId, vote });
    selectedCard = vote;
    highlightSelectedCard();
  });
});

document.getElementById('resetVotesBtn').addEventListener('click', () => {
  const roomId = document.getElementById('roomTitle').innerText;
  socket.emit('resetVotes', roomId);
  votesRevealed = false;
  selectedCard = null;
  highlightSelectedCard();
});

document.getElementById('revealVotesBtn').addEventListener('click', () => {
  votesRevealed = true;
  const roomId = document.getElementById('roomTitle').innerText;
  socket.emit('requestUpdate', roomId);
});

function highlightSelectedCard() {
  document.querySelectorAll('.card').forEach(card => {
    if (card.getAttribute('data-value') === selectedCard) {
      card.classList.add('bg-blue-200');
    } else {
      card.classList.remove('bg-blue-200');
    }
  });
}

function updateSelectedCard() {
  highlightSelectedCard();
}

function getColorClassByVote(vote) {
  switch (vote) {
    case '0.5':
      return 'bg-cyan-300';
    case '1':
      return 'bg-indigo-300';
    case '2':
      return 'bg-green-300';
    case '3':
      return 'bg-orange-300';
    case '5':
      return 'bg-pink-300';
    case '8':
      return 'bg-red-300';
    case '13':
      return 'bg-red-400';
    case '?':
      return 'bg-gray-100';
    case '☕':
      return 'bg-gray-100';
    case 0:
      return null;
    default:
      return 'bg-red-500';
  }
}
