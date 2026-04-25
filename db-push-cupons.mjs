import fs from 'fs';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("\n❌ ERRO: DATABASE_URL not found\n");
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl.replace(':5432/', ':6543/'),
});

async function pushSchema() {
    try {
        console.log("🔄 Conectando ao seu banco de dados Supabase para criar tabela de cupons...");
        await client.connect();

        const sqlContent = fs.readFileSync('supabase_schema_cupons.sql', 'utf8');

        console.log("⚙️ Aplicando schemas e dados...");
        await client.query(sqlContent);

        console.log("✅ SUCESSO! Tabela de cupons criada e inserida.");
    } catch (err) {
        console.error("\n❌ Ocorreu um erro:", err.message);
    } finally {
        await client.end();
    }
}

pushSchema();
