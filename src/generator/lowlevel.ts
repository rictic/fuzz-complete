import {Language, Production, Rule} from '../parser/ast.js';
import {take} from '../util.js';
import {everyCombination, everyLabelling} from './util.js';

type IntermediateIterationResult = string|{label: string};
interface LowLevelProduction {
  generate(expandLabels: boolean):
      IterableIterator<IntermediateIterationResult[]>;
}
class Literal implements LowLevelProduction {
  constructor(private readonly text: string) {}

  * generate() {
    yield [this.text];
  }
}

class Sequence implements LowLevelProduction {
  constructor(private readonly sequence: LowLevelProduction[]) {}

  *
      generate(expandLabels: boolean):
          IterableIterator<IntermediateIterationResult[]> {
    yield* this.concatenateSequence(this.sequence, expandLabels);
  }

  private *
      concatenateSequence(
          sequence: LowLevelProduction[], expandLabels: boolean):
          IterableIterator<IntermediateIterationResult[]> {
    if (sequence.length === 0) {
      yield [];
      return;
    } else if (sequence.length === 1) {
      yield* sequence[0].generate(expandLabels);
    } else {
      for (const [prefix, suffix] of everyCombination(
               sequence[0].generate(expandLabels),
               this.concatenateSequence(sequence.slice(1), expandLabels))) {
        yield prefix.concat(suffix);
      }
    }
  }
}

class Choice implements LowLevelProduction {
  private choices: LowLevelProduction[] = [];

  // delayed initialization is necessary
  initialize(choices: LowLevelProduction[]) {
    this.choices = choices;
  }

  *
      generate(expandLabels: boolean):
          IterableIterator<IntermediateIterationResult[]> {
    if (this.choices.length === 1) {
      // Optimize the simple case where there is no choice.
      yield* this.choices[0].generate(expandLabels);
      return;
    }
    const iterators =
        new Set(this.choices.map((p) => p.generate(expandLabels)));
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
}

class LabeledProduction implements LowLevelProduction {
  constructor(
      private readonly label: string,
      private readonly production: LowLevelProduction) {}

  *
      generate(expandLabels: boolean):
          IterableIterator<IntermediateIterationResult[]> {
    if (expandLabels) {
      yield* this.production.generate(true);
    } else {
      yield [{label: this.label}];
    }
  }
}

export class Generator {
  private containsLabels = false;
  private readonly root: LowLevelProduction;
  private readonly ruleMap = new Map<string, LowLevelProduction>();
  constructor(private readonly language: Language) {
    for (const rule of language.rules) {
      if (rule.labeled) {
        this.containsLabels = true;
      }
    }
    if (language.rules.length === 0) {
      this.root = new Choice();
    } else {
      this.root = this.convertRule(language.rules[0]);
    }
  }

  * [Symbol.iterator](): IterableIterator<string> {
    if (!this.containsLabels) {
      // optimizate for the simple case
      for (const result of this.root.generate(true)) {
        yield result.join('');
      }
      return;
    }

    for (const resultWithLabelBlanks of this.root.generate(false)) {
      yield* this.expandLabels(resultWithLabelBlanks);
    }
  }

  private *
      expandLabels(results: IntermediateIterationResult[]):
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
      const choices = take(this.ruleMap.get(ruleName)!.generate(true), count);
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

  private convertRule(rule: Rule) {
    let converted = this.ruleMap.get(rule.name);
    if (!converted) {
      const choice = new Choice();
      if (rule.labeled) {
        converted = new LabeledProduction(rule.name, choice);
      } else {
        converted = choice;
      }
      this.ruleMap.set(rule.name, converted);
      choice.initialize(rule.choices.map((c) => this.convertProduction(c)));
    }
    return converted;
  }


  private convertProduction(production: Production): LowLevelProduction {
    switch (production.kind) {
      case 'literal':
        return new Literal(production.value);
      case 'sequence':
        return new Sequence(
            production.productions.map((p) => this.convertProduction(p)));
      case 'rule':
        return this.convertRule(
            this.language.rules.find((r) => r.name === production.name)!);
    }
  }
}
