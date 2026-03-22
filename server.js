const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel 环境使用内存存储
let inMemoryData = null;

// 尝试加载Excel文件
let workbook = null;
try {
    const EXCEL_FILE = path.join(__dirname, 'data', '闲鱼代结账.xlsx');
    const fs = require('fs');
    if (fs.existsSync(EXCEL_FILE)) {
        workbook = XLSX.readFile(EXCEL_FILE);
        const sheetName = workbook.SheetNames[0];
        inMemoryData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    }
} catch (err) {
    console.log('Could not load Excel file:', err.message);
}

// 如果没有数据，使用示例数据
if (!inMemoryData) {
    inMemoryData = [
        ['收手续费', '', '', '', '', '', '', '', '', '免手续费'],
        ['日期', '闲鱼付款金额', '1.6的手续费', '支付宝到账', '盒马实际支付', '最多可退', '盒马会员卡利润', '实际利润', '', '日期', '闲鱼付款金额', '盒马实际支付', '手续费（1.6%）', '支付宝到账', '最多可退', '利润'],
        ['公式', 100, 1.6, 98.4, 88, 10.4, 3.52, 3.52, '', '公式', 100, 88, 1.6, 98.4, 12, 1.92]
    ];
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 获取所有数据
app.get('/api/data', (req, res) => {
    res.json({ success: true, data: inMemoryData });
});

// 保存数据（Vercel服务器端不会永久保存）
app.post('/api/save', (req, res) => {
    try {
        const { data } = req.body;
        inMemoryData = data;
        
        // 生成Excel供下载
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, worksheet, 'Sheet1');
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        res.json({ success: true, buffer: excelBuffer.toString('base64') });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 导出Excel
app.get('/api/export', (req, res) => {
    try {
        const worksheet = XLSX.utils.aoa_to_sheet(inMemoryData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, worksheet, 'Sheet1');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        res.setHeader('Content-Disposition', 'attachment; filename=闲鱼代结账.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Vercel handler
module.exports = app;
