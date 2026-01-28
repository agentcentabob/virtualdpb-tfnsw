// TfNSW API interaction module
// Calls Flask backend

class TfNSWAPI {
    constructor() {
        // point to Flask backend on port 5000
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
                mode: event.transportation?.product?.class || 'Unknown',
                fleetType: event.transportation?.product?.name || '',
                stoppingPattern: event.stop?.properties?.stopType || ''
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

    // Search for stops by name
    async searchStops(query) {
        try {
            const response = await fetch(`${this.backendUrl}/stops?q=${encodeURIComponent(query)}`);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return data.stops || [];
        } catch (error) {
            console.error('Error searching stops:', error);
            throw error;
        }
    }

    // Map line names to their colors from styles.css
    getLineColor(lineName) {
        const colorMap = {
            // Rail lines
            'T1': '#F99D1C',  // T1 North Sydney Line
            'T2': '#0098CD',  // T2 Bankstown Line
            'T3': '#F37021',  // T3 Eastern Suburbs & Illawarra Line
            'T4': '#005AA3',  // T4 Eastern Suburbs & Airport Link
            'T5': '#C4258F',  // T5 Cumberland Line
            'T6': '#7C3E21',  // T6 Macarthur Line
            'T7': '#6F818E',  // T7 Olympic Park Line
            'T8': '#00954C',  // T8 Airport & South Coast Line
            'T9': '#D11F2F',  // T9 Northern Line
            'Hunter': '#833134',
            'Regional': '#F6891F',
            'Coaches': '#732A82',
            
            // Ferry lines
            'F1': '#00774B',
            'F2': '#144734',
            'F3': '#648C3C',
            'F4': '#BFD730',
            'F5': '#286142',
            'F6': '#00AB51',
            'F7': '#00B189',
            'F8': '#55622B',
            'F9': '#65B32E',
            'Stockton': '#5AB031',
            
            // Light Rail lines
            'L1': '#BE1622',
            'L2': '#DD1E25',
            'L3': '#781140',
            'L4': '#BB2043',
            'NLR': '#EE343F',
            
            // Metro
            'Metro': '#168388',
            'SydneyTrains': '#EC6606',
            'NSWTL': '#DD3F1D',
            'Bus': '#009ED7',
            'LightRail': '#E4022D',
            'Ferry': '#009E4D'
        };

        // Try exact match first
        if (colorMap[lineName]) {
            return colorMap[lineName];
        }

        // Try partial matches
        for (const [key, color] of Object.entries(colorMap)) {
            if (lineName.includes(key) || key.includes(lineName)) {
                return color;
            }
        }

        // Default color
        return '#ffa900';
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

    // Extract short line name (T4, F1, L2, etc)
    getShortLineName(lineName) {
        if (!lineName) return 'Unknown';
        
        // Remove spaces and convert to uppercase
        let short = lineName.trim().toUpperCase();
        
        // Extract just the line identifier (T1, F2, L3, etc)
        const match = short.match(/([TFL])(\d+|[A-Z]+)/);
        if (match) {
            return match[1] + match[2];
        }
        
        // Try other patterns
        if (short.includes('METRO')) return 'Metro';
        if (short.includes('BUS')) return short.split(' ')[0];
        if (short.includes('TRAIN')) return 'Train';
        
        // Return first 4 characters if nothing else matches
        return short.substring(0, 4);
    }

    // Extract short platform/stop identifier
    getShortPlatform(platformString) {
        if (!platformString) return '-';
        
        const str = platformString.trim().toUpperCase();
        
        // For bus stops like "Stop A", "Stop B"
        const busMatch = str.match(/STOP\s*([A-Z])/);
        if (busMatch) return busMatch[1];
        
        // For platforms like "Platform 1", "Platform 2"
        const platformMatch = str.match(/PLATFORM\s*(\d+)/);
        if (platformMatch) return platformMatch[1];
        
        // For numbered formats
        const numMatch = str.match(/\d+/);
        if (numMatch) return numMatch[0];
        
        // For letter formats
        const letterMatch = str.match(/[A-Z]/);
        if (letterMatch) return letterMatch[0];
        
        return platformString;
    }
}

export default new TfNSWAPI();