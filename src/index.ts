require("dotenv").config();

import { createServer, IncomingMessage, ServerResponse } from "http";
import { log, fetch, validateUrl } from "./Common";
import { FeedCache } from "./FeedCache";
import { FeedProcessor } from "./FeedProcessor"

interface Ads {
    [key: string]: string[];
};

const cache = new FeedCache(process.env.DATABASE_URL, process.env.IS_LOCAL == "true");
const ads: Ads = require('../ads.json') || {};

async function clean() {
    const now = +new Date();
    const keepCache = parseInt(process.env.KEEP_CACHE) * 1000;
    const before = new Date(now - keepCache).toISOString();
    
    const count = await cache.clean(before);

    log(`Removed ${count} pages before ${before}`);
}

function removeAds(document: Document, url: string): void {
    const key = Object.keys(ads).find(domain => url.includes(domain));

    if (ads.hasOwnProperty(key)) {
        const classNames = ads[key] || [];

        for (let className of classNames) {
            document.querySelectorAll(className).forEach(e => e.remove());
        }
    }
}

async function requestListener(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const responseHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, GET",
        "Access-Control-Max-Age": 2592000
    };

    if (req.method == "OPTIONS") {
        res.writeHead(204, responseHeaders);
        res.end();
        return;
    }

    if (req.method != "GET") {
        res.writeHead(400, responseHeaders);
        res.end();
        return;
    }

    const debug = process.env.DEBUG == "true";
    const textMode = process.env.TEXT_MODE == "true";
    const style = process.env.STYLE;

    const input = req.url && req.url.substr(1);

    let feedUrl = input;
    let minCharCount = 0;

    const parts = input.split(",");

    if (parts.length >= 2) {
        const parsedNumber = parseInt(parts[0]);

        if (!Number.isNaN(parsedNumber)) {
            feedUrl = parts[1];
            minCharCount = parsedNumber;
        }
    }
    
    if (!validateUrl(feedUrl)) {
        res.writeHead(400, responseHeaders);
        res.end();
        return;
    }
    
    log(`Incoming request for URL ${feedUrl}`);
    
    try {
        const processor = new FeedProcessor(cache, {
            textMode: textMode,
            style: style,
            applyTweaks: removeAds
        });

        const inputFeed = await fetch(feedUrl);
        const outputFeed = await processor.process(inputFeed, minCharCount);
    
        res.writeHead(200, responseHeaders);
        res.end(outputFeed);
    }
    catch(e) {
        log(e.message);
        res.writeHead(503, responseHeaders);
        res.end(debug ? e.message : undefined);
    }

    clean();
}

async function main(): Promise<void> {
    await cache.init();

    const server = createServer(requestListener);
    
    server.listen(parseInt(process.env.PORT));

    log(`Application is listening on port ${process.env.PORT}`);
}

main();