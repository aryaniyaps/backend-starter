import { Redis } from 'ioredis';

// TODO: configure host, port, username, pass etc.
export const redis = new Redis(process.env.REDIS_URL || '');
