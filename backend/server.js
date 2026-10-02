const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

const TOTAL_PAIRS = 2;
const HOLD_DURATION_MS = 15 * 1000; // 15 seconds for demo purposes

let stock = TOTAL_PAIRS;
// holds: Map<userId, { orderId: string, expiresAt: number }>
let holds = new Map();
// purchases: Map<userId, number>
let purchases = new Map();
// waitlist: Array<userId>
let waitlist = [];
// completedOrders: Set<string>
let completedOrders = new Set();

function processExpiredHolds() {
    const now = Date.now();
    for (const [userId, hold] of holds.entries()) {
        if (hold.expiresAt <= now) {
            holds.delete(userId);
            
            if (waitlist.length > 0) {
                const nextUserId = waitlist.shift();
                holds.set(nextUserId, { 
                    orderId: uuidv4(), 
                    expiresAt: Date.now() + HOLD_DURATION_MS 
                });
            } else {
                stock++;
            }
        }
    }
}

if (process.env.NODE_ENV !== 'test') {
    setInterval(processExpiredHolds, 1000);
}

// API Endpoints
app.get('/api/status', (req, res) => {
    processExpiredHolds();
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const hold = holds.get(userId);
    const waitlistIndex = waitlist.indexOf(userId);
    const boughtCount = purchases.get(userId) || 0;

    res.json({
        stock,
        totalPairs: TOTAL_PAIRS,
        hold: hold ? {
            orderId: hold.orderId,
            expiresInSeconds: Math.max(0, Math.ceil((hold.expiresAt - Date.now()) / 1000))
        } : null,
        waitlistPosition: waitlistIndex !== -1 ? waitlistIndex + 1 : null,
        boughtCount,
        maxPurchases: 2
    });
});

app.post('/api/buy', (req, res) => {
    processExpiredHolds();
    const userId = req.body.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const purchasedCount = purchases.get(userId) || 0;
    if (purchasedCount >= 2) {
        return res.status(400).json({ error: 'You can only buy a maximum of 2 pairs' });
    }

    if (holds.has(userId)) {
        return res.status(400).json({ error: 'You already have a pair on hold' });
    }

    if (stock > 0) {
        stock--;
        const orderId = uuidv4();
        holds.set(userId, { orderId, expiresAt: Date.now() + HOLD_DURATION_MS });
        return res.json({ message: 'Pair held for 5 minutes', orderId });
    } else {
        if (!waitlist.includes(userId)) {
            waitlist.push(userId);
            return res.json({ message: 'Added to waitlist', position: waitlist.length });
        } else {
            return res.status(400).json({ error: 'Already in waitlist' });
        }
    }
});

app.post('/api/payment-webhook', (req, res) => {
    processExpiredHolds();
    const { orderId, status } = req.body;
    
    if (!orderId || status !== 'succeeded') {
        return res.status(400).json({ error: 'Invalid payment payload' });
    }

    if (completedOrders.has(orderId)) {
        return res.json({ message: 'Payment already processed' });
    }

    let foundUserId = null;
    for (const [userId, hold] of holds.entries()) {
        if (hold.orderId === orderId) {
            foundUserId = userId;
            break;
        }
    }

    if (foundUserId) {
        holds.delete(foundUserId);
        completedOrders.add(orderId);
        
        const count = purchases.get(foundUserId) || 0;
        purchases.set(foundUserId, count + 1);
        
        console.log(`Payment successful for user ${foundUserId}, order ${orderId}`);
        return res.json({ message: 'Payment applied successfully' });
    } else {
        console.log(`Late or invalid payment for order ${orderId}. Requires refund.`);
        return res.status(400).json({ error: 'Order not found or expired (refund required)' });
    }
});

// Fallback to serve index.html for any other route
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
