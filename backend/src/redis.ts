import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const host = process.env.REDIS_HOST || 'localhost';
const port = parseInt(process.env.REDIS_PORT || '6380', 10);

export const redisConnectionOptions = {
  host,
  port,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy(times: number) {
    return Math.min(times * 1000, 5000);
  },
};

export let isRedisConnected = false;

const redis = new Redis(redisConnectionOptions);

redis.on('connect', () => {
  isRedisConnected = true;
  console.log(`Connected to Redis on ${host}:${port}`);
});

redis.on('error', (err: any) => {
  isRedisConnected = false;
});

export default redis;
