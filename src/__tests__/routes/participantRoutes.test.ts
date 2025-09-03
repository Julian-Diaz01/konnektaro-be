import request from 'supertest';
import express from 'express';
import participantRoutes from '../../routes/participantRoutes';
import { createMockCollection, sampleEventParticipants } from '../utils/testUtils';

// Mock all dependencies
jest.mock('../../middleware/authMiddleware', () => ({
  verifyFirebaseToken: jest.fn((req: any, res: any, next: any) => {
    req.user = { uid: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

jest.mock('../../collections/eventParticipantsCollection', () => ({
  getEventParticipantsCollection: jest.fn(),
}));

// Import mocked modules
import { getEventParticipantsCollection } from '../../collections/eventParticipantsCollection';

const app = express();
app.use(express.json());
app.use('/events', participantRoutes);

describe('Participant Routes', () => {
  let mockEventParticipantsCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockEventParticipantsCollection = createMockCollection();
    (getEventParticipantsCollection as jest.Mock).mockReturnValue(mockEventParticipantsCollection);
  });

  describe('GET /events/:eventId/participants', () => {
    it('should return participants for a specific event', async () => {
      mockEventParticipantsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(sampleEventParticipants),
      });

      const response = await request(app)
        .get('/events/event-123/participants')
        .expect(200);

      expect(response.body).toEqual(sampleEventParticipants);
      expect(mockEventParticipantsCollection.find).toHaveBeenCalledWith({ eventId: 'event-123' });
    });

    it('should return 404 when no participants found for event', async () => {
      mockEventParticipantsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app)
        .get('/events/event-123/participants')
        .expect(404);

      expect(response.body).toEqual({ message: 'No participants found' });
    });

    it('should handle multiple events with different participants', async () => {
      const event1Participants = [
        { eventId: 'event-1', userId: 'user-1', name: 'User 1', email: 'user1@example.com' },
        { eventId: 'event-1', userId: 'user-2', name: 'User 2', email: 'user2@example.com' },
      ];

      const event2Participants = [
        { eventId: 'event-2', userId: 'user-3', name: 'User 3', email: 'user3@example.com' },
      ];

      // First event
      mockEventParticipantsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(event1Participants),
      });

      const response1 = await request(app)
        .get('/events/event-1/participants')
        .expect(200);

      expect(response1.body).toEqual(event1Participants);
      expect(response1.body).toHaveLength(2);

      // Second event
      mockEventParticipantsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(event2Participants),
      });

      const response2 = await request(app)
        .get('/events/event-2/participants')
        .expect(200);

      expect(response2.body).toEqual(event2Participants);
      expect(response2.body).toHaveLength(1);
    });

    it('should handle very long event IDs', async () => {
      const longEventId = 'event-' + 'a'.repeat(100);
      const longEventParticipants = [
        { eventId: longEventId, userId: 'user-1', name: 'User 1', email: 'user1@example.com' },
      ];

      mockEventParticipantsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(longEventParticipants),
      });

      const response = await request(app)
        .get(`/events/${longEventId}/participants`)
        .expect(200);

      expect(response.body).toEqual(longEventParticipants);
      expect(mockEventParticipantsCollection.find).toHaveBeenCalledWith({ 
        eventId: longEventId 
      });
    });
  });

  describe('Integration Test: Participant Data Consistency', () => {
    it('should maintain data consistency across multiple requests', async () => {
      const eventId = 'event-consistency-test';
      const participants = [
        { eventId, userId: 'user-1', name: 'User 1', email: 'user1@example.com' },
        { eventId, userId: 'user-2', name: 'User 2', email: 'user2@example.com' },
        { eventId, userId: 'user-3', name: 'User 3', email: 'user3@example.com' },
      ];

      mockEventParticipantsCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(participants),
      });

      // Multiple requests to the same endpoint
      const response1 = await request(app)
        .get(`/events/${eventId}/participants`)
        .expect(200);

      const response2 = await request(app)
        .get(`/events/${eventId}/participants`)
        .expect(200);

      const response3 = await request(app)
        .get(`/events/${eventId}/participants`)
        .expect(200);

      // All responses should be identical
      expect(response1.body).toEqual(participants);
      expect(response2.body).toEqual(participants);
      expect(response3.body).toEqual(participants);

      // Verify the same query was made each time
      expect(mockEventParticipantsCollection.find).toHaveBeenCalledTimes(3);
      expect(mockEventParticipantsCollection.find).toHaveBeenCalledWith({ eventId });
    });

    it('should handle concurrent requests to different events', async () => {
      const event1Participants = [
        { eventId: 'event-1', userId: 'user-1', name: 'User 1', email: 'user1@example.com' },
      ];

      const event2Participants = [
        { eventId: 'event-2', userId: 'user-2', name: 'User 2', email: 'user2@example.com' },
      ];

      // Simulate concurrent requests
      const promises = [
        request(app).get('/events/event-1/participants'),
        request(app).get('/events/event-2/participants'),
      ];

      // Mock different responses for each event
      mockEventParticipantsCollection.find
        .mockReturnValueOnce({
          toArray: jest.fn().mockResolvedValue(event1Participants),
        })
        .mockReturnValueOnce({
          toArray: jest.fn().mockResolvedValue(event2Participants),
        });

      const [response1, response2] = await Promise.all(promises);

      expect(response1.body).toEqual(event1Participants);
      expect(response2.body).toEqual(event2Participants);
      expect(response1.body).not.toEqual(response2.body);
    });
  });
});
