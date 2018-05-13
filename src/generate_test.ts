import {assert} from 'chai';

import {BufferedIterable, everyCombination, everyLabelling, Language, Production, Rule} from './generate';
import {take} from './util';

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

suite('bufferedIterable', () => {
  test('iterates once through', () => {
    const vals = [1, 2, 3];
    const buffered = new BufferedIterable(vals[Symbol.iterator]());
    assert.deepEqual([...buffered], vals);
  });

  test('iterates twice through', () => {
    const vals = [1, 2, 3];
    const buffered = new BufferedIterable(vals[Symbol.iterator]());
    assert.deepEqual([...buffered], vals);
    assert.deepEqual([...buffered], vals);
  });

  test('second iterable first', () => {
    const vals = [1, 2, 3];
    const buffered = new BufferedIterable(vals[Symbol.iterator]());
    const it1 = buffered[Symbol.iterator]();
    const it2 = buffered[Symbol.iterator]();
    assert.deepEqual([...it2], vals);
    assert.deepEqual([...it1], vals);
  });

  test('interleaved', () => {
    const vals = [1, 2, 3, 4, 5];
    const buffered = new BufferedIterable(vals[Symbol.iterator]());
    const it1 = buffered[Symbol.iterator]();
    const it2 = buffered[Symbol.iterator]();
    assert.deepEqual({done: false, value: 1}, it1.next());
    assert.deepEqual({done: false, value: 2}, it1.next());
    assert.deepEqual({done: false, value: 3}, it1.next());
    assert.deepEqual({done: false, value: 1}, it2.next());
    assert.deepEqual({done: false, value: 2}, it2.next());
    assert.deepEqual({done: false, value: 3}, it2.next());
    assert.deepEqual({done: false, value: 4}, it2.next());
    assert.deepEqual({done: false, value: 5}, it2.next());
    // This cast is bad, but the typings are overspecific.
    assert.deepEqual(
        {done: true, value: undefined!} as IteratorResult<number>, it2.next());
    assert.deepEqual({done: false, value: 4}, it1.next());
    assert.deepEqual({done: false, value: 5}, it1.next());
    // This cast is bad, but the typings are overspecific.
    assert.deepEqual(
        {done: true, value: undefined!} as IteratorResult<number>, it1.next());
  });
});

suite('everyCombination', () => {
  function* naturals() {
    let i = 1;
    while (true) {
      yield i;
      i++;
    }
  }

  function* abc() {
    yield 'a';
    yield 'b';
    yield 'c';
  }

  test('can give every combination even of two unending iterators', () => {
    const cartesians = everyCombination(naturals(), naturals());
    assert.deepEqual([...take(cartesians[Symbol.iterator](), 10)], [
      [1, 1], [2, 1], [1, 2], [2, 2], [3, 1], [3, 2], [1, 3], [2, 3], [3, 3],
      [4, 1]
    ]);
  });

  test('can give every combination of two ending iterators', () => {
    const letterPairs = everyCombination(abc(), abc());
    // Can try to take 100, there's only 9 total.
    assert.deepEqual([...take(letterPairs[Symbol.iterator](), 100)], [
      ['a', 'a'], ['b', 'a'], ['a', 'b'], ['b', 'b'], ['c', 'a'], ['c', 'b'],
      ['a', 'c'], ['b', 'c'], ['c', 'c']
    ]);
  });

  test(
      'can give every combination of one ending and one unending iterators',
      () => {
        const letterNumber = everyCombination(abc(), naturals());
        const numberLetter = everyCombination(naturals(), abc());
        assert.deepEqual([...take(letterNumber[Symbol.iterator](), 15)], [
          ['a', 1], ['b', 1], ['a', 2], ['b', 2], ['c', 1], ['c', 2], ['a', 3],
          ['b', 3], ['c', 3], ['a', 4], ['b', 4], ['c', 4], ['a', 5], ['b', 5],
          ['c', 5]
        ]);

        assert.deepEqual([...take(numberLetter[Symbol.iterator](), 15)], [
          [1, 'a'], [2, 'a'], [1, 'b'], [2, 'b'], [3, 'a'], [3, 'b'], [1, 'c'],
          [2, 'c'], [3, 'c'], [4, 'a'], [4, 'b'], [4, 'c'], [5, 'a'], [5, 'b'],
          [5, 'c']
        ]);
      });
});

suite('everyChoosingWithReplacement', () => {
  test('one choice one count', () => {
    assert.deepEqual([...everyLabelling(['a'], 1)], [['a']]);
  });

  test('two choices one count', () => {
    assert.deepEqual([...everyLabelling(['a', 'b'], 1)], [['a']]);
  });

  test('one choice two count', () => {
    assert.deepEqual([...everyLabelling(['a'], 2)], [['a', 'a']]);
  });

  test('two choices two count', () => {
    assert.deepEqual(
        [...everyLabelling(['a', 'b'], 2)], [['a', 'a'], ['a', 'b']]);
  });

  test('three choices two count', () => {
    assert.deepEqual(
        [...everyLabelling(['a', 'b', 'c'], 2)], [['a', 'a'], ['a', 'b']]);
  });

  test('three choices three count', () => {
    assert.deepEqual([...everyLabelling(['a', 'b', 'c'], 3)], [
      ['a', 'a', 'a'], ['a', 'a', 'b'], ['a', 'b', 'a'], ['a', 'b', 'b'],
      ['a', 'b', 'c']
    ]);
  });

  test('zero choices five count', () => {
    assert.deepEqual([...everyLabelling([], 5)], []);
  });
});
