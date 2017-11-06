/*
 * Weepack - A wee module bundler demonstrating how Webpack works
 * By Michael Rose (@msrose)
 * @license MIT (https://github.com/msrose/weepack/blob/master/LICENSE)
 */

'use strict';

/*
 * Introduction
 * TODO:
 * - background knowledge:
 *   - what is module bundling and why do we do it
 *   - webpack
 *   - babel libraries being used and why
 *   - compilers and what an AST is
 * - what weepack is and what to expect from it
 * - what weepack is not
 * - black-boxing webpack
 * - barriers to getting into modern web development
 * - why you should consider listening to me
 */

/*
 * Native modules that we'll be using
 */
const fs = require('fs');
const path = require('path');

/*
 * These babel packages are for reading and manipulating the source code of the
 * modules we'll be bundling. I've chosen babel simply because I'm familiar
 * with the APIs. We could just as easily use acorn, esprima, or any of the
 * other great JavaScript parsers that exist.
 */
const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const generate = require('babel-generator').default;
const template = require('babel-template');
const types = require('babel-types');

/*
 * Read in command line arguments. This file is intended to be executed as:
 * `node index.js <entry_file> <output_file>`.
 *
 * For example: `node index.js ./modules/entry.js bundle.js`.
 *
 * The entry file is the starting point of the application, i.e. the first
 * part of our code that gets executed.
 * The output file is where we'll be writing our final code bundle.
 */
const [entry, outputFile] = process.argv.slice(2);

/*
 * Here, we get the absolute path of the entry point. By using require.resolve,
 * we also assert that the entry point exists, because require.resolve throws
 * and error if the path it's given doesn't resolve to a module.
 */
const entryAbsolutePath = require.resolve(entry);

/*
 * This function accepts the absolute path of a file that's going to be
 * bundled into our output, and returns a unique identifier which we're calling
 * the 'module ID'. Since absolute file paths should be unique, we can just
 * use the absolute path itself for the module identifier.
 *
 * We've broken it out into it's own function so we can easily change what we
 * use for module IDs. For example, webpack uses integer IDs, since they
 * result in fewer bytes in the final bundle. Using the absolute file path
 * is good enough for weepack, and it makes the final bundle more readable.
 */
const getModuleIdForFile = fileAbsolutePath => {
  return fileAbsolutePath;
};

/*
 * We'll be inserting module IDs into code by manipulating abstract syntax
 * trees (ASTs). This helper function takes a module ID and gives us back
 * a valid node for us to put into an AST. For now we're just using the
 * absolute file path as the module ID, so a StringLiteral node is appropriate.
 * However, if we ever change the module IDs to integers, for example, we'll
 * be using a NumericLiteral node instead, so it's useful to have this
 * abstraction to minimize the code change.
 *
 * Here we're using the babel-types library, which is just provides helpful
 * factory functions for creating AST nodes that all babel libraries can
 * understand.
 */
const getAstNodeForModuleId = moduleId => {
  return types.stringLiteral(moduleId);
};

/*
 * This list keeps track of all the files in our dependency graph. We'll walk
 * through each file starting with our entry point, and every time we find a
 * call to `require`, we'll add the absolute path of the file being required
 * to the end of this array, and repeat the process until we've found every
 * call to require and therefore traversed all our dependencies.
 */
const filesToProcess = [entryAbsolutePath];

/*
 * We need to keep track of the ASTs of all the modules we find, since we'll be
 * writing the code of all of those files to our output bundle later on. This
 * object is a map from a module's ID to the AST for that module.
 */
const moduleAsts = {};

/*
 * Let's start processing the files in our dependency graph. When there are no
 * files left in the list, we've got all the code we need to write our final
 * bundle, and we can stop.
 */
while(filesToProcess.length > 0) {

  /*
   * Next, we get the name of the next file to process, read it from disk, and
   * parse the code using babylon, babel's JavaScript parser. Babylon is what
   * creates the AST for us.
   */
  const fileAbsolutePath = filesToProcess.pop();
  const code = fs.readFileSync(fileAbsolutePath, 'utf8');
  const ast = babylon.parse(code);

  /*
   * Now we'll get the module ID for the file we just read, and store the AST
   * for that module in the map we declared earlier.
   */
  const moduleId = getModuleIdForFile(fileAbsolutePath);
  moduleAsts[moduleId] = ast;

  /*
   * It's time to search through the AST we just got and look for any calls
   * to `require` using babel-traverse, a package which lets us recursively
   * walk through the AST. We define a visitor with the key CallExpression
   * since we're looking for any code that looks like:
   * `require('./my-module');`, i.e. a "call expression" to `require`.
   * babel-traverse will call the function we give it whenever it runs into
   * a node with type 'CallExpression'.
   */
  traverse(ast, {
    CallExpression({ node }) {

      /*
       * If the CallExpression we found isn't a call to `require`, then there's
       * nothing to do. For example, we don't care about code like `func();`.
       */
      if(node.callee.name !== 'require') {
        return;
      }

      /*
       * When we do find a call to `require`, we need to find out what file is
       * actually being required so that we can process it as well. We get the
       * string being passed to `require` and determine the absolute path of
       * the file using require.resolve. We have to make sure to use the right
       * resolution path, since files are required relative to the file calling
       * `require`. That's why we're using path.join --- to prepend the
       * directory of the file calling require to the relative path being
       * passed to `require`.
       */
      const dependencyRelativePath = node.arguments[0].value;
      const dependencyResolutionPath = path.join(
        path.dirname(fileAbsolutePath),
        dependencyRelativePath
      );
      const dependencyAbsolutePath = require.resolve(dependencyResolutionPath);

      /*
       * Now that we have the absolute path of the dependenct being required,
       * we can get it's module ID.
       */
      const moduleId = getModuleIdForFile(dependencyAbsolutePath);

      /*
       * In our final bundle, we'll be changing all our calls from
       * `require('./relative/path')` to `require('moduleId')`. Therefore, we
       * want to change the first argument to `require` to be the module ID of
       * the file being required. We can just mutate the AST by calling our
       * other helper function to get the AST node for the module ID of the
       * dependency and assigning it directly to the CallExpression arguments
       * property.
       */
      node.arguments[0] = getAstNodeForModuleId(moduleId);

      /*
       * Finally, if we haven't already processed the dependency file,
       * we add it to the list of files to be processed. We don't want to
       * process any files twice since it's wastefully unecessary, and in the
       * case of circular dependencies, it could lead to an infinite loop.
       */
      if(!moduleAsts[moduleId]) {
        filesToProcess.push(dependencyAbsolutePath);
      }
    }
  });
}

/*
 * Now that we've processed all our files, we have all the information we need
 * to create our final bundle: the module ID and AST for each of our modules.
 *
 * In our final bundle, we're going to be "registering" all of our modules by
 * adding them to an object map called `modules`, where the key is the module
 * ID and the value is a function the represents a module "loader". This
 * function injects the values for `require`, `module`, and `exports` into our
 * module.
 *
 * What this "module registration" process looks like in code is a function
 * being assigned as the value of an object where the key is the module ID.
 * We're using babel-template to help us create this code. The template
 * function returns us a function that will generate an AST when called.
 * The values MODULE_ID and MODULE_CONTENTS are placeholders that we can use
 * to inject AST nodes into our code.
 *
 * We could use the babel-types factory functions to build up this code, but it
 * would be a lot longer, more unreadble, and more error-prone than using
 * babel-template.
 */
const buildModuleRegistration = template(`
  modules[MODULE_ID] = function(require, exports, module) {
    MODULE_CONTENTS
  };
`);

/*
 * Now we'll generate the AST for each of modules by calling the function
 * babel-template gave back to us. Recall that Object.entries gives us a array
 * of key-value pairs for the given object. We pass in the module ID and the
 * module AST using the appropriate keys from our template.
 */
const moduleRegistrationAsts = Object.entries(moduleAsts).map(([id, ast]) => {
  return buildModuleRegistration({
    MODULE_ID: getAstNodeForModuleId(id),
    MODULE_CONTENTS: ast
  });
});

/*
 * Finally, we need some code that will actually allow us to load our modules.
 * We use babel-template once again to scaffold the final outline of our
 * bundle. It contains the following
 *
 * - The object map called `modules` which will be holding our registered
 * modules
 * - A placeholder MODULE_REGISTRATIONS where we will inject all of our
 * module registration ASTs from above
 * - The module loading code, which amounts to defining a "require" function
 * of our own called `weepackRequire`
 * - An initial call to `weepackRequire` for our entry point module, to kick
 * off the execution of our bundle code.
 *
 * Let's break down the definition of `weepackRequire`:
 * - It accepts a module's ID as its only parameter
 * - If the module hasn't been loaded before, it loads the module by calling
 *   the module loader function from our module registration map for the
 *   appropriate module. It passes in the `weepackRequire` function itself, and
 *   appropriate values for `module` and `exports`, fulfilling the contract
 *   outlined in our module registration template above. When the function is
 *   called it will execute the module code, which requires any modules needed
 *   by calling `weepackRequire`, and exports any desired values by mutating
 *   the given `module` and `exports` objects.
 * - The value of `module.exports` is cached in the loadedModules object, and
 *   weepackRequire returns the value of `module.exports`.
 * - If the module has been loaded before, the cached value is simply returned
 *   immediately by `weepackRequire`. This behaviour directly emulates what
 *   Node.js require does --- modules can be `required` many times, but they
 *   are only ever executed once.
 */
const buildBundle = template(`
  (function() {
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

/*
 * We need to determine the module ID of the entry point module, as we'll be
 * injecting it into our bundle template.
 */
const entryModuleId = getModuleIdForFile(entryAbsolutePath);

/*
 * At last we retrieve the AST for our final bundle by calling the template
 * function, and injecting the ASTs for module registration and the entry point
 * module ID.
 */
const bundleAst = buildBundle({
  MODULE_REGISTRATIONS: moduleRegistrationAsts,
  ENTRY_MODULE_ID: getAstNodeForModuleId(entryModuleId)
});

/*
 * We use babel-generator to get the code from the AST. The generate function
 * simply retrieves an actual string representation of the code from the AST.
 * The `retainFunctionParens` option makes sure the IIFE wrapping the bundle
 * still has parentheses around it.
 */
const bundleCode = generate(bundleAst, { retainFunctionParens: true }).code;

/*
 * As a final step, we write the bundle code to the output file. If we weren't
 * given an output file, we just write the code to stdout.
 */
if(outputFile) {
  fs.writeFileSync(outputFile, bundleCode);
} else {
  console.log(bundleCode);
}

/*
 * Conclusion
 * TODO:
 * - shortcomings of weepack
 * - what additional module bundling webpack does and why
 * - what additional features webpack offers and why
 */
