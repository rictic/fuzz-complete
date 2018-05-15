import * as fs from 'fs';
import {tryParse} from './index.js';

function usageAndExit(): never {
  console.log(`Usage:`);
  console.log(`  fuzz-complete [options] json.fuzzlang`);
  console.log();
  console.log('Options:');
  console.log(
      `  --json:  Emits output as JSON-encoded, newline-separated strings.\n` +
      `           Useful when your language includes newlines or non-ascii\n` +
      `           printable characters.`);
  console.log('\n');
  process.exit(1);
  throw new Error('This line will not be reached');
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length > 2) {
  usageAndExit();
}

let emitJson = false;
if (args.length === 2) {
  if (args[0] !== '--json') {
    usageAndExit();
  }
  emitJson = true;
  args.shift();
}

const langFilename = args[0];
if (langFilename === undefined) {
  usageAndExit();
}
const langSource = fs.readFileSync(langFilename, 'utf-8');
const result = tryParse(langSource);
if (!result.successful) {
  console.error(result.error.message);
  process.exit(2);
  throw new Error('This line will not be reached');
}
const language = result.value;
let outputIterable: Iterable<string> = language[Symbol.iterator]();
if (emitJson) {
  outputIterable = jsonMap(outputIterable);
}
process.stdout.on('close', () => {
  console.log('stdout closed');
  process.exit(0);
});
process.stdout.on('error', () => {
  console.log('got an error');
  process.exit(0);
});
printInBursts(outputIterable);


function printInBursts(outputIterable: Iterable<string>) {
  let i = 0;
  for (const output of outputIterable) {
    process.stdout.write(output + '\n');
    if (i++ > 1000) {
      process.nextTick(() => printInBursts(outputIterable));
      return;
    }
  }
}

function* jsonMap(iterable: Iterable<string>): Iterable<string> {
  for (const value of iterable) {
    yield JSON.stringify(value);
  }
}
