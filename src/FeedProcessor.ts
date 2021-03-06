import { DOMParser, XMLSerializer } from "xmldom";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { log, fetch, processText, validateUrl, noop, getFirstElement, copyElements } from "./Common";
import { FeedCache } from "./FeedCache";

export const DEFAULT_ROOT_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" ` +
    `xmlns:sy="http://purl.org/rss/1.0/modules/syndication/" ` +
    `xmlns:atom="http://www.w3.org/2005/Atom" ` +
    `version="2.0" />`;

export const DEFAULT_CHANNEL_TAGS = [
    "title",
    "link",
    "description",
    "copyright"
];

export const DEFAULT_ITEM_TAGS = [
    "title",
    "link",
    "pubDate",
    "guid",
    "description"
];

export interface FeedProcessorOptions {
    rootTemplate?: string;
    channelTags?: string[];
    itemTags?: string[];
    textMode?: boolean;
    style?: string;
    applyTweaks?: (document: Document, url: string) => void;
}

export class FeedProcessor {
    private cache: FeedCache;

    private rootTemplate: string;
    private channelTags: string[];
    private itemTags: string[];

    private applyTweaks: (document: Document, url: string) => void;
    private textMode: boolean;
    private style: string;

    constructor(cache: FeedCache, options: FeedProcessorOptions = {}) {
        this.cache = cache;

        this.rootTemplate = options.rootTemplate || DEFAULT_ROOT_TEMPLATE;
        this.channelTags = options.channelTags || DEFAULT_CHANNEL_TAGS;
        this.itemTags = options.itemTags || DEFAULT_ITEM_TAGS;

        this.textMode = options.textMode || false;
        this.style = options.style || "";
        this.applyTweaks = options.applyTweaks || noop;
    }

    private extractContent(url: string, html: string): { body: string, count: number } {
        const dom = new JSDOM(html, { url: url });
        const document = dom.window.document;

        this.applyTweaks(document, url);

        const reader = new Readability(document);
        const article = reader.parse();
        const text = article.textContent;
        const count = text.length;

        if (this.textMode) {
            const processedText = processText(text);
            
            return { body: processedText, count: count };
        }
        else {
            return { body: article.content, count: count };
        }
    }

    private async getContent(url: string): Promise<{ body: string, count: number }> {
        let result = await this.cache.find(url);

        if (result.count) {
            log(`From cache: ${url}`);
        }
        else {
            log(`From web: ${url}`);

            const page = await fetch(url);
            const content = this.extractContent(url, page);

            await this.cache.insert(url, content.count, content.body);

            result = content;
        }

        return result;
    }

    public async process(inputFeed: string, minCharCount: number = 0): Promise<string> {
        const serializer = new XMLSerializer();
        const parser = new DOMParser({
            errorHandler: {
                error: (message: string) => {
                    throw new Error(message)
                },
                fatalError: (message: string) => {
                    throw new Error(message)
                }
            }
        });

        const feed = parser.parseFromString(inputFeed);
        const root = getFirstElement(feed, "rss");

        const outputFeed = parser.parseFromString(this.rootTemplate);
        const outputRoot = getFirstElement(outputFeed, "rss");

        // Iterate over channels
        const channelNodes = root.getElementsByTagName("channel");

        for (let i = 0; i < channelNodes.length; i++) {
            const channelNode = channelNodes.item(i);
            const outputChannelNode = outputFeed.createElement("channel");

            // Copy channel tags
            copyElements(channelNode, outputChannelNode, this.channelTags);

            // Iterate over items
            const itemNodes = channelNode.getElementsByTagName("item");

            for (let j = 0; j < itemNodes.length; j++) {
                const itemNode = itemNodes.item(j);
                const outputItemNode = outputFeed.createElement("item");

                const linkNode = getFirstElement(itemNode, "link");

                if (!linkNode) {
                    continue;
                }

                // Copy item tags
                copyElements(itemNode, outputItemNode, this.itemTags);

                // Extract URL and fetch content
                const url = linkNode.firstChild && linkNode.firstChild.nodeValue;

                if (!validateUrl(url)) {
                    continue;
                }

                try {
                    const content = await this.getContent(url);

                    if (content.count < minCharCount) {
                        continue;
                    }

                    // Add new content node to item
                    const contentNode = outputFeed.createElement("content:encoded");
                    const dataNode = outputFeed.createCDATASection(this.style + content.body);

                    contentNode.appendChild(dataNode);
                    outputItemNode.appendChild(contentNode);
                }
                catch (e) {
                    log(e.message);
                }
                outputChannelNode.appendChild(outputItemNode);
            }

            outputRoot.appendChild(outputChannelNode);
        }

        return serializer.serializeToString(outputFeed);
    }
}