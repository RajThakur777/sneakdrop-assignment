const request = require('supertest');
const app = require('./backend/server');

async function run() {
    // 1. Buy 20 pairs
    for (let i = 1; i <= 20; i++) {
        await request(app).post('/api/buy').send({ userId: `u${i}` });
    }
    
    // 2. User 21 enters waitlist
    await request(app).post('/api/buy').send({ userId: 'u21' });
    
    let res = await request(app).get('/api/status?userId=u21');
    console.log('u21 status before expiry:', res.body.waitlistPosition);
    
    // 3. User 22 enters waitlist
    await request(app).post('/api/buy').send({ userId: 'u22' });

    let res2 = await request(app).get('/api/status?userId=u22');
    console.log('u22 status before expiry:', res2.body.waitlistPosition);

    console.log('All tests passed if above are 1 and 2');
}

run();
