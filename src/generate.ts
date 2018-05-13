import {LocatedError} from './error.js';
import {take} from './util.js';

export type Production = {
  kind: 'literal',
  value: string,
}|{
  kind: 'rule',
  name: string,
  offsetStart: number,
  offsetEnd: number,
}|{
  kind: 'sequence',
  productions: Production[],
};

export class Language {
  private readonly rulesByName: ReadonlyMap<string, Rule>;
  constructor(readonly name: string, readonly rules: ReadonlyArray<Rule>) {
    this.validate();
    const rulesByName = new Map<string, Rule>();
    for (const rule of rules) {
      rulesByName.set(rule.name, rule);
    }
    this.rulesByName = rulesByName;
  }

  private validate() {
    const ruleNames = new Set<string>();
    for (const rule of this.rules) {
      if (ruleNames.has(rule.name)) {
        throw new LocatedError(`Duplicate rule`, rule.nameStart, rule.nameEnd);
      }
      ruleNames.add(rule.name);
    }
    for (const rule of this.rules) {
      for (const production of rule.choices) {
        this.validateProduction(production, ruleNames);
      }
    }
    // TODO: validate that a label rule does not depend on a label rule
  }

  private validateProduction(
      production: Production, ruleNames: ReadonlySet<string>) {
    switch (production.kind) {
      case 'literal':
        return;
      case 'sequence':
        for (const innerProduction of production.productions) {
          this.validateProduction(innerProduction, ruleNames);
        }
        return;
      case 'rule':
        if (!ruleNames.has(production.name)) {
          throw new LocatedError(
              `Rule not declared`, production.offsetStart,
              production.offsetEnd);
        }
        return;
      default:
        const never: never = production;
        throw new Error(`Unknown kind of production: ${JSON.stringify(never)}`);
    }
  }

  * [Symbol.iterator](): IterableIterator<string> {
    if (this.rules.length === 0) {
      return;
    }
    for (const resultArr of this.iterateOverRule(this.rules[0])) {
      yield* this.stringifyIntermediateResults(resultArr);
    }
  }

  private *
      stringifyIntermediateResults(results: IntermediateIterationResult[]):
          IterableIterator<string> {
    const labelsToCounts = new Map<string, number>();
    for (const result of results) {
      if (typeof result !== 'string') {
        labelsToCounts.set(
            result.label, (labelsToCounts.get(result.label) || 0) + 1);
      }
    }
    if (labelsToCounts.size === 0) {
      // Optimize for the simple case.
      yield results.join('');
      return;
    }
    const labellingsByRuleName = new Map<string, string[][]>();
    for (const [ruleName, count] of labelsToCounts) {
      const choices = take(
          this.iterateOverUnlabeledRule(this.rulesByName.get(ruleName)!),
          count);
      labellingsByRuleName.set(
          ruleName,
          [...everyLabelling([...choices].map((c) => c.join()), count)]);
    }
    if (labellingsByRuleName.size !== 1) {
      throw new Error('We don\'t handle multiple different labels yet.');
    }
    const [[rule, labellings]] = labellingsByRuleName;
    for (const labelling of labellings) {
      yield results
          .map((v) => {
            if (typeof v === 'string') {
              return v;
            }
            if (v.label !== rule) {
              throw new Error('Impossible!!');
            }
            return labelling.shift()!;
          })
          .join('');
    }
  }

  private *
      iterateOverLabeledRule(rule: Rule):
          IterableIterator<IntermediateIterationResult[]> {
    yield [{label: rule.name}];
  }

  private *
      iterateOverUnlabeledRule(rule: Rule):
          IterableIterator<IntermediateIterationResult[]> {
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
      iterateOverRule(rule: Rule):
          IterableIterator<IntermediateIterationResult[]> {
    if (rule.labeled) {
      yield* this.iterateOverLabeledRule(rule);
    } else {
      yield* this.iterateOverUnlabeledRule(rule);
    }
  }

  private *
      iterateOverProduction(production: Production):
          IterableIterator<IntermediateIterationResult[]> {
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
        throw new Error(`Unknown production kind: ${JSON.stringify(never)}`);
    }
  }

  private *
      concatenateSequence(sequence: Production[]):
          IterableIterator<IntermediateIterationResult[]> {
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

type IntermediateIterationResult = string|{label: string};

export class Rule {
  constructor(
      readonly name: string, readonly choices: ReadonlyArray<Production>,
      readonly labeled: boolean, readonly nameStart: number,
      readonly nameEnd: number) {}

  toString() {
    return `${this.name}${this.labeled ? '!' : ''} = ${
        this.choices.map((p) => stringifyProduction(p)).join(' | ')};`;
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
      throw new Error(`Unknown production kind: ${JSON.stringify(never)}`);
  }
}

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
