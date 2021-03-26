require("dotenv").config();

import { createServer, IncomingMessage, ServerResponse } from "http";
import { log, fetch, validateUrl } from "./Common";
import { FeedCache } from "./FeedCache";
import { FeedProcessor } from "./FeedProcessor"

const tweaks = require('../tweaks.json') || {};
const cache = new FeedCache(process.env.DATABASE_URL, process.env.IS_LOCAL == "true");

async function clean() {
    const now = +new Date();
    const keepCache = parseInt(process.env.KEEP_CACHE) * 1000;
    const before = new Date(now - keepCache).toISOString();
    const count = await cache.clean(before);

    log(`Removed ${count} pages before ${before}`);
}

async function requestListener(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const debug = process.env.DEBUG == "true";
    const textMode = process.env.TEXT_MODE == "true";
    const style = process.env.STYLE;

    const inputUrl = req.url && req.url.substr(1);
    
    if (validateUrl(inputUrl)) {
        try {
            const processor = new FeedProcessor(cache, textMode, style, tweaks);
    
            log(`Incoming request for URL ${inputUrl}`);
    
            const inputFeed = await fetch(inputUrl);
            const outputFeed = await processor.process(inputFeed);
        
            res.writeHead(200);
            res.end(outputFeed);
        }
        catch(e) {
            log(e.message);
            res.writeHead(503);
            res.end(debug ? e.message : "");
        }
    
        clean();
    }
    else {
        res.writeHead(400);
        res.end("");
    }
}

async function main(): Promise<void> {
    await cache.init();

    const server = createServer(requestListener);
    
    server.listen(parseInt(process.env.PORT));

    log(`Application is listening on port ${process.env.PORT}`);
}

main();