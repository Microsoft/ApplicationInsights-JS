// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { arrForEach, arrIndexOf, hasOwnProperty, isFunction, isObject, isString, isSymbol, objKeys } from '@microsoft/applicationinsights-core-js';
import { Util } from '@microsoft/applicationinsights-common';
import { strShimPrototype } from '@microsoft/applicationinsights-shims';

const strConstructor = "constructor";
const strGetOwnPropertyNames = "getOwnPropertyNames";

export const MAX_DEPTH = 16;

export function makeRegex(value: string) {
    if (value && value.length > 0) {
        value = value.replace(/\\/g, '\\\\');
        // eslint-disable-next-line security/detect-non-literal-regexp
        value = value.replace(/([\+\?\|\{\[\(\)\^\$\#\.]}])/g, '\\$1');
        value = value.replace(/\*/g, '.*');
        return new RegExp('(' + value + ')');
    }

    return null;
}

export function toggleClassName(el: HTMLElement, className: string) {
    const idx = el.className.indexOf(className);
    if (idx === -1) {
        el.className += className;
    } else {
        el.className = el.className.substring(0, idx) + el.className.substring(idx + className.length);
    }
}

export function traverseAndReplace(target: Object, maxDepth: number, currentDepth: number, thingsReferenced: any[], excludedKeys: string[], includeFunctions: boolean): Object {
    const out = {};

    if (!thingsReferenced) {
        thingsReferenced = [];
    }
    if (isObject(target)) {
        for (const key of getTargetKeys(target, excludedKeys, includeFunctions)) {
            let targetValue = target[key];
            if (isSymbol(targetValue)) {
                targetValue = targetValue.toString();
            }

            if (targetValue !== null && arrIndexOf(thingsReferenced, targetValue) !== -1) {
                out[key] = `<circular (${key} - "${getTargetName(targetValue)}")>`;
            }
            else if (targetValue !== null && isObject(targetValue)) {
                if (currentDepth >= maxDepth) {
                    out[key] = '<max allowed depth reached>';
                } else {
                    thingsReferenced.push(target);
                    out[key] = traverseAndReplace(targetValue, maxDepth, currentDepth + 1, thingsReferenced, excludedKeys, includeFunctions);
                    thingsReferenced.pop();
                }
            }
            else {
                out[key] = targetValue;
            }
        }
    }

    return out;
}

function _sanitizeText(value: string) {
    if (value) {
        value = value.replace(/&/g, '&amp;');
        value = value.replace(/>/g, '&gt;');
        value = value.replace(/</g, '&lt;');
    }

    return value;
}

function _setInnerText(elm: HTMLElement, theText: string, textFilter: string): boolean {
    let innerText = theText;
    let matchPos = -1;
    let matchLen = 0;
    let rg = makeRegex(textFilter);
    if (rg) {
        let matchTxt = rg.exec(innerText);
        if (matchTxt && matchTxt[1]) {
            matchPos = theText.indexOf(matchTxt[1]);
            matchLen = matchTxt[1].length;
        }
    }

    if (matchPos !== -1) {
        let innerHtml =
            _sanitizeText(theText.substring(0, matchPos)) +
            '<span class="matched-text-filter">' +
            _sanitizeText(theText.substring(matchPos, matchPos + matchLen)) +
            '</span>' +
            theText.substring(matchPos + matchLen);

        elm.innerHTML = innerHtml;
        return true;
    }

    elm.innerText = theText;
    return false;
}

let lastSelectedElement: HTMLElement;
let selectedObject: object;

export function copySelectedTree() {
    const toCopy: Object = selectedObject;
    if (!toCopy) { 
        return;
    }

    const textArea = document.createElement("textarea");
    textArea.innerText = JSON.stringify(toCopy);
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    textArea.parentElement.removeChild(textArea);
};

export function focusHandler(evt: Event, target: Object, level: number, excludeKeys: string[], includeFunctions: boolean) {
    if (lastSelectedElement) {
        toggleClassName(lastSelectedElement, ' last-selected-element');
    }
    lastSelectedElement = (evt.target as HTMLElement);
    for (let i = 0; i < 10; i++) {
        if (lastSelectedElement.tagName === "DIV") { break; }
        lastSelectedElement = lastSelectedElement.parentElement;
    }
    lastSelectedElement.className += ' last-selected-element';
    selectedObject = traverseAndReplace(target, MAX_DEPTH, level, null, excludeKeys, includeFunctions);
}

function _navHandler(evt: KeyboardEvent, openHandler?: (evt: Event, forceState?: boolean) => void, currentState?: boolean) {
    const el = evt.target as HTMLElement;
    switch (evt.which) {
        // Enter
        case 13: (openHandler) ? openHandler(evt) : void 0; break;
        // ArrowUp
        case 38:
            evt.preventDefault();
            const prev = el.previousElementSibling as HTMLElement;
            if (prev && prev.tagName !== 'BUTTON') { prev.focus(); }
            break;
        // ArrowDown
        case 40:
            evt.preventDefault();
            const next = el.nextElementSibling as HTMLElement;
            if (next) { next.focus(); }
            break;
        // ArrowRight
        case 39:
            if (openHandler) {
                openHandler(evt, true);
                if (currentState) {
                    (el.firstElementChild.nextSibling as HTMLElement).focus();
                }
            }
            break;
        // ArrowLeft
        case 37:
            if (openHandler) { openHandler(evt, false); }
            if (!currentState) { (el.parentElement as HTMLElement).focus(); }
            break;
        // c
        case 67:
            if (evt.ctrlKey) {
                copySelectedTree();
                (evt.target as HTMLElement).focus();
            }
            break;
    }
}

export function getTargetName(target: any) {
    if (target) {
        if (isString(target.identifier)) {
            return target.identifier;
        }

        if (isString(target.name)) {
            return target.name;
        }

        if (hasOwnProperty(target, strShimPrototype)) {
            // Look like a prototype
            return target.name || "";
        }

        return ((target[strConstructor]) || {}).name || "";
    }

    return "";
}

function _toString(value: any) {
    if (isString(value)) {
        return value;
    }

    if (isSymbol(value)) {
        return value.toString();
    }

    if (isFunction(value["toString"])) {
        return (value["toString"] as any)() || "";
    }

    return "";
}

export function getTargetKeys(target: any, excludedKeys: string[], includeFunctions: boolean) {
    let keys: string[] = objKeys(target);

    if (!Util.isArray(target)) {
        try {
            if (Object[strGetOwnPropertyNames]) {
                // We need to use this for built in objects such as Error which don't return their values via objKeys because they are not enumerable for example
                let propKeys = Object[strGetOwnPropertyNames](target);
                if (propKeys) {
                    arrForEach(propKeys, (key) => {
                        const theKey = _toString(key);
                        if (theKey && keys.indexOf(theKey) === -1) {
                            keys.push(key);
                        }
                    });
                }
            }
        } catch (ex) {
            // getOwnPropertyNames can fail in ES5, if the argument to this method is not an object (a primitive), 
            // then it will cause a TypeError. In ES2015, a non-object argument will be coerced to an object.
        }
    }

    let theKeys: string[] = [];
    arrForEach(keys, (key) => {

        if (!includeFunctions && isFunction(target[key])) {
            return;
        }

        const theKey = _toString(key);
        if (theKey && excludedKeys.indexOf(theKey) === -1) {
            theKeys.push(theKey);
        }
    });

    return theKeys;
}

export function formatLogElements(target: Object, tmLabel: string, key: string, level: number, textFilter: string, excludeKeys: string[], thingsReferenced?: any[], includeFunctions?:boolean): any {
    let openState = false;
    if (!level) {
        level = 0; 
    }

    if (!thingsReferenced) {
        thingsReferenced = [];
    }

    let isObj = isObject(target) || Util.isError(target);
    let isErr = target['baseType'] === 'ExceptionData' || Util.isError(target);

    const children: HTMLElement[] = [];

    function _openNode(currentLine: HTMLElement) {
        openState = true;
        arrForEach(children, (child) => {
            rootDiv.appendChild(child);
        });

        currentLine.className = 'obj-key expandable open'
    }

    function _collapseNode(currentLine: HTMLElement) {
        // rootDiv.innerHTML = '';
        arrForEach(children, (child) => {
            rootDiv.removeChild(child);
        });
        // rootDiv.appendChild(currentLine);
        openState = false;
        currentLine.className = 'obj-key expandable closed'
    }

    let matched = false;
    let childOpened = false;
    const keys = getTargetKeys(target, excludeKeys, includeFunctions);
    if (keys.length === 0) { keys.push('<empty>'); }
    if (level >= MAX_DEPTH) { keys.unshift('<maxdepth>'); }
    for (const key of keys) {
        if (excludeKeys.indexOf(key) !== -1) {
            continue;
        }

        let targetValue = target[key];
        if (isSymbol(targetValue)) {
            targetValue = targetValue.toString();
        }

        if (key === '<maxdepth>') {
            const builder = document.createElement("div");
            builder.className = 'empty';
            builder.innerText = '<max allowed depth reached>';
            children.push(builder);
            break;
        }
        else if (key === '<empty>') {
            const builder = document.createElement("div");
            builder.className = 'empty';
            builder.innerText = '<empty>';
            children.push(builder);
        }
        else if (targetValue !== null && arrIndexOf(thingsReferenced, targetValue) !== -1) {
            const builder = document.createElement("div");
            builder.className = 'empty';
            builder.innerText = `<circular (${key}) - "${getTargetName(targetValue)}">`;
            children.push(builder);
        }
        else if (targetValue !== null && (isObject(targetValue) || Util.isError(targetValue))) {
            thingsReferenced.push(target);
            let formatted = formatLogElements(targetValue, null, key, level + 1, textFilter, excludeKeys, thingsReferenced, includeFunctions);
            thingsReferenced.pop();
            if (formatted.matched) {
                childOpened = true;
            }
            if (formatted.isErr) {
                isErr = true;
            }

            children.push(formatted.root);
        } else {
            const builder = document.createElement("div");
            builder.setAttribute("tabindex", "0");
            builder.onclick = (evt: MouseEvent) => {
                evt.stopPropagation();
            }
            builder.ontouchend = (evt: TouchEvent) => {
                evt.stopPropagation();
            }
            builder.onkeydown = (evt: KeyboardEvent) => {
                evt.stopPropagation();
                _navHandler(evt);
            }
            builder.onfocus = (evt: Event) => {
                focusHandler(evt, target, level, excludeKeys, includeFunctions);
            }

            const outerSpan = document.createElement("span");
            const keySpan = document.createElement("span");
            keySpan.className = 'key';
            if (_setInnerText(keySpan, `${key}: `, textFilter)) {
                childOpened = true;
            }

            outerSpan.appendChild(keySpan);

            const valueSpan = document.createElement("span");
            if (isFunction(targetValue)) {
                const fnStr = targetValue.toString();
                const fnHead = fnStr.match(/^([^{]+)/)[1];
                valueSpan.textContent = `${fnHead}{...}`;
            } else {
                if (_setInnerText(valueSpan, `${targetValue}`, textFilter)) {
                    childOpened = true;
                }
            }
            valueSpan.className = `${typeof targetValue}`;
            outerSpan.appendChild(valueSpan);
            builder.appendChild(outerSpan);
            children.push(builder);
        }
    }

    const rootDiv = document.createElement("div");

    let innerText = '';
    let currentLine = document.createElement('span');
    if (isObj || children.length) {
        innerText = `${key ? key : 'obj'}: `;
        if (Util.isArray(target)) {
            innerText += `[${getTargetKeys(target, excludeKeys, includeFunctions).length}]`;
        } else {
            let targetName = getTargetName(target);
            if (targetName) {
                innerText += ` <"${targetName}"> `
            }
            innerText += `{${getTargetKeys(target, excludeKeys, includeFunctions).length}}`;
        }

        matched = _setInnerText(currentLine, innerText, textFilter);

        if (tmLabel) {
            const tmWrapper = document.createElement('span');
            const tmDetails = document.createElement('span');
            tmDetails.className = 'obj-time';
            tmDetails.innerText = tmLabel;
            tmWrapper.appendChild(tmDetails);
            tmWrapper.appendChild(currentLine);

            currentLine = tmWrapper;
        }

        currentLine.className = 'obj-key expandable closed'
    } else {
        innerText = `${key ? key : 'obj'}: ${target.toString()}`;
        matched = _setInnerText(currentLine, innerText, textFilter);

        currentLine.className = 'obj-key';
    }

    rootDiv.appendChild(currentLine);
    rootDiv.setAttribute("tabindex", "0");

    if (childOpened) {
        // A child node matched so auto-expand
        _openNode(currentLine);
    }    
    if (isObj) {
        if (isErr) { rootDiv.className = 'exception' }
        const openHandler = (evt: Event, forceState?: boolean) => {
            evt.stopPropagation();
            if (Util.getIEVersion()) {
                focusHandler(evt, target, level, excludeKeys, includeFunctions);
            }
            if (forceState !== undefined && openState === forceState) {
                return;
            }
            if (lastSelectedElement === rootDiv) {
                if (openState) {
                    _collapseNode(currentLine);
                }
                else {
                    _openNode(currentLine);
                }
            }
        }

        rootDiv.onkeydown = (evt: KeyboardEvent) => {
            _navHandler(evt, openHandler, openState);
        }
        rootDiv.onclick = (evt: MouseEvent) => {
            openHandler(evt);
        }
        rootDiv.ontouchend = (evt: TouchEvent) => {
            openHandler(evt);
        }
        rootDiv.onfocus = (evt: Event) => {
            focusHandler(evt, target, level, excludeKeys, includeFunctions);
        }
    }

    return {
        root: rootDiv,
        isErr: isErr,
        matched: matched || childOpened
    };
}
