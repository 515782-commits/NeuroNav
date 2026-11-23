/**
 * NeuroNav - Tracker Registration System
 * Register phone numbers and track their locations
 */

class TrackerManager {
    constructor() {
        this.trackers = this.loadTrackers();
        this.map = null;
        this.markers = new Map();
        this.selectedTracker = null;
        this.trackingInterval = null;
        
        this.init();
        window.addEventListener('storage', () => {
            this.trackers = this.loadTrackers();
            this.renderTrackersList();
            this.updateStats();
        });
    }

    init() {
        this.renderTrackersList();
        this.initForm();
        this.updateStats();
    }

    initForm() {
        const form = document.getElementById('registerForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.registerTracker();
        });
    }

    loadTrackers() {
        const saved = localStorage.getItem('neuronav_trackers');
        const trackers = saved ? JSON.parse(saved) : [];
        return trackers.map(t => this.prepareTrackerSchema(t));
    }

    saveTrackers() {
        localStorage.setItem('neuronav_trackers', JSON.stringify(this.trackers));
    }

    generateTrackerId() {
        return 'TRK-' + Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    normalizePhone(value = '') {
        return value.replace(/\D+/g, '');
    }

    prepareTrackerSchema(tracker) {
        const displayPhone = tracker.phoneDisplay || tracker.phone || '';
        return {
            ...tracker,
            phoneDisplay: displayPhone,
            phone: tracker.phone || displayPhone,
            phoneNormalized: tracker.phoneNormalized || this.normalizePhone(displayPhone),
            id: tracker.id || this.generateTrackerId(),
            simulatedLocation: tracker.simulatedLocation || {
                lat: 28.6139 + (Math.random() - 0.5) * 0.1,
                lng: 77.2090 + (Math.random() - 0.5) * 0.1
            }
        };
    }

    async registerTracker() {
        const ownerName = document.getElementById('ownerName').value.trim();
        const countryCode = document.getElementById('countryCode').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const vehicleType = document.getElementById('vehicleType').value;
        const vehicleNumber = document.getElementById('vehicleNumber').value.trim().toUpperCase();
        const trackerId = document.getElementById('trackerId').value.trim() || this.generateTrackerId();
        const locationInput = document.getElementById('trackerLocation').value.trim();

        // Validate
        if (!ownerName || !phoneNumber || !vehicleType || !vehicleNumber) {
            this.showToast('Please fill all required fields', 'error');
            return;
        }

        const normalizedPhone = this.normalizePhone(countryCode + phoneNumber);
        if (!normalizedPhone) {
            this.showToast('Enter a valid phone number', 'error');
            return;
        }

        // Check for duplicate phone
        if (this.trackers.some(t => t.phoneNormalized === normalizedPhone)) {
            this.showToast('This phone number is already registered', 'error');
            return;
        }

        let locationData = null;
        if (locationInput) {
            try {
                locationData = await this.resolveLocation(locationInput);
            } catch (error) {
                console.warn('Failed to resolve location', error);
                this.showToast('Could not resolve location. Saved without coordinates.', 'error');
            }
        }

        // Create tracker object
        const tracker = {
            id: trackerId,
            ownerName,
            phone: `${countryCode}${phoneNumber}`,
            phoneDisplay: `${countryCode.trim()} ${phoneNumber}`.trim(),
            phoneNormalized: normalizedPhone,
            vehicleType,
            vehicleNumber,
            registeredAt: Date.now(),
            lastSeen: null,
            lastLocation: locationData?.coords || null,
            status: locationData ? 'online' : 'offline',
            simulatedLocation: {
                lat: 28.6139 + (Math.random() - 0.5) * 0.1,
                lng: 77.2090 + (Math.random() - 0.5) * 0.1
            }
        };

        if (locationData?.address) {
            tracker.savedAddress = locationData.address;
        }

        this.trackers.push(tracker);
        this.saveTrackers();
        this.renderTrackersList();
        this.updateStats();

        // Clear form
        document.getElementById('registerForm').reset();
        document.getElementById('countryCode').value = '+91';

        this.showToast(`Tracker ${trackerId} registered successfully!`);
    }

    async resolveLocation(input) {
        const coordMatch = input.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[2]);
            return {
                coords: { lat, lng },
                address: `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`
            };
        }

        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`, {
            headers: {
                'Accept-Language': 'en',
                'User-Agent': 'NeuroNavTracker'
            }
        });
        if (!response.ok) throw new Error(`Geocoding API returned HTTP ${response.status}`);
        const results = await response.json();
        if (!results.length) {
            throw new Error('No location found');
        }
        const place = results[0];
        return {
            coords: { lat: parseFloat(place.lat), lng: parseFloat(place.lon) },
            address: place.display_name
        };
    }

    deleteTracker(id) {
        if (!confirm('Are you sure you want to delete this tracker?')) return;
        
        this.trackers = this.trackers.filter(t => t.id !== id);
        this.saveTrackers();
        this.renderTrackersList();
        this.updateStats();

        if (this.selectedTracker === id) {
            this.selectedTracker = null;
            this.hideMap();
        }

        this.showToast('Tracker deleted');
    }

    selectTracker(id) {
        this.selectedTracker = id;
        
        // Update UI
        document.querySelectorAll('.device-card').forEach(card => {
            card.classList.toggle('active', card.dataset.id === id);
        });

        // Show map and start tracking
        this.showMap();
        this.trackDevice(id);
    }

    trackDevice(id) {
        const tracker = this.trackers.find(t => t.id === id);
        if (!tracker) return;

        // Clear previous interval
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }

        // Show tracking info
        document.getElementById('trackingInfo').style.display = 'flex';
        document.getElementById('mapEmptyState').style.display = 'none';

        // Initialize map if not exists
        if (!this.map) {
            this.initMap();
        }

        // Update location
        this.updateTrackerLocation(tracker);

        // Simulate real-time updates
        this.trackingInterval = setInterval(() => {
            this.simulateMovement(tracker);
            this.updateTrackerLocation(tracker);
        }, 3000);
    }

    initMap() {
        const mapContainer = document.getElementById('trackingMap');
        mapContainer.innerHTML = '<div id="mapElement" style="width:100%;height:100%;"></div>';
        
        this.map = L.map('mapElement', {
            zoomControl: true
        }).setView([28.6139, 77.2090], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);
    }

    updateTrackerLocation(tracker) {
        const location = tracker.lastLocation || tracker.simulatedLocation;
        
        // Update marker
        if (this.markers.has(tracker.id)) {
            this.markers.get(tracker.id).setLatLng([location.lat, location.lng]);
        } else {
            const icon = L.divIcon({
                className: 'tracker-marker',
                html: `<div class="tracker-marker-inner" style="
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #00f5d4, #7b2cbf);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #0a0a0f;
                    font-size: 18px;
                    box-shadow: 0 0 20px rgba(0, 245, 212, 0.5);
                    border: 3px solid white;
                ">${this.getVehicleEmoji(tracker.vehicleType)}</div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            const marker = L.marker([location.lat, location.lng], { icon }).addTo(this.map);
            marker.bindPopup(`
                <div style="font-family: Rajdhani; min-width: 150px;">
                    <strong style="color: #00f5d4;">${tracker.vehicleNumber}</strong><br>
                    <small>${tracker.ownerName}</small><br>
                    <small>${tracker.phoneDisplay}</small>
                </div>
            `);
            this.markers.set(tracker.id, marker);
        }

        this.map.setView([location.lat, location.lng], 15);

        // Update tracker status if using actual location
        if (tracker.lastLocation) {
            tracker.lastSeen = Date.now();
            tracker.status = 'online';
        } else {
            tracker.status = 'offline';
        }
        this.saveTrackers();

        // Update tracking info
        const speed = Math.floor(Math.random() * 60) + 10;
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const heading = directions[Math.floor(Math.random() * 8)];
        
        document.getElementById('trackSpeed').textContent = speed;
        document.getElementById('trackHeading').textContent = heading;
        document.getElementById('trackLast').textContent = 'Now';

        if (tracker.savedAddress) {
            this.updateMarkerPopup(tracker.id, tracker.savedAddress);
        } else if (tracker.lastLocation) {
            this.reverseGeocode(location.lat, location.lng, tracker.id);
        }
    }

    simulateMovement(tracker) {
        // Only simulate if no manual fix exists
        if (tracker.lastLocation) return;

        const speed = 0.0002; // Movement factor
        tracker.simulatedLocation.lat += (Math.random() - 0.5) * speed;
        tracker.simulatedLocation.lng += (Math.random() - 0.5) * speed;
    }

    async promptTrackerLocation(id) {
        const tracker = this.trackers.find(t => t.id === id);
        if (!tracker) return;

        const current = tracker.lastLocation
            ? `${tracker.lastLocation.lat}, ${tracker.lastLocation.lng}`
            : (tracker.savedAddress || '');
        const input = prompt('Enter coordinates (lat, lng) or address for this tracker:', current);
        if (input === null) return;

        try {
            const locationData = await this.resolveLocation(input);
            tracker.lastLocation = locationData.coords;
            tracker.savedAddress = locationData.address;
            tracker.status = 'online';
            tracker.lastSeen = Date.now();
            this.saveTrackers();
            this.renderTrackersList();

            if (this.selectedTracker === id) {
                this.updateTrackerLocation(tracker);
            }
        } catch (error) {
            console.error(error);
            alert('Unable to parse location. Please use "lat,lng" or a recognizable address.');
        }
    }

    async reverseGeocode(lat, lng, trackerId) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
                { headers: { 'Accept-Language': 'en' } }
            );
            if (!response.ok) throw new Error(`Geocoding API returned HTTP ${response.status}`);
            const data = await response.json();
            
            if (data.display_name && this.markers.has(trackerId)) {
                const tracker = this.trackers.find(t => t.id === trackerId);
                tracker.savedAddress = data.display_name;
                this.updateMarkerPopup(trackerId, data.display_name);
            }
        } catch (e) {
            console.error('Geocoding error:', e);
        }
    }

    updateMarkerPopup(trackerId, address) {
        if (!this.markers.has(trackerId)) return;
        const tracker = this.trackers.find(t => t.id === trackerId);
        const marker = this.markers.get(trackerId);
        marker.setPopupContent(`
            <div style="font-family: Rajdhani; min-width: 200px;">
                <strong style="color: #00f5d4;">${tracker.vehicleNumber}</strong><br>
                <small>${tracker.ownerName}</small><br>
                <small>${tracker.phoneDisplay}</small><br>
                <hr style="border-color: rgba(255,255,255,0.1); margin: 8px 0;">
                <small style="color: #aaa;">${address || 'No address available'}</small>
            </div>
        `);
    }

    getVehicleEmoji(type) {
        const emojis = {
            car: '🚗',
            suv: '🚙',
            motorcycle: '🏍️',
            truck: '🚛',
            bus: '🚌',
            auto: '🛺',
            other: '🚐'
        };
        return emojis[type] || '📍';
    }

    showMap() {
        document.getElementById('mapEmptyState').style.display = 'none';
    }

    hideMap() {
        document.getElementById('mapEmptyState').style.display = 'flex';
        document.getElementById('trackingInfo').style.display = 'none';
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }
    }

    renderTrackersList() {
        const container = document.getElementById('devicesList');
        
        if (this.trackers.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <p>No trackers registered yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.trackers.map(tracker => `
            <div class="device-card ${this.selectedTracker === tracker.id ? 'active' : ''}" 
                 data-id="${tracker.id}" 
                 onclick="trackerManager.selectTracker('${tracker.id}')">
                <div class="device-info">
                    <span class="device-name">${tracker.ownerName}</span>
                    <span class="device-phone">${tracker.phoneDisplay}</span>
                    <span class="device-vehicle">${tracker.vehicleNumber} • ${tracker.vehicleType}</span>
                    ${tracker.savedAddress ? `<small style="color: var(--text-muted); font-size: 0.7rem;">${tracker.savedAddress}</small>` : ''}
                </div>
                <div class="device-status">
                    <span class="status-badge ${tracker.status}">${tracker.status}</span>
                    <div class="device-actions">
                        <button class="btn-action" onclick="event.stopPropagation(); trackerManager.selectTracker('${tracker.id}')" title="Track">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="10" r="3"/>
                                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/>
                            </svg>
                        </button>
                        <button class="btn-action delete" onclick="event.stopPropagation(); trackerManager.deleteTracker('${tracker.id}')" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                            <button class="btn-action" onclick="event.stopPropagation(); trackerManager.promptTrackerLocation('${tracker.id}')" title="Set Location">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                            </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        document.getElementById('totalTrackers').textContent = this.trackers.length;
        document.getElementById('activeTrackers').textContent = 
            this.trackers.filter(t => t.status === 'online').length;
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('successToast');
        const msgEl = document.getElementById('toastMessage');
        msgEl.textContent = message;
        
        if (type === 'error') {
            toast.style.borderColor = '#f72585';
            toast.querySelector('svg').style.color = '#f72585';
        } else {
            toast.style.borderColor = '#00f5d4';
            toast.querySelector('svg').style.color = '#00f5d4';
        }
        
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Initialize
let trackerManager;
document.addEventListener('DOMContentLoaded', () => {
    trackerManager = new TrackerManager();
});

