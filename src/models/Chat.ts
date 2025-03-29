import mongoose, { Schema } from 'mongoose';

const MessageSchema = new Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant']
  },
  content: {
    type: String,
    required: true
  }
}, { _id: false });

const ChatSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  messages: {
    type: [MessageSchema],
    default: []
  },
  hintsUsed: {
    type: Number,
    default: 0
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  resourcesShown: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.models.Chat || mongoose.model('Chat', ChatSchema);
