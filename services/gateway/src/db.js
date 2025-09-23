import {MongoClient, ObjectId} from "mongodb";

const DEFAULT_URI = 'mongodb://textstore:27017/bookbooker';
const MONGO_URI   = process.env.MONGO_URI || DEFAULT_URI;

let client;
let db;

export async function getDb() {
    if (!client) {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db();
        console.log("gateway connected to Mongo");
    }
    return db;
}

export { ObjectId }