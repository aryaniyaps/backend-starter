import { User } from '@prisma/client';
import argon2 from 'argon2';
import { formatDuration } from 'date-fns';
import { join } from 'path';
import UAParser from 'ua-parser-js';
import { URLSearchParams } from 'url';
import { APP_URL, PASSWORD_RESET_TOKEN_EXPIRES_IN } from '../core/constants';
import { emailClient } from '../core/emails';
import {
  InvalidInputError,
  UnauthenticatedError,
  UnexpectedError,
} from '../core/errors';
import userRepo from '../users/repo';
import authRepo from './repo';

interface RegisterUserInput {
  username: string;
  email: string;
  password: string;
}

interface RegisterUserResult {
  authenticationToken: string;
  user: User;
}

async function registerUser(
  input: RegisterUserInput,
): Promise<RegisterUserResult> {
  if ((await userRepo.getUserByEmail(input.email)) !== null) {
    throw new InvalidInputError({
      message: 'User with that email already exists.',
    });
  }
  if ((await userRepo.getUserByUsername(input.username)) !== null) {
    throw new InvalidInputError({
      message: 'User with that username already exists.',
    });
  }

  const user = await userRepo.createUser({
    username: input.username,
    email: input.email,
    password: input.password,
  });

  const authenticationToken = await authRepo.createAuthenticationToken(user.id);

  return {
    user,
    authenticationToken,
  };
}

interface LoginUserInput {
  login: string;
  password: string;
}

interface LoginUserResult {
  authenticationToken: string;
  user: User;
}

async function loginUser(input: LoginUserInput): Promise<LoginUserResult> {
  let user: User | null;
  if (input.login.includes('@')) {
    // if "@" is present, assume it's an email
    user = await userRepo.getUserByEmail(input.login);
  } else {
    // assume it's an username
    user = await userRepo.getUserByUsername(input.login);
  }

  if (user === null) {
    throw new InvalidInputError({ message: 'Invalid credentials provided.' });
  }

  try {
    if (!(await argon2.verify(user.passwordHash, input.password))) {
      throw new InvalidInputError({ message: 'Invalid credentials provided.' });
    }
  } catch (err) {
    // unexpected failure
    throw new UnexpectedError({
      message: "Couldn't login user. Please try again.",
    });
  }

  if (argon2.needsRehash(user.passwordHash)) {
    // update user's password hash
    await userRepo.updateUser(user.id, { password: input.password });
  }

  const authenticationToken = await authRepo.createAuthenticationToken(user.id);

  // update user's last login timestamp
  await userRepo.updateUser(user.id, { lastLogin: new Date() });

  return { authenticationToken, user };
}

async function verifyAuthenticationToken(
  authenticationToken: string,
): Promise<string> {
  const userId =
    await authRepo.getUserIdFromAuthenticationToken(authenticationToken);

  if (userId === null) {
    throw new UnauthenticatedError({
      message: 'Invalid authentication token provided.',
    });
  }

  return userId;
}

async function removeAuthenticationToken(
  authenticationToken: string,
  userId: string,
): Promise<void> {
  await authRepo.removeAuthenticationToken(authenticationToken, userId);
}

interface PasswordResetRequestInput {
  email: string;
}

async function sendPasswordResetRequest(
  input: PasswordResetRequestInput,
  userAgent: UAParser.IResult,
): Promise<void> {
  const existingUser = await userRepo.getUserByEmail(input.email);
  if (existingUser !== null) {
    const resetToken = await authRepo.createPasswordResetToken(
      existingUser.id,
      { lastLoginAt: existingUser.lastLoginAt },
    );

    const queryParams = new URLSearchParams({
      email: existingUser.email,
      reset_token: resetToken,
    });

    const actionUrl =
      join(APP_URL, '/auth/reset-password') + '?' + queryParams.toString();

    // send password reset email
    await emailClient.send({
      template: 'reset-password',
      message: { to: existingUser.email },
      locals: {
        actionUrl: actionUrl,
        operatingSystem: userAgent.os.name,
        browserName: userAgent.browser.name,
        username: existingUser.username,
        tokenExpiresIn: formatDuration({
          seconds: PASSWORD_RESET_TOKEN_EXPIRES_IN,
        }),
      },
    });
  }
}

interface PasswordResetInput {
  resetToken: string;
  email: string;
  newPassword: string;
}

async function resetPassword(input: PasswordResetInput): Promise<void> {
  const resetTokenHash = authRepo.hashPasswordResetToken(input.resetToken);

  const existingUser = await userRepo.getUserByEmail(input.email);

  const passwordResetToken =
    await authRepo.getPasswordResetToken(resetTokenHash);

  if (
    !(existingUser && passwordResetToken && existingUser.email === input.email)
  ) {
    throw new InvalidInputError({
      message: 'Invalid password reset token or email provided.',
    });
  }

  if (existingUser.lastLoginAt > passwordResetToken.lastLoginAt) {
    // If the user has logged in again after generating the password
    // reset token, the generated token becomes invalid.
    throw new InvalidInputError({
      message: 'Invalid password reset token or email provided.',
    });
  }

  await userRepo.updateUser(existingUser.id, { password: input.newPassword });
}

export default {
  registerUser,
  loginUser,
  verifyAuthenticationToken,
  removeAuthenticationToken,
  sendPasswordResetRequest,
  resetPassword,
};
