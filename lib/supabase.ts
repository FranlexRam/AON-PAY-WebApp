import { createClient } from "@supabase/supabase-js";

// Cliente principal (Tasas / WebApp base)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente Plexus Core (CRM / Cyra Telemetría)
const plexusUrl = process.env.NEXT_PUBLIC_PLEXUS_SUPABASE_URL || supabaseUrl;
const plexusAnonKey = process.env.NEXT_PUBLIC_PLEXUS_SUPABASE_ANON_KEY || supabaseAnonKey;
export const supabasePlexus = createClient(plexusUrl, plexusAnonKey);