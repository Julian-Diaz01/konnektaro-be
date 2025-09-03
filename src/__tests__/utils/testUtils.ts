import { Request, Response } from 'express';
import { Collection } from 'mongodb';

// Mock Firebase token verification
export const mockVerifyFirebaseToken = jest.fn((req: Request, res: Response, next: any) => {
  req.user = { uid: 'test-user-id', email: 'test@example.com' };
  next();
});

// Mock MongoDB collection
export const createMockCollection = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockReturnValue({
    toArray: jest.fn(),
  }),
  insertOne: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
});

// Mock request and response objects
export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: { uid: 'test-user-id', email: 'test@example.com' },
  ...overrides,
});

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

// Mock next function
export const createMockNext = () => jest.fn();

// Sample test data
export const sampleUserActivity = {
  activityId: 'activity-123',
  groupId: 'group-456',
  notes: 'Test notes',
  date: '2024-01-01T00:00:00.000Z',
  userId: 'user-123',
};

export const sampleGroupActivity = {
  groupActivityId: 'group-activity-123',
  activityId: 'activity-123',
  groups: [
    {
      groupId: 'group-1',
      groupNumber: 1,
      groupColor: 'red',
      participants: [
        {
          userId: 'user-1',
          name: 'User 1',
          icon: '👤',
          description: 'Test user 1',
          email: 'user1@example.com',
        },
      ],
    },
  ],
  active: true,
  share: false,
};

export const sampleEventParticipants = [
  {
    eventId: 'event-123',
    userId: 'user-1',
    name: 'User 1',
    email: 'user1@example.com',
  },
  {
    eventId: 'event-123',
    userId: 'user-2',
    name: 'User 2',
    email: 'user2@example.com',
  },
];
