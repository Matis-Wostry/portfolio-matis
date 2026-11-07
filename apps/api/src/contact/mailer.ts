import nodemailer from 'nodemailer';
import type { ContactConfig } from '../config.ts';

export type ContactMail = { replyTo: string; subject: string; text: string };
export type Mailer = { send(mail: ContactMail): Promise<void> };

/** Envoie les messages du formulaire par le serveur de mail configuré, à l'adresse de Matis. */
export const createSmtpMailer = (contact: ContactConfig): Mailer => {
  const transport = nodemailer.createTransport({
    host: contact.smtp.host,
    port: contact.smtp.port,
    secure: contact.smtp.secure,
    auth: { user: contact.smtp.user, pass: contact.smtp.password },
  });
  return {
    send: async (mail) => {
      await transport.sendMail({ from: contact.from, to: contact.to, ...mail });
    },
  };
};
