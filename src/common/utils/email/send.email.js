import nodemailer from "nodemailer";
import { EMAIL_APP_PASSWORD, EMAIL_APP, APPLICATION_NAME } from './../../../../config/config.service.js';

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_APP,
    pass: EMAIL_APP_PASSWORD,
  },
});

export const sendEmail = async ({
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  attachments = []
} = {}) => {
  return transporter.sendMail({
    to,
    cc,
    bcc,
    subject,
    attachments,
    from: `"${APPLICATION_NAME} "<${EMAIL_APP}>`,
    html,
    text,
  })
}