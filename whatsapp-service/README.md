# WhatsApp Verification Service - Dra Nikkita

Servicio de verificación de teléfono por WhatsApp usando whatsapp-web.js

## 🚀 Instalación en VPS

### Opción 1: Docker (Recomendado)

```bash
# En tu VPS, clonar o copiar la carpeta whatsapp-service
cd whatsapp-service

# Construir imagen
docker build -t whatsapp-verification .

# Ejecutar contenedor
docker run -d \
  --name whatsapp-verification \
  -p 3001:3001 \
  -v whatsapp-session:/app/whatsapp-session \
  --restart unless-stopped \
  whatsapp-verification

# Ver logs (para escanear QR)
docker logs -f whatsapp-verification
```

### Opción 2: Directamente con Node.js

```bash
# Instalar Node.js 18+ si no está instalado
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar Chrome/Chromium (necesario para puppeteer)
sudo apt-get install -y chromium-browser

# Instalar PM2 para mantener el servicio activo
sudo npm install -g pm2

# En la carpeta whatsapp-service
npm install

# Iniciar con PM2
pm2 start index.js --name whatsapp-verification
pm2 save
pm2 startup
```

## 📱 Configuración Inicial

1. **Iniciar el servicio** (ver logs):
   ```bash
   # Docker
   docker logs -f whatsapp-verification

   # PM2
   pm2 logs whatsapp-verification
   ```

2. **Escanear el código QR** que aparece en la terminal con WhatsApp
   - Abre WhatsApp en tu teléfono
   - Ve a Configuración > Dispositivos vinculados
   - Escanea el QR

3. **Verificar conexión**:
   ```bash
   curl http://localhost:3001/health
   ```

## 🔌 API Endpoints

### GET /health
Verificar estado del servicio
```json
{
  "status": "ok",
  "whatsapp": "connected",
  "timestamp": "2024-01-28T..."
}
```

### GET /qr
Obtener QR code para autenticación (si no está conectado)
```json
{
  "success": true,
  "qr": "data:image/png;base64,...",
  "connected": false
}
```

### POST /send-code
Enviar código de verificación
```bash
curl -X POST http://localhost:3001/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "+56912345678", "nombre": "María"}'
```

### POST /verify-code
Verificar el código ingresado
```bash
curl -X POST http://localhost:3001/verify-code \
  -H "Content-Type: application/json" \
  -d '{"phone": "+56912345678", "code": "123456"}'
```

## 🔒 Seguridad

Para producción, agregar:

1. **API Key** para proteger los endpoints
2. **Rate limiting** para evitar abusos
3. **HTTPS** con certificado SSL

Ejemplo con nginx:

```nginx
server {
    listen 443 ssl;
    server_name whatsapp.tudominio.com;

    ssl_certificate /etc/letsencrypt/live/tudominio/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## ⚠️ Notas Importantes

- El número de WhatsApp usado para verificación no debe usarse para mensajería personal intensiva
- WhatsApp puede banear números que envíen muchos mensajes automatizados
- Recomendado: usar un número exclusivo para este servicio
- Los códigos expiran en 10 minutos
- Máximo 3 intentos por código

## 🐛 Troubleshooting

**QR no aparece:**
```bash
# Reiniciar servicio
docker restart whatsapp-verification
```

**Error de Chrome/Puppeteer:**
```bash
# Instalar dependencias de Chrome
sudo apt-get install -y chromium-browser
```

**Sesión expirada:**
```bash
# Eliminar sesión guardada y reiniciar
docker exec whatsapp-verification rm -rf /app/whatsapp-session/*
docker restart whatsapp-verification
```
