// Serverless function to verify payment and create Event
// Called when user returns from MercadoPago to success page

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get payment_id from query params (MercadoPago sends this on redirect)
        const { payment_id, status, external_reference } = req.query;

        console.log('Verifying payment:', { payment_id, status, external_reference });

        if (!payment_id) {
            return res.status(400).json({ error: 'Missing payment_id' });
        }

        // Get MercadoPago Access Token
        const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!MP_ACCESS_TOKEN) {
            return res.status(500).json({ error: 'Configuration error' });
        }

        // Fetch payment details from MercadoPago
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
            }
        });

        const payment = await paymentResponse.json();

        console.log('Payment details:', JSON.stringify(payment, null, 2));

        if (payment.status !== 'approved') {
            return res.status(200).json({
                success: false,
                status: payment.status,
                message: 'Pago no aprobado'
            });
        }

        // Extract appointment data from metadata
        const metadata = payment.metadata || {};
        console.log('Metadata:', metadata);

        const nombre = metadata.nombre || payment.payer?.first_name || 'Sin nombre';
        const email = metadata.email || payment.payer?.email || '';
        const telefono = metadata.telefono || '';
        const servicio = metadata.servicio || 'Consulta';
        const fecha = metadata.fecha;
        const hora = metadata.hora;
        const duracion = metadata.duracion || 30;
        const motivo = metadata.motivo || '';

        // Get Frappe credentials
        const API_KEY = process.env.FRAPPE_API_KEY;
        const API_SECRET = process.env.FRAPPE_API_SECRET;
        const CRM_URL = process.env.FRAPPE_CRM_URL || 'https://crm.dranikkita.com';

        if (!API_KEY || !API_SECRET) {
            return res.status(500).json({ error: 'CRM configuration error' });
        }

        // Calculate dates
        let startDate, endDate;
        if (fecha && hora) {
            startDate = new Date(`${fecha}T${hora}:00`);
            endDate = new Date(startDate.getTime() + parseInt(duracion) * 60000);
        } else {
            // Fallback: use current date + 1 day
            startDate = new Date();
            startDate.setDate(startDate.getDate() + 1);
            startDate.setHours(10, 0, 0, 0);
            endDate = new Date(startDate.getTime() + 30 * 60000);
        }

        const formatDateTime = (date) => {
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        // Create Event in Frappe
        const eventData = {
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
<b>🔖 ID de pago:</b> ${payment_id}<br>
<b>📅 Referencia:</b> ${external_reference}<br>
<br>
<i style="color: green;">✓ Pago confirmado vía MercadoPago</i>
            `.trim()
        };

        console.log('Creating Event:', JSON.stringify(eventData));

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
        console.log('Event result:', JSON.stringify(eventResult));

        // Create Lead
        const leadData = {
            first_name: nombre.split(' ')[0] || 'Sin nombre',
            last_name: nombre.split(' ').slice(1).join(' ') || '',
            email: email || '',
            mobile_no: telefono || '',
            status: 'New',
            notes: `Cita pagada: ${servicio} - ${fecha} ${hora}\nMonto: $${payment.transaction_amount?.toLocaleString('es-CL')} CLP\nID Pago: ${payment_id}`
        };

        const leadResponse = await fetch(`${CRM_URL}/api/resource/CRM Lead`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(leadData)
        });

        const leadResult = await leadResponse.json();
        console.log('Lead result:', JSON.stringify(leadResult));

        return res.status(200).json({
            success: true,
            payment_status: payment.status,
            amount: payment.transaction_amount,
            event_id: eventResult.data?.name,
            lead_id: leadResult.data?.name,
            appointment: {
                nombre,
                fecha,
                hora,
                servicio
            }
        });

    } catch (error) {
        console.error('Verify payment error:', error);
        return res.status(500).json({
            error: 'Error verifying payment',
            message: error.message
        });
    }
}
