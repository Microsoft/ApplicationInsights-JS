import { Util, ISerializable, FieldType } from '@microsoft/applicationinsights-common';
import { IDiagnosticLogger, LoggingSeverity, _InternalMessageId, CoreUtils, getJSON, IAppInsightsCore, doPerf } from '@microsoft/applicationinsights-core-js';
import dynamicProto from '@microsoft/dynamicproto-js'

export class Serializer {

    constructor(core: IAppInsightsCore) {
        dynamicProto(Serializer, this, (_self) => {

            const logger=core.logger;
            /**
             * Serializes the current object to a JSON string.
             */           
            _self.serialize = (input: ISerializable): string => {
                return doPerf(core, () => "Serializer.serialize", () => {
                    const output = _serializeObject(input, "root");
                    try {
                        return getJSON().stringify(output);
                    } catch (e) {
                    // if serialization fails return an empty string
                        logger.throwInternal(LoggingSeverity.CRITICAL, _InternalMessageId.CannotSerializeObject, (e && CoreUtils.isFunction(e.toString)) ? e.toString() : "Error serializing object", null, true);
                    }
                },() => ({ item: input }));
                
            }

            function _serializeObject(source: ISerializable, name: string): any {
                const circularReferenceCheck = "__aiCircularRefCheck";
                let output = {};

                if (!source) {
                    logger.throwInternal(LoggingSeverity.CRITICAL, _InternalMessageId.CannotSerializeObject, "cannot serialize object because it is null or undefined", { name }, true);
                    return output;
                }

                if (source[circularReferenceCheck]) {
                    logger.throwInternal(LoggingSeverity.WARNING, _InternalMessageId.CircularReferenceDetected, "Circular reference detected while serializing object", { name }, true);
                    return output;
                }

                if (!source.aiDataContract) {
                    // special case for measurements/properties/tags
                    if (name === "measurements") {
                        output = _serializeStringMap(source, "number", name);
                    } else if (name === "properties") {
                        output = _serializeStringMap(source, "string", name);
                    } else if (name === "tags") {
                        output = _serializeStringMap(source, "string", name);
                    } else if (Util.isArray(source)) {
                        output = _serializeArray(source as any, name);
                    } else {
                        logger.throwInternal(LoggingSeverity.WARNING, _InternalMessageId.CannotSerializeObjectNonSerializable, "Attempting to serialize an object which does not implement ISerializable", { name }, true);

                        try {
                            // verify that the object can be stringified
                            getJSON().stringify(source);
                            output = source;
                        } catch (e) {
                            // if serialization fails return an empty string
                            logger.throwInternal(LoggingSeverity.CRITICAL, _InternalMessageId.CannotSerializeObject, (e && CoreUtils.isFunction(e.toString)) ? e.toString() : "Error serializing object", null, true);
                        }
                    }

                    return output;
                }

                source[circularReferenceCheck] = true;
                for (const field in source.aiDataContract) {

                    const contract = source.aiDataContract[field];
                    const isRequired = (CoreUtils.isFunction(contract)) ? (contract() & FieldType.Required) : (contract & FieldType.Required);
                    const isHidden = (CoreUtils.isFunction(contract)) ? (contract() & FieldType.Hidden) : (contract & FieldType.Hidden);
                    const isArray = contract & FieldType.Array;

                    const isPresent = source[field] !== undefined;
                    const isObject = CoreUtils.isObject(source[field]) && source[field] !== null;

                    if (isRequired && !isPresent && !isArray) {
                        logger.throwInternal(
                            LoggingSeverity.CRITICAL,
                            _InternalMessageId.MissingRequiredFieldSpecification,
                            "Missing required field specification. The field is required but not present on source",
                            { field, name });

                        // If not in debug mode, continue and hope the error is permissible
                        continue;
                    }

                    if (isHidden) {
                        // Don't serialize hidden fields
                        continue;
                    }

                    let value;
                    if (isObject) {
                        if (isArray) {
                            // special case; recurse on each object in the source array
                            value = _serializeArray(source[field], field);
                        } else {
                            // recurse on the source object in this field
                            value = _serializeObject(source[field], field);
                        }
                    } else {
                        // assign the source field to the output even if undefined or required
                        value = source[field];
                    }

                    // only emit this field if the value is defined
                    if (value !== undefined) {
                        output[field] = value;
                    }
                }

                delete source[circularReferenceCheck];
                return output;
            }

            function _serializeArray(sources: ISerializable[], name: string): any[] {
                let output;

                if (!!sources) {
                    if (!Util.isArray(sources)) {
                        logger.throwInternal(
                            LoggingSeverity.CRITICAL,
                            _InternalMessageId.ItemNotInArray,
                            "This field was specified as an array in the contract but the item is not an array.\r\n",
                            { name }, true);
                    } else {
                        output = [];
                        for (let i = 0; i < sources.length; i++) {
                            const source = sources[i];
                            const item = _serializeObject(source, name + "[" + i + "]");
                            output.push(item);
                        }
                    }
                }

                return output;
            }

            function _serializeStringMap(map: any, expectedType: string, name: string) {
                let output;
                if (map) {
                    output = {};
                    for (const field in map) {
                        const value = map[field];
                        if (expectedType === "string") {
                            if (value === undefined) {
                                output[field] = "undefined";
                            } else if (value === null) {
                                output[field] = "null";
                            } else if (!value.toString) {
                                output[field] = "invalid field: toString() is not defined.";
                            }
                            else {
                                output[field] = value.toString();
                            }
                        }
                        else if (expectedType === "number") {
                            if (value === undefined) {
                                output[field] = "undefined";
                            } else if (value === null) {
                                output[field] = "null";
                            } else {
                                const num = parseFloat(value);
                                if (isNaN(num)) {
                                    output[field] = "NaN";
                                }
                                else {
                                    output[field] = num;
                                }
                            }
                        }
                        else {
                            output[field] = "invalid field: " + name + " is of unknown type.";
                            logger.throwInternal(LoggingSeverity.CRITICAL, output[field], null, true);
                        }
                    }
                }

                return output;
            }
        });
    }

    /**
     * Serializes the current object to a JSON string.
     */
    public serialize(input: ISerializable): string {
        // @DynamicProtoStub -- DO NOT add any code as this will be removed during packaging
        return null;
    }
}