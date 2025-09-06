import {getSocketServer} from "../socket";

export function emitActivityUpdate(eventId: string, activityId: string) {
    const io = getSocketServer();
    const roomName = `event:${eventId}`;
    io.to(roomName).emit("activityUpdate", { eventId, activityId });
}

