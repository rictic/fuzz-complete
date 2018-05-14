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

/**
 * An enumeration of Token types.
 */
export enum TokenType {
  none,
  whitespace,
  string,
  comment,
  word,
  semicolon,
  colon,
  equals,
  verticalBar,
  exclamationPoint,
  star,
  plus,
  questionMark,

  // Perhaps for future use.
  openParenthesis = (2 ** 6),
  closeParenthesis = (2 ** 7),
}

export const TokenTypeDescription: ReadonlyMap<TokenType, string> =
    new Map<TokenType, string>([
      [TokenType.none, 'an empty file'],
      [TokenType.whitespace, 'whitespace'],
      [TokenType.string, 'a string literal'],
      [TokenType.comment, 'a comment'],
      [TokenType.word, 'an identifier'],
      [TokenType.semicolon, 'a semicolon'],
      [TokenType.colon, 'a colon'],
      [TokenType.equals, 'an equals sign'],
      [TokenType.verticalBar, 'a vertical bar'],
      [TokenType.exclamationPoint, 'an exclamation point'],
      [TokenType.star, 'a star character'],
      [TokenType.plus, 'a plus character'],
      [TokenType.questionMark, 'a question mark'],
      [TokenType.openParenthesis, 'an open parenthesis'],
      [TokenType.closeParenthesis, 'a close parenthesis'],
    ]);

/**
 * Class that describes individual tokens as produced by the Tokenizer.
 */
export class Token {
  static type = TokenType;

  readonly type: TokenType;
  readonly start: number;
  readonly end: number;
  previous: Token|null;
  next: Token|null;

  /**
   * Create a Token instance.
   * @param type The lexical type of the Token.
   * @param start The start index of the text corresponding to the
   *   Token in the text.
   * @param end The end index of the text corresponding to the Token
   *    in the text.
   */
  constructor(type: TokenType, start: number, end: number) {
    this.type = type;
    this.start = start;
    this.end = end;
    this.previous = null;
    this.next = null;
  }

  /**
   * Test if the Token matches a given type.
   */
  is(type: TokenType) {
    return this.type === type;
  }
}

/**
 * A mapping of boundary token text to their corresponding types.
 */
export const boundaryTokenTypes: {[boundaryText: string]: TokenType|
                                  undefined} = {
  '(': Token.type.openParenthesis,
  ')': Token.type.closeParenthesis,
  ':': Token.type.colon,
  ';': Token.type.semicolon,
  '=': Token.type.equals,
  '|': Token.type.verticalBar,
  '!': Token.type.exclamationPoint,
  '*': Token.type.star,
  '+': Token.type.plus,
  '?': Token.type.questionMark,
};
