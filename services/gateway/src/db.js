// services/gateway/src/db.js
import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGO_URI || 'mongodb://textstore:27017/bookbooker';
const client = new MongoClient(uri);
await client.connect();
const db = client.db(); // db name comes from URI path
export const favorites = db.collection('favorites');
export { ObjectId };
