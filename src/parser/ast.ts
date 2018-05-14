import {Generator} from '../generator/lowlevel.js';

import {ValidationError} from './error.js';

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
}|{kind: 'unaryOperator', operator: '*' | '?' | '+', production: Production}|
    {kind: 'choice', choices: Production[]};


export class Language {
  constructor(readonly name: string, readonly rules: ReadonlyArray<Rule>) {
    this.validate();
  }

  private validate() {
    const ruleNames = new Set<string>();
    for (const rule of this.rules) {
      if (ruleNames.has(rule.name)) {
        throw new ValidationError(
            `Duplicate rule`, rule.nameStart, rule.nameEnd);
      }
      ruleNames.add(rule.name);
    }
    for (const rule of this.rules) {
      this.validateProduction(rule.production, ruleNames);
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
          throw new ValidationError(
              `Rule not declared`, production.offsetStart,
              production.offsetEnd);
        }
        return;
      case 'unaryOperator':
        this.validateProduction(production.production, ruleNames);
        return;
      case 'choice':
        for (const choice of production.choices) {
          this.validateProduction(choice, ruleNames);
        }
        return;
      default:
        const never: never = production;
        throw new Error(`Unknown kind of production: ${JSON.stringify(never)}`);
    }
  }

  * [Symbol.iterator](): IterableIterator<string> {
    yield* new Generator(this);
  }

  toString() {
    return `Language "${this.name}":\n${
        this.rules.map((rule) => `  ${rule.toString()}`).join('\n')}`;
  }
}

export class Rule {
  constructor(
      readonly name: string, readonly production: Production,
      readonly labeled: boolean, readonly nameStart: number,
      readonly nameEnd: number) {}

  toString() {
    return `${this.name}${this.labeled ? '!' : ''} = ${
        stringifyProduction(this.production)};`;
  }
}

function stringifyProduction(
    production: Production, parenthesize = false): string {
  switch (production.kind) {
    case 'literal':
      return `"${production.value.replace(/"/g, '\\"')}"`;
    case 'rule':
      return production.name;
    case 'sequence': {
      if (production.productions.length === 0) {
        return 'ℇ';
      }
      return production.productions
          .map((p) => {
            return stringifyProduction(p, production.productions.length > 1);
          })
          .join(' ');
    }
    case 'unaryOperator': {
      let result = `${stringifyProduction(production.production, true)}${
          production.operator}`;
      if (production.production.kind === 'sequence' &&
          production.production.productions.length > 1) {
        result = `(${result})`;
      }
      return result;
    }
    case 'choice': {
      let result = production.choices.map((p) => stringifyProduction(p, true))
                       .join(' | ');
      if (parenthesize) {
        result = `(${result})`;
      }
      return result;
    }
    default:
      const never: never = production;
      throw new Error(`Unknown production kind: ${JSON.stringify(never)}`);
  }
}
