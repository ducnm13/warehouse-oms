import { Prisma, prisma } from "@challenge/database";

const assigneeSelect = {
  id: true,
  code: true,
  fullName: true,
  jobTitle: true,
  workUnit: true,
} as const;

const creatorSelect = {
  id: true,
  username: true,
  fullName: true,
} as const;

export const technicalIncidentListInclude = {
  assignee: { select: assigneeSelect },
  creator: { select: creatorSelect },
  images: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      createdAt: true,
    },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.technical_incidentsInclude;

export const technicalIncidentDetailInclude = {
  assignee: { select: assigneeSelect },
  creator: { select: creatorSelect },
  images: { orderBy: { id: "asc" as const } },
} satisfies Prisma.technical_incidentsInclude;

export const technicalIncidentRepository = {
  list(where: Prisma.technical_incidentsWhereInput, skip: number, take: number) {
    return prisma.technical_incidents.findMany({
      where,
      include: technicalIncidentListInclude,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip,
      take,
    });
  },
  count(where: Prisma.technical_incidentsWhereInput) {
    return prisma.technical_incidents.count({ where });
  },
  find(id: number) {
    return prisma.technical_incidents.findUnique({
      where: { id },
      include: technicalIncidentDetailInclude,
    });
  },
  codeExists(code: string, excludeId?: number) {
    return prisma.technical_incidents.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
  },
  assignee(id: number) {
    return prisma.employees.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fullName: true },
    });
  },
  assignees() {
    return prisma.employees.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, code: true, fullName: true, jobTitle: true, workUnit: true },
      orderBy: { fullName: "asc" },
      take: 500,
    });
  },
  statusCounts() {
    return prisma.technical_incidents.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
  },
  severityCounts() {
    return prisma.technical_incidents.groupBy({
      by: ["severity"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
  },
};

export { prisma };
