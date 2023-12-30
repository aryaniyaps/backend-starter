import { User } from '@prisma/client';
import { ResourceNotFoundError } from '../core/errors';
import userRepo from './repo';

async function getUserById(userId: string): Promise<User> {
  const user = await userRepo.getUserById(userId);
  if (user === null) {
    throw new ResourceNotFoundError({
      message: `Couldn't find user with ID ${userId}.`,
    });
  }
  return user;
}

export default {
  getUserById,
};
