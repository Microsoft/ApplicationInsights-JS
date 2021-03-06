import { ITypeValidator } from './ITypeValidator';
import { IEnvelope } from '@microsoft/applicationinsights-common';
import { CommonValidator } from './CommonValidator';

export class ExceptionValidator implements ITypeValidator {
    static ExceptionValidator = new ExceptionValidator();

    private static _validateExceptions(exceptions: any[]): boolean {
        // verify exceptions has typeName, message, hasFullStack, stack, parsedStack fields
        if (!exceptions[0].typeName ||
            !exceptions[0].message ||
            !("hasFullStack" in exceptions[0]) ||
            !exceptions[0].stack ||
            !("parsedStack" in exceptions[0])) {
            return false;
        }

        return true;
    }

    Validate(item: IEnvelope, baseType: string): boolean {
        // verify item passes CommonValidator
        if (!CommonValidator.CommonValidator.Validate(item, baseType)) {
            return false;
        }

        // verify item has ver and exceptions fields
        if (!item.data.baseData ||
            !item.data.baseData.ver ||
            !item.data.baseData.exceptions) {
            return false;
        }

        // Exception.ver should be a number for breeze channel, but a string in CS4.0
        if (item.data.baseData.ver !== 2) {
            return false; // not a valid breeze exception
        }

        if (!ExceptionValidator._validateExceptions(item.data.baseData.exceptions)) {
            return false;
        }

        return true;
    }
}