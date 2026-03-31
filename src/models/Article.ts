import mongoose, { Schema, Document } from 'mongoose';

export interface IArticle extends Document {
  title: string;
  source: string;
  category: string;
  url: string;
  urlHash: string;
  rawBody: string;
  status: 'pending' | 'ready' | 'failed';
  publishedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    title: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, lowercase: true },
    url: { type: String, required: true, trim: true },
    urlHash: { type: String, required: true, unique: true, index: true },
    rawBody: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'ready', 'failed'],
      default: 'pending',
      index: true
    },
    publishedAt: { type: Date, required: true, index: true }
  },
  {
    timestamps: true
  }
);

export default mongoose.model<IArticle>('Article', ArticleSchema);
