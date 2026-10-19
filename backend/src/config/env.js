require('dotenv').config({ quiet: true });

const DEFAULT_SECRET = 'cambia-questo-segreto';

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taskflow',
  jwtSecret: process.env.JWT_SECRET || DEFAULT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};

// In produzione un segreto di default renderebbe i token falsificabili: meglio non partire.
if (env.nodeEnv === 'production' && env.jwtSecret === DEFAULT_SECRET) {
  throw new Error('Imposta JWT_SECRET in produzione');
}

module.exports = env;
