import { prisma } from "@challenge/database";

const DEFAULT_SIGNATURES = [
  { code: "DIRECTOR", positionTitle: "Giám đốc", signerTitle: "Giám đốc", displayOrder: 10 },
  { code: "CHIEF_ACCOUNTANT", positionTitle: "Kế toán trưởng", signerTitle: "Kế toán trưởng", displayOrder: 20 },
  { code: "TREASURER", positionTitle: "Thủ quỹ", signerTitle: "Thủ quỹ", displayOrder: 30 },
  { code: "WAREHOUSE_KEEPER", positionTitle: "Thủ kho", signerTitle: "Thủ kho", displayOrder: 40 },
  { code: "PREPARER", positionTitle: "Người lập phiếu", signerTitle: "Người lập phiếu", displayOrder: 50 },
  { code: "WORKSHOP_MANAGER", positionTitle: "Quản đốc", signerTitle: "Quản đốc", displayOrder: 60 },
  { code: "PRODUCTION_MANAGER", positionTitle: "Trưởng bộ phận sản xuất", signerTitle: "Trưởng bộ phận sản xuất", displayOrder: 70 },
  { code: "QC_QA", positionTitle: "QC/QA", signerTitle: "QC/QA", displayOrder: 80 },
  { code: "PRODUCTION_STAFF", positionTitle: "Người thực hiện", signerTitle: "Người thực hiện", displayOrder: 90 },
  { code: "SALES_STAFF", positionTitle: "Nhân viên bán hàng", signerTitle: "Nhân viên bán hàng", displayOrder: 100 },
  { code: "CUSTOMER", positionTitle: "Khách hàng", signerTitle: "Khách hàng", displayOrder: 110 },
  { code: "DELIVERER", positionTitle: "Người giao hàng", signerTitle: "Người giao hàng", displayOrder: 120 },
  { code: "RECEIVER", positionTitle: "Người nhận hàng", signerTitle: "Người nhận hàng", displayOrder: 130 },
  { code: "WAREHOUSE_KEEPER_OUT", positionTitle: "Thủ kho xuất", signerTitle: "Thủ kho xuất", displayOrder: 140 },
  { code: "WAREHOUSE_KEEPER_IN", positionTitle: "Thủ kho nhập", signerTitle: "Thủ kho nhập", displayOrder: 150 },
];

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

  ensureDefaultSignatures: () =>
    prisma.company_signatures.createMany({
      data: DEFAULT_SIGNATURES,
      skipDuplicates: true,
    }),

  updateSignature: (code: string, data: { signerName?: string | null; signerTitle: string; isActive?: boolean }) =>
    prisma.company_signatures.update({
      where: { code },
      data: {
        signerName: data.signerName,
        signerTitle: data.signerTitle,
        isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : undefined,
        updatedAt: new Date(),
      },
    }),

  getPrintSettings: () =>
    prisma.company_print_settings.findUnique({ where: { id: 1 } }),

  upsertPrintSettings: (data: { printSignerNames: boolean; preparerFromLoggedInUser: boolean; updatedBy: number }) =>
    prisma.company_print_settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: { ...data, updatedAt: new Date() },
    }),
};
