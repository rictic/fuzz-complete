import {assert} from 'chai';

import {take} from '../util.js';

import {Parser} from './parser.js';

suite('Parser', () => {
  test('it can parse a minimal file', () => {
    const parser = new Parser();
    const language = parser.parse(`Language "Hello World":`);
    assert.deepEqual(language.toString(), `Language "Hello World":\n`);
  });

  test('it can parse the language: a', () => {
    const parser = new Parser();
    const language = parser.parse(`
        Language "Hello World":
          start = "a";
        `.trim());
    assert.deepEqual(
        language.toString(),
        `Language "Hello World":\n` +
            `  start = "a";`);
  });

  test('it can parse the language: a*', () => {
    const parser = new Parser();
    const language = parser.parse(`
        Language "Hello World":
          start = "a" start | ℇ;
        `.trim());
    assert.deepEqual(
        language.toString(),
        `Language "Hello World":\n` +
            `  start = "a" start | ℇ;`);
  });

  test('it can parse the language: a(b|c)*', () => {
    const parser = new Parser();
    const language = parser.parse(`
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
    const parser = new Parser();
    const language = parser.parse(`
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

  test('it can handle multiple labels', () => {
    const parser = new Parser();
    const language = parser.parse(`
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
    const parser = new Parser();
    const language = parser.parse(`
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
});
