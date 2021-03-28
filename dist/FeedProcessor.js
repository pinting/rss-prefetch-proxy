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
exports.FeedProcessor = exports.DEFAULT_ITEM_TAGS = exports.DEFAULT_CHANNEL_TAGS = exports.DEFAULT_ROOT_TEMPLATE = void 0;
var xmldom_1 = require("xmldom");
var readability_1 = require("@mozilla/readability");
var jsdom_1 = require("jsdom");
var Common_1 = require("./Common");
exports.DEFAULT_ROOT_TEMPLATE = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
    "<rss xmlns:content=\"http://purl.org/rss/1.0/modules/content/\" " +
    "xmlns:dc=\"http://purl.org/dc/elements/1.1/\" " +
    "xmlns:sy=\"http://purl.org/rss/1.0/modules/syndication/\" " +
    "xmlns:atom=\"http://www.w3.org/2005/Atom\" " +
    "version=\"2.0\" />";
exports.DEFAULT_CHANNEL_TAGS = [
    "title",
    "link",
    "description",
    "copyright"
];
exports.DEFAULT_ITEM_TAGS = [
    "title",
    "link",
    "pubDate",
    "guid",
    "description"
];
var FeedProcessor = /** @class */ (function () {
    function FeedProcessor(cache, options) {
        if (options === void 0) { options = {}; }
        this.cache = cache;
        this.rootTemplate = options.rootTemplate || exports.DEFAULT_ROOT_TEMPLATE;
        this.channelTags = options.channelTags || exports.DEFAULT_CHANNEL_TAGS;
        this.itemTags = options.itemTags || exports.DEFAULT_ITEM_TAGS;
        this.textMode = options.textMode || false;
        this.style = options.style || "";
        this.applyTweaks = options.applyTweaks || Common_1.noop;
    }
    FeedProcessor.prototype.extractContent = function (url, html) {
        var dom = new jsdom_1.JSDOM(html, { url: url });
        var document = dom.window.document;
        this.applyTweaks(document, url);
        var reader = new readability_1.Readability(document);
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
            var result, page, content;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.cache.find(url)];
                    case 1:
                        result = _a.sent();
                        if (!result) return [3 /*break*/, 2];
                        Common_1.log("From cache: " + url);
                        return [3 /*break*/, 5];
                    case 2:
                        Common_1.log("From web: " + url);
                        return [4 /*yield*/, Common_1.fetch(url)];
                    case 3:
                        page = _a.sent();
                        content = this.extractContent(url, page);
                        return [4 /*yield*/, this.cache.insert(url, content)];
                    case 4:
                        _a.sent();
                        result = content;
                        _a.label = 5;
                    case 5: return [2 /*return*/, result];
                }
            });
        });
    };
    FeedProcessor.prototype.process = function (inputFeed) {
        return __awaiter(this, void 0, void 0, function () {
            var serializer, parser, feed, root, outputFeed, outputRoot, channelNodes, i, channelNode, outputChannelNode, itemNodes, j, itemNode, outputItemNode, linkNode, url, content, contentNode, dataNode, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        serializer = new xmldom_1.XMLSerializer();
                        parser = new xmldom_1.DOMParser({
                            errorHandler: {
                                error: function (message) {
                                    throw new Error(message);
                                },
                                fatalError: function (message) {
                                    throw new Error(message);
                                }
                            }
                        });
                        feed = parser.parseFromString(inputFeed);
                        root = Common_1.getFirstElement(feed, "rss");
                        outputFeed = parser.parseFromString(this.rootTemplate);
                        outputRoot = Common_1.getFirstElement(outputFeed, "rss");
                        channelNodes = root.getElementsByTagName("channel");
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < channelNodes.length)) return [3 /*break*/, 10];
                        channelNode = channelNodes.item(i);
                        outputChannelNode = outputFeed.createElement("channel");
                        // Copy channel tags
                        Common_1.copyElements(channelNode, outputChannelNode, this.channelTags);
                        itemNodes = channelNode.getElementsByTagName("item");
                        j = 0;
                        _a.label = 2;
                    case 2:
                        if (!(j < itemNodes.length)) return [3 /*break*/, 8];
                        itemNode = itemNodes.item(j);
                        outputItemNode = outputFeed.createElement("item");
                        linkNode = Common_1.getFirstElement(itemNode, "link");
                        if (!linkNode) {
                            return [3 /*break*/, 7];
                        }
                        // Copy item tags
                        Common_1.copyElements(itemNode, outputItemNode, this.itemTags);
                        url = linkNode.firstChild && linkNode.firstChild.nodeValue;
                        if (!Common_1.validateUrl(url)) {
                            return [3 /*break*/, 7];
                        }
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.getContent(url)];
                    case 4:
                        content = _a.sent();
                        contentNode = outputFeed.createElement("content:encoded");
                        dataNode = outputFeed.createCDATASection(this.style + content);
                        contentNode.appendChild(dataNode);
                        outputItemNode.appendChild(contentNode);
                        return [3 /*break*/, 6];
                    case 5:
                        e_1 = _a.sent();
                        Common_1.log(e_1.message);
                        return [3 /*break*/, 6];
                    case 6:
                        outputChannelNode.appendChild(outputItemNode);
                        _a.label = 7;
                    case 7:
                        j++;
                        return [3 /*break*/, 2];
                    case 8:
                        outputRoot.appendChild(outputChannelNode);
                        _a.label = 9;
                    case 9:
                        i++;
                        return [3 /*break*/, 1];
                    case 10: return [2 /*return*/, serializer.serializeToString(outputFeed)];
                }
            });
        });
    };
    return FeedProcessor;
}());
exports.FeedProcessor = FeedProcessor;
//# sourceMappingURL=FeedProcessor.js.map