## fuzz-complete

A deterministic data generator for [fuzz testing](https://en.wikipedia.org/wiki/Fuzzing) that will lazily generate every program in a language in roughly increasing order of complexity.

### A demo is worth a thousand words.


* **https://fuzz.rictic.com/**


### Overview

Define a language in [Backus–Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form)

```
Language "simple arithmetic":
  expression = number |
              '(' unaryOp expression ')' |
              '(' expression ' ' binaryOp ' ' expression ')';
  unaryOp = '-';
  binaryOp = '+' | '-' | '*' | '/' | '**' | '<<' | '>>' | '|' | '&';
  number = digit+ | digit+ '.' digit+;
  digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
```
[Demo on the playground](https://fuzz.rictic.com/?input=Language+%22simple+arithmetic%22%3A%0A++expression+%3D+number+%7C%0A++++++++++++++%27%28%27+unaryOp+expression+%27%29%27+%7C%0A++++++++++++++%27%28%27+expression+%27+%27+binaryOp+%27+%27+expression+%27%29%27%3B%0A++unaryOp+%3D+%27-%27%3B%0A++binaryOp+%3D+%27%2B%27+%7C+%27-%27+%7C+%27*%27+%7C+%27%2F%27+%7C+%27**%27+%7C+%27%3C%3C%27+%7C+%27%3E%3E%27+%7C+%27%7C%27+%7C+%27%26%27%3B%0A++number+%3D+digit%2B+%7C+digit%2B+%27.%27+digit%2B%3B%0A++digit+%3D+%270%27+%7C+%271%27+%7C+%272%27+%7C+%273%27+%7C+%274%27+%7C+%275%27+%7C+%276%27+%7C+%277%27+%7C+%278%27+%7C+%279%27%3B)

fuzz-complete will produce every sentence in that language, in roughly increasing complexity. More formally, for every finite N there is a finite K such that every sentence in the language of length ≤N is in fuzz-complete's output at an index less than K.

### Usage

```bash
  npm install -g fuzz-complete
  fuzz-complete ./examples/hello-world.fuzzlang
```

### API

**hello-fuzz.js**
```javascript
import {parse} from 'fuzz-complete'
const language = parse(`Language "foo*": foo = 'foo'*;`);
for (const sentence of language) {
  console.log(sentence);
}
```

```bash
  npm install esm fuzz-complete
  node -r esm hello-fuzz.js | less
```

### Iteration order

The iteration strategy is an unusual one. The tree of possible outputs is infinite in both depth and bredth, so doing either a depth first or a bredth first walk would quickly end up getting stuck in an uninteresting loop of output. For example, emitting string literal before emitting a single numeric literal, or only emitting program with exactly one statement.

fuzz-complete interleaves exploration by depth and breadth to produce a complete walk of the tree while avoiding getting stuck in repetitive loops.

### Backus–Naur form

There's no standard to Backus–Naur. In fuzz-complete's dialect, the first rule is the starting point. Whitespace is not significant, rules are terminated by semicolon.

#### Labeled rules

Compare the output of these two examples:

* [Without labelling](https://fuzz.rictic.com/?input=Language+%22add+two+variables%22%3A%0A++++file+%3D+%27var+%27+identifier+%27+%3D+%27+identifier+%27+%2B+%27+identifier%3B%0A++++identifier+%3D+%28%27a%27+%7C+%27b%27+%7C+%27c%27+%7C+%27d%27+%7C+%27e%27+%7C+%27f%27+%7C+%27g%27%29%2B%3B)
* [With labelling](https://fuzz.rictic.com/?input=Language+%22add+two+variables%22%3A%0A++++file+%3D+%27var+%27+identifier+%27+%3D+%27+identifier+%27+%2B+%27+identifier%3B%0A++++identifier%21+%3D+%28%27a%27+%7C+%27b%27+%7C+%27c%27+%7C+%27d%27+%7C+%27e%27+%7C+%27f%27+%7C+%27g%27%29%2B%3B)

When generating variable names for programs, it's often the case that all you want to test is the _labeling_ of those variables, while ignoring what the labels are. For example: `var a = b + c;` is analogous to `var x = y + z;`, but distinct from `var a = b + b;`.

If a rule is declared with an exclamation point after its name like so:

```
  identifier! = letters+;
```

Then when expanding that rule, fuzz-complete will consider that rule to be a label, and it will not generate sentences with that are structurally the same but with different labels.

### Operators

For any expression, you can use the following operators:

  * `+` – expands the expression one or more times
  * `*` – expands the expression zero or more times
  * `?` – expands to the expression or to the empty string

These operators are often useful with parentheses. For example, `("foo" | "bar")+` will produce `foo, bar, foobar, barfoo, foofoobar...`, and `"[" (number (", " number)*)? "]"` will produce `[], [0], [1], [0, 1], [1, 0], [2]...`.
