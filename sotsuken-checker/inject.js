// このスクリプトはページのコンテキストで実行される

function getCode() {
    // mainオブジェクトが利用可能になるまで待つ
    if (typeof main !== 'undefined' && main.code) {
        // 取得したcodeをDOMに埋め込む
        const container = document.createElement('div');
        container.id = 'sotsuken-checker-code-container';
        container.dataset.code = main.code;
        document.body.appendChild(container);
    } else {
        // まだ利用できない場合は少し待ってリトライ
        setTimeout(getCode, 100);
    }
}

getCode();
