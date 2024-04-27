// TODO: https://stackoverflow.com/questions/75494793/using-es6-modules-in-vs-code-webview


(function () {
  const MAX_LIST_LENGTH = 20;
  const MAX_FAV_LIST_LENGTH = 5;
  const vscode = acquireVsCodeApi();
  const oldState = vscode.getState();
  const pathDom = document.querySelector('.path');
  const pathListDom = document.querySelector('.pathList');
  const favPathListDom = document.querySelector('.favPathList');
  const searchDom = document.querySelector('#searchTerm');
  const excludeDom = document.querySelector('#excludeTerm');
  const searchResultListDom = document.querySelector('.searchResultList');
  const cancelSearchButton = document.querySelector('#cancel');
  const runTimer = null;
  let isRunRequestDone = true;
  let isFinding = false;

  pathDom.value = oldState?.path?.length ? oldState?.path : '';
  searchDom.value = oldState?.search?.length ? oldState?.searchTerm : '';
  excludeDom.value = oldState?.excludeTerm?.length ? oldState?.excludeTerm : '';
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
        div.addEventListener('click', handlers.workspaceNameClicked)
        return div;
      },
      fileName: (name) => {
        const div = document.createElement('div');
        div.className = 'fileName';
        div.textContent = name;
        return div;
      },
      relativePath: (relativePath) => {
        const div = document.createElement('div');
        div.className = 'relativePath';
        div.textContent = relativePath;
        return div;
      },
      workspaceGroupList: () => {
        const ul = document.createElement('ul');
        ul.className = 'workspaceGroupList';
        return ul;
      },
      fileListItem: (name, filePath, queryPath, relativePath) => {
        const li = document.createElement('li');
        li.className = 'fileListItem';
        li.dataset.name = name;
        li.dataset.filePath = filePath;
        li.dataset.queryPath = queryPath;
        li.dataset.relativePath = relativePath;
        li.addEventListener('click', handlers.fileListItemClicked);
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
      },
      fileListItem: (fileData) => {
        const li = doms.create.fileListItem(fileData.fileName, fileData.filePath, fileData.queryPath, fileData.relativePath);
        const fileNameDiv = doms.create.fileName(fileData.fileName);
        const relativePath = doms.create.relativePath(fileData.relativePath);
        
        const iconsDiv = doms.create.icons();
        const countDiv = doms.create.count(fileData.count);
        const removeIcon = doms.create.icon();
        const removeCodIcon = doms.create.codicon('codicon-close', handlers.removeSearchFileClicked);
        
        removeIcon.appendChild(removeCodIcon);
        iconsDiv.appendChild(countDiv);
        iconsDiv.appendChild(removeIcon);
        li.appendChild(fileNameDiv);
        li.appendChild(relativePath);
        li.appendChild(iconsDiv);

        li.title = fileData.relativePath;
        return li;
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

          let workspaceCount = 0;
          
          searchResultState[workspace].forEach(searchResult => {
            workspaceGroupListDom.append(doms.append.fileListItem(searchResult)); 
            workspaceCount += searchResult.count;
          });

          const workspaceIconsDom = doms.create.icons();
          const workspaceCountDom = doms.create.count(workspaceCount);
          const removeWorkspaceIconDom = doms.create.icon();
          const removeWorkspaceCodIcon = doms.create.codicon('codicon-close', handlers.removeSearchWorkspaceClicked);
          
          removeWorkspaceIconDom.appendChild(removeWorkspaceCodIcon);
          workspaceIconsDom.appendChild(workspaceCountDom);
          workspaceIconsDom.appendChild(removeWorkspaceIconDom);
          searchResultWorkspaceItemListDom.appendChild(workspaceNameDom);
          searchResultWorkspaceItemListDom.appendChild(workspaceIconsDom);
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
          isFinding = true;
          cancelSearchButton.addEventListener('click', handlers.cancelFindRequest);
          cancelSearchButton.disabled = false;

          vscode.setState({
            ...vscode.getState(),
            path,
            searchTerm: searchDom.value,
            excludeTerm: excludeDom.value,
            searchResult: {}
          });
      
          doms.refresh.searchResultList();

          vscode.postMessage({
            type: 'search',
            path,
            searchFiles: searchDom.value,
            excludeFiles: excludeDom.value
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
            doms.feedback.update('warning', mode === 'search' ? 
              'This may take longer for large workspace. Refine the files/folders to limit and improve the search time' : 
              'This may take longer for a large file'
            );
          }
        }, mode === 'search' ? 2000 : 1000);
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
      doms.hide.domWithId('searchTermWrapper');
      doms.hide.domWithId('excludeTermWrapper');
      doms.hide.domWithId('cancel');
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
      doms.show.domWithId('searchTermWrapper');
      doms.show.domWithId('excludeTermWrapper');
      doms.show.domWithId('cancel');
      document.getElementById('searchMode')?.classList.add('active');
      document.getElementById('defaultMode')?.classList.remove('active');
    },
    workspaceNameClicked: (event) => {
      const searchReusltWorkItemList = event.target.parentElement;
      const workspaceGroupList = searchReusltWorkItemList.querySelector('.workspaceGroupList');
      workspaceGroupList.classList.toggle('hide');
    },
    fileListItemClicked: (event) => {
      document.querySelectorAll('.fileListItem').forEach(fileNameDiv => fileNameDiv.classList.toggle('selected', false));
      document.querySelectorAll('.workspaceName').forEach(workspaceName => workspaceName.classList.toggle('selected', false));
      if (event.currentTarget.dataset.filePath.trim().length) {
        event.currentTarget.classList.toggle('selected', true);
        const workspaceNameDiv = event.currentTarget.closest('.searchResultWorkspaceItemList').querySelector('.workspaceName');
        workspaceNameDiv.classList.toggle('selected', true);
        vscode.postMessage({
          type: 'display-search-item',
          filePath: event.currentTarget.dataset.filePath,
          queryPath: event.currentTarget.dataset.queryPath,
          relativePath: event.currentTarget.dataset.relativePath,
          workspaceName: workspaceNameDiv.dataset.name
        });
      }
    },
    removeSearchFileClicked: (event) => {
      event.stopPropagation();
      const state = vscode.getState();
      const fileListItemDiv = event.currentTarget.closest('.fileListItem');
      const searchResultWorksplaceLi = fileListItemDiv.closest('.searchResultWorkspaceItemList');
      const workspaceNameDiv = searchResultWorksplaceLi.querySelector('.workspaceName');

      const workspaceName = workspaceNameDiv.dataset.name;
      const filePath = fileListItemDiv.dataset.filePath;
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
    removeSearchWorkspaceClicked: (event) => {
      const state = vscode.getState();
      const iconDiv = event.currentTarget.parentElement;
      const iconsDiv = iconDiv.parentElement;
      const searchResultWorksplaceLi = iconsDiv.parentElement;
      const workspaceNameDiv = searchResultWorksplaceLi.querySelector('.workspaceName');

      const workspaceName = workspaceNameDiv.dataset.name;
      const { [workspaceName]: _, ...searchResult } = state.searchResult;
      
      vscode.setState({
        ...state,
        searchResult: {
          ...searchResult
        }
      });

      doms.refresh.searchResultList();
    },
    cancelFindRequest: (event) => {
      event.stopPropagation();
      vscode.postMessage({
        type: 'cancel-search'
      });
      isFinding = false;
      cancelSearchButton.removeEventListener('click', handlers.cancelFindRequest);
      cancelSearchButton.disabled = true;
    }
  };
 
  document.querySelector('.run').addEventListener('click', handlers.runPathClicked);
  document.querySelector('#defaultMode').addEventListener('click', handlers.defaultModeClicked);
  document.querySelector('#searchMode').addEventListener('click', handlers.searchModeClicked);

  document.querySelectorAll('.histPath').forEach(
    histPath => histPath.addEventListener('click', handlers.histPathClicked)
  );
  document.querySelectorAll('.codicon-close').forEach(
    removeIcon => removeIcon.addEventListener('click', handlers.codIconClicked)
  );

  searchDom.addEventListener('focus', (event) => {
    event.currentTarget.placeholder = 'e.g. file*.json, include/**/folders';
  });
  searchDom.addEventListener('blur', (event) => {
    event.currentTarget.placeholder = '';
  });
  excludeDom.addEventListener('focus', (event) => {
    event.currentTarget.placeholder = 'e.g. file*.json, exclude/**/folders';
  });
  excludeDom.addEventListener('blur', (event) => {
    event.currentTarget.placeholder = '';
  });

  window.addEventListener('message', event => {
    const data = event.data;
    if (data.type === 'done') {
      if (runTimer) {
        clearTimeout(runTimer);
      }
      isRunRequestDone = true;
      
      if (data.mode === 'search' && isFinding) {
        cancelSearchButton.removeEventListener('click', handlers.cancelFindRequest);
        cancelSearchButton.disabled = true;
        isFinding = false;
      }
      
      // stop spinner
      doms.spinner.stop();
      doms.runButton.enable();
    } else if (data.type === 'searchResponse') {
      if (isFinding) {
        const searchResultState = vscode.getState()?.searchResult || {};
        
        if (!searchResultState[data.workspaceName]) {
          searchResultState[data.workspaceName] = [];
        }
        searchResultState[data.workspaceName].push({
          fileName: data.fileName,
          filePath: data.filePath,
          queryPath: data.queryPath,
          relativePath: data.relativePath,
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
      }
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