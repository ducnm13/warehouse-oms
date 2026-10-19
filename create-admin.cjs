const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Tạo/cập nhật tài khoản admin và liên kết vai trò ADMIN trong user_roles.
// Dùng: node create-admin.cjs [username] [password] [fullName]
async function createAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || '123456';
  const fullName = process.argv[4] || 'Administrator';

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.users.upsert({
    where: { username },
    update: {},
    create: { username, password: hashed, role: 'ADMIN', fullName },
  });

  const role = await prisma.roles.findUnique({ where: { code: 'ADMIN' } });
  if (!role) {
    throw new Error(
      'Chưa có vai trò ADMIN. Hãy khởi động server 1 lần để chạy migration trước.',
    );
  }
  await prisma.user_roles.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(`Đã sẵn sàng tài khoản admin: ${username} (đã gán vai trò ADMIN)`);
  await prisma.$disconnect();
}

createAdmin().catch(e => {
  console.error(e);
  process.exit(1);
});
