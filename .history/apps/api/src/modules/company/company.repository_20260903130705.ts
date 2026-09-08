import { prisma } from "@challenge/database";

export const companyRepository = {
  getProfile: () =>
    prisma.company_profiles.findUnique({ where: { id: 1 } }),

  upsertProfile: (data: {
    logoUrl?: string | null;
    name: string;
    address?: string | null;
    taxCode?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    updatedBy: number;
  }) =>
    prisma.company_profiles.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: { ...data, updatedAt: new Date() },
    }),

  getSignatures: () =>
    prisma.company_signatures.findMany({ orderBy: { displayOrder: "asc" } }),

  updateSignature: (code: string, data: { signerName?: string | null; signerTitle: string; isActive?: boolean }) =>
    prisma.company_signatures.update({ where: { code }, data: { ...data, updatedAt: new Date() } }),

  getPrintSettings: () =>
    prisma.company_print_settings.findUnique({ where: { id: 1 } }),

  upsertPrintSettings: (data: { printSignerNames: boolean; preparerFromLoggedInUser: boolean; updatedBy: number }) =>
    prisma.company_print_settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: { ...data, updatedAt: new Date() },
    }),
};
