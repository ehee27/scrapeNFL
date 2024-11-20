// We initialize puppeteer 'browser' (note AWS config VS Local), connect to 'page' and 'evaluate' the DOM. We're targeting data and packaging that into an object. We'll call our scrape() func in the AWS Lambda Handler with our target URL.
// Handler awaits the data, then builda a 'params' object with data as Body payload. Params also notes 'Bucket' name so we know where we're storing this, and 'Key' to tag the data within the bucket.
// Ensure Lambda has... 1. Allocated memory (2000mb) and time(30 secs) 2. Access to S3 via permissions/policy attachments

import puppeteerExtra from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";
import AWS from "aws-sdk";

const s3 = new AWS.S3({});

const scrape = async (url) => {
  try {
    puppeteerExtra.use(stealthPlugin());
    console.log("Browser initialized..."); // INITIALIZE BROWSER & CONNET PAGE
    // const browser = await puppeteerExtra.launch({
    //   args: chromium.args,
    //   defaultViewport: chromium.defaultViewport,
    //   executablePath: await chromium.executablePath(),
    //   headless: chromium.headless,
    //   ignoreHTTPSErrors: true,
    // });
    // EXECUTE LOCAL
    const browser = await puppeteerExtra.launch({
      headless: false,
      // devtools: true
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    });

    console.log("Page connected...");
    const page = await browser.newPage();
    await page.goto("https://www.espn.com/nfl/");

    // EVALUATE PAGE AND BUILD DATA OBJECT ---------------------------
    console.log("Evaluating DOM...");
    const evaluatePage = await page.evaluate(() => {
      const pageHeadlines = Array.from(
        document.querySelectorAll(".contentItem__padding")
      );
      const headlines = pageHeadlines.map((item) => ({
        title: item.querySelector(".contentItem__contentWrapper h2").innerText,
        link: item.href,
      }));
      return headlines;
    });
    await browser.close();
    const pages = await browser.pages();
    await Promise.all(pages.map(async (page) => page.close()));
    return evaluatePage;
  } catch (error) {
    console.log("ERROR at scrape", error.message);
  }
};
// Locally execute
// scrape().then(res => console.log('This is the response', res))

// LAMBDA HANDLER ---------------------
export const handler = async (event, context) => {
  const data = await scrape("https://www.espn.com/nfl/");

  const timeStamp = new Date().toDateString().slice(4);

  // PARAMS OBJECT to target bucket, set object key/name and payload
  const params = {
    Bucket: "nflscrapingbucket/nflData/",
    Key: `${timeStamp}.txt`,
    Body: JSON.stringify(data),
  };
  // CREATE action that actually loads bucket
  const bucketData = await s3.putObject(params).promise();

  // RETURN
  console.log("Data stored in S3 bucket...");
  return bucketData;
};
