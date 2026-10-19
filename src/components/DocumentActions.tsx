import React from "react";
import { CheckCircle2, Edit, Printer, Undo2 } from "lucide-react";

export type DocumentStatus = "DRAFT" | "POSTED" | "CANCELLED" | string;

interface DocumentActionsProps {
  status: DocumentStatus;
  canEdit?: boolean;
  canPost?: boolean;
  canUnpost?: boolean;
  printing?: boolean;
  posting?: boolean;
  unposting?: boolean;
  onPost?: () => void;
  onEdit?: () => void;
  onUnpost?: () => void;
  onPrint?: () => void;
}

export default function DocumentActions({
  status,
  canEdit = true,
  canPost = true,
  canUnpost = true,
  printing = false,
  posting = false,
  unposting = false,
  onPost,
  onEdit,
  onUnpost,
  onPrint,
}: DocumentActionsProps) {
  const isPosted = status === "POSTED";
  const isDraft = status === "DRAFT";
  const isCancelled = status === "CANCELLED";
  const canEditOrPost = isDraft || isCancelled;
  return (
    <>
      {onPrint && (
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={printing}
          onClick={onPrint}
        >
          <span className="inline-flex items-center gap-2">
            <Printer size={15} className="text-blue-600" />
            {printing ? "Đang chuẩn bị in..." : "In"}
          </span>
        </button>
      )}
      {canEditOrPost && canPost && onPost && (
        <button
          type="button"
          className="erp-btn erp-btn-post"
          disabled={posting}
          onClick={onPost}
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={15} />
            {posting
              ? "Đang ghi sổ..."
              : isCancelled
                ? "Ghi sổ lại"
                : "Ghi sổ"}
          </span>
        </button>
      )}
      {isPosted && canUnpost && onUnpost && (
        <button
          type="button"
          className="erp-btn erp-btn-unpost"
          disabled={unposting}
          onClick={onUnpost}
        >
          <span className="inline-flex items-center gap-2">
            <Undo2 size={15} />
            {unposting ? "Đang bỏ ghi..." : "Bỏ ghi"}
          </span>
        </button>
      )}
      {canEditOrPost && canEdit && onEdit && (
        <button
          type="button"
          className="erp-btn erp-btn-primary"
          onClick={onEdit}
        >
          <span className="inline-flex items-center gap-2">
            <Edit size={15} />
            Sửa
          </span>
        </button>
      )}
    </>
  );
}
