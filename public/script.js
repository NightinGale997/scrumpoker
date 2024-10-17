const socket = io({
  reconnectionAttempts: Infinity, // Keep trying indefinitely
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
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
    groupDiv.classList.add('p-4', 'max-w-xl', 'w-full', 'bg-white', 'rounded', 'shadow-md');
    maingroupDiv.appendChild(groupDiv)
    let groupColor = '';
    switch (group) {
      case 'Development':
        groupColor = 'text-blue-500';
        groupName = 'Разработка';
        maingroupDiv.classList.add('md:justify-end', 'flex', 'justify-center');
        break;
      case 'Analysis':
        groupColor = 'text-green-500';
        groupName = 'Анализ';
        maingroupDiv.classList.add('md:justify-end', 'flex', 'justify-center');
        break;
      case 'Testing':
        groupColor = 'text-red-500';
        groupName = 'Тестирование';
        maingroupDiv.classList.add('md:justify-start', 'flex', 'justify-center');
        break;
      case 'PO':
        groupColor = 'text-cyan-500';
        groupName = 'PO';
        maingroupDiv.classList.add('md:justify-start', 'flex', 'justify-center');
        break;
    }
    groupDiv.innerHTML = `<h3 class="text-xl font-bold mb-2 ${groupColor}">${groupName}</h3>`;
    
    let avg = 0;
    let countForAvg = 0;
    groups[group].forEach(user => {
      const userDiv = document.createElement('div');
      userDiv.classList.add('flex', 'justify-between', 'items-center', 'mb-0','mt-0', 'py-1', 'px-3', 'rounded-b-none', 'border-b', 'border-gray-300', 'shadow-sm');

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
        if (votesRevealed && !isNaN(user.vote)) {
          avg += user.vote;
          countForAvg += 1;
        }
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
  disconnected = true;
});

function highlightSelectedCard() {
  document.querySelectorAll('.card').forEach(card => {
    if (card.getAttribute('data-value') === selectedCard) {
      card.classList.add('bg-blue-200');
      card.classList.remove('bg-white');
    } else {
      card.classList.remove('bg-blue-200');
      card.classList.add('bg-white');
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
      return 'bg-red-200';
    case '13':
      return 'bg-red-300';
    case '?':
      return 'bg-gray-100';
    case '☕':
      return 'bg-gray-100';
    case 0:
      return null;
    default:
      return 'bg-red-400';
  }
}
