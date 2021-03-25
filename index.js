const { DOMParser, XMLSerializer } = require("xmldom");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const sqlite3 = require("sqlite3");
const puppeteer = require("puppeteer");
const http = require("http");
const dotenv = require("dotenv");
const request = require("request");

dotenv.config();

const config = require("./config.json");

function log(message) {
    if (config.DEBUG) {
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
};

function databaseInit() {
    const db = new sqlite3.Database(config.DB_PATH);
    const query = "CREATE TABLE IF NOT EXISTS pages (" + 
        "id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " + 
        "created_at INTEGER DEFAULT CURRENT_TIMESTAMP, " + 
        "url TEXT UNIQUE, " + 
        "body TEXT)";
    
    return new Promise((resolve, reject) => {
        db.run(query, error => {
            if (error) {
                reject(error);
            }
            else {
                resolve(db);
            }
        });
    });
}

function databaseDeletePages(db, before) {
    const query = "DELETE FROM pages WHERE created_at < ?";
    const isoString = new Date(before * 1000).toISOString();

    return new Promise((resolve, reject) => {
        db.get(query, [isoString], (error) => {
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    });
}

function databaseGetPage(db, url) {
    const query = "SELECT body FROM pages WHERE url = ?";

    return new Promise((resolve, reject) => {
        db.get(query, [url], (error, row) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(row && row.body);
            }
        });
    });
}

function databaseInsertPage(db, url, body) {
    const query = "INSERT INTO pages(url, body) VALUES(?, ?)";

    return new Promise((resolve, reject) => {
        db.get(query, [url, body], (error) => {
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    });
}

function databaseClose(db) {
    return new Promise(resolve => {
        db.close(() => resolve());
    });
}

async function getContent(browser, url) {
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
        const page = await browser.newPage();

        await page.goto(url);
        
        return await page.content();
    }

    function extract(page) {
        var doc = new JSDOM(page, { url: url });
        let reader = new Readability(doc.window.document);
        let article = reader.parse();

        if (config.TEXT_MODE) {
            return processText(article.textContent);
        }
        else {
            return article.content;
        }
    }

    const db = await databaseInit();
    const cached = await databaseGetPage(db, url);

    let result = null;

    if (!cached) {
        log(`From web: ${url}`);

        const page = await browserFetch(url);
        const content = extract(page);

        await databaseInsertPage(db, url, content);

        result = content;
    }
    else {
        log(`From cache: ${url}`);

        result = cached;
    }
    
    await databaseClose(db);

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
    const browser = await puppeteer.launch();

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
            const content = await getContent(browser, url);
    
            // Remove existing content nodes
            const contentNodes = articleNode.getElementsByTagName("content:encoded");
    
            for (let n = 0; n < contentNodes.length; n++) {
                const contentNode = contentNodes.item(n);
    
                contentNode.parentNode.removeChild(contentNode);
            }
    
            // Add new content node
            const contentNode = document.createElement("content:encoded");
            const dataNode = document.createCDATASection(config.STYLE + content);
    
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
        res.end(config.DEBUG ? e.message : "");
    }
}

async function cleanUp() {
    const now = Math.floor(+new Date() / 1000);
    const cleanBefore = now - config.KEEP_CACHE;

    const db = await databaseInit();

    await databaseDeletePages(db, cleanBefore);
    await databaseClose(db);

    log(`Cleaning pages before ${cleanBefore} complete`);
}

async function main() {
    const server = http.createServer(requestListener);
    
    server.listen(config.PORT);

    setInterval(() => cleanUp(), parseFloat(config.CLEAN_CACHE_INTERVAL) * 1000);
    
    log(`Application is listening on port ${config.PORT}`);
}

main();