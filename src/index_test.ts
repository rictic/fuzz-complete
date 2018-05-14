import {assert} from 'chai';

import {parse, tryParse} from './index.js';
import {ValidationError} from './parser/error.js';
import {take} from './util.js';

suite('it can fuzz itself', () => {
  const languageText = `
    Language "fuzz complete grammar":
      start = 'Language "generated": ' rule*;
      string = '"' stringContents '"';
      rule = word '!'? ' = ' production '; ';
      production = string ' ' | word ' ' | production+;
      word! = letter+;
      stringContents = letter*;
      letter = 'a' | 'b' | 'c';
  `;
  const languageLanguage = parse(languageText);
  test('the first 50 results seem reasonable', () => {
    assert.deepEqual([...take(languageLanguage, 50)], [
      'Language "generated": ',
      'Language "generated": a = "" ; ',
      'Language "generated": a! = "" ; ',
      'Language "generated": a = "" ; a = "" ; ',
      'Language "generated": a = "" ; b = "" ; ',
      'Language "generated": a! = "" ; a = "" ; ',
      'Language "generated": a! = "" ; b = "" ; ',
      'Language "generated": a = a ; ',
      'Language "generated": a = b ; ',
      'Language "generated": a = a ; a = "" ; ',
      'Language "generated": a = a ; b = "" ; ',
      'Language "generated": a = b ; a = "" ; ',
      'Language "generated": a = b ; b = "" ; ',
      'Language "generated": a = b ; aa = "" ; ',
      'Language "generated": a = "" ; a! = "" ; ',
      'Language "generated": a = "" ; b! = "" ; ',
      'Language "generated": a! = "" ; a! = "" ; ',
      'Language "generated": a! = "" ; b! = "" ; ',
      'Language "generated": a = a ; a! = "" ; ',
      'Language "generated": a = a ; b! = "" ; ',
      'Language "generated": a = b ; a! = "" ; ',
      'Language "generated": a = b ; b! = "" ; ',
      'Language "generated": a = b ; aa! = "" ; ',
      'Language "generated": a! = a ; ',
      'Language "generated": a! = b ; ',
      'Language "generated": a! = a ; a = "" ; ',
      'Language "generated": a! = a ; b = "" ; ',
      'Language "generated": a! = b ; a = "" ; ',
      'Language "generated": a! = b ; b = "" ; ',
      'Language "generated": a! = b ; aa = "" ; ',
      'Language "generated": a! = a ; a! = "" ; ',
      'Language "generated": a! = a ; b! = "" ; ',
      'Language "generated": a! = b ; a! = "" ; ',
      'Language "generated": a! = b ; b! = "" ; ',
      'Language "generated": a! = b ; aa! = "" ; ',
      'Language "generated": a = "" ; a = "" ; a = "" ; ',
      'Language "generated": a = "" ; a = "" ; b = "" ; ',
      'Language "generated": a = "" ; b = "" ; a = "" ; ',
      'Language "generated": a = "" ; b = "" ; b = "" ; ',
      'Language "generated": a = "" ; b = "" ; aa = "" ; ',
      'Language "generated": a! = "" ; a = "" ; a = "" ; ',
      'Language "generated": a! = "" ; a = "" ; b = "" ; ',
      'Language "generated": a! = "" ; b = "" ; a = "" ; ',
      'Language "generated": a! = "" ; b = "" ; b = "" ; ',
      'Language "generated": a! = "" ; b = "" ; aa = "" ; ',
      'Language "generated": a = a ; a = "" ; a = "" ; ',
      'Language "generated": a = a ; a = "" ; b = "" ; ',
      'Language "generated": a = a ; b = "" ; a = "" ; ',
      'Language "generated": a = a ; b = "" ; b = "" ; ',
      'Language "generated": a = a ; b = "" ; aa = "" ; '
    ]);
  });

  test('the output parses, even if it does not validate', function() {
    let numToGenerate;
    if (process.env['SLOW_TEST']) {
      numToGenerate = 1_000_000;
      this.timeout(4 * 60 * 1000);
    } else {
      numToGenerate = 10_000;
    }
    let successCount = 0;
    for (const generatedLangDef of take(languageLanguage, numToGenerate)) {
      const result = tryParse(generatedLangDef);
      if (!result.successful) {
        assert.instanceOf(
            result.error, ValidationError,
            `Expected all generated languages to parse, but this one did not: \n    ${
                generatedLangDef}\n`);
      } else {
        successCount++;
        const stringValue = result.value.toString();
        const reparseResult = tryParse(stringValue);
        if (!reparseResult.successful) {
          throw new Error(`
            This language:
              ${generatedLangDef}
            When parsed and stringified, yielded:
              ${stringValue}
            Which failed to parse with error: ${reparseResult.error}`);
        }
        assert.deepEqual(
            parse(reparseResult.value.toString()).toString(), stringValue);
      }
    }
    assert.isAtLeast(
        successCount / numToGenerate, 0.05,
        `Too many generated languages did not parse!`);
  });
});
