import {assert} from 'chai';
import {Parser} from './parser';

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
});
