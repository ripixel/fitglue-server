import { waitlistHandler } from './index';
// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const collectionMock = {
    add: jest.fn().mockResolvedValue({ id: 'mock-doc-id' }),
  };
  const firestoreMock = {
    collection: jest.fn().mockReturnValue(collectionMock),
  };
  const appMock = {
    length: 0
  };
  const firestoreFn = jest.fn(() => firestoreMock);
  Object.assign(firestoreFn, {
    FieldValue: {
      serverTimestamp: jest.fn().mockReturnValue('mock-timestamp')
    }
  });
  return {
    apps: [appMock],
    initializeApp: jest.fn(),
    firestore: firestoreFn
  };
});

// Import mocked module to assert on it
import * as admin from 'firebase-admin';

describe('waitlistHandler', () => {
  let req: any;
  let res: any;
  let collectionAdd: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup request/response mocks
    req = {
      method: 'POST',
      body: {},
      get: jest.fn()
    };
    res = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Get reference to the mocked collection.add
    const db = (admin.firestore as any)();
    collectionAdd = db.collection('waitlist').add;
  });

  it('should handle OPTIONS request (CORS)', async () => {
    req.method = 'OPTIONS';
    await waitlistHandler(req, res);

    expect(res.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith('');
  });

  it('should reject non-POST requests', async () => {
    req.method = 'GET';
    await waitlistHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('should detect honeypot (spam) and return fake success without saving', async () => {
    req.body = { email: 'spammer@bot.com', website_url: 'http://spam.com' };

    await waitlistHandler(req, res);

    // Should verify honeypot
    // Should NOT save to DB
    expect(collectionAdd).not.toHaveBeenCalled();

    // Should return success to fool bot
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('should reject invalid email', async () => {
    req.body = { email: 'not-an-email' };
    await waitlistHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(collectionAdd).not.toHaveBeenCalled();
  });

  it('should save valid email to firestore', async () => {
    req.body = { email: 'user@example.com' };
    await waitlistHandler(req, res);

    expect(collectionAdd).toHaveBeenCalledWith({
      email: 'user@example.com',
      source: 'web',
      createdAt: 'mock-timestamp',
      userAgent: expect.any(String),
      ip: expect.any(String)

    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
