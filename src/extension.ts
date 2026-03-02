import * as vscode from 'vscode';
import { runOption1, runOption2 } from './modules';

const VIEW_ID = 'aicode-tools.mainView';

/** 侧边栏树节点 */
class OptionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly optionId: '1' | '2'
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: optionId === '1' ? 'aicode-tools.selectOption1' : 'aicode-tools.selectOption2',
            title: this.label
        };
    }
}

/** 侧边栏树数据提供者 */
class MainViewProvider implements vscode.TreeDataProvider<OptionItem> {
    getChildren(): OptionItem[] {
        return [
            new OptionItem('提交检测工具', '1'),
            new OptionItem('选项2', '2')
        ];
    }

    getTreeItem(element: OptionItem): vscode.TreeItem {
        return element;
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('AICode Tools 插件已激活');

    const treeDataProvider = new MainViewProvider();
    const treeView = vscode.window.createTreeView(VIEW_ID, {
        treeDataProvider
    });

    const cmd1 = vscode.commands.registerCommand('aicode-tools.selectOption1', runOption1);
    const cmd2 = vscode.commands.registerCommand('aicode-tools.selectOption2', runOption2);

    context.subscriptions.push(treeView, cmd1, cmd2);
}

export function deactivate() {
    console.log('AICode Tools 插件已停用');
}
