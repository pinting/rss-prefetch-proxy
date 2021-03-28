"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUrl = exports.processText = exports.log = exports.fetch = void 0;
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
//# sourceMappingURL=Common.js.map