jest.mock("../src/services/account-deletion.service", () => ({ deleteAccount: jest.fn() }));
const { deleteAccount } = require("../src/services/account-deletion.service");
const { deleteMyAccount } = require("../src/controllers/account.controller");
const { requireAuth } = require("../src/middleware/auth.middleware");
const express = require("express");
const request = require("supertest");
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.isAuthenticated = () => req.headers['x-account-fixture'] !== 'signed-out';
  req.user = { _id: 'actor', email: 'person@example.com', status: req.headers['x-account-fixture'] === 'deleted' ? 'deleted' : 'active' };
  req.session = { destroy: jest.fn(callback => callback(null)) }; next();
});
app.delete('/auth/me', requireAuth, deleteMyAccount);
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ error: { code: error.code } }));
beforeEach(() => jest.resetAllMocks());
test.each(['signed-out', 'deleted'])('account deletion blocks %s sessions', async state => {
  const response = await request(app).delete('/auth/me').set('x-account-fixture', state).send({ confirmation: 'person@example.com' });
  expect([401,403]).toContain(response.status); expect(deleteAccount).not.toHaveBeenCalled();
});
test('account deletion acts only on the authenticated account and clears its cookie', async () => {
  const response = await request(app).delete('/auth/me').send({ confirmation: 'person@example.com' });
  expect(response.status).toBe(200);
  expect(deleteAccount).toHaveBeenCalledWith('actor', 'person@example.com');
  expect(response.headers['set-cookie'].join()).toContain('securepatch.sid=;');
});
test('deletion rejects an injected account selector and all extra fields', async () => {
  const response = await request(app).delete('/auth/me').send({ confirmation: 'person@example.com', userId: 'victim' });
  expect(response.status).toBe(400); expect(deleteAccount).not.toHaveBeenCalled();
});
test('storage failure returns an error instead of reporting success or clearing the cookie', async () => {
  deleteAccount.mockRejectedValue(new Error('storage error'));
  const response = await request(app).delete('/auth/me').send({ confirmation: 'person@example.com' });
  expect(response.status).toBe(500); expect(response.headers['set-cookie']).toBeUndefined();
});
