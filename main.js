const puppeteer = require('puppeteer')
const {
  Worker,
  isMainThread,
  parentPort
} = require('worker_threads')
const fs = require('fs')

const DB_PATH = __dirname + '/db.JSON'
const URL = 'https://instagram.com/sixfaceface'

async function getInstagramAccountInfo() {
  try {
    let isNotFound = false
    let isPublic = true
    let postInfo = []
    let user = {
      username: '',
      name: '',
      posts: 0,
      followers: 0,
      following: 0,
      postsDetails: [],
      errorInfo: ''
    }


    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    await page.goto(URL)

    // check if username can be found
    isNotFound = await page.evaluate(() => {
      let errorDOM = document.querySelector('.error-container')
      if (errorDOM) {
        if (errorDOM.getElementsByTagName('h2')[0]?.textContent === "Sorry, this page isn't available.") {
          return isNotFound = true
        }
      }
      return false
    })

    // check if account is public
    isPublic = await page.evaluate(() => {
      let existDOM = document.querySelector('div.QlxVY h2')
      if (existDOM?.textContent === 'This Account is Private') {
        return false
      }
      return true
    })

    // get userInfo 
    let userInfo = await page.evaluate(() => {
      let posts = 0
      let followers = 0
      let following = 0
      let name = ''
      let username = ''
      let headerSectionDOM = document.querySelector('header > section')
      let liDOM = headerSectionDOM?.querySelectorAll('ul > li')
      if (headerSectionDOM) {
        // username
        username = headerSectionDOM.querySelector('div  h2').textContent
        // post followers following
        liDOM.forEach((el, index) => {
          if (index === 0) posts = el.querySelector('span.g47SY').textContent
          if (index === 1) followers = el.querySelector('span.g47SY').textContent
          if (index === 2) following = el.querySelector('span.g47SY').textContent
        })
        // name
        name = headerSectionDOM.querySelector('div > h1').textContent
      }
      return {
        posts,
        followers,
        following,
        name,
        username
      }
    })

    // get postsInfo
    postInfo = await page.evaluate(() => {
      let posts = []
      let postNodes = document.querySelectorAll('div[style*="flex-direction"]  div.KL4Bh')
      postNodes.forEach(el => {
        let describtion = el.querySelector('img').getAttribute('alt')
        let src = el.querySelector('img').getAttribute('src')
        posts.push({
          describtion,
          src
        })
      })
      return posts
    })

    await browser.close()

    user.posts = userInfo.posts
    user.followers = userInfo.followers
    user.following = userInfo.following
    user.name = userInfo.name
    user.username = userInfo.username
    user.postsDetails = postInfo

    if (isNotFound) {
      user.errorInfo = "Sorry, this page isn't available."
    }

    if (!isPublic) {
      user.errorInfo = "This Account is Private"
    }

    return user

  } catch (error) {
    throw new Error(error)
  }
}

// process data in worker
function processInWorker(data) {
  const worker = new Worker(__filename)
  if (isMainThread) {
    console.log('sending data to worker...')
    worker.postMessage(data)
    worker.once('message', (message) => {
      console.log(message)
    })
  } else {
    parentPort.once('message', (message) => {
      console.log('received data from mainWorker...')
      fs.writeFile(DB_PATH, JSON.stringify(message), 'utf-8', (err) => {
        if (err) throw new Error(err)
        parentPort.postMessage('Data processd and saved successfully !!!')
      })
    })
  }
}


getInstagramAccountInfo()
  .then((res) => processInWorker(res)).catch((error) => {
    throw new Error(error)
  })