const fs = require('fs');
const content = fs.readFileSync('D:/warehouse-oms/src/pages/Customers.tsx', 'utf8');
let openDivs = 0;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (c === '<') {
    if (content[i+1] === '/') {
      const tagEnd = content.indexOf('>', i);
      const tag = content.substring(i+2, tagEnd);
      if (tag.startsWith('div')) {
        openDivs--;
        if (openDivs < 0) {
          console.log('Extra </div> at position', i);
          console.log('Context:', content.substring(i-50, i+50));
          break;
        }
      }
    } else if (content[i+1] !== '?' && content[i+1] !== '!') {
      const tagEnd = content.indexOf('>', i);
      const tag = content.substring(i+1, tagEnd);
      if (tag.startsWith('div')) openDivs++;
    }
  }
}
console.log('Final openDivs:', openDivs);