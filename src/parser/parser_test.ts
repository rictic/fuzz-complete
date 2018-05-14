import {assert} from 'chai';

import {take} from '../util.js';

import {parse, tryParse} from './parser.js';

suite('Parser', () => {
  test('it can parse a minimal file', () => {
    const language = parse(`Language "Hello World":`);
    assert.deepEqual(language.toString(), `Language "Hello World":\n`);
  });

  test('it can parse the language: a', () => {
    const language = parse(`
        Language "Hello World":
          start = "a";
        `.trim());
    assert.deepEqual(
        language.toString(),
        `Language "Hello World":\n` +
            `  start = "a";`);
  });

  test('it can parse the language: a*', () => {
    const language = parse(`
        Language "Hello World":
          start = ℇ | "a" start;
        `.trim());
    assert.deepEqual(
        language.toString(),
        `Language "Hello World":\n` +
            `  start = ℇ | "a" start;`);
    assert.deepEqual([...take(language, 10)], [
      '', 'a', 'aa', 'aaa', 'aaaa', 'aaaaa', 'aaaaaa', 'aaaaaaa', 'aaaaaaaa',
      'aaaaaaaaa'
    ]);
  });

  test('it can parse the language: a(b|c)*', () => {
    const language = parse(`
        Language "a(b|c)*":
          start = "a" bOrCStar;
          bOrC = "b" | "c";
          bOrCStar = ℇ | bOrC bOrCStar;
        `.trim());
    assert.deepEqual(
        language.toString(),
        `Language "a(b|c)*":\n` +
            `  start = "a" bOrCStar;
  bOrC = "b" | "c";
  bOrCStar = ℇ | bOrC bOrCStar;`);
  });

  test('it can parse labelled rules', () => {
    const language = parse(`
        Language "addition of labels":
          start = 'var ' identifier ' = ' identifier ' + ' identifier;
          identifier! = "a" | "b" | "c" | "d" | "e";
        `.trim());
    assert.deepEqual(language.toString(), `Language "addition of labels":
  start = "var " identifier " = " identifier " + " identifier;
  identifier! = "a" | "b" | "c" | "d" | "e";`);
    assert.deepEqual([...take(language, 10)], [
      'var a = a + a',
      'var a = a + b',
      'var a = b + a',
      'var a = b + b',
      'var a = b + c',
    ]);
  });

  test('string escapes', () => {
    // Double-escaping makes this tricky to read.
    const language = parse(`
      Language "string escapes":
        start = "\\"" '\\'' "\\\\" "\\n" "\\t" "\\z";
    `);
    assert.deepEqual(language.toString(), `
Language "string escapes":
  start = "\\"" "'" "\\\\" "\\n" "\\t" "z";
`.trim());
    assert.deepEqual([...language], [`"'\\\n\tz`]);
  });

  test('it can handle multiple labels', () => {
    const language = parse(`
        Language "multiple labels":
          start = statement+;
          statement = 'var ' identifier ' = ' identifier ' * ' number ' + ' number ';  ';
          identifier! = 'foo' | 'bar' | 'baz';
          number! = '0' | '1' | '2' | '3' | '4' | '5';
    `.trim());
    assert.deepEqual([...take(language, 30)], [
      'var foo = foo * 0 + 0;  ',
      'var foo = bar * 0 + 0;  ',
      'var foo = foo * 0 + 1;  ',
      'var foo = bar * 0 + 1;  ',
      'var foo = foo * 0 + 0;  var foo = foo * 0 + 0;  ',
      'var foo = foo * 0 + 0;  var foo = bar * 0 + 0;  ',
      'var foo = foo * 0 + 0;  var foo = foo * 0 + 1;  ',
      'var foo = foo * 0 + 0;  var foo = bar * 0 + 1;  ',
      'var foo = foo * 0 + 0;  var bar = foo * 0 + 0;  ',
      'var foo = foo * 0 + 0;  var bar = foo * 0 + 1;  ',
      'var foo = foo * 0 + 0;  var foo = foo * 1 + 0;  ',
      'var foo = foo * 0 + 0;  var foo = bar * 1 + 0;  ',
      'var foo = foo * 0 + 0;  var bar = foo * 1 + 0;  ',
      'var foo = foo * 0 + 0;  var bar = bar * 0 + 0;  ',
      'var foo = foo * 0 + 0;  var bar = bar * 0 + 1;  ',
      'var foo = foo * 0 + 0;  var bar = bar * 1 + 0;  ',
      'var foo = foo * 0 + 0;  var foo = foo * 1 + 1;  ',
      'var foo = foo * 0 + 0;  var foo = bar * 1 + 1;  ',
      'var foo = foo * 0 + 0;  var bar = foo * 1 + 1;  ',
      'var foo = foo * 0 + 0;  var bar = bar * 1 + 1;  ',
      'var foo = foo * 0 + 0;  var bar = baz * 0 + 0;  ',
      'var foo = foo * 0 + 0;  var bar = baz * 0 + 1;  ',
      'var foo = foo * 0 + 0;  var bar = baz * 1 + 0;  ',
      'var foo = foo * 0 + 0;  var bar = baz * 1 + 1;  ',
      'var foo = foo * 0 + 0;  var foo = foo * 1 + 2;  ',
      'var foo = foo * 0 + 0;  var foo = bar * 1 + 2;  ',
      'var foo = foo * 0 + 0;  var bar = foo * 1 + 2;  ',
      'var foo = foo * 0 + 0;  var bar = bar * 1 + 2;  ',
      'var foo = foo * 0 + 0;  var bar = baz * 1 + 2;  ',
      'var foo = bar * 0 + 0;  var foo = foo * 0 + 0;  '
    ]);
  });

  test('it can parse EBNF unary operators', () => {
    const language = parse(`
        Language "ebnf unary operators":
          start = "foo"* | start+ | "baz"? start? start* start+;
        `);
    assert.deepEqual(language.toString(), `
Language "ebnf unary operators":
  start = "foo"* | start+ | "baz"? start? start* start+;`.trim());
    assert.deepEqual(
        [...take(language, 10)],
        ['', '', '', 'foo', '', 'baz', 'foofoo', '', '', 'foofoofoo']);
  });

  test('it can parse parentheses', () => {
    const language = parse(`
        Language "uses parens":
          start = (foobar (' ' foobar)*)? (" baz " "bonk")?;
          foobar = 'foo' | 'bar';
    `);
    assert.deepEqual(language.toString(), `
Language "uses parens":
  start = (foobar (" " foobar)*)? (" baz " "bonk")?;
  foobar = "foo" | "bar";`.trim());
    assert.deepEqual([...take(language, 10)], [
      '',
      'foo',
      ' baz bonk',
      'foo baz bonk',
      'bar',
      'bar baz bonk',
      'foo foo',
      'foo foo baz bonk',
      'bar foo',
      'bar foo baz bonk',
    ]);
  });

  suite('errors', () => {
    function assertFailsWithError(langSource: string, errorMessage: string) {
      const result = tryParse(langSource);
      if (result.successful) {
        throw new Error(`Did not expect ${
            JSON.stringify(
                langSource)} to parse and validate successfully. Expected error: ${
            errorMessage}`);
      }
      assert.deepEqual(result.error.originalMessage, errorMessage);
    }
    suite('parsing', () => {
      test('gives good error messages for common mistakes', () => {
        assertFailsWithError(
            ``, 'Unexpected end of input, expected word `Language`');
        assertFailsWithError(
            `Language foo:`,
            'Expected a string literal but found an identifier');
        assertFailsWithError(
            `Language "foo": bar = "bar"`,
            'Unexpected end of input, missing semicolon?');
        assertFailsWithError(
            `Language "foo": bar = "bar" baz = "baz;`,
            'Did not expect to find an equals sign inside a rule definition. ' +
                'Is the previous rule missing its trailing semicolon?');
      });
    });

    suite('validation', () => {
      test('languages with references to undeclared rules', () => {
        const langSources = [
          `Language "foo": start = honk;`,
          `Language "foo": start = 'lol' 'what'; foo = honk;`,
        ];
        for (const langSource of langSources) {
          assertFailsWithError(langSource, 'Rule not declared');
        }
      });

      test('languages that loop endlessly', () => {
        const langSources = [
          `Language "loop": start = start;`,
          `Language "loop": start = "a" start;`,
          `Language "loop": foo = "a" bar; bar = "b" baz; baz = "c" foo;`,
        ];
        for (const langSource of langSources) {
          assertFailsWithError(
              langSource, 'Infinite loop detected in leftmost choice');
        }
      });
    });
  });
});
