// API Proxy for WhatsApp Verification Service using WAHA
// This proxies requests to the WAHA service running on your VPS

// In-memory store for verification codes (resets on cold start)
// For production, consider using a database or Redis
const verificationCodes = new Map();

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatPhoneForWhatsApp(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with +, it was already removed
    // Chilean numbers: 56 9 XXXX XXXX
    // Make sure it has country code
    if (cleaned.startsWith('56')) {
        return cleaned + '@c.us';
    } else if (cleaned.startsWith('9') && cleaned.length === 9) {
        // Chilean mobile without country code
        return '56' + cleaned + '@c.us';
    }

    return cleaned + '@c.us';
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Get WAHA service URL and API key from environment variables
    const WAHA_URL = process.env.WHATSAPP_SERVICE_URL || process.env.WAHA_URL;
    const WAHA_API_KEY = process.env.WAHA_API_KEY;

    if (!WAHA_URL) {
        return res.status(500).json({
            success: false,
            error: 'WhatsApp service not configured. Set WHATSAPP_SERVICE_URL in environment.'
        });
    }

    const { action } = req.query;

    try {
        switch (action) {
            case 'send-code': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ success: false, error: 'Method not allowed' });
                }

                const { phone } = req.body;
                if (!phone) {
                    return res.status(400).json({ success: false, error: 'Phone number required' });
                }

                // Generate verification code
                const code = generateCode();
                const chatId = formatPhoneForWhatsApp(phone);

                // Store code with 10 minute expiry
                verificationCodes.set(phone, {
                    code,
                    expires: Date.now() + 10 * 60 * 1000,
                    attempts: 0
                });

                // Send message via WAHA
                const headers = {
                    'Content-Type': 'application/json'
                };

                if (WAHA_API_KEY) {
                    headers['X-Api-Key'] = WAHA_API_KEY;
                }

                const response = await fetch(`${WAHA_URL}/api/sendText`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        chatId: chatId,
                        text: `🔐 Tu código de verificación para Dra. Nikkita es: *${code}*\n\nEste código expira en 10 minutos.\n\n_Si no solicitaste este código, ignora este mensaje._`,
                        session: 'default'
                    })
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    console.error('WAHA error:', errorData);
                    return res.status(500).json({
                        success: false,
                        error: 'No se pudo enviar el código. Verifica tu número e intenta nuevamente.'
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Código enviado por WhatsApp'
                });
            }

            case 'verify-code': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ success: false, error: 'Method not allowed' });
                }

                const { phone, code } = req.body;
                if (!phone || !code) {
                    return res.status(400).json({ success: false, error: 'Phone and code required' });
                }

                const stored = verificationCodes.get(phone);

                if (!stored) {
                    return res.status(400).json({
                        success: false,
                        error: 'No hay código pendiente para este número. Solicita uno nuevo.'
                    });
                }

                if (Date.now() > stored.expires) {
                    verificationCodes.delete(phone);
                    return res.status(400).json({
                        success: false,
                        error: 'El código ha expirado. Solicita uno nuevo.'
                    });
                }

                if (stored.attempts >= 3) {
                    verificationCodes.delete(phone);
                    return res.status(400).json({
                        success: false,
                        error: 'Demasiados intentos fallidos. Solicita un nuevo código.'
                    });
                }

                if (stored.code !== code) {
                    stored.attempts++;
                    return res.status(400).json({
                        success: false,
                        error: `Código incorrecto. Te quedan ${3 - stored.attempts} intentos.`
                    });
                }

                // Code is valid - clean up
                verificationCodes.delete(phone);

                return res.status(200).json({
                    success: true,
                    message: 'Número verificado correctamente'
                });
            }

            case 'status': {
                const headers = {};
                if (WAHA_API_KEY) {
                    headers['X-Api-Key'] = WAHA_API_KEY;
                }

                const response = await fetch(`${WAHA_URL}/api/sessions/default`, {
                    headers
                });

                if (!response.ok) {
                    return res.status(503).json({
                        success: false,
                        status: 'disconnected',
                        error: 'WhatsApp session not available'
                    });
                }

                const data = await response.json();
                return res.status(200).json({
                    success: true,
                    status: data.status || 'connected',
                    name: data.name
                });
            }

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Use: send-code, verify-code, or status'
                });
        }

    } catch (error) {
        console.error('WhatsApp service error:', error);
        return res.status(503).json({
            success: false,
            error: 'No se pudo conectar con el servicio de verificación. Intenta más tarde.'
        });
    }
}
