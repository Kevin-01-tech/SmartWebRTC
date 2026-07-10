const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
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

  socket.on("disconnect", () => {

    socket.to(socket.roomId).emit("user-left");

    console.log("Disconnected");

  });

});

server.listen(5000, () => {

  console.log("🚀 Server Running on Port 5000");

});