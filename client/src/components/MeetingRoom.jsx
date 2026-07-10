
import socket from "../socket";
import { useEffect, useRef, useState } from "react";

function MeetingRoom({ name, roomId, leaveMeeting }) {
  const localVideo = useRef(null);
  const localStream = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream.current = stream;

        localVideo.current.srcObject = stream;
      } catch (error) {
        console.log(error);
      }
    }

    startCamera();
    socket.emit("join-room", roomId);
    socket.on("receive-message", (data)=>{

    setMessages((prev)=>[
        ...prev,
        `${data.user}: ${data.text}`
    ]);

});
return ()=>{

    socket.off("receive-message");

};
  }, [roomId]);

  const sendMessage = () => {

    if(message.trim()==="") return;

    socket.emit("send-message", {
        user:name,
        text:message
    });

    setMessage("");

};

  const toggleMic = () => {

  if (!localStream.current) return;

  const audioTrack = localStream.current.getAudioTracks()[0];

  if (!audioTrack) return;

  audioTrack.enabled = !audioTrack.enabled;

  setMicOn(audioTrack.enabled);

};

  return (
    <div className="meeting-room">

      <h1>Smart WebRTC</h1>

      <p>Room ID: {roomId}</p>

      <div className="meeting-container">

        <div>

          <div className="video-section">

            <video
              ref={localVideo}
              autoPlay
              playsInline
              muted
              className="video-box"
            ></video>

            <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className="video-box"
            />

          </div>

          <div className="controls">

            <button onClick={toggleMic}>
  {micOn ? "🎤 Mic On" : "🔇 Mic Off"}
</button>
            <button>📷 Camera</button>
            <button>💻 Share</button>
            <button
            style={{ background: "red" }}
            onClick={leaveMeeting}
            >
              Leave
            </button>

          </div>

        </div>

        <div className="chat-panel">

          <h2>Chat</h2>

          <div className="messages">

            {messages.map((msg, index) => (
              <p key={index}>{msg}</p>
            ))}

          </div>

          <input
            type="text"
            placeholder="Type message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button onClick={sendMessage}>
            Send
          </button>

        </div>

      </div>

    </div>
  );
}

export default MeetingRoom;