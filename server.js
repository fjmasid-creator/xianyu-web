const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();

// MongoDB 配置
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://xianyu_user:xianyu123@cluster0.go2qogg.mongodb.net/?appName=Cluster0&retryWrites=true&w=majority';
const DB_NAME = 'xianyu_db';
const COLLECTION_NAME = 'data';

// 全局缓存
let cachedClient = null;
let cachedDb = null;
let cachedCollection = null;

// 连接到 MongoDB - 改进版，带重试
async function connectDB() {
    // 如果已经有连接，直接返回
    if (cachedCollection) {
        return cachedCollection;
    }
    
    try {
        const client = new MongoClient(MONGO_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        
        // 测试连接
        await collection ping();
        console.log('MongoDB connected successfully');
        
        cachedClient = client;
        cachedDb = db;
        cachedCollection = collection;
        
        // 如果没有数据，初始化默认数据
        const count = await collection.countDocuments();
        if (count === 0) {
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
                console.log('Using empty data');
            }
        }
        
        return collection;
    } catch (err) {
        console.error('MongoDB connection error:', err);
        throw err;
    }
}

// 确保连接可用
async function getCollection() {
    if (!cachedCollection) {
        await connectDB();
    }
    return cachedCollection;
}

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
        const collection = await getCollection();
        const doc = await collection.findOne({ name: 'xianyu_data' });
        if (doc) {
            res.json({ success: true, data: doc.data });
        } else {
            res.json({ success: true, data: [] });
        }
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 保存数据
app.post('/api/save', async (req, res) => {
    try {
        const { data } = req.body;
        const collection = await getCollection();
        
        const result = await collection.updateOne(
            { name: 'xianyu_data' },
            { $set: { data: data, updatedAt: new Date() } },
            { upsert: true }
        );
        
        console.log('Data saved, upserted:', result.upsertedId);
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving data:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 导出Excel
app.get('/api/export', async (req, res) => {
    try {
        const collection = await getCollection();
        const doc = await collection.findOne({ name: 'xianyu_data' });
        const data = doc ? doc.data : [];
        
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, worksheet, 'Sheet1');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        res.setHeader('Content-Disposition', 'attachment; filename=闲鱼代结账.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        console.error('Error exporting:', err);
        res.status(500).send(err.message);
    }
});

module.exports = app;
