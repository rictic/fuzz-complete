import {assert} from 'chai';

import {take} from '../util.js';

import {Language, Production, Rule} from './ast.js';

function NewRule(name: string, choices: Production[]) {
  // We don't care about locations in these tests.
  return new Rule(name, choices, false, 0, 0);
}
function Literal(value: string): Production {
  return {kind: 'literal', value};
}
function Ref(name: string): Production {
  return {kind: 'rule', name, offsetStart: 0, offsetEnd: 0};
}
function Sequence(...productions: Production[]): Production {
  return {kind: 'sequence', productions};
}
function Op(operator: '+'|'?'|'*', production: Production): Production {
  return {kind: 'unaryOperator', operator, production};
}
const Empty = Sequence();


suite('language b*a', () => {
  const fooLanguage = new Language(
      'b*a',
      [NewRule('foo', [Literal('a'), Sequence(Literal('b'), Ref('foo'))])]);

  test('to string', () => {
    assert.deepEqual(fooLanguage.toString(), `
Language "b*a":
  foo = "a" | "b" foo;
        `.trim());
  });

  test('generates the first few members', () => {
    assert.deepEqual(
        [...take(fooLanguage, 5)], ['a', 'ba', 'bba', 'bbba', 'bbbba']);
  });
});

suite('language a(b|c)*', () => {
  const aThenBsAndCs = new Language('a(b|c)*', [
    NewRule('start', [Sequence(Literal('a'), Ref('bOrCStar'))]),
    NewRule('bOrC', [Literal('b'), Literal('c')]),
    NewRule('bOrCStar', [Empty, Sequence(Ref('bOrC'), Ref('bOrCStar'))])
  ]);

  test('to string', () => {
    assert.deepEqual(aThenBsAndCs.toString(), `
Language "a(b|c)*":
  start = "a" bOrCStar;
  bOrC = "b" | "c";
  bOrCStar = ℇ | bOrC bOrCStar;
        `.trim());
  });

  test('generates the first few members', () => {
    assert.deepEqual(
        [...take(aThenBsAndCs, 10)],
        ['a', 'ab', 'ac', 'abb', 'acb', 'abc', 'acc', 'abbb', 'acbb', 'abcb']);
  });
});

suite('language (a+b)*', () => {
  const lang = new Language('(a+b)*', [
    NewRule(
        'start',
        [
          Empty,
          Sequence(Literal('a'), Ref('aStar'), Literal('b'), Ref('start'))
        ]),
    NewRule('aStar', [Empty, Sequence(Literal('a'), Ref('aStar'))])
  ]);

  test('generates the first few members', () => {
    assert.deepEqual([...take(lang, 20)], [
      '',         'ab',        'aab',      'abab',     'aabab',
      'aaab',     'aaabab',    'abaab',    'aabaab',   'aaabaab',
      'aaaab',    'aaaabab',   'aaaabaab', 'ababab',   'aababab',
      'aaababab', 'aaaababab', 'aaaaab',   'aaaaabab', 'aaaaabaab'
    ]);
  });
});

suite('simplified javascript', () => {
  const js = new Language('javascript', [
    NewRule('file', [Ref('program')]),
    NewRule('program', [Sequence(Ref('statements'))]),
    NewRule(
        'statements',
        [
          Empty,
          Sequence(Ref('statement'), Ref('statements')),
        ]),
    NewRule('statement', [Ref('expressionStatement')]),
    NewRule('expressionStatement', [Sequence(Ref('expression'), Literal(';'))]),
    NewRule('expression', [Ref('stringLiteral'), Ref('numberLiteral')]),
    NewRule(
        'stringLiteral',
        [
          // {
          //   kind: 'sequence',
          //   productions: [
          //     {kind: 'literal', value: '"'},
          //     {kind: 'rule', name: 'stringContents'},
          //     {kind: 'literal', value: '"'},
          //   ]
          // },
          Sequence(
              Literal('\''),
              Ref('stringContents'),
              Literal('\''),
              ),
        ]),
    NewRule('numberLiteral', [Sequence(Ref('digit'), Ref('digits'))]),
    NewRule('digits', [Empty, Sequence(Ref('digit'), Ref('digits'))]),
    NewRule(
        'digit',
        [
          Literal('0'), Literal('1'), Literal('2'), Literal('3'), Literal('4'),
          Literal('5'), Literal('6'), Literal('7'), Literal('8'), Literal('9')
        ]),
    NewRule(
        'stringContents',
        [Empty, Sequence(Ref('character'), Ref('stringContents'))]),
    NewRule('character', [Literal('a'), Literal('b'), Literal('c')])
  ]);

  test('generates the first few members', () => {
    assert.deepEqual([...take(js, 10)], [
      '',
      '\'\';',
      '0;',
      '\'\';\'\';',
      '0;\'\';',
      '\'a\';',
      '\'a\';\'\';',
      '\'\';0;',
      '0;0;',
      '\'a\';0;',
    ]);
  });
});

suite('language with one labeled rule', () => {
  const labelled = new Language('one label', [
    NewRule('start', [Empty, Sequence(Ref('identifier'), Ref('start'))]),
    new Rule(
        'identifier', [Literal('a'), Literal('b'), Literal('c')], true, 0, 0)
  ]);

  test('generates the first few members', () => {
    assert.deepEqual(
        [...take(labelled, 10)],
        ['', 'a', 'aa', 'ab', 'aaa', 'aab', 'aba', 'abb', 'abc', 'aaaa']);
  });
});

suite('EBNF unary operators', () => {
  suite('the + operator', () => {
    const fooPlusBar = new Language('foo+bar', [
      NewRule('start', [Sequence(Op('+', Literal('foo')), Literal('bar'))])
    ]);

    test('toString()', () => {
      assert.deepEqual(fooPlusBar.toString(), `
Language "foo+bar":
  start = "foo"+ "bar";
          `.trim());
    });

    test('generates the first few members', () => {
      assert.deepEqual([...take(fooPlusBar, 5)], [
        'foobar',
        'foofoobar',
        'foofoofoobar',
        'foofoofoofoobar',
        'foofoofoofoofoobar',
      ]);
    });
  });

  suite('the * operator', () => {
    const fooPlusBar = new Language('foo*bar', [
      NewRule('start', [Sequence(Op('*', Literal('foo')), Literal('bar'))])
    ]);

    test('toString()', () => {
      assert.deepEqual(fooPlusBar.toString(), `
Language "foo*bar":
  start = "foo"* "bar";
          `.trim());
    });

    test('generates the first few members', () => {
      assert.deepEqual([...take(fooPlusBar, 5)], [
        'bar',
        'foobar',
        'foofoobar',
        'foofoofoobar',
        'foofoofoofoobar',
      ]);
    });
  });

  suite('the ? operator', () => {
    const fooPlusBar = new Language('foo?bar', [
      NewRule('start', [Sequence(Op('?', Literal('foo')), Literal('bar'))])
    ]);

    test('toString()', () => {
      assert.deepEqual(fooPlusBar.toString(), `
Language "foo?bar":
  start = "foo"? "bar";
          `.trim());
    });

    test('generates the first few members', () => {
      assert.deepEqual([...take(fooPlusBar, 5)], [
        'bar',
        'foobar',
      ]);
    });
  });
});