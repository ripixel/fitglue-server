
import { TOPICS, PROJECT_ID } from './config';

describe('Config', () => {
  it('should export TOPICS', () => {
    expect(TOPICS).toBeDefined();
    expect(TOPICS.RAW_ACTIVITY).toBe('topic-raw-activity');
  });

  it('should export PROJECT_ID', () => {
    expect(PROJECT_ID).toBeDefined();
  });
});
