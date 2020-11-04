import { ApplicationInsightsTests } from '../applicationinsights.e2e.tests';
import { SanitizerE2ETests } from '../sanitizer.e2e.tests';
import { ValidateE2ETests } from '../validate.e2e.tests';
import { SenderE2ETests } from '../sender.e2e.tests';
import { ApplicationInsightsDeprecatedTests } from '../ApplicationInsightsDeprecatedTests';
import { PerfTests } from '../perfTests';

new PerfTests().registerTests();
new ApplicationInsightsTests().registerTests();
new ApplicationInsightsDeprecatedTests().registerTests();
new SanitizerE2ETests().registerTests();
new ValidateE2ETests().registerTests();
new SenderE2ETests().registerTests();
