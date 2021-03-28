"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
var http_1 = require("http");
var Common_1 = require("./Common");
var FeedCache_1 = require("./FeedCache");
var FeedProcessor_1 = require("./FeedProcessor");
;
var cache = new FeedCache_1.FeedCache(process.env.DATABASE_URL, process.env.IS_LOCAL == "true");
var ads = require('../ads.json') || {};
function clean() {
    return __awaiter(this, void 0, void 0, function () {
        var now, keepCache, before, count;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = +new Date();
                    keepCache = parseInt(process.env.KEEP_CACHE) * 1000;
                    before = new Date(now - keepCache).toISOString();
                    return [4 /*yield*/, cache.clean(before)];
                case 1:
                    count = _a.sent();
                    Common_1.log("Removed " + count + " pages before " + before);
                    return [2 /*return*/];
            }
        });
    });
}
function removeAds(document, url) {
    var key = Object.keys(ads).find(function (domain) { return url.includes(domain); });
    if (ads.hasOwnProperty(key)) {
        var classNames = ads[key] || [];
        for (var _i = 0, classNames_1 = classNames; _i < classNames_1.length; _i++) {
            var className = classNames_1[_i];
            document.querySelectorAll(className).forEach(function (e) { return e.remove(); });
        }
    }
}
function requestListener(req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var responseHeaders, debug, textMode, style, input, feedUrl, minCharCount, parts, parsedNumber, processor, inputFeed, outputFeed, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    responseHeaders = {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "OPTIONS, GET",
                        "Access-Control-Max-Age": 2592000
                    };
                    if (req.method == "OPTIONS") {
                        res.writeHead(204, responseHeaders);
                        res.end();
                        return [2 /*return*/];
                    }
                    if (req.method != "GET") {
                        res.writeHead(400, responseHeaders);
                        res.end();
                        return [2 /*return*/];
                    }
                    debug = process.env.DEBUG == "true";
                    textMode = process.env.TEXT_MODE == "true";
                    style = process.env.STYLE;
                    input = req.url && req.url.substr(1);
                    feedUrl = input;
                    minCharCount = 0;
                    parts = input.split(",");
                    if (parts.length >= 2) {
                        parsedNumber = parseInt(parts[0]);
                        if (!Number.isNaN(parsedNumber)) {
                            feedUrl = parts[1];
                            minCharCount = parsedNumber;
                        }
                    }
                    if (!Common_1.validateUrl(feedUrl)) {
                        res.writeHead(400, responseHeaders);
                        res.end();
                        return [2 /*return*/];
                    }
                    Common_1.log("Incoming request for URL " + feedUrl);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    processor = new FeedProcessor_1.FeedProcessor(cache, {
                        textMode: textMode,
                        style: style,
                        applyTweaks: removeAds
                    });
                    return [4 /*yield*/, Common_1.fetch(feedUrl)];
                case 2:
                    inputFeed = _a.sent();
                    return [4 /*yield*/, processor.process(inputFeed, minCharCount)];
                case 3:
                    outputFeed = _a.sent();
                    res.writeHead(200, responseHeaders);
                    res.end(outputFeed);
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    Common_1.log(e_1.message);
                    res.writeHead(503, responseHeaders);
                    res.end(debug ? e_1.message : undefined);
                    return [3 /*break*/, 5];
                case 5:
                    clean();
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var server;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cache.init()];
                case 1:
                    _a.sent();
                    server = http_1.createServer(requestListener);
                    server.listen(parseInt(process.env.PORT));
                    Common_1.log("Application is listening on port " + process.env.PORT);
                    return [2 /*return*/];
            }
        });
    });
}
main();
//# sourceMappingURL=index.js.map