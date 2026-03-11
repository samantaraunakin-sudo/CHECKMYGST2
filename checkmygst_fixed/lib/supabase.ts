import { createClient } from "@supabase/supabase-js";

// Replace these with your actual Supabase project credentials
// Found at: supabase.com → your project → Settings → API
const SUPABASE_URL = "[https://qyjbmsodfuaaazakmlfc.supabase.co](https://qyjbmsodfuaaazakmlfc.supabase.co/)";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5amJtc29kZnVhYWF6YWttbGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjA4NjQsImV4cCI6MjA4ODczNjg2NH0.C-QgSuCgxcxt7gbnjTk7a6TF2W9nP1PPKSnTxdmmvcI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
