export function isIterable<T>(maybeIt: {}): maybeIt is Iterable<T> {
  return Symbol.iterator in maybeIt;
}

export function* take<T>(iter: Iterator<T>|Iterable<T>, num: number) {
  if (isIterable(iter)) {
    iter = (iter as Iterable<T>)[Symbol.iterator]();
  }
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
