# NeuroNav - AI Smart Traffic System

An advanced AI-driven Smart Map System using IoT vehicle trackers for real-time traffic management and accident prevention.

## Features

### 🚗 IoT Vehicle Tracking
- Real-time location, speed, and direction monitoring
- Braking pattern analysis
- Lane change detection
- No mobile phone dependency - dedicated trackers

### 🤖 AI Traffic Prediction
- Congestion forecasting
- Delay estimation
- Alternative route suggestions
- Pattern-based accident risk prediction

### ⚠️ Safety Monitoring
- Overspeeding detection
- Tailgating alerts
- Sudden braking warnings
- Lane violation tracking
- Driver risk scoring

### 📍 Context-Aware Rules
- Dynamic speed limits by zone
- School zone alerts
- Hospital zone notifications
- Highway/residential area rules

### 🎯 Proactive Warnings
- "High accident probability ahead"
- "Vehicle nearby is overspeeding"
- "Maintain safe distance"
- "Sharp curve ahead"

### 📊 Smart Dashboard
- Real-time traffic flow visualization
- Driver scoring system
- Environmental data (weather, visibility, road conditions)
- Violation statistics

## Getting Started

1. Open `index.html` in a modern web browser
2. The simulation will start automatically with 150 simulated IoT trackers
3. Use map controls to zoom and pan
4. Monitor real-time alerts and predictions

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Styling**: CSS3 with custom properties
- **Fonts**: Orbitron (display), Rajdhani (body)
- **No dependencies required**

## Architecture

```
NeuroNav/
├── index.html      # Main application structure
├── styles.css      # Futuristic dark theme styling
├── app.js          # Core application logic
└── README.md       # Documentation
```

## Key Components

- **IoTTracker**: Simulates vehicle-mounted tracking devices
- **RoadNetwork**: Manages road segments, intersections, and zones
- **AIPredictor**: Analyzes patterns and generates predictions
- **AlertSystem**: Manages safety warnings and notifications
- **MapRenderer**: Canvas-based map visualization
- **FlowChart**: Real-time traffic flow analytics

## License

MIT License

