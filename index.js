const { DOMParser, XMLSerializer } = require("xmldom");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const http = require("http");
const dotenv = require("dotenv");
const request = require("request");

dotenv.config();

const { Cache } = require("./cache");

const cache = new Cache(process.env.DATABASE_URL, process.env.IS_LOCAL == "true");

function log(message) {
    if (process.env.DEBUG == "true") {
        console.log(message);
    }
}

function fetch(url) {
    const headers = JSON.parse(process.env.HEADERS);
    const options = {
        url: url,
        headers: headers
    };

    return new Promise((resolve, reject) => {
        request(options, (error, response, body) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(body);
            }
        });
    });
}

async function getContent(url) {
    function processText(text) {
        return text
            .replace(/\n/gi, "<br />")
            .replace(/\./gi, ". ")
            .replace(/\?/gi, "? ")
            .replace(/\:/gi, ": ")
            .replace(/\!/gi, "! ")
            .replace(/\-/gi, " - ")
            .replace(/  /gi, " ");
    }

    function extract(htmlString) {
        var dom = new JSDOM(htmlString, { url: url });
        let reader = new Readability(dom.window.document);
        let article = reader.parse();

        if (process.env.TEXT_MODE == "true") {
            return processText(article.textContent);
        }
        else {
            return article.content;
        }
    }

    const cached = await cache.find(url);

    let result = null;

    if (!cached) {
        log(`From web: ${url}`);

        const page = await fetch(url);
        const content = extract(page);

        await cache.insert(url, content);

        result = content;
    }
    else {
        log(`From cache: ${url}`);

        result = cached;
    }

    return result;
}

async function processFeed(xmlString) {
    const serializer = new XMLSerializer();
    const parser = new DOMParser({ errorHandler: {
        error: (message) => { throw new Error(message) },
        fatalError: (message) => { throw new Error(message) }
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
            const content = await getContent(url);
    
            // Remove existing content nodes
            const contentNodes = itemNode.getElementsByTagName("content:encoded");
    
            for (let n = 0; n < contentNodes.length; n++) {
                const contentNode = contentNodes.item(n);
    
                contentNode.parentNode.removeChild(contentNode);
            }
    
            // Add new content node
            const contentNode = document.createElement("content:encoded");
            const dataNode = document.createCDATASection(process.env.STYLE + content);
    
            contentNode.appendChild(dataNode);
            itemNode.appendChild(contentNode);

            successCount++;
        } catch(e) {
            log(e.message);
        }
    }

    if (!successCount) {
        throw new Error("Zero success count");
    }

    return serializer.serializeToString(document);
}

async function requestListener(req, res) {
    try {
        const inputUrl = req.url.substr(1);

        log(`Incoming request for URL ${inputUrl}`);

        const inputFeed = await fetch(inputUrl);
        const outputFeed = await processFeed(inputFeed);
    
        res.writeHead(200);
        res.end(outputFeed);
    }
    catch(e) {
        log(e.message);
        res.writeHead(503);
        res.end(process.env.DEBUG == "true" ? e.message : "");
    }
}

async function cleanUp() {
    const now = +new Date();
    const keepCache = parseInt(process.env.KEEP_CACHE) * 1000;
    const before = new Date(now - keepCache).toISOString();
    const count = await cache.clean(before);

    log(`Removed ${count} pages before ${before}`);
}

async function main() {
    await cache.init();

    const server = http.createServer(requestListener);
    
    server.listen(parseInt(process.env.PORT));

    cleanUp();
    setInterval(() => cleanUp(), parseInt(process.env.CLEAN_CACHE_INTERVAL) * 1000);

    log(`Application is listening on port ${process.env.PORT}`);
}

main();