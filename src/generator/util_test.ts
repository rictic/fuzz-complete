import {assert} from 'chai';

import {take} from '../util.js';

import {BufferedIterable, everyCombination, everyLabelling} from './util.js';

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

suite('everyLabelling', () => {
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

suite('BufferedIterable', () => {
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
