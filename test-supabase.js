require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Test connection by fetching users table
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .limit(1);

        if (error) {
            console.error('Error connecting to Supabase:', error);
        } else {
            console.log('Successfully connected to Supabase!');
            console.log('Users table is accessible');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

testConnection(); 