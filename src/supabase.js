import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ciuuhgqbgvcndxjfuejc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpdXVoZ3FiZ3ZjbmR4amZ1ZWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI4ODEsImV4cCI6MjA4NzM1ODg4MX0.1vlTv7qNf_7dM4VuPS0lDOVc7CrKvBzAWZr28F5tZ0M'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)