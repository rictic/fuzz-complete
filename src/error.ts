import {Token} from './parser/token.js';
import {Tokenizer} from './parser/tokenizer.js';

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
