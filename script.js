// ============================================================
// GLOBAL HTML-ATTRIBUTE ESCAPING HELPER
// ============================================================
window.escAttr = function (value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '"')
        .replace(/'/g, '&#39;')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
};

// ============================================================
// LUXURY NOTIFICATION SYSTEM - Replaces default alert()
// ============================================================
(function () {
    // Inject global styles once
    if (!document.getElementById('luxNotifyStyles')) {
        const style = document.createElement('style');
        style.id = 'luxNotifyStyles';
        style.textContent = `
            .lux-notify-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(6px);
                z-index: 99998;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            .lux-notify-overlay.show { opacity: 1; }
            .lux-notify-card {
                background: linear-gradient(145deg, #1e1e1e, #141414);
                border: 1px solid rgba(212,175,55,0.4);
                border-radius: 18px;
                padding: 34px 38px;
                max-width: 420px;
                width: 90%;
                text-align: center;
                position: relative;
                box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.12);
                transform: scale(0.9) translateY(20px);
                transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .lux-notify-overlay.show .lux-notify-card { transform: scale(1) translateY(0); }
            .lux-notify-card::before {
                content: '';
                position: absolute;
                top: -40%;
                right: -30%;
                width: 220px;
                height: 220px;
                background: radial-gradient(circle, rgba(212,175,55,0.15), transparent 70%);
                pointer-events: none;
            }
            .lux-notify-icon {
                width: 72px;
                height: 72px;
                margin: 0 auto 18px auto;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                border: 2px solid;
                animation: luxPulse 1.5s infinite;
            }
            .lux-notify-icon.warn { background: rgba(212,175,55,0.12); border-color: var(--gold, #d4af37); color: var(--gold, #d4af37); }
            .lux-notify-icon.success { background: rgba(46,204,113,0.12); border-color: #2ecc71; color: #2ecc71; }
            .lux-notify-icon.error { background: rgba(231,76,60,0.12); border-color: #e74c3c; color: #e74c3c; }
            .lux-notify-icon.info { background: rgba(52,152,219,0.12); border-color: #3498db; color: #3498db; }
            @keyframes luxPulse {
                0% { box-shadow: 0 0 0 0 rgba(212,175,55,0.4); }
                70% { box-shadow: 0 0 0 14px rgba(212,175,55,0); }
                100% { box-shadow: 0 0 0 0 rgba(212,175,55,0); }
            }
            .lux-notify-card h3 {
                font-family: 'Cinzel', serif;
                color: #fff;
                font-size: 1.3rem;
                margin: 0 0 10px 0;
                letter-spacing: 0.5px;
            }
            .lux-notify-card p {
                color: #bbb;
                font-size: 0.95rem;
                line-height: 1.6;
                margin: 0 0 24px 0;
            }
            .lux-notify-close {
                position: absolute;
                top: 12px;
                right: 16px;
                background: none;
                border: none;
                color: #777;
                font-size: 1.4rem;
                cursor: pointer;
                transition: color 0.3s;
                z-index: 2;
            }
            .lux-notify-close:hover { color: var(--gold, #d4af37); }
            .lux-notify-btn {
                background: linear-gradient(135deg, var(--gold, #d4af37), #aa8537);
                color: #0b0b0b;
                border: none;
                font-weight: 700;
                padding: 12px 40px;
                border-radius: 8px;
                font-size: 0.85rem;
                letter-spacing: 1px;
                text-transform: uppercase;
                cursor: pointer;
                transition: 0.3s;
            }
            .lux-notify-btn:hover { opacity: 0.9; transform: translateY(-2px); }
        `;
        document.head.appendChild(style);
    }

    // Beautiful modal popup
    function showPopup(message, type) {
        const overlay = document.createElement('div');
        overlay.className = 'lux-notify-overlay';
        const icons = { warn: 'fa-triangle-exclamation', success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
        const titles = { warn: 'Attention', success: 'Success', error: 'Alert', info: 'Notice' };
        const iconClass = icons[type] || icons.info;

        overlay.innerHTML = `
            <div class="lux-notify-card">
                <button class="lux-notify-close">&times;</button>
                <div class="lux-notify-icon ${type}"><i class="fa-solid ${iconClass}"></i></div>
                <h3>${titles[type] || 'Notice'}</h3>
                <p></p>
                <button class="lux-notify-btn">OK</button>
            </div>
        `;
        overlay.querySelector('p').innerText = message;
        document.body.appendChild(overlay);

        // Show with animation
        requestAnimationFrame(() => overlay.classList.add('show'));

        function close() {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        }
        overlay.querySelector('.lux-notify-close').onclick = close;
        overlay.querySelector('.lux-notify-btn').onclick = close;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    }

    // Public function
    window.showLuxPopup = function (message, type) {
        showPopup(message || '', type || 'info');
    };

    // Override default alert() with luxury popup
    window.alert = function (message) {
        showPopup(message, 'warn');
    };
})();

// Escape string for safe embedding in onclick / inline JS attribute
window.escAttr = function (s) {
    return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, '\\n');
};

// Cart Management System
function getCart() {
    return JSON.parse(localStorage.getItem('bayt_cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('bayt_cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cart = getCart();
    const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const countEl = document.getElementById('cartCount');
    if (countEl) {
        countEl.textContent = totalCount;
    }
}

function addToCart(name, price, image, id, stock, size = '') {
    let cart = getCart();
    const selectedSize = String(size || '').trim();
    const existingIndex = cart.findIndex(item =>
        ((id && item.id === id) || (!id && item.name === name)) && String(item.size || '') === selectedSize
    );
    
    let currentQty = 0;
    if (existingIndex > -1) {
        currentQty = cart[existingIndex].quantity || 1;
    }
    
    // Stock validation: check if adding 1 more would exceed stock
    if (stock !== undefined && stock !== null && stock >= 0) {
        const maxStock = Number(stock);
        if (maxStock <= 0) {
            alert('This product is currently out of stock!');
            return;
        }
        const totalProductQty = cart.reduce((sum, item) => {
            const isSameProduct = id ? item.id === id : item.name === name;
            return sum + (isSameProduct ? Number(item.quantity || 1) : 0);
        }, 0);
        if ((totalProductQty + 1) > maxStock) {
            alert(`Only ${maxStock} unit${maxStock > 1 ? 's' : ''} available in stock. You already have ${totalProductQty} in your bag.`);
            return;
        }
    }
    
    if (existingIndex > -1) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity || 1) + 1;
        if (id) cart[existingIndex].id = id;
    } else {
        cart.push({ name, price, image, id: id || '', size: selectedSize, quantity: 1 });
    }
    
    saveCart(cart);
}

// Direct Add to Cart helper for dynamic buttons
function addToCartDirect(name, price, image, id, stock, size = '') {
    addToCart(name, price, image, id, stock, size);
    alert(name + (size ? ` (${size})` : '') + " has been added to your bag!");
}

// --- Checkout Function with Login Protection ---
function proceedToCheckout() {
    let user = localStorage.getItem('bayt_user');
    
    if (!user) {
        openLoginModal();
        return;
    }
    window.location.href = 'checkout.html';
}

// --- Professional Login System Functions ---
function openLoginModal() {
    let modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
    let modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
}

function handleLogin(event) {
    event.preventDefault();
    let email = document.getElementById('loginEmail').value;
    
    localStorage.setItem('bayt_user', email);
    
    closeLoginModal();
    checkUserLoginStatus();
}

function checkUserLoginStatus() {
    let user = localStorage.getItem('bayt_user');
    let loginBtn = document.getElementById('loginNavBtn') || document.querySelector('.nav-actions a[href*="contact"], .nav-actions .nav-action-btn');
    if (user && loginBtn) {
        loginBtn.style.display = 'none';
    }
}

// --- Quick View Modal Functions ---
let currentModalProduct = {};

function openModal(title, price, img, desc, arg5, arg6) {
    // Robust: detect argument order. Pages may call either:
    //   openModal(title, price, img, desc, id, stock)   [script.js order]
    //   openModal(title, price, img, desc, stock, id)   [legacy page order]
    let id, stock;
    // Detect argument order. Pages call either:
    //   openModal(title, price, img, desc, stock, id)   [stock passed as NUMBER]
    //   openModal(title, price, img, desc, id, stock)   [id passed as STRING]
    // NOTE: Product IDs are numeric strings (e.g. "1785563931319"), so we must
    // only treat arg5 as stock when it is a NUMBER type, never a numeric string.
    if (typeof arg5 === 'number') {
        // arg5 is a number -> order is (desc, stock, id)
        stock = Number(arg5);
        id = arg6;
    } else {
        // arg5 is the id (string) -> order is (desc, id, stock)
        id = arg5;
        stock = Number(arg6);
    }

    window.location.href = `product-detail.html?id=${encodeURIComponent(id || '')}&name=${encodeURIComponent(title || '')}`;
    return;

    currentModalProduct = { name: title, price: price, image: img, id: id || '', stock: Number(stock) || 0 };
    let modalTitle = document.getElementById('modalTitle');
    let modalPrice = document.getElementById('modalPrice');
    let modalImg = document.getElementById('modalImg');
    let modalDesc = document.getElementById('modalDesc');
    let modalStock = document.getElementById('modalStock');
    let modalAddBtn = document.getElementById('modalAddToBag');
    let modal = document.getElementById('quickViewModal') || document.getElementById('productModal');

    if (modalTitle) modalTitle.innerText = title;
    if (modalPrice) modalPrice.innerText = 'Rs. ' + Number(price).toLocaleString();
    if (modalImg) modalImg.src = img;
    if (modalDesc) modalDesc.innerText = desc || 'An exquisite oriental fragrance.';

    // Stock handling
    let isInStock = Number(stock) > 0;
    if (modalStock) {
        modalStock.innerHTML = isInStock
            ? '<span style="color: #2ecc71;"><i class="fa-solid fa-circle-check"></i> In Stock (' + stock + ' available)</span>'
            : '<span style="color: #e74c3c;"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</span>';
    }
    if (modalAddBtn) {
        if (isInStock) {
            modalAddBtn.innerText = 'ADD TO BAG';
            modalAddBtn.disabled = false;
            modalAddBtn.style.opacity = '1';
            modalAddBtn.style.cursor = 'pointer';
        } else {
            modalAddBtn.innerText = 'OUT OF STOCK';
            modalAddBtn.disabled = true;
            modalAddBtn.style.opacity = '0.5';
            modalAddBtn.style.cursor = 'not-allowed';
        }
    }

    if (modal) modal.style.display = 'flex';
}

window.goToProductPage = function(id, name) {
    window.location.href = `product-detail.html?id=${encodeURIComponent(id || '')}&name=${encodeURIComponent(name || '')}`;
};

function closeModal() {
    let qModal = document.getElementById('quickViewModal');
    let pModal = document.getElementById('productModal');
    if (qModal) qModal.style.display = 'none';
    if (pModal) pModal.style.display = 'none';
}

function addToBagFromModal() {
    if(currentModalProduct.name) {
        addToCartDirect(currentModalProduct.name, currentModalProduct.price, currentModalProduct.image, currentModalProduct.id, currentModalProduct.stock);
        closeModal();
    }
}

// --- Reusable Product Card Generator ---
window.generateProductCardHTML = function(p) {
    let priceVal = (Array.isArray(p.sizes) && p.sizes.length ? p.sizes[0].price : null) || p.price50ml || p.offerPrice || p.price || 0;
    let pName = p.name || '';
    let pImg = p.image || '';
    let pDesc = p.description || 'Exquisite oriental fragrance.';
    let pNotes = p.notes || 'Fragrance notes available in the product details.';
    let pOffer = p.offer || p.saleLabel || '';
    let pStock = Number(p.stock) || 0;
    let offerBadge = pOffer ? `<span class="sale-badge">${pOffer}</span>` : '';
    let stockBadge = pStock > 0 ? `<span class="stock-badge in-stock">In Stock</span>` : '<span class="stock-badge out-of-stock">Out of Stock</span>';
    let pId = p.id || '';
    let sName = window.escAttr(pName);
    let sImg = window.escAttr(pImg);
    let sNotes = window.escAttr(pNotes);
    let sDesc = window.escAttr(`${pDesc} Notes: ${pNotes}`);

return `
<div class="product-card" style="cursor: pointer;" onclick="window.location.href='product-detail.html?id=${encodeURIComponent(pId)}&name=${encodeURIComponent(pName)}'">
            ${offerBadge}
            <img src="${pImg}" alt="${pName}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 4px;">
            <span class="brand-name" style="display: block; font-size: 0.8rem; color: #aaa; margin-top: 10px;">CALVIER ESSENCE</span>
            <h3 style="font-size: 1.1rem; color: #fff; margin: 5px 0;">${pName}</h3>
            <div class="price-box" style="margin-bottom: 10px;">
                <span class="new-price variant-price" style="color: var(--gold, #d4af37); font-weight: 600;">Rs. ${Number(priceVal).toLocaleString()}</span>
            </div>
            <p class="product-desc" style="color: #bbb; font-size: 0.9rem; line-height: 1.5; margin: 0 0 12px 0; min-height: 40px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${pDesc}</p>
            <p class="product-notes"><strong>Notes:</strong> ${sNotes}</p>
            <button class="card-btn" style="width: 100%; padding: 10px; background: var(--gold, #d4af37); border: none; font-weight: 600; cursor: pointer; margin-top: 12px;" onclick="event.stopPropagation(); goToProductPage('${pId}', '${sName}')">View Product</button>
        </div>`;
}

window.selectProductSize = function(button) {
    const picker = button.parentElement;
    picker.querySelectorAll('.size-option').forEach(option => option.classList.remove('active'));
    button.classList.add('active');
    const card = button.closest('.product-card');
    card.querySelector('.variant-price').innerText = 'Rs. ' + Number(button.dataset.price || 0).toLocaleString();
};

window.addSelectedProductToBag = function(button) {
    const size = button.closest('.product-card').querySelector('.size-option.active');
    addToCartDirect(button.dataset.name, Number(size?.dataset.price || 0), button.dataset.image, button.dataset.id, Number(button.dataset.stock || 0), size?.dataset.size || '');
};

// --- Server API se Products utha kar Website par live dikhane ka function ---
async function loadWebsiteCatalog() {
    try {
        // Skip pages that manage their own category-specific product grids
        const managedGrids = ['dynamic-products-grid', 'dynamic-unisex-grid', 'shop-products-grid', 'dynamicProductGrid'];
        const managedEl = managedGrids.map(id => document.getElementById(id)).find(el => el);
        if (managedEl) return;

        let grid = document.querySelector('.product-grid');
        if (!grid) return;

        let products = [];
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                products = await response.json();
            }
        } catch (err) {
            console.error('Error fetching products from server:', err);
        }

        if (!Array.isArray(products) || products.length === 0) {
            products = [
                { name: "Rose Noir Elegance", price: 16500, image: "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=400", category: "WOMEN", description: "An exquisite floral creation blending delicate rose petals with warm undertones and rich amber." },
                { name: "Jasmine Gold Elixir", price: 14500, image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=400", category: "WOMEN", description: "A captivating blend of white jasmine flowers laced with sweet vanilla and soft woody hints." },
                { name: "Royal Amber Femme", price: 18500, image: "https://images.unsplash.com/photo-1615397349754-cfa2066a298e?w=400", category: "WOMEN", description: "A majestic oriental scent featuring deep notes of pure amber, saffron, and velvety musk." }
            ];
        }

grid.innerHTML = '';
        grid.innerHTML = products.map(p => window.generateProductCardHTML(p)).join('');
    } catch (err) {
        console.error('Error loading products:', err);
    }
}

// --- DYNAMIC HEADER LOADER ---
async function loadDynamicHeader() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    const collectionLink = navLinks.querySelector('a[href="collection.html"]');
    if (!collectionLink) return;

try {
        const collectionsRes = await fetch('/api/collections');
        const collections = await collectionsRes.json();

        const parentLi = collectionLink.parentElement;
        parentLi.classList.add('nav-item-dropdown');

        // Add dropdown icon
        collectionLink.innerHTML += ' <i class="fa-solid fa-chevron-down" style="font-size: 0.7em;"></i>';

        const dropdownMenu = document.createElement('ul');
        dropdownMenu.className = 'dropdown-menu';

        // Sirf collections dikhao (View All / Categories sections nahi)
        if (Array.isArray(collections) && collections.length > 0) {
            collections.forEach(coll => {
                dropdownMenu.innerHTML += `<li><a href="collection.html?id=${coll.id}">${coll.name}</a></li>`;
            });
        }

        parentLi.appendChild(dropdownMenu);
    } catch (error) {
        console.error("Failed to load dynamic header collections:", error);
    }
}

function setupMobileMenu() {
    const header = document.querySelector('header');
    const navLinks = header?.querySelector('.nav-links');
    if (!header || !navLinks || header.querySelector('.mobile-menu-toggle')) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-menu-toggle';
    toggle.setAttribute('aria-label', 'Open navigation menu');
    toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
    const toggleMenu = () => {
        const isOpen = header.classList.toggle('mobile-menu-open');
        toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
        toggle.innerHTML = `<i class="fa-solid fa-${isOpen ? 'xmark' : 'bars'}"></i>`;
    };
    toggle.onclick = toggleMenu;
    navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => header.classList.remove('mobile-menu-open')));
    header.insertBefore(toggle, header.querySelector('.nav-actions'));
}

function setupHeaderSearch() {
    const header = document.querySelector('header');
    const actions = header?.querySelector('.nav-actions');
    if (!header || !actions || header.querySelector('.header-search')) return;
    const form = document.createElement('form');
    form.className = 'header-search';
    form.setAttribute('role', 'search');
    form.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Search products" aria-label="Search products">';
    form.addEventListener('submit', event => {
        event.preventDefault();
        const query = form.querySelector('input').value.trim();
        window.location.href = `shop.html${query ? `?search=${encodeURIComponent(query)}` : ''}`;
    });
    header.insertBefore(form, actions);
}

// --- GLOBAL QUICK VIEW MODAL AUTO-INJECTION ---
// Sab pages par ek hi popup ensure karta hai (Home, Shop, Signature, Collection, etc.)
function ensureQuickViewModal() {
    if (document.getElementById('quickViewModal')) return; // pehle se maujood hai
    const modal = document.createElement('div');
    modal.id = 'quickViewModal';
    modal.className = 'quick-view-modal';
    modal.innerHTML = `
        <div class="quick-view-content" onclick="event.stopPropagation()">
            <button class="close-modal" onclick="closeModal()">&times;</button>
            <div style="flex: 1; min-width: 280px;">
                <img id="modalImg" src="" alt="Product" class="modal-product-img" style="width: 100%; object-fit: cover; max-height: 350px;">
            </div>
            <div style="flex: 1; min-width: 280px; display: flex; flex-direction: column; justify-content: center;">
                <span style="color: var(--gold); font-size: 0.8rem; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">✦ Calvier Essence ✦</span>
                <h2 id="modalTitle" style="font-family: 'Cinzel', serif; font-size: 2rem; color: #fff; margin: 5px 0 8px 0; line-height: 1.2;"></h2>
                <div id="modalPrice" style="color: var(--gold); font-size: 1.6rem; font-weight: 700; margin-bottom: 12px;"></div>
                <div id="modalStock" style="font-size: 0.8rem; margin-bottom: 14px;"></div>
                <p id="modalDesc" class="modal-desc-text"></p>
                <button id="modalAddToBag" class="card-btn" style="text-align: center; width: 100%; padding: 14px; font-weight: 600; letter-spacing: 1px; border-radius: 8px; background: linear-gradient(135deg, var(--gold, #d4af37), #aa8537); color: #0b0b0b; border: none; cursor: pointer; transition: 0.3s;" onclick="addToBagFromModal()">Add to Bag</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
}

// --- DYNAMIC FOOTER LOADER ---
async function loadDynamicFooter() {
    const socialContainer = document.getElementById('dynamicSocialLinks');
    if (!socialContainer) return;

    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        const social = settings.general?.social;

        if (social) {
            let linksHTML = '';
            if (social.facebook) linksHTML += `<a href="${social.facebook}" target="_blank" style="color: var(--text-muted);"><i class="fa-brands fa-facebook-f"></i></a>`;
            if (social.twitter) linksHTML += `<a href="${social.twitter}" target="_blank" style="color: var(--text-muted);"><i class="fa-brands fa-twitter"></i></a>`;
            if (social.youtube) linksHTML += `<a href="${social.youtube}" target="_blank" style="color: var(--text-muted);"><i class="fa-brands fa-youtube"></i></a>`;
            if (social.instagram) linksHTML += `<a href="${social.instagram}" target="_blank" style="color: var(--text-muted);"><i class="fa-brands fa-instagram"></i></a>`;
            if (social.pinterest) linksHTML += `<a href="${social.pinterest}" target="_blank" style="color: var(--text-muted);"><i class="fa-brands fa-pinterest-p"></i></a>`;

            if (linksHTML) {
                socialContainer.innerHTML = linksHTML;
            } else {
                socialContainer.innerHTML = '<p style="font-size:0.8rem; color: #666;">No social links configured.</p>';
            }
        }
    } catch (error) {
        console.error("Failed to load dynamic footer links:", error);
        socialContainer.innerHTML = ''; // Hide default links on error
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    checkUserLoginStatus();
    setupMobileMenu();
    setupHeaderSearch();
    loadWebsiteCatalog();
    loadDynamicHeader(); // <-- Yahan function call karein
    loadDynamicFooter(); // <-- Footer ke liye function call karein

    const container = document.getElementById('webgl-container');
    if (container && typeof THREE !== 'undefined') {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xd4af37, 3, 50);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);

        const bodyGeo = new THREE.BoxGeometry(1.2, 2.2, 0.6);
        const bodyMat = new THREE.MeshPhysicalMaterial({
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2,
            transmission: 0.4,
            transparent: true,
            opacity: 0.9
        });
        const bottleBody = new THREE.Mesh(bodyGeo, bodyMat);
        scene.add(bottleBody);
        
        camera.position.z = 5;

        function animate() {
            requestAnimationFrame(animate);
            bottleBody.rotation.y += 0.005;
            renderer.render(scene, camera);
        }
        animate();
    }
});

// Close modals when clicking outside content area
window.onclick = function(event) {
    let loginModal = document.getElementById('loginModal');
    let productModal = document.getElementById('productModal');
    let quickViewModal = document.getElementById('quickViewModal');
    
    if (event.target === loginModal) {
        closeLoginModal();
    }
    if (event.target === productModal || event.target === quickViewModal) {
        closeModal();
    }
};
