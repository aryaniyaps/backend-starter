import { User } from '@prisma/client';
import argon2 from 'argon2';
import { db } from '../core/database';

interface CreateUserInput {
  username: string;
  email: string;
  password: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return await db.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    },
  });
}

async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}
