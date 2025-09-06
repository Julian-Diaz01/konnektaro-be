import { getSocketServer } from "../socket";

/**
 * Emit partnerNoteUpdated event when a user updates their note for an activity
 * @param eventId - The event ID to broadcast to
 * @param activityId - The activity ID for which the note was updated
 * @param userId - The user ID who updated the note
 * @param notes - The updated notes content
 */
export function emitPartnerNoteUpdated(eventId: string, activityId: string, userId: string, notes: string) {
    try {
        const io = getSocketServer();
        const roomName = `event:${eventId}`;
        
        io.to(roomName).emit("partnerNoteUpdated", {
            activityId,
            userId,
            notes
        });
        
        console.log(`📡 Emitted partnerNoteUpdated to room ${roomName} for activity ${activityId} by user ${userId}`);
    } catch (error) {
        console.error('Error emitting partnerNoteUpdated event:', error);
    }
}
