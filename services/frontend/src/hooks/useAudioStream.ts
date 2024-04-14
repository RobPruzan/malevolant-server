// start the audio listen

import { useDefinedUser } from "@/components/camps/camps-state";
import { useGetCamp } from "@/components/camps/message-state";
import { client } from "@/edenClient";
import { serverFnReturnTypeHeader } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

const throwAwaySubscribeFn = client.api.protected.camp.audio({
  campId: "does not matter",
}).subscribe;

type WebRTCSignal =
  | { kind: "webRTC-candidate"; candidate: RTCIceCandidateInit; userId: string }
  | { kind: "webRTC-offer"; offer: RTCSessionDescriptionInit; userId: string }
  | { kind: "webRTC-answer"; answer: RTCSessionDescriptionInit; userId: string }
  | { kind: "user-joined"; userId: string }
  | { kind: "user-left"; userId: string }
  | { kind: "join-channel-request"; broadcasterId: string; userId: string }
  | { kind: "started-broadcast"; userId: string };
type AudioSubscribeType = ReturnType<typeof throwAwaySubscribeFn>;
export const useWebRTCConnection = ({
  campId,
  options,
}: {
  campId: string;
  options?: Partial<{
    listeningToAudio: boolean;
  }>;
}) => {
  const [webRTCConnections, setWebRTCConnections] = useState<
    Array<{ conn: RTCPeerConnection; userId: string }>
  >([]);

  const [connectedUsersForReceiver, setConnectedUsersForReceiver] = useState<
    Array<string>
  >([]);

  const [receiverWebRTCConnection, setReceiverWebRTCConnection] =
    useState<null | RTCPeerConnection>(null);
  const [signalingServerSubscription, setSignalingServerSubscription] =
    useState<WebSocket | null>(null);

  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const [senders, setSenders] = useState<
    Array<{ userId: string; sender: RTCRtpSender }>
  >([]);

  const { camp } = useGetCamp({ campId });
  const user = useDefinedUser();
  useEffect(() => {
    if (!signalingServerSubscription) {
      return;
    }

    if (camp.createdBy === user.id) {
      webRTCConnections.forEach(({ conn, userId }) => {
        conn.onicecandidate = ({ candidate }: RTCPeerConnectionIceEvent) => {
          if (!candidate) {
            return;
          }

          signalingServerSubscription.send(
            JSON.stringify({
              kind: "webRTC-candidate",
              candidate,
              receiverId: userId,
              broadcasterId: camp.createdBy,
            })
          );
        };
      });
      return;
    }

    if (!receiverWebRTCConnection) {
      return;
    }

    receiverWebRTCConnection.onicecandidate = ({ candidate }) => {
      if (!candidate) {
        return;
      }

      signalingServerSubscription.send(
        JSON.stringify({
          kind: "webRTC-candidate",
          candidate,
          broadcasterId: camp.createdBy,
          receiverId: user.id,
        })
      );
    };
  }, [
    webRTCConnections,
    signalingServerSubscription,
    receiverWebRTCConnection,
  ]);

  useEffect(() => {
    if (camp.createdBy === user.id) {
      return;
    }
    const conn = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun2.1.google.com:19302"] }],
    });

    setReceiverWebRTCConnection(conn);
  }, []);

  useEffect(() => {
    if (!webRTCConnections) {
      return;
    }

    const subscription = new WebSocket(
      (import.meta.env.PROD ? "wss://" : "ws://") +
        (import.meta.env.PROD ? "fireside.ninja" : "localhost:8080") +
        `/api/protected/camp/audio/${campId}`
    );

    setSignalingServerSubscription(subscription);

    return () => {
      subscription.close();
      setSignalingServerSubscription(null);
    };
  }, []);

  useEffect(() => {
    if (!signalingServerSubscription) {
      return;
    }

    const handleMessage = async (ws: any) => {
      const typedData: WebRTCSignal = JSON.parse(ws.data);

      const isBroadcaster = camp.createdBy === user.id;

      switch (typedData.kind) {
        case "webRTC-answer": {
          if (isBroadcaster) {
            const userConn = webRTCConnections.find(
              (existingConn) => existingConn.userId === typedData.userId
            );
            if (!userConn) {
              return;
            }

            userConn.conn.setRemoteDescription(
              new RTCSessionDescription(typedData.answer)
            );

            return;
          }

          receiverWebRTCConnection?.setRemoteDescription(
            new RTCSessionDescription(typedData.answer)
          );

          return;
        }
        case "webRTC-candidate": {
          if (isBroadcaster) {
            const userConn = webRTCConnections.find(
              (existingConn) => existingConn.userId === typedData.userId
            );
            if (!userConn) {
              return;
            }
            userConn.conn.addIceCandidate(
              new RTCIceCandidate(typedData.candidate)
            );
            return;
          }

          receiverWebRTCConnection?.addIceCandidate(
            new RTCIceCandidate(typedData.candidate)
          );

          return;
        }
        case "webRTC-offer": {
          if (isBroadcaster) {
            const userConn = webRTCConnections.find(
              (existingConn) => existingConn.userId === typedData.userId
            );
            if (!userConn) {
              return;
            }

            userConn.conn.setRemoteDescription(
              new RTCSessionDescription(typedData.offer)
            );

            const answer = await userConn.conn.createAnswer();

            userConn.conn.setLocalDescription(answer);

            signalingServerSubscription.send(
              JSON.stringify({
                kind: "webRTC-answer",
                answer,
                broadcasterId: camp.createdBy,
                receiverId: userConn.userId,
              })
            );

            return;
          }

          if (!receiverWebRTCConnection) {
            return;
          }

          receiverWebRTCConnection.setRemoteDescription(
            new RTCSessionDescription(typedData.offer)
          );

          const answer = await receiverWebRTCConnection?.createAnswer();

          receiverWebRTCConnection.setLocalDescription(answer);

          signalingServerSubscription.send(
            JSON.stringify({
              kind: "webRTC-answer",
              answer,
              broadcasterId: camp.createdBy,
              receiverId: user.id,
            })
          );
          return;
        }

        case "user-joined": {
          if (isBroadcaster) {
            const conn = new RTCPeerConnection({
              iceServers: [{ urls: ["stun:stun2.1.google.com:19302"] }],
            });

            setWebRTCConnections((prev) => [
              ...(prev ?? []),
              { conn, userId: typedData.userId },
            ]);

            signalingServerSubscription?.send(
              JSON.stringify({
                kind: "join-channel-request",
                broadcasterId: camp.createdBy,
                receiverId: typedData.userId,
              })
            );
            return;
          }

          setConnectedUsersForReceiver((prev) => [
            ...(prev ?? []),
            typedData.userId,
          ]);

          return;
        }

        case "user-left": {
          if (isBroadcaster) {
            setWebRTCConnections((prev) =>
              prev.filter((existingConn) => {
                if (existingConn.userId !== typedData.userId) {
                  existingConn.conn.close();
                  return false;
                }

                return true;
              })
            );

            signalingServerSubscription?.send(
              JSON.stringify({
                kind: "leave-channel-request",
                broadcasterId: camp.createdBy,
                receiverId: typedData.userId,
              })
            );

            return;
          }

          if (typedData.userId === camp.createdAt) {
            receiverWebRTCConnection?.close();
          }
          setConnectedUsersForReceiver((prev) =>
            prev.filter((existingUserId) => existingUserId !== typedData.userId)
          );
          return;
        }

        case "join-channel-request": {
          console.log("got join channel request");
          const userConn = webRTCConnections.find(
            (existingConn) => existingConn.userId === typedData.userId
          );
          if (!userConn) {
            return;
          }

          // webRTCConnections.forEach(async ({ conn, userId }) => {
          //   console.log({ conn });
          // if (conn.state) {
          //   return;
          // }
          const offer = await userConn.conn.createOffer();

          userConn.conn.setLocalDescription(offer);

          signalingServerSubscription.send(
            JSON.stringify({
              kind: "webRTC-offer",
              offer,
              broadcasterId: camp.createdBy,
              receiverId: typedData.userId,
            })
          );
          // });

          return;
        }

        case "started-broadcast": {
          // signalingServerSubscription.send(JSON.stringify({

          // }))

          console.log("STARTED BROADCAST", options);

          if (options?.listeningToAudio) {
            console.log("attempt to listen");
            listenToBroadcaster();
          }

          return;
        }
      }
    };

    signalingServerSubscription.addEventListener(
      "message",
      handleMessage,
      true
    );

    return () => {
      signalingServerSubscription.removeEventListener(
        "message",
        handleMessage,
        true
      );
    };
  }, [signalingServerSubscription, webRTCConnections, options]);

  const listenForAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // setMediaStream(stream);
    const audioTracks = stream.getAudioTracks();
    webRTCConnections.forEach(async ({ conn, userId }) => {
      audioTracks.forEach((track) => {
        const sender = conn.addTrack(track, stream);
        setSenders((prev) => [...prev, { sender, userId }]);
      });
    });

    signalingServerSubscription?.send(
      JSON.stringify({
        kind: "started-broadcast",
      })
    );
  };

  const stopListeningForAudio = () => {
    // mediaStream?.getAudioTracks().forEach((track) => track.stop());
    // const audioTracks = mediaStream?.getAudioTracks();
    webRTCConnections.forEach(({ conn, userId }) => {
      const senderObj = senders.find(
        (findSender) => userId === findSender.userId
      );
      if (!senderObj) {
        return;
      }

      conn.removeTrack(senderObj.sender);

      // audioTracks?.forEach((track) => {
      //   // conn.removeTrack([mediaStream]);

      // });
    });
  };

  const listenToBroadcaster = () => {
    if (!receiverWebRTCConnection) {
      return;
    }

    signalingServerSubscription?.send(
      JSON.stringify({
        kind: "join-channel-request",
        broadcasterId: camp.createdBy,
        receiverId: user.id,
      })
    );
    receiverWebRTCConnection.ontrack = ({ track }) => {
      if (track.kind !== "audio") {
        return;
      }
      const audioElement = new Audio();
      audioElement.autoplay = true;
      const audioStream = new MediaStream();

      audioStream.addTrack(track);

      audioElement.srcObject = audioStream;
    };
  };

  const stopListeningToBroadcast = () => {
    signalingServerSubscription?.send(
      JSON.stringify({
        kind: "leave-channel-request",
        broadcasterId: camp.createdBy,
        receiverId: user.id,
      })
    );

    const conn = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun2.1.google.com:19302"] }],
    });

    setReceiverWebRTCConnection(conn);
  };

  const createWebRTCOffer = async () => {
    if (!signalingServerSubscription) {
      console.warn("No signaling server subscription");
      return;
    }

    // webRTCConnections.forEach(async ({ conn, userId }) => {
    //   const offer = await conn.createOffer();

    //   conn.setLocalDescription(offer);

    //   signalingServerSubscription.send(
    //     JSON.stringify({
    //       kind: "webRTC-offer",
    //       offer,
    //       broadcasterId: camp.createdBy,
    //       receiverId: userId,
    //     })
    //   );
    // });
  };

  return {
    signalingServerSubscription,
    listenForAudio,
    stopListeningForAudio,
    receiverWebRTCConnection,
    webRTCConnections,
    setReceiverWebRTCConnection,
    createWebRTCOffer,
    stopListeningToBroadcast,
    listenToBroadcaster,
  };
};

// export const useAudioStream = ({
//   campId,
//   options,
// }: {
//   campId: string;
//   options?: Partial<{ playAudioStream: boolean }>;
// }) => {
//   const {
//     listenForAudio,
//     signalingServerSubscription,
//     receiverWebRTCConnection,
//     webRTCConnections,
//     stopListeningForAudio,
//     setReceiverWebRTCConnection,
//   } = useWebRTCConnection({ campId });
//   const user = useDefinedUser();
//   const { camp } = useGetCamp({ campId });

//   return {
//     createWebRTCOffer,
//     listenForAudio,
//     listenToBroadcaster,
//     stopListeningToBroadcast,
//     stopListeningForAudio,
//   };
// };
