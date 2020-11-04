// NOTE: this is a BETA release. see Note [1] for more information

//const { ApplicationInsightsTests } = require("../../../applicationinsights-analytics-js/Tests/ApplicationInsights.tests");
//const { PerfManager } = require("../../../../shared/appinsightscommon/node_modules/@microsoft/applicationinsights-core-js/types/JavaScriptSDK/PerfManager");

if (!Object.keys) {
  Object.keys = (function() {
    'use strict';
    var hasOwnProperty = Object.prototype.hasOwnProperty,
        hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString'),
        dontEnums = [
          'toString',
          'toLocaleString',
          'valueOf',
          'hasOwnProperty',
          'isPrototypeOf',
          'propertyIsEnumerable',
          'constructor'
        ],
        dontEnumsLength = dontEnums.length;

    return function(obj) {
      if (typeof obj !== 'function' && (typeof obj !== 'object' || obj === null)) {
        throw new TypeError('Object.keys called on non-object');
      }

      var result = [], prop, i;

      for (prop in obj) {
        if (hasOwnProperty.call(obj, prop)) {
          result.push(prop);
        }
      }

      if (hasDontEnumBug) {
        for (i = 0; i < dontEnumsLength; i++) {
          if (hasOwnProperty.call(obj, dontEnums[i])) {
            result.push(dontEnums[i]);
          }
        }
      }
      return result;
    };
  }());
}

function myFunc() {

  //  all trackers
  /*
     var toTrack = [
       'initialize',
       'trackEvent',
       'trackPageView',
       'trackPageViewPerformance',
       'trackException',
       'trackTrace',
       'trackMetric',
       'trackDependencyData',
       'throwInternal',        // called when a message is logged internally
       'logInternalMessage',   // called when a message is logged internally
       'triggerSend',          // called when data is queued to be sent to the server
       '_sender',              // called when data is sent to the server
     ];
*/
  // error handling functions
 /* var toTrack = [
    'trackException',
    'trackTrace',
    'throwInternal',
    'logInternalMessage'
  ]*/

  var debugPlugin = Microsoft.ApplicationInsights.DebugPlugin;
  var debugPluginInstance = new debugPlugin();
  // Application Insights Configuration
  var configObj = {
    instrumentationKey: "MyInstrumentationKey",
    appId: "OSKAR",
    disableFetchTracking: false,
    enableCorsCorrelation: true,
    disableCorrelationHeaders: false,
    maxBatchInterval: 5000,
    extensions: [
      debugPluginInstance
    ],
    extensionConfig: { },
    correlationHeaderDomains: ["oskarsvc", "localhost"],
    perfEvtsSendAll: true
  };

  configObj.extensionConfig[debugPlugin.identifier] = {
   // trackers: toTrack
   // maxMessages: 50
  };

  var appInsights = new Microsoft.ApplicationInsights.ApplicationInsights({ config: configObj });
  var notificationManager = new Microsoft.ApplicationInsights.NotificationManager(configObj);
  appInsights.core.setPerfMgr(new Microsoft.ApplicationInsights.PerfManager(notificationManager));
  appInsights.loadAppInsights(false,null,notificationManager);

  var testBtnFns = {
    trackEvent: function () { appInsights.trackEvent({name: 'some event'}); },
    trackPageView: function () { appInsights.trackPageView({name: 'some page'}); },
    trackPageViewPerformance: function () { appInsights.trackPageViewPerformance({name : 'some page', url: 'some url'}); },
    trackException: function () { appInsights.trackException({exception: new Error('some error')}); },
    trackTrace: function () { appInsights.trackTrace({message: 'some trace'}); },
    trackMetric: function () { appInsights.trackMetric({name: 'some metric', average: 42}); },
    trackDependencyData: function () { appInsights.trackDependencyData({absoluteUrl: 'some url', responseCode: 200, method: 'GET', id: 'some id'}); },
    triggerErrorImmediate: function () {
      throw new Error('testErrorImmediate');
    },
    triggerErrorAsync: function () {
      setTimeout(function() {throw new Error('testErrorAsync')}, 1000);
    },
    throwInternal: function () {
      appInsights.core.logger.throwInternal(1, 42069, 'test internal err');
    },
    send: function () {
      var idx = appInsights.core._extensions.findIndex(function(v) { return v.identifier === 'ChannelControllerPlugin' });
      appInsights.core._extensions[idx].getChannelControls()[0][0].triggerSend();
    }
  }

  var container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.margin = 'auto';
  container.style.top = '0';
  container.style.left = '0';
  container.style.bottom = '0';
  container.style.right = '0';
  container.style.width = "300px";
  container.style.height = 24 * 11 + 'px';
  container.style.zIndex = '-1';
  var keys = Object.keys(testBtnFns);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var fn = testBtnFns[key];

    var btn = document.createElement('button');
    btn.style.display = 'block';
    btn.style.width = '300px';
    btn.style.height = '24px';
    btn.style.background = '#0078D4';
    btn.style.color = "#FFFFFF";
    btn.style.borderRadius = '2px';
    btn.style.border = 'none';
    btn.style.margin = '5px 0';

    btn.textContent = "trigger " + key;
    btn.onclick = fn;
    container.appendChild(btn);
  }
  document.body.appendChild(container);
}

myFunc();