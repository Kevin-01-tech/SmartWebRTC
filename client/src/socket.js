import { io } from "socket.io-client";

const serverUrl =
  import.meta.env.VITE_SERVER_URL ||
  "http://localhost:5000";

const socket = io(serverUrl, {
  transports: ["websocket", "polling"],
});

export default socket;