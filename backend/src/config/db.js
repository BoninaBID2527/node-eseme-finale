const mongoose = require('mongoose');
const { mongoUri } = require('./env');

async function connectDB(uri = mongoUri) {
  await mongoose.connect(uri);
  console.log('MongoDB connesso:', mongoose.connection.name);
}

module.exports = connectDB;
