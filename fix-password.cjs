const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixPassword() {
  // Test with a fresh hash
  const freshHash = await bcrypt.hash('123456', 10);
  console.log('Fresh hash:', freshHash);
  
  const match1 = await bcrypt.compare('123456', freshHash);
  console.log('Fresh hash match:', match1);
  
  // Update user with fresh hash
  const user = await prisma.users.update({
    where: { username: 'admin' },
    data: { password: freshHash }
  });
  console.log('Updated user:', user);
  
  // Test again
  const match2 = await bcrypt.compare('123456', user.password);
  console.log('Updated hash match:', match2);
  
  await prisma.$disconnect();
}

fixPassword().catch(e => { console.error(e); process.exit(1); });