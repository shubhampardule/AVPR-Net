const Organization = require("../src/models/Organization");
const { getAiSettings, updateAiSettings } = require("../src/controllers/organization.controller");

function response() {
  return { statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

afterEach(() => jest.restoreAllMocks());

test("members can read the organization's hosted AI setting", async () => {
  jest.spyOn(Organization, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ hostedAiEnabled: false }) }) });
  const res = response();
  await getAiSettings({ params: { organizationId: "org-1" } }, res, jest.fn());
  expect(res.statusCode).toBe(200);
  expect(res.body.data.hostedAiEnabled).toBe(false);
});

test("organizations predating the setting retain their previous enabled behavior", async () => {
  jest.spyOn(Organization, "findById").mockReturnValue({ select: () => ({ lean: async () => ({}) }) });
  const res = response();
  await getAiSettings({ params: { organizationId: "org-legacy" } }, res, jest.fn());
  expect(res.body.data.hostedAiEnabled).toBe(true);
});

test("owner or admin update writes only the hosted AI flag", async () => {
  const select = jest.fn().mockResolvedValue({ hostedAiEnabled: true });
  const update = jest.spyOn(Organization, "findOneAndUpdate").mockReturnValue({ select });
  const res = response();
  await updateAiSettings({ params: { organizationId: "org-1" }, body: { hostedAiEnabled: true } }, res, jest.fn());
  expect(update).toHaveBeenCalledWith({ _id: "org-1", status: "active" },
    { $set: { hostedAiEnabled: true } }, { new: true, runValidators: true });
  expect(res.body.data.hostedAiEnabled).toBe(true);
});

test("AI setting updates reject extra or non-boolean values without touching MongoDB", async () => {
  const update = jest.spyOn(Organization, "findOneAndUpdate");
  const res = response();
  await updateAiSettings({ params: { organizationId: "org-1" }, body: { hostedAiEnabled: "true", extra: true } }, res, jest.fn());
  expect(res.statusCode).toBe(400);
  expect(res.body.error.code).toBe("INVALID_AI_SETTINGS");
  expect(update).not.toHaveBeenCalled();
});
