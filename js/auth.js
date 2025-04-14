// API URL
const API_URL = 'http://localhost:3000/api';

// Store user data in localStorage
const setUser = (user) => {
    localStorage.setItem('user', JSON.stringify(user));
};

// Get user data from localStorage
const getUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

// Remove user data from localStorage
const removeUser = () => {
    localStorage.removeItem('user');
};

// Check if user is logged in
const isLoggedIn = () => {
    return !!getUser();
};

// Login function
async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Store user data
            setUser(data.user);
            return {
                success: true,
                message: 'Login successful'
            };
        } else {
            return {
                success: false,
                message: data.message || 'Login failed'
            };
        }
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            message: 'Network error. Please try again later.'
        };
    }
}

// Register function
async function registerUser(email, password, fullName) {
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, fullName })
        });

        const data = await response.json();

        if (data.success) {
            return {
                success: true,
                message: 'Registration successful. Please login.'
            };
        } else {
            return {
                success: false,
                message: data.message || 'Registration failed'
            };
        }
    } catch (error) {
        console.error('Registration error:', error);
        return {
            success: false,
            message: 'Network error. Please try again later.'
        };
    }
}

// Logout function
function logoutUser() {
    removeUser();
    window.location.href = 'login.html';
}

// Check auth status function
async function checkAuthStatus() {
    const user = getUser();

    if (user) {
        return { isLoggedIn: true, user };
    }

    return { isLoggedIn: false };
}

// Forgot password function - Request OTP
async function forgotPassword(email) {
    try {
        const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
            // Store email in session for OTP verification
            sessionStorage.setItem('resetEmail', email);
            return {
                success: true,
                message: 'OTP sent to your email'
            };
        } else {
            return {
                success: false,
                message: data.message || 'Failed to send OTP'
            };
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        return {
            success: false,
            message: 'Network error. Please try again later.'
        };
    }
}

// Verify OTP function
async function verifyOTP(email, otp) {
    try {
        const response = await fetch(`${API_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, otp })
        });

        const data = await response.json();

        if (data.success) {
            // Store user ID for password reset
            sessionStorage.setItem('resetUserId', data.userId);
            return {
                success: true,
                message: 'OTP verified successfully'
            };
        } else {
            return {
                success: false,
                message: data.message || 'Invalid OTP'
            };
        }
    } catch (error) {
        console.error('Verify OTP error:', error);
        return {
            success: false,
            message: 'Network error. Please try again later.'
        };
    }
}

// Reset password function
async function resetPassword(userId, password) {
    try {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, password })
        });

        const data = await response.json();

        if (data.success) {
            // Clear stored reset data
            sessionStorage.removeItem('resetEmail');
            sessionStorage.removeItem('resetUserId');
            return {
                success: true,
                message: 'Password reset successful'
            };
        } else {
            return {
                success: false,
                message: data.message || 'Failed to reset password'
            };
        }
    } catch (error) {
        console.error('Reset password error:', error);
        return {
            success: false,
            message: 'Network error. Please try again later.'
        };
    }
} 