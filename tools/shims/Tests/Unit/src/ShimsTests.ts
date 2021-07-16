import { AITestClass } from "@microsoft/ai-test-framework";
import { 
    objCreateFn, getGlobal,
    strShimFunction, strShimHasOwnProperty, strShimObject, strShimPrototype, strShimUndefined 
} from "../../../src/applicationinsights-shims";
import { __extendsFn, __assignFn, __objAssignFnImpl }  from "../../../src/TsLibShims";
import { __exposeGlobalTsLib }  from "../../../src/TsLibGlobals";

__exposeGlobalTsLib();

export class ShimsTests extends AITestClass {

    private _global: any = null;

    public testInitialize() {
        this._global = getGlobal();
        try {
            delete this._global.__assign;
            delete this._global.__extends;
        } catch (e) {
            // Can't do anything if the cleanup fails
        }
    }

    public registerTests() {
        this.testCase({
            name: "__extends should exist as a global",
            test: () => {
                __exposeGlobalTsLib();

                QUnit.assert.ok(this._global.__extends !== undefined, "__extends should exist");
                QUnit.assert.ok(this._global.__extends === __extendsFn, "Check that it came from the shims module");
            }
        });

        this.testCase({
            name: "__assign should exist as a global and be assigned to Object.assign or embedded __assignFn",
            test: () => {
                __exposeGlobalTsLib();

                QUnit.assert.ok(this._global.__assign !== undefined, "__assign should exist");
                if ((Object as any).assign) {
                    QUnit.assert.ok(this._global.__assign === (Object as any).assign, "Check that it came from the shims module");
                } else {
                    QUnit.assert.ok(this._global.__assign === __objAssignFnImpl, "Check that it came from the shims module");
                }
            }
        });

        this.testCase({
            name: "__assignFn should be assigned to Object.assign or embedded __assignFn",
            test: () => {
                QUnit.assert.ok(__assignFn !== undefined, "__assignFn should exist");
                if ((Object as any).assign) {
                    QUnit.assert.ok(__assignFn === (Object as any).assign, "Check that it came from the shims module");
                } else {
                    QUnit.assert.ok(this._global.__assign === __objAssignFnImpl, "Check that it came from the shims module");
                }
            }
        });

        this.testCase({
            name: "__objAssignImplFn should be assigned values to target",
            test: () => {
                let t = __objAssignFnImpl({}, {a:1}, {b:2});
                QUnit.equal(t.a, 1, "Checking expected value");
                QUnit.equal(t.b, 2, "Checking expected value");

                // check overwrite
                t = __objAssignFnImpl({a:0}, {a:1}, {b:2});
                QUnit.equal(t.a, 1, "Checking expected value");
                QUnit.equal(t.b, 2, "Checking expected value");

                // check target
                t = __objAssignFnImpl({x:0}, {a:1}, {b:2});
                QUnit.equal(t.x, 0, "Checking expected value");
                QUnit.equal(t.a, 1, "Checking expected value");
                QUnit.equal(t.b, 2, "Checking expected value");
            }
        });

        this.testCase({
            name: "__assignFn should be assigned values to target",
            test: () => {
                let t = __assignFn({}, {a:1}, {b:2});
                QUnit.equal(t.a, 1, "Checking expected value");
                QUnit.equal(t.b, 2, "Checking expected value");

                // check overwrite
                t = __assignFn({a:0}, {a:1}, {b:2});
                QUnit.equal(t.a, 1, "Checking expected value");
                QUnit.equal(t.b, 2, "Checking expected value");

                // check target
                t = __assignFn({x:0}, {a:1}, {b:2});
                QUnit.equal(t.x, 0, "Checking expected value");
                QUnit.equal(t.a, 1, "Checking expected value");
                QUnit.equal(t.b, 2, "Checking expected value");
            }
        });

        this.testCase({
            name: "objCreateFn should exist",
            test: () => {
                
                QUnit.assert.ok(objCreateFn !== undefined, "__extends should exist");
            }
        });

        this.testCase({
            name: "test string values",
            test: () => {
                
                QUnit.assert.ok(strShimFunction === "function", "check function");
                QUnit.assert.ok(strShimObject === "object", "check object");
                QUnit.assert.ok(strShimUndefined === "undefined", "check undefined");
                QUnit.assert.ok(strShimPrototype === "prototype", "check prototype");
                QUnit.assert.ok(strShimHasOwnProperty === "hasOwnProperty", "check hasOwnProperty");
            }
        });
    }
}
