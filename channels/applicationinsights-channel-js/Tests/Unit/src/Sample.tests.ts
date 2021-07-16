import { AITestClass } from "@microsoft/ai-test-framework";
import { Sample } from "../../../src/TelemetryProcessors/Sample";
import { ITelemetryItem } from "@microsoft/applicationinsights-core-js";
import { PageView, TelemetryItemCreator, IPageViewTelemetry, Util } from "@microsoft/applicationinsights-common";
import { HashCodeScoreGenerator } from "../../../src/TelemetryProcessors/SamplingScoreGenerators/HashCodeScoreGenerator";

export class SampleTests extends AITestClass {
    private sample: Sample
    private item: ITelemetryItem;

    public testInitialize() {
    }

    public testCleanup() {
        this.sample = null;
        this.item = null;
    }

    public registerTests() {
        this.addSamplingTests();
    }

    private addSamplingTests() {
        this.testCase({
            name: 'Sampling: isSampledIn returns true for 100 sampling rate',
            test: () => {
                this.sample = new Sample(100);
                this.item = this.getTelemetryItem();
                const scoreStub = this.sandbox.stub(this.sample["samplingScoreGenerator"], "getSamplingScore");

                QUnit.assert.ok(this.sample.isSampledIn(this.item));
                QUnit.assert.ok(scoreStub.notCalled);
            }
        });

        this.testCase({
            name: 'Sampling: hashing is based on user id even if operation id is provided',
            test: () => {
                this.sample = new Sample(33);

                const userid = "asdf";

                const item1 = this.getTelemetryItem();
                item1.tags["ai.user.id"] = userid;
                item1.tags["ai.operation.id"] = "operation 1";

                const item2 = this.getTelemetryItem();
                item2.tags["ai.user.id"] = userid;
                item2.tags["ai.operation.id"] = "operation 1";

                const isSampledIn1 = this.sample.isSampledIn(item1);
                const isSampledIn2 = this.sample.isSampledIn(item2);

                QUnit.assert.equal(isSampledIn1, isSampledIn2);
            }
        });

        this.testCase({
            name: 'Sampling: hashing is based on operation id if no user id is provided',
            test: () => {
                this.sample = new Sample(33);
                const operationId = "operation id";

                const item1 = this.getTelemetryItem();
                item1.tags["ai.user.id"] = null;
                item1.tags["ai.operation.id"] = operationId;

                const item2 = this.getTelemetryItem();
                item2.tags["ai.user.id"] = null;
                item2.tags["ai.operation.id"] = operationId;

                const item3 = this.getTelemetryItem();
                item3.tags["ai.user.id"] = null;
                item3.tags["ai.operation.id"] = operationId;

                const item4 = this.getTelemetryItem();
                item4.tags["ai.user.id"] = null;
                item4.tags["ai.operation.id"] = operationId;

                // Act
                const isSampledIn1 = this.sample.isSampledIn(item1);
                const isSampledIn2 = this.sample.isSampledIn(item2);
                const isSampledIn3 = this.sample.isSampledIn(item3);
                const isSampledIn4 = this.sample.isSampledIn(item4);

                QUnit.assert.equal(isSampledIn1, isSampledIn2);
                QUnit.assert.equal(isSampledIn1, isSampledIn3);
                QUnit.assert.equal(isSampledIn1, isSampledIn4);
            }
        });

        this.testCase({
            name: 'Sampling: hashing is random if no user id nor operation id provided',
            test: () => {
                // setup
                this.sample = new Sample(33);

                const envelope1 = this.getTelemetryItem();
                envelope1.tags["ai.user.id"] = null;
                envelope1.tags["ai.operation.id"] = null;

                const mathRandomSpy = this.sandbox.spy(Math, "random");

                // act
                this.sample.isSampledIn(envelope1);

                // assert
                QUnit.assert.ok(mathRandomSpy.calledOnce);
            }
        });

        this.testCase({
            name: 'Sampling: actual sampling rate should fall into 5% error range',
            test: () => {

                // setup
                const errorRange = 5;
                const totalItems = 1000;
                const ids = [];
                for (let i = 0; i < totalItems; ++i) {
                    ids.push(Util.newId());
                }

                const sampleRates = [50, 33, 25, 20, 16, 10];

                // act
                sampleRates.forEach((sampleRate) => {
                    const sut = new HashCodeScoreGenerator();
                    let countOfSampledItems = 0;

                    ids.forEach((id) => {
                        if (sut.getHashCodeScore(id) < sampleRate) {++countOfSampledItems; }
                    });

                    // Assert
                    const actualSampleRate = 100 * countOfSampledItems / totalItems;
                    QUnit.assert.ok(Math.abs(actualSampleRate - sampleRate) < errorRange,
                        "Actual sampling (" + actualSampleRate + ") does not fall into +-2% range from expected rate (" + sampleRate + ")");
                });
            }
        });
    }

    private getTelemetryItem(): ITelemetryItem {
        return TelemetryItemCreator.create<IPageViewTelemetry>({
            name: 'some page',
            uri: 'some uri'
        }, PageView.dataType, PageView.envelopeType, null);
    }

    private getMetricItem(): ITelemetryItem {
        return null;
    }
}
