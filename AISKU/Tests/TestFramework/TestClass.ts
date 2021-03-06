/// <reference path="../../../common/Tests/External/qunit.d.ts" />
import { SinonSandbox, SinonSpy, SinonStub, SinonMock, SinonFakeXMLHttpRequest } from 'sinon';
import * as sinon from 'sinon';
import dynamicProto from '@microsoft/dynamicproto-js';
import { ITestContext, StepResult, TestCase, TestCaseAsync } from './TestCase';
import { Assert } from './Assert';
import { CoreUtils, getGlobal } from '@microsoft/applicationinsights-core-js';

const stepRetryCnt = 'retryCnt';

export interface FakeXMLHttpRequest extends XMLHttpRequest {
    url?: string;
    method?: string;
    requestHeaders?: any;
    respond: (status: number, headers: any, body: string) => void;
}

export class TestClass {
    public static isPollingStepFlag = "isPollingStep";

    /** The instance of the currently running suite. */
    public static currentTestClass: TestClass;
    public static currentTestInfo: TestCase|TestCaseAsync;
    public static orgSetTimeout: (handler: Function, timeout?: number) => number;
    public static orgClearTimeout: (handle?: number) => void;

    /** Turns on/off sinon's fake implementation of XMLHttpRequest. On by default. */
    public sandboxConfig: any = {};

    public static orgObjectDefineProperty = Object.defineProperty;

    protected _xhrRequests: FakeXMLHttpRequest[] = [];
    protected _clock = null;

    /** Default value for whether to turns on/off sinon's fake implementation of XMLHttpRequest. On by default. */
    private _useFakeServer: boolean = true;
    public fakeServerAutoRespond: boolean = false;
    public isEmulatingEs3: boolean;

    private _moduleName: string;

    private _xhr;
    private _xhrOrgSend;
    private _orgNavigator: any;
    private _beaconHooks = [];
    private _dynProtoOpts: any = null;

    // Simulate an Es3 environment
    private _orgObjectFuncs = null;
    private _orgFetch = null;

    constructor(name?: string, emulateEs3?: boolean) {
        this._moduleName = (emulateEs3 ? "(ES3) " : "") + name;
        this.isEmulatingEs3 = emulateEs3
        QUnit.module(this._moduleName);
        this.sandboxConfig.injectIntoThis = true;
        this.sandboxConfig.injectInto = null;
        this.sandboxConfig.properties = ["spy", "stub", "mock", "sandbox"];
    }

    get useFakeServer(): boolean {
        return this._useFakeServer;
    }

    set useFakeServer(value: boolean) {
        this._useFakeServer = value;
        if (!value) {
            this._unhookXhr();
        } else if (value && TestClass.currentTestInfo) {
            this._hookXhr();
        }
    }

    /** Method called before the start of each test method */
    public testInitialize() {
    }

    /** Method called after each test method has completed */
    public testCleanup() {
    }

    /** Method in which test class intances should call this.testCase(...) to register each of this suite's tests. */
    public registerTests() {
    }

    /** Register an async Javascript unit testcase. */
    public testCaseAsync(testInfo: TestCaseAsync) {
        if (!testInfo.name) {
            throw new Error("Must specify name in testInfo context in registerTestcase call");
        }

        if (isNaN(testInfo.stepDelay)) {
            throw new Error("Must specify 'stepDelay' period between pre and post");
        }

        if (!testInfo.steps) {
            throw new Error("Must specify 'steps' to take asynchronously");
        }
        if (testInfo.autoComplete === undefined) {
            testInfo.autoComplete = true;
        }

        if (testInfo.autoComplete === undefined) {
            testInfo.autoComplete = true;
        }

        // Create a wrapper around the test method so we can do test initilization and cleanup.
        const testMethod = (assert: any) => {
            const done = assert.async();

            // Save off the instance of the currently running suite.
            TestClass.currentTestClass = this;
            TestClass.currentTestInfo = testInfo;

            // Save the real clearTimeout (as _testStarting and enable sinon fake timers)
            const orgClearTimeout = clearTimeout;
            const orgSetTimeout = setTimeout;

            TestClass.orgSetTimeout = (handler: Function, timeout?: number) => {
                return orgSetTimeout(handler, timeout);
            };

            TestClass.orgClearTimeout = (handler: number) => {
                orgClearTimeout(handler);
            };

            let useFakeServer = testInfo.useFakeServer;
            if (useFakeServer === undefined) {
                useFakeServer = this.useFakeServer;
            }

            if (useFakeServer) {
                this._hookXhr();
            }

            if (testInfo.useFakeTimers) {
                this._clock = sinon.useFakeTimers();
            }

            if (this.isEmulatingEs3) {
                this._emulateEs3();
            }

            // Run the test.
            try {
                let self = this;
                let testComplete = false;
                let timeOutTimer = null;
                let stepIndex = 0;
    
                const testDone = () => {
                    if (timeOutTimer) {
                        orgClearTimeout(timeOutTimer);
                    }
    
                    testComplete = true;
                    // done is QUnit callback indicating the end of the test
                    self._testCompleted();
                    done();
                };
    
                let testContext: ITestContext = {
                    context: {},
                    retryCnt: 0,
                    testDone: testDone
                };

                if (testInfo.timeOut !== undefined) {
                    timeOutTimer = orgSetTimeout(() => {
                        QUnit.assert.ok(false, "Test case timed out!");
                        testComplete = true;
                        done();
                    }, testInfo.timeOut);
                }

                self._testStarting();

                const steps = testInfo.steps;
                const trigger = () => {
                    // The callback which activates the next test step. 
                    let nextTestStepTrigger = () => {
                        orgSetTimeout(() => {
                            trigger();
                        }, testInfo.stepDelay);
                    };

                    if (steps.length && !testComplete) {
                        const step = steps.shift();
                        stepIndex++;

                        // There 2 types of test steps - simple and polling.
                        // Upon completion of the simple test step the next test step will be called.
                        // In case of polling test step the next test step is passed to the polling test step, and
                        // it is responsibility of the polling test step to call the next test step.
                        try {
                            if (step) {
                                if (step[TestClass.isPollingStepFlag]) {
                                    step.call(this, nextTestStepTrigger);
                                } else {
                                    testContext.retryCnt = step[stepRetryCnt] || 0;
    
                                    let result = step.call(this, testContext);
                                    if (result === StepResult.Retry || result === false) {
                                        // The step requested itself to be retried
                                        Assert.ok(false, 'Retrying Step - ' + stepIndex + ' - Attempt #' + testContext.retryCnt);
                                        step[stepRetryCnt] = testContext.retryCnt + 1;
                                        steps.unshift(step);
                                        stepIndex--;
                                    } else if (result === StepResult.Repeat) {
                                        // The step requested itself to be repeated
                                        steps.unshift(step);
                                        stepIndex--;
                                    } else if (result === StepResult.Abort) {
                                        Assert.ok(false, 'Step aborted!');
                                        testDone();
                                        return;
                                    }
    
                                    nextTestStepTrigger.call(this);
                                }
                            }
                        } catch (e) {
                            console.error("Failed: Unexpected Exception: " + e);
                            Assert.ok(false, e.toString());
                            this._testCompleted(true);
                            // done is QUnit callback indicating the end of the test
                            done();

                            return;
                        }
                    } else if (!testComplete) {
                        if (testInfo.autoComplete) {
                            // done is QUnit callback indicating the end of the test
                            testDone();
                        } else {
                            nextTestStepTrigger();
                        }
                    }
                };

                trigger();
            } catch (ex) {
                console.error("Failed: Unexpected Exception: " + ex);
                Assert.ok(false, "Unexpected Exception: " + ex);
                this._testCompleted(true);

                // done is QUnit callback indicating the end of the test
                done();
            }
        };

        // Register the test with QUnit
        QUnit.test((this.isEmulatingEs3 ? "(ES3) " : "") + testInfo.name + " - (Async)", testMethod);
    }

    /** Register a Javascript unit testcase. */
    public testCase(testInfo: TestCase) {
        if (!testInfo.name) {
            throw new Error("Must specify name in testInfo context in registerTestcase call");
        }

        if (!testInfo.test) {
            throw new Error("Must specify 'test' method in testInfo context in registerTestcase call");
        }

        // Create a wrapper around the test method so we can do test initilization and cleanup.
        const testMethod = (assert) => {
            // Treating all tests as async, so there is no issues with mixing them
            let done = assert.async();

            // Save off the instance of the currently running suite.
            TestClass.currentTestClass = this;
            TestClass.currentTestInfo = testInfo;
            function _testFinished(failed?: boolean) {
                TestClass.currentTestClass._testCompleted(failed);
                done();
            }

            // Save the real clearTimeout (as _testStarting and enable sinon fake timers)
            const orgClearTimeout = clearTimeout;
            const orgSetTimeout = setTimeout;

            TestClass.orgSetTimeout = (handler: Function, timeout?: number) => {
                return orgSetTimeout(handler, timeout);
            };

            TestClass.orgClearTimeout = (handler: number) => {
                orgClearTimeout(handler);
            };

            let useFakeServer = testInfo.useFakeServer;
            if (useFakeServer === undefined) {
                useFakeServer = this.useFakeServer;
            }

            if (useFakeServer) {
                this._hookXhr();
            }

            if (testInfo.useFakeTimers) {
                this._clock = sinon.useFakeTimers();
            }

            if (this.isEmulatingEs3) {
                this._emulateEs3();
            }

            let failed = false;

            TestClass.orgSetTimeout = (handler:Function, timeout?:number) => {
                return orgSetTimeout(handler, timeout);
            }

            TestClass.orgClearTimeout = (handler:number) => {
                orgClearTimeout(handler);
            }

            // Run the test.
            try {
                this._testStarting();

                let result = testInfo.test.call(this);
                // Check if the result is present and looks like a Promise
                if (result && result.then) {
                    let promiseTimeout = null;
                    if (testInfo.skipTimeout !== true) {
                        let timeout = testInfo.timeout || 5000;
                        promiseTimeout = setTimeout(() => {
                            QUnit.assert.ok(false, "Timeout: Aborting as the Promise returned from the test method did not resolve within " + timeout + " ms");
                            _testFinished(true);
                        }, timeout);
                    }
                    result.then(() => {
                        promiseTimeout && clearTimeout(promiseTimeout);
                        _testFinished();
                    }).catch((reason) => {
                        promiseTimeout && clearTimeout(promiseTimeout);
                        QUnit.assert.ok(false, "Returned Promise rejected: " + reason);
                        _testFinished(true);
                    });
                } else {
                    _testFinished();
                }
            } catch (ex) {
                console.error("Failed: Unexpected Exception: " + ex);
                Assert.ok(false, "Unexpected Exception: " + ex);
                _testFinished(true);
            }
        };

        // Register the test with QUnit
        QUnit.test((this.isEmulatingEs3 ? "(ES3) " : "") + testInfo.name, testMethod);
    }

    protected _deleteAllCookies() {
        var cookies = document.cookie.split(";");

        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i];
            var eqPos = cookie.indexOf("=");
            var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        }
    }

    protected _disableDynProtoBaseFuncs() {
        let defOpts = dynamicProto['_dfOpts'];
        if (defOpts) {
            if (!this._dynProtoOpts) {
                // Save the current settings so we can restore them
                this._dynProtoOpts = {};
                Object.keys(defOpts).forEach((key) => {
                    this._dynProtoOpts[key] = defOpts[key];
                });
            }

            defOpts.useBaseInst = false;
        }
    }

    /** Called when the test is starting. */
    private _testStarting() {
        let _self = this;
        // Initialize the sandbox similar to what is done in sinon.js "test()" override. See note on class.
        _self.sandbox = sinon.createSandbox(this.sandboxConfig);

        if (_self.isEmulatingEs3) {
            // As we removed Object.define we need to temporarily restore this for each sandbox call
            // tslint:disable-next-line:forin
            for (var field in _self.sandbox) {
                var value = _self.sandbox[field];
                if (CoreUtils.isFunction(value)) {
                    _self.sandbox[field] = (function(theValue) {
                        return function() {
                            var orgArguments = arguments;
                            let saveObjectProps = {};
                            // Save and restore the Object properties/functions
                            if (_self._orgObjectFuncs) {
                                for (var name in _self._orgObjectFuncs) {
                                    if (_self._orgObjectFuncs.hasOwnProperty(name) && _self._orgObjectFuncs[name] !== undefined) {
                                        saveObjectProps[name] = Object[name];
                                        Object[name] = _self._orgObjectFuncs[name];
                                    }
                                }
                            }

                            // Call the original sandbox function
                            let result = theValue.apply(this, orgArguments);

                            // Restore the Object properties/functions
                            _self._restoreObject(saveObjectProps);
                            return result;
                        }
                    })(value);
                }
            }
        }

        // Allow the derived class to perform test initialization.
        this.testInitialize();
    }

    /** Called when the test is completed. */
    private _testCompleted(failed?: boolean) {
        this._unhookXhr();

        if (this._clock) {
            this._clock.restore();
            this._clock = null;
        }

        if (this._orgNavigator) {
            this.setNavigator(this._orgNavigator);
            this._orgNavigator = null;
        }

        this._beaconHooks = [];
        this._cleanupAllHooks();
        this._restoreEs3();

        if (failed) {
            // Just cleanup the sandbox since the test has already failed.
            this.sandbox.restore();
        }
        else {
            // Verify the sandbox and restore.
            (this.sandbox as any).verifyAndRestore();
        }

        this.testCleanup();

        // Clear the instance of the currently running suite.
        TestClass.currentTestClass = null;
        TestClass.currentTestInfo = null;
    }

    private _removeFuncHooks(fn:any) {
        if (typeof fn === "function") {
            let aiHook:any = fn["_aiHooks"];

            if (aiHook && aiHook.h) {
                aiHook.h = [];
            }
        }
    }

    private _removeHooks(target:any) {
        Object.keys(target).forEach(name => {
            try {
                this._removeFuncHooks(target[name]);
            } catch (e) {
            }
        });
    }

    private _cleanupAllHooks() {
        this._removeHooks(XMLHttpRequest.prototype);
        this._removeHooks(XMLHttpRequest);
        this._removeFuncHooks(window.fetch);
    }

    private _restoreObject(objectProps: any) {
        if (objectProps) {
            // Restore the Object properties/functions
            for (var name in objectProps) {
                if (objectProps.hasOwnProperty(name) && objectProps[name] !== undefined) {
                    Object[name] = objectProps[name];
                }
            }
        }
    }

    private _restoreEs3() {
        this._restoreObject(this._orgObjectFuncs);
        this._orgObjectFuncs = null;

        if (this._orgFetch) {
            let global = getGlobal() as any;
            global.fetch = this._orgFetch;
            this._orgFetch = null;
        }
    }

    private _emulateEs3() {
        const objectNames = [ "defineProperty", "defineProperties"];
        if (!this._orgObjectFuncs) {
            this._orgObjectFuncs = {};
            for (var lp = 0; lp < objectNames.length; lp++) {
                let name = objectNames[lp];
                this._orgObjectFuncs[name] = Object[name];
                Object[name] = null;
            }
        }

        if (!this._orgFetch) {
            let global = getGlobal() as any;
            this._orgFetch = global.fetch;
            global.fetch = null;
        }

        // Lets pretend to also be IE8
        this.setUserAgent("Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 5.1; Trident/4.0)");
    }

    private _unhookXhr() {
        if (this._xhr) {
            if (this._xhrOrgSend) {
                this._xhr.prototype.send = this._xhrOrgSend;
                this._xhrOrgSend = null;
            }

            this._xhr.restore();
            this._xhr = null;
        }
    }

    private _hookXhr() {
        let _self = this;
        if (!_self._xhr) {
            // useFake Server is being re-enabled while we are running a test so we need to re-fake it
            _self._xhr = sinon.useFakeXMLHttpRequest();
            _self._xhrRequests = [];
            _self._xhr.onCreate = (xhr: FakeXMLHttpRequest) => {
                _self._xhrRequests.push(xhr);
            }

            _self._xhrOrgSend = _self._xhr.prototype.send;
            _self._xhr.prototype.send = function() {
                let xhr = this;
                let theArguments = arguments;
                let autoRespond = _self.fakeServerAutoRespond;
                if (TestClass.currentTestInfo && TestClass.currentTestInfo.fakeServerAutoRespond !== undefined) {
                    autoRespond = TestClass.currentTestInfo.fakeServerAutoRespond;
                }

                if (autoRespond && xhr && xhr.url && xhr.method) {
                    TestClass.orgSetTimeout && TestClass.orgSetTimeout(() => {
                        if (TestClass.currentTestInfo && xhr && _self._xhrRequests && _self._xhrRequests.indexOf(xhr) !== -1) {
                            xhr.respond(200, {}, "");
                        }
                    }, 5);
                }

                if (_self._xhrOrgSend) {
                    _self._xhrOrgSend.apply(xhr, theArguments);
                }
            }
        }
    }

    /**** Sinon methods and properties ***/

    // These methods and properties are injected by Sinon and will override the implementation here.
    // These are here purely to make typescript happy.
    public sandbox: SinonSandbox;

    /** Creates an anonymous function that records arguments, this value, exceptions and return values for all calls. */
    public spy(): SinonSpy;
    /** Spies on the provided function */
    public spy(funcToWrap: Function): SinonSpy;
    /** Creates a spy for object.methodName and replaces the original method with the spy. The spy acts exactly like the original method in all cases. The original method can be restored by calling object.methodName.restore(). The returned spy is the function object which replaced the original method. spy === object.method. */
    public spy(object: any, methodName: string, func?: Function): SinonSpy;
    public spy(...args: any[]): SinonSpy { return null; }

    /** Creates an anonymous stub function. */
    public stub(): SinonStub;
    /** Stubs all the object's methods. */
    public stub(object: any): SinonStub;
    public stub(...args: any[]): SinonStub { return null; }

    /** Creates a mock for the provided object.Does not change the object, but returns a mock object to set expectations on the object's methods. */
    public mock(object: any): SinonMock { return null; }

    /**** end: Sinon methods and properties ***/

    protected setUserAgent(userAgent: string) {
        // Hook Send beacon which also mocks navigator
        this.hookSendBeacon(null);

        TestClass.orgObjectDefineProperty(window.navigator, 'userAgent',
            {
                configurable: true,
                get: function () {
                    return userAgent;
                }
            });
    }

    protected hookSendBeacon(cb: (url: string, data?: BodyInit | null) => void) {
        if (!this._orgNavigator) {
            let newNavigator = <any>{};
            this._orgNavigator = window.navigator;

            newNavigator.sendBeacon = (url, body) => {
                this._beaconHooks.forEach(element => {
                    element(url, body);
                });
                return this._orgNavigator.sendBeacon(url, body);
            };

            // Just Blindly copy the properties over
            // tslint:disable-next-line: forin
            for (let name in navigator) {
                if (!newNavigator.hasOwnProperty(name)) {
                    newNavigator[name] = navigator[name];
                    if (!newNavigator.hasOwnProperty(name)) {
                        // if it couldn't be set directly try and pretend
                        TestClass.orgObjectDefineProperty(newNavigator, name,
                        {
                            configurable: true,
                            get: function () {
                                return navigator[name];
                            }
                        });
                    }
                }
            }

            this.setNavigator(newNavigator);
        }

        this._beaconHooks.push(cb);
    }

    protected setNavigator(newNavigator: any) {
        TestClass.orgObjectDefineProperty(window, 'navigator',
        {
            configurable: true,
            get: function () {
                return newNavigator;
            }
        });
    }

    /** 
     * Sends a JSON response to the provided request.
     * @param request The request to respond to.
     * @param data Data to respond with.
     * @param errorCode Optional error code to send with the request, default is 200
     */
    public sendJsonResponse(request: SinonFakeXMLHttpRequest, data: any, errorCode?: number) {
        if (errorCode === undefined) {
            errorCode = 200;
        }

        request.respond(
            errorCode,
            { "Content-Type": "application/json" },
            JSON.stringify(data));
    }

    public getPayloadMessages(spy:SinonSpy, includeInit:boolean = false) {
        let resultPayload = [];
        if (spy.called && spy.args && spy.args.length > 0) {
            spy.args.forEach(call => {
                call[0].forEach(message => {
                    // Ignore the internal SendBrowserInfoOnUserInit message (Only occurs when running tests in a browser)
                    if (includeInit || message.indexOf("AI (Internal): 72 ") === -1) {
                        resultPayload.push(message);
                    }
                })
            });
        }

        return resultPayload;
    }

    public dumpPayloadMessages(spy:SinonSpy) {
        let msg = "Sent Messages";
        if (spy.called && spy.args && spy.args.length > 0) {
            spy.args[0][0].forEach((value, idx) => {
                msg += "\n" + idx + ":" + value;
            });
        }
        Assert.ok(false, msg);
    }
}

// Configure Sinon
sinon.assert.fail = (msg?) => {
    Assert.ok(false, msg);
};

sinon.assert.pass = (assertion) => {
    Assert.ok(assertion, "sinon assert");
};
