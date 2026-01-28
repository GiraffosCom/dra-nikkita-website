// Serverless function to create MercadoPago payment preference
// Creates a checkout link for appointment payments

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            nombre,
            email,
            telefono,
            servicio,
            precio,
            fecha,
            hora,
            duracion,
            motivo
        } = req.body;

        // Get MercadoPago Access Token from environment
        const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

        if (!MP_ACCESS_TOKEN) {
            console.error('Missing MercadoPago Access Token');
            return res.status(500).json({ error: 'Payment configuration error' });
        }

        // If price is 0, skip payment and return success
        if (!precio || precio === 0) {
            return res.status(200).json({
                success: true,
                free: true,
                message: 'Cita gratuita, no requiere pago'
            });
        }

        // Create unique external reference for tracking
        const externalReference = `CITA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Prepare preference for MercadoPago Checkout Pro
        const preference = {
            items: [
                {
                    id: externalReference,
                    title: `Cita: ${servicio}`,
                    description: `Cita con Dra. Nikkita - ${fecha} a las ${hora}`,
                    quantity: 1,
                    currency_id: 'CLP',
                    unit_price: precio
                }
            ],
            payer: {
                name: nombre.split(' ')[0],
                surname: nombre.split(' ').slice(1).join(' ') || '',
                email: email,
                phone: {
                    number: telefono.replace(/\D/g, '')
                }
            },
            back_urls: {
                success: `${process.env.SITE_URL || 'https://dranikkita.com'}/pago-exitoso.html?ref=${externalReference}`,
                failure: `${process.env.SITE_URL || 'https://dranikkita.com'}/pago-fallido.html?ref=${externalReference}`,
                pending: `${process.env.SITE_URL || 'https://dranikkita.com'}/pago-pendiente.html?ref=${externalReference}`
            },
            auto_return: 'approved',
            external_reference: externalReference,
            notification_url: `${process.env.SITE_URL || 'https://dranikkita.com'}/api/payment-webhook`,
            statement_descriptor: 'DRA NIKKITA',
            metadata: {
                nombre: nombre,
                email: email,
                telefono: telefono,
                servicio: servicio,
                fecha: fecha,
                hora: hora,
                duracion: duracion,
                motivo: motivo || ''
            }
        };

        console.log('Creating MercadoPago preference:', JSON.stringify(preference));

        // Create preference in MercadoPago
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
            },
            body: JSON.stringify(preference)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('MercadoPago Error:', result);
            return res.status(response.status).json({
                error: 'Error creating payment',
                details: result
            });
        }

        // Return checkout URL
        return res.status(200).json({
            success: true,
            payment_url: result.init_point, // Production URL
            sandbox_url: result.sandbox_init_point, // Sandbox URL for testing
            preference_id: result.id,
            external_reference: externalReference
        });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
