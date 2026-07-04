import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\Code Fire\\Desktop\\saner\\supabase_schema.sql', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('CREATE FUNCTION') || lines[i].includes('CREATE OR REPLACE FUNCTION')) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}
