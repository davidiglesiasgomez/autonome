// Configuración de la Base de Datos
const db = new Dexie("AutonoMeDB");
db.version(1).stores({
    facturas: 'id, numero, fecha, clienteId',
    clientes: 'id, nif, nombre',
    gastos: 'id, fecha, categoria',
    config: 'id'
});

// Al principio de app.js
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// Si tienes el checkbox en el HTML, asegúrate de que se marque correctamente
window.addEventListener('DOMContentLoaded', async () => {
  // Aplicar tema guardado
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeSwitch = document.getElementById('theme-switch');
  if (themeSwitch) themeSwitch.checked = (savedTheme === 'dark');

  // Cargar la última pestaña visitada o por defecto 'facturas'
  const lastTab = localStorage.getItem('activeTab') || 'facturas';

  // Un pequeño truco: si la pestaña era un formulario, mejor vuelve al listado
  if (lastTab.includes('form')) {
      showTab('facturas');
  } else {
      showTab(lastTab);
  }
});

// Navegación entre pestañas
// Actualiza showTab para incluir el dashboard
function showTab(tabId) {
    localStorage.setItem('activeTab', tabId);
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = 'block';
    }

    if (tabId === 'dash') renderDashboard(); // <--- NUEVO
    if (tabId === 'facturas') renderFacturas();
    if (tabId === 'clientes') renderClientes();
    if (tabId === 'gastos') renderGastos();
    if (tabId === 'config') cargarPerfil();
}

// Y al final de app.js, llama a cargarPerfil para inicializarlo
cargarPerfil();

// Modo Claro/Oscuro
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const target = current === 'light' ? 'dark' : 'light';

  html.setAttribute('data-theme', target);
  localStorage.setItem('theme', target); // Guardamos la elección
}

// Backup (Función básica inicial)
async function exportarTodo() {
  const datos = {
    clientes: await db.clientes.toArray(),
    gastos: await db.gastos.toArray(),
    facturas: await db.facturas.toArray(),
    config: await db.config.toArray(),
    fecha: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(datos, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autonome_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

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
                // FORZAMOS LA APERTURA para que Dexie cree las tablas si no existen
                await db.open(); 

                await db.transaction('rw', db.clientes, db.gastos, db.facturas, db.config, async () => {
                    // Limpiamos con seguridad
                    await Promise.all([
                        db.clientes.clear(),
                        db.gastos.clear(),
                        db.facturas.clear(),
                        db.config.clear()
                    ]);

                    if (data.clientes) await db.clientes.bulkAdd(data.clientes);
                    if (data.gastos) await db.gastos.bulkAdd(data.gastos);
                    if (data.facturas) await db.facturas.bulkAdd(data.facturas);
                    if (data.config) await db.config.bulkAdd(data.config);
                });
                
                alert("Restaurado con éxito.");
                location.reload();
            }
        } catch (err) {
            console.error(err);
            alert("Error crítico al importar. Asegúrate de que el archivo es correcto.");
        }
    };
    reader.readAsText(file);
}

// Gestión de Clientes (CRUD con UUID)
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
      iva: parseFloat(document.getElementById('g-iva').value),
      porcentaje: parseFloat(document.getElementById('g-deduccion').value) || 100 // Por defecto 100%
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

// --- GESTIÓN DEL PERFIL (CONFIG) ---
const formPerfil = document.getElementById('form-perfil');

// Guardar datos del perfil
if (formPerfil) {
    formPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();
        const perfil = {
            id: 'mi-perfil', // ID fijo para que solo haya uno
            nombre: document.getElementById('p-nombre').value,
            nif: document.getElementById('p-nif').value,
            email: document.getElementById('p-email').value,
            calle: document.getElementById('p-calle').value,
            cp: document.getElementById('p-cp').value,
            ciudad: document.getElementById('p-ciudad').value,
            provincia: document.getElementById('p-provincia').value,
            objetivoIrpf: document.getElementById('p-objetivo-irpf').value
        };
        await db.config.put(perfil); // 'put' guarda o sobrescribe
        alert("Perfil actualizado");
    });
}

// Cargar datos del perfil al iniciar o entrar en configuración
async function cargarPerfil() {
    const p = await db.config.get('mi-perfil');
    if (p) {
        document.getElementById('p-nombre').value = p.nombre || "";
        document.getElementById('p-nif').value = p.nif || "";
        document.getElementById('p-email').value = p.email || "";
        document.getElementById('p-calle').value = p.calle || "";
        document.getElementById('p-cp').value = p.cp || "";
        document.getElementById('p-ciudad').value = p.ciudad || "";
        document.getElementById('p-provincia').value = p.provincia || "";
        document.getElementById('p-objetivo-irpf').value = p.objetivoIrpf || "20";
    }
}

// --- GESTIÓN DE FACTURAS ---
const formFactura = document.getElementById('form-factura');

// 1. Rellenar el selector de clientes cuando se abre el formulario
async function prepararNuevaFactura() {
    formFactura.reset();
    document.getElementById('f-id-edit').value = "";

    const clientes = await db.clientes.toArray();
    const select = document.getElementById('f-cliente-select');

    select.innerHTML = '<option value="">-- Selecciona un cliente --</option>' +
        clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    showTab('form-factura');
}

// 2. Cálculo automático de totales mientras escribes
function calcularTotalesFactura() {
    const base = parseFloat(document.getElementById('f-base').value) || 0;
    const iva = parseFloat(document.getElementById('f-iva').value) || 0;
    const irpf = parseFloat(document.getElementById('f-irpf').value) || 0;

    const cuotaIva = base * (iva / 100);
    const cuotaIrpf = base * (irpf / 100);
    const total = base + cuotaIva - cuotaIrpf;

    document.getElementById('f-total-display').innerText = total.toFixed(2) + " €";
}

document.getElementById('f-base').addEventListener('input', calcularTotalesFactura);
document.getElementById('f-iva').addEventListener('input', calcularTotalesFactura);
document.getElementById('f-irpf').addEventListener('input', calcularTotalesFactura);

// 3. Guardar Factura con SNAPSHOT
formFactura.addEventListener('submit', async (e) => {
    e.preventDefault();

    const clienteId = document.getElementById('f-cliente-select').value;
    const clienteOriginal = await db.clientes.get(clienteId);
    const miPerfil = await db.config.get('mi-perfil');

    if (!miPerfil) {
        alert("Primero debes rellenar tus datos en Configuración");
        return;
    }

    const facturaData = {
        id: document.getElementById('f-id-edit').value || crypto.randomUUID(),
        numero: document.getElementById('f-numero').value,
        fecha: document.getElementById('f-fecha').value,
        concepto: document.getElementById('f-concepto').value,
        base: parseFloat(document.getElementById('f-base').value),
        iva: parseFloat(document.getElementById('f-iva').value),
        irpf: parseFloat(document.getElementById('f-irpf').value),

        // CONGELAMOS DATOS DEL CLIENTE
        cliente_snapshot: { ...clienteOriginal },

        // CONGELAMOS DATOS DEL EMISOR (TU)
        emisor_snapshot: { ...miPerfil }
    };

    await db.facturas.put(facturaData);
    showTab('facturas');
});

async function renderFacturas() {
    const todas = await db.facturas.orderBy('fecha').reverse().toArray();
    const cuerpo = document.getElementById('lista-facturas');

    cuerpo.innerHTML = todas.map(f => {
        const total = (f.base * (1 + f.iva/100) - (f.base * f.irpf/100)).toFixed(2);
        return `
            <tr>
                <td>${f.numero}</td>
                <td>${f.cliente_snapshot.nombre}</td>
                <td><strong>${total}€</strong></td>
                <td>
                    <div class="grid">
                        <button class="outline" onclick="editarFactura('${f.id}')" title="Editar">✏️</button>
                        <button class="outline" onclick="exportarPDF('${f.id}')" title="PDF">📄</button>
                        <button class="outline secondary" onclick="borrarFactura('${f.id}')" title="Borrar">🗑️</button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

async function editarFactura(id) {
    const f = await db.facturas.get(id);
    if (!f) return;

    // 1. Rellenar el selector de clientes primero (si no, no podemos marcar el actual)
    const clientes = await db.clientes.toArray();
    const select = document.getElementById('f-cliente-select');
    select.innerHTML = '<option value="">-- Selecciona un cliente --</option>' + 
        clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    // 2. Rellenar los campos del formulario
    document.getElementById('f-id-edit').value = f.id;
    document.getElementById('f-numero').value = f.numero;
    document.getElementById('f-fecha').value = f.fecha;
    document.getElementById('f-concepto').value = f.concepto;
    document.getElementById('f-base').value = f.base;
    document.getElementById('f-iva').value = f.iva;
    document.getElementById('f-irpf').value = f.irpf;
    
    // 3. Seleccionar el cliente original (usamos el ID guardado en el snapshot o el original)
    // Nota: Si el cliente fue borrado de la lista general, esta opción no aparecerá 
    // a menos que lo manejemos, pero para edición simple esto funciona:
    select.value = f.cliente_snapshot.id;

    // 4. Cambiar interfaz
    showTab('form-factura');
    document.querySelector('#tab-form-factura h2').innerText = "Editar Factura " + f.numero;
    
    // 5. Recalcular el total visual
    calcularTotalesFactura();
}

async function borrarFactura(id) {
    if (confirm("¿Seguro que quieres eliminar esta factura?")) {
        await db.facturas.delete(id);
        renderFacturas();
        // Si tienes el Dashboard abierto o lo usas, conviene refrescarlo
        if (document.getElementById('tab-dash').style.display === 'block') renderDashboard();
    }
}

async function renderDashboard() {
    // 1. Obtener datos de la DB
    const facturas = await db.facturas.toArray();
    const gastos = await db.gastos.toArray();
    const perfil = await db.config.get('mi-perfil');
    
    // 2. Parámetros de configuración
    const objetivoPorc = (perfil && perfil.p_objetivo_irpf) ? perfil.p_objetivo_irpf / 100 : 0.20;

    // --- CÁLCULOS DE IVA ---
    const ivaCobrado = facturas.reduce((acc, f) => acc + (f.base * (f.iva / 100)), 0);
    const ivaPagado = gastos.reduce((acc, g) => {
        const porc = (g.porcentaje || 100) / 100;
        return acc + ((g.base * (g.iva / 100)) * porc);
    }, 0);
    const huchaIva = ivaCobrado - ivaPagado;

    // --- CÁLCULOS DE IRPF (RETENCIONES Y RESERVA) ---
    const baseTotalIngresos = facturas.reduce((acc, f) => acc + f.base, 0);
    const retencionesYaRealizadas = facturas.reduce((acc, f) => acc + (f.base * (f.irpf / 100)), 0);
    
    // Cuánto deberías haber ahorrado según tu objetivo
    const ahorroTotalTeorico = baseTotalIngresos * objetivoPorc;
    // Cuánto te falta por ahorrar (si el resultado es positivo)
    const faltaPorAhorrar = ahorroTotalTeorico - retencionesYaRealizadas;
    const reservaPreventiva = faltaPorAhorrar > 0 ? faltaPorAhorrar : 0;

    // --- CÁLCULOS DE BENEFICIO REAL ---
    const gastosDeducibles = gastos.reduce((acc, g) => acc + (g.base * ((g.porcentaje || 100) / 100)), 0);
    const resultadoBruto = baseTotalIngresos - gastosDeducibles;
    
    // El sueldo neto es lo que queda tras quitar gastos reales e impuestos (IVA + IRPF total objetivo)
    const sueldoNetoSeguro = baseTotalIngresos - gastosDeducibles - retencionesYaRealizadas - reservaPreventiva;

    // --- RENDERIZADO EN EL HTML ---
    
    // Bloque Superior: Totales
    document.getElementById('dash-ingresos').innerText = baseTotalIngresos.toFixed(2) + "€";
    document.getElementById('dash-gastos').innerText = gastosDeducibles.toFixed(2) + "€";
    document.getElementById('dash-resultado').innerText = resultadoBruto.toFixed(2) + "€";

    // Bloque Inferior: Las Huchas
    document.getElementById('dash-hucha-iva').innerText = huchaIva.toFixed(2) + "€";
    
    document.getElementById('dash-hucha-irpf').innerHTML = `
        <span>${(retencionesYaRealizadas + reservaPreventiva).toFixed(2)}€</span>
        <div style="font-size: 0.7rem; color: #ffcc00; margin-top:5px; font-weight: normal;">
            Ya retenido: ${retencionesYaRealizadas.toFixed(2)}€<br>
            Ahorro extra: ${reservaPreventiva.toFixed(2)}€
        </div>
    `;
    
    document.getElementById('dash-sueldo-real').innerText = sueldoNetoSeguro.toFixed(2) + "€";

    // 2. Avisos de Calendario Fiscal
    const ahora = new Date();
    const mes = ahora.getMonth() + 1; // Enero es 1
    let aviso = "";

    // Lógica simple de trimestres (Modelos 303, 130)
    if ([1, 4, 7, 10].includes(mes)) {
        aviso = `⚠️ <strong>¡Mes de impuestos!</strong> Tienes hasta el día 20 para presentar el trimestre anterior.`;
    } else {
        aviso = `📅 Periodo fiscal tranquilo. Próximas declaraciones en el mes ${mes < 4 ? 'de abril' : mes < 7 ? 'de julio' : mes < 10 ? 'de octubre' : 'de enero'}.`;
    }

    document.getElementById('dash-alertas').innerHTML = aviso;    
}