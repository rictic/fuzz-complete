import {Language, Production, Rule} from './ast.js';
import {LocatedError, ParseError} from './error.js';
import {Token, TokenType} from './token.js';
import {Tokenizer} from './tokenizer.js';

type Result<S, F> = {
  successful: true,
  value: S
}|{successful: false, error: F};



class ParserContext {
  private readonly tokenizer: Tokenizer;
  public readonly result: Result<Language, LocatedError>;
  constructor(text: string) {
    this.tokenizer = new Tokenizer(text);
    try {
      this.result = {successful: true, value: this.parse()};
    } catch (e) {
      this.result = {successful: false, error: e};
    }
  }

  parse() {
    return new Language(this.parseLanguageName(), this.parseRules());
  }

  parseLanguageName() {
    this.skipWhitespace();
    this.consumeWordWithValue('Language');
    const stringText = this.consumeQuotedString();
    this.consume(Token.type.colon, 'colon');
    return stringText;
  }

  parseRules(): Rule[] {
    const rules: Rule[] = [];
    this.skipWhitespace();
    while (this.tokenizer.currentToken) {
      const nameToken = this.consume(Token.type.word, 'rule name');
      let isLabelRule = false;
      if (this.tokenizer.currentToken &&
          this.tokenizer.currentToken.is(Token.type.exclamationPoint)) {
        isLabelRule = true;
        this.tokenizer.advance();
      }
      this.skipWhitespace();
      this.consume(Token.type.equals, 'equals');
      rules.push(new Rule(
          this.tokenizer.slice(nameToken), this.parseProduction(), isLabelRule,
          nameToken.start, nameToken.end));
      this.skipWhitespace();
    }
    return rules;
  }

  parseProduction(depth = 0): Production {
    const choices: Production[] = [];
    let currentChoice: Production[] = [];
    parseChoicesLoop: while (true) {
      this.skipWhitespace();
      const nextToken = this.tokenizer.currentToken;
      if (!nextToken) {
        throw ParseError.atCurrentLocation(
            'Unexpected end of input, missing semicolon?', this.tokenizer);
      }
      function getProduction(choice: Production[]): Production {
        if (choice.length === 1) {
          return choice[0];
        }
        return {kind: 'sequence', productions: choice};
      }
      switch (nextToken.type) {
        case Token.type.star:
        case Token.type.plus:
        case Token.type.questionMark:
          this.tokenizer.advance();
          const latestProduction = currentChoice.pop();
          if (latestProduction === undefined) {
            throw ParseError.atToken(
                `Unary operator must come after a production`, nextToken);
          }
          currentChoice.push({
            kind: 'unaryOperator',
            operator: this.tokenizer.slice(nextToken) as ('*' | '+' | '?'),
            production: latestProduction
          });
          break;
        case Token.type.string:
          const value = this.consumeQuotedString();
          currentChoice.push({kind: 'literal', value});
          break;
        case Token.type.word:
          this.tokenizer.advance();
          const text = this.tokenizer.slice(nextToken);
          if (text === 'ℇ') {
            break;
          }
          currentChoice.push({
            kind: 'rule',
            name: text,
            offsetStart: nextToken.start,
            offsetEnd: nextToken.end
          });
          break;
        case Token.type.verticalBar:
          this.tokenizer.advance();
          choices.push(getProduction(currentChoice));
          currentChoice = [];
          break;
        case Token.type.semicolon:
          if (depth !== 0) {
            throw ParseError.atToken(`Unclosed parentheses`, nextToken);
          }
          this.tokenizer.advance();
          choices.push(getProduction(currentChoice));

          break parseChoicesLoop;
        case Token.type.openParenthesis:
          this.tokenizer.advance();
          currentChoice.push(this.parseProduction(depth + 1));

          break;
        case Token.type.closeParenthesis:
          if (depth <= 0) {
            throw ParseError.atToken(
                `Too many closing parentheses.`, nextToken);
          }
          this.tokenizer.advance();
          choices.push(getProduction(currentChoice));

          break parseChoicesLoop;
        default:
          throw ParseError.atToken(
              `Unexpected token inside of rule definition`, nextToken);
      }
    }
    return {kind: 'choice', choices};
  }

  consumeWordWithValue(expectedValue?: string) {
    const token = this.consume(Token.type.word, `word \`${expectedValue}\``);
    if (this.tokenizer.slice(token) !== expectedValue) {
      throw ParseError.atToken(`Expected word \`${expectedValue}\``, token);
    }
    this.tokenizer.advance();
    return token;
  }

  consumeQuotedString() {
    const token = this.consume(Token.type.string, 'quoted string');
    return this.tokenizer.text.slice(token.start + 1, token.end - 1);
  }

  consume(tokenType: TokenType, kind: string) {
    const token = this.tokenizer.currentToken;
    if (!token) {
      throw ParseError.atCurrentLocation(
          `Unexpected end of input, expected ${kind}`, this.tokenizer);
    }
    if (!token.is(tokenType)) {
      throw ParseError.atToken(`Expected ${kind}`, token);
    }
    this.tokenizer.advance();
    return token;
  }

  skipWhitespace() {
    while (this.tokenizer.currentToken &&
           (this.tokenizer.currentToken.is(Token.type.whitespace) ||
            this.tokenizer.currentToken.is(Token.type.comment))) {
      this.tokenizer.advance();
    }
  }
}

export function parse(text: string): Language {
  const context = new ParserContext(text);
  if (context.result.successful) {
    return context.result.value;
  }
  throw context.result.error;
}

export function tryParse(text: string) {
  return (new ParserContext(text)).result;
}
