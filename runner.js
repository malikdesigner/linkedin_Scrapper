const fs = require("fs");
const es = require("./es");
const puppeteer = require("puppeteer");

const {
  classesNames,
  pageConfigs,
  authCredentials,
  elementProperties,
} = require("./constants");

let page = null;
let browser = null;
let isLoggedIn = false;
let isOnSortByLatest = false;
let isOnSearchResultsPage = false;
let isOnAllPostResultPage = false;
let hasSameNoOfLastPosts = false;
let isFileWritten = false;
let lastBatchSizeWritten = 0;

const details = [];
const hashesArray = [];

const keyword = process.argv[2] || "Proximus";
console.log({ keyword });

const base64Encoder = (data) => {
  // console.log(data);
  try {
    return Buffer.from(JSON.stringify(data)).toString("base64");
  } catch (base64EncoderError) {
    console.log({ base64EncoderError });
    return `${data}`.substring(0, 15);
  }
};

const postFilterBasedOnDefinedTimeline = (dateTime) => {
  //console.log(dateTime)
  const unitOrder = ["seconds", "minutes", "hours", "weeks", "months", "years"];
  const TIMELINE_FILTER_VALUE = {
    value: 3,
    unit: "months",
  };

  const [value, unit] = `${dateTime}`.split(" ");
  const isThisPOstInOurTimeline =
    unitOrder.indexOf(unit) <= unitOrder.indexOf(TIMELINE_FILTER_VALUE.unit);

  if (isThisPOstInOurTimeline) {
    if (TIMELINE_FILTER_VALUE.unit === unit) {
      return value <= TIMELINE_FILTER_VALUE.value;
    }
    return true;
  }
  return false;
};

const getElementsByClassNameWrapper = async (
  htmlObj = null,
  classNames = [],
  { property = null, getInnerText = true, whichIndex = 0 }
) => {
  // console.log({ obj, classNames, getInnerText, whichIndex });
  const shiftedKlass = classNames.shift();
  const klass =
    shiftedKlass.indexOf(".") === 0 ? shiftedKlass : `.${shiftedKlass}`;
  const innerHtmlObj = await htmlObj.$$(klass);
  // console.log({ innerHtmlObj, klass });

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
        const id = await innerObj.getProperty("id");
        const idValue = await id.jsonValue();
        return `#${idValue}`;
      } else {
        return false;
      }
    }
    // whichIndex = -1 means return whole object
    return whichIndex === -1 ? innerHtmlObj : innerHtmlObj[whichIndex];
  } else {
    return getElementsByClassNameWrapper(innerHtmlObj[whichIndex], classNames, {
      property,
      getInnerText,
      whichIndex,
    });
  }
};

const initBrowser = async () => {
  if (browser) {
    return browser;
  }
  return await puppeteer.launch({ headless: false });
};

const initAndGotoPage = async (url = "https://www.linkedin.com/login") => {
  if (page) {
    return page;
  }
  const pageInit = await browser.newPage();
  await pageInit.setViewport({
    width: pageConfigs.viewPort.width,
    height: pageConfigs.viewPort.height,
  });
  await pageInit.goto(url /*{ waitUntil: 'networkidle0', }*/);

  return pageInit;
};

const loginHandler = async () => {
  if (isLoggedIn) {
    return true;
  }
  try {
    await page.type("#username", authCredentials.userName);
    await page.type("#password", authCredentials.password);
    // await page.waitForTimeout(1000);
    await page.waitForSelector(".login__form_action_container");
    await page.click(
      "#organic-div > form > div.login__form_action_container > button"
    );
    return true;
  } catch (loginHandlerError) {
    console.log({ loginHandlerError });
    isLoggedIn = false;
    throw loginHandlerError;
  }
};

const searchKeywordHandler = async (
  baseSelector = ".search-global-typeahead"
) => {
  // if (isOnSearchResultsPage) {
  //   return true;
  // }
  try {
    await page.waitForSelector(baseSelector);
    // await page.focus(".search-global-typeahead__collapsed-search-button");
    await page.click(`${baseSelector} > button`);
    // await page.waitForTimeout(1000);
    await page.type("[placeholder='Search']", keyword);
    await page.waitForTimeout(2000);
    await page.keyboard.press("Enter");

    return true;
  } catch (searchKeywordHandlerError) {
    console.log({ searchKeywordHandlerError });
    const updatedSelector = [
      ".global-nav__search-typeahead",
      ".search-global-typeahead__collapsed-search-button",
    ];

    if (!updatedSelector.includes(baseSelector)) {
      return searchKeywordHandler(updatedSelector[0]);
    }

    if (baseSelector === updatedSelector[0]) {
      return searchKeywordHandler(updatedSelector[1]);
    } else {
      isOnSearchResultsPage = false;
      throw searchKeywordHandlerError;
    }
  }
};

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
    console.log({ viewAllPostOfSearchResultHandlerError });
    isOnAllPostResultPage = false;
    throw viewAllPostOfSearchResultHandlerError;
  }
};

const sortAllPostByLatest = async () => {
  if (isOnSortByLatest) {
    return true;
  }
  try {
    await page.waitForSelector(
      'button[aria-label="Sort by filter. Clicking this button displays all Sort by filter options."]'
    );
    await page.click(
      'button[aria-label="Sort by filter. Clicking this button displays all Sort by filter options."]'
    );
    await page.waitForSelector('[for="sortBy-date_posted"]');
    await page.click('[for="sortBy-date_posted"]');
    await page.click('[aria-label="Posts"]'); // help to apply sort filter

    return true;
  } catch (isOnSortByLatestError) {
    console.log({ isOnSortByLatestError });
    isOnSortByLatest = false;
    throw isOnSortByLatestError;
  }
};
const sendDataES =async()=>{
  await es
  .bulkIndex(details, "linkedin")
  .then((response) => {
    console.info(`Indexed ${response.body.items.length}`);
    if (response.body.errors) {
      response.body.items.forEach((item, _in) => {
        if (item.index.error) {
          console.error(details[_in]);
          console.error(
            `Error Indexing ${JSON.stringify(item.index.error, null, "\t")}`
          );
        }
      });
    }
  })
  .catch((err) => {
    console.error(err);
  });
}
// retry based on fn
const retryFn = async (fn, tries = 0) => {
  if (tries > 0) {
    const { success } = await fn();
    if (!success) {
      tries--;
      retryFn(fn, tries);
    }
  }
};

const writeResultsToJsonFile = (
  dir = "./",
  fileName = null,
  fileData = null
) => {
  const writeableData = fileData || details;
  const writeFileName =
    fileName || `${keyword}-results-${new Date().getTime()}.json`;
  fs.writeFileSync(
    dir.concat(writeFileName),
    JSON.stringify(writeableData, null, 2)
  );
  isFileWritten = true;
};

// const scrollItem = async (scrollDelay) => {
//   previousHeight = await page.evaluate('document.body.scrollHeight')
//   await page.evaluate('window.scrollTo(0,document.body.scrollHeight)')
//   await page.waitForFunction(`document.body.scrollHeight >${previousHeight}`)
//   await page.waitForTimeout(scrollDelay)
// }

const waitForMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  try {
    browser = await initBrowser();
    page = await initAndGotoPage();
    isLoggedIn = await loginHandler();
    isOnSearchResultsPage = await searchKeywordHandler();
    isOnAllPostResultPage = await viewAllPostOfSearchResultHandler();
    isOnSortByLatest = await sortAllPostByLatest();

    let flag = true;
    let scrollHeightNow = 0;
    let scrollHeightUpdated = 0;
    let pageCount = 1;
    // const yOffset = await page.evaluate(() => document.body.scrollHeight);
    // console.log({ yOffset });

    while (flag) {
      console.log({ pageCount });

      flag = await postExtractor(page, details);

      if (flag) {
        scrollHeightNow = await page.evaluate(() => document.body.scrollHeight);
        await page.evaluate(`window.scrollTo(0,${scrollHeightNow})`);
        await page.waitForFunction(
          `document.body.scrollHeight > ${scrollHeightNow}`
        );
        scrollHeightUpdated = await page.evaluate(
          () => document.body.scrollHeight
        );

        console.log({ scrollHeightNow, scrollHeightUpdated });
        if (scrollHeightNow === scrollHeightUpdated) {
          break;
        }

        await waitForMs(2000);
        pageCount += 1;
      }
    }

    await browser.close();
    // inserting into elastic search
   await sendDataES ();

    // uncomment below to write detailsData to json file
    writeResultsToJsonFile();

    return { success: true };
  } catch (mainError) {
    console.log(mainError);
    return { success: false };
  }
};

//start of program
retryFn(main, 1000);

const postExtractor = async (page, details) => {
  let flag = true;
  try {
    // const posts = await page.$$('.feed-shared-update-v2');
    await page.waitForSelector(".feed-shared-update-v2");
    const posts = await getElementsByClassNameWrapper(
      page,
      ["feed-shared-update-v2"],
      { whichIndex: -1 }
    );

    // remove duplicate posts
    posts.splice(0, details.length);

    if (posts.length === 0) {
      if (!hasSameNoOfLastPosts) {
        hasSameNoOfLastPosts = true;
        return true;
      }
      return false;
    }

    if (!posts.length) {
      return false;
    }

    // console.log({ posts });

    const propText = { property: elementProperties.innerText };
    const propClick = {
      property: elementProperties.click,
      getInnerText: false,
    };

    for (const post of posts) {
      // console.log({ post });
      const comments = [];
      // const author = post.getElementsByClassName('feed-shared-actor__name')[0].innerText;
      const author = await getElementsByClassNameWrapper(
        post,
        ["feed-shared-actor__name"],
        propText
      );
      // const designation = post.getElementsByClassName('feed-shared-actor__description')[0].innerText;
      const designation = await getElementsByClassNameWrapper(
        post,
        ["feed-shared-actor__description"],
        propText
      );
      // const dateTime = post.getElementsByClassName('feed-shared-actor__sub-description')[0].getElementsByClassName('visually-hidden')[0].innerText;
      const dateTime = await getElementsByClassNameWrapper(
        post,
        ["feed-shared-actor__sub-description", "visually-hidden"],
        propText
      );
      // const postText = post.getElementsByClassName('feed-shared-text relative feed-shared-update-v2__commentary')[0].getElementsByClassName('break-words')[0].innerText;
      const postText = await getElementsByClassNameWrapper(
        post,
        ["feed-shared-update-v2__commentary", "break-words"],
        propText
      );
      // console.log(author, designation, postText, dateTime);

      while (true) {
        try {
          const loadMoreCommentsHandlerId = await getElementsByClassNameWrapper(
            post,
            ["comments-comments-list__load-more-comments-button"],
            propClick
          );

          await page.click(loadMoreCommentsHandlerId);

          waitForMs(1000);
        } catch (loadMoreCommentsError) {
          // console.log({ loadMoreCommentsError });
          break;
        }
      }

      const commentsHolder = await getElementsByClassNameWrapper(
        post,
        ["comments-comments-list__comment-item"],
        { whichIndex: -1 }
      );

      if (commentsHolder) {
        for (const comment of commentsHolder) {
          const commentAuthor = await getElementsByClassNameWrapper(
            comment,
            ["comments-post-meta__name-text"],
            propText
          );
          const commentAuthorDesignation = await getElementsByClassNameWrapper(
            comment,
            ["comments-post-meta__headline"],
            propText
          );
          const commentText = await getElementsByClassNameWrapper(
            comment,
            ["feed-shared-text"],
            propText
          );
          const commentDateTime = await getElementsByClassNameWrapper(
            comment,
            ["comments-comment-item__timestamp"],
            propText
          );
          // console.log(commentAuthor, commentAuthorDesignation, commentText, commentDateTime);

          // TODO: future implementation break based on date
          comments.push({
            commentAuthor,
            commentAuthorDesignation,
            commentText,
            commentDateTime,
          });
          waitForMs(100);
          // console.log({ comments })
        }
      }

      if (postFilterBasedOnDefinedTimeline(dateTime)) {
        const data = { author, designation, dateTime, postText, comments };
        const hashedData = base64Encoder(data);
        //console.log(hashedData)
        if (hashesArray.indexOf(hashedData) === -1) {
          hashesArray.push(hashedData);
          details.push(data);
          // console.log(details);
        }
      } else {
        flag = false;
        break;
      }
    }

    return flag;
  } catch (error) {
    console.log({ error });
    throw error;
  }
};

function onExitHanlder(eventType) {
  console.log(`onExitHandler::${eventType}`);
  if (!isFileWritten) {
    console.log("onExitHandler::writeResultsToJsonFile");
    writeResultsToJsonFile();
  }
  process.exit();
}

process.on(`uncaughtException`, (exception) => console.log({ exception }));

[`exit`, `beforeExit`, `SIGINT`].forEach((eventType) => {
  process.on(eventType, onExitHanlder.bind(null, eventType));
});
