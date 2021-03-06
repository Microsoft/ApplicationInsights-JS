# Application Insights JavaScript SDK

<properties
    pageTitle="Application Insights SDK JavaScript API"
    description="Reference doc"
    services="application-insights"
    documentationCenter=".net"
/>

<tags
    ms.service="application-insights"
    ms.workload="tbd"
    ms.tgt_pltfrm="ibiza"
    ms.devlang="na"
    ms.topic="article"
    ms.date="08/24/2015"/>

[![Build Status](https://dev.azure.com/mseng/AppInsights/_apis/build/status/AppInsights%20-%20DevTools/1DS%20JavaScript%20SDK%20web%20SKU%20vNext?branchName=master)](https://dev.azure.com/mseng/AppInsights/_build/latest?definitionId=8184&branchName=master)
[![Build Status](https://travis-ci.org/microsoft/ApplicationInsights-JS.svg?branch=master)](https://travis-ci.org/microsoft/ApplicationInsights-JS)
[![npm version](https://badge.fury.io/js/%40microsoft%2Fapplicationinsights-web.svg)](https://badge.fury.io/js/%40microsoft%2Fapplicationinsights-web)
[![minified size size](https://img.badgesize.io/https://js.monitor.azure.com/scripts/b/ai.2.min.js.svg?label=minified%20size)](https://img.badgesize.io/https://js.monitor.azure.com/scripts/b/ai.2.min.js.svg?label=minified%20size)
[![gzip size](https://img.badgesize.io/https://js.monitor.azure.com/scripts/b/ai.2.min.js.svg?compression=gzip&softmax=30000&max=35000)](https://img.badgesize.io/https://js.monitor.azure.com/scripts/b/ai.2.min.js.svg?compression=gzip&softmax=30000&max=35000)

> ***Note:*** The documentation for `applicationinsights-js@1.0.20` has moved [here](./legacy/README.md). If you are looking to upgrade to the new version of the SDK, please see the [Upgrade Guide](#upgrading-from-the-old-version-of-application-insights).

## Getting Started

1. Create an Application Insights resource in Azure by following [these instructions](https://docs.microsoft.com/en-us/azure/application-insights/app-insights-javascript?toc=/azure/azure-monitor/toc.json).
2. Grab the _Instrumentation Key_ (aka "ikey") from the resource you created in
   step 1. Later, you'll add it to the `instrumentationKey` setting of the Application Insights JavaScript SDK.
3. Add Application Insights to your app. **There are 2 ways to do this.**
    - Install via NPM. Then, [set up an instance of Application Insights in your app.](#npm-setup-ignore-if-using-snippet-setup)
        > *Note:* **Typings are included with this package**, so you do **not** need to install a separate typings package.

        ```sh
        npm i --save @microsoft/applicationinsights-web
        ```

    - [Pasting a script snippet at the beginning of every `<head>` tag for each page you want to monitor.](#snippet-setup-ignore-if-using-npm-setup)

## Basic Usage

### NPM Setup (ignore if using Snippet Setup)

```js
import { ApplicationInsights } from '@microsoft/applicationinsights-web'

const appInsights = new ApplicationInsights({ config: {
  instrumentationKey: 'YOUR_INSTRUMENTATION_KEY_GOES_HERE'
  /* ...Other Configuration Options... */
} });
appInsights.loadAppInsights();
appInsights.trackPageView(); // Manually call trackPageView to establish the current user/session/pageview
```

### Snippet Setup (Ignore if using NPM Setup)

If your app does not use NPM, you can directly instrument your webpages with Application Insights by pasting this snippet at the top of each your pages. Preferably, it should be the first script in your `<head>` section so that it can monitor any potential issues with all of your dependencies.

```html
<script type="text/javascript">
!function(T,l,y){var S=T.location,k="script",D="instrumentationKey",C="ingestionendpoint",I="disableExceptionTracking",E="ai.device.",b="toLowerCase",w="crossOrigin",N="POST",e="appInsightsSDK",t=y.name||"appInsights";(y.name||T[e])&&(T[e]=t);var n=T[t]||function(d){var g=!1,f=!1,m={initialize:!0,queue:[],sv:"5",version:2,config:d};function v(e,t){var n={},a="Browser";return n[E+"id"]=a[b](),n[E+"type"]=a,n["ai.operation.name"]=S&&S.pathname||"_unknown_",n["ai.internal.sdkVersion"]="javascript:snippet_"+(m.sv||m.version),{time:function(){var e=new Date;function t(e){var t=""+e;return 1===t.length&&(t="0"+t),t}return e.getUTCFullYear()+"-"+t(1+e.getUTCMonth())+"-"+t(e.getUTCDate())+"T"+t(e.getUTCHours())+":"+t(e.getUTCMinutes())+":"+t(e.getUTCSeconds())+"."+((e.getUTCMilliseconds()/1e3).toFixed(3)+"").slice(2,5)+"Z"}(),iKey:e,name:"Microsoft.ApplicationInsights."+e.replace(/-/g,"")+"."+t,sampleRate:100,tags:n,data:{baseData:{ver:2}}}}var h=d.url||y.src;if(h){function a(e){var t,n,a,i,r,o,s,c,u,p,l;g=!0,m.queue=[],f||(f=!0,t=h,s=function(){var e={},t=d.connectionString;if(t)for(var n=t.split(";"),a=0;a<n.length;a++){var i=n[a].split("=");2===i.length&&(e[i[0][b]()]=i[1])}if(!e[C]){var r=e.endpointsuffix,o=r?e.location:null;e[C]="https://"+(o?o+".":"")+"dc."+(r||"services.visualstudio.com")}return e}(),c=s[D]||d[D]||"",u=s[C],p=u?u+"/v2/track":d.endpointUrl,(l=[]).push((n="SDK LOAD Failure: Failed to load Application Insights SDK script (See stack for details)",a=t,i=p,(o=(r=v(c,"Exception")).data).baseType="ExceptionData",o.baseData.exceptions=[{typeName:"SDKLoadFailed",message:n.replace(/\./g,"-"),hasFullStack:!1,stack:n+"\nSnippet failed to load ["+a+"] -- Telemetry is disabled\nHelp Link: https://go.microsoft.com/fwlink/?linkid=2128109\nHost: "+(S&&S.pathname||"_unknown_")+"\nEndpoint: "+i,parsedStack:[]}],r)),l.push(function(e,t,n,a){var i=v(c,"Message"),r=i.data;r.baseType="MessageData";var o=r.baseData;return o.message='AI (Internal): 99 message:"'+("SDK LOAD Failure: Failed to load Application Insights SDK script (See stack for details) ("+n+")").replace(/\"/g,"")+'"',o.properties={endpoint:a},i}(0,0,t,p)),function(e,t){if(JSON){var n=T.fetch;if(n&&!y.useXhr)n(t,{method:N,body:JSON.stringify(e),mode:"cors"});else if(XMLHttpRequest){var a=new XMLHttpRequest;a.open(N,t),a.setRequestHeader("Content-type","application/json"),a.send(JSON.stringify(e))}}}(l,p))}function i(e,t){f||setTimeout(function(){!t&&m.core||a()},500)}var e=function(){var n=l.createElement(k);n.src=h;var e=y[w];return!e&&""!==e||"undefined"==n[w]||(n[w]=e),n.onload=i,n.onerror=a,n.onreadystatechange=function(e,t){"loaded"!==n.readyState&&"complete"!==n.readyState||i(0,t)},n}();y.ld<0?l.getElementsByTagName("head")[0].appendChild(e):setTimeout(function(){l.getElementsByTagName(k)[0].parentNode.appendChild(e)},y.ld||0)}try{m.cookie=l.cookie}catch(p){}function t(e){for(;e.length;)!function(t){m[t]=function(){var e=arguments;g||m.queue.push(function(){m[t].apply(m,e)})}}(e.pop())}var n="track",r="TrackPage",o="TrackEvent";t([n+"Event",n+"PageView",n+"Exception",n+"Trace",n+"DependencyData",n+"Metric",n+"PageViewPerformance","start"+r,"stop"+r,"start"+o,"stop"+o,"addTelemetryInitializer","setAuthenticatedUserContext","clearAuthenticatedUserContext","flush"]),m.SeverityLevel={Verbose:0,Information:1,Warning:2,Error:3,Critical:4};var s=(d.extensionConfig||{}).ApplicationInsightsAnalytics||{};if(!0!==d[I]&&!0!==s[I]){var c="onerror";t(["_"+c]);var u=T[c];T[c]=function(e,t,n,a,i){var r=u&&u(e,t,n,a,i);return!0!==r&&m["_"+c]({message:e,url:t,lineNumber:n,columnNumber:a,error:i}),r},d.autoExceptionInstrumented=!0}return m}(y.cfg);function a(){y.onInit&&y.onInit(n)}(T[t]=n).queue&&0===n.queue.length?(n.queue.push(a),n.trackPageView({})):a()}(window,document,{
src: "https://js.monitor.azure.com/scripts/b/ai.2.min.js", // The SDK URL Source
// name: "appInsights", // Global SDK Instance name defaults to "appInsights" when not supplied
// ld: 0, // Defines the load delay (in ms) before attempting to load the sdk. -1 = block page load and add to head. (default) = 0ms load after timeout,
// useXhr: 1, // Use XHR instead of fetch to report failures (if available),
crossOrigin: "anonymous", // When supplied this will add the provided value as the cross origin attribute on the script tag
// onInit: null, // Once the application insights instance has loaded and initialized this callback function will be called with 1 argument -- the sdk instance (DO NOT ADD anything to the sdk.queue -- As they won't get called)
cfg: { // Application Insights Configuration
    instrumentationKey: "INSTRUMENTATION_KEY"
}});
</script>
```

> :bulb: **Note**
>
> For readability and to reduce possible JavaScript errors, all of the possible configuration options are listed on a new line in snippet code above, if you don't want to change the value of a commented line it can be removed.

#### Reporting Script load exceptions

This version of the snippet detects and reports an exception when loading the SDK from the CDN fails, this exception is reported to the Azure Monitor portal (under the failures &gt; exceptions &gt; browser), and provides visibility into failures of this type so that you are aware your application is not reporting telemetry (or other exceptions) as expected. This signal is an important measurement in understanding that you have lost telemetry because the SDK did not load or initialize, this provides clarity that you are missing the following telemetry:
- Under-reporting of how users are using (or trying to use) your site;
- Missing telemetry on how your end users are using your site;
- Missing JavaScript errors that could potentially be blocking your end users from successfully using your site.

For details on this exception see [SDK Load Failure](docs/SdkLoadFailure.md) page.

Reporting of this failure as an exception to the portal does not use the configuration option ```disableExceptionTracking``` from the application insights configuration and therefore if this failure occurs it will always be reported by the snippet, even when the window.onerror support is disabled.

Reporting of SDK load exceptions is specifically NOT supported on IE 8 (or less). This assists with reducing the minified size of the snippet by assuming that most environments are not exclusively IE 8 or less. If you have this requirement and you wish to receive these exceptions, you will need to either include a fetch poly fill or create you own snippet version that uses ```XDomainRequest``` instead of ```XMLHttpRequest```, it is recommended that you use the [provided snippet source code](https://github.com/microsoft/ApplicationInsights-JS/blob/master/AISKU/snippet/snippet.js) as a starting point.

> :bulb: **Note**
>
> If you are using a previous version of the snippet, it is highly recommended that you update to the latest version so that you will receive these previously unreported issues.

#### Snippet configuration options

All configuration options have now been move towards the end of the script to help avoid accidentally introducing JavaScript errors that would not just cause the SDK to fail to load, but also it would disable the reporting of the failure.

Each configuration option is shown above on a new line, if you don't wish to override the default value of an item listed as [optional] you can  remove that line to minimize the resulting size of your returned page.

The available configuration options are: -

| Name | Type | Description
|------|------|----------------
| src | string **[required]** | The full URL for where to load the SDK from. This value is used for the "src" attribute of a dynamically added &lt;script /&gt; tag. You can use the public CDN location or your own privately hosted one.
| name | string *[optional]* | The global name for the initialized SDK, defaults to appInsights. So ```window.appInsights``` will be a reference to the initialized instance. Note: if you provide a name value or a previous instance appears to be assigned (via the global name appInsightsSDK) then this name value will also be defined in the global namespace as ```window.appInsightsSDK=<name value>```, this is required by the SDK initialization code to ensure it's initializing and updating the correct snippet skeleton and proxy methods.
| ld | number in ms *[optional]* | Defines the load delay to wait before attempting to load the SDK. Default value is 0ms and any negative value will immediately add a script tag to the &lt;head&gt; region of the page, which will then block the page load event until to script is loaded (or fails).
| useXhr | boolean *[optional]* | This setting is used only for reporting SDK load failures. Reporting will first attempt to use fetch() if available and then fallback to XHR, setting this value to true just bypasses the fetch check. Use of this value is only be required if your application is being used in an environment where fetch would fail to send the failure events.
| crossOrigin | string *[optional]* | By including this setting, the script tag added to download the SDK will include the crossOrigin attribute with this string value. When not defined (the default) no crossOrigin attribute is added. Recommended values are not defined (the default); ""; or "anonymous" (For all valid values see [HTML attribute: crossorigin](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/crossorigin) documentation)
| onInit | function(aiSdk) { ... } *[optional]* | This callback function which is called after the main SDK script has been successfully loaded and initialized from the CDN (based on the src value), it is passed a reference to the sdk instance that it is being called for and it is also called _before_ the first initial page view. If the SDK has already been loaded and initialized this callback will still be called. NOTE: As this callback is called during the processing of the sdk.queue array you CANNOT add any additional items to the queue as they will be ignored and dropped. (Added as part of snippet version 5 -- the sv:"5" value within the snippet script)
| cfg | object **[required]** | The configuration passed to the Application Insights SDK during initialization.

#### Example using the snippet onInit callback

```html
<script type="text/javascript">
!function(T,l,y){<!-- Removed the Snippet code for brevity -->}(window,document,{
src: "https://js.monitor.azure.com/scripts/b/ai.2.min.js",
crossOrigin: "anonymous",
onInit: function (sdk) {
  sdk.addTelemetryInitializer(function (envelope) {
    envelope.data.someField = 'This item passed through my telemetry initializer';
  });
}, // Once the application insights instance has loaded and initialized this method will be called
cfg: { // Application Insights Configuration
    instrumentationKey: "YOUR_INSTRUMENTATION_KEY"
}});
</script>
```

#### Active CDN endpoints

To help with global resiliency, we have added and updated our primary CDN endpoint (source URL) so that if required we can address any outages without the need for everyone to update the URL used by the Application Insights snippet within their application.

All active CDN endpoints contain all of the previous (and future) versions of the SDK and there is currently no plans to stop or block accessing the snippet from the previous (legacy/backup) URL.

| State | CDN Endpoint | Description
|-------|--------------|--------------------
| Primary | https://js.monitor.azure.com/scripts/b/ai.2.min.js | Provides additional resiliency, allowing us to redirect to a different CDN provider should there be an unexpected issue (if required).
| Legacy/Backup |  https://az416426.vo.msecnd.net/scripts/b/ai.2.min.js | Due to the legacy nature of this URL / Domain, if there is an unexpected issue (outage) with this domain, your application will need to be updated and deployed to use the new URL.

### Connection String Setup

For either the NPM or Snippet setup, you can also configure your instance of Application Insights using a Connection String. Simply replace the `instrumentationKey` field with the `connectionString` field.
```js
import { ApplicationInsights } from '@microsoft/applicationinsights-web'

const appInsights = new ApplicationInsights({ config: {
  connectionString: 'YOUR_CONNECTION_STRING_GOES_HERE'
  /* ...Other Configuration Options... */
} });
appInsights.loadAppInsights();
appInsights.trackPageView();
```

#### (Alternative Setup Method) Include AI JS SDK script and initialize statically

Use this approach if you would like to host AI JS SDK script on your endpoint or bundle it with other scripts. One popular example is Cordova applications (see [this blog post](http://www.teamfoundation.co.za/2016/02/application-insights-and-typescript/). After JS script has loaded, include the following snippet to initialize Application Insights:
```html
<!-- the snippet below assumes that JS SDK script has already loaded -->
<script type="text/javascript" src="/pathToAIJSSDK.js"></script>
<script type="text/javascript">
    var snippet = {
        config: {
            instrumentationKey: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx"
        }
    };
    var init = new Microsoft.ApplicationInsights.ApplicationInsights(snippet);
    var appInsights = init.loadAppInsights();
    appInsights.trackPageView();
</script>
```

### Sending Telemetry to the Azure Portal

If initialized using the snippet, your Application Insights instance is located by default at `window.appInsights`

```js
appInsights.trackEvent({name: 'some event'});
appInsights.trackPageView({name: 'some page'});
appInsights.trackPageViewPerformance({name : 'some page', url: 'some url'});
appInsights.trackException({exception: new Error('some error')});
appInsights.trackTrace({message: 'some trace'});
appInsights.trackMetric({name: 'some metric', average: 42});
appInsights.trackDependencyData({absoluteUrl: 'some url', responseCode: 200, method: 'GET', id: 'some id'});
appInsights.startTrackPage("pageName");
appInsights.stopTrackPage("pageName", null, {customProp1: "some value"});
appInsights.startTrackEvent("event");
appInsights.stopTrackEvent("event", null, {customProp1: "some value"});
appInsights.flush();
```

Custom properties can be included in your telemetry through the `properties` named argument. This can be done with *any* of the Track APIs.

```js
appInsights.trackEvent({
  name: 'some event',
  properties: { // accepts any type
    prop1: 'string',
    prop2: 123.45,
    prop3: { nested: 'objects are okay too' }
  }
});
```

### Setting Up Autocollection

All autocollection is ON by default. The full version of the Application Insights Javascript SDK auto collects:

- **Uncaught exceptions** in your app, including information on
  - Stack trace
  - Exception details and message accompanying the error
  - Line & column number of error
  - URL where error was raised
- **Network Dependency Requests** made by your app **XHR** and **Fetch** (fetch collection is disabled by default) requests, include information on
  - Url of dependency source
  - Command & Method used to request the dependency
  - Duration of the request
  - Result code and success status of the request
  - ID (if any) of user making the request
  - Correlation context (if any) where request is made
- **User information** (e.g. Location, network, IP)
- **Device information** (e.g. Browser, OS, version, language, model)
- **Session information**

### Telemetry Initializers

Telemetry initializers are used to modify the contents of collected telemetry before being sent from the user's browser. They can also be used to prevent certain telemetry from being sent, by returning `false`. Multiple telemetry initializers can be added to your Application Insights instance, and they are executed in order of adding them.

The input argument to `addTelemetryInitializer` is a callback that takes a [`ITelemetryItem`](./API-reference.md#addTelemetryInitializer) as an argument and returns a `boolean` or `void`. If returning `false`, the telemetry item is not sent, else it proceeds to the next telemetry initializer, if any, or is sent to the telemetry collection endpoint.

#### Example: [Setting Cloud Role Name](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-map#set-cloud-role-name)

```js
var telemetryInitializer = (envelope) => {
  envelope.tags["ai.cloud.role"] = "your role name";
  envelope.tags["ai.cloud.roleInstance"] = "your role instance";
}
appInsights.addTelemetryInitializer(telemetryInitializer);
```

#### Example: Filtering

```js
var telemetryInitializer = (envelope) => {
  envelope.data.someField = 'This item passed through my telemetry initializer';
};
appInsights.addTelemetryInitializer(telemetryInitializer);
appInsights.trackTrace({message: 'This message will use a telemetry initializer'});

appInsights.addTelemetryInitializer(() => false); // Nothing is sent after this is executed
appInsights.trackTrace({message: 'this message will not be sent'}); // Not sent
```


## Configuration

Most configuration fields are named such that they can be defaulted to falsey. All fields are optional except for `instrumentationKey`.

| Name | Default | Description |
|------|---------|-------------|
| instrumentationKey | null | **Required**<br>Instrumentation key that you obtained from the Azure Portal. |
| accountId | null | An optional account id, if your app groups users into accounts. No spaces, commas, semicolons, equals, or vertical bars |
| sessionRenewalMs | 1800000 | A session is logged if the user is inactive for this amount of time in milliseconds. Default is 30 minutes |
| sessionExpirationMs | 86400000 | A session is logged if it has continued for this amount of time in milliseconds. Default is 24 hours |
| maxBatchSizeInBytes | 10000 | Max size of telemetry batch. If a batch exceeds this limit, it is immediately sent and a new batch is started |
| maxBatchInterval | 15000 | How long to batch telemetry for before sending (milliseconds) |
| disableExceptionTracking | false | If true, exceptions are not autocollected. Default is false. |
| disableTelemetry | false | If true, telemetry is not collected or sent. Default is false. |
| enableDebug | false | If true, **internal** debugging data is thrown as an exception **instead** of being logged, regardless of SDK logging settings. Default is false. <br>***Note:*** Enabling this setting will result in dropped telemetry whenever an internal error occurs. This can be useful for quickly identifying issues with your configuration or usage of the SDK. If you do not want to lose telemetry while debugging, consider using `loggingLevelConsole` or `loggingLevelTelemetry` instead of `enableDebug`. |
| loggingLevelConsole | 0 | Logs **internal** Application Insights errors to console. <br>0: off, <br>1: Critical errors only, <br>2: Everything (errors & warnings) |
| loggingLevelTelemetry | 1 | Sends **internal** Application Insights errors as telemetry. <br>0: off, <br>1: Critical errors only, <br>2: Everything (errors & warnings) |
| diagnosticLogInterval | 10000 | (internal) Polling interval (in ms) for internal logging queue |
| samplingPercentage | 100 | Percentage of events that will be sent. Default is 100, meaning all events are sent. Set this if you wish to preserve your datacap for large-scale applications. |
| autoTrackPageVisitTime | false | If true, on a pageview,the previous instrumented page's view time is tracked and sent as telemetry and a new timer is started for the current pageview. Default is false. |
| disableAjaxTracking | false | If true, Ajax calls are not autocollected. Default is false. |
| disableFetchTracking | true | If true, Fetch requests are not autocollected. Default is true |
| overridePageViewDuration | false | If true, default behavior of trackPageView is changed to record end of page view duration interval when trackPageView is called. If false and no custom duration is provided to trackPageView, the page view performance is calculated using the navigation timing API. Default is false. |
| maxAjaxCallsPerView | 500 | Default 500 - controls how many ajax calls will be monitored per page view. Set to -1 to monitor all (unlimited) ajax calls on the page. |
| disableDataLossAnalysis | true | If false, internal telemetry sender buffers will be checked at startup for items not yet sent. |
| disableCorrelationHeaders | false | If false, the SDK will add two headers ('Request-Id' and 'Request-Context') to all dependency requests to correlate them with corresponding requests on the server side. Default is false. |
| correlationHeaderExcludedDomains |  | Disable correlation headers for specific domains |
| correlationHeaderExcludePatterns | | Disable correlation headers using regular expressions |
| correlationHeaderDomains |  | Enable correlation headers for specific domains |
| disableFlushOnBeforeUnload | false | Default false. If true, flush method will not be called when onBeforeUnload event triggers |
| enableSessionStorageBuffer | true | Default true. If true, the buffer with all unsent telemetry is stored in session storage. The buffer is restored on page load |
| isCookieUseDisabled | false | Default false. If true, the SDK will not store or read any data from cookies.|
| cookieDomain | null | Custom cookie domain. This is helpful if you want to share Application Insights cookies across subdomains. |
| isRetryDisabled | false | Default false. If false, retry on 206 (partial success), 408 (timeout), 429 (too many requests), 500 (internal server error), 503 (service unavailable), and 0 (offline, only if detected) |
| isStorageUseDisabled | false | If true, the SDK will not store or read any data from local and session storage. Default is false. |
| isBeaconApiDisabled | true | If false, the SDK will send all telemetry using the [Beacon API](https://www.w3.org/TR/beacon) |
| onunloadDisableBeacon | false | Default false. when tab is closed, the SDK will send all remaining telemetry using the [Beacon API](https://www.w3.org/TR/beacon) |
| sdkExtension | null | Sets the sdk extension name. Only alphabetic characters are allowed. The extension name is added as a prefix to the 'ai.internal.sdkVersion' tag (e.g. 'ext_javascript:2.0.0'). Default is null. |
| isBrowserLinkTrackingEnabled | false | Default is false. If true, the SDK will track all [Browser Link](https://docs.microsoft.com/en-us/aspnet/core/client-side/using-browserlink) requests. |
| appId | null | AppId is used for the correlation between AJAX dependencies happening on the client-side with the server-side requests. When Beacon API is enabled, it cannot be used automatically, but can be set manually in the configuration. Default is null |
| enableCorsCorrelation | false | If true, the SDK will add two headers ('Request-Id' and 'Request-Context') to all CORS requests to correlate outgoing AJAX dependencies with corresponding requests on the server side. Default is false |
| namePrefix | undefined | An optional value that will be used as name postfix for sessionStorage and cookie name.
| enableAutoRouteTracking | false | Automatically track route changes in Single Page Applications (SPA). If true, each route change will send a new Pageview to Application Insights. Hash route changes changes (`example.com/foo#bar`) are also recorded as new page views.
| enableRequestHeaderTracking | false | If true, AJAX & Fetch request headers is tracked, default is false.
| enableResponseHeaderTracking | false | If true, AJAX & Fetch request's response headers is tracked, default is false.
| enableAjaxErrorStatusText | false | Default false. If true, include response error data text in dependency event on failed AJAX requests.
| enableAjaxPerfTracking | false | Default false. Flag to enable looking up and including additional browser window.performance timings in the reported ajax (XHR and fetch) reported metrics.
| maxAjaxPerfLookupAttempts | 3 | Defaults to 3. The maximum number of times to look for the window.performance timings (if available), this is required as not all browsers populate the window.performance before reporting the end of the XHR request and for fetch requests this is added after its complete.
| ajaxPerfLookupDelay | 25 | Defaults to 25ms. The amount of time to wait before re-attempting to find the windows.performance timings for an ajax request, time is in milliseconds and is passed directly to setTimeout().
| distributedTracingMode | `DistributedTracingModes.AI` | Sets the distributed tracing mode. If AI_AND_W3C mode or W3C mode is set, W3C trace context headers (traceparent/tracestate) will be generated and included in all outgoing requests. AI_AND_W3C is provided for back-compatibility with any legacy Application Insights instrumented services.
| enableUnhandledPromiseRejectionTracking | false | If true, unhandled promise rejections will be autocollected and reported as a javascript error. When disableExceptionTracking is true (dont track exceptions) the config value will be ignored and unhandled promise rejections will not be reported.
| disableInstrumentationKeyValidation | false | If true, instrumentation key validation check is bypassed. Default value is false.
| enablePerfMgr | false | [Optional] When enabled (true) this will create local perfEvents for code that has been instrumented to emit perfEvents (via the doPerf() helper). This can be used to identify performance issues within the SDK based on your usage or optionally within your own instrumented code. [More details are available by the basic documentation](./docs/PerformanceMonitoring.md). Since v2.5.7
| perfEvtsSendAll | false | [Optional] When _enablePerfMgr_ is enabled and the [IPerfManager](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK.Interfaces/IPerfManager.ts) fires a [INotificationManager](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK.Interfaces/INotificationManager.ts).perfEvent() this flag determines whether an event is fired (and sent to all listeners) for all events (true) or only for 'parent' events (false &lt;default&gt;).<br />A parent [IPerfEvent](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK.Interfaces/IPerfEvent.ts) is an event where no other IPerfEvent is still running at the point of this event being created and it's _parent_ property is not null or undefined. Since v2.5.7
| idLength | 22 | [Optional] Identifies the default length used to generate new random session and user id's. Defaults to 22, previous default value was 5 (v2.5.8 or less), if you need to keep the previous maximum length you should set this value to 5.

## Single Page Applications

By default, this SDK will **not** handle state based route changing that occurs in single page applications. To enable automatic route change tracking for your single page application, you can add `enableAutoRouteTracking: true` to your setup configuration.

Currently, we support a separate [React plugin](#available-extensions-for-the-sdk) which you can initialize with this SDK. It will also accomplish route change tracking for you, as well as collect [other React specific telemetry](./extensions/applicationinsights-react-js).

## Source Map Support

The minified callstack of your exception telemetry can be unminified in the Azure Portal. All existing integrations on the Exception Details panel will work with the newly unminified callstack. Drag and drop source map unminifying supports all existing and future JS SDKs (+Node.JS), so you do not need to upgrade your SDK version. To view your unminified callstack,
1. Select an Exception Telemetry item in the Azure Portal to view its "End-to-end transaction details"
2. Identify which source maps correspond to this call stack. The source map must match a stack frame's source file, but suffixed with `.map`
3. Drag and drop the source maps onto the call stack in the Azure Portal
![](https://i.imgur.com/Efue9nU.gif)

## Examples

For runnable examples, see [Application Insights Javascript SDK Samples](https://github.com/topics/applicationinsights-js-demo)

## Application Insights Web Basic

For a lightweight experience, you can instead install the basic version of Application Insights
```
npm i --save @microsoft/applicationinsights-web-basic
```
This version comes with the bare minimum amount of features and functionalities and relies on you to build it up as you see fit. For example, it performs no auto-collection (uncaught exceptions, ajax, etc). The APIs to send certain telemetry types, like `trackTrace`, `trackException`, etc, are not included in this version, so you will need to provide your own wrapper. The only api that is available is `track`. A [sample](https://github.com/Azure-Samples/applicationinsights-web-sample1/blob/master/testlightsku.html) is located here.

## Available extensions for the SDK


| Extensions |
|---------------|
| [React](https://github.com/microsoft/ApplicationInsights-JS/tree/master/extensions/applicationinsights-react-js)|
| [React Native](https://github.com/microsoft/ApplicationInsights-JS/tree/master/extensions/applicationinsights-react-native)|

## Upgrading from the old Version of Application Insights

Breaking changes in the SDK V2 version:
- To allow for better API signatures, some of the apis such as trackPageView, trackException have been updated.
- ES3 (IE8) compatibility, while running in IE8 or lower versions of the browser is not an officially supported scenario we are working to maintain ES3 level compatibility to ensure that the SDK will not cause any unexpected failures due to Javascript parsing error. See [ES3/IE8 Compatibility](#es3ie8-compatibility) below for further information.
- Telemetry envelope has field name and structure changes due to data schema updates.
- Moved `context.operation` to `context.telemetryTrace`. Some fields were also changed (`operation.id` --> `telemetryTrace.traceID`)
  - If you want to maunally refresh the current pageview id (e.g. in SPA apps) this can be done with `appInsights.context.telemetryTrace.traceID = Util.newId()`

If you are using the current application insights PRODUCTION SDK (1.0.20) and want to see if the new SDK works in runtime, please update URL depending on your current SDK loading scenario:

**a)** Download via CDN scenario:
    Update code snippet that you currently use to point to the following URL:
    ```
    "https://js.monitor.azure.com/scripts/b/ai.2.min.js"
    ```

**b)** NPM scenario:
    Call downloadAndSetup to download full ApplicationInsights script from CDN and initialize it with instrumentation key.

```ts
appInsights.downloadAndSetup({
    instrumentationKey: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
    url: "https://js.monitor.azure.com/scripts/b/ai.2.min.js"
});
```

Test in internal environment to verify monitoring telemetry is working as expected. If all works, please update your api signatures appropriately to SDK V2 version and deploy in your production environments.

## Build a new extension for the SDK

The beta SDK supports the ability to include multiple extensions at runtime. In order to create a new extension, please implement the following interface:

[ITelemetryPlugin](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK.Interfaces/ITelemetryPlugin.ts)

On initialization, config.extensions accepts an array of ITelemetryPlugin objects. These are hooked up and ITelemetryPlugin.processTelemetry() is chained based on priority of these plugins.
Please note that higher the priority, the later your processing code will be invoked. The SDK supports a plugin model and channels can also be plugged in similarly (advanced scenario).
Target scenarios for creating a brand new extension is to share a usage scenario that benefits multiple customers. Please follow guidelines

Here is the priority ranges available:

- Regular extension priority can be between 201 to 499.
- Priorty range < 201 is reserved.
- Priority range > 1000 is for channels (advanced scenario)

[BaseTelemetryPlugin](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK/BaseTelemetryPlugin.ts)

To help with the creation of new extensions there is now a supported base class which can be used, this not only provides the common (boilerplate) implementations of common functions it will enable future plugins to automatically receive functional updates with the need to recode the plugins. it provides implementations for :-
* [ITelemetryPlugin.setNextPlugin()](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK.Interfaces/ITelemetryPlugin.ts) implementation to continuing supporting existing (non-shared) execution of plugins, however, new plugins should use the new [IProcessTelemetryContext.processNext()](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK.Interfaces/IProcessTelemetryContext.ts) moving forward as this support the creation of shared (singleton) plugins;
* New [ITelemetryPlugin.isInitialized()](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK.Interfaces/ITelemetryPlugin.ts) implementation
* And several helper methods.
  * [processNext()](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK/BaseTelemetryPlugin.ts), - to call the next plugin using the context or the _nextPlugin value
  * [diagLog()](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK/BaseTelemetryPlugin.ts): - to access the current [IDiagnosticLogger](https://github.com/microsoft/ApplicationInsights-JS/blob/master/shared/AppInsightsCore/src/JavaScriptSDK.Interfaces/IDiagnosticLogger.ts) instance.

  If you are creating new extensions it is recommended that you extend from this base class so that your extension will automatically inherit any future enhancements that are added to the ITelemetryPlugin interface without it requiring updates.

Usage:

```ts
const customPluginInstance = new YourCustomPlugin()
const appInsights = new ApplicationInsights({ config: {
    instrumentationKey: 'YOUR_INSTRUMENTATION_KEY_GOES_HERE',
    extensions: [customPluginInstance]
    // Other Configuration Options...
}});
appInsights.loadAppInsights();
```

ITelemetryPlugin has a simpler base type IPlugin that you can instantiate for initialization purposes when SDK loads.

## Build & Test this repo

1. Install all dependencies

    ```sh
    npm install
    npm install -g @microsoft/rush
    ```

2. Navigate to the root folder and update rush dependencies

    ```sh
    rush update
    ```

3. Build and test

    ```sh
    rush build
    npm run test
    ```

## Performance

Application Insights JS adds a negligible amount of load time to your website. By using the snippet, minimal components of the library are quickly loaded. In the meantime, the full script is downloaded in the background.

While the script downloads from the CDN, all tracking of your page is queued. Once the downloaded script finishes asynchronously initializing, all events that were queued are tracked. As a result, you will not lose any telemetry during the entire life cycle of your page. This setup process provides your page with a seamless analytics system, invisible to your users.

> Summary:
>
> - ![current npm version](https://badge.fury.io/js/%40microsoft%2Fapplicationinsights-web.svg)
> - ![gzip compressed size](https://img.badgesize.io/https://js.monitor.azure.com/scripts/b/ai.2.min.js.svg?compression=gzip)
> - **~15 ms** overall initialization time
> - **Zero** tracking missed during life cycle of page

## Browser Support

![Chrome](https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png) | ![Firefox](https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png) | ![IE](https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png) | ![Opera](https://raw.githubusercontent.com/alrra/browser-logos/master/src/opera/opera_48x48.png) | ![Safari](https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png)
--- | --- | --- | --- | --- |
Latest ✔ | Latest ✔ | 9+ Full ✔<br>8- Compatible | Latest ✔ | Latest ✔ |

## Contributing

Read our [contributing guide](./CONTRIBUTING.md) to learn about our development process, how to propose bugfixes and improvements, and how to build and test your changes to Application Insights.

### Build and Test this Project

Note: With the recent update to the latest version of rush ```npm run build``` fails with exit code 1 on successful build, hence the addition of ```--silent``` to the ```npm run build``` command.

```zsh
npm install -g @microsoft/rush
npm install
npm run build --silent
```

### Submitting a Change to this Project

```zsh
<...added some code...>
rush change
<...enter details>
git add <...your changes and rush change file...>
git commit -m "info about your change"
git push
```

## ES3/IE8 Compatibility

As an SDK there are numerous users which cannot control the browsers that their customers use. As such we need to ensure that this SDK continues to "work" and does not break the JS execution when loaded by an older browser. While it would be ideal to just not support IE8 and older generation (ES3) browsers there are numerous large customers/users that continue to require pages to "work" and as noted they may or cannot control which browser that their end users choose to use.

This does NOT mean that we will only support the lowest common set of features, just that we need to maintain ES3 code compatibility and when adding new features they will need to be added in a manner that would not break ES3 Javascript parsing and added as an optional feature.

As part of enabling ES3/IE8 support we have set the ```tsconfig.json``` to ES3 and ```uglify``` settings in ```rollup.config.js``` transformations to support ie8. This provides a first level of support which blocks anyone from adding unsupported ES3 features to the code and enables the generated javascript to be validily parsed in an ES3+ environment.

Ensuring that the generated code is compatible with ES3 is only the first step, JS parsers will still parse the code when an unsupport core function is used, it will just fail or throw an exception at runtime. Therefore, we also need to require/use polyfil implementations or helper functions to handle those scenarios.

It should also be noted that the overall goal of ES3/IE8 compatibility is the support at least the following 2 usage usage patterns. By supporting these two (2) basic use-cases, application/developers will be able to determine what browsers their users are using and whether they are experiencing any issues. As the SDK will report the data to the server, thus enabling the insights into whether they need to either fully support ES3/IE8 or provide some sort of browser upgrade notifications.

- track()
- trackException()

Beyond terminating support for older browsers that only support ES3, (which we cannot do at this point in time) we will endeavour to maintain support for the above two (2) use-cases.

### Browser must support JSON class

If your users are using a browser that does not support the [JSON](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON) Api you will need to include your own JSON polyfil implementation and this will need to be loaded prior to the application insights code.

This **includes** when running your application within an embedded browser, which on windows will default to using IE in IE7 doc mode -- which does NOT provide the JSON Api. 

For this case either provide a JSON polyfil or add the ["X-UA-Compatible"](https://docs.microsoft.com/en-us/openspecs/ie_standards/ms-iedoco/380e2488-f5eb-4457-a07a-0cb1b6e4b4b5?redirectedfrom=MSDN) meta tag and/or a header to your hosting page so that IE will provide the expected runtime environment.

```
 <meta http-equiv="X-UA-Compatible" content="IE=edge">
 
 <meta http-equiv="X-UA-Compatible" content="IE=11">
```

[More details on this are available here](https://docs.microsoft.com/en-us/archive/blogs/asiatech/ie11-migration-guide-understanding-browser-mode-document-mode-user-agent-and-x-ua-compatible)

### ES3/IE8 Packaging helper (ES3 rollup-plugin)

To ensure that the system conforms to the ES3 spec, by only using ES3 compatible code we have created a rollup plugin which has 2 functions

- es3Poly() finds and rewrite several commonly incompatible functions (such as Object.defineProperty; Object.getOwnPropertyDescriptor; Object.create) with inline polyfill functions that either call the real implementation or provide a basic implementation so that the scripts can be loaded and executed.
- es3Check() finds some of the known ES3 incompatible methods and will stop the packaging process if they are identified (and have not been polyfilled by es3Poly()), this provides a semi-automated validation of not just the application insights code, but also 3rd party libraries that it uses.
- importCheck() checks that the source code does not include imports from specific files or packages, this has been added due to packaging issues while using es3Poly causing imported type values to be renamed as "name$$1", which causes uglify() to missing renaming in some cases where the original source is "name$1". So this is being used to ensure that each source file only imports the values from packages or the original source file and not the main module export like "index". The importCheck can be placed before the nodeResolve() or after the es3Check() the recommendation is to fail fast be having this before the resolve. It should also be noted that only if the import is used will it appear in the final output (packagin), so it may exist in the original source but the packaging will not fail in this case.

To use these rollup plugins you simply need to add the following to your rollup.config.js

To import the module
```
import { es3Poly, es3Check, importCheck } from "@microsoft/applicationinsights-rollup-es3";
```

And then include as part of the packaging plugin list, if you use es3Poly()you should always include it before es3Check() 

```
    plugins: [
      replace({ ... }),
      importCheck({ exclude: [ "Index" ] }),
      nodeResolve({ browser: false, preferBuiltins: false }),
      es3Poly(),
      es3Check()
    ]
```

All plugins take an options which allows you to add additional checks and polyfill replacements. See the [Interfaces.ts]() for the definitions and [ES3Tokens.ts]() for the default values, which should provide the examples, if we have missed some common values that you require please feel free to raise an issue or provide a PR to add as the defaults.

It should be noted at this point that the both react and react-native extensions will NOT work in an ES3/IE8 environment out of the box, primarily because of the react code and their dependencies.
You *may* be able to workaround this limitation by providing and your own polyfill implementations for the unsupported methods.

### ES3/IE8 Features, Solutions, Workarounds and Polyfil style helper functions

As part of contributing to the project the following table highlights all of the currently known issues and the available solution/workaround. During PR and reviewing please ensure that you do not use the unsupported feature directly and instead use (or provide) the helper, soultion or workaround.

This table does not attempt to include ALL of the ES3 unsuported features, just the currently known functions that where being used at the time or writing. You are welcome to contribute to provide additional helpers, workarounds or documentation of values that should not be used.

|  Feature  |  Description  |  Helper, Solution or Workaround |
|-----------|-----------------|-----------------|
| ```JSON.stringify(obj)``` | We have a hard requirement on JSON support, however, because of the size of adding a specific JSON polyfil just for our usage we decided not to include our own version. As such any user of this Api **MUST** include a JSON polyfil implementation, otherwise, the API simply will not work. | App/Site **MUST** provide their own JSON polyfil.
| ```Object.keys()``` | Not provided by ES3, use the helper  | ```CoreUtils.objKeys(obj: {}): string[]``` |
| ES5+ getters/setters<br>```Object.defineProperty(...)``` | Code will needs to created the individual getters/setters manually in a static initializer. See ```ChannelController.ts``` for example usage.<br>However, to ensure compatibility actual usage of any getters/setters internally in the primary SDK code is not permitted. They may (and should) be used in unit tests to ensure that if used they function as expected (in an ES5+ environment).| ``` CoreUtils.objDefineAccessors<T>(target:any, prop:string, getProp?:() => T, setProp?: (v:T) => void) : boolean``` |
| ```Object.create(protoObj)``` | Not supported in an ES3 environment, use the helper or direct construct the object with SON style notation (if possible) | ```CoreUtils.objCreate(obj:object):any``` |
| ```Object.create(protoObj, descriptorSet)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.defineProperties()``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.getOwnPropertyNames(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.getPrototypeOf(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.getOwnPropertyDescriptor(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.getOwnPropertyNames()``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.preventExtensions(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.isExtensible(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.seal(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.isSealed(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.freeze(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Object.isFrozen(obj)``` | Not supported and no provided workaround/solution. | N/A |
| ```Array.prototype.indexOf(...)``` | Use the provided helper | ```CoreUtils.arrIndexOf<T>(arr: T[], searchElement: T, fromIndex?: number): number``` |
| ```Array.prototype.lastIndexOf(...)``` | Not supported and no provided workaround/solution. | N/A |
| ```Array.prototype.every(...)``` | Not supported and no provided workaround/solution. | N/A |
| ```Array.prototype.some(...)``` | Not supported and no provided workaround/solution. | N/A |
| ```Array.prototype.forEach(...)``` | Use the provided helper. | ```arrForEach<T>(arr: T[], callbackfn: (value: T, index?: number, array?: T[]) => void, thisArg?: any):void``` |
| ```Array.prototype.map(...)``` | Use the provided helper. | ```CoreUtils.arrMap<T,R>(arr: T[], callbackfn: (value: T, index?: number, array?: T[]) => R, thisArg?: any): R[]``` |
| ```Array.prototype.filter(...)``` | Not supported and no provided workaround/solution. | N/A |
| ```Array.prototype.reduce(...)``` | Use the provided helper. | ```CoreUtils.arrReduce<T,R>(arr: T[], callbackfn: (previousValue: T|R, currentValue?: T, currentIndex?: number, array?: T[]) => R, initialValue?: R): R``` |
| ```Array.prototype.reduceRight(...)``` | Not supported and no provided workaround/solution. | N/A |
| ```Date.prototype.toISOString()``` | Use the provided helper | ```CoreUtils.toISOString(date: Date)``` |
| ```Date.now()``` | Use the provided helper | ```CoreUtils.dateNow()``` |
| ```performance.now()``` | Use the provided helper for the Performance Api now function. | ```CoreUtils.perfNow()``` |
