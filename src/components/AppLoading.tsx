import React from "react";

export default function AppLoading({ message = "Đang tải..." }: { message?: string }) {
  return (
    <div className="erp-app-loading" role="status" aria-live="polite">
      <div className="erp-app-loading-box">
        <div className="erp-app-loading-spinner" />
        <p>{message}</p>
      </div>
    </div>
  );
}
