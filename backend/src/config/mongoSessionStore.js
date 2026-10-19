const session = require("express-session");
const mongoose = require("mongoose");

class MongoSessionStore extends session.Store {
  constructor({ collectionName = "sessions", ttl = 60 * 60 * 24 } = {}) {
    super();
    this.collectionName = collectionName;
    this.ttlSeconds = ttl;
    this.indexPromise = null;
  }

  collection() {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB must be connected before accessing sessions");
    }
    return mongoose.connection.collection(this.collectionName);
  }

  ensureExpiryIndex(collection) {
    if (!this.indexPromise) {
      this.indexPromise = collection
        .createIndex({ expires: 1 }, { expireAfterSeconds: 0 })
        .catch((error) => {
          this.indexPromise = null;
          throw error;
        });
    }
    return this.indexPromise;
  }

  get(sessionId, callback) {
    let collection;
    try {
      collection = this.collection();
    } catch (error) {
      callback(error);
      return;
    }

    this.ensureExpiryIndex(collection)
      .then(() => collection.findOne({ _id: sessionId, expires: { $gt: new Date() } }))
      .then((document) => callback(null, document?.session || null), callback);
  }

  set(sessionId, sessionData, callback) {
    let collection;
    try {
      collection = this.collection();
    } catch (error) {
      callback(error);
      return;
    }

    const requestedExpiry = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : null;
    const expires =
      requestedExpiry && Number.isFinite(requestedExpiry.getTime())
        ? requestedExpiry
        : new Date(Date.now() + this.ttlSeconds * 1000);
    const serializedSession = JSON.parse(JSON.stringify(sessionData));

    this.ensureExpiryIndex(collection)
      .then(() =>
        collection.updateOne(
          { _id: sessionId },
          { $set: { session: serializedSession, expires } },
          { upsert: true }
        )
      )
      .then(() => callback(null), callback);
  }

  touch(sessionId, sessionData, callback) {
    let collection;
    try {
      collection = this.collection();
    } catch (error) {
      callback(error);
      return;
    }

    const requestedExpiry = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : null;
    const expires =
      requestedExpiry && Number.isFinite(requestedExpiry.getTime())
        ? requestedExpiry
        : new Date(Date.now() + this.ttlSeconds * 1000);

    this.ensureExpiryIndex(collection)
      .then(() => collection.updateOne({ _id: sessionId }, { $set: { expires } }))
      .then(() => callback(null), callback);
  }

  destroy(sessionId, callback) {
    let collection;
    try {
      collection = this.collection();
    } catch (error) {
      callback(error);
      return;
    }

    collection.deleteOne({ _id: sessionId }).then(() => callback(null), callback);
  }
}

module.exports = MongoSessionStore;
