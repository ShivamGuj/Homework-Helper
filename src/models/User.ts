import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  image: {
    type: String,
  },
  // Add other fields as needed
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
