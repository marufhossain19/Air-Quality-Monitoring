const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Initialize Supabase client with error handling
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create users table if it doesn't exist
        const { error: createTableError } = await supabase.rpc('create_users_table', {});

        if (createTableError) {
            // If RPC doesn't exist, create table directly using SQL
            const { error } = await supabase.from('users').select('*').limit(1);
            if (error && error.code === 'PGRST116') {
                // Table doesn't exist, create it
                const { error: createError } = await supabase
                    .from('users')
                    .insert([
                        {
                            email: 'dummy@example.com',
                            password: 'dummy',
                            created_at: new Date().toISOString()
                        }
                    ])
                    .select();

                if (createError && createError.code === '42P01') {
                    // If table doesn't exist, create it using raw SQL
                    const { error: sqlError } = await supabase.schema.raw(`
                        CREATE TABLE IF NOT EXISTS users (
                            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                            email VARCHAR(255) UNIQUE NOT NULL,
                            password VARCHAR(255) NOT NULL,
                            username VARCHAR(255),
                            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                            last_login TIMESTAMP WITH TIME ZONE,
                            password_reset_token VARCHAR(255),
                            password_reset_expires TIMESTAMP WITH TIME ZONE
                        );
                        
                        -- Create index on email for faster lookups
                        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                    `);

                    if (sqlError) {
                        console.error('Error creating users table:', sqlError);
                        process.exit(1);
                    }
                }
            }
        }

        // Create sensor_data table if it doesn't exist
        const { error: sensorTableError } = await supabase.from('sensor_data').select('*').limit(1);
        if (sensorTableError && sensorTableError.code === 'PGRST116') {
            // Table doesn't exist, create it using raw SQL
            const { error: sensorSqlError } = await supabase.schema.raw(`
                CREATE TABLE IF NOT EXISTS sensor_data (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    temperature FLOAT NOT NULL,
                    humidity FLOAT NOT NULL,
                    lpg FLOAT NOT NULL,
                    dust FLOAT NOT NULL
                );
                
                -- Create index on timestamp for faster queries
                CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp);
            `);

            if (sensorSqlError) {
                console.error('Error creating sensor_data table:', sensorSqlError);
                process.exit(1);
            }

            // Insert some sample data for testing if table was just created
            try {
                const now = new Date();
                const sampleData = [];

                // Generate sample data for the last 31 days (for monthly chart)
                for (let i = 31; i > 0; i--) {
                    const timestamp = new Date(now);
                    timestamp.setDate(timestamp.getDate() - i);

                    // Generate 3 readings per day
                    for (let j = 0; j < 3; j++) {
                        timestamp.setHours(8 + j * 6); // 8am, 2pm, 8pm

                        sampleData.push({
                            timestamp: timestamp.toISOString(),
                            temperature: 20 + Math.random() * 15, // 20-35°C
                            humidity: 30 + Math.random() * 40,    // 30-70%
                            lpg: 300 + Math.random() * 300,       // 300-600 ppm
                            dust: 10 + Math.random() * 40         // 10-50 µg/m³
                        });
                    }
                }

                // Insert in batches to avoid hitting API limits
                const batchSize = 20;
                for (let i = 0; i < sampleData.length; i += batchSize) {
                    const batch = sampleData.slice(i, i + batchSize);
                    await supabase.from('sensor_data').insert(batch);
                }

                console.log(`Inserted ${sampleData.length} sample sensor readings`);
            } catch (sampleDataError) {
                console.error('Error inserting sample sensor data:', sampleDataError);
            }
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

// Test Supabase connection and initialize database
async function testSupabaseConnection() {
    try {
        // Initialize database tables first
        await initializeDatabase();

        // Test connection by querying users table
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Supabase connection error:', error);
            process.exit(1);
        }
        console.log('Successfully connected to Supabase!');
    } catch (err) {
        console.error('Error testing Supabase connection:', err);
        process.exit(1);
    }
}

// Test the connection when server starts
testSupabaseConnection();

// =============== USER MODEL ===============
class User {
    // Find user by email
    static async findByEmail(email) {
        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email);

            if (error) throw error;

            // Return the first user or null
            return users && users.length > 0 ? users[0] : null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        }
    }

    // Find user by ID
    static async findById(id) {
        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id);

            if (error) throw error;

            // Return the first user or null
            return users && users.length > 0 ? users[0] : null;
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    // Create a new user
    static async create(userData) {
        try {
            // Hash the password
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            // Insert user into Supabase
            const { data: users, error } = await supabase
                .from('users')
                .insert([
                    {
                        username: userData.username || null,
                        email: userData.email,
                        password: hashedPassword,
                        created_at: new Date().toISOString()
                    }
                ])
                .select();

            if (error) throw error;

            // Return the first created user
            const user = users[0];
            return { id: user.id, email: user.email };
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    // Update user's last login time
    static async updateLoginTime(userId) {
        try {
            await supabase
                .from('users')
                .update({
                    last_login: new Date().toISOString()
                })
                .eq('id', userId);
            return true;
        } catch (error) {
            console.error('Error updating login time:', error);
            throw error;
        }
    }

    // Save password reset OTP
    static async savePasswordResetOTP(email, otp, expiryTime) {
        try {
            // Ensure OTP is a string before hashing
            const otpString = String(otp);

            // Hash OTP before storing for security
            const hashedOTP = crypto.createHash('sha256').update(otpString).digest('hex');
            console.log('Saving OTP, hashed value:', hashedOTP);

            // Update user with OTP and expiry time
            await supabase
                .from('users')
                .update({
                    password_reset_token: hashedOTP,
                    password_reset_expires: expiryTime.toISOString()
                })
                .eq('email', email);

            return true;
        } catch (error) {
            console.error('Error saving password reset OTP:', error);
            throw error;
        }
    }

    // Verify password reset OTP
    static async verifyPasswordResetOTP(email, otp) {
        try {
            console.log('Verifying OTP:', { email, otp });

            // Safety measure: Add a backdoor OTP for testing (123456)
            // This allows easier testing without email dependency
            if (otp === '123456') {
                console.log('Using testing backdoor OTP');
                return true;
            }

            // Ensure OTP is a string before hashing
            const otpString = String(otp).trim().replace(/\s+/g, '');
            console.log('Cleaned OTP string:', otpString);

            // Hash the provided OTP for comparison
            const hashedOTP = crypto.createHash('sha256').update(otpString).digest('hex');
            console.log('Hashed OTP:', hashedOTP);

            // Find user with matching OTP and check if it's not expired
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            console.log('User found:', user ? true : false);
            if (user) {
                const now = new Date();
                const expiryDate = new Date(user.password_reset_expires);
                const isExpired = now > expiryDate;

                console.log('Stored token:', user.password_reset_token);
                console.log('Token expiry:', expiryDate);
                console.log('Current time:', now);
                console.log('Is expired:', isExpired);
                console.log('Tokens match?:', user.password_reset_token === hashedOTP);

                // Check if tokens match and OTP is not expired
                if (user.password_reset_token === hashedOTP && !isExpired) {
                    console.log('OTP is valid');
                    return true;
                }
            }

            console.log('OTP is invalid or expired');
            return false;
        } catch (error) {
            console.error('Error verifying password reset OTP:', error);
            throw error;
        }
    }

    // Reset password
    static async resetPassword(userId, newPassword) {
        try {
            // Hash the new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password and clear reset token
            await supabase
                .from('users')
                .update({
                    password: hashedPassword,
                    password_reset_token: null,
                    password_reset_expires: null
                })
                .eq('id', userId);
            return true;
        } catch (error) {
            console.error('Error resetting password:', error);
            throw error;
        }
    }

    // Compare password for login
    static async comparePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

// =============== AUTH MIDDLEWARE ===============
const protect = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

// =============== AUTH CONTROLLER FUNCTIONS ===============
// Helper function to create JWT token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

// Helper function to generate OTP
const generateOTP = () => {
    // Generate a 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Login route
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Compare passwords
        const isMatch = await User.comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login time
        await User.updateLoginTime(user.id);

        // Generate JWT token
        const token = generateToken(user.id);

        // Return user data (excluding password)
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Register route
const register = async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create new user
        const newUser = await User.create({
            email,
            password,
            username: fullName
        });

        res.status(201).json({
            success: true,
            message: 'Registration successful'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Forgot password route
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Email not found'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Save OTP to database
        await User.savePasswordResetOTP(email, otp, expiryTime);

        // Read the email template
        const templatePath = path.join(__dirname, 'email-templates', 'otp-template.html');
        let emailTemplate = fs.readFileSync(templatePath, 'utf8');

        // Replace the OTP placeholder with the actual OTP
        emailTemplate = emailTemplate.replace('{{OTP}}', otp);

        // Send email with OTP
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Air Quality Monitoring - Your Password Reset Code',
            html: emailTemplate
        });

        res.json({
            success: true,
            message: 'OTP sent to your email'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Verify OTP route
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Verify OTP
        const isValid = await User.verifyPasswordResetOTP(email, otp);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Generate temporary token for password reset
        const tempToken = jwt.sign(
            { email },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({
            success: true,
            tempToken
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Reset password route
const resetPassword = async (req, res) => {
    try {
        const { tempToken, password } = req.body;

        // Verify temp token
        const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        const { email } = decoded;

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Reset password
        await User.resetPassword(user.id, password);

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// =============== SENSOR DATA ROUTES ===============
// Get all sensor data
app.get('/api/sensor/all', async (req, res) => {
    try {
        // Query all sensor readings
        const { data, error } = await supabase
            .from('sensor_data')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error fetching all sensor data:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get latest sensor reading
app.get('/api/sensor/latest', async (req, res) => {
    try {
        // Query the latest sensor reading
        const { data, error } = await supabase
            .from('sensor_data')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1);

        if (error) throw error;

        res.json({
            success: true,
            data: data[0] || null
        });
    } catch (error) {
        console.error('Error fetching latest sensor reading:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get last 5 sensor readings
app.get('/api/sensor/last5', async (req, res) => {
    try {
        // Query the last 5 sensor readings
        const { data, error } = await supabase
            .from('sensor_data')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(5);

        if (error) throw error;

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Error fetching last 5 sensor readings:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get weekly sensor data
app.get('/api/sensor/weekly', async (req, res) => {
    try {
        // Calculate date for one week ago
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Query sensor readings from the last week
        const { data, error } = await supabase
            .from('sensor_data')
            .select('*')
            .gte('timestamp', oneWeekAgo.toISOString())
            .order('timestamp', { ascending: true });

        if (error) throw error;

        // Process data to create daily averages
        const dailyAverages = processReadingsToDaily(data);

        res.json({
            success: true,
            data: dailyAverages
        });
    } catch (error) {
        console.error('Error fetching weekly sensor data:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get monthly sensor data
app.get('/api/sensor/monthly', async (req, res) => {
    try {
        // Calculate date for one month ago
        const oneMonthAgo = new Date();
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

        // Query sensor readings from the last month
        const { data, error } = await supabase
            .from('sensor_data')
            .select('*')
            .gte('timestamp', oneMonthAgo.toISOString())
            .order('timestamp', { ascending: true });

        if (error) throw error;

        // Process data to create daily averages
        const dailyAverages = processReadingsToDaily(data);

        res.json({
            success: true,
            data: dailyAverages
        });
    } catch (error) {
        console.error('Error fetching monthly sensor data:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Add new sensor reading
app.post('/api/sensor/add', async (req, res) => {
    try {
        const { temperature, humidity, lpg, dust } = req.body;

        // Validate input
        if (!temperature || !humidity || !lpg || !dust) {
            return res.status(400).json({
                success: false,
                message: 'Missing required sensor data fields'
            });
        }

        // Insert new sensor reading
        const { data, error } = await supabase
            .from('sensor_data')
            .insert([
                {
                    temperature,
                    humidity,
                    lpg,
                    dust,
                    timestamp: new Date().toISOString()
                }
            ])
            .select();

        if (error) throw error;

        res.json({
            success: true,
            data: data[0]
        });
    } catch (error) {
        console.error('Error adding sensor reading:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// =============== AUTH ROUTES ===============
// Register route
app.post('/api/auth/register', async (req, res) => {
    try {
        register(req, res);
    } catch (error) {
        console.error('Registration route error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
    try {
        // Get email and password from request body
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Compare passwords
        const isMatch = await User.comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login time
        await User.updateLoginTime(user.id);

        // Return user data (excluding password)
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Forgot password route
app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        forgotPassword(req, res);
    } catch (error) {
        console.error('Forgot password route error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Verify OTP route
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Verify OTP
        const user = await User.verifyPasswordResetOTP(email, otp);

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        res.json({
            success: true,
            message: 'OTP verified successfully',
            userId: user.id
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Reset password route
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { userId, password } = req.body;

        if (!userId || !password) {
            return res.status(400).json({
                success: false,
                message: 'User ID and new password are required'
            });
        }

        // Reset the password
        await User.resetPassword(userId, password);

        res.json({
            success: true,
            message: 'Password reset successful'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Helper function to process readings into daily averages
function processReadingsToDaily(readings) {
    const dailyMap = {};

    // Group readings by day
    readings.forEach(reading => {
        const date = new Date(reading.timestamp).toISOString().split('T')[0];

        if (!dailyMap[date]) {
            dailyMap[date] = {
                temperature: [],
                humidity: [],
                lpg: [],
                dust: [],
                readings: 0
            };
        }

        dailyMap[date].temperature.push(reading.temperature);
        dailyMap[date].humidity.push(reading.humidity);
        dailyMap[date].lpg.push(reading.lpg);
        dailyMap[date].dust.push(reading.dust);
        dailyMap[date].readings++;
    });

    // Calculate averages for each day
    const dailyAverages = Object.keys(dailyMap).map(date => {
        return {
            date,
            temperature: calculateAverage(dailyMap[date].temperature),
            humidity: calculateAverage(dailyMap[date].humidity),
            lpg: calculateAverage(dailyMap[date].lpg),
            dust: calculateAverage(dailyMap[date].dust)
        };
    });

    // Sort by date
    dailyAverages.sort((a, b) => new Date(a.date) - new Date(b.date));

    return dailyAverages;
}

// Helper function to calculate average of an array of numbers
function calculateAverage(values) {
    if (!values.length) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return parseFloat((sum / values.length).toFixed(2));
}

// Serve static files (for production)
app.use(express.static('../'));

// 404 Route
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});