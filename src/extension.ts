// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { QueryJSONTreeDataProvider } from './QueryJSONTreeDataProvider';
import QueryJSONWebViewProvider from './QueryJSONWebViewProvider';
import { QueryJSONState } from './QueryJSONState';
import { QueryJSONDocumentProcessor } from './QueryJSONDocumentProcessor';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const queryJsonState = new QueryJSONState(context);
	const documentProcessor = new QueryJSONDocumentProcessor(queryJsonState);
	const treePovider = new QueryJSONTreeDataProvider(queryJsonState);
	const webviewProvider = new QueryJSONWebViewProvider(context.extensionUri, treePovider, queryJsonState);
	
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(QueryJSONWebViewProvider.viewType, webviewProvider)
	);

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider(QueryJSONTreeDataProvider.viewType, treePovider)
	);

	context.subscriptions.push(vscode.commands.registerCommand('query-json-lite.run', () => {
		webviewProvider.run();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('query-json-lite.output', async () => {
		if (treePovider.value) {
			const doc =  await vscode.workspace.openTextDocument({
				content: JSON.stringify(treePovider.value, null, 2),
				language: 'json'
			});
			vscode.window.showTextDocument(doc);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('query-json-lite.goto', (nodes, document) => {
		documentProcessor.goto(nodes, document);
	}))

	let copy = vscode.commands.registerCommand('query-json-lite.copy', (nodeItem, arg2) => {
		vscode.env.clipboard.writeText(nodeItem.description);
	});

	context.subscriptions.push(copy);
}

// This method is called when your extension is deactivated
export function deactivate() {

}

