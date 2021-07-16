import { SenderTests } from "./Sender.tests";
import { SampleTests } from "./Sample.tests";

export function runTests() {
    new SenderTests().registerTests();
    new SampleTests().registerTests();
}