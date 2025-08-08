import {getSocketServer} from "../socket";

export function emitActivityUpdate(eventId: string, activityId: string) {
    const io = getSocketServer();
    io.to(eventId).emit("activityUpdate", { eventId, activityId });
}

