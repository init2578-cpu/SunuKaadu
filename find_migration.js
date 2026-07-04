import fs from 'fs';
import readline from 'readline';

const logPath = 'C:\\Users\\Code Fire\\.gemini\\antigravity-ide\\brain\\1533841d-bc57-47dc-a69e-cb47b2a4d444\\.system_generated\\logs\\transcript.jsonl';

async function run() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount >= 990 && lineCount <= 1005) {
      const parsed = JSON.parse(line);
      console.log(`Step ${parsed.step_index}: type=${parsed.type}, status=${parsed.status}`);
      if (parsed.tool_calls) {
        console.log("Tool calls:", JSON.stringify(parsed.tool_calls, null, 2));
      }
    }
  }
}

run().catch(console.error);
