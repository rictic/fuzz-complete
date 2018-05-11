import {assert} from 'chai';

import {BufferedIterable, Language, Production, Rule} from './generate';


function* take<T>(iter: Iterator<T>, num: number) {
  while (true) {
    if (num <= 0) {
      return;
    }
    const {done, value} = iter.next();
    if (done) {
      return;
    }
    yield value;
    num--;
  }
}

function Literal(value: string): Production {
  return {kind: 'literal', value};
}
function Ref(name: string): Production {
  return {kind: 'rule', name};
}
function Sequence(...productions: Production[]): Production {
  return {kind: 'sequence', productions};
}
const Empty = Sequence();


suite('Any number of b, then one a', () => {
  const fooLanguage = new Language(
      'b*a',
      [new Rule('foo', [Literal('a'), Sequence(Literal('b'), Ref('foo'))])]);

  test('to string', () => {
    assert.deepEqual(fooLanguage.toString(), `
Language "b*a":
  foo -> "a" | "b" foo
        `.trim());
  });

  test('generates the first few members', () => {
    assert.deepEqual(
        [...take(fooLanguage[Symbol.iterator](), 5)],
        ['a', 'ba', 'bba', 'bbba', 'bbbba']);
  });
});

suite('a followed by any number of b or c, interleaved', () => {
  const aThenBsAndCs = new Language('a(b|c)*', [
    new Rule('start', [Sequence(Literal('a'), Ref('bOrCStar'))]),
    new Rule('bOrC', [Literal('b'), Literal('c')]),
    new Rule('bOrCStar', [Empty, Sequence(Ref('bOrC'), Ref('bOrCStar'))])
  ]);

  test('to string', () => {
    assert.deepEqual(aThenBsAndCs.toString(), `
Language "a(b|c)*":
  start -> "a" bOrCStar
  bOrC -> "b" | "c"
  bOrCStar -> ℇ | bOrC bOrCStar
        `.trim());
  });

  test('generates the first few members', () => {
    assert.deepEqual(
        [...take(aThenBsAndCs[Symbol.iterator](), 10)],
        ['a', 'ab', 'ac', 'abb', 'acb', 'abc', 'acc', 'abbb', 'acbb', 'abcb']);
  });
});

suite('(a+b)*', () => {
  const lang = new Language('(a+b)*', [
    new Rule(
        'start',
        [
          Empty,
          Sequence(Literal('a'), Ref('aStar'), Literal('b'), Ref('start'))
        ]),
    new Rule('aStar', [Empty, Sequence(Literal('a'), Ref('aStar'))])
  ]);

  test('generates the first few members', () => {
    assert.deepEqual(
        [...take(lang[Symbol.iterator](), 10)], ['', 'ab', 'aab', 'abab']);
  });
});

suite('javascript', () => {
  const js = new Language('javascript', [
    new Rule('file', [Ref('program')]),
    new Rule('program', [Sequence(Ref('statements'))]),
    new Rule(
        'statements',
        [
          Empty,
          //
          Sequence(Ref('statement'), Ref('statements')),
        ]),
    new Rule('statement', [Ref('expressionStatement')]),
    new Rule(
        'expressionStatement', [Sequence(Ref('expression'), Literal(';'))]),
    new Rule('expression', [Ref('stringLiteral'), Ref('numberLiteral')]),
    new Rule(
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
    new Rule('numberLiteral', [Sequence(Ref('digit'), Ref('digits'))]),
    new Rule('digits', [Empty, Sequence(Ref('digit'), Ref('digits'))]),
    new Rule(
        'digit',
        [
          Literal('0'), Literal('1'), Literal('2'), Literal('3'), Literal('4'),
          Literal('5'), Literal('6'), Literal('7'), Literal('8'), Literal('9')
        ]),
    new Rule(
        'stringContents',
        [Empty, Sequence(Ref('character'), Ref('stringContents'))]),
    new Rule('character', [Literal('a'), Literal('b'), Literal('c')])
  ]);

  test.skip('generates the first few members', () => {
    assert.deepEqual([...take(js[Symbol.iterator](), 50)], []);
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
    // tslint:disable-next-line: no-any Typings are wrong.
    assert.deepEqual({done: true, value: undefined} as any, it2.next());
    assert.deepEqual({done: false, value: 4}, it1.next());
    assert.deepEqual({done: false, value: 5}, it1.next());
    // tslint:disable-next-line: no-any Typings are wrong.
    assert.deepEqual({done: true, value: undefined} as any, it1.next());
  });
});
