import bcrypt from "bcryptjs";
import { prisma } from "@challenge/database";

async function main() {
  const role = await prisma.roles.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const username = `ui_check_admin_${Date.now()}`;
  const user = await prisma.users.create({
    data: {
      username,
      role: "ADMIN",
      fullName: "UI Check Admin",
      password: await bcrypt.hash("UiTest!12345", 10),
    },
  });
  await prisma.user_roles.create({ data: { userId: user.id, roleId: role.id } });
  console.log(JSON.stringify({ id: user.id, username, password: "UiTest!12345" }));
}

main().finally(() => prisma.$disconnect());
