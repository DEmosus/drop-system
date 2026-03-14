import { User } from "@prisma/client";
import { prisma } from "../../config/prisma";

export const authRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async create(email: string, passwordHash: string): Promise<User> {
    return prisma.user.create({ data: { email, passwordHash } });
  },

  async emailExists(email: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { email } });
    return count > 0;
  },
};
