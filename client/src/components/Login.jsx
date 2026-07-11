function Login({
  name,
  setName,
  roomId,
  setRoomId,
  joinMeeting,
}) {
  function handleJoin(event) {
    event.preventDefault();

    if (!name.trim() || !roomId.trim()) {
      alert("Enter your name and room ID.");
      return;
    }

    joinMeeting();
  }

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "20px",
        overflowY: "auto",
        background:
          "radial-gradient(circle at top, #172554, #0b0f19 55%)",
      }}
    >
      <form
        className="login-box"
        onSubmit={handleJoin}
      >
        <div className="login-logo">SW</div>

        <h1>Smart WebRTC</h1>

        <p className="login-subtitle">
          AI Network Predictive Communication
        </p>

        <label htmlFor="user-name">
          Your name
        </label>

        <input
          id="user-name"
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
        />

        <label htmlFor="room-id">
          Room ID
        </label>

        <input
          id="room-id"
          type="text"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(event) =>
            setRoomId(event.target.value)
          }
        />

        <button type="submit">
          Join Meeting
        </button>

        <span className="login-note">
          Secure peer-to-peer communication
        </span>
      </form>
    </main>
  );
}

export default Login;