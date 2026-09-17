const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/reports', express.static(path.join(__dirname, 'reports')));

const adminFile = path.join(__dirname, 'admin.json');
const productsFile = path.join(__dirname, 'products.json');
const ordersFile = path.join(__dirname, 'orders.json');
const closedMonthsFile = path.join(__dirname, 'closedMonths.json');
const dailyRecordsFile = path.join(__dirname, 'dailyRecords.json');
const reportsDir = path.join(__dirname, 'reports');
const settingsFile = path.join(__dirname, 'settings.json');
const categoriesFile = path.join(__dirname, 'categories.json');
const collectionsFile = path.join(__dirname, 'collections.json');
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(productsFile)) fs.writeFileSync(productsFile, JSON.stringify([], null, 2));
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, JSON.stringify([], null, 2));
if (!fs.existsSync(closedMonthsFile)) fs.writeFileSync(closedMonthsFile, JSON.stringify([], null, 2));
if (!fs.existsSync(dailyRecordsFile)) fs.writeFileSync(dailyRecordsFile, JSON.stringify([], null, 2));
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);
if (!fs.existsSync(settingsFile)) fs.writeFileSync(settingsFile, JSON.stringify({ homepage: {} }, null, 2));
if (!fs.existsSync(categoriesFile)) fs.writeFileSync(categoriesFile, JSON.stringify(["MEN", "WOMEN", "SIGNATURE", "UNISEX"], null, 2));
if (!fs.existsSync(collectionsFile)) fs.writeFileSync(collectionsFile, JSON.stringify([], null, 2));

if (!fs.existsSync(adminFile)) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const defaultAdmin = { email: 'owner@baytaloud.com', password: hashedPassword };
    fs.writeFileSync(adminFile, JSON.stringify(defaultAdmin, null, 2));
}

function syncDailyRecords(orders) {
    const daily = {};
    const products = fs.existsSync(productsFile) ? JSON.parse(fs.readFileSync(productsFile, 'utf8')) : [];
    (Array.isArray(orders) ? orders : []).forEach(order => {
        const date = order.date ? new Date(order.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        if (!daily[date]) daily[date] = { date, totalOrders: 0, totalRevenue: 0, totalExpenses: 0, totalProfit: 0 };
        daily[date].totalOrders += 1;
        daily[date].totalRevenue += Number(order.totalAmount || 0);
        daily[date].totalExpenses += Number(order.expenses || 0);
        daily[date].totalProfit += Number(order.profit || 0);
        const items = Array.isArray(order.items) && order.items.length
            ? order.items
            : [{ name: order.productName || 'Manual order', quantity: order.quantity || 1, price: order.totalAmount || 0, costPrice: order.expenses || 0 }];
        items.forEach(item => {
            const productName = item.name || 'Unknown product';
            const quantity = Number(item.quantity || 1);
            const revenue = Number(item.price || 0) * quantity;
            const product = products.find(candidate => candidate.id === item.id || candidate.name === productName);
            const expense = Number(item.costPrice ?? product?.costPrice ?? 0) * quantity;
            const existingProduct = daily[date].products?.find(product => product.name === productName);
            if (existingProduct) {
                existingProduct.quantity += quantity;
                existingProduct.revenue += revenue;
                existingProduct.expenses += expense;
                existingProduct.profit += revenue - expense;
            } else {
                daily[date].products = daily[date].products || [];
                daily[date].products.push({ name: productName, quantity, revenue, expenses: expense, profit: revenue - expense });
            }
        });
    });
    const existing = fs.existsSync(dailyRecordsFile) ? JSON.parse(fs.readFileSync(dailyRecordsFile, 'utf8')) : [];
    const historical = (Array.isArray(existing) ? existing : []).filter(record => !daily[record.date]);
    const records = historical.concat(Object.values(daily)).sort((a, b) => a.date.localeCompare(b.date));
    fs.writeFileSync(dailyRecordsFile, JSON.stringify(records, null, 2));
    return records;
}

function readClosedMonths() {
    if (!fs.existsSync(closedMonthsFile)) return [];
    const records = JSON.parse(fs.readFileSync(closedMonthsFile, 'utf8'));
    return Array.isArray(records) ? records : [];
}

function getStoredOrders() {
    const current = fs.existsSync(ordersFile) ? JSON.parse(fs.readFileSync(ordersFile, 'utf8')) : [];
    const archived = readClosedMonths().flatMap(month => Array.isArray(month.orders) ? month.orders : []);
    const byId = new Map();
    [...archived, ...(Array.isArray(current) ? current : [])].forEach(order => byId.set(String(order.id), order));
    return [...byId.values()];
}

function pdfEscape(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createSimplePdf(lines) {
    const content = ['BT', '/F1 12 Tf', '50 760 Td'];
    lines.forEach((line, index) => {
        if (index > 0) content.push('0 -20 Td');
        content.push(`(${pdfEscape(line)}) Tj`);
    });
    content.push('ET');
    const stream = content.join('\n');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets[index + 1] = Buffer.byteLength(pdf, 'latin1');
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
}

async function createExcelReport(record, products) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CALVIER ESSENCE Admin';
    const summary = workbook.addWorksheet('Summary');
    summary.columns = [{ width: 28 }, { width: 22 }];
    summary.mergeCells('A1:B1');
    summary.getCell('A1').value = 'CALVIER ESSENCE - MONTHLY PROFIT & LOSS REPORT';
    summary.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B6914' } };
    [['Month Closed', new Date(record.closedDate).toLocaleDateString()], ['Total Orders', record.totalOrders], ['Total Revenue', record.totalRevenue], ['Total Expenses', record.totalExpenses], ['Total Profit / Loss', record.totalProfit]].forEach(row => summary.addRow(row));
    summary.getColumn(1).font = { bold: true };
    summary.getColumn(2).numFmt = '#,##0';

    const daily = workbook.addWorksheet('Sales Report');
    daily.columns = [{ width: 30 }, { width: 14 }, { width: 11 }, { width: 16 }, { width: 16 }, { width: 18 }];
    daily.mergeCells('A1:F1');
    daily.getCell('A1').value = 'SALES OF THE MONTH';
    daily.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FF000000' } };
    daily.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    daily.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };
    daily.getRow(1).height = 30;
    daily.mergeCells('A2:F2');
    daily.getCell('A2').value = `Month closed: ${new Date(record.closedDate).toLocaleDateString()}`;
    daily.getCell('A2').font = { italic: true, color: { argb: 'FF5B9BD5' } };
    daily.getCell('A4').value = 'PRODUCT';
    daily.getCell('B4').value = 'IMAGE';
    daily.getCell('C4').value = 'QTY';
    daily.getCell('D4').value = 'SALE / REVENUE';
    daily.getCell('E4').value = 'EXPENSE';
    daily.getCell('F4').value = 'PROFIT / LOSS';
    daily.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    daily.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34495E' } };

    const productTotals = new Map();
    (record.dailyRecords || []).forEach(day => (day.products || []).forEach(product => {
        const existing = productTotals.get(product.name) || { name: product.name, quantity: 0, revenue: 0, expenses: 0, profit: 0, image: '' };
        existing.quantity += Number(product.quantity || 0);
        existing.revenue += Number(product.revenue || 0);
        existing.expenses += Number(product.expenses || 0);
        existing.profit += Number(product.profit || 0);
        productTotals.set(product.name, existing);
    }));
    (record.orders || []).forEach(order => (order.items || []).forEach(item => {
        const product = productTotals.get(item.name);
        if (product && !product.image) product.image = item.image || '';
    }));
    let rowNumber = 5;
    productTotals.forEach(product => {
        const row = daily.addRow([product.name, '', product.quantity, product.revenue, product.expenses, product.profit]);
        row.height = 52;
        const imagePath = product.image.startsWith('/uploads/') ? path.join(__dirname, product.image.slice(1)) : '';
        if (imagePath && fs.existsSync(imagePath)) {
            const extension = path.extname(imagePath).slice(1).toLowerCase();
            if (['jpg', 'jpeg', 'png'].includes(extension)) {
                const imageId = workbook.addImage({ filename: imagePath, extension: extension === 'jpeg' ? 'jpg' : extension });
                daily.addImage(imageId, { tl: { col: 1, row: rowNumber - 1 }, ext: { width: 44, height: 44 } });
            }
        }
        rowNumber += 1;
    });
    const totalRow = daily.addRow(['TOTAL', '', '', record.totalRevenue, record.totalExpenses, record.totalProfit]);
    totalRow.font = { bold: true, size: 12 };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA9D18E' } };
    [4, 5, 6].forEach(column => { daily.getColumn(column).numFmt = '#,##0'; });
    daily.views = [{ state: 'frozen', ySplit: 4 }];

    const ordersSheet = workbook.addWorksheet('Orders');
    ordersSheet.columns = [{ header: 'Order ID', width: 20 }, { header: 'Customer', width: 24 }, { header: 'Product(s)', width: 35 }, { header: 'Total', width: 15 }, { header: 'Expenses', width: 15 }, { header: 'Profit / Loss', width: 18 }, { header: 'Status', width: 14 }, { header: 'Date', width: 15 }, { header: 'Image', width: 16 }];
    ordersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ordersSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B6914' } };
    (record.orders || []).forEach(order => {
        const items = Array.isArray(order.items) ? order.items : [{ name: order.productName || 'Manual order', image: order.productImage || '' }];
        const row = ordersSheet.addRow([order.id, order.customerName || '', items.map(item => item.name).join(', '), order.totalAmount, order.expenses, order.profit, order.status || 'Pending', new Date(order.date).toLocaleDateString(), '']);
        const image = items[0]?.image || '';
        const imagePath = image.startsWith('/uploads/') ? path.join(__dirname, image.slice(1)) : '';
        if (imagePath && fs.existsSync(imagePath)) {
            const extension = path.extname(imagePath).slice(1).toLowerCase();
            if (['jpg', 'jpeg', 'png'].includes(extension)) {
                const imageId = workbook.addImage({ filename: imagePath, extension: extension === 'jpeg' ? 'jpg' : extension });
                ordersSheet.addImage(imageId, { tl: { col: 8, row: row.number - 1 }, ext: { width: 70, height: 70 } });
                row.height = 58;
            }
        }
    });
    ordersSheet.getColumn(4).numFmt = '#,##0'; ordersSheet.getColumn(5).numFmt = '#,##0'; ordersSheet.getColumn(6).numFmt = '#,##0';
    const filename = `profit-loss-${record.monthId}.xlsx`;
    await workbook.xlsx.writeFile(path.join(reportsDir, filename));
    return `/reports/${filename}`;
}

// Admin Login
app.post('/api/admin/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = JSON.parse(fs.readFileSync(adminFile, 'utf8'));
        if (admin.email !== email || !bcrypt.compareSync(password, admin.password)) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        const token = jwt.sign({ email: admin.email }, 'your_jwt_secret_key', { expiresIn: '1h' });
        res.json({ token, message: 'Login successful' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get All Products
app.get('/api/products', (req, res) => {
    try {
        const data = fs.readFileSync(productsFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).json({ message: 'Error reading products' });
    }
});

function normalizeSizes(sizes) {
    if (!Array.isArray(sizes)) return [];
    return sizes
        .map(size => ({
            label: String(size?.label || '').trim().slice(0, 50),
            price: Math.max(0, Number(size?.price) || 0)
        }))
        .filter(size => size.label);
}

function productPrice(sizes) {
    return Number(sizes[0]?.price || 0);
}

// Add Product
app.post('/api/products', (req, res) => {
    try {
const { name, costPrice, sizes, stock, category, image, description, notes, offer } = req.body;
        const products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));

        let imagePath = '';
        if (image) {
            const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const base64Data = matches[2];
                const fileName = `prod_${Date.now()}.${ext}`;
                const fullPath = path.join(uploadDir, fileName);
                fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
                imagePath = `/uploads/${fileName}`;
            }
        }

const productSizes = normalizeSizes(sizes);
const newProduct = {
            id: Date.now().toString(),
            name,
            costPrice: Number(costPrice || 0),
            price: productPrice(productSizes),
            sizes: productSizes,
            stock: Number(stock || 0),
            category: category || '',
            description: description || '',
            notes: notes || '',
            offer: offer || '',
            image: imagePath
        };

        products.push(newProduct);
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
        res.json({ message: 'Product added successfully', product: newProduct });
    } catch (err) {
        res.status(500).json({ message: 'Error saving product', error: err.message });
    }
});

// Update Product
app.put('/api/products/:id', (req, res) => {
    try {
        let products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
        const index = products.findIndex(p => p.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ message: 'Product not found' });
        }

const { name, costPrice, sizes, stock, category, image, description, notes, offer } = req.body;
        let imagePath = products[index].image;

        if (image && image.startsWith('data:image')) {
            const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const base64Data = matches[2];
                const fileName = `prod_${Date.now()}.${ext}`;
                const fullPath = path.join(uploadDir, fileName);
                fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
                imagePath = `/uploads/${fileName}`;
            }
        }

const productSizes = normalizeSizes(sizes);
products[index] = {
            id: req.params.id,
            name,
            costPrice: Number(costPrice || 0),
            price: productPrice(productSizes),
            sizes: productSizes,
            stock: Number(stock || 0),
            category: category || '',
            description: description || '',
            notes: notes || '',
            offer: offer || '',
            image: imagePath
        };

        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
        res.json({ message: 'Product updated successfully', product: products[index] });
    } catch (err) {
        res.status(500).json({ message: 'Error updating product' });
    }
});

// Delete Product
app.delete('/api/products/:id', (req, res) => {
    try {
        let products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
        products = products.filter(p => p.id !== req.params.id);
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting product' });
    }
});

// ===== CATEGORY MANAGEMENT =====

// Get All Categories
app.get('/api/categories', (req, res) => {
    try {
        let categories = [];
        if (fs.existsSync(categoriesFile)) {
            categories = JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));
        }
        if (!Array.isArray(categories)) categories = [];
        res.json(categories);
    } catch (err) {
        res.status(500).json({ message: 'Error reading categories' });
    }
});

// Add Category
app.post('/api/categories', (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Category name is required' });
        }
        let categories = [];
        if (fs.existsSync(categoriesFile)) {
            categories = JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));
        }
        if (!Array.isArray(categories)) categories = [];
        const trimmed = name.trim().toUpperCase();
        if (categories.some(c => c.toUpperCase() === trimmed)) {
            return res.status(400).json({ message: 'Category already exists' });
        }
        categories.push(trimmed);
        fs.writeFileSync(categoriesFile, JSON.stringify(categories, null, 2));
        res.json({ message: 'Category added successfully', categories });
    } catch (err) {
        res.status(500).json({ message: 'Error adding category', error: err.message });
    }
});

// Delete Category
app.delete('/api/categories/:name', (req, res) => {
    try {
        let categories = [];
        if (fs.existsSync(categoriesFile)) {
            categories = JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));
        }
        if (!Array.isArray(categories)) categories = [];
        const target = req.params.name.toUpperCase();
        categories = categories.filter(c => c.toUpperCase() !== target);
        fs.writeFileSync(categoriesFile, JSON.stringify(categories, null, 2));
        res.json({ message: 'Category deleted successfully', categories });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting category' });
    }
});

// Rename Category
app.put('/api/categories/:name', (req, res) => {
    try {
        const { newName } = req.body;
        if (!newName || !newName.trim()) {
            return res.status(400).json({ message: 'New category name is required' });
        }
        let categories = [];
        if (fs.existsSync(categoriesFile)) {
            categories = JSON.parse(fs.readFileSync(categoriesFile, 'utf8'));
        }
        if (!Array.isArray(categories)) categories = [];
        const oldName = req.params.name.toUpperCase();
        const newTrimmed = newName.trim().toUpperCase();

        if (categories.some(c => c.toUpperCase() === newTrimmed)) {
            return res.status(400).json({ message: 'Category already exists' });
        }

        const index = categories.findIndex(c => c.toUpperCase() === oldName);
        if (index === -1) {
            return res.status(404).json({ message: 'Category not found' });
        }

        categories[index] = newTrimmed;
        fs.writeFileSync(categoriesFile, JSON.stringify(categories, null, 2));

        // Also update products that use this category
        if (fs.existsSync(productsFile)) {
            let products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
            let changed = false;
            products.forEach(p => {
                if ((p.category || '').toUpperCase() === oldName) {
                    p.category = newTrimmed;
                    changed = true;
                }
            });
            if (changed) {
                fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
            }
        }

        // Also update collections that reference this category
        if (fs.existsSync(collectionsFile)) {
            let collections = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
            let changed = false;
            (Array.isArray(collections) ? collections : []).forEach(coll => {
                if (Array.isArray(coll.categories)) {
                    coll.categories = coll.categories.map(c => c.toUpperCase() === oldName ? newTrimmed : c);
                    changed = true;
                }
            });
            if (changed) {
                fs.writeFileSync(collectionsFile, JSON.stringify(collections, null, 2));
            }
        }

        res.json({ message: 'Category renamed successfully', categories });
    } catch (err) {
        res.status(500).json({ message: 'Error renaming category', error: err.message });
    }
});

// ===== COLLECTION MANAGEMENT =====

// Get All Collections
app.get('/api/collections', (req, res) => {
    try {
        let collections = [];
        if (fs.existsSync(collectionsFile)) {
            collections = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
        }
        if (!Array.isArray(collections)) collections = [];
        res.json(collections);
    } catch (err) {
        res.status(500).json({ message: 'Error reading collections' });
    }
});

// Get Single Collection by ID
app.get('/api/collections/:id', (req, res) => {
    try {
        let collections = [];
        if (fs.existsSync(collectionsFile)) {
            collections = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
        }
        if (!Array.isArray(collections)) collections = [];
        const collection = collections.find(c => c.id === req.params.id);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        res.json(collection);
    } catch (err) {
        res.status(500).json({ message: 'Error reading collection', error: err.message });
    }
});

// Add Collection
app.post('/api/collections', (req, res) => {
    try {
        const { name, categories, image, type, gender } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Collection name is required' });
        }
        let collections = [];
        if (fs.existsSync(collectionsFile)) {
            collections = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
        }
        if (!Array.isArray(collections)) collections = [];
        const trimmed = name.trim();
        if (collections.some(c => c.name && c.name.toLowerCase() === trimmed.toLowerCase())) {
            return res.status(400).json({ message: 'Collection already exists' });
        }
        let imagePath = image || '';
        if (image && image.startsWith('data:image')) {
            const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const fileName = `coll_${Date.now()}.${ext}`;
                const fullPath = path.join(uploadDir, fileName);
                fs.writeFileSync(fullPath, Buffer.from(matches[2], 'base64'));
                imagePath = `/uploads/${fileName}`;
            }
        }
        const newCollection = {
            id: Date.now().toString(),
            name: trimmed,
            type: type || '',
            gender: gender || '',
            categories: Array.isArray(categories) ? categories : [],
            image: imagePath
        };
        collections.push(newCollection);
        fs.writeFileSync(collectionsFile, JSON.stringify(collections, null, 2));
        res.json({ message: 'Collection added successfully', collection: newCollection });
    } catch (err) {
        res.status(500).json({ message: 'Error adding collection', error: err.message });
    }
});

// Update Collection
app.put('/api/collections/:id', (req, res) => {
    try {
        let collections = [];
        if (fs.existsSync(collectionsFile)) {
            collections = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
        }
        if (!Array.isArray(collections)) collections = [];
        const index = collections.findIndex(c => c.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ message: 'Collection not found' });
        }
        const { name, categories, image, type, gender } = req.body;
        if (name && name.trim()) collections[index].name = name.trim();
        if (Array.isArray(categories)) collections[index].categories = categories;
        if (type !== undefined) collections[index].type = type;
        if (gender !== undefined) collections[index].gender = gender;
        if (image !== undefined) {
            let imagePath = image;
            if (image && image.startsWith('data:image')) {
                const matches = image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                    const fileName = `coll_${Date.now()}.${ext}`;
                    const fullPath = path.join(uploadDir, fileName);
                    fs.writeFileSync(fullPath, Buffer.from(matches[2], 'base64'));
                    imagePath = `/uploads/${fileName}`;
                }
            }
            collections[index].image = imagePath;
        }
        fs.writeFileSync(collectionsFile, JSON.stringify(collections, null, 2));
        res.json({ message: 'Collection updated successfully', collection: collections[index] });
    } catch (err) {
        res.status(500).json({ message: 'Error updating collection' });
    }
});

// Delete Collection
app.delete('/api/collections/:id', (req, res) => {
    try {
        let collections = [];
        if (fs.existsSync(collectionsFile)) {
            collections = JSON.parse(fs.readFileSync(collectionsFile, 'utf8'));
        }
        if (!Array.isArray(collections)) collections = [];
        collections = collections.filter(c => c.id !== req.params.id);
        fs.writeFileSync(collectionsFile, JSON.stringify(collections, null, 2));
        res.json({ message: 'Collection deleted successfully', collections });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting collection' });
    }
});

// Get Customer Orders
app.get('/api/orders', (req, res) => {
    try {
        res.json(getStoredOrders());
    } catch (err) {
        res.status(500).json({ message: 'Error reading orders' });
    }
});

// Save Order
app.post('/api/orders', (req, res) => {
    try {
        const { customerName, phone, address, productId, quantity, totalAmount, expenses, profit } = req.body;

        // Case 1: Direct order entry (checkout.html) - total/expenses/profit provided directly
        if (totalAmount !== undefined && expenses !== undefined) {
            const newOrder = {
                id: Date.now().toString(),
                customerName,
                phone,
                address,
                productName: customerName ? 'Manual Entry' : '',
                quantity: Number(quantity || 1),
                totalAmount: Number(totalAmount || 0),
                expenses: Number(expenses || 0),
                profit: Number(profit !== undefined ? profit : (Number(totalAmount) - Number(expenses))),
                status: 'Pending',
                date: new Date().toISOString()
            };

            let orders = [];
            if (fs.existsSync(ordersFile)) {
                orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
            }
            orders.push(newOrder);
            fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
            syncDailyRecords(orders);
            return res.status(201).json({ message: 'Order placed successfully', order: newOrder });
        }

        // Case 2: Product-based order (productId + quantity)
        let products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));
        const product = products.find(p => p.id === productId);

        if (!product) {
            return res.status(404).json({ message: 'Selected product not found' });
        }

        const qty = Number(quantity || 1);
        if (product.stock < qty) {
            return res.status(400).json({ message: 'Not enough stock available' });
        }

        product.stock -= qty;
        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

        const totalAmountCalc = product.price * qty;
        const expensesCalc = product.costPrice * qty;
        const profitCalc = totalAmountCalc - expensesCalc;

        const newOrder = {
            id: Date.now().toString(),
            customerName,
            phone,
            address,
            productName: product.name,
            quantity: qty,
            totalAmount: totalAmountCalc,
            expenses: expensesCalc,
            profit: profitCalc,
            status: 'Pending',
            date: new Date().toISOString()
        };

        let orders = [];
        if (fs.existsSync(ordersFile)) {
            orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
        }

        orders.push(newOrder);
        fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
        syncDailyRecords(orders);

        res.status(201).json({ message: 'Order placed successfully & stock updated', order: newOrder });
    } catch (err) {
        res.status(500).json({ message: 'Error processing order', error: err.message });
    }
});

// Save Cart Order (multi-item from website cart)
app.post('/api/orders/cart', (req, res) => {
    try {
        const { customerName, email, phone, address, postalCode, country, deliveryMethod, paymentMethod, items, total } = req.body;
        if (!customerName || !phone || !address || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Incomplete order data' });
        }

        let products = JSON.parse(fs.readFileSync(productsFile, 'utf8'));

        // Deduct stock & calculate expenses/profit for each item
        let totalAmount = 0;
        let expenses = 0;
        const orderItems = [];

for (const item of items) {
            // 1. Match by product ID (most reliable)
            let product = (item.id && products.find(p => p.id === item.id)) || null;

            // 2. Fallback to name-based match - prefer in-stock product to avoid picking an out-of-stock duplicate
            if (!product) {
                const nameMatches = products.filter(p => p.name === item.name);
                if (nameMatches.length === 1) {
                    product = nameMatches[0];
                } else if (nameMatches.length > 1) {
                    product = nameMatches.find(p => Number(p.stock || 0) > 0) || nameMatches[0];
                }
            }

            const qty = Number(item.quantity || 1);
            const price = Number(item.price || 0);
            const cost = product ? Number(product.costPrice || 0) : 0;

            if (product) {
                const availableStock = Number(product.stock || 0);
                // STOCK VALIDATION: reject if requested quantity exceeds available stock
                if (qty > availableStock) {
                    return res.status(400).json({
                        message: `Not enough stock for "${product.name}". Only ${availableStock} left in stock.`
                    });
                }
                // Deduct stock
                product.stock = availableStock - qty;
            }

            totalAmount += price * qty;
            expenses += cost * qty;
            orderItems.push({
                id: product ? product.id : (item.id || ''),
                name: item.name,
                size: item.size || '',
                price,
                quantity: qty,
                image: item.image || ''
            });
        }

        fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));

        const profit = totalAmount - expenses;
        const newOrder = {
            id: Date.now().toString(),
            customerName,
            email: email || '',
            phone,
            address: address || '',
            postalCode: postalCode || '',
            country: country || 'Pakistan',
            deliveryMethod: deliveryMethod || 'ship',
            paymentMethod: paymentMethod || 'cod',
            items: orderItems,
            totalAmount,
            expenses,
            profit,
            status: 'Pending',
            date: new Date().toISOString()
        };

        let orders = [];
        if (fs.existsSync(ordersFile)) {
            orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
        }

        orders.push(newOrder);
        fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
        syncDailyRecords(orders);

        res.status(201).json({ message: 'Order placed successfully & stock updated', order: newOrder });
    } catch (err) {
        res.status(500).json({ message: 'Error processing order', error: err.message });
    }
});

// Update Order Status
app.put('/api/orders/:id/status', (req, res) => {
    try {
        if (!fs.existsSync(ordersFile)) {
            return res.status(404).json({ message: 'No orders found' });
        }
        const allowedStatuses = ['Pending', 'Shipping', 'Delivered'];
        const status = String(req.body.status || '').trim();
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid order status' });
        }
        const orders = getStoredOrders();
        const order = orders.find(item => item.id === req.params.id);
        if (!order) {
            const closedMonths = readClosedMonths();
            for (const month of closedMonths) {
                const archivedOrder = (month.orders || []).find(item => item.id === req.params.id);
                if (archivedOrder) {
                    archivedOrder.status = status;
                    fs.writeFileSync(closedMonthsFile, JSON.stringify(closedMonths, null, 2));
                    return res.json({ message: 'Archived order status updated successfully', order: archivedOrder });
                }
            }
        }
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        order.status = status;
        fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
        syncDailyRecords(orders);
        res.json({ message: 'Order status updated successfully', order });
    } catch (err) {
        res.status(500).json({ message: 'Error updating order status' });
    }
});

// Delete Order
app.delete('/api/orders/:id', (req, res) => {
    try {
        if (!fs.existsSync(ordersFile)) {
            return res.status(404).json({ message: 'No orders found' });
        }
        let orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
        const wasCurrentOrder = orders.some(o => o.id === req.params.id);
        orders = orders.filter(o => o.id !== req.params.id);
        fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
        if (!wasCurrentOrder) {
            const closedMonths = readClosedMonths();
            let removed = false;
            closedMonths.forEach(month => {
                const before = (month.orders || []).length;
                month.orders = (month.orders || []).filter(order => order.id !== req.params.id);
                removed = removed || before !== month.orders.length;
            });
            if (removed) fs.writeFileSync(closedMonthsFile, JSON.stringify(closedMonths, null, 2));
        }
        syncDailyRecords(orders);
        res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting order' });
    }
});

// Dashboard Analytics Stats
app.get('/api/analytics/stats', (req, res) => {
    try {
        if (!fs.existsSync(ordersFile)) {
            return res.json({ totalRevenue: 0, totalProfit: 0, totalExpenses: 0 });
        }

        const orders = getStoredOrders();

        let totalRevenue = 0;
        let totalProfit = 0;
        let totalExpenses = 0;

        orders.forEach(order => {
            totalRevenue += Number(order.totalAmount || 0);
            totalProfit += Number(order.profit || 0);
            totalExpenses += Number(order.expenses || 0);
        });

        res.json({ totalRevenue, totalProfit, totalExpenses });
    } catch (err) {
        res.status(500).json({ message: 'Error calculating stats' });
    }
});

// Close Month Record API
app.get('/api/analytics/daily', (req, res) => {
    try {
        const orders = fs.existsSync(ordersFile) ? JSON.parse(fs.readFileSync(ordersFile, 'utf8')) : [];
        res.json(syncDailyRecords(orders));
    } catch (err) {
        res.status(500).json({ message: 'Error reading daily records' });
    }
});

app.post('/api/analytics/close-month', async (req, res) => {
    try {
        if (!fs.existsSync(ordersFile)) {
            return res.status(400).json({ message: 'No records to close' });
        }

        const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
        if (orders.length === 0) {
            const latest = readClosedMonths().slice(-1)[0];
            if (latest) {
                const reportFiles = fs.readdirSync(reportsDir);
                const pdfName = reportFiles.filter(name => name.endsWith('.pdf')).sort().slice(-1)[0];
                const products = fs.existsSync(productsFile) ? JSON.parse(fs.readFileSync(productsFile, 'utf8')) : [];
                const generatedExcelUrl = await createExcelReport(latest, products);
                return res.json({
                    message: 'This month is already closed. Existing records and reports are available.',
                    reportUrl: pdfName ? `/reports/${pdfName}` : '',
                    excelUrl: generatedExcelUrl,
                    alreadyClosed: true
                });
            }
            return res.status(400).json({ message: 'No orders found for this month' });
        }

        let totalRevenue = 0;
        let totalProfit = 0;
        let totalExpenses = 0;

        orders.forEach(order => {
            totalRevenue += Number(order.totalAmount || 0);
            totalProfit += Number(order.profit || 0);
            totalExpenses += Number(order.expenses || 0);
        });

        const monthName = new Date().toISOString().slice(0, 7);
        const dailyRecords = syncDailyRecords(orders).filter(record => record.date.startsWith(monthName));
        const closedRecord = {
            monthId: Date.now().toString(),
            closedDate: new Date().toISOString(),
            totalOrders: orders.length,
            totalRevenue,
            totalProfit,
            totalExpenses,
            dailyRecords,
            orders
        };

        let closedMonths = [];
        if (fs.existsSync(closedMonthsFile)) {
            closedMonths = JSON.parse(fs.readFileSync(closedMonthsFile, 'utf8'));
        }
        closedMonths.push(closedRecord);
        fs.writeFileSync(closedMonthsFile, JSON.stringify(closedMonths, null, 2));

        const reportName = `profit-loss-${monthName}-${closedRecord.monthId}.pdf`;
        const reportLines = [
            'CALVIER ESSENCE - MONTHLY PROFIT & LOSS REPORT',
            `Month closed: ${new Date().toLocaleDateString()}`,
            `Total orders: ${orders.length}`,
            `Total revenue: Rs. ${totalRevenue.toLocaleString()}`,
            `Total expenses: Rs. ${totalExpenses.toLocaleString()}`,
            `Total profit/loss: Rs. ${totalProfit.toLocaleString()}`,
            '',
            'Daily records:'
        ];
        closedRecord.dailyRecords.forEach(record => {
            reportLines.push(`${record.date} TOTAL | Orders: ${record.totalOrders} | Revenue: Rs. ${record.totalRevenue} | Expenses: Rs. ${record.totalExpenses} | Profit/Loss: Rs. ${record.totalProfit}`);
            (record.products || []).forEach(product => {
                reportLines.push(`  ${product.name} | Qty: ${product.quantity} | Revenue: Rs. ${product.revenue} | Expenses: Rs. ${product.expenses} | Profit/Loss: Rs. ${product.profit}`);
            });
        });
        fs.writeFileSync(path.join(reportsDir, reportName), createSimplePdf(reportLines));
        const products = fs.existsSync(productsFile) ? JSON.parse(fs.readFileSync(productsFile, 'utf8')) : [];
        const excelUrl = await createExcelReport(closedRecord, products);

        fs.writeFileSync(ordersFile, JSON.stringify([], null, 2));

        res.json({ message: 'Month closed successfully and record archived!', reportUrl: `/reports/${reportName}`, excelUrl });
    } catch (err) {
        res.status(500).json({ message: 'Error closing month', error: err.message });
    }
});

// Get Website Settings (Content Management)
app.get('/api/settings', (req, res) => {
    try {
        let settings = { homepage: {} };
        if (fs.existsSync(settingsFile)) {
            settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: 'Error reading settings' });
    }
});

// Save Website Settings (Content Management)
app.post('/api/settings', (req, res) => {
    try {
        const newSettings = req.body || {};
        let settings = { homepage: {} };
        if (fs.existsSync(settingsFile)) {
            settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
        }
        if (newSettings.homepage) settings.homepage = { ...settings.homepage, ...newSettings.homepage };
        if (newSettings.general) settings.general = { ...(settings.general || {}), ...newSettings.general };
        if (newSettings.sections) settings.sections = { ...(settings.sections || {}), ...newSettings.sections };
        fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        res.json({ message: 'Settings saved successfully', settings });
    } catch (err) {
        res.status(500).json({ message: 'Error saving settings', error: err.message });
    }
});

// Server Listen (Only Once at the end)
app.listen(3000, () => {
    console.log('Server running on port 3000');
});
