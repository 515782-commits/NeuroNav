/**
 * NeuroNav - AI Smart Traffic System
 * Real-world GPS tracking with Leaflet maps
 */

// Route modes shown in the Route Planner (data-type on the buttons) and their map colours.
const ROUTE_MODES = {
    fastest: { label: 'Fastest', color: '#00f5d4' },
    safest:  { label: 'Safest',  color: '#7c8cff' },
    eco:     { label: 'Eco',     color: '#4ade80' }
};

// ============================================
// Main Application
// ============================================
class NeuroNavApp {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.routeLayer = null;
        this.altRouteLayer = null;
        this.destMarker = null;
        this.routeState = null;
        this.watchId = null;
        this.currentPosition = null;
        this.positionHistory = [];
        this.alerts = [];
        this.tripStartTime = null;
        this.tripDistance = 0;
        this.lastPosition = null;
        this.bestAccuracy = Infinity;
        this.accuracyCircle = null;
        this.gpsRetryCount = 0;
        this.maxGpsRetries = 5;
        this.registeredTrackers = [];
        this.trackerMarkers = new Map();
        this.trackerSyncInterval = null;
        this.aiAnalysisInterval = null;
        this.storageListener = this.handleStorageEvent.bind(this);
        window.addEventListener('storage', this.storageListener);
        
        // AI Neural Network Engine
        this.ai = null;
        this.weatherData = null;
        this.lastAIUpdate = 0;
        
        this.init();
    }

    async init() {
        this.showLoading(true);
        this.initMap();
        this.initEventListeners();
        this.initTrackerControls();
        this.initDiscover();
        await Promise.all([
            this.initAI(),
            this.startTracking()
        ]);
        this.startWeatherUpdates();
        this.startAIAnalysis();
        this.syncRegisteredTrackers();
        this.startTrackerSync();
    }

    async initAI() {
        try {
            if (typeof NeuroNavAI === 'undefined') {
                console.warn('AI module not loaded');
                return;
            }
            this.addAlert('info', 'AI Engine', 'Training neural networks...');
            this.ai = new NeuroNavAI();
            await this.ai.initialize();
            this.addAlert('info', 'AI Ready', 'Neural networks trained with TensorFlow.js');
        } catch (error) {
            console.error('AI initialization failed', error);
            this.addAlert('warning', 'AI Error', 'Unable to initialize neural networks');
        }
    }

    startAIAnalysis() {
        if (this.aiAnalysisInterval) {
            clearInterval(this.aiAnalysisInterval);
        }
        this.aiAnalysisInterval = setInterval(() => this.runAIAnalysis(), 6000);
    }

    runAIAnalysis() {
        if (!this.ai || !this.ai.ready || !this.currentPosition) return;

        const lastPos = this.positionHistory[this.positionHistory.length - 1];
        const speed = lastPos?.speed ? lastPos.speed * 3.6 : 0;

        // Record behavior data for AI
        this.ai.recordBehavior({
            speed,
            braking: this.detectBraking(),
            acceleration: this.detectAcceleration(),
            laneChange: false,
            followingDistance: 50 + Math.random() * 50
        });

        // Get AI safety report
        const report = this.ai.getSafetyReport({
            currentSpeed: speed,
            weather: this.weatherData?.weather || 0.8,
            visibility: this.weatherData?.visibility || 0.8,
            roadCondition: this.weatherData?.roadCondition || 0.8,
            hour: new Date().getHours()
        });
        if (!report) return;

        // Update UI with AI insights
        this.updateAIInsights(report);

        // Generate alerts from AI
        this.processAIAlerts(report);
    }

    detectBraking() {
        if (this.positionHistory.length < 2) return false;
        const curr = this.positionHistory[this.positionHistory.length - 1];
        const prev = this.positionHistory[this.positionHistory.length - 2];
        return (prev.speed - curr.speed) > 2; // Deceleration > 2 m/s
    }

    detectAcceleration() {
        if (this.positionHistory.length < 2) return 0;
        const curr = this.positionHistory[this.positionHistory.length - 1];
        const prev = this.positionHistory[this.positionHistory.length - 2];
        return curr.speed - prev.speed;
    }

    updateAIInsights(report) {
        // Update prediction panel
        const prediction = document.getElementById('aiPrediction');
        if (prediction && report.traffic) {
            prediction.style.display = 'block';
            
            const congestionColor = report.traffic.congestionLevel > 0.7 ? '#f72585' : 
                                   report.traffic.congestionLevel > 0.4 ? '#ff9f1c' : '#00f5d4';
            
            document.getElementById('predictionText').innerHTML = `
                <span style="color: ${congestionColor}">Traffic: ${report.traffic.congestionText}</span> | 
                Risk: <span style="color: ${report.accident.probability > 50 ? '#f72585' : '#00f5d4'}">${report.accident.probabilityText}</span>
            `;
            
            document.getElementById('predictionSuggestion').innerHTML = `
                🧠 AI Safety Score: <strong>${report.overallSafetyScore}/100</strong> | 
                ${report.accident.recommendations[0] || 'Drive safely'}
            `;
        }

        // Update AI Analysis Panel
        const safetyScore = document.getElementById('aiSafetyScore');
        const safetyBar = document.getElementById('aiSafetyBar');
        const accidentRisk = document.getElementById('aiAccidentRisk');
        const accidentBar = document.getElementById('aiAccidentBar');
        const trafficFlow = document.getElementById('aiTrafficFlow');
        const trafficBar = document.getElementById('aiTrafficBar');
        const driverBehavior = document.getElementById('aiDriverBehavior');
        const confidence = document.getElementById('aiConfidence');

        if (safetyScore) {
            safetyScore.textContent = `${report.overallSafetyScore}/100`;
            safetyBar.style.width = `${report.overallSafetyScore}%`;
        }
        
        if (accidentRisk) {
            accidentRisk.textContent = `${report.accident.probability}%`;
            accidentRisk.style.color = report.accident.probability > 50 ? '#f72585' : '#00f5d4';
            accidentBar.style.width = `${report.accident.probability}%`;
        }
        
        if (trafficFlow) {
            trafficFlow.textContent = report.traffic.congestionText;
            trafficBar.style.width = `${report.traffic.congestionLevel * 100}%`;
        }
        
        if (driverBehavior) {
            driverBehavior.textContent = report.behavior.drivingStyle;
            driverBehavior.style.color = report.behavior.safetyScore > 70 ? '#00f5d4' : 
                                         report.behavior.safetyScore > 40 ? '#ff9f1c' : '#f72585';
        }
        
        if (confidence) {
            confidence.textContent = `${Math.round(report.accident.confidence * 100)}%`;
        }
    }

    processAIAlerts(report) {
        const now = Date.now();
        
        // Throttle alerts (max 1 per 30 seconds)
        if (now - this.lastAIUpdate < 30000) return;
        
        // Check for critical conditions
        if (report.accident.probability > 70) {
            this.addAlert('critical', '⚠️ High Accident Risk', 
                `AI detected ${report.accident.probability}% risk. ${report.accident.recommendations[0]}`);
            this.lastAIUpdate = now;
        } else if (report.behavior.fatigueRisk === 'High') {
            this.addAlert('warning', '😴 Fatigue Detected', 
                'AI analysis suggests driver fatigue. Consider taking a break.');
            this.lastAIUpdate = now;
        } else if (report.traffic.congestionLevel > 0.8) {
            this.addAlert('warning', '🚗 Heavy Traffic Ahead', 
                `AI predicts ${report.traffic.delayMinutes} min delay. Consider alternate route.`);
            this.lastAIUpdate = now;
        }

        // Process behavior alerts
        report.behavior.alerts.forEach(alert => {
            if (now - this.lastAIUpdate >= 30000) {
                this.addAlert(alert.type, '🧠 AI Behavior Alert', alert.message);
                this.lastAIUpdate = now;
            }
        });
    }

    startTrackerSync() {
        if (this.trackerSyncInterval) clearInterval(this.trackerSyncInterval);
        this.trackerSyncInterval = setInterval(() => this.syncRegisteredTrackers(), 7000);
    }

    syncRegisteredTrackers() {
        this.registeredTrackers = this.loadRegisteredTrackers();
        this.renderRegisteredTrackers();
    }

    handleStorageEvent(event) {
        if (event.key === 'neuronav_trackers') {
            this.syncRegisteredTrackers();
        }
    }

    normalizePhone(value = '') {
        return value.replace(/\D+/g, '');
    }

    loadRegisteredTrackers() {
        try {
            const data = localStorage.getItem('neuronav_trackers');
            if (!data) return [];
            const trackers = JSON.parse(data);
            return trackers.map(t => ({
                ...t,
                phoneDisplay: t.phoneDisplay || t.phone || '',
                phoneNormalized: t.phoneNormalized || this.normalizePhone(t.phoneDisplay || t.phone || ''),
                simulatedLocation: t.simulatedLocation || {
                    lat: 28.6139 + (Math.random() - 0.5) * 0.1,
                    lng: 77.2090 + (Math.random() - 0.5) * 0.1
                }
            }));
        } catch (error) {
            console.warn('Tracker data unavailable', error);
            return [];
        }
    }

    // ------------------------------------------------------------
    // Discover Nearby: tourist places & cafes (OpenStreetMap / Overpass)
    // ------------------------------------------------------------
    initDiscover() {
        this.discover = { category: 'tourist', cache: new Map(), layer: null, lastQuery: null, token: 0 };
        document.querySelectorAll('.discover-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.discover-tab').forEach((t) => {
                    const on = t === tab;
                    t.classList.toggle('active', on);
                    t.setAttribute('aria-selected', String(on));
                });
                this.discover.category = tab.dataset.category;
                this.loadDiscover();
            });
        });
        document.getElementById('discoverRadius')?.addEventListener('change', () => this.loadDiscover());
        document.getElementById('discoverRefresh')?.addEventListener('click', () => this.loadDiscover(true));

        // Refresh automatically when the first fix arrives or the user moves >1.5 km.
        setInterval(() => {
            if (!this.currentPosition) return;
            const q = this.discover.lastQuery;
            if (!q || this.calculateDistance(q, this.currentPosition) > 1500) this.loadDiscover();
        }, 4000);
    }

    discoverQuery(category, lat, lng, radius) {
        const around = `(around:${radius},${lat},${lng})`;
        const filters = category === 'cafe'
            ? [`nwr["amenity"="cafe"]["name"]${around};`]
            : [
                `nwr["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park|gallery|aquarium)$"]["name"]${around};`,
                `nwr["historic"~"^(monument|memorial|castle|fort|ruins|archaeological_site)$"]["name"]${around};`,
                `nwr["amenity"="place_of_worship"]["tourism"]["name"]${around};`
              ];
        return `[out:json][timeout:20];(${filters.join('')});out center 200;`;
    }

    discoverMeta(category, tags) {
        if (category === 'cafe') {
            return { icon: '☕', type: tags.cuisine ? `Cafe • ${tags.cuisine.split(';')[0].replace(/_/g, ' ')}` : 'Cafe' };
        }
        const kind = tags.tourism || tags.historic || 'attraction';
        const icons = { museum: '🏛️', viewpoint: '🌄', zoo: '🦁', theme_park: '🎢', gallery: '🖼️', aquarium: '🐠',
            monument: '🗿', memorial: '🕊️', castle: '🏰', fort: '🏯', ruins: '🏚️', archaeological_site: '🏺' };
        return { icon: icons[kind] || '📸', type: kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) };
    }

    async loadDiscover(force = false) {
        const status = document.getElementById('discoverStatus');
        const list = document.getElementById('discoverList');
        if (!status || !list) return;
        if (!this.currentPosition) {
            status.textContent = 'Waiting for your location… allow location access, or search a landmark in "Current Location" to set it manually.';
            status.className = 'discover-status';
            return;
        }

        const { lat, lng } = this.currentPosition;
        const category = this.discover.category;
        const radius = Number(document.getElementById('discoverRadius').value) || 5000;
        const key = `${category}|${radius}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
        this.discover.lastQuery = { lat, lng };
        const token = ++this.discover.token;

        let places = !force && this.discover.cache.get(key);
        if (!places) {
            status.textContent = category === 'cafe' ? 'Finding cafes near you…' : 'Finding tourist places near you…';
            status.className = 'discover-status';
            list.replaceChildren();
            try {
                places = await this.fetchOverpass(this.discoverQuery(category, lat, lng, radius), category, lat, lng, radius);
                this.discover.cache.set(key, places);
            } catch (error) {
                if (token !== this.discover.token) return;
                console.error('Discover failed:', error);
                status.textContent = `Couldn't load suggestions (${error.message || 'network error'}). Press ↻ to retry.`;
                status.className = 'discover-status error';
                return;
            }
        }
        if (token !== this.discover.token) return; // tab/radius changed meanwhile

        if (!places.length) {
            status.textContent = `No ${category === 'cafe' ? 'cafes' : 'tourist places'} found within ${radius / 1000} km. Try a larger radius.`;
            status.className = 'discover-status';
            this.drawDiscoverMarkers([]);
            return;
        }
        status.textContent = `${places.length} ${category === 'cafe' ? 'cafes' : 'places'} near you · tap to view, “Go” to route`;
        status.className = 'discover-status';
        this.renderDiscover(places);
    }

    async fetchWithTimeout(url, options = {}, ms = 25000) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        try {
            return await fetch(url, { ...options, signal: ctrl.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    async fetchOverpass(query, category, lat, lng, radius = 5000) {
        const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.private.coffee/api/interpreter'
        ];
        const origin = { lat, lng };
        const finish = (list) => {
            const seen = new Set();
            return list
                .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.name)
                .map((p) => ({ ...p, distance: this.calculateDistance(origin, p) }))
                .filter((p) => !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 15);
        };

        let lastError;
        for (const url of endpoints) {
            try {
                const res = await this.fetchWithTimeout(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'data=' + encodeURIComponent(query)
                });
                if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
                const data = await res.json();
                return finish((data.elements || []).map((el) => {
                    const tags = el.tags || {};
                    const meta = this.discoverMeta(category, tags);
                    return { name: tags.name, lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon, icon: meta.icon, type: meta.type };
                }));
            } catch (e) { lastError = e; console.warn('Overpass endpoint failed:', url, e); }
        }

        // Fallback: Nominatim search restricted to a box around the user.
        try {
            const dLat = radius / 111000;
            const dLng = radius / (111000 * Math.max(Math.cos(lat * Math.PI / 180), 0.2));
            const viewbox = `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`;
            const terms = category === 'cafe' ? ['cafe'] : ['tourist attraction', 'museum', 'monument', 'temple'];
            const batches = await Promise.all(terms.map(async (term) => {
                const res = await this.fetchWithTimeout(
                    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(term)}`,
                    { headers: { 'Accept': 'application/json' } }, 15000);
                if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
                return res.json();
            }));
            const found = finish(batches.flat().map((r) => ({
                name: r.name || (r.display_name || '').split(',')[0],
                lat: parseFloat(r.lat), lng: parseFloat(r.lon),
                icon: category === 'cafe' ? '☕' : '📸',
                type: (r.type || r.category || (category === 'cafe' ? 'cafe' : 'attraction')).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
            })));
            if (found.length) return found;
        } catch (e) { lastError = lastError || e; console.warn('Nominatim fallback failed', e); }

        throw lastError || new Error('no data source reachable');
    }

    renderDiscover(places) {
        const list = document.getElementById('discoverList');
        list.replaceChildren();
        places.forEach((place) => {
            const item = document.createElement('div');
            item.className = 'discover-item';
            item.tabIndex = 0;
            item.setAttribute('role', 'button');

            const icon = document.createElement('span');
            icon.className = 'discover-icon';
            icon.textContent = place.icon;

            const info = document.createElement('div');
            info.className = 'discover-info';
            const name = document.createElement('span');
            name.className = 'discover-name';
            name.textContent = place.name;
            name.title = place.name;
            const meta = document.createElement('span');
            meta.className = 'discover-meta';
            const km = place.distance < 1000 ? `${Math.round(place.distance)} m` : `${(place.distance / 1000).toFixed(1)} km`;
            meta.textContent = `${place.type} · ${km} away`;
            info.append(name, meta);

            const go = document.createElement('button');
            go.type = 'button';
            go.className = 'discover-go';
            go.textContent = 'Go';
            go.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setDestination(place);
                this.calculateRoute();
            });

            const show = () => {
                this.autoFollow = false;
                this.map.setView([place.lat, place.lng], 17);
                this.setDestination(place);
            };
            item.addEventListener('click', show);
            item.addEventListener('keydown', (e) => { if (e.key === 'Enter') show(); });

            item.append(icon, info, go);
            list.appendChild(item);
        });
        this.drawDiscoverMarkers(places);
    }

    setDestination(place) {
        this.selectedDestination = { name: place.name, lat: place.lat, lng: place.lng };
        document.getElementById('endInput').value = place.name;
    }

    drawDiscoverMarkers(places) {
        if (this.discover.layer) {
            this.map.removeLayer(this.discover.layer);
            this.discover.layer = null;
        }
        if (!places.length) return;
        const markers = places.map((p) => {
            const icon = L.divIcon({
                className: 'discover-marker',
                html: `<div style="font-size:20px;filter:drop-shadow(0 0 4px #000)">${p.icon}</div>`,
                iconSize: [24, 24], iconAnchor: [12, 12]
            });
            const m = L.marker([p.lat, p.lng], { icon });
            const box = document.createElement('div');
            const b = document.createElement('strong');
            b.textContent = p.name;
            box.append(b, document.createElement('br'), document.createTextNode(p.type));
            m.bindPopup(box);
            m.on('click', () => this.setDestination(p));
            return m;
        });
        this.discover.layer = L.layerGroup(markers).addTo(this.map);
    }

    initTrackerControls() {
        const searchInput = document.getElementById('trackerSearchInput');
        const searchBtn = document.getElementById('trackerSearchBtn');
        this.trackerSearchStatus = document.getElementById('trackerSearchStatus');
        if (!searchInput || !searchBtn) return;

        searchBtn.addEventListener('click', () => {
            this.locateTrackerByPhone(searchInput.value);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.locateTrackerByPhone(searchInput.value);
            }
        });
    }

    renderRegisteredTrackers() {
        const listEl = document.getElementById('mainTrackersList');
        if (!listEl) return;

        if (!this.registeredTrackers.length) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <p>No trackers yet. <a href="register.html">Register a vehicle</a>.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = this.registeredTrackers.map(tracker => {
            const status = tracker.status || 'offline';
            const lastSeen = tracker.lastSeen ? this.getTimeAgo(tracker.lastSeen) : 'Never';
            const locationLabel = tracker.savedAddress
                ? tracker.savedAddress
                : tracker.lastLocation
                    ? `Lat ${tracker.lastLocation.lat.toFixed(4)}, Lng ${tracker.lastLocation.lng.toFixed(4)}`
                    : 'No location set';

            return `
                <div class="tracker-item" data-track-id="${tracker.id}">
                    <div class="tracker-info">
                        <span class="tracker-owner">${tracker.ownerName}</span>
                        <span class="tracker-phone">${tracker.phoneDisplay}</span>
                        <span class="tracker-vehicle">${tracker.vehicleNumber} • ${tracker.vehicleType}</span>
                        <span class="tracker-location">${locationLabel}</span>
                    </div>
                    <div class="tracker-status">
                        <span>
                            <span class="status-dot ${status === 'online' ? 'online' : 'offline'}"></span>
                            <small>${status === 'online' ? 'Online' : 'Offline'}</small>
                        </span>
                        <small>Last seen: ${lastSeen}</small>
                        <div class="actions">
                            <button data-track-id="${tracker.id}" data-action="locate">Locate</button>
                            <button data-track-id="${tracker.id}" data-action="update-location">Set Location</button>
                            <button data-track-id="${tracker.id}" data-action="delete" class="danger">Delete</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.attachTrackerEvents();
    }

    attachTrackerEvents() {
        const listEl = document.getElementById('mainTrackersList');
        if (!listEl) return;

        listEl.querySelectorAll('button[data-track-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.trackId;
                const action = e.currentTarget.dataset.action;
                if (action === 'locate') {
                    this.focusOnTracker(id);
                } else if (action === 'update-location') {
                    this.promptTrackerLocation(id);
                } else if (action === 'delete') {
                    this.deleteTracker(id);
                }
            });
        });

        listEl.querySelectorAll('.tracker-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const id = item.dataset.trackId;
                this.focusOnTracker(id);
            });
        });
    }

    focusOnTracker(id) {
        const tracker = this.registeredTrackers.find(t => t.id === id);
        if (!tracker) {
            this.addAlert('warning', 'Tracker Not Found', 'Unable to locate this tracker.');
            return;
        }

        const location = tracker.lastLocation || tracker.simulatedLocation;
        if (!location) {
            this.addAlert('info', 'Location Unavailable', 'This tracker has not reported its location yet.');
            return;
        }

        let marker = this.trackerMarkers.get(id);
        if (!marker) {
            const icon = L.divIcon({
                className: 'tracker-map-marker',
                html: `
                    <div style="
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #7b2cbf, #00f5d4);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #0a0a0f;
                        font-size: 16px;
                        border: 2px solid #fff;
                        box-shadow: 0 0 15px rgba(0,245,212,0.5);
                    ">
                        ${tracker.ownerName.charAt(0).toUpperCase()}
                    </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            marker = L.marker([location.lat, location.lng], { icon }).addTo(this.map);
            marker.bindPopup(`
                <div style="font-family: Rajdhani; min-width: 180px;">
                    <strong style="color:#00f5d4;">${tracker.vehicleNumber}</strong><br>
                    <small>${tracker.ownerName}</small><br>
                    <small>${tracker.phoneDisplay}</small><br>
                    <small>${tracker.status || 'offline'}</small>
                </div>
            `);
            this.trackerMarkers.set(id, marker);
        } else {
            marker.setLatLng([location.lat, location.lng]);
        }

        marker.openPopup();
        this.map.setView([location.lat, location.lng], 15);
        this.addAlert('info', 'Tracker Located', `${tracker.ownerName}'s vehicle highlighted on the map.`);

        if (!tracker.savedAddress && tracker.lastLocation) {
            this.reverseLookup(tracker.lastLocation.lat, tracker.lastLocation.lng)
                .then(address => {
                    if (address) {
                        tracker.savedAddress = address;
                        this.saveRegisteredTrackers();
                        this.renderRegisteredTrackers();
                    }
                })
                .catch(() => {});
        }
    }

    promptTrackerLocation(id) {
        const tracker = this.registeredTrackers.find(t => t.id === id);
        if (!tracker) {
            this.addAlert('warning', 'Tracker Not Found', 'Unable to update this tracker.');
            return;
        }

        const input = prompt('Enter new coordinates for this tracker (lat, lng) or leave empty to geocode an address:', tracker.lastLocation ? `${tracker.lastLocation.lat}, ${tracker.lastLocation.lng}` : '');
        if (input === null) return;

        this.updateTrackerLocationData(tracker, input)
            .then(() => {
                this.saveRegisteredTrackers();
                this.renderRegisteredTrackers();
                this.focusOnTracker(id);
                this.addAlert('info', 'Tracker Updated', 'Location saved for this tracker.');
            })
            .catch(err => {
                console.error(err);
                alert('Unable to update location. Please provide coordinates like 28.6139, 77.2090');
            });
    }

    async updateTrackerLocationData(tracker, input) {
        let latLng = null;
        const coordMatch = input.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (coordMatch) {
            latLng = { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
        } else if (input.trim().length > 0) {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`, {
                headers: { 'Accept-Language': 'en', 'User-Agent': 'NeuroNavDashboard' }
            });
            if (!response.ok) throw new Error(`Geocoding API returned HTTP ${response.status}`);
            const results = await response.json();
            if (!Array.isArray(results) || !results.length) throw new Error('No results');
            latLng = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
            tracker.savedAddress = results[0].display_name;
        }

        if (!latLng) throw new Error('No coordinates provided');

        tracker.lastLocation = latLng;
        tracker.status = 'online';
        tracker.lastSeen = Date.now();

        if (!tracker.savedAddress) {
            tracker.savedAddress = await this.reverseLookup(latLng.lat, latLng.lng);
        }
    }

    saveRegisteredTrackers() {
        try {
            localStorage.setItem('neuronav_trackers', JSON.stringify(this.registeredTrackers));
        } catch (error) {
            console.error('Failed to save trackers', error);
        }
    }

    locateTrackerByPhone(phoneInput) {
        if (!phoneInput) {
            this.addAlert('warning', 'Phone Required', 'Enter a registered phone number to locate.');
            this.setTrackerSearchStatus('Enter a phone number to locate a tracker.', 'error');
            return;
        }
        const normalized = this.normalizePhone(phoneInput);
        const rawLower = phoneInput.trim().toLowerCase();
        if (!normalized) {
            this.addAlert('warning', 'Invalid Number', 'Please enter digits (e.g. +91 9876543210).');
            this.setTrackerSearchStatus('Invalid number format.', 'error');
            return;
        }
        let tracker = this.findTrackerByPhone(normalized, rawLower);
        if (!tracker) {
            this.syncRegisteredTrackers();
            tracker = this.findTrackerByPhone(normalized, rawLower);
        }
        if (!tracker) {
            this.addAlert('warning', 'Not Found', 'No tracker registered with that phone number.');
            this.setTrackerSearchStatus('No tracker registered with that number.', 'error');
            return;
        }
        const highlightLabel = tracker.phoneDisplay || tracker.phone || tracker.vehicleNumber || tracker.id;
        this.setTrackerSearchStatus(`Highlighting tracker for ${highlightLabel}`, 'success');
        this.focusOnTracker(tracker.id);
    }

    findTrackerByPhone(inputDigits, rawLower) {
        return this.registeredTrackers.find(t => this.isPhoneMatch(inputDigits, rawLower, t));
    }

    isPhoneMatch(inputDigits, rawLower, tracker) {
        const trackerDigits = tracker.phoneNormalized ||
            this.normalizePhone(tracker.phone) ||
            this.normalizePhone(tracker.phoneDisplay);
        if (!trackerDigits) return false;
        if (trackerDigits === inputDigits) return true;
        if (trackerDigits.endsWith(inputDigits)) return true;
        if (inputDigits.endsWith(trackerDigits)) return true;
        const displayLower = (tracker.phoneDisplay || tracker.phone || '').toLowerCase();
        if (rawLower && displayLower.includes(rawLower)) return true;
        const condensedDisplay = displayLower.replace(/\s+/g, '');
        const condensedInput = rawLower.replace(/\s+/g, '');
        if (condensedInput && condensedDisplay.includes(condensedInput)) return true;
        return false;
    }

    setTrackerSearchStatus(message, type) {
        if (!this.trackerSearchStatus) return;
        this.trackerSearchStatus.textContent = message;
        this.trackerSearchStatus.classList.remove('success', 'error');
        if (type) this.trackerSearchStatus.classList.add(type);
    }

    deleteTracker(id) {
        const tracker = this.registeredTrackers.find(t => t.id === id);
        if (!tracker) return;
        if (!confirm(`Delete tracker ${tracker.vehicleNumber}?`)) return;

        this.registeredTrackers = this.registeredTrackers.filter(t => t.id !== id);
        if (this.trackerMarkers.has(id)) {
            const marker = this.trackerMarkers.get(id);
            marker.remove();
            this.trackerMarkers.delete(id);
        }
        this.saveRegisteredTrackers();
        this.renderRegisteredTrackers();
        this.addAlert('info', 'Tracker Removed', `${tracker.vehicleNumber} has been deleted.`);
    }

    initMap() {
        // Initialize Leaflet map with dark theme
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: true
        }).setView([0, 0], 15);

        // MapTiler dark basemap. The API key is configured in map-config.js.
        // If no key is configured (or MapTiler rejects it), fall back to CARTO
        // so the dashboard remains usable while the key is being set up.
        const mapTilerKey = (window.MAPTILER_API_KEY || '').trim();
        const mapTilerKeyIsConfigured =
            mapTilerKey.length > 0 &&
            mapTilerKey !== 'PASTE_YOUR_MAPTILER_API_KEY_HERE';

        const cartoFallback = () => {
            if (this._usingCartoFallback) return;
            this._usingCartoFallback = true;

            if (this.baseTileLayer && this.map.hasLayer(this.baseTileLayer)) {
                this.map.removeLayer(this.baseTileLayer);
            }

            this.baseTileLayer = L.tileLayer(
                'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 20
                }
            ).addTo(this.map);

            console.warn('NeuroNav: using CARTO fallback tiles. Check your MapTiler key and allowed-domain settings.');
        };

        this._usingCartoFallback = false;

        if (mapTilerKeyIsConfigured) {
            let tileErrors = 0;
            this.baseTileLayer = L.tileLayer(
                `https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}.png?key=${encodeURIComponent(mapTilerKey)}`,
                {
                    minZoom: 1,
                    maxZoom: 20,
                    attribution: '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
                    crossOrigin: true
                }
            ).addTo(this.map);

            // Switch once to CARTO if the key is invalid, restricted, or offline.
            this.baseTileLayer.on('tileerror', (event) => {
                tileErrors += 1;
                console.warn('MapTiler tile request failed:', event?.error || 'HTTP/network error');
                if (tileErrors >= 3) cartoFallback();
            });
        } else {
            console.info('NeuroNav: add your MapTiler key in map-config.js to enable MapTiler tiles.');
            cartoFallback();
        }

        // Add zoom control to bottom right
        L.control.zoom({ position: 'bottomright' }).addTo(this.map);

        // Custom user marker icon
        this.userIcon = L.divIcon({
            className: 'user-marker',
            html: `<div class="user-marker-inner">
                <div class="user-marker-pulse"></div>
                <div class="user-marker-dot"></div>
                <div class="user-marker-direction" id="markerDirection"></div>
            </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        // Alert marker icon
        this.alertIcon = L.divIcon({
            className: 'alert-marker',
            html: '<div class="alert-marker-inner">⚠️</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    }

    initEventListeners() {
        // Locate button
        document.getElementById('locateBtn').addEventListener('click', () => {
            this.autoFollow = true;
            if (this.currentPosition) {
                this.map.setView([this.currentPosition.lat, this.currentPosition.lng], 17);
            } else {
                this.addAlert('info', 'Locating', 'Still waiting for a location fix...');
            }
        });

        // Resume live GPS after a manual / landmark location
        document.getElementById('useGpsBtn')?.addEventListener('click', () => this.useGpsLocation());

        // Route buttons
        document.querySelectorAll('.route-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.route-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // A route is already on screen: re-pick from the routes we have (no new request),
                // unless the destination changed or the vehicle has moved on since.
                const state = this.routeState;
                if (state) {
                    const sameTrip = document.getElementById('endInput').value === state.destText &&
                        this.currentPosition && this.calculateDistance(state.from, this.currentPosition) < 300;
                    if (sameTrip) this.showRoute();
                    else this.calculateRoute();
                }
            });
        });

        // Get route button
        document.getElementById('getRouteBtn').addEventListener('click', () => {
            this.calculateRoute();
        });

        // Destination input - geocoding on enter
        document.getElementById('endInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.calculateRoute();
            }
        });

        // Manual location button
        document.getElementById('setLocationBtn')?.addEventListener('click', () => {
            this.promptManualLocation();
        });

        // Search for a landmark, address, station, or public place and use it as the map location.
        const landmarkInput = document.getElementById('landmarkSearchInput');
        const landmarkButton = document.getElementById('landmarkSearchBtn');
        landmarkButton?.addEventListener('click', () => this.searchLandmarks());
        landmarkInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') this.searchLandmarks();
        });

        // Click on map to set location manually
        this.map.on('contextmenu', (e) => {
            if (confirm('Set this as your current location?')) {
                this.setManualLocation(e.latlng.lat, e.latlng.lng);
            }
        });
    }

    async searchLandmarks() {
        const input = document.getElementById('landmarkSearchInput');
        const button = document.getElementById('landmarkSearchBtn');
        const status = document.getElementById('landmarkSearchStatus');
        const results = document.getElementById('landmarkSearchResults');
        const query = input?.value.trim();
        if (!query) {
            status.textContent = 'Enter a landmark or place name first.';
            status.className = 'landmark-search-status error';
            input?.focus();
            return;
        }

        button.disabled = true;
        status.textContent = 'Searching for matching places…';
        status.className = 'landmark-search-status';
        results.replaceChildren();

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
            const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!response.ok) throw new Error(`Place search returned HTTP ${response.status}`);
            const matches = await response.json();
            if (!Array.isArray(matches) || matches.length === 0) {
                status.textContent = 'No matching landmarks found. Try adding the city or area.';
                status.className = 'landmark-search-status error';
                return;
            }

            status.textContent = `Found ${matches.length} possible match${matches.length === 1 ? '' : 'es'}. Select the correct place:`;
            matches.forEach((place) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'landmark-result';
                item.setAttribute('role', 'option');
                const title = document.createElement('strong');
                title.textContent = place.name || place.display_name.split(',')[0];
                const detail = document.createElement('span');
                detail.textContent = place.display_name;
                item.append(title, detail);
                item.addEventListener('click', () => {
                    const lat = Number(place.lat);
                    const lng = Number(place.lon);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                        status.textContent = 'This result did not include valid map coordinates.';
                        status.className = 'landmark-search-status error';
                        return;
                    }
                    this.setManualLocation(lat, lng, `${place.display_name} (landmark location; approximate)`);
                    document.getElementById('accuracy').textContent = 'Landmark (approx.)';
                    document.getElementById('gpsAccuracy').textContent = 'Landmark (approx.)';
                    status.textContent = `Map location set to ${place.name || place.display_name}.`;
                    status.className = 'landmark-search-status success';
                    results.replaceChildren();
                });
                results.appendChild(item);
            });
        } catch (error) {
            console.error('Landmark search failed:', error);
            status.textContent = 'Landmark search is unavailable right now. Check your connection and try again.';
            status.className = 'landmark-search-status error';
        } finally {
            button.disabled = false;
        }
    }

    promptManualLocation() {
        const input = prompt('Enter coordinates (lat, lng) or leave empty to use map center:\nExample: 28.6139, 77.2090 (New Delhi)');
        if (input === null) return;
        
        if (input.trim() === '') {
            const center = this.map.getCenter();
            this.setManualLocation(center.lat, center.lng);
        } else {
            const parts = input.split(',').map(s => parseFloat(s.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                this.setManualLocation(parts[0], parts[1]);
            } else {
                alert('Invalid format. Use: latitude, longitude');
            }
        }
    }

    // ------------------------------------------------------------
    // Location engine
    // ------------------------------------------------------------
    // Improvements over the old version:
    //  * Fixes are fused with a small Kalman-style filter weighted by the
    //    reported accuracy, so one bad Wi-Fi/IP reading can't throw the
    //    marker kilometres away.
    //  * A manual / landmark location is no longer overwritten by the GPS
    //    watcher; "Use my GPS" switches back.
    //  * The map re-centres when a better fix arrives (the first fix on a
    //    laptop is usually a coarse Wi-Fi/IP guess).
    //  * Reverse geocoding is throttled (Nominatim allows ~1 request/sec).
    //  * The last good fix is remembered so the map starts in the right place.
    startTracking() {
        this.manualOverride = false;
        this.autoFollow = true;
        this.fused = null;           // { lat, lng, accuracy, timestamp }
        this.lastGpsFix = null;
        this.lastGeocode = { lat: null, lng: null, time: 0 };
        this.coarseWarned = false;

        if (!window.isSecureContext) {
            this.addAlert('critical', 'Insecure Page',
                'Browsers only allow accurate location on HTTPS or http://localhost. Do not open this file with file:// - run a local server (e.g. "python -m http.server") and open http://localhost:8000.');
            this.setAddressText('Location is blocked on insecure pages (open via https:// or http://localhost).');
        }

        if (!navigator.geolocation) {
            this.addAlert('error', 'GPS Not Supported', 'Your browser does not support geolocation');
            this.showLoading(false);
            return Promise.resolve();
        }

        // Show the last known location instantly while we wait for a real fix.
        try {
            const saved = JSON.parse(localStorage.getItem('neuronav_last_fix') || 'null');
            if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
                this.map.setView([saved.lat, saved.lng], 15);
            }
        } catch (e) { /* storage unavailable - ignore */ }

        // User dragging the map stops auto-follow; the locate button resumes it.
        this.map.on('dragstart', () => { this.autoFollow = false; });

        return new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                this.showLoading(false);
                this.tripStartTime = this.tripStartTime || Date.now();
                resolve();
            };
            this._resolveFirstFix = done;

            const onPos = (position) => {
                this.handlePositionUpdate(position);
                // Stop the spinner on the first reasonably good fix.
                if (position.coords.accuracy <= 150) done();
            };
            const onErr = (error) => {
                this.handlePositionError(error);
                if (error.code === error.PERMISSION_DENIED) done();
            };

            // One continuous high-accuracy watch. Chrome/Firefox deliver a quick
            // coarse fix first, then refine it as GPS / Wi-Fi data improves.
            this.watchId = navigator.geolocation.watchPosition(onPos, onErr, {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0
            });

            // Never block the dashboard for long: after 12 s show whatever we have.
            setTimeout(done, 12000);
        });
    }

    setAddressText(text) {
        const el = document.getElementById('currentAddress');
        if (el) el.textContent = text;
    }

    // Manual location override (landmark search, right-click, coordinates).
    // GPS updates are ignored until the user chooses "Use my GPS".
    setManualLocation(lat, lng, label) {
        this.manualOverride = true;
        this.autoFollow = true;
        this.fused = null;
        this.currentPosition = { lat, lng };
        this.lastPosition = null;
        this.updateMapPosition(this.currentPosition, 0);
        this.map.setView([lat, lng], 17);
        document.getElementById('latitude').textContent = lat.toFixed(6);
        document.getElementById('longitude').textContent = lng.toFixed(6);
        document.getElementById('accuracy').textContent = 'Manual';
        document.getElementById('gpsAccuracy').textContent = 'Manual';
        document.getElementById('accuracyLabel') && (document.getElementById('accuracyLabel').textContent = 'Manual location');
        if (label) {
            this.setAddressText(label);
        } else {
            this.reverseGeocode(lat, lng, true);
        }
        this.addAlert('info', 'Location Updated', 'Manual location set. GPS updates are paused - click "Use my GPS" to resume.');
        const gpsBtn = document.getElementById('useGpsBtn');
        if (gpsBtn) gpsBtn.hidden = false;
    }

    // Go back to live GPS after a manual location.
    useGpsLocation() {
        this.manualOverride = false;
        this.autoFollow = true;
        this.fused = null;
        const gpsBtn = document.getElementById('useGpsBtn');
        if (gpsBtn) gpsBtn.hidden = true;
        if (this.lastGpsFix && Date.now() - this.lastGpsFix.timestamp < 60000) {
            this.handlePositionUpdate(this.lastGpsFix.raw);
        } else {
            this.setAddressText('Detecting address...');
            this.addAlert('info', 'GPS Resumed', 'Waiting for a fresh GPS fix...');
            // Ask for one immediate fresh reading as well as the running watch.
            navigator.geolocation.getCurrentPosition(
                (p) => this.handlePositionUpdate(p),
                (e) => this.handlePositionError(e),
                { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
            );
        }
    }

    // Combine a new reading with the running estimate, weighting by accuracy.
    fuseFix(prev, z) {
        if (!prev) return { lat: z.lat, lng: z.lng, accuracy: z.accuracy, timestamp: z.timestamp };

        const dt = Math.max(0, (z.timestamp - prev.timestamp) / 1000);
        // The device may have moved since the last fix: grow uncertainty over time.
        const walk = Math.max(z.speed || 0, 2);   // m/s process noise
        const prevVar = prev.accuracy * prev.accuracy + (walk * dt) * (walk * dt);
        const measVar = z.accuracy * z.accuracy;
        const dist = this.calculateDistance(prev, z);

        // A precise fix far from the estimate means the estimate was wrong
        // (e.g. an early IP-based guess): trust the precise fix outright.
        if (z.accuracy <= prev.accuracy && dist > 3 * (Math.sqrt(prevVar) + z.accuracy)) {
            return { lat: z.lat, lng: z.lng, accuracy: z.accuracy, timestamp: z.timestamp };
        }

        const k = prevVar / (prevVar + measVar);
        return {
            lat: prev.lat + k * (z.lat - prev.lat),
            lng: prev.lng + k * (z.lng - prev.lng),
            accuracy: Math.sqrt((1 - k) * prevVar),
            timestamp: z.timestamp
        };
    }

    handlePositionUpdate(position) {
        const { latitude, longitude, accuracy: rawAccuracy, speed, heading } = position.coords;
        const timestamp = position.timestamp || Date.now();
        const accuracy = Number.isFinite(rawAccuracy) && rawAccuracy > 0 ? rawAccuracy : 5000;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        // Always remember the raw GPS fix, even while a manual location is active.
        this.lastGpsFix = { lat: latitude, lng: longitude, accuracy, timestamp, raw: position };
        if (this.manualOverride) return;

        // Ignore out-of-order readings.
        if (this.fused && timestamp < this.fused.timestamp) return;

        const prevFused = this.fused;
        const wasCoarse = !prevFused || prevFused.accuracy > 150;
        this.fused = this.fuseFix(prevFused, { lat: latitude, lng: longitude, accuracy, speed, timestamp });
        const newPosition = { lat: this.fused.lat, lng: this.fused.lng };
        const shownAccuracy = this.fused.accuracy;

        if (shownAccuracy < this.bestAccuracy) this.bestAccuracy = shownAccuracy;

        // Trip distance: only count real movement from precise fixes.
        if (this.lastPosition && shownAccuracy < 50) {
            const dist = this.calculateDistance(this.lastPosition, newPosition);
            if (dist > Math.max(10, shownAccuracy)) this.tripDistance += dist;
            else return this.refreshAfterFix(newPosition, shownAccuracy, speed, heading, timestamp, wasCoarse, false);
        }
        this.lastPosition = newPosition;
        this.refreshAfterFix(newPosition, shownAccuracy, speed, heading, timestamp, wasCoarse, true);
    }

    refreshAfterFix(newPosition, accuracy, speed, heading, timestamp, wasCoarse, moved) {
        this.currentPosition = newPosition;
        this.positionHistory.push({ ...newPosition, timestamp, speed: speed || 0, heading: heading || 0, accuracy });
        if (this.positionHistory.length > 100) this.positionHistory.shift();

        // Remember for the next page load.
        try {
            localStorage.setItem('neuronav_last_fix', JSON.stringify({ ...newPosition, accuracy, timestamp }));
        } catch (e) { /* ignore */ }

        this.updateMapPosition(newPosition, accuracy, wasCoarse && accuracy <= 150);
        this.updateLocationUI(newPosition.lat, newPosition.lng, accuracy, speed, heading);
        this.updateGPSStatus(true);
        this.checkZoneRules(newPosition);
        this.maybeReverseGeocode(newPosition.lat, newPosition.lng);
        this.updateTripStats(speed);
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

        if (accuracy > 500 && !this.coarseWarned) {
            this.coarseWarned = true;
            this.addAlert('warning', 'Approximate Location Only',
                `Your device reported ±${Math.round(accuracy)}m. Laptops/desktops without GPS use Wi-Fi/IP and can be kilometres off. Use a phone outdoors, or search a landmark / right-click the map to set your exact spot.`);
        }
    }

    // Reverse geocode only when we moved noticeably, at most once every 5 s.
    maybeReverseGeocode(lat, lng) {
        const g = this.lastGeocode;
        const now = Date.now();
        if (g.lat !== null) {
            const moved = this.calculateDistance({ lat: g.lat, lng: g.lng }, { lat, lng });
            if (now - g.time < 5000 || (moved < 30 && now - g.time < 120000)) return;
        }
        this.lastGeocode = { lat, lng, time: now };
        this.reverseGeocode(lat, lng);
    }

    handlePositionError(error) {
        let message = 'Unknown error';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied. Click the lock/location icon in the address bar, allow Location, and reload. (Also make sure Windows/macOS/Android location services are ON.)';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable. Turn on device location services and Wi-Fi, or move outdoors.';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out. Still trying - GPS can take a minute outdoors.';
                break;
        }
        this.addAlert('critical', 'GPS Error', message);
        if (error.code !== error.TIMEOUT) this.updateGPSStatus(false);
        if (error.code === error.PERMISSION_DENIED) {
            this.setAddressText('Location permission denied - search a landmark above to set your location manually.');
        }
    }

    updateMapPosition(position, accuracy = 50, forceRecenter = false) {
        if (!this.userMarker) {
            this.userMarker = L.marker([position.lat, position.lng], {
                icon: this.userIcon
            }).addTo(this.map);
            this.map.setView([position.lat, position.lng], accuracy > 500 ? 14 : 16);
        } else {
            this.userMarker.setLatLng([position.lat, position.lng]);
            if (forceRecenter) {
                // First precise fix after a coarse one: jump straight to it.
                this.map.setView([position.lat, position.lng], 17);
            } else if (this.autoFollow && !this.map.getBounds().pad(-0.25).contains([position.lat, position.lng])) {
                this.map.panTo([position.lat, position.lng]);
            }
        }

        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }

        // Show the uncertainty circle whenever the fix isn't precise (>30m).
        if (accuracy > 30) {
            this.accuracyCircle = L.circle([position.lat, position.lng], {
                radius: accuracy,
                color: accuracy > 500 ? '#f72585' : '#ff9f1c',
                fillColor: accuracy > 500 ? '#f72585' : '#ff9f1c',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(this.map);
            // Keep the whole circle visible for coarse fixes.
            if (accuracy > 500 && this.autoFollow) {
                this.map.fitBounds(this.accuracyCircle.getBounds(), { maxZoom: 15, padding: [30, 30] });
            }
        }

        // Update direction indicator
        if (this.positionHistory.length > 1) {
            const last = this.positionHistory[this.positionHistory.length - 1];
            if (last.heading) {
                const dirEl = document.getElementById('markerDirection');
                if (dirEl) dirEl.style.transform = `rotate(${last.heading}deg)`;
            }
        }
    }

    updateLocationUI(lat, lng, accuracy, speed, heading) {
        document.getElementById('latitude').textContent = lat.toFixed(6);
        document.getElementById('longitude').textContent = lng.toFixed(6);
        
        // Color-code accuracy
        const accEl = document.getElementById('accuracy');
        const accText = `±${Math.round(accuracy)}m`;
        accEl.textContent = accText;
        
        // Update accuracy indicator styling
        if (accuracy < 50) {
            accEl.style.color = '#00f5d4'; // Excellent
        } else if (accuracy < 200) {
            accEl.style.color = '#4361ee'; // Good
        } else if (accuracy < 500) {
            accEl.style.color = '#ff9f1c'; // Fair
        } else {
            accEl.style.color = '#f72585'; // Poor
        }
        
        document.getElementById('gpsAccuracy').textContent = accText;
        
        // Update accuracy indicator bar
        const accFill = document.getElementById('accuracyFill');
        const accLabel = document.getElementById('accuracyLabel');
        if (accFill && accLabel) {
            // Calculate percentage (inverse - lower accuracy value = better)
            const pct = Math.max(5, Math.min(100, 100 - (accuracy / 30)));
            accFill.style.width = `${pct}%`;
            
            if (accuracy < 50) {
                accLabel.textContent = 'Excellent GPS';
                accFill.style.background = '#00f5d4';
            } else if (accuracy < 200) {
                accLabel.textContent = 'Good GPS';
                accFill.style.background = '#4361ee';
            } else if (accuracy < 500) {
                accLabel.textContent = 'Fair GPS';
                accFill.style.background = '#ff9f1c';
            } else {
                accLabel.textContent = 'Poor GPS - Move outdoors';
                accFill.style.background = '#f72585';
            }
        }

        // Speed
        const speedKmh = speed ? Math.round(speed * 3.6) : 0;
        document.getElementById('currentSpeed').textContent = `${speedKmh} km/h`;
        document.getElementById('avgSpeed').textContent = speedKmh || '--';

        // Heading
        if (heading) {
            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const index = Math.round(heading / 45) % 8;
            document.getElementById('heading').textContent = `${directions[index]} (${Math.round(heading)}°)`;
        }
    }

    updateTripStats(speed) {
        // Distance
        document.getElementById('tripDistance').textContent = `${(this.tripDistance / 1000).toFixed(2)} km`;

        // Duration
        if (this.tripStartTime) {
            const duration = Math.floor((Date.now() - this.tripStartTime) / 60000);
            document.getElementById('tripDuration').textContent = `${duration} min`;
        }

        // Active vehicles (simulated based on area)
        const activeVehicles = Math.floor(Math.random() * 50) + 100;
        document.getElementById('activeVehicles').textContent = activeVehicles;
    }

    calculateDistance(pos1, pos2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = pos1.lat * Math.PI / 180;
        const φ2 = pos2.lat * Math.PI / 180;
        const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
        const Δλ = (pos2.lng - pos1.lng) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    async reverseGeocode(lat, lng) {
        const token = this._geocodeToken = (this._geocodeToken || 0) + 1;
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } }
            );
            if (!response.ok) throw new Error(`Reverse geocoding API returned HTTP ${response.status}`);
            const data = await response.json();
            if (token !== this._geocodeToken) return; // a newer lookup superseded this one

            if (data.display_name) {
                document.getElementById('currentAddress').textContent = data.display_name;
            }

            // Check for nearby POIs
            this.updateNearbyPOIs(data.address);
        } catch (error) {
            console.error('Geocoding error:', error);
        }
    }

    async reverseLookup(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
                { headers: { 'Accept-Language': 'en' } }
            );
            if (!response.ok) throw new Error(`Reverse geocoding API returned HTTP ${response.status}`);
            const data = await response.json();
            return data.display_name || null;
        } catch (error) {
            console.error('Reverse lookup failed', error);
            return null;
        }
    }

    updateNearbyPOIs(address) {
        const poiList = document.getElementById('nearbyList');
        const pois = [];

        if (address) {
            if (address.road) pois.push({ icon: '🛣️', name: address.road, type: 'Road' });
            if (address.suburb) pois.push({ icon: '🏘️', name: address.suburb, type: 'Area' });
            if (address.city || address.town) pois.push({ icon: '🏙️', name: address.city || address.town, type: 'City' });
            if (address.state) pois.push({ icon: '📍', name: address.state, type: 'State' });
        }

        if (pois.length > 0) {
            poiList.innerHTML = pois.map(poi => `
                <div class="nearby-item">
                    <span class="nearby-icon">${poi.icon}</span>
                    <div class="nearby-info">
                        <span class="nearby-name">${poi.name}</span>
                        <span class="nearby-type">${poi.type}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    checkZoneRules(position) {
        // Default speed limit based on road type (would need real data API)
        const speedLimit = 60;
        document.getElementById('speedLimitIcon').textContent = speedLimit;
        document.getElementById('speedLimitDesc').textContent = `Maximum ${speedLimit} km/h`;

        // Check current speed against limit
        const lastPos = this.positionHistory[this.positionHistory.length - 1];
        if (lastPos && lastPos.speed) {
            const speedKmh = lastPos.speed * 3.6;
            if (speedKmh > speedLimit) {
                this.addAlert('critical', 'Overspeeding Warning', 
                    `Current speed ${Math.round(speedKmh)} km/h exceeds ${speedLimit} km/h limit`);
            }
        }
    }

    // ------------------------------------------------------------
    // Routing: Fastest / Safest / Eco
    // ------------------------------------------------------------
    // The public OSRM server only has one "driving" profile, so the three modes are built here:
    // ask it for several candidate routes (its own alternatives plus a couple of via-point
    // detours), score every candidate, and show the one that best fits the selected mode.
    //   Fastest - lowest travel time.
    //   Safest  - heuristic safety score out of 100 (NOT real crash data): fewer turns and sharp
    //             turns, less time on narrow/slow lanes and unnamed service roads, no needless
    //             extra distance.
    //   Eco     - lowest estimated fuel use, from the speed on every stretch of road
    //             (stop-and-go and very high speeds burn more) plus a small cost per turn.

    getRouteType() {
        const type = document.querySelector('.route-btn.active')?.dataset.type;
        return ROUTE_MODES[type] ? type : 'fastest';
    }

    async calculateRoute() {
        const destination = document.getElementById('endInput').value;
        if (!destination || !this.currentPosition) {
            this.addAlert('warning', 'Route Error', 'Please enter a destination');
            return;
        }

        try {
            let dest;
            const picked = this.selectedDestination;
            if (picked && picked.name === destination) {
                // Destination picked from "Discover Nearby": we already have exact coordinates.
                dest = { lat: picked.lat, lng: picked.lng };
            } else {
                // Geocode destination
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`
                );
                if (!response.ok) throw new Error(`Geocoding API returned HTTP ${response.status}`);
                const data = await response.json();

                if (!Array.isArray(data) || data.length === 0) {
                    this.addAlert('warning', 'Location Not Found', 'Could not find the destination');
                    return;
                }
                dest = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }

            const from = { lat: this.currentPosition.lat, lng: this.currentPosition.lng };
            const routes = await this.fetchRouteCandidates(from, dest);
            if (!routes.length) {
                this.addAlert('warning', 'No Route Found', 'No driving route was found to that destination');
                return;
            }
            this.routeState = { from, dest, destText: destination, routes };
            this.showRoute();
        } catch (error) {
            console.error('Routing error:', error);
            this.addAlert('warning', 'Route Error', 'Could not calculate route');
        }
    }

    async osrmRoutes(points, alternatives = false) {
        const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=${alternatives}`
        );
        if (!response.ok) throw new Error(`Routing API returned HTTP ${response.status}`);
        const data = await response.json();
        return data.code === 'Ok' && Array.isArray(data.routes) ? data.routes : [];
    }

    async fetchRouteCandidates(from, to) {
        // Main request (throws if the routing service is down) - includes OSRM's own alternatives.
        const base = await this.osrmRoutes([from, to], true);
        if (!base.length) return [];
        let candidates = base.map((r) => this.analyzeRoute(r));

        // Short trips rarely have real alternatives. For longer ones, top up with detours that
        // pass through a point to the left / right of the middle of the fastest route.
        if (candidates.length < 3 && this.calculateDistance(from, to) > 1500) {
            const detours = await Promise.all(
                this.detourWaypoints(base[0], from, to).map((via) => this.osrmRoutes([from, via, to]).catch(() => []))
            );
            for (const r of detours.flat()) {
                const cand = this.analyzeRoute(r);
                if (cand.metrics.uturns) continue; // out-and-back spur at the via point
                if (candidates.some((c) => this.routesOverlap(c.route, r))) continue; // same road again
                candidates.push(cand);
            }
        }

        // Drop silly detours so "safest" / "eco" can't pick an absurdly long way round.
        const minDuration = Math.min(...candidates.map((c) => c.route.duration));
        const minDistance = Math.min(...candidates.map((c) => c.route.distance));
        candidates = candidates.filter((c) => c.route.duration <= minDuration * 1.5 && c.route.distance <= minDistance * 1.6);
        return this.scoreCandidates(candidates);
    }

    approxMeters(aLat, aLng, bLat, bLng) {
        const kx = 111320 * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
        return Math.hypot((bLng - aLng) * kx, (bLat - aLat) * 110540);
    }

    // Two points either side of the middle of `route`, perpendicular to the A -> B direction.
    detourWaypoints(route, from, to) {
        const coords = route.geometry.coordinates;
        const [midLng, midLat] = coords[Math.floor(coords.length / 2)];
        const cos = Math.cos(midLat * Math.PI / 180);
        const dx = (to.lng - from.lng) * cos;
        const dy = to.lat - from.lat;
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len; // unit vector perpendicular to the trip direction
        const py = dx / len;
        const offset = Math.min(Math.max(this.calculateDistance(from, to) * 0.2, 400), 3500); // metres
        const dLat = (offset / 111000) * py;
        const dLng = (offset / (111000 * cos)) * px;
        return [
            { lat: midLat + dLat, lng: midLng + dLng },
            { lat: midLat - dLat, lng: midLng - dLng }
        ];
    }

    // True when route `b` mostly follows route `a` (so it isn't a genuinely different option).
    routesOverlap(a, b) {
        const A = a.geometry.coordinates;
        const B = b.geometry.coordinates;
        const stepA = Math.max(1, Math.floor(A.length / 800));
        const stepB = Math.max(1, Math.floor(B.length / 30));
        const refs = A.filter((_, i) => i % stepA === 0);
        let near = 0;
        let total = 0;
        for (let i = 0; i < B.length; i += stepB) {
            total++;
            const [lng, lat] = B[i];
            if (refs.some(([x, y]) => this.approxMeters(lat, lng, y, x) < 100)) near++;
        }
        return total > 0 && near / total >= 0.85;
    }

    // Turn an OSRM route (with steps) into the numbers the three modes are judged on.
    analyzeRoute(route) {
        const TURN_TYPES = new Set(['turn', 'end of road', 'fork', 'on ramp', 'off ramp',
            'roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary']);
        const steps = (route.legs || []).flatMap((leg) => leg.steps || []);
        const totalM = route.distance || steps.reduce((sum, s) => sum + (s.distance || 0), 0) || 1;

        let turns = 0, sharp = 0, uturns = 0, slowM = 0, fastM = 0, unnamedM = 0, fuelL = 0;
        for (const step of steps) {
            const man = step.maneuver || {};
            const mod = man.modifier || '';
            if (TURN_TYPES.has(man.type) && mod !== 'straight') turns++;
            if (mod === 'uturn') uturns++;
            else if (mod === 'sharp left' || mod === 'sharp right') sharp++;

            const meters = step.distance || 0;
            if (!meters) continue;
            const kmh = step.duration > 0 ? (meters / step.duration) * 3.6 : 0;
            if (kmh < 20) slowM += meters;      // crawling: narrow lanes or congestion
            if (kmh > 75) fastM += meters;      // fast roads: crashes are more severe
            if (!step.name) unnamedM += meters; // unnamed service roads / tracks

            // Fuel, litres per 100 km for a typical petrol car: high when crawling, lowest around
            // 60-70 km/h, rising again at high speed.
            const v = Math.min(Math.max(kmh, 5), 120);
            fuelL += (meters / 1000) * (4.5 + 100 / v + 0.000182 * v * v) / 100;
        }

        return {
            route,
            metrics: {
                km: totalM / 1000, turns, sharp, uturns,
                slowShare: slowM / totalM, fastShare: fastM / totalM, unnamedShare: unnamedM / totalM,
                fuelL: fuelL + turns * 0.008 // a little extra fuel for slowing down and speeding up
            }
        };
    }

    // Safety score 0-100 (higher is safer); needs all candidates to measure "extra distance".
    scoreCandidates(candidates) {
        const shortestKm = Math.min(...candidates.map((c) => c.metrics.km));
        for (const { metrics: m } of candidates) {
            const km = Math.max(m.km, 0.5);
            const extraDistance = Math.min((m.km / shortestKm - 1) / 0.5, 1); // 0 - 1 (up to 50% longer)
            const penalty =
                22 * Math.min(m.turns / km / 3, 1) +      // junctions and manoeuvres
                14 * Math.min(m.sharp / km / 0.6, 1) +    // sharp turns and U-turns
                20 * m.slowShare +                        // narrow lanes / crawling traffic
                10 * m.fastShare +                        // very fast roads
                14 * m.unnamedShare +                     // unnamed service roads
                20 * extraDistance;                       // more distance = more exposure
            m.safety = Math.max(0, Math.round(100 - penalty));
        }
        return candidates;
    }

    // Draw the best route for the selected mode (the others stay on the map as faint dashes).
    showRoute() {
        const state = this.routeState;
        if (!state || !state.routes.length) return;
        const { routes, dest } = state;
        const type = this.getRouteType();
        const mode = ROUTE_MODES[type];

        const fastest = routes.reduce((b, c) => (c.route.duration < b.route.duration ? c : b));
        let chosen = fastest;
        if (type === 'safest') {
            const best = routes.reduce((b, c) => (c.metrics.safety > b.metrics.safety ||
                (c.metrics.safety === b.metrics.safety && c.route.duration < b.route.duration) ? c : b));
            if (best.metrics.safety - fastest.metrics.safety >= 2) chosen = best;
        } else if (type === 'eco') {
            const best = routes.reduce((b, c) => (c.metrics.fuelL < b.metrics.fuelL ? c : b));
            if (best.metrics.fuelL <= fastest.metrics.fuelL * 0.99) chosen = best;
        }

        // Replace what was drawn before (route, alternatives and destination marker).
        [this.routeLayer, this.altRouteLayer, this.destMarker].forEach((layer) => layer && this.map.removeLayer(layer));
        const latLngs = (r) => r.geometry.coordinates.map((c) => [c[1], c[0]]);
        this.altRouteLayer = L.layerGroup(
            routes.filter((c) => c !== chosen).map((c) =>
                L.polyline(latLngs(c.route), { color: '#9aa0b8', weight: 4, opacity: 0.55, dashArray: '6 8', interactive: false }))
        ).addTo(this.map);
        this.routeLayer = L.polyline(latLngs(chosen.route), { color: mode.color, weight: 6, opacity: 0.9 }).addTo(this.map);

        const destIcon = L.divIcon({
            className: 'dest-marker',
            html: '<div class="dest-marker-inner">📍</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 30]
        });
        this.destMarker = L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(this.map);
        this.map.fitBounds(this.routeLayer.getBounds(), { padding: [50, 50] });

        // Summary in the alerts panel
        const m = chosen.metrics;
        const f = fastest.metrics;
        const distance = (chosen.route.distance / 1000).toFixed(1);
        const duration = Math.round(chosen.route.duration / 60);
        let message = `Distance: ${distance} km | ETA: ${duration} min`;
        if (type === 'safest') message += ` | Safety score: ${m.safety}/100`;
        if (type === 'eco') message += ` | Est. fuel: ${m.fuelL.toFixed(2)} L`;
        if (type !== 'fastest') {
            if (chosen === fastest) {
                message += ` | The fastest route is also the ${type === 'eco' ? 'most economical' : 'safest'} option here`;
            } else {
                const extra = Math.round((chosen.route.duration - fastest.route.duration) / 60);
                message += ` | +${extra} min vs fastest`;
                message += type === 'safest'
                    ? ` (safety ${f.safety} → ${m.safety})`
                    : ` (${Math.round((1 - m.fuelL / f.fuelL) * 100)}% less fuel)`;
            }
        }
        if (routes.length === 1) message += ' | Only one route available for this trip';
        else message += ` | ${routes.length} routes compared`;
        this.addAlert('info', `${mode.label} Route`, message);

        // Show AI prediction
        this.showPrediction(distance, duration, chosen.metrics);
    }

    showPrediction(distance, duration, metrics = null) {
        const prediction = document.getElementById('aiPrediction');
        prediction.style.display = 'block';
        
        // Use AI for route analysis
        if (this.ai && this.ai.ready) {
            const routes = [{
                distance: parseFloat(distance),
                baseTime: parseInt(duration),
                trafficLevel: 0.5,
                roadQuality: 0.8,
                turns: metrics ? metrics.turns : Math.floor(distance * 2),
                speedLimit: 60,
                safetyScore: metrics ? metrics.safety / 100 : 0.85
            }];
            
            const optimized = this.ai.optimizeRoutes(routes);
            const aiRoute = optimized[0].aiScore;
            
            const traffic = this.ai.analyzeTraffic({
                currentSpeed: 40,
                density: 0.5,
                weather: this.weatherData?.weather || 0.9
            });
            
            document.getElementById('predictionText').innerHTML = `
                Route: <strong>${distance} km</strong> | 
                AI Time: <strong>${aiRoute.estimatedTime} min</strong> | 
                Score: <strong>${aiRoute.overallScore}/100</strong>
            `;
            document.getElementById('predictionSuggestion').innerHTML = `
                🧠 ${traffic.congestionText} (${Math.round(traffic.confidence * 100)}% confidence) | 
                ${aiRoute.recommendation} | 
                Fuel efficiency: ${aiRoute.fuelEfficiency}%
            `;
        } else {
            document.getElementById('predictionText').innerHTML = 
                `Route analyzed: <strong>${distance} km</strong> | Est. time: <strong>${duration} min</strong>`;
            document.getElementById('predictionSuggestion').textContent = 
                'Traffic conditions appear normal. Safe travels!';
        }
    }

    async startWeatherUpdates() {
        if (!this.currentPosition) {
            setTimeout(() => this.startWeatherUpdates(), 5000);
            return;
        }

        try {
            // Using Open-Meteo API (free, no key required)
            const { lat, lng } = this.currentPosition;
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,visibility,precipitation`
            );
            if (!response.ok) throw new Error(`Weather API returned HTTP ${response.status}`);
            const data = await response.json();

            if (data.current) {
                const temp = Math.round(data.current.temperature_2m);
                const humidity = data.current.relative_humidity_2m;
                const visibility = data.current.visibility / 1000;
                const precipitation = data.current.precipitation;
                
                document.getElementById('temperature').textContent = `${temp}°C`;
                document.getElementById('humidity').textContent = `${humidity}%`;
                document.getElementById('visibility').textContent = `${visibility.toFixed(1)} km`;
                
                // Road condition based on precipitation
                const roadCondition = precipitation > 0 ? 'Wet' : 'Dry';
                document.getElementById('roadCondition').textContent = roadCondition;
                
                // Store weather data for AI
                this.weatherData = {
                    temperature: temp,
                    humidity: humidity,
                    visibility: Math.min(1, visibility / 10), // Normalize to 0-1
                    weather: precipitation > 0 ? 0.4 : 0.9, // Weather score
                    roadCondition: precipitation > 0 ? 0.5 : 0.9 // Road condition score
                };
                
                if (roadCondition === 'Wet') {
                    document.getElementById('roadConditionItem').classList.add('warning');
                    this.addAlert('warning', 'Road Condition', 'Wet roads detected. Drive carefully.');
                }
            }
        } catch (error) {
            console.error('Weather fetch error:', error);
        }

        // Update weather every 10 minutes
        setTimeout(() => this.startWeatherUpdates(), 600000);
    }

    addAlert(type, title, message) {
        const alert = {
            type,
            title,
            message,
            time: Date.now()
        };

        this.alerts.unshift(alert);
        if (this.alerts.length > 10) this.alerts.pop();

        this.updateAlertsUI();
        
        // Update badge
        const badge = document.getElementById('alertBadge');
        badge.textContent = this.alerts.length;
        
        // Update incidents count for critical alerts
        const incidents = this.alerts.filter(a => a.type === 'critical').length;
        document.getElementById('incidents').textContent = incidents;
    }

    updateAlertsUI() {
        const alertsList = document.getElementById('alertsList');
        alertsList.innerHTML = this.alerts.map(alert => {
            const timeAgo = this.getTimeAgo(alert.time);
            return `
                <div class="alert-item ${alert.type}">
                    <div class="alert-time">${timeAgo}</div>
                    <div class="alert-content">
                        <strong>${alert.title}</strong>
                        <span>${alert.message}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    }

    showLoading(show) {
        document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
    }

    updateGPSStatus(connected) {
        const dot = document.getElementById('gpsStatus');
        const text = document.getElementById('gpsStatusText');
        
        if (connected) {
            dot.classList.add('online');
            dot.classList.remove('offline');
            text.textContent = 'GPS: Connected';
        } else {
            dot.classList.remove('online');
            dot.classList.add('offline');
            text.textContent = 'GPS: Disconnected';
        }
    }

    destroy() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        if (this.trackerSyncInterval) {
            clearInterval(this.trackerSyncInterval);
        }
        if (this.aiAnalysisInterval) {
            clearInterval(this.aiAnalysisInterval);
        }
        if (this.storageListener) {
            window.removeEventListener('storage', this.storageListener);
        }
    }
}

// ============================================
// Initialize Application
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    window.neuroNav = new NeuroNavApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.neuroNav) {
        window.neuroNav.destroy();
    }
});
