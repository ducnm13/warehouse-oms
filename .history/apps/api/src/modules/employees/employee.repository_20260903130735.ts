import { prisma } from "@challenge/database";

export const employeeRepository = {
  list: (where: object, skip: number, take: number) =>
    prisma.employees.findMany({
      where,
      skip,
      take,
      orderBy: { code: "asc" },
      include: { users: { select: { id: true, username: true } } },
    }),

  count: (where: object) => prisma.employees.count({ where }),

  findById: (id: number) =>
    prisma.employees.findUnique({
      where: { id },
      include: { users: { select: { id: true, username: true } } },
    }),

  findByCode: (code: string) => prisma.employees.findUnique({ where: { code } }),

  create: (data: {
    code: string;
    fullName: string;
    jobTitle?: string | null;
    status: string;
    workUnit?: string | null;
    userId?: number | null;
  }) => prisma.employees.create({ data }),

  update: (id: number, data: {
    code: string;
    fullName: string;
    jobTitle?: string | null;
    status: string;
    workUnit?: string | null;
    userId?: number | null;
  }) =>
    prisma.employees.update({ where: { id }, data: { ...data, updatedAt: new Date() } }),

  softDelete: (id: number) =>
    prisma.employees.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } }),
};
