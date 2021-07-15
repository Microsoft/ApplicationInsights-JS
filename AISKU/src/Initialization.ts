// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    IConfiguration, AppInsightsCore, IAppInsightsCore, LoggingSeverity, _InternalMessageId, ITelemetryItem, ICustomProperties,
    IChannelControls, hasWindow, hasDocument, isReactNative, doPerf, IDiagnosticLogger, INotificationManager, objForEachKey, proxyAssign,
    arrForEach, isString, isFunction, isNullOrUndefined, addEventHandler, isArray, throwError, ICookieMgr, safeGetCookieMgr
} from "@microsoft/applicationinsights-core-js";
import { ApplicationInsights } from "@microsoft/applicationinsights-analytics-js";
import { Sender } from "@microsoft/applicationinsights-channel-js";
import { PropertiesPlugin } from "@microsoft/applicationinsights-properties-js";
import { AjaxPlugin as DependenciesPlugin, IDependenciesPlugin } from '@microsoft/applicationinsights-dependencies-js';
import {
    IUtil, Util, ICorrelationIdHelper, CorrelationIdHelper, IUrlHelper, UrlHelper, IDateTimeUtils, DateTimeUtils, ConnectionStringParser, FieldType,
    IRequestHeaders, RequestHeaders, DisabledPropertyName, ProcessLegacy, SampleRate, HttpMethod, DEFAULT_BREEZE_ENDPOINT, AIData, AIBase,
    Envelope, Event, Exception, Metric, PageView, PageViewData, RemoteDependencyData, IEventTelemetry,
    ITraceTelemetry, IMetricTelemetry, IDependencyTelemetry, IExceptionTelemetry, IAutoExceptionTelemetry,
    IPageViewTelemetry, IPageViewPerformanceTelemetry, Trace, PageViewPerformance, Data, SeverityLevel,
    IConfig, ConfigurationManager, ContextTagKeys, IDataSanitizer, DataSanitizer, TelemetryItemCreator, IAppInsights, CtxTagKeys, Extensions,
    IPropertiesPlugin, DistributedTracingModes, PropertiesPluginIdentifier, BreezeChannelIdentifier, AnalyticsPluginIdentifier,
    ITelemetryContext as Common_ITelemetryContext, parseConnectionString
} from "@microsoft/applicationinsights-common"

"use strict";

let _internalSdkSrc: string;

// This is an exclude list of properties that should not be updated during initialization
// They include a combination of private and internal property names
const _ignoreUpdateSnippetProperties = [
    "snippet", "dependencies", "properties", "_snippetVersion", "appInsightsNew", "getSKUDefaults",
];

/**
 *
 * @export
 * @interface Snippet
 */
export interface Snippet {
    config: IConfiguration & IConfig;
    queue?: Array<() => void>;
    sv?: string;
    version?: number;
}

export interface IApplicationInsights extends IAppInsights, IDependenciesPlugin, IPropertiesPlugin {
    appInsights: ApplicationInsights;
    flush: (async?: boolean) => void;
    onunloadFlush: (async?: boolean) => void;
    getSender: () => Sender;
    setAuthenticatedUserContext(authenticatedUserId: string, accountId?: string, storeInCookie?: boolean): void;
    clearAuthenticatedUserContext(): void;
};

// Re-exposing the Common classes as Telemetry, the list was taken by reviewing the generated code for the build while using
// the previous configuration :-
// import * as Common from "@microsoft/applicationinsights-common"
// export const Telemetry = Common;

let fieldType = {
    Default: FieldType.Default,
    Required: FieldType.Required,
    Array: FieldType.Array,
    Hidden: FieldType.Hidden
};

/**
 * Telemetry type classes, e.g. PageView, Exception, etc
 */
export const Telemetry = {
    __proto__: null as any,
    PropertiesPluginIdentifier,
    BreezeChannelIdentifier,
    AnalyticsPluginIdentifier,
    Util,
    CorrelationIdHelper,
    UrlHelper,
    DateTimeUtils,
    ConnectionStringParser,
    FieldType: fieldType,
    RequestHeaders,
    DisabledPropertyName,
    ProcessLegacy,
    SampleRate,
    HttpMethod,
    DEFAULT_BREEZE_ENDPOINT,
    AIData,
    AIBase,
    Envelope,
    Event,
    Exception,
    Metric,
    PageView,
    PageViewData,
    RemoteDependencyData,
    Trace,
    PageViewPerformance,
    Data,
    SeverityLevel,
    ConfigurationManager,
    ContextTagKeys,
    DataSanitizer: DataSanitizer as IDataSanitizer,
    TelemetryItemCreator,
    CtxTagKeys,
    Extensions,
    DistributedTracingModes
};

/**
 * Application Insights API
 * @class Initialization
 * @implements {IApplicationInsights}
 */
export class Initialization implements IApplicationInsights {
    public snippet: Snippet;
    public config: IConfiguration & IConfig;
    public appInsights: ApplicationInsights;
    public core: IAppInsightsCore;
    public context: Common_ITelemetryContext;

    private dependencies: DependenciesPlugin;
    private properties: PropertiesPlugin;
    private _sender: Sender;
    private _snippetVersion: string;

    constructor(snippet: Snippet) {
        let _self = this;
        // initialize the queue and config in case they are undefined
        _self._snippetVersion = "" + (snippet.sv || snippet.version || "");
        snippet.queue = snippet.queue || [];
        snippet.version = snippet.version || 2.0; // Default to new version
        let config: IConfiguration & IConfig = snippet.config || ({} as any);

        if (config.connectionString) {
            const cs = parseConnectionString(config.connectionString);
            const ingest = cs.ingestionendpoint;
            config.endpointUrl = ingest ? `${ingest}/v2/track` : config.endpointUrl; // only add /v2/track when from connectionstring
            config.instrumentationKey = cs.instrumentationkey || config.instrumentationKey;
        }

        _self.appInsights = new ApplicationInsights();

        _self.properties = new PropertiesPlugin();
        _self.dependencies = new DependenciesPlugin();
        _self.core = new AppInsightsCore();
        _self._sender = new Sender();

        _self.snippet = snippet;
        _self.config = config;
        _self.getSKUDefaults();
    }

    // Analytics Plugin

    /**
     * Get the current cookie manager for this instance
     */
    public getCookieMgr(): ICookieMgr {
        return this.appInsights.getCookieMgr();
    };

    /**
     * Log a user action or other occurrence.
     * @param {IEventTelemetry} event
     * @param {ICustomProperties} [customProperties]
     * @memberof Initialization
     */
    public trackEvent(event: IEventTelemetry, customProperties?: ICustomProperties) {
        this.appInsights.trackEvent(event, customProperties);
    }

    /**
     * Logs that a page, or similar container was displayed to the user.
     * @param {IPageViewTelemetry} pageView
     * @memberof Initialization
     */
    public trackPageView(pageView?: IPageViewTelemetry) {
        const inPv = pageView || {};
        this.appInsights.trackPageView(inPv);
    }

    /**
     * Log a bag of performance information via the customProperties field.
     * @param {IPageViewPerformanceTelemetry} pageViewPerformance
     * @memberof Initialization
     */
    public trackPageViewPerformance(pageViewPerformance: IPageViewPerformanceTelemetry): void {
        const inPvp = pageViewPerformance || {};
        this.appInsights.trackPageViewPerformance(inPvp);
    }

    /**
     * Log an exception that you have caught.
     * @param {IExceptionTelemetry} exception
     * @memberof Initialization
     */
    public trackException(exception: IExceptionTelemetry): void {
        if (exception && !exception.exception && (exception as any).error) {
            exception.exception = (exception as any).error;
        }
        this.appInsights.trackException(exception);
    }

    /**
     * Manually send uncaught exception telemetry. This method is automatically triggered
     * on a window.onerror event.
     * @param {IAutoExceptionTelemetry} exception
     * @memberof Initialization
     */
    public _onerror(exception: IAutoExceptionTelemetry): void {
        this.appInsights._onerror(exception);
    }

    /**
     * Log a diagnostic scenario such entering or leaving a function.
     * @param {ITraceTelemetry} trace
     * @param {ICustomProperties} [customProperties]
     * @memberof Initialization
     */
    public trackTrace(trace: ITraceTelemetry, customProperties?: ICustomProperties): void {
        this.appInsights.trackTrace(trace, customProperties);
    }

    /**
     * Log a numeric value that is not associated with a specific event. Typically used
     * to send regular reports of performance indicators.
     *
     * To send a single measurement, just use the `name` and `average` fields
     * of {@link IMetricTelemetry}.
     *
     * If you take measurements frequently, you can reduce the telemetry bandwidth by
     * aggregating multiple measurements and sending the resulting average and modifying
     * the `sampleCount` field of {@link IMetricTelemetry}.
     * @param {IMetricTelemetry} metric input object argument. Only `name` and `average` are mandatory.
     * @param {ICustomProperties} [customProperties]
     * @memberof Initialization
     */
    public trackMetric(metric: IMetricTelemetry, customProperties?: ICustomProperties): void {
        this.appInsights.trackMetric(metric, customProperties);
    }
    /**
     * Starts the timer for tracking a page load time. Use this instead of `trackPageView` if you want to control when the page view timer starts and stops,
     * but don't want to calculate the duration yourself. This method doesn't send any telemetry. Call `stopTrackPage` to log the end of the page view
     * and send the event.
     * @param name A string that idenfities this item, unique within this HTML document. Defaults to the document title.
     */
    public startTrackPage(name?: string): void {
        this.appInsights.startTrackPage(name);
    }

    /**
     * Stops the timer that was started by calling `startTrackPage` and sends the pageview load time telemetry with the specified properties and measurements.
     * The duration of the page view will be the time between calling `startTrackPage` and `stopTrackPage`.
     * @param   name  The string you used as the name in startTrackPage. Defaults to the document title.
     * @param   url   String - a relative or absolute URL that identifies the page or other item. Defaults to the window location.
     * @param   properties  map[string, string] - additional data used to filter pages and metrics in the portal. Defaults to empty.
     * @param   measurements    map[string, number] - metrics associated with this page, displayed in Metrics Explorer on the portal. Defaults to empty.
     */
    public stopTrackPage(name?: string, url?: string, customProperties?: { [key: string]: any; }, measurements?: { [key: string]: number; }) {
        this.appInsights.stopTrackPage(name, url, customProperties, measurements);
    }

    public startTrackEvent(name?: string): void {
        this.appInsights.startTrackEvent(name);
    }

    /**
     * Log an extended event that you started timing with `startTrackEvent`.
     * @param   name    The string you used to identify this event in `startTrackEvent`.
     * @param   properties  map[string, string] - additional data used to filter events and metrics in the portal. Defaults to empty.
     * @param   measurements    map[string, number] - metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
     */
    public stopTrackEvent(name: string, properties?: { [key: string]: string; }, measurements?: { [key: string]: number; }) {
        this.appInsights.stopTrackEvent(name, properties, measurements); // Todo: Fix to pass measurements once type is updated
    }

    public addTelemetryInitializer(telemetryInitializer: (item: ITelemetryItem) => boolean | void) {
        return this.appInsights.addTelemetryInitializer(telemetryInitializer);
    }

    // Properties Plugin

    /**
     * Set the authenticated user id and the account id. Used for identifying a specific signed-in user. Parameters must not contain whitespace or ,;=|
     *
     * The method will only set the `authenticatedUserId` and `accountId` in the current page view. To set them for the whole session, you should set `storeInCookie = true`
     * @param {string} authenticatedUserId
     * @param {string} [accountId]
     * @param {boolean} [storeInCookie=false]
     * @memberof Initialization
     */
    public setAuthenticatedUserContext(authenticatedUserId: string, accountId?: string, storeInCookie = false): void {
        this.properties.context.user.setAuthenticatedUserContext(authenticatedUserId, accountId, storeInCookie);
    }

    /**
     * Clears the authenticated user id and account id. The associated cookie is cleared, if present.
     * @memberof Initialization
     */
    public clearAuthenticatedUserContext(): void {
        this.properties.context.user.clearAuthenticatedUserContext();
    }

    // Dependencies Plugin

    /**
     * Log a dependency call (e.g. ajax)
     * @param {IDependencyTelemetry} dependency
     * @memberof Initialization
     */
    public trackDependencyData(dependency: IDependencyTelemetry): void {
        this.dependencies.trackDependencyData(dependency);
    }

    // Misc

    /**
     * Manually trigger an immediate send of all telemetry still in the buffer.
     * @param {boolean} [async=true]
     * @memberof Initialization
     */
    public flush(async: boolean = true) {
        doPerf(this.core, () => "AISKU.flush", () => {
            arrForEach(this.core.getTransmissionControls(), channels => {
                arrForEach(channels, channel => {
                    channel.flush(async);
                })
            })
        }, null, async);
    }

    /**
     * Manually trigger an immediate send of all telemetry still in the buffer using beacon Sender.
     * Fall back to xhr sender if beacon is not supported.
     * @param {boolean} [async=true]
     * @memberof Initialization
     */
    public onunloadFlush(async: boolean = true) {
        arrForEach(this.core.getTransmissionControls(), channels => {
            arrForEach(channels, (channel: IChannelControls & Sender) => {
                if (channel.onunloadFlush) {
                    channel.onunloadFlush();
                } else {
                    channel.flush(async);
                }
            })
        })
    }

    /**
     * Initialize this instance of ApplicationInsights
     * @returns {IApplicationInsights}
     * @memberof Initialization
     */
    public loadAppInsights(legacyMode: boolean = false, logger?: IDiagnosticLogger, notificationManager?: INotificationManager): IApplicationInsights {
        let _self = this;

        function _updateSnippetProperties(snippet: Snippet) {
            if (snippet) {
                let snippetVer = "";
                if (!isNullOrUndefined(_self._snippetVersion)) {
                    snippetVer += _self._snippetVersion;
                }
                if (legacyMode) {
                    snippetVer += ".lg";
                }

                if (_self.context && _self.context.internal) {
                    _self.context.internal.snippetVer = snippetVer || "-";
                }

                // apply updated properties to the global instance (snippet)
                objForEachKey(_self, (field, value) => {
                    if (isString(field) &&
                            !isFunction(value) &&
                            field && field[0] !== "_" &&                                // Don't copy "internal" values
                            _ignoreUpdateSnippetProperties.indexOf(field) === -1) {
                        snippet[field as string] = value;
                    }
                });
            }
        }

        // dont allow additional channels/other extensions for legacy mode; legacy mode is only to allow users to switch with no code changes!
        if (legacyMode && _self.config.extensions && _self.config.extensions.length > 0) {
            throwError("Extensions not allowed in legacy mode");
        }

        doPerf(_self.core, () => "AISKU.loadAppInsights", () => {
            const extensions = [];

            extensions.push(_self._sender);
            extensions.push(_self.properties);
            extensions.push(_self.dependencies);
            extensions.push(_self.appInsights);

            // initialize core
            _self.core.initialize(_self.config, extensions, logger, notificationManager);
            _self.context = _self.properties.context;
            if (_internalSdkSrc && _self.context) {
                _self.context.internal.sdkSrc = _internalSdkSrc;
            }
            _updateSnippetProperties(_self.snippet);

            // Empty queue of all api calls logged prior to sdk download
            _self.emptyQueue();
            _self.pollInternalLogs();
            _self.addHousekeepingBeforeUnload(this);
        });

        return _self;
    }

    /**
     * Overwrite the lazy loaded fields of global window snippet to contain the
     * actual initialized API methods
     * @param {Snippet} snippet
     * @memberof Initialization
     */
    public updateSnippetDefinitions(snippet: Snippet) {
        // apply full appInsights to the global instance
        // Note: This must be called before loadAppInsights is called
        proxyAssign(snippet, this, (name: string) => {
            // Not excluding names prefixed with "_" as we need to proxy some functions like _onError
            return name && _ignoreUpdateSnippetProperties.indexOf(name) === -1;
        });
    }

    /**
     * Call any functions that were queued before the main script was loaded
     * @memberof Initialization
     */
    public emptyQueue() {
        let _self = this;

        // call functions that were queued before the main script was loaded
        try {
            if (isArray(_self.snippet.queue)) {
                // note: do not check length in the for-loop conditional in case something goes wrong and the stub methods are not overridden.
                const length = _self.snippet.queue.length;
                for (let i = 0; i < length; i++) {
                    const call = _self.snippet.queue[i];
                    call();
                }

                _self.snippet.queue = undefined;
                delete _self.snippet.queue;
            }
        } catch (exception) {
            const properties: any = {};
            if (exception && isFunction(exception.toString)) {
                properties.exception = exception.toString();
            }

            // need from core
            // Microsoft.ApplicationInsights._InternalLogging.throwInternal(
            //     LoggingSeverity.WARNING,
            //     _InternalMessageId.FailedToSendQueuedTelemetry,
            //     "Failed to send queued telemetry",
            //     properties);
        }
    }

    public pollInternalLogs(): void {
        this.core.pollInternalLogs();
    }

    public addHousekeepingBeforeUnload(appInsightsInstance: IApplicationInsights): void {
        // Add callback to push events when the user navigates away

        if (hasWindow() || hasDocument()) {
            const performHousekeeping = () => {
                // Adds the ability to flush all data before the page unloads.
                // Note: This approach tries to push a sync request with all the pending events onbeforeunload.
                // Firefox does not respect this.Other browsers DO push out the call with < 100% hit rate.
                // Telemetry here will help us analyze how effective this approach is.
                // Another approach would be to make this call sync with a acceptable timeout to reduce the
                // impact on user experience.

                // appInsightsInstance.context._sender.triggerSend();
                appInsightsInstance.onunloadFlush(false);

                // Back up the current session to local storage
                // This lets us close expired sessions after the cookies themselves expire
                arrForEach(appInsightsInstance.appInsights.core['_extensions'], (ext: any) => {
                    if (ext.identifier === PropertiesPluginIdentifier) {
                        if (ext && ext.context && ext.context._sessionManager) {
                            ext.context._sessionManager.backup();
                        }
                        return -1;
                    }
                });
            };

            if (!appInsightsInstance.appInsights.config.disableFlushOnBeforeUnload) {
                // Hook the unload event for the document, window and body to ensure that the client events are flushed to the server
                // As just hooking the window does not always fire (on chrome) for page navigations.
                let added = addEventHandler('beforeunload', performHousekeeping);
                added = addEventHandler('unload', performHousekeeping) || added;
                added = addEventHandler('pagehide', performHousekeeping) || added;
                added = addEventHandler('visibilitychange', performHousekeeping) || added;

                // A reactNative app may not have a window and therefore the beforeunload/pagehide events -- so don't
                // log the failure in this case
                if (!added && !isReactNative()) {
                    appInsightsInstance.appInsights.core.logger.throwInternal(
                        LoggingSeverity.CRITICAL,
                        _InternalMessageId.FailedToAddHandlerForOnBeforeUnload,
                        'Could not add handler for beforeunload and pagehide');
                }
            }

            // We also need to hook the pagehide and visibilitychange events as not all versions of Safari support load/unload events.
            if (!appInsightsInstance.appInsights.config.disableFlushOnUnload) {
                // Not adding any telemetry as pagehide as it's not supported on all browsers
                addEventHandler('pagehide', performHousekeeping);
                addEventHandler('visibilitychange', performHousekeeping);
            }
        }
    }

    public getSender(): Sender {
        return this._sender;
    }

    private getSKUDefaults() {
        let _self = this;
        _self.config.diagnosticLogInterval =
            _self.config.diagnosticLogInterval && _self.config.diagnosticLogInterval > 0 ? _self.config.diagnosticLogInterval : 10000;
    }
}

// tslint:disable-next-line
(function () {
    let sdkSrc = null;
    let isModule = false;
    let cdns: string[] = [
        "://js.monitor.azure.com/",
        "://az416426.vo.msecnd.net/"
    ];

    try {
        // Try and determine whether the sdk is being loaded from the CDN
        // currentScript is only valid during initial processing
        let scrpt = (document || {} as any).currentScript;
        if (scrpt) {
            sdkSrc = scrpt.src;
        // } else {
        //     // We need to update to at least typescript 2.9 for this to work :-(
        //     // Leaving as a stub for now so after we upgrade this breadcrumb is available
        //     let meta = import.meta;
        //     sdkSrc = (meta || {}).url;
        //     isModule = true;
        }
    } catch (e) {
        // eslint-disable-next-line no-empty
    }

    if (sdkSrc) {
        try {
            let url = sdkSrc.toLowerCase();
            if (url) {
                let src = "";
                for (let idx = 0; idx < cdns.length; idx++) {
                    if (url.indexOf(cdns[idx]) !== -1) {
                        src = "cdn" + (idx + 1);
                        if (url.indexOf("/scripts/") === -1) {
                            if (url.indexOf("/next/") !== -1) {
                                src += "-next";
                            } else if (url.indexOf("/beta/") !== -1) {
                                src += "-beta";
                            }
                        }

                        _internalSdkSrc = src + (isModule ? ".mod" : "");
                        break;
                    }
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-empty
        }
    }
})();
