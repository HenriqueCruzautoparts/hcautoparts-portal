import fs from 'fs';
import path from 'path';

const filesToDump = [
  'src/app/page.tsx',
  'src/app/api/pesquisa/route.ts',
  'src/app/api/ml-search/route.ts',
  'src/data/vehicles.ts',
  'package.json'
];

let output = "# DUMP DE CÓDIGO - AUTOPARTS PORTAL\n\n";
output += "Este arquivo contém o código-fonte atualizado para análise do Gemini.\n\n";

filesToDump.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    output += `## ARQUIVO: ${file}\n`;
    output += "```" + (file.endsWith('.tsx') ? 'tsx' : file.endsWith('.ts') ? 'ts' : 'json') + "\n";
    output += content + "\n";
    output += "```\n\n---\n\n";
  } else {
    output += `## ARQUIVO NÃO ENCONTRADO: ${file}\n\n---\n\n`;
  }
});

fs.writeFileSync('codigo_completo.md', output);
console.log('✅ Tudo pronto! O arquivo "codigo_completo.md" foi gerado na raiz do projeto.');
console.log('Você pode copiar o conteúdo desse arquivo e enviar para o Gemini analisar.');
