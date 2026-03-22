const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://xianyu_user:xianyu123@cluster0.go2qogg.mongodb.net/?appName=Cluster0';

async function checkData() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('xianyu_db');
        
        const records = await db.collection('records').find({}).toArray();
        console.log('Total records:', records.length);
        
        const userIds = [...new Set(records.map(r => r.userId))];
        console.log('User IDs:', userIds);
        
        if (records.length > 0) {
            console.log('First record:', JSON.stringify(records[0], null, 2));
        }
        
        const users = await db.collection('users').find({}).toArray();
        console.log('Total users:', users.length);
        
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await client.close();
    }
}

checkData();
