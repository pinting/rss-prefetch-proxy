const { DOMParser, XMLSerializer } = require("xmldom");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const sqlite3 = require("sqlite3");
const puppeteer = require("puppeteer");
const http = require("http");
const request = require("request");

const DB_PATH = "./database.db";
const TEXT_MODE = false;

function fetchFile(url) {
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
    const db = new sqlite3.Database(DB_PATH);

    const SQL = "CREATE TABLE IF NOT EXISTS pages" + 
        "(id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, url TEXT, content TEXT)";
    
    return new Promise((resolve, reject) => {
        db.run(SQL, error => {
            if (error) {
                reject(error);
            }
            else {
                resolve(db);
            }
        });
    });
}

function databaseGetPage(db, url) {
    const SQL = "SELECT content FROM pages WHERE url = ?";

    return new Promise((resolve, reject) => {
        db.get(SQL, [url], (error, row) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(row && row.content);
            }
        });
    });
}

function databaseInsertPage(db, url, content) {
    const SQL = "INSERT INTO pages(url, content) VALUES(?, ?)";

    return new Promise((resolve, reject) => {
        db.get(SQL, [url, content], (error) => {
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
    function charFix(text) {
        return text
            .replace(/\./gi, ". ")
            .replace(/\?/gi, "? ")
            .replace(/\:/gi, ": ")
            .replace(/\!/gi, "! ")
            .replace(/\-/gi, " - ")
            .replace(/  /gi, " ");
    }

    async function fetch() {
        const page = await browser.newPage();

        await page.goto(url);
        
        return await page.content();
    }

    function extract(page) {
        var doc = new JSDOM(page, { url: url });
        let reader = new Readability(doc.window.document);
        let article = reader.parse();

        if (TEXT_MODE) {
            return charFix(article.textContent);
        }
        else {
            return article.content;
        }
    }

    const db = await databaseInit();
    const cached = await databaseGetPage(db, url);

    let result = null;

    if (!cached) {
        const page = await fetch();
        const content = extract(page);

        await databaseInsertPage(db, url, content);

        result = content;
    }
    else {
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
        const content = await getContent(browser, url);

        // Remove existing content nodes
        const contentNodes = articleNode.getElementsByTagName("content:encoded");

        for (let n = 0; n < contentNodes.length; n++) {
            const contentNode = contentNodes.item(n);

            contentNode.parentNode.removeChild(contentNode);
        }

        // Add new content node
        const contentNode = document.createElement("content:encoded");
        const dataNode = document.createCDATASection(content);

        contentNode.appendChild(dataNode);
        articleNode.appendChild(contentNode);
    }
    
    await browser.close();

    return serializer.serializeToString(document);
}

const requestListener = async function (req, res) {
    try {
        const inputUrl = req.url.substr(1);
        const inputFeed = await fetchFile(inputUrl);
        const outputFeed = await processFeed(inputFeed);
    
        res.writeHead(200);
        res.end(outputFeed);
    }
    catch(e) {
        res.writeHead(400);
        res.end(e.message);
    }
}
  
const server = http.createServer(requestListener);

server.listen(8080);