const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Encontrada (tamanho: ' + process.env.GEMINI_API_KEY.length + ')' : 'Não encontrada');
if (process.env.GEMINI_API_KEY) {
  console.log('Primeiros 4 caracteres:', process.env.GEMINI_API_KEY.substring(0, 4));
  console.log('Contém espaços?', /\s/.test(process.env.GEMINI_API_KEY));
}
