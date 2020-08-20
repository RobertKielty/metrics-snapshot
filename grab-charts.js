const fs = require ('fs');
const util = require('util');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const yargs = require('yargs');
var argv = yargs
    .usage('grabs screen shots of metrics that of a specified Prow Job\n\nUsage: $0 [options]')
    .help('help').alias('help', 'h')
    .version('version', '0.0.1').alias('version', 'V')
    .options({
        job: {
            alias: 'j',
            description: "<name> Prow Job name",
            requiresArg: true,
            required: true
        },
        output: {
            alias: 'o',
            default: './screenshots',
            description: "<dirname> output directory name",
            requiresArg: true,
            required: false
        }
    })
    .argv;

function slugify(str) {
    return str.replace(/[\/: ]/g, '_');
}

function humanReadableDate(date) {
    const dateTimeFormat = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' });
    const [{ value: month },,{ value: day },,{ value: year }] = dateTimeFormat .formatToParts(date );

    return `${day}-${month}-${year }`;
}
function getJobUrls(job) {
    return urls = [
        `https://prow.k8s.io/?job=${job}` ,
        `https://testgrid.k8s.io/presubmits-kubernetes-blocking#${job}&graph-metrics=test-duration-minutes`,
        `https://storage.googleapis.com/k8s-gubernator/triage/index.html?pr=1&${job}`,
        `https://prow.k8s.io/job-history/gs/kubernetes-jenkins/pr-logs/directory/${job}`,
        `https://monitoring.prow.k8s.io/d/wSrfvNxWz/boskos-resource-usage?orgId=1`,
    ];
    return urls;
}

const TIMEOUT_AFTER_LOAD = 3000 ;

async function launch() { 

   const browser = await puppeteer.launch({
       headless: false,
       args: [
           '--start-maximized',
       ],
       defaultViewport: null,
   });

  const page = await browser.newPage();

  return page;
}

const sleep = (timeout) => new Promise(r => setTimeout(r, timeout));

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const urls = getJobUrls(argv.job);

    const screen = await page.evaluate(() => {
        return {width: window.screen.availWidth, height: window.screen.availHeight};
    });
    await browser.close();
    const pages = await Promise.all(urls.map((url, i) => launch()));

    if (!fs.existsSync('./screenshots/'+argv.job)){
        fs.mkdirSync('./screenshots/'+argv.job);
    }

    const start = Date.now();

    const waitForPage = async pos => {
        const page = pages[pos];
        await page._client.send('Emulation.clearDeviceMetricsOverride');
        const url = urls[pos];
        return page.goto(url, {waitUntil: 'networkidle2'})
            .then(() => Date.now());
    };

    const waitForScreenShot = async pos => {
        const page = pages[pos];
        await page._client.send('Emulation.clearDeviceMetricsOverride');
        const url = urls[pos];
        const path = `./screenshots/${argv.job}/${slugify(humanReadableDate(Date.now()) + await page.title())}.png`;
        let imgBuff = await page.screenshot({fullPage: true});
        imgBuff = await sharp(imgBuff).toBuffer();
        page.img = `data:img/png;base64,${imgBuff.toString('base64')}`;
        util.promisify(fs.writeFile)(path, imgBuff); // async
};

    const stopTimes = await Promise.all(urls.map((url, i) => waitForPage(i)));
    stopTimes.forEach((stopTime, i) => console.log(`Page ${i + 1} took ${stopTime - start} ms to reach network idle`));

    const screenShots = await Promise.all(urls.map((url, i) => waitForScreenShot(i)));

    await sleep(TIMEOUT_AFTER_LOAD);
    await Promise.all(pages.map(page => page.browser().close()));

})();
