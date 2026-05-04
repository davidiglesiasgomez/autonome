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
    // 1. Ocultar todas las secciones
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none'; // Aseguramos que se oculten
    });

    // 2. Mostrar la seleccionada
    const activeTab = document.getElementById(`tab-${tabId}`);
    activeTab.classList.add('active');
    activeTab.style.display = 'block';

    // 3. Cargar datos según la pestaña
    if (tabId === 'clientes') renderClientes();
    if (tabId === 'gastos') renderGastos();
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
      gastos: await db.gastos.toArray(),
      facturas: await db.facturas.toArray(), // Incluimos facturas
      fechaExportacion: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(datos, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autonome_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

// async function importarTodo(input) {
//   const file = input.files[0];
//   if (!file) return;

//   const reader = new FileReader();
//   reader.onload = async (e) => {
//       try {
//           const data = JSON.parse(e.target.result);

//           // Verificación básica de que el archivo es nuestro
//           if (!data.clientes || !data.gastos) {
//               throw new Error("El archivo no parece ser un backup válido de AutonoMe.");
//           }

//           const mensaje = `¿Estás seguro? Se borrarán los datos actuales y se cargarán:\n` +
//                           `- ${data.clientes.length} Clientes\n` +
//                           `- ${data.gastos.length} Gastos\n` +
//                           `- ${data.facturas ? data.facturas.length : 0} Facturas`;

//           if (confirm(mensaje)) {
//               // Ejecutamos todo en una transacción atómica
//               await db.transaction('rw', db.clientes, db.gastos, db.facturas, async () => {
//                   // Limpiar tablas actuales
//                   await db.clientes.clear();
//                   await db.gastos.clear();
//                   await db.facturas.clear();

//                   // Insertar datos del JSON
//                   if (data.clientes.length) await db.clientes.bulkAdd(data.clientes);
//                   if (data.gastos.length) await db.gastos.bulkAdd(data.gastos);
//                   if (data.facturas && data.facturas.length) await db.facturas.bulkAdd(data.facturas);
//               });

//               alert("¡Datos restaurados con éxito!");
//               location.reload(); // Recargamos para refrescar todas las tablas
//           }
//       } catch (err) {
//           console.error(err);
//           alert("Error al importar: " + err.message);
//       }
//   };
//   reader.readAsText(file);
//   // Limpiar el input para poder volver a subir el mismo archivo si se desea
//   input.value = '';
// }

const inputImport = document.getElementById('import-file');
if (inputImport) {
    inputImport.addEventListener('change', function() {
        importarTodo(this);
    });
}

// Y asegúrate de que la función esté declarada así:
async function importarTodo(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm("¿Restaurar backup? Se borrarán los datos actuales.")) {
                await db.transaction('rw', db.clientes, db.gastos, db.facturas, async () => {
                    await db.clientes.clear();
                    await db.gastos.clear();
                    await db.facturas.clear();
                    if (data.clientes) await db.clientes.bulkAdd(data.clientes);
                    if (data.gastos) await db.gastos.bulkAdd(data.gastos);
                    if (data.facturas) await db.facturas.bulkAdd(data.facturas);
                });
                alert("Restaurado. La página se recargará.");
                location.reload();
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
    };
    reader.readAsText(file);
}

// 3. Gestión de Clientes (CRUD con UUID)
const formCliente = document.getElementById('form-cliente');

formCliente.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idEdit = document.getElementById('c-id-edit').value;
  const clienteData = {
      nombre: document.getElementById('c-nombre').value,
      nif: document.getElementById('c-nif').value,
      email: document.getElementById('c-email').value,
      calle: document.getElementById('c-calle').value,
      cp: document.getElementById('c-cp').value,
      ciudad: document.getElementById('c-ciudad').value,
      provincia: document.getElementById('c-provincia').value
  };

  if (idEdit) {
      // ACTUALIZAR
      await db.clientes.update(idEdit, clienteData);
  } else {
      // CREAR NUEVO
      clienteData.id = crypto.randomUUID();
      await db.clientes.add(clienteData);
  }

  formCliente.reset();
  document.getElementById('c-id-edit').value = ""; // Limpiar ID de edición
  showTab('clientes');
});

async function renderClientes() {
  const todos = await db.clientes.toArray();
  const cuerpo = document.getElementById('lista-clientes');
  cuerpo.innerHTML = todos.map(c => `
      <tr>
          <td>${c.nombre}</td>
          <td>${c.nif}</td>
          <td>
              <div class="grid">
                  <button class="outline" onclick="editarCliente('${c.id}')">✏️</button>
                  <button class="outline secondary" onclick="borrarCliente('${c.id}')">🗑️</button>
              </div>
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

// --- GESTIÓN DE GASTOS ---
const formGasto = document.getElementById('form-gasto');

formGasto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idEdit = document.getElementById('g-id-edit').value;
  const gastoData = {
      fecha: document.getElementById('g-fecha').value,
      categoria: document.getElementById('g-categoria').value,
      concepto: document.getElementById('g-concepto').value,
      base: parseFloat(document.getElementById('g-base').value),
      iva: parseFloat(document.getElementById('g-iva').value)
  };

  if (idEdit) {
      await db.gastos.update(idEdit, gastoData);
  } else {
      gastoData.id = crypto.randomUUID();
      await db.gastos.add(gastoData);
  }

  formGasto.reset();
  document.getElementById('g-id-edit').value = "";
  showTab('gastos');
});

// FUNCIÓN PARA CARGAR EL GASTO EN EL FORMULARIO
async function editarGasto(id) {
  const g = await db.gastos.get(id);
  if (!g) return;

  document.getElementById('g-id-edit').value = g.id;
  document.getElementById('g-fecha').value = g.fecha;
  document.getElementById('g-categoria').value = g.categoria;
  document.getElementById('g-concepto').value = g.concepto;
  document.getElementById('g-base').value = g.base;
  document.getElementById('g-iva').value = g.iva;

  showTab('form-gasto');
  document.querySelector('#tab-form-gasto h2').innerText = "Editar Gasto";
}

// FUNCIÓN PARA LIMPIAR ANTES DE CREAR NUEVO
function prepararNuevoGasto() {
  formGasto.reset();
  document.getElementById('g-id-edit').value = "";
  document.querySelector('#tab-form-gasto h2').innerText = "Nuevo Gasto";
  showTab('form-gasto');
}

async function renderGastos() {
  const todos = await db.gastos.orderBy('fecha').reverse().toArray();
  const cuerpo = document.getElementById('lista-gastos');
  if (!cuerpo) return;

  cuerpo.innerHTML = todos.map(g => {
      const total = (g.base * (1 + g.iva/100)).toFixed(2);
      return `
          <tr>
              <td>${g.fecha}</td>
              <td>${g.concepto}</td>
              <td><mark>${g.categoria}</mark></td>
              <td><strong>${total}€</strong></td>
              <td>
                  <div class="grid">
                      <button class="outline" onclick="editarGasto('${g.id}')" style="padding: 0 5px;">✏️</button>
                      <button class="outline secondary" onclick="borrarGasto('${g.id}')" style="padding: 0 5px;">🗑️</button>
                  </div>
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

async function editarCliente(id) {
  const c = await db.clientes.get(id);
  if (!c) return;

  // Rellenamos los campos
  document.getElementById('c-id-edit').value = c.id;
  document.getElementById('c-nombre').value = c.nombre;
  document.getElementById('c-nif').value = c.nif;
  document.getElementById('c-email').value = c.email || "";
  document.getElementById('c-calle').value = c.calle || "";
  document.getElementById('c-cp').value = c.cp || "";
  document.getElementById('c-ciudad').value = c.ciudad || "";
  document.getElementById('c-provincia').value = c.provincia || "";

  // Cambiamos a la pestaña del formulario
  showTab('form-cliente');
  // Opcional: Cambiar el título del formulario para que el usuario sepa que edita
  document.querySelector('#tab-form-cliente h2').innerText = "Editar Cliente";
}

function prepararNuevoCliente() {
  formCliente.reset();
  document.getElementById('c-id-edit').value = "";
  document.querySelector('#tab-form-cliente h2').innerText = "Nuevo Cliente";
  showTab('form-cliente');
}