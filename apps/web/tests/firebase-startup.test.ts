/** SDK registry regression. Uses a synthetic local app and provider; no network or emulator. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck, getToken } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore, terminate } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

test('todos los SDK Firebase comparten registro y arrancan App Check con proveedor local', async () => {
  const app = initializeApp(
    {
      apiKey: 'synthetic-public-key',
      appId: '1:123456:web:local-registry-test',
      projectId: 'demo-hackaton',
      storageBucket: 'demo-hackaton.appspot.com',
    },
    'offline-sdk-registry-test',
  );
  let database: ReturnType<typeof getFirestore> | undefined;
  let tokenCalls = 0;
  try {
    const appCheck = initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => {
          tokenCalls++;
          return { token: 'synthetic-local-token', expireTimeMillis: Date.now() + 3_600_000 };
        },
      }),
      isTokenAutoRefreshEnabled: false,
    });
    assert.equal(appCheck.app, app);
    assert.equal(getAuth(app).app, app);
    database = getFirestore(app);
    assert.equal(database.app, app);
    assert.equal(getStorage(app).app, app);
    assert.equal(getFunctions(app, 'us-central1').app, app);
    const token = await getToken(appCheck, false);
    assert.equal(token.token, 'synthetic-local-token');
    assert.equal(tokenCalls, 1);
  } finally {
    if (database) await terminate(database);
    await deleteApp(app);
  }
});
