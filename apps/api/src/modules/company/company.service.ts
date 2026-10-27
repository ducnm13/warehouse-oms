import type { CompanyProfileUpdateInput, PrintSettingsUpdateInput, SignaturesUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { companyRepository } from "./company.repository";

export const companyService = {
  async getAll() {
    await companyRepository.ensureDefaultSignatures();
    const [profile, signatures, printSettings] = await Promise.all([
      companyRepository.getProfile(),
      companyRepository.getSignatures(),
      companyRepository.getPrintSettings(),
    ]);
    return { profile, signatures, printSettings };
  },

  async updateProfile(input: CompanyProfileUpdateInput, userId: number) {
    return companyRepository.upsertProfile({
      logoUrl: input.logoUrl ?? null,
      name: input.name,
      address: input.address ?? null,
      taxCode: input.taxCode ?? null,
      phone: input.phone ?? null,
      email: input.email || null,
      website: input.website ?? null,
      updatedBy: userId,
    });
  },

  async updateSignatures(input: SignaturesUpdateInput, _userId: number) {
    const existing = await companyRepository.getSignatures();
    const existingCodes = new Set(existing.map(s => s.code));
    for (const sig of input.signatures) {
      if (!existingCodes.has(sig.code)) throw new HttpError(422, "SIGNATURE_NOT_FOUND", `Chữ ký '${sig.code}' không tồn tại`);
      await companyRepository.updateSignature(sig.code, {
        signerName: sig.signerName ?? null,
        signerTitle: sig.signerTitle,
        isActive: sig.isActive ?? true,
      });
    }
    return companyRepository.getSignatures();
  },

  async updatePrintSettings(input: PrintSettingsUpdateInput, userId: number) {
    return companyRepository.upsertPrintSettings({
      printSignerNames: input.printSignerNames,
      preparerFromLoggedInUser: input.preparerFromLoggedInUser,
      updatedBy: userId,
    });
  },
};
