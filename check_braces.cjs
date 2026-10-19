const fs = require('fs');
const content = fs.readFileSync('D:/warehouse-oms/src/pages/Customers.tsx', 'utf8');
let openBraces = 0;
let inJSX = false;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (c === '<') {
    if (content[i+1] !== '/' && content[i+1] !== '?' && content[i+1] !== '!') {
      inJSX = true;
    } else if (content[i+1] === '/') {
      inJSX = false;
    }
  }
  if (c === '>' && inJSX) {
    inJSX = false;
  }
  if (!inJSX) {
    if (c === '{') openBraces++;
    else if (c === '}') openBraces--;
  }
  if (openBraces < 0) {
    console.log('Extra } at position', i);
    console.log('Context:', content.substring(i-30, i+30));
    break;
  }
}
console.log('Final openBraces:', openBraces);