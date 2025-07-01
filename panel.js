// 1. IMPORTACIONES
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getMessaging, 
    getToken, 
    onMessage 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { 
    getFirestore,
    doc,
    getDoc,
    updateDoc,
    collection,
    onSnapshot,
    query,
    where,
    getDocs,
    setDoc,
    deleteDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDQXY-scmR5EDXD-t69tyXA-r9T-PqrFYo",
    authDomain: "tiendasdb-dd848.firebaseapp.com",
    projectId: "tiendasdb-dd848",
    storageBucket: "tiendasdb-dd848.appspot.com",
    messagingSenderId: "53919436427",
    appId: "1:53919436427:web:9fd6fb71f9ea37813f4e8e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

// 3. OBTENER NEGOCIO Y MOSTRAR NOMBRE
const negocioId = localStorage.getItem("negocioId");

if (!negocioId) {
    window.location.href = "index.html";
} else {
    document.getElementById("negocioNombre").textContent = negocioId;
    cargarGananciasDelDia(negocioId);
    solicitarPermisoYToken();  // Solicitar notificaciones push
}

// 4. CERRAR SESIÓN
document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (negocioId) {
        try {
            const docRef = doc(db, "comeruser", negocioId);
            await updateDoc(docRef, { loggin: false });
        } catch (error) {
            console.error("Error al actualizar loggin:", error);
        }
    }
    localStorage.removeItem("negocioId");
    window.location.href = "index.html";
});

// 5. MOSTRAR ALERTA VISUAL
function mostrarAlerta(pedidoId) {
    const alerta = document.createElement("div");
    alerta.textContent = `🛎️ ¡Nuevo pedido recibido! (${pedidoId})`;
    Object.assign(alerta.style, {
        position: "fixed", bottom: "20px", right: "20px",
        background: "#ffc107", color: "#000", padding: "10px 20px",
        borderRadius: "10px", zIndex: "9999", boxShadow: "0 0 10px #000"
    });
    document.body.appendChild(alerta);
    setTimeout(() => alerta.remove(), 5000);
}

// 6. ESCUCHAR PEDIDOS
const pedidosRef = collection(db, "pedidos", negocioId, "ordenes");
const pedidosPrevios = new Set();

onSnapshot(pedidosRef, snapshot => {
    document.getElementById("pedidoEntrante").style.display = "none";
    document.getElementById("pedidoEntranteContainer").innerHTML = "";
    document.getElementById("buscandoRepartidor").style.display = "none";
    document.getElementById("buscandoRepartidorContainer").innerHTML = "";
    document.getElementById("preparandoContainer").innerHTML = "";
    document.getElementById("completadosContainer").innerHTML = "";

    snapshot.forEach(docSnap => {
        const pedidoId = docSnap.id;
        const pedido = docSnap.data();
        const pedidoRef = doc(db, "pedidos", negocioId, "ordenes", pedidoId);

        if (!pedidosPrevios.has(pedidoId)) {
            mostrarAlerta(pedidoId);
            if (Notification.permission === "granted") {
                navigator.serviceWorker.getRegistration().then(reg => {
                    reg?.showNotification("🛍️ Nuevo pedido", {
                        body: `Cliente: ${pedido.nombre}`,
                        icon: "https://cdn-icons-png.flaticon.com/512/1046/1046784.png",
                        tag: pedidoId
                    });
                });
            }
        }

        pedidosPrevios.add(pedidoId);

        const div = document.createElement("div");
        div.classList.add("pedido");
        div.innerHTML = `
            <p><strong>Cliente:</strong> ${pedido.nombre}</p>
            <p><strong>Teléfono:</strong> ${pedido.telefono}</p>
            <p><strong>Dirección:</strong> ${pedido.direccion}</p>
            <p><strong>Referencia:</strong> ${pedido.referencia}</p>
            <p><strong>Productos:</strong> ${
                Array.isArray(pedido.items) ? pedido.items.map(p => `${p.name} x${p.quantity}`).join(", ") : "Sin productos"
            }</p>
            <p><strong>Estado:</strong> ${pedido.estado}</p>
            <p><strong>Total a cobrar:</strong> $${pedido.total?.baseTotal?.toFixed(2) ?? "N/D"}</p>
        `;
const asignadoTimers = {}; // Almacena los timers activos por pedidoId

      switch (pedido.estado) {
    case "pendiente": {
        document.getElementById("pedidoEntrante").style.display = "block";
        const aceptarBtn = document.createElement("button");
        const beeper = document.getElementById("audioentrante");
        if (beeper) beeper.play().catch(() => {});
        aceptarBtn.textContent = "Aceptar Pedido";
        aceptarBtn.addEventListener("click", async () => {
            if (beeper) {
                beeper.pause();
                beeper.currentTime = 0;
            }
            await updateDoc(pedidoRef, { estado: "buscandorepa" });
        });
        div.appendChild(aceptarBtn);
        document.getElementById("pedidoEntranteContainer").appendChild(div);
        break;
    }

    case "buscandorepa": {
        document.getElementById("buscandoRepartidor").style.display = "block";
        document.getElementById("buscandoRepartidorContainer").appendChild(div);
        break;
    }

case "asignado": {
    document.getElementById("pedidoAsignado").style.display = "block";
    const nombreRepartidor = pedido.repartidorAsignado || "Repartidor desconocido";
    
    const div = document.createElement("div");
    const pedidoDivId = `pedidoAsignado-${pedidoId}`;
    div.id = pedidoDivId;

    const info = document.createElement("p");
    info.textContent = `📦 Pedido asignado a: ${nombreRepartidor}`;
    div.appendChild(info);

    // Cronómetro
    const timerDisplay = document.createElement("p");
    timerDisplay.style.fontWeight = "bold";
    div.appendChild(timerDisplay);

    let tiempoRestante = 40;
    timerDisplay.textContent = `⏳ Tiempo para aceptar: ${tiempoRestante}s`;

    if (asignadoTimers[pedidoId]) {
        clearInterval(asignadoTimers[pedidoId]);
    }

    asignadoTimers[pedidoId] = setInterval(async () => {
        tiempoRestante--;
        timerDisplay.textContent = `⏳ Tiempo para aceptar: ${tiempoRestante}s`;

        // Verificar si el pedido ya no está en estado asignado
        const snapshot = await getDoc(pedidoRef);
        const datosActuales = snapshot.data();
        if (datosActuales.estado !== "asignado") {
            clearInterval(asignadoTimers[pedidoId]);
            delete asignadoTimers[pedidoId];
            document.getElementById(pedidoDivId)?.remove();

            // Ocultar sección si ya no hay pedidos
            const contenedor = document.getElementById("pedidoAsignadoContainer");
            if (contenedor && contenedor.children.length === 0) {
                document.getElementById("pedidoAsignado").style.display = "none";
            }

            return;
        }

        if (tiempoRestante <= 0) {
            clearInterval(asignadoTimers[pedidoId]);
            delete asignadoTimers[pedidoId];
            try {
                await updateDoc(pedidoRef, { estado: "buscandorepa" });
                console.log(`⏱️ Pedido ${pedidoId} regresado a 'buscandorepa'`);
            } catch (error) {
                console.error("❌ Error al actualizar estado:", error);
            }

            document.getElementById(pedidoDivId)?.remove();

            // Ocultar sección si ya no hay pedidos
            const contenedor = document.getElementById("pedidoAsignadoContainer");
            if (contenedor && contenedor.children.length === 0) {
                document.getElementById("pedidoAsignado").style.display = "none";
            }
        }
    }, 1000);

    document.getElementById("pedidoAsignadoContainer").appendChild(div);
    break;
}




    case "preparando": {
        div.setAttribute("data-id", pedidoId);
        const beep = document.getElementById("preparandoSonido");
        if (beep) beep.play().catch(() => {});
        const terminarBtn = document.createElement("button");
        terminarBtn.textContent = "Marcar como Terminado";
        terminarBtn.addEventListener("click", async () => {
            await updateDoc(pedidoRef, { estado: "terminado" });
        });
        div.appendChild(terminarBtn);
        document.getElementById("preparandoContainer").appendChild(div);
        break;
    }

    case "terminado": {
        const cobrarBtn = document.createElement("button");
        cobrarBtn.textContent = "Cobrar";
        cobrarBtn.addEventListener("click", async () => {
            try {
                const hoy = obtenerFechaActual();
                const gananciasRef = doc(db, "ganancias", negocioId, "diario", hoy);
                await setDoc(gananciasRef, {
                    total: increment(pedido.total?.baseTotal || 0)
                }, { merge: true });
                const historialRef = doc(db, "historialPedidos", negocioId, "ordenes", pedidoId);
                await setDoc(historialRef, pedido);
                await deleteDoc(pedidoRef);
                alert("✅ Pedido cobrado y archivado");
            } catch (error) {
                console.error("Error al cobrar:", error);
                alert("❌ Error al cobrar el pedido");
            }
        });
        div.appendChild(cobrarBtn);
        document.getElementById("completadosContainer").appendChild(div);
        break;
    }
}

    });
});

// 7. GANANCIAS DEL DÍA
async function cargarGananciasDelDia(negocioId) {
    try {
        const hoy = obtenerFechaActual();
        const docRef = doc(db, "ganancias", negocioId, "diario", hoy);
        const docSnap = await getDoc(docRef);
        const totalElement = document.getElementById("totalGanado");
        let total = docSnap.exists() ? Number(docSnap.data().total) || 0 : 0;
        totalElement.textContent = formatCurrency(total);

        onSnapshot(docRef, (snapshot) => {
            const newTotal = snapshot.exists() ? Number(snapshot.data().total) || 0 : 0;
            totalElement.textContent = formatCurrency(newTotal);
        });

    } catch (error) {
        console.error("Error al cargar ganancias:", error);
        document.getElementById("totalGanado").textContent = "$0 (error)";
    }
}

// 8. UTILIDADES
function formatCurrency(amount) {
    return Number.isInteger(amount)
        ? `$${amount.toLocaleString('en-US')}`
        : `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function obtenerFechaActual() {
    const hoy = new Date();
    const opciones = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return hoy.toLocaleDateString('en-CA', opciones).replace(/\//g, '-'); // Formato 'YYYY-MM-DD'
}

// 9. SOLICITAR PERMISO PARA NOTIFICACIONES PUSH
async function solicitarPermisoYToken() {
    try {
        const permiso = await Notification.requestPermission();
        if (permiso === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: 'BItR7-NCvNSGV1HnfohXHMCkU9n5Zd-UqbD0zkoo_Rj53WfjhgsBhsiVZ-7lQYaHGSUTgHNVqMZk7SLwf6OTOWQ'
            });
            console.log("🔑 Token de notificaciones:", token);
            // Aquí puedes guardar el token en Firestore si lo deseas
        } else {
            console.warn("❌ Permiso de notificaciones denegado");
        }
    } catch (error) {
        console.error("Error al obtener token FCM:", error);
    }
}

  


// 10. MARCAR PLATILLO COMO AGOTADO/DISPONIBLE
const platilloSelect = document.getElementById('platilloSelect');
const estadoPlatillo = document.getElementById('estadoPlatillo');

// 🟢 Crear las opciones del selector (platillo_1 a platillo_20)
for (let i = 1; i <= 20; i++) {
  const option = document.createElement('option');
  option.value = `platillo_${i}`;
  option.textContent = `Platillo ${i}`;
  platilloSelect.appendChild(option);
}

platilloSelect.addEventListener('change', async () => {
  const platilloId = platilloSelect.value;
  if (!platilloId) {
    estadoPlatillo.innerHTML = '';
    return;
  }

  try {
    const ref = doc(db, "businesses", negocioId, "menu", platilloId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      estadoPlatillo.innerHTML = `<p>❌ Platillo no encontrado en Firestore.</p>`;
      return;
    }

    const data = snap.data();

    estadoPlatillo.innerHTML = `
      <p><strong>${data.name || platilloId}</strong></p>
      <p>${data.description || ''}</p>
      <label>
        Disponible:
        <input type="checkbox" id="toggleDisponible" ${data.disponible !== false ? 'checked' : ''}>
      </label>
      <button id="guardarEstadoBtn">Guardar</button>
    `;

    document.getElementById('guardarEstadoBtn').addEventListener('click', async () => {
      const nuevoEstado = document.getElementById('toggleDisponible').checked;
      try {
        await updateDoc(ref, { disponible: nuevoEstado });
        alert(`✅ Platillo actualizado a ${nuevoEstado ? 'disponible' : 'agotado'}`);
      } catch (error) {
        console.error(error);
        alert('❌ Error al actualizar el platillo');
      }
    });

  } catch (error) {
    console.error(error);
    estadoPlatillo.innerHTML = `<p>❌ Error al buscar el platillo.</p>`;
  }
});



if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(reg => console.log('✅ SW registrado', reg))
    .catch(err => console.error('❌ Error SW:', err));
}
