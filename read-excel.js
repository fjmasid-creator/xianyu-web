const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\Users\\BHGA\\Desktop\\闲鱼代结账.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Excel总行数:', data.length);
console.log('数据行数(不含表头):', data.length - 2);
console.log('前10行:');
for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(i, data[i]);
}
