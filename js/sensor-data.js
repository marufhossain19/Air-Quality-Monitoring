// Sensor data module
const SensorData = (function () {
    // API URL for sensor data operations
    const API_URL = 'http://localhost:3000/api/sensor';

    // Create standard headers
    function getHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    // Fetch the latest sensor reading
    async function getLatestReading() {
        try {
            const response = await fetch(`${API_URL}/latest`, {
                method: 'GET',
                headers: getHeaders()
            });

            const result = await response.json();

            if (result.success && result.data) {
                return result.data;
            } else {
                console.error('Error fetching latest reading:', result.message);
                // Return mock data for testing if API fails
                return {
                    id: 1,
                    timestamp: new Date().toISOString(),
                    temperature: 25.4,
                    humidity: 48.2,
                    lpg: 420,
                    dust: 28.5
                };
            }
        } catch (error) {
            console.error('Error fetching latest reading:', error);
            // Return mock data for testing if API is not available
            return {
                id: 1,
                timestamp: new Date().toISOString(),
                temperature: 25.4,
                humidity: 48.2,
                lpg: 420,
                dust: 28.5
            };
        }
    }

    // Fetch last 5 readings
    async function getLast5Readings() {
        try {
            const response = await fetch(`${API_URL}/last5`, {
                method: 'GET',
                headers: getHeaders()
            });

            const result = await response.json();

            if (result.success && result.data) {
                return result.data;
            } else {
                console.error('Error fetching last 5 readings:', result.message);
                // Return mock data for testing
                return generateMockReadings(5);
            }
        } catch (error) {
            console.error('Error fetching last 5 readings:', error);
            // Return mock data for testing if API is not available
            return generateMockReadings(5);
        }
    }

    // Fetch weekly averages
    async function getWeeklyAverages() {
        try {
            const response = await fetch(`${API_URL}/weekly`, {
                method: 'GET',
                headers: getHeaders()
            });

            const result = await response.json();

            if (result.success && result.data) {
                return result.data;
            } else {
                console.error('Error fetching weekly averages:', result.message);
                // Return mock data for testing
                return generateMockWeeklyData();
            }
        } catch (error) {
            console.error('Error fetching weekly averages:', error);
            // Return mock data for testing if API is not available
            return generateMockWeeklyData();
        }
    }

    // Fetch monthly averages
    async function getMonthlyAverages() {
        try {
            const response = await fetch(`${API_URL}/monthly`, {
                method: 'GET',
                headers: getHeaders()
            });

            const result = await response.json();

            if (result.success && result.data) {
                return result.data;
            } else {
                console.error('Error fetching monthly averages:', result.message);
                // Return mock data for testing
                return generateMockMonthlyData();
            }
        } catch (error) {
            console.error('Error fetching monthly averages:', error);
            // Return mock data for testing if API is not available
            return generateMockMonthlyData();
        }
    }

    // Add a new sensor reading
    async function addSensorReading(data) {
        try {
            const response = await fetch(`${API_URL}/add`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success && result.data) {
                return result.data;
            } else {
                throw new Error(result.message || 'Failed to add sensor reading');
            }
        } catch (error) {
            console.error('Error adding sensor reading:', error);
            throw error;
        }
    }

    // Generate mock readings for testing (when API is not available)
    function generateMockReadings(count) {
        const readings = [];
        const now = new Date();

        for (let i = 0; i < count; i++) {
            const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)); // hourly data
            readings.push({
                id: count - i,
                timestamp: timestamp.toISOString(),
                temperature: 22 + Math.random() * 8,
                humidity: 40 + Math.floor(Math.random() * 20),
                lpg: 350 + Math.floor(Math.random() * 150),
                dust: 15 + Math.floor(Math.random() * 20)
            });
        }

        return readings;
    }

    // Generate mock weekly data for testing
    function generateMockWeeklyData() {
        const weeklyData = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            weeklyData.push({
                date: date.toISOString().split('T')[0],
                temperature: 22 + Math.random() * 8,
                humidity: 40 + Math.floor(Math.random() * 20),
                lpg: 350 + Math.floor(Math.random() * 150),
                dust: 15 + Math.floor(Math.random() * 20)
            });
        }

        return weeklyData;
    }

    // Generate mock monthly data for testing
    function generateMockMonthlyData() {
        const monthlyData = [];
        const now = new Date();

        for (let i = 29; i >= 0; i--) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            monthlyData.push({
                date: date.toISOString().split('T')[0],
                temperature: 22 + Math.random() * 8,
                humidity: 40 + Math.floor(Math.random() * 20),
                lpg: 350 + Math.floor(Math.random() * 150),
                dust: 15 + Math.floor(Math.random() * 20)
            });
        }

        return monthlyData;
    }

    // Helper function to format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Get day name from date
    function getDayName(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    // Check if value exceeds threshold
    function isAboveThreshold(value, metric) {
        const thresholds = {
            temperature: 40,
            humidity: 90,
            lpg: 500,
            dust: 400
        };

        // Special case for humidity - also check if it's too low
        if (metric === 'humidity') {
            return value > thresholds[metric] || value < 25;
        }

        return value > thresholds[metric];
    }

    // Get threshold for a specific metric
    function getThresholdForMetric(metric) {
        const thresholds = {
            temperature: 40,
            humidity: { min: 25, max: 90 },
            lpg: 500,
            dust: 400
        };

        return thresholds[metric];
    }

    // Get unit for a specific metric
    function getMetricUnit(metric) {
        const units = {
            temperature: '°C',
            humidity: '%',
            lpg: 'ppm',
            dust: 'µg/m³'
        };

        return units[metric];
    }

    // Get display name for a specific metric
    function getMetricDisplayName(metric) {
        const names = {
            temperature: 'Temperature',
            humidity: 'Humidity',
            lpg: 'LPG Gas',
            dust: 'Dust'
        };

        return names[metric];
    }

    // Get color for a specific metric
    function getMetricColor(metric) {
        const colors = {
            temperature: '#F87171',
            humidity: '#60A5FA',
            lpg: '#8B5CF6',
            dust: '#10B981'
        };

        return colors[metric];
    }

    // Get background color for a specific metric
    function getMetricBackgroundColor(metric) {
        const colors = {
            temperature: 'rgba(248, 113, 113, 0.2)',
            humidity: 'rgba(96, 165, 250, 0.2)',
            lpg: 'rgba(139, 92, 246, 0.2)',
            dust: 'rgba(16, 185, 129, 0.2)'
        };

        return colors[metric];
    }

    // Public API
    return {
        getLatestReading,
        getLast5Readings,
        getWeeklyAverages,
        getMonthlyAverages,
        addSensorReading,
        formatDate,
        getDayName,
        isAboveThreshold,
        getThresholdForMetric,
        getMetricUnit,
        getMetricDisplayName,
        getMetricColor,
        getMetricBackgroundColor
    };
})(); 