// Serverless function to handle CRM lead creation
// This keeps API credentials secure on the server side

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
        const leadData = req.body;

        // Get credentials from environment variables (secure)
        const API_KEY = process.env.FRAPPE_API_KEY;
        const API_SECRET = process.env.FRAPPE_API_SECRET;
        const CRM_URL = process.env.FRAPPE_CRM_URL || 'https://crm.dranikkita.com';

        if (!API_KEY || !API_SECRET) {
            console.error('Missing API credentials');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Prepare lead data for Frappe CRM
        const frappeLeadData = {
            doctype: 'CRM Lead',
            first_name: leadData.personal?.nombre?.split(' ')[0] || '',
            last_name: leadData.personal?.nombre?.split(' ').slice(1).join(' ') || '',
            email: leadData.personal?.email || '',
            mobile_no: leadData.personal?.telefono || '',
            source: 'Website',
            // Custom fields - adjust based on your Frappe CRM setup
            custom_edad: leadData.medical?.edad || '',
            custom_estatura: leadData.medical?.estatura || '',
            custom_peso: leadData.medical?.peso || '',
            custom_cirugias_previas: leadData.medical?.cirugiasPrevias || '',
            custom_cirugias_previas_detalle: leadData.medical?.cirugiasPreviasDetalle || '',
            custom_condiciones_medicas: leadData.medical?.condicionesMedicas || '',
            custom_condiciones_medicas_detalle: leadData.medical?.condicionesMedicasDetalle || '',
            custom_medicamentos: leadData.medical?.medicamentos || '',
            custom_medicamentos_detalle: leadData.medical?.medicamentosDetalle || '',
            custom_fumadora: leadData.medical?.fumadora || '',
            custom_razon_consulta: leadData.interest?.razon || '',
            custom_expectativas: leadData.interest?.expectativas || '',
            custom_disponibilidad: leadData.interest?.disponibilidad || '',
            custom_como_nos_conocio: leadData.interest?.comoNosConociste || ''
        };

        // Send to Frappe CRM
        const response = await fetch(`${CRM_URL}/api/resource/CRM Lead`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${API_KEY}:${API_SECRET}`
            },
            body: JSON.stringify(frappeLeadData)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Frappe CRM Error:', result);
            return res.status(response.status).json({
                error: 'Error creating lead in CRM',
                details: result
            });
        }

        // Success
        return res.status(200).json({
            success: true,
            message: 'Lead created successfully',
            lead_id: result.data?.name
        });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
