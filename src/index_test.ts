import {assert} from 'chai';

import {Parser} from '.';
import {ValidationError} from './parser/error';
import {take} from './util';

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
  const languageLanguage = new Parser().parse(languageText);
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

  test('the output parses, even if it does not validate', () => {
    for (const generatedLangDef of take(languageLanguage, 10000)) {
      const result = new Parser().tryParse(generatedLangDef);
      if (!result.successful) {
        assert.instanceOf(
            result.error, ValidationError,
            `Expected all generated languages to parse, but this one did not: \n    ${
                generatedLangDef}\n`);
      }
    }
  });
});
