# 🟢 Agendi — Backend

Backend del sistema de agendamiento por WhatsApp para negocios de belleza.  
Desarrollado con Node.js, Express, Firebase Firestore y WhatsApp Cloud API.

---

## 📁 Estructura del proyecto

```
agendi-backend/
├── src/
│   ├── index.js                  # Servidor principal
│   ├── bot/
│   │   └── handler.js            # Lógica completa del bot
│   ├── config/
│   │   └── firebase.js           # Conexión a Firebase
│   ├── cron/
│   │   └── reminders.js          # Recordatorios automáticos
│   ├── routes/
│   │   ├── api.js                # API para la app móvil
│   │   └── webhook.js            # Webhook de WhatsApp
│   └── services/
│       ├── database.js           # Operaciones con Firestore
│       ├── scheduler.js          # Cálculo de slots disponibles
│       └── whatsapp.js           # Envío de mensajes
├── .env.example                  # Variables de entorno de ejemplo
├── .env                          # Tus credenciales (NO subir a GitHub)
├── firebase-credentials.json     # Credenciales Firebase (NO subir a GitHub)
├── package.json
└── README.md
```

---

## ⚙️ Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar archivo de entorno
cp .env.example .env

# 3. Rellenar el .env con tus credenciales (ver sección abajo)

# 4. Correr en desarrollo
npm run dev
```

---

## 🔐 Configuración del .env

```env
# WhatsApp Cloud API — se obtiene en developers.facebook.com
WHATSAPP_TOKEN=tu_token_aqui
WHATSAPP_PHONE_ID=tu_phone_id_aqui

# Token del webhook — lo inventas tú, puede ser cualquier texto
WEBHOOK_VERIFY_TOKEN=agendi_webhook_2024

# Firebase — ruta al archivo de credenciales descargado
FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json

# Servidor
PORT=3000

# API key para la app móvil — la inventas tú
BARBER_API_KEY=agendi_barber_key_2024

# Palabras que activan el bot (separadas por coma, sin espacios)
BOT_KEYWORDS=cita,agendar,reservar,turno,hora

# Minutos antes para enviar el recordatorio
REMINDER_MINUTES=30
```

---

## 🔥 Configuración de Firebase

### 1. Crear el proyecto
1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un proyecto nuevo → llámalo `agendi-app`
3. Ve a **Configuración del proyecto → Cuentas de servicio**
4. Haz clic en **"Generar nueva clave privada"**
5. Guarda el archivo como `firebase-credentials.json` dentro de la carpeta `backend/`

### 2. Crear la base de datos Firestore
1. En el menú izquierdo → **Build → Firestore Database**
2. Clic en **"Create database"**
3. Selecciona **"Start in production mode"**
4. Ubicación del servidor: **us-east1**
5. Clic en **"Enable"**

### 3. Reglas de seguridad
En Firestore → pestaña **"Rules"**, verifica que diga:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
Esto bloquea el acceso directo — solo el backend con las credenciales puede leer y escribir.

### 4. Datos iniciales
Crea estos documentos manualmente desde la consola de Firebase:

**Colección `schedules` → documento `default`:**
```json
{
  "slotDuration": 30,
  "weeklySchedule": {
    "lunes":     { "active": true,  "start": "09:00", "end": "18:00" },
    "martes":    { "active": true,  "start": "09:00", "end": "18:00" },
    "miercoles": { "active": true,  "start": "09:00", "end": "18:00" },
    "jueves":    { "active": true,  "start": "09:00", "end": "18:00" },
    "viernes":   { "active": true,  "start": "09:00", "end": "18:00" },
    "sabado":    { "active": true,  "start": "09:00", "end": "14:00" },
    "domingo":   { "active": false, "start": "09:00", "end": "14:00" }
  }
}
```

**Colección `botConfig` → documento `default`:**
```json
{
  "keywords": ["cita", "agendar", "reservar", "turno", "hora"],
  "reminderMinutes": 30,
  "botActive": true,
  "welcomeMessage": "¡Hola! 👋 Soy el asistente de Agendi. ¿En qué te puedo ayudar?"
}
```

**Colección `services` → agrega los servicios del negocio:**
```json
{ "name": "Corte clásico", "price": 15000, "duration": 30, "active": true, "order": 1 }
{ "name": "Corte + barba",  "price": 25000, "duration": 45, "active": true, "order": 2 }
{ "name": "Arreglo barba",  "price": 12000, "duration": 20, "active": true, "order": 3 }
```

---

## 📡 WhatsApp Cloud API (Meta)

### 1. Crear la app en Meta
1. Ve a [developers.facebook.com](https://developers.facebook.com)
2. Crea una app → tipo **"Business"**
3. Agrega el producto **"WhatsApp"**
4. En **"API Setup"** copia:
   - **Access Token** → `WHATSAPP_TOKEN` en tu `.env`
   - **Phone Number ID** → `WHATSAPP_PHONE_ID` en tu `.env`

### 2. Configurar el Webhook
Para que Meta envíe los mensajes a tu servidor necesitas una URL pública.

**En desarrollo (tu computador):**
```bash
# Instalar ngrok
npm install -g ngrok

# En una terminal aparte, exponer tu servidor
ngrok http 3000

# Ngrok te da una URL tipo: https://abc123.ngrok.io
# Úsala como URL del webhook
```

**En producción (Railway):**
Railway te da una URL pública automáticamente al hacer deploy.

**Configurar en Meta:**
1. En tu app de Meta → **WhatsApp → Configuration → Webhook**
2. URL del webhook: `https://tu-url.com/webhook`
3. Verify token: el mismo que pusiste en `WEBHOOK_VERIFY_TOKEN`
4. Haz clic en **"Verify and Save"**
5. Suscríbete al campo **"messages"**

---

## 🚀 Deploy en Railway

1. Sube el código a GitHub (sin `.env` ni `firebase-credentials.json`)
2. Ve a [railway.app](https://railway.app) y conecta tu repositorio
3. En **"Variables"** agrega todas las del `.env`
4. Para las credenciales de Firebase, copia el contenido del JSON y agrégalo como variable `FIREBASE_CREDENTIALS_JSON`
5. Modifica `src/config/firebase.js` para leer de la variable de entorno en lugar del archivo

---

## 📡 Endpoints de la API

Todas las rutas `/api/*` requieren el header:
```
x-api-key: tu_barber_api_key
```

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servidor |
| GET | `/webhook` | Verificación de Meta |
| POST | `/webhook` | Recibir mensajes de WhatsApp |
| GET | `/api/appointments?date=YYYY-MM-DD` | Listar citas |
| PATCH | `/api/appointments/:id/status` | Confirmar o cancelar cita |
| GET | `/api/services` | Listar servicios |
| POST | `/api/services` | Crear servicio |
| PUT | `/api/services/:id` | Editar servicio |
| DELETE | `/api/services/:id` | Desactivar servicio |
| GET | `/api/schedule` | Ver horario semanal |
| PUT | `/api/schedule` | Actualizar horario |
| POST | `/api/blocked-slots` | Bloquear hora o día |
| DELETE | `/api/blocked-slots/:id` | Desbloquear |
| POST | `/api/urgent-alert` | Cancelar todo el día y avisar clientes |
| GET | `/api/bot-config` | Ver configuración del bot |
| PUT | `/api/bot-config` | Actualizar config (keywords, recordatorio, pausar bot) |

---

## 💬 Flujo del bot

```
Cliente escribe "cita" (o cualquier keyword)
        ↓
¿Primera vez? → Pide nombre → Lo guarda
        ↓
Menú principal:
  1. Agendar cita
  2. Ver mi cita
  3. Cancelar mi cita
        ↓
[Si elige Agendar]
  → Elige servicio
  → Ve horarios disponibles
  → Confirma
  → Recibe confirmación
  → Recordatorio automático X minutos antes
```

---

## 🛡️ Seguridad

- El `.env` y `firebase-credentials.json` **nunca** deben subirse a GitHub
- Agrega un `.gitignore` con:
```
node_modules/
.env
firebase-credentials.json
```

---

## 🧱 Tecnologías

| Tecnología | Uso |
|---|---|
| Node.js + Express | Servidor y API |
| Firebase Firestore | Base de datos en tiempo real |
| WhatsApp Cloud API | Mensajería |
| node-cron | Recordatorios automáticos |
| Railway | Hosting en producción |
