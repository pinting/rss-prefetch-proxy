require("dotenv").config();

import { createServer, IncomingMessage, ServerResponse } from "http";
import { log, fetch, validateUrl } from "./Common";
import { FeedCache } from "./FeedCache";
import { FeedProcessor } from "./FeedProcessor"

const cache = new FeedCache(process.env.DATABASE_URL, process.env.IS_LOCAL == "true");

async function clean() {
    const now = +new Date();
    const keepCache = parseInt(process.env.KEEP_CACHE) * 1000;
    const before = new Date(now - keepCache).toISOString();
    
    const count = await cache.clean(before);

    log(`Removed ${count} pages before ${before}`);
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

    const inputUrl = req.url && req.url.substr(1);
    
    if (!validateUrl(inputUrl)) {
        res.writeHead(400, responseHeaders);
        res.end();
        return;
    }
    
    log(`Incoming request for URL ${inputUrl}`);
    
    try {
        const processor = new FeedProcessor(cache, { textMode: textMode, style: style });
        const inputFeed = await fetch(inputUrl);
        const outputFeed = await processor.process(inputFeed);
    
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