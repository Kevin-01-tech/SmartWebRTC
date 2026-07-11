import { useEffect, useRef, useState } from "react";
import socket from "../socket";

const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

function MeetingRoom({ name, roomId, leaveMeeting }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const localStream = useRef(null);
  const peerRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const videoSenderRef = useRef(null);
const screenStreamRef = useRef(null);
const previousBytesRef = useRef(0);
const previousStatsTimeRef = useRef(0);
const hasConnectedRef = useRef(false);
const networkHistoryRef = useRef([]);
const lastOptimizationRef = useRef("");

const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Stores ICE candidates that arrive before remote description
  const pendingCandidates = useRef([]);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [networkStats, setNetworkStats] = useState({
  status: "Waiting",
  latency: 0,
  bitrate: 0,
  packetLoss: 0,
  jitter: 0,
});
const [networkPrediction, setNetworkPrediction] =
  useState({
    predictedQuality: "Waiting",
    riskLevel: "Low",
    message: "Waiting for network data.",
    optimization: "Normal mode",
  });
const [meetingStartTime] = useState(Date.now());

const [showSummary, setShowSummary] =
  useState(false);

const [meetingSummary, setMeetingSummary] =
  useState(null);

  async function startMedia() {
    const combinedStream = new MediaStream();

    // Request microphone separately
    try {
      const audioStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

      audioStream.getAudioTracks().forEach((track) => {
        combinedStream.addTrack(track);
      });

      setMicOn(true);
      console.log("Microphone connected");
    } catch (error) {
      console.error("Microphone error:", error);
      setMicOn(false);
    }

    // Request camera separately
    try {
      const videoStream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

      videoStream.getVideoTracks().forEach((track) => {
        combinedStream.addTrack(track);
      });

      setCameraOn(true);
      console.log("Camera connected");
    } catch (error) {
      console.error("Camera error:", error);
      setCameraOn(false);
    }

    localStream.current = combinedStream;

    if (localVideo.current) {
      localVideo.current.srcObject = combinedStream;
    }
  }

  function createPeerConnection() {
    if (peerRef.current) {
      return peerRef.current;
    }

    const peer = new RTCPeerConnection(configuration);

    peerRef.current = peer;

    const stream = localStream.current;

    const audioTrack = stream?.getAudioTracks()[0];
    const videoTrack = stream?.getVideoTracks()[0];

    /*
      Important:
      Even when this PC has no camera, it still creates
      a video transceiver so it can RECEIVE phone video.
    */

    if (audioTrack) {
      peer.addTrack(audioTrack, stream);
    } else {
      peer.addTransceiver("audio", {
        direction: "recvonly",
      });
    }

    if (videoTrack) {
  videoSenderRef.current = peer.addTrack(
    videoTrack,
    stream
  );
} else {
  const videoTransceiver = peer.addTransceiver(
    "video",
    {
      direction: "sendrecv",
    }
  );

  videoSenderRef.current =
    videoTransceiver.sender;
}

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
        });
      }
    };

    peer.ontrack = (event) => {
  console.log(
    "Remote track received:",
    event.track.kind
  );

  // Avoid adding the same track twice
  const alreadyAdded =
    remoteStreamRef.current
      .getTracks()
      .some(
        (track) => track.id === event.track.id
      );

  if (!alreadyAdded) {
    remoteStreamRef.current.addTrack(
      event.track
    );
  }

  if (remoteVideo.current) {
    remoteVideo.current.srcObject =
      remoteStreamRef.current;

    remoteVideo.current
      .play()
      .catch((error) => {
        console.log(
          "Remote autoplay blocked:",
          error
        );
      });
  }
};

    peer.onconnectionstatechange = () => {
  const connectionState = peer.connectionState;

  console.log(
    "WebRTC connection state:",
    connectionState
  );

  if (
    connectionState === "new" ||
    connectionState === "connecting"
  ) {
    setNetworkStats((previousStats) => ({
      ...previousStats,
      status: "Connecting",
    }));
  }

  if (connectionState === "connected") {
    hasConnectedRef.current = true;

    setNetworkStats((previousStats) => ({
      ...previousStats,
      status: "Excellent",
    }));
  }

  if (
    connectionState === "disconnected" ||
    connectionState === "failed" ||
    connectionState === "closed"
  ) {
    setNetworkStats({
  status: "Disconnected",
  latency: 0,
  bitrate: 0,
  packetLoss: 0,
  jitter: 0,
});
setNetworkPrediction({
    predictedQuality: "Disconnected",
    riskLevel: "High",
    message: "The WebRTC connection is unavailable.",
    optimization: "Connection stopped",
  });
   networkHistoryRef.current = [];
   lastOptimizationRef.current = "";
  }
};

    peer.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        peer.iceConnectionState
      );
    };

    return peer;
  }

  async function addPendingCandidates() {
    if (!peerRef.current?.remoteDescription) return;

    for (const candidate of pendingCandidates.current) {
      try {
        await peerRef.current.addIceCandidate(candidate);
      } catch (error) {
        console.error("Pending ICE error:", error);
      }
    }

    pendingCandidates.current = [];
  }


  useEffect(() => {
    const handleUserJoined = async () => {
      try {
        setNetworkStats((previousStats) => ({
  ...previousStats,
  status: "Connecting",
}));
        console.log("Second user joined. Creating offer.");

        const peer = createPeerConnection();

        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        socket.emit("offer", {
          offer: peer.localDescription,
        });
      } catch (error) {
        console.error("Offer creation error:", error);
      }
    };

    const handleOffer = async ({ offer }) => {
      try {
        setNetworkStats((previousStats) => ({
  ...previousStats,
  status: "Connecting",
}));
        console.log("Offer received");

        const peer = createPeerConnection();

        await peer.setRemoteDescription(offer);

        await addPendingCandidates();

        const answer = await peer.createAnswer();

        await peer.setLocalDescription(answer);

        socket.emit("answer", {
          answer: peer.localDescription,
        });
      } catch (error) {
        console.error("Offer handling error:", error);
      }
    };

    const handleAnswer = async ({ answer }) => {
      try {
        console.log("Answer received");

        if (!peerRef.current) return;

        await peerRef.current.setRemoteDescription(answer);

        await addPendingCandidates();
      } catch (error) {
        console.error("Answer handling error:", error);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;

      const iceCandidate = new RTCIceCandidate(candidate);

      if (
        peerRef.current &&
        peerRef.current.remoteDescription
      ) {
        try {
          await peerRef.current.addIceCandidate(iceCandidate);
        } catch (error) {
          console.error("ICE candidate error:", error);
        }
      } else {
        pendingCandidates.current.push(iceCandidate);
      }
    };

    const handleMessage = (data) => {
      setMessages((previousMessages) => [
        ...previousMessages,
        `${data.user}: ${data.text}`,
      ]);
    };
    const handleScreenShareStopped = () => {
  console.log(
    "Remote screen sharing stopped"
  );

  const videoTracks =
    remoteStreamRef.current.getVideoTracks();

  videoTracks.forEach((track) => {
    track.stop();
    remoteStreamRef.current.removeTrack(track);
  });

  if (remoteVideo.current) {
    remoteVideo.current.pause();
    remoteVideo.current.srcObject = null;
    remoteVideo.current.load();
  }
};

   const handleUserLeft = () => {
  console.log("Remote user left");
  setNetworkStats({
  status: "Disconnected",
  latency: 0,
  bitrate: 0,
  packetLoss: 0,
  jitter: 0,
});
setNetworkPrediction({
  predictedQuality: "Disconnected",
  riskLevel: "High",
  message:
    "The remote participant has disconnected.",
  optimization: "Connection stopped",
});

networkHistoryRef.current = [];
lastOptimizationRef.current = "";
previousBytesRef.current = 0;
previousStatsTimeRef.current = 0;

hasConnectedRef.current = true;

  // Stop and remove all remote tracks
  remoteStreamRef.current
    .getTracks()
    .forEach((track) => {
      track.stop();
      remoteStreamRef.current.removeTrack(track);
    });

  // Completely clear the remote video element
  if (remoteVideo.current) {
    remoteVideo.current.pause();
    remoteVideo.current.srcObject = null;
    remoteVideo.current.removeAttribute("src");
    remoteVideo.current.load();
  }

  // Close the old WebRTC peer connection
  if (peerRef.current) {
    peerRef.current.close();
    peerRef.current = null;
  }

  videoSenderRef.current = null;
  pendingCandidates.current = [];

  console.log("Remote video cleared");
};

    async function initializeMeeting() {
      await startMedia();

      socket.on("user-joined", handleUserJoined);
      socket.on("offer", handleOffer);
      socket.on("answer", handleAnswer);
      socket.on("ice-candidate", handleIceCandidate);
      socket.on("receive-message", handleMessage);
      
      socket.on(
  "screen-share-stopped",
  handleScreenShareStopped
);
      socket.on("user-left", handleUserLeft);
      socket.emit("join-room", roomId);
    }

    initializeMeeting();

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("receive-message", handleMessage);
      
      socket.off(
  "screen-share-stopped",
  handleScreenShareStopped
);
      socket.off("user-left", handleUserLeft);

     localStream.current
  ?.getTracks()
  .forEach((track) => {
    track.stop();
  });

screenStreamRef.current
  ?.getTracks()
  .forEach((track) => {
    track.stop();
  });

remoteStreamRef.current
  .getTracks()
  .forEach((track) => {
    remoteStreamRef.current.removeTrack(track);
  });

peerRef.current?.close();

peerRef.current = null;
videoSenderRef.current = null;
screenStreamRef.current = null; 

networkHistoryRef.current = [];
lastOptimizationRef.current = "";

previousBytesRef.current = 0;
previousStatsTimeRef.current = 0;
    };
  }, [roomId]);

  function predictNetworkQuality(history) {
  if (history.length < 3) {
    return {
      predictedQuality: "Collecting Data",
      riskLevel: "Low",
      message: "Collecting recent network samples.",
    };
  }

  const recent = history.slice(-5);

  const first = recent[0];
  const last = recent[recent.length - 1];

  let riskScore = 0;

  // Latency trend
  if (last.latency > first.latency + 80) {
    riskScore += 2;
  } else if (last.latency > first.latency + 30) {
    riskScore += 1;
  }

  // Packet-loss trend
  if (last.packetLoss > first.packetLoss + 3) {
    riskScore += 2;
  } else if (
    last.packetLoss > first.packetLoss + 1
  ) {
    riskScore += 1;
  }

  // Bitrate trend
  if (
    first.bitrate > 0 &&
    last.bitrate < first.bitrate * 0.5
  ) {
    riskScore += 2;
  } else if (
    first.bitrate > 0 &&
    last.bitrate < first.bitrate * 0.75
  ) {
    riskScore += 1;
  }

  // Current jitter
  if (last.jitter > 50) {
    riskScore += 2;
  } else if (last.jitter > 30) {
    riskScore += 1;
  }

  // Current bad network values
  if (last.latency > 250) {
    riskScore += 2;
  }

  if (last.packetLoss >= 5) {
    riskScore += 2;
  }

  if (
    last.bitrate > 0 &&
    last.bitrate < 150
  ) {
    riskScore += 2;
  }

  if (riskScore >= 5) {
    return {
      predictedQuality: "Weak",
      riskLevel: "High",
      message:
        "Network degradation is likely within the next few samples.",
    };
  }

  if (riskScore >= 2) {
    return {
      predictedQuality: "Good",
      riskLevel: "Medium",
      message:
        "Network quality may decrease soon.",
    };
  }

  return {
    predictedQuality: "Excellent",
    riskLevel: "Low",
    message:
      "The connection is predicted to remain stable.",
  };
}
async function applyNetworkOptimization(
  predictedQuality
) {
  const sender = videoSenderRef.current;

  // No outgoing video track is active
  if (
    !sender ||
    !sender.track ||
    sender.track.kind !== "video"
  ) {
    setNetworkPrediction((previous) => ({
      ...previous,
      optimization:
        "No active video track to optimize",
    }));

    return;
  }

  let mode = "normal";
  let maxBitrate = 1000000;
  let maxFramerate = 30;
  let optimizationMessage =
    "Full video quality enabled";

  if (predictedQuality === "Weak") {
    mode = "low";

    // 150 kbps
    maxBitrate = 150000;

    // 10 FPS
    maxFramerate = 10;

    optimizationMessage =
      "Low bandwidth mode activated";
  } else if (predictedQuality === "Good") {
    mode = "medium";

    // 400 kbps
    maxBitrate = 400000;

    // 20 FPS
    maxFramerate = 20;

    optimizationMessage =
      "Balanced quality mode activated";
  }

  // Avoid applying the same setting repeatedly
  if (lastOptimizationRef.current === mode) {
    return;
  }

  try {
    const parameters = sender.getParameters();

    if (
      !parameters.encodings ||
      parameters.encodings.length === 0
    ) {
      parameters.encodings = [{}];
    }

    parameters.encodings[0].maxBitrate =
      maxBitrate;

    parameters.encodings[0].maxFramerate =
      maxFramerate;

    await sender.setParameters(parameters);

    lastOptimizationRef.current = mode;

    setNetworkPrediction((previous) => ({
      ...previous,
      optimization: optimizationMessage,
    }));

    console.log(
      "Adaptive optimization applied:",
      {
        mode,
        maxBitrate,
        maxFramerate,
      }
    );
  } catch (error) {
    console.error(
      "Video optimization error:",
      error
    );

    setNetworkPrediction((previous) => ({
      ...previous,
      optimization:
        "Optimization could not be applied",
    }));
  }
}

  useEffect(() => {
  async function checkNetworkStats() {
    const peer = peerRef.current;

    if (!peer) {
  const status = hasConnectedRef.current
    ? "Disconnected"
    : "Waiting";

  setNetworkStats({
    status,
    latency: 0,
    bitrate: 0,
    packetLoss: 0,
    jitter: 0,
  });

  setNetworkPrediction({
    predictedQuality: status,
    riskLevel:
      status === "Disconnected"
        ? "High"
        : "Low",
    message:
      status === "Disconnected"
        ? "The remote participant has disconnected."
        : "Waiting for another participant.",
    optimization:
      status === "Disconnected"
        ? "Connection stopped"
        : "Normal mode",
  });

  networkHistoryRef.current = [];

  return;
}

    if (
      peer.connectionState === "failed" ||
      peer.connectionState === "disconnected" ||
      peer.connectionState === "closed"
    ) {
      setNetworkStats({
        status: "Disconnected",
        latency: 0,
        bitrate: 0,
        packetLoss: 0,
        jitter: 0,
      });

      setNetworkPrediction({
        predictedQuality: "Disconnected",
        riskLevel: "High",
        message: "The WebRTC connection is unavailable.",
        optimization: "Connection stopped",
      });
       networkHistoryRef.current = [];  
       lastOptimizationRef.current = "";

previousBytesRef.current = 0;
previousStatsTimeRef.current = 0;

      return;
    }

    try {
      const reports = await peer.getStats();

      let totalBytesReceived = 0;
      let packetsReceived = 0;
      let packetsLost = 0;
      let latency = 0;
      let jitter = 0;

      reports.forEach((report) => {
        if (
          report.type === "inbound-rtp" &&
          !report.isRemote
        ) {
          totalBytesReceived +=
            report.bytesReceived || 0;

          packetsReceived +=
            report.packetsReceived || 0;

          packetsLost +=
            report.packetsLost || 0;

          if (
            typeof report.jitter === "number"
          ) {
            jitter = Math.max(
              jitter,
              Math.round(
                report.jitter * 1000
              )
            );
          }
        }

        if (
          report.type === "candidate-pair" &&
          report.state === "succeeded" &&
          (report.nominated || report.selected)
        ) {
          if (
            typeof report.currentRoundTripTime ===
            "number"
          ) {
            latency = Math.round(
              report.currentRoundTripTime * 1000
            );
          }
        }
      });

      const currentTime = Date.now();

      let bitrate = 0;

      if (
        previousStatsTimeRef.current > 0 &&
        totalBytesReceived >=
          previousBytesRef.current
      ) {
        const byteDifference =
          totalBytesReceived -
          previousBytesRef.current;

        const timeDifference =
          (currentTime -
            previousStatsTimeRef.current) /
          1000;

        if (timeDifference > 0) {
          bitrate = Math.round(
            (byteDifference * 8) /
              timeDifference /
              1000
          );
        }
      }

      previousBytesRef.current =
        totalBytesReceived;

      previousStatsTimeRef.current =
        currentTime;

      const totalPackets =
        packetsReceived + packetsLost;

      const packetLoss =
        totalPackets > 0
          ? Number(
              (
                (packetsLost / totalPackets) *
                100
              ).toFixed(1)
            )
          : 0;

      let status = "Excellent";

      if (latency === 0) {
        status = "Connecting";
      } else if (
        latency <= 100 &&
        packetLoss < 2 &&
        jitter < 30
      ) {
        status = "Excellent";
      } else if (
        latency <= 200 &&
        packetLoss < 5 &&
        jitter < 50
      ) {
        status = "Good";
      } else {
        status = "Weak";
      }

      const newReading = {
        latency,
        bitrate,
        packetLoss,
        jitter,
        timestamp: Date.now(),
      };

      networkHistoryRef.current = [
        ...networkHistoryRef.current,
        newReading,
      ].slice(-5);

      const prediction =
        predictNetworkQuality(
          networkHistoryRef.current
        );
        await applyNetworkOptimization(
  prediction.predictedQuality
);

      setNetworkPrediction((previous) => ({
        ...previous,
        ...prediction,
      }));

      setNetworkStats({
        status,
        latency,
        bitrate,
        packetLoss,
        jitter,
      });
    } catch (error) {
      console.error(
        "Network stats error:",
        error
      );
    }
  }

  checkNetworkStats();

  const intervalId = setInterval(
    checkNetworkStats,
    2000
  );

  return () => {
    clearInterval(intervalId);
  };
}, [roomId]);

  function sendMessage() {
    if (!message.trim()) return;

    socket.emit("send-message", {
      user: name,
      text: message.trim(),
    });

    setMessage("");
  }

  function toggleMic() {
    const audioTrack =
      localStream.current?.getAudioTracks()[0];

    if (!audioTrack) {
      alert("No microphone is available.");
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  }

  function toggleCamera() {
    const videoTrack =
      localStream.current?.getVideoTracks()[0];

    if (!videoTrack) {
      alert("No camera is available on this device.");
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setCameraOn(videoTrack.enabled);
  }
  async function shareScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert(
      "Screen sharing is not supported on this device or browser."
    );
    return;
  }

  if (!peerRef.current) {
    alert(
      "Wait for the other participant to connect before sharing."
    );
    return;
  }

  try {
    const screenStream =
      await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

    const screenTrack =
      screenStream.getVideoTracks()[0];

    if (!screenTrack) {
      alert("No screen video track found.");
      return;
    }

    screenStreamRef.current = screenStream;

    let sender = videoSenderRef.current;

    // Fallback: find the video sender
    if (!sender) {
      sender = peerRef.current
        .getSenders()
        .find((currentSender) => {
          return (
            currentSender.track?.kind === "video"
          );
        });
    }

    if (!sender) {
      alert(
        "Video sender is not ready. Rejoin the room and try again."
      );

      screenStream
        .getTracks()
        .forEach((track) => track.stop());

      return;
    }

    console.log(
      "Replacing outgoing video with screen track"
    );

    await sender.replaceTrack(screenTrack);

    videoSenderRef.current = sender;
    lastOptimizationRef.current = "";

await applyNetworkOptimization(
  networkPrediction.predictedQuality
);

    // Local PC preview
    if (localVideo.current) {
      localVideo.current.srcObject =
        screenStream;
    }

    setIsScreenSharing(true);

    // User clicks browser-native Stop sharing
    screenTrack.onended = () => {
      stopScreenShare();
    };

  } catch (error) {
    console.error(
      "Screen sharing error:",
      error
    );
  }
}
async function stopScreenShare() {
  try {
    const cameraTrack =
      localStream.current?.getVideoTracks()[0];

    const cameraIsAvailable =
      cameraTrack &&
      cameraTrack.readyState === "live";

    const cameraIsOn =
      cameraIsAvailable &&
      cameraTrack.enabled &&
      cameraOn;

    if (cameraIsOn) {
      // PC camera exists and is ON
      await videoSenderRef.current?.replaceTrack(
        cameraTrack
      );

      console.log(
        "Screen sharing stopped. Camera restored."
      );

      // Do not clear the remote video.
      // The phone will automatically receive the camera.
    } else {
      // PC has no camera or camera is OFF
      await videoSenderRef.current?.replaceTrack(null);

      // Tell the phone to clear the frozen screen
      socket.emit("screen-share-stopped");

      console.log(
        "Screen sharing stopped. No active camera."
      );
    }

    // Stop the captured screen track
    screenStreamRef.current
      ?.getTracks()
      .forEach((track) => {
        track.stop();
      });

    screenStreamRef.current = null;

    // Restore local PC preview
    if (localVideo.current) {
      if (cameraIsOn) {
        localVideo.current.srcObject =
          localStream.current;

        localVideo.current
          .play()
          .catch(console.error);
      } else {
        localVideo.current.srcObject = null;
      }
    }

    setIsScreenSharing(false);

  } catch (error) {
    console.error(
      "Stop screen sharing error:",
      error
    );
  }
}
function generateMeetingSummary() {
  const durationMs =
    Date.now() - meetingStartTime;

  const durationMinutes = Math.max(
    1,
    Math.round(durationMs / 60000)
  );

  const actionKeywords = [
    "will",
    "need to",
    "must",
    "complete",
    "finish",
    "submit",
    "test",
    "deploy",
    "prepare",
    "create",
    "update",
  ];

  const actionItems = messages.filter(
    (currentMessage) =>
      actionKeywords.some((keyword) =>
        currentMessage
          .toLowerCase()
          .includes(keyword)
      )
  );

  const summary = {
    duration: durationMinutes,

    participants: [
      name,
      "Remote Participant",
    ],

    discussionPoints:
      messages.length > 0
        ? messages
        : [
            "No chat discussion was recorded.",
          ],

    actionItems:
      actionItems.length > 0
        ? actionItems
        : [
            "No clear action items were detected.",
          ],

    networkStatus:
  networkStats.status === "Waiting" ||
  networkStats.status === "Disconnected"
    ? "Meeting ended"
    : networkStats.status,

    finalSuggestion:
  networkStats.status === "Excellent"
    ? "The meeting connection was stable."
    : networkStats.status === "Good"
    ? "The meeting connection was usable with minor issues."
    : networkStats.status === "Weak"
    ? "The meeting experienced network-quality issues."
    : "The meeting ended successfully.",
  };

  setMeetingSummary(summary);
  setShowSummary(true);
}

  function handleLeave() {
  // First tell the server that this user is leaving
  socket.emit("leave-room");

  // Stop microphone and camera
  localStream.current
    ?.getTracks()
    .forEach((track) => {
      track.stop();
    });

  // Stop screen sharing if active
  screenStreamRef.current
    ?.getTracks()
    .forEach((track) => {
      track.stop();
    });

  // Remove received remote tracks
  remoteStreamRef.current
    .getTracks()
    .forEach((track) => {
      track.stop();
      remoteStreamRef.current.removeTrack(track);
    });

  // Clear local video box
  if (localVideo.current) {
    localVideo.current.pause();
    localVideo.current.srcObject = null;
    localVideo.current.load();
  }

  // Clear remote video box
  if (remoteVideo.current) {
    remoteVideo.current.pause();
    remoteVideo.current.srcObject = null;
    remoteVideo.current.load();
  }

  // Close WebRTC connection
  peerRef.current?.close();

  peerRef.current = null;
  videoSenderRef.current = null;
  screenStreamRef.current = null;
  pendingCandidates.current = [];
  networkHistoryRef.current = [];
lastOptimizationRef.current = "";

previousBytesRef.current = 0;
previousStatsTimeRef.current = 0;

  // Return to login/home screen
  leaveMeeting();
}
if (showSummary && meetingSummary) {
  return (
    <div className="summary-page">
      <div className="summary-card">
        <h1>AI Meeting Summary</h1>

        <div className="summary-section">
          <h3>Meeting Information</h3>

          <p>
            <strong>Duration:</strong>{" "}
            {meetingSummary.duration} minute(s)
          </p>

          <p>
            <strong>Participants:</strong>{" "}
            {meetingSummary.participants.join(
              ", "
            )}
          </p>

          <p>
            <strong>
              Network Quality:
            </strong>{" "}
            {meetingSummary.networkStatus}
          </p>
        </div>

        <div className="summary-section">
          <h3>Key Discussion Points</h3>

          <ul>
            {meetingSummary.discussionPoints.map(
              (point, index) => (
                <li key={index}>
                  {point}
                </li>
              )
            )}
          </ul>
        </div>

        <div className="summary-section">
          <h3>Action Items</h3>

          <ul>
            {meetingSummary.actionItems.map(
              (item, index) => (
                <li key={index}>
                  {item}
                </li>
              )
            )}
          </ul>
        </div>

        <div className="summary-section">
          <h3>Meeting Analysis</h3>

          <p>
            {meetingSummary.finalSuggestion}
          </p>
        </div>

        <button
          className="leave-summary-button"
          onClick={handleLeave}
        >
          Leave Meeting
        </button>
      </div>
    </div>
  );
}

  return (
    <div className="meeting-room">
      <header className="meeting-header">
  <div>
    <h1>Smart WebRTC</h1>

    <p>
      AI-Powered Predictive Communication Platform
    </p>
  </div>

  <div className="room-badge">
    Room: {roomId}
  </div>
</header>
      <div className="network-panel">
  <h3>Network Status</h3>

  <div className="network-status-row">
    <span
      className={`status-dot ${networkStats.status.toLowerCase()}`}
    ></span>

    <strong>{networkStats.status}</strong>
  </div>

  <div className="network-details">
    <span>
      Latency: {networkStats.latency} ms
    </span>

    <span>
      Bitrate: {networkStats.bitrate} kbps
    </span>

    <span>
      Packet Loss: {networkStats.packetLoss}%
    </span>

    <span>
  Jitter: {networkStats.jitter} ms
</span>
  </div>
</div>
<div className="prediction-panel">
  <h3>AI Network Prediction Engine</h3>

  <p>
    <strong>Current Quality:</strong>{" "}
    {networkStats.status}
  </p>

  <p>
    <strong>Predicted Quality:</strong>{" "}
    {networkPrediction.predictedQuality}
  </p>

  <p>
    <strong>Risk Level:</strong>{" "}
    {networkPrediction.riskLevel}
  </p>

  <p>
    <strong>Prediction:</strong>{" "}
    {networkPrediction.message}
  </p>

  <p>
    <strong>Optimization:</strong>{" "}
    {networkPrediction.optimization}
  </p>
  <p>
  <strong>Adaptive Action:</strong>{" "}

  {networkPrediction.predictedQuality === "Weak"
    ? "Video reduced to 150 kbps and 10 FPS to protect call stability."
    : networkPrediction.predictedQuality === "Good"
    ? "Video adjusted to 400 kbps and 20 FPS for balanced quality."
    : networkPrediction.predictedQuality === "Excellent"
    ? "Video restored to 1 Mbps and 30 FPS."
    : networkPrediction.predictedQuality ===
      "Disconnected"
    ? "Optimization stopped because the participant disconnected."
    : "Waiting for enough network information."}
</p>
</div>
      <div className="meeting-container">
        <div>
          <div className="video-section">
  <div className="video-card">
    <video
      ref={localVideo}
      autoPlay
      playsInline
      muted
      className="video-box"
    />

    <div className="participant-label">
      {name} (You)
    </div>

    {!cameraOn && !isScreenSharing && (
      <div className="camera-placeholder">
        <div className="avatar-circle">
          {name?.charAt(0)?.toUpperCase()}
        </div>

        <p>Camera is off</p>
      </div>
    )}
  </div>

  <div className="video-card">
    <video
      ref={remoteVideo}
      autoPlay
      playsInline
      className="video-box"
    />

    <div className="participant-label">
      Remote Participant
    </div>
  </div>
</div>

        <div className="controls">
  <button
    className={`control-button ${
      micOn ? "active" : "inactive"
    }`}
    onClick={toggleMic}
  >
    <span className="control-icon">
      {micOn ? "🎤" : "🔇"}
    </span>

    <span>
      {micOn ? "Mute" : "Unmute"}
    </span>
  </button>

  <button
    className={`control-button ${
      cameraOn ? "active" : "inactive"
    }`}
    onClick={toggleCamera}
  >
    <span className="control-icon">
      {cameraOn ? "📷" : "🚫"}
    </span>

    <span>
      {cameraOn
        ? "Stop Video"
        : "Start Video"}
    </span>
  </button>

  <button
    className={`control-button ${
      isScreenSharing ? "sharing" : ""
    }`}
    onClick={
      isScreenSharing
        ? stopScreenShare
        : shareScreen
    }
  >
    <span className="control-icon">
      {isScreenSharing ? "⏹" : "🖥️"}
    </span>

    <span>
      {isScreenSharing
        ? "Stop Share"
        : "Share Screen"}
    </span>
  </button>

  <button
    className="control-button end-call"
    onClick={generateMeetingSummary}
  >
    <span className="control-icon">
      📞
    </span>

    <span>End Meeting</span>
  </button>
</div>
        </div>

        <div className="chat-panel">
          <h2>Chat</h2>

          <div className="messages">
            {messages.map((currentMessage, index) => (
              <p key={index}>{currentMessage}</p>
            ))}
          </div>

          <input
            type="text"
            placeholder="Type message..."
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                sendMessage();
              }
            }}
          />

          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default MeetingRoom;