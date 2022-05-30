const fs = require("fs");
const puppeteer = require("puppeteer");

const { classesNames, pageConfigs, authCredentials, elementProperties } = require('./constants')

let page = null;
let browser = null;
let isLoggedIn = false;
let isOnSearchResultsPage = false;
let isOnAllPostResultPage = false;
let isOnSortByLatest=false;
const details = [];
const hashesArray = [];

const keyword = process.argv[2] || "Proximus";
console.log({ keyword });

const base64Encoder = (data) => {
  console.log(data);
  try {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  } catch (base64EncoderError) {
    console.log({ base64EncoderError });
    return `${data}`.substring(0, 15);
  }
};

const postFilterBasedOnDefinedTimeline = (dateTime) => {
  //console.log(dateTime)
  const unitOrder = ['seconds', 'minutes', 'hours', 'weeks', 'months', 'years'];
  const TIMELINE_FILTER_VALUE = {
    value: 3,
    unit: 'months'
  };

  const [value, unit] = `${dateTime}`.split(" ");
  const isThisPOstInOurTimeline = unitOrder.indexOf(unit) <= unitOrder.indexOf(TIMELINE_FILTER_VALUE.unit);

  if (isThisPOstInOurTimeline) {
    if (TIMELINE_FILTER_VALUE.unit === unit) {
      return value <= TIMELINE_FILTER_VALUE.value
    };
    return true;
  }
  return false;
}

const getElementsByClassNameWrapper = async (htmlObj = null, classNames = [], { property = null, getInnerText = true, whichIndex = 0 }) => {
  // console.log({ obj, classNames, getInnerText, whichIndex });
  const shiftedKlass = classNames.shift();
  const klass = shiftedKlass.indexOf('.') === 0 ? shiftedKlass : `.${shiftedKlass}`;
  const innerHtmlObj = await htmlObj.$$(klass);
  console.log({ innerHtmlObj, klass });

  if (innerHtmlObj && innerHtmlObj.length === 0) {
    return false;
  }

  if (classNames.length === 0) {
    if (property && innerHtmlObj) {
      const innerObj = await innerHtmlObj[whichIndex];
      if (getInnerText) {
        const text = await innerObj.getProperty(property);
        return text.jsonValue();
      } else if (property === elementProperties.click) {
        // return innerObj.evaluate((el) => el.click);
        const id = await innerObj.getProperty('id');
        const idValue = await id.jsonValue();
        return `#${idValue}`;
      } else {
        return false
      };
    }
    // whichIndex = -1 means return whole object
    return whichIndex === -1 ? innerHtmlObj : innerHtmlObj[whichIndex];
  } else {
    return getElementsByClassNameWrapper(innerHtmlObj[whichIndex], classNames, { property, getInnerText, whichIndex });
  }
}

const initBrowser = async () => {
  if (browser) {
    return browser;
  }
  return await puppeteer.launch({ headless: false });
}

const initAndGotoPage = async (url = 'https://www.linkedin.com/login') => {
  if (page) {
    return page;
  }
  const pageInit = await browser.newPage();
  await pageInit.setViewport({
    width: pageConfigs.viewPort.width,
    height: pageConfigs.viewPort.height,
  });
  await pageInit.goto(url, /*{ waitUntil: 'networkidle0', }*/);

  return pageInit;
}

const loginHandler = async () => {
  if (isLoggedIn) {
    return true;
  }
  try {
    await page.type("#username", authCredentials.userName);
    await page.type("#password", authCredentials.password);
    // await page.waitForTimeout(1000);
    await page.waitForSelector('.login__form_action_container')
    await page.click(
      "#organic-div > form > div.login__form_action_container > button"
    );
    return true;
  } catch (loginHandlerError) {
    console.log({ loginHandlerError });
    isLoggedIn = false
    throw loginHandlerError;
  }
}

const searchKeywordHandler = async () => {
  if (isOnSearchResultsPage) {
    return true;
  }
  try {
    await page.waitForSelector(".search-global-typeahead");
    // await page.focus(".search-global-typeahead__collapsed-search-button");
    await page.click('.search-global-typeahead > button');
    // await page.waitForTimeout(1000);
    await page.type("[placeholder='Search']", keyword);
    await page.waitForTimeout(2000);
    await page.keyboard.press("Enter");

    return true;
  } catch (searchKeywordHandlerError) {
    console.log({ searchKeywordHandlerError });
    isOnSearchResultsPage = false;
    throw searchKeywordHandler;
  }
}

const viewAllPostOfSearchResultHandler = async () => {
  if (isOnAllPostResultPage) {
    return true;
  }
  try {
    await page.waitForSelector('.scaffold-layout-toolbar [aria-label="Posts"]');
    // await page.waitForTimeout(2000);
    await page.click('[aria-label="Posts"]');
    // await page.waitForSelector('.feed-shared-actor__title [dir="ltr"]');

    return true;
  } catch (viewAllPostOfSearchResultHandlerError) {
    console.log({ viewAllPostOfSearchResultHandlerError })
    isOnAllPostResultPage = false;
    throw viewAllPostOfSearchResultHandlerError
  }
}

const sortAllPostByLatest =async ()=>{
  // if(isOnSortByLatest){
  //   return true;
  // }
  //try {
    await page.waitForSelector('button[aria-label="Sort by filter. Clicking this button displays all Sort by filter options."]')
    await page.click('button[aria-label="Sort by filter. Clicking this button displays all Sort by filter options."]')
    await page.waitForSelector('[for="sortBy-date_posted"]')
    await page.click('[for="sortBy-date_posted"]')
    await page.waitForSelector('.relative mr2')
    await page.click('.relative mr2')
    return true
 // }
  // catch (isOnSortByLatestError){
  //   console.log({isOnSortByLatestError})
  //   isOnSortByLatest=false;
  //   throw isOnSortByLatestError
  // }
}
// retry based on fn 
const retryFn = async (fn, tries = 0) => {
  if (tries > 0) {
    const { success } = await fn(tries);
    if (!success) {
      tries -= 1;
      retryFn(fn, tries);
    }
  }
}

const writeResultsToJsonFile = (dir = './', fileName = `results-${new Date().getTime()}.json`, fileData = details) => {
  fs.writeFileSync(dir.concat(fileName), JSON.stringify(fileData, null, 2))
}

const main = async (triesCount) => {

    // browser = await puppeteer.launch({ headless: false });
    browser = await initBrowser();

    page = await initAndGotoPage();

    isLoggedIn = await loginHandler();
    let capchaVerify=await page.click('button[aria-describedby="descriptionVerify"]')
page.waitForTimeout(400000000)
    isOnSearchResultsPage = await searchKeywordHandler();

    isOnAllPostResultPage = await viewAllPostOfSearchResultHandler();
      
}
//start of program
retryFn(main, 1000);




