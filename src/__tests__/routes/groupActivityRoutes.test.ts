import request from 'supertest';
import express from 'express';
import groupActivityRoutes from '../../routes/groupActivityRoutes';
import { createMockCollection, sampleGroupActivity } from '../utils/testUtils';

// Mock all dependencies
jest.mock('../../middleware/authMiddleware', () => ({
  verifyFirebaseToken: jest.fn((req: any, res: any, next: any) => {
    req.user = { uid: 'test-user-id', email: 'test@example.com' };
    next();
  }),
}));

jest.mock('../../collections/getGroupActivityCollection', () => ({
  getGroupActivityCollection: jest.fn(),
}));

jest.mock('../../collections/userCollection', () => ({
  getUserCollection: jest.fn(),
}));

jest.mock('../../collections/eventCollection', () => ({
  getEventCollection: jest.fn(),
}));

jest.mock('../../sockets/groupActivitySockets', () => ({
  emitGroupsCreated: jest.fn(),
}));

jest.mock('../../services/reviewService', () => ({
  updateUserReview: jest.fn(),
}));

jest.mock('../../models/groupActivity', () => ({
  createGroupActivity: jest.fn((data) => ({ ...data, _id: 'mock-id' })),
}));

// Import mocked modules
import { getGroupActivityCollection } from '../../collections/getGroupActivityCollection';
import { getUserCollection } from '../../collections/userCollection';
import { getEventCollection } from '../../collections/eventCollection';
import { emitGroupsCreated } from '../../sockets/groupActivitySockets';
import { updateUserReview } from '../../services/reviewService';

const app = express();
app.use(express.json());
app.use('/group-activity', groupActivityRoutes);

describe('GroupActivity Routes', () => {
  let mockGroupActivityCollection: any;
  let mockUserCollection: any;
  let mockEventCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGroupActivityCollection = createMockCollection();
    mockUserCollection = createMockCollection();
    mockEventCollection = createMockCollection();
    
    (getGroupActivityCollection as jest.Mock).mockReturnValue(mockGroupActivityCollection);
    (getUserCollection as jest.Mock).mockReturnValue(mockUserCollection);
    (getEventCollection as jest.Mock).mockReturnValue(mockEventCollection);
    (emitGroupsCreated as jest.Mock).mockResolvedValue(undefined);
    (updateUserReview as jest.Mock).mockResolvedValue(undefined);
  });

  describe('GET /group-activity/:groupActivityId', () => {
    it('should return group activity when found', async () => {
      mockGroupActivityCollection.findOne.mockResolvedValue(sampleGroupActivity);

      const response = await request(app)
        .get('/group-activity/group-activity-123')
        .expect(200);

      expect(response.body).toEqual(sampleGroupActivity);
      expect(mockGroupActivityCollection.findOne).toHaveBeenCalledWith({ 
        groupActivityId: 'group-activity-123' 
      });
    });

    it('should return 404 when group activity not found', async () => {
      mockGroupActivityCollection.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/group-activity/group-activity-123')
        .expect(404);

      expect(response.body).toEqual({ message: 'Group activity not found' });
    });

    it('should handle database errors', async () => {
      mockGroupActivityCollection.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/group-activity/group-activity-123')
        .expect(500);

      expect(response.body).toEqual({ message: 'Internal server error' });
    });
  });

  describe('GET /group-activity/activity/:activityId', () => {
    it('should return group activity by activity ID when found', async () => {
      mockGroupActivityCollection.findOne.mockResolvedValue(sampleGroupActivity);

      const response = await request(app)
        .get('/group-activity/activity/activity-123')
        .expect(200);

      expect(response.body).toEqual(sampleGroupActivity);
      expect(mockGroupActivityCollection.findOne).toHaveBeenCalledWith({ 
        activityId: 'activity-123' 
      });
    });

    it('should return 404 when group activity not found by activity ID', async () => {
      mockGroupActivityCollection.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/group-activity/activity/activity-123')
        .expect(404);

      expect(response.body).toEqual({ message: 'Group activity not found' });
    });

    it('should handle database errors for activity lookup', async () => {
      mockGroupActivityCollection.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/group-activity/activity/activity-123')
        .expect(500);

      expect(response.body).toEqual({ message: 'Internal server error' });
    });
  });

  describe('POST /group-activity/:eventId/activity/:activityId', () => {
    const mockUsers = [
      {
        userId: 'user-1',
        name: 'User 1',
        icon: '👤',
        description: 'Test user 1',
        email: 'user1@example.com',
      },
      {
        userId: 'user-2',
        name: 'User 2',
        icon: '👤',
        description: 'Test user 2',
        email: 'user2@example.com',
      },
      {
        userId: 'user-3',
        name: 'User 3',
        icon: '👤',
        description: 'Test user 3',
        email: 'user3@example.com',
      },
    ];

    it('should create new group activity successfully', async () => {
      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers),
      });
      mockGroupActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const response = await request(app)
        .post('/group-activity/event-123/activity/activity-123')
        .send({ share: false })
        .expect(201);

      expect(mockGroupActivityCollection.findOne).toHaveBeenCalledWith({ activityId: 'activity-123' });
      expect(mockUserCollection.find).toHaveBeenCalledWith(
        { eventId: 'event-123' },
        { projection: { userId: 1, name: 1, icon: 1, description: 1 } }
      );
      expect(mockGroupActivityCollection.insertOne).toHaveBeenCalled();
      expect(mockEventCollection.updateOne).toHaveBeenCalledWith(
        { eventId: 'event-123' },
        { $addToSet: { activityIds: 'activity-123' } }
      );
      expect(emitGroupsCreated).toHaveBeenCalledWith('event-123', 'activity-123');
    });

    it('should update existing group activity successfully', async () => {
      const existingGroupActivity = { ...sampleGroupActivity, share: true };
      mockGroupActivityCollection.findOne.mockResolvedValue(existingGroupActivity);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers),
      });
      mockGroupActivityCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      mockGroupActivityCollection.findOne.mockResolvedValueOnce(existingGroupActivity)
        .mockResolvedValueOnce({ ...existingGroupActivity, groups: [] });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const response = await request(app)
        .post('/group-activity/event-123/activity/activity-123')
        .send({ share: false })
        .expect(200);

      expect(mockGroupActivityCollection.updateOne).toHaveBeenCalledWith(
        { activityId: 'activity-123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            active: true,
            share: false,
          }),
        })
      );
    });

    it('should return 404 when no users found for event', async () => {
      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app)
        .post('/group-activity/event-123/activity/activity-123')
        .send({ share: false })
        .expect(404);

      expect(response.body).toEqual({ message: 'No users found for this event' });
    });

    it('should handle single user scenario', async () => {
      const singleUser = [mockUsers[0]];
      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(singleUser),
      });
      mockGroupActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const response = await request(app)
        .post('/group-activity/event-123/activity/activity-123')
        .send({ share: false })
        .expect(201);

      expect(mockGroupActivityCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          groups: expect.arrayContaining([
            expect.objectContaining({
              participants: expect.arrayContaining([
                expect.objectContaining({
                  userId: 'user-1',
                  name: 'User 1',
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should handle database errors during creation', async () => {
      mockGroupActivityCollection.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/group-activity/event-123/activity/activity-123')
        .send({ share: false })
        .expect(500);

      expect(response.body).toEqual({ message: 'Internal server error' });
    });

    it('should handle errors during user review updates', async () => {
      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers),
      });
      mockGroupActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      (updateUserReview as jest.Mock).mockRejectedValue(new Error('Review update failed'));

      const response = await request(app)
        .post('/group-activity/event-123/activity/activity-123')
        .send({ share: false })
        .expect(201); // Should still succeed even if review updates fail

      expect(mockGroupActivityCollection.insertOne).toHaveBeenCalled();
    });

    it('should use default share value when not provided', async () => {
      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers),
      });
      mockGroupActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const response = await request(app)
        .post('/group-activity/event-123/activity/activity-123')
        .expect(201);

      expect(mockGroupActivityCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          share: false, // Default value
        })
      );
    });

    it('should preserve existing share value when updating', async () => {
      const existingGroupActivity = { ...sampleGroupActivity, share: true };
      mockGroupActivityCollection.findOne.mockResolvedValue(existingGroupActivity);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers),
      });
      mockGroupActivityCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      mockGroupActivityCollection.findOne.mockResolvedValueOnce(existingGroupActivity)
        .mockResolvedValueOnce({ ...existingGroupActivity, groups: [] });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const response = await request(app)
        .post('/group-activity/event-123/activity/activity-123')
        .expect(200);

      expect(mockGroupActivityCollection.updateOne).toHaveBeenCalledWith(
        { activityId: 'activity-123' },
        expect.objectContaining({
          $set: expect.objectContaining({
            share: true, // Preserved existing value
          }),
        })
      );
    });
  });

  describe('Integration Test: Complete Group Activity Journey', () => {
    it('should handle complete group activity lifecycle: create → get → update → get → verify', async () => {
      const eventId = 'event-123';
      const activityId = 'activity-123';
      const groupActivityId = 'group-activity-123';
      
      const mockUsers = [
        {
          userId: 'user-1',
          name: 'User 1',
          icon: '👤',
          description: 'Test user 1',
          email: 'user1@example.com',
        },
        {
          userId: 'user-2',
          name: 'User 2',
          icon: '👤',
          description: 'Test user 2',
          email: 'user2@example.com',
        },
        {
          userId: 'user-3',
          name: 'User 3',
          icon: '👤',
          description: 'Test user 3',
          email: 'user3@example.com',
        },
      ];

      const createdGroupActivity = {
        groupActivityId,
        activityId,
        groups: [
          {
            groupId: 'group-1',
            groupNumber: 1,
            groupColor: 'red',
            participants: [mockUsers[0], mockUsers[1]],
          },
          {
            groupId: 'group-2',
            groupNumber: 2,
            groupColor: 'blue',
            participants: [mockUsers[2]],
          },
        ],
        active: true,
        share: false,
      };

      // Step 1: Create group activity
      mockGroupActivityCollection.findOne.mockResolvedValue(null); // No existing activity
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers),
      });
      mockGroupActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const createResponse = await request(app)
        .post(`/group-activity/${eventId}/activity/${activityId}`)
        .send({ share: false })
        .expect(201);

      expect(createResponse.body).toMatchObject({
        activityId,
        active: true,
        share: false,
      });

      // Step 2: Get the created group activity by groupActivityId
      mockGroupActivityCollection.findOne.mockResolvedValue(createdGroupActivity);

      const getResponse1 = await request(app)
        .get(`/group-activity/${groupActivityId}`)
        .expect(200);

      expect(getResponse1.body).toEqual(createdGroupActivity);

      // Step 3: Get the created group activity by activityId
      const getResponse2 = await request(app)
        .get(`/group-activity/activity/${activityId}`)
        .expect(200);

      expect(getResponse2.body).toEqual(createdGroupActivity);

      // Step 4: Update the group activity
      const updatedGroupActivity = {
        ...createdGroupActivity,
        share: true,
        groups: [
          {
            groupId: 'group-1',
            groupNumber: 1,
            groupColor: 'green',
            participants: [mockUsers[0], mockUsers[1]],
          },
          {
            groupId: 'group-2',
            groupNumber: 2,
            groupColor: 'yellow',
            participants: [mockUsers[2]],
          },
        ],
      };

      // Reset mocks for update scenario
      mockGroupActivityCollection.findOne.mockResolvedValue(createdGroupActivity); // Existing activity
      mockGroupActivityCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      
      const updateResponse = await request(app)
        .post(`/group-activity/${eventId}/activity/${activityId}`)
        .send({ share: true })
        .expect(200);

      // Step 5: Get the updated group activity (mock the updated response)
      mockGroupActivityCollection.findOne.mockResolvedValue(updatedGroupActivity);

      const getResponse3 = await request(app)
        .get(`/group-activity/${groupActivityId}`)
        .expect(200);

      expect(getResponse3.body).toEqual(updatedGroupActivity);

      // Step 6: Verify the data has changed
      expect(getResponse3.body.share).toBe(true);
      expect(getResponse3.body.groups[0].groupColor).toBe('green');
      expect(getResponse3.body.groups[1].groupColor).toBe('yellow');
      expect(getResponse3.body.share).not.toBe(getResponse1.body.share);

      // Verify all expected calls were made
      expect(mockGroupActivityCollection.findOne).toHaveBeenCalledTimes(6); // Create check + 3 gets + 2 more for update
      expect(mockGroupActivityCollection.insertOne).toHaveBeenCalledTimes(1);
      expect(mockGroupActivityCollection.updateOne).toHaveBeenCalledTimes(1);
      expect(emitGroupsCreated).toHaveBeenCalledTimes(2); // Once for create, once for update
      expect(updateUserReview).toHaveBeenCalledTimes(6); // 3 users × 2 operations
    });

    it('should handle group activity lifecycle with different user counts', async () => {
      const eventId = 'event-456';
      const activityId = 'activity-456';
      
      // Test with single user
      const singleUser = [
        {
          userId: 'user-1',
          name: 'User 1',
          icon: '👤',
          description: 'Test user 1',
          email: 'user1@example.com',
        },
      ];

      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(singleUser),
      });
      mockGroupActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const singleUserResponse = await request(app)
        .post(`/group-activity/${eventId}/activity/${activityId}`)
        .send({ share: false })
        .expect(201);

      expect(singleUserResponse.body).toMatchObject({
        activityId,
        active: true,
        share: false,
      });

      // Test with even number of users
      const evenUsers = [
        { userId: 'user-1', name: 'User 1', icon: '👤', description: 'Test user 1', email: 'user1@example.com' },
        { userId: 'user-2', name: 'User 2', icon: '👤', description: 'Test user 2', email: 'user2@example.com' },
        { userId: 'user-3', name: 'User 3', icon: '👤', description: 'Test user 3', email: 'user3@example.com' },
        { userId: 'user-4', name: 'User 4', icon: '👤', description: 'Test user 4', email: 'user4@example.com' },
      ];

      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(evenUsers),
      });

      const evenUsersResponse = await request(app)
        .post(`/group-activity/${eventId}/activity/${activityId}-even`)
        .send({ share: true })
        .expect(201);

      expect(evenUsersResponse.body).toMatchObject({
        activityId: `${activityId}-even`,
        active: true,
        share: true,
      });
    });

    it('should handle group activity lifecycle with validation errors', async () => {
      const eventId = 'event-789';
      const activityId = 'activity-789';
      
      // Step 1: Try to create with no users
      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      const noUsersResponse = await request(app)
        .post(`/group-activity/${eventId}/activity/${activityId}`)
        .send({ share: false })
        .expect(404);

      expect(noUsersResponse.body).toEqual({ message: 'No users found for this event' });

      // Step 2: Create with valid users
      const validUsers = [
        { userId: 'user-1', name: 'User 1', icon: '👤', description: 'Test user 1', email: 'user1@example.com' },
        { userId: 'user-2', name: 'User 2', icon: '👤', description: 'Test user 2', email: 'user2@example.com' },
      ];

      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(validUsers),
      });
      mockGroupActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const validResponse = await request(app)
        .post(`/group-activity/${eventId}/activity/${activityId}`)
        .send({ share: false })
        .expect(201);

      expect(validResponse.body).toMatchObject({
        activityId,
        active: true,
        share: false,
      });
    });

    it('should handle group activity lifecycle with database errors', async () => {
      const eventId = 'event-error';
      const activityId = 'activity-error';
      
      // Step 1: Database error during creation
      mockGroupActivityCollection.findOne.mockRejectedValue(new Error('Database connection failed'));

      const dbErrorResponse = await request(app)
        .post(`/group-activity/${eventId}/activity/${activityId}`)
        .send({ share: false })
        .expect(500);

      expect(dbErrorResponse.body).toEqual({ message: 'Internal server error' });

      // Step 2: Database error during retrieval
      mockGroupActivityCollection.findOne.mockRejectedValue(new Error('Database query failed'));

      const getErrorResponse = await request(app)
        .get(`/group-activity/${activityId}`)
        .expect(500);

      expect(getErrorResponse.body).toEqual({ message: 'Internal server error' });
    });

    it('should handle group activity lifecycle with review service errors', async () => {
      const eventId = 'event-review-error';
      const activityId = 'activity-review-error';
      
      const mockUsers = [
        { userId: 'user-1', name: 'User 1', icon: '👤', description: 'Test user 1', email: 'user1@example.com' },
        { userId: 'user-2', name: 'User 2', icon: '👤', description: 'Test user 2', email: 'user2@example.com' },
      ];

      // Step 1: Create with review service errors
      mockGroupActivityCollection.findOne.mockResolvedValue(null);
      mockUserCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers),
      });
      mockGroupActivityCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' });
      mockEventCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      (updateUserReview as jest.Mock).mockRejectedValue(new Error('Review service unavailable'));

      const reviewErrorResponse = await request(app)
        .post(`/group-activity/${eventId}/activity/${activityId}`)
        .send({ share: false })
        .expect(201); // Should still succeed even if review updates fail

      expect(reviewErrorResponse.body).toMatchObject({
        activityId,
        active: true,
        share: false,
      });
    });
  });
});
