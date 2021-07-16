import { AITestClass } from "@microsoft/ai-test-framework";
import { Sender } from "../../../src/Sender";
import { Offline } from '../../../src/Offline';
import { EnvelopeCreator } from '../../../src/EnvelopeCreator';
import { Exception, CtxTagKeys, Util } from "@microsoft/applicationinsights-common";
import { ITelemetryItem, AppInsightsCore, ITelemetryPlugin, DiagnosticLogger, NotificationManager, SendRequestReason, _InternalMessageId, LoggingSeverity, getGlobalInst, getGlobal } from "@microsoft/applicationinsights-core-js";

export class SenderTests extends AITestClass {
    private _sender: Sender;
    private _instrumentationKey = 'iKey';

    public testInitialize() {
        this._sender = new Sender();
        this._sender.initialize({ instrumentationKey: this._instrumentationKey }, new AppInsightsCore(), []);
    }

    public testCleanup() {
        this._sender = null;
    }

    public registerTests() {

        this.testCase({
            name: "Channel Config: Channel can properly take args from root config",
            test: () => {
                this._sender.initialize(
                    {
                        instrumentationKey: 'abc',
                        maxBatchInterval: 123,
                        endpointUrl: 'https://example.com',
                        maxBatchSizeInBytes: 654,
                        extensionConfig: {
                            [this._sender.identifier]: {
                                maxBatchSizeInBytes: 456
                            }
                        }

                    }, new AppInsightsCore(), []
                );

                QUnit.assert.equal(123, this._sender._senderConfig.maxBatchInterval(), 'Channel config can be set from root config (maxBatchInterval)');
                QUnit.assert.equal('https://example.com', this._sender._senderConfig.endpointUrl(), 'Channel config can be set from root config (endpointUrl)');
                QUnit.assert.notEqual(654, this._sender._senderConfig.maxBatchSizeInBytes(), 'Channel config does not equal root config option if extensionConfig field is also set');
                QUnit.assert.equal(456, this._sender._senderConfig.maxBatchSizeInBytes(), 'Channel config prioritizes extensionConfig over root config');
            }
        });

        this.testCase({
            name: "processTelemetry can be called with optional fields undefined",
            useFakeTimers: true,
            test: () => {
                this._sender.initialize({
                    instrumentationKey: 'abc'
                }, new AppInsightsCore(), []);

                const loggerSpy = this.sandbox.stub(this._sender, "triggerSend");
                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };
                try {
                    this._sender.processTelemetry(telemetryItem, null);
                } catch(e) {
                    QUnit.assert.ok(false, "Exception - " + e);
                }

                QUnit.assert.equal(false, loggerSpy.calledOnce, "The send has not yet been triggered");
                this.clock.tick(15000);
                QUnit.assert.equal(true, loggerSpy.calledOnce, "The send has been triggered");
            }
        })

        this.testCase({
            name: "telemetry is not send when legacy telemetry initializer returns false",
            test: () => {
                const cr = new AppInsightsCore();
                cr.logger = new DiagnosticLogger({instrumentationKey: "ikey"});
                this._sender.initialize({
                    instrumentationKey: 'abc'
                }, cr, []);

                const nextPlugin = <ITelemetryPlugin> {
                    identifier: "foo",
                    processTelemetry: (it) => {},
                    priority: 200,
                    setNextPlugin: (it) => {}
                };
                this._sender.setNextPlugin(nextPlugin);

                const processTelemetrySpy = this.sandbox.stub(nextPlugin, "processTelemetry");
                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {},
                    tags: [
                    ]
                };

                telemetryItem.tags["ProcessLegacy"] = [e => true, e => false, f=> true];
                try {
                    this._sender.processTelemetry(telemetryItem, null);
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                QUnit.assert.ok(!processTelemetrySpy.calledOnce);
            }
        });

        this.testCase({
            name: 'BeaconAPI is not used when isBeaconApiDisabled flag is true',
            test: () => {
                let sendBeaconCalled = false;
                this.hookSendBeacon((url: string) => {
                    sendBeaconCalled = true;
                    return true;
                });

                const sender = new Sender();
                const cr = new AppInsightsCore();

                sender.initialize({
                    instrumentationKey: 'abc',
                    isBeaconApiDisabled: true
                }, cr, []);

                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };

                QUnit.assert.ok(Util.IsBeaconApiSupported(), "Beacon API is supported");
                QUnit.assert.equal(false, sendBeaconCalled, "Beacon API was not called before");
                QUnit.assert.equal(0, this._getXhrRequests().length, "xhr sender was not called before");

                try {
                    sender.processTelemetry(telemetryItem, null);
                    sender.flush();
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                QUnit.assert.equal(false, sendBeaconCalled, "Beacon API is disabled, Beacon API is not called");
                QUnit.assert.equal(1, this._getXhrRequests().length, "xhr sender is called when Beacon API is disabled");
            }
        });

        this.testCase({
            name: 'beaconSender is called when isBeaconApiDisabled flag is false',
            useFakeTimers: true,
            test: () => {
                let sendBeaconCalled = false;
                this.hookSendBeacon((url: string) => {
                    sendBeaconCalled = true;
                    return true;
                });

                const cr = new AppInsightsCore();
                const sender = new Sender();

                sender.initialize({
                    instrumentationKey: 'abc',
                    isBeaconApiDisabled: false
                }, cr, []);

                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };

                QUnit.assert.ok(Util.IsBeaconApiSupported(), "Beacon API is supported");
                QUnit.assert.equal(false, sendBeaconCalled, "Beacon API was not called before");
                QUnit.assert.equal(0, this._getXhrRequests().length, "xhr sender was not called before");

                try {
                    sender.processTelemetry(telemetryItem, null);
                    sender.flush();
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                this.clock.tick(15000);

                QUnit.assert.equal(0, this._getXhrRequests().length, "xhr sender is not called when Beacon API is enabled");
                QUnit.assert.equal(true, sendBeaconCalled, "Beacon API is enabled, Beacon API is called");
            }
        });

        this.testCase({
            name: 'BeaconAPI is not used when isBeaconApiDisabled flag is false but payload size is over 64k, fall off to xhr sender',
            useFakeTimers: true,
            test: () => {
                let sendBeaconCalled = false;
                this.hookSendBeacon((url: string) => {
                    sendBeaconCalled = true;
                    return false;
                });

                const sender = new Sender();
                const cr = new AppInsightsCore();
                cr["logger"] = new DiagnosticLogger();
                const MAX_PROPERTIES_SIZE = 8000;
                const payload = new Array(MAX_PROPERTIES_SIZE).join('a');

                sender.initialize({
                    instrumentationKey: 'abc',
                    isBeaconApiDisabled: false
                }, cr, []);

                const telemetryItems: ITelemetryItem[] = [];
                for (let i = 0; i < 8; i ++) {
                    const telemetryItem: ITelemetryItem = {
                        name: 'fake item',
                        iKey: 'iKey',
                        baseType: 'some type',
                        baseData: {},
                        data: {
                            properties: {
                                payload
                            }
                        }
                    };
                    telemetryItems[i] = telemetryItem;
                }

                QUnit.assert.ok(Util.IsBeaconApiSupported(), "Beacon API is supported");
                QUnit.assert.equal(false, sendBeaconCalled, "Beacon API was not called before");
                QUnit.assert.equal(0, this._getXhrRequests().length, "xhr sender was not called before");

                try {
                    for (let i = 0; i < 8; i++) {
                        sender.processTelemetry(telemetryItems[i], null);
                    }
                    sender.flush();
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                this.clock.tick(15000);

                QUnit.assert.equal(true, sendBeaconCalled, "Beacon API is enabled but payload is over size, Beacon API is called");
                QUnit.assert.ok(this._getXhrRequests().length > 0, "xhr sender is called when payload is over size");
            }
        });

        this.testCase({
            name: 'FetchAPI is used when isBeaconApiDisabled flag is true and XMLHttpRequest is not supported, use fetch sender.',
            test: () => {
                let window = getGlobalInst("window");
                let fakeXMLHttpRequest = (window as any).XMLHttpRequest;
                (window as any).XMLHttpRequest = undefined;
                let fetchstub = this.sandbox.stub((window as any), "fetch");

                let sendBeaconCalled = false;
                this.hookSendBeacon((url: string) => {
                    sendBeaconCalled = true;
                    return false;
                });

                const sender = new Sender();
                const cr = new AppInsightsCore();

                sender.initialize({
                    instrumentationKey: 'abc',
                    isBeaconApiDisabled: true
                }, cr, []);

                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };

                QUnit.assert.ok(Util.IsBeaconApiSupported(), "Beacon API is supported");
                QUnit.assert.equal(false, sendBeaconCalled, "Beacon API was not called before");
                QUnit.assert.equal(0, this._getXhrRequests().length, "xhr sender was not called before");

                try {
                    sender.processTelemetry(telemetryItem, null);
                    sender.flush();
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                QUnit.assert.equal(false, sendBeaconCalled, "Beacon API is disabled, Beacon API is not called");
                QUnit.assert.equal(0, this._getXhrRequests().length, "xhr sender is not called");
                QUnit.assert.ok(fetchstub.called, "fetch sender is called");
                // store it back
                (window as any).XMLHttpRequest = fakeXMLHttpRequest;
            }
        });

        this.testCase({
            name: 'Users are not allowed to add customHeaders when endpointUrl is Breeze.',
            test: () => {
                let sendBeaconCalled = false;
                this.hookSendBeacon((url: string) => {
                    sendBeaconCalled = true;
                    return true;
                });

                const sender = new Sender();
                const cr = new AppInsightsCore();

                sender.initialize({
                    instrumentationKey: 'abc',
                    isBeaconApiDisabled: true,
                    customHeaders: [
                        {
                            header: 'testHeader',
                            value: 'testValue'
                        }
                    ]
                }, cr, []);

                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };

                try {
                    sender.processTelemetry(telemetryItem, null);
                    sender.flush();
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                QUnit.assert.equal(1, this._getXhrRequests().length, "xhr sender is called");
                QUnit.assert.notOk(this._getXhrRequests()[0].requestHeaders.hasOwnProperty('testHeader'));
            }
        });

        this.testCase({
            name: 'Users are allowed to add customHeaders when endpointUrl is not Breeze.',
            test: () => {
                let sendBeaconCalled = false;
                this.hookSendBeacon((url: string) => {
                    sendBeaconCalled = true;
                    return true;
                });

                const sender = new Sender();
                const cr = new AppInsightsCore();

                sender.initialize({
                    instrumentationKey: 'abc',
                    isBeaconApiDisabled: true,
                    endpointUrl: 'https://example.com',
                    customHeaders: [
                        {
                            header: 'testHeader',
                            value: 'testValue'
                        }
                    ]
                }, cr, []);

                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };

                try {
                    sender.processTelemetry(telemetryItem, null);
                    sender.flush();
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                QUnit.assert.equal(1, this._getXhrRequests().length, "xhr sender is called");
                QUnit.assert.ok(this._getXhrRequests()[0].requestHeaders.hasOwnProperty('testHeader'));
                QUnit.assert.equal(this._getXhrRequests()[0].requestHeaders.testHeader, 'testValue');
            }
        });

        this.testCase({
            name: 'Users are allowed to add customHeaders via addHeader method.',
            test: () => {
                let sendBeaconCalled = false;
                this.hookSendBeacon((url: string) => {
                    sendBeaconCalled = true;
                    return true;
                });

                const sender = new Sender();
                const cr = new AppInsightsCore();

                sender.addHeader('testHeader', 'testValue');

                sender.initialize({
                    instrumentationKey: 'abc',
                    isBeaconApiDisabled: true
                }, cr, []);

                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };

                try {
                    sender.processTelemetry(telemetryItem, null);
                    sender.flush();
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                QUnit.assert.equal(1, this._getXhrRequests().length, "xhr sender is called");
                QUnit.assert.ok(this._getXhrRequests()[0].requestHeaders.hasOwnProperty('testHeader'));
                QUnit.assert.equal(this._getXhrRequests()[0].requestHeaders.testHeader, 'testValue');
            }
        });

        this.testCase({
            name: "AppInsightsTests: AppInsights Envelope created for Custom Event",
            test: () => {
                const inputEnvelope: ITelemetryItem = {
                    name: "test",
                    time: new Date("2018-06-12").toISOString(),
                    iKey: "iKey",
                    ext: {
                        app: {
                            sesId: "d041d2e5fa834b4f9eee41ac163bf402"
                        },
                        device: {
                            deviceClass: "Browser",
                            localId: "browser"
                        }

                    },
                    tags: [{"ai.internal.sdkVersion": "javascript:2.5.1"}],
                    data: {
                        "property1": "val1",
                        "measurement1": 50.0,
                        "measurement2": 1.3,
                        "property2": "val2"
                    },
                    baseData: {
                        "name": "Event Name"
                    }
                };
                const appInsightsEnvelope = Sender.constructEnvelope(inputEnvelope, this._instrumentationKey, null);

                const baseData = appInsightsEnvelope.data.baseData;

                // Assert measurements
                const resultMeasurements = baseData.measurements;
                QUnit.assert.ok(resultMeasurements);
                QUnit.assert.ok(resultMeasurements["measurement1"]);
                QUnit.assert.equal(50.0, resultMeasurements["measurement1"]);
                QUnit.assert.ok(resultMeasurements["measurement2"]);
                QUnit.assert.equal(1.3, resultMeasurements["measurement2"]);

                // Assert custom properties
                QUnit.assert.ok(baseData.properties);
                QUnit.assert.equal("val1", baseData.properties["property1"]);
                QUnit.assert.equal("val2", baseData.properties["property2"]);

                // Assert Event name
                QUnit.assert.ok(baseData.name);
                QUnit.assert.equal("Event Name", baseData.name);

                // Assert ver
                QUnit.assert.ok(baseData.ver);
                QUnit.assert.equal(2, baseData.ver);

                // Assert baseType added by default
                QUnit.assert.ok(appInsightsEnvelope.data.baseType);
                QUnit.assert.equal("EventData", appInsightsEnvelope.data.baseType);

                // Assert tags
                QUnit.assert.ok(appInsightsEnvelope.tags);
                QUnit.assert.equal("d041d2e5fa834b4f9eee41ac163bf402", appInsightsEnvelope.tags["ai.session.id"]);
                QUnit.assert.equal("browser", appInsightsEnvelope.tags["ai.device.id"]);
                QUnit.assert.equal("Browser", appInsightsEnvelope.tags["ai.device.type"]);
                QUnit.assert.equal("javascript:2.5.1", appInsightsEnvelope.tags["ai.internal.sdkVersion"]);

                // Assert name
                QUnit.assert.ok(appInsightsEnvelope.name);
                QUnit.assert.equal("Microsoft.ApplicationInsights.iKey.Event", appInsightsEnvelope.name);

                // Assert iKey
                QUnit.assert.ok(appInsightsEnvelope.iKey);
                QUnit.assert.equal("iKey", appInsightsEnvelope.iKey);

                // Assert timestamp
                QUnit.assert.ok(appInsightsEnvelope.time);
            }
        });

        this.testCase({
            name: "AppInsightsTests: AppInsights Envelope  unknown type returns custom Event data type",
            test: () => {
                const inputEnvelope: ITelemetryItem = {
                    name: "test",
                    time: new Date("2018-06-12").toISOString(),
                    iKey: "iKey",
                    ext: {
                        "ai.session.id": "d041d2e5fa834b4f9eee41ac163bf402",
                        "ai.device.id": "browser",
                        "ai.device.type": "Browser",
                    },
                    tags: [{}],
                    data: {
                        "property1": "val1",
                        "measurement1": 50.0,
                        "measurement2": 1.3,
                        "property2": "val2"
                    },
                    baseType: "PageUnloadData",
                    baseData: {
                        id: "EADE2F09-DEBA-4B60-A222-E1D80BB8AA7F",
                        vpHeight: 1002,
                        vScrollOffset: 292
                    }
                };
                const appInsightsEnvelope = Sender.constructEnvelope(inputEnvelope, this._instrumentationKey, null);
                const baseData = appInsightsEnvelope.data.baseData;

                // Assert measurements
                const resultMeasurements = baseData.measurements;
                QUnit.assert.ok(resultMeasurements);
                QUnit.assert.ok(resultMeasurements["measurement1"]);
                QUnit.assert.equal(50.0, resultMeasurements["measurement1"]);
                QUnit.assert.ok(resultMeasurements["measurement2"]);
                QUnit.assert.equal(1.3, resultMeasurements["measurement2"]);
                QUnit.assert.ok(resultMeasurements["vpHeight"]);
                QUnit.assert.equal(1002, resultMeasurements["vpHeight"]);
                QUnit.assert.ok(resultMeasurements["vScrollOffset"]);
                QUnit.assert.equal(292, resultMeasurements["vScrollOffset"]);

                // Assert custom properties
                QUnit.assert.ok(baseData.properties);
                QUnit.assert.equal("val1", baseData.properties["property1"]);
                QUnit.assert.equal("val2", baseData.properties["property2"]);
                QUnit.assert.equal("EADE2F09-DEBA-4B60-A222-E1D80BB8AA7F", baseData.properties["id"]);

                // Assert Event name
                QUnit.assert.ok(baseData.name);
                QUnit.assert.equal("PageUnloadData", baseData.properties['baseTypeSource']);

                // Assert ver
                QUnit.assert.ok(baseData.ver);
                QUnit.assert.equal(2, baseData.ver);

                QUnit.assert.equal("javascript:2.6.4", appInsightsEnvelope.tags["ai.internal.sdkVersion"]);
            }
        })

        this.testCase({
            name: "AppInsightsTests: AppInsights Envelope create for Dependency Data",
            test: () => {
                // setup
                const inputEnvelope: ITelemetryItem = {
                    name: "test",
                    time: new Date("2018-06-12").toISOString(),
                    iKey: "iKey",
                    ext: {
                        "user" : {
                            "localId": "TestId",
                            "authId": "AuthenticatedId",
                            "id": "TestId"
                        }
                    },
                    tags: [{"ai.user.accountId": "TestAccountId"},
                           {"ai.location.ip": "10.22.8.2"}],
                    baseType: "RemoteDependencyData",
                    baseData: {
                        id: 'some id',
                        name: "Some name given",
                        success: true,
                        responseCode: 200,
                        duration: 123,
                        type: 'Fetch',
                        data: 'some data',
                        target: 'https://example.com/test/name?q=bar',
                        correlationContext: "cid-v1:foo"
                    },
                    data: {
                        property1: "val1",
                        property2: "val2",
                        measurement1: 50.0,
                        measurement2: 1.3
                    }

                }

                // act
                const appInsightsEnvelope = Sender.constructEnvelope(inputEnvelope, this._instrumentationKey, null);
                const { baseData } = appInsightsEnvelope.data;

                // assert
                const resultDuration = baseData.duration;
                QUnit.assert.equal("00:00:00.123", resultDuration);

                // Assert measurements
                const resultMeasurements = baseData.measurements;
                QUnit.assert.ok(resultMeasurements);
                QUnit.assert.ok(resultMeasurements["measurement1"]);
                QUnit.assert.equal(50.0, resultMeasurements["measurement1"]);
                QUnit.assert.ok(resultMeasurements["measurement2"]);
                QUnit.assert.equal(1.3, resultMeasurements["measurement2"]);
                QUnit.assert.ok(!resultMeasurements.duration, "duration is not supposed to be treated as measurement");

                // Assert custom properties
                QUnit.assert.ok(baseData.properties);
                QUnit.assert.equal("val1", baseData.properties["property1"]);
                QUnit.assert.equal("val2", baseData.properties["property2"]);

                // Assert baseData
                QUnit.assert.ok(baseData.name);
                QUnit.assert.equal("Some name given", baseData.data);
                QUnit.assert.equal("some id", baseData.id);
                QUnit.assert.equal(true, baseData.success);
                QUnit.assert.equal(200, baseData.resultCode);
                QUnit.assert.equal("Some name given", baseData.name);
                QUnit.assert.equal("example.com | cid-v1:foo", baseData.target);

                // Assert ver
                QUnit.assert.ok(baseData.ver);
                QUnit.assert.equal(2, baseData.ver);

                // Assert baseType
                QUnit.assert.ok(appInsightsEnvelope.data.baseType);
                QUnit.assert.equal("RemoteDependencyData", appInsightsEnvelope.data.baseType);

                // Assert tags
                QUnit.assert.ok(appInsightsEnvelope.tags);
                QUnit.assert.equal("TestAccountId", appInsightsEnvelope.tags["ai.user.accountId"]);
                QUnit.assert.equal("10.22.8.2", appInsightsEnvelope.tags["ai.location.ip"]);

                QUnit.assert.equal("AuthenticatedId", appInsightsEnvelope.tags["ai.user.authUserId"]);
                QUnit.assert.equal("TestId", appInsightsEnvelope.tags["ai.user.id"]);

                // Assert name
                QUnit.assert.ok(appInsightsEnvelope.name);
                QUnit.assert.equal("Microsoft.ApplicationInsights.iKey.RemoteDependency", appInsightsEnvelope.name);

                // Assert iKey
                QUnit.assert.ok(appInsightsEnvelope.iKey);
                QUnit.assert.equal("iKey", appInsightsEnvelope.iKey);

                // Assert timestamp
                QUnit.assert.ok(appInsightsEnvelope.time);
            }
        });

        this.testCase({
            name: "AppInsightsTests: When name is not provided, it is obtained from hostname",
            test: () => {
                // setup
                const inputEnvelope: ITelemetryItem = {
                    name: "test",
                    time: new Date("2018-06-12").toISOString(),
                    iKey: "iKey",
                    ext: {
                        "user" : {
                            "localId": "TestId",
                            "authId": "AuthenticatedId",
                            "id": "TestId"
                        }
                    },
                    tags: [{"ai.user.accountId": "TestAccountId"},
                           {"ai.location.ip": "10.22.8.2"}, {"ai.internal.sdkVersion": "1234"}],
                    baseType: "RemoteDependencyData",
                    baseData: {
                        id: 'some id',
                        success: true,
                        responseCode: 200,
                        duration: 123,
                        type: 'Fetch',
                        data: 'some data',
                        target: 'https://example.com/test/name'
                    },
                    data: {
                        property1: "val1",
                        property2: "val2",
                        measurement1: 50.0,
                        measurement2: 1.3
                    }

                }

                // act
                const appInsightsEnvelope = Sender.constructEnvelope(inputEnvelope, this._instrumentationKey, null);
                const { baseData } = appInsightsEnvelope.data;

                // Assert baseData
                QUnit.assert.ok(baseData.name);
                QUnit.assert.equal("GET /test/name", baseData.name); // retrieved from target
                QUnit.assert.equal("/test/name", baseData.data);

                // Assert sdkVersion
                QUnit.assert.equal("1234", appInsightsEnvelope.tags["ai.internal.sdkVersion"])
            }
        });

        this.testCase({
            name: "AppInsightsTests: AppInsights Envelope created for Page View",
            test: () => {
                // setup
                const inputEnvelope: ITelemetryItem = {
                    name: "test",
                    time: new Date("2018-06-12").toISOString(),
                    iKey: "iKey",
                    ext: {
                        "user": {
                            "localId": "TestId",
                            "authId": "AuthenticatedId",
                            "id": "TestId"
                        },
                        "trace": {
                            "traceID": "1528B5FF-6455-4657-BE77-E6664CAC72DC",
                            "parentID": "1528B5FF-6455-4657-BE77-E6664CACEEEE"
                        }
                    },
                    tags: [{"ai.user.accountId": "TestAccountId"}],
                    baseType: "PageviewData",
                    baseData: {
                        "name": "Page View Name",
                        "uri": "https://fakeUri.com",
                        properties: {
                            "property1": "val1",
                            "property2": "val2",
                            "duration": 300000
                        },
                        measurements: {
                            "measurement1": 50.0,
                            "measurement2": 1.3,
                        }
                    },
                    data: {
                        "property3": "val3",
                        "measurement3": 1000
                    }
                };

                // Act
                const appInsightsEnvelope = Sender.constructEnvelope(inputEnvelope, this._instrumentationKey, null);
                const baseData = appInsightsEnvelope.data.baseData;

                // Assert duration
                const resultDuration = baseData.duration;
                QUnit.assert.equal("00:05:00.000", resultDuration);

                // Assert measurements
                const resultMeasurements = baseData.measurements;
                const  props = baseData.properties;
                QUnit.assert.ok(resultMeasurements);
                QUnit.assert.ok(resultMeasurements["measurement1"]);
                QUnit.assert.equal(50.0, resultMeasurements["measurement1"]);
                QUnit.assert.ok(resultMeasurements["measurement2"]);
                QUnit.assert.equal(1.3, resultMeasurements["measurement2"]);
                QUnit.assert.ok(!resultMeasurements.duration, "duration is not supposed to be treated as property in envelope");

                // Assert custom properties
                QUnit.assert.ok(baseData.properties);
                QUnit.assert.equal("val1", baseData.properties["property1"]);
                QUnit.assert.equal("val2", baseData.properties["property2"]);

                // Assert deprecated data custom properties/measurements
                QUnit.assert.equal("val3", baseData.properties["property3"])
                QUnit.assert.equal(1000, baseData.measurements["measurement3"]);

                // Assert Page View name
                QUnit.assert.ok(baseData.name);
                QUnit.assert.equal("Page View Name", baseData.name);


                // Assert ver
                QUnit.assert.ok(baseData.ver);
                QUnit.assert.equal(2, baseData.ver);

                // Assert baseType
                QUnit.assert.ok(appInsightsEnvelope.data.baseType);
                QUnit.assert.equal("PageviewData", appInsightsEnvelope.data.baseType);

                // Assert tags
                QUnit.assert.ok(appInsightsEnvelope.tags);
                QUnit.assert.equal("TestAccountId", appInsightsEnvelope.tags["ai.user.accountId"]);
                QUnit.assert.equal("AuthenticatedId", appInsightsEnvelope.tags["ai.user.authUserId"]);
                QUnit.assert.equal("TestId", appInsightsEnvelope.tags["ai.user.id"]);

                // Assert sdkVersion
                QUnit.assert.ok(EnvelopeCreator.Version)
                QUnit.assert.ok(EnvelopeCreator.Version.length > 0)
                QUnit.assert.equal(`javascript:${EnvelopeCreator.Version}`, appInsightsEnvelope.tags["ai.internal.sdkVersion"])

                // QUnit.assert.equal("d041d2e5fa834b4f9eee41ac163bf402", appInsightsEnvelope.tags["ai.session.id"]);
                // QUnit.assert.equal("browser", appInsightsEnvelope.tags["ai.device.id"]);
                // QUnit.assert.equal("Browser", appInsightsEnvelope.tags["ai.device.type"]);
                // QUnit.assert.equal("javascript:1.0.18", appInsightsEnvelope.tags["ai.internal.sdkVersion"]);

                // Assert name
                QUnit.assert.ok(appInsightsEnvelope.name);
                QUnit.assert.equal("Microsoft.ApplicationInsights.iKey.Pageview", appInsightsEnvelope.name);

                // Assert iKey
                QUnit.assert.ok(appInsightsEnvelope.iKey);
                QUnit.assert.equal("iKey", appInsightsEnvelope.iKey);

                // Assert timestamp
                QUnit.assert.ok(appInsightsEnvelope.time);


                QUnit.assert.equal("1528B5FF-6455-4657-BE77-E6664CAC72DC", appInsightsEnvelope.tags["ai.operation.id"]);
                QUnit.assert.equal("1528B5FF-6455-4657-BE77-E6664CACEEEE", appInsightsEnvelope.tags["ai.operation.parentId"])
            }
        });

        this.testCase({
            name: "AppInsightsTests: AppInsights Envelope created for Page View with duration in customProperties Part C",
            test: () => {
                // setup
                const inputEnvelope: ITelemetryItem = {
                    name: "test",
                    time: new Date("2018-06-12").toISOString(),
                    iKey: "iKey",
                    ext: {
                        "user": {
                            "localId": "TestId",
                            "authId": "AuthenticatedId",
                            "id": "TestId"
                        },
                        "trace": {
                            "traceID": "1528B5FF-6455-4657-BE77-E6664CAC72DC",
                            "parentID": "1528B5FF-6455-4657-BE77-E6664CACEEEE"
                        }
                    },
                    tags: [{"ai.user.accountId": "TestAccountId"}],
                    baseType: "PageviewData",
                    baseData: {
                        "name": "Page View Name",
                        "uri": "https://fakeUri.com",
                        properties: {
                            "property1": "val1",
                            "property2": "val2",
                        },
                        measurements: {
                            "measurement1": 50.0,
                            "measurement2": 1.3,
                        }
                    },
                    data: {
                        "duration": 300000
                    }
                };

                // Act
                const appInsightsEnvelope = Sender.constructEnvelope(inputEnvelope, this._instrumentationKey, null);
                const baseData = appInsightsEnvelope.data.baseData;

                // Assert duration
                const resultDuration = baseData.duration;
                QUnit.assert.equal("00:05:00.000", resultDuration);
            }
        });

        this.testCase({
            name: 'Envelope: custom properties are put into envelope for Exception data type',
            test: () => {
                const bd = new Exception(
                    null,
                    new Error(),
                    {"property1": "val1", "property2": "val2" },
                    {"measurement1": 50.0, "measurement2": 1.3 }
                );
                const inputEnvelope: ITelemetryItem = {
                    name: "test",
                    time: new Date("2018-06-12").toISOString(),
                    iKey: "iKey",
                    baseType: Exception.dataType,
                    baseData: bd,
                    data: {
                        "property3": "val3",
                        "measurement3": 3.0
                    },
                    ext: {
                        "user": {
                            "localId": "TestId",
                            "authId": "AuthenticatedId",
                            "id": "TestId"
                        }
                    },
                    tags: [{"user.accountId": "TestAccountId"}],
                };

                // Act
                const appInsightsEnvelope = Sender.constructEnvelope(inputEnvelope, this._instrumentationKey, null);
                const baseData = appInsightsEnvelope.data.baseData; 

                QUnit.assert.equal("val3", baseData.properties["property3"], "ExceptionData: customProperties (item.data) are added to the properties of the envelope and not included in the item.data")
                QUnit.assert.equal("val1", baseData.properties["property1"], "ExceptionData: properties (item.baseData.properties) are added to telemetry envelope");
                QUnit.assert.equal(50.0, baseData.measurements["measurement1"], "ExceptionData: measurements (item.baseData.measurements) are added to telemetry envelope");

            }
        });

        this.testCase({
            name: 'Offline watcher is listening to events',
            test: () => {
                QUnit.assert.ok(Offline.isListening, 'Offline is listening');
                QUnit.assert.equal(true, Offline.isOnline(), 'Offline reports online status');
                QUnit.assert.equal(false, Offline.isOffline(), 'Offline reports offline status');
            }
        });

        this.testCase({
            name: 'Offline watcher responds to offline events (window.addEventListener)',
            useFakeTimers: true,
            test: () => {
                // Setup
                const offlineEvent = new Event('offline');
                const onlineEvent = new Event('online');

                // Verify precondition
                QUnit.assert.ok(Offline.isListening);
                QUnit.assert.ok(Offline.isOnline());

                // Act - Go offline
                window.dispatchEvent(offlineEvent);
                this.clock.tick(1);

                // Verify offline
                QUnit.assert.ok(Offline.isOffline());

                // Act - Go online
                window.dispatchEvent(onlineEvent);
                this.clock.tick(1);

                // Verify online
                QUnit.assert.ok(Offline.isOnline());
            }
        });

        this.testCase({
            name: "AppInsightsTests: AppInsights Envelope created for Page View with new web extension",
            test: () => {
                // setup
                const inputEnvelope: ITelemetryItem = {
                    name: "test",
                    iKey: "iKey",
                    ext: {
                        "web": {
                            "domain": "www.bing.com",
                            "userConsent": true,
                            "screenRes": "1024x768",
                            "browser": "internet explorer",
                            "browserVer": "48.0",
                            "isManual": true,
                            "browserLang": "EN"
                        }
                    },
                    baseType: "PageviewData",
                    baseData: {
                        "name": "Page View Name",
                        "uri": "https://fakeUri.com",
                        "startTime": new Date(123),
                        properties: {
                            "property1": "val1",
                            "property2": "val2"
                        },
                        measurements: {
                            "measurement1": 50.0,
                        }
                    }
                };

                // Act
                const appInsightsEnvelope = Sender.constructEnvelope(inputEnvelope, this._instrumentationKey, null);
                const baseData = appInsightsEnvelope.data.baseData;

                // Assert envelope
                QUnit.assert.deepEqual(appInsightsEnvelope.time, new Date(123).toISOString());

                // Assert measurements
                const resultMeasurements = baseData.measurements;
                QUnit.assert.ok(resultMeasurements);
                QUnit.assert.ok(resultMeasurements["measurement1"]);
                QUnit.assert.equal(50.0, resultMeasurements["measurement1"]);

                // Assert custom properties
                QUnit.assert.ok(baseData.properties);
                QUnit.assert.equal("val1", baseData.properties["property1"]);
                QUnit.assert.equal("val2", baseData.properties["property2"]);
                QUnit.assert.equal("true", baseData.properties["isManual"]);
                QUnit.assert.equal("1024x768", baseData.properties["screenRes"]);
                QUnit.assert.equal("true", baseData.properties["userConsent"]);
                QUnit.assert.equal("www.bing.com", baseData.properties["domain"]);

                QUnit.assert.equal("internet explorer", appInsightsEnvelope.tags[CtxTagKeys.deviceBrowser]);
                QUnit.assert.equal("48.0", appInsightsEnvelope.tags[CtxTagKeys.deviceBrowserVersion]);
                QUnit.assert.equal("EN", appInsightsEnvelope.tags[CtxTagKeys.deviceLanguage]);

                // Assert Page View name
                QUnit.assert.ok(baseData.name);
                QUnit.assert.equal("Page View Name", baseData.name);

                // Assert ver
                QUnit.assert.ok(baseData.ver);
                QUnit.assert.equal(2, baseData.ver);

                // Assert baseType
                QUnit.assert.ok(appInsightsEnvelope.data.baseType);
                QUnit.assert.equal("PageviewData", appInsightsEnvelope.data.baseType);

                // Assert name
                QUnit.assert.ok(appInsightsEnvelope.name);
                QUnit.assert.equal("Microsoft.ApplicationInsights.iKey.Pageview", appInsightsEnvelope.name);
            }
        });

        this.testCase({
            name: "Channel Config: Notification is sent when requests are being sent when requests exceed max batch size",
            useFakeTimers: true,
            test: () => {
                let sendNotifications = [];
                let notificationManager = new NotificationManager();
                notificationManager.addNotificationListener({
                    eventsSendRequest: (sendReason: number, isAsync?: boolean) => {
                        sendNotifications.push({
                            sendReason,
                            isAsync
                        });
                    }
                });

                let core = new AppInsightsCore();
                this.sandbox.stub(core, "getNotifyMgr").returns(notificationManager);

                this._sender.initialize(
                    {
                        instrumentationKey: 'abc',
                        maxBatchInterval: 123,
                        endpointUrl: 'https://example.com',
                        maxBatchSizeInBytes: 100,
                        extensionConfig: {
                            [this._sender.identifier]: {
                                maxBatchSizeInBytes: 100
                            }
                        }

                    }, core, []
                );

                const loggerSpy = this.sandbox.spy(this._sender, "triggerSend");
                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };
                try {
                    this._sender.processTelemetry(telemetryItem, null);
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                QUnit.assert.equal(true, loggerSpy.calledOnce);
                this.clock.tick(1);
                QUnit.assert.ok(sendNotifications.length === 1);
                QUnit.assert.ok(sendNotifications[0].sendReason === SendRequestReason.MaxBatchSize);
            }
        });

        this.testCase({
            name: "Channel Config: Notification is sent when requests are being sent with manual flush",
            useFakeTimers: true,
            test: () => {
                let sendNotifications = [];
                let notificationManager = new NotificationManager();
                notificationManager.addNotificationListener({
                    eventsSendRequest: (sendReason: number, isAsync?: boolean) => {
                        sendNotifications.push({
                            sendReason,
                            isAsync
                        });
                    }
                });

                let core = new AppInsightsCore();
                this.sandbox.stub(core, "getNotifyMgr").returns(notificationManager);

                this._sender.initialize(
                    {
                        instrumentationKey: 'abc',
                        maxBatchInterval: 123,
                        endpointUrl: 'https://example.com',
                        extensionConfig: {
                        }

                    }, core, []
                );

                const loggerSpy = this.sandbox.spy(this._sender, "triggerSend");
                const telemetryItem: ITelemetryItem = {
                    name: 'fake item',
                    iKey: 'iKey',
                    baseType: 'some type',
                    baseData: {}
                };
                try {
                    this._sender.processTelemetry(telemetryItem, null);
                } catch(e) {
                    QUnit.assert.ok(false);
                }

                QUnit.assert.equal(false, loggerSpy.calledOnce);
                QUnit.assert.equal(0, sendNotifications.length);

                this._sender.flush();
                QUnit.assert.equal(true, loggerSpy.calledOnce);
                QUnit.assert.equal(0, sendNotifications.length);

                this.clock.tick(1);

                QUnit.assert.equal(1, sendNotifications.length);
                QUnit.assert.equal(SendRequestReason.ManualFlush, sendNotifications[0].sendReason);
            }
        });

        this.testCase({
            name: "IKey Validation Test",
            test: () => {
                let appInsightsCore = new AppInsightsCore();
                appInsightsCore.logger = new DiagnosticLogger();
                let messageId: _InternalMessageId = _InternalMessageId.InvalidInstrumentationKey;
                let logInternalSpy = this.sandbox.spy(appInsightsCore.logger, 'logInternalMessage');
                this._sender.initialize(
                    {
                        instrumentationKey: '1aa11111-bbbb-1ccc-8ddd-eeeeffff3333',
                        maxBatchInterval: 123,
                        endpointUrl: 'https://example.com',
                        maxBatchSizeInBytes: 654,
                        extensionConfig: {
                            [this._sender.identifier]: {
                                maxBatchSizeInBytes: 456
                            }
                        }

                    }, appInsightsCore, []
                );

                QUnit.assert.equal(false,logInternalSpy.calledOnce, 'valid Ikey test-1');
                QUnit.assert.equal(0, appInsightsCore.logger.queue.length, "POST: No messageId logged");

                appInsightsCore = new AppInsightsCore();
                appInsightsCore.logger = new DiagnosticLogger();
                messageId = _InternalMessageId.InvalidInstrumentationKey;
                logInternalSpy = this.sandbox.spy(appInsightsCore.logger, 'logInternalMessage');
                this._sender.initialize(
                    {
                        instrumentationKey: '1aa11111bbbb1ccc8dddeeeeffff3333',
                        maxBatchInterval: 123,
                        endpointUrl: 'https://example.com',
                        maxBatchSizeInBytes: 654,
                        extensionConfig: {
                            [this._sender.identifier]: {
                                maxBatchSizeInBytes: 456
                            }
                        }

                    }, appInsightsCore, []
                );

                QUnit.assert.ok(logInternalSpy.calledOnce, 'iKey Validation check -throwInternal called');
                QUnit.assert.equal(messageId, logInternalSpy.args[0][1].messageId, "Correct message logged");
                QUnit.assert.ok(logInternalSpy.args[0][1].message.indexOf('Invalid Instrumentation key') !== -1, "Correct message logged");
                QUnit.assert.equal(1, appInsightsCore.logger.queue.length, "POST: Correct messageId logged");
                QUnit.assert.ok(appInsightsCore.logger.queue[0].message.indexOf('Invalid Instrumentation key') !== -1, "Correct message logged");
                QUnit.assert.equal(messageId, appInsightsCore.logger.queue[0].messageId, "Correct message logged");

                appInsightsCore = new AppInsightsCore();
                appInsightsCore.logger = new DiagnosticLogger();
                messageId = _InternalMessageId.InvalidInstrumentationKey;
                logInternalSpy = this.sandbox.spy(appInsightsCore.logger, 'logInternalMessage');
                this._sender.initialize(
                    {
                        instrumentationKey: 'abc',
                        maxBatchInterval: 123,
                        endpointUrl: 'https://example.com',
                        maxBatchSizeInBytes: 654,
                        extensionConfig: {
                            [this._sender.identifier]: {
                                maxBatchSizeInBytes: 456
                            }
                        }

                    }, appInsightsCore, []
                );

                QUnit.assert.ok(logInternalSpy.calledOnce, 'iKey Validation check -throwInternal called');
                QUnit.assert.equal(messageId, logInternalSpy.args[0][1].messageId, "Correct message logged");
                QUnit.assert.ok(logInternalSpy.args[0][1].message.indexOf('Invalid Instrumentation key') !== -1, "Correct message logged");
                QUnit.assert.equal(1, appInsightsCore.logger.queue.length, "POST: Correct messageId logged");
                QUnit.assert.ok(appInsightsCore.logger.queue[0].message.indexOf('Invalid Instrumentation key') !== -1, "Correct message logged");
                QUnit.assert.equal(messageId, appInsightsCore.logger.queue[0].messageId, "Correct message logged");

                appInsightsCore = new AppInsightsCore();
                appInsightsCore.logger = new DiagnosticLogger();
                messageId = _InternalMessageId.InvalidInstrumentationKey;
                logInternalSpy = this.sandbox.spy(appInsightsCore.logger, 'logInternalMessage');
                this._sender.initialize(
                    {
                        instrumentationKey: '',
                        maxBatchInterval: 123,
                        endpointUrl: 'https://example.com',
                        maxBatchSizeInBytes: 654,
                        extensionConfig: {
                            [this._sender.identifier]: {
                                maxBatchSizeInBytes: 456
                            }
                        }

                    }, appInsightsCore, []
                );

                QUnit.assert.ok(logInternalSpy.calledOnce, 'iKey Validation check -throwInternal called');
                QUnit.assert.equal(messageId, logInternalSpy.args[0][1].messageId, "Correct message logged");
                QUnit.assert.ok(logInternalSpy.args[0][1].message.indexOf('Invalid Instrumentation key') !== -1, "Correct message logged");
                QUnit.assert.equal(1, appInsightsCore.logger.queue.length, "POST: Correct messageId logged");
                QUnit.assert.ok(appInsightsCore.logger.queue[0].message.indexOf('Invalid Instrumentation key') !== -1, "Correct message logged");
                QUnit.assert.equal(messageId, appInsightsCore.logger.queue[0].messageId, "Correct message logged");

                appInsightsCore = new AppInsightsCore();
                appInsightsCore.logger = new DiagnosticLogger();
                messageId = _InternalMessageId.InvalidInstrumentationKey;
                logInternalSpy = this.sandbox.spy(appInsightsCore.logger, 'logInternalMessage');
                this._sender.initialize(
                    {
                        instrumentationKey: 'abc',
                        maxBatchInterval: 123,
                        endpointUrl: 'https://example.com',
                        maxBatchSizeInBytes: 654,
                        extensionConfig: {
                            [this._sender.identifier]: {
                                maxBatchSizeInBytes: 456
                            }
                        },
                        disableInstrumentationKeyValidation: true

                    }, appInsightsCore, []
                );

                QUnit.assert.equal(false,logInternalSpy.calledOnce, 'disableIKeyValidation flag set to yes');
                QUnit.assert.equal(0, appInsightsCore.logger.queue.length, "POST: No messageId logged");
            }

            
        });

    }
}