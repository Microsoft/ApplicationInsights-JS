import { SinonStub } from "sinon";
import { Assert, AITestClass, PollingAssert } from "@microsoft/ai-test-framework";
import { AjaxMonitor } from "../../../src/ajax";
import { DisabledPropertyName, IConfig, DistributedTracingModes, RequestHeaders, IDependencyTelemetry } from "@microsoft/applicationinsights-common";
import {
    AppInsightsCore, IConfiguration, ITelemetryItem, ITelemetryPlugin, IChannelControls, _InternalMessageId,
    getPerformance, getGlobalInst, getGlobal
} from "@microsoft/applicationinsights-core-js";

interface IFetchArgs {
    input: RequestInfo,
    init: RequestInit
}

function hookFetch<T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void): IFetchArgs[] {
    let calls:IFetchArgs[] = [];
    let global = getGlobal() as any;
    global.fetch = function(input: RequestInfo, init?: RequestInit) {
        calls.push({
            input,
            init
        });
        return new window["SimpleSyncPromise"](executor);
    }

    return calls;
}

function hookTrackDependencyInternal(ajaxMonitor: AjaxMonitor) {
    let orgInternalDependency: (dependency: IDependencyTelemetry, properties?: { [key: string]: any }) => void = ajaxMonitor["trackDependencyDataInternal"];
    let dependencyArgs: IDependencyTelemetry[] = [];

    ajaxMonitor["trackDependencyDataInternal"] = function (dependency: IDependencyTelemetry, properties?: { [key: string]: any }) {
        let orgArguments = arguments;
        dependencyArgs.push({ ...dependency});
        orgInternalDependency.apply(ajaxMonitor, orgArguments);
    };

    return dependencyArgs;
}

export class AjaxTests extends AITestClass {
    private _fetch;
    private _ajax:AjaxMonitor = null;
    private _context:any = {};

    public testInitialize() {
        this._context = {};
        this.useFakeServer = true;
        this._fetch = getGlobalInst("fetch");
    }

    public testCleanup() {
        this._context = {};
        if (this._ajax !== null) {
            this._ajax.teardown();
            this._ajax = null;
        }
        getGlobal().fetch = this._fetch;
    }

    public registerTests() {
        this.testCase({
            name: "Dependencies Configuration: Config can be set from root config",
            test: () => {
                this._ajax = new AjaxMonitor();
                let dependencyFields = hookTrackDependencyInternal(this._ajax);
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentation_key",
                    maxAjaxCallsPerView: 5,
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                let throwSpy = this.sandbox.spy(appInsightsCore.logger, "throwInternal");

                for (let lp = 0; lp < 5; lp++) {
                    var xhr = new XMLHttpRequest();
                    xhr.open("GET", "http://microsoft.com");
                    xhr.setRequestHeader("header name", "header value");
                    xhr.send();
                    // Emulate response
                    (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");
                }
                Assert.equal(5, trackSpy.callCount, "Track has been called 5 times");
                Assert.equal(false, throwSpy.called, "We should not have thrown an internal error -- yet");

                var xhr = new XMLHttpRequest();
                xhr.open("GET", "http://microsoft.com");
                xhr.setRequestHeader("header name", "header value");
                xhr.send();
                // Emulate response
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");

                Assert.equal(5, trackSpy.callCount, "Track has still only been called 5 times");
                Assert.equal(true, throwSpy.called, "We should have thrown an internal error");
                Assert.equal(_InternalMessageId.MaxAjaxPerPVExceeded, throwSpy.args[0][1], "Reported error should be max exceeded");
                Assert.equal(true, throwSpy.args[0][2].indexOf("ajax per page view limit") !== -1, "Reported error should be contain text describing the issue");

                Assert.equal(6, dependencyFields.length, "trackDependencyDataInternal should have been called");
                for (let lp = 0; lp < 6; lp++) {
                    Assert.ok(dependencyFields[lp].startTime, `startTime ${lp} was specified before trackDependencyDataInternal was called`);
                }
            }
        });

        this.testCase({
            name: "Dependencies Configuration: Make sure we don't fail for invalid arguments",
            test: () => {
                this._ajax = new AjaxMonitor();
                let dependencyFields = hookTrackDependencyInternal(this._ajax);
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentation_key",
                    maxAjaxCallsPerView: 5,
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                let throwSpy = this.sandbox.spy(appInsightsCore.logger, "throwInternal");

                var xhr = new XMLHttpRequest();
                xhr.open("GET", null);
                xhr.setRequestHeader("header name", "header value");
                xhr.send();
                // Emulate response
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");

                var xhr = new XMLHttpRequest();
                xhr.open("GET", undefined);
                xhr.setRequestHeader("header name", "header value");
                xhr.send();
                // Emulate response
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");

                Assert.equal(2, trackSpy.callCount, "Track has been called 2 times");
                Assert.equal(2, dependencyFields.length, "trackDependencyDataInternal should have been called");
                Assert.ok(dependencyFields[0].startTime, "startTime 0 was specified before trackDependencyDataInternal was called")
                Assert.ok(dependencyFields[1].startTime, "startTime 1 was specified before trackDependencyDataInternal was called")

                Assert.equal(false, throwSpy.called, "We should not have thrown an internal error -- yet");
            }
        });

        this.testCase({
            name: "Ajax: xhr.open gets instrumented",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                // act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "http://microsoft.com");

                // assert
                Assert.ok((<any>xhr).ajaxData)
                var ajaxData = (<any>xhr).ajaxData;
                Assert.equal("http://microsoft.com", ajaxData.requestUrl, "RequestUrl is collected correctly");
            }
        });

        this.testCase({
            name: "Ajax: xhr with disabled flag isn't tracked",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig: IConfiguration & IConfig = { instrumentationKey: "", disableAjaxTracking: false };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                // act
                var xhr = new XMLHttpRequest();
                xhr[DisabledPropertyName] = true;
                xhr.open("GET", "http://microsoft.com");

                // assert
                Assert.equal(undefined, (<any>xhr).ajaxData, "RequestUrl is collected correctly");
            }
        });

        this.testCase({
            name: "Ajax: xhr with disabled flag isn't tracked and any followup request to the same URL event without the disabled flag are also not tracked",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig: IConfiguration & IConfig = { instrumentationKey: "", disableAjaxTracking: false };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                // act
                var xhr = new XMLHttpRequest();
                xhr[DisabledPropertyName] = true;
                xhr.open("GET", "http://microsoft.com");

                // assert
                Assert.equal(undefined, (<any>xhr).ajaxData, "RequestUrl is collected correctly");

                xhr = new XMLHttpRequest();
                xhr.open("GET", "http://microsoft.com");

                // assert
                Assert.equal(undefined, (<any>xhr).ajaxData, "Follow up GET Request was not instrumented");

                xhr = new XMLHttpRequest();
                xhr.open("POST", "http://microsoft.com");

                // assert
                Assert.equal(undefined, (<any>xhr).ajaxData, "Follow up POST Request was not instrumented");
            }
        });

        this.testCase({
            name: "Ajax: xhr without disabled flag but with exclude string configured are not tracked",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                const ExcludeRequestRegex = ["microsoft"];
                let coreConfig: IConfiguration & IConfig = { instrumentationKey: "", disableAjaxTracking: true, excludeRequestFromAutoTrackingPatterns: ExcludeRequestRegex };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                // act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "http://microsoft.com");

                // assert
                Assert.equal(undefined, (<any>xhr).ajaxData, "RequestUrl is collected correctly");

                xhr = new XMLHttpRequest();
                xhr.open("GET", "http://microsoft.com");

                // assert
                Assert.equal(undefined, (<any>xhr).ajaxData, "Follow up GET Request was not instrumented");

                xhr = new XMLHttpRequest();
                xhr.open("POST", "http://microsoft.com");

                // assert
                Assert.equal(undefined, (<any>xhr).ajaxData, "Follow up POST Request was not instrumented");
            }
        });

        this.testCase({
            name: "Ajax: xhr request header is tracked as part C data when enableRequestHeaderTracking flag is true",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig: IConfiguration & IConfig = { instrumentationKey: "abc", disableAjaxTracking: false, enableRequestHeaderTracking: true };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                var trackStub = this.sandbox.stub(appInsightsCore, "track");

                // act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "http://microsoft.com");
                xhr.setRequestHeader("header name", "header value");
                xhr.setRequestHeader("Authorization", "Authorization");
                xhr.send();

                // Emulate response
                (<any>xhr).respond(200, {}, "");

                // assert
                Assert.ok(trackStub.calledOnce, "track is called");
                let data = trackStub.args[0][0].baseData;
                Assert.equal("Ajax", data.type, "request is Ajax type");
                Assert.notEqual(undefined, data.properties.requestHeaders, "xhr request's request header is stored");
                Assert.equal(undefined, data.properties.requestHeaders["Authorization"], "xhr request's request header is not ignored when the header is in ignoreHeaders");
                Assert.equal(undefined, data.properties.responseHeaders, "xhr request's reponse header is not stored when enableResponseHeaderTracking flag is not set, default is false");
            }
        });

        this.testCase({
            name: "Ajax: xhr request header is tracked as part C data when enableResponseHeaderTracking flag is true",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig: IConfiguration & IConfig = { instrumentationKey: "abc", disableAjaxTracking: false, enableResponseHeaderTracking: true };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                var trackStub = this.sandbox.stub(appInsightsCore, "track");

                // act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "http://microsoft.com");
                xhr.send();

                // Emulate response
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*","Authorization":"Authorization"}, "");

                // assert
                Assert.ok(trackStub.calledOnce, "track is called");
                let data = trackStub.args[0][0].baseData;
                Assert.equal("Ajax", data.type, "request is Ajax type");
                Assert.equal(undefined, data.properties.requestHeaders, "xhr request's request header is not stored when enableRequestHeaderTracking flag is not set, default is false");
                Assert.notEqual(undefined, data.properties.responseHeaders, "xhr request's reponse header is stored");
                Assert.equal(undefined, data.properties.responseHeaders["Authorization"], "xhr request's reponse header is not ignored when the header is in ignoreHeader");
            }
        });

        this.testCase({
            name: "Ajax: xhr respond error data is tracked as part C data when enableAjaxErrorStatusText flag is true",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig: IConfiguration & IConfig = { instrumentationKey: "abc", disableAjaxTracking: false, enableAjaxErrorStatusText: true };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                var trackStub = this.sandbox.stub(appInsightsCore, "track");

                // act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "http://microsoft.com");
                xhr.send();

                // Emulate response
                (<any>xhr).respond(403, {}, "error data with status code 403");

                // assert
                Assert.ok(trackStub.calledOnce, "track is called");
                let data = trackStub.args[0][0].baseData;
                Assert.equal("Ajax", data.type, "request is Ajax type");
                Assert.notEqual(undefined, data.properties.responseText, "xhr request's reponse error is stored in part C");
                Assert.strictEqual("Forbidden - error data with status code 403", data.properties.responseText, "xhr responseType is \"\"");

                // act
                var xhr2 = new XMLHttpRequest();
                xhr2.open("GET", "http://microsoft.com");
                xhr2.responseType = "json";
                xhr2.send();

                // Emulate response
                let responseJSON = '{ "error":"error data with status code 403" }';
                (<any>xhr2).respond(403, {}, responseJSON);

                // assert
                Assert.ok(trackStub.calledTwice, "track is called");
                data = trackStub.args[1][0].baseData;
                Assert.equal("Ajax", data.type, "request is Ajax type");
                Assert.notEqual(undefined, data.properties.responseText, "xhr request's reponse error is stored in part C");
                Assert.strictEqual("Forbidden - {\"error\":\"error data with status code 403\"}", data.properties.responseText, "xhr responseType is JSON, response got parsed");
            }
        });

        this.testCaseAsync({
            name: "Fetch: fetch with disabled flag isn't tracked",
            stepDelay: 10,
            autoComplete: false,
            timeOut: 10000,
            steps: [ (testContext) => {
                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "", disableFetchTracking: false };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let fetchSpy = this.sandbox.spy(appInsightsCore, "track")

                // Act
                Assert.ok(fetchSpy.notCalled, "No fetch called yet");
                fetch("https://httpbin.org/status/200", {method: "post", [DisabledPropertyName]: true}).then(() => {
                    // Assert
                    Assert.ok(fetchSpy.notCalled, "The request was not tracked");
                    testContext.testDone();
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
        });

        this.testCaseAsync({
            name: "Fetch: fetch with disabled flag isn't tracked and any followup request to the same URL event without the disabled flag are also not tracked",
            stepDelay: 10,
            autoComplete: false,
            timeOut: 10000,
            steps: [ (testContext) => {
                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "", disableFetchTracking: false };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let fetchSpy = this.sandbox.spy(appInsightsCore, "track")

                // Act
                Assert.ok(fetchSpy.notCalled, "No fetch called yet");
                fetch("https://httpbin.org/status/200", {method: "post", [DisabledPropertyName]: true}).then(() => {
                    // Assert
                    Assert.ok(fetchSpy.notCalled, "The initial request was not tracked");

                    fetch("https://httpbin.org/status/200", {method: "post" }).then(() => {
                        // Assert
                        Assert.ok(fetchSpy.notCalled, "The follow up request should also not have been tracked");
                        testContext.testDone();
                    }, () => {
                        Assert.ok(false, "fetch failed!");
                        testContext.testDone();
                    });
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
        });

        this.testCaseAsync({
            name: "Fetch: fetch with disabled flag false and with exclude request regex pattern isn't tracked and any followup request to the same URL event without the disabled flag are also not tracked",
            stepDelay: 10,
            autoComplete: false,
            timeOut: 10000,
            steps: [ (testContext) => {
                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                const ExcludeRequestRegex = ["bin"];
                let coreConfig = { instrumentationKey: "", disableFetchTracking: false, excludeRequestFromAutoTrackingPatterns: ExcludeRequestRegex };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let fetchSpy = this.sandbox.spy(appInsightsCore, "track")

                // Act
                Assert.ok(fetchSpy.notCalled, "No fetch called yet");
                fetch("https://httpbin.org/status/200", {method: "post"}).then(() => {
                    // Assert
                    Assert.ok(fetchSpy.notCalled, "The initial request was not tracked");

                    fetch("https://httpbin.org/status/200", {method: "post" }).then(() => {
                        // Assert
                        Assert.ok(fetchSpy.notCalled, "The follow up request should also not have been tracked");
                        testContext.testDone();
                    }, () => {
                        Assert.ok(false, "fetch failed!");
                        testContext.testDone();
                    });
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
        });

        this.testCaseAsync({
            name: "Fetch: fetch gets instrumented",
            stepDelay: 10,
            autoComplete: false,
            timeOut: 10000,
            steps: [ (testContext) => {
                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let dependencyFields = hookTrackDependencyInternal(this._ajax);
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "", disableFetchTracking: false };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let fetchSpy = this.sandbox.spy(appInsightsCore, "track")
                let throwSpy = this.sandbox.spy(appInsightsCore.logger, "throwInternal");

                // Act
                Assert.ok(fetchSpy.notCalled, "No fetch called yet");
                fetch("https://httpbin.org/status/200", {method: "post", [DisabledPropertyName]: false}).then(() => {
                    // Assert
                    Assert.ok(fetchSpy.calledOnce, "createFetchRecord called once after using fetch");
                    let data = fetchSpy.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fetch type");
                    Assert.ok(throwSpy.notCalled, "Make sure we didn't fail internally");
                    Assert.equal(1, dependencyFields.length, "trackDependencyDataInternal was called");
                    Assert.ok(dependencyFields[0].startTime, "startTime was specified before trackDependencyDataInternal was called")
                    testContext.testDone();
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
        });

        this.testCaseAsync({
            name: "Fetch: instrumentation handles invalid / missing request or url",
            stepDelay: 10,
            autoComplete: false,
            timeOut: 10000,
            steps: [ (testContext) => {
                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let dependencyFields = hookTrackDependencyInternal(this._ajax);
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "", disableFetchTracking: false };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let fetchSpy = this.sandbox.spy(appInsightsCore, "track")
                let throwSpy = this.sandbox.spy(appInsightsCore.logger, "throwInternal");

                // Act
                Assert.ok(fetchSpy.notCalled, "No fetch called yet");
                fetch(null, {method: "post", [DisabledPropertyName]: false}).then(() => {
                    // Assert
                    Assert.ok(fetchSpy.calledOnce, "createFetchRecord called once after using fetch");
                    let data = fetchSpy.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fetch type");
                    Assert.equal(false, throwSpy.called, "We should not have failed internally");
                    Assert.equal(1, dependencyFields.length, "trackDependencyDataInternal was called");
                    Assert.ok(dependencyFields[0].startTime, "startTime was specified before trackDependencyDataInternal was called")

                    fetch(undefined, null).then(() => {
                        // Assert
                        Assert.ok(fetchSpy.calledTwice, "createFetchRecord called once after using fetch");
                        Assert.equal(false, throwSpy.called, "We should still not have failed internally");
                        Assert.equal(2, dependencyFields.length, "trackDependencyDataInternal was called");
                        Assert.ok(dependencyFields[1].startTime, "startTime was specified before trackDependencyDataInternal was called");
                        testContext.testDone();
                    }, () => {
                        Assert.ok(false, "fetch failed!");
                        testContext.testDone();
                    });
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
        });

        this.testCase({
            name: "Fetch: fetch keeps custom headers",
            test: () => {
                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve();
                    }, 0);
                });

                try {
                    this._ajax = new AjaxMonitor();
                    let appInsightsCore = new AppInsightsCore();
                    let coreConfig = {
                        instrumentationKey: "",
                        disableFetchTracking: false,
                        disableAjaxTracking: true
                    };
                    appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                    let fetchSpy = this.sandbox.spy(window, "fetch");

                    // Setup
                    let headers = new Headers();
                    headers.append('My-Header', 'Header field');
                    let init = {
                        method: 'get',
                        headers: headers
                    };
                    const url = 'https://httpbin.org/status/200';

                    let headerSpy = this.sandbox.spy(this._ajax, "includeCorrelationHeaders");

                    // Act
                    Assert.ok(fetchSpy.notCalled);
                    fetch(url, init);

                    // Assert
                    Assert.ok(fetchSpy.calledOnce);
                    Assert.ok(headerSpy.calledOnce);
                    Assert.deepEqual(init, headerSpy.returnValue || headerSpy.returnValues[0]);
            } catch (e) {
                    console && console.warn("Exception: " + e);
                    Assert.ok(false, e);
                }
            }
        });

        this.testCaseAsync({
            name: "Fetch: should create and pass a traceparent header if ai and w3c is enabled with custom headers",
            stepDelay: 10,
            timeOut: 10000,
            steps: [ (testContext) => {
                let fetchCalls = hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    disableFetchTracking: false,
                    disableAjaxTracking: false,
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI_AND_W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Setup
                let headers = new Headers();
                headers.append('My-Header', 'Header field');
                let init = {
                    method: 'get',
                    headers: headers
                };
                const url = 'https://httpbin.org/status/200';

                // Act
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch(url, init).then(() => {
                    // Assert
                    Assert.ok(trackSpy.called, "The request was not tracked");
                    // Assert that both headers are sent
                    Assert.equal(1, fetchCalls.length);
                    Assert.notEqual(undefined, fetchCalls[0].init, "Has init param");
                    let headers:Headers = fetchCalls[0].init.headers as Headers;
                    Assert.notEqual(undefined, headers, "has headers");
                    Assert.equal(true, headers.has("My-Header"), "My-Header should be present");
                    Assert.equal(true, headers.has(RequestHeaders.requestIdHeader), "AI header shoud be present"); // AI
                    Assert.equal(true, headers.has(RequestHeaders.traceParentHeader), "W3c header should be present"); // W3C
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fatch type");
                    var id = data.id;
                    Assert.equal("|", id[0]);
                    Assert.equal(".", id[id.length - 1]);
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        })

        this.testCaseAsync({
            name: "Fetch: should create and pass a traceparent header if ai and w3c is enabled with no init param",
            stepDelay: 10,
            timeOut: 10000,
            steps: [ (testContext) => {
                let fetchCalls = hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    disableFetchTracking: false,
                    disableAjaxTracking: false,
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI_AND_W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Setup
                const url = 'https://httpbin.org/status/200';

                // Act
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch(url).then(() => {
                    // Assert
                    Assert.ok(trackSpy.called, "The request was not tracked");
                    // Assert that both headers are sent
                    Assert.equal(1, fetchCalls.length);
                    Assert.notEqual(undefined, fetchCalls[0].init, "Has init param");
                    let headers:Headers = fetchCalls[0].init.headers as Headers;
                    Assert.notEqual(undefined, headers, "has headers");
                    Assert.equal(true, headers.has(RequestHeaders.requestIdHeader), "AI header shoud be present"); // AI
                    Assert.equal(true, headers.has(RequestHeaders.traceParentHeader), "W3c header should be present"); // W3C
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fatch type");
                    var id = data.id;
                    Assert.equal("|", id[0]);
                    Assert.equal(".", id[id.length - 1]);
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        })

        this.testCaseAsync({
            name: "Fetch: should create and pass a traceparent header if w3c only is enabled with custom headers",
            stepDelay: 10,
            timeOut: 10000,
            steps: [ (testContext) => {
                let fetchCalls = hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    disableFetchTracking: false,
                    disableAjaxTracking: false,
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Setup
                let headers = new Headers();
                headers.append('My-Header', 'Header field');
                let init = {
                    method: 'get',
                    headers: headers
                };
                const url = 'https://httpbin.org/status/200';

                // Act
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch(url, init).then(() => {
                    // Assert
                    Assert.ok(trackSpy.called, "The request was not tracked");
                    // Assert that both headers are sent
                    Assert.equal(1, fetchCalls.length);
                    Assert.notEqual(undefined, fetchCalls[0].init, "Has init param");
                    let headers:Headers = fetchCalls[0].init.headers as Headers;
                    Assert.notEqual(undefined, headers, "has headers");
                    Assert.equal(true, headers.has("My-Header"), "My-Header should be present");
                    Assert.equal(false, headers.has(RequestHeaders.requestIdHeader), "AI header shoud be present"); // AI
                    Assert.equal(true, headers.has(RequestHeaders.traceParentHeader), "W3c header should be present"); // W3C
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fatch type");
                    var id = data.id;
                    Assert.equal("|", id[0]);
                    Assert.equal(".", id[id.length - 1]);
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        })

        this.testCaseAsync({
            name: "Fetch: should create and pass a traceparent header if w3c only is enabled with no init param",
            stepDelay: 10,
            timeOut: 10000,
            steps: [ (testContext) => {
                let fetchCalls = hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    disableFetchTracking: false,
                    disableAjaxTracking: false,
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Setup
                const url = 'https://httpbin.org/status/200';

                // Act
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch(url).then(() => {
                    // Assert
                    Assert.ok(trackSpy.called, "The request was not tracked");
                    // Assert that both headers are sent
                    Assert.equal(1, fetchCalls.length);
                    Assert.notEqual(undefined, fetchCalls[0].init, "Has init param");
                    let headers:Headers = fetchCalls[0].init.headers as Headers;
                    Assert.notEqual(undefined, headers, "has headers");
                    Assert.equal(false, headers.has(RequestHeaders.requestIdHeader), "AI header shoud be present"); // AI
                    Assert.equal(true, headers.has(RequestHeaders.traceParentHeader), "W3c header should be present"); // W3C
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fatch type");
                    var id = data.id;
                    Assert.equal("|", id[0]);
                    Assert.equal(".", id[id.length - 1]);
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        })

        this.testCaseAsync({
            name: "Fetch: should create and pass a request header if AI only is enabled with custom headers",
            stepDelay: 10,
            timeOut: 10000,
            steps: [ (testContext) => {
                let fetchCalls = hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    disableFetchTracking: false,
                    disableAjaxTracking: false,
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Setup
                let headers = new Headers();
                headers.append('My-Header', 'Header field');
                let init = {
                    method: 'get',
                    headers: headers
                };
                const url = 'https://httpbin.org/status/200';

                // Act
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch(url, init).then(() => {
                    // Assert
                    Assert.ok(trackSpy.called, "The request was not tracked");
                    // Assert that both headers are sent
                    Assert.equal(1, fetchCalls.length);
                    Assert.notEqual(undefined, fetchCalls[0].init, "Has init param");
                    let headers:Headers = fetchCalls[0].init.headers as Headers;
                    Assert.notEqual(undefined, headers, "has headers");
                    Assert.equal(true, headers.has("My-Header"), "My-Header should be present");
                    Assert.equal(true, headers.has(RequestHeaders.requestIdHeader), "AI header shoud be present"); // AI
                    Assert.equal(false, headers.has(RequestHeaders.traceParentHeader), "W3c header should be present"); // W3C
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fatch type");
                    var id = data.id;
                    Assert.equal("|", id[0]);
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        })

        this.testCaseAsync({
            name: "Fetch: should create and pass a request header if AI only is enabled with no init param",
            stepDelay: 10,
            timeOut: 10000,
            steps: [ (testContext) => {
                let fetchCalls = hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    disableFetchTracking: false,
                    disableAjaxTracking: false,
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Setup
                const url = 'https://httpbin.org/status/200';

                // Act
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch(url).then(() => {
                    // Assert
                    Assert.ok(trackSpy.called, "The request was not tracked");
                    // Assert that both headers are sent
                    Assert.equal(1, fetchCalls.length);
                    Assert.notEqual(undefined, fetchCalls[0].init, "Has init param");
                    let headers:Headers = fetchCalls[0].init.headers as Headers;
                    Assert.notEqual(undefined, headers, "has headers");
                    Assert.equal(true, headers.has(RequestHeaders.requestIdHeader), "AI header shoud be present"); // AI
                    Assert.equal(false, headers.has(RequestHeaders.traceParentHeader), "W3c header should be present"); // W3C
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fatch type");
                    var id = data.id;
                    Assert.equal("|", id[0]);
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        })

        this.testCaseAsync({
            name: "Fetch: should add request headers to all valid argument variants",
            stepDelay: 10,
            timeOut: 10000,
            useFakeTimers: true,
            steps: [ (testContext) => {
                this._context["fetchCalls"] = hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    disableFetchTracking: false,
                    disableAjaxTracking: false,
                    enableRequestHeaderTracking: true,
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI_AND_W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Setup
                let headers = new Headers();
                headers.append('My-Header', 'Header field');
                headers.append("Authorization","Authorization");
                let init = {
                    method: 'get',
                    headers: headers
                };
                const url = 'https://httpbin.org/status/200';

                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch(url);
                fetch(url, {});
                fetch(url, { headers: {} });
                fetch(url, { headers: new Headers() });
                fetch(url, { headers });
                fetch(url, init);
                fetch(new Request(url));
                fetch(new Request(url, {}));
                fetch(new Request(url, { headers: {} }));
                fetch(new Request(url, { headers: new Headers() }));
                fetch(new Request(url, { headers }));
                fetch(new Request(url, init));
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                let fetchCalls = this._context["fetchCalls"] as IFetchArgs[];
                Assert.ok(true, "Track: " + trackStub.args.length + " Fetch Calls: " + fetchCalls.length);
                if (trackStub.called && trackStub.args.length === 12 && fetchCalls.length === 12) {
                    for (let lp = 0; lp < trackStub.args.length; lp++) {
                        let evtData = trackStub.args[lp][0];
                        this._checkFetchTraceId(evtData, "Fetch " + lp);
                        let properties = evtData.baseData.properties || {};
                        let trackHeaders = properties.requestHeaders || {};

                        Assert.notEqual(undefined, fetchCalls[lp].init, "Has init param");
                        let headers:Headers = fetchCalls[lp].init.headers as Headers;
                        Assert.notEqual(undefined, headers, "has headers");
                        switch (lp) {
                            case 4:
                            case 5:
                            case 10:
                            case 11:
                                // All headers should be added to the init (2nd param) as this overrides
                                // any headers on any request object
                                Assert.equal(true, headers.has("My-Header"), "My-Header should be present");
                                Assert.equal(true, headers.has("Authorization"), "Authorization should be present");
                                Assert.equal("Header field", trackHeaders["my-header"], "my-header present in outbound event");
                                Assert.equal(undefined, trackHeaders["Authorization"],"Authorization header should be ignored")
                                break;
                        }

                        Assert.equal(true, headers.has(RequestHeaders.requestContextHeader), "requestContext header shoud be present");
                        Assert.equal(true, headers.has(RequestHeaders.requestIdHeader), "AI header shoud be present"); // AI
                        Assert.equal(true, headers.has(RequestHeaders.traceParentHeader), "W3c header should be present"); // W3C

                        Assert.notEqual(undefined, trackHeaders[RequestHeaders.requestIdHeader], "RequestId present in outbound event");
                        Assert.notEqual(undefined, trackHeaders[RequestHeaders.requestContextHeader], "RequestContext present in outbound event");
                        Assert.notEqual(undefined, trackHeaders[RequestHeaders.traceParentHeader], "traceParent present in outbound event");

                    }

                    return true;
                }

                this.clock.tick(1000);
                return false;
            }, 'response received', 60, 1000) as any)
        })

        this.testCase({
            name: "Ajax: successful request, ajax monitor doesn't change payload",
            test: () => {
                var callback = this.sandbox.spy();
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                // Act
                var xhr = new XMLHttpRequest();
                xhr.onload = callback;
                xhr.open("GET", "example.com/bla");
                xhr.send();


                // Emulate response
                (<any>xhr).respond(200, { "Content-Type": "application/json" }, "bla");
                //Assert.ok((<any>ajaxMonitor)._trackAjaxAttempts === 1, "TrackAjax is called");

                // Assert
                var result = callback.args[0][0].target;
                Assert.ok(callback.called, "Ajax callback is called");
                Assert.equal("bla", result.responseText, "Expected result match");
                Assert.equal(200, result.status, "Expected 200 response code");
                Assert.equal(4, xhr.readyState, "Expected readyState is 4 after request is finished");
            }
        });

        this.testCase({
            name: "Ajax: custom onreadystatechange gets called",
            useFakeServer: true,
            useFakeTimers: true,
            test: () => {
                var onreadystatechangeSpy = this.sandbox.spy();
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                var trackStub = this.sandbox.stub(appInsightsCore, "track");

                // Act
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = onreadystatechangeSpy;
                xhr.open("GET", "example.com/bla");
                xhr.send();

                Assert.ok(trackStub.notCalled, "track should not be called yet");

                // Emulate response
                (<any>xhr).respond(200, {}, "");

                // Assert
                Assert.ok(trackStub.called, "TrackAjax is called");
                Assert.ok(onreadystatechangeSpy.callCount >= 4, "custom onreadystatechange should be called");
            }
        });

        this.testCase({
            name: "Ajax: 200 means success",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                var trackStub = this.sandbox.stub(appInsightsCore, "track");

                // Act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "example.com/bla");
                xhr.send();

                // Emulate response
                (<any>xhr).respond(200, {}, "");

                // Assert
                let data = trackStub.args[0][0].baseData;
                Assert.equal("Ajax", data.type, "request is Ajax type");
                Assert.equal(true, data.success, "TrackAjax should receive true as a 'success' argument");
            }
        });

        this.testCase({
            name: "Ajax: non 200 means failure",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                var trackStub = this.sandbox.stub(appInsightsCore, "track");

                // Act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "example.com/bla");
                xhr.send();

                // Emulate response
                (<any>xhr).respond(404, {}, "");

                // Assert
                let data = trackStub.args[0][0].baseData;
                Assert.equal("Ajax", data.type, "request is Ajax type");
                Assert.equal(false, data.success, "TrackAjax should receive false as a 'success' argument");
            }
        });

        [200, 201, 202, 203, 204, 301, 302, 303, 304].forEach((responseCode) => {
            this.testCase({
                name: "Ajax: test success http response code: " + responseCode,
                test: () => {
                    this.testAjaxSuccess(responseCode, true);
                }
            })
        });

        [400, 401, 402, 403, 404, 500, 501].forEach((responseCode) => {
            this.testCase({
                name: "Ajax: test failure http response code: " + responseCode,
                test: () => {
                    this.testAjaxSuccess(responseCode, false);
                }
            })
        });

        this.testCase({
            name: "Ajax: overriding ready state change handlers in all possible ways",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                var trackStub = this.sandbox.stub(appInsightsCore, "track");
                var cb1 = this.sandbox.spy();
                var cb2 = this.sandbox.spy();
                var cb3 = this.sandbox.spy();
                var cb4 = this.sandbox.spy();
                var cb5 = this.sandbox.spy();
                var cb6 = this.sandbox.spy();
                var cb7 = this.sandbox.spy();

                // Act
                var xhr = new XMLHttpRequest();
                xhr.addEventListener("readystatechange", cb1);
                xhr.addEventListener("readystatechange", cb2);
                xhr.open("GET", "example.com/bla");
                xhr.onreadystatechange = cb3;
                xhr.addEventListener("readystatechange", cb4);
                xhr.addEventListener("readystatechange", cb5);
                xhr.send();
                xhr.addEventListener("readystatechange", cb6);
                xhr.addEventListener("readystatechange", cb7);

                Assert.ok(!trackStub.called, "TrackAjax should not be called yet");

                // Emulate response
                (<any>xhr).respond(404, {}, "");

                // Assert
                Assert.ok(trackStub.calledOnce, "TrackAjax should be called");
                Assert.ok(cb1.called, "callback 1 should be called");
                Assert.ok(cb2.called, "callback 2 should be called");
                Assert.ok(cb3.called, "callback 3 should be called");
                Assert.ok(cb4.called, "callback 4 should be called");
                Assert.ok(cb5.called, "callback 5 should be called");
                Assert.ok(cb6.called, "callback 6 should be called");
                Assert.ok(cb7.called, "callback 7 should be called");
            }
        });

        this.testCase({
            name: "Ajax: test ajax duration is calculated correctly",
            test: () => {
                var initialPerformance = window.performance;
                this._ajax = new AjaxMonitor();
                try {
                    // Mocking window performance (sinon doesn't have it).
                    // tick() is similar to sinon's clock.tick()
                    (<any>window).performance = <any>{
                        current: 0,

                        now: function () {
                            return this.current;
                        },

                        tick: function (ms: number) {
                            this.current += ms;
                        },

                        timing: initialPerformance.timing
                    };

                    let appInsightsCore = new AppInsightsCore();
                    let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                    appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                    var trackStub = this.sandbox.stub(appInsightsCore, "track");
                // tick to set the initial time be non zero
                    (<any>window.performance).tick(23);

                    // Act
                    var xhr = new XMLHttpRequest();
                    var clock = this.clock;
                    var expectedResponseDuration = 50;
                    xhr.onreadystatechange = () => {
                        if (xhr.readyState == 3) {
                            (<any>window.performance).tick(expectedResponseDuration);
                        }
                    }
                    xhr.open("GET", "example.com/bla");
                    xhr.send();
                    // Emulate response
                    (<any>xhr).respond(404, {}, "");

                    // Assert
                    Assert.ok(trackStub.calledOnce, "TrackAjax should be called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Ajax", data.type, "It should be an XHR request");
                    Assert.ok(data.startTime);
                    Assert.equal(expectedResponseDuration, data.duration, "Ajax duration should match expected duration");
                } finally {
                    (<any>window.performance) = initialPerformance;
                }
            }
        });

        this.testCase({
            name: "Ajax: 2nd invokation of xhr.send doesn't cause send wrapper to execute 2nd time",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                var spy = this.sandbox.spy(this._ajax, "includeCorrelationHeaders");
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "example.com/bla");
                xhr.send();

                try {
                    xhr.send();
                } catch (e) { }

                // Emulate response
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");

                // Assert
                Assert.ok(spy.calledOnce, "sendPrefixInstrumentor/includeCorrelationHeaders should be called only once");
            }
        });

        this.testCase({
            name: "Ajax: 2nd invokation of xhr.send doesn't cause send wrapper to execute 2nd time even if after response",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                var spy = this.sandbox.spy(this._ajax, "includeCorrelationHeaders");
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "example.com/bla");
                xhr.send();

                // Emulate response
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");

                try {
                    xhr.send();
                } catch (e) { }

                // Assert
                Assert.ok(spy.calledOnce, "sendPrefixInstrumentor/includeCorrelationHeaders should be called only once");
            }
        });

        this.testCase({
            name: "Ajax: 2 invokation of xhr.open() doesn't cause send wrapper to execute 2nd time",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);

                // Act
                var xhr = new XMLHttpRequest();
                xhr.open("GET", "example.com/bla");


                Assert.equal("GET", xhr["ajaxData"].method, "Expecting the ajax data set the method");
                // Reset the method to something else
                xhr["ajaxData"].method = "TEST";

                try {
                    xhr.open("GET", "example.com/bla");
                } catch (e) { }

                Assert.equal("TEST", xhr["ajaxData"].method, "sendPrefixInstrumentor should be called only once");
            }
        });

        this.testCase({
            name: "Ajax: should create and pass a traceparent header if w3c is enabled",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI_AND_W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                var trackStub = this.sandbox.stub(appInsightsCore, "track");

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "www.example.com";

                // Act
                var xhr = new XMLHttpRequest();
                var stub = this.sandbox.stub(xhr, "setRequestHeader");
                xhr.open("GET", "http://www.example.com");
                xhr.send();

                // Assert that both headers are sent
                Assert.equal(true, stub.calledWith(RequestHeaders.requestIdHeader)); // AI
                Assert.equal(true, stub.calledWith(RequestHeaders.traceParentHeader)); // W3C

                // Emulate response so perf monitoring is cleaned up
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");
                var id = trackStub.args[0][0].baseData.id;
                Assert.equal("|", id[0]);
                Assert.equal(".", id[id.length - 1]);
            }
        });

        this.testCase({
            name: "Ajax: should not create and pass a traceparent header if correlationHeaderExcludePatterns set to exclude all",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    correlationHeaderExcludePatterns: [/.*/],
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI_AND_W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                var trackStub = this.sandbox.stub(appInsightsCore, "track");

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "www.example.com";

                // Act
                var xhr = new XMLHttpRequest();
                var stub = this.sandbox.stub(xhr, "setRequestHeader");
                xhr.open("GET", "http://www.example.com");
                xhr.send();

                // Assert that both headers are not sent
                Assert.equal(false, stub.calledWith(RequestHeaders.requestIdHeader)); // AI
                Assert.equal(false, stub.calledWith(RequestHeaders.traceParentHeader)); // W3C

                // Emulate response so perf monitoring is cleaned up
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");
                var id = trackStub.args[0][0].baseData.id;
                Assert.equal("|", id[0]);
                Assert.equal(".", id[id.length - 1]);
            }
        });

        this.testCase({
            name: "Ajax: should create and only pass a traceparent header if w3c is enabled",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "www.example.com";

                // Act
                var xhr = new XMLHttpRequest();
                var stub = this.sandbox.stub(xhr, "setRequestHeader");
                xhr.open("GET", "http://www.example.com");
                xhr.send();

                // Assert that the AI header was not included
                Assert.equal(false, stub.calledWith(RequestHeaders.requestIdHeader)); // AI
                // Assert that the W3C header is included
                Assert.equal(true, stub.calledWith(RequestHeaders.traceParentHeader)); // W3C

                // Emulate response
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");
            }
        })

        this.testCase({
            name: "Ajax: should create and only pass AI is enabled",
            test: () => {
                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "www.example.com";

                // Act
                var xhr = new XMLHttpRequest();
                var stub = this.sandbox.stub(xhr, "setRequestHeader");
                xhr.open("GET", "http://www.example.com");
                xhr.send();

                // Assert that the AI header was not included
                Assert.equal(true, stub.calledWith(RequestHeaders.requestIdHeader)); // AI
                // Assert that the W3C header is included
                Assert.equal(false, stub.calledWith(RequestHeaders.traceParentHeader)); // W3C

                // Emulate response
                (<any>xhr).respond(200, {"Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*"}, "");
            }
        })
    }

    private testAjaxSuccess(responseCode: number, success: boolean) {
        this._ajax = new AjaxMonitor();
        let appInsightsCore = new AppInsightsCore();
        let coreConfig = { instrumentationKey: "instrumentationKey", extensionConfig: {"AjaxPlugin": {}}};
        appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
        var trackStub = this.sandbox.stub(appInsightsCore, "track");

        // Act
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "example.com/bla");
        xhr.send();

        // Emulate response
        (<any>xhr).respond(responseCode, {}, "");

        // Assert
        let data = trackStub.args[0][0].baseData;
        Assert.equal("Ajax", data.type, "request is Ajax type");
        Assert.equal(success, data.success, "TrackAjax should receive " + success + " as a 'success' argument");
    }

    private _checkFetchTraceId(evtData:any, message:string) {
        Assert.notEqual(undefined, evtData, message + " - Must have track data");
        if (evtData) {
            let data = evtData.baseData;
            Assert.equal("Fetch", data.type, message + " - request is Fatch type");
            var id = data.id;
            Assert.equal("|", id[0], message + " - check id starts with |");
            Assert.equal(".", id[id.length - 1], message + " - check id ends with .");
        }
    }
}

export class AjaxPerfTrackTests extends AITestClass {

    private _fetch:any;
    private _ajax:AjaxMonitor;
    private _initialPerformance: Performance;
    private _perfEntries: PerformanceEntry[];
    private _context:any;

    constructor(name?: string) {
        super(name);

        this.useFakeServer = false;
        this._perfEntries = [];
        this._context = {};
    }

    public addPerfEntry(entry:any) {
        this._perfEntries.push(entry);
    }

    public testInitialize() {
        this._context = {};
        this._fetch = getGlobalInst("fetch");

        let performance = getPerformance();
        if (performance && performance.clearResourceTimings) {
            // Make sure we don't pick up some elses value
            performance.clearResourceTimings();
        }

        let testThis = this;
        testThis._initialPerformance = performance;

        testThis._perfEntries = [];

        // Add polyfil / mock
        (<any>window).performance = {
            _current: 0,
            _tick: function (ms: number) {
                this._current += ms;
            },
            now: function() {
                return this._current;
            },
            getEntries: function() {
                return testThis._perfEntries;
            },
            getEntriesByName: function (name) {
                let result = [];
                testThis._perfEntries.forEach((entry) => {
                    if (entry.name === name) {
                        result.push(entry);
                    }
                });
                return result;
            },
            mark: function (name) {
                testThis.addPerfEntry({
                    entryType: "mark",
                    name: name,
                    startTime: this._current,
                    duration: 0
                });
            }
        }
    }

    public testCleanup() {
        this._context = {};
        if (this._ajax) {
            this._ajax.teardown();
            this._ajax = null;
        }

        if (this._initialPerformance) {
            (<any>window).performance = this._initialPerformance;
            this._initialPerformance = null;
        }

        // Restore the real fetch
        window.fetch = this._fetch;
    }

    public registerTests() {

        this.testCaseAsync({
            name: "AjaxPerf: check that performance tracking is disabled for xhr requests by default",
            stepDelay: 10,
            steps: [ () => {
                let performance = getPerformance();
                let markSpy = this.sandbox.spy(performance, "mark");

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId"
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Used to "wait" for App Insights to finish initializing which should complete after the XHR request
                this._context["trackStub"] = this.sandbox.stub(appInsightsCore, "track");


                // Act
                var xhr = new XMLHttpRequest();

                // trigger the request that should cause a track event once the xhr request is complete
                xhr.open("GET", "https://httpbin.org/status/200");
                xhr.send();
                Assert.equal(false, markSpy.called, "The code should not have called mark()");
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Ajax", data.type, "request is Ajax type");
                    let props = data.properties || {};
                    Assert.equal(undefined, props.ajaxPerf, "Should contain properties perf object");
                    return true;
                }

                return false;
            }, 'response received', 600, 1000) as any)
        });

        this.testCaseAsync({
            name: "AjaxPerf: check that performance tracking is included when enabled for xhr requests",
            stepDelay: 10,
            steps: [ (testContext) => {
                let performance = getPerformance();
                let markSpy = this.sandbox.spy(performance, "mark");

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            enableAjaxPerfTracking: true
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Used to "wait" for App Insights to finish initializing which should complete after the XHR request
                this._context["trackStub"] = this.sandbox.stub(appInsightsCore, "track");

                // Act
                var xhr = new XMLHttpRequest();

                // trigger the request that should cause a track event once the xhr request is complete
                xhr.open("GET", "https://httpbin.org/status/200");
                xhr.send();
                Assert.equal(true, markSpy.called, "The code should have called been mark()");
                this.addPerfEntry({
                    entryType: "resource",
                    initiatorType: "xmlhttprequest",
                    name: "https://httpbin.org/status/200",
                    startTime: getPerformance().now(),
                    duration: 10
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Ajax", data.type, "request is Ajax type");
                    let props = data.properties;
                    Assert.notEqual(undefined, props, "Should contain properties");
                    if (props) {
                        let perf = props.ajaxPerf || {};
                        Assert.equal(10, perf.duration, "Duration exists - " + JSON.stringify(data));
                    }
                    return true;
                }

                return false;
            }, 'response received', 600, 1000) as any)
        });

        this.testCaseAsync({
            name: "AjaxPerf: check that performance tracking is included when enabled for xhr requests with server timing",
            stepDelay: 10,
            steps: [ (testContext) => {
                let performance = getPerformance();
                let markSpy = this.sandbox.spy(performance, "mark");

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            enableAjaxPerfTracking: true
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Used to "wait" for App Insights to finish initializing which should complete after the XHR request
                this._context["trackStub"] = this.sandbox.stub(appInsightsCore, "track");

                // Act
                var xhr = new XMLHttpRequest();

                // trigger the request that should cause a track event once the xhr request is complete
                xhr.open("GET", "https://httpbin.org/status/200");
                xhr.send();
                Assert.equal(true, markSpy.called, "The code should have called been mark()");
                this.addPerfEntry({
                    entryType: "resource",
                    initiatorType: "xmlhttprequest",
                    name: "https://httpbin.org/status/200",
                    startTime: getPerformance().now(),
                    duration: 10,
                    serverTiming: [
                        { name: "cache", duration: 23.2, description: "Cache Read"},
                        { name: "db", duration: 53, description: ""},
                        { name: "app", duration: 47.2, description: ""},
                        { name: "dup", description: "dup1"},
                        { name: "dup", description: "dup2"},
                    ]
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Ajax", data.type, "request is Ajax type");
                    let props = data.properties;
                    Assert.notEqual(undefined, props, "Should contain properties");
                    if (props) {
                        let perf = props.ajaxPerf || {};
                        Assert.equal(10, perf.duration, "Duration exists - " + JSON.stringify(data));
                        Assert.equal(23.2, perf.serverTiming.cache.duration, "Check that the server timing was set")
                        Assert.equal("Cache Read", perf.serverTiming.cache.description, "Check that the server timing was set")
                        Assert.equal("dup1;dup2", perf.serverTiming.dup.description, "Check that the server timing was set")
                    }
                    return true;
                }

                return false;
            }, 'response received', 600, 1000) as any)
        });

        this.testCaseAsync({
            name: "AjaxPerf: check that performance tracking is reported, even if the entry is missing when enabled for xhr requests",
            stepDelay: 10,
            steps: [ (testContext) => {
                let performance = getPerformance();
                let markSpy = this.sandbox.spy(performance, "mark");

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            enableAjaxPerfTracking: true
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Used to "wait" for App Insights to finish initializing which should complete after the XHR request
                this._context["trackStub"] = this.sandbox.stub(appInsightsCore, "track");

                // Act
                var xhr = new XMLHttpRequest();

                // trigger the request that should cause a track event once the xhr request is complete
                xhr.open("GET", "https://httpbin.org/status/200");
                xhr.send();
                Assert.equal(true, markSpy.called, "The code should have called been mark()");
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Ajax", data.type, "request is Ajax type");
                    let props = data.properties;
                    Assert.notEqual(undefined, props, "Should contain properties");
                    if (props) {
                        let perf = props.ajaxPerf || {};
                        Assert.equal(true, !!perf.missing, "Performance was executed but browser did not populate the window.performance entries - " + JSON.stringify(data));
                    }
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        });

        this.testCaseAsync({
            name: "AjaxPerf: check that performance tracking is disabled for fetch requests by default",
            stepDelay: 10,
            steps: [ (testContext) => {

                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve();
                    }, 0);
                });

                let performance = getPerformance();
                let markSpy = this.sandbox.spy(performance, "mark");

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId"
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "httpbin.org";

                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Send fetch request that should trigger a track event when complete
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch("https://httpbin.org/status/200", {method: "post",  }).then((value) => {
                    this._context["fetchComplete"] = true;
                    return value;
                });
                Assert.equal(false, markSpy.called, "The code should not have called been mark()");
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (this._context["fetchComplete"]) {
                    Assert.ok(trackStub.notCalled, "No fetch called yet");
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        });

        this.testCaseAsync({
            name: "AjaxPerf: check that performance tracking is included for fetch requests when enabled",
            stepDelay: 10,
            steps: [ (testContext) => {
                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                let performance = getPerformance();
                let markSpy = this.sandbox.spy(performance, "mark");

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            disableFetchTracking: false,
                            enableAjaxPerfTracking: true
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "www.example.com";

                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Send fetch request that should trigger a track event when complete
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch("https://httpbin.org/status/200", {method: "post" });
                Assert.equal(true, markSpy.called, "The code should have called been mark()");
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    window.console && window.console.warn("Performance Entries: " + window.performance.getEntries().length);

                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fetch type");
                    let props = data.properties;
                    Assert.notEqual(undefined, props, "Should contain properties");
                    if (props) {
                        let perf = props.ajaxPerf || {};
                        if (perf.missing) {
                            Assert.equal(true, !!perf.missing, "Performance was executed but browser did not populate the window.performance entries - " + JSON.stringify(data));
                        } else {
                            Assert.notEqual(undefined, perf.duration, "Duration exists - " + JSON.stringify(data));
                        }
                    }
                    return true;
                }

                return false;
            }, 'response received', 30, 1000) as any)
        });

        this.testCaseAsync({
            name: "AjaxPerf: check that performance tracking is included for fetch requests when enabled when the fetch has a delayed promise",
            stepDelay: 10,
            steps: [ (testContext) => {
                hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 500);
                });

                let performance = getPerformance();
                let markSpy = this.sandbox.spy(performance, "mark");

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            disableFetchTracking: false,
                            enableAjaxPerfTracking: true
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "www.example.com";

                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Send fetch request that should trigger a track event when complete
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch("https://httpbin.org/status/200", { method: "post" });
                Assert.equal(true, markSpy.called, "The code should have called been mark()");
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    window.console && window.console.warn("Performance Entries: " + window.performance.getEntries().length);

                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fetch type");
                    let props = data.properties;
                    Assert.notEqual(undefined, props, "Should contain properties");
                    if (props) {
                        Assert.notEqual(undefined, props.ajaxPerf, "Perf detail exists")
                        let perf = props.ajaxPerf || {};
                        if (perf.missing) {
                            Assert.equal(true, !!perf.missing, "Performance was executed but browser did not populate the window.performance entries - " + JSON.stringify(data));
                        } else {
                            Assert.notEqual(undefined, perf.duration, "Duration exists - " + JSON.stringify(data));
                        }
                    }
                    return true;
                }

                return false;
            }, 'response received', 600, 1000) as any)
        });

        this.testCaseAsync({
            name: "Fetch: should not create and pass correlation header if correlationHeaderExcludePatterns set to exclude all.",
            stepDelay: 10,
            timeOut: 10000,
            steps: [ (testContext) => {
                let fetchCalls = hookFetch((resolve) => {
                    AITestClass.orgSetTimeout(function() {
                        resolve({
                            headers: new Headers(),
                            ok: true,
                            body: null,
                            bodyUsed: false,
                            redirected: false,
                            status: 200,
                            statusText: "Hello",
                            trailer: null,
                            type: "basic",
                            url: "https://httpbin.org/status/200"
                        });
                    }, 0);
                });

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    disableFetchTracking: false,
                    disableAjaxTracking: false,
                    correlationHeaderExcludePatterns: [/.*/],
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId",
                            distributedTracingMode: DistributedTracingModes.AI_AND_W3C
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                let trackSpy = this.sandbox.spy(appInsightsCore, "track")
                this._context["trackStub"] = trackSpy;

                // Use test hook to simulate the correct url location
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Setup
                let headers = new Headers();
                headers.append('My-Header', 'Header field');
                let init = {
                    method: 'get',
                    headers
                };
                const url = 'https://httpbin.org/status/200';

                // Act
                Assert.ok(trackSpy.notCalled, "No fetch called yet");
                fetch(url, init).then(() => {
                    // Assert
                    Assert.ok(trackSpy.called, "The request was not tracked");
                    Assert.equal(1, fetchCalls.length);
                    Assert.notEqual(undefined, fetchCalls[0].init, "Has init param");
                    let headers:Headers = fetchCalls[0].init.headers as Headers;
                    Assert.equal(true, headers.has("My-Header"), "My-Header should be present");
                    Assert.equal(false, headers.has(RequestHeaders.requestIdHeader), "Correlation header - AI header should be excluded"); // AI
                    Assert.equal(false, headers.has(RequestHeaders.traceParentHeader), "Correlation header - W3c header should be excluded"); // W3C
                }, () => {
                    Assert.ok(false, "fetch failed!");
                    testContext.testDone();
                });
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let trackStub = this._context["trackStub"] as SinonStub;
                if (trackStub.called) {
                    Assert.ok(trackStub.calledOnce, "track is called");
                    let data = trackStub.args[0][0].baseData;
                    Assert.equal("Fetch", data.type, "request is Fatch type");
                    var id = data.id;
                    Assert.equal("|", id[0]);
                    Assert.equal(".", id[id.length - 1]);
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        })
    }
}

export class AjaxFrozenTests extends AITestClass {

    private _fetch:any;
    private _xmlHttpRequest:XMLHttpRequest;
    private _ajax:AjaxMonitor;
    private _context:any;

    constructor(name?: string) {
        super(name);

        this.useFakeServer = false;
        this._context = {};
    }

    public testInitialize() {
        this._context = {};
        this._fetch = getGlobalInst("fetch");
        this._xmlHttpRequest = getGlobalInst("XMLHttpRquest)");
    }

    public testCleanup() {
        this._context = {};
        if (this._ajax) {
            this._ajax.teardown();
            this._ajax = null;
        }

        // Restore the real fetch
        window.fetch = this._fetch;
        if (this._xmlHttpRequest) {
            getGlobal()["XMLHttpRequest"] = this._xmlHttpRequest;
        }
    }

    public registerTests() {

        this.testCaseAsync({
            name: "AjaxFrozenTests: check for prevent extensions",
            stepDelay: 10,
            steps: [ () => {
                Object.preventExtensions(XMLHttpRequest);
                Object.freeze(XMLHttpRequest);
                let reflect:any = getGlobalInst("Reflect");
                if (reflect) {
                    reflect.preventExtensions(XMLHttpRequest);
                }

                this._ajax = new AjaxMonitor();
                let appInsightsCore = new AppInsightsCore();
                let coreConfig = {
                    instrumentationKey: "instrumentationKey",
                    extensionConfig: {
                        "AjaxDependencyPlugin": {
                            appId: "appId"
                        }
                    }
                };
                appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
                this._ajax["_currentWindowHost"] = "httpbin.org";

                // Used to "wait" for App Insights to finish initializing which should complete after the XHR request
                this._context["trackStub"] = this.sandbox.stub(appInsightsCore, "track");
                this._context["throwSpy"] = this.sandbox.spy(appInsightsCore.logger, "throwInternal");

                // Act
                var xhr = new XMLHttpRequest();

                // Make sure the instance can't be changed
                Object.preventExtensions(xhr);
                Object.freeze(xhr);
                if (reflect) {
                    reflect["preventExtensions"](xhr);
                }

                // trigger the request that should cause a track event once the xhr request is complete
                xhr.open("GET", "https://httpbin.org/status/200");
                xhr.send();
            }]
            .concat(PollingAssert.createPollingAssert(() => {
                let throwSpy = this._context["throwSpy"] as SinonStub;
                if (throwSpy.called) {
                    Assert.ok(throwSpy.calledOnce, "track is called");
                    let message = throwSpy.args[0][2];
                    Assert.notEqual(-1, message.indexOf("Failed to monitor XMLHttpRequest"));
                    let data = throwSpy.args[0][3];
                    Assert.notEqual(-1, data.exception.indexOf("Cannot add property ajaxData"));
                    return true;
                }

                return false;
            }, 'response received', 60, 1000) as any)
        });

        // This is currently a manual test as we don't have hooks / mocks defined to automated this today
        // this.testCaseAsync({
        //     name: "AjaxFrozenTests: check frozen prototype",
        //     stepDelay: 10,
        //     steps: [ () => {
        //         Object.preventExtensions(XMLHttpRequest.prototype);
        //         Object.freeze(XMLHttpRequest.prototype);
        //         let reflect:any = getGlobalInst("Reflect");
        //         if (reflect) {
        //             reflect.preventExtensions(XMLHttpRequest.prototype);
        //         }

        //         this._ajax = new AjaxMonitor();
        //         let appInsightsCore = new AppInsightsCore();
        //         let coreConfig = {
        //             instrumentationKey: "instrumentationKey",
        //             extensionConfig: {
        //                 "AjaxDependencyPlugin": {
        //                     appId: "appId"
        //                 }
        //             }
        //         };
        //         let testThis = this;
        //         appInsightsCore.initialize(coreConfig, [this._ajax, new TestChannelPlugin()]);
        //         appInsightsCore.addNotificationListener({
        //             eventsSent: (events: ITelemetryItem[]) => {
        //                 testThis._context["_eventsSent"] = events;
        //             }
        //         });
        //         this._ajax["_currentWindowHost"] = "httpbin.org";

        //         // Used to "wait" for App Insights to finish initializing which should complete after the XHR request
        //         this._context["trackStub"] = this.sandbox.stub(appInsightsCore, "track");

        //         // Act
        //         var xhr = new XMLHttpRequest();

        //         // Make sure the instance can't be changed
        //         Object.preventExtensions(xhr);
        //         Object.freeze(xhr);
        //         if (reflect) {
        //             reflect["preventExtensions"](xhr);
        //         }

        //         // trigger the request that should cause a track event once the xhr request is complete
        //         xhr.open("GET", "https://httpbin.org/status/200");
        //         xhr.send();
        //         appInsightsCore.track({
        //             name: "Hello World!"
        //         });
        //     }]
        //     .concat(PollingAssert.createPollingAssert(() => {
        //         let trackStub = this._context["trackStub"] as SinonStub;
        //         if (trackStub.called) {
        //             Assert.ok(trackStub.calledOnce, "track is called");
        //             let data = trackStub.args[0][0].baseData;
        //             Assert.equal("Ajax", data.type, "request is Ajax type");
        //             let props = data.properties || {};
        //             Assert.equal(undefined, props.ajaxPerf, "Should contain properties perf object");
        //             return true;
        //         }

        //         return false;
        //     }, 'response received', 600, 1000) as any)
        // });

    }
}

class TestChannelPlugin implements IChannelControls {

    public isFlushInvoked = false;
    public isUnloadInvoked = false;
    public isTearDownInvoked = false;
    public isResumeInvoked = false;
    public isPauseInvoked = false;

    constructor() {
        this.processTelemetry = this._processTelemetry.bind(this);
    }
    public pause(): void {
        this.isPauseInvoked = true;
    }

    public resume(): void {
        this.isResumeInvoked = true;
    }

    public teardown(): void {
        this.isTearDownInvoked = true;
    }

    flush(async?: boolean, callBack?: () => void): void {
        this.isFlushInvoked = true;
        if (callBack) {
            callBack();
        }
    }

    public processTelemetry;

    public identifier = "Sender";

    setNextPlugin(next: ITelemetryPlugin) {
        // no next setup
    }

    public priority: number = 1001;

    public initialize = (config: IConfiguration) => {
    }

    private _processTelemetry(env: ITelemetryItem) {

    }
}

class TestAjaxMonitor extends AjaxMonitor {

}
