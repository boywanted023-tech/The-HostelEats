const mongoose = require('mongoose');

const connectDB = async (retries = 5) => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not defined');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(uri, {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt} failed:`, err.message);
      if (attempt === retries) {
        console.error('All MongoDB connection attempts failed.');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err.message);
});

module.exports = { connectDB, mongoose };