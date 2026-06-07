# 📱 Agendi — App Móvil

App móvil para el dueño/encargado del negocio. Desarrollada con React Native + Expo.

---

## 📁 Estructura

```
agendi-app/
├── App.js                          # Punto de entrada
├── app.json                        # Configuración Expo
├── babel.config.js
├── package.json
├── .env.example
└── src/
    ├── navigation/
    │   └── AppNavigator.js         # Navegación principal
    ├── screens/
    │   ├── LoginScreen.js          # Pantalla de login
    │   ├── AgendaScreen.js         # Citas del día
    │   ├── ScheduleScreen.js       # Horarios semanales
    │   ├── ServicesScreen.js       # Servicios y precios
    │   └── ConfigScreen.js         # Config del bot
    └── services/
        ├── api.js                  # Conexión con el backend
        └── theme.js                # Colores y estilos
```

---

## ⚙️ Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Instalar Expo CLI si no lo tienes
npm install -g expo-cli

# 3. Copiar variables de entorno
cp .env.example .env
```

---

## ▶️ Correr la app

```bash
npx expo start
```

Luego:
- Escanea el QR con la app **Expo Go** en tu celular
- O presiona `a` para Android emulator / `i` para iOS simulator

---

## 🔌 Conectar con el backend

Al abrir la app por primera vez, aparece la pantalla de login donde ingresas:

- **URL del servidor**: La URL de tu backend (Railway o ngrok en desarrollo)
  - Ejemplo: `https://agendi-backend.railway.app`
  - En desarrollo: `http://192.168.1.x:3000` (la IP de tu computador en la red local)
- **Clave de acceso**: El valor de `BARBER_API_KEY` en el `.env` del backend

---

## 📱 Pantallas

### 🗓 Agenda
- Ver citas del día con nombre del cliente, servicio y hora
- Navegar entre días
- Confirmar o rechazar citas pendientes
- Estadísticas del día (total, confirmadas, pendientes)
- Botón de **alerta urgente** para cancelar todas las citas del día y notificar a los clientes por WhatsApp

### ⏰ Horarios
- Activar/desactivar días de la semana
- Definir hora de inicio y fin por día
- Cambiar la duración de cada turno (15, 30, 45, 60 min)

### ✂️ Servicios
- Ver, crear, editar y desactivar servicios
- Nombre, precio y duración por servicio

### ⚙️ Config
- Activar o pausar el bot (modo manual)
- Gestionar palabras clave que activan el bot
- Tiempo del recordatorio automático (15, 30, 45, 60 min)
- Editar mensaje de bienvenida del bot
- Cerrar sesión

---

## 🚀 Build para producción

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Configurar
eas build:configure

# Build para Android (.apk)
eas build --platform android --profile preview

# Build para iOS (requiere cuenta Apple Developer)
eas build --platform ios
```

---

## 🧱 Tecnologías

| Tecnología | Uso |
|---|---|
| React Native | Framework móvil |
| Expo | Toolchain y builds |
| React Navigation | Navegación entre pantallas |
| AsyncStorage | Guardar sesión localmente |
| Axios | Peticiones al backend |
| date-fns | Manejo de fechas |
| @expo/vector-icons | Íconos |
