// login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuración Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDQXY-scmR5EDXD-t69tyXA-r9T-PqrFYo",
    authDomain: "tiendasdb-dd848.firebaseapp.com",
    projectId: "tiendasdb-dd848",
    storageBucket: "tiendasdb-dd848.appspot.com",
    messagingSenderId: "53919436427",
    appId: "1:53919436427:web:9fd6fb71f9ea37813f4e8e",
    measurementId: "G-GHGCY3SCX8"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Función para iniciar sesión
async function login() {
    const usuarioInput = document.getElementById('usuario');
    const passwordInput = document.getElementById('password');
    const mensaje = document.getElementById('mensaje');

    const usuario = usuarioInput.value.trim();
    const password = passwordInput.value.trim();

    mensaje.textContent = ""; // Limpiamos mensaje anterior

    if (!usuario || !password) {
        mensaje.textContent = "Por favor llena ambos campos.";
        return;
    }

    try {
        const docRef = doc(db, "comeruser", usuario);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            mensaje.textContent = "Usuario no encontrado.";
            return;
        }

        const data = docSnap.data();
        if (data.contraseña === password) {
            // Guardamos el ID en localStorage
            localStorage.setItem('negocioId', usuario);

            // Actualizamos el campo loggin a true
            await updateDoc(docRef, { loggin: true });

            // Redirigimos al panel
            window.location.href = 'panel.html';
        } else {
            mensaje.textContent = "Contraseña incorrecta.";
        }
    } catch (error) {
        console.error("Error en login:", error);
        mensaje.textContent = "Ocurrió un error. Intenta más tarde.";
    }
}

// Listener al botón
document.getElementById('btnLogin').addEventListener('click', login);

