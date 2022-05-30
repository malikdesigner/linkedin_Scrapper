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
  //console.log(data);
  try {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  } catch (base64EncoderError) {
    //console.log({ base64EncoderError });
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
  //console.log({ innerHtmlObj, klass });

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
    //console.log({ loginHandlerError });
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
    //console.log({ searchKeywordHandlerError });
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
    await page.waitForSelector('button[aria-label="Sort by filter. Clicking this button displays all Sort by filter options."]')
    await page.click('button[aria-label="Sort by filter. Clicking this button displays all Sort by filter options."]')
    await page.waitForSelector('[for="sortBy-date_posted"]')
    await page.click('[for="sortBy-date_posted"]')
    await page.click('[aria-label="Posts"]');
    return true;
  } catch (viewAllPostOfSearchResultHandlerError) {
    //console.log({ viewAllPostOfSearchResultHandlerError })
    isOnAllPostResultPage = false;
    throw viewAllPostOfSearchResultHandlerError
  }
}

// const sortAllPostByLatest =async ()=>{
  // if(isOnSortByLatest){
  //   return true;
  // }
  //try {
    // await page.waitForSelector('button[aria-label="Sort by filter. Clicking this button displays all Sort by filter options."]')
    // await page.click('button[aria-label="Sort by filter. Clicking this button displays all Sort by filter options."]')
    // await page.waitForSelector('[for="sortBy-date_posted"]')
    // await page.click('[for="sortBy-date_posted"]')
    // //await page.waitForSelector('[aria-label="Apply current filters to show results"]')
    // await page.click('[aria-label="Posts"]');
    // return true
 // }
  // catch (isOnSortByLatestError){
  //   console.log({isOnSortByLatestError})
  //   isOnSortByLatest=false;
  //   throw isOnSortByLatestError
  // }
// }
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
async function scrollItem(page, scrollDelay){
  
    previousHeight=await page.evaluate('document.body.scrollHeight')
    await page.evaluate('window.scrollTo(0,document.body.scrollHeight)')
    await page.waitForFunction(`document.body.scrollHeight >${previousHeight}`)
    await page.waitForTimeout(scrollDelay)
    }
    
  

const writeResultsToJsonFile = (dir = './', fileName = `results-${new Date().getTime()}.json`, fileData = details) => {
  fs.writeFileSync(dir.concat(fileName), JSON.stringify(fileData, null, 2))
}

const main = async (triesCount) => {
  try {
    // browser = await puppeteer.launch({ headless: false });
    browser = await initBrowser();

    // page = await browser.newPage();
    // await page.setViewport({
    //   width: 1920,
    //   height: 1080,
    // });
    // await page.setViewport({ width: 1366, height: 768});
    // await page.goto("https://www.linkedin.com/login", {
    //   waitUntil: 'networkidle0',
    // });

    page = await initAndGotoPage();

    // await page.type("#username", "mw392957@gmail.com");
    // await page.type("#password", "qwertASDFG12345");
    // await page.waitForTimeout(1000);
    // await page.click(
    //   "#organic-div > form > div.login__form_action_container > button"
    // );
    // await page.waitForTimeout(2000);

    isLoggedIn = await loginHandler();

    // await page.waitForSelector(".search-global-typeahead__collapsed-search-button");
    // await page.click('.search-global-typeahead__collapsed-search-button');
    // await page.focus(".search-global-typeahead__collapsed-search-button");
    // await page.waitForTimeout(1000);
    // await page.type("[placeholder='Search']", keyword);
    // await page.waitForTimeout(2000);
    // await page.keyboard.press("Enter");

    isOnSearchResultsPage = await searchKeywordHandler();

    // await page.waitForSelector('.scaffold-layout-toolbar [aria-label="Posts"]');
    // await page.waitForTimeout(2000);
    // //await page.click('.scaffold-layout-toolbar [aria-label="Posts"]');
    // await page.click('[aria-label="Posts"]')
    // // await page.waitForTimeout(3000);
    // await page.waitForSelector('.feed-shared-actor__title [dir="ltr"]');

    isOnAllPostResultPage = await viewAllPostOfSearchResultHandler();

    // set sortBy to latest 
   //isOnSortByLatest=   await sortAllPostByLatest()

    let flag = true;
    let y = 0;
    const yOffset = await page.evaluate(() => window.innerHeight);
    console.log({ yOffset });

    while (flag) {
      //console.log({ y });

      await postExtractor(page, details, triesCount);
      // console.log(details);
      //scroll function
     // await page.evaluate(() => window.scrollBy(y, y+yOffset));
     scrollItem(page, 4000)
      //await page.evaluate((y)=>window.scrollBy(y ,y+yOffset))
      y += yOffset;
     // console(`yvalue after:${y}`)
      // await page.waitForTimeout(4000);

      // newData2 = JSON.stringify(details);
    }

    // console.log(details)
    // // Writing to our JSON file
    // fs.writeFile("test.json", JSON.stringify(details), (err) => {
    //   // Error checking
    //   if (err) throw err;
    //   console.log("New data added");
    // });

    await browser.close();

    // uncomment below to write detailsData to json file 
    writeResultsToJsonFile();

    return { success: true };
  } catch (mainError) {
    //console.log(mainError);
    return { success: false };
  }
};
//start of program
retryFn(main, 1000);

async function postExtractor(page, details, triesCount) {
  let flag = true;
  try {
    // const posts = await page.$$('.feed-shared-update-v2');
    const posts = await getElementsByClassNameWrapper(page, ['feed-shared-update-v2'], { whichIndex: -1 });
    // handle duplicate
    //posts.splice(0, details.length - 1);

    if (!posts.length) {
      flag=false
      return flag;
    }

    //console.log({ posts });

    const propText = { property: elementProperties.innerText };
    const propClick = { property: elementProperties.click, getInnerText: false };

    for (const post of posts) {
      // console.log({ post });
      const comments = [];
      // const author = post.getElementsByClassName('feed-shared-actor__name')[0].innerText;
      const author = await getElementsByClassNameWrapper(post, ['feed-shared-actor__name'], propText);
      // const designation = post.getElementsByClassName('feed-shared-actor__description')[0].innerText;
      const designation = await getElementsByClassNameWrapper(post, ['feed-shared-actor__description'], propText);
      // const dateTime = post.getElementsByClassName('feed-shared-actor__sub-description')[0].getElementsByClassName('visually-hidden')[0].innerText;
      const dateTime = await getElementsByClassNameWrapper(post, ['feed-shared-actor__sub-description', 'visually-hidden'], propText);
      // const postText = post.getElementsByClassName('feed-shared-text relative feed-shared-update-v2__commentary')[0].getElementsByClassName('break-words')[0].innerText;
      const postText = await getElementsByClassNameWrapper(post, ['feed-shared-update-v2__commentary', 'break-words'], propText);
      //console.log(author, designation, postText, dateTime);

      console.log("post say guzra")
      // now we'll sort comments by most-recent via clicking dropdown button
      // const commentSortHandlerId = await getElementsByClassNameWrapper(post, [
      //   'comments-sort-order-toggle__trigger'
      // ], propClick);


      // if (commentSortHandlerId) {
      // opening dropdown
      // commentSortHandler.click();
      // await page.click(commentSortHandlerId);

      // const mostRecentDropdownHandlerId = await getElementsByClassNameWrapper(post, [
      //   'comment-sort-order-toggle__main-text'
      // ], { ...propClick, whichIndex: 1 });

      // now gonna click on mostRecent option
      // mostRecentDropdownHandler.click();
      // await page.click(mostRecentDropdownHandlerId);

      // try {
      //   // if dropdown stays open we can close that here
      //   await getElementsByClassNameWrapper(post, [
      //     'comment-sort-order-toggle__main-text'
      //   ], propClick);
      // } catch (err) {
      //   console.log({ err });
      //   // closing dropdown
      //   commentSortHandler.click();
      // }

      let hasComments = triesCount ? true : false;
      // click on load more till end of 
      while (true) {
        try {
          const loadMoreCommentsHandlerId = await getElementsByClassNameWrapper(post, [
            'comments-comments-list__load-more-comments-button'
          ], propClick);
          console.log("loadmore clicked")
          // loadMoreCommentsHandler.click();
          hasComments = true;
          await page.click(loadMoreCommentsHandlerId);
        } catch (loadMoreCommentsError) {
          
          console.log({ loadMoreCommentsError });
          break;
        }
      }

      if (hasComments) {
        console.log("comments holder not clicked")
        const commentsHolder = await getElementsByClassNameWrapper(post, ['comments-comments-list__comment-item'], { whichIndex: -1 });
        console.log('comments handler clicked')
        console.log({commentsHolder})
        for (const comment of commentsHolder) {
          const commentAuthor = await getElementsByClassNameWrapper(comment, ['comments-post-meta__name-text'], propText);
          const commentAuthorDesignation = await getElementsByClassNameWrapper(comment, ['comments-post-meta__headline'], propText);
          const commentText = await getElementsByClassNameWrapper(comment, ['feed-shared-text'], propText);
          const commentDateTime = await getElementsByClassNameWrapper(comment, ['comments-comment-item__timestamp'], propText);
          //console.log(commentAuthor, commentAuthorDesignation, commentText, commentDateTime);

          // TODO: future implementation break based on date
          comments.push({ commentAuthor, commentAuthorDesignation, commentText, commentDateTime })
          //console.log({comments})
          console.log("comments are pushed")
        }
      }
      else {
        comments.push({ NA, NA, NA, NA })
        return false
      }
      // }

      if (postFilterBasedOnDefinedTimeline(dateTime)) {
        const data = { author, designation, dateTime, postText, comments };
        const hashedData = base64Encoder(data);
        //console.log(hashedData)
        if (hashesArray.indexOf(hashedData) === -1) {
          hashesArray.push(hashedData)
          details.push(data)
          console.log(details);
        }
      }
      else {
        flag = false;
        break;
      }
      
    }

    return flag;
  } catch (error) {
    console.log({ error });
    throw error;
  }
}

