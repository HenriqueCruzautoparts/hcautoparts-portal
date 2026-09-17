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

async function renewCupons() {
    try {
        console.log("🔄 Conectando ao Supabase...");
        await client.connect();

        // Primeiro, verificar/adicionar a coluna data_validade se não existir
        console.log("⚙️ Verificando estrutura da tabela...");
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema='public' AND table_name='cupons' AND column_name='data_validade'
                ) THEN
                    ALTER TABLE public.cupons ADD COLUMN data_validade DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days');
                    RAISE NOTICE 'Coluna data_validade adicionada com sucesso.';
                END IF;
            END $$;
        `);

        // Atualizar data_validade de TODOS os cupons ativos para +30 dias a partir de hoje
        const result = await client.query(`
            UPDATE public.cupons 
            SET data_validade = CURRENT_DATE + INTERVAL '30 days'
            WHERE ativo = true;
        `);

        console.log(`✅ ${result.rowCount} cupom(ns) renovado(s) com nova validade de +30 dias.`);

        // Adicionar política de leitura para system_errors (para o health check funcionar)
        console.log("⚙️ Configurando política de leitura para system_errors...");
        await client.query(`
            DO $$ BEGIN
                CREATE POLICY "Allow anonymous reads on system_errors" ON public.system_errors
                    FOR SELECT USING (true);
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        // Adicionar política de DELETE para system_errors (limpeza)
        await client.query(`
            DO $$ BEGIN
                CREATE POLICY "Allow anonymous deletes on system_errors" ON public.system_errors
                    FOR DELETE USING (true);
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        console.log("✅ Políticas de acesso configuradas.");

        // Mostrar todos os cupons atualizados
        const { rows } = await client.query(`
            SELECT titulo, codigo, data_validade, ativo 
            FROM public.cupons 
            ORDER BY ordem;
        `);

        console.log("\n📋 Cupons atualizados:");
        rows.forEach(row => {
            const status = row.ativo ? '✅' : '❌';
            console.log(`  ${status} ${row.titulo} (${row.codigo}) — Validade: ${row.data_validade}`);
        });

    } catch (err) {
        console.error("\n❌ Ocorreu um erro:", err.message);
    } finally {
        await client.end();
    }
}

renewCupons();
