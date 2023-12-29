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

interface UpdateUserInput {
  username?: string;
  email?: string;
  password?: string;
  lastLogin?: Date;
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
): Promise<User> {
  return await db.user.update({
    data: {
      username: input.username,
      email: input.email,
      passwordHash: input.password
        ? await hashPassword(input.password)
        : undefined,
      lastLoginAt: input.lastLogin,
    },
    where: {
      id: userId,
    },
  });
}

export async function getUserByUsername(
  username: string,
): Promise<User | null> {
  return await db.user.findUnique({ where: { username } });
}

export async function getUserById(userId: string): Promise<User | null> {
  return await db.user.findUnique({ where: { id: userId } });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return await db.user.findUnique({ where: { email } });
}
