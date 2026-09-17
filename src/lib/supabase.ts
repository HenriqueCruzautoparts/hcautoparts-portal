import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://gpvxqrspuqyhffmkxnkr.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_9iocrTRab5c9q8f06KBHtg_Dt19N1jM";

export const supabase = createClient(supabaseUrl, supabaseKey);
