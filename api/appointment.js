// Serverless function to handle appointment creation
// Creates Events in Frappe CRM

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
        const appointmentData = req.body;

        // Get credentials from environment variables
        const API_KEY = process.env.FRAPPE_API_KEY;
        const API_SECRET = process.env.FRAPPE_API_SECRET;
        const CRM_URL = process.env.FRAPPE_CRM_URL || 'https://crm.dranikkita.com';

        if (!API_KEY || !API_SECRET) {
            console.error('Missing API credentials');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Calculate end time (default 30 min appointment)
        const startDate = new Date(appointmentData.fecha + 'T' + appointmentData.hora);
        const endDate = new Date(startDate.getTime() + 30 * 60000); // 30 minutes

        // Format dates for Frappe
        const formatDateTime = (date) => {
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        // Prepare Event data for Frappe
        const eventData = {
            doctype: 'Event',
            subject: `Cita: ${appointmentData.nombre}`,
            starts_on: formatDateTime(startDate),
            ends_on: formatDateTime(endDate),
            event_type: 'Public',
            status: 'Open',
            description: `
                <b>Paciente:</b> ${appointmentData.nombre}<br>
                <b>Teléfono:</b> ${appointmentData.telefono}<br>
                <b>Email:</b> ${appointmentData.email}<br>
                <b>Motivo:</b> ${appointmentData.motivo || 'Consulta general'}<br>
                <br>
                <i>Cita agendada desde el sitio web</i>
            `.trim()
        };

        // If we have a lead_id, link it
        if (appointmentData.lead_id) {
            eventData.reference_doctype = 'CRM Lead';
            eventData.reference_docname = appointmentData.lead_id;
        }

        console.log('Creating Event:', JSON.stringify(eventData));

        // Send to Frappe CRM
        const response = await fetch(`${CRM_URL}/api/resource/Event`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(eventData)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Frappe Event Error:', result);
            return res.status(response.status).json({
                error: 'Error creating appointment',
                details: result
            });
        }

        // Success
        return res.status(200).json({
            success: true,
            message: 'Cita agendada correctamente',
            event_id: result.data?.name
        });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
