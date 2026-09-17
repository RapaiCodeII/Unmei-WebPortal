(function () {
  'use strict';

  var database = null;
  var studentUid = '';
  var studentEmail = '';
  var notificationMap = {};
  var messageMap = {};
  var notificationsRef = null;
  var messagesRef = null;
  var studentSearchInput = null;
  var studentSearchResults = null;
  var studentSearchItems = [];
  var studentIdentityRef = null;

  var STUDENT_SEARCH_BASE_ITEMS = [
    {
      title: 'Dashboard',
      description: 'Overview, progress, and announcements',
      url: 'dashboard.html',
      keywords: 'home overview stats progress updates get started onboarding',
      icon: 'dashboard',
      tone: 'red'
    },
    {
      title: 'My Profile',
      description: 'View and update your student profile',
      url: 'profile.html',
      keywords: 'account profile information avatar contact',
      icon: 'profile',
      tone: 'blue'
    },
    {
      title: 'My Courses',
      description: 'Course list, scores, and instructor ratings',
      url: 'courses.html',
      keywords: 'lessons modules jlpt scores rating instructor class',
      icon: 'course',
      tone: 'green'
    },
    {
      title: 'Schedules',
      description: 'Class schedule and meeting times',
      url: 'schedules.html',
      keywords: 'calendar class time days session',
      icon: 'calendar',
      tone: 'pink'
    },
    {
      title: 'Announcements',
      description: 'Portal notices, reminders, and updates',
      url: 'announcements.html',
      keywords: 'notice updates reminders read unread onboarding',
      icon: 'announcement',
      tone: 'indigo'
    },
    {
      title: 'Payments',
      description: 'Payment status and installment tracking',
      url: 'payments.html',
      keywords: 'billing installment due payment receipt finance',
      icon: 'payment',
      tone: 'yellow'
    },
    {
      title: 'App Download',
      description: 'Download the UNMEI student mobile app',
      url: 'app-download.html',
      keywords: 'apk android mobile install app',
      icon: 'download',
      tone: 'purple'
    },
    {
      title: 'Settings',
      description: 'Portal preferences and account options',
      url: 'settings.html',
      keywords: 'settings preferences notifications account security',
      icon: 'settings',
      tone: 'gray'
    },
    {
      title: 'Student Login',
      description: 'Sign in to the student portal',
      url: 'login.html',
      keywords: 'login sign in authentication session',
      icon: 'profile',
      tone: 'gray'
    }
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function closeSearchResults() {
    document.querySelectorAll('.search-results.active').forEach(function (element) {
      element.classList.remove('active');
    });
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeSearchUrl(url) {
    return String(url || '').trim().replace(/^\.\//, '');
  }

  function toTrimmedText(value) {
    return String(value || '').trim();
  }

  function getStudentInitials(name) {
    var tokens = toTrimmedText(name).split(/\s+/).filter(Boolean);
    if (!tokens.length) return '--';
    return tokens.map(function (token) {
      return token.charAt(0);
    }).join('').toUpperCase().slice(0, 2) || '--';
  }

  function setNodeText(id, value) {
    var node = byId(id);
    if (node) node.textContent = value;
  }

  function getAvatarTextDisplayMode(textNode) {
    if (!textNode) return 'inline-flex';
    return textNode.classList.contains('profile-card__avatar-text') ? 'flex' : 'inline-flex';
  }

  function setAvatarPair(imageId, textId, avatarUrl) {
    var imageNode = byId(imageId);
    var textNode = byId(textId);
    var hasAvatar = !!toTrimmedText(avatarUrl);

    if (imageNode) {
      if (hasAvatar) {
        imageNode.src = avatarUrl;
        imageNode.style.display = 'block';
      } else {
        imageNode.removeAttribute('src');
        imageNode.style.display = 'none';
      }
    }

    if (textNode) {
      textNode.style.display = hasAvatar ? 'none' : getAvatarTextDisplayMode(textNode);
    }
  }

  function setBannerAvatar(initials, avatarUrl) {
    var bannerAvatar = byId('bannerAvatar');
    if (!bannerAvatar) return;

    var hasAvatar = !!toTrimmedText(avatarUrl);
    if (hasAvatar) {
      bannerAvatar.textContent = '';
      bannerAvatar.style.backgroundImage = 'url("' + avatarUrl + '")';
      bannerAvatar.style.backgroundSize = 'cover';
      bannerAvatar.style.backgroundPosition = 'center';
      bannerAvatar.style.backgroundRepeat = 'no-repeat';
      bannerAvatar.style.color = 'transparent';
      return;
    }

    bannerAvatar.style.backgroundImage = '';
    bannerAvatar.style.backgroundSize = '';
    bannerAvatar.style.backgroundPosition = '';
    bannerAvatar.style.backgroundRepeat = '';
    bannerAvatar.style.color = '';
    bannerAvatar.textContent = initials;
  }

  function applyStudentIdentity(fullName, avatarUrl) {
    var resolvedName = toTrimmedText(fullName) || 'Student';
    var resolvedAvatarUrl = toTrimmedText(avatarUrl);
    var initials = getStudentInitials(resolvedName);

    setNodeText('sidebarUserName', resolvedName);
    setNodeText('headerUserName', resolvedName);
    setNodeText('profileName', resolvedName);

    setNodeText('sidebarAvatarText', initials);
    setNodeText('headerAvatarText', initials);
    setNodeText('profileAvatarText', initials);

    setAvatarPair('sidebarAvatarImg', 'sidebarAvatarText', resolvedAvatarUrl);
    setAvatarPair('headerAvatarImg', 'headerAvatarText', resolvedAvatarUrl);
    setAvatarPair('profileAvatarImg', 'profileAvatarText', resolvedAvatarUrl);
    setBannerAvatar(initials, resolvedAvatarUrl);
  }

  function bindStudentIdentity() {
    if (!database || !studentUid) return;

    if (studentIdentityRef) {
      studentIdentityRef.off();
    }

    studentIdentityRef = database.ref('students/' + studentUid);
    studentIdentityRef.on('value', function (snapshot) {
      var cachedName = toTrimmedText(localStorage.getItem('studentDisplayName'));
      var cachedAvatar = toTrimmedText(localStorage.getItem('studentAvatarUrl'));

      if (!snapshot.exists()) {
        applyStudentIdentity(cachedName || 'Student', cachedAvatar);
        return;
      }

      var studentData = snapshot.val() || {};
      var profile = studentData.profile || {};
      var fullName = toTrimmedText(profile.fullName || studentData.fullName || studentData.name || cachedName || 'Student');
      var avatarUrl = toTrimmedText(profile.avatarUrl || studentData.avatarUrl || '');

      localStorage.setItem('studentDisplayName', fullName);
      if (avatarUrl) {
        localStorage.setItem('studentAvatarUrl', avatarUrl);
      } else {
        localStorage.removeItem('studentAvatarUrl');
      }

      applyStudentIdentity(fullName, avatarUrl);
    }, function () {
      applyStudentIdentity(
        toTrimmedText(localStorage.getItem('studentDisplayName')) || 'Student',
        toTrimmedText(localStorage.getItem('studentAvatarUrl'))
      );
    });
  }

  function getSearchToneStyle(tone) {
    var toneStyle = {
      red: 'background:var(--red-soft);color:var(--red);',
      blue: 'background:var(--blue-soft);color:var(--blue);',
      green: 'background:var(--green-soft);color:var(--green);',
      yellow: 'background:var(--yellow-soft);color:var(--yellow);',
      pink: 'background:#fce7f3;color:#db2777;',
      indigo: 'background:#e0e7ff;color:#6366f1;',
      purple: 'background:#ede9fe;color:#7c3aed;',
      gray: 'background:var(--gray-100);color:var(--gray-600);'
    };

    return toneStyle[tone] || toneStyle.red;
  }

  function getSearchIconSvg(iconType) {
    var icons = {
      dashboard: '<iconify-icon icon="mdi:view-dashboard"></iconify-icon>',
      profile: '<iconify-icon icon="mdi:account-outline"></iconify-icon>',
      course: '<iconify-icon icon="mdi:card-text-outline"></iconify-icon>',
      calendar: '<iconify-icon icon="mdi:credit-card-outline"></iconify-icon>',
      announcement: '<iconify-icon icon="mdi:bell-outline"></iconify-icon>',
      payment: '<iconify-icon icon="mdi:credit-card-outline"></iconify-icon>',
      download: '<iconify-icon icon="mdi:download-outline"></iconify-icon>',
      settings: '<iconify-icon icon="mdi:cog-outline"></iconify-icon>',
      page: '<iconify-icon icon="mdi:file-document-outline"></iconify-icon>'
    };

    return icons[iconType] || icons.page;
  }

  function collectSidebarSearchItems() {
    var derivedItems = [];

    document.querySelectorAll('.sidebar .nav-link[href]').forEach(function (link) {
      var href = normalizeSearchUrl(link.getAttribute('href'));
      if (!href || href === '#' || href.indexOf('javascript:') === 0) {
        return;
      }

      var title = String(link.textContent || '').replace(/\s+/g, ' ').trim();
      title = title.replace(/\s*(--|\d+)\s*$/, '').trim();
      if (!title) {
        return;
      }

      derivedItems.push({
        title: title,
        description: 'Open ' + title,
        url: href,
        keywords: title + ' navigation menu page',
        icon: 'page',
        tone: 'gray'
      });
    });

    return derivedItems;
  }

  function buildStudentSearchItems() {
    var mergedMap = {};

    function mergeItem(item) {
      if (!item || !item.url) {
        return;
      }

      var normalizedUrl = normalizeSearchUrl(item.url);
      var key = normalizeText(normalizedUrl);
      if (!key) {
        return;
      }

      if (!mergedMap[key]) {
        mergedMap[key] = {
          title: String(item.title || normalizedUrl).trim(),
          description: String(item.description || '').trim(),
          url: normalizedUrl,
          keywords: String(item.keywords || '').trim(),
          icon: item.icon || 'page',
          tone: item.tone || 'red'
        };
        return;
      }

      var existing = mergedMap[key];
      if (item.title && existing.title.length < String(item.title).trim().length) {
        existing.title = String(item.title).trim();
      }
      if (item.description && !existing.description) {
        existing.description = String(item.description).trim();
      }
      existing.keywords = (existing.keywords + ' ' + String(item.keywords || '').trim()).trim();
      if (existing.icon === 'page' && item.icon) {
        existing.icon = item.icon;
      }
      if (existing.tone === 'gray' && item.tone) {
        existing.tone = item.tone;
      }
    }

    STUDENT_SEARCH_BASE_ITEMS.forEach(mergeItem);
    collectSidebarSearchItems().forEach(mergeItem);

    return Object.keys(mergedMap).map(function (key) {
      return mergedMap[key];
    }).sort(function (a, b) {
      return a.title.localeCompare(b.title);
    });
  }

  function ensureStudentSearchUi() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) {
      return false;
    }

    var topbarCenter = topbar.querySelector('.topbar__center');
    if (!topbarCenter) {
      topbarCenter = document.createElement('div');
      topbarCenter.className = 'topbar__center';
      var topbarRight = topbar.querySelector('.topbar__right');
      if (topbarRight) {
        topbar.insertBefore(topbarCenter, topbarRight);
      } else {
        topbar.appendChild(topbarCenter);
      }
    }

    if (!topbarCenter.style.position) {
      topbarCenter.style.position = 'relative';
    }

    var searchBar = topbarCenter.querySelector('.search-bar');
    if (!searchBar) {
      searchBar = document.createElement('div');
      searchBar.className = 'search-bar';
      searchBar.innerHTML = '<iconify-icon icon="mdi:magnify"></iconify-icon><input type="text" placeholder="Search" />';
      topbarCenter.appendChild(searchBar);
    }

    var input = searchBar.querySelector('input[type="text"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Search';
      searchBar.appendChild(input);
    }

    input.placeholder = 'Search';
    if (!input.id) {
      input.id = 'globalSearch';
    }

    /* SINGLE SEARCH ENTRY POINT: the Ctrl+K global-search button
       (assets/global-search.js) is the only visible search control.
       This legacy inline bar stays in the DOM for API compatibility
       but is never rendered (matches PHASE 8/13 consolidation rule). */
    searchBar.style.display = 'none';

    var results = topbarCenter.querySelector('.search-results');
    if (!results) {
      results = document.createElement('div');
      results.className = 'search-results';
      results.id = 'searchResults';
      topbarCenter.appendChild(results);
    }
    results.style.display = 'none';

    studentSearchInput = input;
    studentSearchResults = results;
    studentSearchItems = buildStudentSearchItems();
    return true;
  }

  function getStudentSearchMatches(query) {
    if (!studentSearchItems.length) {
      studentSearchItems = buildStudentSearchItems();
    }

    var normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return studentSearchItems.slice(0, 12);
    }

    var terms = normalizedQuery.split(/\s+/).filter(Boolean);
    var matches = [];

    studentSearchItems.forEach(function (item) {
      var haystack = normalizeText(item.title + ' ' + item.description + ' ' + item.keywords + ' ' + item.url);
      var titleText = normalizeText(item.title);
      var descText = normalizeText(item.description);
      var keywordText = normalizeText(item.keywords);
      var urlText = normalizeText(item.url);
      var score = 0;
      var containsAllTerms = true;

      terms.forEach(function (term) {
        if (haystack.indexOf(term) === -1) {
          containsAllTerms = false;
          return;
        }
        if (titleText.indexOf(term) !== -1) score += 5;
        if (keywordText.indexOf(term) !== -1) score += 3;
        if (descText.indexOf(term) !== -1) score += 2;
        if (urlText.indexOf(term) !== -1) score += 1;
      });

      if (!containsAllTerms) {
        return;
      }

      matches.push({ item: item, score: score });
    });

    matches.sort(function (a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.item.title.localeCompare(b.item.title);
    });

    return matches.slice(0, 12).map(function (entry) {
      return entry.item;
    });
  }

  function renderStudentSearchResults(items) {
    if (!studentSearchResults) {
      return;
    }

    if (!items.length) {
      studentSearchResults.innerHTML = '<div class="search-empty"><iconify-icon icon="mdi:magnify"></iconify-icon>No results found.</div>';
      studentSearchResults.classList.add('active');
      return;
    }

    var html = '';
    items.forEach(function (item) {
      html += '<div class="search-result-item" data-search-url="' + escapeHtml(item.url) + '">'
        + '<div class="search-result-icon" style="' + getSearchToneStyle(item.tone) + '">'
        + getSearchIconSvg(item.icon)
        + '</div>'
        + '<div class="search-result-body">'
        + '<div class="search-result-title">' + escapeHtml(item.title) + '</div>'
        + '<div class="search-result-desc">' + escapeHtml(item.description || 'Open page') + '</div>'
        + '</div>'
        + '</div>';
    });

    studentSearchResults.innerHTML = html;
    studentSearchResults.querySelectorAll('.search-result-item[data-search-url]').forEach(function (row) {
      row.addEventListener('click', function () {
        window.navigateTo(row.getAttribute('data-search-url'));
      });
    });
    studentSearchResults.classList.add('active');
  }

  function runStudentGlobalSearch(query) {
    if (!ensureStudentSearchUi()) {
      return;
    }
    var matches = getStudentSearchMatches(query);
    renderStudentSearchResults(matches);
  }

  function initStudentGlobalSearch() {
    if (window.__unmeiStudentGlobalSearchBound) {
      return;
    }
    if (!ensureStudentSearchUi()) {
      return;
    }

    studentSearchInput.addEventListener('input', function (event) {
      runStudentGlobalSearch(event.target.value);
    });

    studentSearchInput.addEventListener('focus', function () {
      runStudentGlobalSearch(studentSearchInput.value || '');
    });

    studentSearchInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') {
        return;
      }
      var firstResult = studentSearchResults && studentSearchResults.querySelector('.search-result-item[data-search-url]');
      if (!firstResult) {
        return;
      }
      event.preventDefault();
      window.navigateTo(firstResult.getAttribute('data-search-url'));
    });

    window.handleSearch = function (query) {
      runStudentGlobalSearch(typeof query === 'string' ? query : (studentSearchInput ? studentSearchInput.value : ''));
    };

    window.showSearchResults = function () {
      runStudentGlobalSearch(studentSearchInput ? studentSearchInput.value : '');
    };

    window.navigateTo = function (url) {
      var targetUrl = normalizeSearchUrl(url);
      if (!targetUrl) {
        return;
      }

      var currentPage = normalizeSearchUrl(window.location.pathname.split('/').pop());
      if (targetUrl === currentPage) {
        closeSearchResults();
        return;
      }

      window.location.href = targetUrl;
    };

    window.__unmeiStudentGlobalSearchBound = true;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getNotifListEl() {
    return byId('notifList') || document.querySelector('#notifDropdown .header-dropdown__list');
  }

  function getNotifEmptyEl() {
    return byId('notifEmpty') || document.querySelector('#notifDropdown .header-dropdown__empty');
  }

  function getNotifBadgeEl() {
    return byId('notifBadge') || document.querySelector('#notifBtn .dropdown-badge');
  }

  function getMsgListEl() {
    return byId('msgList') || byId('msgDropdownList') || document.querySelector('#msgDropdown .header-dropdown__list');
  }

  function getMsgEmptyEl() {
    return byId('msgEmpty') || document.querySelector('#msgDropdown .header-dropdown__empty');
  }

  function getMsgBadgeEl() {
    return byId('msgBadge') || document.querySelector('#msgBtn .dropdown-badge');
  }

  function timeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    var seconds = Math.floor((Date.now() - Number(timestamp)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    return Math.floor(seconds / 86400) + ' days ago';
  }

  function notifyInfo(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }
    if (typeof window.showAlert === 'function') {
      window.showAlert('Info', message, 'info');
      return;
    }
    console.warn('[UNMEI]', message);
  }

  function setBadge(element, count) {
    if (!element) return;
    if (count > 0) {
      element.textContent = String(count);
      element.style.display = 'block';
    } else {
      element.style.display = 'none';
    }
  }

  function renderEmptyState(list, iconSvg, text) {
    if (!list) return;
    list.innerHTML = ''
      + '<div class="header-dropdown__empty">'
      + iconSvg
      + '<p>' + escapeHtml(text) + '</p>'
      + '</div>';
  }

  function renderNotifications(items) {
    var list = getNotifListEl();
    var badge = getNotifBadgeEl();
    if (!list) return;

    var emptyIcon = '<iconify-icon icon="mdi:bell-outline"></iconify-icon>';

    if (!items.length) {
      renderEmptyState(list, emptyIcon, 'No notifications yet');
      setBadge(badge, 0);
      return;
    }

    var typeIcons = {
      payment: '<iconify-icon icon="mdi:credit-card-outline"></iconify-icon>',
      schedule: '<iconify-icon icon="mdi:credit-card-outline"></iconify-icon>',
      announcement: '<iconify-icon icon="mdi:bell-outline"></iconify-icon>',
      info: '<iconify-icon icon="mdi:information-outline"></iconify-icon>'
    };
    var typeColors = { payment: 'red', schedule: 'blue', announcement: 'green', info: 'blue' };

    var html = '';
    var unreadCount = 0;

    items.forEach(function (item) {
      var iconSvg = typeIcons[item.type] || typeIcons.info;
      var colorClass = typeColors[item.type] || 'blue';
      var unreadClass = item.read ? '' : 'dropdown-item--unread';
      if (!item.read) unreadCount += 1;
      html += '<div class="dropdown-item ' + unreadClass + '" onclick="markNotifRead(\'' + item.id + '\', this)">'
        + '<div class="dropdown-item__icon dropdown-item__icon--' + colorClass + '">' + iconSvg + '</div>'
        + '<div class="dropdown-item__body">'
        + '<div class="dropdown-item__title">' + escapeHtml(item.title || 'Notification') + '</div>'
        + '<div class="dropdown-item__text">' + escapeHtml(item.message || '') + '</div>'
        + '<div class="dropdown-item__time">' + timeAgo(item.createdAt) + '</div>'
        + '</div>'
        + '</div>';
    });

    list.innerHTML = html;
    setBadge(badge, unreadCount);
  }

  function renderMessages(items) {
    var list = getMsgListEl();
    var badge = getMsgBadgeEl();
    if (!list) return;

    var emptyIcon = '<iconify-icon icon="mdi:email-outline"></iconify-icon>';

    if (!items.length) {
      renderEmptyState(list, emptyIcon, 'No messages');
      setBadge(badge, 0);
      return;
    }

    var html = '';
    var unreadCount = 0;

    items.forEach(function (msg) {
      var unreadClass = msg.read ? '' : 'dropdown-item--unread';
      if (!msg.read) unreadCount += 1;
      html += '<div class="dropdown-item ' + unreadClass + '" onclick="openMessage(\'' + msg.id + '\', this)">'
        + '<div class="dropdown-item__icon dropdown-item__icon--blue">'
        + '<iconify-icon icon="mdi:email-outline"></iconify-icon>'
        + '</div>'
        + '<div class="dropdown-item__body">'
        + '<div class="dropdown-item__title">' + escapeHtml(msg.subject || msg.title || 'Message') + '</div>'
        + '<div class="dropdown-item__text">' + escapeHtml(msg.message || msg.body || '') + '</div>'
        + '<div class="dropdown-item__time">' + timeAgo(msg.createdAt) + '</div>'
        + '</div>'
        + '</div>';
    });

    list.innerHTML = html;
    setBadge(badge, unreadCount);
  }

  function bindNotifications() {
    if (!database || !studentUid) return;
    notificationsRef = database.ref('notifications').orderByChild('recipientUid').equalTo(studentUid).limitToLast(20);
    notificationsRef.on('value', function (snapshot) {
      notificationMap = {};
      if (!snapshot.exists()) {
        renderNotifications([]);
        return;
      }

      var records = [];
      snapshot.forEach(function (child) {
        var value = child.val() || {};
        value.id = child.key;
        notificationMap[child.key] = value;
        records.push(value);
      });

      records.sort(function (a, b) {
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });
      renderNotifications(records);
    }, function () {
      renderNotifications([]);
    });
  }

  function bindMessages() {
    if (!database || !studentUid) return;
    messagesRef = database.ref('messages').limitToLast(100);
    messagesRef.on('value', function (snapshot) {
      messageMap = {};
      if (!snapshot.exists()) {
        renderMessages([]);
        return;
      }

      var records = [];
      snapshot.forEach(function (child) {
        var value = child.val() || {};
        var recipientUid = String(value.recipientUid || value.toUid || value.studentUid || '').trim();
        var recipientEmail = String(value.recipientEmail || value.toEmail || value.studentEmail || '').trim().toLowerCase();
        var isUidMatch = recipientUid === studentUid;
        var isEmailMatch = studentEmail && recipientEmail === studentEmail;
        if (!isUidMatch && !isEmailMatch) return;
        value.id = child.key;
        messageMap[child.key] = value;
        records.push(value);
      });

      records.sort(function (a, b) {
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });
      renderMessages(records.slice(0, 20));
    }, function () {
      renderMessages([]);
    });
  }

  window.markNotifRead = function (notifId, element) {
    var notif = notificationMap[notifId];
    if (!notif || !database) return;
    database.ref('notifications/' + notifId).update({ read: true, readAt: Date.now() });
    if (element) {
      element.classList.remove('dropdown-item--unread');
    }
  };

  window.markAllRead = function () {
    if (!database || !studentUid) return;
    var updates = {};
    Object.keys(notificationMap).forEach(function (id) {
      if (!notificationMap[id].read) {
        updates[id + '/read'] = true;
        updates[id + '/readAt'] = Date.now();
      }
    });

    if (Object.keys(updates).length > 0) {
      database.ref('notifications').update(updates);
      notifyInfo('All notifications marked as read.');
    }
  };

  window.viewNotif = function (element) {
    if (element) {
      element.classList.remove('dropdown-item--unread');
    }
  };

  window.openMessage = function (messageId, element) {
    var msg = messageMap[messageId];
    if (!msg) {
      notifyInfo('No message details available yet.');
      return;
    }

    if (database && !msg.read) {
      database.ref('messages/' + messageId).update({ read: true, readAt: Date.now() });
    }

    if (element) {
      element.classList.remove('dropdown-item--unread');
    }

    var text = (msg.message || msg.body || '').trim();
    var subject = (msg.subject || msg.title || 'Message').trim();
    if (typeof window.showAlert === 'function') {
      window.showAlert(subject, text || 'No message body.', 'info');
    } else {
      notifyInfo((subject ? subject + ': ' : '') + (text || 'No message body.'));
    }
  };

  window.viewAllMessages = function () {
    var count = Object.keys(messageMap).length;
    if (count === 0) {
      notifyInfo('No messages available.');
      return;
    }
    notifyInfo('You have ' + count + ' message(s). Open any message from the dropdown.');
  };

  var msgComposerSending = false;

  function ensureMsgComposeLink() {
    var msgHeader = document.querySelector('#msgDropdown .header-dropdown__header');
    if (!msgHeader || msgHeader.querySelector('[data-msg-compose]')) return;

    var compose = document.createElement('span');
    compose.className = 'header-dropdown__link';
    compose.setAttribute('data-msg-compose', 'true');
    compose.textContent = 'Compose';
    compose.setAttribute('onclick', 'openMsgComposer()');
    msgHeader.appendChild(compose);
  }

  function ensureMsgComposer() {
    if (byId('msgComposerOverlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'msg-composer-overlay';
    overlay.id = 'msgComposerOverlay';
    overlay.innerHTML = ''
      + '<div class="msg-composer" role="dialog" aria-modal="true" aria-labelledby="msgComposerTitle">'
      + '<div class="msg-composer__header">'
      + '<div class="msg-composer__heading">'
      + '<h3 id="msgComposerTitle">Message Administration</h3>'
      + '<p>Send a direct message to the UNMEI administration team. Replies arrive in your Messages inbox.</p>'
      + '</div>'
      + '<button type="button" class="msg-composer__close" onclick="closeMsgComposer()" aria-label="Close composer">'
      + '<iconify-icon icon="mdi:close"></iconify-icon>'
      + '</button>'
      + '</div>'
      + '<div class="msg-composer__body">'
      + '<label class="msg-composer__label" for="msgComposerSubject">Subject</label>'
      + '<input type="text" class="msg-composer__input" id="msgComposerSubject" maxlength="120" placeholder="e.g. Question about my schedule" />'
      + '<label class="msg-composer__label" for="msgComposerBody">Message</label>'
      + '<textarea class="msg-composer__textarea" id="msgComposerBody" maxlength="1000" placeholder="Write your message here..."></textarea>'
      + '</div>'
      + '<div class="msg-composer__footer">'
      + '<button type="button" class="msg-composer__btn msg-composer__btn--ghost" onclick="closeMsgComposer()">Cancel</button>'
      + '<button type="button" class="msg-composer__btn msg-composer__btn--primary" id="msgComposerSend" onclick="sendComposedMessage()">Send Message</button>'
      + '</div>'
      + '</div>';

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeMsgComposer();
      }
    });

    document.body.appendChild(overlay);
  }

  window.openMsgComposer = function () {
    if (!studentUid) {
      notifyInfo('Please sign in again before sending a message.');
      return;
    }
    ensureMsgComposer();
    document.querySelectorAll('.header-dropdown').forEach(function (el) {
      el.classList.remove('active');
    });
    document.querySelectorAll('.icon-btn').forEach(function (el) {
      el.classList.remove('icon-btn--active');
    });
    var overlay = byId('msgComposerOverlay');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    var subjectInput = byId('msgComposerSubject');
    if (subjectInput) subjectInput.focus();
  };

  window.closeMsgComposer = function () {
    var overlay = byId('msgComposerOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  window.sendComposedMessage = function () {
    if (msgComposerSending) return;

    var subjectInput = byId('msgComposerSubject');
    var bodyInput = byId('msgComposerBody');
    if (!subjectInput || !bodyInput) return;

    var subject = subjectInput.value.trim();
    var body = bodyInput.value.trim();

    if (!subject || !body) {
      notifyInfo('Subject and message are both required.');
      return;
    }
    if (!database || !studentUid) {
      notifyInfo('Unable to reach the database. Please try again.');
      return;
    }

    msgComposerSending = true;
    var sendBtn = byId('msgComposerSend');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
    }

    database.ref('messages').push({
      subject: subject,
      message: body,
      senderUid: studentUid,
      senderName: toTrimmedText(localStorage.getItem('studentDisplayName')) || 'Student',
      senderEmail: studentEmail,
      senderRole: 'student',
      recipientRole: 'admin',
      read: false,
      createdAt: Date.now()
    }).then(function () {
      subjectInput.value = '';
      bodyInput.value = '';
      closeMsgComposer();
      notifyInfo('Message sent to the administration team.');
    }).catch(function () {
      notifyInfo('Failed to send the message. Please try again.');
    }).finally(function () {
      msgComposerSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Message';
      }
    });
  };

  function startSync() {
    studentUid = localStorage.getItem('studentUid') || '';
    studentEmail = String(localStorage.getItem('studentEmail') || '').trim().toLowerCase();
    if (!studentUid) return;

    applyStudentIdentity(
      toTrimmedText(localStorage.getItem('studentDisplayName')) || 'Student',
      toTrimmedText(localStorage.getItem('studentAvatarUrl'))
    );

    if (typeof window.firebase === 'undefined' || !window.firebase.database) {
      setTimeout(startSync, 200);
      return;
    }

    database = window.firebase.database();
    bindStudentIdentity();
    bindNotifications();
    bindMessages();
  }

  window.addEventListener('beforeunload', function () {
    if (studentIdentityRef) studentIdentityRef.off();
    if (notificationsRef) notificationsRef.off();
    if (messagesRef) messagesRef.off();
  });

  if (!window.__unmeiStudentSearchDismissBound) {
    document.addEventListener('click', function (event) {
      if (event.target.closest('.search-bar') || event.target.closest('.search-results')) {
        return;
      }
      closeSearchResults();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSearchResults();
      }
    });

    window.__unmeiStudentSearchDismissBound = true;
  }

  function showStudentSignOutConfirm(onConfirm) {
    var existing = document.getElementById('unmeiSignOutConfirm');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'unmeiSignOutConfirm';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);backdrop-filter:blur(2px);font-family:inherit;';
    overlay.innerHTML = ''
      + '<div role="dialog" aria-modal="true" aria-label="Confirm sign out" style="background:#fff;border-radius:16px;box-shadow:0 24px 48px rgba(15,23,42,0.25);max-width:360px;width:calc(100% - 40px);padding:28px 26px 22px;text-align:center;">'
      + '<div style="width:56px;height:56px;border-radius:50%;background:#FDECEA;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">'
      + '<iconify-icon icon="mdi:logout" style="font-size:28px;color:#C0392B;"></iconify-icon></div>'
      + '<h3 style="margin:0 0 8px;font-size:1.05rem;font-weight:700;color:#111827;">Sign out of the portal?</h3>'
      + '<p style="margin:0 0 22px;font-size:0.85rem;color:#6B7280;line-height:1.5;">You will need to sign in again to access your dashboard, courses, and schedules.</p>'
      + '<div style="display:flex;gap:10px;">'
      + '<button type="button" id="unmeiSignOutCancel" style="flex:1;padding:11px 0;border:1.5px solid #E5E7EB;border-radius:10px;background:#fff;color:#374151;font-weight:600;font-size:0.85rem;cursor:pointer;">Cancel</button>'
      + '<button type="button" id="unmeiSignOutOk" style="flex:1;padding:11px 0;border:none;border-radius:10px;background:#C0392B;color:#fff;font-weight:600;font-size:0.85rem;cursor:pointer;">Sign Out</button>'
      + '</div></div>';
    document.body.appendChild(overlay);

    var close = function () { overlay.remove(); };
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    overlay.querySelector('#unmeiSignOutCancel').addEventListener('click', close);
    overlay.querySelector('#unmeiSignOutOk').addEventListener('click', function () {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  window.__studentSignOut = function () {
    showStudentSignOutConfirm(function () {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = 'login.html';
    });
  };

  function initStudentAvatarDropdown() {
    var userEl = document.querySelector('.topbar__user');
    if (!userEl || userEl.dataset.dropdownReady) return;
    userEl.dataset.dropdownReady = 'true';

    var name = toTrimmedText(localStorage.getItem('studentDisplayName')) || (document.getElementById('headerUserName') ? document.getElementById('headerUserName').textContent : 'Student');
    var email = String(localStorage.getItem('studentEmail') || '').trim();
    var initials = getStudentInitials(name);

    var menu = document.createElement('div');
    menu.className = 'avatar-menu';
    menu.id = 'studentAvatarMenu';
    menu.innerHTML = 
      '<div class="avatar-menu__header">' +
        '<div class="user-avatar" id="menuAvatarInitials" style="background:var(--red);color:#fff;font-weight:700;">' + initials + '</div>' +
        '<div style="min-width:0;flex:1;">' +
          '<div class="avatar-menu__name" id="menuStudentName" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
          '<div class="avatar-menu__email" id="menuStudentEmail" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + email + '</div>' +
        '</div>' +
      '</div>' +
      '<a class="avatar-menu__item" href="profile.html"><iconify-icon icon="mdi:account-outline"></iconify-icon> My Profile</a>' +
      '<a class="avatar-menu__item" href="courses.html"><iconify-icon icon="mdi:card-text-outline"></iconify-icon> My Courses</a>' +
      '<a class="avatar-menu__item" href="payments.html"><iconify-icon icon="mdi:credit-card-outline"></iconify-icon> Payments</a>' +
      '<a class="avatar-menu__item" href="settings.html"><iconify-icon icon="mdi:cog-outline"></iconify-icon> Settings</a>';

    userEl.style.position = 'relative';
    userEl.appendChild(menu);

    userEl.addEventListener('click', function (e) {
      if (e.target.closest('.avatar-menu')) return;
      e.stopPropagation();
      menu.classList.toggle('active');
    });

    document.addEventListener('click', function (e) {
      if (!userEl.contains(e.target)) {
        menu.classList.remove('active');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        menu.classList.remove('active');
      }
    });
  }

  function boot() {
    initStudentGlobalSearch();
    ensureMsgComposeLink();
    initStudentAvatarDropdown();
    startSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
