import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestSearch() {
    const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching history:', error);
    } else {
        fs.writeFileSync('test-latest-search.json', JSON.stringify(data, null, 2));
        console.log("Wrote to test-latest-search.json");
    }
}

checkLatestSearch();
