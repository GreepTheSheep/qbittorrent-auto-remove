require("dotenv").config();
const cron = require("node-cron"),
    fetch = require("node-fetch"),
    log4js = require("log4js"),
    defaultCron = "0 0 * * *"

log4js.configure({
    appenders: { console: {type: "stdout"} },
    categories: { default: {appenders: ["console"], level: log4js.levels.ALL} }
});

const logger = log4js.getLogger("Init");

let cronTime = process.env.EXEC_CRON,
    envTimezone = process.env.TZ;

setTimeout(init, 100);

function init() {
    logger.info("qBitAutoRemove started on " + new Date().toDateString() + " at " + new Date().toTimeString());

    // Check Cron expression
    if (!cron.validate(cronTime)) {
        logger.warn("EXEC_CRON variable is not valid, using " + defaultCron);
        cronTime = defaultCron;
    } else {
        logger.info("EXEC_CRON variable is valid: " + cronTime);
    }

    // Check Timezone
    if (envTimezone == null) {
        envTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        logger.info("CRON_TIMEZONE variable is not set, using " + envTimezone);
    } else {
        let listAllTimezones = Intl.supportedValuesOf('timeZone');

        if (!listAllTimezones.includes(envTimezone)) {
            envTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            logger.warn("CRON_TIMEZONE variable is not valid, using " + envTimezone);
        } else {
            logger.info("CRON_TIMEZONE variable is valid: " + envTimezone);
        }
    }

    // Test connection
    let host = process.env.QBIT_HOST,
        port = process.env.QBIT_PORT,
        user = process.env.QBIT_USER,
        pass = process.env.QBIT_PASS;

    if (user == null) {
        logger.fatal("QBIT_USER variable is not set, exiting");
        process.exit(10);
    }
    if (pass == null) {
        logger.fatal("QBIT_PASS variable is not set, exiting");
        process.exit(11);
    }
    if (host == null) {
        logger.fatal("QBIT_HOST variable is not set, exiting");
        process.exit(12);
    }
    if (port == null) {
        port = 8080;
        logger.warn("QBIT_PORT variable is not set, using "+port+" as default port");
    }

    let url = `http://${host}:${port}/api/v2/auth/login`,
    params = new URLSearchParams();

    params.set("username", user);
    params.set("password", pass);
    logger.info("connecting to " + url);
    fetch(url, {
        method: "POST",
        headers: {
            "Referer": `http://${host}:${port}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
    }).then(res=>{
        if (!res.ok) {
            logger.fatal(`Couldn't connect to qBittorrent: ${res.status} ${res.statusText}`);
            process.exit(20);
        } else {
            logger.info(`qBittorrent: ${res.status} ${res.statusText}`);
            // Schedule task
            // require("./task")();
            let fnTask = require("./task");
            cron.schedule(cronTime, fnTask, {
                timezone: envTimezone
            });
            logger.info("Scheduler started");
        }
    })
}