import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wejyrgmblwsawwnupddn.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlanlyZ21ibHdzYXd3bnVwZGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDU3MzQsImV4cCI6MjA5NTAyMTczNH0.WrDkMouillUCn1yxC3Dbe-TKWdSf2Q6BWL4EDqS40Rk';

export const supabase = createClient(supabaseUrl, supabaseKey);
