// API Proxy for WhatsApp Verification Service
// This proxies requests to the WhatsApp service running on your VPS

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Get WhatsApp service URL from environment variable
    const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL;

    if (!WHATSAPP_SERVICE_URL) {
        return res.status(500).json({
            success: false,
            error: 'WhatsApp service not configured. Set WHATSAPP_SERVICE_URL in environment.'
        });
    }

    const { action } = req.query;

    try {
        let response;

        switch (action) {
            case 'send-code':
                if (req.method !== 'POST') {
                    return res.status(405).json({ success: false, error: 'Method not allowed' });
                }
                response = await fetch(`${WHATSAPP_SERVICE_URL}/send-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(req.body)
                });
                break;

            case 'verify-code':
                if (req.method !== 'POST') {
                    return res.status(405).json({ success: false, error: 'Method not allowed' });
                }
                response = await fetch(`${WHATSAPP_SERVICE_URL}/verify-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(req.body)
                });
                break;

            case 'status':
                response = await fetch(`${WHATSAPP_SERVICE_URL}/health`);
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Use: send-code, verify-code, or status'
                });
        }

        const data = await response.json();
        return res.status(response.status).json(data);

    } catch (error) {
        console.error('WhatsApp service error:', error);
        return res.status(503).json({
            success: false,
            error: 'No se pudo conectar con el servicio de verificación. Intenta más tarde.'
        });
    }
}
