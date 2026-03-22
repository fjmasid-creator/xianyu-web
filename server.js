const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();

// 内存存储数据
let inMemoryData = [
    ['收手续费', '', '', '', '', '', '', '', '', '免手续费'],
    ['日期', '闲鱼付款金额', '1.6的手续费', '支付宝到账', '盒马实际支付', '最多可退', '盒马会员卡利润', '实际利润', '', '日期', '闲鱼付款金额', '盒马实际支付', '手续费（1.6%）', '支付宝到账', '最多可退', '利润'],
    ['公式', 100, 1.6, 98.4, 88, 10.4, 3.52, 3.52, '', '公式', 100, 88, 1.6, 98.4, 12, 1.92]
];

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 首页
app.get('/', (req, res) => {
    res.send('<h1>闲鱼代结账</h1><p>Loading...</p>');
});

// 获取数据
app.get('/api/data', (req, res) => {
    res.json({ success: true, data: inMemoryData });
});

// 保存数据
app.post('/api/save', (req, res) => {
    try {
        const { data } = req.body;
        inMemoryData = data;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 导出Excel
app.get('/api/export', (req, res) => {
    const worksheet = XLSX.utils.aoa_to_sheet(inMemoryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Sheet1');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    res.setHeader('Content-Disposition', 'attachment; filename=闲鱼代结账.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

module.exports = app;
