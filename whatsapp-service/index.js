const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

// Store verification codes (in production, use Redis)
const verificationCodes = new Map();

// WhatsApp Client
let client;
let isReady = false;
let currentQR = null;

function initializeClient() {
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './whatsapp-session'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        currentQR = qr;
        console.log('\n📱 Escanea este código QR con WhatsApp:\n');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        isReady = true;
        currentQR = null;
        console.log('✅ WhatsApp conectado y listo!');
    });

    client.on('authenticated', () => {
        console.log('🔐 Autenticado correctamente');
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Error de autenticación:', msg);
        isReady = false;
    });

    client.on('disconnected', (reason) => {
        console.log('📴 Desconectado:', reason);
        isReady = false;
        // Reiniciar después de 5 segundos
        setTimeout(() => {
            console.log('🔄 Reiniciando cliente...');
            initializeClient();
        }, 5000);
    });

    client.initialize();
}

// Generate random 6-digit code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format phone number for WhatsApp
function formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 56 (Chile code), keep it
    if (cleaned.startsWith('56')) {
        return cleaned + '@c.us';
    }

    // If starts with 9 (Chilean mobile without code), add 56
    if (cleaned.startsWith('9') && cleaned.length === 9) {
        return '56' + cleaned + '@c.us';
    }

    // Default: assume it's correct
    return cleaned + '@c.us';
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: isReady ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Get QR code for authentication
app.get('/qr', async (req, res) => {
    if (isReady) {
        return res.json({
            success: true,
            message: 'WhatsApp ya está conectado',
            connected: true
        });
    }

    if (!currentQR) {
        return res.json({
            success: false,
            message: 'QR no disponible aún, espera unos segundos...',
            connected: false
        });
    }

    try {
        const qrDataUrl = await QRCode.toDataURL(currentQR);
        res.json({
            success: true,
            qr: qrDataUrl,
            connected: false
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send verification code
app.post('/send-code', async (req, res) => {
    const { phone, nombre } = req.body;

    if (!phone) {
        return res.status(400).json({
            success: false,
            error: 'Teléfono requerido'
        });
    }

    if (!isReady) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp no está conectado. Escanea el QR primero.'
        });
    }

    try {
        const code = generateCode();
        const formattedPhone = formatPhoneNumber(phone);

        // Store code with 10 minute expiry
        verificationCodes.set(phone, {
            code,
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
            attempts: 0
        });

        // Send WhatsApp message
        const message = `🏥 *Dra. Nikkita - Verificación*\n\n` +
            `Hola${nombre ? ' ' + nombre : ''}! 👋\n\n` +
            `Tu código de verificación es:\n\n` +
            `*${code}*\n\n` +
            `Este código expira en 10 minutos.\n\n` +
            `Si no solicitaste este código, ignora este mensaje.`;

        await client.sendMessage(formattedPhone, message);

        console.log(`📤 Código enviado a ${phone}: ${code}`);

        res.json({
            success: true,
            message: 'Código enviado por WhatsApp',
            expiresIn: 600 // 10 minutes in seconds
        });

    } catch (error) {
        console.error('Error enviando código:', error);
        res.status(500).json({
            success: false,
            error: 'Error al enviar el mensaje. Verifica el número.'
        });
    }
});

// Verify code
app.post('/verify-code', (req, res) => {
    const { phone, code } = req.body;

    if (!phone || !code) {
        return res.status(400).json({
            success: false,
            error: 'Teléfono y código requeridos'
        });
    }

    const stored = verificationCodes.get(phone);

    if (!stored) {
        return res.json({
            success: false,
            error: 'No hay código pendiente para este número. Solicita uno nuevo.'
        });
    }

    // Check expiry
    if (Date.now() > stored.expiresAt) {
        verificationCodes.delete(phone);
        return res.json({
            success: false,
            error: 'El código ha expirado. Solicita uno nuevo.'
        });
    }

    // Check attempts (max 3)
    if (stored.attempts >= 3) {
        verificationCodes.delete(phone);
        return res.json({
            success: false,
            error: 'Demasiados intentos fallidos. Solicita un nuevo código.'
        });
    }

    // Verify code
    if (stored.code === code) {
        verificationCodes.delete(phone);
        console.log(`✅ Código verificado correctamente para ${phone}`);
        return res.json({
            success: true,
            message: 'Número verificado correctamente'
        });
    } else {
        stored.attempts++;
        return res.json({
            success: false,
            error: 'Código incorrecto. Intentos restantes: ' + (3 - stored.attempts)
        });
    }
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        whatsappConnected: isReady,
        pendingVerifications: verificationCodes.size,
        uptime: process.uptime()
    });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`\n🚀 Servidor de verificación WhatsApp iniciado en puerto ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 QR Code: http://localhost:${PORT}/qr`);
    console.log('\n⏳ Inicializando WhatsApp...\n');
    initializeClient();
});

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('\n👋 Cerrando servicio...');
    if (client) {
        await client.destroy();
    }
    process.exit(0);
});
