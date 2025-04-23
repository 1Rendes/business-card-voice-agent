import { MongoClient } from 'mongodb';

export const initMongoConnection = async () => {
  try {
    const user = process.env.MONGODB_USER;
    const pwd = process.env.MONGODB_PASSWORD;
    const url = process.env.MONGODB_URL;
    const db = process.env.MONGODB_DB;
    console.log('Mongo connection successfully established!');
    return new MongoClient(
      `mongodb+srv://${user}:${pwd}@${url}/${db}?retryWrites=true&w=majority&appName=MainDB`,
    );
  } catch (e) {
    console.log('Error while setting up mongo connection', e);
    throw e;
  }
};
