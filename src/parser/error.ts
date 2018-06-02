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

import {Token} from './token.js';
import {Tokenizer} from './tokenizer.js';

export class LocatedError extends Error {
  readonly originalMessage: string;
  constructor(message: string, readonly start: number, readonly end: number) {
    super(`[offset ${start}] ${message}`);
    this.originalMessage = message;
  }
  static atCurrentLocation(message: string, tokenizer: Tokenizer) {
    return new LocatedError(message, tokenizer.offset, tokenizer.offset);
  }
  static atToken(message: string, token: Token) {
    return new LocatedError(message, token.start, token.end);
  }
}

export class ParseError extends LocatedError {}

export class ValidationError extends LocatedError {}
