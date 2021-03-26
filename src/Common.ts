import request from "request";

export function fetch(url: string): Promise<string> {
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

export function log(message: string): void {
    if (process.env.DEBUG == "true") {
        console.log(message);
    }
}

export function processText(text: string): string {
    return text
        .replace(/\n/gi, "<br />")
        .replace(/\./gi, ". ")
        .replace(/\?/gi, "? ")
        .replace(/\:/gi, ": ")
        .replace(/\!/gi, "! ")
        .replace(/\-/gi, " - ")
        .replace(/  /gi, " ");
}

export function validateUrl(url: string): boolean {
    return /^(ftp|http|https):\/\/[^ "]+$/.test(url);
}