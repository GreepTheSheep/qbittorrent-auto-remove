const fetch = require('node-fetch'),
    log4js = require("log4js");

log4js.configure({
    appenders: { console: {type: "stdout"} },
    categories: { default: {appenders: ["console"], level: log4js.levels.ALL} }
});

const logger = log4js.getLogger("Main");

let delayDays = process.env.TASK_DELAY_DAYS || 30,
    userMinRatio = process.env.TASK_RATIO || 0.2,
    userDeleteFiles = Boolean(process.env.TASK_DELETE_FILES) || true,
    host = process.env.QBIT_HOST,
    port = process.env.QBIT_PORT,
    user = process.env.QBIT_USER,
    pass = process.env.QBIT_PASS;

module.exports = async function() {
    let baseUrl = `http://${host}:${port}`,
        url = baseUrl+"/api/v2"
        params = new URLSearchParams(),
        res = null;

    params.set("username", user);
    params.set("password", pass);
    // Login
    try {
        res = await fetch(url+"/auth/login", {
            method: "POST",
            headers: {
                "Referer": baseUrl,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params.toString()
        });

        if (!res.ok) {
            logger.fatal(`Couldn't connect to qBittorrent: ${res.status} ${res.statusText}`);
            process.exit(20);
        }
    } catch (err) {
        logger.fatal(`Couldn't connect to qBittorrent: ${err.code} ${err.message}`);
        process.exit(21);
    }

    let sessionCookie = parseCookie(res);

    // List
    try {
        res = await fetch(url+"/torrents/info?sort=ratio", {
            headers: {
                "Referer": baseUrl,
                "Cookie": encodeURI(sessionCookie)
            },
        });

        if (!res.ok) {
            logger.error(`Failed to fetch torrent list: ${res.status} ${res.statusText}`);
            return;
        }
    } catch (err) {
        logger.error(`Failed to fetch torrent list: ${err.code} ${err.message}`);
        return;
    }

    let json = await res.json(),
        torrentsToDelete = [];

    logger.info(json.length, "torrent(s) listed");

    for (let i = 0; i < json.length; i++) {
        if (json[i].state == "stalledUP") {
            let date = new Date(json[i].added_on * 1000),
                now = new Date(),
                dateDiff = now.getTime() - date.getTime();
            if (dateDiff >= delayDays*24*60*60*1000) {
                // torrent is older
                if (json[i].ratio < userMinRatio) {
                    // torrent does not have the right ratio
                    torrentsToDelete.push(json[i].hash);
                    logger.info(json[i].name, "added to delete");
                }
            }
        }
    }

    logger.info(torrentsToDelete.length, "torrents added to delete");

    if (torrentsToDelete.length > 0) {
        let deleteQueryParams = new URLSearchParams();
        deleteQueryParams.set("hashes", torrentsToDelete.join("|"));
        deleteQueryParams.set("deleteFiles", String(userDeleteFiles));

        try {
            res = await fetch(url+"/torrents/delete?"+deleteQueryParams.toString(), {
                method: "POST",
                headers: {
                    "Referer": baseUrl,
                    "Cookie": encodeURI(sessionCookie)
                },
            });

            if (!res.ok) {
                logger.error(`Failed to delete torrents: ${res.status} ${res.statusText}`);
                return;
            }
        } catch (err) {
            logger.error(`Failed to delete torrents: ${err.code} ${err.message}`);
            return;
        }
    }
};

function parseCookie(response) {
    const raw = response.headers.raw()['set-cookie'];
    return raw.map((entry) => {
        const parts = entry.split(';');
        const cookiePart = parts[0];
        return cookiePart;
    }).join(';');
}