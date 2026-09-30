const appElement = document.getElementById('app');
let currentUserId = null;
let pollInterval = null;

function renderLogin() {
    appElement.innerHTML = `
        <h1>Sneaker Drop</h1>
        <h2>Exclusive Limited Release</h2>
        <p>Enter your User ID to join the waiting room and participate in the drop.</p>
        <form id="loginForm">
            <input type="text" id="userIdInput" placeholder="Enter your User ID" required autocomplete="off">
            <button type="submit">Join Drop</button>
        </form>
    `;

    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const userId = document.getElementById('userIdInput').value.trim();
        if (userId) {
            currentUserId = userId;
            fetchStatus();
            pollInterval = setInterval(fetchStatus, 1000);
        }
    });
}

async function fetchStatus() {
    if (!currentUserId) return;
    try {
        const res = await fetch(`/api/status?userId=${currentUserId}`);
        if (!res.ok) throw new Error('Failed to fetch status');
        const data = await res.json();
        renderDashboard(data);
    } catch (err) {
        console.error(err);
    }
}

function renderDashboard(data) {
    const { stock, totalPairs, hold, waitlistPosition, boughtCount, maxPurchases } = data;

    let timeStatusHtml = '<p>No active holds.</p>';
    if (hold) {
        timeStatusHtml = `<p>You have a pair on hold! Complete purchase in <span class="countdown">${hold.expiresInSeconds}s</span></p>`;
    }

    let waitlistHtml = '';
    if (waitlistPosition) {
        waitlistHtml = `<p>You are at position <strong>${waitlistPosition}</strong> in the waiting line.</p>`;
    }

    let actionsHtml = '';
    if (!hold && !waitlistPosition && boughtCount < maxPurchases) {
        actionsHtml += `<button id="buyBtn">Click to Buy</button>`;
    }

    if (hold && hold.orderId) {
        actionsHtml += `<button id="payBtn" class="btn-success">Simulate Payment</button>`;
    }
    
    // Check if there is an error to show
    let messageHtml = window.appMessage ? `<div class="${window.appMessage.type}-msg">${window.appMessage.text}</div>` : '';

    appElement.innerHTML = `
        <h1>Sneaker Drop</h1>
        
        ${messageHtml}

        <div class="stat-box">
            <span>Stock Remaining</span>
            <span class="stat-value">${stock} / ${totalPairs}</span>
        </div>
        
        ${timeStatusHtml}
        ${waitlistHtml}
        
        <div class="stat-box" style="margin-top: 20px;">
            <span>Pairs Purchased</span>
            <span class="stat-value">${boughtCount} / ${maxPurchases}</span>
        </div>
        
        <div style="margin-top: 30px;">
            ${actionsHtml}
        </div>
        
        <button id="logoutBtn" class="refresh-btn">Leave / Logout</button>
    `;

    const buyBtn = document.getElementById('buyBtn');
    if (buyBtn) buyBtn.addEventListener('click', handleBuy);

    const payBtn = document.getElementById('payBtn');
    if (payBtn) payBtn.addEventListener('click', () => handlePay(hold.orderId));

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => {
        clearInterval(pollInterval);
        currentUserId = null;
        window.appMessage = null;
        renderLogin();
    });
}

function showMessage(text, type) {
    window.appMessage = { text, type };
    setTimeout(() => {
        window.appMessage = null;
        fetchStatus();
    }, 3000);
}

async function handleBuy() {
    try {
        const res = await fetch('/api/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId })
        });
        const data = await res.json();
        
        if (!res.ok) {
            showMessage(data.error || 'Buy failed', 'error');
        } else {
            showMessage(data.message, 'success');
        }
        fetchStatus();
    } catch (err) {
        showMessage('Error requesting buy', 'error');
    }
}

async function handlePay(orderId) {
    try {
        const res = await fetch('/api/payment-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, status: 'succeeded' })
        });
        const data = await res.json();
        
        if (!res.ok) {
            showMessage(data.error || 'Payment failed', 'error');
        } else {
            showMessage(data.message, 'success');
        }
        fetchStatus();
    } catch (err) {
        showMessage('Error simulating payment', 'error');
    }
}

// Initial render
renderLogin();
