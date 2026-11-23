const STORAGE_KEY = 'neuronav_trackers';

const phoneState = {
    watchId: null,
    currentCoords: null,
    currentAccuracy: null,
    lastUpdated: null,
    lastAddress: null,
    lastAddressFetch: 0,
    activePhoneNormalized: null,
    activeTrackerId: null,
    startedAt: Date.now()
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initGeolocation();
    initForm();
});

function cacheElements() {
    elements.form = document.getElementById('phoneForm');
    elements.owner = document.getElementById('phoneOwner');
    elements.code = document.getElementById('phoneCode');
    elements.number = document.getElementById('phoneNumberField');
    elements.label = document.getElementById('deviceLabel');
    elements.trackerId = document.getElementById('phoneTrackerId');
    elements.lat = document.getElementById('phoneLat');
    elements.lng = document.getElementById('phoneLng');
    elements.acc = document.getElementById('phoneAccuracy');
    elements.updated = document.getElementById('phoneUpdated');
    elements.address = document.getElementById('phoneAddress');
    elements.gpsDot = document.getElementById('gpsDot');
    elements.gpsStatusText = document.getElementById('gpsStatusText');
    elements.gpsWatchId = document.getElementById('gpsWatchId');
    elements.shareBtn = document.getElementById('shareBtn');
    elements.shareHint = document.getElementById('shareHint');
    elements.shareDot = document.getElementById('phoneShareDot');
    elements.shareStatus = document.getElementById('phoneShareStatus');
}

function initGeolocation() {
    if (!navigator.geolocation) {
        updateGpsStatus('GPS not supported on this device.', false);
        return;
    }

    elements.gpsStatusText.textContent = 'Requesting GPS permission...';
    phoneState.watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
    });
    elements.gpsWatchId.textContent = phoneState.watchId ?? '--';
}

function handlePosition(position) {
    const { latitude, longitude, accuracy } = position.coords;
    phoneState.currentCoords = { lat: latitude, lng: longitude };
    phoneState.currentAccuracy = accuracy;
    phoneState.lastUpdated = new Date();

    elements.lat.textContent = latitude.toFixed(6);
    elements.lng.textContent = longitude.toFixed(6);
    elements.acc.textContent = `±${Math.round(accuracy)}m`;
    elements.updated.textContent = phoneState.lastUpdated.toLocaleTimeString();

    const accuracyOk = accuracy && accuracy < 100;
    updateGpsStatus(accuracyOk ? 'GPS lock acquired' : `Seeking better accuracy (±${Math.round(accuracy)}m)...`, true);
    // Allow sharing once precise (<100m), or after 20s with a usable (<1500m) fix.
    const waitedLongEnough = Date.now() - phoneState.startedAt > 20000 && accuracy < 1500;
    if ((accuracyOk || waitedLongEnough) && elements.shareBtn.disabled && !phoneState.activePhoneNormalized) {
        elements.shareBtn.disabled = false;
        elements.shareHint.textContent = accuracyOk
            ? 'Ready to register. Keep this page open after starting.'
            : 'Location is approximate (no GPS lock). Use a phone outdoors for exact tracking.';
    }

    if (Date.now() - phoneState.lastAddressFetch > 60000) {
        reverseLookup(latitude, longitude).then(addr => {
            if (addr) {
                phoneState.lastAddress = addr;
                elements.address.textContent = addr;
            }
        });
        phoneState.lastAddressFetch = Date.now();
    }

    if (phoneState.activePhoneNormalized) {
        persistLocationUpdate();
    }
}

function handlePositionError(error) {
    updateGpsStatus(error.message || 'Unable to retrieve GPS.', false);
    elements.shareBtn.disabled = true;
    elements.shareHint.textContent = 'Grant GPS permission to start sharing.';
}

function updateGpsStatus(message, online) {
    elements.gpsStatusText.textContent = message;
    if (online) {
        elements.gpsDot.classList.add('online');
        elements.shareDot.classList.add('online');
    } else {
        elements.gpsDot.classList.remove('online');
        elements.shareDot.classList.remove('online');
    }
}

function initForm() {
    elements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        registerPhoneTracker();
    });
}

function registerPhoneTracker() {
    if (!phoneState.currentCoords) {
        elements.shareHint.textContent = 'Waiting for GPS before registering.';
        return;
    }

    const ownerName = elements.owner.value.trim();
    const code = elements.code.value.trim();
    const phoneNumber = elements.number.value.trim();
    const label = elements.label.value.trim();
    const trackerIdInput = elements.trackerId.value.trim();

    if (!ownerName || !phoneNumber) {
        elements.shareHint.textContent = 'Please fill owner name and phone number.';
        return;
    }

    const normalized = normalizePhone(code + phoneNumber);
    if (!normalized) {
        elements.shareHint.textContent = 'Enter a valid phone number.';
        return;
    }

    const trackers = loadTrackers();
    let tracker = trackers.find(t => t.phoneNormalized === normalized);

    const baseTracker = {
        id: tracker?.id || trackerIdInput || generateTrackerId(),
        ownerName,
        phone: `${code}${phoneNumber}`,
        phoneDisplay: `${code} ${phoneNumber}`.trim(),
        phoneNormalized: normalized,
        vehicleType: 'phone',
        vehicleNumber: label || `${ownerName.split(' ')[0]}'s Phone`,
        registeredAt: tracker?.registeredAt || Date.now(),
        simulatedLocation: tracker?.simulatedLocation || phoneState.currentCoords
    };

    tracker = {
        ...tracker,
        ...baseTracker,
        lastLocation: phoneState.currentCoords,
        savedAddress: phoneState.lastAddress || tracker?.savedAddress,
        status: 'online',
        lastSeen: Date.now()
    };

    const updated = trackers.filter(t => t.phoneNormalized !== normalized);
    updated.push(tracker);
    saveTrackers(updated);

    phoneState.activePhoneNormalized = normalized;
    phoneState.activeTrackerId = tracker.id;
    persistLocationUpdate();
    elements.shareStatus.textContent = 'Live sharing active';
    elements.shareHint.textContent = 'Location updates are being synced with NeuroNav.';
    elements.shareBtn.textContent = 'Sharing Enabled';
    elements.shareBtn.disabled = true;

    alert('Phone registered! Keep this tab open to continue sharing location.');
}

function persistLocationUpdate() {
    if (!phoneState.currentCoords || !phoneState.activePhoneNormalized) return;
    const trackers = loadTrackers();
    const tracker = trackers.find(t => t.phoneNormalized === phoneState.activePhoneNormalized);
    if (!tracker) return;

    tracker.lastLocation = phoneState.currentCoords;
    tracker.status = 'online';
    tracker.lastSeen = Date.now();
    tracker.savedAddress = phoneState.lastAddress || tracker.savedAddress;
    tracker.simulatedLocation = tracker.simulatedLocation || phoneState.currentCoords;
    saveTrackers(trackers);
}

function loadTrackers() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
}

function saveTrackers(trackers) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trackers));
}

function normalizePhone(value = '') {
    return value.replace(/\D+/g, '');
}

function generateTrackerId() {
    return 'TRK-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

async function reverseLookup(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`, {
            headers: { 'Accept-Language': 'en' }
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        return data.display_name;
    } catch (error) {
        console.warn('Reverse lookup failed', error);
        return null;
    }
}

