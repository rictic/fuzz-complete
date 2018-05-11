import * as util from 'util';
export type Production = {
  kind: 'literal',
  value: string
}|{kind: 'rule', name: string}|{kind: 'sequence', productions: Production[]};


export class Language {
  private readonly rulesByName: ReadonlyMap<string, Rule>;
  constructor(readonly name: string, readonly rules: ReadonlyArray<Rule>) {
    // TODO: validate rule uniqueness and references.
    const rulesByName = new Map<string, Rule>();
    for (const rule of rules) {
      rulesByName.set(rule.name, rule);
    }
    this.rulesByName = rulesByName;
  }

  * [Symbol.iterator](): IterableIterator<string> {
    if (this.rules.length === 0) {
      return;
    }
    for (const resultArr of this.iterateOverRule(this.rules[0])) {
      yield resultArr.join('');
    }
  }

  private * iterateOverRule(rule: Rule): IterableIterator<string[]> {
    if (rule.choices.length === 1) {
      // Optimize the simple case where there is no choice.
      yield* this.iterateOverProduction(rule.choices[0]);
      return;
    }
    const iterators =
        new Set(rule.choices.map((p) => this.iterateOverProduction(p)));
    while (iterators.size > 0) {
      for (const iter of iterators) {
        const {done, value} = iter.next();
        if (done) {
          iterators.delete(iter);
        } else {
          yield value;
        }
      }
    }
  }

  private *
      iterateOverProduction(production: Production):
          IterableIterator<string[]> {
    switch (production.kind) {
      case 'literal':
        yield [production.value];
        return;
      case 'rule':
        yield* this.iterateOverRule(this.rulesByName.get(production.name)!);
        return;
      case 'sequence':
        yield* this.concatenateSequence(production.productions);
        return;
      default:
        const never: never = production;
        throw new Error(`Unknown production kind: ${util.inspect(never)}`);
    }
  }

  private *
      concatenateSequence(sequence: Production[]): IterableIterator<string[]> {
    if (sequence.length === 0) {
      yield [];
      return;
    } else if (sequence.length === 1) {
      yield* this.iterateOverProduction(sequence[0]);
    } else {
      for (const [prefix, suffix] of everyCombination(
               this.iterateOverProduction(sequence[0]),
               this.concatenateSequence(sequence.slice(1)))) {
        yield prefix.concat(suffix);
      }
    }
  }

  toString() {
    return `Language "${this.name}":\n${
        this.rules.map((rule) => `  ${rule.toString()}`).join('\n')}`;
  }
}

// function* enumerated<T>(iter: Iterable<T>): Iterable<[number, T]> {
//   let i = 0;
//   for (const val of iter) {
//     yield [i++, val];
//   }
// }

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

export class Rule {
  constructor(
      readonly name: string, readonly choices: ReadonlyArray<Production>) {}

  toString() {
    return `${this.name} -> ${
        this.choices.map((p) => stringifyProduction(p)).join(' | ')}`;
  }
}

function stringifyProduction(production: Production): string {
  switch (production.kind) {
    case 'literal':
      return `"${production.value.replace(/"/g, '\\"')}"`;
    case 'rule':
      return production.name;
    case 'sequence':
      if (production.productions.length === 0) {
        return 'ℇ';
      }
      return production.productions.map((p) => stringifyProduction(p))
          .join(' ');
    default:
      const never: never = production;
      throw new Error(`Unknown production kind: ${util.inspect(never)}`);
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
