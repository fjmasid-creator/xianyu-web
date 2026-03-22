const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\Users\\BHGA\\Desktop\\闲鱼代结账.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('所有非空数据行:');
for (let i = 2; i < data.length; i++) {
    const row = data[i];
    // 检查是否有实际数据（非0，非空）
    const hasFeeData = row[1] && row[1] !== 0;
    const hasNofeeData = row[10] && row[10] !== 0;
    
    if (hasFeeData || hasNofeeData) {
        console.log(`行${i}:`, JSON.stringify(row));
    }
}
