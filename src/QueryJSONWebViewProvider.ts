
import * as vscode from 'vscode';
import { QueryJSONTreeDataProvider } from './QueryJSONTreeDataProvider';
import { performance } from 'perf_hooks';
import { runPath } from 'jsxpath';

export default class EvaluateJSONProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'query-json-lite.input';
  private _view?: vscode.WebviewView;
  private _treeView?: vscode.TreeView<unknown>;

  constructor(private readonly _extensionUri: vscode.Uri, private _evalJSONProvider: QueryJSONTreeDataProvider) { }

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
        this._extensionUri
      ]
    }
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'run':
          {
            let document;
            if (!data.path.length || vscode.window.activeTextEditor?.document.languageId !== 'json') {
              this._evalJSONProvider?.update({
                nodesValue: [], nodes: {}, value: [], document
              });
              this._evalJSONProvider?.refresh();
              const message = !data.path.length ? 'Path is not provided' : 'Invalid file type. Was expecting JSON file';
              webviewView.webview.postMessage({type: 'error', message: message});
              return;
            }
            let value: any[] = [];
            let nodesValue;
            let nodes;
            let performanceTime;
            let queryDone = false;
            try {
              webviewView.webview.postMessage({type: 'reset'});
              vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Querying JSON in progress!",
                cancellable: false
              }, (progress, token) => {
                token.onCancellationRequested(() => {
                  console.log("User canceled the long running operation");
                });

                progress.report({ increment: 0 });

                setTimeout(() => {
                  progress.report({ increment: 10, message: "..." });
                }, 100);

                setTimeout(() => {
                  progress.report({ increment: 20, message: "..." });
                }, 200);

                setTimeout(() => {
                  progress.report({ increment: 30, message: "..." });
                }, 300);

                setTimeout(() => {
                  progress.report({ increment: 40, message: "..." });
                }, 400);

                setTimeout(() => {
                  progress.report({ increment: 40, message: "..." });
                }, 500);

                const p = new Promise<void>(resolve => {
                  setInterval(() => {
                    if (queryDone) resolve();
                  }, 1000);
                });

                return p;
              });

              document = vscode.window.activeTextEditor?.document;
              const text = document?.getText();
              
              const json = JSON.parse(text);
              const startTime = performance.now()
              runPath({
                path: data.path,
                then: (result) => {
                  if (result.error) console.log(result.error);
                  nodesValue = result.nodesValue || [];
                  nodes = result.nodes;
                  value = result.value;
                  queryDone = true;
                }
              }, { json, outputOptions: { nodes: true } });
              const endTime = performance.now();
              performanceTime = endTime - startTime;
            } catch (e) { 
              queryDone = true; 
              webviewView.webview.postMessage({type: 'error', message: (e as Error).message });
            }

            try {
              if (nodesValue && nodes) {
                if (!this._treeView) {
                  this._treeView = vscode.window.createTreeView('query-json-lite.result', {
                    treeDataProvider: this._evalJSONProvider
                  });
                }
                this._treeView.title = `Query Result${value.length ? `: ${value.length}` : ''}`;
                this._evalJSONProvider?.update({ nodesValue, nodes, value, document });
                this._evalJSONProvider?.refresh();
              } else if(this._treeView) {
                this._treeView.title = `Query Result: 0`;
              }
            } catch (e) { }
            break;
          }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.js'));

    // Do the same for the stylesheet.
    const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'reset.css'));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'vscode.css'));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.css'));
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'codicon.css'));

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
          <link href="${codiconsUri}" rel="stylesheet" />
          <title>Evaluate JSON</title>
      </head>
      <body>
          <textarea wrap="soft" class="path" placeholder="path"></textarea>
          <button class="run">Run Path</button>
          <div id="errorMessage"></div>
          <div>
            <ul class="pathList">
              <!--  Dnamically load pathListItems
                  <li class="pathListItem">
                    <div class="histPath">path</div>
                    <div class="icon"><i class="codicon codicon-close"></i></div>
                  </li>
                  ...
              --!>
            </ul>
          </div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>`
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