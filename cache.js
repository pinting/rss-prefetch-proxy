const { Pool } = require("pg");

class Cache {
    constructor(connectionString) {
        this.pool = new Pool({ 
            connectionString: connectionString,
            ssl: {
              rejectUnauthorized: false
            }
        });
    }

    async init() {
        const query = "CREATE TABLE IF NOT EXISTS cache (" + 
            "id SERIAL PRIMARY KEY, " + 
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " + 
            "url TEXT UNIQUE, " + 
            "body TEXT)";
        
        await this.pool.query(query);
    }

    async clean(before) {
        const client = await this.pool.connect();
        const query = "DELETE FROM cache WHERE created_at < $1";
        const isoString = new Date(before * 1000).toISOString();

        try {
            await client.query(query, [isoString]);
        }
        finally {
            client.release()
        }
    }

    async find(url) {
        const client = await this.pool.connect();
        const query = "SELECT body FROM cache WHERE url = $1";

        let result = null;

        try {
            const r = await client.query(query, [url]);

            result = r && r.rows[0] && r.rows[0].body;
        }
        finally {
            client.release()
        }

        return result;
    }

    async insert(url, body) {
        const client = await this.pool.connect();
        const query = "INSERT INTO cache(url, body) VALUES($1, $2)";
        
        try {
            await client.query(query, [url, body]);
        }
        finally {
            client.release()
        }
    }
}

module.exports = { Cache: Cache };