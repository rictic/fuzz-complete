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
      const self = this;
      const iterableIterables = new BufferedIterable((function*() {
        for (const prefix of self.iterateOverProduction(sequence[0])) {
          yield(function*() {
            for (const suffix of self.concatenateSequence(sequence.slice(1))) {
              yield prefix.concat(suffix);
            }
          })();
        }
      })());
      while (true) {
        let yielded = false;
        for (const iterable of iterableIterables) {
          const {done, value} = iterable.next();
          if (!done) {
            yielded = true;
            yield value;
          }
        }
        if (!yielded) {
          return;
        }
      }
    }
  }

  toString() {
    return `Language "${this.name}":\n${
        this.rules.map((rule) => `  ${rule.toString()}`).join('\n')}`;
  }
}

export class Rule {
  constructor(
      readonly name: string, readonly choices: ReadonlyArray<Production>) {}

  toString() {
    return `${this.name} -> ${
        this.choices.map((p) => this.stringifyProduction(p)).join(' | ')}`;
  }

  private stringifyProduction(production: Production): string {
    switch (production.kind) {
      case 'literal':
        return `"${production.value.replace(/"/g, '\\"')}"`;
      case 'rule':
        return production.name;
      case 'sequence':
        if (production.productions.length === 0) {
          return 'ℇ';
        }
        return production.productions.map((p) => this.stringifyProduction(p))
            .join(' ');
      default:
        const never: never = production;
        throw new Error(`Unknown production kind: ${util.inspect(never)}`);
    }
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
}
