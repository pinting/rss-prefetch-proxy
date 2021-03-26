import { DOMParser, XMLSerializer } from "xmldom";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { log, fetch, processText } from "./Common";
import { FeedCache } from "./FeedCache";

export class FeedProcessor {
    private cache: FeedCache;
    private textMode: boolean;
    private style: string;

    constructor(cache: FeedCache, textMode: boolean = false, style: string = "") {
        this.cache = cache;
        this.textMode = textMode;
        this.style = style;
    }

    private extractContent(url: string, htmlString: string): string {
        const dom = new JSDOM(htmlString, { url: url });
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
        const cached = await this.cache.find(url);

        let result = null;

        if (!cached) {
            log(`From web: ${url}`);

            const page = await fetch(url);
            const content = this.extractContent(url, page);

            await this.cache.insert(url, content);

            result = content;
        }
        else {
            log(`From cache: ${url}`);

            result = cached;
        }

        return result;
    }

    public async process(xmlString: string): Promise<string> {
        const serializer = new XMLSerializer();
        const parser = new DOMParser({ errorHandler: {
            error: (message: string) => { throw new Error(message) },
            fatalError: (message: string) => { throw new Error(message) }
        }});

        const document = parser.parseFromString(xmlString);
        const itemNodes = document.getElementsByTagName("item");

        let successCount = 0;
        
        for (let i = 0; i < itemNodes.length; i++) {
            const itemNode = itemNodes.item(i);
            const linkNodes = itemNode.getElementsByTagName("link");
            const titleNodes = itemNode.getElementsByTagName("title");
            
            // Check if the right node is selected
            if (linkNodes.length != 1 || titleNodes.length != 1) {
                continue;
            }
        
            // Extract URL and fetch content
            const linkNode = linkNodes.item(0);
            const url = linkNode.firstChild.nodeValue;

            try {
                const content = await this.getContent(url);
        
                // Remove existing content nodes
                const contentNodes = itemNode.getElementsByTagName("content:encoded");
        
                for (let n = 0; n < contentNodes.length; n++) {
                    const contentNode = contentNodes.item(n);
        
                    contentNode.parentNode.removeChild(contentNode);
                }
        
                // Add new content node
                const contentNode = document.createElement("content:encoded");
                const dataNode = document.createCDATASection(this.style + content);
        
                contentNode.appendChild(dataNode);
                itemNode.appendChild(contentNode);

                successCount++;
            }
            catch (e) {
                log(e.message);
            }
        }

        if (!successCount) {
            throw new Error("Zero success count");
        }

        return serializer.serializeToString(document);
    }
}