const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\Users\\BHGA\\Desktop\\闲鱼代结账.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

let feeCount = 0;
let nofeeCount = 0;

for (let i = 2; i < data.length; i++) {
    const row = data[i];
    // 检查收手续费列
    if (row[1] && typeof row[1] === 'number' && row[1] > 0) {
        feeCount++;
    }
    // 检查免手续费列
    if (row[10] && typeof row[10] === 'number' && row[10] > 0) {
        nofeeCount++;
    }
}

console.log('收手续费记录数:', feeCount);
console.log('免手续费记录数:', nofeeCount);
console.log('总记录数:', feeCount + nofeeCount);

// 显示前几条有数据的记录
console.log('\n前5条收手续费记录:');
for (let i = 2; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (row[1] && typeof row[1] === 'number' && row[1] > 0) {
        console.log(`  日期:${row[0]}, 闲鱼:${row[1]}, 盒马:${row[4]}`);
    }
}
