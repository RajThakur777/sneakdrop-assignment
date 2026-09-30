const request = require('supertest');
const app = require('../backend/server');

describe('Sneaker Drop API', () => {
    // Note: State is shared across tests because it's kept in memory in server.js.
    // In a real app we'd reset the database before each test.

    let user1OrderId = null;

    it('should show the main page (static HTML)', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Sneaker Drop');
    });

    it('should allow a user to buy if stock is available', async () => {
        const res = await request(app)
            .post('/api/buy')
            .send({ userId: 'test_user_1' });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('orderId');
        expect(res.body.message).toEqual('Pair held for 5 minutes');
        user1OrderId = res.body.orderId;
    });

    it('should not allow the same user to hold multiple pairs at once', async () => {
        const res = await request(app)
            .post('/api/buy')
            .send({ userId: 'test_user_1' });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toEqual('You already have a pair on hold');
    });

    it('should process successful payment', async () => {
        const res = await request(app)
            .post('/api/payment-webhook')
            .send({ orderId: user1OrderId, status: 'succeeded' });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual('Payment applied successfully');
    });

    it('should not process the same payment twice', async () => {
        const res = await request(app)
            .post('/api/payment-webhook')
            .send({ orderId: user1OrderId, status: 'succeeded' });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toEqual('Payment already processed');
    });

    it('should allow user to buy a second pair', async () => {
        const res = await request(app)
            .post('/api/buy')
            .send({ userId: 'test_user_1' });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('orderId');
        
        const resPay = await request(app)
            .post('/api/payment-webhook')
            .send({ orderId: res.body.orderId, status: 'succeeded' });
        
        expect(resPay.statusCode).toEqual(200);
    });

    it('should not allow user to buy a third pair', async () => {
        const res = await request(app)
            .post('/api/buy')
            .send({ userId: 'test_user_1' });
        
        expect(res.statusCode).toEqual(400);
        expect(res.body.error).toEqual('You can only buy a maximum of 2 pairs');
    });

    it('should add to waitlist when stock is depleted', async () => {
        // Stock started at 20. user1 bought 2. Left: 18.
        for (let i = 2; i <= 19; i++) {
            await request(app).post('/api/buy').send({ userId: `test_user_${i}` });
        }
        
        // Stock should now be 0.
        // Buy for user 20 - should be waitlisted
        const resWaitlist = await request(app)
            .post('/api/buy')
            .send({ userId: 'test_user_20' });

        expect(resWaitlist.statusCode).toEqual(200);
        expect(resWaitlist.body.message).toEqual('Added to waitlist');
    });
});
