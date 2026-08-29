import { prisma } from "@challenge/database";

export const authRepository = {
  findUserByUsername(username: string) {
    return prisma.users.findUnique({ where: { username } });
  },
  findUserById(id: number) {
    return prisma.users.findUnique({ where: { id } });
  },
  createRefreshToken(data: {
    userId: number; tokenHash: string; familyId: string; expiresAt: Date;
    createdIp?: string; userAgent?: string;
  }) {
    return prisma.refresh_tokens.create({ data });
  },
  findRefreshToken(tokenHash: string) {
    return prisma.refresh_tokens.findUnique({ where: { tokenHash }, include: { users: true } });
  },
  async rotateRefreshToken(currentHash: string, replacement: {
    userId: number; tokenHash: string; familyId: string; expiresAt: Date;
    createdIp?: string; userAgent?: string;
  }) {
    return prisma.$transaction(async tx => {
      await tx.refresh_tokens.update({
        where: { tokenHash: currentHash },
        data: { revokedAt: new Date(), replacedByHash: replacement.tokenHash },
      });
      return tx.refresh_tokens.create({ data: replacement });
    });
  },
  revokeToken(tokenHash: string) {
    return prisma.refresh_tokens.updateMany({
      where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() },
    });
  },
  revokeFamily(userId: number, familyId: string) {
    return prisma.refresh_tokens.updateMany({
      where: { userId, familyId, revokedAt: null }, data: { revokedAt: new Date() },
    });
  },
};