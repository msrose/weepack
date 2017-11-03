'use strict';

const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const generate = require('babel-generator').default;
const util = require('util');
const fs = require('fs');
const path = require('path');
const readFile = util.promisify(fs.readFile);
const template = require('babel-template');
const t = require('babel-types');

const entry = require.resolve(process.argv.slice(2)[0]);

const filesToProcess = [entry];

const modules = {};

(async() => {
  while(filesToProcess.length > 0) {
    const file = filesToProcess.pop();
    const code = await readFile(file, 'utf8');
    const ast = babylon.parse(code);
    traverse(ast, {
      CallExpression({ node }) {
        if(node.callee.name === 'require') {
          const dependencyFile = require.resolve(
            path.join(
              path.dirname(file),
              node.arguments[0].value
            )
          );
          node.arguments[0].value = dependencyFile;
          if(!modules[dependencyFile]) {
            filesToProcess.push(dependencyFile);
          }
        }
      }
    });
    modules[file] = ast;
  }

  const buildModule = template(`
    modules[MODULE_ID] = function(require, exports, module) {
      MODULE_CONTENTS
    };
  `);

  const moduleAsts = [];

  for(const moduleId in modules) {
    const ast = buildModule({
      MODULE_ID: t.stringLiteral(moduleId),
      MODULE_CONTENTS: modules[moduleId]
    });
    moduleAsts.push(ast);
  }

  const buildBundle = template(`
    var bundle = (function() {
      var modules = {};
      MODULES
      var loadedModules = {};
      var weepackRequire = function(moduleId) {
        if(!loadedModules[moduleId]) {
          var module = { exports: {} };
          modules[moduleId](weepackRequire, module.exports, module);
          loadedModules[moduleId] = module.exports;
        }
        return loadedModules[moduleId];
      };
      weepackRequire(ENTRY);
    })();
  `);

  console.log(generate(buildBundle({ MODULES: moduleAsts, ENTRY: t.stringLiteral(entry) })).code);
})();
