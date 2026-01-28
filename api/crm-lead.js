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

        // Build detailed notes with all medical and interest information
        const notesContent = `
📋 INFORMACIÓN DEL LEAD - PRE-EVALUACIÓN

👤 DATOS PERSONALES
- Nombre: ${leadData.personal?.nombre || 'No especificado'}
- Teléfono: ${leadData.personal?.telefono || 'No especificado'}
- Email: ${leadData.personal?.email || 'No especificado'}

📊 DATOS MÉDICOS
- Edad: ${leadData.medical?.edad || 'No especificado'}
- Estatura: ${leadData.medical?.estatura || 'No especificado'} cm
- Peso: ${leadData.medical?.peso || 'No especificado'} kg
- Cirugías previas: ${leadData.medical?.cirugiasPrevias || 'No especificado'}
  ${leadData.medical?.cirugiasPreviasDetalle ? `  Detalle: ${leadData.medical.cirugiasPreviasDetalle}` : ''}
- Condiciones médicas: ${leadData.medical?.condicionesMedicas || 'No especificado'}
  ${leadData.medical?.condicionesMedicasDetalle ? `  Detalle: ${leadData.medical.condicionesMedicasDetalle}` : ''}
- Medicamentos: ${leadData.medical?.medicamentos || 'No especificado'}
  ${leadData.medical?.medicamentosDetalle ? `  Detalle: ${leadData.medical.medicamentosDetalle}` : ''}
- Fumadora: ${leadData.medical?.fumadora || 'No especificado'}

💭 INTERÉS Y EXPECTATIVAS
- Razón de consulta: ${leadData.interest?.razon || 'No especificado'}
- Expectativas: ${leadData.interest?.expectativas || 'No especificado'}
- Disponibilidad: ${leadData.interest?.disponibilidad || 'No especificado'}
- Cómo nos conoció: ${leadData.interest?.comoNosConociste || 'No especificado'}

📅 Fecha de registro: ${new Date().toLocaleString('es-CL')}
🌐 Fuente: Chatbot Web
        `.trim();

        // Prepare lead data for Frappe CRM using standard fields
        const frappeLeadData = {
            doctype: 'CRM Lead',
            first_name: leadData.personal?.nombre?.split(' ')[0] || '',
            last_name: leadData.personal?.nombre?.split(' ').slice(1).join(' ') || '',
            email: leadData.personal?.email || '',
            mobile_no: leadData.personal?.telefono || '',
            source: 'Website',
            notes: notesContent
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
