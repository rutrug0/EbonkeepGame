import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

export function initEmailService(config: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}) {
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password
    }
  });
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  baseUrl: string
) {
  if (!transporter) {
    throw new Error("Email service not initialized");
  }

  const verifyLink = `${baseUrl}?verifyToken=${token}`;

  await transporter.sendMail({
    from: '"Ebonkeep" <noreply@ebonkeep.com>',
    to,
    subject: "Verify your Ebonkeep account",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background: linear-gradient(165deg, #26303a 0%, #1b232d 45%, #13171d 100%); font-family: 'Alegreya Sans', 'Trebuchet MS', 'Segoe UI', sans-serif; line-height: 1.6;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background: radial-gradient(circle at 20% 12%, rgba(191, 153, 95, 0.08), transparent 38%), radial-gradient(circle at 78% 82%, rgba(70, 108, 113, 0.08), transparent 42%);">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background: rgba(29, 37, 46, 0.95); border: 1px solid rgba(186, 166, 131, 0.24); border-radius: 8px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, rgba(210, 173, 114, 0.15) 0%, rgba(76, 134, 141, 0.12) 100%); padding: 32px 40px; text-align: center; border-bottom: 1px solid rgba(186, 166, 131, 0.24);">
                      <h1 style="margin: 0; font-family: 'Cinzel', Cambria, 'Palatino Linotype', serif; font-size: 32px; font-weight: 700; color: #d2ad72; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5); letter-spacing: 1px;">
                        EBONKEEP
                      </h1>
                      <p style="margin: 8px 0 0 0; font-size: 14px; color: #c8bfad; letter-spacing: 3px; text-transform: uppercase;">
                        Dark Fantasy RPG
                      </p>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px 0; font-family: 'Cinzel', Cambria, serif; font-size: 24px; font-weight: 600; color: #f0e8d7;">
                        Welcome, Adventurer
                      </h2>
                      <p style="margin: 0 0 16px 0; color: #c8bfad; font-size: 16px;">
                        Thank you for joining Ebonkeep. To begin your journey into the depths, please verify your email address.
                      </p>
                      <p style="margin: 0 0 32px 0; color: #a69b86; font-size: 14px;">
                        Click the button below to activate your account:
                      </p>
                      <!-- Button -->
                      <table role="presentation" style="width: 100%;">
                        <tr>
                          <td style="text-align: center;">
                            <a href="${verifyLink}" 
                               style="display: inline-block; background: linear-gradient(135deg, #d2ad72 0%, #be9651 100%); color: #13171d; padding: 14px 36px; text-decoration: none; border-radius: 5px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(210, 173, 114, 0.3); text-transform: uppercase;">
                              Verify Email
                            </a>
                          </td>
                        </tr>
                      </table>
                      <!-- Link -->
                      <p style="margin: 32px 0 16px 0; color: #a69b86; font-size: 14px;">
                        Or copy and paste this link into your browser:
                      </p>
                      <div style="background: rgba(19, 23, 29, 0.6); border: 1px solid rgba(186, 166, 131, 0.2); border-radius: 5px; padding: 12px; word-break: break-all;">
                        <a href="${verifyLink}" style="color: #4c868d; text-decoration: none; font-size: 13px;">${verifyLink}</a>
                      </div>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background: rgba(19, 23, 29, 0.5); border-top: 1px solid rgba(186, 166, 131, 0.14);">
                      <p style="margin: 0 0 8px 0; color: #a69b86; font-size: 13px; line-height: 1.5;">
                        This verification link will expire in <strong style="color: #be9651;">24 hours</strong>.
                      </p>
                      <p style="margin: 0; color: #a69b86; font-size: 12px; line-height: 1.5;">
                        If you didn't create an account with Ebonkeep, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
                <!-- Copyright -->
                <table role="presentation" style="max-width: 600px; margin: 20px auto 0 auto;">
                  <tr>
                    <td style="text-align: center; padding: 0 20px;">
                      <p style="margin: 0; color: #a69b86; font-size: 12px;">
                        © 2026 Ebonkeep. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  baseUrl: string
) {
  if (!transporter) {
    throw new Error("Email service not initialized");
  }

  const resetLink = `${baseUrl}?resetToken=${token}`;

  await transporter.sendMail({
    from: '"Ebonkeep" <noreply@ebonkeep.com>',
    to,
    subject: "Reset your Ebonkeep password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background: linear-gradient(165deg, #26303a 0%, #1b232d 45%, #13171d 100%); font-family: 'Alegreya Sans', 'Trebuchet MS', 'Segoe UI', sans-serif; line-height: 1.6;">
          <table role="presentation" style="width: 100%; border-collapse: collapse; background: radial-gradient(circle at 20% 12%, rgba(191, 153, 95, 0.08), transparent 38%), radial-gradient(circle at 78% 82%, rgba(70, 108, 113, 0.08), transparent 42%);">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background: rgba(29, 37, 46, 0.95); border: 1px solid rgba(186, 166, 131, 0.24); border-radius: 8px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, rgba(151, 80, 74, 0.2) 0%, rgba(190, 150, 81, 0.15) 100%); padding: 32px 40px; text-align: center; border-bottom: 1px solid rgba(186, 166, 131, 0.24);">
                      <h1 style="margin: 0; font-family: 'Cinzel', Cambria, 'Palatino Linotype', serif; font-size: 32px; font-weight: 700; color: #d2ad72; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5); letter-spacing: 1px;">
                        EBONKEEP
                      </h1>
                      <p style="margin: 8px 0 0 0; font-size: 14px; color: #c8bfad; letter-spacing: 3px; text-transform: uppercase;">
                        Password Recovery
                      </p>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px 0; font-family: 'Cinzel', Cambria, serif; font-size: 24px; font-weight: 600; color: #f0e8d7;">
                        Password Reset Request
                      </h2>
                      <p style="margin: 0 0 16px 0; color: #c8bfad; font-size: 16px;">
                        We received a request to reset the password for your Ebonkeep account.
                      </p>
                      <p style="margin: 0 0 32px 0; color: #a69b86; font-size: 14px;">
                        Click the button below to create a new password:
                      </p>
                      <!-- Button -->
                      <table role="presentation" style="width: 100%;">
                        <tr>
                          <td style="text-align: center;">
                            <a href="${resetLink}" 
                               style="display: inline-block; background: linear-gradient(135deg, #97504a 0%, #be9651 100%); color: #f0e8d7; padding: 14px 36px; text-decoration: none; border-radius: 5px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(151, 80, 74, 0.4); text-transform: uppercase;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      <!-- Link -->
                      <p style="margin: 32px 0 16px 0; color: #a69b86; font-size: 14px;">
                        Or copy and paste this link into your browser:
                      </p>
                      <div style="background: rgba(19, 23, 29, 0.6); border: 1px solid rgba(186, 166, 131, 0.2); border-radius: 5px; padding: 12px; word-break: break-all;">
                        <a href="${resetLink}" style="color: #4c868d; text-decoration: none; font-size: 13px;">${resetLink}</a>
                      </div>
                      <!-- Warning Box -->
                      <div style="margin-top: 32px; background: rgba(151, 80, 74, 0.15); border-left: 4px solid #97504a; border-radius: 5px; padding: 16px;">
                        <p style="margin: 0; color: #f0e8d7; font-size: 14px; line-height: 1.6;">
                          <strong style="color: #be9651;">Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your account remains secure.
                        </p>
                      </div>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background: rgba(19, 23, 29, 0.5); border-top: 1px solid rgba(186, 166, 131, 0.14);">
                      <p style="margin: 0 0 8px 0; color: #a69b86; font-size: 13px; line-height: 1.5;">
                        This password reset link will expire in <strong style="color: #be9651;">1 hour</strong>.
                      </p>
                      <p style="margin: 0; color: #a69b86; font-size: 12px; line-height: 1.5;">
                        For security reasons, password reset links are single-use only.
                      </p>
                    </td>
                  </tr>
                </table>
                <!-- Copyright -->
                <table role="presentation" style="max-width: 600px; margin: 20px auto 0 auto;">
                  <tr>
                    <td style="text-align: center; padding: 0 20px;">
                      <p style="margin: 0; color: #a69b86; font-size: 12px;">
                        © 2026 Ebonkeep. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  });
}
