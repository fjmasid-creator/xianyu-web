const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://xianyu_user:xianyu123@cluster0.go2qogg.mongodb.net/?appName=Cluster0';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '112211';

let db;
let usersCollection;
let dataCollection;

async function connectDB() {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db('xianyu_db');
        usersCollection = db.collection('users');
        dataCollection = db.collection('records');
        
        await usersCollection.createIndex({ username: 1 }, { unique: true });
        
        let adminExists = await usersCollection.findOne({ username: ADMIN_USERNAME });
        if (!adminExists) {
            await usersCollection.insertOne({
                username: ADMIN_USERNAME,
                password: ADMIN_PASSWORD,
                isAdmin: true,
                createdAt: new Date()
            });
            console.log('Admin account created');
        } else if (!adminExists.isAdmin) {
            // 确保admin有管理员权限
            await usersCollection.updateOne(
                { username: ADMIN_USERNAME },
                { $set: { isAdmin: true } }
            );
            console.log('Admin isAdmin updated to true');
        }
        
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
    }
}
connectDB();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    const fs = require('fs');
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.send('<h1>闲鱼代结账</h1><p>Loading...</p>');
    }
});

// 登录
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await usersCollection.findOne({ username, password });
        if (!user) {
            return res.json({ success: false, error: '用户名或密码错误' });
        }
        
        res.json({ success: true, user: { id: user._id.toString(), username: user.username, isAdmin: user.isAdmin || false } });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// 主账号添加用户
app.post('/api/createuser', async (req, res) => {
    try {
        const { adminUsername, adminPassword, newUsername, newPassword } = req.body;
        
        const admin = await usersCollection.findOne({ username: adminUsername, password: adminPassword, isAdmin: true });
        if (!admin) {
            return res.json({ success: false, error: '主账号验证失败' });
        }
        
        const existing = await usersCollection.findOne({ username: newUsername });
        if (existing) {
            return res.json({ success: false, error: '用户名已存在' });
        }
        
        await usersCollection.insertOne({
            username: newUsername,
            password: newPassword,
            isAdmin: false,
            createdBy: adminUsername,
            createdAt: new Date()
        });
        
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// 获取用户列表
app.get('/api/users', async (req, res) => {
    try {
        const adminId = req.query.adminId;
        const admin = await usersCollection.findOne({ _id: new ObjectId(adminId), isAdmin: true });
        
        if (!admin) {
            return res.json({ success: false, error: '无权访问' });
        }
        
        const users = await usersCollection.find({}, { projection: { password: 0 } }).toArray();
        res.json({ success: true, users });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// 获取某个用户的数据（主账号可以查看所有用户）
app.get('/api/userdata', async (req, res) => {
    try {
        const adminId = req.query.adminId;
        const targetUserId = req.query.targetUserId;
        
        const admin = await usersCollection.findOne({ _id: new ObjectId(adminId), isAdmin: true });
        
        let userId = targetUserId;
        
        // 如果不是主账号，只能看自己的数据
        if (!admin) {
            userId = adminId;
        }
        
        if (!userId) {
            return res.json({ success: false, error: '未登录' });
        }
        
        const records = await dataCollection.find({ userId }).sort({ date: -1 }).toArray();
        
        const excelData = [
            ['收手续费', '', '', '', '', '', '', '', '', '免手续费'],
            ['日期', '闲鱼付款金额', '1.6的手续费', '支付宝到账', '盒马实际支付', '最多可退', '盒马会员卡利润', '实际利润', '', '日期', '闲鱼付款金额', '盒马实际支付', '手续费（1.6%）', '支付宝到账', '最多可退', '利润']
        ];
        
        const feeRecords = records.filter(r => r.type === 'fee');
        const nofeeRecords = records.filter(r => r.type === 'nofee');
        
        const maxRows = Math.max(feeRecords.length, nofeeRecords.length);
        
        for (let i = 0; i < maxRows; i++) {
            const fee = feeRecords[i] || {};
            const nofee = nofeeRecords[i] || {};
            
            excelData.push([
                fee.date || '', fee.xianyuAmount || '', fee.fee || '', fee.alipay || '', fee.hemaActual || '', fee.refund || '', '', fee.actualProfit || '',
                '',
                nofee.date || '', nofee.xianyuAmount || '', nofee.hemaActual || '', nofee.fee || '', nofee.alipay || '', nofee.refund || '', nofee.actualProfit || ''
            ]);
        }
        
        res.json({ success: true, data: excelData });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// 获取当前用户数据
app.get('/api/data', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.json({ success: false, error: '未登录' });
        }
        
        const records = await dataCollection.find({ userId }).sort({ date: -1 }).toArray();
        
        const excelData = [
            ['收手续费', '', '', '', '', '', '', '', '', '免手续费'],
            ['日期', '闲鱼付款金额', '1.6的手续费', '支付宝到账', '盒马实际支付', '最多可退', '盒马会员卡利润', '实际利润', '', '日期', '闲鱼付款金额', '盒马实际支付', '手续费（1.6%）', '支付宝到账', '最多可退', '利润']
        ];
        
        const feeRecords = records.filter(r => r.type === 'fee');
        const nofeeRecords = records.filter(r => r.type === 'nofee');
        
        const maxRows = Math.max(feeRecords.length, nofeeRecords.length);
        
        for (let i = 0; i < maxRows; i++) {
            const fee = feeRecords[i] || {};
            const nofee = nofeeRecords[i] || {};
            
            excelData.push([
                fee.date || '', fee.xianyuAmount || '', fee.fee || '', fee.alipay || '', fee.hemaActual || '', fee.refund || '', '', fee.actualProfit || '',
                '',
                nofee.date || '', nofee.xianyuAmount || '', nofee.hemaActual || '', nofee.fee || '', nofee.alipay || '', nofee.refund || '', nofee.actualProfit || ''
            ]);
        }
        
        res.json({ success: true, data: excelData });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// 保存数据
app.post('/api/save', async (req, res) => {
    try {
        const { userId, records } = req.body;
        
        if (!userId) {
            return res.json({ success: false, error: '未登录' });
        }
        
        await dataCollection.deleteMany({ userId });
        
        if (records && records.length > 0) {
            const docs = records.map(r => ({
                userId,
                ...r
            }));
            await dataCollection.insertMany(docs);
        }
        
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// 导出Excel
app.get('/api/export', async (req, res) => {
    try {
        const userId = req.query.userId;
        
        let records = [];
        if (userId) {
            records = await dataCollection.find({ userId }).sort({ date: -1 }).toArray();
        }
        
        const excelData = [
            ['收手续费', '', '', '', '', '', '', '', '', '免手续费'],
            ['日期', '闲鱼付款金额', '1.6的手续费', '支付宝到账', '盒马实际支付', '最多可退', '盒马会员卡利润', '实际利润', '', '日期', '闲鱼付款金额', '盒马实际支付', '手续费（1.6%）', '支付宝到账', '最多可退', '利润']
        ];
        
        const feeRecords = records.filter(r => r.type === 'fee');
        const nofeeRecords = records.filter(r => r.type === 'nofee');
        
        const maxRows = Math.max(feeRecords.length, nofeeRecords.length);
        
        for (let i = 0; i < maxRows; i++) {
            const fee = feeRecords[i] || {};
            const nofee = nofeeRecords[i] || {};
            
            excelData.push([
                fee.date || '', fee.xianyuAmount || '', fee.fee || '', fee.alipay || '', fee.hemaActual || '', fee.refund || '', '', fee.actualProfit || '',
                '',
                nofee.date || '', nofee.xianyuAmount || '', nofee.hemaActual || '', nofee.fee || '', nofee.alipay || '', nofee.refund || '', nofee.actualProfit || ''
            ]);
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, worksheet, 'Sheet1');
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        const filename = 'xianyu_' + Date.now() + '.xlsx';
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).send('Export failed: ' + err.message);
    }
});

module.exports = app;
