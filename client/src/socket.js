import { io } from "socket.io-client";

const socket = io(
  "https://wma-featured-bomb-invisible.trycloudflare.com"
);

export default socket;