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

const PALABRAS_PERMITIDAS = [
  'estoy de viaje',
  'código de acceso temporal',
  'acceso temporal',
  'actualizar hogar',
  'hogar con netflix',
  'confirmar hogar',
  'solicitud de inicio de sesión',
  'código de inicio de sesión',
  'código de verificación'
];

/**
 * Analiza un correo entrante y determina si es seguro mostrarlo al cliente
 * o si debe ser bloqueado por contener información sensible de la cuenta.
 */
function analizarSeguridadCorreo(asunto = '', cuerpo = '') {
  const textoCompleto = `${asunto} ${cuerpo}`.toLowerCase();

  // 1. Verificar lista negra estricta primero (Prioridad máxima)
  for (const palabra of PALABRAS_PROHIBIDAS) {
    if (textoCompleto.includes(palabra.toLowerCase())) {
      return {
        permitido: false,
        motivoBloqueo: `Detectada frase restringida: "${palabra}"`,
        categoria: 'SEGURIDAD_BLOQUEADO'
      };
    }
  }

  // 2. Clasificar el tipo de código permitido
  let tipo = 'Código Temporal';
  if (textoCompleto.includes('viaje') || textoCompleto.includes('temporal')) {
    tipo = 'Estoy de Viaje (Acceso Temporal)';
  } else if (textoCompleto.includes('hogar')) {
    tipo = 'Actualizar Hogar con Netflix';
  } else if (textoCompleto.includes('inicio de sesión')) {
    tipo = 'Código de Inicio de Sesión';
  }

  // 3. Extraer código de 4 o 6 dígitos si existe en el cuerpo
  const matchCodigo = cuerpo.match(/\b\d{4}\b/) || cuerpo.match(/\b\d{6}\b/);
  const codigoExtraido = matchCodigo ? matchCodigo[0] : null;

  // 4. Extraer enlace de aprobación si existe
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
  // Estado de Autenticación Firebase
  const [user, setUser] = useState(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  // Datos en Firestore
  const [clientes, setClientes] = useState([]);
  const [correos, setCorreos] = useState([]);
  const [config, setConfig] = useState({
    adminPin: '2026',
    whatsappSoporte: '573001234567',
    nombreNegocio: 'Rosaxmedia'
  });

  // Navegación de Vistas ('cliente' | 'admin_login' | 'admin')
  const [vistaActual, setVistaActual] = useState('cliente');
  const [pestanaAdmin, setPestanaAdmin] = useState('clientes'); // 'clientes' | 'correos' | 'gmail_script' | 'ajustes'

  // Notificaciones Toast internas (sin alert())
  const [notificacion, setNotificacion] = useState(null);
  const mostrarToast = (mensaje, tipo = 'exito') => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion(null), 4000);
  };

  // Estado Vista Cliente
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [clienteConsultado, setClienteConsultado] = useState(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [buscandoEnVivo, setBuscandoEnVivo] = useState(false);
  const [codigoCopiadoId, setCodigoCopiadoId] = useState(null);

  // Estado Login Admin
  const [pinIngresado, setPinIngresado] = useState('');
  const [errorPin, setErrorPin] = useState('');

  // Estado Formulario Nuevo Cliente (Admin)
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    whatsapp: '',
    correoNetflix: '',
    pinCliente: '',
    diasDuracion: 30
  });
  const [filtroTablaClientes, setFiltroTablaClientes] = useState('');

  // Estado Simulador de Gmail (Admin)
  const [correoSimulado, setCorreoSimulado] = useState({
    destinatario: 'familia.perez@rosaxmedia.com',
    asunto: 'Tu código de acceso temporal de Netflix',
    cuerpo: 'Hola: Alguien solicitó un código de acceso temporal ("Estoy de viaje") para tu cuenta. Tu código de verificación es 8492. Este código vence en 15 minutos. O aprueba desde aquí: https://www.netflix.com/account/travel/verify?token=abc123xyz'
  });

  // 1. Inicializar Autenticación de Firebase (Regla 3)
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

  // 2. Escuchar colecciones de Firestore y sembrar datos iniciales si están vacías
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
        // Ordenar en memoria del más reciente al más antiguo (Regla 2)
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

  // Mantener actualizado el cliente consultado en tiempo real si el admin lo renueva o desactiva
  useEffect(() => {
    if (clienteConsultado) {
      const actualizado = clientes.find((c) => c.id === clienteConsultado.id);
      if (actualizado) {
        setClienteConsultado(actualizado);
      }
    }
  }, [clientes]);

  // ==========================================
  // SEMBRADO DE DATOS DE DEMOSTRACIÓN INICIALES
  // ==========================================
  const sembrarDatosDemostracion = async () => {
    if (!user) return;
    try {
      const ahora = new Date();
      
      // Fecha +26 días (Activo)
      const venceActivo = new Date(ahora.getTime() + 26 * 24 * 60 * 60 * 1000).toISOString();
      // Fecha +2 días (Por vencer)
      const vencePronto = new Date(ahora.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
      // Fecha -3 días (Vencido - Pasaron los 30 días)
      const venceExpirado = new Date(ahora.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

      const clientesDemo = [
        {
          id: 'cli_demo_1',
          nombre: 'Carlos Mendoza (Cliente Activo)',
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
        },
        {
          id: 'cli_demo_3',
          nombre: 'Andrés Silva (Vencido > 30 días)',
          whatsapp: '3201112233',
          correoNetflix: 'vencido@rosaxmedia.com',
          pinCliente: '3030',
          fechaInicio: new Date(ahora.getTime() - 33 * 24 * 60 * 60 * 1000).toISOString(),
          fechaVencimiento: venceExpirado,
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
          cuerpo: 'Hola: Ingresa este código en tu TV o dispositivo para seguir viendo Netflix mientras estás de viaje: 4928. El código expira en 15 minutos. También puedes aprobar desde: https://www.netflix.com/account/travel/verify?code=4928',
          fechaRecepcion: new Date(ahora.getTime() - 3 * 60 * 1000).toISOString(), // Hace 3 min
          ...analizarSeguridadCorreo(
            'Tu código de acceso temporal de Netflix (Estoy de viaje)',
            'Hola: Ingresa este código en tu TV o dispositivo para seguir viendo Netflix mientras estás de viaje: 4928. El código expira en 15 minutos. También puedes aprobar desde: https://www.netflix.com/account/travel/verify?code=4928'
          )
        },
        {
          id: 'mail_demo_2',
          destinatario: 'cuenta1@rosaxmedia.com',
          remitente: 'info@account.netflix.com',
          asunto: 'Importante: Cómo actualizar tu Hogar con Netflix',
          cuerpo: 'Confirma que este televisor forma parte de tu Hogar con Netflix haciendo clic en el botón de abajo o usando el código de confirmación 7731. https://www.netflix.com/account/update-primary-location?token=hogar7731',
          fechaRecepcion: new Date(ahora.getTime() - 42 * 60 * 1000).toISOString(), // Hace 42 min
          ...analizarSeguridadCorreo(
            'Importante: Cómo actualizar tu Hogar con Netflix',
            'Confirma que este televisor forma parte de tu Hogar con Netflix haciendo clic en el botón de abajo o usando el código de confirmación 7731. https://www.netflix.com/account/update-primary-location?token=hogar7731'
          )
        },
        {
          id: 'mail_demo_3',
          destinatario: 'cuenta1@rosaxmedia.com',
          remitente: 'info@account.netflix.com',
          asunto: 'Completa tu solicitud de restablecimiento de contraseña',
          cuerpo: 'Alguien solicitó restablecer contraseña de tu cuenta cuenta1@rosaxmedia.com. Haz clic aquí para cambiar contraseña: https://www.netflix.com/password-reset-secret-link',
          fechaRecepcion: new Date(ahora.getTime() - 15 * 60 * 1000).toISOString(), // Hace 15 min (BLOQUEADO)
          ...analizarSeguridadCorreo(
            'Completa tu solicitud de restablecimiento de contraseña',
            'Alguien solicitó restablecer contraseña de tu cuenta cuenta1@rosaxmedia.com. Haz clic aquí para cambiar contraseña: https://www.netflix.com/password-reset-secret-link'
          )
        },
        {
          id: 'mail_demo_4',
          destinatario: 'cuenta2@rosaxmedia.com',
          remitente: 'info@account.netflix.com',
          asunto: 'Código de acceso temporal para Estoy de viaje',
          cuerpo: 'Tu código de verificación temporal de Netflix es 9104. Úsalo en los próximos 15 minutos.',
          fechaRecepcion: new Date(ahora.getTime() - 8 * 60 * 1000).toISOString(),
          ...analizarSeguridadCorreo(
            'Código de acceso temporal para Estoy de viaje',
            'Tu código de verificación temporal de Netflix es 9104. Úsalo en los próximos 15 minutos.'
          )
        }
      ];

      for (const correo of correosDemo) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'correos', correo.id), correo);
      }

      setCargandoDatos(false);
    } catch (error) {
      console.error('Error sembrando datos iniciales:', error);
      setCargandoDatos(false);
    }
  };

  // ==========================================
  // LÓGICA DE CONSULTA DEL CLIENTE Y FILTRADO
  // ==========================================
  const handleConsultarCliente = (e, valorDirecto = null) => {
    if (e) e.preventDefault();
    setErrorBusqueda('');
    const termino = (valorDirecto !== null ? valorDirecto : busquedaCliente).trim().toLowerCase();

    if (!termino) {
      setErrorBusqueda('Por favor ingresa el correo de tu cuenta asignada o tu PIN de cliente.');
      return;
    }

    const encontrado = clientes.find(
      (c) =>
        c.correoNetflix?.toLowerCase() === termino ||
        c.pinCliente?.toLowerCase() === termino ||
        c.whatsapp?.toLowerCase() === termino
    );

    if (!encontrado) {
      setClienteConsultado(null);
      setErrorBusqueda('No encontramos ninguna cuenta asociada a ese correo o PIN. Verifica los datos con soporte.');
      return;
    }

    setClienteConsultado(encontrado);
  };

  // Simular refresco/sincronización con Gmail para el cliente activo
  const handleRefrescarCodigosCliente = async () => {
    if (!clienteConsultado) return;
    setBuscandoEnVivo(true);
    setTimeout(() => {
      setBuscandoEnVivo(false);
      mostrarToast('Bandeja sincronizada con Gmail en tiempo real');
    }, 900);
  };

  // Generar un código de prueba instantáneo para el cliente actual (para que el usuario pueda probar la experiencia enseguida)
  const handleSimularNuevoCodigoParaCliente = async (correoDestino) => {
    if (!user || !correoDestino) return;
    setBuscandoEnVivo(true);
    const nuevoPin4 = Math.floor(1000 + Math.random() * 9000).toString();
    const asunto = 'Tu código de acceso temporal de Netflix (Estoy de viaje)';
    const cuerpo = `Hola: Solicitud de Estoy de viaje recibida. Ingresa el código ${nuevoPin4} en tu TV o dispositivo móvil para continuar viendo Netflix. También puedes aprobar directamente en: https://www.netflix.com/account/travel/verify?code=${nuevoPin4}`;

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

  // Filtrar correos del cliente consultado (APLICANDO DOBLE CAPA DE SEGURIDAD)
  const correosSegurosDelCliente = useMemo(() => {
    if (!clienteConsultado) return [];
    const correoCuenta = clienteConsultado.correoNetflix.toLowerCase().trim();

    return correos.filter((mail) => {
      // 1. Que pertenezca únicamente al correo asignado a este cliente
      const coincideCuenta = mail.destinatario?.toLowerCase().trim() === correoCuenta;
      if (!coincideCuenta) return false;

      // 2. Verificación en tiempo real contra palabras prohibidas (Restablecer contraseña / cambio de correo)
      const reevaluacion = analizarSeguridadCorreo(mail.asunto, mail.cuerpo);
      return mail.permitido === true && reevaluacion.permitido === true;
    });
  }, [correos, clienteConsultado]);

  // ==========================================
  // ACCIONES DEL ADMINISTRADOR
  // ==========================================
  const handleCrearCliente = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!nuevoCliente.nombre.trim() || !nuevoCliente.correoNetflix.trim()) {
      mostrarToast('Completa el nombre del cliente y el correo de Netflix', 'error');
      return;
    }

    const ahora = new Date();
    const dias = Number(nuevoCliente.diasDuracion) || 30;
    const fechaVencimiento = new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000).toISOString();
    const pinGenerado = nuevoCliente.pinCliente.trim() || Math.floor(1000 + Math.random() * 9000).toString();

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clientes'), {
        nombre: nuevoCliente.nombre.trim(),
        whatsapp: nuevoCliente.whatsapp.trim(),
        correoNetflix: nuevoCliente.correoNetflix.trim().toLowerCase(),
        pinCliente: pinGenerado,
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

  // Renovar +30 días automáticamente
  const handleRenovar30Dias = async (cliente) => {
    if (!user) return;
    const ahora = new Date();
    const vencimientoActual = new Date(cliente.fechaVencimiento);
    // Si aún tiene días activos, suma 30 días a su fecha actual; si ya venció, suma 30 días desde hoy
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

  // Forzar vencimiento inmediato (Para probar cómo se desactiva al llegar a 30 días)
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

  // Pausar / Reactivar manualmente
  const handleAlternarEstadoManual = async (cliente) => {
    if (!user) return;
    const nuevoEstado = cliente.estadoManual === 'activo' ? 'suspendido' : 'activo';
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clientes', cliente.id), {
        estadoManual: nuevoEstado
      });
      mostrarToast(`Acceso ${nuevoEstado === 'activo' ? 'reactivado' : 'suspendido'} manualmente`);
    } catch (err) {
      mostrarToast('Error cambiando estado', 'error');
    }
  };

  // Eliminar cliente
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

  // Copiar datos de acceso listos para WhatsApp
  const handleCopiarMensajeWhatsApp = (cliente) => {
    const dias = Math.max(0, calcularDiasRestantes(cliente.fechaVencimiento));
    const mensaje = `🎬 *${config.nombreNegocio} - Acceso a Códigos Netflix*\n\nHola *${cliente.nombre}*, aquí tienes tu acceso al panel para consultar tus códigos de *"Estoy de viaje"* o *"Actualizar Hogar"* sin esperas:\n\n📧 *Correo de tu cuenta:* ${cliente.correoNetflix}\n🔑 *Tu PIN de acceso:* ${cliente.pinCliente}\n⏳ *Vigencia de tu acceso:* ${dias} días (Vence el ${formatearFechaCorta(cliente.fechaVencimiento)})\n\nSolo ingresa tu correo o tu PIN en el panel cuando tu TV te pida código.`;
    navigator.clipboard.writeText(mensaje);
    mostrarToast('Mensaje para WhatsApp copiado al portapapeles');
  };

  // Simulador de llegada de correo desde Gmail (En pestaña Bandeja / Filtro de Seguridad)
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

      if (analisis.permitido) {
        mostrarToast('✅ Correo PERMITIDO: El código ya es visible para el cliente.');
      } else {
        mostrarToast('🛡️ Correo BLOQUEADO POR SEGURIDAD: El cliente NO podrá verlo.', 'alerta');
      }
    } catch (err) {
      mostrarToast('Error al procesar el correo simulado', 'error');
    }
  };

  // Plantillas rápidas para el simulador de correos
  const cargarPlantillaSimulador = (tipo) => {
    const cuentaEjemplo = clientes[0]?.correoNetflix || 'cuenta1@rosaxmedia.com';
    const randomCode = Math.floor(1000 + Math.random() * 9000);

    if (tipo === 'viaje') {
      setCorreoSimulado({
        destinatario: cuentaEjemplo,
        asunto: 'Tu código de acceso temporal de Netflix (Estoy de viaje)',
        cuerpo: `Hola: Alguien solicitó un código para ver Netflix mientras está de viaje. Tu código de acceso temporal es ${randomCode}. Caduca en 15 minutos. O aprueba aquí: https://www.netflix.com/account/travel/verify?code=${randomCode}`
      });
    } else if (tipo === 'hogar') {
      setCorreoSimulado({
        destinatario: cuentaEjemplo,
        asunto: 'Importante: Cómo actualizar tu Hogar con Netflix',
        cuerpo: `Para confirmar que esta TV pertenece a tu Hogar con Netflix, selecciona el botón de abajo o utiliza el código de verificación ${randomCode}. Enlace: https://www.netflix.com/account/update-primary-location?code=${randomCode}`
      });
    } else if (tipo === 'password_hack') {
      setCorreoSimulado({
        destinatario: cuentaEjemplo,
        asunto: 'Completa tu solicitud de restablecimiento de contraseña',
        cuerpo: `Hemos recibido una solicitud para restablecer contraseña en tu cuenta ${cuentaEjemplo}. Si fuiste tú, ingresa al siguiente enlace para cambiar contraseña: https://www.netflix.com/password?token=secreto999`
      });
    } else if (tipo === 'email_hack') {
      setCorreoSimulado({
        destinatario: cuentaEjemplo,
        asunto: 'Solicitud de cambio de correo electrónico en tu cuenta',
        cuerpo: `Se solicitó cambiar correo electrónico asociado a tu membresía de Netflix. Código de seguridad: ${randomCode}.`
      });
    }
  };

  // Métricas del Dashboard Admin
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

  // Copiar texto al portapapeles
  const copiarTexto = (texto, idElemento) => {
    navigator.clipboard.writeText(texto);
    setCodigoCopiadoId(idElemento);
    mostrarToast(`Copiado: ${texto}`);
    setTimeout(() => setCodigoCopiadoId(null), 2500);
  };

  // Código de Google Apps Script listo para copiar y pegar en Gmail
  const codigoGoogleAppsScript = `/**
 * ============================================================================
 * ROSAXMEDIA - PUENTE AUTOMÁTICO DE GMAIL A PANEL DE CÓDIGOS (30 DÍAS)
 * ============================================================================
 * Este script se ejecuta gratis en tu cuenta de Google (script.google.com).
 * Lee únicamente los correos entrantes de Netflix y:
 * 1. BLOQUEA DE RAÍZ cualquier correo de "Restablecer contraseña" o "Cambio de correo".
 * 2. Envía solo los códigos de "Estoy de viaje" y "Actualizar Hogar" a tu panel.
 */

const PROJECT_ID = "sistema-codigos-d7377";
const APP_ID = "rosaxmedia-panel";

// Palabras estrictamente prohibidas (Jamás saldrán de tu Gmail)
const LISTA_NEGRA_SEGURIDAD = [
  "restablecer contraseña",
  "cambiar contraseña",
  "cambio de contraseña",
  "reset password",
  "cambiar correo",
  "cambio de correo",
  "actualización de correo",
  "método de pago",
  "facturación"
];

function sincronizarCodigosNetflix() {
  // Busca correos de Netflix no leídos de la última hora
  const query = 'from:(info@account.netflix.com) is:unread newer_than:1h';
  const threads = GmailApp.search(query, 0, 10);

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    const msg = messages[messages.length - 1];
    
    const asunto = msg.getSubject() || "";
    const cuerpoPlano = msg.getPlainBody() || "";
    const destinatario = msg.getTo().replace(/.*<|>|"/g, "").trim().toLowerCase();
    const textoCompleto = (asunto + " " + cuerpoPlano).toLowerCase();

    // 1. FILTRO DE SEGURIDAD ESTRICTO
    let esPeligroso = false;
    for (let p of LISTA_NEGRA_SEGURIDAD) {
      if (textoCompleto.indexOf(p) !== -1) {
        esPeligroso = true;
        break;
      }
    }

    if (esPeligroso) {
      Logger.log("BLOQUEADO POR SEGURIDAD (Contraseña/Correo): " + asunto);
      msg.markRead(); // Lo marca como leído para no procesarlo de nuevo, pero NO lo envía al cliente
      continue;
    }

    // 2. EXTRAER CÓDIGO DE 4 DÍGITOS O ENLACE DE APROBACIÓN
    const matchCodigo = cuerpoPlano.match(/\\b\\d{4}\\b/);
    const codigo = matchCodigo ? matchCodigo[0] : "";
    const matchUrl = cuerpoPlano.match(/https?:\\/\\/www\\.netflix\\.com\\/[^\\s"<>]+/);
    const enlace = matchUrl ? matchUrl[0] : "";

    // 3. ENVIAR A FIRESTORE (PANEL ROSAXMEDIA: sistema-codigos-d7377)
    const urlFirestore = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + 
                         "/databases/(default)/documents/artifacts/" + APP_ID + "/public/data/correos";

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
    Logger.log("Código enviado con éxito para: " + destinatario);
  }
}`;

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans selection:bg-red-600 selection:text-white flex flex-col">
      {/* NOTIFICACIÓN TOAST FLOTANTE */}
      {notificacion && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-bounce">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md ${
              notificacion.tipo === 'error'
                ? 'bg-red-950/95 border-red-500/60 text-red-100'
                : notificacion.tipo === 'alerta'
                ? 'bg-amber-950/95 border-amber-500/60 text-amber-100'
                : 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100'
            }`}
          >
            {notificacion.tipo === 'error' ? (
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            ) : notificacion.tipo === 'alerta' ? (
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{notificacion.mensaje}</span>
          </div>
        </div>
      )}

      {/* BARRA SUPERIOR DE NAVEGACIÓN */}
      <header className="sticky top-0 z-40 bg-[#0a0a0c]/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo Marca */}
          <div
            onClick={() => setVistaActual('cliente')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-600/20 group-hover:scale-105 transition-transform">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">
                  {config.nombreNegocio}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30">
                  Códigos TV
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Sistema de recepción Estoy de Viaje y Hogar • Acceso 30 días
              </p>
            </div>
          </div>

          {/* Botones de cambio entre Vista Cliente y Administrador */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setVistaActual('cliente')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                vistaActual === 'cliente'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Panel Cliente</span>
            </button>

            <button
              onClick={() => {
                if (vistaActual !== 'admin') {
                  setVistaActual('admin_login');
                }
              }}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                vistaActual === 'admin' || vistaActual === 'admin_login'
                  ? 'bg-zinc-100 text-zinc-900 shadow-lg'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Administrador</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* ===================================================================== */}
        {/* 1. VISTA DEL CLIENTE (CONSULTA DE CÓDIGOS CON VALIDACIÓN DE 30 DÍAS) */}
        {/* ===================================================================== */}
        {vistaActual === 'cliente' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Banner Hero Cliente */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900/90 to-[#121216] border border-zinc-800 p-6 sm:p-8 shadow-2xl">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full mb-3">
                    <Sparkles className="w-3.5 h-3.5" /> Consulta instantánea 24/7
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Recibe tu código de Netflix
                  </h1>
                  <p className="text-sm text-zinc-400 mt-1">
                    Obtén al instante tu código de <strong className="text-zinc-200">"Estoy de viaje"</strong> o <strong className="text-zinc-200">"Actualizar Hogar"</strong> asignado a tu cuenta.
                  </p>
                </div>
              </div>

              {/* Buscador por Correo o PIN */}
              <form onSubmit={handleConsultarCliente} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Mail className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={busquedaCliente}
                      onChange={(e) => setBusquedaCliente(e.target.value)}
                      placeholder="Ingresa el correo de la cuenta o tu PIN de cliente..."
                      className="w-full pl-12 pr-4 py-3.5 bg-zinc-950/90 border border-zinc-700/80 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-sm sm:text-base"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-3.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/25 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  >
                    <Search className="w-5 h-5" />
                    <span>Consultar Código</span>
                  </button>
                </div>

                {errorBusqueda && (
                  <div className="flex items-center gap-2 text-red-400 bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-2.5 text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorBusqueda}</span>
                  </div>
                )}
              </form>

              {/* Botones de Prueba Rápida (Demostración interactiva) */}
              <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-400 mr-1">Cuentas de prueba rápida:</span>
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaCliente('cuenta1@rosaxmedia.com');
                    handleConsultarCliente(null, 'cuenta1@rosaxmedia.com');
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                >
                  🟢 Cliente Activo (26 días restantes)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaCliente('cuenta2@rosaxmedia.com');
                    handleConsultarCliente(null, 'cuenta2@rosaxmedia.com');
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer"
                >
                  🟡 Por Vencer (2 días restantes)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBusquedaCliente('vencido@rosaxmedia.com');
                    handleConsultarCliente(null, 'vencido@rosaxmedia.com');
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 transition cursor-pointer"
                >
                  🔴 Cliente Vencido (&gt;30 días)
                </button>
              </div>
            </div>

            {/* RESULTADO DE LA CONSULTA DEL CLIENTE */}
            {clienteConsultado && (() => {
              const diasRestantes = calcularDiasRestantes(clienteConsultado.fechaVencimiento);
              const estaVencido = diasRestantes <= 0 || clienteConsultado.estadoManual !== 'activo';

              // CASO A: ACCESO VENCIDO (PASARON LOS 30 DÍAS O FUE DESACTIVADO)
              if (estaVencido) {
                return (
                  <div className="rounded-2xl bg-gradient-to-b from-red-950/40 to-zinc-900 border-2 border-red-600/50 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
                      <Lock className="w-8 h-8" />
                    </div>
                    <div className="space-y-2 max-w-lg mx-auto">
                      <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-600 text-white">
                        Acceso Automáticamente Desactivado
                      </span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-white pt-1">
                        Tu acceso de 30 días ha finalizado
                      </h2>
                      <p className="text-sm text-zinc-300">
                        Hola <strong className="text-white">{clienteConsultado.nombre}</strong>, el periodo de 30 días para consultar códigos de la cuenta{' '}
                        <span className="font-mono text-red-300">{clienteConsultado.correoNetflix}</span> venció el{' '}
                        <strong>{formatearFechaCorta(clienteConsultado.fechaVencimiento)}</strong>.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                      <a
                        href={`https://wa.me/${config.whatsappSoporte}?text=${encodeURIComponent(
                          `Hola ${config.nombreNegocio}, quiero renovar mis 30 días de acceso para la cuenta ${clienteConsultado.correoNetflix}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Contactar por WhatsApp para Renovar (+30 días)</span>
                      </a>
                    </div>
                  </div>
                );
              }

              // CASO B: CLIENTE ACTIVO (DENTRO DE SUS 30 DÍAS)
              const porcentajeBarra = Math.min(100, Math.max(5, Math.round((diasRestantes / 30) * 100)));

              return (
                <div className="space-y-5">
                  {/* Barra de estado de suscripción de 30 días */}
                  <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <Unlock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base">
                              {clienteConsultado.nombre}
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold">
                              Activo
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 font-mono">
                            Cuenta: {clienteConsultado.correoNetflix}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-800">
                        <Calendar className="w-4 h-4 text-red-400" />
                        <div className="text-right">
                          <div className="text-xs text-zinc-400">Vigencia restante</div>
                          <div className="text-sm font-extrabold text-white">
                            {diasRestantes} {diasRestantes === 1 ? 'día' : 'días'} de 30
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Barra de progreso de los 30 días */}
                    <div className="space-y-1.5">
                      <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            diasRestantes <= 3 ? 'bg-amber-500' : 'bg-gradient-to-r from-red-600 to-emerald-500'
                          }`}
                          style={{ width: `${porcentajeBarra}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Activado: {formatearFechaCorta(clienteConsultado.fechaInicio)}</span>
                        <span>Corte automático: {formatearFechaCorta(clienteConsultado.fechaVencimiento)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cabecera de Bandeja Filtrada del Cliente */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div className="text-xs text-zinc-300">
                        <span className="font-semibold text-white">Filtro de Seguridad Activo:</span> Mostrando únicamente códigos de{' '}
                        <span className="text-emerald-400 font-medium">Estoy de viaje</span> y{' '}
                        <span className="text-emerald-400 font-medium">Hogar</span>.
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleSimularNuevoCodigoParaCliente(clienteConsultado.correoNetflix)}
                        disabled={buscandoEnVivo}
                        className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition flex items-center gap-1.5 cursor-pointer"
                        title="Simula que Netflix acaba de enviar un código a este correo"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Simular llegada de código</span>
                      </button>

                      <button
                        onClick={handleRefrescarCodigosCliente}
                        disabled={buscandoEnVivo}
                        className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${buscandoEnVivo ? 'animate-spin' : ''}`} />
                        <span>{buscandoEnVivo ? 'Sincronizando...' : 'Actualizar Gmail'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Lista de Códigos Autorizados del Cliente */}
                  {correosSegurosDelCliente.length === 0 ? (
                    <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800 p-10 text-center space-y-3">
                      <Mail className="w-10 h-10 text-zinc-600 mx-auto" />
                      <h4 className="font-bold text-zinc-200">
                        Aún no hay códigos recientes para esta cuenta
                      </h4>
                      <p className="text-xs text-zinc-400 max-w-md mx-auto">
                        Solicita el código de "Estoy de viaje" o "Actualizar Hogar" en tu televisor o celular y luego presiona el botón <strong>Actualizar Gmail</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {correosSegurosDelCliente.map((correo) => (
                        <div
                          key={correo.id}
                          className="rounded-2xl bg-gradient-to-b from-zinc-900 to-[#111115] border border-zinc-800 hover:border-zinc-700 p-5 sm:p-6 shadow-xl transition-all"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                              <Tv className="w-3.5 h-3.5" />
                              {correo.categoria || 'Estoy de Viaje / Hogar'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                              <Clock className="w-3.5 h-3.5 text-zinc-500" />
                              {formatearTiempoRelativo(correo.fechaRecepcion)}
                            </span>
                          </div>

                          <h4 className="font-bold text-white text-base sm:text-lg mb-2">
                            {correo.asunto}
                          </h4>
                          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-5">
                            {correo.cuerpo}
                          </p>

                          {/* Bloque Destacado con el Código de 4 Dígitos y/o Enlace */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800/90">
                            {correo.codigoExtraido ? (
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                                    Código de Verificación
                                  </div>
                                  <div className="text-3xl sm:text-4xl font-black tracking-[0.25em] text-white font-mono mt-0.5">
                                    {correo.codigoExtraido}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-400">
                                Este correo contiene un enlace directo de confirmación de Hogar/Viaje.
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2.5">
                              {correo.codigoExtraido && (
                                <button
                                  onClick={() => copiarTexto(correo.codigoExtraido, correo.id)}
                                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                                >
                                  {codigoCopiadoId === correo.id ? (
                                    <>
                                      <Check className="w-4 h-4" />
                                      <span>¡Código Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4" />
                                      <span>Copiar Código</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {correo.enlaceExtraido && (
                                <a
                                  href={correo.enlaceExtraido}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border border-zinc-700 transition"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  <span>Abrir Enlace de Aprobación</span>
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

        {/* ===================================================================== */}
        {/* 2. LOGIN DE ADMINISTRADOR                                             */}
        {/* ===================================================================== */}
        {vistaActual === 'admin_login' && (
          <div className="max-w-md mx-auto mt-10">
            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-extrabold text-white">
                  Acceso Administrador
                </h2>
                <p className="text-xs text-zinc-400">
                  Ingresa tu PIN maestro para gestionar clientes de 30 días y el filtro de Gmail (PIN demo: <strong className="text-white">{config.adminPin}</strong>)
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pinIngresado === config.adminPin) {
                    setErrorPin('');
                    setPinIngresado('');
                    setVistaActual('admin');
                  } else {
                    setErrorPin('PIN incorrecto. Usa el PIN por defecto: ' + config.adminPin);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <input
                    type="password"
                    value={pinIngresado}
                    onChange={(e) => setPinIngresado(e.target.value)}
                    placeholder="Ingresa el PIN (2026)"
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-center text-lg tracking-widest font-mono text-white focus:outline-none focus:border-red-500"
                    autoFocus
                  />
                  {errorPin && (
                    <p className="text-xs text-red-400 mt-2 text-center">{errorPin}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPinIngresado(config.adminPin)}
                    className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 cursor-pointer"
                  >
                    Autocompletar Demo
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition cursor-pointer"
                  >
                    Entrar al Panel Admin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 3. PANEL DE ADMINISTRADOR COMPLETO                                    */}
        {/* ===================================================================== */}
        {vistaActual === 'admin' && (
          <div className="space-y-6">
            {/* Tarjetas de Métricas Superiores */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 sm:p-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Clientes Activos (30 días)</span>
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">
                  {metricas.activos}
                </div>
                <div className="text-[11px] text-emerald-400 mt-1">
                  Con acceso habilitado al panel
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 sm:p-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Por Vencer (≤ 3 días)</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-400">
                  {metricas.porVencer}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Próximos a cumplir 30 días
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 sm:p-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Vencidos / Cortados</span>
                  <Lock className="w-4 h-4 text-red-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-red-400">
                  {metricas.vencidos}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Bloqueados automáticamente
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 sm:p-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Filtro Anti-Contraseñas</span>
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-white">
                    {metricas.bloqueados}
                  </span>
                  <span className="text-xs text-red-400 font-semibold">
                    bloqueados
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  {metricas.permitidos} códigos de viaje permitidos
                </div>
              </div>
            </div>

            {/* Navegación de Pestañas del Administrador */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPestanaAdmin('clientes')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
                    pestanaAdmin === 'clientes'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>1. Clientes y Accesos (30 Días)</span>
                </button>

                <button
                  onClick={() => setPestanaAdmin('correos')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
                    pestanaAdmin === 'correos'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>2. Filtro de Correos y Simulador</span>
                </button>

                <button
                  onClick={() => setPestanaAdmin('gmail_script')}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer ${
                    pestanaAdmin === 'gmail_script'
                      ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>3. Conectar Gmail Real (Apps Script)</span>
                </button>
              </div>

              <button
                onClick={() => setVistaActual('cliente')}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-zinc-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Salir del Admin</span>
              </button>
            </div>

            {/* ================================================================= */}
            {/* PESTAÑA ADMIN 1: GESTIÓN DE CLIENTES Y VENCIMIENTO DE 30 DÍAS     */}
            {/* ================================================================= */}
            {pestanaAdmin === 'clientes' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Columna Izquierda: Formulario Asignar Cliente por 30 Días */}
                <div className="lg:col-span-4">
                  <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 sm:p-6 space-y-4 sticky top-24">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-400">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">
                          Asignar Nuevo Acceso
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Se desactivará automáticamente a los 30 días
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleCrearCliente} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Nombre del Cliente *
                        </label>
                        <input
                          type="text"
                          required
                          value={nuevoCliente.nombre}
                          onChange={(e) =>
                            setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })
                          }
                          placeholder="Ej: María Fernanda"
                          className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Correo de la Cuenta Netflix Asignada *
                        </label>
                        <input
                          type="email"
                          required
                          value={nuevoCliente.correoNetflix}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              correoNetflix: e.target.value
                            })
                          }
                          placeholder="Ej: pantalla4@tudominio.com"
                          className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-red-500"
                        />
                        <p className="text-[11px] text-zinc-500 mt-1">
                          El cliente solo verá los códigos que lleguen a este correo.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            WhatsApp (Opcional)
                          </label>
                          <input
                            type="text"
                            value={nuevoCliente.whatsapp}
                            onChange={(e) =>
                              setNuevoCliente({ ...nuevoCliente, whatsapp: e.target.value })
                            }
                            placeholder="3001234567"
                            className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-red-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            PIN de Acceso
                          </label>
                          <input
                            type="text"
                            value={nuevoCliente.pinCliente}
                            onChange={(e) =>
                              setNuevoCliente({
                                ...nuevoCliente,
                                pinCliente: e.target.value
                              })
                            }
                            placeholder="Auto (4 dígitos)"
                            className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-red-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Duración del Acceso (Corte Automático)
                        </label>
                        <select
                          value={nuevoCliente.diasDuracion}
                          onChange={(e) =>
                            setNuevoCliente({
                              ...nuevoCliente,
                              diasDuracion: Number(e.target.value)
                            })
                          }
                          className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-red-500"
                        >
                          <option value={30}>30 Días Exactos (Estándar Mensual)</option>
                          <option value={15}>15 Días (Quincenal)</option>
                          <option value={60}>60 Días (2 Meses)</option>
                          <option value={1}>1 Día (Prueba rápida)</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-red-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Activar Acceso por {nuevoCliente.diasDuracion} Días</span>
                      </button>
                    </form>
                  </div>
                </div>

                {/* Columna Derecha: Lista de Clientes y Control de los 30 Días */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl">
                    <div>
                      <h3 className="font-bold text-white text-base">
                        Clientes Registrados ({clientes.length})
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Cuando el contador llega a 0 días, el panel les bloquea el acceso automáticamente.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={filtroTablaClientes}
                        onChange={(e) => setFiltroTablaClientes(e.target.value)}
                        placeholder="Buscar cliente o correo..."
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {clientes
                      .filter((c) => {
                        const q = filtroTablaClientes.toLowerCase();
                        return (
                          c.nombre?.toLowerCase().includes(q) ||
                          c.correoNetflix?.toLowerCase().includes(q) ||
                          c.pinCliente?.toLowerCase().includes(q)
                        );
                      })
                      .map((cliente) => {
                        const dias = calcularDiasRestantes(cliente.fechaVencimiento);
                        const vencidoPorFecha = dias <= 0;
                        const activoReal = !vencidoPorFecha && cliente.estadoManual === 'activo';

                        return (
                          <div
                            key={cliente.id}
                            className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                              activoReal
                                ? 'bg-zinc-900/90 border-zinc-800'
                                : 'bg-red-950/15 border-red-900/40'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-white text-base">
                                    {cliente.nombre}
                                  </span>
                                  {activoReal ? (
                                    <span
                                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                        dias <= 3
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      }`}
                                    >
                                      Activo • Quedan {dias} {dias === 1 ? 'día' : 'días'}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30">
                                      {vencidoPorFecha
                                        ? 'Vencido (Cumplió 30 días)'
                                        : 'Suspendido Manualmente'}
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                                  <span className="font-mono text-zinc-200">
                                    📧 {cliente.correoNetflix}
                                  </span>
                                  <span className="font-mono">
                                    🔑 PIN: <strong className="text-white">{cliente.pinCliente}</strong>
                                  </span>
                                  <span>
                                    📅 Vence: {formatearFechaCorta(cliente.fechaVencimiento)}
                                  </span>
                                </div>
                              </div>

                              {/* Botones de Acción por Cliente */}
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => handleRenovar30Dias(cliente)}
                                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                                  title="Sumar 30 días adicionales y activar"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>+30 Días</span>
                                </button>

                                <button
                                  onClick={() => handleCopiarMensajeWhatsApp(cliente)}
                                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                                  title="Copiar datos de acceso para enviar por WhatsApp"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copiar Datos</span>
                                </button>

                                {activoReal && (
                                  <button
                                    onClick={() => handleSimularVencimiento30Dias(cliente)}
                                    className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                                    title="Simular que ya pasaron los 30 días para probar el bloqueo"
                                  >
                                    Simular Vencido
                                  </button>
                                )}

                                <button
                                  onClick={() => handleEliminarCliente(cliente.id)}
                                  className="p-2 rounded-xl bg-zinc-950 hover:bg-red-950 text-zinc-500 hover:text-red-400 border border-zinc-800 transition cursor-pointer"
                                  title="Eliminar cliente"
                                >
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

            {/* ================================================================= */}
            {/* PESTAÑA ADMIN 2: SIMULADOR Y FILTRO ANTI-CAMBIO DE CONTRASEÑA     */}
            {/* ================================================================= */}
            {pestanaAdmin === 'correos' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Simulador en Vivo de Correos de Gmail */}
                <div className="lg:col-span-5">
                  <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-5 sm:p-6 space-y-4 sticky top-24">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400">
                        Laboratorio de Pruebas
                      </span>
                      <h3 className="font-bold text-white text-lg pt-1">
                        Simulador de Llegada de Gmail
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Prueba cómo reacciona el sistema cuando llega un correo de <strong>"Estoy de viaje"</strong> frente a uno de <strong>"Restablecer contraseña"</strong>.
                      </p>
                    </div>

                    {/* Botones de carga rápida de escenarios */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-300 block">
                        Cargar plantilla de prueba:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => cargarPlantillaSimulador('viaje')}
                          className="p-2.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-700/50 text-left transition cursor-pointer"
                        >
                          <div className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Estoy de Viaje
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            Sí se muestra al cliente
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => cargarPlantillaSimulador('hogar')}
                          className="p-2.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-700/50 text-left transition cursor-pointer"
                        >
                          <div className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Actualizar Hogar
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            Sí se muestra al cliente
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => cargarPlantillaSimulador('password_hack')}
                          className="p-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/50 border border-red-700/50 text-left transition cursor-pointer"
                        >
                          <div className="text-xs font-bold text-red-300 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" /> Reset Contraseña
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            Se bloquea automáticamente
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => cargarPlantillaSimulador('email_hack')}
                          className="p-2.5 rounded-xl bg-red-950/50 hover:bg-red-900/50 border border-red-700/50 text-left transition cursor-pointer"
                        >
                          <div className="text-xs font-bold text-red-300 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5" /> Cambio de Correo
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            Se bloquea automáticamente
                          </div>
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleDispararSimuladorCorreo} className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Cuenta de Destino (Correo Netflix)
                        </label>
                        <select
                          value={correoSimulado.destinatario}
                          onChange={(e) =>
                            setCorreoSimulado({
                              ...correoSimulado,
                              destinatario: e.target.value
                            })
                          }
                          className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-white"
                        >
                          {clientes.map((c) => (
                            <option key={c.id} value={c.correoNetflix}>
                              {c.correoNetflix} ({c.nombre})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Asunto del Correo Entrante
                        </label>
                        <input
                          type="text"
                          value={correoSimulado.asunto}
                          onChange={(e) =>
                            setCorreoSimulado({ ...correoSimulado, asunto: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Cuerpo del Correo
                        </label>
                        <textarea
                          rows={4}
                          value={correoSimulado.cuerpo}
                          onChange={(e) =>
                            setCorreoSimulado({ ...correoSimulado, cuerpo: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Enviar Correo Simulado al Filtro</span>
                      </button>
                    </form>
                  </div>
                </div>

                {/* Historial de Auditoría de Correos (Permitidos vs Bloqueados) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 sm:p-5">
                    <h3 className="font-bold text-white text-base">
                      Registro de Seguridad de Correos Recibidos ({correos.length})
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Los correos marcados en <span className="text-red-400 font-semibold">ROJO (BLOQUEADO)</span> jamás aparecen en la vista del cliente.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {correos.map((mail) => (
                      <div
                        key={mail.id}
                        className={`rounded-2xl border p-4 space-y-2 ${
                          mail.permitido
                            ? 'bg-zinc-900/80 border-zinc-800'
                            : 'bg-red-950/25 border-red-500/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {mail.permitido ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <Eye className="w-3 h-3" /> VISIBLE AL CLIENTE ({mail.categoria})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                                <EyeOff className="w-3 h-3" /> BLOQUEADO Y OCULTO AL CLIENTE
                              </span>
                            )}
                            <span className="text-xs font-mono text-zinc-400">
                              → {mail.destinatario}
                            </span>
                          </div>

                          <span className="text-[11px] text-zinc-500">
                            {formatearTiempoRelativo(mail.fechaRecepcion)}
                          </span>
                        </div>

                        <div className="font-bold text-sm text-white">{mail.asunto}</div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{mail.cuerpo}</p>

                        {!mail.permitido && (
                          <div className="text-xs text-red-300 bg-red-950/60 border border-red-800/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                            <span>
                              <strong>Protección activada:</strong> {mail.motivoBloqueo}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* PESTAÑA ADMIN 3: CONEXIÓN REAL CON GMAIL (GOOGLE APPS SCRIPT)     */}
            {/* ================================================================= */}
            {pestanaAdmin === 'gmail_script' && (
              <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800 p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      100% Gratis y Sin Servidores Externos
                    </span>
                    <h3 className="text-xl font-extrabold text-white mt-1">
                      Cómo conectar tu cuenta de Gmail a este Panel en 3 minutos
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                      Usa la herramienta oficial de Google (<strong>Google Apps Script</strong>) dentro de tu mismo Gmail para reenviar automáticamente los códigos a esta web filtrando los de cambio de contraseña.
                    </p>
                  </div>

                  <button
                    onClick={() => copiarTexto(codigoGoogleAppsScript, 'script_gmail')}
                    className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shrink-0 shadow-lg shadow-red-600/20 cursor-pointer"
                  >
                    {codigoCopiadoId === 'script_gmail' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>¡Código Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Código para Gmail</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Pasos Explicados */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                    <div className="text-xs font-black text-red-400 uppercase">Paso 1</div>
                    <div className="font-bold text-white text-sm">
                      Abre Google Apps Script
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Inicia sesión en el Gmail donde recibes los correos de Netflix y entra a{' '}
                      <a
                        href="https://script.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-400 underline"
                      >
                        script.google.com
                      </a>
                      . Haz clic en <strong>"Nuevo proyecto"</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                    <div className="text-xs font-black text-red-400 uppercase">Paso 2</div>
                    <div className="font-bold text-white text-sm">
                      Pega el código con Filtro Anti-Robo
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Borra lo que haya en el editor, pega el código de abajo y presiona el icono de <strong>Guardar (💾)</strong>. Este código ya ignora cualquier correo de restablecimiento de contraseña.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                    <div className="text-xs font-black text-red-400 uppercase">Paso 3</div>
                    <div className="font-bold text-white text-sm">
                      Activa el Activador (Cada 1 minuto)
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      En el menú izquierdo entra a <strong>Activadores (Reloj ⏰)</strong> → Añadir activador → Función: <code className="text-zinc-200">sincronizarCodigosNetflix</code> → Según el tiempo → <strong>Cada minuto</strong>.
                    </p>
                  </div>
                </div>

                {/* Visor de Código */}
                <div className="relative">
                  <pre className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-emerald-300 overflow-x-auto max-h-96">
                    {codigoGoogleAppsScript}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* PIE DE PÁGINA */}
      <footer className="border-t border-zinc-900 py-5 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} <strong>{config.nombreNegocio}</strong> • Panel Automatizado de Códigos Temporales
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Protección activa contra restablecimiento de contraseña y cambio de correo
          </span>
        </div>
      </footer>
    </div>
  );
}
