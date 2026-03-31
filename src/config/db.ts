import mongoose from 'mongoose'
import dns from 'node:dns'
import { env } from './env'
import logger from '../utils/logger'

export const connectDB = async () => {
  if (env.DNS_SERVERS) {
    const resolvers = env.DNS_SERVERS
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    if (resolvers.length > 0) {
      dns.setServers(resolvers)
      logger.info(`Using DNS resolvers: ${resolvers.join(', ')}`)
    }
  }

  try {
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000,
    })
    logger.info('MongoDB connected ✓')
  } catch (err) {
    const errorMessage = String(err)

    if (errorMessage.includes('querySrv') && env.MONGO_URI_DIRECT) {
      logger.warn('SRV lookup failed. Retrying with MONGO_URI_DIRECT...')

      try {
        await mongoose.connect(env.MONGO_URI_DIRECT, {
          serverSelectionTimeoutMS: 15000,
        })
        logger.info('MongoDB connected via direct URI ✓')
        return
      } catch (directErr) {
        logger.error(`MongoDB direct URI connection failed: ${directErr}`)
      }
    }

    logger.error(`MongoDB connection failed: ${err}`)
    logger.error('Set DNS_SERVERS and/or MONGO_URI_DIRECT in .env and try again.')
    process.exit(1)
  }
}