/**
 * NeuroNav AI Engine
 * TensorFlow.js powered neural networks for traffic, routing, and behavior analysis
 */

class NeuroNavAI {
    constructor() {
        this.ready = false;
        this.behaviorHistory = [];
        this.maxHistory = 120;
    }

    async initialize() {
        if (typeof tf === 'undefined') {
            throw new Error('TensorFlow.js not loaded');
        }
        await tf.ready();
        await this.buildTrafficModel();
        await this.buildRouteModel();
        await this.buildBehaviorModel();
        this.ready = true;
    }

    async buildTrafficModel() {
        this.trafficModel = tf.sequential({
            layers: [
                tf.layers.dense({ inputShape: [8], units: 32, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.15 }),
                tf.layers.dense({ units: 20, activation: 'relu' }),
                tf.layers.dense({ units: 3, activation: 'sigmoid' })
            ]
        });
        this.trafficModel.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'meanSquaredError'
        });

        const dataset = this.getTrafficDataset();
        const xs = tf.tensor2d(dataset.inputs);
        const ys = tf.tensor2d(dataset.labels);
        await this.trafficModel.fit(xs, ys, { epochs: 180, shuffle: true, verbose: 0 });
        xs.dispose();
        ys.dispose();
    }

    async buildRouteModel() {
        this.routeModel = tf.sequential({
            layers: [
                tf.layers.dense({ inputShape: [6], units: 24, activation: 'relu' }),
                tf.layers.dense({ units: 16, activation: 'relu' }),
                tf.layers.dense({ units: 3, activation: 'sigmoid' })
            ]
        });
        this.routeModel.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'meanSquaredError'
        });

        const dataset = this.getRouteDataset();
        const xs = tf.tensor2d(dataset.inputs);
        const ys = tf.tensor2d(dataset.labels);
        await this.routeModel.fit(xs, ys, { epochs: 160, shuffle: true, verbose: 0 });
        xs.dispose();
        ys.dispose();
    }

    async buildBehaviorModel() {
        this.behaviorModel = tf.sequential({
            layers: [
                tf.layers.dense({ inputShape: [6], units: 20, activation: 'relu' }),
                tf.layers.dense({ units: 12, activation: 'relu' }),
                tf.layers.dense({ units: 3, activation: 'sigmoid' })
            ]
        });
        this.behaviorModel.compile({
            optimizer: tf.train.adam(0.01),
            loss: 'meanSquaredError'
        });

        const dataset = this.getBehaviorDataset();
        const xs = tf.tensor2d(dataset.inputs);
        const ys = tf.tensor2d(dataset.labels);
        await this.behaviorModel.fit(xs, ys, { epochs: 150, shuffle: true, verbose: 0 });
        xs.dispose();
        ys.dispose();
    }

    getTrafficDataset() {
        const samples = [
            { f: [8, 1, 28, 0.85, 0.9, 0, 1, 0.4], l: [0.92, 0.82, 0.65] },
            { f: [17, 2, 30, 0.9, 0.8, 0, 1, 0.5], l: [0.95, 0.9, 0.7] },
            { f: [2, 4, 70, 0.1, 0.95, 0, 0, 0.5], l: [0.08, 0.05, 0.15] },
            { f: [12, 6, 55, 0.45, 0.85, 1, 0, 0.3], l: [0.45, 0.35, 0.3] },
            { f: [10, 3, 40, 0.6, 0.3, 0, 0, 0.3], l: [0.75, 0.68, 0.82] },
            { f: [14, 5, 85, 0.25, 0.95, 0, 0, 0.9], l: [0.18, 0.18, 0.28] },
            { f: [20, 6, 50, 0.5, 0.7, 1, 0, 0.4], l: [0.55, 0.45, 0.4] },
            { f: [7, 1, 25, 0.75, 0.8, 0, 1, 0.3], l: [0.88, 0.75, 0.6] },
            { f: [9, 0, 45, 0.4, 0.9, 1, 0, 0.2], l: [0.4, 0.35, 0.25] },
            { f: [15, 2, 65, 0.5, 0.7, 0, 0, 0.6], l: [0.35, 0.32, 0.3] }
        ];

        const inputs = samples.map(s => [
            s.f[0] / 24,
            s.f[1] / 7,
            s.f[2] / 120,
            s.f[3],
            s.f[4],
            s.f[5],
            s.f[6],
            s.f[7]
        ]);
        const labels = samples.map(s => s.l);
        return { inputs, labels };
    }

    getRouteDataset() {
        const samples = [
            { f: [12, 0.2, 0.9, 4, 90, 0.9], l: [0.92, 0.18, 0.88] },
            { f: [40, 0.5, 0.7, 8, 70, 0.7], l: [0.65, 0.4, 0.6] },
            { f: [25, 0.8, 0.4, 12, 50, 0.5], l: [0.38, 0.62, 0.35] },
            { f: [15, 0.3, 0.85, 6, 80, 0.8], l: [0.78, 0.3, 0.82] },
            { f: [50, 0.6, 0.5, 15, 60, 0.45], l: [0.3, 0.75, 0.4] },
            { f: [18, 0.4, 0.8, 5, 100, 0.9], l: [0.85, 0.25, 0.88] }
        ];

        const inputs = samples.map(s => [
            Math.min(1, s.f[0] / 60),
            s.f[1],
            s.f[2],
            s.f[3] / 20,
            s.f[4] / 120,
            s.f[5]
        ]);
        const labels = samples.map(s => s.l);
        return { inputs, labels };
    }

    getBehaviorDataset() {
        const samples = [
            { f: [0.1, 0.1, 0.2, 0.1, 0.8, 0.4], l: [0.95, 0.1, 0.1] },
            { f: [0.7, 0.6, 0.8, 0.7, 0.3, 0.5], l: [0.25, 0.4, 0.85] },
            { f: [0.3, 0.2, 0.15, 0.25, 0.5, 0.9], l: [0.45, 0.85, 0.3] },
            { f: [0.4, 0.35, 0.35, 0.4, 0.6, 0.6], l: [0.65, 0.4, 0.45] },
            { f: [0.2, 0.15, 0.25, 0.3, 0.75, 0.3], l: [0.85, 0.2, 0.2] }
        ];
        return {
            inputs: samples.map(s => s.f),
            labels: samples.map(s => s.l)
        };
    }

    recordBehavior(data) {
        this.behaviorHistory.push({ ...data, timestamp: Date.now() });
        if (this.behaviorHistory.length > this.maxHistory) {
            this.behaviorHistory.shift();
        }
    }

    analyzeBehavior() {
        if (!this.ready || this.behaviorHistory.length < 5) {
            return {
                safetyScore: 80,
                fatigueRisk: 'low',
                drivingStyle: 'Normal',
                alerts: [],
                confidence: 0.4
            };
        }

        const speeds = this.behaviorHistory.map(d => d.speed || 0);
        const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length || 0;
        const variance = speeds.reduce((a, b) => a + Math.pow(b - meanSpeed, 2), 0) / speeds.length;
        const brakingFrequency = this.behaviorHistory.filter(d => d.braking).length / this.behaviorHistory.length;
        const laneChanges = this.behaviorHistory.filter(d => d.laneChange).length / this.behaviorHistory.length;
        const following = this.behaviorHistory.map(d => d.followingDistance || 40);
        const avgFollow = following.reduce((a, b) => a + b, 0) / following.length;
        const hour = new Date().getHours();

        const input = tf.tensor2d([[
            Math.min(1, variance / 1500),
            Math.min(1, brakingFrequency),
            Math.min(1, Math.abs(this.behaviorHistory.at(-1).acceleration || 0) / 8),
            Math.min(1, laneChanges),
            Math.min(1, avgFollow / 120),
            hour / 24
        ]]);
        const output = this.behaviorModel.predict(input);
        const [safety, fatigue, aggression] = output.dataSync();
        input.dispose();
        output.dispose();

        const alerts = [];
        if (safety < 0.4) alerts.push({ type: 'warning', message: 'Unstable driving detected' });
        if (fatigue > 0.6) alerts.push({ type: 'critical', message: 'Fatigue indicators high' });
        if (aggression > 0.65) alerts.push({ type: 'warning', message: 'Aggressive maneuvers detected' });

        return {
            safetyScore: Math.round(safety * 100),
            fatigueRisk: fatigue > 0.7 ? 'High' : fatigue > 0.4 ? 'Medium' : 'Low',
            aggressiveScore: Math.round(aggression * 100),
            drivingStyle: this.getDrivingStyle(safety, aggression, fatigue),
            alerts,
            confidence: 0.75
        };
    }

    getDrivingStyle(safety, aggression, fatigue) {
        if (safety > 0.8 && aggression < 0.3) return 'Defensive';
        if (aggression > 0.7) return 'Aggressive';
        if (fatigue > 0.6) return 'Fatigued';
        if (safety > 0.6) return 'Normal';
        return 'Inconsistent';
    }

    analyzeTraffic(params) {
        if (!this.ready) return null;
        const {
            hour = new Date().getHours(),
            day = new Date().getDay(),
            currentSpeed = 40,
            density = 0.5,
            weather = 0.9,
            roadType = 0.5
        } = params;

        const input = tf.tensor2d([[
            hour / 24,
            day / 7,
            currentSpeed / 120,
            density,
            weather,
            day === 0 || day === 6 ? 1 : 0,
            (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20) ? 1 : 0,
            roadType
        ]]);
        const output = this.trafficModel.predict(input);
        const [congestion, delay, risk] = output.dataSync();
        input.dispose();
        output.dispose();

        return {
            congestionLevel: congestion,
            congestionText: this.getCongestionText(congestion),
            delayMinutes: Math.round(delay * 40),
            accidentRisk: risk,
            probabilityText: this.getProbabilityText(risk),
            confidence: 0.85
        };
    }

    getCongestionText(value) {
        if (value < 0.2) return 'Free Flow';
        if (value < 0.4) return 'Light Traffic';
        if (value < 0.6) return 'Moderate Traffic';
        if (value < 0.8) return 'Heavy Traffic';
        return 'Severe Congestion';
    }

    getProbabilityText(prob) {
        if (prob < 0.2) return 'Very Low';
        if (prob < 0.4) return 'Low';
        if (prob < 0.6) return 'Moderate';
        if (prob < 0.8) return 'High';
        return 'Critical';
    }

    optimizeRoutes(routes) {
        if (!this.ready) return routes;
        return routes.map(route => this.scoreRoute(route))
            .sort((a, b) => b.aiScore.overallScore - a.aiScore.overallScore);
    }

    scoreRoute(route) {
        const input = tf.tensor2d([[
            Math.min(1, route.distance / 60),
            route.trafficLevel ?? 0.5,
            route.roadQuality ?? 0.7,
            (route.turns || 8) / 25,
            (route.speedLimit || 60) / 120,
            route.safetyScore ?? 0.8
        ]]);
        const output = this.routeModel.predict(input);
        const [score, timeFactor, efficiency] = output.dataSync();
        input.dispose();
        output.dispose();

        return {
            ...route,
            aiScore: {
                overallScore: Math.round(score * 100),
                estimatedTime: Math.round(route.baseTime * (0.8 + timeFactor)),
                fuelEfficiency: Math.round(efficiency * 100),
                recommendation: score > 0.8 ? 'Highly Recommended' :
                    score > 0.6 ? 'Good Option' :
                    score > 0.4 ? 'Consider Alternatives' : 'Avoid'
            }
        };
    }

    predictAccidentRisk(conditions) {
        const traffic = conditions.traffic ?? 0.5;
        const behavior = conditions.behavior ?? 0.5;
        const weather = conditions.weather ?? 0.8;
        const visibility = conditions.visibility ?? 0.8;

        const probability = Math.min(1,
            0.4 * traffic +
            0.3 * (1 - weather) +
            0.2 * (1 - visibility) +
            0.3 * (1 - behavior)
        );

        return {
            probability: Math.round(probability * 100),
            probabilityText: this.getProbabilityText(probability),
            severity: probability > 0.7 ? 'Severe' : probability > 0.4 ? 'Moderate' : 'Minor',
            recommendations: this.getSafetyRecommendations(probability, conditions)
        };
    }

    getSafetyRecommendations(prob, conditions) {
        const recs = [];
        if (prob > 0.6) recs.push('Reduce speed immediately');
        if ((conditions.weather ?? 1) < 0.6) recs.push('Increase following distance - wet/slippery roads');
        if ((conditions.visibility ?? 1) < 0.5) recs.push('Turn on fog lamps and drive cautiously');
        if ((conditions.behavior ?? 1) < 0.5) recs.push('Driver fatigue detected - take a break');
        if (!recs.length) recs.push('Conditions acceptable - maintain vigilance');
        return recs;
    }

    getSafetyReport(params) {
        if (!this.ready) return null;
        const traffic = this.analyzeTraffic(params);
        const behavior = this.analyzeBehavior();
        const accident = this.predictAccidentRisk({
            traffic: traffic?.congestionLevel,
            behavior: behavior?.safetyScore / 100,
            weather: params.weather ?? 0.8,
            visibility: params.visibility ?? 0.8
        });

        return {
            traffic,
            behavior,
            accident,
            overallSafetyScore: Math.round(
                (behavior.safetyScore * 0.5) +
                ((100 - accident.probability) * 0.3) +
                ((1 - (traffic?.congestionLevel ?? 0.5)) * 20)
            )
        };
    }
}

window.NeuroNavAI = NeuroNavAI;

