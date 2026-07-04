import fs from 'fs';
import readline from 'readline';

const logPath = 'C:\\Users\\Code Fire\\.gemini\\antigravity-ide\\brain\\151d9556-62b6-4a9e-9c0f-06bb626cf384\\.system_generated\\logs\\transcript.jsonl';

async function run() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.includes('check_and_save_representative') && line.includes('UUID')) {
      console.log(`Line ${lineCount}:`);
      const parsed = JSON.parse(line);
      console.log("  type:", parsed.type);
      console.log("  content:", parsed.content ? parsed.content.substring(0, 300) : 'no content');
    }
  }
}

run().catch(console.error);
