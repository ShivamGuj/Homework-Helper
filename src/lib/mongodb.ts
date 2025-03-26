import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://shivamgujaria4:RiAkB5srWVTGvkyJ@cluster0.a1y9wfg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    try {
      cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
        console.log('Connected to MongoDB');
        return mongoose;
      });
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('Failed to establish MongoDB connection:', e);
    throw e;
  }

  return cached.conn;
}

export default connectDB;
