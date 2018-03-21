# weepack

Weepack is a wee module bundler that's intended to demonstrate how Webpack 
works. It should be used purely as an informational resource and is not
intended to be used as an actual module bundler. Definitely don't use it in a
production environment.

Weepack is still in progress! I'm looking to improve the explanatory comments,
and make small changes to the code so that it better reflects an actual module
bundler.

### [View the annotated source code.](./index.js)
- Heavily commented with explanations for every line of code

### [View the unannotated source code.](./source.js)
- All comments stripped out so you can see exactly how short a functional
  module bundler can be

### [View an example output bundle.](./examples/bundle.js)
- Intentionally generated in a readable format

The format of weepack is largely based off that of
[The Super Tiny Compiler](https://github.com/jamiebuilds/the-super-tiny-compiler).
In fact, I suggest you go through that repository before reading through 
weepack, since knowledge of compilers will help you understand how module
bundlers work.

## Usage

```
node index.js <entry_file> [<output_file>]
```

For example:

```
node index.js ./modules/entry.js bundle.js
```
