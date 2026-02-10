const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));

// Aquí guardaremos los pedidos en la memoria del servidor
let kitchenQueue = [];

io.on('connection', (socket) => {
    // Al conectar, enviamos los pedidos actuales al nuevo dispositivo
    socket.emit('cargar-pedidos', kitchenQueue);

    // Cuando el mesero envía un pedido
    socket.on('nuevo-pedido', (pedido) => {
        kitchenQueue.push(pedido);
        io.emit('actualizar-cocina', kitchenQueue); // Avisa a todos
    });

    // Cuando el cocinero marca como listo
    socket.on('pedido-listo', (index) => {
        kitchenQueue.splice(index, 1);
        io.emit('actualizar-cocina', kitchenQueue);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});