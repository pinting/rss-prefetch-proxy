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
exports.FeedProcessor = void 0;
var xmldom_1 = require("xmldom");
var readability_1 = require("@mozilla/readability");
var jsdom_1 = require("jsdom");
var Common_1 = require("./Common");
var FeedProcessor = /** @class */ (function () {
    function FeedProcessor(cache, textMode, style) {
        if (textMode === void 0) { textMode = false; }
        if (style === void 0) { style = ""; }
        this.cache = cache;
        this.textMode = textMode;
        this.style = style;
    }
    FeedProcessor.prototype.extractContent = function (url, htmlString) {
        var dom = new jsdom_1.JSDOM(htmlString, { url: url });
        var reader = new readability_1.Readability(dom.window.document);
        var article = reader.parse();
        if (this.textMode) {
            return Common_1.processText(article.textContent);
        }
        else {
            return article.content;
        }
    };
    FeedProcessor.prototype.getContent = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var cached, result, page, content;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.cache.find(url)];
                    case 1:
                        cached = _a.sent();
                        result = null;
                        if (!!cached) return [3 /*break*/, 4];
                        Common_1.log("From web: " + url);
                        return [4 /*yield*/, Common_1.fetch(url)];
                    case 2:
                        page = _a.sent();
                        content = this.extractContent(url, page);
                        return [4 /*yield*/, this.cache.insert(url, content)];
                    case 3:
                        _a.sent();
                        result = content;
                        return [3 /*break*/, 5];
                    case 4:
                        Common_1.log("From cache: " + url);
                        result = cached;
                        _a.label = 5;
                    case 5: return [2 /*return*/, result];
                }
            });
        });
    };
    FeedProcessor.prototype.process = function (xmlString) {
        return __awaiter(this, void 0, void 0, function () {
            var serializer, parser, document, itemNodes, successCount, i, itemNode, linkNodes, titleNodes, linkNode, url, content, contentNodes, n, contentNode_1, contentNode, dataNode, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        serializer = new xmldom_1.XMLSerializer();
                        parser = new xmldom_1.DOMParser({ errorHandler: {
                                error: function (message) { throw new Error(message); },
                                fatalError: function (message) { throw new Error(message); }
                            } });
                        document = parser.parseFromString(xmlString);
                        itemNodes = document.getElementsByTagName("item");
                        successCount = 0;
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < itemNodes.length)) return [3 /*break*/, 6];
                        itemNode = itemNodes.item(i);
                        linkNodes = itemNode.getElementsByTagName("link");
                        titleNodes = itemNode.getElementsByTagName("title");
                        // Check if the right node is selected
                        if (linkNodes.length != 1 || titleNodes.length != 1) {
                            return [3 /*break*/, 5];
                        }
                        linkNode = linkNodes.item(0);
                        url = linkNode.firstChild.nodeValue;
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.getContent(url)];
                    case 3:
                        content = _a.sent();
                        contentNodes = itemNode.getElementsByTagName("content:encoded");
                        for (n = 0; n < contentNodes.length; n++) {
                            contentNode_1 = contentNodes.item(n);
                            contentNode_1.parentNode.removeChild(contentNode_1);
                        }
                        contentNode = document.createElement("content:encoded");
                        dataNode = document.createCDATASection(this.style + content);
                        contentNode.appendChild(dataNode);
                        itemNode.appendChild(contentNode);
                        successCount++;
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _a.sent();
                        Common_1.log(e_1.message);
                        return [3 /*break*/, 5];
                    case 5:
                        i++;
                        return [3 /*break*/, 1];
                    case 6:
                        if (!successCount) {
                            throw new Error("Zero success count");
                        }
                        return [2 /*return*/, serializer.serializeToString(document)];
                }
            });
        });
    };
    return FeedProcessor;
}());
exports.FeedProcessor = FeedProcessor;
//# sourceMappingURL=FeedProcessor.js.map