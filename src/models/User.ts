import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  deviceId: string
  installedAt: Date
  preferences: {
    categories: string[]
    categoryWeights: Map<string, number>
  }
  swipeHistory: {
    articleId: mongoose.Types.ObjectId
    action: 'like' | 'dislike'
    at: Date
  }[]
  bookmarks: mongoose.Types.ObjectId[]
  ttsSettings: {
    speed: number
    language: string
  }
}

const UserSchema = new Schema<IUser>({
  deviceId: { type: String, required: true, unique: true },
  installedAt: { type: Date, default: Date.now },
  preferences: {
    categories: { type: [String], default: [] },
    categoryWeights: { type: Map, of: Number, default: {} }
  },
  swipeHistory: [{
    articleId: { type: Schema.Types.ObjectId, ref: 'Article' },
    action: { type: String, enum: ['like', 'dislike'] },
    at: { type: Date, default: Date.now }
  }],
  bookmarks: [{ type: Schema.Types.ObjectId, ref: 'Article' }],
  ttsSettings: {
    speed: { type: Number, default: 1.0 },
    language: { type: String, default: 'en-IN' }
  }
})

export default mongoose.model<IUser>('User', UserSchema)