// TfNSW API interaction module
// Calls our Flask backend

class TfNSWAPI {
    constructor() {
        // Point to our Flask backend on port 5000
        this.backendUrl = '/api';
    }

    // Get departures from a stop
    async getDepartures(stopId, options = {}) {
        try {
            const response = await fetch(`${this.backendUrl}/departures?stop_id=${stopId}`);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return this.parseDepartureData(data);
        } catch (error) {
            console.error('Error fetching departures:', error);
            throw error;
        }
    }

    // Parse the TfNSW departure response
    parseDepartureData(data) {
        const departures = [];
        
        if (!data.stopEvents) {
            return departures;
        }

        data.stopEvents.forEach(event => {
            const departure = {
                line: event.transportation?.number || 'Unknown',
                destination: event.transportation?.destination?.name || 'Unknown',
                departureTime: event.departureTimePlanned || event.departureTimeEstimated,
                platform: event.location?.properties?.platform,
                realtime: event.isRealtimeControlled,
                delay: event.departureTimeEstimated && event.departureTimePlanned 
                    ? this.calculateDelay(event.departureTimePlanned, event.departureTimeEstimated)
                    : 0,
                mode: event.transportation?.product?.class || 'Unknown'
            };
            departures.push(departure);
        });

        return departures;
    }

    // Calculate delay in minutes
    calculateDelay(planned, estimated) {
        const plannedTime = new Date(planned);
        const estimatedTime = new Date(estimated);
        return Math.round((estimatedTime - plannedTime) / 60000);
    }

    // Get current date in YYYYMMDD format
    getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    // Get current time in HHMM format
    getCurrentTime() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}${minutes}`;
    }

    // Format time for display
    formatTime(datetime) {
        const date = new Date(datetime);
        return date.toLocaleTimeString('en-AU', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
    }

    // Get minutes until departure
    getMinutesUntil(datetime) {
        const now = new Date();
        const departure = new Date(datetime);
        const diff = Math.round((departure - now) / 60000);
        return diff;
    }
}

export default new TfNSWAPI();