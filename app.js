// 1. Configuración de la Base de Datos
const db = new Dexie("AutonoMeDB");
db.version(1).stores({
    facturas: 'id, numero, fecha, clienteId',
    clientes: 'id, nif, nombre',
    gastos: 'id, fecha, categoria',
    config: 'id'
});

// 2. Navegación entre pestañas
function showTab(tabId) {
    // Ocultar todas
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Mostrar la seleccionada
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Si la pestaña tiene una función de carga, ejecutarla
    if(tabId === 'clientes') renderClientes();
}

// 3. Gestión de Clientes (CRUD con UUID)
const formCliente = document.getElementById('form-cliente');

formCliente.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nuevoCliente = {
        id: crypto.randomUUID(), // Identificador único universal
        nombre: document.getElementById('c-nombre').value,
        nif: document.getElementById('c-nif').value,
        email: document.getElementById('c-email').value,
        direccion: document.getElementById('c-direccion').value
    };

    try {
        await db.clientes.add(nuevoCliente);
        formCliente.reset();
        showTab('clientes'); // Volver al listado
    } catch (error) {
        alert("Error al guardar el cliente: " + error);
    }
});

async function renderClientes() {
    const todos = await db.clientes.toArray();
    const cuerpo = document.getElementById('lista-clientes');
    cuerpo.innerHTML = todos.map(c => `
        <tr>
            <td>${c.nombre}</td>
            <td>${c.nif}</td>
            <td>
                <button class="outline secondary" onclick="borrarCliente('${c.id}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function borrarCliente(id) {
    if(confirm('¿Borrar cliente?')) {
        await db.clientes.delete(id);
        renderClientes();
    }
}

// 4. Modo Claro/Oscuro
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    html.setAttribute('data-theme', current === 'light' ? 'dark' : 'light');
}

// 5. Backup (Función básica inicial)
async function exportarTodo() {
    const datos = {
        clientes: await db.clientes.toArray(),
        facturas: await db.facturas.toArray(),
        gastos: await db.gastos.toArray()
    };
    const blob = new Blob([JSON.stringify(datos, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autonome_backup.json';
    a.click();
}

// --- GESTIÓN DE GASTOS ---
const formGasto = document.getElementById('form-gasto');

formGasto.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nuevoGasto = {
        id: crypto.randomUUID(),
        fecha: document.getElementById('g-fecha').value,
        categoria: document.getElementById('g-categoria').value,
        concepto: document.getElementById('g-concepto').value,
        base: parseFloat(document.getElementById('g-base').value),
        iva: parseFloat(document.getElementById('g-iva').value)
    };

    await db.gastos.add(nuevoGasto);
    formGasto.reset();
    showTab('gastos');
});

async function renderGastos() {
    const todos = await db.gastos.orderBy('fecha').reverse().toArray();
    const cuerpo = document.getElementById('lista-gastos');
    cuerpo.innerHTML = todos.map(g => {
        const total = (g.base * (1 + g.iva/100)).toFixed(2);
        return `
            <tr>
                <td>${g.fecha}</td>
                <td>${g.concepto}</td>
                <td><mark>${g.categoria}</mark></td>
                <td><strong>${total}€</strong></td>
                <td>
                    <button class="outline secondary" onclick="borrarGasto('${g.id}')">🗑️</button>
                </td>
            </tr>`;
    }).join('');
}

async function borrarGasto(id) {
    if(confirm('¿Borrar este gasto?')) {
        await db.gastos.delete(id);
        renderGastos();
    }
}

// Actualizamos la función showTab para que cargue los gastos al entrar
const originalShowTab = showTab;
showTab = function(tabId) {
    originalShowTab(tabId);
    if(tabId === 'gastos') renderGastos();
};