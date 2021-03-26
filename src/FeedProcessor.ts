import {DOMParser, XMLSerializer} from "xmldom";
import {Readability} from "@mozilla/readability";
import {JSDOM} from "jsdom";
import {log, fetch, processText} from "./Common";
import {FeedCache} from "./FeedCache";

export class FeedProcessor {
    private cache: FeedCache;
    private textMode: boolean;
    private style: string;
    private tweaks;

    constructor(cache: FeedCache, textMode: boolean = false, style: string = "", tweaks) {
        this.cache = cache;
        this.textMode = textMode;
        this.style = style;
        this.tweaks = tweaks;
    }


    private matchDomain(url: string) {
        const keys = Object.keys(this.tweaks);
        const values = Object.values(this.tweaks);

        for (let i = 0; i < keys.length; i++) {
            let regex = new RegExp(`^(?:https?:\/\/)?(?:[^\.]+\.)?${keys[i]}(\/.*)?$`);

            if (regex.test(url)) {
                return values[i];
            }
        }

        return {};
    }

    private removeSleim(dom: JSDOM, url: string): Document {
        let document = dom.window.document;

        let tweak = this.matchDomain(url);

        if (tweak.hasOwnProperty('classes')) {

            let classes = tweak['classes'];

            for (let i = 0; i < classes.length; i++) {
                document.querySelectorAll("." + classes[i]).forEach(function (a) {
                    a.remove()
                })
            }
        }

        return document;
    }

    private extractContent(url: string, htmlString: string): string {
        const dom = new JSDOM(htmlString, {url: url});
        const doc = this.removeSleim(dom, url);
        const reader = new Readability(doc);
        const article = reader.parse();

        if (this.textMode) {
            return processText(article.textContent);
        } else {
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
        } else {
            log(`From cache: ${url}`);

            result = cached;
        }

        return result;
    }

    public async process(xmlString: string): Promise<string> {
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
            } catch (e) {
                log(e.message);
            }
        }

        if (!successCount) {
            throw new Error("Zero success count");
        }

        return serializer.serializeToString(document);
    }
}