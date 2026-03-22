const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://xianyu_user:xianyu123@cluster0.go2qogg.mongodb.net/?appName=Cluster0';

async function checkData() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('xianyu_db');
        
        const adminId = '69bfc5f94d8b1ac3697653c3';
        
        const records = await db.collection('records').find({ userId: adminId }).toArray();
        console.log('admin记录数:', records.length);
        console.log(JSON.stringify(records, null, 2));
        
    } catch (e) {
        console.error('错误:', e.message);
    } finally {
        await client.close();
    }
}

checkData();
