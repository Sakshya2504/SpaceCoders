import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is required');
  }

  await mongoose.connect(uri);

  // Older versions of the project used a unique `patientCode` index.
  // The current schema uses `patientId`, so the legacy index can reject
  // every new patient with a duplicate `patientCode: null` error.
  try {
    await mongoose.connection.db.collection('patients').dropIndex('patientCode_1');
    console.log('Removed legacy patientCode_1 index');
  } catch (error) {
    // IndexNotFound means the database is already on the current schema.
    if (error?.codeName !== 'IndexNotFound' && error?.code !== 27) {
      console.warn('Legacy index check:', error.message);
    }
  }

  console.log('MongoDB connected');
}

export function dbHealth() {
  return mongoose.connection.readyState === 1 ? 'ONLINE' : 'OFFLINE';
}
