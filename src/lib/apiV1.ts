type ApiEnvelope<T> = { success: boolean; message: string; data: T; code?: string; meta?: Record<string, any> };

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
  }
  const body = await response.json().catch(() => ({ success: false, message: "Phản hồi máy chủ không hợp lệ" }));
  if (!response.ok) throw Object.assign(new Error(body.message || "Có lỗi xảy ra"), { status: response.status, code: body.code, fieldErrors: body.fieldErrors });
  return body;
}

export async function legacyApi<T>(url: string): Promise<T> {
  const token = localStorage.getItem("token");
  let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) {
    const nextToken = await refreshAccessToken();
    if (nextToken) response = await fetch(url, { headers: { Authorization: `Bearer ${nextToken}` } });
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Không tải được dữ liệu danh mục");
  return body;
}