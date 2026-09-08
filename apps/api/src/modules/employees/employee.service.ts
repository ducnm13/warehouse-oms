import type { EmployeeCreateInput, EmployeeListQuery, EmployeeUpdateInput } from "@challenge/contracts";
import { HttpError } from "../../common/http-error";
import { employeeRepository } from "./employee.repository";

export const employeeService = {
  async list(query: EmployeeListQuery) {
    const where: any = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { fullName: { contains: query.search } },
        { jobTitle: { contains: query.search } },
      ];
    }
    const [rows, total] = await Promise.all([
      employeeRepository.list(where, (query.page - 1) * query.limit, query.limit),
      employeeRepository.count(where),
    ]);
    return {
      data: rows,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  },

  async get(id: number) {
    const row = await employeeRepository.findById(id);
    if (!row || row.deletedAt) throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    return row;
  },

  async create(input: EmployeeCreateInput) {
    const existing = await employeeRepository.findByCode(input.code);
    if (existing && !existing.deletedAt) throw new HttpError(422, "EMPLOYEE_CODE_EXISTS", "Mã nhân viên đã tồn tại");
    return employeeRepository.create({
      code: input.code,
      fullName: input.fullName,
      jobTitle: input.jobTitle ?? null,
      status: input.status ?? "ACTIVE",
      workUnit: input.workUnit ?? null,
      userId: input.userId ?? null,
    });
  },

  async update(id: number, input: EmployeeUpdateInput) {
    const existing = await employeeRepository.findById(id);
    if (!existing || existing.deletedAt) throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    // Nếu đổi code, check trùng
    if (input.code !== existing.code) {
      const dup = await employeeRepository.findByCode(input.code);
      if (dup && !dup.deletedAt && dup.id !== id) throw new HttpError(422, "EMPLOYEE_CODE_EXISTS", "Mã nhân viên đã tồn tại");
    }
    return employeeRepository.update(id, {
      code: input.code,
      fullName: input.fullName,
      jobTitle: input.jobTitle ?? null,
      status: input.status ?? "ACTIVE",
      workUnit: input.workUnit ?? null,
      userId: input.userId ?? null,
    });
  },

  async delete(id: number) {
    const existing = await employeeRepository.findById(id);
    if (!existing || existing.deletedAt) throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "Không tìm thấy nhân viên");
    return employeeRepository.softDelete(id);
  },
};
