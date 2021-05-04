import { Assert, AITestClass } from "@microsoft/ai-test-framework";
import { AppInsightsCore, DiagnosticLogger, ITelemetryItem, objForEachKey } from "@microsoft/applicationinsights-core-js";
import { ReactNativePlugin, INativeDevice, IReactNativePluginConfig } from '../../../src/index';
import dynamicProto from '@microsoft/dynamicproto-js';

export class ReactNativePluginTests extends AITestClass {
    private plugin: ReactNativePlugin;
    private core: AppInsightsCore;
    private config: IReactNativePluginConfig;
    private item: ITelemetryItem;

    public testInitialize() {
        this._disableDynProtoBaseFuncs();
        this.core = new AppInsightsCore();
        this.core.logger = new DiagnosticLogger();
        this.plugin = new ReactNativePlugin();
        this.config = {};
    }

    public testCleanup() {
        this.core = null;
        this.plugin = null;
        this.config = null;
    }

    public registerTests() {
        this.addConfigTests()
        this.addAPITests();
        this.addProcessTelemetryTests();
    }

    private addProcessTelemetryTests() {
        this.testCase({
            name: 'processTelemetry appends device fields',
            test: () => {
                const expectation: ITelemetryItem = {
                    name: 'a name',
                    ext: {
                        device: {
                            localId: 'some id',
                            model: 'some model',
                            deviceClass: 'some type'
                        }
                    }
                };
                const actual: ITelemetryItem = {
                    name: 'a name'
                };
                this.plugin['_initialized'] = true;
                objForEachKey({
                    id: 'some id',
                    model: 'some model',
                    deviceClass: 'some type'
                }, (name, value) => {
                    this._getDevice(this.plugin)[name] = value;
                });
                Assert.notDeepEqual(expectation, actual, 'Telemetry items are not equal yet');
                this.plugin.processTelemetry(actual);
                Assert.deepEqual(expectation, actual, 'Telemetry items are equal');
            }
        });
    }

    private addAPITests() {
        this.testCase({
            name: `setDeviceId sets this device's id`,
            test: () => {
                const expectation = 'something';
                Assert.notEqual(expectation, this._getDevice(this.plugin).id, 'Initial not set');
                this.plugin.setDeviceId(expectation);
                Assert.equal(expectation, this._getDevice(this.plugin).id, 'Value set');
            }
        });

        this.testCase({
            name: `setDeviceModel sets this device's model`,
            test: () => {
                const expectation = 'something';
                Assert.notEqual(expectation, this._getDevice(this.plugin).model, 'Initial not set');
                this.plugin.setDeviceModel(expectation);
                Assert.equal(expectation, this._getDevice(this.plugin).model, 'Value set');
            }
        });

        this.testCase({
            name: `setDeviceType sets this device's type`,
            test: () => {
                const expectation = 'something';
                Assert.notEqual(expectation, this._getDevice(this.plugin).deviceClass, 'Initial not set');
                this.plugin.setDeviceType(expectation);
                Assert.equal(expectation, this._getDevice(this.plugin).deviceClass, 'Value set');
            }
        });
    }

    private addConfigTests() {
        this.testCase({
            name: 'Autocollection is enabled by default',
            test: () => {
                const autoCollectStub = this.sandbox.stub(this.plugin as any, '_collectDeviceInfo');
                const autoCollectExceptionStub = this.sandbox.stub(this.plugin as any, '_setExceptionHandler').callsFake(() => true);

                this.plugin.initialize(this.config, this.core, []);
                Assert.equal(false, this.plugin['_config'].disableDeviceCollection, 'disableDeviceCollection is false');
                Assert.equal(false, this.plugin['_config'].disableExceptionCollection, 'disableExceptionCollection is false');
                Assert.ok(autoCollectStub.calledOnce);
                Assert.ok(autoCollectExceptionStub.calledOnce);
            }
        });

        this.testCase({
            name: 'Autocollection does not run when disabled from root config',
            test: () => {
                const autoCollectStub = this.sandbox.stub(this.plugin as any, '_collectDeviceInfo');
                const autoCollectExceptionStub = this.sandbox.stub(this.plugin as any, '_setExceptionHandler').callsFake(() => true);
                this.config['disableDeviceCollection'] = true;
                this.config['disableExceptionCollection'] = true;
                this.plugin.initialize(this.config, this.core, []);

                Assert.equal(true, this.plugin['_config'].disableDeviceCollection, 'disableDeviceCollection is true');
                Assert.equal(true, this.plugin['_config'].disableExceptionCollection, 'disableExceptionCollection is true');
                Assert.ok(autoCollectStub.notCalled);
                Assert.ok(autoCollectExceptionStub.notCalled);
            }
        });

        this.testCase({
            name: 'Autocollection does not run when disabled from constructor config',
            test: () => {
                this.plugin = new ReactNativePlugin({disableDeviceCollection: true, disableExceptionCollection: true});
                const autoCollectStub = this.sandbox.stub(this.plugin as any, '_collectDeviceInfo');
                const autoCollectExceptionStub = this.sandbox.stub(this.plugin as any, '_setExceptionHandler').callsFake(() => true);
                this.plugin.initialize(this.config, this.core, []);

                Assert.equal(true, this.plugin['_config'].disableDeviceCollection, 'disableDeviceCollection is true');
                Assert.equal(true, this.plugin['_config'].disableExceptionCollection, 'disableExceptionCollection is true');
                Assert.ok(autoCollectStub.notCalled);
                Assert.ok(autoCollectExceptionStub.notCalled);
            }
        });

        this.testCase({
            name: 'Autocollection runs when empty config is passed',
            test: () => {
                this.plugin = new ReactNativePlugin({} as any);
                const autoCollectStub = this.sandbox.stub(this.plugin as any, '_collectDeviceInfo');
                const autoCollectExceptionStub = this.sandbox.stub(this.plugin as any, '_setExceptionHandler').callsFake(() => true);
                this.plugin.initialize(this.config, this.core, []);

                Assert.equal(false, this.plugin['_config'].disableDeviceCollection, 'disableDeviceCollection is false');
                Assert.equal(false, this.plugin['_config'].disableExceptionCollection, 'disableExceptionCollection is false');
                Assert.ok(autoCollectStub.calledOnce);
                Assert.ok(autoCollectExceptionStub.calledOnce);
            }
        });

        this.testCase({
            name: 'Autocollection runs when random config is passed',
            test: () => {
                this.plugin = new ReactNativePlugin({foo: 'bar'} as any);
                const autoCollectStub = this.sandbox.stub(this.plugin as any, '_collectDeviceInfo');
                const autoCollectExceptionStub = this.sandbox.stub(this.plugin as any, '_setExceptionHandler').callsFake(() => true);
                this.plugin.initialize(this.config, this.core, []);

                Assert.deepEqual(false, this.plugin['_config'].disableDeviceCollection, 'disableDeviceCollection is false');
                Assert.deepEqual(false, this.plugin['_config'].disableExceptionCollection, 'disableExceptionCollection is false');
                Assert.ok(autoCollectStub.calledOnce);
                Assert.ok(autoCollectExceptionStub.calledOnce);
            }
        });
    }

    private _getDevice(plugin: any): any {
        return plugin._getDbgPlgTargets()[0];
    }
}

export function runTests() {
    new ReactNativePluginTests().registerTests();
}
