import { randomUUID } from "node:crypto";

import {
  accountOverviewResponseSchema,
  devGuestLoginResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  registerBodySchema,
  registerResponseSchema
} from "@ebonkeep/shared";
import bcrypt from "bcrypt";
import { z } from "zod";

import type { FastifyPluginAsync } from "fastify";

import { getEnv } from "../../config/env.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./services/email.js";
import { generateToken, getExpiryDate } from "./utils/tokens.js";

const devGuestBodySchema = z.object({
  guestId: z.string().min(1).optional(),
  class: z.enum(["warrior", "mage", "ranger"]).default("warrior")
});

const verifyEmailBodySchema = z.object({
  token: z.string().min(1)
});

const forgotPasswordBodySchema = z.object({
  email: z.string().email()
});

const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register endpoint
  fastify.post("/v1/auth/register", async (request, reply) => {
    const body = registerBodySchema.parse(request.body ?? {});

    // Check if email already exists
    const existingEmailAccount = await fastify.prisma.account.findUnique({
      where: { email: body.email }
    });

    if (existingEmailAccount) {
      return reply.code(409).send({ error: "Email already registered" });
    }

    // Check if username already exists
    const existingUsernameAccount = await fastify.prisma.account.findUnique({
      where: { username: body.username }
    });

    if (existingUsernameAccount) {
      return reply.code(409).send({ error: "Username already taken" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Generate email verification token
    const emailVerifyToken = generateToken();
    const emailVerifyExpiry = getExpiryDate(24); // 24 hours

    // Create account
    const account = await fastify.prisma.account.create({
      data: {
        provider: "email",
        providerUserId: body.email,
        username: body.username,
        email: body.email,
        passwordHash,
        emailVerified: false,
        emailVerifyToken,
        emailVerifyExpiry
      }
    });

    // Create player profile
    const profile = await fastify.prisma.playerProfile.create({
      data: {
        id: `player_${randomUUID().replaceAll("-", "")}`,
        accountId: account.id,
        class: body.class,
        level: 1,
        gearScore: 10
      }
    });

    // Create player stats
    await fastify.prisma.playerStat.create({
      data: {
        playerId: profile.id,
        strength: 12,
        intelligence: 8,
        dexterity: 10,
        vitality: 12,
        initiative: 10,
        luck: 9
      }
    });

    // Create currency balance (start with 0 imperials, 1000 ducats)
    await fastify.prisma.currencyBalance.create({
      data: {
        playerId: profile.id,
        ducats: 1000,
        imperials: 0
      }
    });

    // Send verification email
    try {
      await sendVerificationEmail(
        body.email,
        emailVerifyToken,
        process.env.EBONKEEP_WEB_URL ?? "http://localhost:5173"
      );
    } catch (error) {
      fastify.log.error({ error }, "Failed to send verification email");
      // Don't fail registration if email fails
    }

    // Generate JWT
    const accessToken = await reply.jwtSign({
      accountId: account.id,
      playerId: profile.id
    });

    const payload = registerResponseSchema.parse({
      accessToken,
      accountId: account.id,
      playerId: profile.id
    });

    return reply.send(payload);
  });

  // Login endpoint
  fastify.post("/v1/auth/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body ?? {});

    // Find account by email
    const account = await fastify.prisma.account.findUnique({
      where: { email: body.email },
      include: {
        profiles: {
          take: 1
        }
      }
    });

    if (!account || !account.passwordHash) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(body.password, account.passwordHash);

    if (!passwordValid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    // Get first profile (for now we only support one profile per account)
    const profile = account.profiles[0];

    if (!profile) {
      return reply.code(404).send({ error: "No player profile found" });
    }

    // Generate JWT
    const accessToken = await reply.jwtSign({
      accountId: account.id,
      playerId: profile.id
    });

    const payload = loginResponseSchema.parse({
      accessToken,
      accountId: account.id,
      playerId: profile.id
    });

    return reply.send(payload);
  });

  fastify.post("/v1/dev/guest-login", async (request, reply) => {
    const env = getEnv();
    if (!env.DEV_GUEST_AUTH) {
      return reply.code(403).send({ error: "DEV_GUEST_AUTH is disabled." });
    }

    const body = devGuestBodySchema.parse(request.body ?? {});
    const providerUserId = body.guestId ?? "local-default";

    const account = await fastify.prisma.account.upsert({
      where: {
        provider_providerUserId: {
          provider: "dev-guest",
          providerUserId
        }
      },
      update: {},
      create: {
        provider: "dev-guest",
        providerUserId
      }
    });

    let profile = await fastify.prisma.playerProfile.findFirst({
      where: { accountId: account.id }
    });

    if (!profile) {
      profile = await fastify.prisma.playerProfile.create({
        data: {
          id: `player_${randomUUID().replaceAll("-", "")}`,
          accountId: account.id,
          class: body.class,
          level: 1,
          gearScore: 10
        }
      });
    }

    await fastify.prisma.playerStat.upsert({
      where: { playerId: profile.id },
      update: {},
      create: {
        playerId: profile.id,
        strength: 12,
        intelligence: 8,
        dexterity: 10,
        vitality: 12,
        initiative: 10,
        luck: 9
      }
    });

    await fastify.prisma.currencyBalance.upsert({
      where: { playerId: profile.id },
      update: {
        ducats: 1000
      },
      create: {
        playerId: profile.id,
        ducats: 1000,
        imperials: 10
      }
    });

    const accessToken = await reply.jwtSign({
      accountId: account.id,
      playerId: profile.id
    });

    const payload = devGuestLoginResponseSchema.parse({
      accessToken,
      playerId: profile.id,
      accountId: account.id
    });

    return reply.send(payload);
  });

  // Account overview endpoint (protected)
  fastify.get(
    "/v1/account/overview",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const accountId = request.user.accountId;

      const account = await fastify.prisma.account.findUnique({
        where: { id: accountId },
        include: {
          profiles: {
            take: 1,
            include: {
              currency: true
            }
          }
        }
      });

      if (!account) {
        return reply.code(404).send({ error: "Account not found" });
      }

      const profile = account.profiles[0];

      const payload = accountOverviewResponseSchema.parse({
        accountId: account.id,
        username: account.username,
        email: account.email,
        emailVerified: account.emailVerified,
        provider: account.provider,
        createdAt: account.createdAt.toISOString(),
        profile: profile
          ? {
              playerId: profile.id,
              class: profile.class,
              level: profile.level,
              gearScore: profile.gearScore
            }
          : null,
        currency: profile?.currency
          ? {
              ducats: profile.currency.ducats,
              imperials: profile.currency.imperials
            }
          : null
      });

      return reply.send(payload);
    }
  );

  // Email verification endpoint
  fastify.post("/v1/auth/verify-email", async (request, reply) => {
    const body = verifyEmailBodySchema.parse(request.body ?? {});

    const account = await fastify.prisma.account.findUnique({
      where: { emailVerifyToken: body.token }
    });

    if (!account) {
      return reply.code(400).send({ error: "Invalid or expired verification token" });
    }

    // Check if token expired
    if (account.emailVerifyExpiry && account.emailVerifyExpiry < new Date()) {
      return reply.code(400).send({ error: "Verification token has expired" });
    }

    // Mark email as verified
    await fastify.prisma.account.update({
      where: { id: account.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null
      }
    });

    return reply.send({ success: true, message: "Email verified successfully" });
  });

  // Forgot password endpoint
  fastify.post("/v1/auth/forgot-password", async (request, reply) => {
    const body = forgotPasswordBodySchema.parse(request.body ?? {});

    const account = await fastify.prisma.account.findUnique({
      where: { email: body.email }
    });

    // Always return success even if email doesn't exist (security best practice)
    if (!account) {
      return reply.send({ 
        success: true, 
        message: "If the email exists, a password reset link has been sent" 
      });
    }

    // Generate reset token
    const resetPasswordToken = generateToken();
    const resetPasswordExpiry = getExpiryDate(1); // 1 hour

    await fastify.prisma.account.update({
      where: { id: account.id },
      data: {
        resetPasswordToken,
        resetPasswordExpiry
      }
    });

    // Send reset email
    try {
      await sendPasswordResetEmail(
        body.email,
        resetPasswordToken,
        process.env.EBONKEEP_WEB_URL ?? "http://localhost:5173"
      );
    } catch (error) {
      fastify.log.error({ error }, "Failed to send password reset email");
    }

    return reply.send({ 
      success: true, 
      message: "If the email exists, a password reset link has been sent" 
    });
  });

  // Reset password endpoint
  fastify.post("/v1/auth/reset-password", async (request, reply) => {
    const body = resetPasswordBodySchema.parse(request.body ?? {});

    const account = await fastify.prisma.account.findUnique({
      where: { resetPasswordToken: body.token }
    });

    if (!account) {
      return reply.code(400).send({ error: "Invalid or expired reset token" });
    }

    // Check if token expired
    if (account.resetPasswordExpiry && account.resetPasswordExpiry < new Date()) {
      return reply.code(400).send({ error: "Reset token has expired" });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(body.newPassword, 10);

    // Update password and clear reset token
    await fastify.prisma.account.update({
      where: { id: account.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiry: null
      }
    });

    return reply.send({ success: true, message: "Password reset successfully" });
  });

  // Resend verification email endpoint (protected)
  fastify.post(
    "/v1/auth/resend-verification",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const accountId = request.user.accountId;

      const account = await fastify.prisma.account.findUnique({
        where: { id: accountId }
      });

      if (!account || !account.email) {
        return reply.code(404).send({ error: "Account not found" });
      }

      if (account.emailVerified) {
        return reply.code(400).send({ error: "Email is already verified" });
      }

      // Generate new verification token
      const emailVerifyToken = generateToken();
      const emailVerifyExpiry = getExpiryDate(24); // 24 hours

      await fastify.prisma.account.update({
        where: { id: account.id },
        data: {
          emailVerifyToken,
          emailVerifyExpiry
        }
      });

      // Send verification email
      try {
        await sendVerificationEmail(
          account.email,
          emailVerifyToken,
          process.env.EBONKEEP_WEB_URL ?? "http://localhost:5173"
        );
      } catch (error) {
        fastify.log.error({ error }, "Failed to send verification email");
        return reply.code(500).send({ error: "Failed to send verification email" });
      }

      return reply.send({ success: true, message: "Verification email sent" });
    }
  );
};
