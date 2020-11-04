/// <reference path='./TestFramework/Common.ts' />
import {
  ApplicationInsights,
  IApplicationInsights,
} from "../src/applicationinsights-web";
import { Sender } from "@microsoft/applicationinsights-channel-js";
import {
  NotificationManager,
  IPerfEvent,
  PerfManager,
} from "@microsoft/applicationinsights-core-js";
import {
  Event,
  Trace,
  Exception,
  Metric,
  PageView,
  PageViewPerformance,
  RemoteDependencyData,
} from "@microsoft/applicationinsights-common";
import { EventValidator } from "./TelemetryValidation/EventValidator";
import { TraceValidator } from "./TelemetryValidation/TraceValidator";
import { ExceptionValidator } from "./TelemetryValidation/ExceptionValidator";
import { MetricValidator } from "./TelemetryValidation/MetricValidator";
import { PageViewPerformanceValidator } from "./TelemetryValidation/PageViewPerformanceValidator";
import { PageViewValidator } from "./TelemetryValidation/PageViewValidator";
import { RemoteDepdencyValidator } from "./TelemetryValidation/RemoteDepdencyValidator";

export class PerfTests extends TestClass {
  private readonly _instrumentationKey = "b7170927-2d1c-44f1-acec-59f4e1751c11";

  private _ai: IApplicationInsights;

  // Sinon
  private errorSpy: SinonSpy;
  private successSpy: SinonSpy;
  private loggingSpy: SinonSpy;

  private delay = 100;
  private _notificationManager;
  private _sendNotifications;

  public testInitialize() {
    
      this.useFakeServer = false;
      (sinon.fakeServer as any).restore();
      this.useFakeTimers = false;
      this.clock.restore();

      // Setup Notification Listener
      this._sendNotifications = [];
  }

  public testCleanup() {
    this.useFakeServer = true;
    this.useFakeTimers = true;
    this._sendNotifications = [];
    this.successSpy.restore();
  }

  public registerTests() {
    this.addPerfTests();
  }

  private addPerfTests(): void {
    this.testCase({
      name: "AISKU Perf Tests -> load AppInsights",
      test: () => {
        try {
          const configObj= {
            instrumentationKey: this._instrumentationKey,
            extensionConfig: {
              AppInsightsChannelPlugin: {
                maxBatchInterval: 2000,
                maxBatchSizeInBytes: 10 * 1024 * 1024, // 10 MB
              },
            },
          };
          const init = new ApplicationInsights({
            config: configObj
          });
          this._notificationManager = new NotificationManager();
          this._notificationManager.addNotificationListener({
              perfEvent: (perfEvent: IPerfEvent): void => {
              this._sendNotifications.push(perfEvent);
            },
          });
          init.core.setPerfMgr(new PerfManager(this._notificationManager));
          init.loadAppInsights(false, null, this._notificationManager);
          this._ai = init;
    
          // Setup Sinon stuff
          const sender: Sender = this._ai.appInsights.core.getTransmissionControls()[0][0] as Sender;
          this.errorSpy = this.sandbox.spy(sender, "_onError");
          this.successSpy = this.sandbox.spy(sender, "_onSuccess");
          this.loggingSpy = this.sandbox.stub(
            this._ai.appInsights.core.logger,
            "throwInternal"
          );
        } catch (e) {
          console.error("Failed to initialize");
        }
        QUnit.assert.ok(this._sendNotifications.length === 1);
        QUnit.assert.ok(
          this._sendNotifications[0].name.indexOf("AISKU.loadAppInsights") !==
            -1,
          "AppInsights Load time: " + this._sendNotifications[0].time
        );
        console.log(
          "Exec time loadAppInsights: " + this._sendNotifications[0].time
        );
      },
    });

    this.testCaseAsync({
      name: "AISKU Perf Tests -> processTelemetry",
      stepDelay: 100,
      steps: [
        () => {
          try {
            const configObj= {
              instrumentationKey: this._instrumentationKey,
              extensionConfig: {
                AppInsightsChannelPlugin: {
                  maxBatchInterval: 2000,
                  maxBatchSizeInBytes: 10 * 1024 * 1024, // 10 MB
                },
              },
              perfEvtsSendAll: true
            };
            const init = new ApplicationInsights({
              config: configObj
            });
            this._notificationManager = new NotificationManager(configObj);
            this._notificationManager.addNotificationListener({
                perfEvent: (perfEvent: IPerfEvent): void => {
                this._sendNotifications.push(perfEvent);
              },
            });
      
            init.core.setPerfMgr(new PerfManager(this._notificationManager));
            init.loadAppInsights(false, null, this._notificationManager);
            this._ai = init;
      
            // Setup Sinon stuff
            const sender: Sender = this._ai.appInsights.core.getTransmissionControls()[0][0] as Sender;
            this.errorSpy = this.sandbox.spy(sender, "_onError");
            this.successSpy = this.sandbox.spy(sender, "_onSuccess");
            this.loggingSpy = this.sandbox.stub(
              this._ai.appInsights.core.logger,
              "throwInternal"
            );
          } catch (e) {
            console.error("Failed to initialize");
          }
          for (let i = 0; i < 100; i++) {
            let exception = null;
            try {
              window["a"]["b"]();
            } catch (e) {
              exception = e;
            }

            Assert.ok(exception);

            this._ai.trackException({ exception });
            this._ai.trackMetric({
              name: "test",
              average: Math.round(100 * Math.random()),
            });
            this._ai.trackTrace({ message: "test" });
          }
        },
      ]
        .concat(this.asserts(300))
        .concat(() => {
          let totalTrackExtime = 0;
          let processTelemetryEvents = this._sendNotifications.filter(
            (event) => event.name.indexOf("processTelemetry") !== -1
          );
          QUnit.assert.ok(processTelemetryEvents.length === 300*6);
          for(let i=0;i<processTelemetryEvents.length;i++) {
            totalTrackExtime += processTelemetryEvents[i].exTime;
          }
          console.log(
            "Avg Exec time processTelemetry (avg over 300 track calls): " +
              totalTrackExtime / 300
          );
        }),
    });

    this.testCaseAsync({
      name: "AISKU Perf Tests -> flush all event types",
      stepDelay: 1,
      steps: [
        () => {
          try {
            const configObj= {
              instrumentationKey: this._instrumentationKey,
              extensionConfig: {
                AppInsightsChannelPlugin: {
                  maxBatchInterval: 2000,
                  maxBatchSizeInBytes: 10 * 1024 * 1024, // 10 MB
                },
              },
            };
            const init = new ApplicationInsights({
              config: configObj
            });
            this._notificationManager = new NotificationManager();
            this._notificationManager.addNotificationListener({
                perfEvent: (perfEvent: IPerfEvent): void => {
                this._sendNotifications.push(perfEvent);
              },
            });
      
            init.core.setPerfMgr(new PerfManager(this._notificationManager));
            init.loadAppInsights(false, null, this._notificationManager);
            this._ai = init;
      
            // Setup Sinon stuff
            const sender: Sender = this._ai.appInsights.core.getTransmissionControls()[0][0] as Sender;
            this.errorSpy = this.sandbox.spy(sender, "_onError");
            this.successSpy = this.sandbox.spy(sender, "_onSuccess");
            this.loggingSpy = this.sandbox.stub(
              this._ai.appInsights.core.logger,
              "throwInternal"
            );
          } catch (e) {
            console.error("Failed to initialize");
          }
          let exception = null;
          try {
            window["a"]["b"]();
          } catch (e) {
            exception = e;
          }

          Assert.ok(exception);

          this._ai.trackException({ exception });
          this._ai.trackMetric({
            name: "test",
            average: Math.round(100 * Math.random()),
          });
          this._ai.trackTrace({ message: "test" });
          this._ai.trackPageView({}); // sends 2
          this._ai.trackPageViewPerformance({
            name: "name",
            uri: "http://someurl",
          });
          this._ai.flush();
        },
      ]
        .concat(this.asserts(6))
        .concat(() => {
          let flushEvent = this._sendNotifications.filter(
            (event) => event.name.indexOf("AISKU.flush") !== -1
          );
          console.log(
            "Exec time flush (all event types): " + flushEvent[0].time
          );
        }),
    });

    this.testCaseAsync({
      name: "AISKU Perf Tests -> track",
      stepDelay: 100,
      steps: [
        () => {
          try {
            const configObj= {
              instrumentationKey: this._instrumentationKey,
              extensionConfig: {
                AppInsightsChannelPlugin: {
                  maxBatchInterval: 2000,
                  maxBatchSizeInBytes: 10 * 1024 * 1024, // 10 MB
                },
              },
            };
            const init = new ApplicationInsights({
              config: configObj
            });
            this._notificationManager = new NotificationManager();
            this._notificationManager.addNotificationListener({
                perfEvent: (perfEvent: IPerfEvent): void => {
                this._sendNotifications.push(perfEvent);
              },
            });
      
            init.core.setPerfMgr(new PerfManager(this._notificationManager));
            init.loadAppInsights(false, null, this._notificationManager);
            this._ai = init;
      
            // Setup Sinon stuff
            const sender: Sender = this._ai.appInsights.core.getTransmissionControls()[0][0] as Sender;
            this.errorSpy = this.sandbox.spy(sender, "_onError");
            this.successSpy = this.sandbox.spy(sender, "_onSuccess");
            this.loggingSpy = this.sandbox.stub(
              this._ai.appInsights.core.logger,
              "throwInternal"
            );
          } catch (e) {
            console.error("Failed to initialize");
          }
          for (let i = 0; i < 100; i++) {
            let exception = null;
            try {
              window["a"]["b"]();
            } catch (e) {
              exception = e;
            }

            Assert.ok(exception);

            this._ai.trackException({ exception });
            this._ai.trackMetric({
              name: "test",
              average: Math.round(100 * Math.random()),
            });
            this._ai.trackTrace({ message: "test" });
          }
        },
      ]
        .concat(this.asserts(300))
        .concat(() => {
          let trackEvent = this._sendNotifications.filter(
            (event) => event.name.indexOf("track") !== -1
          );
          QUnit.assert.ok(trackEvent.length === 300);
          let totalTrackExtime = 0;
          for (let i = 0; i < trackEvent.length; i++) {
            totalTrackExtime += trackEvent[i].time;
          }
          console.log(
            "Exec time track (avg over 300 track calls): " +
              totalTrackExtime / 300
          );
        }),
    });
  }

  private boilerPlateAsserts() {
    Assert.ok(this.successSpy.called, "success");
    Assert.ok(!this.errorSpy.called, "no error sending");
    const isValidCallCount = this.loggingSpy.callCount === 0;
    Assert.ok(isValidCallCount, "logging spy was called 0 time(s)");
    if (!isValidCallCount) {
      while (this.loggingSpy.args.length) {
        Assert.ok(false, "[warning thrown]: " + this.loggingSpy.args.pop());
      }
    }
  }

  private asserts: any = (
    expectedCount: number,
    includeInit: boolean = false,
    doBoilerPlate: boolean = true
  ) => [
    () => {
      const message = "polling: " + new Date().toISOString();
      Assert.ok(true, message);
      console.log(message);

      if (doBoilerPlate) {
        if (
          this.successSpy.called ||
          this.errorSpy.called ||
          this.loggingSpy.called
        ) {
          this.boilerPlateAsserts();
        }
      }
    },
    PollingAssert.createPollingAssert(
      () => {
        let argCount = 0;
        if (
          this.successSpy.called &&
          this.successSpy.args &&
          this.successSpy.args.length > 0
        ) {
          this.successSpy.args.forEach((call) => {
            argCount += call[0].length;
          });
        }

        Assert.ok(
          true,
          "* [" +
            argCount +
            " of " +
            expectedCount +
            "] checking success spy " +
            new Date().toISOString()
        );

        if (argCount >= expectedCount) {
          let payloadStr = this.getPayloadMessages(
            this.successSpy,
            includeInit
          );
          if (payloadStr.length > 0) {
            let currentCount: number = payloadStr.length;
            console.log(
              "curr: " + currentCount + " exp: " + expectedCount,
              " appId: " + this._ai.context.appId()
            );
            if (currentCount === expectedCount && !!this._ai.context.appId()) {
              const payload = JSON.parse(payloadStr[0]);
              const baseType = payload.data.baseType;
              // call the appropriate Validate depending on the baseType
              switch (baseType) {
                case Event.dataType:
                  return EventValidator.EventValidator.Validate(
                    payload,
                    baseType
                  );
                case Trace.dataType:
                  return TraceValidator.TraceValidator.Validate(
                    payload,
                    baseType
                  );
                case Exception.dataType:
                  return ExceptionValidator.ExceptionValidator.Validate(
                    payload,
                    baseType
                  );
                case Metric.dataType:
                  return MetricValidator.MetricValidator.Validate(
                    payload,
                    baseType
                  );
                case PageView.dataType:
                  return PageViewValidator.PageViewValidator.Validate(
                    payload,
                    baseType
                  );
                case PageViewPerformance.dataType:
                  return PageViewPerformanceValidator.PageViewPerformanceValidator.Validate(
                    payload,
                    baseType
                  );
                case RemoteDependencyData.dataType:
                  return RemoteDepdencyValidator.RemoteDepdencyValidator.Validate(
                    payload,
                    baseType
                  );

                default:
                  return EventValidator.EventValidator.Validate(
                    payload,
                    baseType
                  );
              }
            }
          }
        }

        return false;
      },
      "sender succeeded",
      60,
      1000
    ),
  ];
}
