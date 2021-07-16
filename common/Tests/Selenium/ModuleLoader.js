function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function loadFetchModule(moduleLoader, name) {
    // Load whatwg-fetch
    moduleLoader.add(name || "whatwg-fetch").afterLoad = function (polyFetch) {
        window.fetch = window.fetch || polyFetch.fetch;
        window.Headers = window.Headers || polyFetch.Headers;
        window.Response = window.Response || polyFetch.Response;
        window.Request = window.Request || polyFetch.Request;
        window.Promise = window.Promise || SimpleSyncPromise;
        
        var usePolyFetch = getParameterByName("polyFetch");
        if (usePolyFetch) {
            window.fetch = polyFetch.fetch;
            window.Headers = polyFetch.Headers;
            window.Response = polyFetch.Response;
            window.Request = polyFetch.Request;
        }
    };
}

function loadCommonModules(moduleLoader) {
    // Load and define the app insights test framework module
    moduleLoader.add("@microsoft/ai-test-framework", "./node_modules/@microsoft/ai-test-framework/dist/ai-test-framework");

    // Load and define the app insights Shims module
    moduleLoader.add("@microsoft/applicationinsights-shims", "./node_modules/@microsoft/applicationinsights-shims/browser/applicationinsights-shims");

    // Load DynamicProto
    moduleLoader.add("@microsoft/dynamicproto-js", "./node_modules/@microsoft/dynamicproto-js/lib/dist/umd/dynamicproto-js", true);
}

function ModuleLoader(config) {

    if (config) {
        require.config(config);
    }

    var requiredModules = [];

    function doModuleCb(moduleDef, theModule, cb) {
        if (theModule) {
            cb(module);
        } else {
            // Module was loaded, but has not yet created and instance -- so create one
            console && console.log("Module [" + moduleDef.name + "] loaded - creating instance - " + moduleDef.name);
            require([moduleDef.name], function (theModule) {
                cb(theModule);
            });
        }
    }

    function processModules() {
        if (requiredModules.length > 0) {
            var moduleDef = requiredModules.shift();
            if (moduleDef.prepare) {
                moduleDef.prepare();
            }

            if (moduleDef.config) {
                require.config(config);
            }

            require([moduleDef.path], function (theModule) {
                try {
                    if (moduleDef.run) {
                        doModuleCb(moduleDef, theModule, function(theModule) {
                            console && console.log("Running module - " + moduleDef.name);
                            moduleDef.run(theModule);
                        });
                    } else {
                        define(moduleDef.name, function() {
                            if (moduleDef.asDefault) {
                                console && console.log("Returning default module - " + moduleDef.name);
                                return {
                                    "default": theModule
                                }
                            }
                            console && console.log("Returning module - " + moduleDef.name);
                            return theModule 
                        });

                        if (moduleDef.afterLoad) {
                            doModuleCb(moduleDef, theModule, function(theModule) {
                                console && console.log("Module After Load called - " + moduleDef.name + " from " + moduleDef.path);
                                moduleDef.afterLoad(theModule);
                            });
                        }
                        console && console.log("Loaded module - " + moduleDef.name + " from " + moduleDef.path);
                    }
                } catch(err) {
                    console && console.error("Failed to load and initialize [" + moduleDef.name + "] from [" + moduleDef.path + "]\n - Require ERROR: " + err.toString());
                }

                processModules();
            },
            function (err) {
                console && console.error("Failed to load [" + moduleDef.name + "] from [" + moduleDef.path + "]\n - Require ERROR: " + err.toString());
                if (moduleDef.path.toLowerCase() !== moduleDef.path) {
                    console && console.log(" ** Validate the path it may need to be all lowercase -- " + moduleDef.path);
                }
            });
        }
    }

    function addModule(name, path, asDefault) {
        var moduleDef = {
            name: name,
            path: !path ? name : path,
            asDefault: asDefault
        }

        requiredModules.push(moduleDef);

        return moduleDef;
    }

    return {
        add: addModule,
        run: processModules
    }
}
