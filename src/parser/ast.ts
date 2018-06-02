/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {Generator} from '../generator/lowlevel.js';

import {ValidationError} from './error.js';
import {Result} from './parser.js';

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

class ErrorCollection extends Error {
  constructor(readonly errors: ValidationError[]) {
    super();
  }
}

export class Language {
  readonly rulesByName: ReadonlyMap<string, Rule>;
  private constructor(
      readonly name: string, readonly rules: ReadonlyArray<Rule>) {
    const rulesByName = new Map<string, Rule>();
    for (const rule of rules) {
      rulesByName.set(rule.name, rule);
    }
    this.rulesByName = rulesByName;
    const errors = this.validate();
    if (errors !== undefined) {
      throw new ErrorCollection(errors);
    }
  }

  static tryToConstruct(name: string, rules: ReadonlyArray<Rule>):
      Result<Language, ValidationError[]> {
    try {
      const language = new Language(name, rules);
      return {successful: true, value: language};
    } catch (e) {
      if (e instanceof ErrorCollection) {
        return {successful: false, error: e.errors};
      }
      throw e;
    }
  }

  private validate(): undefined|ValidationError[] {
    const errors = [];
    const ruleNames = new Set<string>();
    for (const rule of this.rules) {
      if (ruleNames.has(rule.name)) {
        errors.push(new ValidationError(
            `Duplicate rule`, rule.nameStart, rule.nameEnd));
      }
      ruleNames.add(rule.name);
    }
    for (const rule of this.rules) {
      errors.push(...this.validateRuleReferences(rule.production, ruleNames));
    }
    if (errors.length === 0) {
      for (const rule of this.rules) {
        errors.push(...this.validateRuleTerminates(rule));
      }
    }
    if (errors.length > 0) {
      return errors;
    }
    return undefined;
  }

  private *
      validateRuleReferences(
          production: Production, ruleNames: ReadonlySet<string>):
          IterableIterator<ValidationError> {
    switch (production.kind) {
      case 'literal':
        return;
      case 'sequence':
        for (const innerProduction of production.productions) {
          yield* this.validateRuleReferences(innerProduction, ruleNames);
        }
        return;
      case 'rule':
        if (!ruleNames.has(production.name)) {
          yield new ValidationError(
              `Rule not declared`, production.offsetStart,
              production.offsetEnd);
        }
        return;
      case 'unaryOperator':
        yield* this.validateRuleReferences(production.production, ruleNames);
        return;
      case 'choice':
        for (const choice of production.choices) {
          yield* this.validateRuleReferences(choice, ruleNames);
        }
        return;
      default:
        const never: never = production;
        throw new Error(`Unknown kind of production: ${JSON.stringify(never)}`);
    }
  }

  private *
      validateRuleTerminates(rule: Rule, visited = new Set<Rule>()):
          IterableIterator<ValidationError> {
    if (visited.has(rule)) {
      yield new ValidationError(
          `Infinite loop detected in leftmost choice`, rule.nameStart,
          rule.nameEnd);
      return;
    }
    visited.add(rule);
    yield* this.validateProductionTerminates(rule.production, visited);
    visited.delete(rule);
  }

  private *
      validateProductionTerminates(production: Production, visited: Set<Rule>):
          IterableIterator<ValidationError> {
    switch (production.kind) {
      case 'literal':
        return;  // no loop here!
      case 'unaryOperator':
        switch (production.operator) {
          case '*':
          case '?':
            return;  // These evaluate first to empty string, so it's k.
          case '+':
            yield*
                this.validateProductionTerminates(
                    production.production, visited);
            return;
          default:
            const never: never = production.operator;
            throw new Error(`Unknown unary operator: ${never}`);
        }
      case 'rule':
        yield*
            this.validateRuleTerminates(
                this.rulesByName.get(production.name)!, visited);
        return;
      case 'choice':
        if (production.choices.length === 0) {
          return;
        }
        yield*
            this.validateProductionTerminates(production.choices[0], visited);
        return;
      case 'sequence':
        for (const child of production.productions) {
          yield* this.validateProductionTerminates(child, visited);
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
      const text = production.value.replace(/\\/g, '\\\\')
                       .replace(/"/g, '\\"')
                       .replace(/\n/g, '\\n')
                       .replace(/\t/g, '\\t');
      return `"${text}"`;
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
