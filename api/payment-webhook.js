// Serverless function to handle MercadoPago payment webhooks
// Creates Event in Frappe CRM when payment is confirmed

export default async function handler(req, res) {
    // MercadoPago sends POST notifications
    if (req.method !== 'POST') {
        return res.status(200).json({ received: true });
    }

    try {
        const { type, data } = req.body;

        console.log('Webhook received:', type, data);

        // Only process payment notifications
        if (type !== 'payment') {
            return res.status(200).json({ received: true, ignored: true });
        }

        const paymentId = data?.id;
        if (!paymentId) {
            return res.status(200).json({ received: true, no_payment_id: true });
        }

        // Get MercadoPago Access Token
        const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!MP_ACCESS_TOKEN) {
            console.error('Missing MercadoPago Access Token');
            return res.status(500).json({ error: 'Configuration error' });
        }

        // Fetch payment details from MercadoPago
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
            }
        });

        const payment = await paymentResponse.json();

        console.log('Payment status:', payment.status);

        // Only process approved payments
        if (payment.status !== 'approved') {
            return res.status(200).json({ received: true, status: payment.status });
        }

        // Extract appointment data from metadata
        const metadata = payment.metadata || {};
        const {
            nombre,
            email,
            telefono,
            servicio,
            fecha,
            hora,
            duracion,
            motivo
        } = metadata;

        // Create Event in Frappe CRM
        const API_KEY = process.env.FRAPPE_API_KEY;
        const API_SECRET = process.env.FRAPPE_API_SECRET;
        const CRM_URL = process.env.FRAPPE_CRM_URL || 'https://crm.dranikkita.com';

        if (!API_KEY || !API_SECRET) {
            console.error('Missing Frappe credentials');
            return res.status(500).json({ error: 'CRM configuration error' });
        }

        // Calculate end time
        const startDate = new Date(`${fecha}T${hora}:00`);
        const durationMinutes = parseInt(duracion) || 30;
        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

        const formatDateTime = (date) => {
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        // Create Event
        const eventData = {
            doctype: 'Event',
            subject: `✅ Cita PAGADA: ${nombre} - ${servicio}`,
            starts_on: formatDateTime(startDate),
            ends_on: formatDateTime(endDate),
            event_type: 'Public',
            status: 'Open',
            description: `
                <b>👤 Paciente:</b> ${nombre}<br>
                <b>📱 Teléfono:</b> ${telefono}<br>
                <b>📧 Email:</b> ${email}<br>
                <b>🏥 Servicio:</b> ${servicio}<br>
                <b>💰 Monto pagado:</b> $${payment.transaction_amount?.toLocaleString('es-CL')} CLP<br>
                <b>📝 Motivo:</b> ${motivo || 'No especificado'}<br>
                <br>
                <b>🔖 ID de pago:</b> ${paymentId}<br>
                <b>📅 Referencia:</b> ${payment.external_reference}<br>
                <br>
                <i style="color: green;">✓ Pago confirmado vía MercadoPago</i>
            `.trim()
        };

        const eventResponse = await fetch(`${CRM_URL}/api/resource/Event`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        const eventResult = await eventResponse.json();

        if (!eventResponse.ok) {
            console.error('Error creating Event:', eventResult);
        } else {
            console.log('Event created:', eventResult.data?.name);
        }

        // Also create/update Lead
        try {
            const leadData = {
                first_name: nombre.split(' ')[0] || 'Sin nombre',
                last_name: nombre.split(' ').slice(1).join(' ') || '',
                email: email || '',
                mobile_no: telefono || '',
                status: 'New',
                notes: `Cita pagada: ${servicio} - ${fecha} ${hora}\nMonto: $${payment.transaction_amount?.toLocaleString('es-CL')} CLP\nID Pago: ${paymentId}`
            };

            await fetch(`${CRM_URL}/api/resource/CRM Lead`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `token ${API_KEY}:${API_SECRET}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(leadData)
            });

            console.log('Lead created for paid appointment');
        } catch (leadError) {
            console.error('Error creating lead:', leadError);
        }

        return res.status(200).json({
            received: true,
            processed: true,
            event_id: eventResult.data?.name
        });

    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).json({
            error: 'Webhook processing error',
            message: error.message
        });
    }
}
