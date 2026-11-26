import type {
  TechnicalIncidentActionInput,
  TechnicalIncidentInput,
  TechnicalIncidentListQuery,
  TechnicalIncidentUpdateInput,
} from "@challenge/contracts";
import { resolveDocumentCode } from "../../common/document-code";
import { HttpError } from "../../common/http-error";
import {
  diffFields,
  recordAudit,
  snapshotFields,
  type AuditChange,
  type AuditField,
} from "../../common/audit";
import { mapTechnicalIncident } from "./technical-incident.mapper";
import {
  prisma,
  technicalIncidentDetailInclude,
  technicalIncidentRepository,
} from "./technical-incident.repository";

const nowIso = () => new Date().toISOString();

const AUDIT_FIELDS: AuditField[] = [
  { key: "code", label: "Mã sự cố" },
  { key: "title", label: "Tên sự cố" },
  { key: "equipmentName", label: "Máy móc / thiết bị" },
  { key: "location", label: "Vị trí" },
  { key: "category", label: "Loại sự cố" },
  { key: "severity", label: "Mức độ" },
  { key: "status", label: "Trạng thái" },
  { key: "occurredAt", label: "Thời gian xảy ra" },
  { key: "assigneeName", label: "Người chịu trách nhiệm" },
  { key: "cause", label: "Nguyên nhân" },
  { key: "solution", label: "Hướng xử lý" },
  { key: "cost", label: "Chi phí" },
  { key: "note", label: "Ghi chú" },
  { key: "resolvedAt", label: "Thời gian hoàn tất" },
];

const MAX_IMAGES = 12;
const MAX_IMAGE_PAYLOAD = 8_500_000;

const totalImageChars = (images: Array<{ dataUrl?: string }>) =>
  images.reduce((sum, image) => sum + (image.dataUrl?.length || 0), 0);

const parseOccurredAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, "INVALID_OCCURRED_AT", "Thời gian xảy ra không hợp lệ");
  }
  return date;
};

async function resolveAssignee(assigneeId?: number | null) {
  if (!assigneeId) return null;
  const employee = await technicalIncidentRepository.assignee(assigneeId);
  if (!employee) {
    throw new HttpError(422, "ASSIGNEE_NOT_FOUND", "Người chịu trách nhiệm không tồn tại");
  }
  return employee;
}

function headerPayload(
  input: TechnicalIncidentInput,
  assignee: { id: number; fullName: string } | null,
  resolvedAt: Date | null,
) {
  const assigneeName = (input.assigneeName || assignee?.fullName || "").trim();
  return {
    title: input.title,
    equipmentName: input.equipmentName || null,
    location: input.location || null,
    category: input.category,
    severity: input.severity,
    status: input.status,
    occurredAt: parseOccurredAt(input.occurredAt),
    assigneeId: assignee?.id ?? null,
    assigneeName: assigneeName || null,
    cause: input.cause || null,
    solution: input.solution || null,
    cost: input.cost,
    note: input.note || null,
    resolvedAt,
  };
}

function imageAudit(
  added: Array<{ fileName: string }>,
  removed: Array<{ fileName: string }>,
): AuditChange[] {
  return [
    ...removed.map(image => ({
      field: "images",
      label: `Xóa hình ảnh bằng chứng: ${image.fileName}`,
      oldValue: image.fileName,
      newValue: null,
    })),
    ...added.map(image => ({
      field: "images",
      label: `Thêm hình ảnh bằng chứng: ${image.fileName}`,
      oldValue: null,
      newValue: image.fileName,
    })),
  ];
}

export const technicalIncidentService = {
  async list(query: TechnicalIncidentListQuery) {
    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { title: { contains: query.search } },
        { equipmentName: { contains: query.search } },
        { assigneeName: { contains: query.search } },
        { cause: { contains: query.search } },
      ];
    }
    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = new Date(`${query.from}T00:00:00.000Z`);
      if (query.to) where.occurredAt.lte = new Date(`${query.to}T23:59:59.999Z`);
    }
    const [rows, total] = await Promise.all([
      technicalIncidentRepository.list(where, (query.page - 1) * query.limit, query.limit),
      technicalIncidentRepository.count(where),
    ]);
    return {
      data: rows.map(row => mapTechnicalIncident(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  },

  async get(id: number) {
    const row = await technicalIncidentRepository.find(id);
    if (!row || row.deletedAt) {
      throw new HttpError(404, "TECHNICAL_INCIDENT_NOT_FOUND", "Không tìm thấy sự cố kỹ thuật");
    }
    return mapTechnicalIncident(row, { detail: true });
  },

  async summary() {
    const [statusRows, severityRows] = await Promise.all([
      technicalIncidentRepository.statusCounts(),
      technicalIncidentRepository.severityCounts(),
    ]);
    const countByStatus = (status: string) =>
      Number(statusRows.find((row: any) => row.status === status)?._count?._all || 0);
    const countBySeverity = (severity: string) =>
      Number(severityRows.find((row: any) => row.severity === severity)?._count?._all || 0);
    const open = countByStatus("OPEN");
    const inProgress = countByStatus("IN_PROGRESS");
    const resolved = countByStatus("RESOLVED");
    const cancelled = countByStatus("CANCELLED");
    return {
      total: open + inProgress + resolved + cancelled,
      open,
      inProgress,
      resolved,
      cancelled,
      critical: countBySeverity("CRITICAL"),
      high: countBySeverity("HIGH"),
    };
  },

  async assignees() {
    return technicalIncidentRepository.assignees();
  },

  async create(input: TechnicalIncidentInput, userId: number) {
    const code = await resolveDocumentCode("technical_incident", input.code);
    const assignee = await resolveAssignee(input.assigneeId);
    if (input.images.length > MAX_IMAGES) {
      throw new HttpError(422, "IMAGE_LIMIT_EXCEEDED", `Tối đa ${MAX_IMAGES} hình ảnh bằng chứng`);
    }
    if (totalImageChars(input.images) > MAX_IMAGE_PAYLOAD) {
      throw new HttpError(422, "IMAGE_PAYLOAD_EXCEEDED", "Tổng dung lượng hình ảnh vượt giới hạn cho phép");
    }
    const resolvedAt = input.status === "RESOLVED" ? new Date() : null;
    const row = await prisma.technical_incidents.create({
      data: {
        code,
        ...headerPayload(input, assignee, resolvedAt),
        createdBy: userId,
        ...(input.images.length
          ? {
              images: {
                create: input.images.map(image => ({
                  fileName: image.fileName,
                  mimeType: image.mimeType,
                  size: image.size,
                  dataUrl: image.dataUrl,
                })),
              },
            }
          : {}),
      },
      include: technicalIncidentDetailInclude,
    });
    await recordAudit(prisma, {
      action: "Tạo sự cố kỹ thuật",
      details: row.code,
      entityType: "TECHNICAL_INCIDENT",
      entityId: row.id,
      entityCode: row.code,
      userId,
      createdAt: nowIso(),
      changes: [
        ...snapshotFields(row, AUDIT_FIELDS),
        ...imageAudit(row.images || [], []),
      ],
    });
    return mapTechnicalIncident(row, { detail: true });
  },

  async update(id: number, input: TechnicalIncidentUpdateInput, userId: number) {
    const assignee = await resolveAssignee(input.assigneeId);
    return prisma.$transaction(async tx => {
      const locked = (await tx.$queryRawUnsafe(
        "SELECT id,status,version,code FROM technical_incidents WHERE id=? AND deletedAt IS NULL FOR UPDATE",
        id,
      )) as any[];
      if (!locked.length) {
        throw new HttpError(404, "TECHNICAL_INCIDENT_NOT_FOUND", "Không tìm thấy sự cố kỹ thuật");
      }
      if (Number(locked[0].version) !== input.version) {
        throw new HttpError(409, "VERSION_CONFLICT", "Sự cố đã được cập nhật bởi người khác");
      }
      const before = await tx.technical_incidents.findUnique({
        where: { id },
        include: technicalIncidentDetailInclude,
      });
      if (!before) {
        throw new HttpError(404, "TECHNICAL_INCIDENT_NOT_FOUND", "Không tìm thấy sự cố kỹ thuật");
      }
      const removeIds = new Set(input.removeImageIds);
      const removed = (before.images || []).filter((image: any) => removeIds.has(image.id));
      const remaining = (before.images || []).length - removed.length;
      if (remaining + input.images.length > MAX_IMAGES) {
        throw new HttpError(422, "IMAGE_LIMIT_EXCEEDED", `Tối đa ${MAX_IMAGES} hình ảnh bằng chứng`);
      }
      const keptImages = (before.images || []).filter((image: any) => !removeIds.has(image.id));
      if (
        totalImageChars(keptImages as any[]) + totalImageChars(input.images) >
        MAX_IMAGE_PAYLOAD
      ) {
        throw new HttpError(
          422,
          "IMAGE_PAYLOAD_EXCEEDED",
          "Tổng dung lượng hình ảnh vượt giới hạn cho phép",
        );
      }
      const resolvedAt =
        input.status !== "RESOLVED"
          ? null
          : before.status === "RESOLVED" && before.resolvedAt
            ? before.resolvedAt
            : new Date();
      await tx.technical_incidents.update({
        where: { id },
        data: {
          ...headerPayload(input, assignee, resolvedAt),
          version: { increment: 1 },
        },
      });
      if (removed.length) {
        await tx.technical_incident_images.deleteMany({
          where: { incidentId: id, id: { in: removed.map((image: any) => image.id) } },
        });
      }
      if (input.images.length) {
        await tx.technical_incident_images.createMany({
          data: input.images.map(image => ({
            incidentId: id,
            fileName: image.fileName,
            mimeType: image.mimeType,
            size: image.size,
            dataUrl: image.dataUrl,
          })),
        });
      }
      const after = await tx.technical_incidents.findUnique({
        where: { id },
        include: technicalIncidentDetailInclude,
      });
      if (!after) {
        throw new HttpError(404, "TECHNICAL_INCIDENT_NOT_FOUND", "Không tìm thấy sự cố kỹ thuật");
      }
      const beforeIds = new Set((before.images || []).map((image: any) => image.id));
      const added = (after.images || []).filter((image: any) => !beforeIds.has(image.id));
      const changes = [
        ...diffFields(before, after, AUDIT_FIELDS),
        ...imageAudit(added as any[], removed as any[]),
      ];
      await recordAudit(tx, {
        action: "Cập nhật sự cố kỹ thuật",
        details: after.code,
        entityType: "TECHNICAL_INCIDENT",
        entityId: id,
        entityCode: after.code,
        userId,
        createdAt: nowIso(),
        changes,
      });
      return mapTechnicalIncident(after, { detail: true });
    });
  },

  async changeStatus(id: number, input: TechnicalIncidentActionInput, userId: number) {
    return prisma.$transaction(async tx => {
      const locked = (await tx.$queryRawUnsafe(
        "SELECT id,status,version,code FROM technical_incidents WHERE id=? AND deletedAt IS NULL FOR UPDATE",
        id,
      )) as any[];
      if (!locked.length) {
        throw new HttpError(404, "TECHNICAL_INCIDENT_NOT_FOUND", "Không tìm thấy sự cố kỹ thuật");
      }
      if (Number(locked[0].version) !== input.version) {
        throw new HttpError(409, "VERSION_CONFLICT", "Sự cố đã được cập nhật bởi người khác");
      }
      if (locked[0].status === input.status) {
        throw new HttpError(409, "STATUS_CONFLICT", "Sự cố đã ở trạng thái yêu cầu");
      }
      const row = await tx.technical_incidents.update({
        where: { id },
        data: {
          status: input.status,
          resolvedAt: input.status === "RESOLVED" ? new Date() : null,
          version: { increment: 1 },
        },
        include: technicalIncidentDetailInclude,
      });
      await recordAudit(tx, {
        action: "Chuyển trạng thái sự cố kỹ thuật",
        details: row.code,
        entityType: "TECHNICAL_INCIDENT",
        entityId: id,
        entityCode: row.code,
        userId,
        createdAt: nowIso(),
        changes: [
          {
            field: "status",
            label: "Trạng thái",
            oldValue: locked[0].status,
            newValue: input.status,
          },
        ],
      });
      return mapTechnicalIncident(row, { detail: true });
    });
  },

  async remove(id: number, version: number, userId: number) {
    return prisma.$transaction(async tx => {
      const locked = (await tx.$queryRawUnsafe(
        "SELECT id,status,version,code,title FROM technical_incidents WHERE id=? AND deletedAt IS NULL FOR UPDATE",
        id,
      )) as any[];
      if (!locked.length) {
        throw new HttpError(404, "TECHNICAL_INCIDENT_NOT_FOUND", "Không tìm thấy sự cố kỹ thuật");
      }
      if (Number(locked[0].version) !== version) {
        throw new HttpError(409, "VERSION_CONFLICT", "Sự cố đã được cập nhật bởi người khác");
      }
      await tx.technical_incidents.update({
        where: { id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      await recordAudit(tx, {
        action: "Xóa sự cố kỹ thuật",
        details: locked[0].code,
        entityType: "TECHNICAL_INCIDENT",
        entityId: id,
        entityCode: locked[0].code,
        userId,
        createdAt: nowIso(),
        changes: [
          {
            field: "deletedAt",
            label: "Trạng thái bản ghi",
            oldValue: "Đang sử dụng",
            newValue: "Đã xóa",
          },
        ],
      });
      return null;
    });
  },
};
