import { afterEach } from 'vitest';

// Set default env vars for tests
process.env.ENCRYPTION_SECRET =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

// Use a temp DB path (individual test files override this as needed)
process.env.DATABASE_PATH = '/tmp/mc-test-default.db';

afterEach(() => {
  vi.restoreAllMocks();
});
