require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,          // cap connections — Atlas free tier allows ~100, keep headroom
      minPoolSize: 2,           // keep 2 warm connections ready
      socketTimeoutMS: 30000,   // fail fast if query hangs
      connectTimeoutMS: 10000,  // fail fast on initial connect
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
