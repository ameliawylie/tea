chrome.storage.local.get((storedConfig) => {
  let form = document.querySelector('form')

  let config = {
    forceLatestTweets: true,
    hidePromotedTweets: true,
    hideFollowedByTweets: true,
    hideLikedTweets: false,
    hideRetweets: false,
    mutedUsers: [],

    // Sidebar
    hideExplore: false,
    hideMessages: false,
    hideBookmarks: false,
    hideLists: false,
    hideNotifications: false,
    hideTrends: true,
    hideWhoToFollow: true,
    hideFooter: false,

    ...storedConfig
  }

  for (let prop in config) {
    if (prop in form.elements) {
      let type = form.elements[prop].type
      if (form.elements[prop].type == 'checkbox') {
        form.elements[prop].checked = config[prop]
      }
      else {
        form.elements[prop].value = config[prop]
      }
    }
  }

  form.addEventListener('change', (e) => {
    let type = e.target.type
    if (type == 'checkbox') {
      config[e.target.name] = e.target.checked
    } else {
      config[e.target.name] = e.target.value
    }
    chrome.storage.local.set(config)
  })
})
