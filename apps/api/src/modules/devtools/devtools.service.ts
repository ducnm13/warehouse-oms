import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@challenge/database";
import { HttpError } from "../../common/http-error";

const execFileAsync = promisify(execFile);
const MAX_QUERY_ROWS = 1000;

export type DevScript = {
  id: string;
  label: string;
  description: string;
  command: string;
  args: string[];
  dangerous: boolean;
  confirmPhrase?: string;
  timeoutMs: number;
};

const SCRIPTS: DevScript[] = [
  {
    id: "reset-operational-dry-run",
    label: "Kiểm tra dữ liệu nghiệp vụ",
    description: "Chạy thử script reset dữ liệu nghiệp vụ (chỉ đếm, không xóa).",
    command: "npx",
    args: ["tsx", "scripts/reset-operational-data.ts"],
    dangerous: false,
    timeoutMs: 120_000,
  },
  {
    id: "reset-operational",
    label: "Xóa dữ liệu nghiệp vụ",
    description: "Xóa đơn bán/mua, phiếu kho, công nợ, sản xuất… Giữ danh mục, khách hàng, nhà cung cấp, tồn đầu kỳ.",
    command: "npx",
    args: ["tsx", "scripts/reset-operational-data.ts", "--yes"],
    dangerous: true,
    confirmPhrase: "XOA DU LIEU",
    timeoutMs: 300_000,
  },
  {
    id: "reset-sales",
    label: "Xóa toàn bộ dữ liệu bán hàng",
    description: "Chạy script reset-sales-data.ts (xóa cả tồn đầu kỳ và tồn kho hiện tại).",
    command: "npx",
    args: ["tsx", "scripts/reset-sales-data.ts"],
    dangerous: true,
    confirmPhrase: "XOA DU LIEU BAN HANG",
    timeoutMs: 300_000,
  },
  {
    id: "dump-database",
    label: "Dump cơ sở dữ liệu",
    description: "Xuất toàn bộ cấu trúc và dữ liệu ra file .sql trong thư mục backups/.",
    command: "npx",
    args: ["tsx", "scripts/dump-database.ts"],
    dangerous: false,
    timeoutMs: 600_000,
  },
  {
    id: "typecheck",
    label: "Kiểm tra kiểu TypeScript",
    description: "Chạy npm run typecheck trên toàn bộ workspace.",
    command: "npm",
    args: ["run", "typecheck"],
    dangerous: false,
    timeoutMs: 300_000,
  },
  {
    id: "build",
    label: "Build production",
    description: "Chạy npm run build (tsc + vite build).",
    command: "npm",
    args: ["run", "build"],
    dangerous: true,
    confirmPhrase: "BUILD",
    timeoutMs: 600_000,
  },
  {
    id: "prisma-push",
    label: "Đồng bộ schema Prisma",
    description: "Chạy prisma db push — có thể thay đổi cấu trúc CSDL.",
    command: "npm",
    args: ["run", "prisma:push"],
    dangerous: true,
    confirmPhrase: "DB PUSH",
    timeoutMs: 300_000,
  },
];

let activeRun: { id: string; startedAt: string } | null = null;

const toNumber = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const sanitize = (value: any): any => {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(value)
      : value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object") {
    if (typeof value.toJSON === "function") {
      try {
        return sanitize(value.toJSON());
      } catch {
        return String(value);
      }
    }
    const result: Record<string, any> = {};
    for (const [key, item] of Object.entries(value)) result[key] = sanitize(item);
    return result;
  }
  return value;
};

const projectRoot = () => process.cwd();

async function getDiskUsage() {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress",
        ],
        { timeout: 4_000, maxBuffer: 1024 * 1024, windowsHide: true },
      );
      const parsed = JSON.parse(stdout.trim());
      const disks = (Array.isArray(parsed) ? parsed : [parsed]).map((disk: any) => ({
        path: String(disk.DeviceID || ""),
        totalBytes: toNumber(disk.Size),
        freeBytes: toNumber(disk.FreeSpace),
        usedBytes: Math.max(0, toNumber(disk.Size) - toNumber(disk.FreeSpace)),
      }));
      return disks;
    }
    const { stdout } = await execFileAsync("df", ["-kP", "/"], { timeout: 4_000 });
    const line = stdout.trim().split(/\r?\n/).pop() || "";
    const parts = line.split(/\s+/);
    const totalBytes = toNumber(parts[1]) * 1024;
    const usedBytes = toNumber(parts[2]) * 1024;
    const freeBytes = toNumber(parts[3]) * 1024;
    return [{ path: "/", totalBytes, usedBytes, freeBytes }];
  } catch {
    return null;
  }
}

async function getPm2Processes() {
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], {
      timeout: 5_000,
      maxBuffer: 5 * 1024 * 1024,
      windowsHide: true,
      shell: process.platform === "win32",
    });
    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item: any) => ({
      name: item.name,
      pid: item.pid || null,
      status: item.pm2_env?.status || null,
      cpu: toNumber(item.monit?.cpu),
      memoryBytes: toNumber(item.monit?.memory),
      restarts: toNumber(item.pm2_env?.restart_time),
      uptimeMs: item.pm2_env?.pm_uptime ? Math.max(0, Date.now() - toNumber(item.pm2_env.pm_uptime)) : 0,
      mode: item.pm2_env?.exec_mode || null,
      version: item.pm2_env?.version || null,
    }));
  } catch {
    return null;
  }
}

async function getGitInfo() {
  try {
    const [head, branch, subject] = await Promise.all([
      execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: projectRoot(), timeout: 3_000 }),
      execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: projectRoot(), timeout: 3_000 }),
      execFileAsync("git", ["log", "-1", "--pretty=%s"], { cwd: projectRoot(), timeout: 3_000 }),
    ]);
    return {
      commit: head.stdout.trim(),
      branch: branch.stdout.trim(),
      subject: subject.stdout.trim(),
    };
  } catch {
    return null;
  }
}

async function getDatabaseOverview() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT DATABASE() AS databaseName, VERSION() AS version, NOW() AS serverTime,
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) AS tableCount,
      (SELECT COALESCE(SUM(data_length + index_length), 0) FROM information_schema.tables WHERE table_schema = DATABASE()) AS sizeBytes`,
  );
  const row = rows[0] || {};
  return {
    databaseName: row.databaseName || null,
    version: row.version || null,
    serverTime: row.serverTime instanceof Date ? row.serverTime.toISOString() : row.serverTime || null,
    tableCount: toNumber(row.tableCount),
    sizeBytes: toNumber(row.sizeBytes),
    host: process.env.DB_HOST || process.env.HOST || "localhost",
    port: toNumber(process.env.DB_PORT || 3306),
  };
}

export const devtoolsService = {
  enabled() {
    return process.env.DEV_TOOLS_ENABLED !== "false";
  },

  async overview() {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const processMemory = process.memoryUsage();
    const [database, disks, pm2, git] = await Promise.all([
      getDatabaseOverview(),
      getDiskUsage(),
      getPm2Processes(),
      getGitInfo(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      projectRoot: projectRoot(),
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: process.env.NODE_ENV || "development",
        uptimeSeconds: Math.round(process.uptime()),
        rssBytes: processMemory.rss,
        heapUsedBytes: processMemory.heapUsed,
        heapTotalBytes: processMemory.heapTotal,
      },
      host: {
        hostname: os.hostname(),
        osType: os.type(),
        osRelease: os.release(),
        platform: os.platform(),
        arch: os.arch(),
        uptimeSeconds: Math.round(os.uptime()),
        cpuModel: cpus[0]?.model?.trim() || null,
        cpuCount: cpus.length,
        loadAverage: os.loadavg(),
        totalMemoryBytes: totalMemory,
        freeMemoryBytes: freeMemory,
        usedMemoryBytes: totalMemory - freeMemory,
      },
      database,
      disks,
      pm2,
      git,
    };
  },

  async tables() {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_ROWS AS approxRows,
        DATA_LENGTH AS dataBytes, INDEX_LENGTH AS indexBytes, TABLE_COLLATION AS collation
      FROM information_schema.tables
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME`,
    );
    return rows.map(row => ({
      name: String(row.name),
      engine: row.engine || null,
      approxRows: toNumber(row.approxRows),
      dataBytes: toNumber(row.dataBytes),
      indexBytes: toNumber(row.indexBytes),
      collation: row.collation || null,
    }));
  },

  async query(sql: string) {
    const trimmed = String(sql || "").trim();
    if (!trimmed) throw new HttpError(400, "SQL_REQUIRED", "Vui lòng nhập câu lệnh SQL");
    const statement = trimmed.replace(/;+\s*$/, "").trim();
    if (statement.includes(";")) {
      throw new HttpError(400, "MULTIPLE_STATEMENTS", "Chỉ cho phép một câu lệnh mỗi lần chạy");
    }
    if (!/^(select|show|describe|desc|explain)\b/i.test(statement)) {
      throw new HttpError(400, "READ_ONLY_ONLY", "Chỉ cho phép truy vấn đọc dữ liệu (SELECT/SHOW/DESCRIBE/EXPLAIN)");
    }
    if (/^explain\s+analyze\b/i.test(statement)) {
      throw new HttpError(400, "READ_ONLY_ONLY", "Không hỗ trợ EXPLAIN ANALYZE trong chế độ chỉ đọc");
    }
    if (/\binto\s+(out|dump)file\b/i.test(statement) || /\bfor\s+update\b/i.test(statement) ||
        /\block\s+in\s+share\s+mode\b/i.test(statement) || /\bload_file\s*\(/i.test(statement) ||
        /\bsleep\s*\(/i.test(statement) || /\bbenchmark\s*\(/i.test(statement)) {
      throw new HttpError(400, "UNSAFE_QUERY", "Câu lệnh chứa thao tác không được phép");
    }

    const startedAt = Date.now();
    const rows = await prisma.$transaction(async tx => {
      try {
        await tx.$executeRawUnsafe("SET SESSION MAX_EXECUTION_TIME=15000");
      } catch {
        // MySQL cũ có thể không hỗ trợ; vẫn tiếp tục chạy truy vấn.
      }
      return tx.$queryRawUnsafe<any[]>(statement) as Promise<any[]>;
    }, { timeout: 20_000, maxWait: 5_000 });

    const durationMs = Date.now() - startedAt;
    const list = Array.isArray(rows) ? rows : [rows];
    const columns = list.length ? Object.keys(list[0]) : [];
    return {
      columns,
      rows: sanitize(list.slice(0, MAX_QUERY_ROWS)),
      rowCount: list.length,
      truncated: list.length > MAX_QUERY_ROWS,
      durationMs,
    };
  },

  scripts() {
    return SCRIPTS.map(script => ({
      id: script.id,
      label: script.label,
      description: script.description,
      dangerous: script.dangerous,
      confirmPhrase: script.confirmPhrase || null,
      timeoutMs: script.timeoutMs,
      command: [script.command, ...script.args].join(" "),
    }));
  },

  activeRun() {
    return activeRun;
  },

  async runScript(id: string, userId: number, username: string, confirm?: string) {
    const script = SCRIPTS.find(item => item.id === id);
    if (!script) throw new HttpError(404, "SCRIPT_NOT_FOUND", "Không tìm thấy script");
    if (activeRun) {
      throw new HttpError(409, "SCRIPT_RUNNING", `Script "${activeRun.id}" đang chạy, vui lòng đợi`);
    }
    if (script.dangerous && String(confirm || "").trim() !== script.confirmPhrase) {
      throw new HttpError(400, "CONFIRM_REQUIRED", `Nhập chính xác "${script.confirmPhrase}" để xác nhận`);
    }

    activeRun = { id, startedAt: new Date().toISOString() };
    const startedAt = Date.now();
    let output = "";

    const append = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.length > 200_000) output = output.slice(-200_000);
    };

    const result = await new Promise<{ exitCode: number | null; timedOut: boolean }>(resolve => {
      let timedOut = false;
      const child = spawn(script.command, script.args, {
        cwd: projectRoot(),
        env: process.env,
        shell: process.platform === "win32",
        windowsHide: true,
      });
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          if (process.platform === "win32" && child.pid) {
            execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }, () => {});
          } else {
            child.kill("SIGKILL");
          }
        } catch {
          child.kill();
        }
      }, script.timeoutMs);

      child.stdout?.on("data", append);
      child.stderr?.on("data", append);
      child.on("error", error => {
        append(`\n${error.message}\n`);
      });
      child.on("close", code => {
        clearTimeout(timer);
        resolve({ exitCode: code, timedOut });
      });
    });

    const durationMs = Date.now() - startedAt;
    activeRun = null;
    void prisma.audit_logs.create({
      data: {
        action: "Chạy script dev",
        details: `${script.id} · exit ${result.exitCode ?? "-"} · ${Math.round(durationMs / 1000)}s`,
        userId,
        userName: username,
        createdAt: new Date().toISOString(),
      },
    }).catch(() => {});

    return {
      scriptId: script.id,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs,
      output: output.trim() || "(không có output)",
    };
  },

};
