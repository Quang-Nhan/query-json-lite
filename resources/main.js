// TODO: https://stackoverflow.com/questions/75494793/using-es6-modules-in-vs-code-webview


(function () {
 
  const MAX_LIST_LENGTH = 20;
  const MAX_FAV_LIST_LENGTH = 5;
  const vscode = acquireVsCodeApi();
  const oldState = vscode.getState();
  const pathDom = document.querySelector('.path');
  const pathListDom = document.querySelector('.pathList');
  const favPathListDom = document.querySelector('.favPathList');
  const searchDom = document.querySelector('#search')
  const searchResultListDom = document.querySelector('.searchResultList');
  const cancelSearchIconDom = document.querySelector('.cancel');
  const runTimer = null;
  let isRunRequestDone = true;

  pathDom.value = oldState?.path?.length ? oldState?.path : '';
  searchDom.value = oldState?.search?.length ? oldState?.search : '';
  /**
   * build a new historyPaths state and update html dom when run path is clicked
   */
  const processHistoryPaths = (path, historyPaths) => {
    let pathCopy = path.slice();
    if (!pathCopy.replace(/\n|\r/g, '').trim().length || (vscode.getState()?.favHistoryPaths || []).includes(path)) {
      return historyPaths;
    }
    // remove duplicate html
    historyPaths = historyPaths.filter(val => val !== path);
    historyPaths.push(path);

    if (historyPaths.length > MAX_LIST_LENGTH) {
      historyPaths = historyPaths.slice(0, MAX_LIST_LENGTH);
    }

    let n = 0;
    // remove duplicate paths from html list
    for (let li of pathListDom.children) {
      if (li.firstElementChild.dataset.path.trim() === path.trim() || n >= MAX_LIST_LENGTH-1) {
        li.parentNode.removeChild(li);
      } else {
        n++;
      }
    }
    // add the new pathListItem
    doms.append.pathListItem(path);
    return historyPaths;
  }

  const hints = {
    'codicon-close': 'delete',
    'codicon-star-full': 'remove from favourites',
    'codicon-star-empty': 'add to favourites'
  }

  const doms = {
    create: {
      pathListItem: () => {
        const li = document.createElement('li');
        li.className = 'pathListItem';
        return li;
      },
      icons: () => {
        const div = document.createElement('div');
        div.className = 'icons';
        return div;
      },
      icon: () => {
        const div = document.createElement('div');
        div.className = 'icon';
        return div;
      },
      count: () => {
        const div = document.createElement('div');
        div.className = 'icon';
        return div;
      },
      codicon: (iconClass, handler) => {
        const codIcon = document.createElement('i');
        codIcon.classList = `codicon ${iconClass}`;
        codIcon.title = hints[iconClass];
        codIcon.addEventListener('click', handler);
        return codIcon;
      },
      histPath: (path, isFav) => {
        const div = document.createElement('div');
        // https://www.tutorialspoint.com/how-to-check-if-a-string-is-html-or-not-using-javascript
        if (/<([A-Za-z][A-Za-z0-9]*)((\b[^>]*>((.|(\r?\n))*?)<\/\1>)|(\/\>))/.test(path)) {
          div.innerText = path.replace(/\n|\r/g, '');
        } else {
          div.innerHTML = path;
        }
        div.dataset.path = path;
        div.dataset.fav = isFav ? 'y' : 'n'
        div.className = 'histPath';
        div.addEventListener('click', handlers.histPathClicked);
        return div;
      },
      favPathListItem: () => {
        const li = document.createElement('li');
        li.className = 'favPathListItem';
        return li;
      },
      searchResultWorkspaceItemList: () => {
        const li = document.createElement('li');
        li.className = 'searchResultWorkspaceItemList';
        return li;
      },
      workspaceName: (name) => {
        const div = document.createElement('div');
        div.className = 'workspaceName';
        div.dataset.name = name;
        div.textContent = name;
        return div;
      },
      fileName: (name, filePath, queryPath) => {
        const div = document.createElement('div');
        div.className = 'fileName';
        div.dataset.name = name;
        div.dataset.filePath = filePath;
        div.datasetqueryPath = queryPath;
        div.textContent = name;

        div.addEventListener('click', handlers.fileNameClicked);
        return div;
      },
      workspaceGroupList: () => {
        const ul = document.createElement('ul');
        ul.className = 'workspaceGroupList';
        return ul;
      },
      fileListItem: () => {
        const li = document.createElement('li');
        li.className = 'fileListItem';
        return li;
      },
      count: (count) => {
        const div = document.createElement('div');
        div.classList.add('count');
        div.setAttribute('data-count', count);
        div.textContent = count;
        return div;
      }
    },
    append: {
      pathListItem: (path) => {
        const li = doms.create.pathListItem();
        const histPathDiv = doms.create.histPath(path);
        const iconsDiv = doms.create.icons();
        const iconDiv1 = doms.create.icon();
        const iconDiv2 = doms.create.icon();
        const starCodIcon = doms.create.codicon('codicon-star-empty', handlers.starPathClicked);
        const closeCodIcon = doms.create.codicon('codicon-close', handlers.removePathClicked);

        iconDiv1.appendChild(starCodIcon);
        iconDiv2.appendChild(closeCodIcon);
        iconsDiv.appendChild(iconDiv1);
        iconsDiv.appendChild(iconDiv2);
        li.appendChild(histPathDiv);
        li.appendChild(iconsDiv);

        pathListDom.insertBefore(li, pathListDom.firstChild);
      },
      favPathListItem: (path) => {
        const li = doms.create.favPathListItem();
        const histPathDiv = doms.create.histPath(path, true);
        const iconsDiv = doms.create.icons();
        const iconDiv = doms.create.icon();
        const unstarCodIcon = doms.create.codicon('codicon-star-full', handlers.unstarPathClicked);

        iconDiv.appendChild(unstarCodIcon);
        iconsDiv.appendChild(iconDiv);
        li.appendChild(histPathDiv);
        li.appendChild(iconsDiv);

        favPathListDom.insertBefore(li, favPathListDom.firstChild);
      }
    },
    refresh: {
      searchResultList: () => {
        const searchResultState = vscode.getState()?.searchResult || {};
        const newList = [];
        Object.keys(searchResultState).sort().forEach(workspace => {
          const searchResultWorkspaceItemListDom = doms.create.searchResultWorkspaceItemList();
          const workspaceNameDom = doms.create.workspaceName(workspace);
          const workspaceGroupListDom = doms.create.workspaceGroupList();
          
          searchResultState[workspace].forEach(searchResult => {
            const fileListItemDom = doms.create.fileListItem();
            const fileNameDom = doms.create.fileName(searchResult.fileName, searchResult.filePath, searchResult.queryPath);
            const iconsDom = doms.create.icons();
            const countDom = doms.create.count(searchResult.count);
            const removeIcon = doms.create.icon();
            const removeCodIcon = doms.create.codicon('codicon-close', handlers.removeSearchFileClicked);
            
            removeIcon.appendChild(removeCodIcon);
            iconsDom.appendChild(countDom);
            iconsDom.appendChild(removeIcon);
            fileListItemDom.appendChild(fileNameDom);
            fileListItemDom.appendChild(iconsDom);
            workspaceGroupListDom.append(fileListItemDom);
          });
          searchResultWorkspaceItemListDom.appendChild(workspaceNameDom);
          searchResultWorkspaceItemListDom.appendChild(workspaceGroupListDom);
          newList.push(searchResultWorkspaceItemListDom);
        });
        
        searchResultListDom.replaceChildren(...newList);
      }
    },
    feedback: {
      update: (type, message = '') => {
        const feedbackDiv = document.querySelector('#feedback');
        if (type === 'reset') {
          feedbackDiv.innerText = '';
        } else {
          feedbackDiv.innerText = message;
          if (type === 'error') {
            feedbackDiv.classList.remove('warning');
            feedbackDiv.classList.add('error');
          } else if (type === 'warning') {
            feedbackDiv.classList.remove('error');
            feedbackDiv.classList.add('warning');
          }
        }
      }
    },
    spinner: {
      start: () => {
        const spinnerIconDiv = document.querySelector('.codicon-sync');
        spinnerIconDiv.classList.add('spin');
      },
      stop: () => {
        const spinnerIconDiv = document.querySelector('.codicon-sync');
        spinnerIconDiv.classList.remove('spin');
      }
    },
    runButton: {
      enable: () => {
        const runButton = document.querySelector('button.run');
        runButton.disabled = false;
      },
      disable: () => {
        const runButton = document.querySelector('button.run');
        runButton.disabled = true;
      }
    },
    hide: {
      domWithId: (id) => {
        const dom = document.getElementById(id);
        if (dom) {
          dom.classList.add('hide')
        }
      }
    },
    show: {
      domWithId: (id) => {
        const dom = document.getElementById(id);
        if (dom) {
          dom.classList.remove('hide');
        }
      }
    }
  };

  const handlers = {
    /**
     * handler when runPath button is clicked
     */
    runPathClicked: () => {
      try {
        const path = pathDom.value;
        const historyPaths = vscode.getState()?.historyPaths || [];
        const mode = vscode.getState()['mode']
        doms.feedback.update('reset');
        
        if (mode === 'search') {
          cancelSearchIconDom.addEventListener('click', handlers.cancelFindRequest);
          if (cancelSearchIconDom.classList.contains('invisible')) {
            cancelSearchIconDom.classList.toggle('invisible');
          }

          vscode.setState({
            ...vscode.getState(),
            path,
            search: searchDom.value,
            searchResult: {}
          });
      
          doms.refresh.searchResultList();

          vscode.postMessage({
            type: 'search',
            path,
            searchFiles: searchDom.value
          });
        } else {
          vscode.setState({
            ...vscode.getState(), 
            path, 
            historyPaths: processHistoryPaths(path, historyPaths)
          });

          vscode.postMessage({
            type: 'run',
            path: path.replace(/\n|\r/g, '')
          });
        }
        
        doms.spinner.start();
        doms.runButton.disable();

        isRunRequestDone = false;
        runTimer = setTimeout((timout) => {
          if (!isRunRequestDone) {
            doms.feedback.update('warning', mode === 'search' ? 'This may take longer for large workspace. Refine the files/folders to limit and improve the search time' : 'This may take longer for a large file');
          }
        }, 1000);
      } catch(e) {
        // TODO
        // doms.feedback.update('error', 'An unexpected error had occcured');
      }
    },
    /**
     * handler when the histPath div is clicked
     */
    histPathClicked: (event) => {
      if (event.currentTarget.dataset.path.trim().length) {
        if (pathDom.value?.trim() !== event.currentTarget.dataset.path.trim()) {
          doms.feedback.update('reset');
        }
        pathDom.value = event.currentTarget.dataset.path;
        vscode.setState({...vscode.getState(), path: pathDom.value});
      }
    },
    /**
     * handler when the codicon i element is clicked
     */
    removePathClicked: (event) => {
      const state = vscode.getState();
      const iconDiv = event.currentTarget.parentElement;
      const iconsDiv = iconDiv.parentElement;
      const li = iconsDiv.parentElement;
      const histPathDiv = li.querySelector('.histPath');
  
      // remove from state
      vscode.setState({
        ...vscode.getState(),
        [histPathDiv.dataset.fav === 'y' ? 'favHistoryPaths' : 'historyPaths']: 
          ((histPathDiv.dataset.fav === 'y' ? state?.favHistoryPaths : state?.historyPaths )|| []).filter(path => path !== histPathDiv.dataset.path)
      });
  
      // remove from html dom
      li.parentElement.removeChild(li);
      return histPathDiv.dataset.path;
    },
    /**
     * handler to favourite a path
     * moves the normal path hist item to fav path list
     */
    starPathClicked: (event) => {
      const favHistoryPaths = vscode.getState()?.favHistoryPaths || [];
      if (favHistoryPaths.length >= MAX_FAV_LIST_LENGTH) {
        doms.feedback.update('warning', 'A maximum of 5 starred paths are allowed')
        setTimeout(() => {
          doms.feedback.update('reset');
        }, 1600);
        return;
      }

      // remove from historyPath state
      const path = handlers.removePathClicked(event);

      // add it to favHistoryPath state and dom
      if (!favHistoryPaths.includes(path)) {
        vscode.setState({
          ...vscode.getState(),
          favHistoryPaths: [...favHistoryPaths, path]
        });
        doms.append.favPathListItem(path);
      }
    },
    /**
     * handler to unfavourte a path
     * moves the fav path item to normal path hist
     */
    unstarPathClicked: (event) => {
      // remove from favHistoryPath
      const path = handlers.removePathClicked(event);

      // add it to historyPath state and dom
      if (!(vscode.getState()?.historyPaths || []).includes(path)) {
        vscode.setState({
          ...vscode.getState(),
          historyPaths: [...(vscode.getState()?.historyPaths || []), path]
        });
        doms.append.pathListItem(path);
      }
    },
    defaultModeClicked: () => {
      vscode.setState({
        ...vscode.getState(),
        mode: 'default'
      });
      doms.hide.domWithId('searchContainer');
      doms.show.domWithId('pathsContainer');
      doms.hide.domWithId('search');
      document.getElementById('defaultMode')?.classList.add('active');
      document.getElementById('searchMode')?.classList.remove('active');
    },
    searchModeClicked: () => {
      vscode.setState({
        ...vscode.getState(),
        mode: 'search'
      });
      doms.hide.domWithId('pathsContainer');
      doms.show.domWithId('searchContainer');
      doms.show.domWithId('search');
      document.getElementById('searchMode')?.classList.add('active');
      document.getElementById('defaultMode')?.classList.remove('active');
    },
    fileNameClicked: (event) => {
      if (event.currentTarget.dataset.filePath.trim().length) {
        vscode.postMessage({
          type: 'display-search-item',
          filePath: event.currentTarget.dataset.filePath,
          queryPath: event.currentTarget.datasetqueryPath
        });
      }
    },
    removeSearchFileClicked: (event) => {
      const state = vscode.getState();
      const iconDiv = event.currentTarget.parentElement;
      const iconsDiv = iconDiv.parentElement;
      const li = iconsDiv.parentElement;
      const fileNameDiv = li.querySelector('.fileName');

      const workspaceGroupUl = li.parentElement;
      const searchResultWorksplaceLi = workspaceGroupUl.parentElement;
      const workspaceNameDiv = searchResultWorksplaceLi.querySelector('.workspaceName');
      

      const workspaceName = workspaceNameDiv.dataset.name;
      const filePath = fileNameDiv.dataset.path;
      const filteredList = (state.searchResult[workspaceName] || []).filter(item => item.filePath !== filePath)

      // remove from state
      vscode.setState({
        ...state,
        searchResult: {
          ...state.searchResult,
          [workspaceName]: filteredList.length ? filteredList : undefined
        }
      });

      doms.refresh.searchResultList();
    },
    cancelFindRequest: (event) => {
      // TODO: only show icon on filesearch .
      // icon to be stand out
      event.stopPropagation();
      vscode.postMessage({
        type: 'cancel-search'
      });
    }
  };
 
  document.querySelector('.run').addEventListener('click', handlers.runPathClicked);
  document.querySelector('#defaultMode').addEventListener('click', handlers.defaultModeClicked)
  document.querySelector('#searchMode').addEventListener('click', handlers.searchModeClicked)
  document.querySelectorAll('.histPath').forEach(histPath => histPath.addEventListener('click', handlers.histPathClicked));
  document.querySelectorAll('.codicon-close').forEach(removeIcon => removeIcon.addEventListener('click', handlers.codIconClicked))

  window.addEventListener('message', event => {
    const data = event.data;
    if (data.type === 'done') {
      if (runTimer) {
        clearTimeout(runTimer);
      }
      isRunRequestDone = true;
      cancelSearchIconDom.removeEventListener('click', handlers.cancelFindRequest);
      cancelSearchIconDom.classList.toggle('invisible', true);
      
      // stop spinner
      doms.spinner.stop();
      doms.runButton.enable();
    } else if (data.type === 'searchResponse') {
      const searchResultState = vscode.getState()?.searchResult || {};
      // TODO: what happens if there's no workspace?
      if (!searchResultState[data.workspaceName]) {
        searchResultState[data.workspaceName] = [];
      }
      searchResultState[data.workspaceName].push({
        fileName: data.fileName,
        filePath: data.filePath,
        queryPath: data.queryPath,
        count: data.resultCount
      });

      searchResultState[data.workspaceName].sort((a, b) => {
        const aName = a.fileName.toUpperCase();
        const bName = b.fileName.toUpperCase();
        if (aName < bName) {
          return -1;
        }
        if (aName > bName) {
          return 1;
        }
        return 1;
      });

      vscode.setState({
        ...vscode.getState(),
        searchResult: {
          ...searchResultState
        }
      });
      doms.refresh.searchResultList();
    } else {
      doms.feedback.update(data.type, data.message);
    }
  });


  // Observer to toggle btw absolute and sticky position of the footer
  const stickyFooterObserver = new IntersectionObserver(([entry]) => {
    const footerDom = entry.target.parentElement.querySelector('#footerContainer');
    footerDom?.classList.toggle('footerAbsolute', entry.intersectionRatio === 1);
    footerDom?.classList.toggle('footerSticky', entry.intersectionRatio < 1);
  }, { threshold: [1, 5/40] });

  stickyFooterObserver.observe(document.querySelector('#content'));
 
  // dynamically load the pathListItems
  (oldState?.historyPaths || []).forEach(path => {
    doms.append.pathListItem(path);
  });

  // dynamically load the favPathListItems
  (oldState?.favHistoryPaths || []).forEach(path => {
    doms.append.favPathListItem(path)
  });

  if (oldState?.mode === 'search') {
    handlers.searchModeClicked();
  } else {
    handlers.defaultModeClicked();
  }

  if (oldState?.searchResult) {
    doms.refresh.searchResultList();
  } else {
    vscode.setState({
      ...vscode.getState(),
      searchResult: {}
    });
  }
}());