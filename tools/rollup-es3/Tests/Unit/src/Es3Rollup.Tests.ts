import { AITestClass } from "@microsoft/ai-test-framework";
import { es3Check, es3Poly, importCheck } from "../../../src/applicationinsights-rollup-es3";

export class Es3RollupTests extends AITestClass {

    public testInitialize() {
    }

    private visibleNewlines(value) {
        if (value) {
            return value.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
        }

        return value;
    }

    private convertNewlines(value, newline) {
        if (value) {
            return value.replace(/\n/g, newline);
        }

        return value;
    }

    private testPolyNoChange(options:any, input:string, id:string = null) {
        let plugin = es3Poly(options);

        QUnit.assert.equal(plugin.name, "ai-rollup-es3poly");
        QUnit.assert.equal(plugin.renderChunk(input, { filename: id ? id : "test.js" }), null);
        QUnit.assert.equal(plugin.transform(input, id ? id : "testId"), null);
    }

    private testCheckNoMatch(options:any, input:string) {
        let plugin = es3Check(options);

        QUnit.assert.equal(plugin.name, "ai-rollup-es3check");
        QUnit.assert.equal(plugin.renderChunk(input, { filename: "test.js" }), null);
        QUnit.assert.equal(plugin.transform(input, "testId"), null);
    }

    public testImportCheck(options:any, input:string) {
        let plugin = importCheck(options);

        QUnit.assert.equal(plugin.name, "ai-rollup-importcheck");
        QUnit.assert.equal(plugin.renderChunk(input, { filename: "test.js" }), null);
        QUnit.assert.equal(plugin.transform(input, "testId"), null);
    }

    public testImportCheckFail(options:any, input:string, renderExpected:string, transformExpected:string = null) {
        let plugin = importCheck(options);

        QUnit.assert.equal(plugin.name, "ai-rollup-importcheck");

        this.testError(plugin, input, input, renderExpected, transformExpected);
    }

    private doTest(plugin:any, input:string, expected:string) {
        this.testExpected(plugin, input, expected);
        this.testExpected(plugin, this.convertNewlines(input, "\r"), this.convertNewlines(expected, "\r"));
        this.testExpected(plugin, this.convertNewlines(input, "\r\n"), this.convertNewlines(expected, "\r\n"));
        this.testExpected(plugin, this.convertNewlines(input, "\n\r"), this.convertNewlines(expected, "\n\r"));
    }

    private testExpected(plugin:any, input:string, expected:string) {
        QUnit.assert.equal(plugin.name, "ai-rollup-es3poly");
        let result = plugin.renderChunk(input, { filename: "test.js" });
        QUnit.assert.equal(result != null ? result.code : null, expected, this.visibleNewlines(result != null ? result.code : null));

        result = plugin.transform(input, "testId");
        QUnit.assert.equal(result != null ? result.code : null, expected, this.visibleNewlines(result != null ? result.code : null));
    }

    private testError(plugin:any, message:string, input:string, renderExpected:string, transformExpected:string = null) {
        QUnit.assert.throws(() => {
            plugin.renderChunk(input, { filename: "test.js" });
        }, new Error(renderExpected), "renderChunk:" + (message || input));

        QUnit.assert.throws(() => {
            plugin.transform(input, "test.js");
        }, new Error(transformExpected || renderExpected.replace(/during renderChunk/g, "during transform")), "transform:" + (message || input));
    }

    public registerTests() {
        this.testCase({
            name: "No matching values for Es3Poly",
            test: () => {
                this.testPolyNoChange(null, "Nothing removed");
                this.testPolyNoChange(null, "ClassName.prototype.anotherMethod = function () {\n};\n");

                this.testPolyNoChange(null, 
                    "ClassName.prototype.methodName = function () {\n" +
                    "    // This is a comment for a dynamic proto stub\n" +
                    "};\n");

                this.testPolyNoChange(null, 
                    "ClassName.prototype.methodName = function () {\n" +
                    "    // This is a comment for a dynamic proto stub\n" +
                    "};\n");

                this.testPolyNoChange(null, 
                    "// @Stub -- Type 1 comment\n" +
                    "function methodName() {\n" +
                    "    // This is a comment for a dynamic proto stub\n" +
                    "};\n");
    
                this.testPolyNoChange(null, 
                    "function methodName() {\n" +
                    "     // @Stub -- Type 2 single line comment\n" +
                    "};\n");
    
                this.testPolyNoChange(null, 
                    "function methodName() {\n" +
                    "     /* @Stub -- Type 2 multiline comment */\n" +
                    "};\n");
    
                this.testPolyNoChange(null, 
                    "function methodName() {\n" +
                    "     /* @Stub -- Type 2 multiline comment\n" +
                    "     * Continuation of a multi-line comment/\n" +
                    "     */\n" +
                    "};\n");
                }
        });

        this.testCase({
            name: "No matching values for Es3Check",
            test: () => {
                this.testCheckNoMatch(null, "Nothing removed");
                this.testCheckNoMatch(null, "ClassName.prototype.anotherMethod = function () {\n};\n");
                this.testCheckNoMatch(null, "telemertyItem.time = CoreUtils.toISOString(new Date());");
                this.testCheckNoMatch(null, "var responseHeaders = {};\nresponse.headers.forEach(function (value, name) {\n");
            }
        });

        this.testCase({
            name: "Test Es3Polyfil implementations",
            test: () => {
                this.testPolyNoChange(null, 
                    "Object[\"defineProperty\"](exports, '__esModule', { value: true });");

                this.testExpected(
                    es3Poly(), 
                    "Object.defineProperty(exports, '__esModule', { value: true });",
                    "(function(obj, prop, descriptor) { /* ai_es3_polyfil defineProperty */ var func = Object[\"defineProperty\"]; if (func) { try { return func(obj, prop, descriptor); } catch(e) { /* IE8 defines defineProperty, but will throw */ } } if (descriptor && typeof descriptor.value !== undefined) { obj[prop] = descriptor.value; } return obj; })(exports, '__esModule', { value: true });");

                this.testExpected(
                    es3Poly(), 
                    "return r && Object.defineProperty(exports, '__esModule', { value: true }), b;",
                    "return r && (function(obj, prop, descriptor) { /* ai_es3_polyfil defineProperty */ var func = Object[\"defineProperty\"]; if (func) { try { return func(obj, prop, descriptor); } catch(e) { /* IE8 defines defineProperty, but will throw */ } } if (descriptor && typeof descriptor.value !== undefined) { obj[prop] = descriptor.value; } return obj; })(exports, '__esModule', { value: true }), b;");

                this.testExpected(
                    es3Poly(), 
                    "d = Object.getOwnPropertyDescriptor(obj, 'foo'), a=b;",
                    "d = (function(obj, prop) { /* ai_es3_polyfil getOwnPropertyDescriptor */var func = Object[\"getOwnPropertyDescriptor\"]; if (func) { return func(obj, prop); } return undefined; })(obj, 'foo'), a=b;");

                this.testExpected(
                    es3Poly(), 
                    "d = Object.getOwnPropertyDescriptor(obj, 'foo');",
                    "d = (function(obj, prop) { /* ai_es3_polyfil getOwnPropertyDescriptor */var func = Object[\"getOwnPropertyDescriptor\"]; if (func) { return func(obj, prop); } return undefined; })(obj, 'foo');");
    
                this.testExpected(
                    es3Poly(), 
                    "Rectangle.prototype = Object.create(Shape.prototype);",
                    "Rectangle.prototype = (function(obj) { /* ai_es3_polyfil create */ var func = Object[\"create\"]; if (func) { return func(obj); } if (obj == null) { return {}; }; var type = typeof obj; if (type !== 'object' && type !== 'function') { throw new TypeError('Object prototype may only be an Object:' + obj); } function tmpFunc() {}; tmpFunc.prototype = obj; return new tmpFunc(); })(Shape.prototype);");

                // We don't support a polyfil with a 2nd argument
                this.testError(
                    es3Poly(), 
                    null,
                    "Rectangle.prototype = Object.create(Shape.prototype, propsObj);",
                    "Invalid ES3 function [Object.create(] found on line [1], column [23], position [22] during renderChunk - test.js\n" +
                    "[Object.create] is not supported in an ES3 environment, use the helper function objCreate() or add an explicit existence check\n" +
                    "\n" +
                    "--------------------=([Object.create(])=--------------------\n"
                    );

                this.testExpected(
                    es3Poly(), 
                    "a = Object.freeze(obj);",
                    "a = (function(obj) { /* ai_es3_polyfil freeze */ var func = Object[\"freeze\"]; if (func) { return func(obj); } return obj; })(obj);");

                this.testExpected(
                    es3Poly(), 
                    "a = Object.seal(obj);",
                    "a = (function(obj) { /* ai_es3_polyfil seal */ var func = Object[\"seal\"]; if (func) { return func(obj); } return obj; })(obj);");

            }
        });

        this.testCase({
            name: "Test recursive replacements",
            test: () => {
                this.testExpected(
                    es3Poly(),
                    "    var PropertiesPluginIdentifier = \"AppInsightsPropertiesPlugin\";\n"+
                    "    var BreezeChannelIdentifier = \"AppInsightsChannelPlugin\";\n"+
                    "    var Common = /*#__PURE__*/Object.freeze({\n"+
                    "    PropertiesPluginIdentifier: PropertiesPluginIdentifier,\n"+
                    "    BreezeChannelIdentifier: BreezeChannelIdentifier,\n"+
                    "    Util: Util,\n"+
                    "    CorrelationIdHelper: CorrelationIdHelper,\n"+
                    "    UrlHelper: UrlHelper,\n"+
                    "    DateTimeUtils: DateTimeUtils,\n"+
                    "    ConnectionStringParser: ConnectionStringParser,\n"+
                    "    get FieldType () { return FieldType; },\n"+
                    "    RequestHeaders: RequestHeaders,\n"+
                    "    DisabledPropertyName: DisabledPropertyName,\n"+
                    "    ProcessLegacy: ProcessLegacy,\n"+
                    "    SampleRate: SampleRate,\n"+
                    "    HttpMethod: HttpMethod,\n"+
                    "    DEFAULT_BREEZE_ENDPOINT: DEFAULT_BREEZE_ENDPOINT,\n"+
                    "    AIData: Data,\n"+
                    "    AIBase: Base,\n"+
                    "    Envelope: Envelope$1,\n"+
                    "    Event: Event$1,\n"+
                    "    Exception: Exception,\n"+
                    "    Metric: Metric,\n"+
                    "    PageView: PageView,\n"+
                    "    get SeverityLevel () { return exports.SeverityLevel; },\n"+
                    "    ConfigurationManager: ConfigurationManager,\n"+
                    "    ContextTagKeys: ContextTagKeys,\n"+
                    "    DataSanitizer: DataSanitizer,\n"+
                    "    TelemetryItemCreator: TelemetryItemCreator,\n"+
                    "    CtxTagKeys: CtxTagKeys,\n"+
                    "    Extensions: Extensions,\n"+
                    "    get DistributedTracingModes () { return exports.DistributedTracingModes; }\n"+
                    "});",
                    "    var PropertiesPluginIdentifier = \"AppInsightsPropertiesPlugin\";\n"+
                    "    var BreezeChannelIdentifier = \"AppInsightsChannelPlugin\";\n"+
                    "    var Common = /*#__PURE__*/(function(obj) { /* ai_es3_polyfil freeze */ var func = Object[\"freeze\"]; if (func) { return func(obj); } return obj; })({\n"+
                    "    PropertiesPluginIdentifier: PropertiesPluginIdentifier,\n"+
                    "    BreezeChannelIdentifier: BreezeChannelIdentifier,\n"+
                    "    Util: Util,\n"+
                    "    CorrelationIdHelper: CorrelationIdHelper,\n"+
                    "    UrlHelper: UrlHelper,\n"+
                    "    DateTimeUtils: DateTimeUtils,\n"+
                    "    ConnectionStringParser: ConnectionStringParser,\n"+
                    "    FieldType: (function(obj) { /* ai_es3polyfil get FieldType */ if (obj == null || typeof obj !== \"object\") { return obj; } var cpy = obj.constructor(); for (var attr in obj) { if (obj.hasOwnProperty(attr)) { cpy[attr] = obj[attr]; } } return cpy; })(FieldType),\n"+
                    "    RequestHeaders: RequestHeaders,\n"+
                    "    DisabledPropertyName: DisabledPropertyName,\n"+
                    "    ProcessLegacy: ProcessLegacy,\n"+
                    "    SampleRate: SampleRate,\n"+
                    "    HttpMethod: HttpMethod,\n"+
                    "    DEFAULT_BREEZE_ENDPOINT: DEFAULT_BREEZE_ENDPOINT,\n"+
                    "    AIData: Data,\n"+
                    "    AIBase: Base,\n"+
                    "    Envelope: Envelope$1,\n"+
                    "    Event: Event$1,\n"+
                    "    Exception: Exception,\n"+
                    "    Metric: Metric,\n"+
                    "    PageView: PageView,\n"+
                    "    SeverityLevel: (function(obj) { /* ai_es3polyfil get SeverityLevel */ if (obj == null || typeof obj !== \"object\") { return obj; } var cpy = obj.constructor(); for (var attr in obj) { if (obj.hasOwnProperty(attr)) { cpy[attr] = obj[attr]; } } return cpy; })(exports.SeverityLevel),\n"+
                    "    ConfigurationManager: ConfigurationManager,\n"+
                    "    ContextTagKeys: ContextTagKeys,\n"+
                    "    DataSanitizer: DataSanitizer,\n"+
                    "    TelemetryItemCreator: TelemetryItemCreator,\n"+
                    "    CtxTagKeys: CtxTagKeys,\n"+
                    "    Extensions: Extensions,\n"+
                    "    DistributedTracingModes: (function(obj) { /* ai_es3polyfil get DistributedTracingModes */ if (obj == null || typeof obj !== \"object\") { return obj; } var cpy = obj.constructor(); for (var attr in obj) { if (obj.hasOwnProperty(attr)) { cpy[attr] = obj[attr]; } } return cpy; })(exports.DistributedTracingModes)\n"+
                    "});");
            }
        });

        this.testCase({
            name: "Test Errors Es3Check",
            test: () => {
                this.testError(
                    es3Check(), 
                    null, 
                    "var dt = new Date();\n" +
                    "\n" +
                    "dt.toISOString ();\n" +
                    "Can.toISOString();\n",
                    "Invalid ES3 function [dt.toISOString (] found on line [3], column [1], position [22] during renderChunk - test.js\n" +
                    "[dt.toISOString (] is not supported in an ES3 environment, use getISOString()\n" +
                    "1   :var dt = new Date();\n" +
                    "2   :\n" +
                    "3   :dt.toISOString ();\n" +
                    "     ^^^^^^^^^^^^^^^^\n" +
                    "4   :Can.toISOString();\n" +
                    "\n" +
                    "--------------------=([dt.toISOString (])=--------------------\n" +
                    "Invalid ES3 function [Can.toISOString(] found on line [4], column [1], position [41] during renderChunk - test.js\n" +
                    "[Can.toISOString(] is not supported in an ES3 environment, use getISOString()\n" +
                    "1   :var dt = new Date();\n" +
                    "2   :\n" +
                    "3   :dt.toISOString ();\n" +
                    "4   :Can.toISOString();\n" +
                    "     ^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Can.toISOString(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = [];\n" +
                    "\n" +
                    "arr.forEach(function (value, name) { });\n",
                    "Invalid ES3 function [arr.forEach(] found on line [3], column [1], position [15] during renderChunk - test.js\n" +
                    "[arr.forEach(] is not a supported array method in an ES3 environment, use arrForEach().\n" +
                    "1   :var arr = [];\n" +
                    "2   :\n" +
                    "3   :arr.forEach(function (value, name) { });\n" +
                    "     ^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([arr.forEach(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.defineProperty(a);\n",
                    "Invalid ES3 function [Object.defineProperty(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.defineProperty(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.defineProperty(a);\n" +
                    "               ^^^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.defineProperty(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.create(a);\n",
                    "Invalid ES3 function [Object.create(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.create(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.create(a);\n" +
                    "               ^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.create(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.defineProperties(a);\n",
                    "Invalid ES3 function [Object.defineProperties(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.defineProperties(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.defineProperties(a);\n" +
                    "               ^^^^^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.defineProperties(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.getOwnPropertyNames(a);\n",
                    "Invalid ES3 function [Object.getOwnPropertyNames(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.getOwnPropertyNames(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.getOwnPropertyNames(a);\n" +
                    "               ^^^^^^^^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.getOwnPropertyNames(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.getPrototypeOf(a);\n",
                    "Invalid ES3 function [Object.getPrototypeOf(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.getPrototypeOf(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.getPrototypeOf(a);\n" +
                    "               ^^^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.getPrototypeOf(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.getOwnPropertyDescriptor(a);\n",
                    "Invalid ES3 function [Object.getOwnPropertyDescriptor(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.getOwnPropertyDescriptor(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.getOwnPropertyDescriptor(a);\n" +
                    "               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.getOwnPropertyDescriptor(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.preventExtensions(a);\n",
                    "Invalid ES3 function [Object.preventExtensions(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.preventExtensions(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.preventExtensions(a);\n" +
                    "               ^^^^^^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.preventExtensions(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.is(a);\n",
                    "Invalid ES3 function [Object.is(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.is(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.is(a);\n" +
                    "               ^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.is(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.isExtensible(a);\n",
                    "Invalid ES3 function [Object.isExtensible(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.isExtensible(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.isExtensible(a);\n" +
                    "               ^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.isExtensible(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.seal(a);\n",
                    "Invalid ES3 function [Object.seal(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.seal(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.seal(a);\n" +
                    "               ^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.seal(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.isSealed(a);\n",
                    "Invalid ES3 function [Object.isSealed(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.isSealed(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.isSealed(a);\n" +
                    "               ^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.isSealed(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.freeze(a);\n",
                    "Invalid ES3 function [Object.freeze(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.freeze(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.freeze(a);\n" +
                    "               ^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.freeze(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.isFrozen(a);\n",
                    "Invalid ES3 function [Object.isFrozen(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.isFrozen(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.isFrozen(a);\n" +
                    "               ^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.isFrozen(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.fromEntries(a);\n",
                    "Invalid ES3 function [Object.fromEntries(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.fromEntries(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.fromEntries(a);\n" +
                    "               ^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.fromEntries(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.entries(a);\n",
                    "Invalid ES3 function [Object.entries(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.entries(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.entries(a);\n" +
                    "               ^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.entries(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var arr = Object.assign(a);\n",
                    "Invalid ES3 function [Object.assign(] found on line [1], column [11], position [10] during renderChunk - test.js\n" +
                    "[Object.assign(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var arr = Object.assign(a);\n" +
                    "               ^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.assign(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var a = Object.isPrototypeOf(a);\n",
                    "Invalid ES3 function [Object.isPrototypeOf(] found on line [1], column [9], position [8] during renderChunk - test.js\n" +
                    "[Object.isPrototypeOf(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var a = Object.isPrototypeOf(a);\n" +
                    "             ^^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.isPrototypeOf(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var x = Object.setPrototypeOf(a);\n",
                    "Invalid ES3 function [Object.setPrototypeOf(] found on line [1], column [9], position [8] during renderChunk - test.js\n" +
                    "[Object.setPrototypeOf(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var x = Object.setPrototypeOf(a);\n" +
                    "             ^^^^^^^^^^^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.setPrototypeOf(])=--------------------\n"
                    );

                this.testError(
                    es3Check(), 
                    null, 
                    "var x = Object.keys(a);\n",
                    "Invalid ES3 function [Object.keys(] found on line [1], column [9], position [8] during renderChunk - test.js\n" +
                    "[Object.keys(] is not supported in an ES3 environment, use a helper function or add explicit check for existence\n" +
                    "1   :var x = Object.keys(a);\n" +
                    "             ^^^^^^^^^^^^\n" +
                    "\n" +
                    "--------------------=([Object.keys(])=--------------------\n"
                    );
                                                                                                                                                                                                                                                                   
            }
        });

        this.testCase({
            name: "Test Import Check",
            test: () => {
                let plugin = importCheck({});

                this.testImportCheck({}, "");
                this.testImportCheck({ exclude: ["index"]}, "import {\nSomeClass\n} from './MyCode'");
                this.testImportCheck({ exclude: ["index"]}, "import {\nSomeClass\n} from \"./MyCode\"");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from './Index';",
                    "Invalid Import detected [import { A, B, C } from './Index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from './Index']\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from './Index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from \"./Index\";",
                    "Invalid Import detected [import { A, B, C } from \"./Index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from \"./Index\"]\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from \"./Index\"])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from './Index'",
                    "Invalid Import detected [import { A, B, C } from './Index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from './Index']\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from './Index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from \"./Index\"",
                    "Invalid Import detected [import { A, B, C } from \"./Index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from \"./Index\"]\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from \"./Index\"])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from './index';",
                    "Invalid Import detected [import { A, B, C } from './index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from './index']\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from './index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from \"./index\";",
                    "Invalid Import detected [import { A, B, C } from \"./index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from \"./index\"]\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from \"./index\"])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from './index'",
                    "Invalid Import detected [import { A, B, C } from './index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from './index']\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from './index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from \"./index\"",
                    "Invalid Import detected [import { A, B, C } from \"./index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from \"./index\"]\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from \"./index\"])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from './folder/index';",
                    "Invalid Import detected [import { A, B, C } from './folder/index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from './folder/index']\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from './folder/index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from \"./folder/index\";",
                    "Invalid Import detected [import { A, B, C } from \"./folder/index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from \"./folder/index\"]\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from \"./folder/index\"])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from './folder/index'",
                    "Invalid Import detected [import { A, B, C } from './folder/index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from './folder/index']\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from './folder/index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import { A, B, C } from \"./folder/index\"",
                    "Invalid Import detected [import { A, B, C } from \"./folder/index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import { A, B, C } from \"./folder/index\"]\n" +
                    "\n" +
                    "--------------------=([import { A, B, C } from \"./folder/index\"])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import * from './Index';",
                    "Invalid Import detected [import * from './Index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import * from './Index']\n" +
                    "\n" +
                    "--------------------=([import * from './Index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import * from \"./Index\";",
                    "Invalid Import detected [import * from \"./Index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import * from \"./Index\"]\n" +
                    "\n" +
                    "--------------------=([import * from \"./Index\"])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import * from './Index'",
                    "Invalid Import detected [import * from './Index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import * from './Index']\n" +
                    "\n" +
                    "--------------------=([import * from './Index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import * from \"./Index\"",
                    "Invalid Import detected [import * from \"./Index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import * from \"./Index\"]\n" +
                    "\n" +
                    "--------------------=([import * from \"./Index\"])=--------------------\n");

                    this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import * from './folder/Index';",
                    "Invalid Import detected [import * from './folder/Index'] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import * from './folder/Index']\n" +
                    "\n" +
                    "--------------------=([import * from './folder/Index'])=--------------------\n");

                this.testImportCheckFail(
                    { exclude: [ "index" ]},
                    "import * from \"./folder/Index\";",
                    "Invalid Import detected [import * from \"./folder/Index\"] found on line [0], column [1], position [0] during renderChunk - test.js\n" +
                    "Importing from this module has been blocked, you should be importing directly from the source file and not the main module index definition - [import * from \"./folder/Index\"]\n" +
                    "\n" +
                    "--------------------=([import * from \"./folder/Index\"])=--------------------\n");

            }
        });
    }
}

