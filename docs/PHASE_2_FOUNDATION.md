# Phase 2 — Modular Monolith Foundation

## Trạng thái

Hoàn thành nền tảng chuyển đổi theo strangler pattern. Legacy frontend và `/api` tiếp tục hoạt động; module mới chạy song song tại `/api/v1`.

## Đã hoàn thành

- npm workspaces: `apps/*`, `packages/*`.
- Skeleton `apps/api`, `apps/web`, `packages/contracts`, `packages/database`.
- Prisma 6.19.2 introspection 24 model legacy, không dùng `db push`.
- Migration runner versioned và hai migration additive:
  - `001_auth_foundation`.
  - `002_rbac_foundation`.
- Zod contracts dùng chung cho auth.
- API response/error envelope, request ID, CORS và login rate limit.
- API v1 auth theo controller/service/repository:
  - Access token 15 phút.
  - Opaque refresh token, chỉ lưu SHA-256 hash.
  - Rotation và phát hiện token reuse.
  - Logout/revoke.
- RBAC tables, permission catalog và compatibility mapping từ role legacy.
- Middleware `authenticateV1` và `requirePermission`.
- Swagger UI tại `/api/v1/docs`.
- React Router và TanStack Query compatibility providers; App legacy vẫn chạy qua wildcard route.
- `.env.example` không chứa secret.

## Compatibility

- `/api/auth/login` legacy vẫn giữ nguyên.
- `/api/v1/auth/*` dùng security model mới.
- Cột `users.role` vẫn được giữ; `user_roles` là mapping song song.
- Không di chuyển page khỏi `src` trong phase này.

## Kiểm thử tích hợp

- Health: 200.
- Swagger: 200.
- Zod invalid login: 422.
- Login: 200.
- Refresh rotation: 200.
- Reuse token cũ: 401 và revoke family.
- Logout: 200; token đã logout không refresh được.
- `/auth/me` anonymous: 401.
- `/auth/me` admin: 200, có role và 18 permissions.
- Admin policy: 200.
- Non-admin policy: 403.
- Legacy login: 200.
- Dữ liệu test được cleanup.

## Bước tiếp theo

Vertical slice kế tiếp: chuẩn hóa mua hàng thành `DRAFT → POSTED → CANCELLED`, inventory ledger và payable ledger. Module mới sẽ dùng `/api/v1`; UI mua hàng được chuyển sang Router/Query/Form từng bước.