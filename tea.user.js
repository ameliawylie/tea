// TweetType specifies the different types of tweet we can categorize.
// Note that this currently relies on language being english for now.
const TweetType = {
    PROMOTED: 'PROMOTED', // All promoted tweets
    RETWEET: 'RETWEET',   // All retweets
    FOLLOWS: 'FOLLOWS',   // "X follows" tweets.
    LIKED: 'LIKED',       // "X and 3 others liked" tweets.
    TWEET: 'TWEET',       // All regular first-party tweets.
}

const HOME = 'Home'
const LATEST_TWEETS = 'Latest Tweets'
const MESSAGES = 'Messages'
const RETWEETS = 'Retweets'

// Config holds default config settings. This is merged with user config later.
// The config defaults here are my own choices!
let Config = {
    forceLatestTweets: true,
    hidePromotedTweets: true,
    hideFollowedByTweets: true,
    hideLikedTweets: false,
    hideRetweets: false,
    mutedUsers: [],

    hideExplore: false,
    hideMessages: false,
    hideBookmarks: false,
    hideLists: false,
    hideNotifications: false,
    hideTrends: true,
    hideWhoToFollow: true,
    hideFooter: false,
}

let Selectors = {
    PRIMARY_COLUMN: 'div[data-testid="primaryColumn"]',
    PRIMARY_NAV: 'nav[aria-label="Primary"]',
    SIDEBAR_COLUMN: 'div[data-testid="sidebarColumn"]',
    TWEET: 'div[data-testid="tweet"]',
    AUTHOR: 'a[role="link"]'
}

Object.assign(Selectors, {
    SIDEBAR_FOOTER: `${Selectors.SIDEBAR_COLUMN} nav`,
    SIDEBAR_WHO_TO_FOLLOW: `${Selectors.SIDEBAR_COLUMN} aside`,
    SIDEBAR_TRENDS: `${Selectors.SIDEBAR_COLUMN} section`,
    TIMELINE: `${Selectors.PRIMARY_COLUMN} section > h1 + div[aria-label] > div > div`,
})

// getTweetType takes a timeline item and tries to work out what specifically it is.
// This requires your twitter language is English, unfortunately.
// Twitter deliberately makes it very hard to identify tweet types based on IDs.
function getTweetType($tweet) {
    if ($tweet.lastElementChild.children.length > 2 &&
        $tweet.lastElementChild.children[2].textContent.includes('Promoted')) {
        return TweetType.PROMOTED
    }

    if ($tweet.previousElementSibling != null) {
        const text = $tweet.previousElementSibling.textContent

        if (text.includes('follow')) {
            return TweetType.FOLLOWS
        }

        if (text.includes('liked')) {
            return TweetType.LIKED
        }

        if (text.includes('Retweeted')) {
            return TweetType.RETWEET
        }
    }

    return TweetType.TWEET
}

/**
 * getTweetAuthor pulls out the "link" aria element on a tweet, which is always the direct link to it.
 * It's then trivial to parse out the author.
 * 
 * @param {HTMLElement} $tweet 
 * @returns {String?}
 */
function getTweetAuthor($tweet) {
    let $author = $tweet.querySelector(Selectors.AUTHOR)
    if ($author == null || $author.href == null) {
        //console.log('🍵: did not find author from tweet', { selector: Selectors.AUTHOR, tweet: $tweet })
        return null
    }

    const href = $author.href.replace('https://twitter.com/', '').replace('/^\//', '')
    let author = href.split('/')[0]

    if (author != null) {
        author = author.toLowerCase()
    }

    return author
}

/**
 * hideTweet checks if we should hide a specific tweet based on settings.
 * 
 * @param {string} tweetType 
 * @param {string} author 
 * @returns {boolean}
 */
function hideTweet(tweetType, author) {
    if (Config.mutedUsers.includes(author)) {
        return true
    }

    switch (tweetType) {
        case TweetType.PROMOTED:
            return Config.hidePromotedTweets
        case TweetType.FOLLOWS:
            return Config.hideFollowedByTweets
        case TweetType.LIKED:
            return Config.hideLikedTweets
        case TweetType.RETWEET:
            return Config.hideRetweets
    }

    return false
}

/**
 * @returns {Promise<HTMLElement>}
 */
function getElement(selector, {
    name = null,
    stopIf = null,
    target = document,
    timeout = Infinity,
} = {}) {
    return new Promise(resolve => {
        let rafId
        let timeoutId

        function stop($element, reason) {
            if ($element == null) {
                log(`stopped waiting for ${name || selector} after ${reason}`)
            }
            if (rafId) {
                cancelAnimationFrame(rafId)
            }
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
            resolve($element)
        }

        if (timeout !== Infinity) {
            timeoutId = setTimeout(stop, timeout, null, `${timeout}ms timeout`)
        }

        function queryElement() {
            let $element = target.querySelector(selector)
            if ($element) {
                stop($element)
            }
            else if (stopIf != null && stopIf() === true) {
                stop(null, 'stopIf condition met')
            }
            else {
                rafId = requestAnimationFrame(queryElement)
            }
        }

        queryElement()
    })
}

/**
 * 
 * @param {HTMLElement} $element 
 * @param {*} listener 
 * @param {*} options 
 */
function observeElement($element, listener, options = { childList: true }) {
    listener([])
    let observer = new MutationObserver(listener)
    observer.observe($element, options)
    return observer
}

async function switchToLatestTweets() {
    console.log('🍵: Switching to Latest Tweets')

    // Check to see if the button for "top tweets" (Twitter name for Home) is "on".
    // If it is, the button will switch to latest tweets when clicked.
    // We open the popup, and click the first tab element inside of it to switch.
    let $switchButton = await getElement('div[aria-label="Top Tweets on"]', {
        name: 'timeline switch button',
    })

    if ($switchButton == null) {
        console.log('🍵: Already on Latest Tweets or not on the homepage')
        return
    }

    // Click the button to open up the switch panel.
    $switchButton.click()

    // Look for the menuitems inside of the switch panel.
    let $seeLatestTweetsInstead = await getElement('div[role="menu"] div[role="menuitem"]', {
        name: '"See latest Tweets instead" menu item',
    })

    if ($seeLatestTweetsInstead == null) {
        console.log('🍵: Failed to switch to Latest Tweets after opening menu item, menuitem not found.')
        return
    }

    // Finally, click the "Show latest Tweets first" button to trigger a switch.
    $seeLatestTweetsInstead.closest('div[tabindex="0"]').click()
    console.log('🍵: Switched to Latest Tweets')
}

async function hideSidebarElements() {
    let selectors = []

    // Navigation

    if (Config.hideBookmarks) {
        selectors.push(`${Selectors.PRIMARY_NAV} a[href="/i/bookmarks"]`)
    }
            
    if (Config.hideExplore) {
        selectors.push(`${Selectors.PRIMARY_NAV} a[href="/explore"]`)
    }

    if (Config.hideLists) {
        selectors.push(`${Selectors.PRIMARY_NAV} a[href*="/lists"]`)
    }

    if (Config.hideMessages) {
        selectors.push(`${Selectors.PRIMARY_NAV} a[href="/messages"]`)
    }

    if (Config.hideNotifications) {
        selectors.push(`${Selectors.PRIMARY_NAV} a[href="/notifications"]`)
    }

    // Right-side Sidebar
    
    if (Config.hideTrends) {
        selectors.push(Selectors.SIDEBAR_TRENDS)
    }

    if (Config.hideWhoToFollow) {
        selectors.push(Selectors.SIDEBAR_WHO_TO_FOLLOW)
    }

    if (Config.hideFooter) {
        selectors.push(Selectors.SIDEBAR_FOOTER)
    }

    if (selectors.length > 0) {
        let css = `${selectors.join(', ')} { display: none !important; }`

        let $style = document.createElement('style')
        $style.dataset.insertedBy = 'github.com/ameliawylie/tea'
        $style.textContent = css

        document.head.appendChild($style)
    }
}

// Observers

let pageObservers = []

/**
 * createPageObserver is the entrypoint to our async updating here.
 * Whenever you change tab in the Twitter UI, the title updates and this function fires.
 */
async function createPageObserver() {
    let $title = await getElement('title', { name: '<title>' })
    console.log('🍵: Observing title element for page changes', $title)

    return observeElement($title, () => onPageChange($title.textContent), {
        childList: true,
    })
}

/**
 * createTimelineObserver adds a MutationObserver to the timeline element within the Twitter UI.
 * This lets us filter the timeline at-will.
 */
async function createTimelineObserver() {
    let $timeline = await getElement(Selectors.TIMELINE, { name: 'timeline' })
    if ($timeline == null) {
        console.log('🍵: Timeline not found when attempting to observe', { selector: Selectors.TIMELINE })
        return
    }

    console.log('🍵: Created observer for timeline.')
    pageObservers.push(
        observeElement($timeline, () => onTimelineChange($timeline))
    )
}

// Listeners

let currentPage = null

/**
 * onPageChange fires whenever there is a navigation event in the new Twitter UI.
 * The actual trigger is the <title> element changing, but that is not too important.
 * 
 * @param {String} pageTitle 
 */
async function onPageChange(pageTitle) {
    // Ignore initial page loads to prevent the screen from flashing.
    if (pageTitle === 'Twitter') {
        console.log('🍵: Ignoring initial page load')
        return
    }

    // Only allow the same page to re-process if the "Customize your view" dialog is currently open.
    let newPage = pageTitle.split(' / ')[0]
    if (newPage === currentPage && location.pathname !== '/i/display') {
        console.log('🍵: Ignoring duplicate title change', { pageTitle })
        return
    }

    // disconnect all pageObservers as we'll add back to it down below.
    if (pageObservers.length > 0) {
        console.log('🍵: Disconnecting MutationObservers', pageObservers)

        pageObservers.forEach(observer => observer.disconnect())
        pageObservers = []
    }

    currentPage = newPage

    console.log('🍵: Processing new page', { page: newPage })

    // if we're on the homepage, then start observing the timeline.
    // If we're forcing latest tweets to on, do that _first_ or we'll break timeline observing.
    if (currentPage === HOME && Config.forceLatestTweets) {
        await switchToLatestTweets()
    }

    if (currentPage === HOME || currentPage === LATEST_TWEETS) {
        await createTimelineObserver()
    }
}

/**
 * onTimelineChange checks if we should hide a timeline item based on config, tweet type, and the author.
 * To hide, it sets the display style to none.
 * 
 * @param {HTMLElement} $timeline 
 */
function onTimelineChange($timeline) {
    for (let $item of $timeline.children) {
        let $tweet = $item.querySelector(Selectors.TWEET)

        if ($tweet == null) {
            continue
        }

        let tweetType = getTweetType($tweet)
        let author = getTweetAuthor($tweet)
        let hideItem = hideTweet(tweetType, author)

        if (hideItem === true) {
            console.log('🍵 [DEBUG]: Tweet Hidden', { tweetType, author })

            $item.firstElementChild.style.display = 'none'
        }
    }
}

// Main function

async function main() {
    console.log('🍵: config loaded', Config)

    // hiding sidebar elements can be done statically via CSS, so do that first before anything else.
    await hideSidebarElements()

    // observe the page for navigation events, so that we're able to re-draw when the current tab is changed.
    // this is the entrypoint to this extension, effectively. しょうがない
    await createPageObserver()
}

chrome.storage.local.get(storedConfig => {
    // assign to the config variable using storedConfig; this lets us set defaults.
    Object.assign(Config, storedConfig)

    // run the main function asynchronously
    main()
})
