import { getSocketServer } from "../socket";

/**
 * Emit groupsCreated event when partner activity groups are created
 * @param eventId - The event ID to broadcast to
 * @param activityId - The activity ID for which groups were created
 */
export function emitGroupsCreated(eventId: string, activityId: string) {
    try {
        const io = getSocketServer();
        const roomName = `event:${eventId}`;
        io.to(roomName).emit("groupsCreated", { 
            eventId, 
            activityId 
        });
        console.log(`📡 Emitted groupsCreated to room ${roomName} for activity ${activityId}`);
    } catch (error) {
        console.error('Error emitting groupsCreated event:', error);
    }
}
