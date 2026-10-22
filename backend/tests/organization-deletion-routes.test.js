jest.mock("../src/services/organization-deletion.service", () => ({ requestOrganizationDeletion: jest.fn().mockResolvedValue({ status: "deleting" }) }));
jest.mock("../src/middleware/auth.middleware", () => ({ requireAuth: (req, res, next) => { req.user = { _id: "actor" }; next(); } }));
jest.mock("../src/middleware/organization.middleware", () => ({ requireOrganizationMember: (req, res, next) => { req.organizationMembership = { role: req.headers['x-fixture-role'] || 'owner' }; next(); } }));
const request = require("supertest");
const express = require("express");
const { requestOrganizationDeletion } = require("../src/services/organization-deletion.service");
const app = express();app.use(express.json());app.use('/organizations', require('../src/routes/organization.routes'));
app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ error: { message: error.message } }));
beforeEach(() => jest.clearAllMocks());
test.each(['admin','developer'])('an %s cannot delete an organization', async role => {
  const response = await request(app).delete('/organizations/org-1').set('x-fixture-role',role).send({ confirmation:'Team' });
  expect(response.status).toBe(403);expect(requestOrganizationDeletion).not.toHaveBeenCalled();
});
test('only the authenticated actor and route organization reach the deletion service', async () => {
  const response = await request(app).delete('/organizations/org-1').send({ confirmation:'Team' });
  expect(response.status).toBe(202);
  expect(requestOrganizationDeletion).toHaveBeenCalledWith({ organizationId:'org-1', actorId:'actor', confirmation:'Team' });
});
test('extra account selectors are rejected before deletion', async () => {
  const response = await request(app).delete('/organizations/org-1').send({ confirmation:'Team', organizationId:'victim' });
  expect(response.status).toBe(400);expect(requestOrganizationDeletion).not.toHaveBeenCalled();
});
