(function(){
  var pages = [
    {href:'../wiki.html', file:'wiki.html', label:'Home & overview', short:'Home', group:'Overview', icon:'seal', status:'Complete', tone:'complete', percent:94, facts:[['Target','Build 254'],['Date','7 Sep 2004'],['Read first','Coverage index']], verdict:'The whole audit starts here: definitions, implementation coverage, known gaps, and non-canonical additions.'},
    {href:'quests.html', file:'quests.html', label:'1 Quests', short:'Quests', group:'Gameplay coverage', icon:'scroll', status:'Complete', tone:'complete', percent:100, facts:[['Coverage','56 / 56'],['Bonus','2 miniquests'],['Caveat','Minor edge bugs']], verdict:'Every cutoff-date quest is implemented and reward-complete; Tai Bwo Wannai Trio is correctly absent.'},
    {href:'skills.html', file:'skills.html', label:'2 Skills', short:'Skills', group:'Gameplay coverage', icon:'skill', status:'Complete', tone:'complete', percent:100, facts:[['Coverage','19 / 19'],['Post-2004','Absent'],['Disabled slots','2 reserved']], verdict:'All period skills are present, with no anachronistic skill enabled.'},
    {href:'magic-prayer.html', file:'magic-prayer.html', label:'3 Magic & Prayer', short:'Magic & Prayer', group:'Gameplay coverage', icon:'prayer', status:'Partial', tone:'partial', percent:83, facts:[['Magic','Period-complete'],['Prayer','15 / 18'],['Missing','3 prayers']], verdict:'The standard spellbook is period-complete; three Priest in Peril prayers are missing.'},
    {href:'npcs.html', file:'npcs.html', label:'4 NPCs & dialogue', short:'NPCs', group:'Gameplay coverage', icon:'npc', status:'Mixed', tone:'partial', percent:89, facts:[['Placed NPCs','988'],['Scripted talk','~89%'],['Dead ends','27']], verdict:'NPC placement is broad and dialogue coverage is high, but some Talk-to options still dead-end.'},
    {href:'shops.html', file:'shops.html', label:'5 Shops & economy', short:'Shops', group:'Gameplay coverage', icon:'coin', status:'Complete', tone:'complete', percent:100, facts:[['Stocked shops','~74'],['Shopkeepers','99'],['Engine','Dynamic prices']], verdict:'The shop engine and regional stock coverage are both strong for the target period.'},
    {href:'drops.html', file:'drops.html', label:'6 Drop tables', short:'Drops', group:'Gameplay coverage', icon:'bag', status:'Complete', tone:'complete', percent:100, facts:[['Attackable defs','362'],['Scripted defs','105'],['Default defs','257']], verdict:'Every attackable NPC definition is catalogued with either a scripted table or the generic default death drop.'},
    {href:'minigames.html', file:'minigames.html', label:'7 Minigames', short:'Minigames', group:'Gameplay coverage', icon:'flag', status:'Complete', tone:'complete', percent:100, facts:[['Coverage','7 / 7'],['Castle Wars','Absent'],['Trawler','Stateful']], verdict:'All period minigames checked in the audit are implemented; later Castle Wars is correctly absent.'},
    {href:'areas.html', file:'areas.html', label:'8 World & areas', short:'Areas', group:'Gameplay coverage', icon:'map', status:'Complete', tone:'complete', percent:100, facts:[['Area folders','37'],['Sampled','10 regions'],['Empty samples','0']], verdict:'The sampled world areas have meaningful scripts and placement rather than bare map shells.'},
    {href:'misc.html', file:'misc.html', label:'9 Tutorial, random events & UI systems', short:'Tutorial & UI', group:'Gameplay coverage', icon:'spark', status:'Complete', tone:'complete', percent:100, facts:[['Tutorial','Complete'],['Events','19'],['Music','Mapped']], verdict:'Tutorial Island, random events, doors, ladders, music, and level-up systems are substantively wired.'},
    {href:'engine.html', file:'engine.html', label:'10 Engine systems', short:'Engine', group:'Technical audit', icon:'gear', status:'Audited', tone:'extra', percent:100, facts:[['Revision','254'],['VM','Script-driven'],['Scope','Plumbing']], verdict:'The engine supplies reusable primitives; most game-specific rules live in content scripts.'},
    {href:'anachronism.html', file:'anachronism.html', label:'11 Anachronism check', short:'Anachronisms', group:'Technical audit', icon:'warn', status:'Flagged', tone:'flag', percent:95, facts:[['Flags','1'],['Post-cutoff','Checked'],['Evidence','Explicit']], verdict:'The audit calls out systems that do not belong in a faithful 7 September 2004 target.'},
    {href:'progressive.html', file:'progressive.html', label:'12 Progressive-only additions', short:'Progressive additions', group:'Audit flags', icon:'plus', status:'Extra', tone:'extra', percent:100, facts:[['Layer','Non-canonical'],['Hiscores','Era-inspired'],['Bots','Progressive-only']], verdict:'These features are useful project additions, but they are not 2004 RuneScape mechanics.'},
    {href:'unaudited.html', file:'unaudited.html', label:'13 Previously unaudited subsystems', short:'Unaudited systems', group:'Audit flags', icon:'lens', status:'Follow-up', tone:'flag', percent:88, facts:[['Scope','Closed gap'],['Security','Flagged'],['Method','Second pass']], verdict:'This page documents follow-up coverage for folders the original gameplay audit skipped.'},
    {href:'bugs.html', file:'bugs.html', label:'14 Known bugs & rough edges', short:'Known bugs', group:'Audit flags', icon:'warn', status:'Needs fixes', tone:'missing', percent:68, facts:[['Role','Fix backlog'],['Evidence','Line-level'],['Changes','None here']], verdict:'Known problems are recorded as future repair work, with evidence kept separate from claims of coverage.'},
    {href:'plugins.html', file:'plugins.html', label:'15 Plugins', short:'Plugins', group:'Tools & reference', icon:'plug', status:'Reference', tone:'extra', percent:100, facts:[['Launcher','Menu 14'],['Toggle','A / D / B'],['Scope','Custom content']], verdict:'A practical reference for the launcher plugin toggles and what each optional module changes.'},
    {href:'commands.html', file:'commands.html', label:'16 Commands', short:'Commands', group:'Tools & reference', icon:'terminal', status:'Risky', tone:'missing', percent:100, facts:[['Core','41'],['Debug procs','235'],['Prefix','::~']], verdict:'The command catalogue is complete, but many admin and debug commands can permanently alter accounts.'}
  ];

  var currentPage = (window.location.pathname.split('/').pop() || 'wiki.html').toLowerCase();
  var isHome = currentPage === 'wiki.html' || currentPage === '';
  document.body.classList.add(isHome ? 'home-page' : 'manual-page');

  function pageNameFromHref(href){
    if(!href) return '';
    var cleaned = href.split('#')[0].split('?')[0];
    return cleaned.split('/').pop().toLowerCase();
  }

  function findPageByFile(file){
    for(var i = 0; i < pages.length; i++){
      if(pages[i].file === file) return pages[i];
    }
    return pages[0];
  }

  function makeEl(tag, className, text){
    var el = document.createElement(tag);
    if(className) el.className = className;
    if(text !== undefined) el.textContent = text;
    return el;
  }

  var currentMeta = findPageByFile(isHome ? 'wiki.html' : currentPage);

  function implementationBand(percent){
    if(percent >= 90) return 'green';
    if(percent >= 70) return 'blue';
    if(percent >= 40) return 'orange';
    return 'red';
  }

  function implementationText(page){
    return page.percent + '% implemented';
  }

  function implementationClass(page){
    return 'implementation-score impl-' + implementationBand(page.percent);
  }

  function iconEmoji(icon){
    var emojis = {
      seal:'🏠',
      scroll:'📜',
      skill:'⚔️',
      prayer:'✨',
      npc:'💬',
      coin:'🪙',
      bag:'🎲',
      flag:'🏁',
      map:'🗺️',
      spark:'🎵',
      gear:'⚙️',
      warn:'⚠️',
      plus:'➕',
      lens:'🔎',
      plug:'🔌',
      terminal:'⌨️'
    };
    return emojis[icon] || '•';
  }

  function buildHeaderLinks(){
    var headerLinks = document.querySelector('.header-links');
    if(!headerLinks) return;
    headerLinks.innerHTML = '';
    [
      findPageByFile('wiki.html'),
      findPageByFile('quests.html'),
      findPageByFile('skills.html'),
      findPageByFile('bugs.html'),
      findPageByFile('commands.html')
    ].forEach(function(page){
      var link = makeEl('a', '', page.short === 'Home' ? 'Main page' : page.short);
      link.href = page.href;
      headerLinks.appendChild(link);
    });
  }

  function buildMobileNav(){
    var mobilePageNav = document.getElementById('mobilePageNav');
    if(!mobilePageNav) return;
    mobilePageNav.innerHTML = '';
    pages.forEach(function(page){
      var option = makeEl('option', '', page.file === 'wiki.html' ? 'Home' : page.label);
      option.value = page.href;
      option.selected = page.file === currentMeta.file;
      mobilePageNav.appendChild(option);
    });
    mobilePageNav.addEventListener('change', function(){
      if(mobilePageNav.value) window.location.href = mobilePageNav.value;
    });
  }

  function buildSidebar(){
    var sidebarNav = document.getElementById('sidebarnav');
    if(!sidebarNav) return;
    sidebarNav.innerHTML = '';
    var groups = {};
    pages.forEach(function(page){
      if(!groups[page.group]) groups[page.group] = [];
      groups[page.group].push(page);
    });
    Object.keys(groups).forEach(function(group){
      sidebarNav.appendChild(makeEl('div', 'navlabel', group));
      var list = makeEl('ul', 'navgroup');
      groups[group].forEach(function(page){
        var item = makeEl('li');
        item.setAttribute('data-title', page.label + ' ' + page.short + ' ' + page.status + ' ' + page.group + ' ' + implementationText(page));
        var link = makeEl('a', page.file === currentMeta.file ? 'active' : '', page.label);
        link.href = page.href;
        link.setAttribute('data-icon', page.icon);
        link.setAttribute('data-emoji', iconEmoji(page.icon));
        if(page.file === currentMeta.file) link.setAttribute('aria-current', 'page');
        if(page.file === 'wiki.html') link.classList.add('home-item');
        item.appendChild(link);
        list.appendChild(item);
      });
      sidebarNav.appendChild(list);
    });
    sidebarNav.appendChild(makeEl('div', 'navlabel', currentMeta.file === 'commands.html' ? 'Command facts' : 'Quick facts'));
    var factbox = makeEl('div', 'factbox');
    if(!isHome){
      var implementationRow = makeEl('div', 'frow');
      implementationRow.appendChild(makeEl('dt', '', 'Implemented'));
      var implementationValue = makeEl('dd', implementationClass(currentMeta), implementationText(currentMeta));
      implementationRow.appendChild(implementationValue);
      factbox.appendChild(implementationRow);
    }
    currentMeta.facts.forEach(function(row){
      var wrap = makeEl('div', 'frow');
      wrap.appendChild(makeEl('dt', '', row[0]));
      wrap.appendChild(makeEl('dd', '', row[1]));
      factbox.appendChild(wrap);
    });
    sidebarNav.appendChild(factbox);
  }

  function markActiveHeaderLinks(){
    Array.prototype.forEach.call(document.querySelectorAll('.header-links a'), function(link){
      var target = pageNameFromHref(link.getAttribute('href'));
      var matchesHome = isHome && (target === 'wiki.html' || target === '');
      var matchesPage = !isHome && target === currentPage;
      if(matchesHome || matchesPage){
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  function injectImplementationTitle(){
    if(isHome) return;
    var title = document.querySelector('h1.pagetitle');
    if(!title || title.querySelector('.implementation-score')) return;
    title.appendChild(document.createTextNode(' - '));
    title.appendChild(makeEl('span', implementationClass(currentMeta), implementationText(currentMeta)));
  }

  function injectPageSummary(){
    if(isHome) return;
    var byline = document.querySelector('.byline');
    if(!byline || document.querySelector('.page-summary')) return;
    var panel = makeEl('aside', 'page-summary ' + currentMeta.tone);
    var head = makeEl('div', 'summary-head');
    var icon = makeEl('span', 'asset-icon ' + currentMeta.icon);
    icon.setAttribute('aria-hidden', 'true');
    head.appendChild(icon);
    var titleWrap = makeEl('div');
    titleWrap.appendChild(makeEl('div', 'summary-label', 'Coverage notes'));
    titleWrap.appendChild(makeEl('p', 'summary-verdict', currentMeta.verdict));
    head.appendChild(titleWrap);
    var pill = makeEl('span', 'pill ' + currentMeta.tone, currentMeta.status);
    head.appendChild(pill);
    panel.appendChild(head);
    var facts = makeEl('dl', 'summary-facts');
    var implementationFact = makeEl('div', 'summary-fact implementation-fact');
    implementationFact.appendChild(makeEl('dt', '', 'Implemented'));
    implementationFact.appendChild(makeEl('dd', implementationClass(currentMeta), implementationText(currentMeta)));
    facts.appendChild(implementationFact);
    currentMeta.facts.forEach(function(row){
      var fact = makeEl('div', 'summary-fact');
      fact.appendChild(makeEl('dt', '', row[0]));
      fact.appendChild(makeEl('dd', '', row[1]));
      facts.appendChild(fact);
    });
    panel.appendChild(facts);
    byline.insertAdjacentElement('afterend', panel);
  }

  function injectStatusLegend(){
    return;
    var target = isHome ? document.querySelector('.audit-dashboard') : document.querySelector('.page-summary');
    if(!target || document.querySelector('.status-legend')) return;
    var legend = makeEl('div', 'status-legend');
    legend.setAttribute('aria-label', 'Status legend');
    [
      ['complete','Complete'],
      ['partial','Partial'],
      ['missing','Needs fixes'],
      ['extra','Extra/reference'],
      ['flag','Flagged']
    ].forEach(function(item){
      legend.appendChild(makeEl('span', 'legend-item ' + item[0], item[1]));
    });
    target.insertAdjacentElement('afterend', legend);
  }

  function groupHomepageCards(){
    var grid = document.querySelector('.section-grid');
    if(!grid || grid.classList.contains('grouped')) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.section-card'));
    var groupedWrap = makeEl('div', 'coverage-groups');
    var groups = {};
    pages.forEach(function(page){
      if(page.file === 'wiki.html') return;
      if(!groups[page.group]) groups[page.group] = [];
      groups[page.group].push(page);
    });
    Object.keys(groups).forEach(function(group){
      var section = makeEl('section', 'card-group');
      section.appendChild(makeEl('h3', 'group-title', group));
      var inner = makeEl('div', 'section-grid grouped');
      groups[group].forEach(function(page){
        var card = cards.filter(function(item){ return pageNameFromHref(item.getAttribute('href')) === page.file; })[0];
        if(card){
          card.setAttribute('data-group', group);
          card.setAttribute('data-status', page.status);
          card.setAttribute('data-icon', page.icon);
          card.setAttribute('data-implemented', implementationText(page));
          var badge = card.querySelector('.section-number');
          if(badge){
            badge.textContent = implementationText(page);
            badge.className = 'section-number ' + implementationClass(page);
          }
          inner.appendChild(card);
        }
      });
      section.appendChild(inner);
      groupedWrap.appendChild(section);
    });
    grid.parentNode.replaceChild(groupedWrap, grid);
  }

  function refreshQuestAccessRows(table){
    if(!table) return;
    Array.prototype.forEach.call(table.querySelectorAll('.quest-access-row'), function(header){
      var row = header.nextElementSibling;
      var hasVisibleQuest = false;
      while(row && !row.classList.contains('quest-access-row')){
        if(!row.classList.contains('hidden-by-filter') && !row.classList.contains('hidden-by-search')){
          hasVisibleQuest = true;
          break;
        }
        row = row.nextElementSibling;
      }
      header.classList.toggle('hidden-by-group', !hasVisibleQuest);
    });
  }

  function splitQuestRowsByAccess(){
    if(currentMeta.file !== 'quests.html') return;
    var table = document.getElementById('quest-table');
    if(!table) return;
    var tbody = table.querySelector('tbody');
    if(!tbody || tbody.querySelector('.quest-access-row')) return;

    var nonMembers = {
      'cooks-assistant.html':true,
      'demon-slayer.html':true,
      'restless-ghost.html':true,
      'romeo-and-juliet.html':true,
      'sheep-shearer.html':true,
      'shield-of-arrav.html':true,
      'ernest-the-chicken.html':true,
      'vampyre-slayer.html':true,
      'imp-catcher.html':true,
      'prince-ali-rescue.html':true,
      'dorics-quest.html':true,
      'black-knights-fortress.html':true,
      'the-knights-sword.html':true,
      'goblin-diplomacy.html':true,
      'pirates-treasure.html':true,
      'dragon-slayer.html':true,
      'rune-mysteries.html':true,
      'witchs-potion.html':true
    };

    var memberRows = [];
    var nonMemberRows = [];
    Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function(row){
      var questLink = row.querySelector('td:nth-child(2) a[href]');
      var questFile = questLink ? pageNameFromHref(questLink.getAttribute('href')) : '';
      var access = nonMembers[questFile] ? 'non-members' : 'members';
      row.setAttribute('data-access', access);
      (access === 'members' ? memberRows : nonMemberRows).push(row);
    });

    function makeAccessRow(label, count, access){
      var row = makeEl('tr', 'quest-access-row');
      row.setAttribute('data-access', access);
      var cell = makeEl('td', 'quest-access-cell');
      cell.colSpan = 4;
      cell.appendChild(makeEl('strong', '', label));
      cell.appendChild(makeEl('span', 'quest-access-count', count + ' quests'));
      row.appendChild(cell);
      return row;
    }

    tbody.innerHTML = '';
    tbody.appendChild(makeAccessRow('Members', memberRows.length, 'members'));
    memberRows.forEach(function(row){ tbody.appendChild(row); });
    tbody.appendChild(makeAccessRow('Non-members', nonMemberRows.length, 'non-members'));
    nonMemberRows.forEach(function(row){ tbody.appendChild(row); });
  }

  function setupQuestFilter(){
    Array.prototype.forEach.call(document.querySelectorAll('.filters'), function(filterGroup){
      var table = filterGroup.parentElement && filterGroup.parentElement.querySelector('table');
      if(!table) return;
      var buttons = filterGroup.querySelectorAll('button');
      var rows = table.querySelectorAll('tbody tr');
      Array.prototype.forEach.call(buttons, function(button){
        button.addEventListener('click', function(){
          Array.prototype.forEach.call(buttons, function(item){ item.classList.remove('active'); });
          button.classList.add('active');
          var filter = button.getAttribute('data-filter');
          Array.prototype.forEach.call(rows, function(row){
            if(row.classList.contains('quest-access-row')) return;
            row.classList.toggle('hidden-by-filter', filter !== 'all' && row.getAttribute('data-status') !== filter);
          });
          refreshQuestAccessRows(table);
        });
      });
    });
  }

  function setupTableTools(){
    Array.prototype.forEach.call(document.querySelectorAll('.table-wrap'), function(wrap, index){
      var table = wrap.querySelector('table');
      if(!table || wrap.previousElementSibling && wrap.previousElementSibling.classList && wrap.previousElementSibling.classList.contains('table-tools')) return;
      table.classList.add('enhanced-table');
      Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(row){
        Array.prototype.forEach.call(row.children, function(cell, cellIndex){
          var th = table.querySelector('thead th:nth-child(' + (cellIndex + 1) + ')');
          if(th) cell.setAttribute('data-label', th.textContent.trim());
        });
      });

      var toolbar = makeEl('div', 'table-tools');
      var search = makeEl('input', 'table-search');
      search.type = 'search';
      search.placeholder = 'Search this table';
      search.setAttribute('aria-label', 'Search this table');
      toolbar.appendChild(search);

      if(currentMeta.file === 'commands.html'){
        var risky = makeEl('button', 'risk-toggle', 'Risky only');
        risky.type = 'button';
        toolbar.appendChild(risky);
        risky.addEventListener('click', function(){
          risky.classList.toggle('active');
          filterTable();
        });
      }

      var collapse = makeEl('button', 'collapse-toggle', 'Collapse');
      collapse.type = 'button';
      toolbar.appendChild(collapse);
      wrap.parentNode.insertBefore(toolbar, wrap);

      function filterTable(){
        var query = search.value.trim().toLowerCase();
        var riskyOnly = toolbar.querySelector('.risk-toggle.active');
        Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(row){
          if(row.classList.contains('quest-access-row')) return;
          var text = row.textContent.toLowerCase();
          var matchesSearch = !query || text.indexOf(query) !== -1;
          var matchesRisk = !riskyOnly || /clear|reset|delete|ban|mute|kick|reboot|damage|kill|poison|drop|teleother|giveother|permanent/.test(text);
          row.classList.toggle('hidden-by-search', !matchesSearch || !matchesRisk);
        });
        refreshQuestAccessRows(table);
      }

      search.addEventListener('input', filterTable);
      collapse.addEventListener('click', function(){
        var collapsed = wrap.classList.toggle('collapsed');
        collapse.textContent = collapsed ? 'Expand' : 'Collapse';
      });
    });
  }

  function setupGlobalSearch(){
    var searchInput = document.getElementById('wikisearch');
    var navItems = Array.prototype.slice.call(document.querySelectorAll('#sidebarnav li'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('.section-card'));
    var noResults = document.getElementById('noResults');
    if(!searchInput) return;
    searchInput.addEventListener('input', function(){
      var query = searchInput.value.trim().toLowerCase();
      navItems.forEach(function(item){
        var text = (item.getAttribute('data-title') || item.textContent).toLowerCase();
        item.classList.toggle('no-match', query.length > 0 && text.indexOf(query) === -1);
      });
      cards.forEach(function(card){
        var text = (card.getAttribute('data-search') || card.textContent).toLowerCase();
        card.classList.toggle('hidden', query.length > 0 && text.indexOf(query) === -1);
      });
      if(noResults){
        var visibleCards = cards.filter(function(card){ return !card.classList.contains('hidden'); });
        noResults.classList.toggle('show', query.length > 0 && visibleCards.length === 0);
      }
    });

    searchInput.addEventListener('keydown', function(event){
      if(event.key !== 'Enter') return;
      var visibleCard = cards.filter(function(card){ return !card.classList.contains('hidden'); })[0];
      if(visibleCard){
        window.location.href = visibleCard.getAttribute('href');
        return;
      }
      var visibleItem = navItems.filter(function(item){ return !item.classList.contains('no-match'); })[0];
      if(visibleItem){
        var link = visibleItem.querySelector('a');
        if(link) window.location.href = link.getAttribute('href');
      }
    });
  }

  buildHeaderLinks();
  buildMobileNav();
  buildSidebar();
  markActiveHeaderLinks();
  injectImplementationTitle();
  injectPageSummary();
  injectStatusLegend();
  groupHomepageCards();
  splitQuestRowsByAccess();
  setupQuestFilter();
  setupTableTools();
  setupGlobalSearch();
})();
