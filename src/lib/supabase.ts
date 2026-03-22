import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gpvxqrspuqyhffmkxnkr.supabase.co";
const supabaseKey = "sb_publishable_9iocrTRab5c9q8f06KBHtg_Dt19N1jM";

export const supabase = createClient(supabaseUrl, supabaseKey);
