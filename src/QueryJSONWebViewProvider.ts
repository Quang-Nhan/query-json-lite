
import * as vscode from 'vscode';
import { QueryJSONTreeDataProvider } from './QueryJSONTreeDataProvider';
import { performance } from 'perf_hooks';
import { runPath, tRunPathResult } from 'jsxpath';
import path = require('path');
import { QueryJSONState } from './QueryJSONState';

export default class EvaluateJSONProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'query-json-lite.input';
  private _view?: vscode.WebviewView;
  private _treeView?: vscode.TreeView<unknown>;
  private _cancelTokenSource?: vscode.CancellationTokenSource;

  constructor(
    private readonly extensionUri: vscode.Uri, 
    private qjTreeProvider: QueryJSONTreeDataProvider, 
    private qjState: QueryJSONState
  ) {}

  public run() {
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage({ type: 'run' });
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext<unknown>,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.extensionUri
      ]
    }
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async data => {
      let document;
      
      switch (data.type) {
        case 'run': {
          if (!data.path.length || vscode.window.activeTextEditor?.document.languageId !== 'json') {
            await this.qjTreeProvider?.update({
              nodesValue: [], nodes: {}, value: [], document
            });
            this.qjTreeProvider?.refresh();
            const message = !data.path.length ? 'Path is not provided.' : 'Invalid file type. Was expecting a JSON file.';
            webviewView.webview.postMessage({type: 'error', message: message});
            webviewView.webview.postMessage({type: 'done'});
            return;
          }
          let value: any[] = [];
          let nodesValue;
          let nodes;
          let performanceTime;
          try {
            webviewView.webview.postMessage({type: 'reset'});
            document = vscode.window.activeTextEditor?.document;
            const text = document?.getText();
          
            const startTime = performance.now()
            this._runPath(text, data.path, (result: tRunPathResult) => {
              value = result.value;
              nodesValue = result.nodesValue;
              nodes = result.nodes;
            });
      
            const endTime = performance.now();
            performanceTime = endTime - startTime;
          } catch (e) { 
            webviewView.webview.postMessage({type: 'error', message: (e as Error).message });
          }

          try {
            if (nodesValue && nodes) {
              if (!this._treeView) {
                this._treeView = vscode.window.createTreeView('query-json-lite.result', {
                  treeDataProvider: this.qjTreeProvider
                });
              }

              const fileNameSplitted = document?.fileName.split('/') || [];
              this._treeView.title = `Query Result${value.length ? `: ${value.length}` : ''}`;
              this._treeView.description = `${fileNameSplitted[fileNameSplitted.length-1]}`
              await this.qjTreeProvider?.update({ nodesValue, nodes, value, document });
              this.qjTreeProvider?.refresh();
              if (!value.length) {
                webviewView.webview.postMessage({type: 'warning', message: 'No result found for the given path expression.'})
              }
            } else if(this._treeView) {
              this._treeView.title = `Query Result: 0`;
            }
          } catch (e) { }
          webviewView.webview.postMessage({type: 'done'});
          break;
        };
        case 'search': {
          if (!data.path.length) {
            webviewView.webview.postMessage({type: 'error', message: 'Path is not provided.'});
            webviewView.webview.postMessage({type: 'done', mode: 'search'});
            return;
          }
          if (!this._cancelTokenSource || this._cancelTokenSource?.token.isCancellationRequested) {
            this._cancelTokenSource = new vscode.CancellationTokenSource();
            this._tokenCancellation(this._cancelTokenSource, () => {
              // webviewView.webview.postMessage({type: 'done', mode: 'search'});
            });
          }
          let total = 0;
          let urisCount = 0;
          // const largeFileList: string[] = [];
          const fileSizeLimit = 1000000;

          const processedWorkspaces: string[] = [];
          const includePattern: string = getGlobPattern(data.searchFiles);
          const excludePattern: string = data.excludeFiles.length ? getGlobPattern(data.excludeFiles) : '';
          (vscode.workspace.workspaceFolders || []).forEach((workspaceFolder, fileIndex) => {
            const searchRelativePath = new vscode.RelativePattern(workspaceFolder, includePattern);
            const execludeRelativePath = excludePattern.length ? new vscode.RelativePattern(workspaceFolder, excludePattern) : undefined;
            vscode.workspace.findFiles(searchRelativePath, execludeRelativePath, undefined , this._cancelTokenSource?.token)
              .then((uris) => {
                urisCount += uris.length;
                if ((vscode.workspace?.workspaceFolders?.length || 0)-1 === fileIndex && urisCount === 0) {
                  webviewView.webview.postMessage({type: 'warning', message: 'No files found.'})
                  webviewView.webview.postMessage({type: 'done', mode: 'search'});
                }
                if (this._cancelTokenSource?.token.isCancellationRequested) {
                  return;
                }
                uris.forEach((uri, uriIndex) => {
                  vscode.workspace.fs.readFile(uri)
                    .then(value => {
                      if (this._cancelTokenSource?.token.isCancellationRequested) {
                        return;
                      }
                      try {
                        const workspaceUri = vscode.workspace.getWorkspaceFolder(uri);
                        const splits = uri.fsPath.split(path.sep);
                        const fileName = splits[splits.length - 1];

                        if (value.byteLength > fileSizeLimit && data.path.includes('//')) {
                          // largeFileList.push(fileName);
                          // TODO: find out a way to pause until user acknowledges
                          webviewView.webview.postMessage({
                            type: 'warning',
                            message: `${fileName} is very large. This will take a while`
                          });
                        }

                        this._runPath(cleanup(value.toString()), data.path, (runResult: tRunPathResult) => {
                          if (runResult.value.length) { 
                            total += value.length;
                            webviewView.webview.postMessage({
                              type: 'searchResponse',
                              workspaceName: workspaceUri?.name || '',
                              resultCount: runResult.value.length,
                              filePath: uri.path,
                              relativePath: vscode.workspace.asRelativePath(uri, false),
                              queryPath: data.path,
                              fileName,
                            });
                          }
                        });
                      } catch(e) {
                        // ignore this file because it's likely malFormed
                      } 
                    })
                    .then(() => {
                      if (vscode.workspace.getWorkspaceFolder(uri)?.name.length && !processedWorkspaces.includes(vscode.workspace.getWorkspaceFolder(uri)?.name as string)) {
                        processedWorkspaces.push(vscode.workspace.getWorkspaceFolder(uri)?.name as string);
                      }
                      if (vscode.workspace?.workspaceFolders?.length === processedWorkspaces.length && uris.length - 1 === uriIndex) {
                        if (total === 0) {
                          webviewView.webview.postMessage({ type: 'warning', message: 'No files with matching path expression found.' });
                        }
                        webviewView.webview.postMessage({type: 'done', mode: 'search'});
                        // console.log('find done! Total found: ', total, ' Is user cancelled ? ', this._cancelTokenSource?.token.isCancellationRequested);
                      }
                    });
                });
              })
          });
          break;
        };
        case 'display-search-item': {
          try {
            vscode.workspace.openTextDocument(data.filePath)
              .then((document) => {
                if (!document) {
                  return webviewView.webview.postMessage({
                    type: 'Error',
                    message: 'file cannot be found/load'
                  });
                }

                vscode.window.showTextDocument(document, vscode.window.tabGroups.activeTabGroup.viewColumn, false);
                
                try {
                  this._runPath(document.getText(), data.queryPath, async ({nodes, nodesValue, value}: tRunPathResult) => {
                    if (nodesValue && nodes) {
                      if (!this._treeView) {
                        this._treeView = vscode.window.createTreeView('query-json-lite.result', {
                          treeDataProvider: this.qjTreeProvider
                        });
                      }

                      this._treeView.title = `Query Result${value.length ? `: ${value.length}` : ''}`;
                      this._treeView.description = `${data.workspaceName}/${data.relativePath}`;
                      await this.qjTreeProvider?.update({ nodesValue, nodes, value, document });
                      this.qjTreeProvider?.refresh();
                      if (!value.length) {
                        webviewView.webview.postMessage({type: 'warning', message: 'No result found for the given path expression.'})
                      }
                    } else if(this._treeView)  {
                      this._treeView.title = `Query Result: 0`;
                    }
                  });
                } catch(e) {
                  // ignore this file because it's likely malFormed
                  // console.log(e);
                } 
              })
          } catch(e) {}
          break;
        };
        case 'cancel-search': {
          if (!this._cancelTokenSource?.token.isCancellationRequested) {
            this._cancelTokenSource?.cancel();
          }
          break;
        }
        case 'change-highlight': {
          this.qjState.setHexValues(data);
          break;
        }
        case 'toggle-highlight': {
          if (data.value) {
            
            this.qjTreeProvider.addDocumentRanges();
          }
          this.qjState.enableHighlight(data.value);
          break;
        }
      }
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._postLoadHighlightColor();
      }
    });
    this._postLoadHighlightColor();
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'main.js'));

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'reset.css'));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'main.css'));
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'resources', 'codicon.css'));

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <!--
              Use a content security policy to only allow loading styles from our extension directory,
              and only allow scripts that have a specific nonce.
              (See the 'webview-sample' extension sample for img-src content security policy examples)
          -->
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="${styleResetUri}" rel="stylesheet">
          <link href="${styleVSCodeUri}" rel="stylesheet">
          <link href="${styleMainUri}" rel="stylesheet">
          <link href="${codiconsUri}" rel="stylesheet">
          <title>Evaluate JSON</title>
        </head>
        <body>
          <div id="content">
            <div class="sticky">
              <textarea id="pathTextArea" wrap="soft" class="path" placeholder="path"></textarea>
              <ul class="tabs">
                <li id="defaultMode" class="tab">
                  <div class="icon"><i class="codicon codicon-target" title="Query"></i></div>
                </li>
                <li id="searchMode" class="tab">
                  <div class="icon"><i class="codicon codicon-search-fuzzy" title="Find"></i></div>
                </li>
              </ul>
              <div id="searchJSON">
                <div id="searchChevrons">
                  <i id="searchRightIcon" class="codicon codicon-chevron-right"></i>
                  <i id="searchDownIcon" class="codicon codicon-chevron-down"></i>
                </div>
                <div id="searchTermContainer">
                  <div id="searchTermWrapper">
                    <input type="text" id="searchTerm" placeholder="files to include"/>
                  </div>
                  <div id="excludeTermWrapper">
                    <input type="text" id="excludeTerm" placeholder="files to exclude"/>
                  </div>
                </div>
              </div>
              <span class="span">
                <button class="run">
                  Run Path 
                  <div class="icons">
                    <div class="icon"><i class="codicon codicon-sync" title="Syncing"></i></div>
                  </div>
                </button>
                <button id="cancel" disabled> 
                  <div class="icon cancel"><i class="codicon codicon-close" title="Cancel"></i></div>
                </button>
              </span>
              <div id="feedback"></div>
            </div>
            <div class="spacer"></div>
            <div id="pathsContainer">
              <ul class="favPathList">
                <!--
                  <li class="favPathListItem">
                    <div class="histPath" data-path="testtest" data-fav="y">testtest</div>
                    <div class="icons">
                      <div class="icon"><i class="codicon codicon-star-full" title="un-favourite"></i></div>
                    </div>
                  </li>
                  ...
                --!>
              </ul>
              <div class="spacer"></div>
              <ul class="pathList">
                <!--  Dynamically load pathListItems
                  <li class="pathListItem">
                    <div class="histPath">path</div>
                    <div class="icons">
                      <div class="icon"><i class="codicon codicon-close" title="remove"></i></div>
                      <div class="icon"><i class="codicon codicon-star-empty" title="favourite"></i></div>
                    </div>
                  </li>
                  ...
                --!>
              </ul>
            </div>
            <div id="searchContainer">
              <ul class="searchResultList">
                <!-- Dynamically create searchResultItems
                  <li class="searchResultWorkspaceItemList">
                    <div class="workspaceName" data-name="workspace">Workspace</div>
                    <div class="icons">
                      <div class="icon count" data-count="2323">12334</div>
                    </div>
                    <ul class="workspaceGroupList">
                      <li class="fileListItem" data-...>
                        <div class="fileName">test URI</div>
                        <div class="relativePath"></div>
                        <div class="icons">
                          <div class="icon count" data-count="34">1000</div>
                          <div class="icon"><i class="codicon codicon-expand-all" title="expand"></i></div> 
                        </div>
                      </li>
                    </ul>
                  </li>
                -->
              </ul>
            </div>
          </div>
          <div id="highlightContainer" class="footerSticky">
            <input id="highlightSwitch" type="checkbox"/>
            <input id="colorPicker" type="color" height="40" title="highlight color"/>
            <input id="opacity" type="range" min="0" max="1" step="0.1" title="highlight opacity"/>
          </div>
          <div id="footerContainer" class="footerSticky">
            <ul class="footerList">
              <li class="footerItem">
                <a class="footerIcon" href="https://github.com/Quang-Nhan/query-json-lite/issues">
                  <i class="codicon codicon-debug"></i>
                </a>
                <div class="footerItemLabel">Report Issue</div>
              <div>
              <li class="footerItem">
                <a class="footerIcon" href="https://marketplace.visualstudio.com/items?itemName=Quang-Nhan.query-json-lite&ssr=false#review-details">
                  <i class="codicon codicon-feedback"></i>
                </a>
                <div class="footerItemLabel">Provide Review</div>
              </li>
            </ul>
          </div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>`
  }

  private _runPath(text: string, path: string, callback: Function) {
    // TODO look at separating this into a new Worker() thread
    // TODO work out how to cancel query executations mid flight
    const json = JSON.parse(text);
    this.qjState.reset();
    runPath({
      path,
      then: ({nodesValue, nodes, error, value}) => {
        if (error) console.log(error);
        callback({
          nodesValue: nodesValue || [],
          value,
          nodes
        });
      }
    }, { json, outputOptions: { nodes: true } });
  }


  private async _displayResult(webviewView: vscode.WebviewView, document: vscode.TextDocument, {nodesValue, nodes, value}: tRunPathResult) {
    if (nodesValue && nodes) {
      if (!this._treeView) {
        this._treeView = vscode.window.createTreeView('query-json-lite.result', {
          treeDataProvider: this.qjTreeProvider
        });
      }

      const fileNameSplitted = document?.fileName.split('/') || [];
      this._treeView.title = `Query Result${value.length ? `: ${value.length}` : ''}`;
      this._treeView.description = `${fileNameSplitted[fileNameSplitted.length-1]}`
      await this.qjTreeProvider?.update({ nodesValue, nodes, value, document });
      this.qjTreeProvider?.refresh();
      if (!value.length) {
        webviewView.webview.postMessage({type: 'warning', message: 'No result found for the given path expression.'})
      }
    } else if(this._treeView)  {
      this._treeView.title = `Query Result: 0`;
    }
  }

  private _tokenCancellation(source: vscode.CancellationTokenSource, callback: Function) {
    source.token.onCancellationRequested(() => {
      source.dispose();
      callback();
    });
  }

  private _postLoadHighlightColor() {
    const hexValues = this.qjState.getDocumentHighlightOptions();
    this._view?.webview.postMessage({
      type: 'load-highlight-options',
      hex: hexValues.hex,
      hexOpacity: hexValues.hexOpacity,
      highlightEnabled: hexValues.highlightEnabled
    });
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getGlobPattern(search: string) {
  const commaSplit = search.split(',');
  const searchList = commaSplit.map(term => {
    term = term.trim();
    
    const dotSplits = term.split('.');
    if (dotSplits.length > 1 && dotSplits[dotSplits.length - 1]?.toLowerCase() === 'json') {
      return `**/${term}`;
    } else if (dotSplits.length === 1) {
      const caseInsensitiveTerm = getCaseInsensitiveTerm(term);
      return `**/*${caseInsensitiveTerm}*/**/*.json,**/*${caseInsensitiveTerm}*.json`;
    } 
    return '';
  });

  return `{${searchList.join(',')}}`;
}

function getCaseInsensitiveTerm(term: string) {
  const splittedTerm = [...term];
  const caseInsensitiveTerm = splittedTerm.map(char => {
    if (char.match(/[a-z|A-Z]/i)) {
      return `[${char.toLowerCase()}${char.toUpperCase()}]`;
    }
    return char;
  });
  return caseInsensitiveTerm.join('');
}

// Attempt to cleanup if there is an error when parsing
// https://stackoverflow.com/questions/33483667/how-to-strip-json-comments-in-javascript
// https://github.com/nokazn/strip-json-trailing-commas/blob/main/src/index.ts
function cleanup(jsonString: string) {
  try {
    JSON.parse(jsonString);
    return jsonString;
  } catch(e) {
    return jsonString
      // remove comemnts
      .replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m)
      // remove trailing comma
      .replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
  }
}