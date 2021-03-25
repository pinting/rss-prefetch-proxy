const { DOMParser, XMLSerializer } = require("xmldom");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const puppeteer = require("puppeteer");
const http = require("http");
const dotenv = require("dotenv");
const request = require("request");

dotenv.config();

const { Cache } = require("./cache");

const cache = new Cache(process.env.DATABASE_URL);

function log(message) {
    if (process.env.DEBUG == "true") {
        console.log(message);
    }
}

function fetch(url) {
    return new Promise((resolve, reject) => {
        request({ uri: url }, (error, response, body) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(body);
            }
        });
    });
}

async function getContent(page, url) {
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

    async function browserFetch(url) {
        await page.goto(url);
        
        return await page.content();
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

        const page = await browserFetch(url);
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
    const titleNodes = document.getElementsByTagName("title");
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();

    let successCount = 0;
    
    for (let i = 0; i < titleNodes.length; i++) {
        const titleNode = titleNodes.item(i);
        const articleNode = titleNode.parentNode;
        const linkNodes = articleNode.getElementsByTagName("link");
        
        // Check if the right node is selected
        if (linkNodes.length != 1) {
            continue;
        }
    
        // Extract URL and fetch content
        const linkNode = linkNodes.item(0);
        const url = linkNode.firstChild.nodeValue;

        try {
            const content = await getContent(page, url);
    
            // Remove existing content nodes
            const contentNodes = articleNode.getElementsByTagName("content:encoded");
    
            for (let n = 0; n < contentNodes.length; n++) {
                const contentNode = contentNodes.item(n);
    
                contentNode.parentNode.removeChild(contentNode);
            }
    
            // Add new content node
            const contentNode = document.createElement("content:encoded");
            const dataNode = document.createCDATASection(process.env.STYLE + content);
    
            contentNode.appendChild(dataNode);
            articleNode.appendChild(contentNode);

            successCount++;
        } catch(e) {
            log(e.message);
        }
    }
    
    await browser.close();

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
    const now = Math.floor(+new Date() / 1000);
    const cleanBefore = now - parseInt(process.env.KEEP_CACHE);

    await cache.clean(cleanBefore);

    log(`Cleaning pages before ${cleanBefore} complete`);
}

async function main() {
    await cache.init();

    const server = http.createServer(requestListener);
    
    server.listen(parseInt(process.env.PORT));
    setInterval(() => cleanUp(), parseInt(process.env.CLEAN_CACHE_INTERVAL) * 1000);
    log(`Application is listening on port ${process.env.PORT}`);
}

main();