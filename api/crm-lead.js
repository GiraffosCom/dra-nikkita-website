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
            first_name: leadData.personal?.nombre?.split(' ')[0] || 'Sin nombre',
            last_name: leadData.personal?.nombre?.split(' ').slice(1).join(' ') || '',
            email: leadData.personal?.email || '',
            mobile_no: leadData.personal?.telefono || '',
            status: 'New',
            notes: notesContent
        };

        console.log('Sending to Frappe:', JSON.stringify(frappeLeadData));

        // Send to Frappe CRM
        const response = await fetch(`${CRM_URL}/api/resource/CRM Lead`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                'Accept': 'application/json'
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

        const leadId = result.data?.name;

        // Add notes as a Comment (backup method if notes field doesn't exist)
        if (leadId) {
            try {
                await fetch(`${CRM_URL}/api/resource/Comment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `token ${API_KEY}:${API_SECRET}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        comment_type: 'Comment',
                        reference_doctype: 'CRM Lead',
                        reference_name: leadId,
                        content: notesContent.replace(/\n/g, '<br>')
                    })
                });
                console.log('Comment added to lead');
            } catch (commentError) {
                console.error('Error adding comment:', commentError);
            }
        }

        // Upload photos if present
        if (leadData.fotos && leadId) {
            const photoNames = ['frente', 'izquierdo', 'derecho'];

            for (const photoName of photoNames) {
                const photo = leadData.fotos[photoName];
                if (photo && photo.data) {
                    try {
                        // Extract base64 data (remove data:image/xxx;base64, prefix)
                        const base64Data = photo.data.split(',')[1];
                        const buffer = Buffer.from(base64Data, 'base64');

                        // Determine file extension from data URL
                        const mimeMatch = photo.data.match(/data:image\/(\w+);/);
                        const extension = mimeMatch ? mimeMatch[1] : 'jpg';
                        const fileName = `${leadId}_${photoName}.${extension}`;

                        // Create form data for file upload
                        const FormData = (await import('form-data')).default;
                        const formData = new FormData();
                        formData.append('file', buffer, {
                            filename: fileName,
                            contentType: `image/${extension}`
                        });
                        formData.append('is_private', '0');
                        formData.append('doctype', 'CRM Lead');
                        formData.append('docname', leadId);

                        // Upload file to Frappe
                        await fetch(`${CRM_URL}/api/method/upload_file`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                                ...formData.getHeaders()
                            },
                            body: formData
                        });

                        console.log(`Uploaded photo: ${fileName}`);
                    } catch (photoError) {
                        console.error(`Error uploading photo ${photoName}:`, photoError);
                    }
                }
            }
        }

        // Success
        return res.status(200).json({
            success: true,
            message: 'Lead created successfully',
            lead_id: leadId
        });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
