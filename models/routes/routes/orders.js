const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'orders.json');

// Order save karne ka function
function saveOrder(orderData) {
    let orders = [];
    if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        try {
            orders = JSON.parse(fileData);
        } catch (e) {
            orders = [];
        }
    }

    // Naya order add karna (percentage ka koi formula nahi)
    orders.push(orderData);
    fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
}

module.exports = { saveOrder };