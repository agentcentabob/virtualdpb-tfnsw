import api from '../api.js';

class DepartureBoard {
    constructor() {
        this.stopId = null;
        this.stopName = null;
        this.refreshInterval = null;
        this.searchTimeout = null;
        this.init();
    }

    init() {
        // get DOM elements
        this.stopInput = document.getElementById('stopInput');
        this.loadBtn = document.getElementById('loadBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.departuresEl = document.getElementById('departures');
        this.emptyStateEl = document.getElementById('emptyState');
        this.statusEl = document.getElementById('status');
        this.suggestionsEl = document.getElementById('suggestions');
        this.stationInfoEl = document.getElementById('stationInfo');
        this.stationNameEl = document.getElementById('stationName');
        this.stationIdEl = document.getElementById('stationId');

        // set up event listeners
        this.loadBtn.addEventListener('click', () => this.loadDepartures());
        this.refreshBtn.addEventListener('click', () => this.refresh());
        
        // add search functionality
        this.stopInput.addEventListener('input', (e) => this.handleSearch(e));
        this.stopInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadDepartures();
            }
        });

        // close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target !== this.stopInput) {
                this.suggestionsEl.style.display = 'none';
            }
        });

        // load from localStorage if available
        const savedStopId = localStorage.getItem('lastStopId');
        if (savedStopId) {
            this.stopInput.value = savedStopId;
        }
    }

    async handleSearch(e) {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            this.suggestionsEl.style.display = 'none';
            return;
        }

        // debounce search
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(async () => {
            try {
                const stops = await api.searchStops(query);
                this.displaySuggestions(stops);
            } catch (error) {
                console.error('Search error:', error);
            }
        }, 300);
    }

    displaySuggestions(stops) {
        this.suggestionsEl.innerHTML = '';

        if (stops.length === 0) {
            this.suggestionsEl.style.display = 'none';
            return;
        }

        stops.forEach(stop => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `<span class="stop-name">${this.escapeHtml(stop.name)}</span><span class="stop-id">${stop.id}</span>`;
            item.addEventListener('click', () => {
                this.stopInput.value = stop.name;
                this.stopId = stop.id;
                this.stopName = stop.name;
                this.suggestionsEl.style.display = 'none';
                this.loadDepartures();
            });
            this.suggestionsEl.appendChild(item);
        });

        this.suggestionsEl.style.display = 'block';
    }

    async loadDepartures() {
        const inputValue = this.stopInput.value.trim();
        
        if (!inputValue) {
            this.showStatus('Please enter a stop ID or search for a station', 'error');
            return;
        }

        // Clear previous stop data
        this.stopId = null;
        this.stopName = null;

        // if stopId is not already set from search, use the input value
        if (!this.stopId) {
            this.stopId = inputValue;
            this.stopName = inputValue;
        }

        localStorage.setItem('lastStopId', this.stopId);
        
        await this.fetchAndDisplay();
        
        // set up auto-refresh every 30 seconds
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.refreshInterval = setInterval(() => this.refresh(), 30000);
    }

    async refresh() {
        if (!this.stopId) return;
        await this.fetchAndDisplay();
    }

    async fetchAndDisplay() {
        this.showStatus('Loading departures...', 'loading');
        this.emptyStateEl.style.display = 'none';

        try {
            const departures = await api.getDepartures(this.stopId);
            
            if (departures.length === 0) {
                this.departuresEl.innerHTML = '';
                this.emptyStateEl.style.display = 'block';
                this.emptyStateEl.innerHTML = '<p>No departures found for this stop</p>';
                this.showStatus('No departures found', 'error');
                this.displayStationInfo();
                return;
            }

            this.renderDepartures(departures);
            this.displayStationInfo();
            const now = new Date().toLocaleTimeString('en-AU', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
            });
            this.showStatus(`Last updated: ${now}`, '');
            
        } catch (error) {
            console.error('Error:', error);
            this.showStatus('Error loading departures. Check console for details.', 'error');
            this.emptyStateEl.style.display = 'block';
            this.emptyStateEl.innerHTML = '<p>Error loading departures. Please check your API key and stop ID.</p>';
        }
    }

    displayStationInfo() {
        if (this.stopId && this.stopName) {
            this.stationNameEl.textContent = this.stopName;
            this.stationIdEl.textContent = `(${this.stopId})`;
            this.stationInfoEl.style.display = 'block';
        } else if (this.stopId) {
            this.stationNameEl.textContent = this.stopId;
            this.stationIdEl.textContent = '';
            this.stationInfoEl.style.display = 'block';
        }
    }

    renderDepartures(departures) {
        this.departuresEl.innerHTML = '';

        departures.forEach(dep => {
            const row = document.createElement('div');
            row.className = 'departure-row';

            const minsUntil = api.getMinutesUntil(dep.departureTime);
            
            // Format time display: "mins until" in white, then "[delay]" in colored brackets
            let timeDisplay = '';
            if (minsUntil <= 2) {
                timeDisplay = '<span class="time-mins">NOW</span>';
            } else {
                timeDisplay = `<span class="time-mins">${minsUntil} min</span>`;
            }

            // Add delay in brackets with appropriate color
            if (dep.delay > 0) {
                let delayClass = 'delay-minor';
                if (dep.delay >= 3) {
                    delayClass = 'delay-major';
                }
                timeDisplay += ` <span class="time-delay ${delayClass}">[+${dep.delay}]</span>`;
            } else if (minsUntil > 2) {
                timeDisplay += ` <span class="time-delay delay-ontime">[on time]</span>`;
            }

            // Get short line name
            const shortLine = api.getShortLineName(dep.line);
            const lineColor = api.getLineColor(dep.line);
            const lineStyle = `background-color: ${lineColor}; color: ${this.getContrastedTextColor(lineColor)};`;

            // Get short platform
            const shortPlatform = api.getShortPlatform(dep.platform);

            // Fleet type and stopping pattern info
            const fleetInfo = dep.fleetType ? ` • ${dep.fleetType}` : '';
            const stoppingInfo = dep.stoppingPattern ? ` • ${dep.stoppingPattern}` : '';

            row.innerHTML = `
                <div class="col-time">${timeDisplay}</div>
                <div class="col-line" style="${lineStyle}">${this.escapeHtml(shortLine)}</div>
                <div class="col-destination">
                    <div class="destination-main">${this.escapeHtml(dep.destination)}</div>
                    <div class="destination-info">${fleetInfo}${stoppingInfo}</div>
                </div>
                <div class="col-platform">${shortPlatform}</div>
            `;

            this.departuresEl.appendChild(row);
        });
    }

    getContrastedTextColor(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return white or black based on luminance
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    showStatus(message, type) {
        this.statusEl.textContent = message;
        this.statusEl.className = `status ${type}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// initialise the board
new DepartureBoard();