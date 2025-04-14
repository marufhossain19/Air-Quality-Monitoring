// API URL for database operations
const DB_API_URL = 'http://localhost:3000/api';

// Fetch the latest sensor reading
async function getLatestReading() {
    try {
        const response = await fetch(`${DB_API_URL}/readings/latest`);
        const data = await response.json();
        return data.success ? data.reading : null;
    } catch (error) {
        console.error('Error fetching latest reading:', error);
        // Return mock data for testing if API is not available
        return {
            reading_id: 1,
            timestamp: new Date().toISOString(),
            co2_level: 530,
            pm25_level: 20,
            temperature: 23.0,
            humidity: 40,
            aqi: 70
        };
    }
}

// Fetch readings for the last 24 hours
async function getLast24HoursReadings() {
    try {
        const response = await fetch(`${DB_API_URL}/readings/last24hours`);
        const data = await response.json();
        return data.success ? data.readings : generateMockReadings(24);
    } catch (error) {
        console.error('Error fetching 24-hour readings:', error);
        // Return mock data for testing if API is not available
        return generateMockReadings(24);
    }
}

// Fetch daily average readings for the last week
async function getWeeklyAverages() {
    try {
        const response = await fetch(`${DB_API_URL}/readings/weekly`);
        const data = await response.json();
        return data.success ? data.readings : generateMockWeeklyData();
    } catch (error) {
        console.error('Error fetching weekly averages:', error);
        // Return mock data for testing if API is not available
        return generateMockWeeklyData();
    }
}

// Fetch monthly averages
async function getMonthlyAverages() {
    try {
        const response = await fetch(`${DB_API_URL}/readings/monthly`);
        const data = await response.json();
        return data.success ? data.readings : generateMockMonthlyData();
    } catch (error) {
        console.error('Error fetching monthly averages:', error);
        // Return mock data for testing if API is not available
        return generateMockMonthlyData();
    }
}

// Fetch active alerts
async function getAlerts() {
    try {
        const response = await fetch(`${DB_API_URL}/alerts`);
        const data = await response.json();
        return data.success ? data.alerts : generateMockAlerts();
    } catch (error) {
        console.error('Error fetching alerts:', error);
        // Return mock data for testing if API is not available
        return generateMockAlerts();
    }
}

// Generate mock readings for testing (when API is not available)
function generateMockReadings(count) {
    const readings = [];
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
        const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000)); // hourly data
        readings.push({
            reading_id: count - i,
            timestamp: timestamp.toISOString(),
            co2_level: 500 + Math.floor(Math.random() * 100),
            pm25_level: 15 + Math.floor(Math.random() * 15),
            temperature: 22 + Math.random() * 3,
            humidity: 35 + Math.floor(Math.random() * 15),
            aqi: 60 + Math.floor(Math.random() * 30)
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
            avg_co2: 500 + Math.floor(Math.random() * 100),
            avg_pm25: 15 + Math.floor(Math.random() * 15),
            avg_temp: 22 + Math.random() * 3,
            avg_humidity: 35 + Math.floor(Math.random() * 15),
            avg_aqi: 60 + Math.floor(Math.random() * 30)
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
            avg_co2: 500 + Math.floor(Math.random() * 100),
            avg_pm25: 15 + Math.floor(Math.random() * 15),
            avg_temp: 22 + Math.random() * 3,
            avg_humidity: 35 + Math.floor(Math.random() * 15),
            avg_aqi: 60 + Math.floor(Math.random() * 30)
        });
    }
    
    return monthlyData;
}

// Generate mock alerts for testing
function generateMockAlerts() {
    return [
        {
            alert_id: 1,
            alert_timestamp: new Date().toISOString(),
            alert_type: 'PM25',
            threshold_value: 20,
            actual_value: 20,
            message: 'PM2.5 level has reached warning threshold',
            status: 'active',
            resolved_timestamp: null
        },
        {
            alert_id: 2,
            alert_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            alert_type: 'CO2',
            threshold_value: 600,
            actual_value: 620,
            message: 'CO2 levels exceeded healthy indoor threshold',
            status: 'active',
            resolved_timestamp: null
        },
        {
            alert_id: 3,
            alert_timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            alert_type: 'AQI',
            threshold_value: 75,
            actual_value: 76,
            message: 'Air Quality Index reached moderate levels',
            status: 'resolved',
            resolved_timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            alert_id: 4,
            alert_timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            alert_type: 'Humidity',
            threshold_value: 35,
            actual_value: 34,
            message: 'Humidity below recommended levels',
            status: 'resolved',
            resolved_timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];
}
