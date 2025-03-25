const socket = io({
  reconnectionAttempts: Infinity,
  reconnectionDelay: 100,
  reconnectionDelayMax: 400,
  timeout: 5000,
});

let votesRevealed = false;
let username;
let selectedCard = null;
let roomId;
let group;
let disconnected = false;

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days*24*60*60*1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/`;
}

function getCookie(name) {
  const cname = name + "=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(cname) === 0) {
      return c.substring(cname.length, c.length);
    }
  }
  return "";
}

window.addEventListener('load', () => {
  const roomIdInput = document.getElementById('roomId');
  const roomIdContainer = document.getElementById('roomIdContainer');
  const urlRoomId = getRoomIdFromURL();

  if (urlRoomId) {
    roomIdInput.value = urlRoomId;
    roomIdInput.disabled = true;
    roomIdContainer.style.display = 'none';
  }

  const savedUsername = getCookie('username');
  const savedGroup = getCookie('group');

  if (savedUsername) {
    document.getElementById('username').value = savedUsername;
    username = savedUsername;
  }

  if (savedGroup) {
    document.getElementById('group').value = savedGroup;
    group = savedGroup;
  }

  // Добавляем обработчик на кнопку переключения темы
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      // Переключаем класс 'dark' на <html>
      const htmlEl = document.documentElement;
      htmlEl.classList.toggle('dark');

      // Сохраняем состояние в localStorage
      if (htmlEl.classList.contains('dark')) {
        localStorage.setItem('theme', 'dark');
      } else {
        localStorage.setItem('theme', 'light');
      }
    });
  }
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  roomId = document.getElementById('roomId').value;
  username = document.getElementById('username').value;
  group = document.getElementById('group').value;

  if (!roomId) {
    roomId = generateRoomId();
    window.location.href = `/${roomId}`;
    return;
  }

  if (username && group) {
    setCookie('username', username, 30);
    setCookie('group', group, 30);

    socket.emit('joinRoom', { roomId, username, group });
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('roomScreen').classList.remove('hidden');
    document.getElementById('roomTitle').innerText = decodeURIComponent(roomId);
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
    Testing: [],
    Analysis: [],
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
    const maingroupDiv = document.createElement('div');
    const groupDiv = document.createElement('div');
    // Добавляем светлую и тёмную тему
    groupDiv.classList.add('p-4', 'max-w-xl', 'w-full', 
                           'bg-white', 'rounded', 'shadow-md', "dark:shadow-none", 
                           'dark:bg-gray-800', 'transition-colors', 'duration-300');
    maingroupDiv.appendChild(groupDiv);

    let groupColor = '';
    let groupName = group;
    switch (group) {
      case 'Development':
        groupColor = 'text-blue-500 dark:text-blue-300';
        groupName = 'Разработка';
        maingroupDiv.classList.add('md:justify-end', 'flex', 'justify-center');
        break;
      case 'Analysis':
        groupColor = 'text-green-500 dark:text-green-300';
        groupName = 'Анализ';
        maingroupDiv.classList.add('md:justify-end', 'flex', 'justify-center');
        break;
      case 'Testing':
        groupColor = 'text-red-500 dark:text-red-300';
        groupName = 'Тестирование';
        maingroupDiv.classList.add('md:justify-start', 'flex', 'justify-center');
        break;
      case 'PO':
        groupColor = 'text-cyan-500 dark:text-cyan-300';
        groupName = 'Алексей (PO)';
        maingroupDiv.classList.add('md:justify-start', 'flex', 'justify-center');
        break;
    }
    groupDiv.innerHTML = `<h3 class="text-xl font-bold mb-2 ${groupColor}">${groupName}</h3>`;

    groups[group].forEach(user => {
      const userDiv = document.createElement('div');
      userDiv.classList.add('flex', 'justify-between', 'items-center', 
                            'mb-0','mt-0', 'py-1', 'px-3', 'rounded-b-none', 
                            'border-b', 'border-gray-300', 'shadow-sm', 'dark:shadow-none',
                            'dark:border-gray-700');

      const userInfoDiv = document.createElement('div');
      userInfoDiv.classList.add('flex', 'items-center');

      const userNameSpan = document.createElement('div');
      userNameSpan.innerText = user.username;

      const userVoteDiv = document.createElement('div');
      userVoteDiv.classList.add('p-2', 'w-12', 'flex', 'items-center', 'm-1', 'mr-2', 
                                'rounded', 'shadow-md', 'dark:shadow-none', 'dark:text-gray-900');
      const userVoteSpan = document.createElement('p');
      userVoteSpan.classList.add('font-bold', 'text-center', 'w-full', 'dark:text-gray-200');
      userVoteDiv.append(userVoteSpan);

      if (user.vote !== null && user.vote !== 0) {
        userVoteSpan.innerText = votesRevealed ? user.vote : '★';
      } else {
        userVoteSpan.innerText = '—';
      }

      userInfoDiv.appendChild(userNameSpan);

      userDiv.appendChild(userInfoDiv);
      userDiv.appendChild(userVoteDiv);

      if (votesRevealed && user.vote !== null) {
        const colorClasses = getColorClassByVote(user.vote);
        if (colorClasses) {
          // если это массив
          userVoteDiv.classList.add(...colorClasses);
        }
      }

      groupDiv.appendChild(userDiv);
    });

    usersDiv.appendChild(maingroupDiv);
  }
  selectedCard = users.every((user) => user.vote === 0) ? null : selectedCard;
  updateSelectedCard();
});

document.querySelectorAll('.card').forEach(card => {
  card.addEventListener('click', () => {
    const vote = card.getAttribute('data-value');
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

document.getElementById('hideVotesBtn').addEventListener('click', () => {
  votesRevealed = false;
  const roomId = document.getElementById('roomTitle').innerText;
  socket.emit('hideUpdate', roomId);
});

socket.on('reconnect', () => {
  console.log('Reconnected to server');
  if (username && roomId && group) {
    socket.emit('joinRoom', { roomId, username, group });
    if (selectedCard !== null && selectedCard !== 0) {
      socket.emit('sendVote', { roomId, vote: selectedCard });
    }
  }
});

socket.on('connect', () => {
  console.log('Connected to server');
  document.getElementById('status').innerText = 'ПОДКЛЮЧЁН';
  document.getElementById('status').classList.add('text-green-600');
  document.getElementById('status').classList.remove('text-red-600');
  if (disconnected && username && roomId && group) {
    socket.emit('joinRoom', { roomId, username, group });
    if (selectedCard !== null && selectedCard !== 0) {
      socket.emit('sendVote', { roomId, vote: selectedCard });
    }
  }
});

socket.on('disconnect', (reason) => {
  console.log(`Disconnected from server: ${reason}`);
  document.getElementById('status').innerText = 'НЕ ПОДКЛЮЧЁН: ' + reason;
  document.getElementById('status').classList.add('text-red-600');
  document.getElementById('status').classList.remove('text-green-600');
  disconnected = true;
});

function highlightSelectedCard() {
  document.querySelectorAll('.card').forEach(card => {
    if (card.getAttribute('data-value') === selectedCard) {
      card.classList.add('bg-blue-200', 'dark:bg-blue-800');
      card.classList.remove('bg-white', 'dark:bg-gray-800');
    } else {
      card.classList.remove('bg-blue-200', 'dark:bg-blue-800');
      card.classList.add('bg-white', 'dark:bg-gray-800');
    }
  });
}

function updateSelectedCard() {
  highlightSelectedCard();
}

function getColorClassByVote(vote) {
  switch (vote) {
    case '0.5':
      return ['bg-cyan-300', 'dark:bg-cyan-600', 'dark:text-gray-200'];
    case '1':
      return ['bg-indigo-300', 'dark:bg-indigo-600', 'dark:text-gray-200'];
    case '2':
      return ['bg-green-300', 'dark:bg-green-600', 'dark:text-gray-200'];
    case '3':
      return ['bg-orange-300', 'dark:bg-orange-600', 'dark:text-gray-200'];
    case '5':
      return ['bg-pink-300', 'dark:bg-pink-600', 'dark:text-gray-200'];
    case '8':
      return ['bg-red-200', 'dark:bg-red-600', 'dark:text-gray-200'];
    case '13':
      return ['bg-red-300', 'dark:bg-red-700', 'dark:text-gray-200'];
    case '?':
    case '☕':
      return ['bg-gray-100', 'dark:bg-gray-500', 'dark:text-gray-200'];
    case 0:
      return null; // или []
    default:
      return ['bg-red-400', 'dark:bg-red-800', 'dark:text-gray-200'];
  }
}
