const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://xianyu_user:xianyu123@cluster0.go2qogg.mongodb.net/?appName=Cluster0&retryWrites=true&w=majority';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '112211';

let db, usersCollection, dataCollection;
let dbConnected = false;

async function connectDB() {
    try {
        const client = new MongoClient(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1,
            connectTimeoutMS: 10000,
            retryWrites: true,
            retryReads: true,
        });
        
        await client.connect();
        await client.db('admin').command({ ping: 1 });
        
        db = client.db('xianyu_db');
        usersCollection = db.collection('users');
        dataCollection = db.collection('records');
        
        await usersCollection.createIndex({ username: 1 }, { unique: true });
        
        let admin = await usersCollection.findOne({ username: ADMIN_USERNAME });
        if (!admin) {
            await usersCollection.insertOne({
                username: ADMIN_USERNAME,
                password: ADMIN_PASSWORD,
                isAdmin: true,
                createdAt: new Date()
            });
        } else if (!admin.isAdmin) {
            await usersCollection.updateOne({ username: ADMIN_USERNAME }, { $set: { isAdmin: true } });
        }
        
        dbConnected = true;
        console.log('MongoDB connected');
        
        setInterval(async () => {
            try {
                await client.db('admin').command({ ping: 1 });
            } catch (e) {
                dbConnected = false;
                connectDB();
            }
        }, 60000);
        
    } catch (err) {
        console.error('MongoDB error:', err.message);
        dbConnected = false;
        setTimeout(connectDB, 30000);
    }
}

connectDB();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    const fs = require('fs');
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(fs.existsSync(htmlPath) ? htmlPath : '<h1>闲鱼代结账</h1>');
});

app.post('/api/login', async (req, res) => {
    try {
        if (!dbConnected) return res.json({ success: false, error: '数据库未连接' });
        
        const { username, password } = req.body;
        const user = await usersCollection.findOne({ username, password });
        if (!user) return res.json({ success: false, error: '用户名或密码错误' });
        
        res.json({ success: true, user: { id: user._id.toString(), username: user.username, isAdmin: user.isAdmin || false } });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post('/api/createuser', async (req, res) => {
    try {
        if (!dbConnected) return res.json({ success: false, error: '数据库未连接' });
        
        const { adminUsername, adminPassword, newUsername, newPassword } = req.body;
        const admin = await usersCollection.findOne({ username: adminUsername, password: adminPassword, isAdmin: true });
        if (!admin) return res.json({ success: false, error: '主账号验证失败' });
        
        const existing = await usersCollection.findOne({ username: newUsername });
        if (existing) return res.json({ success: false, error: '用户名已存在' });
        
        await usersCollection.insertOne({ username: newUsername, password: newPassword, isAdmin: false, createdBy: adminUsername, createdAt: new Date() });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        if (!dbConnected) return res.json({ success: false, error: '数据库未连接' });
        
        const admin = await usersCollection.findOne({ _id: new ObjectId(req.query.adminId), isAdmin: true });
        if (!admin) return res.json({ success: false, error: '无权访问' });
        
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
        res.json({ success: true, users });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post('/api/deleteuser', async (req, res) => {
    try {
        if (!dbConnected) return res.json({ success: false, error: '数据库未连接' });
        
        const { adminId, targetUserId } = req.body;
        const admin = await usersCollection.findOne({ _id: new ObjectId(adminId), isAdmin: true });
        if (!admin) return res.json({ success: false, error: '无权操作' });
        
        const target = await usersCollection.findOne({ _id: new ObjectId(targetUserId) });
        if (target && target.isAdmin) return res.json({ success: false, error: '不能删除主账号' });
        
        await usersCollection.deleteOne({ _id: new ObjectId(targetUserId) });
        await dataCollection.deleteMany({ userId: targetUserId });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/api/userdata', async (req, res) => {
    try {
        if (!dbConnected) return res.json({ success: false, error: '数据库未连接' });
        
        const adminId = req.query.adminId;
        const targetUserId = req.query.targetUserId;
        
        const admin = await usersCollection.findOne({ _id: new ObjectId(adminId), isAdmin: true });
        if (!admin) return res.json({ success: false, error: '无权访问' });
        
        const records = await dataCollection.find({ userId: targetUserId }).sort({ date: -1 }).toArray();
        
        const excelData = [
            ['收手续费', '', '', '', '', '', '', '', '', '免手续费'],
            ['日期', '闲鱼付款金额', '1.6的手续费', '支付宝到账', '盒马实际支付', '最多可退', '盒马会员卡利润', '实际利润', '', '日期', '闲鱼付款金额', '盒马实际支付', '手续费（1.6%）', '支付宝到账', '最多可退', '利润']
        ];
        
        const feeR = records.filter(r => r.type === 'fee');
        const nofeeR = records.filter(r => r.type === 'nofee');
        const maxRows = Math.max(feeR.length, nofeeR.length);
        
        for (let i = 0; i < maxRows; i++) {
            const fee = feeR[i] || {};
            const nofee = nofeeR[i] || {};
            excelData.push([
                fee.date || '', fee.xianyuAmount || '', fee.fee || '', fee.alipay || '', fee.hemaActual || '', fee.refund || '', '', fee.actualProfit || '',
                '', nofee.date || '', nofee.xianyuAmount || '', nofee.hemaActual || '', nofee.fee || '', nofee.alipay || '', nofee.refund || '', nofee.actualProfit || ''
            ]);
        }
        
        res.json({ success: true, data: excelData });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/api/data', async (req, res) => {
    try {
        if (!dbConnected) return res.json({ success: false, error: '数据库未连接' });
        if (!req.query.userId) return res.json({ success: false, error: '未登录' });
        
        const records = await dataCollection.find({ userId: req.query.userId }).sort({ date: -1 }).toArray();
        
        const excelData = [
            ['收手续费', '', '', '', '', '', '', '', '', '免手续费'],
            ['日期', '闲鱼付款金额', '1.6的手续费', '支付宝到账', '盒马实际支付', '最多可退', '盒马会员卡利润', '实际利润', '', '日期', '闲鱼付款金额', '盒马实际支付', '手续费（1.6%）', '支付宝到账', '最多可退', '利润']
        ];
        
        const feeR = records.filter(r => r.type === 'fee');
        const nofeeR = records.filter(r => r.type === 'nofee');
        const maxRows = Math.max(feeR.length, nofeeR.length);
        
        for (let i = 0; i < maxRows; i++) {
            const fee = feeR[i] || {};
            const nofee = nofeeR[i] || {};
            excelData.push([
                fee.date || '', fee.xianyuAmount || '', fee.fee || '', fee.alipay || '', fee.hemaActual || '', fee.refund || '', '', fee.actualProfit || '',
                '', nofee.date || '', nofee.xianyuAmount || '', nofee.hemaActual || '', nofee.fee || '', nofee.alipay || '', nofee.refund || '', nofee.actualProfit || ''
            ]);
        }
        
        res.json({ success: true, data: excelData });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.post('/api/save', async (req, res) => {
    try {
        if (!dbConnected) return res.json({ success: false, error: '数据库未连接' });
        if (!req.body.userId) return res.json({ success: false, error: '未登录' });
        
        await dataCollection.deleteMany({ userId: req.body.userId });
        if (req.body.records && req.body.records.length > 0) {
            const docs = req.body.records.map(r => ({ userId: req.body.userId, ...r }));
            await dataCollection.insertMany(docs);
        }
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.get('/api/export', async (req, res) => {
    try {
        let records = [];
        if (dbConnected && req.query.userId) {
            records = await dataCollection.find({ userId: req.query.userId }).sort({ date: -1 }).toArray();
        }
        
        const excelData = [
            ['收手续费', '', '', '', '', '', '', '', '', '免手续费'],
            ['日期', '闲鱼付款金额', '1.6的手续费', '支付宝到账', '盒马实际支付', '最多可退', '盒马会员卡利润', '实际利润', '', '日期', '闲鱼付款金额', '盒马实际支付', '手续费（1.6%）', '支付宝到账', '最多可退', '利润']
        ];
        
        const feeR = records.filter(r => r.type === 'fee');
        const nofeeR = records.filter(r => r.type === 'nofee');
        const maxRows = Math.max(feeR.length, nofeeR.length);
        
        for (let i = 0; i < maxRows; i++) {
            const fee = feeR[i] || {};
            const nofee = nofeeR[i] || {};
            excelData.push([
                fee.date || '', fee.xianyuAmount || '', fee.fee || '', fee.alipay || '', fee.hemaActual || '', fee.refund || '', '', fee.actualProfit || '',
                '', nofee.date || '', nofee.xianyuAmount || '', nofee.hemaActual || '', nofee.fee || '', nofee.alipay || '', nofee.refund || '', nofee.actualProfit || ''
            ]);
        }
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(excelData), 'Sheet1');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        res.setHeader('Content-Disposition', `attachment; filename="xianyu_${Date.now()}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).send('Export failed: ' + err.message);
    }
});

module.exports = app;
