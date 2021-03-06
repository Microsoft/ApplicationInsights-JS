// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    RequestHeaders, CorrelationIdHelper, TelemetryItemCreator, ICorrelationConfig,
    RemoteDependencyData, dateTimeUtilsNow, DisabledPropertyName, IDependencyTelemetry,
    IConfig, ITelemetryContext, PropertiesPluginIdentifier, DistributedTracingModes
} from '@microsoft/applicationinsights-common';
import {
    isNullOrUndefined, arrForEach, isString, strTrim, isFunction, LoggingSeverity, _InternalMessageId,
    IAppInsightsCore, BaseTelemetryPlugin, ITelemetryPluginChain, IConfiguration, IPlugin, ITelemetryItem, IProcessTelemetryContext,
    getLocation, getGlobal, strUndefined, strPrototype, IInstrumentCallDetails, InstrumentFunc, InstrumentProto, getPerformance,
    IInstrumentHooksCallbacks, IInstrumentHook, objForEachKey, generateW3CId, getIEVersion, dumpObj
} from '@microsoft/applicationinsights-core-js';
import { ajaxRecord, IAjaxRecordResponse } from './ajaxRecord';
import { EventHelper } from './ajaxUtils';
import { Traceparent } from './TraceParent';
import dynamicProto from "@microsoft/dynamicproto-js";

const AJAX_MONITOR_PREFIX = "ai.ajxmn.";
const strDiagLog = "diagLog";
const strAjaxData = "ajaxData";
const strThrowInternal = "throwInternal";
const strFetch = "fetch";

// Using a global value so that to handle same iKey with multiple app insights instances (mostly for testing)
let _markCount: number = 0;

/** @Ignore */
function _supportsFetch(): (input: RequestInfo, init?: RequestInit) => Promise<Response> {
    let _global = getGlobal();
    if (!_global ||
            isNullOrUndefined((_global as any).Request) ||
            isNullOrUndefined((_global as any).Request[strPrototype]) ||
            isNullOrUndefined(_global[strFetch])) {
        return null;
    }

    return _global[strFetch];
}

/**
 * Determines whether ajax monitoring can be enabled on this document
 * @returns True if Ajax monitoring is supported on this page, otherwise false
 * @ignore
 */
function _supportsAjaxMonitoring(ajaxMonitorInstance:AjaxMonitor): boolean {
    let result = false;

    if (typeof XMLHttpRequest !== strUndefined && !isNullOrUndefined(XMLHttpRequest)) {
        let proto = XMLHttpRequest[strPrototype];
        result = !isNullOrUndefined(proto) &&
            !isNullOrUndefined(proto.open) &&
            !isNullOrUndefined(proto.send) &&
            !isNullOrUndefined(proto.abort);
    }

    let ieVer = getIEVersion();
    if (ieVer && ieVer < 9) {
        result = false;
    }

    if (result) {
        // Disable if the XmlHttpRequest can't be extended or hooked
        try {
            let xhr = new XMLHttpRequest();
            xhr[strAjaxData] = {};

            // Check that we can update the prototype
            let theOpen = XMLHttpRequest[strPrototype].open;
            XMLHttpRequest[strPrototype].open = theOpen;
        } catch (e) {
            // We can't decorate the xhr object so disable monitoring
            result = false;
            _throwInternalCritical(ajaxMonitorInstance,
                _InternalMessageId.FailedMonitorAjaxOpen,
                "Failed to enable XMLHttpRequest monitoring, extension is not supported",
                {
                    exception: dumpObj(e)
                });
        }
    }

    return result;
}

/** @Ignore */
function _getFailedAjaxDiagnosticsMessage(xhr: XMLHttpRequestInstrumented): string {
    let result = "";
    try {
        if (!isNullOrUndefined(xhr) &&
            !isNullOrUndefined(xhr[strAjaxData]) &&
            !isNullOrUndefined(xhr[strAjaxData].requestUrl)) {
            result += "(url: '" + xhr[strAjaxData].requestUrl + "')";
        }
    } catch (e) { }

    return result;
}

/** @ignore */
function _throwInternalCritical(ajaxMonitorInstance:AjaxMonitor, msgId: _InternalMessageId, message: string, properties?: Object, isUserAct?: boolean): void {
    ajaxMonitorInstance[strDiagLog]()[strThrowInternal](LoggingSeverity.CRITICAL, msgId, message, properties, isUserAct);
}

/** @ignore */
function _throwInternalWarning(ajaxMonitorInstance:AjaxMonitor, msgId: _InternalMessageId, message: string, properties?: Object, isUserAct?: boolean): void {
    ajaxMonitorInstance[strDiagLog]()[strThrowInternal](LoggingSeverity.WARNING, msgId, message, properties, isUserAct);
}

/** @Ignore */
function _createErrorCallbackFunc(ajaxMonitorInstance:AjaxMonitor, internalMessage:_InternalMessageId, message:string) {
    // tslint:disable-next-line
    return function (args:IInstrumentCallDetails) {
        _throwInternalCritical(ajaxMonitorInstance,
            internalMessage,
            message,
            {
                ajaxDiagnosticsMessage: _getFailedAjaxDiagnosticsMessage(args.inst),
                exception: dumpObj(args.err)
            });
    };
}

function _indexOf(value:string, match:string):number {
    if (value && match) {
        return value.indexOf(match);
    }

    return -1;
}

export interface XMLHttpRequestInstrumented extends XMLHttpRequest {
    ajaxData: ajaxRecord;
}

export interface IDependenciesPlugin {
    /**
     * Logs dependency call
     * @param dependencyData dependency data object
     */
    trackDependencyData(dependency: IDependencyTelemetry): void;
}

export interface IInstrumentationRequirements extends IDependenciesPlugin {
    includeCorrelationHeaders: (ajaxData: ajaxRecord, input?: Request | string, init?: RequestInit, xhr?: XMLHttpRequestInstrumented) => any;
}

export class AjaxMonitor extends BaseTelemetryPlugin implements IDependenciesPlugin, IInstrumentationRequirements {

    public static identifier: string = "AjaxDependencyPlugin";

    public static getDefaultConfig(): ICorrelationConfig {
        const config: ICorrelationConfig = {
            maxAjaxCallsPerView: 500,
            disableAjaxTracking: false,
            disableFetchTracking: false,
            disableCorrelationHeaders: false,
            distributedTracingMode: DistributedTracingModes.AI,
            correlationHeaderExcludedDomains: [
                "*.blob.core.windows.net",
                "*.blob.core.chinacloudapi.cn",
                "*.blob.core.cloudapi.de",
                "*.blob.core.usgovcloudapi.net"],
            correlationHeaderDomains: undefined,
            appId: undefined,
            enableCorsCorrelation: false,
            enableRequestHeaderTracking: false,
            enableResponseHeaderTracking: false,
            enableAjaxErrorStatusText: false,
            enableAjaxPerfTracking: false,
            maxAjaxPerfLookupAttempts: 3,
            ajaxPerfLookupDelay: 25
        }
        return config;
    }

    public static getEmptyConfig(): ICorrelationConfig {
        let emptyConfig = this.getDefaultConfig();
        objForEachKey(emptyConfig, (value) => {
            emptyConfig[value] = undefined;
        });

        return emptyConfig;
    }

    public identifier: string = AjaxMonitor.identifier;

    priority: number = 120;

    constructor() {
        super();
        let strTrackDependencyDataInternal = "trackDependencyDataInternal"; // Using string to help with minification
        let location = getLocation();
        let _fetchInitialized:boolean = false;      // fetch monitoring initialized
        let _xhrInitialized:boolean = false;        // XHR monitoring initialized
        let _currentWindowHost:string = location && location.host && location.host.toLowerCase();
        let _config: ICorrelationConfig = AjaxMonitor.getEmptyConfig();
        let _enableRequestHeaderTracking = false;
        let _trackAjaxAttempts: number = 0;
        let _context: ITelemetryContext;
        let _isUsingW3CHeaders: boolean;
        let _isUsingAIHeaders: boolean;
        let _markPrefix: string;
        let _enableAjaxPerfTracking:boolean = false;
        let _maxAjaxCallsPerView:number = 0;
        let _enableResponseHeaderTracking:boolean = false;
        let _hooks:IInstrumentHook[] = [];
        let _disabledUrls:any = {};

        dynamicProto(AjaxMonitor, this, (_self, base) => {
            _self.initialize = (config: IConfiguration & IConfig, core: IAppInsightsCore, extensions: IPlugin[], pluginChain?:ITelemetryPluginChain) => {
                if (!_self.isInitialized()) {
                    base.initialize(config, core, extensions, pluginChain);
                    let ctx = _self._getTelCtx();
                    const defaultConfig = AjaxMonitor.getDefaultConfig();
                    objForEachKey(defaultConfig, (field, value) => {
                        _config[field] = ctx.getConfig(AjaxMonitor.identifier, field, value);
                    });

                    let distributedTracingMode = _config.distributedTracingMode;
                    _enableRequestHeaderTracking = _config.enableRequestHeaderTracking;
                    _enableAjaxPerfTracking = _config.enableAjaxPerfTracking;
                    _maxAjaxCallsPerView = _config.maxAjaxCallsPerView;
                    _enableResponseHeaderTracking = _config.enableResponseHeaderTracking;

                    _isUsingAIHeaders = distributedTracingMode === DistributedTracingModes.AI || distributedTracingMode === DistributedTracingModes.AI_AND_W3C;
                    _isUsingW3CHeaders = distributedTracingMode === DistributedTracingModes.AI_AND_W3C || distributedTracingMode === DistributedTracingModes.W3C;
                    if (_enableAjaxPerfTracking) {
                        let iKey = config.instrumentationKey || "unkwn";
                        if (iKey.length > 5) {
                            _markPrefix = AJAX_MONITOR_PREFIX + iKey.substring(iKey.length - 5) + ".";
                        } else {
                            _markPrefix = AJAX_MONITOR_PREFIX + iKey + ".";
                        }
                    }

                    if (_config.disableAjaxTracking === false) {
                        _instrumentXhr();
                    }

                    _instrumentFetch();

                    if (extensions.length > 0 && extensions) {
                        let propExt: any, extIx = 0;
                        while (!propExt && extIx < extensions.length) {
                            if (extensions[extIx] && extensions[extIx].identifier === PropertiesPluginIdentifier) {
                                propExt = extensions[extIx]
                            }
                            extIx++;
                        }
                        if (propExt) {
                            _context = propExt.context; // we could move IPropertiesPlugin to common as well
                        }
                    }
                }
            };

            _self.teardown = () => {
                // Remove all instrumentation hooks
                arrForEach(_hooks, (fn) => {
                    fn.rm();
                });
                _hooks = [];
                _fetchInitialized = false;
                _xhrInitialized = false;
                _self.setInitialized(false);
            }

            _self.trackDependencyData = (dependency: IDependencyTelemetry, properties?: { [key: string]: any }) => {
                _self[strTrackDependencyDataInternal](dependency, properties);
            }

            _self.includeCorrelationHeaders = (ajaxData: ajaxRecord, input?: Request | string, init?: RequestInit, xhr?: XMLHttpRequestInstrumented): any => {
                // Test Hook to allow the overriding of the location host
                let currentWindowHost = _self["_currentWindowHost"] || _currentWindowHost;
                if (input) { // Fetch
                    if (CorrelationIdHelper.canIncludeCorrelationHeader(_config, ajaxData.getAbsoluteUrl(), currentWindowHost)) {
                        if (!init) {
                            init = {};
                        }
                        // init headers override original request headers
                        // so, if they exist use only them, otherwise use request's because they should have been applied in the first place
                        // not using original request headers will result in them being lost
                        init.headers = new Headers(init.headers || (input instanceof Request ? (input.headers || {}) : {}));
                        if (_isUsingAIHeaders) {
                            const id = "|" + ajaxData.traceID + "." + ajaxData.spanID;
                            init.headers.set(RequestHeaders.requestIdHeader, id);
                            if (_enableRequestHeaderTracking) {
                                ajaxData.requestHeaders[RequestHeaders.requestIdHeader] = id;
                            }
                        }
                        const appId: string = _config.appId ||(_context && _context.appId());
                        if (appId) {
                            init.headers.set(RequestHeaders.requestContextHeader, RequestHeaders.requestContextAppIdFormat + appId);
                            if (_enableRequestHeaderTracking) {
                                ajaxData.requestHeaders[RequestHeaders.requestContextHeader] = RequestHeaders.requestContextAppIdFormat + appId;
                            }
                        }
                        if (_isUsingW3CHeaders) {
                            const traceparent = new Traceparent(ajaxData.traceID, ajaxData.spanID);
                            init.headers.set(RequestHeaders.traceParentHeader, traceparent.toString());
                            if (_enableRequestHeaderTracking) {
                                ajaxData.requestHeaders[RequestHeaders.traceParentHeader] = traceparent.toString();
                            }
                        }
                    }

                    return init;
                } else if (xhr) { // XHR
                    if (CorrelationIdHelper.canIncludeCorrelationHeader(_config, ajaxData.getAbsoluteUrl(), currentWindowHost)) {
                        if (_isUsingAIHeaders) {
                            const id = "|" + ajaxData.traceID + "." + ajaxData.spanID;
                            xhr.setRequestHeader(RequestHeaders.requestIdHeader, id);
                            if (_enableRequestHeaderTracking) {
                                ajaxData.requestHeaders[RequestHeaders.requestIdHeader] = id;
                            }
                        }
                        const appId = _config.appId || (_context && _context.appId());
                        if (appId) {
                            xhr.setRequestHeader(RequestHeaders.requestContextHeader, RequestHeaders.requestContextAppIdFormat + appId);
                            if (_enableRequestHeaderTracking) {
                                ajaxData.requestHeaders[RequestHeaders.requestContextHeader] = RequestHeaders.requestContextAppIdFormat + appId;
                            }
                        }
                        if (_isUsingW3CHeaders) {
                            const traceparent = new Traceparent(ajaxData.traceID, ajaxData.spanID);
                            xhr.setRequestHeader(RequestHeaders.traceParentHeader, traceparent.toString());
                            if (_enableRequestHeaderTracking) {
                                ajaxData.requestHeaders[RequestHeaders.traceParentHeader] = traceparent.toString();
                            }
                        }
                    }

                    return xhr;
                }

                return undefined;
            }

            _self[strTrackDependencyDataInternal] = (dependency: IDependencyTelemetry, properties?: { [key: string]: any }, systemProperties?: { [key: string]: any }) => {
                if (_maxAjaxCallsPerView === -1 || _trackAjaxAttempts < _maxAjaxCallsPerView) {
                    // Hack since expected format in w3c mode is |abc.def.
                    // Non-w3c format is |abc.def
                    // @todo Remove if better solution is available, e.g. handle in portal
                    if ((_config.distributedTracingMode === DistributedTracingModes.W3C
                        || _config.distributedTracingMode === DistributedTracingModes.AI_AND_W3C)
                        && typeof dependency.id === "string" && dependency.id[dependency.id.length - 1] !== "."
                    ) {
                        dependency.id += ".";
                    }
                    if (isNullOrUndefined(dependency.startTime)) {
                        dependency.startTime = new Date();
                    }
                    const item = TelemetryItemCreator.create<IDependencyTelemetry>(
                        dependency,
                        RemoteDependencyData.dataType,
                        RemoteDependencyData.envelopeType,
                        _self[strDiagLog](),
                        properties,
                        systemProperties);

                    _self.core.track(item);
                } else if (_trackAjaxAttempts === _maxAjaxCallsPerView) {
                    _throwInternalCritical(_self,
                        _InternalMessageId.MaxAjaxPerPVExceeded,
                        "Maximum ajax per page view limit reached, ajax monitoring is paused until the next trackPageView(). In order to increase the limit set the maxAjaxCallsPerView configuration parameter.",
                        true);
                }

                ++_trackAjaxAttempts;
            }

            // Fetch Stuff
            function _instrumentFetch(): void {
                let fetch = _supportsFetch();
                if (!fetch) {
                    return;
                }

                let global = getGlobal();
                let isPolyfill = (fetch as any).polyfill;
                if (_config.disableFetchTracking === false) {
                    _hooks.push(InstrumentFunc(global, strFetch, {
                        // Add request hook
                        req: (callDetails: IInstrumentCallDetails, input, init) => {
                            let fetchData: ajaxRecord;
                            if (_fetchInitialized &&
                                    !_isDisabledRequest(null, input, init) &&
                                    // If we have a polyfil and XHR instrumented then let XHR report otherwise we get duplicates
                                    !(isPolyfill && _xhrInitialized)) {
                                let ctx = callDetails.ctx();
                                fetchData = _createFetchRecord(input, init);
                                let newInit = _self.includeCorrelationHeaders(fetchData, input, init);
                                if (newInit !== init) {
                                    callDetails.set(1, newInit);
                                }
                                ctx.data = fetchData;
                            }
                        },
                        rsp: (callDetails: IInstrumentCallDetails, input) => {
                            let fetchData = callDetails.ctx().data;
                            if (fetchData) {
                                // Replace the result with the new promise from this code
                                callDetails.rslt = callDetails.rslt.then((response: any) => {
                                    _reportFetchMetrics(callDetails, (response||{}).status, response, fetchData, () => {
                                        let ajaxResponse:IAjaxRecordResponse = {
                                            statusText: response.statusText,
                                            headerMap: null,
                                            correlationContext: _getFetchCorrelationContext(response)
                                        };

                                        if (_enableResponseHeaderTracking) {
                                            const responseHeaderMap = {};
                                            response.headers.forEach((value: string, name: string) => {
                                                responseHeaderMap[name] = value;
                                            });

                                            ajaxResponse.headerMap = responseHeaderMap;
                                        }

                                        return ajaxResponse;
                                    });

                                    return response;
                                })
                                .catch((reason: any) => {
                                    _reportFetchMetrics(callDetails, 0, input, fetchData, null, { error: reason.message });
                                    throw reason;
                                });
                            }
                        },
                        // Create an error callback to report any hook errors
                        hkErr: _createErrorCallbackFunc(_self, _InternalMessageId.FailedMonitorAjaxOpen,
                            "Failed to monitor Window.fetch, monitoring data for this fetch call may be incorrect.")
                    }));

                    _fetchInitialized = true;
                } else if (isPolyfill) {
                    // If fetch is a polyfill we need to capture the request to ensure that we correctly track
                    // disabled request URLS (i.e. internal urls) to ensure we don't end up in a constant loop
                    // of reporting ourselves, for example React Native uses a polyfill for fetch
                    // Note: Polyfill implementations that don't support the "poyyfill" tag are not supported
                    // the workaround is to add a polyfill property to your fetch implementation before initializing
                    // App Insights
                    _hooks.push(InstrumentFunc(global, strFetch, {
                        req: (callDetails: IInstrumentCallDetails, input, init) => {
                            // Just call so that we record any disabled URL
                            _isDisabledRequest(null, input, init);
                        }
                    }));
                }

                if (isPolyfill) {
                    // retag the instrumented fetch with the same polyfill settings this is mostly for testing
                    // But also supports multiple App Insights usages
                    (global[strFetch] as any).polyfill = isPolyfill;
                }
            }

            function _hookProto(target: any, funcName: string, callbacks: IInstrumentHooksCallbacks) {
                _hooks.push(InstrumentProto(target, funcName, callbacks));
            }

            function _instrumentXhr():void {
                if (_supportsAjaxMonitoring(_self) && !_xhrInitialized) {
                    // Instrument open
                    _hookProto(XMLHttpRequest, "open", {
                        req: (args:IInstrumentCallDetails, method:string, url:string, async?:boolean) => {
                            let xhr = args.inst as XMLHttpRequestInstrumented;
                            let ajaxData = xhr[strAjaxData];
                            if (!_isDisabledRequest(xhr, url) && _isMonitoredXhrInstance(xhr, true) &&
                                    (!ajaxData || !ajaxData.xhrMonitoringState.openDone)) {
                                _openHandler(xhr, method, url, async);
                            }
                        },
                        hkErr: _createErrorCallbackFunc(_self, _InternalMessageId.FailedMonitorAjaxOpen,
                            "Failed to monitor XMLHttpRequest.open, monitoring data for this ajax call may be incorrect.")
                    });

                    // Instrument send
                    _hookProto(XMLHttpRequest, "send", {
                        req: (args:IInstrumentCallDetails, context?: Document | BodyInit | null) => {
                            let xhr = args.inst as XMLHttpRequestInstrumented;
                            let ajaxData = xhr[strAjaxData];
                            if (_isMonitoredXhrInstance(xhr) && !ajaxData.xhrMonitoringState.sendDone) {
                                _createMarkId("xhr", ajaxData);
                                ajaxData.requestSentTime = dateTimeUtilsNow();
                                xhr = _self.includeCorrelationHeaders(ajaxData, undefined, undefined, xhr);
                                ajaxData.xhrMonitoringState.sendDone = true;
                            }
                        },
                        hkErr: _createErrorCallbackFunc(_self, _InternalMessageId.FailedMonitorAjaxSend,
                            "Failed to monitor XMLHttpRequest, monitoring data for this ajax call may be incorrect.")
                    });

                    // Instrument abort
                    _hookProto(XMLHttpRequest, "abort", {
                        req: (args:IInstrumentCallDetails) => {
                            let xhr = args.inst as XMLHttpRequestInstrumented;
                            let ajaxData = xhr[strAjaxData];
                            if (_isMonitoredXhrInstance(xhr) && !ajaxData.xhrMonitoringState.abortDone) {
                                ajaxData.aborted = 1;
                                ajaxData.xhrMonitoringState.abortDone = true;
                            }
                        },
                        hkErr: _createErrorCallbackFunc(_self, _InternalMessageId.FailedMonitorAjaxAbort,
                            "Failed to monitor XMLHttpRequest.abort, monitoring data for this ajax call may be incorrect.")
                    });

                    // Instrument setRequestHeader
                    if (_enableRequestHeaderTracking) {
                        _hookProto(XMLHttpRequest, "setRequestHeader", {
                            req: (args: IInstrumentCallDetails, header: string, value: string) => {
                                let xhr = args.inst as XMLHttpRequestInstrumented;
                                if (_isMonitoredXhrInstance(xhr)) {
                                    xhr[strAjaxData].requestHeaders[header] = value;
                                }
                            },
                            hkErr: _createErrorCallbackFunc(_self, _InternalMessageId.FailedMonitorAjaxSetRequestHeader,
                                "Failed to monitor XMLHttpRequest.setRequestHeader, monitoring data for this ajax call may be incorrect.")
                        });
                    }

                    _xhrInitialized = true;
                }
            }

            function _isDisabledRequest(xhr?: XMLHttpRequestInstrumented, request?: Request | string, init?: RequestInit) {
                let isDisabled = false;
                let theUrl:string = ((!isString(request) ? ((request ||{}) as Request).url || "" : request as string) ||"").toLowerCase();
                let idx = _indexOf(theUrl, "?");
                let idx2 = _indexOf(theUrl, "#");
                if (idx === -1 || (idx2 !== -1 && idx2 < idx)) {
                    idx = idx2;
                }
                if (idx !== -1) {
                    // Strip off any Query string
                    theUrl = theUrl.substring(0, idx);
                }

                // check that this instance is not not used by ajax call performed inside client side monitoring to send data to collector
                if (!isNullOrUndefined(xhr)) {
                    // Look on the XMLHttpRequest of the URL string value
                    isDisabled = xhr[DisabledPropertyName] === true || theUrl[DisabledPropertyName] === true;
                } else if (!isNullOrUndefined(request)) { // fetch
                    // Look for DisabledPropertyName in either Request or RequestInit
                    isDisabled = (typeof request === 'object' ? request[DisabledPropertyName] === true : false) ||
                            (init ? init[DisabledPropertyName] === true : false);
                }

                if (isDisabled) {
                    // Add the disabled url if not present
                    if (!_disabledUrls[theUrl]) {
                        _disabledUrls[theUrl] = 1;
                    }
                } else {
                    // Check to see if the url is listed as disabled
                    if (_disabledUrls[theUrl]) {
                        isDisabled = true;
                    }
                }

                return isDisabled;
            }

            /// <summary>Verifies that particalar instance of XMLHttpRequest needs to be monitored</summary>
            /// <param name="excludeAjaxDataValidation">Optional parameter. True if ajaxData must be excluded from verification</param>
            /// <returns type="bool">True if instance needs to be monitored, otherwise false</returns>
            function _isMonitoredXhrInstance(xhr: XMLHttpRequestInstrumented, excludeAjaxDataValidation?: boolean): boolean {
                let ajaxValidation = true;
                let initialized = _xhrInitialized;
                if (!isNullOrUndefined(xhr)) {
                    ajaxValidation = excludeAjaxDataValidation === true || !isNullOrUndefined(xhr[strAjaxData]);
                }

                // checking to see that all interested functions on xhr were instrumented
                return initialized
                    // checking on ajaxData to see that it was not removed in user code
                    && ajaxValidation;
            }

            function _openHandler(xhr: XMLHttpRequestInstrumented, method: string, url: string, async: boolean) {
                const traceID = (_context && _context.telemetryTrace && _context.telemetryTrace.traceID) || generateW3CId();
                const spanID = generateW3CId().substr(0, 16);

                const ajaxData = new ajaxRecord(traceID, spanID, _self[strDiagLog]());
                ajaxData.method = method;
                ajaxData.requestUrl = url;
                ajaxData.xhrMonitoringState.openDone = true;
                ajaxData.requestHeaders = {};
                ajaxData.async = async;
                xhr[strAjaxData] = ajaxData;

                _attachToOnReadyStateChange(xhr);
            }

            function _attachToOnReadyStateChange(xhr: XMLHttpRequestInstrumented) {
                xhr[strAjaxData].xhrMonitoringState.stateChangeAttached = EventHelper.Attach(xhr, "readystatechange", () => {
                    try {
                        if (xhr && xhr.readyState === 4 && _isMonitoredXhrInstance(xhr)) {
                            _onAjaxComplete(xhr);
                        }
                    } catch (e) {
                        const exceptionText = dumpObj(e);

                        // ignore messages with c00c023f, as this a known IE9 XHR abort issue
                        if (!exceptionText || _indexOf(exceptionText.toLowerCase(), "c00c023f") === -1) {
                            _throwInternalCritical(_self,
                                _InternalMessageId.FailedMonitorAjaxRSC,
                                "Failed to monitor XMLHttpRequest 'readystatechange' event handler, monitoring data for this ajax call may be incorrect.",
                                {
                                    ajaxDiagnosticsMessage: _getFailedAjaxDiagnosticsMessage(xhr),
                                    exception: exceptionText
                                });
                        }
                    }
                });
            }

            function _getResponseText(xhr: XMLHttpRequestInstrumented) {
                try {
                    const responseType = xhr.responseType;
                    if (responseType === "" || responseType === "text") {
                        // As per the specification responseText is only valid if the type is an empty string or "text"
                        return xhr.responseText;
                    }
                } catch (e) {
                    // This shouldn't happend because of the above check -- but just in case, so just ignore
                }

                return null;
            }

            function _onAjaxComplete(xhr: XMLHttpRequestInstrumented) {
                let ajaxData = xhr[strAjaxData];
                ajaxData.responseFinishedTime = dateTimeUtilsNow();
                ajaxData.status = xhr.status;

                function _reportXhrError(e: any, failedProps?:Object) {
                    let errorProps = failedProps||{};
                    errorProps["ajaxDiagnosticsMessage"] = _getFailedAjaxDiagnosticsMessage(xhr);
                    if (e) {
                        errorProps["exception"]  = dumpObj(e);
                    }

                    _throwInternalWarning(_self,
                        _InternalMessageId.FailedMonitorAjaxDur,
                        "Failed to calculate the duration of the ajax call, monitoring data for this ajax call won't be sent.",
                        errorProps
                    );
                }

                _findPerfResourceEntry("xmlhttprequest", ajaxData, () => {
                    try {
                        const dependency = ajaxData.CreateTrackItem("Ajax", _enableRequestHeaderTracking, () => {
                            let ajaxResponse:IAjaxRecordResponse = {
                                statusText: xhr.statusText,
                                headerMap: null,
                                correlationContext: _getAjaxCorrelationContext(xhr),
                                type: xhr.responseType,
                                responseText: _getResponseText(xhr),
                                response: xhr.response
                            };

                            if (_enableResponseHeaderTracking) {
                                const headers = xhr.getAllResponseHeaders();
                                if (headers) {
                                    // xhr.getAllResponseHeaders() method returns all the response headers, separated by CRLF, as a string or null
                                    // the regex converts the header string into an array of individual headers
                                    const arr = strTrim(headers).split(/[\r\n]+/);
                                    const responseHeaderMap = {};
                                    arrForEach(arr, (line) => {
                                        const parts = line.split(': ');
                                        const header = parts.shift();
                                        const value = parts.join(': ');
                                        responseHeaderMap[header] = value;
                                    });

                                    ajaxResponse.headerMap = responseHeaderMap;
                                }
                            }

                            return ajaxResponse;
                        });

                        if (dependency) {
                            _self[strTrackDependencyDataInternal](dependency);
                        } else {
                            _reportXhrError(null, {
                                    requestSentTime: ajaxData.requestSentTime,
                                    responseFinishedTime: ajaxData.responseFinishedTime
                                });
                        }
                    } finally {
                        // cleanup telemetry data
                        try {
                            xhr[strAjaxData] = null;
                        } catch (e) {
                            // May throw in environments that prevent extension or freeze xhr
                        }
                    }
                }, (e) => {
                    _reportXhrError(e, null);
                });
            }

            function _getAjaxCorrelationContext(xhr: XMLHttpRequestInstrumented) {
                try {
                    const responseHeadersString = xhr.getAllResponseHeaders();
                    if (responseHeadersString !== null) {
                        const index = _indexOf(responseHeadersString.toLowerCase(), RequestHeaders.requestContextHeaderLowerCase);
                        if (index !== -1) {
                            const responseHeader = xhr.getResponseHeader(RequestHeaders.requestContextHeader);
                            return CorrelationIdHelper.getCorrelationContext(responseHeader);
                        }
                    }
                } catch (e) {
                    _throwInternalWarning(_self,
                        _InternalMessageId.FailedMonitorAjaxGetCorrelationHeader,
                        "Failed to get Request-Context correlation header as it may be not included in the response or not accessible.",
                        {
                            ajaxDiagnosticsMessage: _getFailedAjaxDiagnosticsMessage(xhr),
                            exception: dumpObj(e)
                        });
                }
            }

            function _createMarkId(type:string, ajaxData:ajaxRecord) {
                if (ajaxData.requestUrl && _markPrefix && _enableAjaxPerfTracking) {
                    let performance = getPerformance();
                    if (performance && isFunction(performance.mark)) {
                        _markCount++;
                        let markId = _markPrefix + type + "#" + _markCount;
                        performance.mark(markId);
                        let entries = performance.getEntriesByName(markId);
                        if (entries && entries.length === 1) {
                            ajaxData.perfMark = entries[0];
                        }
                    }
                }
            }

            function _findPerfResourceEntry(initiatorType:string, ajaxData:ajaxRecord, trackCallback:() => void, reportError:(e:any) => void): void {
                let perfMark = ajaxData.perfMark;
                let performance = getPerformance();

                let maxAttempts = _config.maxAjaxPerfLookupAttempts;
                let retryDelay = _config.ajaxPerfLookupDelay;
                let requestUrl = ajaxData.requestUrl;
                let attempt = 0;
                (function locateResourceTiming() {
                    try {
                        if (performance && perfMark) {
                            attempt++;
                            let perfTiming:PerformanceResourceTiming = null;
                            let entries = performance.getEntries();
                            for (let lp = entries.length - 1; lp >= 0; lp--) {
                                let entry:PerformanceEntry = entries[lp];
                                if (entry) {
                                    if (entry.entryType === "resource") {
                                        if ((entry as PerformanceResourceTiming).initiatorType === initiatorType &&
                                                (_indexOf(entry.name, requestUrl) !== -1 || _indexOf(requestUrl, entry.name) !== -1)) {

                                            perfTiming = entry as PerformanceResourceTiming;
                                        }
                                    } else if (entry.entryType === "mark" && entry.name === perfMark.name) {
                                        // We hit the start event
                                        ajaxData.perfTiming = perfTiming;
                                        break;
                                    }

                                    if (entry.startTime < perfMark.startTime - 1000) {
                                        // Fallback to try and reduce the time spent looking for the perf entry
                                        break;
                                    }
                                }
                            }
                        }

                        if (!perfMark ||                // - we don't have a perfMark or
                            ajaxData.perfTiming ||      // - we have not found the perf entry or
                            attempt >= maxAttempts ||   // - we have tried too many attempts or
                            ajaxData.async === false) { // - this is a sync request

                            if (perfMark && isFunction(performance.clearMarks)) {
                                // Remove the mark so we don't fill up the performance resources too much
                                performance.clearMarks(perfMark.name);
                            }

                            ajaxData.perfAttempts = attempt;

                            // just continue and report the track event
                            trackCallback();
                        } else {
                            // We need to wait for the browser to populate the window.performance entry
                            // This needs to be at least 1ms as waiting <= 1 (on firefox) is not enough time for fetch or xhr,
                            // this is a scheduling issue for the browser implementation
                            setTimeout(locateResourceTiming, retryDelay);
                        }
                    } catch (e) {
                        reportError(e);
                    }
                })();
            }

            function _createFetchRecord(input?: Request | string, init?: RequestInit): ajaxRecord {
                const traceID = (_context && _context.telemetryTrace && _context.telemetryTrace.traceID) || generateW3CId();
                const spanID = generateW3CId().substr(0, 16);

                const ajaxData = new ajaxRecord(traceID, spanID, _self[strDiagLog]());
                ajaxData.requestSentTime = dateTimeUtilsNow();

                if (input instanceof Request) {
                    ajaxData.requestUrl = input ? input.url : "";
                } else {
                    ajaxData.requestUrl = input;
                }

                let method = "GET";
                if (init && init.method) {
                    method = init.method;
                } else if (input && input instanceof Request) {
                    method = input.method;
                }
                ajaxData.method = method;

                let requestHeaders = {};
                if (_enableRequestHeaderTracking) {
                    let headers = new Headers((init ? init.headers : 0) || (input instanceof Request ? (input.headers || {}) : {}));
                    headers.forEach((value, key) => {
                        requestHeaders[key] = value;
                    });
                }

                ajaxData.requestHeaders = requestHeaders;

                _createMarkId("fetch", ajaxData);

                return ajaxData;
            }

            function _getFailedFetchDiagnosticsMessage(input: Request | Response | string): string {
                let result: string = "";
                try {
                    if (!isNullOrUndefined(input)) {
                        if (typeof (input) === "string") {
                            result += `(url: '${input}')`;
                        } else {
                            result += `(url: '${input.url}')`;
                        }
                    }
                } catch (e) {
                    _throwInternalCritical(_self,
                        _InternalMessageId.FailedMonitorAjaxOpen,
                        "Failed to grab failed fetch diagnostics message",
                        { exception: dumpObj(e) }
                    );
                }
                return result;
            }

            function _reportFetchMetrics(callDetails: IInstrumentCallDetails, status: number, input: Request | Response | string, ajaxData: ajaxRecord, getResponse:() => IAjaxRecordResponse, properties?: { [key: string]: any }): void {
                if (!ajaxData) {
                    return;
                }

                function _reportFetchError(msgId: _InternalMessageId, e: any, failedProps?:Object) {
                    let errorProps = failedProps||{};
                    errorProps["fetchDiagnosticsMessage"] = _getFailedFetchDiagnosticsMessage(input);
                    if (e) {
                        errorProps["exception"]  = dumpObj(e);
                    }

                    _throwInternalWarning(_self,
                        msgId,
                        "Failed to calculate the duration of the fetch call, monitoring data for this fetch call won't be sent.",
                        errorProps
                    );
                }
                ajaxData.responseFinishedTime = dateTimeUtilsNow();
                ajaxData.status = status;

                _findPerfResourceEntry("fetch", ajaxData, () => {
                    const dependency = ajaxData.CreateTrackItem("Fetch", _enableRequestHeaderTracking, getResponse);
                    if (dependency) {
                        _self[strTrackDependencyDataInternal](dependency);
                    } else {
                        _reportFetchError(_InternalMessageId.FailedMonitorAjaxDur, null,
                            {
                                requestSentTime: ajaxData.requestSentTime,
                                responseFinishedTime: ajaxData.responseFinishedTime
                            });
                    }
                }, (e) => {
                    _reportFetchError(_InternalMessageId.FailedMonitorAjaxGetCorrelationHeader, e, null);
                });
            }

            function _getFetchCorrelationContext(response: Response): string {
                if (response && response.headers) {
                    try {
                        const responseHeader: string = response.headers.get(RequestHeaders.requestContextHeader);
                        return CorrelationIdHelper.getCorrelationContext(responseHeader);
                    } catch (e) {
                        _throwInternalWarning(_self,
                            _InternalMessageId.FailedMonitorAjaxGetCorrelationHeader,
                            "Failed to get Request-Context correlation header as it may be not included in the response or not accessible.",
                            {
                                fetchDiagnosticsMessage: _getFailedFetchDiagnosticsMessage(response),
                                exception: dumpObj(e)
                            });
                    }
                }
            }
        });
    }

    public initialize(config: IConfiguration & IConfig, core: IAppInsightsCore, extensions: IPlugin[], pluginChain?:ITelemetryPluginChain) {
        // @DynamicProtoStub -- DO NOT add any code as this will be removed during packaging
    }

    public teardown():void {
        // @DynamicProtoStub -- DO NOT add any code as this will be removed during packaging
    }

    public processTelemetry(item: ITelemetryItem, itemCtx?: IProcessTelemetryContext) {
        this.processNext(item, itemCtx);
    }

    /**
     * Logs dependency call
     * @param dependencyData dependency data object
     */
    public trackDependencyData(dependency: IDependencyTelemetry, properties?: { [key: string]: any }) {
        // @DynamicProtoStub -- DO NOT add any code as this will be removed during packaging
    }

    public includeCorrelationHeaders(ajaxData: ajaxRecord, input?: Request | string, init?: RequestInit, xhr?: XMLHttpRequestInstrumented): any {
        // @DynamicProtoStub -- DO NOT add any code as this will be removed during packaging
    }

    /**
     * Protected function to allow sub classes the chance to add additional properties to the delendency event
     * before it's sent. This function calls track, so sub-classes must call this function after they have
     * populated their properties.
     * @param dependencyData dependency data object
     */
    protected trackDependencyDataInternal(dependency: IDependencyTelemetry, properties?: { [key: string]: any }, systemProperties?: { [key: string]: any }) {
        // @DynamicProtoStub -- DO NOT add any code as this will be removed during packaging
    }
}
