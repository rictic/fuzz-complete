/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

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
  for (const error of result.error) {
    console.error(error.message);
    console.error('');
  }
  process.exit(2);
  throw new Error('This line will not be reached');
}
const language = result.value;
let outputIterable: IterableIterator<string> = language[Symbol.iterator]();
if (emitJson) {
  outputIterable = jsonMap(outputIterable);
}
process.stdout.on('error', () => {
  process.exit(0);
});
printInBursts(outputIterable);


function printInBursts(outputIterable: Iterator<string>) {
  for (let i = 0; i < 1000; i++) {
    const {done, value} = outputIterable.next();
    if (done) {
      return;
    }
    process.stdout.write(value + '\n');
  }
  setTimeout(() => printInBursts(outputIterable), 0);
}

function* jsonMap(iterable: Iterable<string>): IterableIterator<string> {
  for (const value of iterable) {
    yield JSON.stringify(value);
  }
}
