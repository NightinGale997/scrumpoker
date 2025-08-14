const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const fs = require("fs");
const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
  },
});
const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const cors = require('cors');

app.use((req, res, next) => {
  res.append("Access-Control-Allow-Origin", ["*"]);
  res.append("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
  res.append("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Хранение данных о комнатах и пользователях
let rooms = {};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "temp/"); // Directory to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, crypto.randomUUID() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });
app.post("/uploadAvatar", upload.any(), async (req, res) => {
  console.log(req.files[0]);
  if (!req.files[0]) {
    return res.status(400).send("No image uploaded.");
  }
  const inputPath = req.files[0].path;
  const filename = crypto.randomUUID() + '.jpeg';
  const outputPath = "user_avatars/" + filename;

  try {
    console.log('start resize');
    await sharp(inputPath)
      .resize(100, 100, { fit: "cover",  })
      .toFormat('jpeg', { quality: 75 })
      .toFile(outputPath);

    console.log('finish resize');
    fs.unlinkSync(inputPath);
    res.json({
      image: filename,
    });
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).send("Error processing image.");
  }
});

// Настройка статической папки
app.use(express.static(path.join(__dirname, "public")));

// Обработка GET-запроса для динамических маршрутов
app.get("/avatars/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "user_avatars", req.params["filename"]));
});

app.post("/api/rooms", (req, res) => {
  console.log('new room!');
  console.log(req.body);
  const roomId = crypto.randomUUID();
  rooms[roomId] = {
    id: roomId,
    users: [],
    estimatesRevealed: false,
    lockEstimates: false,
    settings: {
      name: req.body.name,
      description: req.body.description,
      groupByTag: false,
      lockEstimatesWhenShowed: false,
      kickTimeout: "00:01:00"
    },
    tags: req.body.tags
  };
  res.json({
    roomId: roomId
  });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const roomId = req.params["roomId"];
  if (!rooms[roomId]) {
    res.sendStatus(404);
    return;
  }

  res.json({
    ...rooms[roomId],
    users: rooms[roomId].users.map((u) => {
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        tag: u.tag,
        estimateSelected: u.estimateSelected,
        estimate: rooms[roomId].estimatesRevealed ? u.estimate : undefined
      };
    }),
  });
});

const updateEstimates = (roomId) => {
  if (!rooms[roomId]) {
    return;
  }
  let users = [];
  if (rooms[roomId].estimatesRevealed) {
    users = rooms[roomId].users.map((u) => {
      return {
        id: u.id,
        name: u.name,
        estimateSelected: u.estimateSelected,
        estimate: u.estimate,
        tag: u.tag,
        avatar: u.avatar
      };
    });
  } else {
    users = rooms[roomId].users.map((u) => {
      return {
        id: u.id,
        estimateSelected: u.estimateSelected,
        tag: u.tag,
        avatar: u.avatar,
        name: u.name
      };
    });
  }

  io.to(roomId).emit("updateEstimates", {
    lockEstimates: rooms[roomId].lockEstimates,
    estimatesRevealed: rooms[roomId].estimatesRevealed,
    users: users,
  });
};

io.on("connection", (socket) => {
  console.log("Новое соединение:", socket.id);

  socket.on("updateUser", ({roomId, data}) => {
    if (!rooms[roomId]) {
      return;
    }

    const user = rooms[roomId].users.find((u) => u.id === socket.data.userId);

    user.name = data.name;
    user.avatar = data.avatar;
    user.tag = data.tag;
    user.estimate = data.estimate;
    user.estimateSelected = data.estimateSelected;

    io.to(roomId).emit("editUser", { id: user.id, ...data });
  });

  socket.on("updateRoomSettings", ({roomId, settings}) => {
    if (!rooms[roomId]) {
      return;
    }

    if (!settings.lockEstimatesWhenShowed) {
      rooms[roomId].lockEstimates = false;
    }

    rooms[roomId].settings = settings;
    console.log(settings);
    io.to(roomId).emit("editRoomSettings", rooms[roomId].settings);
  });

  socket.on("updateTag", (roomId, data) => {
    if (!rooms[roomId]) {
      return;
    }

    const tag = rooms[roomId].tags.find((t) => t.name === data.name);

    if (!tag) {
      return;
    }

    tag.color = data.color;
    tag.order = data.order;

    io.to(roomId).emit("editTag", tag);
  });

  socket.on("addTag", (roomId, data) => {
    if (!rooms[roomId]) {
      return;
    }

    const tag = rooms[roomId].tags.find((t) => t.name === data.name);

    if (tag) {
      return;
    }

    rooms[roomId].tags.push({
      name: data.name,
      color: data.color,
      order: data.order,
    });

    io.to(roomId).emit("newTag", data);
  });

  socket.on("removeTag", (roomId, tagName) => {
    if (!rooms[roomId]) {
      return;
    }
    const tag = rooms[roomId].tags.find((t) => t.name === tagName);
    if (!tag) {
      return;
    }

    rooms[roomId] = rooms[roomId].tags.filter((t) => t.name !== tagName);
    io.to(roomId).emit("deleteTag", tagName);
  });

  socket.on("joinRoom", ({ roomId, data }) => {
    const { name, tag, estimate, id, avatar, estimateSelected } = data;

    if (rooms[roomId] && rooms[roomId].users.some(u => u.id === socket.data.userId)) {
      return;
    }
    socket.join(roomId);

    // Инициализация комнаты, если она ещё не существует
    if (!rooms[roomId]) {
      rooms[roomId] = {
        roomSettings: {},
        users: [],
      };
    }

    socket.data.userId = id;

    // Добавление пользователя в комнату
    rooms[roomId].users.push({
      id: id,
      name: name,
      estimate: estimate,
      avatar: avatar,
      estimateSelected: estimateSelected,
      tag: tag
    });

    io.to(roomId).emit("addUser", { ...data });
  });

  socket.on("submitEstimate", ({ roomId, estimate }) => {
    if (!rooms[roomId] || rooms[roomId].lockEstimates) {
      return;
    }

    const user = rooms[roomId].users.find((u) => u.id === socket.data.userId);
    if (!user) {
      return;
    }
    console.log(estimate);
    user.estimate = estimate;
    user.estimateSelected = estimate ? true : false;
    updateEstimates(roomId);
  });

  socket.on("changeEstimatesVisibility", ({roomId, estimatesRevealed}) => {
    if (!rooms[roomId]) {
      return;
    }

    if (rooms[roomId].settings.lockEstimatesWhenShowed) {
      rooms[roomId].lockEstimates = estimatesRevealed;
    }
    console.log('смена видимости оценок на ' + estimatesRevealed);
    rooms[roomId].estimatesRevealed = estimatesRevealed;
    updateEstimates(roomId);
  });

  socket.on("resetEstimates", (roomId) => {
    if (!rooms[roomId]) {
      return;
    }

    rooms[roomId].users.forEach((u) => {
      u.estimate = undefined;
      u.estimateSelected = false;
    });

    rooms[roomId].estimatesRevealed = false;
    rooms[roomId].lockEstimates = false;

    updateEstimates(roomId);
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const user = rooms[roomId].users.find((u) => u.id === socket.data.userId);
      rooms[roomId].users = rooms[roomId].users.filter(
        (u) => u.id !== socket.data.userId
      );
      if (rooms[roomId].users.length === 0) {
        // delete rooms[roomId];
      } else if (user) {
        io.to(roomId).emit("removeUser", user.id);
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Сервер запущен на порту 3000");
});
