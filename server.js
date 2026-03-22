const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const EXCEL_FILE = path.join(__dirname, 'data', '闲鱼代结账.xlsx');

// 确保data目录存在
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    // 复制原始Excel文件
    const origFile = 'C:/Users/BHGA/Desktop/闲鱼代结账.xlsx';
    if (fs.existsSync(origFile)) {
        fs.copyFileSync(origFile, EXCEL_FILE);
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 获取所有数据
app.get('/api/data', (req, res) => {
    try {
        const workbook = XLSX.readFile(EXCEL_FILE);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 保存数据
app.post('/api/save', (req, res) => {
    try {
        const { data } = req.body;
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        XLSX.writeFile(workbook, EXCEL_FILE);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 导出Excel
app.get('/api/export', (req, res) => {
    res.download(EXCEL_FILE);
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
