'use strict';

const fs = require('fs');
const path = require('path');

const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const generate = require('babel-generator').default;
const template = require('babel-template');
const t = require('babel-types');

const [entry] = process.argv.slice(2);

const entryAbsolutePath = require.resolve(entry);

const filesToProcess = [entryAbsolutePath];
const moduleAsts = {};

while(filesToProcess.length > 0) {
  const fileAbsolutePath = filesToProcess.pop();
  const code = fs.readFileSync(fileAbsolutePath, 'utf8');
  const ast = babylon.parse(code);

  traverse(ast, {
    CallExpression({ node }) {
      if(node.callee.name !== 'require') {
        return;
      }

      const dependencyRelativePath = node.arguments[0].value;
      const dependencyResolutionPath = path.join(
        path.dirname(fileAbsolutePath),
        dependencyRelativePath
      );
      const dependencyAbsolutePath = require.resolve(dependencyResolutionPath);

      const moduleId = dependencyAbsolutePath;

      node.arguments[0] = t.stringLiteral(moduleId);

      if(!moduleAsts[moduleId]) {
        filesToProcess.push(dependencyAbsolutePath);
      }
    }
  });

  const moduleId = fileAbsolutePath;

  moduleAsts[moduleId] = ast;
}

const buildModuleRegistration = template(`
  modules[MODULE_ID] = function(require, exports, module) {
    MODULE_CONTENTS
  };
`);

const moduleRegistrationAsts = Object.entries(moduleAsts).map(([id, ast]) => {
  return buildModuleRegistration({
    MODULE_ID: t.stringLiteral(id),
    MODULE_CONTENTS: ast
  });
});

const buildBundle = template(`
  void (function() {
    var modules = {};
    MODULE_REGISTRATIONS

    var loadedModules = {};
    var weepackRequire = function(moduleId) {
      if(!loadedModules[moduleId]) {
        var module = { exports: {} };
        modules[moduleId](weepackRequire, module.exports, module);
        loadedModules[moduleId] = module.exports;
      }
      return loadedModules[moduleId];
    };

    weepackRequire(ENTRY_MODULE_ID);
  })();
`);

const bundleAst = buildBundle({
  MODULE_REGISTRATIONS: moduleRegistrationAsts,
  ENTRY_MODULE_ID: t.stringLiteral(entryAbsolutePath)
});

const bundleCode = generate(bundleAst).code;

console.log(bundleCode);
