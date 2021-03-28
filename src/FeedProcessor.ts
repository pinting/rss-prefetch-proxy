import { DOMParser, XMLSerializer } from "xmldom";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { log, fetch, processText, validateUrl } from "./Common";
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
}

export class FeedProcessor {
    private cache: FeedCache;

    private rootTemplate: string;
    private channelTags: string[];
    private itemTags: string[];

    private textMode: boolean;
    private style: string;

    constructor(cache: FeedCache, options: FeedProcessorOptions = {}) {
        this.cache = cache;

        this.rootTemplate = options.rootTemplate || DEFAULT_ROOT_TEMPLATE;
        this.channelTags = options.channelTags || DEFAULT_CHANNEL_TAGS;
        this.itemTags = options.itemTags || DEFAULT_ITEM_TAGS;

        this.textMode = options.textMode || false;
        this.style = options.style || "";
    }

    private extractContent(url: string, html: string): string {
        const dom = new JSDOM(html, { url: url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (this.textMode) {
            return processText(article.textContent);
        }
        else {
            return article.content;
        }
    }

    private async getContent(url: string): Promise<string> {
        let result = await this.cache.find(url);

        if (result) {
            log(`From cache: ${url}`);
        }
        else {
            log(`From web: ${url}`);

            const page = await fetch(url);
            const content = this.extractContent(url, page);

            await this.cache.insert(url, content);

            result = content;
        }

        return result;
    }

    private getFirstElement(parent: Element | Document, tagName: string) {
        const nodes = parent.getElementsByTagName(tagName);

        if (nodes.length) {
            return nodes.item(0);
        }

        return null;
    }

    private copyElements(fromParent: Element, toParent: Element, tagNames: string[]) {
        for (let tagName of tagNames) {
            const element = this.getFirstElement(fromParent, tagName);

            if (element) {
                toParent.appendChild(element);
            }
        }
    }

    public async process(inputFeed: string): Promise<string> {
        const serializer = new XMLSerializer();
        const parser = new DOMParser({ errorHandler: {
            error: (message: string) => { throw new Error(message) },
            fatalError: (message: string) => { throw new Error(message) }
        }});

        const feed = parser.parseFromString(inputFeed);
        const root = this.getFirstElement(feed, "rss");

        const outputFeed = parser.parseFromString(this.rootTemplate);
        const outputRoot = this.getFirstElement(outputFeed, "rss");
        
        // Iterate over channels
        const channelNodes = root.getElementsByTagName("channel");

        for (let i = 0; i < channelNodes.length; i++) {
            const channelNode = channelNodes.item(i);
            const outputChannelNode = outputFeed.createElement("channel");
            
            // Copy channel tags
            this.copyElements(channelNode, outputChannelNode, this.channelTags);
            
            // Iterate over items
            const itemNodes = channelNode.getElementsByTagName("item");
            
            for (let j = 0; j < itemNodes.length; j++) {
                const itemNode = itemNodes.item(j);
                const outputItemNode = outputFeed.createElement("item");
                
                const linkNode = this.getFirstElement(itemNode, "link");

                if (!linkNode) {
                    continue;
                }

                // Copy item tags
                this.copyElements(itemNode, outputItemNode, this.itemTags);
            
                // Extract URL and fetch content
                const url = linkNode.firstChild && linkNode.firstChild.nodeValue;

                if (!validateUrl(url)) {
                    continue;
                }

                try {
                    const content = await this.getContent(url);
            
                    // Add new content node to item
                    const contentNode = outputFeed.createElement("content:encoded");
                    const dataNode = outputFeed.createCDATASection(this.style + content);
            
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