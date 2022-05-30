const html = `
<!doctype html>
<html>
  <head><meta charset='UTF-8'><title>Test</title></head>
  <body>
    <div class="class1">    
      <div class="class2"> 
        <span class="classAuthor">
          "a1"
        </span>
      </div>
      <div class="class2">  
        <span class="class3">
        "c11"
        </span>
        <span class="class3">
        "c12"
        </span>
      </div>
    </div>
    <div class="class1">  
      <div class="class2"> 
        <span class="classAuthor">
          "a2"
        </span>
      </div>
      <div class="class2">  
        <span class="class3">
           "c21"
        </span>
        <span class="class3">
           "c22"
        </span>
      </div>
    </div>
    <div class="class1">  
      <div class="class2"> 
        <span class="classAuthor">
          "a3"
        </span>
      </div>
      <div class="class2">  
        <span class="class3">
         "c31"
        </span>
        <span class="class3">
          "c32"
        </span>
      </div>
    </div>
    <div class="class1">  
      <div class="class2"> 
        <span class="classAuthor">
          "a4"
        </span>
      </div>
      <div class="class2">  
        <span class="class3">
        "c41"
        </span>
        <span class="class3">
        "c42"
        </span>
      </div>
    </div>
  </body>
</html>`;

const puppeteer = require('puppeteer');

(async function main() {
  try {
    const browser = await puppeteer.launch();
    const [page] = await browser.pages();

    await page.goto(`data:text/html,${html}`);

    const posts = await page.$$(".class1");
    for (const post of posts) {
      const allAuthorHolder = await post.$$('.classAuthor');
      const authorHolder = await allAuthorHolder[0].getProperty('innerText');
      const author = await authorHolder.jsonValue()

      const commentsText = [];
      const commentsOuterHolder = await post.$$('.class2');
      // const commentsHolder = await commentsOuterHolder[0].$$('.class3')
      // console.log({ commentsOuterHolder })

      for (const commentOuter of commentsOuterHolder) {
        const comments = await commentOuter.$$('.class3');

        // console.log({ comments });
        for (const comment of comments) {
          const inner = await comment.getProperty('innerText');
          const text = await inner.jsonValue();
          commentsText.push(text);
          // console.log({ innerText: text });
        }
      }

      console.log({ author, commentsText });

    }

    // Way 1.
    // {
    //     const allClass1InPage = await page.$$(".class1");
    //     for (const class1El of allClass1InPage) {
    //         console.debug(await class1El.$eval(".class2", class2El =>
    //             `${class2El.parentNode.dataset.id}: ${class2El.innerText}`
    //         ));
    //     }
    // }

    console.log();

    // Way 2.
    // {
    //     const allClass1InPage = await page.$$('.class1');
    //     for (const class1El of allClass1InPage) {
    //         const datasetHandle = await class1El.getProperty('dataset');
    //         const idHandle = await datasetHandle.getProperty('id');
    //         const id = await idHandle.jsonValue();

    //         const spanHandle = await class1El.$('.class2');
    //         const textHandle = await spanHandle.getProperty('innerText');
    //         const text = await textHandle.jsonValue();

    //         console.log(`${id}: ${text}`);
    //     }
    // }

    console.log();

    // Way 3.
    // {
    //     const data = await page.evaluate(
    //         () => [...document.querySelectorAll('.class1')].map(element =>
    //             `${element.dataset.id}: ${element.querySelector('.class2').innerText}`)
    //     );
    //     console.log(data.join('\n'));
    // }

    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();