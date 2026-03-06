import fs from 'fs';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error("\n❌ ERRO: A variável DATABASE_URL (Transaction Connection String) não foi encontrada no arquivo .env.local!\n");
    console.error("1. Vá no painel do Supabase que você está vendo agora.");
    console.error("2. Clique na engrenagem de Configurações (Settings) no canto inferior esquerdo.");
    console.error("3. Selecione 'Database' no menu lateral interno.");
    console.error("4. Role até a seção 'Connection string', clique em URI e copie.");
    console.error("5. Abra seu arquivo .env.local aqui no VS Code, crie uma linha 'DATABASE_URL=\"...\"' e cole o URI nela.");
    console.error("6. TROQUE [YOUR-PASSWORD] pela sua senha de banco de dados real.\n");
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
});

async function pushSchema() {
    try {
        console.log("🔄 Conectando ao seu banco de dados Supabase...");
        await client.connect();

        const sqlContent = fs.readFileSync('supabase_schema.sql', 'utf8');

        console.log("⚙️ Aplicando todas as atualizações de tabelas e políticas (RLS)...");
        await client.query(sqlContent);

        console.log("✅ SUCESSO! Banco de dados atualizado automaticamente.");
    } catch (err) {
        console.error("\n❌ Ocorreu um erro ao atualizar o banco Supabase:", err.message);
    } finally {
        await client.end();
    }
}

pushSchema();
