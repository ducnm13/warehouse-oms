const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.users.findUnique({
    where: { username: 'admin' }
  });
  console.log('User:', user);
  
  if (user) {
    const match = await bcrypt.compare('123456', user.password);
    console.log('Password match:', match);
  }
  
  await prisma.$disconnect();
}

checkUser().catch(e => { console.error(e); process.exit(1); });