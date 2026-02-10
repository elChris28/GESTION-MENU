let menu = JSON.parse(localStorage.getItem('restoMenu')) || [];
let orders = JSON.parse(localStorage.getItem('restoOrders')) || {};
let currentTable = null;

// Inicialización de mesas y persistencia
function init() {
    const container = document.getElementById('tablesContainer');
    if (!container) return; 
    container.innerHTML = '';
    
    for (let i = 1; i <= 10; i++) {
        // IMPORTANTE: Guardamos el ID como String
        const mesaId = i.toString(); 
        if (!orders[mesaId]) orders[mesaId] = [];
        
        const isOccupied = orders[mesaId].length > 0;
        container.innerHTML += `
            <div class="table-card ${isOccupied ? 'occupied' : ''}" id="mesa-${mesaId}" onclick="openModal('${mesaId}')">
                <h3>Mesa ${mesaId}</h3>
                <p id="status-${mesaId}">${isOccupied ? 'Ocupada' : 'Libre'}</p>
            </div>
        `;
    }
    updateMenuUI();
    renderTakeAwayList();
}

// Gestión de Menú
function addDish() {
    const name = document.getElementById('newDish').value;
    const price = document.getElementById('dishPrice').value;
    const category = document.getElementById('dishCategory').value; // Nueva categoría

    if (name && price) {
        menu.push({ 
            id: Date.now(), 
            name: `${category}: ${name}`, // Guardamos el nombre con su categoría
            price: parseFloat(price),
            baseCategory: category // Para lógica interna
        });
        
        // Limpiar campos
        document.getElementById('newDish').value = '';
        document.getElementById('dishPrice').value = '';
        
        saveAndRefresh();
    }
}

function deleteDish(id) {
    menu = menu.filter(dish => dish.id !== id);
    saveAndRefresh();
}

function updateMenuUI() {
    const select = document.getElementById('dishSelect');
    const display = document.getElementById('menuListDisplay');
    select.innerHTML = '';
    display.innerHTML = '';
    
    menu.forEach(dish => {
        select.innerHTML += `<option value="${dish.id}">${dish.name} ($${dish.price})</option>`;
        display.innerHTML += `
            <span class="badge">${dish.name} 
                <b onclick="deleteDish(${dish.id})" style="color:red; cursor:pointer"> (x)</b>
            </span>`;
    });
}


// Gestión de Pedidos y Cuenta
function saveOrder() {
    const dishId = document.getElementById('dishSelect').value;
    const quantity = parseInt(document.getElementById('dishQuantity').value) || 1;
    const details = document.getElementById('orderDetails').value;
    const dishFound = menu.find(d => d.id == dishId);

    if (dishFound) {
        // 1. Agregar el plato seleccionado
        orders[currentTable].push({ 
            ...dishFound, 
            quantity: quantity, 
            details: details, 
            sent: false 
        });

        // 2. Lógica Automática: Si es pedido "Para Llevar", agregar S/ 1.00 por cada plato
        if (currentTable.toString().startsWith('TA-')) {
            orders[currentTable].push({
                id: "taper-" + Date.now(),
                name: "📦 CARGO POR TAPER",
                price: 1.00,
                quantity: quantity,
                details: "Envase para llevar",
                sent: true // No necesita ir a cocina
            });
        }
        
        saveAndRefresh();
        renderOrders();
    }
}


// 2. Nueva función para BORRAR un plato de la mesa
function deleteOrderItem(index) {
    if (confirm("¿Eliminar este plato del pedido?")) {
        orders[currentTable].splice(index, 1);
        saveAndRefresh();
        renderOrders();
    }
}

// Nueva función para enviar a cocina
function sendToKitchen(index = null) {
    let kitchenQueue = JSON.parse(localStorage.getItem('kitchenQueue')) || [];
    let tableIdStr = currentTable.toString();
    let tableLabel = tableIdStr.startsWith('TA-') ? "Llevar" : `Mesa ${tableIdStr}`;
    let time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let currentTimeStamp = Date.now(); 

    if (index !== null) {
        // --- ENVÍO INDIVIDUAL ---
        let order = orders[tableIdStr][index];
        if (order.sent) return;

        kitchenQueue.push({
            table: tableLabel,
            time: time,
            timestamp: currentTimeStamp,
            isGrouped: false,
            items: [{ 
                name: order.name, 
                quantity: order.quantity, 
                details: order.details // <-- Detalle recuperado
            }]
        });
        order.sent = true;
    } else {
        // --- ENVÍO AGRUPADO (TODO) ---
        let pendingItems = orders[tableIdStr].filter(order => !order.sent);
        if (pendingItems.length === 0) return;

        kitchenQueue.push({
            table: tableLabel,
            time: time,
            timestamp: currentTimeStamp,
            isGrouped: true,
            items: pendingItems.map(p => ({ 
                name: p.name, 
                quantity: p.quantity, 
                details: p.details // <-- Detalle recuperado
            }))
        });

        orders[tableIdStr].forEach(order => order.sent = true);
    }

    localStorage.setItem('kitchenQueue', JSON.stringify(kitchenQueue));
    localStorage.setItem('restoOrders', JSON.stringify(orders)); 
    
    renderOrders();
    init(); 
    alert("¡Pedido enviado a cocina!");
}

// Modifica renderOrders para que muestre el botón individual y el estado
function renderOrders() {
    const list = document.getElementById('currentOrderList');
    const totalSpan = document.getElementById('tableTotal');
    let total = 0;
    list.innerHTML = '';
    
    orders[currentTable].forEach((order, index) => {
        const statusClass = order.sent ? 'sent-badge' : 'pending-badge';
        const statusText = order.sent ? 'En Cocina' : 'Pendiente';
        
        list.innerHTML += `
            <li class="order-item">
                <div style="flex-grow: 1;">
                    <strong>(${order.quantity}x) ${order.name}</strong> 
                    <span class="${statusClass}">${statusText}</span><br>
                    <small>${order.details}</small>
                </div>
                <div style="display: flex; gap: 5px;">
                    ${!order.sent ? `<button class="btn-mini" onclick="sendToKitchen(${index})">👨‍🍳 Enviar</button>` : ''}
                    <button class="btn-delete-item" onclick="deleteOrderItem(${index})">🗑️</button>
                </div>
            </li>`;
        total += (order.price * order.quantity);
    });
    totalSpan.innerText = total.toFixed(2);
}

// FUNCIÓN PARA CERRAR EL MODAL (El botón Volver)
function closeModal() {
    document.getElementById('orderModal').style.display = 'none';
}

// FUNCIÓN PARA CREAR NUEVOS PEDIDOS "PARA LLEVAR"
function createNewTakeAway() {
    const id = "TA-" + Date.now(); // ID único
    orders[id] = []; 
    saveAndRefresh();
    openModal(id);
}

// FUNCIÓN PARA RENDERIZAR LA LISTA DE PEDIDOS PARA LLEVAR
function renderTakeAwayList() {
    const listContainer = document.getElementById('takeAwayList');
    if(!listContainer) return; // Por si el elemento no existe aún
    
    listContainer.innerHTML = '';

    Object.keys(orders).forEach(id => {
        if (id.toString().startsWith('TA-')) {
            const numPedido = id.split('-')[1].slice(-4);
            const isOccupied = orders[id].length > 0;
            
            listContainer.innerHTML += `
                <div class="table-card special ${isOccupied ? 'occupied' : ''}" onclick="openModal('${id}')">
                    <h4>Pedido #${numPedido}</h4>
                    <p>${orders[id].length} platos</p>
                    <small>Para llevar</small>
                </div>
            `;
        }
    });
}


// 4. Ajuste en el Modal Title (dentro de openModal)
function openModal(tableId) {
    currentTable = tableId;
    let title = "";
    if (tableId.toString().startsWith('TA-')) {
        title = "🛍️ Pedido Llevar #" + tableId.split('-')[1].slice(-4);
    } else {
        title = "Mesa " + tableId;
    }
    
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('orderModal').style.display = 'block';
    document.getElementById('orderDetails').value = '';
    renderOrders();
}

// 5. Ajuste en cerrar cuenta (para que borre el pedido de llevar de la lista)
function closeAccount() {
    const total = parseFloat(document.getElementById('tableTotal').innerText);
    const metodo = document.getElementById('paymentMethod').value; // Captura el método elegido
    
    if (total <= 0) {
        alert("No hay consumos en esta mesa.");
        return;
    }

    if(confirm(`¿Cerrar cuenta de $${total.toFixed(2)} con pago en ${metodo}?`)) {
        
        let salesHistory = JSON.parse(localStorage.getItem('restoSales')) || [];
        
        // Guardamos los datos incluyendo el método de pago
        const itemsToSell = orders[currentTable].map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            metodo: metodo, // <--- Guardamos el método aquí
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        }));

        salesHistory = [...salesHistory, ...itemsToSell];
        localStorage.setItem('restoSales', JSON.stringify(salesHistory));

        // Limpiar mesa
        if (currentTable.toString().startsWith('TA-')) {
            delete orders[currentTable];
        } else {
            orders[currentTable] = [];
        }
        
        saveAndRefresh();
        closeModal();
    }
}

// 6. Actualizar saveAndRefresh
function saveAndRefresh() {
    localStorage.setItem('restoMenu', JSON.stringify(menu));
    localStorage.setItem('restoOrders', JSON.stringify(orders));
    updateMenuUI();
    renderTakeAwayList(); // Actualizar la lista de llevar
    // Recargar visual de mesas sin re-renderizar todo el DOM si es posible, 
    // o simplemente llamar a init() para simplificar:
    init(); 
}

init(); // Iniciar al cargar