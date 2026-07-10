function Login({ name, setName, roomId, setRoomId, joinMeeting }) {
  return (
    <div className="container">
      <div className="login-box">
        <h1>Smart WebRTC</h1>

        <input
          type="text"
          placeholder="Enter your Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />

        <button onClick={joinMeeting}>
          Join Meeting
        </button>
      </div>
    </div>
  );
}

export default Login;