(function () {
  'use strict';

  var database = null;
  var adminId = '';
  var adminEmail = '';
  var notificationMap = {};
  var messageMap = {};
  var fallbackNotificationMap = {};
  var notificationsRef = null;
  var messagesRef = null;
  var paymentsRef = null;
  var enrollmentsRef = null;
  var fallbackReadStateKey = 'unmeiAdminFallbackNotifRead';
  var fallbackReadState = {};
  var adminSearchInput = null;
  var adminSearchResults = null;
  var adminSearchItems = [];
  var adminAvatarObserver = null;
  var adminLogoStyleId = 'unmei-admin-logo-avatar-style';

  var ADMIN_SEARCH_BASE_ITEMS = [
    {
      title: 'Dashboard',
      description: 'Main admin overview and system metrics',
      url: 'admin-dashboard.html',
      keywords: 'home overview summary analytics quick actions',
      icon: 'dashboard',
      tone: 'red'
    },
    {
      title: 'Students',
      description: 'Manage student records and profiles',
      url: 'admin-students.html',
      keywords: 'students learner profile account management',
      icon: 'students',
      tone: 'blue'
    },
    {
      title: 'Enrollments',
      description: 'Track and review enrollment requests',
      url: 'admin-enrollments.html',
      keywords: 'enrollment registration pending approval',
      icon: 'enrollment',
      tone: 'green'
    },
    {
      title: 'Payments',
      description: 'Verify and monitor payment submissions',
      url: 'admin-payments.html',
      keywords: 'payments billing receipts verification',
      icon: 'payment',
      tone: 'yellow'
    },
    {
      title: 'Course List',
      description: 'View and manage courses and assigned instructors',
      url: 'admin-courses.html',
      keywords: 'courses curriculum class schedule instructor',
      icon: 'course',
      tone: 'indigo'
    },
    {
      title: 'Course Overview',
      description: 'Inspect course roster and curriculum details',
      url: 'admin-course-view.html',
      keywords: 'course overview roster attendance instructor',
      icon: 'course',
      tone: 'purple'
    },
    {
      title: 'Build New Course',
      description: 'Create new course curriculum programs',
      url: 'admin-build-course.html',
      keywords: 'create course build curriculum setup',
      icon: 'course',
      tone: 'pink'
    },
    {
      title: 'Add Student',
      description: 'Launch guided add-student wizard',
      url: 'admin-add-student.html',
      keywords: 'add student wizard create account enrollment',
      icon: 'add',
      tone: 'blue'
    },
    {
      title: 'New Enrollment',
      description: 'Create and assign a student enrollment',
      url: 'admin-new-enrollment.html',
      keywords: 'new enrollment student assignment',
      icon: 'enrollment',
      tone: 'green'
    },
    {
      title: 'Post Notice',
      description: 'Publish announcements and notices',
      url: 'admin-post-notice.html',
      keywords: 'notice announcement publish audience message',
      icon: 'announcement',
      tone: 'indigo'
    },
    {
      title: 'Portal Settings',
      description: 'Configure portal behavior and rules',
      url: 'admin-portal-settings.html',
      keywords: 'settings configuration access preferences',
      icon: 'settings',
      tone: 'gray'
    },
    {
      title: 'Admin Login',
      description: 'Sign in to admin portal',
      url: 'admin-login.html',
      keywords: 'login sign in authentication admin',
      icon: 'students',
      tone: 'gray'
    }
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function ensureAdminLogoStyle() {
    if (byId(adminLogoStyleId)) return;

    var styleEl = document.createElement('style');
    styleEl.id = adminLogoStyleId;
    styleEl.textContent =
      '.topbar__user .user-avatar, .sidebar__user .user-avatar {' +
      'background-color:#ffffff !important;' +
      'background-image:url("assets/logo.png") !important;' +
      'background-size:72% !important;' +
      'background-position:center !important;' +
      'background-repeat:no-repeat !important;' +
      'color:transparent !important;' +
      'font-size:0 !important;' +
      'text-indent:-9999px !important;' +
      'overflow:hidden !important;' +
      '}';

    document.head.appendChild(styleEl);
  }

  function applyAdminLogoAvatars() {
    ensureAdminLogoStyle();

    document.querySelectorAll('.topbar__user .user-avatar, .sidebar__user .user-avatar').forEach(function (avatar) {
      avatar.textContent = '';
      avatar.setAttribute('aria-label', 'UNMEI');
      avatar.setAttribute('title', 'UNMEI');
    });
  }

  function bindAdminAvatarObserver() {
    if (adminAvatarObserver || typeof MutationObserver === 'undefined') return;

    adminAvatarObserver = new MutationObserver(function () {
      applyAdminLogoAvatars();
    });

    adminAvatarObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function closeSearchResults() {
    document.querySelectorAll('.search-results.active').forEach(function (element) {
      element.classList.remove('active');
    });
  }

  function normalizeSearchUrl(url) {
    return String(url || '').trim().replace(/^\.\//, '');
  }

  function getSearchToneStyle(tone) {
    var toneStyle = {
      red: 'background:var(--red-soft);color:var(--red);',
      blue: 'background:var(--blue-soft);color:var(--blue);',
      green: 'background:var(--green-soft);color:var(--green);',
      yellow: 'background:var(--yellow-soft);color:var(--yellow);',
      purple: 'background:#ede9fe;color:#7c3aed;',
      indigo: 'background:#e0e7ff;color:#6366f1;',
      gray: 'background:var(--gray-100);color:var(--gray-500);'
    };

    return toneStyle[tone] || toneStyle.red;
  }

  function getSearchIconSvg(iconType) {
    var icons = {
      dashboard: '<iconify-icon icon="mdi:view-dashboard"></iconify-icon>',
      students: '<iconify-icon icon="mdi:account-outline"></iconify-icon>',
      enrollment: '<iconify-icon icon="mdi:card-text-outline"></iconify-icon>',
      payment: '<iconify-icon icon="mdi:credit-card-outline"></iconify-icon>',
      section: '<iconify-icon icon="mdi:card-text-outline"></iconify-icon>',
      add: '<iconify-icon icon="mdi:plus-circle-outline"></iconify-icon>',
      announcement: '<iconify-icon icon="mdi:bell-outline"></iconify-icon>',
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

  function buildAdminSearchItems() {
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

    ADMIN_SEARCH_BASE_ITEMS.forEach(mergeItem);
    collectSidebarSearchItems().forEach(mergeItem);

    return Object.keys(mergedMap).map(function (key) {
      return mergedMap[key];
    }).sort(function (a, b) {
      return a.title.localeCompare(b.title);
    });
  }

  function ensureAdminSearchUi() {
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

    adminSearchInput = input;
    adminSearchResults = results;
    adminSearchItems = buildAdminSearchItems();
    return true;
  }

  function createHeaderActionWidget(kind) {
    var wrapper = document.createElement('div');
    wrapper.style.position = 'relative';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-btn';
    button.id = kind === 'notif' ? 'notifBtn' : 'msgBtn';
    button.setAttribute('aria-label', kind === 'notif' ? 'Open notifications' : 'Open messages');
    button.setAttribute('onclick', kind === 'notif' ? "toggleDropdown('notifDropdown')" : "toggleDropdown('msgDropdown')");

    button.innerHTML = kind === 'notif'
      ? '<iconify-icon icon="mdi:bell-outline"></iconify-icon>'
      : '<iconify-icon icon="mdi:email-outline"></iconify-icon>';

    var badge = document.createElement('span');
    badge.className = 'dropdown-badge';
    badge.id = kind === 'notif' ? 'notifBadge' : 'msgBadge';
    badge.style.display = 'none';
    badge.textContent = '0';
    button.appendChild(badge);

    var dropdown = document.createElement('div');
    dropdown.className = 'header-dropdown';
    dropdown.id = kind === 'notif' ? 'notifDropdown' : 'msgDropdown';

    var header = document.createElement('div');
    header.className = 'header-dropdown__header';

    var title = document.createElement('span');
    title.className = 'header-dropdown__title';
    title.textContent = kind === 'notif' ? 'Notifications' : 'Messages';
    header.appendChild(title);

    var action = document.createElement('span');
    action.className = 'header-dropdown__link';
    action.textContent = kind === 'notif' ? 'Mark all read' : 'View all';
    action.setAttribute('onclick', kind === 'notif' ? 'markAllRead()' : 'viewAllMessages()');
    header.appendChild(action);

    if (kind === 'msg') {
      var compose = document.createElement('span');
      compose.className = 'header-dropdown__link';
      compose.textContent = 'Compose';
      compose.setAttribute('onclick', 'openMsgComposer()');
      header.appendChild(compose);
    }

    var list = document.createElement('div');
    list.className = 'header-dropdown__list';
    list.id = kind === 'notif' ? 'notifList' : 'msgList';

    var empty = document.createElement('div');
    empty.className = 'header-dropdown__empty';
    empty.id = kind === 'notif' ? 'notifEmpty' : 'msgEmpty';
    empty.innerHTML = kind === 'notif'
      ? '<iconify-icon icon="mdi:bell-outline"></iconify-icon><p>No notifications</p>'
      : '<iconify-icon icon="mdi:email-outline"></iconify-icon><p>No messages</p>';

    list.appendChild(empty);
    dropdown.appendChild(header);
    dropdown.appendChild(list);
    wrapper.appendChild(button);
    wrapper.appendChild(dropdown);
    return wrapper;
  }

  function ensureHeaderActionWidgets() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) {
      return false;
    }

    var topbarRight = topbar.querySelector('.topbar__right');
    if (!topbarRight) {
      return false;
    }

    var userBlock = topbarRight.querySelector('.topbar__user');
    var notifBtn = byId('notifBtn');
    var msgBtn = byId('msgBtn');

    if (!notifBtn) {
      topbarRight.insertBefore(createHeaderActionWidget('notif'), userBlock || null);
    }

    if (!msgBtn) {
      var anchor = byId('notifBtn');
      topbarRight.insertBefore(createHeaderActionWidget('msg'), anchor ? anchor.parentNode.nextSibling : (userBlock || null));
    }

    return true;
  }

  function getAdminSearchMatches(query) {
    if (!adminSearchItems.length) {
      adminSearchItems = buildAdminSearchItems();
    }

    var normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return adminSearchItems.slice(0, 12);
    }

    var terms = normalizedQuery.split(/\s+/).filter(Boolean);
    var matches = [];

    adminSearchItems.forEach(function (item) {
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

  function renderAdminSearchResults(items) {
    if (!adminSearchResults) {
      return;
    }

    if (!items.length) {
      adminSearchResults.innerHTML = '<div class="search-empty"><iconify-icon icon="mdi:magnify"></iconify-icon>No results found.</div>';
      adminSearchResults.classList.add('active');
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

    adminSearchResults.innerHTML = html;
    adminSearchResults.querySelectorAll('.search-result-item[data-search-url]').forEach(function (row) {
      row.addEventListener('click', function () {
        window.navigateTo(row.getAttribute('data-search-url'));
      });
    });
    adminSearchResults.classList.add('active');
  }

  function runAdminGlobalSearch(query) {
    if (!ensureAdminSearchUi()) {
      return;
    }
    var matches = getAdminSearchMatches(query);
    renderAdminSearchResults(matches);
  }

  function initAdminGlobalSearch() {
    if (window.__unmeiAdminGlobalSearchBound) {
      return;
    }
    if (!ensureAdminSearchUi()) {
      return;
    }

    adminSearchInput.addEventListener('input', function (event) {
      runAdminGlobalSearch(event.target.value);
    });

    adminSearchInput.addEventListener('focus', function () {
      runAdminGlobalSearch(adminSearchInput.value || '');
    });

    adminSearchInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') {
        return;
      }
      var firstResult = adminSearchResults && adminSearchResults.querySelector('.search-result-item[data-search-url]');
      if (!firstResult) {
        return;
      }
      event.preventDefault();
      window.navigateTo(firstResult.getAttribute('data-search-url'));
    });

    window.handleSearch = function (query) {
      runAdminGlobalSearch(typeof query === 'string' ? query : (adminSearchInput ? adminSearchInput.value : ''));
    };

    window.showSearchResults = function () {
      runAdminGlobalSearch(adminSearchInput ? adminSearchInput.value : '');
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

    window.__unmeiAdminGlobalSearchBound = true;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function loadFallbackReadState() {
    try {
      var raw = localStorage.getItem(fallbackReadStateKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          fallbackReadState = parsed;
        }
      }
    } catch (_e) {
      fallbackReadState = {};
    }
  }

  function saveFallbackReadState() {
    try {
      localStorage.setItem(fallbackReadStateKey, JSON.stringify(fallbackReadState));
    } catch (_e) {
      // Ignore persistence errors and keep in-memory behavior.
    }
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

  function notifyInfo(message) {
    if (typeof window.showAlert === 'function') {
      window.showAlert('Info', message, 'info');
      return;
    }
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }
    console.warn('[UNMEI]', message);
  }

  function timeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    var ageSeconds = Math.floor((Date.now() - Number(timestamp)) / 1000);
    if (ageSeconds < 60) return 'Just now';
    if (ageSeconds < 3600) return Math.floor(ageSeconds / 60) + ' minutes ago';
    if (ageSeconds < 86400) return Math.floor(ageSeconds / 3600) + ' hours ago';
    return Math.floor(ageSeconds / 86400) + ' days ago';
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

  function isAdminTarget(value) {
    var recipientUid = normalizeText(value.recipientUid || value.toUid || value.adminUid || value.userUid || '');
    var recipientEmail = normalizeText(value.recipientEmail || value.toEmail || value.adminEmail || value.email || '');
    var recipientRole = normalizeText(value.recipientRole || value.role || value.recipientType || value.targetRole || value.audience || '');
    var targetScope = normalizeText(value.target || value.scope || value.recipientGroup || value.channel || '');

    if (adminId && recipientUid === normalizeText(adminId)) return true;
    if (adminEmail && recipientEmail === normalizeText(adminEmail)) return true;

    if (
      recipientRole === 'admin' ||
      recipientRole === 'admins' ||
      recipientRole === 'administrator' ||
      recipientRole === 'all-admins'
    ) {
      return true;
    }

    if (targetScope === 'admin' || targetScope === 'admins' || targetScope === 'all-admins') {
      return true;
    }

    if (value.forAdmins === true) {
      return true;
    }

    return false;
  }

  function getCombinedNotifications() {
    var fromDatabase = Object.keys(notificationMap).map(function (id) {
      var item = notificationMap[id];
      item.id = id;
      return item;
    });

    var fromFallback = Object.keys(fallbackNotificationMap).map(function (id) {
      var item = fallbackNotificationMap[id];
      item.id = id;
      item.read = !!fallbackReadState[id];
      return item;
    });

    var combined = fromDatabase.concat(fromFallback);
    combined.sort(function (a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

    return combined.slice(0, 25);
  }

  function renderNotifications() {
    var list = getNotifListEl();
    var badge = getNotifBadgeEl();
    if (!list) return;

    var emptyIcon = '<iconify-icon icon="mdi:bell-outline"></iconify-icon>';

    var items = getCombinedNotifications();
    if (!items.length) {
      renderEmptyState(list, emptyIcon, 'No notifications');
      setBadge(badge, 0);
      return;
    }

    var icons = {
      payment: '<iconify-icon icon="mdi:credit-card-outline"></iconify-icon>',
      enrollment: '<iconify-icon icon="mdi:card-text-outline"></iconify-icon>',
      announcement: '<iconify-icon icon="mdi:bell-outline"></iconify-icon>',
      message: '<iconify-icon icon="mdi:email-outline"></iconify-icon>',
      info: '<iconify-icon icon="mdi:information-outline"></iconify-icon>'
    };
    var typeColor = {
      payment: 'red',
      enrollment: 'blue',
      announcement: 'green',
      message: 'blue',
      info: 'blue'
    };

    var html = '';
    var unreadCount = 0;

    items.forEach(function (item) {
      var itemType = normalizeText(item.type || 'info');
      var iconSvg = icons[itemType] || icons.info;
      var colorClass = typeColor[itemType] || 'blue';
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

  function renderMessages() {
    var list = getMsgListEl();
    var badge = getMsgBadgeEl();
    if (!list) return;

    var emptyIcon = '<iconify-icon icon="mdi:email-outline"></iconify-icon>';

    var items = Object.keys(messageMap).map(function (id) {
      var item = messageMap[id];
      item.id = id;
      return item;
    }).sort(function (a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    }).slice(0, 25);

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
    if (!database) return;
    notificationsRef = database.ref('notifications').limitToLast(150);
    notificationsRef.on('value', function (snapshot) {
      notificationMap = {};
      if (snapshot.exists()) {
        snapshot.forEach(function (child) {
          var value = child.val() || {};
          if (!isAdminTarget(value)) return;
          value.id = child.key;
          notificationMap[child.key] = value;
        });
      }
      renderNotifications();
    }, function () {
      notificationMap = {};
      renderNotifications();
    });
  }

  function bindMessages() {
    if (!database) return;
    messagesRef = database.ref('messages').limitToLast(200);
    messagesRef.on('value', function (snapshot) {
      messageMap = {};
      if (snapshot.exists()) {
        snapshot.forEach(function (child) {
          var value = child.val() || {};
          if (!isAdminTarget(value)) return;
          value.id = child.key;
          messageMap[child.key] = value;
        });
      }
      renderMessages();
    }, function () {
      messageMap = {};
      renderMessages();
    });
  }

  function bindFallbackOperationalNotifications() {
    if (!database) return;

    paymentsRef = database.ref('payments').limitToLast(100);
    paymentsRef.on('value', function (snapshot) {
      if (!snapshot.exists()) {
        renderNotifications();
        return;
      }

      var nextFallback = {};
      snapshot.forEach(function (child) {
        var value = child.val() || {};
        var status = normalizeText(value.status || value.verificationStatus || '');
        var pendingLike = (
          status === 'pending' ||
          status === 'under_review' ||
          status === 'for_verification' ||
          status === 'submitted'
        );
        if (!pendingLike) return;

        var studentName = value.studentName || value.fullName || 'Student';
        var amount = Number(value.amount || value.paidAmount || 0);
        var method = value.paymentMethod || value.paymentChannel || 'payment';
        var fallbackId = 'fallback-payment-' + child.key;

        nextFallback[fallbackId] = {
          id: fallbackId,
          type: 'payment',
          title: 'Payment Needs Review',
          message: studentName + ' submitted ' + method + ' payment' + (amount > 0 ? (' of Php ' + amount.toLocaleString()) : '') + '.',
          createdAt: Number(value.createdAt || value.submittedAt || value.updatedAt || Date.now())
        };
      });

      Object.keys(fallbackNotificationMap).forEach(function (id) {
        if (id.indexOf('fallback-payment-') === 0 && !nextFallback[id]) {
          delete fallbackNotificationMap[id];
        }
      });

      Object.keys(nextFallback).forEach(function (id) {
        fallbackNotificationMap[id] = nextFallback[id];
      });

      renderNotifications();
    }, function () {
      renderNotifications();
    });

    enrollmentsRef = database.ref('enrollments').limitToLast(100);
    enrollmentsRef.on('value', function (snapshot) {
      if (!snapshot.exists()) {
        renderNotifications();
        return;
      }

      var nextFallback = {};
      snapshot.forEach(function (child) {
        var value = child.val() || {};
        var status = normalizeText(value.status || value.applicationStatus || '');
        var pendingLike = (
          status === 'pending' ||
          status === 'new' ||
          status === 'submitted' ||
          status === 'for_review'
        );
        if (!pendingLike) return;

        var studentName = value.studentName || value.fullName || 'Applicant';
        var course = value.course || value.courseName || 'course';
        var fallbackId = 'fallback-enrollment-' + child.key;

        nextFallback[fallbackId] = {
          id: fallbackId,
          type: 'enrollment',
          title: 'Enrollment Pending',
          message: studentName + ' has a pending enrollment for ' + course + '.',
          createdAt: Number(value.createdAt || value.submittedAt || value.updatedAt || Date.now())
        };
      });

      Object.keys(fallbackNotificationMap).forEach(function (id) {
        if (id.indexOf('fallback-enrollment-') === 0 && !nextFallback[id]) {
          delete fallbackNotificationMap[id];
        }
      });

      Object.keys(nextFallback).forEach(function (id) {
        fallbackNotificationMap[id] = nextFallback[id];
      });

      renderNotifications();
    }, function () {
      renderNotifications();
    });
  }

  window.markNotifRead = function (notifId, element) {
    if (notifId && notifId.indexOf('fallback-') === 0) {
      fallbackReadState[notifId] = true;
      saveFallbackReadState();
      if (element) element.classList.remove('dropdown-item--unread');
      renderNotifications();
      return;
    }

    var notif = notificationMap[notifId];
    if (!notif || !database) return;
    database.ref('notifications/' + notifId).update({ read: true, readAt: Date.now() });
    if (element) element.classList.remove('dropdown-item--unread');
  };

  window.markAllRead = function () {
    var hasChanges = false;

    if (database) {
      var updates = {};
      Object.keys(notificationMap).forEach(function (id) {
        if (!notificationMap[id].read) {
          updates[id + '/read'] = true;
          updates[id + '/readAt'] = Date.now();
        }
      });
      if (Object.keys(updates).length > 0) {
        database.ref('notifications').update(updates);
        hasChanges = true;
      }
    }

    Object.keys(fallbackNotificationMap).forEach(function (id) {
      if (!fallbackReadState[id]) {
        fallbackReadState[id] = true;
        hasChanges = true;
      }
    });
    saveFallbackReadState();

    if (hasChanges) {
      renderNotifications();
      notifyInfo('All notifications marked as read.');
    }
  };

  window.openMessage = function (messageId, element) {
    var msg = messageMap[messageId];
    if (!msg) {
      notifyInfo('No message details available.');
      return;
    }

    if (database && !msg.read) {
      database.ref('messages/' + messageId).update({ read: true, readAt: Date.now() });
    }

    if (element) element.classList.remove('dropdown-item--unread');

    var title = (msg.subject || msg.title || 'Message').trim();
    var body = (msg.message || msg.body || '').trim();
    if (typeof window.showAlert === 'function') {
      window.showAlert(title, body || 'No message body.', 'info');
    } else {
      notifyInfo((title ? title + ': ' : '') + (body || 'No message body.'));
    }
  };

  window.viewAllMessages = function () {
    var count = Object.keys(messageMap).length;
    if (count === 0) {
      notifyInfo('No messages available.');
      return;
    }
    notifyInfo('You have ' + count + ' message(s). Open any message in the dropdown.');
  };

  var msgComposerSending = false;
  var msgComposerStudentsLoaded = false;

  function ensureMsgComposer() {
    if (byId('msgComposerOverlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'msg-composer-overlay';
    overlay.id = 'msgComposerOverlay';
    overlay.innerHTML = ''
      + '<div class="msg-composer" role="dialog" aria-modal="true" aria-labelledby="msgComposerTitle">'
      + '<div class="msg-composer__header">'
      + '<div class="msg-composer__heading">'
      + '<h3 id="msgComposerTitle">Send Message</h3>'
      + '<p>Message a single student or every student at once. Messages appear in their portal Messages inbox.</p>'
      + '</div>'
      + '<button type="button" class="msg-composer__close" onclick="closeMsgComposer()" aria-label="Close composer">'
      + '<iconify-icon icon="mdi:close"></iconify-icon>'
      + '</button>'
      + '</div>'
      + '<div class="msg-composer__body">'
      + '<label class="msg-composer__label" for="msgComposerRecipient">Recipient</label>'
      + '<select class="msg-composer__select" id="msgComposerRecipient">'
      + '<option value="all">All students</option>'
      + '</select>'
      + '<label class="msg-composer__label" for="msgComposerSubject">Subject</label>'
      + '<input type="text" class="msg-composer__input" id="msgComposerSubject" maxlength="120" placeholder="e.g. Schedule adjustment for your class" />'
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

  function loadComposerStudentOptions() {
    if (msgComposerStudentsLoaded || !database) return;

    var select = byId('msgComposerRecipient');
    if (!select) return;

    database.ref('students').once('value').then(function (snapshot) {
      var options = [];
      if (snapshot.exists()) {
        snapshot.forEach(function (child) {
          var data = child.val() || {};
          if (data.isDeleted === true) return;
          var profile = data.profile || {};
          var name = String(profile.fullName || data.name || '').trim();
          var email = String(profile.email || '').trim();
          if (!name && !email) return;
          options.push({ uid: child.key, label: (name || 'Student') + (email ? ' (' + email + ')' : '') });
        });
      }

      options.sort(function (a, b) {
        return a.label.localeCompare(b.label);
      });

      options.forEach(function (option) {
        var el = document.createElement('option');
        el.value = option.uid;
        el.textContent = option.label;
        select.appendChild(el);
      });

      msgComposerStudentsLoaded = true;
    }).catch(function () {
      // Keep the "All students" option if the roster cannot be loaded.
    });
  }

  window.openMsgComposer = function () {
    if (!adminId && !adminEmail) {
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
    loadComposerStudentOptions();
    var subjectInput = byId('msgComposerSubject');
    if (subjectInput) subjectInput.focus();
  };

  window.closeMsgComposer = function () {
    var overlay = byId('msgComposerOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  function buildComposedPayload(subject, body, recipientUid, recipientEmail) {
    return {
      subject: subject,
      message: body,
      senderUid: adminId,
      senderName: String(sessionStorage.getItem('adminDisplayName') || 'Admin').trim() || 'Admin',
      senderEmail: adminEmail,
      senderRole: 'admin',
      recipientUid: recipientUid || '',
      recipientEmail: recipientEmail || '',
      recipientRole: 'student',
      read: false,
      createdAt: Date.now()
    };
  }

  window.sendComposedMessage = function () {
    if (msgComposerSending) return;

    var recipientSelect = byId('msgComposerRecipient');
    var subjectInput = byId('msgComposerSubject');
    var bodyInput = byId('msgComposerBody');
    if (!recipientSelect || !subjectInput || !bodyInput) return;

    var subject = subjectInput.value.trim();
    var body = bodyInput.value.trim();
    var recipient = recipientSelect.value;

    if (!subject || !body) {
      notifyInfo('Subject and message are both required.');
      return;
    }
    if (!database) {
      notifyInfo('Unable to reach the database. Please try again.');
      return;
    }

    msgComposerSending = true;
    var sendBtn = byId('msgComposerSend');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
    }

    function finish(success, successText) {
      msgComposerSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Message';
      }
      if (success) {
        subjectInput.value = '';
        bodyInput.value = '';
        closeMsgComposer();
        notifyInfo(successText);
      } else {
        notifyInfo('Failed to send the message. Please try again.');
      }
    }

    if (recipient === 'all') {
      database.ref('students').once('value').then(function (snapshot) {
        var updates = {};
        var count = 0;
        if (snapshot.exists()) {
          snapshot.forEach(function (child) {
            var data = child.val() || {};
            if (data.isDeleted === true) return;
            var profile = data.profile || {};
            var email = String(profile.email || '').trim().toLowerCase();
            var key = database.ref('messages').push().key;
            updates['messages/' + key] = buildComposedPayload(subject, body, child.key, email);
            count += 1;
          });
        }

        if (!count) {
          finish(false);
          return;
        }

        database.ref().update(updates).then(function () {
          finish(true, 'Message sent to ' + count + ' student' + (count === 1 ? '' : 's') + '.');
        }).catch(function () {
          finish(false);
        });
      }).catch(function () {
        finish(false);
      });
      return;
    }

    var selectedOption = recipientSelect.options[recipientSelect.selectedIndex];
    var emailMatch = /\(([^()]+@[^()]+)\)/.exec(String(selectedOption ? selectedOption.textContent : ''));
    var recipientEmail = emailMatch ? emailMatch[1].trim().toLowerCase() : '';

    database.ref('messages').push(buildComposedPayload(subject, body, recipient, recipientEmail)).then(function () {
      finish(true, 'Message sent to the selected student.');
    }).catch(function () {
      finish(false);
    });
  };

  window.toggleDropdown = function (id) {
    var dropdown = byId(id);
    if (!dropdown) return;
    var isActive = dropdown.classList.contains('active');

    document.querySelectorAll('.header-dropdown').forEach(function (el) {
      el.classList.remove('active');
    });
    document.querySelectorAll('.icon-btn').forEach(function (el) {
      el.classList.remove('icon-btn--active');
    });

    if (!isActive) {
      dropdown.classList.add('active');
      var button = byId(id === 'notifDropdown' ? 'notifBtn' : 'msgBtn');
      if (button) button.classList.add('icon-btn--active');
    }
  };

  if (!window.__unmeiAdminHeaderDropdownBound) {
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.icon-btn') && !event.target.closest('.header-dropdown')) {
        document.querySelectorAll('.header-dropdown').forEach(function (el) {
          el.classList.remove('active');
        });
        document.querySelectorAll('.icon-btn').forEach(function (el) {
          el.classList.remove('icon-btn--active');
        });
      }
    });
    window.__unmeiAdminHeaderDropdownBound = true;
  }

  if (!window.__unmeiAdminSearchDismissBound) {
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

    window.__unmeiAdminSearchDismissBound = true;
  }

  function startSync() {
    adminId = sessionStorage.getItem('adminId') || '';
    adminEmail = sessionStorage.getItem('adminEmail') || '';

    if (!adminId && !adminEmail) {
      return;
    }

    loadFallbackReadState();

    if (typeof window.firebase === 'undefined' || !window.firebase.database) {
      setTimeout(startSync, 200);
      return;
    }

    database = window.firebase.database();
    bindNotifications();
    bindMessages();
    bindFallbackOperationalNotifications();
  }

  function showAdminSignOutConfirm(onConfirm) {
    var existing = document.getElementById('unmeiAdminSignOutConfirm');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'unmeiAdminSignOutConfirm';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);backdrop-filter:blur(2px);font-family:inherit;';
    overlay.innerHTML = ''
      + '<div role="dialog" aria-modal="true" aria-label="Confirm sign out" style="background:#fff;border-radius:16px;box-shadow:0 24px 48px rgba(15,23,42,0.25);max-width:360px;width:calc(100% - 40px);padding:28px 26px 22px;text-align:center;">'
      + '<div style="width:56px;height:56px;border-radius:50%;background:#1F2937;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">'
      + '<iconify-icon icon="mdi:logout" style="font-size:28px;color:#ffffff;"></iconify-icon></div>'
      + '<h3 style="margin:0 0 8px;font-size:1.05rem;font-weight:700;color:#111827;">Sign out of the Admin Portal?</h3>'
      + '<p style="margin:0 0 22px;font-size:0.85rem;color:#6B7280;line-height:1.5;">Your admin session will end. You will need to sign in again to manage students, courses, and payments.</p>'
      + '<div style="display:flex;gap:10px;">'
      + '<button type="button" id="unmeiAdminSignOutCancel" style="flex:1;padding:11px 0;border:1.5px solid #E5E7EB;border-radius:10px;background:#fff;color:#374151;font-weight:600;font-size:0.85rem;cursor:pointer;">Cancel</button>'
      + '<button type="button" id="unmeiAdminSignOutOk" style="flex:1;padding:11px 0;border:none;border-radius:10px;background:#1F2937;color:#fff;font-weight:600;font-size:0.85rem;cursor:pointer;">Sign Out</button>'
      + '</div></div>';
    document.body.appendChild(overlay);

    var close = function () { overlay.remove(); };
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    overlay.querySelector('#unmeiAdminSignOutCancel').addEventListener('click', close);
    overlay.querySelector('#unmeiAdminSignOutOk').addEventListener('click', function () {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  window.__adminSignOut = function () {
    showAdminSignOutConfirm(function () {
      sessionStorage.clear();
      window.location.href = 'admin-login.html';
    });
  };

  function initAdminAvatarDropdown() {
    var userEl = document.querySelector('.topbar__user');
    if (!userEl || userEl.dataset.dropdownReady) return;
    userEl.dataset.dropdownReady = 'true';

    var name = sessionStorage.getItem('adminDisplayName') || (document.querySelector('.user-name') ? document.querySelector('.user-name').textContent : 'Admin');
    var email = sessionStorage.getItem('adminEmail') || 'admin@unmei-ph.com';

    var menu = document.createElement('div');
    menu.className = 'avatar-menu';
    menu.id = 'adminAvatarMenu';
    menu.innerHTML = 
      '<div class="avatar-menu__header">' +
        '<div class="user-avatar user-avatar--red" style="background:var(--red);color:#fff;font-weight:700;">AD</div>' +
        '<div style="min-width:0;flex:1;">' +
          '<div class="avatar-menu__name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
          '<div class="avatar-menu__email" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + email + '</div>' +
        '</div>' +
      '</div>' +
      '<a class="avatar-menu__item" href="admin-dashboard.html"><iconify-icon icon="mdi:view-dashboard"></iconify-icon> Dashboard</a>' +
      '<a class="avatar-menu__item" href="admin-courses.html"><iconify-icon icon="mdi:card-text-outline"></iconify-icon> Course Management</a>' +
      '<a class="avatar-menu__item" href="admin-students.html"><iconify-icon icon="mdi:account-group-outline"></iconify-icon> Student Records</a>' +
      '<a class="avatar-menu__item" href="admin-portal-settings.html"><iconify-icon icon="mdi:cog-outline"></iconify-icon> Portal Settings</a>';

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
    applyAdminLogoAvatars();
    bindAdminAvatarObserver();
    ensureHeaderActionWidgets();
    initAdminAvatarDropdown();
    initAdminGlobalSearch();
    startSync();
  }

  window.addEventListener('beforeunload', function () {
    if (notificationsRef) notificationsRef.off();
    if (messagesRef) messagesRef.off();
    if (paymentsRef) paymentsRef.off();
    if (enrollmentsRef) enrollmentsRef.off();
    if (adminAvatarObserver) adminAvatarObserver.disconnect();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
