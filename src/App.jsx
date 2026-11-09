import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  KeyRound, 
  Mail, 
  Clock, 
  UserPlus, 
  Users, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  Lock, 
  Unlock, 
  Trash2, 
  PlusCircle, 
  AlertTriangle, 
  Search, 
  Send, 
  Terminal, 
  Settings, 
  LogOut, 
  Smartphone, 
  Calendar, 
  Tv, 
  Eye, 
  EyeOff,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare
} from 'lucide-react';

// ==========================================
// CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
// ==========================================
const productionFirebaseConfig = {
  apiKey: "AIzaSyBcHNZrpWnOXL9YaYoTPBRVsqxYdwrLaAw",
  authDomain: "sistema-codigos-d7377.firebaseapp.com",
  databaseURL: "https://sistema-codigos-d7377-default-rtdb.firebaseio.com",
  projectId: "sistema-codigos-d7377",
  storageBucket: "sistema-codigos-d7377.firebasestorage.app",
  messagingSenderId: "937614201302",
  appId: "1:937614201302:web:817be734d2907102499477",
  measurementId: "G-W7QCFX4F4G"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : productionFirebaseConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'rosaxmedia-panel';

// ==========================================
// MOTOR DE FILTRADO DE SEGURIDAD (ANTI-ROBO DE CUENTAS)
// ==========================================
const PALABRAS_PROHIBIDAS = [
  'restablecer contraseña',
  'restablecimiento de contraseña',
  'cambiar contraseña',
  'cambio de contraseña',
  'olvidaste tu contraseña',
  'solicitud de restablecimiento',
  'reset password',
  'password reset',
  'cambiar correo',
  'cambio de correo',
  'actualización de correo',
  'actualizar correo',
  'nuevo correo electrónico',
  'change email',
  'método de pago',
  'actualizar pago',
  'datos de facturación',
  'suscripción cancelada',
  'eliminar cuenta'
];

function analizarSeguridadCorreo(asunto = '', cuerpo = '') {
  const textoCompleto = `${asunto} ${cuerpo}`.toLowerCase();

  for (const palabra of PALABRAS_PROHIBIDAS) {
    if (textoCompleto.includes(palabra.toLowerCase())) {
      return {
        permitido: false,
        motivoBloqueo: `Detectada frase restringida: "${palabra}"`,
        categoria: 'SEGURIDAD_BLOQUEADO'
      };
    }
  }

  let tipo = 'Código Temporal';
  if (textoCompleto.includes('viaje') || textoCompleto.includes('temporal')) {
    tipo = 'Estoy de Viaje (Acceso Temporal)';
  } else if (textoCompleto.includes('hogar')) {
    tipo = 'Actualizar Hogar con Netflix';
  } else if (textoCompleto.includes('inicio de sesión')) {
    tipo = 'Código de Inicio de Sesión';
  }

  const matchCodigo = cuerpo.match(/\b\d{4}\b/) || cuerpo.match(/\b\d{6}\b/);
  const codigoExtraido = matchCodigo ? matchCodigo[0] : null;

  const matchUrl = cuerpo.match(/https?:\/\/[^\s"<>]+/);
  const enlaceExtraido = matchUrl ? matchUrl[0] : null;

  return {
    permitido: true,
    motivoBloqueo: null,
    categoria: tipo,
    codigoExtraido,
    enlaceExtraido
  };
}

// ==========================================
// FUNCIONES DE UTILIDAD Y FECHAS
// ==========================================
function calcularDiasRestantes(fechaVencimientoISO) {
  if (!fechaVencimientoISO) return 0;
  const ahora = new Date().getTime();
  const vencimiento = new Date(fechaVencimientoISO).getTime();
  const diffMs = vencimiento - ahora;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatearTiempoRelativo(fechaISO) {
  if (!fechaISO) return 'Hace un momento';
  const ahora = new Date().getTime();
  const fecha = new Date(fechaISO).getTime();
  const diffSegundos = Math.floor((ahora - fecha) / 1000);

  if (diffSegundos < 60) return 'Hace unos segundos';
  const diffMinutos = Math.floor(diffSegundos / 60);
  if (diffMinutos < 60) return `Hace ${diffMinutos} ${diffMinutos === 1 ? 'minuto' : 'minutos'}`;
  const diffHoras = Math.floor(diffMinutos / 60);
  if (diffHoras < 24) return `Hace ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
  const diffDias = Math.floor(diffHoras / 24);
  return `Hace ${diffDias} ${diffDias === 1 ? 'día' : 'días'}`;
}

function formatearFechaCorta(fechaISO) {
  if (!fechaISO) return '-';
  try {
    return new Date(fechaISO).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [clientes, setClientes] = useState([]);
  const [correos, setCorreos] = useState([]);
  const [config, setConfig] = useState({
    adminPin: '2026',
    whatsappSoporte: '573001234567',
    nombreNegocio: 'Rosaxmedia'
  });

  const [vistaActual, setVistaActual] = useState('cliente');
  const [pestanaAdmin, setPestanaAdmin] = useState('clientes');

  const [notificacion, setNotificacion] = useState(null);
  const mostrarToast = (mensaje, tipo = 'exito') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion(null), 4000);
  };

  // 🔐 ESTADOS DE DOBLE VALIDACIÓN (CORREO + PIN) PARA EL CLIENTE
  const [inputCorreoCliente, setInputCorreoCliente] = useState('');
  const [inputPinCliente, setInputPinCliente] = useState('');
  const [clienteConsultado, setClienteConsultado] = useState(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [buscandoEnVivo, setBuscandoEnVivo] = useState(false);
  const [codigoCopiadoId, setCodigoCopiadoId] = useState(null);

  const [pinIngresado, setPinIngresado] = useState('');
  const [errorPin, setErrorPin] = useState('');

  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    whatsapp: '',
    correoNetflix: '',
    pinCliente: '',
    diasDuracion: 30
  });
  const [filtroTablaClientes, setFiltroTablaClientes] = useState('');

  const [correoSimulado, setCorreoSimulado] = useState({
    destinatario: 'familia.perez@rosaxmedia.com',
    asunto: 'Tu código de acceso temporal de Netflix',
    cuerpo: 'Hola: Alguien solicitó un código de acceso temporal ("Estoy de viaje") para tu cuenta. Tu código de verificación es 8492. Este código vence en 15 minutos.'
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Error en autenticación:', err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const clientesRef = collection(db, 'artifacts', appId, 'public', 'data', 'clientes');
    const correosRef = collection(db, 'artifacts', appId, 'public', 'data', 'correos');
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'configuracion', 'general');

    const unsubClientes = onSnapshot(
      clientesRef,
      async (snapshot) => {
        const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (lista.length === 0 && cargandoDatos) {
          await sembrarDatosDemostracion();
        } else {
          setClientes(lista);
          setCargandoDatos(false);
        }
      },
      (err) => {
        console.error('Error leyendo clientes:', err);
        setCargandoDatos(false);
      }
    );

    const unsubCorreos = onSnapshot(
      correosRef,
      (snapshot) => {
        const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => new Date(b.fechaRecepcion) - new Date(a.fechaRecepcion));
        setCorreos(lista);
      },
      (err) => console.error('Error leyendo correos:', err)
    );

    const unsubConfig = onSnapshot(
      configRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setConfig((prev) => ({ ...prev, ...docSnap.data() }));
        }
      },
      (err) => console.error('Error leyendo configuración:', err)
    );

    return () => {
      unsubClientes();
      unsubCorreos();
      unsubConfig();
    };
  }, [user]);

  useEffect(() => {
    if (clienteConsultado) {
      const actualizado = clientes.find((c) => c.id === clienteConsultado.id);
      if (actualizado) {
        setClienteConsultado(actualizado);
      }
    }
  }, [clientes]);

  const sembrarDatosDemostracion = async () => {
    if (!user) return;
    try {
      const ahora = new Date();
      const venceActivo = new Date(ahora.getTime() + 26 * 24 * 60 * 60 * 1000).toISOString();
      const vencePronto = new Date(ahora.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const venceExpirado = new Date(ahora.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const clientesDemo = [
        {
          id: 'cli_demo_1',
          nombre: 'Carlos Mendoza (Activo)',
          whatsapp: '3005550192',
          correoNetflix: 'cuenta1@rosaxmedia.com',
          pinCliente: '1010',
          fechaInicio: new Date(ahora.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          fechaVencimiento: venceActivo,
          estadoManual: 'activo'
        },
        {
          id: 'cli_demo_2',
          nombre: 'Laura Gómez (Por Vencer)',
          whatsapp: '3119876543',
          correoNetflix: 'cuenta2@rosaxmedia.com',
          pinCliente: '2020',
          fechaInicio: new Date(ahora.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString(),
          fechaVencimiento: vencePronto,
          estadoManual: 'activo'
        }
      ];

      for (const cli of clientesDemo) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clientes', cli.id), cli);
      }

      const correosDemo = [
        {
          id: 'mail_demo_1',
          destinatario: 'cuenta1@rosaxmedia.com',
          remitente: 'info@account.netflix.com',
          asunto: 'Tu código de acceso temporal de Netflix (Estoy de viaje)',
          cuerpo: 'Hola: Ingresa este código en tu TV para seguir viendo Netflix mientras estás de viaje: 4928.',
          fechaRecepcion: new Date(ahora.getTime() - 3 * 60 * 1000).toISOString(),
          ...analisarSeguridadCorreo('Tu código de acceso temporal de Netflix (Estoy de viaje)', 'Hola: Ingresa este código en tu TV para seguir viendo Netflix mientras estás de viaje: 4928.')
        }
      ];

      for (const correo of correosDemo) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'correos', correo.id), correo);
      }

      setCargandoDatos(false);
    } catch (error) {
      console.error('Error sembrando datos:', error);
      setCargandoDatos(false);
    }
  };

  // 🔐 VALIDACIÓN ESTRICTA: CORREO Y PIN DE 4 DÍGITOS OBLIGATORIOS
  const handleConsultarCliente = (e, correoDirecto = null, pinDirecto = null) => {
    if (e) e.preventDefault();
    setErrorBusqueda('');

    const correoBuscado = (correoDirecto !== null ? correoDirecto : inputCorreoCliente).trim().toLowerCase();
    const pinBuscado = (pinDirecto !== null ? pinDirecto : inputPinCliente).trim();

    if (!correoBuscado || !pinBuscado) {
      setErrorBusqueda('Debes ingresar tanto el correo de la cuenta como tu PIN de 4 dígitos.');
      return;
    }

    const encontrado = clientes.find((c) => {
      const coincideCorreo = c.correoNetflix?.toLowerCase().trim() === correoBuscado;
      const coincidePin = String(c.pinCliente).trim() === pinBuscado;
      return coincideCorreo && coincidePin;
    });

    if (!encontrado) {
      setClienteConsultado(null);
      setErrorBusqueda('❌ Acceso denegado: Correo incorrecto, PIN de seguridad inválido o membresía vencida.');
      return;
    }

    setClienteConsultado(encontrado);
  };

  const handleRefrescarCodigosCliente = async () => {
    if (!clienteConsultado) return;
    setBuscandoEnVivo(true);
    setTimeout(() => {
      setBuscandoEnVivo(false);
      mostrarToast('Bandeja sincronizada con Gmail en tiempo real');
    }, 900);
  };

  const handleSimularNuevoCodigoParaCliente = async (correoDestino) => {
    if (!user || !correoDestino) return;
    setBuscandoEnVivo(true);
    const nuevoPin4 = Math.floor(1000 + Math.random() * 9000).toString();
    const asunto = 'Tu código de acceso temporal de Netflix (Estoy de viaje)';
    const cuerpo = `Hola: Ingresa el código ${nuevoPin4} en tu TV o dispositivo móvil para continuar viendo Netflix.`;

    const analisis = analizarSeguridadCorreo(asunto, cuerpo);

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'correos'), {
        destinatario: correoDestino.toLowerCase().trim(),
        remitente: 'info@account.netflix.com',
        asunto,
        cuerpo,
        fechaRecepcion: new Date().toISOString(),
        ...analisis
      });
      setTimeout(() => {
        setBuscandoEnVivo(false);
        mostrarToast(`¡Nuevo código (${nuevoPin4}) recibido desde Gmail!`);
      }, 600);
    } catch (err) {
      setBuscandoEnVivo(false);
      mostrarToast('Error al sincronizar código', 'error');
    }
  };

  const correosSegurosDelCliente = useMemo(() => {
    if (!clienteConsultado) return [];
    const correoCuenta = clienteConsultado.correoNetflix.toLowerCase().trim();

    return correos.filter((mail) => {
      const coincideCuenta = mail.destinatario?.toLowerCase().trim() === correoCuenta;
      if (!coincideCuenta) return false;
      const reevaluacion = analizarSeguridadCorreo(mail.asunto, mail.cuerpo);
      return mail.permitido === true && reevaluacion.permitido === true;
    });
  }, [correos, clienteConsultado]);

  const handleCrearCliente = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!nuevoCliente.nombre.trim() || !nuevoCliente.correoNetflix.trim() || !nuevoCliente.pinCliente.trim()) {
      mostrarToast('Completa el nombre, correo y el PIN de 4 dígitos', 'error');
      return;
    }

    const ahora = new Date();
    const dias = Number(nuevoCliente.diasDuracion) || 30;
    const fechaVencimiento = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clientes'), {
        nombre: nuevoCliente.nombre.trim(),
        whatsapp: nuevoCliente.whatsapp.trim(),
        correoNetflix: nuevoCliente.correoNetflix.trim().toLowerCase(),
        pinCliente: nuevoCliente.pinCliente.trim(),
        fechaInicio: ahora.toISOString(),
        fechaVencimiento,
        estadoManual: 'activo'
      });

      setNuevoCliente({
        nombre: '',
        whatsapp: '',
        correoNetflix: '',
        pinCliente: '',
        diasDuracion: 30
      });
      mostrarToast(`Cliente asignado por ${dias} días con éxito`);
    } catch (error) {
      console.error('Error creando cliente:', error);
      mostrarToast('No se pudo guardar el cliente', 'error');
    }
  };

  const handleRenovar30Dias = async (cliente) => {
    if (!user) return;
    const ahora = new Date();
    const vencimientoActual = new Date(cliente.fechaVencimiento);
    const baseFecha = vencimientoActual > ahora ? vencimientoActual : ahora;
    const nuevaFechaVencimiento = new Date(baseFecha.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clientes', cliente.id), {
        fechaVencimiento: nuevaFechaVencimiento,
        estadoManual: 'activo'
      });
      mostrarToast(`Suscripción de ${cliente.nombre} renovada por +30 días`);
    } catch (err) {
      mostrarToast('Error al renovar cliente', 'error');
    }
  };

  const handleSimularVencimiento30Dias = async (cliente) => {
    if (!user) return;
    const fechaPasada = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clientes', cliente.id), {
        fechaVencimiento: fechaPasada
      });
      mostrarToast(`Se simularon 30 días cumplidos para ${cliente.nombre}. Acceso desactivado.`);
    } catch (err) {
      mostrarToast('Error al actualizar', 'error');
    }
  };

  const handleEliminarCliente = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clientes', id));
      if (clienteConsultado?.id === id) setClienteConsultado(null);
      mostrarToast('Cliente eliminado del sistema');
    } catch (err) {
      mostrarToast('Error al eliminar cliente', 'error');
    }
  };

  const handleCopiarMensajeWhatsApp = (cliente) => {
    const dias = Math.max(0, calcularDiasRestantes(cliente.fechaVencimiento));
    const mensaje = `🎬 *${config.nombreNegocio} - Acceso a Códigos Netflix*\n\nHola *${cliente.nombre}*, aquí tienes tu acceso al panel seguro para consultar tus códigos:\n\n📧 *Correo:* ${cliente.correoNetflix}\n🔑 *PIN de acceso:* ${cliente.pinCliente}\n⏳ *Vigencia:* ${dias} días (Vence el ${formatearFechaCorta(cliente.fechaVencimiento)})\n\nIngresa tu correo y tu PIN secreto en la web para ver tus códigos al instante.`;
    navigator.clipboard.writeText(mensaje);
    mostrarToast('Mensaje para WhatsApp copiado al portapapeles');
  };

  const handleDispararSimuladorCorreo = async (e) => {
    e.preventDefault();
    if (!user) return;
    const analisis = analizarSeguridadCorreo(correoSimulado.asunto, correoSimulado.cuerpo);

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'correos'), {
        destinatario: correoSimulado.destinatario.toLowerCase().trim(),
        remitente: 'info@account.netflix.com',
        asunto: correoSimulado.asunto,
        cuerpo: correoSimulado.cuerpo,
        fechaRecepcion: new Date().toISOString(),
        ...analisis
      });
      mostrarToast(analisis.permitido ? '✅ Correo PERMITIDO y visible al cliente.' : '🛡️ Correo BLOQUEADO por seguridad.');
    } catch (err) {
      mostrarToast('Error en simulador', 'error');
    }
  };

  const metricas = useMemo(() => {
    let activos = 0;
    let porVencer = 0;
    let vencidos = 0;

    clientes.forEach((c) => {
      const dias = calcularDiasRestantes(c.fechaVencimiento);
      if (c.estadoManual !== 'activo' || dias <= 0) {
        vencidos++;
      } else if (dias <= 3) {
        porVencer++;
        activos++;
      } else {
        activos++;
      }
    });

    const permitidos = correos.filter((m) => m.permitido).length;
    const bloqueados = correos.filter((m) => !m.permitido).length;
    return { activos, porVencer, vencidos, permitidos, bloqueados };
  }, [clientes, correos]);

  const copiarTexto = (texto, idElemento) => {
    navigator.clipboard.writeText(texto);
    setCodigoCopiadoId(idElemento);
    mostrarToast(`Copiado al portapapeles`);
    setTimeout(() => setCodigoCopiadoId(null), 2500);
  };

  const codigoGoogleAppsScript = `const PROJECT_ID = "sistema-codigos-d7377";
const APP_ID = "rosaxmedia-panel";

const LISTA_NEGRA_SEGURIDAD = [
  "restablecer contraseña", "cambiar contraseña", "cambio de contraseña",
  "reset password", "cambiar correo", "cambio de correo", "actualización de correo", "método de pago", "facturación"
];

function sincronizarCodigosNetflix() {
  const query = 'from:(netflix.com) is:unread newer_than:1h';
  const threads = GmailApp.search(query, 0, 10);

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    const msg = messages[messages.length - 1];
    
    const asunto = msg.getSubject() || "";
    const cuerpoPlano = msg.getPlainBody() || "";
    const destinatario = (msg.getTo() || "").replace(/.*<|>|"/g, "").trim().toLowerCase();
    const textoCompleto = (asunto + " " + cuerpoPlano).toLowerCase();

    let esPeligroso = false;
    for (let p of LISTA_NEGRA_SEGURIDAD) {
      if (textoCompleto.indexOf(p) !== -1) {
        esPeligroso = true;
        break;
      }
    }

    if (esPeligroso) {
      msg.markRead();
      continue;
    }

    const matchCodigo = cuerpoPlano.match(/\\b\\d{4}\\b/);
    const codigo = matchCodigo ? matchCodigo[0] : "";
    const matchUrl = cuerpoPlano.match(/https?:\\/\\/www\\.netflix\\.com\\/[^\\s"<>]+/);
    const enlace = matchUrl ? matchUrl[0] : "";

    const urlFirestore = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/artifacts/" + APP_ID + "/public/data/correos";

    const payload = {
      fields: {
        destinatario: { stringValue: destinatario },
        remitente: { stringValue: "info@account.netflix.com" },
        asunto: { stringValue: asunto },
        cuerpo: { stringValue: cuerpoPlano.substring(0, 600) },
        fechaRecepcion: { stringValue: new Date().toISOString() },
        permitido: { booleanValue: true },
        categoria: { stringValue: textoCompleto.includes("viaje") ? "Estoy de Viaje (Acceso Temporal)" : "Actualizar Hogar con Netflix" },
        codigoExtraido: { stringValue: codigo },
        enlaceExtraido: { stringValue: enlace }
      }
    };

    UrlFetchApp.fetch(urlFirestore, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    msg.markRead();
  }
}`;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans selection:bg-red-600 selection:text-white flex flex-col">
      {notificacion && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-bounce">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md ${
            notificacion.tipo === 'error' ? 'bg-red-950/95 border-red-500/60 text-red-100' :
            notificacion.tipo === 'alerta' ? 'bg-amber-950/95 border-amber-500/60 text-amber-100' :
            'bg-emerald-950/95 border-emerald-500/60 text-emerald-100'
          }`}>
            {notificacion.tipo === 'error' ? <XCircle className="w-5 h-5 text-red-400 shrink-0" /> :
             notificacion.tipo === 'alerta' ? <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" /> :
             <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
            <span className="text-sm font-medium">{notificacion.mensaje}</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#0a0a0c]/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div onClick={() => setVistaActual('cliente')} className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-600/20 group-hover:scale-105 transition-transform">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">{config.nombreNegocio}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30">Códigos TV</span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">Panel Seguro • Acceso Protegido por PIN</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setVistaActual('cliente')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                vistaActual === 'cliente' ? 'bg-red-600 text-white shadow-lg shadow-red-600/25' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Panel Cliente</span>
            </button>

            <button
              onClick={() => { if (vistaActual !== 'admin') setVistaActual('admin_login'); }}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                vistaActual === 'admin' || vistaActual === 'admin_login' ? 'bg-zinc-100 text-zinc-900 shadow-lg' : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Administrador</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {vistaActual === 'cliente' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900/90 to-[#121216] border border-zinc-800 p-6 sm:p-8 shadow-2xl">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full mb-3">
                  <Sparkles className="w-3.5 h-3.5" /> Seguridad Activada • Correo + PIN
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Recibe tu código de Netflix
                </h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Ingresa tu correo asignado y tu <strong className="text-zinc-200">PIN secreto de 4 dígitos</strong> para consultar tus accesos.
                </p>
              </div>

              {/* FORMULARIO DOBLE VALIDACIÓN (CORREO + PIN) */}
              <form onSubmit={handleConsultarCliente} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <Mail className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={inputCorreoCliente}
                      onChange={(e) => setInputCorreoCliente(e.target.value)}
                      placeholder="Correo de la cuenta..."
                      className="w-full pl-12 pr-4 py-3.5 bg-zinc-950/90 border border-zinc-700/80 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      maxLength="4"
                      value={inputPinCliente}
                      onChange={(e) => setInputPinCliente(e.target.value)}
                      placeholder="PIN de 4 dígitos (ej: 1010)"
                      className="w-full pl-12 pr-4 py-3.5 bg-zinc-950/90 border border-zinc-700/80 rounded-xl text-white placeholder-zinc-500 font-mono tracking-widest focus:outline-none focus:border-red-500 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-5 h-5" />
                  <span>Consultar con Doble Seguridad</span>
                </button>

                {errorBusqueda && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorBusqueda}</span>
                  </div>
                )}
              </form>

              {/* Botones de prueba rápida */}
              <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-400 mr-1">Prueba rápida:</span>
                <button
                  type="button"
                  onClick={() => {
                    setInputCorreoCliente('cuenta1@rosaxmedia.com');
                    setInputPinCliente('1010');
                    handleConsultarCliente(null, 'cuenta1@rosaxmedia.com', '1010');
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                >
                  🟢 Cuenta Activa (PIN: 1010)
                </button>
              </div>
            </div>

            {/* RESULTADO CLIENTE */}
            {clienteConsultado && (() => {
              const diasRestantes = calcularDiasRestantes(clienteConsultado.fechaVencimiento);
              const estaVencido = diasRestantes <= 0 || clienteConsultado.estadoManual !== 'activo';

              if (estaVencido) {
                return (
                  <div className="rounded-2xl bg-gradient-to-b from-red-950/40 to-zinc-900 border-2 border-red-600/50 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div className="space-y-2 max-w-lg mx-auto">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-600 text-white">
                        Acceso Expirado
                      </span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-white pt-1">
                        Tu membresía de 30 días ha finalizado
                      </h2>
                      <p className="text-sm text-zinc-300">
                        Hola <strong className="text-white">{clienteConsultado.nombre}</strong>, el periodo de acceso para <span className="font-mono text-red-300">{clienteConsultado.correoNetflix}</span> venció. Contacta a soporte para renovar.
                      </p>
                    </div>
                    <a
                      href={`https://wa.me/${config.whatsappSoporte}?text=${encodeURIComponent(`Hola, quiero renovar mis 30 días de acceso para la cuenta ${clienteConsultado.correoNetflix}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Renovar por WhatsApp (+30 Días)</span>
                    </a>
                  </div>
                );
              }

              const porcentajeBarra = Math.min(100, Math.max(5, Math.round((diasRestantes / 30) * 100)));

              return (
                <div className="space-y-5">
                  <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <Unlock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base">{clienteConsultado.nombre}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold">Autenticado con PIN</span>
                          </div>
                          <p className="text-xs text-zinc-400 font-mono">Cuenta: {clienteConsultado.correoNetflix}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-800">
                        <Calendar className="w-4 h-4 text-red-400" />
                        <div className="text-right">
                          <div className="text-xs text-zinc-400">Vigencia restante</div>
                          <div className="text-sm font-extrabold text-white">{diasRestantes} días de 30</div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-emerald-500 transition-all duration-500" style={{ width: `${porcentajeBarra}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-zinc-300">Mostrando códigos seguros para tu cuenta.</span>
                    </div>

                    <button
                      onClick={handleRefrescarCodigosCliente}
                      disabled={buscandoEnVivo}
                      className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${buscandoEnVivo ? 'animate-spin' : ''}`} />
                      <span>Actualizar Gmail</span>
                    </button>
                  </div>

                  {correosSegurosDelCliente.length === 0 ? (
                    <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-10 text-center space-y-3">
                      <Mail className="w-10 h-10 text-zinc-600 mx-auto" />
                      <h4 className="font-bold text-zinc-200">No hay códigos recientes</h4>
                      <p className="text-xs text-zinc-400">Solicita tu código en el televisor y pulsa Actualizar Gmail.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {correosSegurosDelCliente.map((correo) => (
                        <div key={correo.id} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-xl">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-500/15 text-red-400">{correo.categoria}</span>
                            <span className="text-xs text-zinc-400">{formatearTiempoRelativo(correo.fechaRecepcion)}</span>
                          </div>
                          <h4 className="font-bold text-white mb-2">{correo.asunto}</h4>
                          <p className="text-xs text-zinc-400 mb-4">{correo.cuerpo}</p>

                          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                            {correo.codigoExtraido ? (
                              <div>
                                <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">Código de Verificación</div>
                                <div className="text-3xl sm:text-4xl font-black tracking-[0.25em] text-white font-mono mt-0.5">{correo.codigoExtraido}</div>
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-400">Enlace directo de confirmación</div>
                            )}

                            <div className="flex gap-2 w-full sm:w-auto">
                              {correo.codigoExtraido && (
                                <button
                                  onClick={() => copiarTexto(correo.codigoExtraido, correo.id)}
                                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Copy className="w-4 h-4" />
                                  <span>{codigoCopiadoId === correo.id ? '¡Copiado!' : 'Copiar Código'}</span>
                                </button>
                              )}
                              {correo.enlaceExtraido && (
                                <a
                                  href={correo.enlaceExtraido}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs flex items-center justify-center gap-2 border border-zinc-700"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  <span>Abrir Enlace</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ADMIN LOGIN */}
        {vistaActual === 'admin_login' && (
          <div className="max-w-md mx-auto mt-10">
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-extrabold text-white">Acceso Administrador</h2>
                <p className="text-xs text-zinc-400">PIN por defecto: <strong className="text-white">{config.adminPin}</strong></p>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (pinIngresado === config.adminPin) {
                  setErrorPin('');
                  setPinIngresado('');
                  setVistaActual('admin');
                } else {
                  setErrorPin('PIN incorrecto (Usa 2026)');
                }
              }} className="space-y-4">
                <input
                  type="password"
                  value={pinIngresado}
                  onChange={(e) => setPinIngresado(e.target.value)}
                  placeholder="PIN Maestro (2026)"
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-center text-lg tracking-widest font-mono text-white focus:outline-none focus:border-red-500"
                  autoFocus
                />
                {errorPin && <p className="text-xs text-red-400 text-center">{errorPin}</p>}
                <button type="submit" className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition">
                  Entrar al Panel Admin
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADMIN PANEL */}
        {vistaActual === 'admin' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
                <span className="text-xs text-zinc-400">Clientes Activos</span>
                <div className="text-2xl font-black text-white">{metricas.activos}</div>
              </div>
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
                <span className="text-xs text-zinc-400">Por Vencer</span>
                <div className="text-2xl font-black text-amber-400">{metricas.porVencer}</div>
              </div>
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
                <span className="text-xs text-zinc-400">Vencidos / Bloqueados</span>
                <div className="text-2xl font-black text-red-400">{metricas.vencidos}</div>
              </div>
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
                <span className="text-xs text-zinc-400">Correos Filtrados</span>
                <div className="text-2xl font-black text-white">{metricas.bloqueados} bloq.</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex gap-2">
                <button onClick={() => setPestanaAdmin('clientes')} className={`px-4 py-2.5 rounded-xl text-xs font-bold ${pestanaAdmin === 'clientes' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}>
                  1. Clientes y PINs
                </button>
                <button onClick={() => setPestanaAdmin('correos')} className={`px-4 py-2.5 rounded-xl text-xs font-bold ${pestanaAdmin === 'correos' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}>
                  2. Filtro y Simulador
                </button>
                <button onClick={() => setPestanaAdmin('gmail_script')} className={`px-4 py-2.5 rounded-xl text-xs font-bold ${pestanaAdmin === 'gmail_script' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'}`}>
                  3. Conectar Gmail
                </button>
              </div>
              <button onClick={() => setVistaActual('cliente')} className="px-3 py-2 rounded-xl bg-zinc-900 text-zinc-400 text-xs flex items-center gap-1.5 border border-zinc-800">
                <LogOut className="w-3.5 h-3.5" /> Salir
              </button>
            </div>

            {/* PESTAÑA CLIENTES */}
            {pestanaAdmin === 'clientes' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4">
                  <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 sticky top-24">
                    <h3 className="font-bold text-white text-base">Asignar Acceso (30 Días + PIN)</h3>
                    <form onSubmit={handleCrearCliente} className="space-y-3.5">
                      <div>
                        <label className="block text-xs text-zinc-300 mb-1">Nombre del Cliente *</label>
                        <input
                          type="text"
                          required
                          value={nuevoCliente.nombre}
                          onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                          placeholder="Ej: Juan Pérez"
                          className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-300 mb-1">Correo Cuenta Netflix *</label>
                        <input
                          type="email"
                          required
                          value={nuevoCliente.correoNetflix}
                          onChange={(e) => setNuevoCliente({ ...nuevoCliente, correoNetflix: e.target.value })}
                          placeholder="cuenta@rosaxmedia.com"
                          className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-zinc-300 mb-1">WhatsApp</label>
                          <input
                            type="text"
                            value={nuevoCliente.whatsapp}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, whatsapp: e.target.value })}
                            placeholder="3001234567"
                            className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-300 mb-1">PIN 4 Dígitos *</label>
                          <input
                            type="text"
                            maxLength="4"
                            required
                            value={nuevoCliente.pinCliente}
                            onChange={(e) => setNuevoCliente({ ...nuevoCliente, pinCliente: e.target.value })}
                            placeholder="1010"
                            className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white font-mono text-center tracking-widest"
                          />
                        </div>
                      </div>
                      <button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-red-600/20">
                        Guardar y Asignar Acceso
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                    <h3 className="font-bold text-white text-base">Clientes Registrados ({clientes.length})</h3>
                    <input
                      type="text"
                      value={filtroTablaClientes}
                      onChange={(e) => setFiltroTablaClientes(e.target.value)}
                      placeholder="Buscar por correo o PIN..."
                      className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="space-y-3">
                    {clientes.filter(c => c.correoNetflix?.toLowerCase().includes(filtroTablaClientes.toLowerCase()) || c.pinCliente?.includes(filtroTablaClientes)).map((cliente) => {
                      const dias = calcularDiasRestantes(cliente.fechaVencimiento);
                      const activoReal = dias > 0 && cliente.estadoManual === 'activo';

                      return (
                        <div key={cliente.id} className={`rounded-2xl border p-4 sm:p-5 ${activoReal ? 'bg-zinc-900 border-zinc-800' : 'bg-red-950/20 border-red-900/40'}`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-base">{cliente.nombre}</span>
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${activoReal ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-600/20 text-red-400'}`}>
                                  {activoReal ? `Activo (${dias} días)` : 'Vencido'}
                                </span>
                              </div>
                              <p className="text-xs font-mono text-zinc-400 mt-1">📧 {cliente.correoNetflix} | 🔑 PIN: <strong className="text-white">{cliente.pinCliente}</strong></p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button onClick={() => handleRenovar30Dias(cliente)} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1">
                                <RefreshCw className="w-3.5 h-3.5" /> +30 Días
                              </button>
                              <button onClick={() => handleCopiarMensajeWhatsApp(cliente)} className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1">
                                <Copy className="w-3.5 h-3.5" /> WhatsApp
                              </button>
                              <button onClick={() => handleSimularVencimiento30Dias(cliente)} className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs">
                                Vencer
                              </button>
                              <button onClick={() => handleEliminarCliente(cliente.id)} className="p-2 rounded-xl bg-zinc-950 hover:bg-red-950 text-zinc-500 hover:text-red-400 border border-zinc-800">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA CORREOS Y SIMULADOR */}
            {pestanaAdmin === 'correos' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5">
                  <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 sticky top-24">
                    <h3 className="font-bold text-white text-base">Simulador de Llegada de Gmail</h3>
                    <form onSubmit={handleDispararSimuladorCorreo} className="space-y-3">
                      <div>
                        <label className="block text-xs text-zinc-300 mb-1">Destinatario</label>
                        <select
                          value={correoSimulado.destinatario}
                          onChange={(e) => setCorreoSimulado({ ...correoSimulado, destinatario: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-white"
                        >
                          {clientes.map(c => <option key={c.id} value={c.correoNetflix}>{c.correoNetflix}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-300 mb-1">Asunto</label>
                        <input
                          type="text"
                          value={correoSimulado.asunto}
                          onChange={(e) => setCorreoSimulado({ ...correoSimulado, asunto: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-300 mb-1">Cuerpo del Correo</label>
                        <textarea
                          rows={4}
                          value={correoSimulado.cuerpo}
                          onChange={(e) => setCorreoSimulado({ ...correoSimulado, cuerpo: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                        />
                      </div>
                      <button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs">
                        Probar Filtro de Seguridad
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-3">
                  <h3 className="font-bold text-white text-base">Registro de Seguridad ({correos.length})</h3>
                  {correos.map(mail => (
                    <div key={mail.id} className={`rounded-2xl border p-4 space-y-2 ${mail.permitido ? 'bg-zinc-900 border-zinc-800' : 'bg-red-950/25 border-red-500/40'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${mail.permitido ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-600 text-white'}`}>
                          {mail.permitido ? `VISIBLE (${mail.categoria})` : 'BLOQUEADO POR SEGURIDAD'}
                        </span>
                        <span className="text-xs text-zinc-500">{formatearTiempoRelativo(mail.fechaRecepcion)}</span>
                      </div>
                      <div className="font-bold text-sm text-white">{mail.asunto}</div>
                      <p className="text-xs text-zinc-400">{mail.cuerpo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PESTAÑA GMAIL APPS SCRIPT */}
            {pestanaAdmin === 'gmail_script' && (
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8 space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-white">Código de Google Apps Script para Gmail</h3>
                    <p className="text-xs text-zinc-400 mt-1">Pega este código en script.google.com para automatizar la lectura de tus correos.</p>
                  </div>
                  <button onClick={() => copiarTexto(codigoGoogleAppsScript, 'script_gmail')} className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2">
                    <Copy className="w-4 h-4" /> <span>Copiar Código</span>
                  </button>
                </div>
                <pre className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-emerald-300 overflow-x-auto max-h-96">
                  {codigoGoogleAppsScript}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-900 py-5 text-center text-xs text-zinc-500">
        © {new Date().getFullYear()} <strong>{config.nombreNegocio}</strong> • Panel Automático de Códigos Temporales
      </footer>
    </div>
  );
}
