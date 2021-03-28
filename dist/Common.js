"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyElements = exports.getFirstElement = exports.noop = exports.validateUrl = exports.processText = exports.log = exports.fetch = void 0;
var request_1 = __importDefault(require("request"));
function fetch(url) {
    var headers = JSON.parse(process.env.HEADERS);
    var options = {
        url: url,
        headers: headers
    };
    return new Promise(function (resolve, reject) {
        request_1.default(options, function (error, response, body) {
            if (error) {
                reject(error);
            }
            else {
                resolve(body);
            }
        });
    });
}
exports.fetch = fetch;
function log(message) {
    if (process.env.DEBUG == "true") {
        console.log(message);
    }
}
exports.log = log;
function processText(text) {
    return text
        .replace(/\n/gi, "<br />")
        .replace(/\./gi, ". ")
        .replace(/\?/gi, "? ")
        .replace(/\:/gi, ": ")
        .replace(/\!/gi, "! ")
        .replace(/\-/gi, " - ")
        .replace(/  /gi, " ");
}
exports.processText = processText;
function validateUrl(url) {
    return url && /^(ftp|http|https):\/\/[^ "]+$/.test(url);
}
exports.validateUrl = validateUrl;
function noop() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return true;
}
exports.noop = noop;
function getFirstElement(parent, tagName) {
    var nodes = parent.getElementsByTagName(tagName);
    if (nodes.length) {
        return nodes.item(0);
    }
    return null;
}
exports.getFirstElement = getFirstElement;
function copyElements(fromParent, toParent, tagNames) {
    for (var _i = 0, tagNames_1 = tagNames; _i < tagNames_1.length; _i++) {
        var tagName = tagNames_1[_i];
        var element = this.getFirstElement(fromParent, tagName);
        if (element) {
            toParent.appendChild(element);
        }
    }
}
exports.copyElements = copyElements;
//# sourceMappingURL=Common.js.map