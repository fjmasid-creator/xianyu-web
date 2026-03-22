const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();

// MongoDB 配置
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://xianyu_user:xianyu123@cluster0.go2qogg.mongodb.net/?appName=Cluster0';
const DB_NAME = 'xianyu_db';
const COLLECTION_NAME = 'data';

let db;
let collection;

// 连接到 MongoDB
async function connectDB() {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        collection = db.collection(COLLECTION_NAME);
        console.log('Connected to MongoDB');
        
        // 如果没有数据，初始化默认数据
        const count = await collection.countDocuments();
        if (count === 0) {
            // 加载 Excel 数据
            try {
                const fs = require('fs');
                const EXCEL_FILE = path.join(__dirname, 'data', '闲鱼代结账.xlsx');
                if (fs.existsSync(EXCEL_FILE)) {
                    const workbook = XLSX.readFile(EXCEL_FILE);
                    const sheetName = workbook.SheetNames[0];
                    const excelData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                    await collection.insertOne({ name: 'xianyu_data', data: excelData, updatedAt: new Date() });
                    console.log('Excel data loaded to MongoDB');
                }
            } catch (err) {
                console.log('Using default data');
            }
        }
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}
connectDB();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 首页
app.get('/', (req, res) => {
    const fs = require('fs');
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.send('<h1>闲鱼代结账</h1><p>Loading...</p>');
    }
});

// 获取数据
app.get('/api/data', async (req, res) => {
    try {
        if (collection) {
            const doc = await collection.findOne({ name: 'xianyu_data' });
            if (doc) {
                res.json({ success: true, data: doc.data });
                return;
            }
        }
        res.json({ success: true, data: [] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 保存数据
app.post('/api/save', async (req, res) => {
    try {
        const { data } = req.body;
        if (collection) {
            await collection.updateOne(
                { name: 'xianyu_data' },
                { $set: { data: data, updatedAt: new Date() } },
                { upsert: true }
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 导出Excel
app.get('/api/export', async (req, res) => {
    try {
        let data = [];
        if (collection) {
            const doc = await collection.findOne({ name: 'xianyu_data' });
            if (doc) data = doc.data;
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(data);
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

module.exports = app;
