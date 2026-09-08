import { z } from "zod";

// ─── Company Profile ──────────────────────────────────────────────────────────
export const companyProfileUpdateSchema = z.object({
  logoUrl: z.string().trim().max(10_000_000).optional().nullable(),
  name: z.string().trim().min(1).max(255),
  address: z.string().trim().max(1000).optional().nullable(),
  taxCode: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  website: z.string().trim().max(255).optional().nullable(),
});
export type CompanyProfileUpdateInput = z.infer<typeof companyProfileUpdateSchema>;

// ─── Signature ────────────────────────────────────────────────────────────────
export const signatureUpdateSchema = z.object({
  signerName: z.string().trim().max(255).optional().nullable(),
  signerTitle: z.string().trim().max(255).min(1),
  isActive: z.boolean().optional().default(true),
});
export type SignatureUpdateInput = z.infer<typeof signatureUpdateSchema>;

export const signaturesUpdateSchema = z.object({
  signatures: z.array(
    z.object({
      code: z.string().trim().min(1).max(50),
      signerName: z.string().trim().max(255).optional().nullable(),
      signerTitle: z.string().trim().max(255).min(1),
      isActive: z.boolean().optional().default(true),
    }),
  ).min(1),
});
export type SignaturesUpdateInput = z.infer<typeof signaturesUpdateSchema>;

// ─── Print Settings ───────────────────────────────────────────────────────────
export const printSettingsUpdateSchema = z.object({
  printSignerNames: z.boolean().default(false),
  preparerFromLoggedInUser: z.boolean().default(true),
});
export type PrintSettingsUpdateInput = z.infer<typeof printSettingsUpdateSchema>;
