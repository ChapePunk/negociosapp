// panel.js

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
  solicitarPermisoYToken();  // Inicia Registro SW y token FCM
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

// Para almacenar timers de “asignado”
const asignadoTimers = {};

// 5. ESCUCHAR PEDIDOS
const pedidosRef = collection(db, "pedidos", negocioId, "ordenes");
const pedidosPrevios = new Set();

onSnapshot(pedidosRef, snapshot => {
  // Limpieza de vistas
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

    // Alerta y notificación push
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

    // Contenedor genérico
    const div = document.createElement("div");
    div.classList.add("pedido");
    div.innerHTML = `
      <p><strong>Cliente:</strong> ${pedido.nombre}</p>
      <p><strong>Teléfono:</strong> ${pedido.telefono}</p>
      <p><strong>Dirección:</strong> ${pedido.direccion}</p>
      <p><strong>Referencia:</strong> ${pedido.referencia}</p>
      <p><strong>Productos:</strong> ${
        Array.isArray(pedido.items)
          ? pedido.items.map(p => `${p.name} x${p.quantity}`).join(", ")
          : "Sin productos"
      }</p>
      <p><strong>Estado:</strong> ${pedido.estado}</p>
      <p><strong>Total a cobrar:</strong> $${pedido.total?.baseTotal?.toFixed(2) ?? "N/D"}</p>
    `;

    // SWITCH DE ESTADOS
    switch (pedido.estado) {
      case "pendiente": {
        document.getElementById("pedidoEntrante").style.display = "block";
        const aceptarBtn = document.createElement("button");
        const beeper = document.getElementById("audioentrante");
        if (beeper) beeper.play().catch(() => {});
        aceptarBtn.textContent = "Aceptar Pedido";
        aceptarBtn.addEventListener("click", async () => {
          if (beeper) { beeper.pause(); beeper.currentTime = 0; }
          await updateDoc(pedidoRef, { estado: "buscandorepa" });
        });
        div.appendChild(aceptarBtn);
        document.getElementById("pedidoEntranteContainer")
          .appendChild(div);
        break;
      }

      case "buscandorepa": {
        // Limpia posible timer si venía de "asignado"
        if (asignadoTimers[pedidoId]) {
          clearInterval(asignadoTimers[pedidoId]);
          delete asignadoTimers[pedidoId];
        }
        document.getElementById("buscandoRepartidor").style.display = "block";
        document.getElementById("buscandoRepartidorContainer")
          .appendChild(div);
        break;
      }

      case "asignado": {
        document.getElementById("pedidoAsignado").style.display = "block";
        // Nombre repartidor
        const nombreRepartidor = pedido.repartidorAsignado || "Repartidor desconocido";

        // Div propio
        const pedidoDivId = `pedidoAsignado-${pedidoId}`;
        // Si existía, limpiar
        document.getElementById(pedidoDivId)?.remove();

        const asignDiv = document.createElement("div");
        asignDiv.id = pedidoDivId;
        const info = document.createElement("p");
        info.textContent = `📦 Pedido asignado a: ${nombreRepartidor}`;
        asignDiv.appendChild(info);

        // Cronómetro
        const timerDisplay = document.createElement("p");
        timerDisplay.style.fontWeight = "bold";
        asignDiv.appendChild(timerDisplay);

        let tiempoRestante = 40;
        timerDisplay.textContent = `⏳ Tiempo para aceptar: ${tiempoRestante}s`;

        // Limpia timer previo
        if (asignadoTimers[pedidoId]) {
          clearInterval(asignadoTimers[pedidoId]);
          delete asignadoTimers[pedidoId];
        }

        // Nuevo timer
        asignadoTimers[pedidoId] = setInterval(async () => {
          tiempoRestante--;
          timerDisplay.textContent = `⏳ Tiempo para aceptar: ${tiempoRestante}s`;

          // Si cambió de estado, limpiar todo
          const snapNow = await getDoc(pedidoRef);
          const dataNow = snapNow.data() || {};
          if (dataNow.estado !== "asignado") {
            clearInterval(asignadoTimers[pedidoId]);
            delete asignadoTimers[pedidoId];
            document.getElementById(pedidoDivId)?.remove();
            // oculta sección si está vacía
            const cont = document.getElementById("pedidoAsignadoContainer");
            if (cont.children.length === 0) {
              document.getElementById("pedidoAsignado").style.display = "none";
            }
            return;
          }

          // Si se acabó
          if (tiempoRestante <= 0) {
            clearInterval(asignadoTimers[pedidoId]);
            delete asignadoTimers[pedidoId];
            try {
              // solo si sigue asignado
              if ((await getDoc(pedidoRef)).data().estado === "asignado") {
                await updateDoc(pedidoRef, { estado: "buscandorepa" });
                console.log(`⏱️ Pedido ${pedidoId} regresado a buscandorepa`);
              }
            } catch (err) {
              console.error("Error al actualizar:", err);
            }
            document.getElementById(pedidoDivId)?.remove();
            const cont2 = document.getElementById("pedidoAsignadoContainer");
            if (cont2.children.length === 0) {
              document.getElementById("pedidoAsignado").style.display = "none";
            }
          }
        }, 1000);

        document.getElementById("pedidoAsignadoContainer")
          .appendChild(asignDiv);
        break;
      }

      case "preparando": {
        // limpia timer si existiera
        if (asignadoTimers[pedidoId]) {
          clearInterval(asignadoTimers[pedidoId]);
          delete asignadoTimers[pedidoId];
          // y oculta sección si necesaria
          const cont = document.getElementById("pedidoAsignadoContainer");
          if (cont.children.length === 0) {
            document.getElementById("pedidoAsignado").style.display = "none";
          }
        }
        div.setAttribute("data-id", pedidoId);
        const beep2 = document.getElementById("preparandoSonido");
        if (beep2) beep2.play().catch(() => {});
        const terminarBtn = document.createElement("button");
        terminarBtn.textContent = "Marcar como Terminado";
        terminarBtn.addEventListener("click", async () => {
          await updateDoc(pedidoRef, { estado: "terminado" });
        });
        div.appendChild(terminarBtn);
        document.getElementById("preparandoContainer")
          .appendChild(div);
        break;
      }

      case "terminado": {
        // limpia timer si existiera
        if (asignadoTimers[pedidoId]) {
          clearInterval(asignadoTimers[pedidoId]);
          delete asignadoTimers[pedidoId];
          const cont = document.getElementById("pedidoAsignadoContainer");
          if (cont.children.length === 0) {
            document.getElementById("pedidoAsignado").style.display = "none";
          }
        }
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
        document.getElementById("completadosContainer")
          .appendChild(div);
        break;
      }
    } // fin switch

  }); // fin forEach
}); // fin onSnapshot

// 7. GANANCIAS DEL DÍA
async function cargarGananciasDelDia(negocioId) {
  try {
    const hoy = obtenerFechaActual();
    const docRef = doc(db, "ganancias", negocioId, "diario", hoy);
    const docSnap = await getDoc(docRef);
    const totalElement = document.getElementById("totalGanado");
    let total = docSnap.exists() ? Number(docSnap.data().total) || 0 : 0;
    totalElement.textContent = formatCurrency(total);
    onSnapshot(docRef, snapshot => {
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
  return hoy.toLocaleDateString('en-CA').replace(/\//g, '-'); // YYYY-MM-DD
}

// 9. SOLICITAR PERMISO Y TOKEN FCM
async function solicitarPermisoYToken() {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      console.warn("❌ Permiso de notificaciones denegado");
      return;
    }
    // Registra el SW específico para tu carpeta
    const registration = await navigator.serviceWorker.register(
      '/negociosapp/firebase-messaging-sw.js',
      { scope: '/negociosapp/' }
    );
    console.log('✅ Service Worker registrado:', registration);

    // Obtén el token con ese SW
    const token = await getToken(messaging, {
      vapidKey: 'BItR7-NCvNSGV1HnfohXHMCkU9n5Zd-UqbD0zkoo_Rj53WfjhgsBhsiVZ-7lQYaHGSUTgHNVqMZk7SLwf6OTOWQ',
      serviceWorkerRegistration: registration
    });
    console.log("🔑 Token de notificaciones:", token);

    // Guarda en Firestore
    const tokenRef = doc(db, "tokensNegocios", negocioId);
    await setDoc(tokenRef, { token }, { merge: true });
    console.log("📦 Token guardado en Firestore");

    // Escucha notificaciones en primer plano
    onMessage(messaging, payload => {
      console.log("📨 Notificación recibida en foreground:", payload);
      // Muestra toast o badge si deseas
    });
  } catch (error) {
    console.error("❌ Error en solicitarPermisoYToken:", error);
  }
}
