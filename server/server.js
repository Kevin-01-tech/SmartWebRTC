const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {

  console.log("User Connected:", socket.id);

  socket.on("join-room", (roomId) => {

    socket.join(roomId);
    socket.roomId = roomId;

    console.log(`${socket.id} joined ${roomId}`);

    socket.to(roomId).emit("user-joined", socket.id);

  });

  // Chat
  socket.on("send-message", (data) => {

    io.to(socket.roomId).emit("receive-message", data);

  });

  // WebRTC Offer
  socket.on("offer", ({ offer }) => {

    socket.to(socket.roomId).emit("offer", {
      offer,
      sender: socket.id,
    });

  });

  // WebRTC Answer
  socket.on("answer", ({ answer }) => {

    socket.to(socket.roomId).emit("answer", {
      answer,
      sender: socket.id,
    });

  });

  // ICE Candidate
  socket.on("ice-candidate", ({ candidate }) => {

    socket.to(socket.roomId).emit("ice-candidate", {
      candidate,
      sender: socket.id,
    });

  });
  socket.on("screen-share-stopped", () => {
  socket.to(socket.roomId).emit("screen-share-stopped");
});
   socket.on("leave-room", () => {
  const roomId = socket.roomId;

  if (!roomId) return;

  console.log(
    `User ${socket.id} left room ${roomId}`
  );

  // Tell the other participant
  socket.to(roomId).emit("user-left");

  // Remove this user from the room
  socket.leave(roomId);

  // Clear the stored room ID
  socket.roomId = null;
});

  socket.on("disconnect", () => {
  console.log("User disconnected:", socket.id);

  if (socket.roomId) {
    socket.to(socket.roomId).emit("user-left");
  }
});

});
app.get("/", (req, res) => {
  res.send("SmartWebRTC server is running");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});