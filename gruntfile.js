module.exports = function (grunt) {
    grunt.initConfig({
        tslint: {
            options: {
                rulesDirectory: 'node_modules/tslint-microsoft-contrib',
            },
            files: {
                src: [
                    './shared/AppInsightsCommon/**/*.ts',
                    './extensions/**/*.ts',
                    './AISKU/**/*.ts',
                    '!./**/node_modules/**',
                    '!./**/Tests/**',
                    '!./**/dist-esm/**',
                    '!./**/Generated/**',
                    './legacy/JavaScript/**/*.ts',
                    '!./legacy/JavaScript/JavaScriptSDK.Tests/**'
                ],
            }
        },
        ts: {
            options: {
                comments: true
            },
            default: {
                tsconfig: './tsconfig.json',
                src: [
                    'legacy/JavaScript/JavaScriptSDK.Interfaces/*.ts',
                    'legacy/JavaScript/JavaScriptSDK/*.ts',
                ],
                out: 'legacy/bundle/ai.js',
            },
            core: {
                tsconfig: './shared/AppInsightsCore/tsconfig.json'
            },
            coretest: {
                tsconfig: './shared/AppInsightsCore/Tests/tsconfig.json',
                src: [
                    './shared/AppInsightsCore/Tests/Selenium/ApplicationInsightsCore.Tests.ts',
                    './shared/AppInsightsCore/Tests/Selenium/aitests.ts'
                ],
                out: 'shared/AppInsightsCore/Tests/Selenium/aicore.tests.js'
            },
            common: {
                tsconfig: './shared/AppInsightsCommon/tsconfig.json'
            },
            commontest: {
                tsconfig: './shared/AppInsightsCommon/Tests/tsconfig.json',
                src: [
                    './shared/AppInsightsCommon/Tests/Selenium/appinsights-common.tests.ts',
                ],
                out: 'shared/AppInsightsCommon/Tests/Selenium/aicommon.tests.js'
            },
            appinsights: {
                tsconfig: './extensions/applicationinsights-analytics-js/tsconfig.json',
            },
            appinsightstests: {
                tsconfig: './extensions/applicationinsights-analytics-js/Tests/tsconfig.json',
                src: [
                    './extensions/applicationinsights-analytics-js/Tests/Selenium/*.ts',
                    './extensions/applicationinsights-analytics-js/Tests/*.ts'
                ],
                out: 'extensions/applicationinsights-analytics-js/Tests/Selenium/appinsights-analytics.tests.js'
            },
            aisku: {
                tsconfig: './AISKU/tsconfig.json',
                src: [
                    'AISKU/src/*.ts'
                ]
            },
            aiskulite: {
                tsconfig: './AISKULight/tsconfig.json',
                src: [
                    'AISKULight/*.ts'
                ]
            },
            aiskutests: {
                tsconfig: './AISKU/Tests/tsconfig.json',
                src: [
                    'AISKU/Tests/Selenium/*.ts',
                    'AISKU/Tests/*.ts'
                ],
                out: 'AISKU/Tests/Selenium/appinsights-sdk.tests.js'
            },
            properties: {
                tsconfig: './extensions/applicationinsights-properties-js/tsconfig.json',
                src: [
                    './extensions/applicationinsights-properties-js/*.ts',
                    './extensions/applicationinsights-properties-js/Context/*.ts',
                    './extensions/applicationinsights-properties-js/Interfaces/Context/*.ts',
                    './extensions/applicationinsights-properties-js/Interfaces/*.ts'
                ]
            },
            propertiestests: {
                tsconfig: './extensions/applicationinsights-properties-js/Tests/tsconfig.json',
                src: './extensions/applicationinsights-properties-js/Tests/**/*.ts',
                out: './extensions/applicationinsights-properties-js/Tests/Selenium/properties.tests.js'
            },
            reactnative: {
                tsconfig: './extensions/applicationinsights-react-native/tsconfig.json',
                src: [
                    './extensions/applicationinsights-react-native/src/index.ts'
                ]
            },
            reactnativetests: {
                tsconfig: './extensions/applicationinsights-react-native/Tests/tsconfig.json',
                src: './extensions/applicationinsights-react-native/Tests/**/*.ts',
                out: './extensions/applicationinsights-react-native/Tests/Selenium/reactnativeplugin.tests.js'
            },
            deps: {
                tsconfig: './extensions/applicationinsights-dependencies-js/tsconfig.json'
            },
            depstest: {
                tsconfig: './extensions/applicationinsights-dependencies-js/Tests/tsconfig.json',
                src: [
                    './extensions/applicationinsights-dependencies-js/Tests/Selenium/*.ts',
                    './extensions/applicationinsights-dependencies-js/Tests/TestsFramework/*.ts'
                ],
                out: './extensions/applicationinsights-dependencies-js/Tests/Selenium/dependencies.tests.js'
            },
            debugplugin: {
                tsconfig: './extensions/applicationinsights-debugplugin-js/tsconfig.json',
                src: [
                    './extensions/applicationinsights-debugplugin-js/*.ts',
                    './extensions/applicationinsights-debugplugin-js/components/*.ts',
                ]
            },
            aichannel: {
                tsconfig: './channels/applicationinsights-channel-js/tsconfig.json'
            },
            aichanneltest: {
                tsconfig: './channels/applicationinsights-channel-js/Tests/tsconfig.json',
                src: [
                    './channels/applicationinsights-channel-js/Tests/Selenium/*.ts',
                    './channels/applicationinsights-channel-js/Tests/*.ts',
                ],
                out: './channels/applicationinsights-channel-js/Tests/Selenium/aichannel.tests.js'
            },
            rollupes3: {
                tsconfig: './tools/rollup-es3/tsconfig.json'
            },
            rollupes3test: {
                tsconfig: './tools/rollup-es3/Tests/tsconfig.json',
                src: [
                    './tools/rollup-es3/Tests/Selenium/Es3RollupTests.ts'
                ],
                out: './tools/rollup-es3/Tests/Selenium/es3rolluptests.js'
            },
            shims: {
                tsconfig: './tools/shims/tsconfig.json',
                src: [
                    './tools/shims/src/*.ts'
                ]
            },
            shimstest: {
                tsconfig: './tools/shims/Tests/tsconfig.json',
                src: [
                    './tools/shims/src/*.ts',
                    './tools/shims/Tests/**/*.ts'
                ],
                out: './tools/shims/Tests/Selenium/shimstests.js'
            },
            module: {
                // Use a different tsconfig for building module in order to not generate a declaration file for module, while keeping declaration for other modules
                tsconfig: './tsconfigmodule.json',
                src: [
                    'legacy/JavaScript/JavaScriptSDK.Interfaces/*.ts',
                    'legacy/JavaScript/JavaScriptSDK.Module/*.ts',
                ],
                out: 'legacy/bundle/ai.module.js'
            },
            types: {
                tsconfig: './tsconfig.json',
                src: [
                    'legacy/JavaScript/JavaScriptSDK.Tests/DefinitionTypes/*.ts'
                ],
                out: 'legacy/bundle/test/ai.types.js'
            },
            test: {
                tsconfig: './tsconfig.json',
                src: [
                    'legacy/JavaScript/JavaScriptSDK.Tests/Selenium/*.ts'
                ],
                out: 'legacy/JavaScript/JavaScriptSDK.Tests/Selenium/ai.tests.js'
            },
            testSchema: {
                tsconfig: './tsconfig.json',
                src: [
                    'legacy/JavaScript/JavaScriptSDK.Tests/Contracts/Generated/*.ts'
                ],
                out: 'legacy/bundle/test/ai.schema.tests.js'
            },
            testE2E: {
                tsconfig: './tsconfig.json',
                files: [
                    {
                        src: 'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/DisableTelemetry.tests.ts',
                        dest: 'legacy/bundle/test/e2e/DisableTelemetry.tests.js'
                    },
                    {
                        src: 'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/PublicApi.tests.ts',
                        dest: 'legacy/bundle/test/e2e/PublicApiTests.tests.js'
                    },
                    {
                        src: 'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/SanitizerE2E.tests.ts',
                        dest: 'legacy/bundle/test/e2e/SanitizerE2E.tests.js'
                    },
                    {
                        src: 'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/SenderE2E.tests.ts',
                        dest: 'legacy/bundle/test/e2e/SenderE2E.tests.js'
                    },
                    {
                        src: 'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/Snippet.tests.ts',
                        dest: 'legacy/bundle/test/e2e/Snippet.tests.js'
                    },
                    {
                        src: 'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/ValidateApi.tests.ts',
                        dest: 'legacy/bundle/test/e2e/ValidateApi.tests.js'
                    }
                ],
                outDir: 'legacy/bundle/test/e2e'
            }
        },
        uglify: {
            ai: {
                files: {
                    'legacy/bundle/ai.0.js': ['legacy/bundle/ai.js'],
                },
                options: {
                    sourceMap: true,
                    sourceMapIncludeSources: true,
                    sourceMapIn: 'legacy/bundle/ai.js.map',
                    compress: {
                        ie8: true
                    },
                    mangle: {
                        ie8: true
                    }
                },
            },
            snippet: {
                files: {
                    'legacy/bundle/snippet/snippet.min.js': ['legacy/JavaScript/JavaScriptSDK/snippet.js']
                }
            },
            snippetvNext: {
                files: {
                    'AISKU/snippet/snippet.min.js': ['AISKU/snippet/snippet.js']
                },
                options: {
                    sourceMap: false,
                    ie8: true,
                    compress: {
                      passes:3,
                      unsafe: true,
                    },
                    output: {
                      webkit:true
                    }
                }
            }
        },
        qunit: {
            all: {
                options: {
                    urls: [
                        'legacy/JavaScript/JavaScriptSDK.Tests/Selenium/Tests.html',
                        'legacy/JavaScript/JavaScriptSDK.Tests/Contracts/Schema.tests.htm',
                        'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/E2E.DisableTelemetry.tests.htm',
                        'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/E2E.PublicApi.tests.htm',
                        'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/E2E.SanitizerE2E.tests.htm',
                        'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/E2E.Sender.tests.htm',
                        'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/E2E.snippetTests.htm',
                        'legacy/JavaScript/JavaScriptSDK.Tests/E2ETests/E2E.ValidateApi.tests.htm'
                    ],
                    timeout: 300 * 1000, // 5 min
                    console: false,
                    summaryOnly: true,
                    '--web-security': 'false' // we need this to allow CORS requests in PhantomJS
                }
            },
            core: {
                options: {
                    urls: [
                        './shared/AppInsightsCore/Tests/Selenium/Tests.html'
                    ],
                    timeout: 300 * 1000, // 5 min
                    console: false,
                    summaryOnly: true,
                    '--web-security': 'false' // we need this to allow CORS requests in PhantomJS
                }
            },
            common: {
                options: {
                    urls: [
                        './shared/AppInsightsCommon/Tests/Selenium/Tests.html'
                    ],
                    timeout: 300 * 1000, // 5 min
                    console: false,
                    summaryOnly: true,
                    '--web-security': 'false' // we need this to allow CORS requests in PhantomJS
                }
            },
            aitests: {
                options: {
                    urls: [
                        './extensions/applicationinsights-analytics-js/Tests/Selenium/Tests.html'
                    ],
                    timeout: 300 * 1000, // 5 min
                    console: true,
                    summaryOnly: false,
                    '--web-security': 'false' // we need this to allow CORS requests in PhantomJS
                }
            },
            deps: {
                options: {
                    urls: [
                        './extensions/applicationinsights-dependencies-js/Tests/Selenium/Tests.html'
                    ],
                    timeout: 300 * 1000, // 5 min
                    console: true,
                    summaryOnly: false,
                    '--web-security': 'false'
                }
            },
            properties: {
                options: {
                    urls: [
                        './extensions/applicationinsights-properties-js/Tests/Selenium/Tests.html'
                    ],
                    timeout: 5 * 60 * 1000, // 5 min
                    console: false,
                    summaryOnly: true,
                    '--web-security': 'false'
                }
            },
            reactnative: {
                options: {
                    urls: [
                        './extensions/applicationinsights-react-native/Tests/Selenium/Tests.html'
                    ],
                    timeout: 5 * 60 * 1000, // 5 min
                    console: true,
                    summaryOnly: true,
                    '--web-security': 'false'
                }
            },
            aisku: {
                options: {
                    urls: [
                        './AISKU/Tests/Selenium/Tests.html'
                    ],
                    timeout: 5 * 60 * 1000, // 5 min
                    console: true,
                    summaryOnly: true,
                    '--web-security': 'false'
                }
            },
            aichannel: {
                options: {
                    urls: [
                        './channels/applicationinsights-channel-js/Tests/Selenium/Tests.html'
                    ],
                    timeout: 300 * 1000, // 5 min
                    console: false,
                    summaryOnly: true,
                    '--web-security': 'false'
                }
            },
            rollupes3: {
                options: {
                    urls: [
                        './tools/rollup-es3/Tests/Selenium/Tests.html'
                    ],
                    timeout: 300 * 1000, // 5 min
                    console: false,
                    summaryOnly: true,
                    '--web-security': 'false' // we need this to allow CORS requests in PhantomJS
                }
            },
            shims: {
                options: {
                    urls: [
                        './tools/shims/Tests/Selenium/Tests.html'
                    ],
                    timeout: 300 * 1000, // 5 min
                    console: false,
                    summaryOnly: true,
                    '--web-security': 'false' // we need this to allow CORS requests in PhantomJS
                }
            }
        }
    });

    grunt.event.on('qunit.testStart', function (name) {
        grunt.log.ok('Running test: ' + name);
    });

    grunt.loadNpmTasks("grunt-ts");
    grunt.loadNpmTasks('grunt-tslint');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-run');
    grunt.registerTask("default", ["ts:rollupes3", "ts:rollupes3test", "qunit:rollupes3", "ts:shims", "ts:shimstest", "qunit:shims", "ts:default", "uglify:ai", "uglify:snippet"]);
    grunt.registerTask("core", ["ts:core"]);
    grunt.registerTask("common", ["ts:common"]);
    grunt.registerTask("module", ["ts:module"]);
    grunt.registerTask("ai", ["ts:appinsights"]);
    grunt.registerTask("aitests", ["ts:appinsights", "ts:appinsightstests", "qunit:aitests"]);
    grunt.registerTask("aisku", ["ts:aisku"]);
    grunt.registerTask("aiskulite", ["ts:aiskulite"]);
    grunt.registerTask("snippetvnext", ["uglify:snippetvNext"]);
    grunt.registerTask("aiskutests", ["ts:aisku", "ts:aiskutests", "qunit:aisku"]);
    grunt.registerTask("test", ["ts:default", "ts:test", "ts:testSchema", "ts:testE2E", "qunit:all"]);
    grunt.registerTask("test1ds", ["coretest", "common", "propertiestests", "depstest", "aitests", "aiskutests", "reactnativetests", "reacttests"]);
    grunt.registerTask("coretest", ["ts:core", "ts:coretest", "qunit:core"]);
    grunt.registerTask("commontest", ["ts:common", "ts:commontest", "qunit:common"]);
    grunt.registerTask("properties", ["ts:properties"]);
    grunt.registerTask("propertiestests", ["ts:properties", "ts:propertiestests", "qunit:properties"]);
    grunt.registerTask("reactnative", ["ts:reactnative"]);
    grunt.registerTask("reactnativetests", ["qunit:reactnative"]);
    grunt.registerTask("deps", ["ts:deps"]);
    grunt.registerTask("depstest", ["ts:deps", "ts:depstest", "qunit:deps"]);
    grunt.registerTask("debugplugin", ["ts:debugplugin"]);
    grunt.registerTask("aichannel", ["ts:aichannel"]);
    grunt.registerTask("aichanneltest", ["ts:aichannel", "ts:aichanneltest", "qunit:aichannel"]);
    grunt.registerTask("rollupes3", ["ts:rollupes3", "ts:rollupes3test", "qunit:rollupes3"]);
    grunt.registerTask("rollupes3test", ["ts:rollupes3", "ts:rollupes3test", "qunit:rollupes3"]);
    grunt.registerTask("shims", ["ts:shims", "ts:shimstest", "qunit:shims"]);
    grunt.registerTask("shimstest", ["ts:shims", "ts:shimstest", "qunit:shims"]);
};
