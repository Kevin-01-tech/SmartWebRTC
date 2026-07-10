import { useState } from "react";
import "./App.css";

import Login from "./components/Login";
import MeetingRoom from "./components/MeetingRoom";

function App() {

  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");

  const [joined, setJoined] = useState(false);

  const joinMeeting = () => {

    if(name==="" || roomId===""){
      alert("Please enter Name and Room ID");
      return;
    }

    setJoined(true);

  };
  const leaveMeeting = () => {
  setJoined(false);
  setName("");
  setRoomId("");
};

  return (

    joined ?

    <MeetingRoom
      name={name}
      roomId={roomId}
      leaveMeeting={leaveMeeting}
    />

    :

    <Login
      name={name}
      setName={setName}
      roomId={roomId}
      setRoomId={setRoomId}
      joinMeeting={joinMeeting}
    />

  );

}

export default App;