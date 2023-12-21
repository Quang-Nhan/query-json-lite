import { KEYS, tNode, tNodesState } from 'jsxpath';
import * as vscode from 'vscode';
import { tNodes } from './GoTo';

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
      return '[...]'
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
  id = -2;
  constructor() {}

  public update(pathResult: {nodesValue: tNode[], nodes: tNodesState['nodes']['byId'], value: any, document?: vscode.TextDocument }) {
    this.nodes = pathResult.nodes;
    this.nodesValue = pathResult.nodesValue;
    this.value = pathResult.value;
    this.document = pathResult.document;
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
      return Promise.resolve(currentNode[KEYS.links].childrenIds.map((id: number) => {
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

        const ancestors = child[KEYS.links].ancestorIds.map((aId: number) => this.nodes[aId]);
        return new NodeItem(
          label, 
          child[KEYS.value], 
          childId, 
          {current: child, ancestors: ancestors}, 
          this.document
        );
      }));
    } else if (this.nodesValue.length) {
      return Promise.resolve(this.nodesValue.map((node, i) => {
        const ancestors = node[KEYS.links].ancestorIds.map((aId: number) => this.nodes[aId]);
        return new NodeItem(
          this.getDisplaylabel(node[KEYS.name], node[KEYS.arrayPosition]), 
          node[KEYS.value], 
          node[KEYS.id], 
          {current: node, ancestors}, 
          this.document,
          this.value[i]
        );
      }));
    } else {
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