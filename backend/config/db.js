const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 6+ uses these settings by default, but we can be explicit
      serverSelectionTimeoutMS: 20000, // Increase timeout to 20 seconds for initial connection
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

mongoose.connection.on('error', err => {
  console.error(`MongoDB runtime error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected.');
});


module.exports = connectDB; 