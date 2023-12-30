import EmailClient from 'email-templates';
import nodemailer from 'nodemailer';
import { APP_NAME, APP_URL, SUPPORT_EMAIL } from './constants';

const transport = nodemailer.createTransport({
  url: process.env.MAIL_SERVER,
});

export const emailClient = new EmailClient({
  transport,
  message: {
    from: `${APP_NAME} <${process.env.MAIL_FROM}>`,
  },
  preview: Boolean(process.env.DEBUG),
  send: true,
  views: {
    locals: { appName: APP_NAME, appUrl: APP_URL, supportEmail: SUPPORT_EMAIL },
  },
});
