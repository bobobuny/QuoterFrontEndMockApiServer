const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { createApp } = require('../mockServer');

async function startTestServer(t, logger = { log() {} }) {
  const server = createApp(undefined, logger).listen(0, '127.0.0.1');
  await once(server, 'listening');

  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  return `http://127.0.0.1:${server.address().port}`;
}

async function postLogin(baseUrl, username, password) {
  return fetch(`${baseUrl}/iamApi/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
}

test('accepts the Playwright account only with its matching password', async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await postLogin(baseUrl, 'playwright@a.com', 'Playwright123!');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { refreshToken: 'playwright-test-token' });
});

test('rejects an incorrect password for the Playwright account', async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await postLogin(baseUrl, 'playwright@a.com', 'WrongPassword123!');

  assert.equal(response.status, 401);
});

test('preserves existing username-only login scenarios', async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await postLogin(baseUrl, 'success@a.com', 'any-password');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { refreshToken: 'abc' });
});

test('returns 404 when no login scenario matches', async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await postLogin(baseUrl, 'unknown@a.com', 'any-password');

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'No matching scenario' });
});

test('continues to parse JSON registration requests', async (t) => {
  const baseUrl = await startTestServer(t);
  const response = await fetch(`${baseUrl}/iamApi/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'success@a.com', password: 'any-password' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { refreshToken: 'abc' });
});

test('redacts passwords from request logs', async (t) => {
  const logs = [];
  const baseUrl = await startTestServer(t, { log: (message) => logs.push(message) });
  const password = 'Playwright123!';
  await postLogin(baseUrl, 'playwright@a.com', password);

  const requestLog = logs.join('\n');
  assert.equal(requestLog.includes(password), false);
  assert.equal(requestLog.includes('[REDACTED]'), true);
});
