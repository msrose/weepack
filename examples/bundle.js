(function () {
  var modules = {};

  modules["/Users/michael/Documents/weepack/modules/entry.js"] = function (require, exports, module) {
    'use strict';

    const module1 = require("/Users/michael/Documents/weepack/modules/module1.js");

    const module2 = require("/Users/michael/Documents/weepack/modules/module2.js");

    console.log(module1.func());
    console.log(module1.func2());
    console.log(module2.func());
    console.log(module2.func2());
  };

  modules["/Users/michael/Documents/weepack/modules/module2.js"] = function (require, exports, module) {
    'use strict';

    const module1 = require("/Users/michael/Documents/weepack/modules/module1.js");

    module.exports = {
      func() {
        return 'Here is the stuff from module 2';
      },

      func2() {
        return `Here we are in module 2 calling module1's func: "${module1.func()}"`;
      }

    };
  };

  modules["/Users/michael/Documents/weepack/modules/module1.js"] = function (require, exports, module) {
    'use strict';

    const module3 = require("/Users/michael/Documents/weepack/modules/module3.js");

    module.exports = {
      func() {
        return 'Here is the stuff from module 1';
      },

      func2() {
        return `In module1, calling 3: ${module3.func()}`;
      }

    };
  };

  modules["/Users/michael/Documents/weepack/modules/module3.js"] = function (require, exports, module) {
    'use strict';

    module.exports = {
      func() {
        return 'This is boring module 3';
      }

    };
  };

  var loadedModules = {};

  var weepackRequire = function (moduleId) {
    if (!loadedModules[moduleId]) {
      var module = {
        exports: {}
      };
      modules[moduleId](weepackRequire, module.exports, module);
      loadedModules[moduleId] = module.exports;
    }

    return loadedModules[moduleId];
  };

  weepackRequire("/Users/michael/Documents/weepack/modules/entry.js");
})();