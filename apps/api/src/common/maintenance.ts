import { prisma } from "@challenge/database";

const MAINTENANCE_KEY = "maintenance_mode";
const DEFAULT_MESSAGE =
  "Hệ thống đang được cập nhật để nâng cao chất lượng dịch vụ. Vui lòng quay lại sau ít phút.";

export type MaintenanceState = {
  enabled: boolean;
  message: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

const defaultState = (): MaintenanceState => ({
  enabled: false,
  message: DEFAULT_MESSAGE,
  updatedAt: null,
  updatedBy: null,
});

function parseState(value?: string | null): MaintenanceState {
  if (!value) return defaultState();
  try {
    const parsed = JSON.parse(value);
    return {
      enabled: parsed?.enabled === true,
      message:
        typeof parsed?.message === "string" && parsed.message.trim()
          ? parsed.message
          : DEFAULT_MESSAGE,
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null,
      updatedBy: typeof parsed?.updatedBy === "string" ? parsed.updatedBy : null,
    };
  } catch {
    return defaultState();
  }
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  const row = await prisma.system_settings.findUnique({
    where: { key: MAINTENANCE_KEY },
  });
  return parseState(row?.value);
}

export async function setMaintenanceState(input: {
  enabled: boolean;
  message?: string;
  actor?: string | null;
}): Promise<MaintenanceState> {
  const next: MaintenanceState = {
    enabled: input.enabled === true,
    message: input.message?.trim() || DEFAULT_MESSAGE,
    updatedAt: new Date().toISOString(),
    updatedBy: input.actor || null,
  };
  const value = JSON.stringify(next);
  await prisma.system_settings.upsert({
    where: { key: MAINTENANCE_KEY },
    create: {
      key: MAINTENANCE_KEY,
      value,
      description: "Trạng thái bảo trì toàn hệ thống",
      updatedAt: next.updatedAt,
    },
    update: {
      value,
      description: "Trạng thái bảo trì toàn hệ thống",
      updatedAt: next.updatedAt,
    },
  });
  return next;
}
