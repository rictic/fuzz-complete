export function*
    everyCombination<A, B>(rawLefts: Iterator<A>, rawRights: Iterator<B>):
        Iterable<[A, B]> {
  const lefts = new BufferedIterable(rawLefts);
  const rights = new BufferedIterable(rawRights);
  let leftsDone = false;
  let rightsDone = false;
  let max = 0;
  while (true) {
    if (!leftsDone) {
      const {done, value: left} = lefts.get(max);
      if (done) {
        leftsDone = true;
      } else {
        for (let i = 0; i < max; i++) {
          const {done, value: right} = rights.get(i);
          if (done) {
            break;
          }
          yield [left!, right!];
        }
      }
    }
    if (!rightsDone) {
      const {done, value: right} = rights.get(max);
      if (done) {
        rightsDone = true;
      } else {
        for (let i = 0; i <= max; i++) {
          const {done, value: left} = lefts.get(i);
          if (done) {
            break;
          }
          yield [left!, right!];
        }
      }
    }
    if (leftsDone && rightsDone) {
      break;
    }
    max++;
  }
}

export function*
    everyCombinationMany<T>(iterators: Array<Iterable<T>>):
        IterableIterator<T[]> {
  if (iterators.length === 0) {
    yield [];
    return;
  }
  if (iterators.length === 1) {
    for (const it of iterators[0]) {
      yield [it];
    }
    return;
  }
  for (const [prefix, suffix] of everyCombination(
           iterators[0][Symbol.iterator](),
           everyCombinationMany(iterators.slice(1))[Symbol.iterator]())) {
    yield [prefix].concat(suffix);
  }
}

export class BufferedIterable<T> {
  private readonly buffer: T[] = [];
  constructor(private readonly iterator: Iterator<T>) {}

  * [Symbol.iterator](): IterableIterator<T> {
    let i = 0;
    while (true) {
      if (i + 1 > this.buffer.length) {
        const {done, value} = this.iterator.next();
        if (done) {
          return;
        }
        this.buffer.push(value);
      }
      yield this.buffer[i];
      i++;
    }
  }

  get(index: number): {done: true, value: undefined}|{done: false, value: T} {
    while (index >= this.buffer.length) {
      const {done, value} = this.iterator.next();
      if (done) {
        return {done: true, value: undefined};
      }
      this.buffer.push(value);
    }
    return {done: false, value: this.buffer[index]};
  }
}

export function*
    everyLabelling(choices: string[], count: number):
        IterableIterator<string[]> {
  for (const numberedLabelling of everyLabellingHelper(choices.length, count)) {
    yield numberedLabelling.map((n) => choices[n]);
  }
}

function*
    everyLabellingHelper(numberOfChoices: number, count: number):
        IterableIterator<number[]> {
  if (numberOfChoices === 0) {
    return;
  }
  if (count === 1) {
    yield [0];
    return;
  }
  const smallerLabellings = everyLabellingHelper(numberOfChoices, count - 1);
  for (const subLabelling of smallerLabellings) {
    const maxInLabelling = subLabelling.reduce((x, y) => Math.max(x, y), 0);
    const maxToCountTo = Math.min(maxInLabelling + 1, numberOfChoices - 1);
    for (let i = 0; i <= maxToCountTo; i++) {
      yield subLabelling.concat([i]);
    }
  }
}
