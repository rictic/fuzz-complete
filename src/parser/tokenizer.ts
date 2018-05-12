/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {boundaryTokenTypes, Token} from './token';

/**
 * A set of common RegExp matchers for tokenizing.
 */
const matcher = {
  whitespace: /\s/,
  whitespaceGreedy: /(\s+)/g,
  commentGreedy: /(\*\/)/g,
  boundary: /[\(\)\{\}'"@;:=\s\|]/,
  stringBoundary: /['"]/
};


class Tokenizer {
  /**
   * Tracks the position of the tokenizer in the source.
   * Also the default head of the Token linked list.
   */
  private cursorToken_ = new Token(Token.type.none, 0, 0);

  /**
   * Holds a reference to a Token that is "next" in the source string, often
   * due to having been peeked at.
   */
  private currentToken_: null|Token = null;

  /**
   * Create a Tokenizer instance.
   * @param text The raw string to be tokenized.
   *
   */
  constructor(public readonly text: string) {}

  get offset() {
    return this.cursorToken_.end;
  }

  /**
   * The current token that will be returned by a call to `advance`. This
   * reference is useful for "peeking" at the next token ahead in the sequence.
   * If the entire text has been tokenized, the `currentToken` will be null.
   */
  get currentToken(): Token|null {
    if (this.currentToken_ == null) {
      this.currentToken_ = this.getNextToken_();
    }

    return this.currentToken_;
  }

  /**
   * Advance the Tokenizer to the next token in the sequence.
   * @return The current token prior to the call to `advance`, or null
   * if the entire text has been tokenized.
   */
  advance(): Token|null {
    let token;
    if (this.currentToken_ != null) {
      token = this.currentToken_;
      this.currentToken_ = null;
    } else {
      token = this.getNextToken_();
    }
    return token;
  }

  /**
   * Extract a slice from the text, using two tokens to represent the range
   * of text to be extracted. The extracted text will include all text between
   * the start index of the first token and the offset index of the second token
   * (or the offset index of the first token if the second is not provided).
   * @param startToken The token that represents the beginning of the
   * text range to be extracted.
   * @param endToken The token that represents the end of the text range
   * to be extracted. Defaults to the startToken if no endToken is provided.
   * @return The substring of the text corresponding to the
   * startToken and endToken.
   */
  slice(startToken: Token, endToken: Token|undefined|null = undefined): string {
    const {start, end} = this.getRange(startToken, endToken);
    return this.text.substring(start, end);
  }

  /**
   * Like `slice`, but returns the offsets into the source, rather than the
   * substring itself.
   */
  getRange(startToken: Token, endToken: Token|undefined|null = undefined) {
    return {start: startToken.start, end: (endToken || startToken).end};
  }

  /**
   * Flush all tokens from the Tokenizer.
   * @return An array of all tokens corresponding to the text.
   */
  flush() {
    const tokens = [];
    while (this.currentToken) {
      tokens.push(this.advance());
    }
    return tokens;
  }

  /**
   * Extract the next token from the text and advance the Tokenizer.
   * @return A Token instance, or null if the entire text has beeen
   * tokenized.
   */
  private getNextToken_(): Token|null {
    const character = this.text[this.offset];
    let token;

    this.currentToken_ = null;

    if (this.offset >= this.text.length) {
      return null;
    } else if (matcher.whitespace.test(character)) {
      token = this.tokenizeWhitespace(this.offset);
    } else if (matcher.stringBoundary.test(character)) {
      token = this.tokenizeString(this.offset);
    } else if (character === '/' && this.text[this.offset + 1] === '*') {
      token = this.tokenizeComment(this.offset);
    } else if (matcher.boundary.test(character)) {
      token = this.tokenizeBoundary(this.offset);
    } else {
      token = this.tokenizeWord(this.offset);
    }

    token.previous = this.cursorToken_;
    this.cursorToken_.next = token;
    this.cursorToken_ = token;

    return token;
  }

  /**
   * Tokenize a string starting at a given offset in the text. A string is
   * any span of text that is wrapped by eclusively paired, non-escaped matching
   * quotation marks.
   * @param offset An offset in the text.
   * @return A string Token instance.
   */
  tokenizeString(offset: number) {
    const quotation = this.text[offset];
    let escaped = false;
    const start = offset;
    let character;

    while (character = this.text[++offset]) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === quotation) {
        ++offset;
        break;
      }

      if (character === '\\') {
        escaped = true;
      }
    }

    return new Token(Token.type.string, start, offset);
  }

  /**
   * Tokenize a word starting at a given offset in the text. A word is any
   * span of text that is not whitespace, is not a string, is not a comment and
   * is not a structural delimiter (such as braces and semicolon).
   *
   * @param number An offset in the text.
   * @return A word Token instance.
   */
  tokenizeWord(offset: number): Token {
    const start = offset;
    let character;
    // TODO(cdata): change to greedy regex match?
    while ((character = this.text[offset]) &&
           !matcher.boundary.test(character)) {
      offset++;
    }

    return new Token(Token.type.word, start, offset);
  }

  /**
   * Tokenize whitespace starting at a given offset in the text. Whitespace
   * is any span of text made up of consecutive spaces, tabs, newlines and other
   * single whitespace characters.
   * @param number An offset in the text.
   * @return A whitespace Token instance.
   */
  tokenizeWhitespace(offset: number) {
    const start = offset;

    matcher.whitespaceGreedy.lastIndex = offset;
    const match = matcher.whitespaceGreedy.exec(this.text);

    if (match != null && match.index === offset) {
      offset = matcher.whitespaceGreedy.lastIndex;
    }

    return new Token(Token.type.whitespace, start, offset);
  }

  /**
   * Tokenize a comment starting at a given offset in the text. A comment is
   * any span of text beginning with the two characters / and *, and ending with
   * a matching counterpart pair of consecurtive characters (* and /).
   * @param number An offset in the text.
   * @return A comment Token instance.
   */
  tokenizeComment(offset: number) {
    const start = offset;

    matcher.commentGreedy.lastIndex = offset;
    const match = matcher.commentGreedy.exec(this.text);

    if (match == null) {
      offset = this.text.length;
    } else {
      offset = matcher.commentGreedy.lastIndex;
    }

    return new Token(Token.type.comment, start, offset);
  }

  /**
   * Tokenize a boundary at a given offset in the text. A boundary is any
   * single structurally significant character. These characters include braces,
   * semicolons, the "at" symbol and others.
   * @param number An offset in the text.
   * @return A boundary Token instance.
   */
  tokenizeBoundary(offset: number): Token {
    // TODO(cdata): Evaluate if this is faster than a switch statement:
    const type = boundaryTokenTypes[this.text[offset]];
    if (type === undefined) {
      throw new Error(`Unexpected boundary: ${this.text[offset]}`);
    }
    return new Token(type, offset, offset + 1);
  }
}

export {Tokenizer};
