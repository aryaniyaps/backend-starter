import { PasswordResetToken } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PASSWORD_RESET_TOKEN_EXPIRES_IN } from '../core/constants';
import { db } from '../core/database';
import { redis } from '../core/redis';

async function createAuthenticationToken(userId: string): Promise<string> {
  const authenticationToken = generateAuthenticationToken();

  const authenticationTokenHash = hashAuthenticationToken(authenticationToken);

  await redis.set(
    generateAuthenticationTokenKey(authenticationTokenHash),
    userId,
  );

  await redis.sadd(generateTokenOwnerKey(userId), authenticationTokenHash);

  return authenticationToken;
}

function generateAuthenticationToken(): string {
  return randomBytes(32).toString('hex');
}

function generateAuthenticationTokenKey(
  authenticationTokenHash: string,
): string {
  return `auth-tokens:${authenticationTokenHash}`;
}

function generateTokenOwnerKey(userId: string): string {
  return `auth-token-owners:${userId}`;
}

function hashAuthenticationToken(authenticationToken: string): string {
  return createHash('sha256').update(authenticationToken).digest('hex');
}

async function getUserIdFromAuthenticationToken(
  authenticationToken: string,
): Promise<string | null> {
  return await redis.get(
    generateAuthenticationTokenKey(
      hashAuthenticationToken(authenticationToken),
    ),
  );
}

async function removeAuthenticationToken(
  authenticationToken: string,
  userId: string,
): Promise<void> {
  const authenticationTokenHash = hashAuthenticationToken(authenticationToken);

  await redis.del(generateAuthenticationTokenKey(authenticationTokenHash));

  await redis.srem(generateTokenOwnerKey(userId), authenticationTokenHash);
}

async function removeAllAuthenticationTokens(userId: string): Promise<void> {
  const authenticationTokenHashes = await redis.smembers(
    generateTokenOwnerKey(userId),
  );

  const authenticationTokenKeys: string[] = [];

  for (const authenticationTokenHash in authenticationTokenHashes) {
    authenticationTokenKeys.push(
      generateAuthenticationTokenKey(authenticationTokenHash),
    );
  }

  await redis.del([...authenticationTokenKeys, generateTokenOwnerKey(userId)]);
}

function generatePasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}

function hashPasswordResetToken(passwordResetToken: string): string {
  return createHash('sha256').update(passwordResetToken).digest('hex');
}

interface CreatePasswordResetTokenInput {
  lastLoginAt: Date;
}

async function createPasswordResetToken(
  userId: string,
  input: CreatePasswordResetTokenInput,
): Promise<string> {
  const resetToken = generatePasswordResetToken();

  const resetTokenHash = hashPasswordResetToken(resetToken);

  const expiresAt = new Date();

  expiresAt.setSeconds(
    expiresAt.getSeconds() + PASSWORD_RESET_TOKEN_EXPIRES_IN,
  );

  await db.passwordResetToken.create({
    data: {
      userId: userId,
      tokenHash: resetTokenHash,
      lastLoginAt: input.lastLoginAt,
      expiresAt: expiresAt,
    },
  });

  return resetToken;
}

async function getPasswordResetToken(
  resetTokenHash: string,
): Promise<PasswordResetToken | null> {
  return await db.passwordResetToken.findUnique({
    where: { tokenHash: resetTokenHash },
  });
}

export default {
  createAuthenticationToken,
  getUserIdFromAuthenticationToken,
  removeAuthenticationToken,
  removeAllAuthenticationTokens,
  hashPasswordResetToken,
  createPasswordResetToken,
  getPasswordResetToken,
};
