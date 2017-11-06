'use strict';

const fs = require('fs');
const path = require('path');

const babylon = require('babylon');
const generate = require('babel-generator').default;

/*
 * Write source code from index.js to source.js, excluding comments
 */
const annotatedSource = fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf8');
const ast = babylon.parse(annotatedSource);
const { code } = generate(ast, { comments: false });
fs.writeFileSync(path.resolve(__dirname, '../source.js'), code);
