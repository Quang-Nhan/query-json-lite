import { KEYS, tNode, tNodesState } from 'jsxpath';
import * as vscode from 'vscode';
import { QueryJSONState } from './QueryJSONState';
import { QueryJSONDocumentUtility, tNodes } from './QueryJSONDocumentProcessor';

let idList: any[] = [];

export class NodeItem extends vscode.TreeItem {
  command?: vscode.Command | undefined = {
    command: 'query-json-lite.goto',
    title: 'Goto',
    arguments: [this.nodes, this.document]
  };
	constructor(
	  public readonly label: string,
	  private value: string,
    public id: string,
    private nodes: tNodes,
    private document?: vscode.TextDocument,
    private actualValue?: any
	) {
    const collapsibleState = ['{$o}', '{$a}'].includes(value) 
      ? vscode.TreeItemCollapsibleState.Collapsed 
      : vscode.TreeItemCollapsibleState.None;
	  super(label, collapsibleState);
	  this.description = String(this.getDisplayValue(this.label, this.value, this.actualValue));
	  this.tooltip = `${this.label}: ${this.description}`;
    idList.push(this.id);
	}

  private getDisplayValue(label:string, value: string, actualValue?: any) {
    if (actualValue) {
      return JSON.stringify(actualValue);
    };
    if (label === '{$ao}') {
      return '';
    }
    if (value === '{$o}' ) {
      return '{...}';
    }
    if (value === '{$a}') {
      return '[...]';
    }
    return value;
  }
}
  
export class QueryJSONTreeDataProvider implements vscode.TreeDataProvider<NodeItem> {
  public static readonly viewType = 'query-json-lite.result';
  nodesValue: tNode[] = [];
  nodes: tNodesState['nodes']['byId'] = {};
  value: any;
  document: vscode.TextDocument | undefined;
  qjDocUtility: QueryJSONDocumentUtility;
  id = -2;
  // refreshHighlight = false;
  addDocumentRangeArgs: [string, { startLine: number; startCharacter: number; endLine: number; endCharacter: number; }, boolean|undefined][] = [];

  constructor(
    private qjState: QueryJSONState
  ) {
    this.qjDocUtility = new QueryJSONDocumentUtility();
  }

  public async update(pathResult: {nodesValue: tNode[], nodes: tNodesState['nodes']['byId'], value: any, document?: vscode.TextDocument }) {
    if (pathResult.document) {
      await this.qjDocUtility.cacheDocument(pathResult.document as vscode.TextDocument);
    }
    this.nodes = pathResult.nodes;
    this.nodesValue = pathResult.nodesValue;
    this.value = pathResult.value;
    this.document = pathResult.document;
    // this.refreshHighlight = true;

    this.addDocumentRangeArgs = [] 
  }

  public getTreeItem(element: NodeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  public getChildren(element?: NodeItem | undefined): vscode.ProviderResult<NodeItem[]> {
    if (!this.nodesValue) {
      // vscode.window.showInformationMessage('No result found');
      return;
    }
    if (element) {
      const currentNode = this.nodes[Number(element.id)];
      return Promise.resolve(currentNode[KEYS.links].childrenIds.map((id: number, i: number) => {
        const child = this.nodes[id];
        let label = this.getDisplaylabel(child[KEYS.name], child[KEYS.arrayPosition]);
        if (currentNode[KEYS.valueType] === 'array') {
          label = String(child[KEYS.arrayPosition]);
        }
        
        let childId;
        if (idList.includes(child[KEYS.id])) {
          childId = this.id--;
          this.nodes[childId] = child;
        } else {
          childId = child[KEYS.id];
        }

        const currentAncestorNodes = {
          current: child,
          ancestors: child[KEYS.links].ancestorIds.map((aId: number) => this.nodes[aId])
        }

        const range = this.qjDocUtility.getSymbolRanges(currentAncestorNodes);
        range && this.addDocumentRangeArgs.push([ this.document?.uri.fsPath as string, range, i === currentNode[KEYS.links].childrenIds.length-1 ]);
        if (this.qjState.getDocumentHighlightOptions().highlightEnabled && i === currentNode[KEYS.links].childrenIds.length-1) {
          this.addDocumentRanges();
        }

        return new NodeItem(
          label, 
          child[KEYS.value],
          childId, 
          currentAncestorNodes, 
          this.document
        );
      }));
    } else if (this.nodesValue.length) {
      return Promise.resolve(this.nodesValue.map((node, i) => {
        const currentAncestorNodes = {
          current: node,
          ancestors: node[KEYS.links].ancestorIds.map((aId: number) => this.nodes[aId])
        }

        const range = this.qjDocUtility.getSymbolRanges(currentAncestorNodes);
        range && this.addDocumentRangeArgs.push([ this.document?.uri.fsPath as string, range, i === this.nodesValue.length-1 ]);
        if (this.qjState.getDocumentHighlightOptions().highlightEnabled && i === this.nodesValue.length-1) {
          this.addDocumentRanges();
        }

        return new NodeItem(
          this.getDisplaylabel(node[KEYS.name], node[KEYS.arrayPosition]), 
          node[KEYS.value], 
          node[KEYS.id], 
          currentAncestorNodes, 
          this.document,
          this.value[i]
        );
      }));
    } else {
      this.qjState.reset();
      return Promise.resolve(
        [new NodeItem('result', typeof this.value === 'string' ? this.value : (this.value === undefined ? '' : String(this.value)), '-1', {current: undefined, ancestors: undefined}, this.document)]
      );
    }
  }
  
  private _onDidChangeTreeData: vscode.EventEmitter<NodeItem | undefined | null | void> = new vscode.EventEmitter<NodeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<NodeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public addDocumentRanges() {
    const documentMeta = this.qjState.getDocumentMetas();
    if (!documentMeta.length || documentMeta[0].fsPath !== this.document?.uri.fsPath) {
      this.addDocumentRangeArgs.forEach(args => {
        if (args) {
          this.qjState.addDocumentRange.apply(this.qjState, args);
        }
      });
    }
  }

  private getDisplaylabel(label: string, arrayPosition: number) {
    if (['{$o}', '{$ao}'].includes(label)) {
      return '{ }';
    }
    if (label === '{$a}') {
      return '[ ]';
    }

    if (label === '_') {
      return '';
    }

    if (!isNaN(arrayPosition) && ['{$v}'].includes(label)) {
      return String(arrayPosition);
    }

    return label;
  }
}