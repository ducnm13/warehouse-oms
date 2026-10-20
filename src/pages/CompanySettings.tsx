import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FileSignature, Printer, Save } from "lucide-react";
import toast from "../components/ui/toast";
import { apiV1 } from "../lib/apiV1";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CompanyProfile {
  id: number; logoUrl?: string | null; name: string; address?: string | null;
  taxCode?: string | null; phone?: string | null; email?: string | null; website?: string | null;
}
interface CompanySignature {
  id: number; code: string; positionTitle: string; signerTitle: string;
  signerName?: string | null; displayOrder: number; isActive: boolean;
}
interface PrintSettings { id: number; printSignerNames: boolean; preparerFromLoggedInUser: boolean; }
interface CompanyData { profile: CompanyProfile | null; signatures: CompanySignature[]; printSettings: PrintSettings | null; }

// ─── Component ────────────────────────────────────────────────────────────────
export default function CompanySettings() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => apiV1<CompanyData>("/api/v1/company"),
  });

  // Profile form
  const emptyProfile = { name: "", address: "", taxCode: "", phone: "", email: "", website: "", logoUrl: "" };
  const [profile, setProfile] = useState(emptyProfile);

  // Signatures form
  const [signatures, setSignatures] = useState<CompanySignature[]>([]);

  // Print settings form
  const [printSettings, setPrintSettings] = useState({ printSignerNames: false, preparerFromLoggedInUser: true });

  // Sync state khi data load
  useEffect(() => {
    if (!data?.data) return;
    const d = data.data;
    if (d.profile) {
      setProfile({
        name: d.profile.name || "",
        address: d.profile.address || "",
        taxCode: d.profile.taxCode || "",
        phone: d.profile.phone || "",
        email: d.profile.email || "",
        website: d.profile.website || "",
        logoUrl: d.profile.logoUrl || "",
      });
    }
    if (d.signatures) setSignatures(d.signatures.map(s => ({ ...s, isActive: Boolean(s.isActive) })));
    if (d.printSettings) {
      setPrintSettings({
        printSignerNames: d.printSettings.printSignerNames,
        preparerFromLoggedInUser: d.printSettings.preparerFromLoggedInUser,
      });
    }
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: () => apiV1("/api/v1/company/profile", { method: "PUT", body: JSON.stringify({ ...profile, email: profile.email || null }) }),
    onSuccess: (r: any) => { toast.success(r.message); void qc.invalidateQueries({ queryKey: ["company-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSignatures = useMutation({
    mutationFn: () => {
      const bad = signatures.find(s => !s.code?.trim() || !(s.signerTitle || "").trim());
      if (bad) throw new Error(`Chức danh người ký (dòng ${bad.code || "?"}) không được để trống`);
      return apiV1("/api/v1/company/signatures", {
        method: "PUT",
        body: JSON.stringify({
          signatures: signatures.map(s => ({ code: s.code, signerName: s.signerName || null, signerTitle: s.signerTitle, isActive: Boolean(s.isActive) })),
        }),
      });
    },
    onSuccess: (r: any) => { toast.success(r.message); void qc.invalidateQueries({ queryKey: ["company-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePrintSettings = useMutation({
    mutationFn: () => apiV1("/api/v1/company/print-settings", { method: "PUT", body: JSON.stringify(printSettings) }),
    onSuccess: (r: any) => { toast.success(r.message); void qc.invalidateQueries({ queryKey: ["company-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="erp-page"><div className="p-12 text-center text-slate-400">Đang tải...</div></div>;

  return (
    <div className="erp-page p-6 max-w-5xl mx-auto">
      <div className="erp-page-header mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cấu hình doanh nghiệp</h1>
          <p className="text-sm text-slate-500 mt-1">Thông tin đơn vị, chữ ký và cài đặt in ấn</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Thông tin doanh nghiệp ── */}
        <div className="erp-card bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-indigo-50 rounded-xl"><Building2 size={22} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Thông tin đơn vị</h2>
              <p className="text-xs text-slate-500">Hiển thị trên báo cáo và chứng từ in ấn</p>
            </div>
          </div>
          <form onSubmit={e => { e.preventDefault(); saveProfile.mutate(); }}>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2 flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Tên đơn vị <span className="text-red-500">*</span>
                <input required value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Tên công ty / doanh nghiệp" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white shadow-sm" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Mã số thuế
                <input value={profile.taxCode || ""} onChange={e => setProfile({ ...profile, taxCode: e.target.value })} placeholder="0123456789" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white shadow-sm" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Điện thoại
                <input value={profile.phone || ""} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="0901 234 567" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white shadow-sm" />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Địa chỉ
                <textarea rows={2} value={profile.address || ""} onChange={e => setProfile({ ...profile, address: e.target.value })} placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white shadow-sm" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Email
                <input type="email" value={profile.email || ""} onChange={e => setProfile({ ...profile, email: e.target.value })} placeholder="contact@company.com" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white shadow-sm" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Website
                <input value={profile.website || ""} onChange={e => setProfile({ ...profile, website: e.target.value })} placeholder="https://company.com" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white shadow-sm" />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                Logo doanh nghiệp (Tải lên hoặc nhập URL)
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (uploadEvent) => {
                          setProfile({ ...profile, logoUrl: uploadEvent.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-300 rounded-lg bg-white shadow-sm"
                  />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    value={profile.logoUrl || ""}
                    onChange={e => setProfile({ ...profile, logoUrl: e.target.value })}
                    placeholder="Hoặc dán URL ảnh logo tại đây (https://...)"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white shadow-sm"
                  />
                </div>
                {profile.logoUrl && (
                  <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <img src={profile.logoUrl} alt="Logo preview" className="h-14 w-auto object-contain rounded bg-white p-1 border border-slate-200 shadow-sm" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="text-xs text-slate-500">
                      <p className="font-medium text-slate-700">Xem trước logo</p>
                      <p className="text-slate-400 truncate max-w-md">{profile.logoUrl.startsWith("data:") ? "Ảnh tải lên từ thiết bị" : profile.logoUrl}</p>
                    </div>
                  </div>
                )}
              </label>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="submit" className="erp-btn erp-btn-primary" disabled={saveProfile.isPending}>
                <Save size={16} /> {saveProfile.isPending ? "Đang lưu..." : "Lưu thông tin"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Chữ ký ── */}
        <div className="erp-card bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-amber-50 rounded-xl"><FileSignature size={22} className="text-amber-600" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Thông tin chữ ký</h2>
              <p className="text-xs text-slate-500">Hiển thị dưới chứng từ, phiếu in</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Chức danh</th>
                  <th>Tiêu đề trên phiếu</th>
                  <th>Tên người ký</th>
                  <th className="text-center">Hiển thị</th>
                </tr>
              </thead>
              <tbody>
                {signatures.map((sig, i) => (
                  <tr key={sig.code} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{sig.positionTitle}</td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 bg-white"
                        value={sig.signerTitle}
                        onChange={e => setSignatures(prev => prev.map((s, j) => j === i ? { ...s, signerTitle: e.target.value } : s))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 bg-white"
                        value={sig.signerName || ""}
                        placeholder="Để trống nếu chưa có"
                        onChange={e => setSignatures(prev => prev.map((s, j) => j === i ? { ...s, signerName: e.target.value } : s))}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={sig.isActive}
                        onChange={e => setSignatures(prev => prev.map((s, j) => j === i ? { ...s, isActive: e.target.checked } : s))}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="erp-btn erp-btn-primary" onClick={() => saveSignatures.mutate()} disabled={saveSignatures.isPending}>
              <Save size={16} /> {saveSignatures.isPending ? "Đang lưu..." : "Lưu chữ ký"}
            </button>
          </div>
        </div>

        {/* ── Cài đặt in ấn ── */}
        <div className="erp-card bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2.5 bg-green-50 rounded-xl"><Printer size={22} className="text-green-600" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Cài đặt in ấn</h2>
              <p className="text-xs text-slate-500">Tuỳ chọn hiển thị trên phiếu in</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
              <input
                type="checkbox"
                checked={printSettings.printSignerNames}
                onChange={e => setPrintSettings({ ...printSettings, printSignerNames: e.target.checked })}
                className="mt-1 w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-900">In tên người ký lên chứng từ</p>
                <p className="text-xs text-slate-500 mt-0.5">Hiển thị tên người ký bên dưới chữ ký mẫu trên tất cả phiếu in</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
              <input
                type="checkbox"
                checked={printSettings.preparerFromLoggedInUser}
                onChange={e => setPrintSettings({ ...printSettings, preparerFromLoggedInUser: e.target.checked })}
                className="mt-1 w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-900">Lấy tên người lập biểu theo người đăng nhập</p>
                <p className="text-xs text-slate-500 mt-0.5">Tự động điền tên đăng nhập hiện tại vào ô "Người lập phiếu"</p>
              </div>
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <button className="erp-btn erp-btn-primary" onClick={() => savePrintSettings.mutate()} disabled={savePrintSettings.isPending}>
              <Save size={16} /> {savePrintSettings.isPending ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
