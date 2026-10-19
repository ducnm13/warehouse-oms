const fs = require('fs');
const path = require('path');
const clientDir = path.join(__dirname, 'node_modules', '.prisma', 'client');
if (fs.existsSync(clientDir)) {
  const files = fs.readdirSync(clientDir);
  files.forEach(f => {
    try { fs.unlinkSync(path.join(clientDir, f)); } catch(e) {}
  });
}
console.log('Cleaned up');