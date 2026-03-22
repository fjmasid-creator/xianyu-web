const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://xianyu_user:xianyu123@cluster0.go2qogg.mongodb.net/?appName=Cluster0';

async function migrateData() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('xianyu_db');
        
        const oldUserId = '69bfc4ab7f3c23475215d11d';
        const adminId = '69bfc5f94d8b1ac3697653c3';
        
        const result = await db.collection('records').updateMany(
            { userId: oldUserId },
            { $set: { userId: adminId } }
        );
        
        console.log('迁移了', result.modifiedCount, '条记录');
        
        // 验证
        const adminRecords = await db.collection('records').find({ userId: adminId }).toArray();
        console.log('admin现在有', adminRecords.length, '条记录');
        
    } catch (e) {
        console.error('错误:', e.message);
    } finally {
        await client.close();
    }
}

migrateData();
