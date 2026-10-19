const mongoose = require("mongoose");
const env = require("./env");

let connectionPromise;

const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  connectionPromise = mongoose
    .connect(env.databaseUrl, {
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000,
    })
    .then(() => {
      console.log("MongoDB connected successfully");
      return mongoose.connection;
    })
    .finally(() => {
      // Cache only an in-flight connection. Vercel can resume a warm instance
      // after its MongoDB connection has closed and must reconnect at that point.
      connectionPromise = undefined;
    });

  return connectionPromise;
};

module.exports = connectDatabase;
