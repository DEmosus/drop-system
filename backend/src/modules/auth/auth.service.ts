// import bcrypt from "bcryptjs";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { BCRYPT_ROUNDS } from "../../config/constants";
import { env } from "../../config/env";
import { ConflictError, UnauthorizedError } from "../../utils/errors";
import { logger } from "../../utils/logger/logger";
import { authRepository } from "./auth.repository";
import { AuthTokenResult, JwtPayload } from "./auth.types";

function signToken(userId: string, email: string): string {
  const payload: JwtPayload = { userId, email };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "24h" });
}

export const authService = {
  async register(email: string, password: string): Promise<AuthTokenResult> {
    const exists = await authRepository.emailExists(email);
    if (exists) {
      throw new ConflictError("Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await authRepository.create(email, passwordHash);
    console.log("Created user:", user);
    const token = signToken(user.id, user.email);

    logger.info({ userId: user.id, email }, "User registered");
    return { token, userId: user.id, email: user.email };
  },

  async login(email: string, password: string): Promise<AuthTokenResult> {
    const user = await authRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const token = signToken(user.id, user.email);
    logger.info({ userId: user.id, email }, "User logged in");
    return { token, userId: user.id, email: user.email };
  },
};
