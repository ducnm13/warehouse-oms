type ApiEnvelope<T> = { success: boolean; message: string; data: T; code?: string; meta?: Record<string, any>; fieldErrors?: Record<string, string[]> };

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;
  if (!refreshPromise) refreshPromise = fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }).then(async response => {
    if (!response.ok) return null;
    const envelope = await response.json();
    localStorage.setItem("token", envelope.data.accessToken);
    localStorage.setItem("refreshToken", envelope.data.refreshToken);
    return envelope.data.accessToken as string;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function clearAuthAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("erp-session-only");
  window.location.href = "/login";
}

export async function apiV1<T>(url: string, options: RequestInit = {}, allowRefresh = true): Promise<ApiEnvelope<T>> {
  const token = localStorage.getItem("token");
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401 && allowRefresh) {
    const nextToken = await refreshAccessToken();
    if (nextToken) return apiV1<T>(url, options, false);
    clearAuthAndRedirect();
    throw new Error("Phiên đăng nhập hết hạn");
  }
  if (response.status === 401 && !allowRefresh) {
    clearAuthAndRedirect();
    throw new Error("Phiên đăng nhập hết hạn");
  }
  
  // Handle empty responses (e.g., 204 No Content)
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return { success: true, message: "OK", data: null as any };
  }
  
  let body: ApiEnvelope<T>;
  try {
    body = await response.json();
  } catch {
    body = { success: false, message: "Phản hồi máy chủ không hợp lệ", data: null as any };
  }
  if (!response.ok) throw Object.assign(new Error(body.message || "Có lỗi xảy ra"), { status: response.status, code: body.code, fieldErrors: body.fieldErrors });
  return body;
}

export async function legacyApi<T>(url: string): Promise<T> {
  const token = localStorage.getItem("token");
  let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      response = await fetch(url, { headers: { Authorization: `Bearer ${nextToken}` } });
    } else {
      clearAuthAndRedirect();
      throw new Error("Phiên đăng nhập hết hạn");
    }
  }
  if (response.status === 401) {
    clearAuthAndRedirect();
    throw new Error("Phiên đăng nhập hết hạn");
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Không tải được dữ liệu danh mục");
  return body;
}