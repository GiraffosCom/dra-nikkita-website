// Serverless function to check availability
// Fetches existing Events from Frappe CRM to show busy slots

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' });
        }

        // Get credentials from environment variables
        const API_KEY = process.env.FRAPPE_API_KEY;
        const API_SECRET = process.env.FRAPPE_API_SECRET;
        const CRM_URL = process.env.FRAPPE_CRM_URL || 'https://crm.dranikkita.com';

        if (!API_KEY || !API_SECRET) {
            console.error('Missing API credentials');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Fetch events for the given date from Frappe
        // Events that start on the selected date
        const startOfDay = `${date} 00:00:00`;
        const endOfDay = `${date} 23:59:59`;

        const filters = JSON.stringify([
            ['starts_on', '>=', startOfDay],
            ['starts_on', '<=', endOfDay],
            ['status', '!=', 'Cancelled']
        ]);

        const fields = JSON.stringify(['name', 'subject', 'starts_on', 'ends_on', 'status']);

        const url = `${CRM_URL}/api/resource/Event?filters=${encodeURIComponent(filters)}&fields=${encodeURIComponent(fields)}`;

        console.log('Fetching events:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `token ${API_KEY}:${API_SECRET}`,
                'Accept': 'application/json'
            }
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Frappe Error:', result);
            return res.status(response.status).json({
                error: 'Error fetching availability',
                details: result
            });
        }

        // Extract busy time slots from events
        const events = result.data || [];
        const busySlots = events.map(event => {
            const startTime = new Date(event.starts_on);
            const endTime = event.ends_on ? new Date(event.ends_on) : new Date(startTime.getTime() + 30 * 60000);

            return {
                start: startTime.toTimeString().slice(0, 5), // HH:MM format
                end: endTime.toTimeString().slice(0, 5),
                subject: event.subject
            };
        });

        // Define available working hours (configurable)
        const workingHours = {
            start: '09:00',
            end: '18:00',
            slotDuration: 30, // minutes
            breakStart: '13:00',
            breakEnd: '14:00'
        };

        // Generate all possible time slots
        const allSlots = [];
        let currentTime = new Date(`${date}T${workingHours.start}:00`);
        const endTime = new Date(`${date}T${workingHours.end}:00`);
        const breakStart = new Date(`${date}T${workingHours.breakStart}:00`);
        const breakEnd = new Date(`${date}T${workingHours.breakEnd}:00`);

        while (currentTime < endTime) {
            const timeStr = currentTime.toTimeString().slice(0, 5);

            // Skip lunch break
            if (currentTime >= breakStart && currentTime < breakEnd) {
                currentTime = new Date(currentTime.getTime() + workingHours.slotDuration * 60000);
                continue;
            }

            // Check if this slot is busy
            const isBusy = busySlots.some(busy => {
                const slotTime = timeStr;
                return slotTime >= busy.start && slotTime < busy.end;
            });

            allSlots.push({
                time: timeStr,
                available: !isBusy
            });

            currentTime = new Date(currentTime.getTime() + workingHours.slotDuration * 60000);
        }

        return res.status(200).json({
            success: true,
            date: date,
            workingHours: workingHours,
            slots: allSlots,
            busySlots: busySlots
        });

    } catch (error) {
        console.error('Server Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
