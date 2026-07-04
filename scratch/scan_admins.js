import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\Code Fire\\Desktop\\saner\\supabase_schema.sql', 'utf8');
const lines = content.split('\n');

let start = -1;
let openCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('CREATE TABLE public.admins')) {
    start = i;
    break;
  }
}

if (start !== -1) {
  for (let i = start; i < start + 50; i++) {
    console.log(lines[i]);
    if (lines[i].includes(');')) break;
  }
} else {
  console.log("public.admins table not found in supabase_schema.sql");
}
