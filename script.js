const socket = io(); // Conexión en tiempo real

// Configuración de accesos
const PASSWORDS = {
    ventas: "1234",
    cocina: "5678"
};

let targetModule = "";

function checkAccess(module) {
    targetModule = module;
    document.getElementById('loginTitle').innerText = "Acceso a " + module.toUpperCase();
    document.getElementById('loginModal').style.display = 'block';
    document.getElementById('adminPass').value = '';
    document.getElementById('adminPass').focus();
}

function closeLogin() {
    document.getElementById('loginModal').style.display = 'none';
}

document.getElementById('loginBtn').onclick = function() {
    const enteredPass = document.getElementById('adminPass').value;
    if (enteredPass === PASSWORDS[targetModule]) {
        window.location.href = targetModule + '.html';
    } else {
        alert("❌ Contraseña incorrecta");
    }
};

// --- LÓGICA DEL SISTEMA ---
let menu = JSON.parse(localStorage.getItem('restoMenu')) || [];
let orders = JSON.parse(localStorage.getItem('restoOrders')) || {};
let currentTable = null;

function init() {
    const container = document.getElementById('tablesContainer');
    if (!container) return; 
    container.innerHTML = '';
    
    for (let i = 1; i <= 10; i++) {
        const mesaId = i.toString(); 
        if (!orders[mesaId]) orders[mesaId] = [];
        const isOccupied = orders[mesaId].length > 0;
        container.innerHTML += `
            <div class="table-card ${isOccupied ? 'occupied' : ''}" onclick="openModal('${mesaId}')">
                <h3>Mesa ${mesaId}</h3>
                <p>${isOccupied ? 'Ocupada' : 'Libre'}</p>
            </div>`;
    }
    updateMenuUI();
    renderTakeAwayList();
}

function addDish() {
    const name = document.getElementById('newDish').value;
    const price = document.getElementById('dishPrice').value;
    const category = document.getElementById('dishCategory').value;

    if (name && price) {
        menu.push({ 
            id: Date.now(), 
            name: `${category}: ${name}`, 
            price: parseFloat(price),
            baseCategory: category 
        });
        saveAndRefresh();
        document.getElementById('newDish').value = '';
        document.getElementById('dishPrice').value = '';
    }
}

function updateMenuUI() {
    const select = document.getElementById('dishSelect');
    const display = document.getElementById('menuListDisplay');
    if(!select || !display) return;
    select.innerHTML = '';
    display.innerHTML = '';
    
    menu.forEach(dish => {
        select.innerHTML += `<option value="${dish.id}">${dish.name} (S/ ${dish.price})</option>`;
        display.innerHTML += `
            <span class="badge">${dish.name} 
                <b onclick="deleteDish(${dish.id})" style="color:red; cursor:pointer"> (x)</b>
            </span>`;
    });
}

function saveOrder() {
    const dishId = document.getElementById('dishSelect').value;
    const quantity = parseInt(document.getElementById('dishQuantity').value) || 1;
    const details = document.getElementById('orderDetails').value;
    const dishFound = menu.find(d => d.id == dishId);

    if (dishFound) {
        orders[currentTable].push({ 
            ...dishFound, 
            quantity: quantity, 
            details: details, 
            sent: false 
        });

        if (currentTable.toString().startsWith('TA-')) {
            orders[currentTable].push({
                id: "taper-" + Date.now(),
                name: "📦 CARGO POR TAPER",
                price: 1.00,
                quantity: quantity,
                details: "Envase para llevar",
                sent: true 
            });
        }
        saveAndRefresh();
        renderOrders();
    }
}

function sendToKitchen(index = null) {
    let tableIdStr = currentTable.toString();
    let tableLabel = tableIdStr.startsWith('TA-') ? "Llevar" : `Mesa ${tableIdStr}`;
    let time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let itemsToSend = [];
    if (index !== null) {
        let order = orders[tableIdStr][index];
        if (order.sent) return;
        itemsToSend.push({ name: order.name, quantity: order.quantity, details: order.details });
        order.sent = true;
    } else {
        let pending = orders[tableIdStr].filter(o => !o.sent);
        if (pending.length === 0) return;
        itemsToSend = pending.map(p => ({ name: p.name, quantity: p.quantity, details: p.details }));
        orders[tableIdStr].forEach(o => o.sent = true);
    }

    // ENVÍO EN TIEMPO REAL AL SERVIDOR
    socket.emit('nuevo-pedido', {
        table: tableLabel,
        time: time,
        timestamp: Date.now(),
        items: itemsToSend
    });

    saveAndRefresh();
    renderOrders();
    alert("🔥 ¡Pedido enviado a cocina!");
}

function renderOrders() {
    const list = document.getElementById('currentOrderList');
    const totalSpan = document.getElementById('tableTotal');
    let total = 0;
    list.innerHTML = '';
    
    orders[currentTable].forEach((order, index) => {
        list.innerHTML += `
            <li class="order-item">
                <div style="flex-grow: 1;">
                    <strong>(${order.quantity}x) ${order.name}</strong> 
                    <span class="${order.sent ? 'sent-badge' : 'pending-badge'}">${order.sent ? 'En Cocina' : 'Pendiente'}</span><br>
                    <small>${order.details || ''}</small>
                </div>
                <div style="display: flex; gap: 5px;">
                    ${!order.sent ? `<button onclick="sendToKitchen(${index})">👨‍🍳</button>` : ''}
                    <button class="btn-delete-item" onclick="deleteOrderItem(${index})">🗑️</button>
                </div>
            </li>`;
        total += (order.price * order.quantity);
    });
    totalSpan.innerText = total.toFixed(2);
}

function deleteOrderItem(index) {
    orders[currentTable].splice(index, 1);
    saveAndRefresh();
    renderOrders();
}

function openModal(tableId) {
    currentTable = tableId;
    document.getElementById('modalTitle').innerText = tableId.startsWith('TA-') ? "🛍️ Llevar" : "Mesa " + tableId;
    document.getElementById('orderModal').style.display = 'block';
    renderOrders();
}

function closeModal() { document.getElementById('orderModal').style.display = 'none'; }

function createNewTakeAway() {
    const id = "TA-" + Date.now();
    orders[id] = []; 
    saveAndRefresh();
    openModal(id);
}

function renderTakeAwayList() {
    const container = document.getElementById('takeAwayList');
    if(!container) return;
    container.innerHTML = '';
    Object.keys(orders).forEach(id => {
        if (id.startsWith('TA-')) {
            container.innerHTML += `<div class="table-card special ${orders[id].length > 0 ? 'occupied' : ''}" onclick="openModal('${id}')">
                <h4>Pedido #${id.slice(-4)}</h4>
                <p>${orders[id].length} platos</p>
            </div>`;
        }
    });
}

function closeAccount() {
    const total = parseFloat(document.getElementById('tableTotal').innerText);
    const metodo = document.getElementById('paymentMethod').value;
    if (total <= 0) return;

    if(confirm(`¿Cerrar cuenta de S/ ${total.toFixed(2)}?`)) {
        let sales = JSON.parse(localStorage.getItem('restoSales')) || [];
        const newSales = orders[currentTable].map(i => ({ ...i, metodo, date: new Date().toLocaleDateString() }));
        localStorage.setItem('restoSales', JSON.stringify([...sales, ...newSales]));
        
        if (currentTable.startsWith('TA-')) delete orders[currentTable];
        else orders[currentTable] = [];
        
        saveAndRefresh();
        closeModal();
    }
}

function saveAndRefresh() {
    localStorage.setItem('restoMenu', JSON.stringify(menu));
    localStorage.setItem('restoOrders', JSON.stringify(orders));
    init();
}

init();