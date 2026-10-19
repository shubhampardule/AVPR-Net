module.exports = {
  nodeEnv: "test", port: 5000, databaseUrl: "mongodb://127.0.0.1:27017/securepatch_unit_test",
  demoMode: false,
  google: { clientId: "unit-test-client", clientSecret: "unit-test-secret",
    callbackUrl: "http://localhost:5000/api/v1/auth/google/callback" },
  github: {},
};
