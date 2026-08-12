import fs from 'fs';
import path from 'path';

// Polyfill import.meta.env for standalone Node scripts
const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) env[k.trim()] = v.trim();
});
globalThis.import = globalThis.import || {};
import.meta.env = env;

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data: trips } = await supabase.from('trips').select('*');
console.log('Database trips:', trips);
