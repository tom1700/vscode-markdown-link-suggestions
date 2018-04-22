'use strict';

import * as path from 'path';
import MarkDownDOM from 'markdown-dom';
import { ExtensionContext, languages, TextDocument, Position, CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, Range, workspace, Uri, CompletionItemKind } from 'vscode';

export function activate(context: ExtensionContext) {
    const linkProvider = new LinkProvider();
    context.subscriptions.push(languages.registerCompletionItemProvider({ scheme: 'file', language: 'markdown'}, linkProvider, '('));
    context.subscriptions.push(linkProvider);
}

class LinkProvider implements CompletionItemProvider {
    constructor() {
        // TODO: Cache workspace files
        // TODO: Update cache when workspace file is saved (`workspace.onDidSaveTextDocument`)
    }

    async provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext) {
        const check = document.getText(new Range(position.translate(0, -2), position));
        // Bail if we're not within the context of the target reference portion of a MarkDown link.
        if (check !== '](') {
            return;
        }

        const files = await workspace.findFiles('**/*.*', undefined); // Exclude default exclusions using `undefined`
        const items: CompletionItem[] = [];
        for (const file of files) {
            if (file.scheme !== 'file') {
                return;
            }

            const filePath = file.fsPath.substring(workspace.getWorkspaceFolder(Uri.file(file.fsPath))!.uri.fsPath.length + 1);
            const { name, ext } = path.parse(filePath);
            const fileName = name + ext;
            const fileItem = new CompletionItem(fileName, CompletionItemKind.File);
            fileItem.detail = fileName;
            fileItem.documentation = filePath;
            fileItem.sortText = filePath;
            fileItem.filterText = filePath;
            items.push(fileItem);

            if (file.fsPath.endsWith('.md')) {
                const textDocument = await workspace.openTextDocument(file);
                const lines = textDocument.getText().split(/\r|\n/).filter(line => line.trim().startsWith('#'));
                for (const line of lines) {
                    const header = this.strip(line);
                    const anchor = header.toLowerCase().replace(/\s/g, '-');
                    const headerItem = new CompletionItem(`${header} (${fileName})`, CompletionItemKind.Reference);
                    headerItem.detail = header;
                    headerItem.documentation = filePath;
                    headerItem.insertText = filePath + '#' + anchor;
                    headerItem.sortText = filePath + ' ' + anchor;
                    headerItem.filterText = filePath + ' ' + header + ' ' + anchor;
                    items.push(headerItem);
                }
            }
        }

        return items;
    }

    strip(line: string) {
        try {
            const dom = MarkDownDOM.parse(line);
            let header = '';

            const block = dom.blocks[0];
            if (block.type !== 'header') {
                throw new Error('Not a header block!');
            }

            for (const span of block.spans) {
                switch (span.type) {
                    case 'run': header += span.text; break;
                    case 'link': header += span.text; break;
                    default: {
                        // TODO: Telemetry.
                    }
                }
            }
            
            return header.trim();
        } catch (error) {
            let header = line.substring(line.indexOf('# ') + '# '.length);
    
            // Remove link.
            if (header.startsWith('[')) {
                header = header.substring('['.length, header.indexOf(']'));
            }

            return header;
        }
    }

    dispose() {
        // TODO: Dispose of the cache.
    }
}
