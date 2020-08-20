const fs = require ('fs');
const util = require('util');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

// TODO Ultimate goal would be for this code to be able to name the metrics that are being grabbed screen shotting URLs
// TODO Could also lift corresponding test-infra commits
// TODO Parameterise this script on Prow Job name instead of hardcoding it in these URLs
var metrics = {
     "prow-status":"https://prow.k8s.io/?job=pull-kubernetes-e2e-gce-network-proxy-http-connect" ,
     "duration":"https://testgrid.k8s.io/presubmits-kubernetes-blocking#pull-kubernetes-e2e-gce-network-proxy-http-connect&graph-metrics=test-duration-minutes",
     "aggregated-errors":"https://storage.googleapis.com/k8s-gubernator/triage/index.html?pr=1&job=pull-kubernetes-e2e-gce-network-proxy-http-connect",
     "result-history":"https://prow.k8s.io/job-history/gs/kubernetes-jenkins/pr-logs/directory/pull-kubernetes-e2e-gce-network-proxy-http-connect",
     "build-cluster":"https://monitoring.prow.k8s.io/d/wSrfvNxWz/boskos-resource-usage?orgId=1",
};

function slugify(str) {
    return str.replace(/[\/:]/g, '_');
}
// For now we just add the URLS with hardcoded job names
const urls = [
    'https://prow.k8s.io/?job=pull-kubernetes-e2e-gce-network-proxy-http-connect' ,
    'https://testgrid.k8s.io/presubmits-kubernetes-blocking#pull-kubernetes-e2e-gce-network-proxy-http-connect&graph-metrics=test-duration-minutes',
    'https://storage.googleapis.com/k8s-gubernator/triage/index.html?pr=1&job=pull-kubernetes-e2e-gce-network-proxy-http-connect',
    'https://prow.k8s.io/job-history/gs/kubernetes-jenkins/pr-logs/directory/pull-kubernetes-e2e-gce-network-proxy-http-connect',
    'https://monitoring.prow.k8s.io/d/wSrfvNxWz/boskos-resource-usage?orgId=1',
//    'https://monitoring.prow.k8s.io/d/wSrfvNxWz/boskos-resource-usage?orgId=1&from=now-7d&to=nowys&kiosk',
];

const TIMEOUT_AFTER_LOAD = 3000 ;

async function launch() { //position, screen) {

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

    const screen = await page.evaluate(() => {
        return {width: window.screen.availWidth, height: window.screen.availHeight};
    });
    await browser.close();
    const pages = await Promise.all(urls.map((url, i) => launch()));

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
        const path = `./screenshots/${slugify(Date.now() + await page.title())}.png`;
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
