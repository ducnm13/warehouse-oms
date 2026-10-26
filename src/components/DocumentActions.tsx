import React from "react";
import { CheckCircle2, Copy, Edit, Printer, Undo2 } from "lucide-react";
import DetailOptionsMenu from "./DetailOptionsMenu";

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
  onDuplicate?: () => void;
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
  onDuplicate,
}: DocumentActionsProps) {
  const isPosted = status === "POSTED";
  const isDraft = status === "DRAFT";
  const isCancelled = status === "CANCELLED";
  const canEditOrPost = isDraft || isCancelled;
  return (
    <>
      {onPrint && onDuplicate ? (
        <DetailOptionsMenu
          actions={[
            {
              key: "print",
              label: printing ? "Đang chuẩn bị in..." : "In",
              icon: <Printer size={15} className="text-blue-600" />,
              onClick: onPrint,
              disabled: printing,
            },
            {
              key: "duplicate",
              label: "Nhân bản",
              icon: <Copy size={15} />,
              onClick: onDuplicate,
            },
          ]}
        />
      ) : (
        onPrint && (
          <button
            type="button"
            className="erp-btn"
            disabled={printing}
            onClick={onPrint}
          >
            <span className="inline-flex items-center gap-2">
              <Printer size={15} className="text-blue-600" />
              {printing ? "Đang chuẩn bị in..." : "In"}
            </span>
          </button>
        )
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
              ? "Đang lưu..."
              : isCancelled
                ? "Lưu lại"
                : "Lưu"}
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
            {unposting ? "Đang hủy lưu..." : "Hủy lưu"}
          </span>
        </button>
      )}
      {canEdit && onEdit && (
        <button
          type="button"
          className="erp-btn erp-btn-primary"
          disabled={!isDraft}
          title={
            isDraft
              ? "Sửa phiếu"
              : "Phiếu đã lưu — hủy lưu để khôi phục tồn kho trước khi sửa"
          }
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
